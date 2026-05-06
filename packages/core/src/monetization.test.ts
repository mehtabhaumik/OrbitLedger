import { describe, expect, it } from 'vitest';

import {
  ORBIT_LEDGER_PAID_PLAN_CATALOG,
  ORBIT_LEDGER_PLAN_COMPARISON,
  ORBIT_LEDGER_PROVIDER_GO_LIVE_CHECKLIST,
  ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS,
  ORBIT_LEDGER_PURCHASE_LAUNCH_RUNBOOK,
  ORBIT_LEDGER_PURCHASE_SUPPORT_POLICIES,
  ORBIT_LEDGER_PURCHASE_QA_MATRIX,
  canUseOrbitLedgerMonetizationFeature,
  getOrbitLedgerPaidPlanByProductId,
  getOrbitLedgerPaidPlansForCountry,
  getOrbitLedgerCountryCheckoutMapping,
  getOrbitLedgerBillingTaxRule,
  getOrbitLedgerControlledPaymentTestReadiness,
  getOrbitLedgerMonetizationFreezeReadiness,
  getOrbitLedgerProviderGoLiveChecklist,
  getOrbitLedgerPriceMappingValidation,
  getOrbitLedgerPurchaseProviderSafetyState,
  getOrbitLedgerPurchaseSupportPolicies,
  getOrbitLedgerPurchaseLaunchRunbook,
  getOrbitLedgerPurchaseQaLaunchBlockers,
  getOrbitLedgerPurchaseQaMatrix,
  getOrbitLedgerPurchaseQaReadiness,
  getOrbitLedgerRequiredProviderGoLiveChecks,
  getOrbitLedgerPlanPrice,
  getOrbitLedgerProviderPrice,
  getOrbitLedgerPlanTierForPlanId,
  getOrbitLedgerPricingCountry,
  isOrbitLedgerTierAtLeast,
  normalizeOrbitLedgerPlanId,
} from './monetization';

