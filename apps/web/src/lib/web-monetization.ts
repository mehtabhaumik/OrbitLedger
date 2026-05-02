export type WebSubscriptionTier = 'free' | 'pro';

export type WebSubscriptionFeature =
  | 'business_setup'
  | 'dashboard'
  | 'customer_management'
  | 'ledger_transactions'
  | 'basic_statements'
  | 'pdf_export'
  | 'backup_export'
  | 'backup_restore'
  | 'pin_lock'
  | 'advanced_pdf_styling'
  | 'custom_document_branding'
  | 'advanced_statement_templates'
  | 'tax_ready_documents'
  | 'bulk_document_export'
  | 'multi_business_profiles'
  | 'advanced_insights';

export type WebSubscriptionStatus = {
  tier: WebSubscriptionTier;
  tierLabel: string;
  isPro: boolean;
  planId: 'pro_monthly' | 'pro_yearly' | null;
  includedFeatures: WebSubscriptionFeature[];
};

export type WebPlanCatalogItem = {
  id: 'pro_monthly' | 'pro_yearly';
  productId: 'com.rudraix.orbitledger.pro.monthly' | 'com.rudraix.orbitledger.pro.yearly';
  title: string;
  price: string;
  cadence: string;
  helper: string;
  entitlementDays: number;
  isBestValue: boolean;
};

export type WebCountryPackCatalogItem = {
  countryCode: 'US' | 'GB';
  productId: 'com.rudraix.orbitledger.countrypack.us' | 'com.rudraix.orbitledger.countrypack.uk';
  title: string;
  fallbackPrice: string;
  availability: 'upcoming';
  availabilityLabel: string;
  helper: string;
};

export type WebProBrandTheme = {
  key: 'ledger_green' | 'graphite' | 'moss';
  label: string;
  description: string;
  accentColor: string;
  surfaceColor: string;
  lineColor: string;
  textColor: string;
};

export type WebPlanComparisonItem = {
  feature: string;
  free: string;
  pro: string;
  proHighlight?: boolean;
};

