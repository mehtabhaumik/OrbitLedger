import type { CustomerHealthRank } from './customerHealth';

export type CustomerTrustMemoryCategory =
  | 'money'
  | 'documents'
  | 'reminders'
  | 'promises'
  | 'notes'
  | 'disputes';

export type CustomerTrustMemoryFilter = CustomerTrustMemoryCategory | 'all';

export type CustomerTrustMemoryTone = 'success' | 'primary' | 'warning' | 'danger' | 'neutral';

export type CustomerTrustMemoryEvent = {
  id: string;
  category: CustomerTrustMemoryCategory;
  occurredAt: string;
  title: string;
  detail: string;
  meta: string;
  tone: CustomerTrustMemoryTone;
};

export type CustomerTrustMemorySummaryCard = {
  id:
    | 'current_balance'
    | 'payment_behavior'
    | 'promise_memory'
    | 'relationship_notes'
    | 'document_history';
  label: string;
  value: string;
  helper: string;
  tone: CustomerTrustMemoryTone;
};

export type CustomerTrustMemoryMoneyEvent = {
  id: string;
  type: 'credit' | 'payment';
  amount: number;
  occurredAt: string;
  note?: string | null;
  paymentModeLabel?: string | null;
};

export type CustomerTrustMemoryInvoiceEvent = {
  id: string;
  invoiceNumber: string;
  amount: number;
  occurredAt: string;
  documentState?: string | null;
  paymentState?: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'pending_clearance' | string | null;
  notes?: string | null;
};

export type CustomerTrustMemoryDocumentEvent = {
  id: string;
  kind: 'invoice' | 'statement' | 'profile' | 'notice' | 'other';
  fileName: string;
  occurredAt: string;
  pageCount?: number | null;
};

export type CustomerTrustMemoryReminderEvent = {
  id: string;
  tone: 'polite' | 'firm' | 'final' | string;
  message?: string | null;
  balanceAtSend?: number | null;
  occurredAt: string;
  sharedVia?: string | null;
};

export type CustomerTrustMemoryPromiseEvent = {
  id: string;
  amount: number;
  promisedDate: string;
  status: 'open' | 'fulfilled' | 'missed' | 'cancelled' | string;
  occurredAt: string;
  note?: string | null;
};

export type CustomerTrustMemoryNoteEvent = {
  id: string;
  kind: 'note' | 'dispute';
  body: string;
  occurredAt: string;
};

export type CustomerTrustMemoryInput = {
  customerName: string;
  currency?: string | null;
  currentBalance?: number | null;
  healthRank?: CustomerHealthRank | null;
  healthLabel?: string | null;
  totalCredit?: number | null;
  totalPayment?: number | null;
  lastPaymentAt?: string | null;
  today?: string | null;
  moneyEvents?: CustomerTrustMemoryMoneyEvent[];
  invoiceEvents?: CustomerTrustMemoryInvoiceEvent[];
  documentEvents?: CustomerTrustMemoryDocumentEvent[];
  reminderEvents?: CustomerTrustMemoryReminderEvent[];
  promiseEvents?: CustomerTrustMemoryPromiseEvent[];
  noteEvents?: CustomerTrustMemoryNoteEvent[];
};

export type CustomerTrustMemoryOutput = {
  title: string;
  summary: string;
  summaryCards: CustomerTrustMemorySummaryCard[];
  timeline: CustomerTrustMemoryEvent[];
  filters: Array<{
    id: CustomerTrustMemoryFilter;
    label: string;
    count: number;
  }>;
  emptyState: boolean;
};

export type CustomerTrustMemorySurfaceBlueprint = {
  area: string;
  label: string;
  userPromise: string;
  requiredData: string[];
};

export const CUSTOMER_TRUST_MEMORY_SURFACES: CustomerTrustMemorySurfaceBlueprint[] = [
  surface('relationship_summary', 'Relationship summary', 'Show the customer relationship at a glance.', [
    'current balance',
    'customer health',
    'last payment',
    'open promise count',
  ]),
  surface('memory_timeline', 'Memory timeline', 'Show what happened without making the owner search across screens.', [
    'money events',
    'invoice events',
    'reminders',
    'promises',
    'notes',
    'documents',
  ]),
  surface('trust_signals', 'Trust signals', 'Highlight promises, disputes, and payment behavior clearly.', [
    'missed promises',
    'dispute notes',
    'payment ratio',
    'overdue invoices',
  ]),
  surface('action_context', 'Action context', 'Give the owner enough context before calling, messaging, or extending credit.', [
    'last reminder',
    'last payment',
    'latest document',
    'latest note',
  ]),
];

