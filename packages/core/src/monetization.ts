export type OrbitLedgerPlanTier = 'free' | 'plus' | 'pro' | 'office';

export type OrbitLedgerBillingInterval = 'monthly' | 'yearly';

export type OrbitLedgerCurrencyCode = 'INR' | 'USD' | 'CAD' | 'AUD' | 'GBP';

export type OrbitLedgerPricingCountryCode = 'IN' | 'US' | 'CA' | 'AU' | 'GB';

export type OrbitLedgerCheckoutProvider = 'manual_provider_pending' | 'razorpay' | 'stripe' | 'apple' | 'google';

export type OrbitLedgerProviderPriceStatus = 'pending_provider_connection' | 'active';

export type OrbitLedgerBillingTaxRule = {
  countryCode: OrbitLedgerPricingCountryCode;
  taxLabel: string;
  registrationLabel: string;
  receiptLabel: string;
  taxDocumentLabel: string;
  registrationRecommended: boolean;
  complianceBasis: string;
  reviewMessage: string;
};

export type OrbitLedgerPurchaseQaArea =
  | 'checkout'
  | 'entitlement'
  | 'billing_portal'
  | 'receipt'
  | 'email_delivery'
  | 'tax_review'
  | 'admin_review';

export type OrbitLedgerPurchaseQaStatus =
  | 'covered'
  | 'provider_pending'
  | 'manual_review_required';

export type OrbitLedgerPurchaseQaCheck = {
  id: string;
  area: OrbitLedgerPurchaseQaArea;
  title: string;
  userImpact: string;
  expectedBehavior: string;
  recoveryAction: string;
  status: OrbitLedgerPurchaseQaStatus;
  launchBlocker: boolean;
  coveredBy: string[];
};

export type OrbitLedgerLiveCheckoutProvider = Exclude<OrbitLedgerCheckoutProvider, 'manual_provider_pending'>;

export type OrbitLedgerProviderGoLiveArea =
  | 'provider_account'
  | 'price_mapping'
  | 'secrets'
  | 'webhooks'
  | 'checkout_experience'
  | 'entitlement_sync'
  | 'billing_documents'
  | 'email_delivery'
  | 'tax_review'
  | 'admin_recovery'
  | 'smoke_test'
  | 'rollback';

export type OrbitLedgerProviderGoLiveCheck = {
  id: string;
  area: OrbitLedgerProviderGoLiveArea;
  provider: OrbitLedgerLiveCheckoutProvider | 'all';
  title: string;
  owner: 'product' | 'engineering' | 'operations' | 'finance';
  requiredBeforeLive: boolean;
  evidence: string;
  failureMode: string;
};

export type OrbitLedgerPurchaseLaunchRunbookStep = {
  id: string;
  phase: 'preflight' | 'provider_setup' | 'controlled_test' | 'launch' | 'post_launch' | 'rollback';
  title: string;
  action: string;
  successCriteria: string;
  rollback: string;
};

export type OrbitLedgerPriceMappingValidationIssue = {
  planId: OrbitLedgerPaidPlanId;
  countryCode: OrbitLedgerPricingCountryCode;
  currencyCode: OrbitLedgerCurrencyCode;
  message: string;
  severity: 'warning' | 'blocker';
};

export type OrbitLedgerPriceMappingValidation = {
  checkedPrices: number;
  activePrices: number;
  pendingPrices: number;
  issues: OrbitLedgerPriceMappingValidationIssue[];
  readyForLiveCheckout: boolean;
};

export type OrbitLedgerControlledPaymentTestStep = {
  id: string;
  label: string;
  expectedEvidence: string;
  requiredBeforePublicLaunch: boolean;
};

export type OrbitLedgerControlledPaymentTestReadiness = {
  totalSteps: number;
  completedSteps: number;
  remainingSteps: number;
  readyForPublicLaunch: boolean;
};

export type OrbitLedgerPurchaseProviderMode =
  | 'provider_pending'
  | 'controlled_test'
  | 'live_enabled'
  | 'disabled';

export type OrbitLedgerPurchaseProviderSafetyState = {
  mode: OrbitLedgerPurchaseProviderMode;
  canCreateCheckout: boolean;
  preservesExistingEntitlements: boolean;
  userMessage: string;
  adminMessage: string;
};

export type OrbitLedgerPurchaseSupportPolicy = {
  id: 'failed_checkout' | 'duplicate_charge' | 'refund_request' | 'cancel_plan' | 'paid_access_missing';
  title: string;
  customerMessage: string;
  supportAction: string;
  providerAction: string;
};

export type OrbitLedgerMonetizationFreezeReadiness = {
  frozen: boolean;
  readyForPublicPaidCheckout: boolean;
  status: 'provider_pending' | 'ready_for_controlled_test' | 'ready_for_public_launch';
  blockers: string[];
  completedRails: string[];
};

export type OrbitLedgerPaidPlanId =
  | 'plus_monthly'
  | 'plus_yearly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'office_monthly'
  | 'office_yearly';

export type OrbitLedgerPlanId = 'free' | OrbitLedgerPaidPlanId;

export type OrbitLedgerSubscriptionProductId =
  | 'com.rudraix.orbitledger.plus.monthly'
  | 'com.rudraix.orbitledger.plus.yearly'
  | 'com.rudraix.orbitledger.pro.monthly'
  | 'com.rudraix.orbitledger.pro.yearly'
  | 'com.rudraix.orbitledger.office.monthly'
  | 'com.rudraix.orbitledger.office.yearly';

export type OrbitLedgerMonetizationFeature =
  | 'daily_ledger'
  | 'customer_management'
  | 'basic_invoices'
  | 'basic_exports'
  | 'backup_restore'
  | 'manual_payment_instructions'
  | 'basic_reports'
  | 'customer_health'
  | 'customer_profile_exports'
  | 'payment_links'
  | 'payment_proof_attachments'
  | 'branded_invoice_basics'
  | 'batch_statements'
  | 'recurring_invoice_rules'
  | 'premium_templates'
  | 'advanced_document_branding'
  | 'recurring_auto_email'
  | 'payment_reconciliation'
  | 'payment_reversals'
  | 'tax_compliance_reports'
  | 'audit_ready_reports'
  | 'advanced_inventory'
  | 'bulk_operations'
  | 'multi_user_workspace'
  | 'accountant_exports'
  | 'priority_support';

export type OrbitLedgerPlanDefinition = {
  tier: OrbitLedgerPlanTier;
  label: string;
  shortLabel: string;
  description: string;
  audience: string;
  includedFeatures: OrbitLedgerMonetizationFeature[];
};

export type OrbitLedgerPaidPlanCatalogItem = {
  id: OrbitLedgerPaidPlanId;
  tier: Exclude<OrbitLedgerPlanTier, 'free'>;
  billingInterval: OrbitLedgerBillingInterval;
  productId: OrbitLedgerSubscriptionProductId;
  label: string;
  shortLabel: string;
  title: string;
  helper: string;
  entitlementDays: number;
  isBestValue: boolean;
};

