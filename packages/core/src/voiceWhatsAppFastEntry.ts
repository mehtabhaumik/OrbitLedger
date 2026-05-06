export type FastEntryChannel = 'voice' | 'whatsapp' | 'typed';

export type FastEntryIntentKind =
  | 'record_payment'
  | 'record_credit'
  | 'create_invoice_draft'
  | 'send_payment_reminder'
  | 'record_payment_promise'
  | 'add_customer'
  | 'add_product'
  | 'unknown';

export type FastEntryActionTarget =
  | 'open_transaction_review'
  | 'open_invoice_draft_review'
  | 'open_reminder_review'
  | 'open_promise_review'
  | 'open_customer_review'
  | 'open_product_review'
  | 'open_capture_review';

export type FastEntrySurfaceArea =
  | 'capture'
  | 'money_entry'
  | 'invoice_draft'
  | 'collection_follow_up'
  | 'customer_setup'
  | 'inventory_setup'
  | 'review_safety';

export type FastEntryExtractedFields = {
  amount?: number;
  customerName?: string;
  invoiceNumber?: string;
  paymentMode?: string;
  dueDateText?: string;
  note?: string;
  itemName?: string;
  quantity?: number;
};

export type FastEntryDraft = {
  channel: FastEntryChannel;
  rawText: string;
  normalizedText: string;
  intent: FastEntryIntentKind;
  confidence: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  extracted: FastEntryExtractedFields;
  missingFields: string[];
  reviewRequired: true;
  canAutoSave: false;
  suggestedAction: string;
  actionTarget: FastEntryActionTarget;
  guardrails: string[];
};

export type FastEntrySurfaceBlueprint = {
  area: FastEntrySurfaceArea;
  label: string;
  userPromise: string;
  inputExamples: string[];
  requiredReviewFields: string[];
  actionTarget: FastEntryActionTarget;
};

export const VOICE_WHATSAPP_FAST_ENTRY_SURFACES: FastEntrySurfaceBlueprint[] = [
  surface('capture', 'Fast capture', 'Capture spoken, typed, or WhatsApp-style business text into a reviewable draft.', [
    'Sonali paid 1500 by UPI',
    'Add 2000 credit for Mehta Stores',
    'Create invoice for printer repair 1500 plus GST',
  ], ['raw text', 'source channel', 'detected intent'], 'open_capture_review'),
  surface('money_entry', 'Money entry review', 'Turn payment and credit phrases into reviewed ledger entries.', [
    'Received 5000 cash from Aarav Stores',
    'Add outstanding 3200 for Riya Traders',
  ], ['customer', 'amount', 'entry type', 'date', 'payment mode when payment'], 'open_transaction_review'),
  surface('invoice_draft', 'Invoice draft review', 'Prepare invoice drafts from quick text without creating final invoices silently.', [
    'Invoice Sonali Traders for monthly maintenance 2500',
    'Bill Aarav Stores for 3 paper rolls at 400 each',
  ], ['customer', 'line item', 'quantity', 'price', 'tax choice'], 'open_invoice_draft_review'),
  surface('collection_follow_up', 'Collection follow-up', 'Prepare reminders and promise notes from quick messages.', [
    'Remind Sonali about WEB-100 tomorrow',
    'Riya promised to pay 5000 on Friday',
  ], ['customer', 'message or promise date', 'amount when available'], 'open_reminder_review'),
  surface('customer_setup', 'Customer setup', 'Prepare customer records from quick text and ask for missing contact details.', [
    'Add customer Sonali Traders phone 9586976949',
    'Add Aarav Stores as business customer',
  ], ['display name', 'phone or email when available', 'customer type'], 'open_customer_review'),
  surface('inventory_setup', 'Inventory setup', 'Prepare product or stock updates from quick text for review.', [
    'Add product thermal paper roll price 120 stock 25',
    'Stock for printer toner is 4',
  ], ['product name', 'price or stock quantity', 'unit when available'], 'open_product_review'),
  surface('review_safety', 'Review safety', 'Require confirmation before any money, invoice, customer, or stock record is saved.', [
    'Review detected details before saving',
    'Show what Orbit understood',
  ], ['detected details', 'missing fields', 'save action'], 'open_capture_review'),
];

