import type { CustomerHealthRank } from './customerHealth';

export type CollectionCoachPriority = 'critical' | 'high' | 'normal' | 'watch';
export type CollectionCoachTone = 'danger' | 'warning' | 'primary' | 'success';
export type CollectionCoachReminderTone = 'soft' | 'firm' | 'urgent';

export type CollectionCoachActionTarget =
  | 'call_customer'
  | 'send_reminder'
  | 'send_statement'
  | 'record_payment'
  | 'add_payment_promise'
  | 'review_customer';

export type CollectionCoachAction = {
  label: string;
  target: CollectionCoachActionTarget;
};

export type CollectionCoachPromiseSignal = {
  amount?: number | null;
  promisedDate?: string | null;
  status?: 'open' | 'fulfilled' | 'missed' | 'cancelled' | null;
};

export type CollectionCoachCustomerSignal = {
  id: string;
  name: string;
  balance: number;
  daysOutstanding?: number | null;
  lastPaymentAt?: string | null;
  lastReminderAt?: string | null;
  lastPromise?: CollectionCoachPromiseSignal | null;
  brokenPromiseCount?: number | null;
  overdueInvoiceCount?: number | null;
  remindersSentCount?: number | null;
  totalBusiness?: number | null;
  healthRank?: CustomerHealthRank | null;
};

export type CollectionCoachInput = {
  businessName?: string | null;
  currency?: string | null;
  today?: string | null;
  customers: CollectionCoachCustomerSignal[];
};

export type CollectionCoachRecommendation = {
  id: string;
  customerId: string;
  customerName: string;
  balanceLabel: string;
  score: number;
  priority: CollectionCoachPriority;
  tone: CollectionCoachTone;
  title: string;
  reason: string;
  helper: string;
  nextAction: CollectionCoachAction;
  reminderTone: CollectionCoachReminderTone;
  suggestedMessage: string;
  followUpDate: string;
};

export type CollectionCoachOutput = {
  title: string;
  summary: string;
  emptyState: boolean;
  topRecommendation: CollectionCoachRecommendation | null;
  recommendations: CollectionCoachRecommendation[];
};

export type CollectionCoachSurfaceBlueprint = {
  area: string;
  label: string;
  userPromise: string;
  requiredData: string[];
};

export const COLLECTION_COACH_SURFACES: CollectionCoachSurfaceBlueprint[] = [
  surface('priority_queue', 'Priority queue', 'Show who should be contacted first and why.', [
    'customer balance',
    'days outstanding',
    'health rank',
    'invoice overdue count',
  ]),
  surface('promise_tracking', 'Promise tracking', 'Keep promise-to-pay dates from becoming memory work.', [
    'promise amount',
    'promise date',
    'promise status',
    'broken promise count',
  ]),
  surface('reminder_guidance', 'Reminder guidance', 'Suggest a tone and message without sounding harsh by default.', [
    'last reminder date',
    'reminders sent count',
    'balance label',
    'business name',
  ]),
  surface('next_action', 'Next action', 'Recommend call, reminder, statement, payment record, or promise capture.', [
    'priority score',
    'risk reason',
    'customer contact context',
  ]),
];

export function buildCollectionCoach(input: CollectionCoachInput): CollectionCoachOutput {
  const today = normalizeDate(input.today);
  const currency = normalizeCurrency(input.currency);
  const businessName = input.businessName?.trim() || 'Orbit Ledger';
  const recommendations = input.customers
    .filter((customer) => customer.balance > 0 || hasOpenPromise(customer.lastPromise, today))
    .map((customer) => buildRecommendation(customer, { businessName, currency, today }))
    .filter((recommendation) => recommendation.score > 0)
    .sort((left, right) => right.score - left.score || left.customerName.localeCompare(right.customerName));

  if (!recommendations.length) {
    return {
      title: 'Collection coach',
      summary: 'No customer needs collection follow-up right now.',
      emptyState: true,
      topRecommendation: null,
      recommendations: [],
    };
  }

  const urgentCount = recommendations.filter((recommendation) => recommendation.priority === 'critical').length;
  return {
    title: 'Collection coach',
    summary:
      urgentCount > 0
        ? `${urgentCount} customer${plural(urgentCount)} should be contacted first.`
        : `${recommendations.length} customer${plural(recommendations.length)} are ready for guided follow-up.`,
    emptyState: false,
    topRecommendation: recommendations[0],
    recommendations,
  };
}

