#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID?.trim() || 'orbit-ledger-f41c2';
const requiredSecrets = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];

function main() {
  const results = requiredSecrets.map(readSecretStatus);
  const authResult = readGcloudAuthStatus();
  const keyId = results.find((result) => result.name === 'RAZORPAY_KEY_ID');
  const blockers = [...results.flatMap((result) => result.blockers), ...authResult.blockers];

  console.log(`Razorpay secret mode audit project: ${projectId}`);
  for (const result of results) {
    console.log(`${result.name}: ${result.status}`);
  }
  console.log(`Firestore admin access token: ${authResult.status}`);

  if (keyId?.mode) {
    console.log(`RAZORPAY_KEY_ID mode: ${keyId.mode}`);
  }

  if (blockers.length > 0) {
    console.error('Razorpay secret mode audit blocked sandbox payment:');
    for (const blocker of blockers) {
      console.error(`- ${blocker}`);
    }
    process.exit(1);
  }

  console.log('PASS: Razorpay Secret Manager values are present and test-mode compatible.');
}

function readGcloudAuthStatus() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const token = result.stdout.trim();
  if (result.status !== 0 || !token) {
    return {
      status: 'missing_or_inaccessible',
      blockers: ['gcloud auth cannot provide an access token for controlled Firestore setup and cleanup.'],
    };
  }

  return { status: 'available', blockers: [] };
}

function readSecretStatus(name) {
  const result = spawnSync(
    'gcloud',
    ['secrets', 'versions', 'access', 'latest', `--secret=${name}`, `--project=${projectId}`],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  if (result.status !== 0) {
    return {
      name,
      status: 'missing_or_inaccessible',
      mode: null,
      blockers: [`${name} is missing or inaccessible in Firebase Secret Manager.`],
    };
  }

  const value = result.stdout.trim();
  if (!value) {
    return {
      name,
      status: 'empty',
      mode: null,
      blockers: [`${name} is empty.`],
    };
  }

  if (name === 'RAZORPAY_KEY_ID') {
    if (value.startsWith('rzp_test_')) {
      return { name, status: 'present', mode: 'test', blockers: [] };
    }
    if (value.startsWith('rzp_live_')) {
      return {
        name,
        status: 'present',
        mode: 'live',
        blockers: ['RAZORPAY_KEY_ID is a live key. Sandbox payment tests require rzp_test_.'],
      };
    }
    return {
      name,
      status: 'present',
      mode: 'invalid_or_unknown',
      blockers: ['RAZORPAY_KEY_ID is not a Razorpay test key. Store rzp_test_ credentials before running sandbox payment proof.'],
    };
  }

  if (value.length < 16 || ['placeholder', 'todo', 'not_configured', 'changeme'].includes(value.toLowerCase())) {
    return {
      name,
      status: 'placeholder_or_too_short',
      mode: null,
      blockers: [`${name} is not a usable test secret.`],
    };
  }

  return { name, status: 'present', mode: null, blockers: [] };
}

main();
