export type PaymentMode =
  | 'cash'
  | 'cheque'
  | 'demand_draft'
  | 'bank_transfer'
  | 'upi'
  | 'card'
  | 'wallet'
  | 'other';

export type PaymentModeDetails = {
  referenceNumber?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  instrumentDate?: string | null;
  upiId?: string | null;
  provider?: string | null;
  cardLastFour?: string | null;
  note?: string | null;
};

export type PaymentModeConfig = {
  mode: PaymentMode;
  label: string;
  helper: string;
  requiredFields: Array<keyof PaymentModeDetails>;
};

export const PAYMENT_MODE_CONFIGS: PaymentModeConfig[] = [
  {
    mode: 'cash',
    label: 'Cash',
    helper: 'Physical cash received.',
    requiredFields: [],
  },
  {
    mode: 'cheque',
    label: 'Cheque',
    helper: 'Cheque number, bank, branch, and cheque date.',
    requiredFields: ['referenceNumber', 'bankName', 'branchName', 'instrumentDate'],
  },
  {
    mode: 'demand_draft',
    label: 'Demand draft',
    helper: 'Demand draft number, issuing bank, branch, and date.',
    requiredFields: ['referenceNumber', 'bankName', 'branchName', 'instrumentDate'],
  },
  {
    mode: 'bank_transfer',
    label: 'Bank transfer',
    helper: 'Bank transfer reference and sender bank when available.',
    requiredFields: ['referenceNumber'],
  },
  {
    mode: 'upi',
    label: 'UPI',
    helper: 'UPI transaction reference or payer UPI ID.',
    requiredFields: ['referenceNumber'],
  },
  {
    mode: 'card',
    label: 'Card',
    helper: 'Card payment reference and last four digits.',
    requiredFields: ['cardLastFour'],
  },
  {
    mode: 'wallet',
    label: 'Wallet / provider',
    helper: 'Wallet or provider name and payment reference.',
    requiredFields: ['provider', 'referenceNumber'],
  },
  {
    mode: 'other',
    label: 'Other',
    helper: 'Any other confirmed payment mode.',
    requiredFields: ['note'],
  },
];

export function getPaymentModeConfig(mode?: string | null): PaymentModeConfig {
  return PAYMENT_MODE_CONFIGS.find((config) => config.mode === mode) ?? PAYMENT_MODE_CONFIGS[0];
}

export function getPaymentModeLabel(mode?: string | null): string {
  return getPaymentModeConfig(mode).label;
}

export function normalizePaymentMode(value?: string | null): PaymentMode {
  return PAYMENT_MODE_CONFIGS.some((config) => config.mode === value) ? (value as PaymentMode) : 'cash';
}

export function normalizePaymentModeDetails(details?: PaymentModeDetails | null): PaymentModeDetails {
  return {
    referenceNumber: clean(details?.referenceNumber),
    bankName: clean(details?.bankName),
    branchName: clean(details?.branchName),
    instrumentDate: clean(details?.instrumentDate),
    upiId: clean(details?.upiId),
    provider: clean(details?.provider),
    cardLastFour: normalizeCardLastFour(details?.cardLastFour),
    note: clean(details?.note),
  };
}

export function validatePaymentModeDetails(
  mode: PaymentMode,
  details: PaymentModeDetails
): string | null {
  const config = getPaymentModeConfig(mode);
  for (const field of config.requiredFields) {
    if (!details[field]?.trim()) {
      return `${config.label} needs ${formatFieldLabel(field)}.`;
    }
  }

  if (details.cardLastFour && !/^\d{4}$/.test(details.cardLastFour)) {
    return 'Card last four must be 4 digits.';
  }

  return null;
}

export function summarizePaymentMode(mode?: string | null, details?: PaymentModeDetails | null): string {
  const normalizedMode = normalizePaymentMode(mode);
  const normalizedDetails = normalizePaymentModeDetails(details);
  const label = getPaymentModeLabel(normalizedMode);
  const parts = [
    normalizedDetails.provider,
    normalizedDetails.referenceNumber ? `Ref ${normalizedDetails.referenceNumber}` : null,
    normalizedDetails.bankName,
    normalizedDetails.cardLastFour ? `Card ${normalizedDetails.cardLastFour}` : null,
    normalizedDetails.upiId,
  ].filter(Boolean);

  return parts.length ? `${label} - ${parts.join(' - ')}` : label;
}

function clean(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function normalizeCardLastFour(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, '').slice(-4);
  return digits && digits.length === 4 ? digits : clean(value);
}

function formatFieldLabel(field: keyof PaymentModeDetails): string {
  switch (field) {
    case 'referenceNumber':
      return 'a reference number';
    case 'bankName':
      return 'bank name';
    case 'branchName':
      return 'branch name';
    case 'instrumentDate':
      return 'date';
    case 'upiId':
      return 'UPI ID';
    case 'provider':
      return 'provider name';
    case 'cardLastFour':
      return 'card last four digits';
    case 'note':
    default:
      return 'a note';
  }
}