function buildRecommendation(
  customer: CollectionCoachCustomerSignal,
  context: { businessName: string; currency: string; today: string }
): CollectionCoachRecommendation {
  const daysOutstanding = normalizeCount(customer.daysOutstanding);
  const brokenPromises = normalizeCount(customer.brokenPromiseCount);
  const overdueInvoices = normalizeCount(customer.overdueInvoiceCount);
  const reminderAgeDays = daysBetween(customer.lastReminderAt, context.today);
  const promiseState = getPromiseState(customer.lastPromise, context.today);
  const score = getPriorityScore({
    balance: customer.balance,
    brokenPromises,
    daysOutstanding,
    healthRank: customer.healthRank,
    overdueInvoices,
    promiseState,
    reminderAgeDays,
  });
  const priority = getPriority(score);
  const reminderTone = getReminderTone(priority, promiseState, brokenPromises);
  const nextAction = getNextAction(priority, promiseState, overdueInvoices, reminderAgeDays);
  const reason = getReason(customer, promiseState, daysOutstanding, overdueInvoices, brokenPromises);
  const followUpDate = addDays(context.today, priority === 'critical' ? 1 : priority === 'high' ? 2 : 4);

  return {
    id: `collection-${customer.id}`,
    customerId: customer.id,
    customerName: customer.name,
    balanceLabel: formatMoney(customer.balance, context.currency),
    score,
    priority,
    tone: getTone(priority),
    title: getTitle(customer.name, priority, promiseState),
    reason,
    helper: getHelper(customer, reminderAgeDays, promiseState),
    nextAction,
    reminderTone,
    suggestedMessage: buildCollectionReminderMessage({
      balanceLabel: formatMoney(customer.balance, context.currency),
      businessName: context.businessName,
      currency: context.currency,
      customerName: customer.name,
      promise: customer.lastPromise,
      reason,
      tone: reminderTone,
    }),
    followUpDate,
  };
}

