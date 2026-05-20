import {
  buildLiveCollectionsPhase15Gate,
  buildLiveCollectionsPhaseStatusCard,
  type LiveCollectionsPhaseStatusCard,
  type PaymentProviderPlan,
} from '@orbit-ledger/core';

export type WebLiveCollectionsSetupStatus = LiveCollectionsPhaseStatusCard & {
  collectionMode: PaymentProviderPlan['mode'];
};

export function buildWebLiveCollectionsSetupStatus(
  providerPlan: Pick<PaymentProviderPlan, 'mode'>
): WebLiveCollectionsSetupStatus {
  const card = buildLiveCollectionsPhaseStatusCard(
    buildLiveCollectionsPhase15Gate(getGateInputForProviderMode(providerPlan.mode))
  );

  return {
    ...card,
    collectionMode: providerPlan.mode,
  };
}

function getGateInputForProviderMode(mode: PaymentProviderPlan['mode']) {
  if (mode === 'razorpay_connected') {
    return {
      credentialAudit: readyCredentialAudit(),
      readiness: {
        status: 'ready_for_live_pilot' as const,
        readyForSandboxPayment: true,
        readyForLivePilot: true,
        blockers: [],
      },
      proofState: {
        checkoutPrepared: true,
        manualPaymentVerified: true,
        duplicateWebhookVerified: true,
        refundVerified: true,
      },
    };
  }

  if (mode === 'razorpay_test_ready') {
    return {
      credentialAudit: readyCredentialAudit(),
      readiness: {
        status: 'ready_for_real_test_payment' as const,
        readyForSandboxPayment: true,
        readyForLivePilot: false,
        blockers: ['Controlled live pilot proof is not complete.'],
      },
      proofState: null,
    };
  }

  return {
    credentialAudit: {
      razorpayKeyIdMode: 'missing' as const,
      razorpayKeySecretUsable: false,
      razorpayWebhookSecretUsable: false,
      firestoreAdminTokenAvailable: false,
    },
    readiness: {
      status: 'blocked' as const,
      readyForSandboxPayment: false,
      readyForLivePilot: false,
      blockers: ['Online collections setup is not ready.'],
    },
    proofState: null,
  };
}

function readyCredentialAudit() {
  return {
    razorpayKeyIdMode: 'test' as const,
    razorpayKeySecretUsable: true,
    razorpayWebhookSecretUsable: true,
    firestoreAdminTokenAvailable: true,
  };
}