export const VOICE_WHATSAPP_FAST_ENTRY_GUARDRAILS = [
  'Fast entry must create a draft for review, never silently save money, invoices, customers, or stock.',
  'Every draft must show what Orbit Ledger understood and which fields are missing.',
  'Low-confidence input must ask the user to choose the intent before showing save actions.',
  'Voice and WhatsApp text can suggest payment mode, but clearance and invoice allocation still need review.',
  'Customer-facing messages must be editable before sharing.',
  'Invoice drafts created from fast entry must follow normal invoice save and version rules.',
  'Sensitive data from WhatsApp or voice must stay inside the active workspace review flow.',
];

export function buildVoiceWhatsAppFastEntryDraft(input: {
  text: string;
  channel?: FastEntryChannel | null;
}): FastEntryDraft {
  const rawText = input.text.trim();
  const normalizedText = normalizeText(rawText);
  const intent = detectIntent(normalizedText);
  const extracted = extractFields(rawText, normalizedText, intent);
  const missingFields = getMissingFields(intent, extracted);
  const confidence = getConfidence(intent, extracted, missingFields);
  const actionTarget = getActionTarget(intent);

  return {
    channel: input.channel ?? 'typed',
    rawText,
    normalizedText,
    intent,
    confidence,
    title: getTitle(intent),
    summary: buildSummary(intent, extracted, missingFields),
    extracted,
    missingFields,
    reviewRequired: true,
    canAutoSave: false,
    suggestedAction: getSuggestedAction(intent, confidence),
    actionTarget,
    guardrails: VOICE_WHATSAPP_FAST_ENTRY_GUARDRAILS,
  };
}

function detectIntent(text: string): FastEntryIntentKind {
  if (!text) {
    return 'unknown';
  }
  if (matchesAny(text, ['remind', 'reminder', 'send message', 'whatsapp', 'payment notice'])) {
    return 'send_payment_reminder';
  }
  if (matchesAny(text, ['promise', 'promised', 'will pay', 'pay on'])) {
    return 'record_payment_promise';
  }
  if (matchesAny(text, ['invoice', 'bill ', 'create bill', 'tax invoice'])) {
    return 'create_invoice_draft';
  }
  if (matchesAny(text, ['add customer', 'new customer'])) {
    return 'add_customer';
  }
  if (matchesAny(text, ['add product', 'new product', 'stock ', 'inventory'])) {
    return 'add_product';
  }
  if (matchesAny(text, ['credit', 'outstanding', 'due', 'udhar', 'gave on credit'])) {
    return 'record_credit';
  }
  if (
    matchesAny(text, ['paid', 'payment', 'received', 'cash', 'upi', 'bank transfer', 'card', 'cheque', 'check', 'demand draft']) ||
    /\bdd\b/.test(text)
  ) {
    return 'record_payment';
  }
  return 'unknown';
}

function extractFields(
  rawText: string,
  normalizedText: string,
  intent: FastEntryIntentKind
): FastEntryExtractedFields {
  const amount = extractAmount(rawText);
  const quantity = extractQuantity(normalizedText);
  const paymentMode = extractPaymentMode(normalizedText);
  const customerName = extractCustomerName(rawText, normalizedText, intent);
  const invoiceNumber = rawText.match(/\b(?:INV|WEB|MOB)-?\d+\b/i)?.[0];
  const dueDateText = extractDueDateText(rawText, normalizedText);

  return removeEmpty({
    amount,
    quantity,
    paymentMode,
    customerName,
    invoiceNumber,
    dueDateText,
    itemName: intent === 'add_product' || intent === 'create_invoice_draft' ? extractItemName(rawText, normalizedText) : undefined,
    note: rawText || undefined,
  });
}