export type OrbitLedgerPlanPrice = {
  countryCode: OrbitLedgerPricingCountryCode;
  currencyCode: OrbitLedgerCurrencyCode;
  amountMinor: number;
  display: string;
};

export type OrbitLedgerProviderPrice = OrbitLedgerPlanPrice & {
  planId: OrbitLedgerPaidPlanId;
  productId: OrbitLedgerSubscriptionProductId;
  checkoutProvider: OrbitLedgerCheckoutProvider;
  providerPriceId: string;
  providerPriceStatus: OrbitLedgerProviderPriceStatus;
};

export type OrbitLedgerCountryPricing = {
  countryCode: OrbitLedgerPricingCountryCode;
  currencyCode: OrbitLedgerCurrencyCode;
  planPrices: Record<OrbitLedgerPaidPlanId, OrbitLedgerPlanPrice>;
};

export type OrbitLedgerCountryCheckoutMapping = {
  countryCode: OrbitLedgerPricingCountryCode;
  currencyCode: OrbitLedgerCurrencyCode;
  checkoutProvider: OrbitLedgerCheckoutProvider;
  providerPriceStatus: OrbitLedgerProviderPriceStatus;
  planPrices: Record<OrbitLedgerPaidPlanId, OrbitLedgerProviderPrice>;
};

export type OrbitLedgerPlanComparisonRow = {
  feature: string;
  free: string;
  plus: string;
  pro: string;
  office: string;
  highlightTier?: OrbitLedgerPlanTier;
};

const planRank: Record<OrbitLedgerPlanTier, number> = {
  free: 0,
  plus: 10,
  pro: 20,
  office: 30,
};

const paidPlanIds = [
  'plus_monthly',
  'plus_yearly',
  'pro_monthly',
  'pro_yearly',
  'office_monthly',
  'office_yearly',
] as const satisfies readonly OrbitLedgerPaidPlanId[];

export const ORBIT_LEDGER_PLAN_DEFINITIONS: Record<OrbitLedgerPlanTier, OrbitLedgerPlanDefinition> = {
  free: {
    tier: 'free',
    label: 'Free',
    shortLabel: 'Free',
    description: 'Daily ledger, customer records, basic invoices, exports, backup, and restore.',
    audience: 'New and very small businesses that need dependable daily money tracking.',
    includedFeatures: [
      'daily_ledger',
      'customer_management',
      'basic_invoices',
      'basic_exports',
      'backup_restore',
      'manual_payment_instructions',
      'basic_reports',
    ],
  },
  plus: {
    tier: 'plus',
    label: 'Plus',
    shortLabel: 'Plus',
    description: 'Stronger customer exports, health ranking, payment links, proof attachments, and batch office work.',
    audience: 'Owners who send documents often and want fewer repeated steps.',
    includedFeatures: [
      'daily_ledger',
      'customer_management',
      'basic_invoices',
      'basic_exports',
      'backup_restore',
      'manual_payment_instructions',
      'basic_reports',
      'customer_health',
      'customer_profile_exports',
      'payment_links',
      'payment_proof_attachments',
      'branded_invoice_basics',
      'batch_statements',
      'recurring_invoice_rules',
    ],
  },
  pro: {
    tier: 'pro',
    label: 'Pro Plus',
    shortLabel: 'Pro',
    description: 'Premium templates, advanced branding, auto email, reconciliation, audit-ready reports, and tax surfaces.',
    audience: 'Growing businesses that need professional documents and tighter payment control.',
    includedFeatures: [
      'daily_ledger',
      'customer_management',
      'basic_invoices',
      'basic_exports',
      'backup_restore',
      'manual_payment_instructions',
      'basic_reports',
      'customer_health',
      'customer_profile_exports',
      'payment_links',
      'payment_proof_attachments',
      'branded_invoice_basics',
      'batch_statements',
      'recurring_invoice_rules',
      'premium_templates',
      'advanced_document_branding',
      'recurring_auto_email',
      'payment_reconciliation',
      'payment_reversals',
      'tax_compliance_reports',
      'audit_ready_reports',
      'advanced_inventory',
    ],
  },
  office: {
    tier: 'office',
    label: 'Office',
    shortLabel: 'Office',
    description: 'Office-grade controls for teams, accountant exports, bulk work, compliance review, and priority support.',
    audience: 'Busy offices, multi-user teams, and businesses working with accountants.',
    includedFeatures: [
      'daily_ledger',
      'customer_management',
      'basic_invoices',
      'basic_exports',
      'backup_restore',
      'manual_payment_instructions',
      'basic_reports',
      'customer_health',
      'customer_profile_exports',
      'payment_links',
      'payment_proof_attachments',
      'branded_invoice_basics',
      'batch_statements',
      'recurring_invoice_rules',
      'premium_templates',
      'advanced_document_branding',
      'recurring_auto_email',
      'payment_reconciliation',
      'payment_reversals',
      'tax_compliance_reports',
      'audit_ready_reports',
      'advanced_inventory',
      'bulk_operations',
      'multi_user_workspace',
      'accountant_exports',
      'priority_support',
    ],
  },
};

export const ORBIT_LEDGER_PAID_PLAN_CATALOG: OrbitLedgerPaidPlanCatalogItem[] = [
  paidPlan('plus_monthly', 'plus', 'monthly', 'com.rudraix.orbitledger.plus.monthly', 'Plus Monthly', 'Monthly', 'Useful upgrades for regular document sharing.', 30, false),
  paidPlan('plus_yearly', 'plus', 'yearly', 'com.rudraix.orbitledger.plus.yearly', 'Plus Yearly', 'Yearly', 'Best value for owners who use Orbit Ledger every week.', 365, true),
  paidPlan('pro_monthly', 'pro', 'monthly', 'com.rudraix.orbitledger.pro.monthly', 'Pro Plus Monthly', 'Monthly', 'Premium documents, automation, and stronger payment control.', 30, false),
  paidPlan('pro_yearly', 'pro', 'yearly', 'com.rudraix.orbitledger.pro.yearly', 'Pro Plus Yearly', 'Yearly', 'Best value for growing businesses that rely on polished workflows.', 365, true),
  paidPlan('office_monthly', 'office', 'monthly', 'com.rudraix.orbitledger.office.monthly', 'Office Monthly', 'Monthly', 'Office-grade controls for heavier review, bulk work, and teams.', 30, false),
  paidPlan('office_yearly', 'office', 'yearly', 'com.rudraix.orbitledger.office.yearly', 'Office Yearly', 'Yearly', 'Best value for teams and accountant-supported businesses.', 365, true),
];

export const ORBIT_LEDGER_SUBSCRIPTION_PRODUCT_IDS = ORBIT_LEDGER_PAID_PLAN_CATALOG.map(
  (plan) => plan.productId
);

export const ORBIT_LEDGER_FEATURE_REQUIRED_TIER: Record<
  OrbitLedgerMonetizationFeature,
  OrbitLedgerPlanTier
