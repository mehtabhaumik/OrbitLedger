import {
  getOrbitLedgerPaidPlansForCountry,
  getOrbitLedgerPaidPlan,
  getOrbitLedgerPlanDefinition,
  getOrbitLedgerPlanRank,
  getOrbitLedgerPlanTierForPlanId,
  getOrbitLedgerProviderPrice,
  isOrbitLedgerPaidPlanId,
  isOrbitLedgerTierAtLeast,
  ORBIT_LEDGER_PLAN_COMPARISON,
  type OrbitLedgerCheckoutProvider,
  type OrbitLedgerCurrencyCode,
  type OrbitLedgerPaidPlanId,
  type OrbitLedgerPlanComparisonRow,
  type OrbitLedgerPlanTier,
  type OrbitLedgerPricingCountryCode,
  type OrbitLedgerSubscriptionProductId,
} from '@orbit-ledger/core';

export type WebSubscriptionTier = OrbitLedgerPlanTier;
export type WebSubscriptionSource =
  | 'local_default'
  | 'manual'
  | 'purchase_cache'
  | 'restore_cache'
  | 'server_entitlement'
  | 'development';

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
  | 'customer_health'
  | 'customer_profile_exports'
  | 'payment_links'
  | 'payment_proof_attachments'
  | 'branded_invoice_basics'
  | 'batch_statements'
  | 'recurring_invoice_rules'
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
  | 'audit_ready_reports'
  | 'bulk_operations'
  | 'multi_user_workspace'
  | 'accountant_exports'
  | 'priority_support';

export type WebSubscriptionStatus = {
  version: 1;
  tier: WebSubscriptionTier;
  tierLabel: string;
  isPro: boolean;
  planId: OrbitLedgerPaidPlanId | null;
  productId: OrbitLedgerSubscriptionProductId | null;
  source: WebSubscriptionSource;
  updatedAt: string | null;
  validUntil: string | null;
  includedFeatures: WebSubscriptionFeature[];
};

export type WebStoredSubscriptionStatus = {
  version: 1;
  tier: WebSubscriptionTier;
  planId: OrbitLedgerPaidPlanId | null;
  productId: OrbitLedgerSubscriptionProductId | null;
  source: WebSubscriptionSource;
  updatedAt: string | null;
  validUntil: string | null;
};

export type WebServerSubscriptionEntitlement = {
  version?: unknown;
  tier?: unknown;
  plan_id?: unknown;
  product_id?: unknown;
  source?: unknown;
  updated_at?: unknown;
  valid_until?: unknown;
};

export type SaveWebSubscriptionStatusInput = {
  planId: OrbitLedgerPaidPlanId | null;
  source?: WebSubscriptionSource;
  validUntil?: string | null;
};

export type WebCheckoutIntentStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed';

