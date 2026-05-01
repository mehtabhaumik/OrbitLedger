import { describe, expect, it } from 'vitest';

import { getPaymentProviderReadiness } from './paymentProviderReadiness';

describe('payment provider readiness', () => {
  it('keeps manual mode ready but online checkout hidden', () => {
    const readiness = getPaymentProviderReadiness({
      mode: 'manual',
      paymentPageUrl: 'https://orbit-ledger-f41c2.web.app/pay',
    });

    expect(readiness.label).toBe('Manual collection ready');
    expect(readiness.canShowOnlineCheckout).toBe(false);
    expect(readiness.blockers).toContain('No real payment provider is connected yet.');
  });

  it('blocks test-ready mode from public checkout claims', () => {
    const readiness = getPaymentProviderReadiness({
      mode: 'razorpay_test_ready',
      paymentPageUrl: 'https://orbit-ledger-f41c2.web.app/pay',
      webhookUrl: 'https://asia-south1-project.cloudfunctions.net/providerWebhook',
    });

    expect(readiness.canShowOnlineCheckout).toBe(false);
    expect(readiness.blockers[0]).toContain('Real provider account');
  });

  it('allows connected mode only with safe URLs', () => {
    expect(
      getPaymentProviderReadiness({
        mode: 'razorpay_connected',
        paymentPageUrl: 'https://orbit-ledger-f41c2.web.app/pay',
        webhookUrl: 'https://asia-south1-project.cloudfunctions.net/providerWebhook',
      }).canShowOnlineCheckout
    ).toBe(true);

    expect(
      getPaymentProviderReadiness({
        mode: 'razorpay_connected',
        paymentPageUrl: 'http://unsafe.example/pay',
        webhookUrl: 'https://asia-south1-project.cloudfunctions.net/providerWebhook',
      }).canShowOnlineCheckout
    ).toBe(false);
  });
});
