import { describe, expect, it } from 'vitest';

import { buildLiveCollectionsPhase15Gate } from './liveCollectionsPhaseGate';

const readyReadiness = {
  status: 'ready_for_real_test_payment' as const,
  readyForSandboxPayment: true,
  readyForLivePilot: false,
  blockers: ['Duplicate webhook smoke passed', 'Refund smoke passed', 'Manual Razorpay test payment passed'],
};

const readyCredentials = {
  razorpayKeyIdMode: 'test' as const,
  razorpayKeySecretUsable: true,
  razorpayWebhookSecretUsable: true,
  firestoreAdminTokenAvailable: true,
};

describe('live collections phase 15 gate', () => {
  it('blocks Phase 15 when server-side Razorpay test credentials are not ready', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: {
        razorpayKeyIdMode: 'invalid_or_unknown',
        razorpayKeySecretUsable: false,
        razorpayWebhookSecretUsable: false,
        firestoreAdminTokenAvailable: true,
      },
      readiness: readyReadiness,
    });

    expect(gate).toMatchObject({
      status: 'blocked_missing_test_credentials',
      canStoreTestSecrets: true,
      canPrepareCheckout: false,
      canProceedToLivePilot: false,
    });
    expect(gate.blockers).toContain('RAZORPAY_KEY_ID must be a Razorpay test key that starts with rzp_test_.');
    expect(gate.message).not.toMatch(/browser/i);
  });

  it('blocks checkout preparation until signed smoke readiness is complete', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: readyCredentials,
      readiness: {
        status: 'ready_for_signed_smoke',
        readyForSandboxPayment: false,
        readyForLivePilot: false,
        blockers: ['Checkout smoke passed'],
      },
    });

    expect(gate).toMatchObject({
      status: 'blocked_readiness_incomplete',
      canPrepareCheckout: false,
      canVerifyManualPayment: false,
    });
    expect(gate.operatorActions).toContain('Run connected checkout smoke.');
  });

  it('allows preparing a kept checkout only after credentials and sandbox readiness are ready', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: readyCredentials,
      readiness: readyReadiness,
    });

    expect(gate).toMatchObject({
      status: 'ready_to_prepare_payment_proof',
      canPrepareCheckout: true,
      canVerifyManualPayment: false,
      canProceedToLivePilot: false,
    });
    expect(gate.message).toContain('browser still does not decide payment success');
  });

  it('waits for captured payment, duplicate webhook, and refund proof after checkout preparation', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: readyCredentials,
      readiness: readyReadiness,
      proofState: {
        checkoutPrepared: true,
        manualPaymentVerified: true,
      },
    });

    expect(gate).toMatchObject({
      status: 'waiting_for_manual_test_payment',
      canPrepareCheckout: false,
      canVerifyManualPayment: true,
      canProceedToLivePilot: false,
    });
    expect(gate.blockers).toEqual([
      'Duplicate webhook proof must confirm no duplicate transaction or allocation.',
      'Refund proof must confirm reversal records and recalculated invoice balance.',
    ]);
  });

  it('allows live-pilot review only after sandbox proof and readiness are complete', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: readyCredentials,
      readiness: {
        status: 'ready_for_live_pilot',
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
    });

    expect(gate).toMatchObject({
      status: 'ready_for_live_pilot_review',
      canProceedToLivePilot: true,
      blockers: [],
    });
    expect(gate.operatorActions).toContain('Open live pilot only after explicit approval.');
  });
});