export type WebCheckoutIntent = {
  version: 1;
  id: string;
  planId: OrbitLedgerPaidPlanId;
  productId: OrbitLedgerSubscriptionProductId;
  tier: Exclude<WebSubscriptionTier, 'free'>;
  planLabel: string;
  amountLabel: string;
  amountMinor: number;
  currencyCode: OrbitLedgerCurrencyCode;
  pricingCountryCode: OrbitLedgerPricingCountryCode;
  status: WebCheckoutIntentStatus;
  provider: OrbitLedgerCheckoutProvider;
  providerPriceId: string;
  providerPriceStatus: 'pending_provider_connection' | 'active';
  providerCheckoutUrl: string | null;
  providerReference: string | null;
  transactionId: string | null;
  failureReason: string | null;
  failedAt: string | null;
  retryOf: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

export type AttachWebCheckoutProviderInput = {
  provider: WebCheckoutIntent['provider'];
  amountLabel?: string | null;
  amountMinor?: number | null;
  currencyCode?: OrbitLedgerCurrencyCode | null;
  pricingCountryCode?: OrbitLedgerPricingCountryCode | null;
  providerPriceId?: string | null;
  providerPriceStatus?: WebCheckoutIntent['providerPriceStatus'] | null;
  providerCheckoutUrl?: string | null;
  providerReference?: string | null;
};

export type WebPurchaseStatusCopy = {
  tone: 'checking' | 'free' | 'pending' | 'failed' | 'active' | 'restored';
  title: string;
  message: string;
  chip: string;
};

export type WebBetaToPaidPolicyCopy = {
  chip: string;
  title: string;
  summary: string;
  commitments: string[];
  officeNote: string;
};

export type WebPlanChangeKind =
  | 'new_purchase'
  | 'current_plan'
  | 'upgrade'
  | 'downgrade'
  | 'billing_change'
  | 'checkout_pending'
  | 'checkout_failed';

export type WebPlanChangeRule = {
  kind: WebPlanChangeKind;
  canStartCheckout: boolean;
  canQueueRenewalChange: boolean;
  buttonLabel: string;
  helper: string;
  chip: string;
  tone: 'default' | 'success' | 'warning' | 'locked';
};

export type WebWorkspaceCreationAccess = {
  allowed: boolean;
  existingWorkspaceCount: number;
  currentTier: WebSubscriptionTier;
  requiredTier: WebSubscriptionTier;
  requiredPlanLabel: string;
  message: string | null;
};

export type WebOfficeInvitationInput = {
  fullName: string;
  email: string;
  bestContactNumber: string;
  alternateContactNumber?: string | null;
  message: string;
  businessName?: string | null;
  userEmail?: string | null;
};

export type WebOfficeInvitationValidation = {
  valid: boolean;
  fieldErrors: {
    fullName: string | null;
    email: string | null;
    bestContactNumber: string | null;
    message: string | null;
  };
};

export type WebPlanCatalogItem = {
  id: OrbitLedgerPaidPlanId;
  tier: Exclude<WebSubscriptionTier, 'free'>;
  productId: OrbitLedgerSubscriptionProductId;
  title: string;
  price: string;
  amountMinor: number;
  currencyCode: OrbitLedgerCurrencyCode;
  pricingCountryCode: OrbitLedgerPricingCountryCode;
  checkoutProvider: OrbitLedgerCheckoutProvider;
  providerPriceId: string;
  providerPriceStatus: 'pending_provider_connection' | 'active';
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

export type WebTierPlanComparisonItem = OrbitLedgerPlanComparisonRow;

export const WEB_SUBSCRIPTION_STATUS_VERSION = 1;
export const WEB_SUBSCRIPTION_STORAGE_PREFIX = 'orbit-ledger:web-subscription-status:';
export const WEB_CHECKOUT_INTENT_STORAGE_PREFIX = 'orbit-ledger:web-checkout-intent:';
export const WEB_BETA_FREE_ONLY = true;
export const WEB_BETA_TO_PAID_POLICY: WebBetaToPaidPolicyCopy = {
  chip: 'Beta transition',
  title: 'No surprise lockout when paid plans begin',
  summary:
    'Public beta gives broad access so businesses can evaluate real workflows. Before paid plans start, Orbit Ledger will give clear notice and a fair transition window.',
  commitments: [
    'You will get advance notice before any paid limits are enforced.',
    'Your records stay available for review and export even if you do not upgrade.',
    'Premium automation will not be removed mid-workflow without a visible plan choice.',
    'Office access stays reviewed separately so team and multi-company work remains controlled.',
  ],
  officeNote:
    'Office may be enabled during beta as reviewed access. When paid Office launches, existing beta workspaces will be contacted before any team or multi-company limits change.',
};
export const WEB_OFFICE_INVITATION_SUBJECT = 'Orbit Ledger Office invitation request';
export const WEB_OFFICE_INVITATION_SUPPORT_EMAIL = 'support@rudraix.com';

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
  'recurring_auto_email',
  'payment_reconciliation',
  'payment_reversals',
  'audit_ready_reports',
];

const plusTierFeatures: WebSubscriptionFeature[] = [
  'customer_health',
  'customer_profile_exports',
  'payment_links',
  'payment_proof_attachments',
  'branded_invoice_basics',
  'batch_statements',
  'recurring_invoice_rules',
];

const officeTierFeatures: WebSubscriptionFeature[] = [
  'bulk_operations',
  'multi_user_workspace',
  'accountant_exports',
  'priority_support',
];

const webFeatureRequiredTier: Record<WebSubscriptionFeature, WebSubscriptionTier> = {
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

export const WEB_PAID_PLAN_CATALOG: WebPlanCatalogItem[] = getWebPaidPlanCatalogForCountry('IN');

export const WEB_PRO_PLAN_CATALOG: WebPlanCatalogItem[] = WEB_PAID_PLAN_CATALOG.filter(
  (plan) => plan.tier === 'pro'
);

export function getWebPaidPlanCatalogForCountry(countryCode: string | null | undefined): WebPlanCatalogItem[] {
  return getOrbitLedgerPaidPlansForCountry(countryCode).map((plan) => {
    const providerPrice = getOrbitLedgerProviderPrice(plan.id, countryCode);
    return {
      id: plan.id,
      tier: plan.tier,
      productId: plan.productId,
      title: plan.label,
      price: providerPrice.display,
      amountMinor: providerPrice.amountMinor,
      currencyCode: providerPrice.currencyCode,
      pricingCountryCode: providerPrice.countryCode,
      checkoutProvider: providerPrice.checkoutProvider,
      providerPriceId: providerPrice.providerPriceId,
      providerPriceStatus: providerPrice.providerPriceStatus,
      cadence: plan.billingInterval === 'monthly' ? 'per month' : 'per year',
      helper: plan.helper,
      entitlementDays: plan.entitlementDays,
      isBestValue: plan.isBestValue,
    };
  });
}

export const WEB_TIER_PLAN_COMPARISON: WebTierPlanComparisonItem[] = ORBIT_LEDGER_PLAN_COMPARISON;

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
  return hydrateWebSubscriptionStatus({
    version: WEB_SUBSCRIPTION_STATUS_VERSION,
    tier: 'free',
    planId: null,
    productId: null,
    source: 'local_default',
    updatedAt: null,
    validUntil: null,
  });
}

export function getWebPaidSubscriptionStatus(
  planId: OrbitLedgerPaidPlanId,
  options: { source?: WebSubscriptionSource; validUntil?: string | null; updatedAt?: string | null } = {}
): WebSubscriptionStatus {
  const plan = getOrbitLedgerPaidPlan(planId);

  return hydrateWebSubscriptionStatus({
    version: WEB_SUBSCRIPTION_STATUS_VERSION,
    tier: plan.tier,
    planId,
    productId: plan.productId,
    source: options.source ?? 'purchase_cache',
    updatedAt: options.updatedAt ?? null,
    validUntil: options.validUntil ?? null,
  });
}

export function getWebProSubscriptionStatus(planId: WebPlanCatalogItem['id'] = 'pro_yearly'): WebSubscriptionStatus {
  return getWebPaidSubscriptionStatus(planId);
}

export function resolveWebFeatureAccess(status: WebSubscriptionStatus, feature: WebSubscriptionFeature) {
  const requiredTier = webFeatureRequiredTier[feature];
  const officeOnlyFeatures: WebSubscriptionFeature[] = ['multi_user_workspace', 'accountant_exports', 'priority_support'];
  const allowed =
    (WEB_BETA_FREE_ONLY && !officeOnlyFeatures.includes(feature)) ||
    requiredTier === 'free' ||
    isOrbitLedgerTierAtLeast(status.tier, requiredTier);
  const requiredPlanLabel = getOrbitLedgerPlanDefinition(requiredTier).label;
  return {
    feature,
    allowed,
    currentTier: status.tier,
    requiredTier,
    requiredPlanLabel,
    message: allowed
      ? null
      : WEB_BETA_FREE_ONLY
        ? `${featureLabel(feature)} is part of Office access. Request Office when your team is ready for it.`
        : `${featureLabel(feature)} is available with Orbit Ledger ${requiredPlanLabel}. Daily ledger tools remain available.`,
  };
}

export function getWebFeatureRequiredTier(feature: WebSubscriptionFeature): WebSubscriptionTier {
  return webFeatureRequiredTier[feature];
}

export function getWebFeatureRequiredPlanLabel(feature: WebSubscriptionFeature): string {
  return getOrbitLedgerPlanDefinition(webFeatureRequiredTier[feature]).label;
}

export function resolveWebWorkspaceCreationAccess(
  status: WebSubscriptionStatus,
  existingWorkspaceCount: number
): WebWorkspaceCreationAccess {
  const normalizedCount = Math.max(0, Math.floor(existingWorkspaceCount));
  const requiredTier = getWebFeatureRequiredTier('multi_business_profiles');
  const requiredPlanLabel = getOrbitLedgerPlanDefinition(requiredTier).label;
  const allowed =
    normalizedCount === 0 || resolveWebFeatureAccess(status, 'multi_business_profiles').allowed;

  return {
    allowed,
    existingWorkspaceCount: normalizedCount,
    currentTier: status.tier,
    requiredTier,
    requiredPlanLabel,
    message: allowed
      ? null
      : `Multiple companies are available with Orbit Ledger ${requiredPlanLabel}. This plan keeps one company workspace active.`,
  };
}

export function createDefaultWebOfficeInvitationMessage(businessName?: string | null): string {
  const businessLine = businessName?.trim()
    ? `We are interested in Orbit Ledger Office for ${businessName.trim()}.`
    : 'We are interested in Orbit Ledger Office.';

  return [
    'Hello Orbit Ledger team,',
    '',
    businessLine,
    'Please contact us with invitation details, team access options, onboarding steps, and pricing.',
    '',
    'We are especially interested in:',
    '- Multiple users for the same business',
    '- Multiple company workspaces',
    '- Accountant exports and office review controls',
    '',
    'Thank you.',
  ].join('\n');
}

export function validateWebOfficeInvitationInput(
  input: WebOfficeInvitationInput
): WebOfficeInvitationValidation {
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const bestContactNumber = input.bestContactNumber.trim();
  const message = input.message.trim();
  const fieldErrors = {
    fullName: fullName.length < 2 ? 'Enter your full name.' : null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Enter a valid email address.',
    bestContactNumber: bestContactNumber.length < 7 ? 'Enter the best phone number to reach you.' : null,
    message: message.length < 20 ? 'Add a short message so we know what you need.' : null,
  };

  return {
    valid: !fieldErrors.fullName && !fieldErrors.email && !fieldErrors.bestContactNumber && !fieldErrors.message,
    fieldErrors,
  };
}

export function buildWebOfficeInvitationMailto(input: WebOfficeInvitationInput): string {
  const body = [
    input.message.trim(),
    '',
    '---',
    `Full name: ${input.fullName.trim()}`,
    `Email: ${input.email.trim()}`,
    `Best contact number: ${input.bestContactNumber.trim()}`,
    `Alternate contact number: ${input.alternateContactNumber?.trim() || 'Not provided'}`,
    `Business: ${input.businessName?.trim() || 'Not provided'}`,
    `Signed-in email: ${input.userEmail?.trim() || 'Not available'}`,
  ].join('\n');

  return `mailto:${WEB_OFFICE_INVITATION_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    WEB_OFFICE_INVITATION_SUBJECT
  )}&body=${encodeURIComponent(body)}`;
}

export function getWebFeaturePlanChip(status: WebSubscriptionStatus, feature: WebSubscriptionFeature): string {
  const access = resolveWebFeatureAccess(status, feature);
  if (WEB_BETA_FREE_ONLY && access.allowed) {
    return 'Included during beta';
  }
  return access.allowed ? `Included in ${status.tierLabel}` : `Requires ${access.requiredPlanLabel}`;
}

export function getWebPurchaseStatusCopy(
  status: WebSubscriptionStatus,
  checkoutIntent: WebCheckoutIntent | null,
  isChecking: boolean
): WebPurchaseStatusCopy {
  if (isChecking) {
    return {
      tone: 'checking',
      title: 'Checking purchase status',
      message: 'Orbit Ledger is checking confirmed purchases for this workspace.',
      chip: 'Checking',
    };
  }

  if (checkoutIntent?.status === 'pending') {
    return {
      tone: 'pending',
      title: 'Payment confirmation pending',
      message: `${checkoutIntent.planLabel} access starts only after payment confirmation. Your current plan has not changed.`,
      chip: 'Pending',
    };
  }

  if (checkoutIntent?.status === 'failed') {
    return {
      tone: 'failed',
      title: 'Checkout needs retry',
      message: checkoutIntent.failureReason
        ? `${checkoutIntent.failureReason} Your current plan has not changed.`
        : 'Checkout could not be prepared. Your current plan has not changed.',
      chip: 'Retry',
    };
  }

  if (status.tier !== 'free' && status.source === 'server_entitlement') {
    return {
      tone: 'restored',
      title: 'Purchase restored',
      message: `${status.tierLabel} access was restored from a confirmed purchase for this workspace.`,
      chip: 'Restored',
    };
  }

  if (status.tier !== 'free') {
    return {
      tone: 'active',
      title: 'Plan active',
      message: `${status.tierLabel} access is active for this workspace.`,
      chip: 'Active',
    };
  }

  return {
    tone: 'free',
    title: 'Free plan active',
    message: 'Core ledger, customers, invoices, exports, backup, and restore remain available.',
    chip: 'Free',
  };
}

export function resolveWebPlanChangeRule(
  status: WebSubscriptionStatus,
  targetPlanId: OrbitLedgerPaidPlanId,
  checkoutIntent: WebCheckoutIntent | null = null
): WebPlanChangeRule {
  const targetPlan = getOrbitLedgerPaidPlan(targetPlanId);
  const currentPlan = status.planId ? getOrbitLedgerPaidPlan(status.planId) : null;
  const targetTierLabel = getOrbitLedgerPlanDefinition(targetPlan.tier).label;

  if (checkoutIntent?.status === 'pending') {
    return {
      kind: 'checkout_pending',
      canStartCheckout: false,
      canQueueRenewalChange: false,
      buttonLabel: 'Checkout pending',
      helper: 'Finish or cancel the pending checkout before choosing another plan.',
      chip: 'Pending checkout',
      tone: 'warning',
    };
  }

  if (checkoutIntent?.status === 'failed' && checkoutIntent.planId === targetPlanId) {
    return {
      kind: 'checkout_failed',
      canStartCheckout: true,
      canQueueRenewalChange: false,
      buttonLabel: 'Retry checkout',
      helper: 'Retry this checkout when you are ready. Your current plan will not change until payment is confirmed.',
      chip: 'Retry available',
      tone: 'warning',
    };
  }

  if (status.planId === targetPlanId) {
    return {
      kind: 'current_plan',
      canStartCheckout: false,
      canQueueRenewalChange: false,
      buttonLabel: 'Current plan',
      helper: 'This plan is already active for the workspace.',
      chip: 'Current plan',
      tone: 'success',
    };
  }

  if (status.tier === 'free' || !currentPlan) {
    return {
      kind: 'new_purchase',
      canStartCheckout: true,
      canQueueRenewalChange: false,
      buttonLabel: `Choose ${targetTierLabel}`,
      helper: `${targetTierLabel} access starts only after payment confirmation.`,
      chip: 'Available',
      tone: 'default',
    };
  }

  const currentRank = getOrbitLedgerPlanRank(currentPlan.tier);
  const targetRank = getOrbitLedgerPlanRank(targetPlan.tier);

  if (targetRank > currentRank) {
    return {
      kind: 'upgrade',
      canStartCheckout: true,
      canQueueRenewalChange: false,
      buttonLabel: `Upgrade to ${targetTierLabel}`,
      helper: `Upgrade checkout is allowed. ${targetTierLabel} access starts after payment confirmation.`,
      chip: 'Upgrade',
      tone: 'default',
    };
  }

  if (targetRank < currentRank) {
    return {
      kind: 'downgrade',
      canStartCheckout: false,
      canQueueRenewalChange: true,
      buttonLabel: 'Change at renewal',
      helper: 'Plan reductions are handled at renewal so paid access is not reduced by accident.',
      chip: 'Renewal change',
      tone: 'locked',
    };
  }

  return {
    kind: 'billing_change',
    canStartCheckout: false,
    canQueueRenewalChange: true,
    buttonLabel: 'Change at renewal',
    helper: 'Billing-cycle changes are handled at renewal to avoid duplicate charges.',
    chip: 'Renewal change',
    tone: 'locked',
  };
}

export function createWebSubscriptionStorageKey(userId: string, workspaceId: string | null | undefined): string {
  return `${WEB_SUBSCRIPTION_STORAGE_PREFIX}${userId}:${workspaceId ?? 'no-workspace'}`;
}

export function createWebCheckoutIntentStorageKey(userId: string, workspaceId: string | null | undefined): string {
  return `${WEB_CHECKOUT_INTENT_STORAGE_PREFIX}${userId}:${workspaceId ?? 'no-workspace'}`;
}

export function createWebStoredSubscriptionStatus(
  input: SaveWebSubscriptionStatusInput,
  now = new Date()
): WebStoredSubscriptionStatus {
  if (!input.planId) {
    return {
      version: WEB_SUBSCRIPTION_STATUS_VERSION,
      tier: 'free',
      planId: null,
      productId: null,
      source: input.source ?? 'manual',
      updatedAt: now.toISOString(),
      validUntil: input.validUntil ?? null,
    };
  }

  const plan = getOrbitLedgerPaidPlan(input.planId);
  return {
    version: WEB_SUBSCRIPTION_STATUS_VERSION,
    tier: plan.tier,
    planId: plan.id,
    productId: plan.productId,
    source: input.source ?? 'purchase_cache',
    updatedAt: now.toISOString(),
    validUntil: input.validUntil ?? buildWebEntitlementValidUntil(plan.entitlementDays, now),
  };
}

export function hydrateWebSubscriptionStatus(status: WebStoredSubscriptionStatus): WebSubscriptionStatus {
  const planTier = status.planId ? getOrbitLedgerPlanTierForPlanId(status.planId) : status.tier;
  const effectiveTier =
    planTier !== 'free' && isWebSubscriptionExpired(status.validUntil) ? 'free' : planTier;
  const definition = getOrbitLedgerPlanDefinition(effectiveTier);

  return {
    ...status,
    tier: effectiveTier,
    planId: effectiveTier === 'free' ? null : status.planId,
    productId: effectiveTier === 'free' ? null : status.productId,
    isPro: isOrbitLedgerTierAtLeast(effectiveTier, 'pro'),
    tierLabel: definition.label,
    includedFeatures: getWebIncludedFeaturesForTier(effectiveTier),
  };
}

export function parseWebStoredSubscriptionStatus(rawValue: string | null | undefined): WebStoredSubscriptionStatus | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<WebStoredSubscriptionStatus>;
    if (parsed.version !== WEB_SUBSCRIPTION_STATUS_VERSION) {
      return null;
    }
    const tier = isWebSubscriptionTier(parsed.tier) ? parsed.tier : null;
    const planId = isOrbitLedgerPaidPlanId(parsed.planId) ? parsed.planId : null;
    if (!tier) {
      return null;
    }
    const productId = planId ? getOrbitLedgerPaidPlan(planId).productId : null;
    return {
      version: WEB_SUBSCRIPTION_STATUS_VERSION,
      tier: planId ? getOrbitLedgerPlanTierForPlanId(planId) : tier,
      planId,
      productId,
      source: isWebSubscriptionSource(parsed.source) ? parsed.source : 'manual',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      validUntil: typeof parsed.validUntil === 'string' ? parsed.validUntil : null,
    };
  } catch {
    return null;
  }
}