const freeTierFeatures: WebSubscriptionFeature[] = [
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

const proTierFeatures: WebSubscriptionFeature[] = [
  'advanced_pdf_styling',
  'custom_document_branding',
  'advanced_statement_templates',
  'tax_ready_documents',
  'bulk_document_export',
  'multi_business_profiles',
  'advanced_insights',
];

export const WEB_PRO_PLAN_CATALOG: WebPlanCatalogItem[] = [
  {
    id: 'pro_monthly',
    productId: 'com.rudraix.orbitledger.pro.monthly',
    title: 'Monthly',
    price: 'INR 199',
    cadence: 'per month',
    helper: 'Flexible document polish for businesses that share statements regularly.',
    entitlementDays: 30,
    isBestValue: false,
  },
  {
    id: 'pro_yearly',
    productId: 'com.rudraix.orbitledger.pro.yearly',
    title: 'Yearly',
    price: 'INR 1,999',
    cadence: 'per year',
    helper: 'Best value when polished documents are part of weekly business work.',
    entitlementDays: 365,
    isBestValue: true,
  },
];

export const WEB_FREE_VS_PRO_COMPARISON: WebPlanComparisonItem[] = [
  {
    feature: 'Customers, ledger, and balances',
    free: 'Included',
    pro: 'Included',
  },
  {
    feature: 'Basic invoices and statements',
    free: 'Included',
    pro: 'Included',
  },
  {
    feature: 'PDF and CSV exports',
    free: 'Basic export with Orbit Ledger footer',
    pro: 'Polished branded exports without footer',
    proHighlight: true,
  },
  {
    feature: 'Invoice templates',
    free: 'Clean basic templates',
    pro: 'Premium templates and branding',
    proHighlight: true,
  },
  {
    feature: 'Customer reports',
    free: 'Basic customer export',
    pro: 'Detailed profile reports and bulk packs',
    proHighlight: true,
  },
  {
    feature: 'Collection follow-up',
    free: 'Basic payment messages',
    pro: 'Smarter follow-up copy and collection focus',
    proHighlight: true,
  },
  {
    feature: 'Customer health',
    free: 'Basic health signal',
    pro: 'Full customer ranking and insights',
    proHighlight: true,
  },
  {
    feature: 'Bulk office work',
    free: 'One-at-a-time exports',
    pro: 'Bulk PDF/CSV exports',
    proHighlight: true,
  },
  {
    feature: 'Multiple businesses',
    free: 'One workspace',
    pro: 'Multiple business profiles',
    proHighlight: true,
  },
  {
    feature: 'Backup and lock',
    free: 'Included',
    pro: 'Included',
  },
];

export const WEB_COUNTRY_PACK_PRODUCT_CATALOG: WebCountryPackCatalogItem[] = [
  {
    countryCode: 'US',
    productId: 'com.rudraix.orbitledger.countrypack.us',
    title: 'United States Country Pack',
    fallbackPrice: 'Coming soon',
    availability: 'upcoming',
    availabilityLabel: 'Upcoming',
    helper: 'Sales tax labels, document wording, and review summaries for US businesses.',
  },
  {
    countryCode: 'GB',
    productId: 'com.rudraix.orbitledger.countrypack.uk',
    title: 'United Kingdom Country Pack',
    fallbackPrice: 'Coming soon',
    availability: 'upcoming',
    availabilityLabel: 'Upcoming',
    helper: 'VAT labels, document wording, and review summaries for UK businesses.',
  },
];

export const WEB_PRO_BRAND_THEMES: Record<WebProBrandTheme['key'], WebProBrandTheme> = {
  ledger_green: {
    key: 'ledger_green',
    label: 'Ledger Green',
    description: 'Clean green identity for practical business records.',
    accentColor: '#145C52',
    surfaceColor: '#E5F1ED',
    lineColor: '#D6E0DA',
    textColor: '#18231F',
  },
  graphite: {
    key: 'graphite',
    label: 'Graphite',
    description: 'Quiet professional tone for formal statements.',
    accentColor: '#3F514A',
    surfaceColor: '#EEF2EF',
    lineColor: '#D3DBD6',
    textColor: '#18231F',
  },
  moss: {
    key: 'moss',
    label: 'Moss',
    description: 'Warm but restrained accent for branded documents.',
    accentColor: '#4F6B3F',
    surfaceColor: '#EEF4EA',
    lineColor: '#D5E1CF',
    textColor: '#18231F',
  },
};

export function getDefaultWebSubscriptionStatus(): WebSubscriptionStatus {
  return {
    tier: 'free',
    tierLabel: 'Free',
    isPro: false,
    planId: null,
    includedFeatures: freeTierFeatures,
  };
}

export function getWebProSubscriptionStatus(planId: WebPlanCatalogItem['id'] = 'pro_yearly'): WebSubscriptionStatus {
  return {
    tier: 'pro',
    tierLabel: 'Pro',
    isPro: true,
    planId,
    includedFeatures: [...freeTierFeatures, ...proTierFeatures],
  };
}

export function resolveWebFeatureAccess(status: WebSubscriptionStatus, feature: WebSubscriptionFeature) {
  const requiredTier: WebSubscriptionTier = proTierFeatures.includes(feature) ? 'pro' : 'free';
  const allowed = requiredTier === 'free' || status.isPro;
  return {
    feature,
    allowed,
    currentTier: status.tier,
    requiredTier,
    message: allowed
      ? null
      : 'This document enhancement is available with Orbit Ledger Pro. Daily ledger tools remain available.',
  };
}

export function getWebProBrandTheme(key?: string | null): WebProBrandTheme {
  if (key && Object.prototype.hasOwnProperty.call(WEB_PRO_BRAND_THEMES, key)) {
    return WEB_PRO_BRAND_THEMES[key as WebProBrandTheme['key']];
  }
  return WEB_PRO_BRAND_THEMES.ledger_green;
}
