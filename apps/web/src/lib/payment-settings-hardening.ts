import { normalizeManualPaymentInstructionDetails, type ManualPaymentInstructionDetails } from '@orbit-ledger/core';

export type PaymentInstructionAuditChange = {
  field: keyof ManualPaymentInstructionDetails;
  label: string;
  previousValue: string | null;
  nextValue: string | null;
  maskedPreviousValue: string | null;
  maskedNextValue: string | null;
};

const paymentInstructionFieldLabels: Partial<Record<keyof ManualPaymentInstructionDetails, string>> = {
  upiId: 'UPI ID',
  paymentPageUrl: 'Payment page',
  paymentNote: 'Payment note',
  bankAccountName: 'Account name',
  bankName: 'Bank name',
  bankAccountNumber: 'Account number',
  bankIfsc: 'IFSC',
  bankBranch: 'Branch',
  bankRoutingNumber: 'Routing number',
  bankSortCode: 'Sort code',
  bankIban: 'IBAN',
  bankSwift: 'SWIFT / BIC',
};

const sensitiveFields = new Set<keyof ManualPaymentInstructionDetails>([
  'upiId',
  'bankAccountNumber',
  'bankIfsc',
  'bankRoutingNumber',
  'bankSortCode',
  'bankIban',
  'bankSwift',
]);

export function buildPaymentInstructionAuditChanges(
  previous: Partial<ManualPaymentInstructionDetails> | null | undefined,
  next: Partial<ManualPaymentInstructionDetails> | null | undefined
): PaymentInstructionAuditChange[] {
  const normalizedPrevious = normalizeManualPaymentInstructionDetails(previous);
  const normalizedNext = normalizeManualPaymentInstructionDetails(next);

  return (Object.keys(paymentInstructionFieldLabels) as Array<keyof ManualPaymentInstructionDetails>)
    .map((field) => {
      const previousValue = normalizeAuditValue(normalizedPrevious[field]);
      const nextValue = normalizeAuditValue(normalizedNext[field]);
      if (previousValue === nextValue) {
        return null;
      }

      return {
        field,
        label: paymentInstructionFieldLabels[field] ?? String(field),
        previousValue,
        nextValue,
        maskedPreviousValue: maskPaymentSettingValue(field, previousValue),
        maskedNextValue: maskPaymentSettingValue(field, nextValue),
      };
    })
    .filter((change): change is PaymentInstructionAuditChange => Boolean(change));
}

export function hasPaymentInstructionChanges(
  previous: Partial<ManualPaymentInstructionDetails> | null | undefined,
  next: Partial<ManualPaymentInstructionDetails> | null | undefined
) {
  return buildPaymentInstructionAuditChanges(previous, next).length > 0;
}

export function summarizePaymentInstructionChanges(changes: PaymentInstructionAuditChange[]) {
  if (!changes.length) {
    return 'No payment detail changes.';
  }
  return changes.map((change) => change.label).join(', ');
}

export function validateManualPaymentSettings(details: Partial<ManualPaymentInstructionDetails>, countryCode?: string | null) {
  const normalized = normalizeManualPaymentInstructionDetails(details);
  const country = countryCode?.trim().toUpperCase();
  const errors: string[] = [];
  const rawPaymentPageUrl = typeof details.paymentPageUrl === 'string' ? details.paymentPageUrl.trim() : '';
  const rawUpiId = typeof details.upiId === 'string' ? details.upiId.trim() : '';

  if (rawPaymentPageUrl && !rawPaymentPageUrl.startsWith('https://')) {
    errors.push('Payment page must use a secure https link.');
  }
  if (country === 'IN' && rawUpiId && !/^[A-Za-z0-9.\-_]{2,256}@[A-Za-z][A-Za-z0-9.\-_]{2,64}$/.test(rawUpiId)) {
    errors.push('Enter a valid UPI ID.');
  }
  if (country === 'IN' && normalized.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized.bankIfsc)) {
    errors.push('Enter a valid IFSC code.');
  }
  if (normalized.bankAccountNumber && !/^[A-Za-z0-9\- ]{4,34}$/.test(normalized.bankAccountNumber)) {
    errors.push('Enter a valid bank account number.');
  }

  return errors;
}

function normalizeAuditValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function maskPaymentSettingValue(field: keyof ManualPaymentInstructionDetails, value: string | null) {
  if (!value) {
    return null;
  }
  if (!sensitiveFields.has(field)) {
    return value;
  }
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  return `${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
}