function getMissingFields(intent: FastEntryIntentKind, extracted: FastEntryExtractedFields): string[] {
  const missing: string[] = [];
  if (intent === 'unknown') {
    return ['intent'];
  }
  if (requiresCustomer(intent) && !extracted.customerName) {
    missing.push('customer');
  }
  if (requiresAmount(intent) && !extracted.amount) {
    missing.push('amount');
  }
  if (intent === 'record_payment' && !extracted.paymentMode) {
    missing.push('payment mode');
  }
  if (intent === 'create_invoice_draft' && !extracted.itemName) {
    missing.push('invoice item');
  }
  if (intent === 'record_payment_promise' && !extracted.dueDateText) {
    missing.push('promise date');
  }
  if (intent === 'add_product' && !extracted.itemName) {
    missing.push('product name');
  }
  if (intent === 'send_payment_reminder' && !extracted.customerName && !extracted.invoiceNumber) {
    missing.push('customer or invoice');
  }
  return missing;
}

function getConfidence(
  intent: FastEntryIntentKind,
  extracted: FastEntryExtractedFields,
  missingFields: string[]
): FastEntryDraft['confidence'] {
  if (intent === 'unknown') {
    return 'low';
  }
  if (missingFields.length === 0) {
    return 'high';
  }
  if (extracted.customerName || extracted.amount || extracted.invoiceNumber || extracted.itemName) {
    return 'medium';
  }
  return 'low';
}

function getActionTarget(intent: FastEntryIntentKind): FastEntryActionTarget {
  const targets: Record<FastEntryIntentKind, FastEntryActionTarget> = {
    record_payment: 'open_transaction_review',
    record_credit: 'open_transaction_review',
    create_invoice_draft: 'open_invoice_draft_review',
    send_payment_reminder: 'open_reminder_review',
    record_payment_promise: 'open_promise_review',
    add_customer: 'open_customer_review',
    add_product: 'open_product_review',
    unknown: 'open_capture_review',
  };
  return targets[intent];
}

function getTitle(intent: FastEntryIntentKind): string {
  const titles: Record<FastEntryIntentKind, string> = {
    record_payment: 'Review payment entry',
    record_credit: 'Review credit entry',
    create_invoice_draft: 'Review invoice draft',
    send_payment_reminder: 'Review reminder',
    record_payment_promise: 'Review payment promise',
    add_customer: 'Review customer',
    add_product: 'Review product',
    unknown: 'Choose what to create',
  };
  return titles[intent];
}

function buildSummary(
  intent: FastEntryIntentKind,
  extracted: FastEntryExtractedFields,
  missingFields: string[]
): string {
  if (intent === 'unknown') {
    return 'Orbit Ledger needs the user to choose what this entry should become.';
  }
  const parts = [
    extracted.customerName ? `Customer: ${extracted.customerName}` : null,
    extracted.amount ? `Amount: ${extracted.amount}` : null,
    extracted.paymentMode ? `Mode: ${extracted.paymentMode}` : null,
    extracted.invoiceNumber ? `Invoice: ${extracted.invoiceNumber}` : null,
    extracted.itemName ? `Item: ${extracted.itemName}` : null,
  ].filter(Boolean);
  const understood = parts.length ? parts.join(' · ') : 'Some details were detected.';
  return missingFields.length
    ? `${understood} Missing: ${missingFields.join(', ')}.`
    : `${understood} Review before saving.`;
}

