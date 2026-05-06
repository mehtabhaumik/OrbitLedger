import type {
  FreeTierFeature,
  OfficeTierFeature,
  PlusTierFeature,
  ProTierFeature,
  SubscriptionFeature,
  SubscriptionFeatureAccess,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierDefinition,
} from './types';

const planRank: Record<SubscriptionTier, number> = {
  free: 0,
  plus: 10,
  pro: 20,
  office: 30,
};

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
  'recurring_auto_email',
  'payment_reconciliation',
  'payment_reversals',
  'audit_ready_reports',
];

const plusTierFeatures: PlusTierFeature[] = [
  'customer_health',
  'customer_profile_exports',
  'payment_links',
  'payment_proof_attachments',
  'branded_invoice_basics',
  'batch_statements',
  'recurring_invoice_rules',
];

const officeTierFeatures: OfficeTierFeature[] = [
  'bulk_operations',
  'multi_user_workspace',
  'accountant_exports',
  'priority_support',
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
    label: 'Pro Plus',
    description: 'Premium document polish while keeping the core offline ledger available.',
    includedFeatures: [...freeTierFeatures, ...proTierFeatures],
  },
  plus: {
    tier: 'plus',
    label: 'Plus',
    description: 'Better exports, customer health, and payment workflows for regular use.',
    includedFeatures: [...freeTierFeatures, ...plusTierFeatures],
  },
  office: {
    tier: 'office',
    label: 'Office',
    description: 'Office-grade controls for teams, accountants, bulk work, and priority support.',
    includedFeatures: [...freeTierFeatures, ...plusTierFeatures, ...proTierFeatures, ...officeTierFeatures],
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
  customer_health: 'plus',
  customer_profile_exports: 'plus',
  payment_links: 'plus',
  payment_proof_attachments: 'plus',
  branded_invoice_basics: 'plus',
  batch_statements: 'plus',
  recurring_invoice_rules: 'plus',
  advanced_pdf_styling: 'pro',
  custom_document_branding: 'pro',
  advanced_statement_templates: 'pro',
  tax_ready_documents: 'pro',
  bulk_document_export: 'pro',
  multi_business_profiles: 'pro',
  advanced_insights: 'pro',
  recurring_auto_email: 'pro',
  payment_reconciliation: 'pro',
  payment_reversals: 'pro',
  audit_ready_reports: 'pro',
  bulk_operations: 'office',
  multi_user_workspace: 'office',
  accountant_exports: 'office',
  priority_support: 'office',
};

export function resolveSubscriptionFeatureAccess(
  status: SubscriptionStatus,
  feature: SubscriptionFeature
): SubscriptionFeatureAccess {
  const requiredTier = featureRequiredTier[feature];
  const allowed = planRank[status.tier] >= planRank[requiredTier];

  return {
    feature,
    allowed,
    currentTier: status.tier,
    requiredTier,
    message: allowed
      ? null
      : `${formatFeatureLabel(feature)} is available with Orbit Ledger ${SUBSCRIPTION_TIER_DEFINITIONS[requiredTier].label}. Your daily offline ledger tools remain available.`,
  };
}

export function isPremiumSubscriptionFeature(feature: SubscriptionFeature): boolean {
  return featureRequiredTier[feature] !== 'free';
}

export function getSubscriptionTierDefinition(
  tier: SubscriptionTier
): SubscriptionTierDefinition {
  return SUBSCRIPTION_TIER_DEFINITIONS[tier];
}

function formatFeatureLabel(feature: SubscriptionFeature): string {
  return feature
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}
