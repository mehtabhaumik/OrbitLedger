#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID?.trim() || 'orbit-ledger-f41c2';
const proofFile =
  args.proofFile ||
  process.env.ORBIT_LEDGER_RAZORPAY_SANDBOX_PROOF_FILE ||
  'artifacts/razorpay-sandbox-payment-proof.json';

function main() {
  const credentialAudit = readCredentialAudit();
  const proofState = readProofState();
  const readiness = readReadiness();
  const gate = buildGate({ credentialAudit, proofState, readiness });

  console.log(`Live Collections phase gate project: ${projectId}`);
  console.log(`Status: ${gate.status}`);
  console.log(`Title: ${gate.title}`);
  console.log(`Message: ${gate.message}`);
  console.log(`Proof file: ${proofFile}`);
  console.log(`Can prepare checkout: ${gate.canPrepareCheckout ? 'yes' : 'no'}`);
  console.log(`Can verify manual payment: ${gate.canVerifyManualPayment ? 'yes' : 'no'}`);
  console.log(`Can proceed to live pilot: ${gate.canProceedToLivePilot ? 'yes' : 'no'}`);

  if (gate.blockers.length > 0) {
    console.log('Blockers:');
    for (const blocker of gate.blockers) {
      console.log(`- ${blocker}`);
    }
  }

  console.log('Operator actions:');
  for (const action of gate.operatorActions) {
    console.log(`- ${action}`);
  }

  if (args.failOnBlocked && gate.status.startsWith('blocked_')) {
    process.exit(1);
  }
}

function readCredentialAudit() {
  const keyId = readSecret('RAZORPAY_KEY_ID');
  const keySecret = readSecret('RAZORPAY_KEY_SECRET');
  const webhookSecret = readSecret('RAZORPAY_WEBHOOK_SECRET');
  return {
    razorpayKeyIdMode: getKeyIdMode(keyId.value),
    razorpayKeySecretUsable: keySecret.exists && isUsableSecret(keySecret.value),
    razorpayWebhookSecretUsable: webhookSecret.exists && isUsableSecret(webhookSecret.value),
    firestoreAdminTokenAvailable: hasGcloudAccessToken(),
  };
}

function readReadiness() {
  const baseBlockers = [];
  if (!args.signedWebhookSmokePassed) {
    baseBlockers.push('Signed webhook boundary smoke passed');
  }
  if (!args.checkoutSmokePassed) {
    baseBlockers.push('Checkout smoke passed');
  }
  if (!args.signedCaptureSmokePassed) {
    baseBlockers.push('Signed capture webhook smoke passed');
  }

  const liveBlockers = [];
  if (!args.duplicateWebhookVerified) {
    liveBlockers.push('Duplicate webhook proof must confirm no duplicate transaction or allocation.');
  }
  if (!args.refundVerified) {
    liveBlockers.push('Refund proof must confirm reversal records and recalculated invoice balance.');
  }
  if (!args.manualPaymentVerified) {
    liveBlockers.push('Manual Razorpay test payment proof must verify captured payment and ledger reconciliation.');
  }

  const readyForSandboxPayment = baseBlockers.length === 0;
  const readyForLivePilot = readyForSandboxPayment && liveBlockers.length === 0;
  return {
    readyForSandboxPayment,
    readyForLivePilot,
    blockers: readyForSandboxPayment ? liveBlockers : baseBlockers,
  };
}

function readProofState() {
  const checkoutPreparedFromFile = proofFileHasCheckout(proofFile);
  return {
    checkoutPrepared: checkoutPreparedFromFile || args.checkoutPrepared,
    manualPaymentVerified: args.manualPaymentVerified,
    duplicateWebhookVerified: args.duplicateWebhookVerified,
    refundVerified: args.refundVerified,
  };
}

