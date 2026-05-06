export type SmartDocumentPackKind =
  | 'invoice'
  | 'statement'
  | 'payment_notice'
  | 'overdue_notice'
  | 'customer_profile'
  | 'tax_summary'
  | 'audit_packet';

export type SmartDocumentPackTier = 'free' | 'plus' | 'pro_plus' | 'office';
export type SmartDocumentPackPriority = 'critical' | 'high' | 'normal' | 'low';
export type SmartDocumentPackTone = 'danger' | 'warning' | 'primary' | 'success' | 'neutral';
export type SmartDocumentPackActionTarget =
  | 'create_invoice'
  | 'send_statement'
  | 'send_payment_notice'
  | 'send_overdue_notice'
  | 'export_customer_profile'
  | 'open_tax_summary'
  | 'prepare_audit_packet';

export type SmartDocumentPackSignal = {
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  amountDue?: number | null;
  invoiceCount?: number | null;
  overdueInvoiceCount?: number | null;
  daysOverdue?: number | null;
  hasPaymentLink?: boolean | null;
  hasCustomerEmail?: boolean | null;
  hasTaxData?: boolean | null;
  needsAuditTrail?: boolean | null;
  countryCode?: string | null;
  kind:
    | 'invoice_ready'
    | 'customer_has_balance'
    | 'payment_due'
    | 'invoice_overdue'
    | 'customer_review'
    | 'tax_period_review'
    | 'audit_review';
};

export type SmartDocumentPackItem = {
  id: string;
  kind: SmartDocumentPackKind;
  customerId?: string | null;
  customerName?: string | null;
  amountDue?: number | null;
  invoiceCount?: number | null;
  title: string;
  message: string;
  helper: string;
  priority: SmartDocumentPackPriority;
  score: number;
  tone: SmartDocumentPackTone;
  requiredTier: SmartDocumentPackTier;
  available: boolean;
  actionLabel: string;
  actionTarget: SmartDocumentPackActionTarget;
  requiredData: string[];
  includedDocuments: SmartDocumentPackKind[];
};

export type SmartDocumentPackOutput = {
  title: string;
  summary: string;
  emptyState: boolean;
  recommendedPack: SmartDocumentPackItem | null;
  items: SmartDocumentPackItem[];
  guardrails: string[];
};

export type SmartDocumentPackSurfaceBlueprint = {
  kind: SmartDocumentPackKind;
  label: string;
  userPromise: string;
  requiredData: string[];
  minimumTier: SmartDocumentPackTier;
};

export const SMART_DOCUMENT_PACK_SURFACES: SmartDocumentPackSurfaceBlueprint[] = [
  surface('invoice', 'Invoice', 'Create the official sales document with tax, payment, branding, and version rules.', [
    'business identity',
    'customer identity',
    'line items',
    'tax settings',
    'payment status',
  ], 'free'),
  surface('statement', 'Customer statement', 'Show a customer what happened across the account, not only one invoice.', [
    'customer ledger',
    'date range',
    'opening balance',
    'closing balance',
  ], 'free'),
  surface('payment_notice', 'Payment notice', 'Send a focused collection document without turning it into a harsh overdue notice.', [
    'amount due',
    'customer contact',
    'payment instructions',
  ], 'plus'),
  surface('overdue_notice', 'Overdue notice', 'Create a stronger but professional notice when payment is late.', [
    'overdue invoices',
    'days overdue',
    'payment history',
    'business contact',
  ], 'pro_plus'),
  surface('customer_profile', 'Customer profile report', 'Export customer details, balance, health, invoices, payments, promises, and notes together.', [
    'customer profile',
    'balance summary',
    'health score',
    'timeline',
  ], 'plus'),
  surface('tax_summary', 'Tax summary', 'Prepare country-aware tax summary documents without pretending to file taxes.', [
    'country pack',
    'invoice tax data',
    'date range',
  ], 'pro_plus'),
  surface('audit_packet', 'Audit packet', 'Bundle records that explain what changed and why when the business needs review.', [
    'document versions',
    'payment reversals',
    'settings audit',
    'restore history',
  ], 'office'),
];

