#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2';
const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? '';
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? '';

function main() {
  validateCredentials();
  setFirebaseSecret('RAZORPAY_KEY_ID', keyId);
  setFirebaseSecret('RAZORPAY_KEY_SECRET', keySecret);
  console.log('PASS: Razorpay test credentials were stored in Firebase Secret Manager.');
  console.log('Next: npm run smoke:razorpay-checkout:connected');
}

function validateCredentials() {
  if (!keyId || !keySecret) {
    throw new Error(
      [
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be provided as environment variables.',
        'Example:',
        '  RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx npm run setup:razorpay-test-keys',
      ].join('\n')
    );
  }

  if (!keyId.startsWith('rzp_test_')) {
    throw new Error('RAZORPAY_KEY_ID must be a Razorpay test key and should start with rzp_test_.');
  }

  if (['not_configured', 'placeholder', 'todo'].includes(keySecret.toLowerCase()) || keySecret.length < 16) {
    throw new Error('RAZORPAY_KEY_SECRET must be the real Razorpay test key secret, not a placeholder.');
  }
}

function setFirebaseSecret(name, value) {
  const result = spawnSync(
    'npx',
    ['-y', 'firebase-tools@latest', 'functions:secrets:set', name, '--project', projectId],
    {
      input: value,
      encoding: 'utf8',
      stdio: ['pipe', 'inherit', 'inherit'],
    }
  );

  if (result.status !== 0) {
    throw new Error(`${name} could not be stored in Firebase Secret Manager.`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
