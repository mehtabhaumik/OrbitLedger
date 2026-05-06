export type OrbitLedgerPlatform = 'mobile' | 'web';

export type FeatureCoverageStatus = 'complete' | 'partial' | 'missing' | 'os_specific' | 'not_applicable';

export type FeatureParityPhase =
  | 'phase_1_registry'
  | 'phase_2_web_products_inventory'
  | 'phase_3_web_customer_timeline_followup'
  | 'phase_4_web_business_reviews'
  | 'phase_5_mobile_provider_admin'
  | 'phase_6_shared_document_templates';

export type FeatureCategory =
  | 'access'
  | 'customers'
  | 'ledger'
  | 'invoices'
  | 'payments'
  | 'documents'
  | 'reports'
  | 'inventory'
  | 'backup'
  | 'market'
  | 'settings'
  | 'support';

export type PlatformFeatureCoverage = {
  status: FeatureCoverageStatus;
  evidence: string;
  gap?: string;
  nextPhase?: FeatureParityPhase;
};

export type OrbitLedgerFeatureParityItem = {
  id: string;
  category: FeatureCategory;
  label: string;
  launchCritical: boolean;
  userPromise: string;
  parityRule: string;
  mobile: PlatformFeatureCoverage;
  web: PlatformFeatureCoverage;
};

export type FeatureParityGap = {
  featureId: string;
  label: string;
  category: FeatureCategory;
  launchCritical: boolean;
  platform: OrbitLedgerPlatform;
  status: FeatureCoverageStatus;
  gap: string;
  nextPhase: FeatureParityPhase;
};

export const ORBIT_LEDGER_PARITY_PHASES: Array<{
  id: FeatureParityPhase;
  title: string;
  goal: string;
}> = [
  {
    id: 'phase_1_registry',
    title: 'Shared Feature Registry + Gap Tests',
    goal: 'Keep mobile and web parity visible, testable, and hard to accidentally drift.',
  },
  {
    id: 'phase_2_web_products_inventory',
    title: 'Web Products + Inventory Parity',
    goal: 'Bring products, stock review, and reorder assistance to the web workspace.',
  },
  {
    id: 'phase_3_web_customer_timeline_followup',
    title: 'Web Customer Timeline + Promises + Follow-Up',
    goal: 'Bring customer relationship memory, payment promises, reminders, and follow-up queues to web.',
  },
  {
    id: 'phase_4_web_business_reviews',
    title: 'Web Daily Closing + Business Health + Monthly Review',
    goal: 'Bring the mobile daily command center and review rituals to web.',
  },
  {
    id: 'phase_5_mobile_provider_admin',
    title: 'Mobile Provider Admin + Payment Event Review',
    goal: 'Expose provider event review, application, and reversal controls on mobile.',
  },
  {
    id: 'phase_6_shared_document_templates',
    title: 'Shared Document Template Catalog + Golden Parity Tests',
    goal: 'Move invoice and statement template behavior behind one tested shared catalog.',
  },
];