export const SMART_DOCUMENT_PACK_GUARDRAILS = [
  'Documents must never show internal template names or plan labels on customer-facing pages.',
  'Free documents can include the Orbit Ledger footer; paid documents can remove it when the plan allows.',
  'Every generated document must use frozen source data so later edits do not change old exports.',
  'Payment links, QR codes, and payment instructions should be included only when the business settings allow them.',
  'Tax and audit documents must use careful wording and avoid claiming official filing or legal certification.',
  'Batch packs should show a preview count before export or sending.',
];

export function buildSmartDocumentPack(input: {
  businessName?: string | null;
  currency?: string | null;
  currentTier?: SmartDocumentPackTier | null;
  signals?: SmartDocumentPackSignal[] | null;
}): SmartDocumentPackOutput {
  const currentTier = normalizeTier(input.currentTier);
  const items = (input.signals ?? [])
    .map((signal) => signalToDocumentPackItem(signal, currentTier))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));

  return {
    title: `${input.businessName?.trim() || 'Business'} document pack`,
    summary: buildSummary(items),
    emptyState: items.length === 0,
    recommendedPack: items[0] ?? null,
    items,
    guardrails: SMART_DOCUMENT_PACK_GUARDRAILS,
  };
}

function signalToDocumentPackItem(signal: SmartDocumentPackSignal, currentTier: SmartDocumentPackTier): SmartDocumentPackItem {
  switch (signal.kind) {
    case 'invoice_ready':
      return item(signal, currentTier, {
        kind: 'invoice',
        title: 'Invoice ready to generate',
        message: `${name(signal)} has invoice work ready for a clean PDF or CSV export.`,
        helper: signal.hasPaymentLink ? 'Payment link can be included.' : 'Payment instructions can be added before sending.',
        priority: 'normal',
        score: 54,
        tone: 'primary',
        requiredTier: 'free',
        actionLabel: 'Create invoice',
        actionTarget: 'create_invoice',
        requiredData: ['customer', 'line items', 'tax settings'],
        includedDocuments: ['invoice'],
      });
    case 'customer_has_balance':
      return item(signal, currentTier, {
        kind: 'statement',
        title: 'Send customer statement',
        message: `${name(signal)} has an open balance. A statement can explain the account clearly.`,
        helper: 'Best when the customer needs a full account view instead of one invoice.',
        priority: 'high',
        score: 78 + Math.min(count(signal.invoiceCount) * 4, 16),
        tone: 'warning',
        requiredTier: 'free',
        actionLabel: 'Send statement',
        actionTarget: 'send_statement',
        requiredData: ['customer ledger', 'date range', 'opening balance', 'closing balance'],
        includedDocuments: ['statement'],
      });
    case 'payment_due':
      return item(signal, currentTier, {
        kind: 'payment_notice',
        title: 'Prepare payment notice',
        message: `${name(signal)} needs a focused payment request.`,
        helper: signal.hasCustomerEmail ? 'Email-ready copy can use saved customer contact details.' : 'Add customer email before sending from the app.',
        priority: 'high',
        score: 84,
        tone: 'warning',
        requiredTier: 'plus',
        actionLabel: 'Prepare notice',
        actionTarget: 'send_payment_notice',
        requiredData: ['amount due', 'payment instructions', 'customer contact'],
        includedDocuments: ['payment_notice', 'statement'],
      });
    case 'invoice_overdue':
      return item(signal, currentTier, {
        kind: 'overdue_notice',
        title: 'Prepare overdue notice',
        message: `${name(signal)} has overdue invoice work that needs a stronger document.`,
        helper: `${count(signal.overdueInvoiceCount) || 1} overdue invoice${plural(count(signal.overdueInvoiceCount) || 1)} can be included.`,
        priority: count(signal.daysOverdue) >= 30 ? 'critical' : 'high',
        score: 96 + Math.min(count(signal.daysOverdue), 45),
        tone: count(signal.daysOverdue) >= 30 ? 'danger' : 'warning',
        requiredTier: 'pro_plus',
        actionLabel: 'Prepare overdue notice',
        actionTarget: 'send_overdue_notice',
        requiredData: ['overdue invoices', 'days overdue', 'payment history'],
        includedDocuments: ['overdue_notice', 'statement'],
      });
    case 'customer_review':
      return item(signal, currentTier, {
        kind: 'customer_profile',
        title: 'Export customer profile',
        message: `${name(signal)} can be reviewed with contact, tax, balance, health, and timeline details together.`,
        helper: 'Useful before a call, dispute review, credit-limit change, or account cleanup.',
        priority: 'normal',
        score: 62,
        tone: 'primary',
        requiredTier: 'plus',
        actionLabel: 'Export profile',
        actionTarget: 'export_customer_profile',
        requiredData: ['customer profile', 'balance', 'health', 'timeline'],
        includedDocuments: ['customer_profile', 'statement'],
      });
    case 'tax_period_review':
      return item(signal, currentTier, {
        kind: 'tax_summary',
        title: 'Prepare tax summary',
        message: `${country(signal)} tax summary can be prepared from the selected period.`,
        helper: signal.hasTaxData ? 'Tax data is available for review.' : 'Complete tax settings before relying on this summary.',
        priority: 'normal',
        score: signal.hasTaxData ? 70 : 44,
        tone: signal.hasTaxData ? 'primary' : 'warning',
        requiredTier: 'pro_plus',
        actionLabel: 'Open tax summary',
        actionTarget: 'open_tax_summary',
        requiredData: ['country pack', 'invoice tax data', 'date range'],
        includedDocuments: ['tax_summary'],
      });
    case 'audit_review':
      return item(signal, currentTier, {
        kind: 'audit_packet',
        title: 'Prepare audit packet',
        message: 'Bundle documents, payment corrections, versions, and settings history for review.',
        helper: 'Designed for internal review, accountant handoff, or launch support.',
        priority: signal.needsAuditTrail ? 'critical' : 'high',
        score: signal.needsAuditTrail ? 160 : 88,
        tone: signal.needsAuditTrail ? 'danger' : 'warning',
        requiredTier: 'office',
        actionLabel: 'Prepare packet',
        actionTarget: 'prepare_audit_packet',
        requiredData: ['document versions', 'payment corrections', 'settings audit', 'restore history'],
        includedDocuments: ['audit_packet', 'customer_profile', 'tax_summary'],
      });
  }
}

