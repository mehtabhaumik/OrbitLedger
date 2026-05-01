export type PaymentLinkDetails = {
  upiId?: string | null;
  paymentPageUrl?: string | null;
  paymentNote?: string | null;
};

export type InvoicePaymentLinkInput = {
  businessName: string;
  customerName?: string | null;
  amount: number;
  currency: string;
  countryCode?: string | null;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  details?: PaymentLinkDetails | null;
};

export type InvoicePaymentLink = {
  url: string;
  label: string;
  instruction: string;
  reference: string;
  provider: 'upi' | 'payment_page';
};

const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

export function normalizeUpiId(value?: string | null): string | null {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized && upiPattern.test(normalized) ? normalized : null;
}

export function normalizePaymentPageUrl(value?: string | null): string | null {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildInvoicePaymentReference(invoiceNumber?: string | null): string {
  const normalized = (invoiceNumber ?? '').trim().replace(/\s+/g, '-');
  return normalized ? `INV-${normalized}` : `INV-${Date.now()}`;
}

export function buildInvoicePaymentLink(input: InvoicePaymentLinkInput): InvoicePaymentLink | null {
  const details = input.details ?? {};
  const reference = buildInvoicePaymentReference(input.invoiceNumber);
  const amount = Math.max(Number.isFinite(input.amount) ? input.amount : 0, 0);
  const currency = (input.currency || 'INR').trim().toUpperCase();
  const isIndia = (input.countryCode ?? '').trim().toUpperCase() === 'IN';
  const upiId = normalizeUpiId(details.upiId);

  if (isIndia && upiId && currency === 'INR' && amount > 0) {
    const url = new URL('upi://pay');
    url.searchParams.set('pa', upiId);
    url.searchParams.set('pn', input.businessName.trim() || 'Orbit Ledger business');
    url.searchParams.set('am', roundAmount(amount));
    url.searchParams.set('cu', 'INR');
    url.searchParams.set('tn', buildPaymentNote(input, reference));
    return {
      url: url.toString(),
      label: 'Pay now with UPI',
      instruction: `Use UPI reference ${reference}.`,
      reference,
      provider: 'upi',
    };
  }

  const paymentPageUrl = normalizePaymentPageUrl(details.paymentPageUrl);
  if (paymentPageUrl) {
    const url = new URL(paymentPageUrl);
    url.searchParams.set('invoice', input.invoiceNumber ?? reference);
    url.searchParams.set('amount', roundAmount(amount));
    url.searchParams.set('currency', currency);
    url.searchParams.set('reference', reference);
    if (input.customerName) {
      url.searchParams.set('customer', input.customerName);
    }
    return {
      url: url.toString(),
      label: 'Pay now',
      instruction: `Use payment reference ${reference}.`,
      reference,
      provider: 'payment_page',
    };
  }

  return null;
}

export function appendPaymentLinkToMessage(message: string, link: InvoicePaymentLink | null): string {
  if (!link) {
    return message;
  }

  return `${message}\n\n${link.label}: ${link.url}\n${link.instruction}`;
}

function buildPaymentNote(input: InvoicePaymentLinkInput, reference: string): string {
  const explicitNote = input.details?.paymentNote?.trim();
  if (explicitNote) {
    return explicitNote;
  }
  return input.invoiceNumber ? `Invoice ${input.invoiceNumber} ${reference}` : reference;
}

function roundAmount(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