export function buildCustomerTrustMemory(input: CustomerTrustMemoryInput): CustomerTrustMemoryOutput {
  const currency = normalizeCurrency(input.currency);
  const today = normalizeDate(input.today);
  const timeline = [
    ...(input.moneyEvents ?? []).map((event) => moneyEvent(event, currency)),
    ...(input.invoiceEvents ?? []).map((event) => invoiceEvent(event, currency)),
    ...(input.documentEvents ?? []).map(documentEvent),
    ...(input.reminderEvents ?? []).map((event) => reminderEvent(event, currency)),
    ...(input.promiseEvents ?? []).map((event) => promiseEvent(event, currency, today)),
    ...(input.noteEvents ?? []).map(noteEvent),
  ].sort(sortTrustEvents);

  const summaryCards = buildSummaryCards(input, currency, today);
  return {
    title: `${input.customerName} memory`,
    summary: buildSummary(input, timeline, today),
    summaryCards,
    timeline,
    filters: buildFilters(timeline),
    emptyState: timeline.length === 0,
  };
}

export function filterCustomerTrustMemory(
  events: CustomerTrustMemoryEvent[],
  filter: CustomerTrustMemoryFilter
): CustomerTrustMemoryEvent[] {
  if (filter === 'all') {
    return events;
  }
  return events.filter((event) => event.category === filter);
}

function buildSummaryCards(
  input: CustomerTrustMemoryInput,
  currency: string,
  today: string
): CustomerTrustMemorySummaryCard[] {
  const balance = amount(input.currentBalance);
  const totalCredit = amount(input.totalCredit);
  const totalPayment = amount(input.totalPayment);
  const paymentRatio = totalCredit > 0 ? totalPayment / totalCredit : balance <= 0 ? 1 : 0;
  const promises = input.promiseEvents ?? [];
  const missedPromises = promises.filter(
    (promise) => promise.status === 'missed' || (promise.status === 'open' && promise.promisedDate < today)
  ).length;
  const openPromises = promises.filter((promise) => promise.status === 'open' && promise.promisedDate >= today).length;
  const disputes = (input.noteEvents ?? []).filter((note) => note.kind === 'dispute').length;
  const documents = (input.invoiceEvents?.length ?? 0) + (input.documentEvents?.length ?? 0);

  return [
    {
      id: 'current_balance',
      label: 'Current balance',
      value: formatMoney(balance, currency),
      helper: balance > 0 ? 'Amount still pending from this customer.' : 'No pending balance right now.',
      tone: balance > 0 ? 'warning' : 'success',
    },
    {
      id: 'payment_behavior',
      label: 'Payment behavior',
      value: input.healthLabel?.trim() || labelHealth(input.healthRank),
      helper:
        input.lastPaymentAt
          ? `Last payment on ${input.lastPaymentAt.slice(0, 10)}.`
          : paymentRatio >= 1
            ? 'Payments are keeping up with credit.'
            : 'No payment is recorded yet.',
      tone: toneForHealth(input.healthRank, paymentRatio),
    },
    {
      id: 'promise_memory',
      label: 'Promise memory',
      value: missedPromises > 0 ? `${missedPromises} missed` : `${openPromises} open`,
      helper:
        missedPromises > 0
          ? 'Review missed promises before extending more credit.'
          : openPromises > 0
            ? 'Upcoming payment promises are being tracked.'
            : 'No open promises on record.',
      tone: missedPromises > 0 ? 'danger' : openPromises > 0 ? 'primary' : 'success',
    },
    {
      id: 'relationship_notes',
      label: 'Notes and disputes',
      value: disputes > 0 ? `${disputes} dispute${plural(disputes)}` : `${input.noteEvents?.length ?? 0} notes`,
      helper: disputes > 0 ? 'Resolve dispute context before follow-up.' : 'Important notes stay in customer memory.',
      tone: disputes > 0 ? 'danger' : 'neutral',
    },
    {
      id: 'document_history',
      label: 'Documents',
      value: String(documents),
      helper: documents > 0 ? 'Invoices, statements, and saved documents are visible here.' : 'No documents yet.',
      tone: documents > 0 ? 'primary' : 'neutral',
    },
  ];
}

