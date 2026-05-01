import type { PaymentAllocationStrategy } from './invoiceLifecycle';
import { buildInvoicePaymentReference } from './paymentLinks';
import type { PaymentMode, PaymentModeDetails } from './paymentModes';

export type PaymentProviderSource =
  | 'upi'
  | 'payment_page'
  | 'bank_transfer'
  | 'card'
  | 'wallet'
  | 'other';

export type PaymentReconciliationStatus =
  | 'matched'
  | 'partial_match'
  | 'overpaid_match'
  | 'needs_review'
  | 'duplicate'
  | 'missing_reference'
  | 'no_match';

export type PaymentReconciliationInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName?: string | null;
  totalAmount: number;
  paidAmount: number;
  documentState?: string | null;
  paymentStatus?: string | null;
};

export type PaymentProviderReconciliationInput = {
  source: PaymentProviderSource;
  reference?: string | null;
  providerPaymentId?: string | null;
  amount?: number | null;
  currency?: string | null;
  payerName?: string | null;
  payerContact?: string | null;
  paidAt?: string | null;
  invoices: PaymentReconciliationInvoice[];
};

export type PaymentReconciliationDecision = {
  status: PaymentReconciliationStatus;
  confidence: 'high' | 'medium' | 'low';
  invoice: PaymentReconciliationInvoice | null;
  allocationStrategy: PaymentAllocationStrategy;
  allocationAmount: number;
  dueAmount: number;
  paymentMode: PaymentMode;
  paymentDetails: PaymentModeDetails;
  note: string;
  message: string;
};

