import type { LiveCollectionsSandboxReadiness } from './liveCollectionsSandboxReadiness';

export type LiveCollectionsCredentialMode = 'missing' | 'test' | 'live' | 'invalid_or_unknown';

export type LiveCollectionsPhaseCredentialAudit = {
  razorpayKeyIdMode: LiveCollectionsCredentialMode;
  razorpayKeySecretUsable: boolean;
  razorpayWebhookSecretUsable: boolean;
  firestoreAdminTokenAvailable: boolean;
};

export type LiveCollectionsPhaseProofState = {
  checkoutPrepared?: boolean;
  manualPaymentVerified?: boolean;
  duplicateWebhookVerified?: boolean;
  refundVerified?: boolean;
};

export type LiveCollectionsPhase15Status =
  | 'blocked_missing_test_credentials'
  | 'blocked_readiness_incomplete'
  | 'ready_to_prepare_payment_proof'
  | 'waiting_for_manual_test_payment'
  | 'ready_for_live_pilot_review';

export type LiveCollectionsPhase15GateInput = {
  credentialAudit: LiveCollectionsPhaseCredentialAudit;
  readiness: Pick<LiveCollectionsSandboxReadiness, 'status' | 'readyForSandboxPayment' | 'readyForLivePilot' | 'blockers'>;
  proofState?: LiveCollectionsPhaseProofState | null;
};

export type LiveCollectionsPhase15Gate = {
  status: LiveCollectionsPhase15Status;
  title: string;
  message: string;
  canStoreTestSecrets: boolean;
  canPrepareCheckout: boolean;
  canVerifyManualPayment: boolean;
  canProceedToLivePilot: boolean;
  blockers: string[];
  operatorActions: string[];
};

export function buildLiveCollectionsPhase15Gate(input: LiveCollectionsPhase15GateInput): LiveCollectionsPhase15Gate {
  const credentialBlockers = getCredentialBlockers(input.credentialAudit);
  if (credentialBlockers.length > 0) {
    return {
      status: 'blocked_missing_test_credentials',
      title: 'Razorpay test credentials are not ready',
      message: 'Store real Razorpay test credentials in server-side secrets before preparing a sandbox payment proof.',
      canStoreTestSecrets: true,
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

  if (!input.readiness.readyForSandboxPayment) {
    return {
      status: 'blocked_readiness_incomplete',
      title: 'Sandbox proof is not ready',
      message: 'Complete signed webhook, checkout, and capture smoke before preparing a real Razorpay test payment.',
      canStoreTestSecrets: false,
      canPrepareCheckout: false,
      canVerifyManualPayment: false,
      canProceedToLivePilot: false,
      blockers: input.readiness.blockers,
      operatorActions: [
        'Run signed Live Collections webhook boundary smoke.',
        'Run connected checkout smoke.',
        'Run signed capture reconciliation smoke.',
      ],
    };
  }

  const proofState = input.proofState ?? {};
  if (!proofState.checkoutPrepared) {
    return {
      status: 'ready_to_prepare_payment_proof',
      title: 'Ready to prepare sandbox payment proof',
      message: 'Create a kept Razorpay test checkout and write a proof file. The browser still does not decide payment success.',
      canStoreTestSecrets: false,
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
      canStoreTestSecrets: false,
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
    canStoreTestSecrets: false,
    canPrepareCheckout: false,
    canVerifyManualPayment: false,
    canProceedToLivePilot: input.readiness.readyForLivePilot,
    blockers: input.readiness.readyForLivePilot ? [] : input.readiness.blockers,
    operatorActions: [
      'Review the sandbox proof file and audit records.',
      'Confirm monitoring, rollback, and support paths are staffed.',
      'Open live pilot only after explicit approval.',
    ],
  };
}

function getCredentialBlockers(audit: LiveCollectionsPhaseCredentialAudit): string[] {
  const blockers: string[] = [];
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

function getProofBlockers(proofState: LiveCollectionsPhaseProofState): string[] {
  const blockers: string[] = [];
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