export function serializeWebStoredSubscriptionStatus(status: WebStoredSubscriptionStatus): string {
  return JSON.stringify(status);
}

export function parseWebServerSubscriptionEntitlement(
  value: WebServerSubscriptionEntitlement | null | undefined
): WebStoredSubscriptionStatus | null {
  if (
    !value ||
    value.version !== WEB_SUBSCRIPTION_STATUS_VERSION ||
    typeof value.plan_id !== 'string' ||
    !isOrbitLedgerPaidPlanId(value.plan_id)
  ) {
    return null;
  }

  const plan = getOrbitLedgerPaidPlan(value.plan_id);
  return {
    version: WEB_SUBSCRIPTION_STATUS_VERSION,
    tier: plan.tier,
    planId: plan.id,
    productId: plan.productId,
    source: 'server_entitlement',
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : null,
    validUntil: typeof value.valid_until === 'string' ? value.valid_until : null,
  };
}

export function createWebCheckoutIntent(
  planId: OrbitLedgerPaidPlanId,
  now = new Date(),
  countryCode?: string | null
): WebCheckoutIntent {
  const plan = getOrbitLedgerPaidPlan(planId);
  const providerPrice = getOrbitLedgerProviderPrice(plan.id, countryCode ?? 'IN');
  const timestamp = now.toISOString();
  return {
    version: WEB_SUBSCRIPTION_STATUS_VERSION,
    id: `checkout_${plan.id}_${now.getTime()}`,
    planId: plan.id,
    productId: plan.productId,
    tier: plan.tier,
    planLabel: plan.label,
    amountLabel: providerPrice.display,
    amountMinor: providerPrice.amountMinor,
    currencyCode: providerPrice.currencyCode,
    pricingCountryCode: providerPrice.countryCode,
    status: 'pending',
    provider: providerPrice.checkoutProvider,
    providerPriceId: providerPrice.providerPriceId,
    providerPriceStatus: providerPrice.providerPriceStatus,
    providerCheckoutUrl: null,
    providerReference: null,
    transactionId: null,
    failureReason: null,
    failedAt: null,
    retryOf: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    confirmedAt: null,
  };
}