describe('Orbit Ledger monetization model', () => {
  it('defines the public launch tier ladder', () => {
    expect(isOrbitLedgerTierAtLeast('free', 'free')).toBe(true);
    expect(isOrbitLedgerTierAtLeast('plus', 'free')).toBe(true);
    expect(isOrbitLedgerTierAtLeast('plus', 'pro')).toBe(false);
    expect(isOrbitLedgerTierAtLeast('pro', 'plus')).toBe(true);
    expect(isOrbitLedgerTierAtLeast('office', 'pro')).toBe(true);
  });

  it('keeps legacy Pro plan ids valid while adding Plus and Office', () => {
    expect(normalizeOrbitLedgerPlanId('pro_monthly')).toBe('pro_monthly');
    expect(getOrbitLedgerPlanTierForPlanId('pro_yearly')).toBe('pro');
    expect(getOrbitLedgerPlanTierForPlanId('plus_monthly')).toBe('plus');
    expect(getOrbitLedgerPlanTierForPlanId('office_yearly')).toBe('office');
    expect(normalizeOrbitLedgerPlanId('unknown')).toBeNull();
  });

  it('maps every paid plan to a stable store product id', () => {
    expect(ORBIT_LEDGER_PAID_PLAN_CATALOG).toHaveLength(6);
    expect(getOrbitLedgerPaidPlanByProductId('com.rudraix.orbitledger.plus.monthly')?.id).toBe(
      'plus_monthly'
    );
    expect(getOrbitLedgerPaidPlanByProductId('com.rudraix.orbitledger.pro.yearly')?.tier).toBe(
      'pro'
    );
    expect(getOrbitLedgerPaidPlanByProductId('com.rudraix.orbitledger.office.yearly')?.tier).toBe(
      'office'
    );
  });

  it('uses country-specific pricing with a USD fallback', () => {
    expect(getOrbitLedgerPlanPrice('plus_monthly', 'IN')).toMatchObject({
      currencyCode: 'INR',
      display: '₹99',
    });
    expect(getOrbitLedgerPlanPrice('pro_yearly', 'GB')).toMatchObject({
      currencyCode: 'GBP',
      display: '£79.99',
    });
    expect(getOrbitLedgerPricingCountry('ZZ')).toBe('US');
    expect(getOrbitLedgerPaidPlansForCountry('CA')[0].price.currencyCode).toBe('CAD');
  });

  it('maps country checkout to provider-ready price references', () => {
    expect(getOrbitLedgerCountryCheckoutMapping('IN')).toMatchObject({
      countryCode: 'IN',
      currencyCode: 'INR',
      checkoutProvider: 'razorpay',
      providerPriceStatus: 'pending_provider_connection',
    });
    expect(getOrbitLedgerProviderPrice('pro_yearly', 'IN')).toMatchObject({
      currencyCode: 'INR',
      amountMinor: 199900,
      providerPriceId: 'orbit_razorpay_in_pro_yearly',
    });
    expect(getOrbitLedgerProviderPrice('office_monthly', 'GB')).toMatchObject({
      currencyCode: 'GBP',
      checkoutProvider: 'razorpay',
      providerPriceId: 'orbit_razorpay_gb_office_monthly',
    });
    expect(getOrbitLedgerProviderPrice('plus_monthly', 'ZZ')).toMatchObject({
      countryCode: 'US',
      currencyCode: 'USD',
      checkoutProvider: 'razorpay',
      providerPriceId: 'orbit_razorpay_us_plus_monthly',
    });
  });

  it('provides country-specific billing tax labels and review rules', () => {
    expect(getOrbitLedgerBillingTaxRule('IN')).toMatchObject({
      taxLabel: 'GST',
      registrationLabel: 'GSTIN / PAN',
      taxDocumentLabel: 'GST tax invoice',
      complianceBasis: 'india_gst',
    });
    expect(getOrbitLedgerBillingTaxRule('GB')).toMatchObject({
      taxLabel: 'VAT',
      registrationLabel: 'VAT number',
      taxDocumentLabel: 'VAT invoice',
    });
    expect(getOrbitLedgerBillingTaxRule('ZZ')).toMatchObject({
      countryCode: 'US',
      taxLabel: 'Sales tax',
      complianceBasis: 'us_state_sales_tax',
    });
  });

  it('locks advanced features to the correct paid tiers', () => {
    expect(canUseOrbitLedgerMonetizationFeature('free', 'customer_health')).toBe(false);
    expect(canUseOrbitLedgerMonetizationFeature('plus', 'customer_health')).toBe(true);
    expect(canUseOrbitLedgerMonetizationFeature('plus', 'premium_templates')).toBe(false);
    expect(canUseOrbitLedgerMonetizationFeature('pro', 'premium_templates')).toBe(true);
    expect(canUseOrbitLedgerMonetizationFeature('pro', 'multi_user_workspace')).toBe(false);
    expect(canUseOrbitLedgerMonetizationFeature('office', 'multi_user_workspace')).toBe(true);
  });

  it('has launch comparison copy for all four tiers', () => {
    expect(ORBIT_LEDGER_PLAN_COMPARISON.length).toBeGreaterThanOrEqual(6);
    expect(
      ORBIT_LEDGER_PLAN_COMPARISON.every(
        (row) => row.free.trim() && row.plus.trim() && row.pro.trim() && row.office.trim()
      )
    ).toBe(true);
  });

  it('defines a purchase QA matrix for failure and recovery coverage', () => {
    const readiness = getOrbitLedgerPurchaseQaReadiness();

    expect(ORBIT_LEDGER_PURCHASE_QA_MATRIX.length).toBeGreaterThanOrEqual(10);
    expect(getOrbitLedgerPurchaseQaLaunchBlockers()).toEqual([]);
    expect(readiness).toMatchObject({
      readyForLaunchWithoutProvider: true,
      launchBlockers: 0,
    });
    expect(readiness.providerPending).toBeGreaterThanOrEqual(2);
    expect(readiness.manualReviewRequired).toBeGreaterThanOrEqual(1);
  });

  it('keeps purchase QA checks actionable and tied to test coverage', () => {
    expect(
      ORBIT_LEDGER_PURCHASE_QA_MATRIX.every(
        (check) =>
          check.id.trim() &&
          check.title.trim() &&
          check.userImpact.trim() &&
          check.expectedBehavior.trim() &&
          check.recoveryAction.trim() &&
          check.coveredBy.length > 0
      )
    ).toBe(true);

    expect(getOrbitLedgerPurchaseQaMatrix('checkout').map((check) => check.id)).toEqual([
      'provider_checkout_boundary',
      'checkout_failure_retry',
      'pending_checkout_lock',
    ]);
    expect(getOrbitLedgerPurchaseQaMatrix('tax_review')).toHaveLength(1);
  });

  it('defines a provider go-live checklist for launch operations', () => {
    const requiredChecks = getOrbitLedgerRequiredProviderGoLiveChecks();

    expect(ORBIT_LEDGER_PROVIDER_GO_LIVE_CHECKLIST.length).toBeGreaterThanOrEqual(12);
    expect(requiredChecks.length).toBeGreaterThan(10);
    expect(getOrbitLedgerProviderGoLiveChecklist('razorpay').map((check) => check.id)).toContain(
      'razorpay_live_credentials_configured'
    );
    expect(getOrbitLedgerProviderGoLiveChecklist('stripe').map((check) => check.id)).not.toContain(
      'razorpay_live_credentials_configured'
    );
    expect(ORBIT_LEDGER_PROVIDER_GO_LIVE_CHECKLIST.map((check) => check.provider)).not.toContain('stripe');
    expect(requiredChecks.every((check) => check.evidence.trim() && check.failureMode.trim())).toBe(true);
  });

  it('keeps the purchase launch runbook ordered from preflight through rollback', () => {
    expect(ORBIT_LEDGER_PURCHASE_LAUNCH_RUNBOOK.map((step) => step.phase)).toEqual([
      'preflight',
      'preflight',
      'provider_setup',
      'provider_setup',
      'controlled_test',
      'launch',
      'post_launch',
      'rollback',
    ]);
    expect(getOrbitLedgerPurchaseLaunchRunbook('controlled_test')).toHaveLength(1);
    expect(
      ORBIT_LEDGER_PURCHASE_LAUNCH_RUNBOOK.every(
        (step) =>
          step.title.trim() &&
          step.action.trim() &&
          step.successCriteria.trim() &&
          step.rollback.trim()
      )
    ).toBe(true);
  });

  it('validates Razorpay price mapping separately from live activation', () => {
    const mapping = getOrbitLedgerPriceMappingValidation();

    expect(mapping).toMatchObject({
      checkedPrices: 30,
      pendingPrices: 30,
      activePrices: 0,
      readyForLiveCheckout: true,
    });
    expect(mapping.issues).toEqual([]);

    const liveMapping = getOrbitLedgerPriceMappingValidation({ requireActiveProviderPrices: true });
    expect(liveMapping.readyForLiveCheckout).toBe(false);
    expect(liveMapping.issues).toHaveLength(30);
    expect(liveMapping.issues.every((issue) => issue.message === 'Live Razorpay price ID is not active yet.')).toBe(true);
  });

  it('tracks controlled live payment test readiness without running a payment', () => {
    expect(ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS.length).toBeGreaterThanOrEqual(7);
    expect(getOrbitLedgerControlledPaymentTestReadiness()).toMatchObject({
      completedSteps: 0,
      readyForPublicLaunch: false,
    });
    expect(
      getOrbitLedgerControlledPaymentTestReadiness(
        ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS.map((step) => step.id)
      )
    ).toMatchObject({
      remainingSteps: 0,
      readyForPublicLaunch: true,
    });
  });

  it('keeps provider rollback modes from removing existing entitlements', () => {
    expect(getOrbitLedgerPurchaseProviderSafetyState('provider_pending')).toMatchObject({
      canCreateCheckout: false,
      preservesExistingEntitlements: true,
    });
    expect(getOrbitLedgerPurchaseProviderSafetyState('disabled')).toMatchObject({
      canCreateCheckout: false,
      preservesExistingEntitlements: true,
    });
    expect(getOrbitLedgerPurchaseProviderSafetyState('controlled_test')).toMatchObject({
      canCreateCheckout: true,
      preservesExistingEntitlements: true,
    });
    expect(getOrbitLedgerPurchaseProviderSafetyState('live_enabled')).toMatchObject({
      canCreateCheckout: true,
      preservesExistingEntitlements: true,
    });
  });

  it('defines support-safe refund and cancellation policies', () => {
    expect(getOrbitLedgerPurchaseSupportPolicies()).toBe(ORBIT_LEDGER_PURCHASE_SUPPORT_POLICIES);
    expect(ORBIT_LEDGER_PURCHASE_SUPPORT_POLICIES.map((policy) => policy.id)).toEqual([
      'failed_checkout',
      'duplicate_charge',
      'refund_request',
      'cancel_plan',
      'paid_access_missing',
    ]);
    expect(
      ORBIT_LEDGER_PURCHASE_SUPPORT_POLICIES.every(
        (policy) =>
          policy.customerMessage.trim() &&
          policy.supportAction.trim() &&
          policy.providerAction.trim()
      )
    ).toBe(true);
  });

  it('freezes monetization launch until Razorpay is truly ready', () => {
    const freeze = getOrbitLedgerMonetizationFreezeReadiness({
      providerMode: 'provider_pending',
      livePriceMapping: getOrbitLedgerPriceMappingValidation({ requireActiveProviderPrices: true }),
      controlledPayment: getOrbitLedgerControlledPaymentTestReadiness(),
    });

    expect(freeze).toMatchObject({
      frozen: true,
      readyForPublicPaidCheckout: false,
      status: 'provider_pending',
    });
    expect(freeze.blockers).toEqual([
      'Razorpay live checkout is not enabled yet.',
      'Live Razorpay price IDs are not active for every launch price.',
      'Controlled live payment test has not been completed.',
    ]);
    expect(freeze.completedRails.length).toBeGreaterThanOrEqual(5);
  });
});
