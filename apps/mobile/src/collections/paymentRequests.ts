import { formatCurrency, formatShortDate } from '../lib/format';

export type PaymentShareDetails = {
  upiId?: string | null;
  paymentNote?: string | null;
};

export type PaymentRequestKind = 'reminder' | 'invoice' | 'statement';

export type PaymentRequestMessageInput = {
  kind: PaymentRequestKind;
  businessName: string;
  customerName: string;
  amount: number;
  currency: string;
  countryCode?: string | null;
  invoiceNumber?: string | null;
  statementDate?: string | null;
  dueDate?: string | null;
  paymentDetails?: PaymentShareDetails | null;
};

export type PaymentRequestShareResult = {
  shared: boolean;
  sharedVia: string | null;
};

const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

export function normalizeUpiId(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return upiPattern.test(normalized) ? normalized : null;
}

export function formatPaymentDetailsLine(
  paymentDetails: PaymentShareDetails | null | undefined,
  countryCode?: string | null
): string | null {
  const upiId = normalizeUpiId(paymentDetails?.upiId);
  const note = (paymentDetails?.paymentNote ?? '').trim();
  const isIndia = (countryCode ?? '').trim().toUpperCase() === 'IN';
  const parts: string[] = [];

  if (isIndia && upiId) {
    parts.push(`UPI: ${upiId}`);
  }
  if (note) {
    parts.push(note);
  }

  return parts.length ? `Payment details: ${parts.join(' · ')}` : null;
}

export function buildPaymentRequestMessage(input: PaymentRequestMessageInput): string {
  const amount = formatCurrency(Math.max(input.amount, 0), input.currency);
  const detailsLine = formatPaymentDetailsLine(input.paymentDetails, input.countryCode);
  const titleLine = buildTitleLine(input, amount);
  const dueLine = input.dueDate ? `Due date: ${formatShortDate(input.dueDate)}.` : null;

  return [
    `Hi ${input.customerName},`,
    '',
    titleLine,
    dueLine,
    detailsLine,
    'Please reply after sending the payment. I will mark it received once I confirm it.',
    '',
    `Thank you,\n${input.businessName}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sharePaymentRequestMessage(
  message: string
): Promise<PaymentRequestShareResult> {
  const { Share } = await import('react-native');
  const result = await Share.share({
    message,
    title: 'Payment request',
  });

  const shared =
    result.action === Share.sharedAction ||
    (result.action !== Share.dismissedAction && result.action !== undefined);

  return {
    shared,
    sharedVia: result.activityType ?? (shared ? 'system_share_sheet' : null),
  };
}

function buildTitleLine(input: PaymentRequestMessageInput, amount: string): string {
  if (input.kind === 'invoice') {
    return `Please find the payment request for invoice ${input.invoiceNumber ?? ''}. Amount due: ${amount}.`;
  }

  if (input.kind === 'statement') {
    const statementLabel = input.statementDate ? ` dated ${formatShortDate(input.statementDate)}` : '';
    return `Please find the account statement${statementLabel}. Current amount due: ${amount}.`;
  }

  return `Your pending balance with ${input.businessName} is ${amount}.`;
}
