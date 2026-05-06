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

export type PaymentClearanceStatus =
  | 'pending'
  | 'received'
  | 'post_dated'
  | 'deposited'
  | 'initiated'
  | 'cleared'
  | 'bounced'
  | 'errored'
  | 'cancelled';

export const PAYMENT_CLEARANCE_STATUSES: PaymentClearanceStatus[] = [
  'pending',
  'received',
  'post_dated',
  'deposited',
  'initiated',
  'cleared',
  'bounced',
  'errored',
  'cancelled',
];

export type PaymentInstrumentAttachment = {
  id: string;
  name: string;
  url: string;
  storagePath?: string | null;
  contentType?: string | null;
  size?: number | null;
  uploadedAt: string;
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

export function isInstrumentPaymentMode(mode?: string | null): boolean {
  return mode === 'cheque' || mode === 'demand_draft';
}

export function normalizePaymentClearanceStatus(
  value?: string | null,
  mode?: PaymentMode | string | null,
  details?: PaymentModeDetails | null,
  today = todayDate()
): PaymentClearanceStatus {
  const allowedStatuses = getPaymentClearanceStatusesForMode(mode);
  if (isPaymentClearanceStatus(value) && allowedStatuses.includes(value)) {
    return value;
  }

  const normalizedMode = normalizePaymentMode(mode);
  if (normalizedMode === 'cash') {
    return 'received';
  }

  if (normalizedMode !== 'cheque' && normalizedMode !== 'demand_draft') {
    return 'pending';
  }

  if (normalizedMode === 'demand_draft') {
    return 'received';
  }

  const instrumentDate = details?.instrumentDate?.trim();
  return instrumentDate && instrumentDate > today ? 'post_dated' : 'received';
}

export function getPaymentClearanceStatusesForMode(
  mode?: PaymentMode | string | null
): PaymentClearanceStatus[] {
  const normalizedMode = normalizePaymentMode(mode);

  if (normalizedMode === 'cheque') {
    return ['pending', 'received', 'post_dated', 'deposited', 'cleared', 'bounced', 'cancelled'];
  }

  if (normalizedMode === 'demand_draft') {
    return ['pending', 'received', 'deposited', 'cleared', 'errored', 'cancelled'];
  }

  if (normalizedMode === 'cash') {
    return ['pending', 'received'];
  }

  if (
    normalizedMode === 'bank_transfer' ||
    normalizedMode === 'upi' ||
    normalizedMode === 'card' ||
    normalizedMode === 'wallet'
  ) {
    return ['pending', 'initiated', 'cleared', 'errored', 'cancelled'];
  }

  return ['pending', 'received', 'cleared', 'cancelled'];
}

function isPaymentClearanceStatus(value?: string | null): value is PaymentClearanceStatus {
  return PAYMENT_CLEARANCE_STATUSES.includes(value as PaymentClearanceStatus);
}

export function doesPaymentClearInvoice(status?: string | null, mode?: PaymentMode | string | null): boolean {
  return status === 'cleared' || (status === 'received' && normalizePaymentMode(mode) === 'cash');
}

export function doesPaymentAwaitClearance(status?: string | null, mode?: PaymentMode | string | null): boolean {
  if (status === 'pending' || status === 'post_dated' || status === 'deposited' || status === 'initiated') {
    return true;
  }
  return status === 'received' && normalizePaymentMode(mode) !== 'cash';
}

export function getPaymentDocumentModeLine(
  mode?: PaymentMode | string | null,
  details?: PaymentModeDetails | null
): string {
  const normalizedMode = normalizePaymentMode(mode);
  const normalizedDetails = normalizePaymentModeDetails(details);

  switch (normalizedMode) {
    case 'bank_transfer':
      return 'Bank transfer';
    case 'upi':
      return normalizedDetails.upiId ? `UPI - ${normalizedDetails.upiId}` : 'UPI';
    case 'card':
      return 'Credit/Debit Card';
    case 'wallet':
      return normalizedDetails.provider ? `E-Wallet - ${normalizedDetails.provider}` : 'E-Wallet';
    case 'cheque':
      return 'Cheque';
    case 'demand_draft':
      return 'Demand draft';
    case 'other':
      return 'Other payment';
    case 'cash':
    default:
      return 'Cash';
  }
}

export function getPaymentClearanceUnpaidReason(
  status?: string | null,
  mode?: PaymentMode | string | null
): string | null {
  const normalizedMode = normalizePaymentMode(mode);

  if (doesPaymentClearInvoice(status, normalizedMode)) {
    return null;
  }

  if (normalizedMode === 'cash') {
    return status === 'pending' ? 'pending' : null;
  }

  if (normalizedMode === 'cheque') {
    switch (status) {
      case 'pending':
        return 'cheque pending';
      case 'received':
        return 'cheque received';
      case 'post_dated':
        return 'post-dated cheque received';
      case 'deposited':
        return 'cheque deposited';
      case 'bounced':
        return 'cheque bounced';
      case 'cancelled':
        return 'cheque canceled';
      default:
        return null;
    }
  }

  if (normalizedMode === 'demand_draft') {
    switch (status) {
      case 'pending':
        return 'DD pending';
      case 'received':
        return 'DD received';
      case 'deposited':
        return 'DD deposited';
      case 'errored':
        return 'DD errored';
      case 'cancelled':
        return 'DD canceled';
      default:
        return null;
    }
  }

  if (
    normalizedMode === 'bank_transfer' ||
    normalizedMode === 'upi' ||
    normalizedMode === 'card' ||
    normalizedMode === 'wallet'
  ) {
    switch (status) {
      case 'pending':
        return 'E-payment pending';
      case 'initiated':
        return 'E-payment initiated';
      case 'errored':
        return 'E-payment errored';
      case 'cancelled':
        return 'E-payment canceled';
      default:
        return null;
    }
  }

  if (normalizedMode === 'other') {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'received':
        return 'received';
      case 'cancelled':
        return 'cancelled';
      default:
        return null;
    }
  }

  return null;
}

