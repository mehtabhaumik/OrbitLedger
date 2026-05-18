export type InvoiceDocumentState = 'draft' | 'created' | 'revised' | 'cancelled';

export type InvoicePaymentStatus =
  | 'unpaid'
  | 'pending_clearance'
  | 'partially_paid'
  | 'paid'
  | 'overdue';

export type LegacyInvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

export type PaymentAllocationStrategy = 'ledger_only' | 'oldest_invoice' | 'selected_invoice';

export type InvoiceLifecycleInput = {
  legacyStatus?: string | null;
  documentState?: string | null;
  paymentStatus?: string | null;
  dueDate?: string | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  pendingAmount?: number | null;
  today?: string;
};

export type InvoicePaymentDocumentStatusInput = {
  paymentStatus?: string | null;
  paymentStatusLine?: string | null;
  paymentStatusReason?: string | null;
};

export const INVOICE_DOCUMENT_STATES: InvoiceDocumentState[] = [
  'draft',
  'created',
  'revised',
  'cancelled',
];

export const INVOICE_PAYMENT_STATUSES: InvoicePaymentStatus[] = [
  'unpaid',
  'pending_clearance',
  'partially_paid',
  'paid',
  'overdue',
];

export const PAYMENT_ALLOCATION_STRATEGIES: PaymentAllocationStrategy[] = [
  'ledger_only',
  'oldest_invoice',
  'selected_invoice',
];

export function normalizeInvoiceDocumentState(value?: string | null): InvoiceDocumentState {
  if (value === 'created' || value === 'revised' || value === 'cancelled' || value === 'draft') {
    return value;
  }

  if (value === 'issued' || value === 'paid' || value === 'overdue') {
    return 'created';
  }

  return 'draft';
}

export function normalizeInvoicePaymentStatus(input: InvoiceLifecycleInput): InvoicePaymentStatus {
  const explicit = input.paymentStatus;
  if (
    explicit === 'unpaid' ||
    explicit === 'pending_clearance' ||
    explicit === 'partially_paid' ||
    explicit === 'paid' ||
    explicit === 'overdue'
  ) {
    return explicit;
  }

  if (input.legacyStatus === 'paid') {
    return 'paid';
  }

  if (input.legacyStatus === 'overdue') {
    return 'overdue';
  }

  return deriveInvoicePaymentStatus(input);
}

export function deriveInvoicePaymentStatus(input: InvoiceLifecycleInput): InvoicePaymentStatus {
  const total = Math.max(Number(input.totalAmount ?? 0), 0);
  const paid = Math.max(Number(input.paidAmount ?? 0), 0);
  const pending = Math.max(Number(input.pendingAmount ?? 0), 0);

  if (total > 0 && paid >= total) {
    return 'paid';
  }

  if (paid > 0 && paid < total) {
    return 'partially_paid';
  }

  if (pending > 0) {
    return 'pending_clearance';
  }

  if (input.dueDate && input.dueDate < (input.today ?? todayDate())) {
    return 'overdue';
  }

  return 'unpaid';
}

export function legacyStatusForInvoiceLifecycle(
  documentState: InvoiceDocumentState,
  paymentStatus: InvoicePaymentStatus
): LegacyInvoiceStatus {
  if (documentState === 'draft') {
    return 'draft';
  }

  if (documentState === 'cancelled') {
    return 'cancelled';
  }

  if (paymentStatus === 'paid') {
    return 'paid';
  }

  if (paymentStatus === 'overdue') {
    return 'overdue';
  }

  return 'issued';
}

export function getInvoiceDocumentStateLabel(state: InvoiceDocumentState): string {
  switch (state) {
    case 'created':
      return 'Created';
    case 'revised':
      return 'Revised';
    case 'cancelled':
      return 'Cancelled';
    case 'draft':
    default:
      return 'Draft';
  }
}

export function getInvoicePaymentStatusLabel(status: InvoicePaymentStatus): string {
  switch (status) {
    case 'partially_paid':
      return 'Partially paid';
    case 'paid':
      return 'Paid';
    case 'pending_clearance':
      return 'Pending clearance';
    case 'overdue':
      return 'Overdue';
    case 'unpaid':
    default:
      return 'Unpaid';
  }
}

export function getInvoicePaymentDocumentStatusLine(input: InvoicePaymentDocumentStatusInput): string | null {
  const status = normalizeInvoicePaymentStatus({ paymentStatus: input.paymentStatus });
  const statusLine = clean(input.paymentStatusLine);
  const reason = clean(input.paymentStatusReason);

  if (status === 'paid') {
    return statusLine && !startsWithUnpaid(statusLine) ? statusLine : null;
  }

  if (statusLine) {
    if (startsWithPaid(statusLine)) {
      return reason ? `Unpaid - ${stripPaymentPrefix(reason)}` : null;
    }
    return statusLine;
  }

  return reason ? `Unpaid - ${stripPaymentPrefix(reason)}` : null;
}

export function getGeneratedInvoiceDocumentLabel(state: InvoiceDocumentState): string {
  if (state === 'draft') {
    return 'Working copy';
  }

  return getInvoiceDocumentStateLabel(state);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function clean(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function startsWithUnpaid(value: string): boolean {
  return /^unpaid\b/i.test(value.trim());
}

function startsWithPaid(value: string): boolean {
  return /^paid\b/i.test(value.trim());
}

function stripPaymentPrefix(value: string): string {
  return value.replace(/^(unpaid|paid)\s*[-:]\s*/i, '').trim();
}
