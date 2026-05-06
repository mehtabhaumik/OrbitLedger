export const SUBSCRIPTION_STATUS_KEY = 'monetization_subscription_status';
export const CURRENT_SUBSCRIPTION_STATUS_VERSION = 1;

export type SubscriptionTier = 'free' | 'plus' | 'pro' | 'office';

export type SubscriptionPlanId =
  | 'plus_monthly'
  | 'plus_yearly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'office_monthly'
  | 'office_yearly';

export type SubscriptionProductId =
  | 'com.rudraix.orbitledger.plus.monthly'
  | 'com.rudraix.orbitledger.plus.yearly'
  | 'com.rudraix.orbitledger.pro.monthly'
  | 'com.rudraix.orbitledger.pro.yearly'
  | 'com.rudraix.orbitledger.office.monthly'
  | 'com.rudraix.orbitledger.office.yearly';

export type CountryPackProductId =
  | 'com.rudraix.orbitledger.countrypack.us'
  | 'com.rudraix.orbitledger.countrypack.uk';

export type BillingProductId = SubscriptionProductId | CountryPackProductId;

export type SubscriptionSource =
  | 'local_default'
  | 'manual'
  | 'purchase_cache'
  | 'restore_cache'
  | 'development';

export type CountryPackEntitlementSource = 'purchase_cache' | 'restore_cache';

export type CountryPackEntitlement = {
  countryCode: string;
  productId: CountryPackProductId;
  source: CountryPackEntitlementSource;
  purchasedAt: string;
  transactionId: string | null;
};

export type FreeTierFeature =
  | 'business_setup'
  | 'dashboard'
  | 'customer_management'
  | 'ledger_transactions'
  | 'basic_statements'
  | 'pdf_export'
  | 'backup_export'
  | 'backup_restore'
  | 'pin_lock';

export type ProTierFeature =
  | 'advanced_pdf_styling'
  | 'custom_document_branding'
  | 'advanced_statement_templates'
  | 'tax_ready_documents'
  | 'bulk_document_export'
  | 'multi_business_profiles'
  | 'advanced_insights'
  | 'recurring_auto_email'
  | 'payment_reconciliation'
  | 'payment_reversals'
  | 'audit_ready_reports';

export type PlusTierFeature =
  | 'customer_health'
  | 'customer_profile_exports'
  | 'payment_links'
  | 'payment_proof_attachments'
  | 'branded_invoice_basics'
  | 'batch_statements'
  | 'recurring_invoice_rules';

export type OfficeTierFeature =
  | 'bulk_operations'
  | 'multi_user_workspace'
  | 'accountant_exports'
  | 'priority_support';

export type SubscriptionFeature = FreeTierFeature | PlusTierFeature | ProTierFeature | OfficeTierFeature;

export type StoredSubscriptionStatus = {
  version: typeof CURRENT_SUBSCRIPTION_STATUS_VERSION;
  tier: SubscriptionTier;
  source: SubscriptionSource;
  updatedAt: string | null;
  validUntil: string | null;
  planId?: SubscriptionPlanId | null;
  productId?: SubscriptionProductId | null;
};

export type SubscriptionStatus = StoredSubscriptionStatus & {
  isPro: boolean;
  tierLabel: string;
  includedFeatures: SubscriptionFeature[];
};

export type SaveSubscriptionStatusInput = {
  tier: SubscriptionTier;
  source?: SubscriptionSource;
  validUntil?: string | null;
  planId?: SubscriptionPlanId | null;
  productId?: SubscriptionProductId | null;
};

export type SubscriptionFeatureAccess = {
  feature: SubscriptionFeature;
  allowed: boolean;
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  message: string | null;
};

export type SubscriptionTierDefinition = {
  tier: SubscriptionTier;
  label: string;
  description: string;
  includedFeatures: SubscriptionFeature[];
};
