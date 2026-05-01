export type RazorpayPaymentLinkDraftInput = {
  workspaceId: string;
  businessName: string;
  invoiceId?: string | null;
  invoiceNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl?: string | null;
};

export type RazorpayPaymentLinkDraft = {
  amount: number;
  currency: string;
  accept_partial: boolean;
  description: string;
  reference_id: string;
  customer?: {
    name: string;
  };
  notify: {
    sms: boolean;
    email: boolean;
  };
  reminder_enable: boolean;
  callback_url?: string;
  callback_method?: 'get';
  notes: Record<string, string>;
};

const RAZORPAY_REFERENCE_LIMIT = 40;
const RAZORPAY_NOTE_LIMIT = 255;

export function buildRazorpayNotes(input: RazorpayPaymentLinkDraftInput): Record<string, string> {
  const notes: Record<string, string> = {
    orbit_workspace_id: trimNote(input.workspaceId),
    orbit_invoice_number: trimNote(input.invoiceNumber),
  };

  if (input.invoiceId?.trim()) {
    notes.orbit_invoice_id = trimNote(input.invoiceId);
  }

  if (input.customerId?.trim()) {
    notes.orbit_customer_id = trimNote(input.customerId);
  }

  if (input.customerName?.trim()) {
    notes.orbit_customer_name = trimNote(input.customerName);
  }

  return notes;
}

export function buildRazorpayPaymentLinkDraft(input: RazorpayPaymentLinkDraftInput): RazorpayPaymentLinkDraft {
  const amount = Math.max(Number.isFinite(input.amount) ? input.amount : 0, 0);
  const currency = (input.currency || 'INR').trim().toUpperCase();
  const description = `${input.businessName.trim() || 'Orbit Ledger'} invoice ${input.invoiceNumber}`;
  const callbackUrl = normalizeHttpsUrl(input.callbackUrl);

  return {
    amount: Math.round(amount * 100),
    currency,
    accept_partial: false,
    description,
    reference_id: trimReference(input.reference || input.invoiceNumber),
    customer: input.customerName?.trim() ? { name: input.customerName.trim() } : undefined,
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: true,
    ...(callbackUrl ? { callback_url: callbackUrl, callback_method: 'get' as const } : {}),
    notes: buildRazorpayNotes(input),
  };
}

function trimReference(value: string): string {
  const normalized = value.trim().replace(/\s+/g, '-');
  return (normalized || `INV-${Date.now()}`).slice(0, RAZORPAY_REFERENCE_LIMIT);
}

function trimNote(value: string): string {
  return value.trim().slice(0, RAZORPAY_NOTE_LIMIT);
}

function normalizeHttpsUrl(value?: string | null): string | null {
  const normalized = value?.trim();
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