export const ORBIT_LEDGER_FEATURE_REGISTRY: OrbitLedgerFeatureParityItem[] = [
  feature({
    id: 'access-account-workspace',
    category: 'access',
    label: 'Account access and workspace selection',
    launchCritical: true,
    userPromise: 'User can sign in, create an account, and access the right business workspace.',
    parityRule: 'Mobile and web may use different auth surfaces, but signed-in workspace identity must match.',
    mobile: complete('CloudAuth and business startup route users into the active business.'),
    web: complete('Login and AppShell workspace selector load signed-in Firebase workspaces.'),
  }),
  feature({
    id: 'customers-profile-fields',
    category: 'customers',
    label: 'Customer profile fields',
    launchCritical: true,
    userPromise: 'User can store practical customer identity, contact, address, tax, money, and tag details.',
    parityRule: 'Both apps must support the same customer profile data even when the layout differs.',
    mobile: partial(
      'Customer forms and customer detail support the core customer profile.',
      'Confirm every expanded optional customer field from web is editable on mobile.',
      'phase_3_web_customer_timeline_followup'
    ),
    web: complete('Customers and Customer Detail expose expanded profile fields, validation, CSV, and PDF exports.'),
  }),
  feature({
    id: 'customers-health-ranking',
    category: 'customers',
    label: 'Customer health ranking',
    launchCritical: true,
    userPromise: 'User can see which customers are reliable, risky, or need follow-up.',
    parityRule: 'Health labels must come from shared scoring logic and avoid insulting customer labels.',
    mobile: complete('Customer health appears across customer, report, and business health surfaces.'),
    web: complete('Customer list and detail show shared customer health score and label.'),
  }),
  feature({
    id: 'customers-trust-timeline',
    category: 'customers',
    label: 'Customer timeline and notes',
    launchCritical: true,
    userPromise: 'User can see the relationship memory for dues, payments, reminders, notes, and promises.',
    parityRule: 'Both apps must expose customer history and follow-up context.',
    mobile: complete('Trust timeline, timeline notes, reminders, and payment promises are modeled on mobile.'),
    web: complete('Customer Detail includes trust timeline, notes, disputes, reminders, payment promises, and follow-up actions.'),
  }),
  feature({
    id: 'customer-export',
    category: 'customers',
    label: 'Customer PDF and CSV export',
    launchCritical: true,
    userPromise: 'User can export one or many customer records in useful PDF and CSV formats.',
    parityRule: 'Both apps must include the same profile, balance, health, and activity fields.',
    mobile: complete('Customer export service supports CSV and PDF sharing.'),
    web: complete('Customers and Customer Detail support selected-row CSV/PDF exports.'),
  }),
  feature({
    id: 'ledger-credit-payment-entry',
    category: 'ledger',
    label: 'Ledger credit and payment entry',
    launchCritical: true,
    userPromise: 'User can quickly record customer dues and received payments.',
    parityRule: 'Credit increases receivable, cleared payment reduces receivable, and pending instruments do not clear early.',
    mobile: complete('TransactionForm records credits, payments, clearance, allocations, and attachments.'),
    web: complete('Transactions and invoice payment flows record credits, payments, clearance, allocations, and attachments.'),
  }),
  feature({
    id: 'payment-allocation',
    category: 'payments',
    label: 'Payment allocation to invoices',
    launchCritical: true,
    userPromise: 'User can apply a payment to a selected invoice, oldest invoice, or ledger-only balance.',
    parityRule: 'Invoice paid state must come from allocations, not guesswork.',
    mobile: complete('TransactionForm supports ledger-only, oldest invoice, selected invoice, and reconciliation suggestions.'),
    web: complete('Transactions and invoice editor support allocation and invoice payment status updates.'),
  }),
  feature({
    id: 'payment-modes-clearance-attachments',
    category: 'payments',
    label: 'Payment modes, clearance, and instrument attachments',
    launchCritical: true,
    userPromise: 'User can record cash, cheque, demand draft, UPI, bank, card, pending clearance, bounced, and proof images.',
    parityRule: 'Both apps must keep payment status, customer balance, invoice paid amount, and proof handling consistent.',
    mobile: complete('TransactionForm captures payment modes, clearance status, and instrument attachments.'),
    web: complete('Transactions and invoice editor capture modes, clearance status, and instrument attachments.'),
  }),
  feature({
    id: 'manual-payment-instructions',
    category: 'payments',
    label: 'Manual payment instructions and hosted payment page',
    launchCritical: true,
    userPromise: 'User can share payment instructions without a connected payment provider.',
    parityRule: 'Both apps must generate the same payment message; hosted pages are web-specific but mobile must link to them.',
    mobile: partial(
      'Mobile shares manual payment request messages and invoice documents can include the hosted payment page URL from EXPO_PUBLIC_ORBIT_LEDGER_PAYMENT_PAGE_URL.',
      'Add an end-to-end mobile smoke test for hosted payment links once the public payment domain is final.',
      'phase_6_shared_document_templates'
    ),
    web: complete('Web builds payment messages and exposes the hosted /pay instruction page.'),
  }),
  feature({
    id: 'provider-event-admin',
    category: 'payments',
    label: 'Payment provider event admin',
    launchCritical: false,
    userPromise: 'User can review provider events, apply payments to invoices, and reverse incorrect events.',
    parityRule: 'Provider events should be reviewable from both apps once providers are connected.',
    mobile: complete('Payment Review exposes provider readiness, event review, and mark-reviewed controls on mobile.'),
    web: complete('Payments page supports provider event review, apply-to-invoice, mark reviewed, and reverse.'),
  }),
  feature({
    id: 'payment-refunds-reversals',
    category: 'payments',
    label: 'Refunds and payment reversals',
    launchCritical: true,
    userPromise: 'User can correct mistaken payments without silently corrupting history.',
    parityRule: 'Reversal creates correction records and recalculates customer balance and invoice payment state.',
    mobile: complete('Mobile provider event review includes mark-reviewed and reverse-event controls.'),
    web: complete('Web supports invoice payment allocation reversals and provider event reversals.'),
  }),
  feature({
    id: 'invoice-lifecycle-versioning',
    category: 'invoices',
    label: 'Invoice lifecycle and versioning',
    launchCritical: true,
    userPromise: 'User can save official invoices, revise changed invoices, and view version history.',
    parityRule: 'Draft, Created, Revised, Cancelled, payment status, and version creation rules must match.',
    mobile: partial(
      'Mobile has invoice lifecycle data and version listing support.',
      'Confirm list and preview expose the same version row actions as web.',
      'phase_6_shared_document_templates'
    ),
    web: complete('Web invoice editor/list supports draft delete, archive/cancel controls, version history, and payment state.'),
  }),
  feature({
    id: 'invoice-pdf-csv-generation',
    category: 'documents',
    label: 'Invoice PDF and CSV generation',
    launchCritical: true,
    userPromise: 'User can view, print, download, and export invoices with correct tax and payment details.',
    parityRule: 'Output names, amount in words, free footer, payment links, attachments, and tax totals must match.',
    mobile: partial(
      'Mobile generates invoice PDFs and shares/saves them.',
      'Run golden document tests against the web invoice output rules.',
      'phase_6_shared_document_templates'
    ),
    web: complete('Web generates printable invoice documents plus PDF and CSV downloads.'),
  }),
  feature({
    id: 'recurring-invoice-auto-email',
    category: 'invoices',
    label: 'Recurring invoices and automatic invoice email',
    launchCritical: true,
    userPromise: 'User can create customer-specific monthly invoice rules and safely approve automatic invoice emails.',
    parityRule: 'Both apps must support the same recurring rule data, approval safeguards, invoice selection, catch-up safety, and send history.',
    mobile: complete('Mobile Monthly Auto Email supports synced customer-specific rules, approval, catch-up safety, payment-link/PDF email options, and queue/send history.'),
    web: complete('Web supports customer-specific monthly auto email rules, approval, warnings, queue preview, and send history.'),
  }),
  feature({
    id: 'statement-documents',
    category: 'documents',
    label: 'Customer statements',
    launchCritical: true,
    userPromise: 'User can create customer statements from ledger activity.',
    parityRule: 'Both apps must use the same statement columns, balance logic, payment message, and template access.',
    mobile: complete('StatementPreview generates and shares customer statements.'),
    web: complete('Documents page generates single-customer statements and PDF downloads.'),
  }),
  feature({
    id: 'statement-batch',
    category: 'documents',
    label: 'Statement batch generation',
    launchCritical: false,
    userPromise: 'User can prepare statements for many customers at once.',
    parityRule: 'Batch criteria and exported output should match where batch export is supported.',
    mobile: complete('StatementBatch builds previews and generates statement batches.'),
    web: complete('Documents page supports selected-customer statement batches with one PDF page per customer plus batch CSV export.'),
  }),
  feature({
    id: 'document-template-catalog',
    category: 'documents',
    label: 'Document template catalog',
    launchCritical: true,
    userPromise: 'User can choose consistent free and Pro invoice/statement templates on both apps.',
    parityRule: 'Template keys, names, gates, columns, and default selection must come from one shared catalog.',
    mobile: complete('Mobile template selection now reads invoice and statement templates from the shared core catalog.'),
    web: complete('Web template selection now reads invoice and statement templates from the shared core catalog.'),
  }),
  feature({
    id: 'backup-restore',
    category: 'backup',
    label: 'Backup and restore',
    launchCritical: true,
    userPromise: 'User can protect business data and restore only after review.',
    parityRule: 'Both apps must preview, validate, restore safely, and preserve rollback confidence.',
    mobile: complete('BackupRestore supports export, restore preview, validation, and saved backup status.'),
    web: complete('Backup page supports export, typed confirmation, preview, rollback backup, and restore progress.'),
  }),
  feature({
    id: 'products-inventory',
    category: 'inventory',
    label: 'Products and inventory',
    launchCritical: true,
    userPromise: 'User can track products, stock, and low-stock risk.',
    parityRule: 'Product records and stock summaries must be available on both apps except scanner/camera extras.',
    mobile: complete('Products and Inventory Reorder Assistant are available on mobile.'),
    web: complete('Products page supports add/edit, stock review, CSV export, and invoice product selection with stock updates.'),
  }),
  feature({
    id: 'daily-closing',
    category: 'reports',
    label: 'Daily closing ritual',
    launchCritical: true,
    userPromise: 'User can close the day with clear dues, payments, stock, and follow-up checks.',
    parityRule: 'Both apps must provide the daily closing workflow, with mobile optimized for counter use and web for review.',
    mobile: complete('DailyClosingReport builds the daily closing ritual and report.'),
    web: complete('Reports page includes daily closing metrics and actions for payments, credits, promises, and stock.'),
  }),
  feature({
    id: 'business-health-snapshot',
    category: 'reports',
    label: 'Business health snapshot',
    launchCritical: true,
    userPromise: 'User can see business health, risky customers, improving customers, and recommended actions.',
    parityRule: 'Both apps should explain health in plain business language and link to next actions.',
    mobile: complete('BusinessHealthSnapshot is a dedicated mobile screen.'),
    web: complete('Reports page includes a business health score and action list based on customers, invoices, promises, and inventory.'),
  }),
  feature({
    id: 'monthly-business-review',
    category: 'reports',
    label: 'Monthly business review',
    launchCritical: true,
    userPromise: 'User can review month-end receivables, sales, payments, and customer movement.',
    parityRule: 'Both apps must produce a useful month-end review, not just a metrics card.',
    mobile: complete('MonthlyBusinessReview has a dedicated service and screen.'),
    web: complete('Reports page includes monthly payment, credit, invoice, customer metrics, and review actions.'),
  }),
  feature({
    id: 'compliance-tax-setup',
    category: 'reports',
    label: 'Tax setup and compliance reports',
    launchCritical: true,
    userPromise: 'User can configure local tax labels and review compliance-ready summaries.',
    parityRule: 'Country packs, tax setup, and compliance summaries must stay consistent across apps.',
    mobile: complete('TaxSetup, CountryPackageStore, and ComplianceReports are exposed on mobile.'),
    web: complete('Reports page exposes tax and compliance review totals with export, and Settings holds tax/business defaults.'),
  }),
  feature({
    id: 'country-pack-market',
    category: 'market',
    label: 'Country packs and market packages',
    launchCritical: true,
    userPromise: 'User can see which local packs are available or upcoming.',
    parityRule: 'US and UK packs remain upcoming on both apps until actually available.',
    mobile: complete('Country pack catalog marks US and UK as upcoming.'),
    web: complete('Market page marks US and UK country packs as upcoming.'),
  }),
  feature({
    id: 'monetization-free-pro',
    category: 'market',
    label: 'Free vs Pro monetization',
    launchCritical: true,
    userPromise: 'User can clearly see what stays free and what Pro adds.',
    parityRule: 'Free/Pro copy and gated document behavior must match, even though purchase mechanics differ by platform.',
    mobile: complete('Upgrade screen, billing, restore purchases, and gates are implemented for native stores.'),
    web: partial(
      'Market page explains Free vs Pro but does not complete real web purchase.',
      'Keep web as presentation until web billing is intentionally added.',
      'phase_6_shared_document_templates'
    ),
  }),
  feature({
    id: 'cloud-sync',
    category: 'settings',
    label: 'Cloud sync and workspace data',
    launchCritical: true,
    userPromise: 'User can use the same business across phone and web.',
    parityRule: 'Both apps must respect synced workspace ownership and safe data boundaries.',
    mobile: complete('Mobile sync service pushes and pulls workspace data.'),
    web: complete('Web uses Firebase workspace collections directly after sign-in.'),
  }),
  feature({
    id: 'security-lock',
    category: 'settings',
    label: 'App lock and local privacy',
    launchCritical: true,
    userPromise: 'User can protect business data from casual device access.',
    parityRule: 'Each platform may use native/browser-appropriate lock behavior.',
    mobile: osSpecific('PIN, biometrics, and app-state lock are native mobile behavior.'),
    web: complete('Browser PIN lock exists for web workspace access.'),
  }),
  feature({
    id: 'support-feedback',
    category: 'support',
    label: 'Feedback, founder note, and referral',
    launchCritical: false,
    userPromise: 'User can get help, send feedback, and understand the product story.',
    parityRule: 'Support entry points should exist on both apps; native share/referral can remain mobile-specific.',
    mobile: complete('Feedback, FounderNote, rating feedback, and referral share flows exist on mobile.'),
    web: complete('Web has a dedicated Support page with feedback, help, and founder note surfaces.'),
  }),
];

