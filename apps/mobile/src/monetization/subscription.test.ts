import { describe, expect, it } from 'vitest';

import { resolveSubscriptionFeatureAccess } from './subscriptionRules';
import type { SubscriptionStatus } from './types';

function status(isPro: boolean): SubscriptionStatus {
  return {
    version: 1,
    tier: isPro ? 'pro' : 'free',
    source: 'manual',
    updatedAt: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    planId: isPro ? 'pro_monthly' : null,
    productId: isPro ? 'com.rudraix.orbitledger.pro.monthly' : null,
    isPro,
    tierLabel: isPro ? 'Pro' : 'Free',
    includedFeatures: [],
  };
}

describe('subscription feature access', () => {
  it('keeps backup restore available on Free', () => {
    expect(resolveSubscriptionFeatureAccess(status(false), 'backup_restore')).toMatchObject({
      allowed: true,
      requiredTier: 'free',
    });
  });

  it('locks advanced document styling until Pro', () => {
    expect(resolveSubscriptionFeatureAccess(status(false), 'advanced_pdf_styling')).toMatchObject({
      allowed: false,
      requiredTier: 'pro',
    });
    expect(resolveSubscriptionFeatureAccess(status(true), 'advanced_pdf_styling')).toMatchObject({
      allowed: true,
      requiredTier: 'pro',
    });
  });
});