export function buildCollectionReminderMessage(input: {
  businessName: string;
  customerName: string;
  balanceLabel: string;
  currency?: string | null;
  reason?: string | null;
  tone: CollectionCoachReminderTone;
  promise?: CollectionCoachPromiseSignal | null;
}): string {
  const promiseLine =
    input.promise?.promisedDate && input.promise.status !== 'cancelled'
      ? `We had noted ${
          input.promise.amount ? formatMoney(input.promise.amount, normalizeCurrency(input.currency)) : 'the payment'
        } for ${input.promise.promisedDate}.`
      : null;

  if (input.tone === 'urgent') {
    return [
      `Hello ${input.customerName},`,
      '',
      `This is an urgent payment follow-up from ${input.businessName}. The pending balance is ${input.balanceLabel}.`,
      promiseLine,
      'Please share the payment update today.',
      '',
      `Thank you,\n${input.businessName}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (input.tone === 'firm') {
    return [
      `Hello ${input.customerName},`,
      '',
      `This is a payment follow-up from ${input.businessName}. The current pending balance is ${input.balanceLabel}.`,
      promiseLine,
      'Please let us know when the payment will be completed.',
      '',
      `Thank you,\n${input.businessName}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello ${input.customerName},`,
    '',
    `This is a gentle payment reminder from ${input.businessName}. The pending balance is ${input.balanceLabel}.`,
    'Please share the payment update when convenient.',
    '',
    `Thank you,\n${input.businessName}`,
  ].join('\n');
}

function getPriorityScore(input: {
  balance: number;
  brokenPromises: number;
  daysOutstanding: number;
  healthRank?: CustomerHealthRank | null;
  overdueInvoices: number;
  promiseState: ReturnType<typeof getPromiseState>;
  reminderAgeDays: number | null;
}): number {
  let score = input.balance > 0 ? 30 : 0;

  if (input.daysOutstanding >= 60) {
    score += 36;
  } else if (input.daysOutstanding >= 30) {
    score += 28;
  } else if (input.daysOutstanding >= 14) {
    score += 18;
  } else if (input.daysOutstanding >= 7) {
    score += 10;
  }

  if (input.promiseState === 'missed') {
    score += 54;
  } else if (input.promiseState === 'due_today') {
    score += 34;
  } else if (input.promiseState === 'upcoming') {
    score += 8;
  }

  score += Math.min(input.brokenPromises * 10, 24);
  score += Math.min(input.overdueInvoices * 8, 24);

  if (input.reminderAgeDays === null) {
    score += 8;
  } else if (input.reminderAgeDays >= 7) {
    score += 7;
  } else if (input.reminderAgeDays <= 1) {
    score -= 6;
  }

  if (input.healthRank === 'high_risk') {
    score += 20;
  } else if (input.healthRank === 'needs_follow_up') {
    score += 14;
  } else if (input.healthRank === 'watch_closely') {
    score += 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getPromiseState(promise: CollectionCoachPromiseSignal | null | undefined, today: string) {
  if (!promise || promise.status === 'fulfilled' || promise.status === 'cancelled' || !promise.promisedDate) {
    return 'none' as const;
  }
  if (promise.status === 'missed' || promise.promisedDate < today) {
    return 'missed' as const;
  }
  if (promise.promisedDate === today) {
    return 'due_today' as const;
  }
  return 'upcoming' as const;
}

function getPriority(score: number): CollectionCoachPriority {
  if (score >= 85) {
    return 'critical';
  }
  if (score >= 65) {
    return 'high';
  }
  if (score >= 35) {
    return 'normal';
  }
  return 'watch';
}

function getTone(priority: CollectionCoachPriority): CollectionCoachTone {
  if (priority === 'critical') {
    return 'danger';
  }
  if (priority === 'high') {
    return 'warning';
  }
  if (priority === 'normal') {
    return 'primary';
  }
  return 'success';
}

function getReminderTone(
  priority: CollectionCoachPriority,
  promiseState: ReturnType<typeof getPromiseState>,
  brokenPromises: number
): CollectionCoachReminderTone {
  if (priority === 'critical' || promiseState === 'missed' || brokenPromises > 0) {
    return 'urgent';
  }
  if (priority === 'high' || promiseState === 'due_today') {
    return 'firm';
  }
  return 'soft';
}

function getNextAction(
  priority: CollectionCoachPriority,
  promiseState: ReturnType<typeof getPromiseState>,
  overdueInvoices: number,
  reminderAgeDays: number | null
): CollectionCoachAction {
  if (priority === 'critical' || promiseState === 'missed') {
    return { label: 'Call customer', target: 'call_customer' };
  }
  if (overdueInvoices > 0) {
    return { label: 'Send statement', target: 'send_statement' };
  }
  if (reminderAgeDays === null || reminderAgeDays >= 3) {
    return { label: 'Send reminder', target: 'send_reminder' };
  }
  return { label: 'Add promise', target: 'add_payment_promise' };
}

function getTitle(
  customerName: string,
  priority: CollectionCoachPriority,
  promiseState: ReturnType<typeof getPromiseState>
): string {
  if (promiseState === 'missed') {
    return `Missed promise from ${customerName}`;
  }
  if (promiseState === 'due_today') {
    return `Promise due today from ${customerName}`;
  }
  if (priority === 'critical') {
    return `Call ${customerName} first`;
  }
  return `Follow up ${customerName}`;
}

function getReason(
  customer: CollectionCoachCustomerSignal,
  promiseState: ReturnType<typeof getPromiseState>,
  daysOutstanding: number,
  overdueInvoices: number,
  brokenPromises: number
): string {
  if (promiseState === 'missed') {
    return 'Payment promise was missed.';
  }
  if (promiseState === 'due_today') {
    return 'Payment promise is due today.';
  }
  if (brokenPromises > 0) {
    return `${brokenPromises} broken promise${plural(brokenPromises)} on record.`;
  }
  if (overdueInvoices > 0) {
    return `${overdueInvoices} overdue invoice${plural(overdueInvoices)} need${overdueInvoices === 1 ? 's' : ''} follow-up.`;
  }
  if (daysOutstanding >= 1) {
    return `Balance has been outstanding for ${daysOutstanding} day${plural(daysOutstanding)}.`;
  }
  if (customer.healthRank === 'high_risk' || customer.healthRank === 'needs_follow_up') {
    return 'Customer health indicates follow-up is needed.';
  }
  return 'Outstanding balance needs routine follow-up.';
}

function getHelper(
  customer: CollectionCoachCustomerSignal,
  reminderAgeDays: number | null,
  promiseState: ReturnType<typeof getPromiseState>
): string {
  if (promiseState === 'upcoming' && customer.lastPromise?.promisedDate) {
    return `Promise is scheduled for ${customer.lastPromise.promisedDate}.`;
  }
  if (reminderAgeDays === null) {
    return 'No reminder has been recorded yet.';
  }
  if (reminderAgeDays === 0) {
    return 'Reminder was already sent today.';
  }
  return `Last reminder was ${reminderAgeDays} day${plural(reminderAgeDays)} ago.`;
}

function hasOpenPromise(promise: CollectionCoachPromiseSignal | null | undefined, today: string): boolean {
  const state = getPromiseState(promise, today);
  return state === 'missed' || state === 'due_today';
}

function normalizeDate(value?: string | null): string {
  const text = value?.slice(0, 10);
  if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeCurrency(value?: string | null): string {
  return value && /^[A-Z]{3}$/.test(value) ? value : 'INR';
}

function normalizeCount(value?: number | null): number {
  return Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
}

function daysBetween(from: string | null | undefined, to: string): number | null {
  if (!from) {
    return null;
  }
  const fromTime = Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return null;
  }
  return Math.max(0, Math.floor((toTime - fromTime) / 86_400_000));
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Math.max(0, value));
}

function plural(value: number): string {
  return value === 1 ? '' : 's';
}

function surface(
  area: string,
  label: string,
  userPromise: string,
  requiredData: string[]
): CollectionCoachSurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    requiredData,
  };
}
