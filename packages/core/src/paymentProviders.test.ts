import { describe, expect, it } from 'vitest';

import { getPaymentProviderPlan, normalizePaymentProviderMode } from './paymentProviders';

describe('payment provider mode', () => {
  it('defaults to manual collection', () => {
    const plan = getPaymentProviderPlan(undefined);

    expect(normalizePaymentProviderMode('')).toBe('manual');
    expect(plan.mode).toBe('manual');
    expect(plan.canCreateOnlineCheckout).toBe(false);
    expect(plan.canCopyGatewayDraft).toBe(false);
  });

  it('keeps test setup separate from connected checkout', () => {
    const plan = getPaymentProviderPlan('razorpay_test_ready');

    expect(plan.statusLabel).toBe('Test setup');
    expect(plan.canCreateOnlineCheckout).toBe(false);
    expect(plan.canCopyGatewayDraft).toBe(true);
  });

  it('allows online checkout only when the provider is connected', () => {
    const plan = getPaymentProviderPlan('razorpay_connected');

    expect(plan.statusLabel).toBe('Connected');
    expect(plan.canCreateOnlineCheckout).toBe(true);
  });
});
