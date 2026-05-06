export type LocalBusinessIntelligenceArea =
  | 'tax_labels'
  | 'payment_wording'
  | 'document_pack'
  | 'collection_timing'
  | 'seasonal_nudge'
  | 'regional_formatting'
  | 'compliance_review';

export type LocalBusinessIntelligenceTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
export type LocalBusinessIntelligencePriority = 'critical' | 'high' | 'normal' | 'low';

export type LocalBusinessIntelligenceActionTarget =
  | 'open_tax_setup'
  | 'open_payment_settings'
  | 'open_document_settings'
  | 'open_collection_coach'
  | 'open_reports'
  | 'open_settings';

export type LocalBusinessIntelligenceSignal = {
  countryCode?: string | null;
  stateCode?: string | null;
  city?: string | null;
  month?: number | null;
  hasTaxProfile?: boolean | null;
  hasLocalPaymentDetails?: boolean | null;
  hasInvoiceTemplate?: boolean | null;
  overdueCustomerCount?: number | null;
  unpaidInvoiceCount?: number | null;
  taxInvoiceCount?: number | null;
  localCurrency?: string | null;
};

export type LocalBusinessIntelligenceItem = {
  id: LocalBusinessIntelligenceArea;
  title: string;
  message: string;
  helper: string;
  priority: LocalBusinessIntelligencePriority;
  score: number;
  tone: LocalBusinessIntelligenceTone;
  actionLabel: string;
  actionTarget: LocalBusinessIntelligenceActionTarget;
  countryCode: string;
  localityLabel: string;
};

export type LocalBusinessIntelligenceOutput = {
  title: string;
  summary: string;
  emptyState: boolean;
  topInsight: LocalBusinessIntelligenceItem | null;
  items: LocalBusinessIntelligenceItem[];
  guardrails: string[];
};

export type LocalBusinessIntelligenceSurfaceBlueprint = {
  area: LocalBusinessIntelligenceArea;
  label: string;
  userPromise: string;
  requiredData: string[];
};

export const LOCAL_BUSINESS_INTELLIGENCE_SURFACES: LocalBusinessIntelligenceSurfaceBlueprint[] = [
  surface('tax_labels', 'Local tax labels', 'Use country-ready tax labels and document wording where available.', [
    'country',
    'state or province',
    'tax profile',
  ]),
  surface('payment_wording', 'Local payment wording', 'Use payment instructions that match how customers actually pay locally.', [
    'country',
    'payment methods',
    'bank or manual payment details',
  ]),
  surface('document_pack', 'Local document pack', 'Keep invoice, statement, notice, tax summary, and audit packet wording locally appropriate.', [
    'country pack',
    'document template',
    'business details',
  ]),
  surface('collection_timing', 'Collection timing', 'Suggest follow-up timing that fits local payment behavior and business rhythm.', [
    'overdue customers',
    'unpaid invoices',
    'reminder settings',
  ]),
  surface('seasonal_nudge', 'Seasonal nudge', 'Surface helpful reminders around local business seasons without adding noise.', [
    'country',
    'month',
    'customer dues',
  ]),
  surface('regional_formatting', 'Regional formatting', 'Format currency, address, phone, and date details consistently for the selected country.', [
    'country',
    'currency',
    'address fields',
  ]),
  surface('compliance_review', 'Compliance review', 'Prepare careful country-aware review prompts without claiming legal filing.', [
    'tax invoices',
    'country pack',
    'reporting period',
  ]),
];

export const LOCAL_BUSINESS_INTELLIGENCE_GUARDRAILS = [
  'Local guidance must be written as business help, not legal or tax advice.',
  'Country packs can suggest labels, wording, and review reminders, but they must not claim official filing.',
  'US and UK packs remain upcoming until enabled by entitlement and implementation.',
  'India can use GST, PAN, UPI, IFSC, state, and place-of-supply language where data is available.',
  'Seasonal nudges should be subtle and dismissible, never noisy or fear-based.',
  'Every local recommendation must still respect the user’s saved settings and plan entitlement.',
];

