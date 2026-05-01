import type { GeneratedDocumentHistoryEntry } from '../documents';
import type {
  CustomerTimelineNote,
  Invoice,
  LedgerTransaction,
  PaymentPromise,
  PaymentReminder,
} from '../database';
import { formatCurrency, formatShortDate, formatTransactionType } from '../lib/format';

export type CustomerTrustTimelineFilter =
  | 'all'
  | 'money'
  | 'documents'
  | 'reminders'
  | 'promises'
  | 'notes';

export type CustomerTrustTimelineCategory =
  | 'money'
  | 'documents'
  | 'reminders'
  | 'promises'
  | 'notes';

export type CustomerTrustTimelineEvent = {
  id: string;
  category: CustomerTrustTimelineCategory;
  occurredAt: string;
  title: string;
  detail: string;
  meta: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
};

export type BuildCustomerTrustTimelineInput = {
  currency: string;
  customerName: string;
  documents?: GeneratedDocumentHistoryEntry[];
  invoices: Invoice[];
  notes: CustomerTimelineNote[];
  promises: PaymentPromise[];
  reminders: PaymentReminder[];
  transactions: LedgerTransaction[];
};

export function buildCustomerTrustTimeline(
  input: BuildCustomerTrustTimelineInput
): CustomerTrustTimelineEvent[] {
  const events: CustomerTrustTimelineEvent[] = [
    ...input.transactions.map((transaction) => transactionEvent(transaction, input.currency)),
    ...input.invoices.map((invoice) => invoiceEvent(invoice, input.currency)),
    ...input.reminders.map((reminder) => reminderEvent(reminder, input.currency)),
    ...input.promises.map((promise) => promiseEvent(promise, input.currency)),
    ...input.notes.map(noteEvent),
    ...(input.documents ?? [])
      .filter((document) => namesMatch(document.customerName, input.customerName))
      .map(documentEvent),
  ];

  return events.sort((left, right) => {
    const dateDelta = right.occurredAt.localeCompare(left.occurredAt);
    if (dateDelta !== 0) {
      return dateDelta;
    }

    return categoryRank(left.category) - categoryRank(right.category);
  });
}

export function filterCustomerTrustTimeline(
  events: CustomerTrustTimelineEvent[],
  filter: CustomerTrustTimelineFilter
): CustomerTrustTimelineEvent[] {
  if (filter === 'all') {
    return events;
  }

  return events.filter((event) => event.category === filter);
}

function transactionEvent(
  transaction: LedgerTransaction,
  currency: string
): CustomerTrustTimelineEvent {
  const isPayment = transaction.type === 'payment';

  return {
    id: `transaction:${transaction.id}`,
    category: 'money',
    occurredAt: `${transaction.effectiveDate}T00:00:00.000Z`,
    title: isPayment ? 'Payment received' : 'Credit given',
    detail: transaction.note ?? `${formatTransactionType(transaction.type)} entry saved.`,
    meta: formatCurrency(transaction.amount, currency),
    tone: isPayment ? 'success' : 'warning',
  };
}

function invoiceEvent(invoice: Invoice, currency: string): CustomerTrustTimelineEvent {
  return {
    id: `invoice:${invoice.id}`,
    category: 'documents',
    occurredAt: `${invoice.issueDate}T00:00:00.000Z`,
    title: `Invoice ${invoice.invoiceNumber}`,
    detail: invoice.notes ?? `Invoice is ${formatInvoiceStatus(invoice.status)}.`,
    meta: formatCurrency(invoice.totalAmount, currency),
    tone: invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'danger' : 'primary',
  };
}

function reminderEvent(
  reminder: PaymentReminder,
  currency: string
): CustomerTrustTimelineEvent {
  return {
    id: `reminder:${reminder.id}`,
    category: 'reminders',
    occurredAt: reminder.createdAt,
    title: `${formatReminderTone(reminder.tone)} reminder sent`,
    detail: 'Reminder was saved in customer history.',
    meta: formatCurrency(reminder.balanceAtSend, currency),
    tone: reminder.tone === 'final' ? 'danger' : reminder.tone === 'firm' ? 'warning' : 'primary',
  };
}

function promiseEvent(promise: PaymentPromise, currency: string): CustomerTrustTimelineEvent {
  return {
    id: `promise:${promise.id}`,
    category: 'promises',
    occurredAt: promise.updatedAt,
    title: formatPromiseTitle(promise),
    detail: promise.note ?? `Promised for ${formatShortDate(promise.promisedDate)}.`,
    meta: formatCurrency(promise.promisedAmount, currency),
    tone:
      promise.status === 'fulfilled'
        ? 'success'
        : promise.status === 'missed'
          ? 'danger'
          : promise.status === 'cancelled'
            ? 'neutral'
            : 'warning',
  };
}

function noteEvent(note: CustomerTimelineNote): CustomerTrustTimelineEvent {
  return {
    id: `note:${note.id}`,
    category: 'notes',
    occurredAt: note.createdAt,
    title: note.kind === 'dispute' ? 'Dispute note' : 'Important note',
    detail: note.body,
    meta: formatShortDate(note.createdAt),
    tone: note.kind === 'dispute' ? 'danger' : 'neutral',
  };
}

function documentEvent(document: GeneratedDocumentHistoryEntry): CustomerTrustTimelineEvent {
  return {
    id: `document:${document.id}`,
    category: 'documents',
    occurredAt: document.createdAt,
    title: document.documentKind === 'invoice' ? 'Invoice PDF saved' : 'Statement saved',
    detail: document.fileName,
    meta: `${document.numberOfPages} page${document.numberOfPages === 1 ? '' : 's'}`,
    tone: 'primary',
  };
}

function formatInvoiceStatus(status: Invoice['status']): string {
  if (status === 'draft') {
    return 'draft';
  }

  if (status === 'issued') {
    return 'issued';
  }

  if (status === 'paid') {
    return 'paid';
  }

  if (status === 'overdue') {
    return 'overdue';
  }

  return 'cancelled';
}

function formatReminderTone(tone: PaymentReminder['tone']): string {
  if (tone === 'final') {
    return 'Final';
  }

  if (tone === 'firm') {
    return 'Firm';
  }

  return 'Polite';
}

function formatPromiseTitle(promise: PaymentPromise): string {
  if (promise.status === 'fulfilled') {
    return 'Promise fulfilled';
  }

  if (promise.status === 'missed') {
    return 'Promise missed';
  }

  if (promise.status === 'cancelled') {
    return 'Promise cancelled';
  }

  return 'Promise recorded';
}

function categoryRank(category: CustomerTrustTimelineCategory): number {
  const ranks: Record<CustomerTrustTimelineCategory, number> = {
    notes: 0,
    promises: 1,
    reminders: 2,
    money: 3,
    documents: 4,
  };

  return ranks[category];
}

function namesMatch(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