function buildGate({ credentialAudit, readiness, proofState }) {
  const credentialBlockers = getCredentialBlockers(credentialAudit);
  if (credentialBlockers.length > 0) {
    return {
      status: 'blocked_missing_test_credentials',
      title: 'Razorpay test credentials are not ready',
      message: 'Store real Razorpay test credentials in server-side secrets before preparing a sandbox payment proof.',
      canPrepareCheckout: false,
      canVerifyManualPayment: false,
      canProceedToLivePilot: false,
      blockers: credentialBlockers,
      operatorActions: [
        'Store rzp_test_ key id, key secret, and webhook secret in Firebase Secret Manager.',
        'Run npm run audit:razorpay-secret-mode.',
        'Do not run checkout proof until the secret mode audit passes.',
      ],
    };
  }

  if (!readiness.readyForSandboxPayment) {
    return {
      status: 'blocked_readiness_incomplete',
      title: 'Sandbox proof is not ready',
      message: 'Complete signed webhook, checkout, and capture smoke before preparing a real Razorpay test payment.',
      canPrepareCheckout: false,
      canVerifyManualPayment: false,
      canProceedToLivePilot: false,
      blockers: readiness.blockers,
      operatorActions: [
        'Run signed Live Collections webhook boundary smoke.',
        'Run connected checkout smoke.',
        'Run signed capture reconciliation smoke.',
      ],
    };
  }

  if (!proofState.checkoutPrepared) {
    return {
      status: 'ready_to_prepare_payment_proof',
      title: 'Ready to prepare sandbox payment proof',
      message: 'Create a kept Razorpay test checkout and write a proof file. The browser still does not decide payment success.',
      canPrepareCheckout: true,
      canVerifyManualPayment: false,
      canProceedToLivePilot: false,
      blockers: [],
      operatorActions: [
        'Run npm run live-collections:razorpay-sandbox-payment with real test credentials.',
        'Open the generated Razorpay test checkout URL.',
        'Pay with a Razorpay test method, then verify backend reconciliation.',
      ],
    };
  }

  const proofBlockers = getProofBlockers(proofState);
  if (proofBlockers.length > 0) {
    return {
      status: 'waiting_for_manual_test_payment',
      title: 'Waiting for sandbox payment proof verification',
      message: 'Verify the paid checkout, duplicate webhook handling, and refund path before live-pilot review.',
      canPrepareCheckout: false,
      canVerifyManualPayment: true,
      canProceedToLivePilot: false,
      blockers: proofBlockers,
      operatorActions: [
        'Verify the proof file after the Razorpay test payment is captured.',
        'Replay the webhook and confirm no duplicate allocation.',
        'Create a test refund and confirm reversal records.',
      ],
    };
  }

  return {
    status: 'ready_for_live_pilot_review',
    title: 'Ready for controlled live-pilot review',
    message: 'Sandbox proof is complete. Live rollout still requires explicit operator approval and monitoring.',
    canPrepareCheckout: false,
    canVerifyManualPayment: false,
    canProceedToLivePilot: readiness.readyForLivePilot,
    blockers: readiness.readyForLivePilot ? [] : readiness.blockers,
    operatorActions: [
      'Review the sandbox proof file and audit records.',
      'Confirm monitoring, rollback, and support paths are staffed.',
      'Open live pilot only after explicit approval.',
    ],
  };
}

function readSecret(name) {
  const result = spawnSync(
    'gcloud',
    ['secrets', 'versions', 'access', 'latest', `--secret=${name}`, `--project=${projectId}`],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return {
    exists: result.status === 0,
    value: result.status === 0 ? result.stdout.trim() : '',
  };
}

function hasGcloudAccessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 && Boolean(result.stdout.trim());
}

function getKeyIdMode(value) {
  if (!value) {
    return 'missing';
  }
  if (value.startsWith('rzp_test_')) {
    return 'test';
  }
  if (value.startsWith('rzp_live_')) {
    return 'live';
  }
  return 'invalid_or_unknown';
}

function isUsableSecret(value) {
  const normalized = value.trim().toLowerCase();
  return value.trim().length >= 16 && !['not_configured', 'placeholder', 'todo', 'changeme'].includes(normalized);
}

function proofFileHasCheckout(file) {
  if (!existsSync(file)) {
    return false;
  }
  try {
    const proof = JSON.parse(readFileSync(file, 'utf8'));
    return Boolean(proof.checkoutUrl && proof.checkoutId && proof.invoiceId && proof.workspaceId);
  } catch {
    return false;
  }
}

function getCredentialBlockers(audit) {
  const blockers = [];
  if (audit.razorpayKeyIdMode !== 'test') {
    blockers.push('RAZORPAY_KEY_ID must be a Razorpay test key that starts with rzp_test_.');
  }
  if (!audit.razorpayKeySecretUsable) {
    blockers.push('RAZORPAY_KEY_SECRET must be a usable server-side test secret.');
  }
  if (!audit.razorpayWebhookSecretUsable) {
    blockers.push('RAZORPAY_WEBHOOK_SECRET must be a usable server-side test webhook secret.');
  }
  if (!audit.firestoreAdminTokenAvailable) {
    blockers.push('Firestore admin access token must be available for controlled setup and cleanup.');
  }
  return blockers;
}

function getProofBlockers(proofState) {
  const blockers = [];
  if (!proofState.manualPaymentVerified) {
    blockers.push('Manual Razorpay test payment proof must verify captured payment and ledger reconciliation.');
  }
  if (!proofState.duplicateWebhookVerified) {
    blockers.push('Duplicate webhook proof must confirm no duplicate transaction or allocation.');
  }
  if (!proofState.refundVerified) {
    blockers.push('Refund proof must confirm reversal records and recalculated invoice balance.');
  }
  return blockers;
}

function parseArgs(values) {
  const flags = new Set(values);
  const proofFileArg = values.find((value) => value.startsWith('--proof-file='));
  return {
    proofFile: proofFileArg ? proofFileArg.slice('--proof-file='.length).trim() : '',
    failOnBlocked: flags.has('--fail-on-blocked'),
    checkoutPrepared: flags.has('--checkout-prepared'),
    signedWebhookSmokePassed: flags.has('--signed-webhook-smoke-passed'),
    checkoutSmokePassed: flags.has('--checkout-smoke-passed'),
    signedCaptureSmokePassed: flags.has('--signed-capture-smoke-passed'),
    manualPaymentVerified: flags.has('--manual-payment-verified'),
    duplicateWebhookVerified: flags.has('--duplicate-webhook-verified'),
    refundVerified: flags.has('--refund-verified'),
  };
}

main();
