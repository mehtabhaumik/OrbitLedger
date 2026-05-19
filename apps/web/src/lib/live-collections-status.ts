import type { WorkspaceInvoice, WorkspacePaymentProviderEvent } from './workspace-data';

export type LivePaymentLinkStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type LivePaymentLinkStatusState =
  | 'not_enabled'
  | 'waiting'
  | 'checkout_opened'
  | 'payment_initiated'
  | 'authorized'
  | 'received_verifying'
  | 'captured'
  | 'invoice_paid'
  | 'failed'
  | 'needs_review'
  | 'refunded';

export type LivePaymentLinkStatus = {
  state: LivePaymentLinkStatusState;
  title: string;
  label: string;
  helper: string;
  tone: LivePaymentLinkStatusTone;
  updatedAt: string | null;
  eventId: string | null;
};

export type BuildLivePaymentLinkStatusInput = {
  invoice: Pick<WorkspaceInvoice, 'id' | 'invoiceNumber' | 'paymentStatus' | 'paidAmount' | 'totalAmount'>;
  events?: WorkspacePaymentProviderEvent[];
  hasPaymentLink: boolean;
};

export function buildLivePaymentLinkStatus(input: BuildLivePaymentLinkStatusInput): LivePaymentLinkStatus {
  const matchingEvents = (input.events ?? [])
    .filter((event) => event.invoiceId === input.invoice.id)
    .sort((left, right) => (right.lastModified || right.createdAt).localeCompare(left.lastModified || left.createdAt));
  const latestEvent = matchingEvents[0] ?? null;
  const dueAmount = Math.max(input.invoice.totalAmount - input.invoice.paidAmount, 0);

  if (input.invoice.paymentStatus === 'paid' && dueAmount <= 0) {
    return {
      state: 'invoice_paid',
      title: 'Invoice marked paid',
      label: 'Paid',
      helper: latestEvent?.applied
        ? 'A verified payment event was applied to this invoice.'
        : 'This invoice is fully paid from saved payment allocation.',
      tone: 'success',
      updatedAt: latestEvent?.lastModified || latestEvent?.createdAt || null,
      eventId: latestEvent?.id ?? null,
    };
  }

  if (latestEvent) {
    return statusFromProviderEvent(latestEvent);
  }

  if (input.hasPaymentLink) {
    return {
      state: 'waiting',
      title: 'Waiting for payment',
      label: 'Live watch active',
      helper: 'Orbit Ledger will update this invoice after a verified backend payment event arrives.',
      tone: 'info',
      updatedAt: null,
      eventId: null,
    };
  }

  return {
    state: 'not_enabled',
    title: 'No online payment link',
    label: 'Manual collection',
    helper: 'Manual UPI or bank details can still be shown on this invoice.',
    tone: 'neutral',
    updatedAt: null,
    eventId: null,
  };
}

export function getLivePaymentLinkStatusRank(status: LivePaymentLinkStatus): number {
  switch (status.state) {
    case 'needs_review':
    case 'failed':
      return 1;
    case 'received_verifying':
    case 'authorized':
    case 'payment_initiated':
    case 'checkout_opened':
      return 2;
    case 'waiting':
      return 3;
    case 'invoice_paid':
    case 'captured':
      return 4;
    case 'refunded':
      return 5;
    case 'not_enabled':
    default:
      return 6;
  }
}

export function getLivePaymentLinkStatusChipTone(tone: LivePaymentLinkStatusTone): 'primary' | 'success' | 'warning' | 'tax' {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
    case 'danger':
      return 'warning';
    case 'info':
      return 'tax';
    case 'neutral':
    default:
      return 'primary';
  }
}

export function formatLivePaymentLinkStatusTime(value: string | null): string {
  if (!value) {
    return 'No event yet';
  }

  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusFromProviderEvent(event: WorkspacePaymentProviderEvent): LivePaymentLinkStatus {
  const status = normalizeEventStatus(event.status || event.applyStatus);
  const updatedAt = event.lastModified || event.createdAt || null;
  const base = {
    updatedAt,
    eventId: event.id,
  };

  if (event.reversed || event.refundedAmount > 0 || status === 'refunded' || status === 'partially_refunded') {
    return {
      ...base,
      state: 'refunded',
      title: event.refundedAmount > 0 ? 'Payment refund recorded' : 'Payment reversed',
      label: 'Refunded',
      helper: 'The invoice balance should be reviewed after this reversal or refund.',
      tone: 'warning',
    };
  }

  if (event.applied || status === 'captured' || status === 'cleared' || status === 'paid') {
    if (event.applied) {
      return {
        ...base,
        state: 'captured',
        title: 'Payment captured',
        label: 'Applied',
        helper: 'The verified payment event has been applied to this invoice.',
        tone: 'success',
      };
    }

    return {
      ...base,
      state: 'received_verifying',
      title: 'Payment received, verifying',
      label: 'Verifying',
      helper: 'A payment event was received and is waiting for backend reconciliation.',
      tone: 'info',
    };
  }

  if (event.error || status === 'failed' || status === 'errored' || status === 'cancelled') {
    return {
      ...base,
      state: 'failed',
      title: 'Payment failed',
      label: 'Failed',
      helper: 'The latest online payment attempt did not complete. Review before following up.',
      tone: 'danger',
    };
  }

  if (event.applyStatus === 'needs_review' || status === 'needs_review' || status === 'disputed') {
    return {
      ...base,
      state: 'needs_review',
      title: 'Payment needs review',
      label: 'Review',
      helper: 'A backend payment event needs manual review before it changes invoice balance.',
      tone: 'warning',
    };
  }

  if (status === 'authorized') {
    return {
      ...base,
      state: 'authorized',
      title: 'Payment authorized',
      label: 'Authorized',
      helper: 'The payment is authorized and waiting for capture or reconciliation.',
      tone: 'info',
    };
  }

  if (status === 'payment_initiated' || status === 'initiated') {
    return {
      ...base,
      state: 'payment_initiated',
      title: 'Payment initiated',
      label: 'Initiated',
      helper: 'The customer started the online payment flow.',
      tone: 'info',
    };
  }

  if (status === 'checkout_opened') {
    return {
      ...base,
      state: 'checkout_opened',
      title: 'Checkout opened',
      label: 'Customer opened link',
      helper: 'The payment link was opened. No money is recorded until backend verification succeeds.',
      tone: 'info',
    };
  }

  return {
    ...base,
    state: 'waiting',
    title: 'Waiting for payment',
    label: 'Live watch active',
    helper: 'No verified payment event has arrived for this invoice yet.',
    tone: 'info',
  };
}

function normalizeEventStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}