export function attachWebCheckoutProvider(
  intent: WebCheckoutIntent,
  input: AttachWebCheckoutProviderInput,
  now = new Date()
): WebCheckoutIntent {
  return {
    ...intent,
    provider: input.provider,
    amountLabel: input.amountLabel ?? intent.amountLabel,
    amountMinor: typeof input.amountMinor === 'number' ? input.amountMinor : intent.amountMinor,
    currencyCode: input.currencyCode ?? intent.currencyCode,
    pricingCountryCode: input.pricingCountryCode ?? intent.pricingCountryCode,
    providerPriceId: input.providerPriceId ?? intent.providerPriceId,
    providerPriceStatus: input.providerPriceStatus ?? intent.providerPriceStatus,
    providerCheckoutUrl: input.providerCheckoutUrl ?? null,
    providerReference: input.providerReference ?? intent.providerReference,
    updatedAt: now.toISOString(),
  };
}

export function confirmWebCheckoutIntent(
  intent: WebCheckoutIntent,
  input: { transactionId: string; providerReference?: string | null },
  now = new Date()
): WebCheckoutIntent {
  return {
    ...intent,
    status: 'confirmed',
    transactionId: input.transactionId,
    providerReference: input.providerReference ?? intent.providerReference,
    failureReason: null,
    failedAt: null,
    updatedAt: now.toISOString(),
    confirmedAt: now.toISOString(),
  };
}