export function buildLocalBusinessIntelligence(input: {
  businessName?: string | null;
  signal?: LocalBusinessIntelligenceSignal | null;
}): LocalBusinessIntelligenceOutput {
  const signal = input.signal ?? {};
  const countryCode = normalizeCountryCode(signal.countryCode);
  const localityLabel = buildLocalityLabel(signal);
  const items = [
    buildTaxLabelInsight(signal, countryCode, localityLabel),
    buildPaymentWordingInsight(signal, countryCode, localityLabel),
    buildDocumentPackInsight(signal, countryCode, localityLabel),
    buildCollectionTimingInsight(signal, countryCode, localityLabel),
    buildSeasonalInsight(signal, countryCode, localityLabel),
    buildFormattingInsight(signal, countryCode, localityLabel),
    buildComplianceReviewInsight(signal, countryCode, localityLabel),
  ]
    .filter(isLocalBusinessIntelligenceItem)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));

  return {
    title: `${input.businessName?.trim() || 'Business'} local intelligence`,
    summary: buildSummary(items, countryCode),
    emptyState: items.length === 0,
    topInsight: items[0] ?? null,
    items,
    guardrails: LOCAL_BUSINESS_INTELLIGENCE_GUARDRAILS,
  };
}

function buildTaxLabelInsight(
  signal: LocalBusinessIntelligenceSignal,
  countryCode: string,
  localityLabel: string
): LocalBusinessIntelligenceItem | null {
  if (signal.hasTaxProfile) {
    return null;
  }
  return item({
    id: 'tax_labels',
    title: countryCode === 'IN' ? 'Complete India tax setup' : 'Complete local tax setup',
    message:
      countryCode === 'IN'
        ? 'Add GST, PAN, state, and place-of-supply details so invoices and summaries use India-ready wording.'
        : 'Add country tax details so documents use the right local labels.',
    helper: 'This improves invoices, tax summaries, customer profiles, and audit packets.',
    priority: 'high',
    score: 92,
    tone: 'warning',
    actionLabel: 'Open tax setup',
    actionTarget: 'open_tax_setup',
    countryCode,
    localityLabel,
  });
}

function buildPaymentWordingInsight(
  signal: LocalBusinessIntelligenceSignal,
  countryCode: string,
  localityLabel: string
): LocalBusinessIntelligenceItem | null {
  if (signal.hasLocalPaymentDetails) {
    return null;
  }
  return item({
    id: 'payment_wording',
    title: countryCode === 'IN' ? 'Add UPI and bank details' : 'Add local payment instructions',
    message:
      countryCode === 'IN'
        ? 'Add UPI ID, account name, bank, account number, IFSC, and payment notes for invoices and reminders.'
        : 'Add saved payment instructions so customers know exactly how to pay.',
    helper: 'Manual payment links and email bodies can reuse these details.',
    priority: 'high',
    score: 88,
    tone: 'primary',
    actionLabel: 'Open payment settings',
    actionTarget: 'open_payment_settings',
    countryCode,
    localityLabel,
  });
}

function buildDocumentPackInsight(
  signal: LocalBusinessIntelligenceSignal,
  countryCode: string,
  localityLabel: string
): LocalBusinessIntelligenceItem | null {
  if (signal.hasInvoiceTemplate) {
    return null;
  }
  return item({
    id: 'document_pack',
    title: 'Choose a local document style',
    message: 'Set the default invoice and statement style so exported documents feel consistent.',
    helper:
      countryCode === 'IN'
        ? 'India GST Standard is the safest starting point for GST-ready invoices.'
        : 'Free templates are available now; deeper country packs can be enabled later.',
    priority: 'normal',
    score: 72,
    tone: 'primary',
    actionLabel: 'Open document settings',
    actionTarget: 'open_document_settings',
    countryCode,
    localityLabel,
  });
}

function buildCollectionTimingInsight(
  signal: LocalBusinessIntelligenceSignal,
  countryCode: string,
  localityLabel: string
): LocalBusinessIntelligenceItem | null {
  const overdueCustomers = count(signal.overdueCustomerCount);
  const unpaidInvoices = count(signal.unpaidInvoiceCount);
  if (overdueCustomers + unpaidInvoices === 0) {
    return null;
  }
  return item({
    id: 'collection_timing',
    title: 'Prepare local follow-up queue',
    message: `${overdueCustomers || unpaidInvoices} account${plural(overdueCustomers || unpaidInvoices)} need${(overdueCustomers || unpaidInvoices) === 1 ? 's' : ''} payment follow-up with locally clear wording.`,
    helper: countryCode === 'IN' ? 'Use UPI/bank wording and polite WhatsApp-ready copy.' : 'Use saved reminder tone and payment instructions.',
    priority: overdueCustomers > 0 ? 'critical' : 'high',
    score: overdueCustomers > 0 ? 118 : 96,
    tone: overdueCustomers > 0 ? 'danger' : 'warning',
    actionLabel: 'Open collection coach',
    actionTarget: 'open_collection_coach',
    countryCode,
    localityLabel,
  });
}

