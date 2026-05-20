#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const storeSecrets = args.has('--store-secrets');
const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID?.trim() || 'orbit-ledger-f41c2';
const requiredEnv = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN',
];

const commands = [
  {
    label: 'signed Live Collections webhook boundary smoke',
    command: 'npm',
    args: ['run', 'smoke:razorpay-live-collections-webhook'],
  },
  {
    label: 'authenticated Razorpay checkout creation smoke',
    command: 'npm',
    args: ['run', 'smoke:razorpay-checkout:connected'],
  },
  {
    label: 'signed capture reconciliation smoke',
    command: 'npm',
    args: ['run', 'smoke:razorpay-capture'],
  },
];

function main() {
  validateEnvironment();

  if (storeSecrets) {
    runCommand({
      label: 'store Razorpay test credentials in Firebase Secret Manager',
      command: 'npm',
      args: ['run', 'setup:razorpay-test-keys'],
    });
  }

  for (const command of commands) {
    runCommand(command);
  }

  console.log('PASS: controlled Razorpay sandbox smoke sequence completed.');
  console.log('Next manual step: pay the created Razorpay test payment link, then verify Orbit Ledger notification, receipt, allocation, customer balance, and audit records.');
}

function validateEnvironment() {
  const missing = requiredEnv.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      [
        'Controlled Razorpay sandbox run is blocked because required local environment variables are missing:',
        ...missing.map((name) => `- ${name}`),
        '',
        'No secret values were printed. Load test credentials locally and rerun this command.',
      ].join('\n')
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';
  if (!keyId.startsWith('rzp_test_')) {
    throw new Error('Controlled sandbox run requires a Razorpay test key id that starts with rzp_test_.');
  }
  if (!isUsableSecret(keySecret)) {
    throw new Error('RAZORPAY_KEY_SECRET must be a real Razorpay test secret, not a placeholder.');
  }
  if (!isUsableSecret(webhookSecret)) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET must be a real Razorpay test webhook secret, not a placeholder.');
  }

  console.log(`Controlled Razorpay sandbox target project: ${projectId}`);
  console.log('PASS: local Razorpay test environment is present without printing secrets.');
}

function isUsableSecret(value) {
  const normalized = value.trim().toLowerCase();
  return value.trim().length >= 16 && !['not_configured', 'placeholder', 'todo', 'changeme'].includes(normalized);
}

function runCommand({ label, command, args: commandArgs }) {
  console.log(`Running ${label}...`);
  const result = spawnSync(command, commandArgs, {
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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