export function failWebCheckoutIntent(
  intent: WebCheckoutIntent,
  input: { reason?: string | null },
  now = new Date()
): WebCheckoutIntent {
  return {
    ...intent,
    status: 'failed',
    failureReason: input.reason ?? 'Checkout could not be prepared.',
    failedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function retryWebCheckoutIntent(intent: WebCheckoutIntent, now = new Date()): WebCheckoutIntent {
  return {
    ...createWebCheckoutIntent(intent.planId, now, intent.pricingCountryCode),
    retryOf: intent.id,
  };
}

export function cancelWebCheckoutIntent(intent: WebCheckoutIntent, now = new Date()): WebCheckoutIntent {
  return {
    ...intent,
    status: 'cancelled',
    updatedAt: now.toISOString(),
  };
}

export function canActivateWebCheckoutIntent(intent: WebCheckoutIntent | null): intent is WebCheckoutIntent {
  return Boolean(intent && intent.status === 'confirmed' && intent.transactionId);
}

export function parseWebCheckoutIntent(rawValue: string | null | undefined): WebCheckoutIntent | null {
  if (!rawValue) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawValue) as Partial<WebCheckoutIntent>;
    if (
      parsed.version !== WEB_SUBSCRIPTION_STATUS_VERSION ||
      typeof parsed.id !== 'string' ||
      !isOrbitLedgerPaidPlanId(parsed.planId) ||
      !isWebCheckoutIntentStatus(parsed.status)
    ) {
      return null;
    }
    const plan = getOrbitLedgerPaidPlan(parsed.planId);
    const fallbackPrice = getOrbitLedgerProviderPrice(plan.id, 'IN');
    return {
      version: WEB_SUBSCRIPTION_STATUS_VERSION,
      id: parsed.id,
      planId: plan.id,
      productId: plan.productId,
      tier: plan.tier,
      planLabel: plan.label,
      amountLabel: typeof parsed.amountLabel === 'string' ? parsed.amountLabel : fallbackPrice.display,
      amountMinor: typeof parsed.amountMinor === 'number' ? parsed.amountMinor : fallbackPrice.amountMinor,
      currencyCode: isWebCurrencyCode(parsed.currencyCode) ? parsed.currencyCode : fallbackPrice.currencyCode,
      pricingCountryCode: isWebPricingCountryCode(parsed.pricingCountryCode) ? parsed.pricingCountryCode : fallbackPrice.countryCode,
      status: parsed.status,
      provider: isWebCheckoutProvider(parsed.provider) ? parsed.provider : fallbackPrice.checkoutProvider,
      providerPriceId: typeof parsed.providerPriceId === 'string' ? parsed.providerPriceId : fallbackPrice.providerPriceId,
      providerPriceStatus: parsed.providerPriceStatus === 'active' ? 'active' : 'pending_provider_connection',
      providerCheckoutUrl: typeof parsed.providerCheckoutUrl === 'string' ? parsed.providerCheckoutUrl : null,
      providerReference: typeof parsed.providerReference === 'string' ? parsed.providerReference : null,
      transactionId: typeof parsed.transactionId === 'string' ? parsed.transactionId : null,
      failureReason: typeof parsed.failureReason === 'string' ? parsed.failureReason : null,
      failedAt: typeof parsed.failedAt === 'string' ? parsed.failedAt : null,
      retryOf: typeof parsed.retryOf === 'string' ? parsed.retryOf : null,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date(0).toISOString(),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      confirmedAt: typeof parsed.confirmedAt === 'string' ? parsed.confirmedAt : null,
    };
  } catch {
    return null;
  }
}

