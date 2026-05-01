import { normalizePaymentPageUrl, normalizeUpiId, type PaymentLinkDetails } from './paymentLinks';

export type ManualPaymentInstructionDetails = PaymentLinkDetails;

export type ManualPaymentInstructionField = {
  key: keyof ManualPaymentInstructionDetails;
  label: string;
  placeholder: string;
  helper: string;
};

export type ManualPaymentInstructionTemplate = {
  countryCode: 'IN' | 'US' | 'GB' | 'GENERIC';
  title: string;
  helper: string;
  fields: ManualPaymentInstructionField[];
};

const indiaTemplate: ManualPaymentInstructionTemplate = {
  countryCode: 'IN',
  title: 'India payment details',
  helper: 'Add UPI and bank transfer details customers can use from invoices and reminders.',
  fields: [
    field('upiId', 'UPI ID', 'yourname@bank', 'Shown on India payment requests and UPI links.'),
    field('bankAccountName', 'Account name', 'Business account name', 'Name customers should use for bank transfer.'),
    field('bankName', 'Bank name', 'HDFC Bank', 'Receiving bank name.'),
    field('bankAccountNumber', 'Account number', '1234567890', 'Receiving account number.'),
    field('bankIfsc', 'IFSC', 'HDFC0001234', 'Required for India bank transfers.'),
    field('bankBranch', 'Branch', 'Ahmedabad', 'Optional branch detail.'),
    field('paymentPageUrl', 'Payment page', 'https://...', 'Optional hosted payment page.'),
    field('paymentNote', 'Payment note', 'Please mention invoice number while paying.', 'Added to shared payment messages.'),
  ],
};

const usTemplate: ManualPaymentInstructionTemplate = {
  countryCode: 'US',
  title: 'US payment details',
  helper: 'Add ACH, wire, or hosted payment instructions when the US pack is enabled later.',
  fields: [
    field('bankAccountName', 'Account name', 'Business account name', 'Name customers should use for bank transfer.'),
    field('bankName', 'Bank name', 'Bank name', 'Receiving bank name.'),
    field('bankAccountNumber', 'Account number', 'Account number', 'Receiving account number.'),
    field('bankRoutingNumber', 'Routing number', 'Routing number', 'ACH or wire routing number.'),
    field('paymentPageUrl', 'Payment page', 'https://...', 'Optional hosted payment page.'),
    field('paymentNote', 'Payment note', 'Please include invoice number.', 'Added to shared payment messages.'),
  ],
};

const gbTemplate: ManualPaymentInstructionTemplate = {
  countryCode: 'GB',
  title: 'UK payment details',
  helper: 'Add bank transfer details when the UK pack is enabled later.',
  fields: [
    field('bankAccountName', 'Account name', 'Business account name', 'Name customers should use for bank transfer.'),
    field('bankName', 'Bank name', 'Bank name', 'Receiving bank name.'),
    field('bankAccountNumber', 'Account number', 'Account number', 'Receiving account number.'),
    field('bankSortCode', 'Sort code', '00-00-00', 'UK bank sort code.'),
    field('bankIban', 'IBAN', 'GB00...', 'Optional international transfer detail.'),
    field('bankSwift', 'SWIFT / BIC', 'BANKGB00', 'Optional international transfer detail.'),
    field('paymentPageUrl', 'Payment page', 'https://...', 'Optional hosted payment page.'),
    field('paymentNote', 'Payment note', 'Please include invoice number.', 'Added to shared payment messages.'),
  ],
};

const genericTemplate: ManualPaymentInstructionTemplate = {
  countryCode: 'GENERIC',
  title: 'Payment details',
  helper: 'Add bank or hosted payment details customers can use from invoices and reminders.',
  fields: [
    field('bankAccountName', 'Account name', 'Business account name', 'Name customers should use for bank transfer.'),
    field('bankName', 'Bank name', 'Bank name', 'Receiving bank name.'),
    field('bankAccountNumber', 'Account number', 'Account number', 'Receiving account number.'),
    field('paymentPageUrl', 'Payment page', 'https://...', 'Optional hosted payment page.'),
    field('paymentNote', 'Payment note', 'Please include invoice number.', 'Added to shared payment messages.'),
  ],
};