function item(
  signal: SmartDocumentPackSignal,
  currentTier: SmartDocumentPackTier,
  config: Omit<SmartDocumentPackItem, 'id' | 'available' | 'customerId' | 'customerName' | 'amountDue' | 'invoiceCount'>
): SmartDocumentPackItem {
  return {
    id: `${signal.kind}:${signal.id}`,
    customerId: signal.customerId ?? null,
    customerName: signal.customerName ?? null,
    amountDue: signal.amountDue ?? null,
    invoiceCount: signal.invoiceCount ?? null,
    available: tierRank(currentTier) >= tierRank(config.requiredTier),
    ...config,
  };
}

function buildSummary(items: SmartDocumentPackItem[]): string {
  if (!items.length) {
    return 'No document pack is waiting right now.';
  }
  const locked = items.filter((item) => !item.available).length;
  const critical = items.filter((item) => item.priority === 'critical').length;
  if (critical > 0) {
    return `${critical} urgent document pack${plural(critical)} should be reviewed first.`;
  }
  if (locked > 0) {
    return `${locked} useful document pack${plural(locked)} need${locked === 1 ? 's' : ''} a higher plan.`;
  }
  return `${items.length} document pack${plural(items.length)} are ready to prepare.`;
}

function normalizeTier(tier?: SmartDocumentPackTier | null): SmartDocumentPackTier {
  return tier ?? 'free';
}

function tierRank(tier: SmartDocumentPackTier): number {
  const ranks: Record<SmartDocumentPackTier, number> = {
    free: 0,
    plus: 1,
    pro_plus: 2,
    office: 3,
  };
  return ranks[tier];
}

function name(signal: SmartDocumentPackSignal): string {
  return signal.customerName?.trim() || 'Customer';
}

function country(signal: SmartDocumentPackSignal): string {
  return signal.countryCode?.trim().toUpperCase() || 'Local';
}

function count(value?: number | null): number {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 0;
}

function plural(countValue: number): string {
  return countValue === 1 ? '' : 's';
}

function surface(
  kind: SmartDocumentPackKind,
  label: string,
  userPromise: string,
  requiredData: string[],
  minimumTier: SmartDocumentPackTier
): SmartDocumentPackSurfaceBlueprint {
  return {
    kind,
    label,
    userPromise,
    requiredData,
    minimumTier,
  };
}