function buildSeasonalInsight(
  signal: LocalBusinessIntelligenceSignal,
  countryCode: string,
  localityLabel: string
): LocalBusinessIntelligenceItem | null {
  const month = normalizeMonth(signal.month);
  if (countryCode !== 'IN' || ![3, 4, 10, 11].includes(month)) {
    return null;
  }
  const isYearEnd = month === 3 || month === 4;
  return item({
    id: 'seasonal_nudge',
    title: isYearEnd ? 'Year-end review season' : 'Festival-season collection check',
    message: isYearEnd
      ? 'Review tax summaries, pending balances, and customer statements before year-end cleanup.'
      : 'Review customer dues and payment notices before the busy seasonal period.',
    helper: 'Keep this as a calm checklist, not a warning.',
    priority: 'normal',
    score: isYearEnd ? 84 : 66,
    tone: 'neutral',
    actionLabel: 'Open reports',
    actionTarget: 'open_reports',
    countryCode,
    localityLabel,
  });
}

function buildFormattingInsight(
  signal: LocalBusinessIntelligenceSignal,
  countryCode: string,
  localityLabel: string
): LocalBusinessIntelligenceItem | null {
  if (signal.localCurrency && signal.localCurrency.toUpperCase() === expectedCurrency(countryCode)) {
    return null;
  }
  return item({
    id: 'regional_formatting',
    title: 'Review country and currency format',
    message: `Documents should use ${expectedCurrency(countryCode)} and ${countryCode} address, phone, and date conventions.`,
    helper: 'This helps invoices, CSV exports, receipts, and customer reports look native.',
    priority: 'normal',
    score: 58,
    tone: 'primary',
    actionLabel: 'Open settings',
    actionTarget: 'open_settings',
    countryCode,
    localityLabel,
  });
}

function buildComplianceReviewInsight(
  signal: LocalBusinessIntelligenceSignal,
  countryCode: string,
  localityLabel: string
): LocalBusinessIntelligenceItem | null {
  const taxInvoiceCount = count(signal.taxInvoiceCount);
  if (!signal.hasTaxProfile || taxInvoiceCount === 0) {
    return null;
  }
  return item({
    id: 'compliance_review',
    title: 'Prepare local review summary',
    message: `${taxInvoiceCount} tax invoice${plural(taxInvoiceCount)} can be reviewed with ${countryCode} labels and careful export wording.`,
    helper: 'Use this for internal review or accountant handoff, not official filing.',
    priority: 'normal',
    score: 68 + Math.min(taxInvoiceCount, 20),
    tone: 'success',
    actionLabel: 'Open reports',
    actionTarget: 'open_reports',
    countryCode,
    localityLabel,
  });
}

function item(input: LocalBusinessIntelligenceItem): LocalBusinessIntelligenceItem {
  return input;
}

function buildSummary(items: LocalBusinessIntelligenceItem[], countryCode: string): string {
  if (!items.length) {
    return `${countryCode} settings look ready for the current workspace.`;
  }
  const critical = items.filter((entry) => entry.priority === 'critical').length;
  if (critical > 0) {
    return `${critical} local business item${plural(critical)} should be reviewed first.`;
  }
  return `${items.length} local improvement${plural(items.length)} can make documents and follow-ups feel more native.`;
}

function surface(
  area: LocalBusinessIntelligenceArea,
  label: string,
  userPromise: string,
  requiredData: string[]
): LocalBusinessIntelligenceSurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    requiredData,
  };
}

function normalizeCountryCode(countryCode?: string | null): string {
  return countryCode?.trim().toUpperCase() || 'IN';
}

function buildLocalityLabel(signal: LocalBusinessIntelligenceSignal): string {
  const parts = [signal.city, signal.stateCode, signal.countryCode]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : normalizeCountryCode(signal.countryCode);
}

function expectedCurrency(countryCode: string): string {
  const currencies: Record<string, string> = {
    AU: 'AUD',
    CA: 'CAD',
    GB: 'GBP',
    IN: 'INR',
    US: 'USD',
  };
  return currencies[countryCode] ?? 'INR';
}

function normalizeMonth(month?: number | null): number {
  return Number.isFinite(month) && month && month >= 1 && month <= 12 ? Math.floor(month) : new Date().getMonth() + 1;
}

function count(value?: number | null): number {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 0;
}

function plural(countValue: number): string {
  return countValue === 1 ? '' : 's';
}

function isLocalBusinessIntelligenceItem(
  itemValue: LocalBusinessIntelligenceItem | null
): itemValue is LocalBusinessIntelligenceItem {
  return itemValue !== null;
}