export function getManualPaymentInstructionTemplate(countryCode?: string | null): ManualPaymentInstructionTemplate {
  switch ((countryCode ?? '').trim().toUpperCase()) {
    case 'IN':
      return indiaTemplate;
    case 'US':
      return usTemplate;
    case 'GB':
    case 'UK':
      return gbTemplate;
    default:
      return genericTemplate;
  }
}

export function normalizeManualPaymentInstructionDetails(
  input?: Partial<ManualPaymentInstructionDetails> | null
): ManualPaymentInstructionDetails {
  return {
    upiId: normalizeUpiId(input?.upiId),
    paymentPageUrl: normalizePaymentPageUrl(input?.paymentPageUrl),
    hostedPaymentPageUrl: normalizePaymentPageUrl(input?.hostedPaymentPageUrl),
    preferHostedPaymentPage: Boolean(input?.preferHostedPaymentPage),
    paymentNote: clean(input?.paymentNote),
    bankAccountName: clean(input?.bankAccountName),
    bankName: clean(input?.bankName),
    bankAccountNumber: clean(input?.bankAccountNumber),
    bankIfsc: clean(input?.bankIfsc)?.toUpperCase() ?? null,
    bankBranch: clean(input?.bankBranch),
    bankRoutingNumber: clean(input?.bankRoutingNumber),
    bankSortCode: clean(input?.bankSortCode),
    bankIban: clean(input?.bankIban)?.toUpperCase() ?? null,
    bankSwift: clean(input?.bankSwift)?.toUpperCase() ?? null,
  };
}

export function buildManualPaymentInstructionLines(
  details?: Partial<ManualPaymentInstructionDetails> | null,
  countryCode?: string | null
): string[] {
  const normalized = normalizeManualPaymentInstructionDetails(details);
  const country = (countryCode ?? '').trim().toUpperCase();
  const lines: string[] = [];

  if (country === 'IN' && normalized.upiId) {
    lines.push(`UPI ID: ${normalized.upiId}`);
  }

  if (normalized.bankAccountName) {
    lines.push(`Account name: ${normalized.bankAccountName}`);
  }
  if (normalized.bankName) {
    lines.push(`Bank: ${normalized.bankName}`);
  }
  if (normalized.bankAccountNumber) {
    lines.push(`Account number: ${normalized.bankAccountNumber}`);
  }
  if (country === 'IN' && normalized.bankIfsc) {
    lines.push(`IFSC: ${normalized.bankIfsc}`);
  }
  if (country === 'IN' && normalized.bankBranch) {
    lines.push(`Branch: ${normalized.bankBranch}`);
  }
  if (country === 'US' && normalized.bankRoutingNumber) {
    lines.push(`Routing number: ${normalized.bankRoutingNumber}`);
  }
  if ((country === 'GB' || country === 'UK') && normalized.bankSortCode) {
    lines.push(`Sort code: ${normalized.bankSortCode}`);
  }
  if (normalized.bankIban) {
    lines.push(`IBAN: ${normalized.bankIban}`);
  }
  if (normalized.bankSwift) {
    lines.push(`SWIFT/BIC: ${normalized.bankSwift}`);
  }
  if (normalized.paymentPageUrl) {
    lines.push(`Payment page: ${normalized.paymentPageUrl}`);
  }
  if (normalized.paymentNote) {
    lines.push(normalized.paymentNote);
  }

  return lines;
}

export function buildManualPaymentInstructionText(
  details?: Partial<ManualPaymentInstructionDetails> | null,
  countryCode?: string | null
): string | null {
  const lines = buildManualPaymentInstructionLines(details, countryCode);
  return lines.length ? lines.join('\n') : null;
}

function field(
  key: keyof ManualPaymentInstructionDetails,
  label: string,
  placeholder: string,
  helper: string
): ManualPaymentInstructionField {
  return { key, label, placeholder, helper };
}

function clean(value?: string | null): string | null {
  const next = value?.trim();
  return next ? next : null;
}