function buildSummary(input: CustomerTrustMemoryInput, events: CustomerTrustMemoryEvent[], today: string): string {
  if (!events.length) {
    return 'No customer history is recorded yet.';
  }
  const missedPromises = (input.promiseEvents ?? []).filter(
    (promise) => promise.status === 'missed' || (promise.status === 'open' && promise.promisedDate < today)
  ).length;
  const disputes = (input.noteEvents ?? []).filter((note) => note.kind === 'dispute').length;
  if (missedPromises > 0 || disputes > 0) {
    return 'Review promises and disputes before the next collection action.';
  }
  const balance = amount(input.currentBalance);
  if (balance > 0) {
    return 'Review payment history, reminders, and documents before follow-up.';
  }
  return 'Customer history is clear and ready for review.';
}

function moneyEvent(event: CustomerTrustMemoryMoneyEvent, currency: string): CustomerTrustMemoryEvent {
  const isPayment = event.type === 'payment';
  return {
    id: `money:${event.id}`,
    category: 'money',
    occurredAt: event.occurredAt,
    title: isPayment ? 'Payment recorded' : 'Credit added',
    detail: event.note || (isPayment ? 'Payment entry saved.' : 'Credit entry saved.'),
    meta: event.paymentModeLabel
      ? `${formatMoney(event.amount, currency)} · ${event.paymentModeLabel}`
      : formatMoney(event.amount, currency),
    tone: isPayment ? 'success' : 'warning',
  };
}

function invoiceEvent(event: CustomerTrustMemoryInvoiceEvent, currency: string): CustomerTrustMemoryEvent {
  const paymentState = event.paymentState ?? 'unpaid';
  return {
    id: `invoice:${event.id}`,
    category: 'documents',
    occurredAt: event.occurredAt,
    title: `Invoice ${event.invoiceNumber}`,
    detail: event.notes || `Invoice is ${labelPaymentState(paymentState)}.`,
    meta: formatMoney(event.amount, currency),
    tone: paymentState === 'paid' ? 'success' : paymentState === 'overdue' ? 'danger' : 'primary',
  };
}

function documentEvent(event: CustomerTrustMemoryDocumentEvent): CustomerTrustMemoryEvent {
  const pageCount = event.pageCount ?? 1;
  return {
    id: `document:${event.id}`,
    category: 'documents',
    occurredAt: event.occurredAt,
    title: labelDocumentKind(event.kind),
    detail: event.fileName,
    meta: `${pageCount} page${pageCount === 1 ? '' : 's'}`,
    tone: 'primary',
  };
}

function reminderEvent(event: CustomerTrustMemoryReminderEvent, currency: string): CustomerTrustMemoryEvent {
  const tone = event.tone === 'final' ? 'danger' : event.tone === 'firm' ? 'warning' : 'primary';
  return {
    id: `reminder:${event.id}`,
    category: 'reminders',
    occurredAt: event.occurredAt,
    title: `${labelReminderTone(event.tone)} reminder sent`,
    detail: event.message || 'Reminder was saved in customer history.',
    meta: event.balanceAtSend ? formatMoney(event.balanceAtSend, currency) : event.sharedVia || 'Reminder',
    tone,
  };
}

function promiseEvent(
  event: CustomerTrustMemoryPromiseEvent,
  currency: string,
  today: string
): CustomerTrustMemoryEvent {
  const missed = event.status === 'missed' || (event.status === 'open' && event.promisedDate < today);
  const dueToday = event.status === 'open' && event.promisedDate === today;
  return {
    id: `promise:${event.id}`,
    category: 'promises',
    occurredAt: event.occurredAt,
    title:
      event.status === 'fulfilled'
        ? 'Promise fulfilled'
        : missed
          ? 'Promise missed'
          : event.status === 'cancelled'
            ? 'Promise cancelled'
            : 'Promise recorded',
    detail: event.note || `Promised for ${event.promisedDate}.`,
    meta: `${dueToday ? 'Due today' : labelPromiseStatus(event.status, missed)} · ${formatMoney(event.amount, currency)}`,
    tone: event.status === 'fulfilled' ? 'success' : missed ? 'danger' : event.status === 'cancelled' ? 'neutral' : 'warning',
  };
}

