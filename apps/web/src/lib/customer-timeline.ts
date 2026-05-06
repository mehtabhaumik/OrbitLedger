import type {
  WorkspaceCustomerTimelineNote,
  WorkspacePaymentPromise,
  WorkspacePaymentPromiseStatus,
  WorkspacePaymentReminder,
  WorkspaceTransaction,
} from './workspace-data';

export type CustomerTimelineEventKind = 'transaction' | 'note' | 'dispute' | 'promise' | 'reminder';
export type CustomerTimelineTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export type CustomerTimelineEvent = {
  id: string;
  kind: CustomerTimelineEventKind;
  title: string;
  detail: string;
  meta: string;
  occurredAt: string;
  tone: CustomerTimelineTone;
};

export function buildCustomerTimelineEvents(input: {
  transactions: WorkspaceTransaction[];
  notes: WorkspaceCustomerTimelineNote[];
  reminders: WorkspacePaymentReminder[];
  promises: WorkspacePaymentPromise[];
  today?: string;
  formatAmount(value: number): string;
}): CustomerTimelineEvent[] {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  return [
    ...input.transactions.map((transaction) => transactionToEvent(transaction, input.formatAmount)),
    ...input.notes.map(noteToEvent),
    ...input.reminders.map((reminder) => reminderToEvent(reminder, input.formatAmount)),
    ...input.promises.map((promise) => promiseToEvent(promise, today, input.formatAmount)),
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.title.localeCompare(right.title));
}

export function getPromiseStatusLabel(status: WorkspacePaymentPromiseStatus, promisedDate: string, today: string): string {
  if (status === 'fulfilled') {
    return 'Fulfilled';
  }
  if (status === 'missed') {
    return 'Missed';
  }
  if (status === 'cancelled') {
    return 'Cancelled';
  }
  if (promisedDate < today) {
    return 'Missed';
  }
  if (promisedDate === today) {
    return 'Due today';
  }
  return 'Open';
}

export function getPromiseTone(status: WorkspacePaymentPromiseStatus, promisedDate: string, today: string): CustomerTimelineTone {
  if (status === 'fulfilled') {
    return 'success';
  }
  if (status === 'cancelled') {
    return 'neutral';
  }
  if (status === 'missed' || promisedDate < today) {
    return 'danger';
  }
  if (promisedDate === today) {
    return 'warning';
  }
  return 'primary';
}

export function buildReminderMessage(input: {
  businessName: string;
  customerName: string;
  balanceLabel: string;
  tone: 'polite' | 'firm' | 'final';
}): string {
  if (input.tone === 'final') {
    return `Hello ${input.customerName}, this is an urgent payment reminder from ${input.businessName}. The pending balance is ${input.balanceLabel}. Please clear it as soon as possible.`;
  }
  if (input.tone === 'firm') {
    return `Hello ${input.customerName}, this is a payment follow-up from ${input.businessName}. The pending balance is ${input.balanceLabel}. Please share the payment update today.`;
  }
  return `Hello ${input.customerName}, this is a gentle reminder from ${input.businessName}. The pending balance is ${input.balanceLabel}. Please send the payment update when convenient.`;
}

function transactionToEvent(
  transaction: WorkspaceTransaction,
  formatAmount: (value: number) => string
): CustomerTimelineEvent {
  const isPayment = transaction.type === 'payment';
  return {
    id: `transaction-${transaction.id}`,
    kind: 'transaction',
    title: isPayment ? 'Payment recorded' : 'Credit added',
    detail: transaction.note || (isPayment ? 'Payment entry recorded.' : 'Credit entry recorded.'),
    meta: formatAmount(transaction.amount),
    occurredAt: transaction.createdAt || transaction.effectiveDate,
    tone: isPayment ? 'success' : 'warning',
  };
}

function noteToEvent(note: WorkspaceCustomerTimelineNote): CustomerTimelineEvent {
  return {
    id: `note-${note.id}`,
    kind: note.kind,
    title: note.kind === 'dispute' ? 'Dispute note' : 'Customer note',
    detail: note.body,
    meta: note.kind === 'dispute' ? 'Needs review' : 'Note',
    occurredAt: note.createdAt,
    tone: note.kind === 'dispute' ? 'danger' : 'neutral',
  };
}

function reminderToEvent(
  reminder: WorkspacePaymentReminder,
  formatAmount: (value: number) => string
): CustomerTimelineEvent {
  return {
    id: `reminder-${reminder.id}`,
    kind: 'reminder',
    title: `${capitalize(reminder.tone)} reminder`,
    detail: reminder.message,
    meta: formatAmount(reminder.balanceAtSend),
    occurredAt: reminder.createdAt,
    tone: reminder.tone === 'final' ? 'danger' : reminder.tone === 'firm' ? 'warning' : 'primary',
  };
}

function promiseToEvent(
  promise: WorkspacePaymentPromise,
  today: string,
  formatAmount: (value: number) => string
): CustomerTimelineEvent {
  return {
    id: `promise-${promise.id}`,
    kind: 'promise',
    title: 'Payment promise',
    detail: promise.note || `Promised for ${promise.promisedDate}.`,
    meta: `${getPromiseStatusLabel(promise.status, promise.promisedDate, today)} · ${formatAmount(promise.promisedAmount)}`,
    occurredAt: promise.updatedAt || promise.createdAt,
    tone: getPromiseTone(promise.status, promise.promisedDate, today),
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
