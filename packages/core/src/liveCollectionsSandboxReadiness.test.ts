import { describe, expect, it } from 'vitest';

import { buildLiveCollectionsSandboxReadiness } from './liveCollectionsSandboxReadiness';

const readyUrls = {
  checkoutUrl: 'https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/createRazorpayCheckout',
  webhookUrl: 'https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/razorpayLiveCollectionsWebhook',
  publicAppUrl: 'https://orbit-ledger-f41c2.web.app',
  hostedPaymentPageUrl: 'https://orbit-ledger-f41c2.web.app/pay',
};

describe('live collections sandbox readiness', () => {
  it('blocks sandbox traffic until endpoints, secrets, and matrix checks are ready', () => {
    const readiness = buildLiveCollectionsSandboxReadiness({
      ...readyUrls,
      hasRazorpayKeyId: true,
      hasRazorpayKeySecret: false,
      hasRazorpayWebhookSecret: true,
      failureMatrixBlockers: ['Duplicate QA scenario id: captured-payment'],
    });

    expect(readiness).toMatchObject({
      status: 'blocked',
      readyForSandboxPayment: false,
      readyForLivePilot: false,
    });
    expect(readiness.blockers).toContain('Razorpay key secret stored in server secret');
    expect(readiness.blockers).toContain('Duplicate QA scenario id: captured-payment');
  });

  it('allows signed smoke only after the server-side setup is complete', () => {
    const readiness = buildLiveCollectionsSandboxReadiness({
      ...readyUrls,
      hasRazorpayKeyId: true,
      hasRazorpayKeySecret: true,
      hasRazorpayWebhookSecret: true,
      failureMatrixBlockers: [],
    });

    expect(readiness).toMatchObject({
      status: 'ready_for_signed_smoke',
      readyForSandboxPayment: false,
      readyForLivePilot: false,
    });
    expect(readiness.blockers).toEqual([
      'Signed webhook boundary smoke passed',
      'Checkout smoke passed',
      'Signed capture webhook smoke passed',
    ]);
  });

  it('allows a real sandbox payment only after checkout and capture smoke pass', () => {
    const readiness = buildLiveCollectionsSandboxReadiness({
      ...readyUrls,
      hasRazorpayKeyId: true,
      hasRazorpayKeySecret: true,
      hasRazorpayWebhookSecret: true,
      signedWebhookBoundarySmokePassed: true,
      checkoutSmokePassed: true,
      signedCaptureSmokePassed: true,
      failureMatrixBlockers: [],
    });

    expect(readiness).toMatchObject({
      status: 'ready_for_real_test_payment',
      readyForSandboxPayment: true,
      readyForLivePilot: false,
    });
    expect(readiness.blockers).toEqual([
      'Duplicate webhook smoke passed',
      'Refund smoke passed',
      'Manual Razorpay test payment passed',
    ]);
  });

  it('allows controlled live pilot only after duplicate, refund, and manual payment proofs pass', () => {
    const readiness = buildLiveCollectionsSandboxReadiness({
      ...readyUrls,
      hasRazorpayKeyId: true,
      hasRazorpayKeySecret: true,
      hasRazorpayWebhookSecret: true,
      signedWebhookBoundarySmokePassed: true,
      checkoutSmokePassed: true,
      signedCaptureSmokePassed: true,
      duplicateWebhookSmokePassed: true,
      refundSmokePassed: true,
      manualRazorpayTestPaymentPassed: true,
      failureMatrixBlockers: [],
    });

    expect(readiness).toMatchObject({
      status: 'ready_for_live_pilot',
      readyForSandboxPayment: true,
      readyForLivePilot: true,
      blockers: [],
    });
  });

  it('rejects non-HTTPS payment endpoints', () => {
    const readiness = buildLiveCollectionsSandboxReadiness({
      checkoutUrl: 'http://localhost:5001/createRazorpayCheckout',
      webhookUrl: 'https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/razorpayLiveCollectionsWebhook',
      publicAppUrl: 'https://orbit-ledger-f41c2.web.app',
      hostedPaymentPageUrl: 'https://orbit-ledger-f41c2.web.app/pay',
      hasRazorpayKeyId: true,
      hasRazorpayKeySecret: true,
      hasRazorpayWebhookSecret: true,
      failureMatrixBlockers: [],
    });

    expect(readiness.status).toBe('blocked');
    expect(readiness.blockers).toContain('Checkout Function URL is HTTPS');
  });
});
