import { describe, expect, it } from 'vitest';

import {
  buildLiveCollectionsPhase15Gate,
  buildLiveCollectionsPhaseStatusCard,
  type LiveCollectionsPhaseStatusCard,
} from './liveCollectionsPhaseGate';

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

describe('live collections phase status card', () => {
  const secretNamePattern = /RAZORPAY_KEY_ID|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|secret manager/i;

  function expectUiSafe(card: LiveCollectionsPhaseStatusCard) {
    const combinedCopy = [
      card.badge,
      card.title,
      card.message,
      card.primaryActionLabel,
      card.secondaryActionLabel ?? '',
      ...card.detailItems,
    ].join('\n');

    expect(card).toMatchObject({
      id: 'online_collections',
      safeForCustomerUi: true,
      exposesSecrets: false,
      allowsPaymentMutation: false,
    });
    expect(combinedCopy).not.toMatch(secretNamePattern);
    expect(combinedCopy).not.toMatch(/browser decides|browser confirms|frontend confirms/i);
  }

  it('renders a UI-safe blocked setup card without exposing secret names', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: {
        razorpayKeyIdMode: 'missing',
        razorpayKeySecretUsable: false,
        razorpayWebhookSecretUsable: false,
        firestoreAdminTokenAvailable: false,
      },
      readiness: readyReadiness,
    });

    const card = buildLiveCollectionsPhaseStatusCard(gate);

    expect(card).toMatchObject({
      status: 'blocked_missing_test_credentials',
      tone: 'blocked',
      badge: 'Setup required',
      primaryActionLabel: 'Review setup',
    });
    expect(card.message).toContain('Online payment links stay off');
    expect(card.message).toContain('Manual UPI and bank details remain available');
    expectUiSafe(card);
  });

  it('renders a UI-safe readiness-check card for incomplete backend checks', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: readyCredentials,
      readiness: {
        status: 'ready_for_signed_smoke',
        readyForSandboxPayment: false,
        readyForLivePilot: false,
        blockers: ['Checkout smoke passed'],
      },
    });

    const card = buildLiveCollectionsPhaseStatusCard(gate);

    expect(card).toMatchObject({
      status: 'blocked_readiness_incomplete',
      tone: 'warning',
      badge: 'Checks pending',
      primaryActionLabel: 'Review checks',
    });
    expect(card.detailItems).toContain('Invoice paid status remains allocation-derived.');
    expectUiSafe(card);
  });

  it('renders a UI-safe test preparation card that keeps browser success non-authoritative', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: readyCredentials,
      readiness: readyReadiness,
    });

    const card = buildLiveCollectionsPhaseStatusCard(gate);

    expect(card).toMatchObject({
      status: 'ready_to_prepare_payment_proof',
      tone: 'ready',
      badge: 'Ready for test',
      primaryActionLabel: 'Prepare test proof',
    });
    expect(card.detailItems).toContain('The browser success screen is not payment authority.');
    expectUiSafe(card);
  });

  it('renders a UI-safe proof verification card for captured payment and refund evidence', () => {
    const gate = buildLiveCollectionsPhase15Gate({
      credentialAudit: readyCredentials,
      readiness: readyReadiness,
      proofState: {
        checkoutPrepared: true,
        manualPaymentVerified: true,
      },
    });

    const card = buildLiveCollectionsPhaseStatusCard(gate);

    expect(card).toMatchObject({
      status: 'waiting_for_manual_test_payment',
      tone: 'warning',
      badge: 'Proof pending',
      primaryActionLabel: 'Verify proof',
    });
    expect(card.detailItems).toContain('Duplicate webhook replay must not create duplicate money records.');
    expectUiSafe(card);
  });

  it('renders a UI-safe live pilot review card without granting payment mutation', () => {
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

    const card = buildLiveCollectionsPhaseStatusCard(gate);

    expect(card).toMatchObject({
      status: 'ready_for_live_pilot_review',
      tone: 'success',
      badge: 'Pilot review ready',
      primaryActionLabel: 'Review pilot checklist',
      allowsPaymentMutation: false,
    });
    expect(card.detailItems).toContain('Continue storing every automated payment update in audit history.');
    expectUiSafe(card);
  });
});
