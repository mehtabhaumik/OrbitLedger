import { describe, expect, it } from 'vitest';

import { buildRazorpayProviderReadiness } from './razorpay-provider-readiness';

describe('Razorpay provider readiness', () => {
  it('keeps checkout not connected when no live setup is checked', () => {
    const readiness = buildRazorpayProviderReadiness();

    expect(readiness).toMatchObject({
      status: 'not_connected',
      missingRequiredCount: 8,
    });
    expect(readiness.checks.every((check) => check.status === 'not_checked')).toBe(true);
  });

  it('shows partial readiness without allowing live launch', () => {
    const readiness = buildRazorpayProviderReadiness({
      keyIdReady: true,
      keySecretReady: true,
      webhookSecretReady: false,
    });

    expect(readiness).toMatchObject({
      status: 'partially_ready',
      missingRequiredCount: 6,
    });
    expect(readiness.checks.find((check) => check.id === 'webhookSecretReady')).toMatchObject({
      status: 'missing',
    });
  });

  it('only becomes ready for controlled test when every required item is ready', () => {
    const readiness = buildRazorpayProviderReadiness({
      businessVerified: true,
      callbackDomainReady: true,
      keyIdReady: true,
      keySecretReady: true,
      liveModeReady: true,
      settlementReady: true,
      webhookSecretReady: true,
      webhookUrlReady: true,
    });

    expect(readiness).toMatchObject({
      status: 'ready_for_controlled_test',
      missingRequiredCount: 0,
    });
  });
});