> = {
  daily_ledger: 'free',
  customer_management: 'free',
  basic_invoices: 'free',
  basic_exports: 'free',
  backup_restore: 'free',
  manual_payment_instructions: 'free',
  basic_reports: 'free',
  customer_health: 'plus',
  customer_profile_exports: 'plus',
  payment_links: 'plus',
  payment_proof_attachments: 'plus',
  branded_invoice_basics: 'plus',
  batch_statements: 'plus',
  recurring_invoice_rules: 'plus',
  premium_templates: 'pro',
  advanced_document_branding: 'pro',
  recurring_auto_email: 'pro',
  payment_reconciliation: 'pro',
  payment_reversals: 'pro',
  tax_compliance_reports: 'pro',
  audit_ready_reports: 'pro',
  advanced_inventory: 'pro',
  bulk_operations: 'office',
  multi_user_workspace: 'office',
  accountant_exports: 'office',
  priority_support: 'office',
};

export const ORBIT_LEDGER_PLAN_COMPARISON: OrbitLedgerPlanComparisonRow[] = [
  {
    feature: 'Daily ledger and customer records',
    free: 'Included',
    plus: 'Included',
    pro: 'Included',
    office: 'Included',
  },
  {
    feature: 'Invoices, PDF, CSV, backup, and restore',
    free: 'Basic documents',
    plus: 'Better exports',
    pro: 'Premium output',
    office: 'Bulk-ready output',
    highlightTier: 'plus',
  },
  {
    feature: 'Customer health and profile reports',
    free: 'Basic view',
    plus: 'Ranking and PDF/CSV reports',
    pro: 'Advanced review',
    office: 'Office review pack',
    highlightTier: 'plus',
  },
  {
    feature: 'Payment links and proof attachments',
    free: 'Manual instructions',
    plus: 'Links and proof files',
    pro: 'Review and reconciliation',
    office: 'Team review',
    highlightTier: 'plus',
  },
  {
    feature: 'Invoice templates and branding',
    free: 'Free templates',
    plus: 'Light branding',
    pro: 'Premium templates and watermark',
    office: 'Team brand controls',
    highlightTier: 'pro',
  },
  {
    feature: 'Recurring invoices and automatic email',
    free: 'Not included',
    plus: 'Recurring draft rules',
    pro: 'Auto email and history',
    office: 'Team-safe automation',
    highlightTier: 'pro',
  },
  {
    feature: 'Tax and audit reports',
    free: 'Starter summaries',
    plus: 'Exportable summaries',
    pro: 'Compliance surfaces',
    office: 'Audit-ready packs',
    highlightTier: 'pro',
  },
  {
    feature: 'Bulk work, team controls, and support',
    free: 'Self-service',
    plus: 'Focused upgrades',
    pro: 'Advanced workflows',
    office: 'Teams, accountant exports, priority support',
    highlightTier: 'office',
  },
];

export const ORBIT_LEDGER_COUNTRY_PRICING: Record<
  OrbitLedgerPricingCountryCode,
  OrbitLedgerCountryPricing
> = {
  IN: countryPricing('IN', 'INR', {
    plus_monthly: 9900,
    plus_yearly: 99900,
    pro_monthly: 19900,
    pro_yearly: 199900,
    office_monthly: 49900,
    office_yearly: 499900,
  }),
  US: countryPricing('US', 'USD', {
    plus_monthly: 499,
    plus_yearly: 4999,
    pro_monthly: 999,
    pro_yearly: 9999,
    office_monthly: 2499,
    office_yearly: 24999,
  }),
  CA: countryPricing('CA', 'CAD', {
    plus_monthly: 699,
    plus_yearly: 6999,
    pro_monthly: 1299,
    pro_yearly: 12999,
    office_monthly: 3299,
    office_yearly: 32999,
  }),
  AU: countryPricing('AU', 'AUD', {
    plus_monthly: 799,
    plus_yearly: 7999,
    pro_monthly: 1499,
    pro_yearly: 14999,
    office_monthly: 3999,
    office_yearly: 39999,
  }),
  GB: countryPricing('GB', 'GBP', {
    plus_monthly: 399,
    plus_yearly: 3999,
    pro_monthly: 799,
    pro_yearly: 7999,
    office_monthly: 1999,
    office_yearly: 19999,
  }),
};

const ORBIT_LEDGER_COUNTRY_CHECKOUT_PROVIDER: Record<OrbitLedgerPricingCountryCode, OrbitLedgerCheckoutProvider> = {
  IN: 'razorpay',
  US: 'razorpay',
  CA: 'razorpay',
  AU: 'razorpay',
  GB: 'razorpay',
};

export const ORBIT_LEDGER_BILLING_TAX_RULES: Record<OrbitLedgerPricingCountryCode, OrbitLedgerBillingTaxRule> = {
  IN: {
    countryCode: 'IN',
    taxLabel: 'GST',
    registrationLabel: 'GSTIN / PAN',
    receiptLabel: 'Receipt',
    taxDocumentLabel: 'GST tax invoice',
    registrationRecommended: true,
    complianceBasis: 'india_gst',
    reviewMessage: 'Keep GSTIN or PAN for business tax records when needed.',
  },
  US: {
    countryCode: 'US',
    taxLabel: 'Sales tax',
    registrationLabel: 'Tax ID',
    receiptLabel: 'Receipt',
    taxDocumentLabel: 'Receipt',
    registrationRecommended: false,
    complianceBasis: 'us_state_sales_tax',
    reviewMessage: 'Sales tax can vary by state, so final tax treatment needs provider or accountant review.',
  },
  CA: {
    countryCode: 'CA',
    taxLabel: 'GST/HST',
    registrationLabel: 'Business number',
    receiptLabel: 'Receipt',
    taxDocumentLabel: 'GST/HST receipt',
    registrationRecommended: true,
    complianceBasis: 'canada_gst_hst',
    reviewMessage: 'Keep business number details when they are needed for GST/HST records.',
  },
  AU: {
    countryCode: 'AU',
    taxLabel: 'GST',
    registrationLabel: 'ABN',
    receiptLabel: 'Receipt',
    taxDocumentLabel: 'Tax invoice',
    registrationRecommended: true,
    complianceBasis: 'australia_gst',
    reviewMessage: 'Keep ABN details when they are needed for GST records.',
  },
  GB: {
    countryCode: 'GB',
    taxLabel: 'VAT',
    registrationLabel: 'VAT number',
    receiptLabel: 'Receipt',
    taxDocumentLabel: 'VAT invoice',
    registrationRecommended: true,
    complianceBasis: 'uk_vat',
    reviewMessage: 'Keep VAT number details when they are needed for VAT records.',
  },
};