export function getFeatureParityGaps(
  registry: readonly OrbitLedgerFeatureParityItem[] = ORBIT_LEDGER_FEATURE_REGISTRY
): FeatureParityGap[] {
  return registry.flatMap((item) =>
    (['mobile', 'web'] as const).flatMap((platform) => {
      const coverage = item[platform];
      if (!isGapStatus(coverage.status)) {
        return [];
      }

      return [
        {
          featureId: item.id,
          label: item.label,
          category: item.category,
          launchCritical: item.launchCritical,
          platform,
          status: coverage.status,
          gap: coverage.gap ?? coverage.evidence,
          nextPhase: coverage.nextPhase ?? 'phase_1_registry',
        },
      ];
    })
  );
}

export function getFeatureParityGapsForPhase(
  phase: FeatureParityPhase,
  registry: readonly OrbitLedgerFeatureParityItem[] = ORBIT_LEDGER_FEATURE_REGISTRY
): FeatureParityGap[] {
  return getFeatureParityGaps(registry).filter((gap) => gap.nextPhase === phase);
}

export function getFeatureParitySummary(
  registry: readonly OrbitLedgerFeatureParityItem[] = ORBIT_LEDGER_FEATURE_REGISTRY
) {
  const gaps = getFeatureParityGaps(registry);
  return {
    featureCount: registry.length,
    completeOnBothPlatforms: registry.filter(
      (item) => item.mobile.status === 'complete' && item.web.status === 'complete'
    ).length,
    launchCriticalGapCount: gaps.filter((gap) => gap.launchCritical).length,
    mobileGapCount: gaps.filter((gap) => gap.platform === 'mobile').length,
    webGapCount: gaps.filter((gap) => gap.platform === 'web').length,
  };
}

function feature(item: OrbitLedgerFeatureParityItem): OrbitLedgerFeatureParityItem {
  return item;
}

function complete(evidence: string): PlatformFeatureCoverage {
  return { status: 'complete', evidence };
}

function partial(evidence: string, gap: string, nextPhase: FeatureParityPhase): PlatformFeatureCoverage {
  return { status: 'partial', evidence, gap, nextPhase };
}

function missing(gap: string, nextPhase: FeatureParityPhase): PlatformFeatureCoverage {
  return { status: 'missing', evidence: gap, gap, nextPhase };
}

function osSpecific(evidence: string): PlatformFeatureCoverage {
  return { status: 'os_specific', evidence };
}

function isGapStatus(status: FeatureCoverageStatus): boolean {
  return status === 'partial' || status === 'missing';
}