function noteEvent(event: CustomerTrustMemoryNoteEvent): CustomerTrustMemoryEvent {
  const isDispute = event.kind === 'dispute';
  return {
    id: `${isDispute ? 'dispute' : 'note'}:${event.id}`,
    category: isDispute ? 'disputes' : 'notes',
    occurredAt: event.occurredAt,
    title: isDispute ? 'Dispute note' : 'Important note',
    detail: event.body,
    meta: event.occurredAt.slice(0, 10),
    tone: isDispute ? 'danger' : 'neutral',
  };
}

function buildFilters(events: CustomerTrustMemoryEvent[]) {
  const filters: CustomerTrustMemoryFilter[] = ['all', 'money', 'documents', 'reminders', 'promises', 'notes', 'disputes'];
  return filters.map((filter) => ({
    id: filter,
    label: labelFilter(filter),
    count: filter === 'all' ? events.length : events.filter((event) => event.category === filter).length,
  }));
}

function sortTrustEvents(left: CustomerTrustMemoryEvent, right: CustomerTrustMemoryEvent): number {
  return right.occurredAt.localeCompare(left.occurredAt) || categoryRank(left.category) - categoryRank(right.category);
}

function categoryRank(category: CustomerTrustMemoryCategory): number {
  const ranks: Record<CustomerTrustMemoryCategory, number> = {
    disputes: 0,
    notes: 1,
    promises: 2,
    reminders: 3,
    money: 4,
    documents: 5,
  };
  return ranks[category];
}

function labelFilter(filter: CustomerTrustMemoryFilter): string {
  if (filter === 'all') {
    return 'All';
  }
  if (filter === 'money') {
    return 'Money';
  }
  if (filter === 'documents') {
    return 'Documents';
  }
  if (filter === 'reminders') {
    return 'Reminders';
  }
  if (filter === 'promises') {
    return 'Promises';
  }
  if (filter === 'disputes') {
    return 'Disputes';
  }
  return 'Notes';
}

function labelHealth(rank?: CustomerHealthRank | null): string {
  if (rank === 'excellent') {
    return 'Excellent';
  }
  if (rank === 'reliable') {
    return 'Reliable';
  }
  if (rank === 'watch_closely') {
    return 'Watch closely';
  }
  if (rank === 'needs_follow_up') {
    return 'Needs follow-up';
  }
  if (rank === 'high_risk') {
    return 'High risk';
  }
  return 'Not enough history';
}

function toneForHealth(rank: CustomerHealthRank | null | undefined, paymentRatio: number): CustomerTrustMemoryTone {
  if (rank === 'high_risk' || paymentRatio < 0.35) {
    return 'danger';
  }
  if (rank === 'needs_follow_up' || rank === 'watch_closely') {
    return 'warning';
  }
  if (rank === 'excellent' || rank === 'reliable') {
    return 'success';
  }
  return 'neutral';
}

function labelPaymentState(value: string): string {
  return value.replace(/_/g, ' ');
}

function labelPromiseStatus(value: string, missed: boolean): string {
  if (missed) {
    return 'Missed';
  }
  if (value === 'fulfilled') {
    return 'Fulfilled';
  }
  if (value === 'cancelled') {
    return 'Cancelled';
  }
  return 'Open';
}

function labelReminderTone(value: string): string {
  if (value === 'final') {
    return 'Final';
  }
  if (value === 'firm') {
    return 'Firm';
  }
  return 'Polite';
}

function labelDocumentKind(kind: CustomerTrustMemoryDocumentEvent['kind']): string {
  if (kind === 'invoice') {
    return 'Invoice saved';
  }
  if (kind === 'statement') {
    return 'Statement saved';
  }
  if (kind === 'profile') {
    return 'Customer profile saved';
  }
  if (kind === 'notice') {
    return 'Payment notice saved';
  }
  return 'Document saved';
}

function normalizeDate(value?: string | null): string {
  const text = value?.slice(0, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

function normalizeCurrency(value?: string | null): string {
  return value && /^[A-Z]{3}$/.test(value) ? value : 'INR';
}

function amount(value?: number | null): number {
  return Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount(value));
}

function plural(value: number): string {
  return value === 1 ? '' : 's';
}

function surface(
  area: string,
  label: string,
  userPromise: string,
  requiredData: string[]
): CustomerTrustMemorySurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    requiredData,
  };
}