function getSuggestedAction(intent: FastEntryIntentKind, confidence: FastEntryDraft['confidence']): string {
  if (confidence === 'low') {
    return 'Choose entry type';
  }
  if (intent === 'unknown') {
    return 'Review capture';
  }
  return confidence === 'high' ? 'Review and save' : 'Complete missing details';
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function extractAmount(text: string): number | undefined {
  const match = text.match(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!match?.[1]) {
    return undefined;
  }
  const amount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function extractQuantity(text: string): number | undefined {
  const match = text.match(/\b(?:qty|quantity|stock)\s+([0-9]+)\b/);
  if (!match?.[1]) {
    return undefined;
  }
  const quantity = Number(match[1]);
  return Number.isFinite(quantity) ? quantity : undefined;
}

function extractPaymentMode(text: string): string | undefined {
  if (text.includes('upi')) return 'UPI';
  if (text.includes('cash')) return 'Cash';
  if (text.includes('bank transfer')) return 'Bank transfer';
  if (text.includes('card')) return 'Card';
  if (text.includes('cheque') || text.includes('check')) return 'Cheque';
  if (text.includes('demand draft') || /\bdd\b/.test(text)) return 'Demand draft';
  if (text.includes('wallet')) return 'Wallet';
  return undefined;
}

function extractCustomerName(
  rawText: string,
  normalizedText: string,
  intent: FastEntryIntentKind
): string | undefined {
  const labelMatch = rawText.match(/\b(?:customer|from|for|to)\s+([A-Za-z][A-Za-z0-9 &.'-]{1,48})/i);
  if (labelMatch?.[1]) {
    return cleanName(labelMatch[1]);
  }
  if (intent === 'record_payment') {
    const paidMatch = rawText.match(/^([A-Za-z][A-Za-z0-9 &.'-]{1,48})\s+(?:paid|payment|sent)/i);
    if (paidMatch?.[1]) {
      return cleanName(paidMatch[1]);
    }
  }
  if (intent === 'record_credit' && normalizedText.includes(' for ')) {
    const creditMatch = rawText.match(/\bfor\s+([A-Za-z][A-Za-z0-9 &.'-]{1,48})/i);
    if (creditMatch?.[1]) {
      return cleanName(creditMatch[1]);
    }
  }
  return undefined;
}

function extractDueDateText(rawText: string, normalizedText: string): string | undefined {
  const dateMatch = rawText.match(/\b(?:on|by)\s+([A-Za-z0-9 ,/-]{3,24})/i);
  if (dateMatch?.[1]) {
    return dateMatch[1].trim();
  }
  if (normalizedText.includes('tomorrow')) return 'tomorrow';
  if (normalizedText.includes('today')) return 'today';
  return undefined;
}

function extractItemName(rawText: string, normalizedText: string): string | undefined {
  const itemMatch = rawText.match(/\b(?:for|product|item)\s+([A-Za-z][A-Za-z0-9 &.'-]{1,60})/i);
  if (itemMatch?.[1]) {
    return cleanName(itemMatch[1]);
  }
  if (normalizedText.includes('stock for ')) {
    const stockMatch = rawText.match(/\bstock for\s+([A-Za-z][A-Za-z0-9 &.'-]{1,60})/i);
    if (stockMatch?.[1]) {
      return cleanName(stockMatch[1]);
    }
  }
  return undefined;
}

function cleanName(value: string): string {
  return value
    .replace(/\s+[0-9][0-9,]*(?:\.[0-9]{1,2})?.*$/i, '')
    .replace(/\b(?:paid|payment|received|by|cash|upi|bank transfer|card|cheque|check|invoice|bill|for|rs|inr|on|tomorrow|today)\b.*$/i, '')
    .replace(/[.,;:]+$/g, '')
    .trim();
}

function requiresCustomer(intent: FastEntryIntentKind): boolean {
  return ['record_payment', 'record_credit', 'create_invoice_draft', 'record_payment_promise'].includes(intent);
}

function requiresAmount(intent: FastEntryIntentKind): boolean {
  return ['record_payment', 'record_credit', 'create_invoice_draft', 'record_payment_promise'].includes(intent);
}

function removeEmpty(input: FastEntryExtractedFields): FastEntryExtractedFields {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as FastEntryExtractedFields;
}

function surface(
  area: FastEntrySurfaceArea,
  label: string,
  userPromise: string,
  inputExamples: string[],
  requiredReviewFields: string[],
  actionTarget: FastEntryActionTarget
): FastEntrySurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    inputExamples,
    requiredReviewFields,
    actionTarget,
  };
}
