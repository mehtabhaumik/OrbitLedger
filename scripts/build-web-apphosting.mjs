import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const webRoot = path.join(repoRoot, 'apps', 'web');
const webNextDir = path.join(webRoot, '.next');
const webStandaloneDir = path.join(webNextDir, 'standalone');
const webStandaloneAppDir = path.join(webStandaloneDir, 'apps', 'web');
const rootNextDir = path.join(repoRoot, '.next');
const rootStandaloneDir = path.join(rootNextDir, 'standalone');

execFileSync('npm', ['run', 'build', '--workspace', '@orbit-ledger/web'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (!existsSync(webStandaloneDir) || !existsSync(webStandaloneAppDir)) {
  throw new Error('App Hosting build shaping failed: Next standalone output was not generated for apps/web.');
}

rmSync(rootNextDir, { recursive: true, force: true });
cpSync(webNextDir, rootNextDir, { recursive: true });

rmSync(rootStandaloneDir, { recursive: true, force: true });
mkdirSync(rootStandaloneDir, { recursive: true });
cpSync(webStandaloneDir, rootStandaloneDir, { recursive: true });

for (const entry of readdirSync(webStandaloneAppDir, { withFileTypes: true })) {
  cpSync(path.join(webStandaloneAppDir, entry.name), path.join(rootStandaloneDir, entry.name), {
    force: true,
    recursive: true,
  });
}

rmSync(path.join(rootStandaloneDir, 'apps'), { recursive: true, force: true });