export function normalizeProviderReference(value?: string | null): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function reconcileProviderPayment(
  input: PaymentProviderReconciliationInput
): PaymentReconciliationDecision {
  const rawReference = input.reference?.trim() || input.providerPaymentId?.trim() || '';
  const normalizedReference = normalizeProviderReference(rawReference);
  const amount = roundMoney(Math.max(Number(input.amount ?? 0), 0));
  const paymentMode = paymentModeForProvider(input.source);
  const paymentDetails = buildReconciliationPaymentDetails(input, rawReference);
  const baseNote = buildReconciliationNote(input, rawReference);

  if (!normalizedReference) {
    return decision({
      status: 'missing_reference',
      confidence: 'low',
      invoice: null,
      allocationAmount: 0,
      dueAmount: 0,
      paymentMode,
      paymentDetails,
      note: baseNote,
      message: 'Add the provider or bank reference to match this payment.',
    });
  }

  const candidateInvoices = input.invoices
    .filter((invoice) => invoice.documentState !== 'cancelled')
    .map((invoice) => ({
      ...invoice,
      dueAmount: roundMoney(Math.max(invoice.totalAmount - invoice.paidAmount, 0)),
    }));

  const scored = candidateInvoices
    .map((invoice) => {
      const invoiceNumber = normalizeProviderReference(invoice.invoiceNumber);
      const paymentReference = normalizeProviderReference(buildInvoicePaymentReference(invoice.invoiceNumber));
      const exactReference =
        normalizedReference === invoiceNumber || normalizedReference === paymentReference;
      const containsReference =
        !exactReference &&
        (normalizedReference.includes(invoiceNumber) ||
          normalizedReference.includes(paymentReference) ||
          invoiceNumber.includes(normalizedReference));
      const score = exactReference ? 100 : containsReference ? 70 : 0;
      return { invoice, exactReference, score };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || right.invoice.dueAmount - left.invoice.dueAmount);

  if (!scored.length) {
    return decision({
      status: 'no_match',
      confidence: 'low',
      invoice: null,
      allocationAmount: 0,
      dueAmount: 0,
      paymentMode,
      paymentDetails,
      note: baseNote,
      message: 'No open invoice matches this reference.',
    });
  }

  const match = scored[0];
  const dueAmount = match.invoice.dueAmount;
  const allocationAmount = amount > 0 ? roundMoney(Math.min(amount, dueAmount)) : dueAmount;
  const amountDelta = amount > 0 ? roundMoney(amount - dueAmount) : 0;
  const confidence = match.exactReference ? 'high' : 'medium';

  if (match.invoice.paymentStatus === 'paid' || dueAmount <= 0) {
    return decision({
      status: 'duplicate',
      confidence,
      invoice: match.invoice,
      allocationAmount: 0,
      dueAmount,
      paymentMode,
      paymentDetails,
      note: baseNote,
      message: 'This reference points to an invoice that is already paid.',
    });
  }

  if (amount <= 0) {
    return decision({
      status: 'needs_review',
      confidence,
      invoice: match.invoice,
      allocationAmount,
      dueAmount,
      paymentMode,
      paymentDetails,
      note: baseNote,
      message: `Matched ${match.invoice.invoiceNumber}. Confirm the amount before applying it.`,
    });
  }

  if (amountDelta === 0) {
    return decision({
      status: 'matched',
      confidence,
      invoice: match.invoice,
      allocationAmount,
      dueAmount,
      paymentMode,
      paymentDetails,
      note: baseNote,
      message: `Matched ${match.invoice.invoiceNumber}. This can be applied automatically.`,
    });
  }

  if (amountDelta < 0) {
    return decision({
      status: 'partial_match',
      confidence,
      invoice: match.invoice,
      allocationAmount,
      dueAmount,
      paymentMode,
      paymentDetails,
      note: `${baseNote} Partial payment against ${match.invoice.invoiceNumber}.`.trim(),
      message: `Matched ${match.invoice.invoiceNumber}. This will mark the invoice as partially paid.`,
    });
  }

  return decision({
    status: 'overpaid_match',
    confidence,
    invoice: match.invoice,
    allocationAmount,
    dueAmount,
    paymentMode,
    paymentDetails,
    note: `${baseNote} Extra amount should remain as customer advance.`.trim(),
    message: `Matched ${match.invoice.invoiceNumber}. Apply invoice due and keep the extra amount on the ledger.`,
  });
}

function decision(
  input: Omit<PaymentReconciliationDecision, 'allocationStrategy'>
): PaymentReconciliationDecision {
  return {
    ...input,
    allocationStrategy: input.invoice && input.allocationAmount > 0 ? 'selected_invoice' : 'ledger_only',
  };
}

function buildReconciliationPaymentDetails(
  input: PaymentProviderReconciliationInput,
  rawReference: string
): PaymentModeDetails {
  const referenceNumber = rawReference || input.providerPaymentId?.trim() || null;
  switch (input.source) {
    case 'upi':
      return {
        referenceNumber,
        upiId: input.payerContact?.includes('@') ? input.payerContact : null,
        provider: 'UPI',
      };
    case 'card':
      return {
        referenceNumber,
        cardLastFour: lastFourDigits(input.payerContact),
        provider: 'Card',
      };
    case 'wallet':
      return {
        referenceNumber,
        provider: input.payerName?.trim() || 'Wallet',
      };
    case 'payment_page':
      return {
        referenceNumber,
        provider: 'Payment page',
      };
    case 'bank_transfer':
      return {
        referenceNumber,
        bankName: input.payerName?.trim() || null,
      };
    case 'other':
    default:
      return {
        referenceNumber,
        provider: input.payerName?.trim() || null,
      };
  }
}

function buildReconciliationNote(input: PaymentProviderReconciliationInput, rawReference: string): string {
  const parts = [
    'Provider payment',
    rawReference ? `Ref ${rawReference}` : null,
    input.payerName?.trim() ? `from ${input.payerName.trim()}` : null,
  ].filter(Boolean);
  return parts.join(' ');
}

function paymentModeForProvider(source: PaymentProviderSource): PaymentMode {
  switch (source) {
    case 'upi':
      return 'upi';
    case 'card':
      return 'card';
    case 'wallet':
    case 'payment_page':
      return 'wallet';
    case 'bank_transfer':
      return 'bank_transfer';
    case 'other':
    default:
      return 'other';
  }
}

function lastFourDigits(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, '').slice(-4);
  return digits && digits.length === 4 ? digits : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
