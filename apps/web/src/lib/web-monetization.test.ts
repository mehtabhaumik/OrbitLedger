import { describe, expect, it } from 'vitest';

import {
  getDefaultWebSubscriptionStatus,
  getWebFeaturePlanChip,
  getWebFeatureRequiredPlanLabel,
  getWebPaidPlanCatalogForCountry,
  getWebPaidSubscriptionStatus,
  getWebPurchaseStatusCopy,
  attachWebCheckoutProvider,
  createWebStoredSubscriptionStatus,
  canActivateWebCheckoutIntent,
  cancelWebCheckoutIntent,
  confirmWebCheckoutIntent,
  createWebCheckoutIntent,
  failWebCheckoutIntent,
  hydrateWebSubscriptionStatus,
  parseWebCheckoutIntent,
  parseWebServerSubscriptionEntitlement,
  parseWebStoredSubscriptionStatus,
  resolveWebPlanChangeRule,
  serializeWebCheckoutIntent,
  serializeWebStoredSubscriptionStatus,
  retryWebCheckoutIntent,
  resolveWebFeatureAccess,
} from './web-monetization';

describe('web monetization feature gates', () => {
  it('keeps core ledger work available on Free', () => {
    expect(resolveWebFeatureAccess(getDefaultWebSubscriptionStatus(), 'ledger_transactions')).toMatchObject({
      allowed: true,
      requiredTier: 'free',
    });
  });

  it('unlocks Plus features without unlocking Pro templates', () => {
    const plus = getWebPaidSubscriptionStatus('plus_monthly');

    expect(resolveWebFeatureAccess(plus, 'payment_links')).toMatchObject({
      allowed: true,
      requiredTier: 'plus',
    });
    expect(resolveWebFeatureAccess(plus, 'advanced_pdf_styling')).toMatchObject({
      allowed: false,
      requiredTier: 'pro',
    });
  });

  it('unlocks Pro Plus features without unlocking Office-only features', () => {
    const pro = getWebPaidSubscriptionStatus('pro_yearly');

    expect(resolveWebFeatureAccess(pro, 'recurring_auto_email')).toMatchObject({
      allowed: true,
      requiredTier: 'pro',
    });
    expect(resolveWebFeatureAccess(pro, 'multi_user_workspace')).toMatchObject({
      allowed: false,
      requiredTier: 'office',
    });
  });

  it('unlocks Office-only workflows for Office', () => {
    const office = getWebPaidSubscriptionStatus('office_yearly');

    expect(resolveWebFeatureAccess(office, 'accountant_exports')).toMatchObject({
      allowed: true,
      requiredTier: 'office',
    });
  });

  it('returns consistent user-facing plan labels for locked features', () => {
    const free = getDefaultWebSubscriptionStatus();

    expect(getWebFeatureRequiredPlanLabel('payment_links')).toBe('Plus');
    expect(getWebFeatureRequiredPlanLabel('advanced_pdf_styling')).toBe('Pro Plus');
    expect(getWebFeaturePlanChip(free, 'payment_links')).toBe('Requires Plus');
    expect(getWebFeaturePlanChip(getWebPaidSubscriptionStatus('plus_yearly'), 'payment_links')).toBe('Included in Plus');
  });

  it('persists and hydrates a paid web entitlement', () => {
    const stored = createWebStoredSubscriptionStatus(
      { planId: 'office_yearly', source: 'purchase_cache' },
      new Date('2026-05-03T00:00:00.000Z')
    );
    const parsed = parseWebStoredSubscriptionStatus(serializeWebStoredSubscriptionStatus(stored));
    const status = hydrateWebSubscriptionStatus(parsed!);

    expect(parsed).toMatchObject({
      planId: 'office_yearly',
      source: 'purchase_cache',
      tier: 'office',
    });
    expect(status).toMatchObject({
      tier: 'office',
      tierLabel: 'Office',
      isPro: true,
    });
    expect(status.validUntil).toContain('2027-05-03');
  });

  it('rejects invalid persisted subscription payloads', () => {
    expect(parseWebStoredSubscriptionStatus('{bad json')).toBeNull();
    expect(parseWebStoredSubscriptionStatus(JSON.stringify({ version: 1, tier: 'enterprise' }))).toBeNull();
  });

  it('hydrates paid access from a server entitlement record', () => {
    const stored = parseWebServerSubscriptionEntitlement({
      version: 1,
      plan_id: 'pro_monthly',
      product_id: 'com.rudraix.orbitledger.pro.monthly',
      source: 'provider_webhook',
      updated_at: '2026-05-03T00:00:00.000Z',
      valid_until: '2026-06-03T00:00:00.000Z',
    });
    const status = hydrateWebSubscriptionStatus(stored!);

    expect(stored).toMatchObject({
      planId: 'pro_monthly',
      source: 'server_entitlement',
      tier: 'pro',
    });
    expect(status).toMatchObject({
      tier: 'pro',
      tierLabel: 'Pro Plus',
      isPro: true,
    });
  });

  it('rejects malformed server entitlement records', () => {
    expect(parseWebServerSubscriptionEntitlement({ version: 1, plan_id: 'bad_plan' })).toBeNull();
    expect(parseWebServerSubscriptionEntitlement({ version: 2, plan_id: 'pro_monthly' })).toBeNull();
  });

  it('keeps checkout intent separate from active entitlements until confirmed', () => {
    const intent = createWebCheckoutIntent('pro_monthly', new Date('2026-05-03T00:00:00.000Z'));
    const parsed = parseWebCheckoutIntent(serializeWebCheckoutIntent(intent));

    expect(parsed).toMatchObject({
      planId: 'pro_monthly',
      status: 'pending',
      provider: 'razorpay',
      amountLabel: '₹199',
      currencyCode: 'INR',
      providerPriceId: 'orbit_razorpay_in_pro_monthly',
    });
    expect(canActivateWebCheckoutIntent(parsed)).toBe(false);

    const confirmed = confirmWebCheckoutIntent(parsed!, { transactionId: 'txn_123' }, new Date('2026-05-03T01:00:00.000Z'));
    expect(canActivateWebCheckoutIntent(confirmed)).toBe(true);
    expect(confirmed.confirmedAt).toBe('2026-05-03T01:00:00.000Z');
  });

  it('does not activate cancelled checkout intents', () => {
    const intent = createWebCheckoutIntent('plus_yearly', new Date('2026-05-03T00:00:00.000Z'));
    const cancelled = cancelWebCheckoutIntent(intent, new Date('2026-05-03T01:00:00.000Z'));

    expect(cancelled.status).toBe('cancelled');
    expect(canActivateWebCheckoutIntent(cancelled)).toBe(false);
  });

  it('keeps failed checkout intents recoverable without activating access', () => {
    const intent = createWebCheckoutIntent('plus_monthly', new Date('2026-05-03T00:00:00.000Z'));
    const withProvider = attachWebCheckoutProvider(
      intent,
      {
        provider: 'razorpay',
        providerCheckoutUrl: 'https://rzp.io/i/expired',
        providerReference: 'order_expired',
      },
      new Date('2026-05-03T00:01:00.000Z')
    );
    const failed = failWebCheckoutIntent(withProvider, { reason: 'Checkout could not be prepared.' }, new Date('2026-05-03T00:02:00.000Z'));
    const retry = retryWebCheckoutIntent(failed, new Date('2026-05-03T00:03:00.000Z'));

    expect(failed).toMatchObject({
      status: 'failed',
      failureReason: 'Checkout could not be prepared.',
      failedAt: '2026-05-03T00:02:00.000Z',
      providerCheckoutUrl: 'https://rzp.io/i/expired',
    });
    expect(canActivateWebCheckoutIntent(failed)).toBe(false);
    expect(retry).toMatchObject({
      status: 'pending',
      planId: 'plus_monthly',
      retryOf: failed.id,
      providerCheckoutUrl: null,
      providerReference: null,
      failureReason: null,
    });
  });

  it('attaches provider checkout details without activating access', () => {
    const intent = createWebCheckoutIntent('office_monthly', new Date('2026-05-03T00:00:00.000Z'));
    const withProvider = attachWebCheckoutProvider(
      intent,
      {
        provider: 'razorpay',
        providerCheckoutUrl: 'https://rzp.io/i/test',
        providerReference: 'order_123',
      },
      new Date('2026-05-03T00:01:00.000Z')
    );

    expect(withProvider).toMatchObject({
      status: 'pending',
      provider: 'razorpay',
      providerCheckoutUrl: 'https://rzp.io/i/test',
      providerReference: 'order_123',
    });
    expect(canActivateWebCheckoutIntent(withProvider)).toBe(false);
  });

  it('keeps web checkout prices aligned to workspace country', () => {
    const gbPlans = getWebPaidPlanCatalogForCountry('GB');
    const officeYearly = gbPlans.find((plan) => plan.id === 'office_yearly');
    const intent = createWebCheckoutIntent('office_yearly', new Date('2026-05-03T00:00:00.000Z'), 'GB');

    expect(officeYearly).toMatchObject({
      price: '£199.99',
      currencyCode: 'GBP',
      checkoutProvider: 'razorpay',
      providerPriceId: 'orbit_razorpay_gb_office_yearly',
    });
    expect(intent).toMatchObject({
      amountLabel: '£199.99',
      amountMinor: 19999,
      currencyCode: 'GBP',
      provider: 'razorpay',
      providerPriceId: 'orbit_razorpay_gb_office_yearly',
    });
  });

  it('describes purchase status without exposing provider internals', () => {
    const free = getDefaultWebSubscriptionStatus();
    const pendingIntent = createWebCheckoutIntent('plus_monthly', new Date('2026-05-03T00:00:00.000Z'));
    const restored = getWebPaidSubscriptionStatus('office_yearly', {
      source: 'server_entitlement',
      validUntil: '2027-05-03T00:00:00.000Z',
    });

    expect(getWebPurchaseStatusCopy(free, null, true)).toMatchObject({
      tone: 'checking',
      chip: 'Checking',
    });
    expect(getWebPurchaseStatusCopy(free, pendingIntent, false)).toMatchObject({
      tone: 'pending',
      title: 'Payment confirmation pending',
    });
    expect(getWebPurchaseStatusCopy(free, failWebCheckoutIntent(pendingIntent, { reason: 'Network error.' }), false)).toMatchObject({
      tone: 'failed',
      title: 'Checkout needs retry',
    });
    expect(getWebPurchaseStatusCopy(restored, null, false)).toMatchObject({
      tone: 'restored',
      title: 'Purchase restored',
    });
    expect(getWebPurchaseStatusCopy(free, null, false)).toMatchObject({
      tone: 'free',
      chip: 'Free',
    });
  });

  it('allows new paid checkout and higher-tier upgrades only', () => {
    const free = getDefaultWebSubscriptionStatus();
    const plus = getWebPaidSubscriptionStatus('plus_yearly', { source: 'server_entitlement' });
    const pro = getWebPaidSubscriptionStatus('pro_yearly', { source: 'server_entitlement' });

    expect(resolveWebPlanChangeRule(free, 'plus_monthly')).toMatchObject({
      kind: 'new_purchase',
      canStartCheckout: true,
    });
    expect(resolveWebPlanChangeRule(plus, 'pro_monthly')).toMatchObject({
      kind: 'upgrade',
      canStartCheckout: true,
    });
    expect(resolveWebPlanChangeRule(pro, 'plus_yearly')).toMatchObject({
      kind: 'downgrade',
      canStartCheckout: false,
      canQueueRenewalChange: true,
      buttonLabel: 'Change at renewal',
    });
  });

  it('blocks same-plan and same-tier billing-cycle changes locally', () => {
    const plus = getWebPaidSubscriptionStatus('plus_monthly', { source: 'server_entitlement' });

    expect(resolveWebPlanChangeRule(plus, 'plus_monthly')).toMatchObject({
      kind: 'current_plan',
      canStartCheckout: false,
    });
    expect(resolveWebPlanChangeRule(plus, 'plus_yearly')).toMatchObject({
      kind: 'billing_change',
      canStartCheckout: false,
      canQueueRenewalChange: true,
    });
  });

  it('requires pending checkout to be finished before another plan starts', () => {
    const free = getDefaultWebSubscriptionStatus();
    const pending = createWebCheckoutIntent('plus_monthly', new Date('2026-05-03T00:00:00.000Z'));

    expect(resolveWebPlanChangeRule(free, 'pro_yearly', pending)).toMatchObject({
      kind: 'checkout_pending',
      canStartCheckout: false,
      canQueueRenewalChange: false,
      buttonLabel: 'Checkout pending',
    });
  });
});
