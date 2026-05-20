#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID?.trim() || 'orbit-ledger-f41c2';
const proofFile =
  args.proofFile ||
  process.env.ORBIT_LEDGER_RAZORPAY_SANDBOX_PROOF_FILE ||
  'artifacts/razorpay-sandbox-payment-proof.json';
const pollSeconds = Number(args.pollSeconds ?? 0);
const storeSecrets = Boolean(args.storeSecrets);
const verifyOnly = Boolean(args.verifyOnly);
const prepareOnly = Boolean(args.prepareOnly);

const requiredEnv = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN',
];

async function main() {
  validateEnvironment();
  console.log(`Razorpay sandbox payment run target project: ${projectId}`);
  console.log(`Proof file: ${proofFile}`);

  if (verifyOnly) {
    await verifyProof();
    return;
  }

  if (storeSecrets) {
    runCommand('store Razorpay test credentials', ['run', 'setup:razorpay-test-keys']);
  }

  runCommand('signed Live Collections webhook boundary smoke', ['run', 'smoke:razorpay-live-collections-webhook']);
  runCommand('create kept Razorpay sandbox checkout', [
    'run',
    'smoke:razorpay-checkout:connected',
    '--',
    '--keep',
    `--proof-file=${proofFile}`,
  ]);

  const proof = await readProofFile();
  console.log('Manual Razorpay sandbox payment required.');
  console.log(`Open checkout URL: ${proof.checkoutUrl}`);
  console.log('After paying with a Razorpay test method, run:');
  console.log(`  ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=... npm run live-collections:razorpay-sandbox-payment -- --verify-only --proof-file=${proofFile}`);

  if (prepareOnly || pollSeconds <= 0) {
    return;
  }

  await pollForProof(pollSeconds);
}

async function pollForProof(timeoutSeconds) {
  const startedAt = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  while (Date.now() - startedAt <= timeoutMs) {
    const result = spawnSync('npm', ['run', 'proof:razorpay-sandbox-payment', '--', `--proof-file=${proofFile}`], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ORBIT_LEDGER_FIREBASE_PROJECT_ID: projectId,
      },
      encoding: 'utf8',
    });

    if (result.status === 0) {
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      console.log('PASS: manual Razorpay sandbox payment was verified during polling.');
      return;
    }

    await sleep(10_000);
  }

  throw new Error(`Manual Razorpay sandbox payment was not verified within ${timeoutSeconds} seconds.`);
}

async function verifyProof() {
  runCommand('verify Razorpay sandbox payment proof', ['run', 'proof:razorpay-sandbox-payment', '--', `--proof-file=${proofFile}`]);
}

async function readProofFile() {
  const proof = JSON.parse(await readFile(proofFile, 'utf8'));
  if (!proof.checkoutUrl || typeof proof.checkoutUrl !== 'string') {
    throw new Error('Proof file was created but checkoutUrl is missing.');
  }
  return proof;
}

function validateEnvironment() {
  const requiredNames = verifyOnly ? ['ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN'] : requiredEnv;
  const missing = requiredNames.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      [
        'Razorpay sandbox payment run is blocked because required local environment variables are missing:',
        ...missing.map((name) => `- ${name}`),
        '',
        verifyOnly
          ? 'No secret values were printed. Load the Firestore admin setup token locally to verify the sandbox payment proof.'
          : 'No secret values were printed. Load real Razorpay test credentials and the Firestore admin setup token locally.',
      ].join('\n')
    );
  }

  if (verifyOnly) {
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';
  if (!keyId.startsWith('rzp_test_')) {
    throw new Error('Razorpay sandbox payment run refuses non-test keys. RAZORPAY_KEY_ID must start with rzp_test_.');
  }
  if (!isUsableSecret(keySecret)) {
    throw new Error('RAZORPAY_KEY_SECRET must be a real Razorpay test secret, not a placeholder.');
  }
  if (!isUsableSecret(webhookSecret)) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET must be a real Razorpay test webhook secret, not a placeholder.');
  }
}

function isUsableSecret(value) {
  const normalized = value.trim().toLowerCase();
  return value.trim().length >= 16 && !['not_configured', 'placeholder', 'todo', 'changeme'].includes(normalized);
}

function runCommand(label, commandArgs) {
  console.log(`Running ${label}...`);
  const result = spawnSync('npm', commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ORBIT_LEDGER_FIREBASE_PROJECT_ID: projectId,
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed.`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(values) {
  const parsed = {
    proofFile: null,
    pollSeconds: null,
    storeSecrets: false,
    verifyOnly: false,
    prepareOnly: false,
  };
  for (const value of values) {
    if (value === '--store-secrets') {
      parsed.storeSecrets = true;
    } else if (value === '--verify-only') {
      parsed.verifyOnly = true;
    } else if (value === '--prepare-only') {
      parsed.prepareOnly = true;
    } else if (value.startsWith('--proof-file=')) {
      parsed.proofFile = value.slice('--proof-file='.length).trim();
    } else if (value.startsWith('--poll-seconds=')) {
      parsed.pollSeconds = value.slice('--poll-seconds='.length).trim();
    }
  }
  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
