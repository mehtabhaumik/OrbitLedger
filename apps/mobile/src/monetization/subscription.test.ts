import { describe, expect, it } from 'vitest';

import { resolveSubscriptionFeatureAccess } from './subscriptionRules';
import type { SubscriptionStatus } from './types';

function status(tier: SubscriptionStatus['tier']): SubscriptionStatus {
  return {
    version: 1,
    tier,
    source: 'manual',
    updatedAt: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    planId: tier === 'free' ? null : `${tier}_monthly` as SubscriptionStatus['planId'],
    productId:
      tier === 'free'
        ? null
        : `com.rudraix.orbitledger.${tier}.monthly` as SubscriptionStatus['productId'],
    isPro: tier === 'pro' || tier === 'office',
    tierLabel: tier,
    includedFeatures: [],
  };
}

describe('subscription feature access', () => {
  it('keeps backup restore available on Free', () => {
    expect(resolveSubscriptionFeatureAccess(status('free'), 'backup_restore')).toMatchObject({
      allowed: true,
      requiredTier: 'free',
    });
  });

  it('unlocks Plus features without unlocking Pro document styling', () => {
    expect(resolveSubscriptionFeatureAccess(status('plus'), 'payment_links')).toMatchObject({
      allowed: true,
      requiredTier: 'plus',
    });
    expect(resolveSubscriptionFeatureAccess(status('plus'), 'advanced_pdf_styling')).toMatchObject({
      allowed: false,
      requiredTier: 'pro',
    });
  });

  it('unlocks Pro Plus features without unlocking Office workflows', () => {
    expect(resolveSubscriptionFeatureAccess(status('pro'), 'advanced_pdf_styling')).toMatchObject({
      allowed: true,
      requiredTier: 'pro',
    });
    expect(resolveSubscriptionFeatureAccess(status('pro'), 'multi_user_workspace')).toMatchObject({
      allowed: false,
      requiredTier: 'office',
    });
  });

  it('unlocks Office workflows for Office', () => {
    expect(resolveSubscriptionFeatureAccess(status('office'), 'multi_user_workspace')).toMatchObject({
      allowed: true,
      requiredTier: 'office',
    });
  });
});