export function serializeWebCheckoutIntent(intent: WebCheckoutIntent): string {
  return JSON.stringify(intent);
}

export function getWebProBrandTheme(key?: string | null): WebProBrandTheme {
  if (key && Object.prototype.hasOwnProperty.call(WEB_PRO_BRAND_THEMES, key)) {
    return WEB_PRO_BRAND_THEMES[key as WebProBrandTheme['key']];
  }
  return WEB_PRO_BRAND_THEMES.ledger_green;
}

function getWebIncludedFeaturesForTier(tier: WebSubscriptionTier): WebSubscriptionFeature[] {
  if (tier === 'office') {
    return [...freeTierFeatures, ...plusTierFeatures, ...proTierFeatures, ...officeTierFeatures];
  }
  if (tier === 'pro') {
    return [...freeTierFeatures, ...plusTierFeatures, ...proTierFeatures];
  }
  if (tier === 'plus') {
    return [...freeTierFeatures, ...plusTierFeatures];
  }
  return freeTierFeatures;
}

function featureLabel(feature: WebSubscriptionFeature): string {
  return feature
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildWebEntitlementValidUntil(entitlementDays: number, now: Date): string {
  return new Date(now.getTime() + entitlementDays * 86_400_000).toISOString();
}

function isWebSubscriptionExpired(validUntil: string | null): boolean {
  if (!validUntil) {
    return false;
  }
  const timestamp = Date.parse(validUntil);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

function isWebSubscriptionTier(value: unknown): value is WebSubscriptionTier {
  return value === 'free' || value === 'plus' || value === 'pro' || value === 'office';
}

function isWebSubscriptionSource(value: unknown): value is WebSubscriptionSource {
  return (
    value === 'local_default' ||
    value === 'manual' ||
    value === 'purchase_cache' ||
    value === 'restore_cache' ||
    value === 'server_entitlement' ||
    value === 'development'
  );
}

function isWebCheckoutIntentStatus(value: unknown): value is WebCheckoutIntentStatus {
  return value === 'pending' || value === 'confirmed' || value === 'cancelled' || value === 'failed';
}

function isWebCheckoutProvider(value: unknown): value is WebCheckoutIntent['provider'] {
  return (
    value === 'manual_provider_pending' ||
    value === 'razorpay' ||
    value === 'stripe' ||
    value === 'apple' ||
    value === 'google'
  );
}

function isWebCurrencyCode(value: unknown): value is OrbitLedgerCurrencyCode {
  return value === 'INR' || value === 'USD' || value === 'CAD' || value === 'AUD' || value === 'GBP';
}

function isWebPricingCountryCode(value: unknown): value is OrbitLedgerPricingCountryCode {
  return value === 'IN' || value === 'US' || value === 'CA' || value === 'AU' || value === 'GB';
}