export const ORBIT_LEDGER_PURCHASE_QA_MATRIX: OrbitLedgerPurchaseQaCheck[] = [
  {
    id: 'provider_checkout_boundary',
    area: 'checkout',
    title: 'Provider checkout boundary',
    userImpact: 'A customer should never think payment was collected when a checkout provider is not connected.',
    expectedBehavior: 'Checkout returns a calm provider-pending state, shows no live payment URL, and does not activate paid access.',
    recoveryAction: 'Connect the real provider price IDs and retry checkout from the same plan card.',
    status: 'provider_pending',
    launchBlocker: false,
    coveredBy: [
      'apps/web/src/lib/web-monetization.test.ts',
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'checkout_failure_retry',
    area: 'checkout',
    title: 'Checkout failure recovery',
    userImpact: 'A failed checkout should be recoverable without creating paid access or losing the selected plan.',
    expectedBehavior: 'Failure is recorded, paid access stays locked, and retry creates a fresh pending checkout linked to the failed one.',
    recoveryAction: 'Show retry messaging and let the user start a fresh checkout safely.',
    status: 'covered',
    launchBlocker: false,
    coveredBy: [
      'apps/web/src/lib/web-monetization.test.ts',
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'pending_checkout_lock',
    area: 'checkout',
    title: 'Pending checkout lock',
    userImpact: 'A user should not accidentally start multiple purchases while one checkout is still waiting.',
    expectedBehavior: 'A pending checkout blocks another plan selection until it is completed, cancelled, or retried after failure.',
    recoveryAction: 'Ask the user to finish the pending checkout or retry only after the previous attempt fails.',
    status: 'covered',
    launchBlocker: false,
    coveredBy: ['apps/web/src/lib/web-monetization.test.ts'],
  },
  {
    id: 'entitlement_confirmation',
    area: 'entitlement',
    title: 'Server entitlement confirmation',
    userImpact: 'Paid features should unlock only after trusted server confirmation.',
    expectedBehavior: 'Confirmed provider events create the server entitlement, entitlement audit item, and checkout confirmation state.',
    recoveryAction: 'Use purchase recovery to reload the server entitlement if the browser cache is stale.',
    status: 'covered',
    launchBlocker: false,
    coveredBy: [
      'apps/functions/src/providerPayload.test.ts',
      'apps/web/src/lib/web-monetization.test.ts',
    ],
  },
  {
    id: 'downgrade_renewal_queue',
    area: 'entitlement',
    title: 'Downgrade and billing-cycle safety',
    userImpact: 'A user should not lose paid features immediately because they clicked a lower plan or different billing cycle.',
    expectedBehavior: 'Downgrades and billing-cycle changes are queued for renewal review instead of changing access immediately.',
    recoveryAction: 'Review queued renewal changes from the admin queue and apply them at the correct renewal boundary.',
    status: 'covered',
    launchBlocker: false,
    coveredBy: [
      'apps/web/src/lib/web-monetization.test.ts',
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'billing_portal_boundary',
    area: 'billing_portal',
    title: 'Billing portal provider boundary',
    userImpact: 'Billing management should not expose broken provider language or pretend the portal is live.',
    expectedBehavior: 'When provider management is not connected, the app creates a reviewable request and shows calm guidance.',
    recoveryAction: 'Process the queued renewal or billing request manually until the provider portal is connected.',
    status: 'provider_pending',
    launchBlocker: false,
    coveredBy: ['apps/functions/src/providerPayload.test.ts'],
  },
  {
    id: 'receipt_recovery',
    area: 'receipt',
    title: 'Receipt and tax document recovery',
    userImpact: 'A confirmed purchase should always be recoverable into a downloadable billing document.',
    expectedBehavior: 'Receipt metadata can be rebuilt from checkout, pricing, workspace, and provider confirmation records.',
    recoveryAction: 'Use Recover on the billing document row to rebuild the receipt and tax metadata.',
    status: 'covered',
    launchBlocker: false,
    coveredBy: [
      'apps/web/src/lib/subscription-billing-documents.test.ts',
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'receipt_email_delivery',
    area: 'email_delivery',
    title: 'Billing email delivery tracking',
    userImpact: 'A user should know whether a receipt email is queued, pending provider setup, sent, failed, or resent.',
    expectedBehavior: 'Email requests track delivery status, provider state, recipient, resend count, and last error without exposing provider jargon.',
    recoveryAction: 'Retry or manually resend from the billing email admin review queue.',
    status: 'provider_pending',
    launchBlocker: false,
    coveredBy: [
      'apps/functions/src/providerPayload.test.ts',
      'apps/web/src/lib/subscription-billing-documents.test.ts',
    ],
  },
  {
    id: 'billing_email_admin_review',
    area: 'admin_review',
    title: 'Billing email admin review',
    userImpact: 'Failed or provider-pending receipt emails should not disappear from operations view.',
    expectedBehavior: 'Every receipt email request creates or updates an admin queue item with review status and manual resend context.',
    recoveryAction: 'Admin can review pending or failed delivery, then resend once the provider is connected.',
    status: 'covered',
    launchBlocker: false,
    coveredBy: ['apps/functions/src/providerPayload.test.ts'],
  },
  {
    id: 'country_tax_review',
    area: 'tax_review',
    title: 'Country tax compliance review',
    userImpact: 'Receipts and tax documents should clearly show when country tax details need review before live billing.',
    expectedBehavior: 'Country rules label GST, VAT, GST/HST, ABN, or sales tax review needs and flag missing business tax IDs.',
    recoveryAction: 'Collect missing business tax details and complete provider/accountant review before live provider billing.',
    status: 'manual_review_required',
    launchBlocker: false,
    coveredBy: [
      'packages/core/src/monetization.test.ts',
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
];

export const ORBIT_LEDGER_PROVIDER_GO_LIVE_CHECKLIST: OrbitLedgerProviderGoLiveCheck[] = [
  {
    id: 'provider_business_account_verified',
    area: 'provider_account',
    provider: 'all',
    title: 'Provider business account is verified',
    owner: 'operations',
    requiredBeforeLive: true,
    evidence: 'Provider dashboard shows verified business/KYC, settlement account, support contact, and live mode access.',
    failureMode: 'Checkout may fail, settlement may be blocked, or paid users may not receive service access.',
  },
  {
    id: 'country_currency_plan_mapping_approved',
    area: 'price_mapping',
    provider: 'all',
    title: 'Country, currency, and plan mapping is approved',
    owner: 'finance',
    requiredBeforeLive: true,
    evidence: 'Free, Plus, Pro Plus, and Office prices are approved for INR, USD, CAD, AUD, and GBP.',
    failureMode: 'Users may see the wrong price, wrong currency, or an unavailable plan for their country.',
  },
  {
    id: 'live_provider_price_ids_saved',
    area: 'price_mapping',
    provider: 'all',
    title: 'Live provider price IDs are saved',
    owner: 'engineering',
    requiredBeforeLive: true,
    evidence: 'Every paid plan has an active provider price ID for its country checkout mapping.',
    failureMode: 'Checkout remains in provider-pending mode and cannot collect payment.',
  },
  {
    id: 'razorpay_live_credentials_configured',
    area: 'secrets',
    provider: 'razorpay',
    title: 'Razorpay live credentials are configured',
    owner: 'engineering',
    requiredBeforeLive: true,
    evidence: 'Razorpay live key ID, key secret, and webhook secret are stored as deployment secrets.',
    failureMode: 'India checkout cannot create payment links or verify payment confirmation.',
  },
  {
    id: 'app_store_purchase_boundaries_defined',
    area: 'provider_account',
    provider: 'all',
    title: 'Apple and Google purchase boundaries are defined',
    owner: 'product',
    requiredBeforeLive: false,
    evidence: 'Mobile store purchase behavior is documented before enabling native in-app purchases. Stripe is not part of the current launch.',
    failureMode: 'Mobile purchase behavior may diverge from web if app-store purchases are enabled without a shared entitlement sync.',
  },
  {
    id: 'webhook_signature_verification_enabled',
    area: 'webhooks',
    provider: 'all',
    title: 'Webhook signature verification is enabled',
    owner: 'engineering',
    requiredBeforeLive: true,
    evidence: 'Provider webhook endpoints reject malformed signatures and only accept trusted raw payloads.',
    failureMode: 'Fake payment events could unlock paid access or corrupt billing records.',
  },
  {
    id: 'checkout_callback_domains_verified',
    area: 'checkout_experience',
    provider: 'all',
    title: 'Checkout callback domains are verified',
    owner: 'engineering',
    requiredBeforeLive: true,
    evidence: 'Production domains, payment callback URLs, and auth domains use Orbit Ledger branding.',
    failureMode: 'Users may be redirected to unsafe, local, or confusing callback pages after payment.',
  },
  {
    id: 'entitlement_webhook_sync_tested',
    area: 'entitlement_sync',
    provider: 'all',
    title: 'Entitlement webhook sync is tested',
    owner: 'engineering',
    requiredBeforeLive: true,
    evidence: 'A confirmed provider event creates checkout confirmation, entitlement, and audit records.',
    failureMode: 'Payment may be collected while paid features remain locked.',
  },
  {
    id: 'billing_document_generation_reviewed',
    area: 'billing_documents',
    provider: 'all',
    title: 'Receipt and tax document generation is reviewed',
    owner: 'finance',
    requiredBeforeLive: true,
    evidence: 'Receipt number, tax document label, buyer details, plan, currency, and amount are correct for each country.',
    failureMode: 'Users may receive incomplete receipts or country-inaccurate billing documents.',
  },
  {
    id: 'billing_email_delivery_connected',
    area: 'email_delivery',
    provider: 'all',
    title: 'Billing email delivery is connected',
    owner: 'engineering',
    requiredBeforeLive: false,
    evidence: 'Receipt email queue can deliver, track sent/failed status, and support manual resend.',
    failureMode: 'Receipt emails remain pending and operations must manually share billing documents.',
  },
  {
    id: 'country_tax_review_completed',
    area: 'tax_review',
    provider: 'all',
    title: 'Country tax review is completed',
    owner: 'finance',
    requiredBeforeLive: true,
    evidence: 'GST, VAT, GST/HST, ABN, and US sales-tax review notes are approved for launch countries.',
    failureMode: 'Checkout may collect payment with unclear tax treatment or missing business tax data.',
  },
  {
    id: 'admin_recovery_queue_operational',
    area: 'admin_recovery',
    provider: 'all',
    title: 'Admin recovery queue is operational',
    owner: 'operations',
    requiredBeforeLive: true,
    evidence: 'Operations can review failed checkouts, receipt recovery, billing email delivery, and renewal-change requests.',
    failureMode: 'Support cannot resolve purchase failures quickly after launch.',
  },
  {
    id: 'one_real_small_value_payment_per_provider',
    area: 'smoke_test',
    provider: 'all',
    title: 'Small-value live payment is verified per provider',
    owner: 'operations',
    requiredBeforeLive: true,
    evidence: 'A small live payment confirms checkout, webhook, entitlement, receipt, email status, and refund path.',
    failureMode: 'Untested live checkout may fail for real users even when sandbox tests pass.',
  },
  {
    id: 'purchase_rollback_switch_ready',
    area: 'rollback',
    provider: 'all',
    title: 'Purchase rollback switch is ready',
    owner: 'engineering',
    requiredBeforeLive: true,
    evidence: 'Provider checkout can be switched back to provider-pending/manual mode without breaking existing entitlements.',
    failureMode: 'A broken provider launch could keep collecting bad checkout attempts with no quick stop.',
  },
];

export const ORBIT_LEDGER_PURCHASE_LAUNCH_RUNBOOK: OrbitLedgerPurchaseLaunchRunbookStep[] = [
  {
    id: 'freeze_purchase_scope',
    phase: 'preflight',
    title: 'Freeze purchase scope',
    action: 'Confirm Free, Plus, Pro Plus, Office plans, launch countries, currencies, refund language, and support owner.',
    successCriteria: 'No pricing, plan, or entitlement rule is still changing during provider setup.',
    rollback: 'Keep checkout in provider-pending mode and continue manual upgrades only.',
  },
  {
    id: 'run_purchase_qa_matrix',
    phase: 'preflight',
    title: 'Run purchase QA matrix',
    action: 'Run the purchase, billing document, entitlement, mobile subscription, and provider payload tests.',
    successCriteria: 'All purchase QA tests pass and the shared matrix has no launch blockers.',
    rollback: 'Do not connect live provider credentials until failing checks are fixed.',
  },
  {
    id: 'configure_live_provider_accounts',
    phase: 'provider_setup',
    title: 'Configure live provider accounts',
    action: 'Complete provider KYC, settlement, live keys, webhook secrets, live price IDs, and callback domains.',
    successCriteria: 'Provider dashboards show live-ready status and every checkout country maps to an active price ID.',
    rollback: 'Remove live keys and keep provider price status as pending connection.',
  },
  {
    id: 'deploy_provider_configuration',
    phase: 'provider_setup',
    title: 'Deploy provider configuration',
    action: 'Deploy secrets, functions, Firestore rules, and web build with provider checkout still monitored.',
    successCriteria: 'Production endpoints respond, reject bad signatures, and create pending checkout records safely.',
    rollback: 'Redeploy previous functions or provider-pending configuration.',
  },
  {
    id: 'run_controlled_live_payment',
    phase: 'controlled_test',
    title: 'Run controlled live payment',
    action: 'Use a small real payment for each live provider and country path before public announcement.',
    successCriteria: 'Checkout, webhook, entitlement, receipt download, billing email state, and audit trail are correct.',
    rollback: 'Refund the test payment, disable checkout provider, and review logs before retesting.',
  },
  {
    id: 'open_purchase_to_users',
    phase: 'launch',
    title: 'Open purchase to users',
    action: 'Enable provider checkout in the market screen and monitor checkout, entitlement, receipt, and admin queues.',
    successCriteria: 'Users can purchase without support intervention, and failed purchases show retry/recovery messaging.',
    rollback: 'Switch checkout back to provider-pending/manual mode and keep paid entitlements intact.',
  },
  {
    id: 'monitor_first_72_hours',
    phase: 'post_launch',
    title: 'Monitor first 72 hours',
    action: 'Review failed checkout records, provider callbacks, receipt emails, refunds, and support messages twice daily.',
    successCriteria: 'No repeated checkout failure, entitlement delay, receipt failure, or tax metadata issue remains unresolved.',
    rollback: 'Pause new checkout and keep support-facing recovery queue active.',
  },
  {
    id: 'execute_purchase_rollback',
    phase: 'rollback',
    title: 'Execute purchase rollback if needed',
    action: 'Disable live checkout creation, preserve entitlements, stop broken email delivery, and document affected attempts.',
    successCriteria: 'No new failed live payments are created while existing paid users keep access.',
    rollback: 'After fix verification, repeat controlled live payment before reopening checkout.',
  },
];

export const ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS: OrbitLedgerControlledPaymentTestStep[] = [
  {
    id: 'create_small_checkout',
    label: 'Create small-value checkout',
    expectedEvidence: 'Admin can create a small Razorpay checkout for a test workspace.',
    requiredBeforePublicLaunch: true,
  },
  {
    id: 'complete_provider_payment',
    label: 'Complete provider payment',
    expectedEvidence: 'Razorpay shows the payment as captured or successful.',
    requiredBeforePublicLaunch: true,
  },
  {
    id: 'receive_verified_webhook',
    label: 'Receive verified webhook',
    expectedEvidence: 'Functions accept the signed webhook and reject an invalid signature.',
    requiredBeforePublicLaunch: true,
  },
  {
    id: 'activate_entitlement',
    label: 'Activate entitlement',
    expectedEvidence: 'Correct plan access is active for the purchased workspace.',
    requiredBeforePublicLaunch: true,
  },
  {
    id: 'recover_billing_document',
    label: 'Review receipt and tax document',
    expectedEvidence: 'Receipt can be viewed, downloaded, recovered, and reviewed for tax metadata.',
    requiredBeforePublicLaunch: true,
  },
  {
    id: 'review_billing_email_state',
    label: 'Review billing email state',
    expectedEvidence: 'Receipt email is sent, queued, failed, or provider-pending with visible admin state.',
    requiredBeforePublicLaunch: true,
  },
  {
    id: 'verify_refund_path',
    label: 'Verify refund path',
    expectedEvidence: 'Refund/reversal path is understood and support copy is ready.',
    requiredBeforePublicLaunch: true,
  },
];

export const ORBIT_LEDGER_PURCHASE_SUPPORT_POLICIES: OrbitLedgerPurchaseSupportPolicy[] = [
  {
    id: 'failed_checkout',
    title: 'Checkout could not be completed',
    customerMessage: 'Your plan was not changed. You can retry checkout when ready.',
    supportAction: 'Confirm no entitlement was activated and help the user retry from Market.',
    providerAction: 'No provider action is needed unless the provider dashboard shows a captured payment.',
  },
  {
    id: 'duplicate_charge',
    title: 'Possible duplicate charge',
    customerMessage: 'We will review the payment references and keep your access correct.',
    supportAction: 'Compare checkout intent IDs, provider references, entitlement records, and receipt numbers.',
    providerAction: 'Refund or void the duplicate provider payment after confirming which charge should remain.',
  },
  {
    id: 'refund_request',
    title: 'Refund request',
    customerMessage: 'Refund requests are reviewed with the purchase record and provider reference.',
    supportAction: 'Review the receipt, entitlement audit, usage state, and provider transaction before approving.',
    providerAction: 'Process refund from Razorpay after approval, then record the reversal/audit note.',
  },
  {
    id: 'cancel_plan',
    title: 'Cancel or change plan',
    customerMessage: 'Your current access stays active until the renewal change is processed.',
    supportAction: 'Queue downgrade or billing-cycle change for renewal review; do not remove access immediately.',
    providerAction: 'Update the provider subscription only when live provider billing is connected.',
  },
  {
    id: 'paid_access_missing',
    title: 'Paid access is missing',
    customerMessage: 'We will restore confirmed purchase access after checking the payment record.',
    supportAction: 'Use purchase recovery, verify webhook/audit records, and restore entitlement from server truth.',
    providerAction: 'Check provider payment status only if Orbit Ledger has no trusted confirmation record.',
  },
];

export function getOrbitLedgerPurchaseQaMatrix(
  area?: OrbitLedgerPurchaseQaArea
): OrbitLedgerPurchaseQaCheck[] {
  return area ? ORBIT_LEDGER_PURCHASE_QA_MATRIX.filter((check) => check.area === area) : ORBIT_LEDGER_PURCHASE_QA_MATRIX;
}

export function getOrbitLedgerPurchaseQaLaunchBlockers(
  checks: OrbitLedgerPurchaseQaCheck[] = ORBIT_LEDGER_PURCHASE_QA_MATRIX
): OrbitLedgerPurchaseQaCheck[] {
  return checks.filter((check) => check.launchBlocker);
}

export function getOrbitLedgerPurchaseQaReadiness(
  checks: OrbitLedgerPurchaseQaCheck[] = ORBIT_LEDGER_PURCHASE_QA_MATRIX
): {
  total: number;
  covered: number;
  providerPending: number;
  manualReviewRequired: number;
  launchBlockers: number;
  readyForLaunchWithoutProvider: boolean;
} {
  const launchBlockers = getOrbitLedgerPurchaseQaLaunchBlockers(checks).length;
  return {
    total: checks.length,
    covered: checks.filter((check) => check.status === 'covered').length,
    providerPending: checks.filter((check) => check.status === 'provider_pending').length,
    manualReviewRequired: checks.filter((check) => check.status === 'manual_review_required').length,
    launchBlockers,
    readyForLaunchWithoutProvider: launchBlockers === 0,
  };
}

export function getOrbitLedgerProviderGoLiveChecklist(
  provider?: OrbitLedgerLiveCheckoutProvider | 'all'
): OrbitLedgerProviderGoLiveCheck[] {
  if (!provider || provider === 'all') {
    return ORBIT_LEDGER_PROVIDER_GO_LIVE_CHECKLIST;
  }
  return ORBIT_LEDGER_PROVIDER_GO_LIVE_CHECKLIST.filter(
    (check) => check.provider === provider || check.provider === 'all'
  );
}

export function getOrbitLedgerRequiredProviderGoLiveChecks(
  provider?: OrbitLedgerLiveCheckoutProvider | 'all'
): OrbitLedgerProviderGoLiveCheck[] {
  return getOrbitLedgerProviderGoLiveChecklist(provider).filter((check) => check.requiredBeforeLive);
}

export function getOrbitLedgerPurchaseLaunchRunbook(
  phase?: OrbitLedgerPurchaseLaunchRunbookStep['phase']
): OrbitLedgerPurchaseLaunchRunbookStep[] {
  return phase
    ? ORBIT_LEDGER_PURCHASE_LAUNCH_RUNBOOK.filter((step) => step.phase === phase)
    : ORBIT_LEDGER_PURCHASE_LAUNCH_RUNBOOK;
}

export function getOrbitLedgerPriceMappingValidation(options: {
  requireActiveProviderPrices?: boolean;
} = {}): OrbitLedgerPriceMappingValidation {
  const issues: OrbitLedgerPriceMappingValidationIssue[] = [];
  let checkedPrices = 0;
  let activePrices = 0;
  let pendingPrices = 0;

  Object.values(ORBIT_LEDGER_COUNTRY_CHECKOUT_PROVIDER).forEach((provider) => {
    if (provider !== 'razorpay') {
      // Keep this guard strict while Razorpay is the only launch provider.
      issues.push({
        planId: 'plus_monthly',
        countryCode: 'IN',
        currencyCode: 'INR',
        message: 'A launch country is mapped to a non-Razorpay checkout provider.',
        severity: 'blocker',
      });
    }
  });

  Object.values(ORBIT_LEDGER_COUNTRY_PRICING).forEach((countryPricing) => {
    paidPlanIds.forEach((planId) => {
      checkedPrices += 1;
      const providerPrice = getOrbitLedgerProviderPrice(planId, countryPricing.countryCode);
      if (providerPrice.currencyCode !== countryPricing.currencyCode) {
        issues.push({
          planId,
          countryCode: countryPricing.countryCode,
          currencyCode: providerPrice.currencyCode,
          message: `Currency should be ${countryPricing.currencyCode}.`,
          severity: 'blocker',
        });
      }
      if (providerPrice.checkoutProvider !== 'razorpay') {
        issues.push({
          planId,
          countryCode: countryPricing.countryCode,
          currencyCode: providerPrice.currencyCode,
          message: 'Provider must be Razorpay for the current launch.',
          severity: 'blocker',
        });
      }
      if (!providerPrice.providerPriceId.trim()) {
        issues.push({
          planId,
          countryCode: countryPricing.countryCode,
          currencyCode: providerPrice.currencyCode,
          message: 'Provider price ID is missing.',
          severity: 'blocker',
        });
      }
      if (providerPrice.providerPriceStatus === 'active') {
        activePrices += 1;
      } else {
        pendingPrices += 1;
        if (options.requireActiveProviderPrices) {
          issues.push({
            planId,
            countryCode: countryPricing.countryCode,
            currencyCode: providerPrice.currencyCode,
            message: 'Live Razorpay price ID is not active yet.',
            severity: 'blocker',
          });
        }
      }
    });
  });

  return {
    checkedPrices,
    activePrices,
    pendingPrices,
    issues,
    readyForLiveCheckout: issues.every((issue) => issue.severity !== 'blocker'),
  };
}

export function getOrbitLedgerControlledPaymentTestReadiness(
  completedStepIds: string[] = []
): OrbitLedgerControlledPaymentTestReadiness {
  const completed = new Set(completedStepIds);
  const requiredSteps = ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS.filter((step) => step.requiredBeforePublicLaunch);
  const completedSteps = requiredSteps.filter((step) => completed.has(step.id)).length;
  return {
    totalSteps: requiredSteps.length,
    completedSteps,
    remainingSteps: requiredSteps.length - completedSteps,
    readyForPublicLaunch: completedSteps === requiredSteps.length,
  };
}

export function getOrbitLedgerPurchaseProviderSafetyState(
  mode: OrbitLedgerPurchaseProviderMode
): OrbitLedgerPurchaseProviderSafetyState {
  if (mode === 'live_enabled') {
    return {
      mode,
      canCreateCheckout: true,
      preservesExistingEntitlements: true,
      userMessage: 'Checkout is available.',
      adminMessage: 'Live provider checkout is enabled. Monitor purchase operations closely.',
    };
  }
  if (mode === 'controlled_test') {
    return {
      mode,
      canCreateCheckout: true,
      preservesExistingEntitlements: true,
      userMessage: 'Checkout is available for controlled testing.',
      adminMessage: 'Only controlled test purchases should be run in this mode.',
    };
  }
  if (mode === 'disabled') {
    return {
      mode,
      canCreateCheckout: false,
      preservesExistingEntitlements: true,
      userMessage: 'Checkout is temporarily unavailable. Existing plan access is not affected.',
      adminMessage: 'New checkout is disabled. Existing entitlements must remain active.',
    };
  }
  return {
    mode,
    canCreateCheckout: false,
    preservesExistingEntitlements: true,
    userMessage: 'Checkout will be available after payment setup is complete.',
    adminMessage: 'Provider setup is pending. Keep checkout preparation safe and do not collect payment.',
  };
}

export function getOrbitLedgerPurchaseSupportPolicies(): OrbitLedgerPurchaseSupportPolicy[] {
  return ORBIT_LEDGER_PURCHASE_SUPPORT_POLICIES;
}

export function getOrbitLedgerMonetizationFreezeReadiness(input: {
  providerMode: OrbitLedgerPurchaseProviderMode;
  livePriceMapping: OrbitLedgerPriceMappingValidation;
  controlledPayment: OrbitLedgerControlledPaymentTestReadiness;
  launchBlockers?: string[];
}): OrbitLedgerMonetizationFreezeReadiness {
  const blockers = [...(input.launchBlockers ?? [])];
  if (input.providerMode !== 'live_enabled') {
    blockers.push('Razorpay live checkout is not enabled yet.');
  }
  if (!input.livePriceMapping.readyForLiveCheckout) {
    blockers.push('Live Razorpay price IDs are not active for every launch price.');
  }
  if (!input.controlledPayment.readyForPublicLaunch) {
    blockers.push('Controlled live payment test has not been completed.');
  }

  const readyForPublicPaidCheckout = blockers.length === 0;
  const readyForControlledTest =
    input.providerMode === 'controlled_test' &&
    input.livePriceMapping.readyForLiveCheckout &&
    !input.controlledPayment.readyForPublicLaunch;

  return {
    frozen: true,
    readyForPublicPaidCheckout,
    status: readyForPublicPaidCheckout
      ? 'ready_for_public_launch'
      : readyForControlledTest
        ? 'ready_for_controlled_test'
        : 'provider_pending',
    blockers,
    completedRails: [
      'Plan ladder and country pricing defined.',
      'Checkout failure and retry flow covered.',
      'Entitlement recovery and audit flow covered.',
      'Receipt recovery and billing email review covered.',
      'Admin operations, rollback, support, and first-72-hours monitoring prepared.',
    ],
  };
}

export function getOrbitLedgerPlanDefinition(tier: OrbitLedgerPlanTier): OrbitLedgerPlanDefinition {
  return ORBIT_LEDGER_PLAN_DEFINITIONS[tier];
}

export function getOrbitLedgerPlanRank(tier: OrbitLedgerPlanTier): number {
  return planRank[tier];
}

export function isOrbitLedgerTierAtLeast(
  currentTier: OrbitLedgerPlanTier,
  requiredTier: OrbitLedgerPlanTier
): boolean {
  return getOrbitLedgerPlanRank(currentTier) >= getOrbitLedgerPlanRank(requiredTier);
}

export function getOrbitLedgerPlanTierForPlanId(
  planId: OrbitLedgerPlanId | null | undefined
): OrbitLedgerPlanTier {
  if (!planId || planId === 'free') {
    return 'free';
  }

  return getOrbitLedgerPaidPlan(planId).tier;
}

export function isOrbitLedgerPaidPlanId(value: string | null | undefined): value is OrbitLedgerPaidPlanId {
  return Boolean(value && (paidPlanIds as readonly string[]).includes(value));
}

export function normalizeOrbitLedgerPlanId(value: string | null | undefined): OrbitLedgerPlanId | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'free') {
    return 'free';
  }
  return isOrbitLedgerPaidPlanId(normalized) ? normalized : null;
}

export function getOrbitLedgerPaidPlan(planId: OrbitLedgerPaidPlanId): OrbitLedgerPaidPlanCatalogItem {
  const plan = ORBIT_LEDGER_PAID_PLAN_CATALOG.find((entry) => entry.id === planId);
  if (!plan) {
    throw new Error(`Unknown Orbit Ledger paid plan: ${planId}`);
  }
  return plan;
}

export function getOrbitLedgerPaidPlanByProductId(
  productId: string
): OrbitLedgerPaidPlanCatalogItem | null {
  return ORBIT_LEDGER_PAID_PLAN_CATALOG.find((entry) => entry.productId === productId) ?? null;
}

export function getOrbitLedgerPricingCountry(
  countryCode: string | null | undefined
): OrbitLedgerPricingCountryCode {
  const normalized = (countryCode ?? '').trim().toUpperCase();
  if (normalized in ORBIT_LEDGER_COUNTRY_PRICING) {
    return normalized as OrbitLedgerPricingCountryCode;
  }
  return 'US';
}

export function getOrbitLedgerCountryPricing(
  countryCode: string | null | undefined
): OrbitLedgerCountryPricing {
  return ORBIT_LEDGER_COUNTRY_PRICING[getOrbitLedgerPricingCountry(countryCode)];
}

export function getOrbitLedgerPlanPrice(
  planId: OrbitLedgerPaidPlanId,
  countryCode: string | null | undefined
): OrbitLedgerPlanPrice {
  return getOrbitLedgerCountryPricing(countryCode).planPrices[planId];
}

export function getOrbitLedgerCountryCheckoutMapping(
  countryCode: string | null | undefined
): OrbitLedgerCountryCheckoutMapping {
  const pricingCountryCode = getOrbitLedgerPricingCountry(countryCode);
  const countryPricing = ORBIT_LEDGER_COUNTRY_PRICING[pricingCountryCode];
  const checkoutProvider = ORBIT_LEDGER_COUNTRY_CHECKOUT_PROVIDER[pricingCountryCode];
  const providerPriceStatus: OrbitLedgerProviderPriceStatus = 'pending_provider_connection';

  return {
    countryCode: pricingCountryCode,
    currencyCode: countryPricing.currencyCode,
    checkoutProvider,
    providerPriceStatus,
    planPrices: Object.fromEntries(
      paidPlanIds.map((planId) => {
        const plan = getOrbitLedgerPaidPlan(planId);
        const price = countryPricing.planPrices[planId];
        return [
          planId,
          {
            ...price,
            planId,
            productId: plan.productId,
            checkoutProvider,
            providerPriceId: buildProviderPriceId(checkoutProvider, pricingCountryCode, planId),
            providerPriceStatus,
          } satisfies OrbitLedgerProviderPrice,
        ];
      })
    ) as Record<OrbitLedgerPaidPlanId, OrbitLedgerProviderPrice>,
  };
}

export function getOrbitLedgerBillingTaxRule(
  countryCode: string | null | undefined
): OrbitLedgerBillingTaxRule {
  return ORBIT_LEDGER_BILLING_TAX_RULES[getOrbitLedgerPricingCountry(countryCode)];
}

export function getOrbitLedgerProviderPrice(
  planId: OrbitLedgerPaidPlanId,
  countryCode: string | null | undefined
): OrbitLedgerProviderPrice {
  return getOrbitLedgerCountryCheckoutMapping(countryCode).planPrices[planId];
}

export function getOrbitLedgerPaidPlansForCountry(
  countryCode: string | null | undefined
): Array<OrbitLedgerPaidPlanCatalogItem & { price: OrbitLedgerPlanPrice }> {
  const countryPricing = getOrbitLedgerCountryPricing(countryCode);
  return ORBIT_LEDGER_PAID_PLAN_CATALOG.map((plan) => ({
    ...plan,
    price: countryPricing.planPrices[plan.id],
  }));
}

export function canUseOrbitLedgerMonetizationFeature(
  currentTier: OrbitLedgerPlanTier,
  feature: OrbitLedgerMonetizationFeature
): boolean {
  return isOrbitLedgerTierAtLeast(currentTier, ORBIT_LEDGER_FEATURE_REQUIRED_TIER[feature]);
}

function paidPlan(
  id: OrbitLedgerPaidPlanId,
  tier: Exclude<OrbitLedgerPlanTier, 'free'>,
  billingInterval: OrbitLedgerBillingInterval,
  productId: OrbitLedgerSubscriptionProductId,
  label: string,
  shortLabel: string,
  helper: string,
  entitlementDays: number,
  isBestValue: boolean
): OrbitLedgerPaidPlanCatalogItem {
  return {
    id,
    tier,
    billingInterval,
    productId,
    label,
    shortLabel,
    title: ORBIT_LEDGER_PLAN_DEFINITIONS[tier].label,
    helper,
    entitlementDays,
    isBestValue,
  };
}

function countryPricing(
  countryCode: OrbitLedgerPricingCountryCode,
  currencyCode: OrbitLedgerCurrencyCode,
  amounts: Record<OrbitLedgerPaidPlanId, number>
): OrbitLedgerCountryPricing {
  return {
    countryCode,
    currencyCode,
    planPrices: Object.fromEntries(
      paidPlanIds.map((planId) => [
        planId,
        {
          countryCode,
          currencyCode,
          amountMinor: amounts[planId],
          display: formatPrice(currencyCode, amounts[planId]),
        } satisfies OrbitLedgerPlanPrice,
      ])
    ) as Record<OrbitLedgerPaidPlanId, OrbitLedgerPlanPrice>,
  };
}

function formatPrice(currencyCode: OrbitLedgerCurrencyCode, amountMinor: number): string {
  const value = amountMinor / 100;
  const formatter = new Intl.NumberFormat('en', {
    currency: currencyCode,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    style: 'currency',
  });

  return formatter.format(value);
}

function buildProviderPriceId(
  provider: OrbitLedgerCheckoutProvider,
  countryCode: OrbitLedgerPricingCountryCode,
  planId: OrbitLedgerPaidPlanId
): string {
  return `orbit_${provider}_${countryCode.toLowerCase()}_${planId}`;
}
