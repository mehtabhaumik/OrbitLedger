#!/usr/bin/env node

/**
 * Starts the Firebase emulators used by the visual-baseline suite.
 *
 * Exists because firebase-tools >= 15 requires Java 21+, while a machine can
 * easily have an older JDK first on PATH (Homebrew keeps openjdk keg-only, so
 * an installed 21 is often not the default `java`). Rather than fail with
 * "Java version before 21", this locates a suitable JDK and points the
 * emulators at it.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const MIN_JAVA_VERSION = 21;
const FIREBASE_TOOLS = 'firebase-tools@15.18.0';
const PROJECT_ID = process.env.ORBIT_LEDGER_EMULATOR_PROJECT || 'orbit-ledger-emulator';
// Functions are included so the workspace/session/offer endpoints the app calls
// on load resolve locally instead of failing against a real cloudfunctions.net
// host, which would leave signed-in screens partially empty.
const EMULATORS = process.env.ORBIT_LEDGER_EMULATORS || 'auth,firestore,storage,functions';

function javaMajor(javaBin) {
  // `java -version` prints to stderr, not stdout, so both streams are read.
  const result = spawnSync(javaBin, ['-version'], { encoding: 'utf8' });
  if (result.error) {
    return 0;
  }
  return parseVersion(`${result.stderr || ''}${result.stdout || ''}`);
}

function parseVersion(text) {
  const match = text.match(/version "(\d+)(?:\.(\d+))?/);
  if (!match) return 0;
  const major = Number(match[1]);
  // Java 8 and earlier report as 1.8.x - the second component is the real major.
  return major === 1 ? Number(match[2] || 0) : major;
}

function findJavaHome() {
  const candidates = [];

  if (process.env.JAVA_HOME) {
    candidates.push(process.env.JAVA_HOME);
  }

  // Homebrew keeps JDKs keg-only, so they are installed but not on PATH.
  for (const version of [25, 24, 23, 22, 21]) {
    candidates.push(`/opt/homebrew/opt/openjdk@${version}`);
    candidates.push(`/usr/local/opt/openjdk@${version}`);
  }

  for (const home of candidates) {
    const bin = `${home}/bin/java`;
    if (existsSync(bin) && javaMajor(bin) >= MIN_JAVA_VERSION) {
      return home;
    }
  }

  // macOS registry, which knows about JDKs installed outside Homebrew.
  try {
    const home = execFileSync('/usr/libexec/java_home', ['-v', `${MIN_JAVA_VERSION}+`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (home && javaMajor(`${home}/bin/java`) >= MIN_JAVA_VERSION) {
      return home;
    }
  } catch {
    // No matching JDK registered; fall through to the PATH check.
  }

  return javaMajor('java') >= MIN_JAVA_VERSION ? null : undefined;
}

const javaHome = findJavaHome();

if (javaHome === undefined) {
  console.error(
    [
      `The Firebase emulators need Java ${MIN_JAVA_VERSION} or newer, and none was found.`,
      '',
      'Install one, then rerun:',
      '  macOS:  brew install openjdk@21',
      '  Linux:  sudo apt install openjdk-21-jdk',
      '',
      'If a suitable JDK is already installed somewhere unusual, set JAVA_HOME to it.',
    ].join('\n')
  );
  process.exit(1);
}

const env = { ...process.env };

// The functions emulator enforces its own admin allowlist, separately from the
// client-side NEXT_PUBLIC_* one. Without this, getPlatformAdminSnapshot returns
// 403 and the platform console renders "Internal access only" - so the visual
// baselines would capture a restricted screen instead of the real 3,600-line
// admin surface the reskin needs to cover.
env.ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS =
  process.env.ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS || 'qa.owner@orbit-ledger.test';

if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${javaHome}/bin:${env.PATH}`;
  console.log(`Using Java from ${javaHome}`);
}

const child = spawn(
  'npx',
  ['-y', FIREBASE_TOOLS, 'emulators:start', '--project', PROJECT_ID, '--only', EMULATORS],
  { stdio: 'inherit', env }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
