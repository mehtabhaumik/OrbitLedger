import type {
  FreeTierFeature,
  ProTierFeature,
  SubscriptionFeature,
  SubscriptionFeatureAccess,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierDefinition,
} from './types';

const freeTierFeatures: FreeTierFeature[] = [
  'business_setup',
  'dashboard',
  'customer_management',
  'ledger_transactions',
  'basic_statements',
  'pdf_export',
  'backup_export',
  'backup_restore',
  'pin_lock',
];

const proTierFeatures: ProTierFeature[] = [
  'advanced_pdf_styling',
  'custom_document_branding',
  'advanced_statement_templates',
  'tax_ready_documents',
  'bulk_document_export',
  'multi_business_profiles',
  'advanced_insights',
];

export const SUBSCRIPTION_TIER_DEFINITIONS: Record<
  SubscriptionTier,
  SubscriptionTierDefinition
> = {
  free: {
    tier: 'free',
    label: 'Free',
    description: 'Full offline ledger tools for daily customer dues and payments.',
    includedFeatures: freeTierFeatures,
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    description: 'Premium document polish while keeping the core offline ledger available.',
    includedFeatures: [...freeTierFeatures, ...proTierFeatures],
  },
};

const featureRequiredTier: Record<SubscriptionFeature, SubscriptionTier> = {
  business_setup: 'free',
  dashboard: 'free',
  customer_management: 'free',
  ledger_transactions: 'free',
  basic_statements: 'free',
  pdf_export: 'free',
  backup_export: 'free',
  backup_restore: 'free',
  pin_lock: 'free',
  advanced_pdf_styling: 'pro',
  custom_document_branding: 'pro',
  advanced_statement_templates: 'pro',
  tax_ready_documents: 'pro',
  bulk_document_export: 'pro',
  multi_business_profiles: 'pro',
  advanced_insights: 'pro',
};

export function resolveSubscriptionFeatureAccess(
  status: SubscriptionStatus,
  feature: SubscriptionFeature
): SubscriptionFeatureAccess {
  const requiredTier = featureRequiredTier[feature];
  const allowed = requiredTier === 'free' || status.isPro;

  return {
    feature,
    allowed,
    currentTier: status.tier,
    requiredTier,
    message: allowed
      ? null
      : 'This document enhancement is available with Orbit Ledger Pro. Your daily offline ledger tools remain available.',
  };
}

export function isPremiumSubscriptionFeature(feature: SubscriptionFeature): boolean {
  return featureRequiredTier[feature] === 'pro';
}

export function getSubscriptionTierDefinition(
  tier: SubscriptionTier
): SubscriptionTierDefinition {
  return SUBSCRIPTION_TIER_DEFINITIONS[tier];
}