export function getPaymentClearanceDocumentStatusLine(
  status?: string | null,
  mode?: PaymentMode | string | null
): string | null {
  const unpaidReason = getPaymentClearanceUnpaidReason(status, mode);
  if (unpaidReason) {
    return `Unpaid - ${unpaidReason}`;
  }

  const normalizedMode = normalizePaymentMode(mode);
  if (status === 'cleared') {
    if (
      normalizedMode === 'bank_transfer' ||
      normalizedMode === 'upi' ||
      normalizedMode === 'card' ||
      normalizedMode === 'wallet'
    ) {
      return 'E-payment received';
    }
    if (normalizedMode === 'cheque') {
      return 'Cheque cleared';
    }
    if (normalizedMode === 'demand_draft') {
      return 'DD cleared';
    }
    return 'Payment cleared';
  }

  if (status === 'received' && normalizedMode === 'cash') {
    return 'Cash received';
  }

  return null;
}

export function getPaymentClearanceStatusLabel(status?: string | null): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'post_dated':
      return 'Post-dated';
    case 'deposited':
      return 'Deposited';
    case 'initiated':
      return 'Initiated';
    case 'cleared':
      return 'Cleared';
    case 'bounced':
      return 'Bounced';
    case 'errored':
      return 'Errored';
    case 'cancelled':
      return 'Cancelled';
    case 'received':
    default:
      return 'Received';
  }
}

export function summarizePaymentClearance(
  status?: string | null,
  details?: PaymentModeDetails | null
): string {
  const label = getPaymentClearanceStatusLabel(status);
  if (status === 'post_dated' && details?.instrumentDate) {
    return `${label} until ${details.instrumentDate}`;
  }
  return label;
}

export function normalizePaymentInstrumentAttachments(
  attachments?: PaymentInstrumentAttachment[] | null
): PaymentInstrumentAttachment[] {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((attachment) => ({
      id: clean(attachment.id) ?? `att-${Date.now()}`,
      name: clean(attachment.name) ?? 'Payment proof',
      url: clean(attachment.url) ?? '',
      storagePath: clean(attachment.storagePath),
      contentType: clean(attachment.contentType),
      size: typeof attachment.size === 'number' && Number.isFinite(attachment.size) ? attachment.size : null,
      uploadedAt: clean(attachment.uploadedAt) ?? new Date().toISOString(),
    }))
    .filter((attachment) => attachment.url);
}

function clean(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
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
