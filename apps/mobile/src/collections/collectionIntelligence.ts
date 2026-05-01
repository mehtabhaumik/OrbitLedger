import type {
  CollectionCustomer,
  PaymentPromiseWithCustomer,
  TopDueCustomer,
} from '../database';

export type CollectionRecommendationTone = 'danger' | 'warning' | 'primary';

export type CollectionRecommendationAction =
  | 'call'
  | 'message'
  | 'statement'
  | 'payment'
  | 'promise';

export type CollectionRecommendation = TopDueCustomer & {
  customerPhone: string | null;
  helper: string;
  priority: number;
  reason: string;
  recommendedAction: CollectionRecommendationAction;
  tone: CollectionRecommendationTone;
  oldestCreditAt: string | null;
  promise: PaymentPromiseWithCustomer | null;
  badges: string[];
};

export type BuildCollectionRecommendationsInput = {
  date?: Date;
  highestDues: TopDueCustomer[];
  oldestDues: CollectionCustomer[];
  staleDues: CollectionCustomer[];
  promises: PaymentPromiseWithCustomer[];
  limit?: number;
};

type CollectionCandidate = TopDueCustomer & {
  customerPhone?: string | null;
  oldestCreditAt?: string | null;
};

export function buildCollectionRecommendations(
  input: BuildCollectionRecommendationsInput
): CollectionRecommendation[] {
  const today = toDateOnly(input.date ?? new Date());
  const promisesByCustomer = new Map<string, PaymentPromiseWithCustomer>();
  for (const promise of input.promises) {
    const current = promisesByCustomer.get(promise.customerId);
    if (!current || comparePromiseUrgency(promise, current, today) < 0) {
      promisesByCustomer.set(promise.customerId, promise);
    }
  }

  const candidates = dedupeCandidates([
    ...input.highestDues,
    ...input.oldestDues,
    ...input.staleDues,
    ...input.promises.map((promise) => promiseToCandidate(promise, today)),
  ]);

  return candidates
    .filter((customer) => customer.balance > 0)
    .map((customer) => buildRecommendation(customer, promisesByCustomer.get(customer.id) ?? null, today))
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      if (right.balance !== left.balance) {
        return right.balance - left.balance;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, input.limit ?? 5);
}

function buildRecommendation(
  customer: CollectionCandidate,
  promise: PaymentPromiseWithCustomer | null,
  today: string
): CollectionRecommendation {
  const promiseDays = promise ? daysBetween(today, promise.promisedDate) : null;
  const daysOutstanding = customer.insight.daysOutstanding ?? null;
  const daysSincePayment = customer.lastPaymentAt ? daysBetween(today, customer.lastPaymentAt) : null;
  const daysSinceReminder = customer.lastReminderAt ? daysBetween(today, customer.lastReminderAt) : null;
  const reason = buildReason(customer, promise, promiseDays, daysSincePayment);
  const helper = buildHelper(customer, promise, promiseDays, daysSinceReminder);
  const recommendedAction = getRecommendedAction(customer, promise, promiseDays, daysSinceReminder);
  const priority = calculatePriority(customer, promiseDays, daysOutstanding, daysSincePayment, daysSinceReminder);

  return {
    ...customer,
    customerPhone: customer.customerPhone ?? customer.phone ?? promise?.customerPhone ?? null,
    helper,
    priority,
    reason,
    recommendedAction,
    tone: priority >= 115 ? 'danger' : priority >= 80 ? 'warning' : 'primary',
    oldestCreditAt: customer.oldestCreditAt ?? customer.insight.oldestDueAt ?? null,
    promise,
    badges: buildBadges(customer, promise, promiseDays),
  };
}

function calculatePriority(
  customer: CollectionCandidate,
  promiseDays: number | null,
  daysOutstanding: number | null,
  daysSincePayment: number | null,
  daysSinceReminder: number | null
): number {
  let priority = Math.min(35, Math.max(8, customer.balance / 1000));

  if (promiseDays !== null) {
    if (promiseDays > 0) {
      priority += 60;
    } else if (promiseDays === 0) {
      priority += 56;
    } else {
      priority += 16;
    }
  }

  if (customer.insight.dueAgingBucket === 'thirty_plus') {
    priority += 32;
  } else if (customer.insight.dueAgingBucket === 'seven_to_thirty') {
    priority += 18;
  } else if (customer.insight.dueAgingBucket === 'less_than_7') {
    priority += 6;
  }

  if (customer.insight.behaviorKind === 'high_outstanding_balance') {
    priority += 28;
  } else if (customer.insight.behaviorKind === 'no_recent_payment') {
    priority += 24;
  } else if (customer.insight.behaviorKind === 'delayed_payments') {
    priority += 16;
  }

  if (daysOutstanding !== null) {
    priority += Math.min(24, Math.floor(daysOutstanding / 3));
  }

  if (daysSincePayment === null) {
    priority += 12;
  } else if (daysSincePayment >= 30) {
    priority += 20;
  } else if (daysSincePayment >= 14) {
    priority += 12;
  }

  if (daysSinceReminder === null) {
    priority += 10;
  } else if (daysSinceReminder >= 7) {
    priority += 6;
  } else if (daysSinceReminder <= 1) {
    priority -= 8;
  }

  return Math.round(priority);
}

function buildReason(
  customer: CollectionCandidate,
  promise: PaymentPromiseWithCustomer | null,
  promiseDays: number | null,
  daysSincePayment: number | null
): string {
  if (promise && promiseDays !== null) {
    if (promiseDays > 0) {
      return 'Payment promise has passed.';
    }

    if (promiseDays === 0) {
      return 'Payment promise is due today.';
    }
  }

  const daysOutstanding = customer.insight.daysOutstanding;
  if (customer.balance >= 10000 && daysOutstanding && daysOutstanding >= 14) {
    return `High balance and no full payment for ${daysOutstanding} days.`;
  }

  if (daysSincePayment === null) {
    return 'No payment recorded yet.';
  }

  if (daysSincePayment >= 14) {
    return `No payment in ${daysSincePayment} days.`;
  }

  if (daysOutstanding && daysOutstanding > 0) {
    return `Oldest due is about ${daysOutstanding} days old.`;
  }

  return 'Outstanding balance needs follow-up.';
}

function buildHelper(
  customer: CollectionCandidate,
  promise: PaymentPromiseWithCustomer | null,
  promiseDays: number | null,
  daysSinceReminder: number | null
): string {
  if (promise && promiseDays !== null) {
    if (promiseDays > 0) {
      return `Promised for ${formatDateOnly(promise.promisedDate)}.`;
    }

    if (promiseDays === 0) {
      return 'Call or message today.';
    }

    return `Promised for ${formatDateOnly(promise.promisedDate)}.`;
  }

  if (daysSinceReminder === null) {
    return 'No reminder shared yet.';
  }

  if (daysSinceReminder === 0) {
    return 'Reminder shared today.';
  }

  if (daysSinceReminder === 1) {
    return 'Reminder shared yesterday.';
  }

  return `Last reminder ${daysSinceReminder} days ago.`;
}

function getRecommendedAction(
  customer: CollectionCandidate,
  promise: PaymentPromiseWithCustomer | null,
  promiseDays: number | null,
  daysSinceReminder: number | null
): CollectionRecommendationAction {
  if (
    promise &&
    promiseDays !== null &&
    promiseDays >= 0 &&
    (customer.customerPhone || customer.phone || promise.customerPhone)
  ) {
    return 'call';
  }

  if (daysSinceReminder === null || daysSinceReminder >= 4) {
    return 'message';
  }

  if ((customer.insight.daysOutstanding ?? 0) >= 21) {
    return 'statement';
  }

  return 'payment';
}

function buildBadges(
  customer: CollectionCandidate,
  promise: PaymentPromiseWithCustomer | null,
  promiseDays: number | null
): string[] {
  const badges: string[] = [];
  if (promise && promiseDays !== null) {
    badges.push(promiseDays >= 0 ? 'Promise due' : 'Promise set');
  }

  if (customer.insight.daysOutstanding && customer.insight.daysOutstanding >= 30) {
    badges.push('Old due');
  }

  if (customer.lastReminderAt) {
    badges.push('Reminder sent');
  } else {
    badges.push('Needs reminder');
  }

  return badges.slice(0, 3);
}

function dedupeCandidates(customers: CollectionCandidate[]): CollectionCandidate[] {
  const byId = new Map<string, CollectionCandidate>();
  for (const customer of customers) {
    const current = byId.get(customer.id);
    if (!current) {
      byId.set(customer.id, customer);
      continue;
    }

    byId.set(customer.id, {
      ...current,
      ...customer,
      balance: Math.max(current.balance, customer.balance),
      phone: current.phone ?? customer.phone ?? null,
      customerPhone: current.customerPhone ?? customer.customerPhone ?? null,
      lastPaymentAt: current.lastPaymentAt ?? customer.lastPaymentAt,
      lastReminderAt: current.lastReminderAt ?? customer.lastReminderAt,
      oldestCreditAt: current.oldestCreditAt ?? customer.oldestCreditAt ?? null,
    });
  }

  return [...byId.values()];
}

function promiseToCandidate(promise: PaymentPromiseWithCustomer, today: string): CollectionCandidate {
  const promisedDays = Math.max(0, daysBetween(today, promise.promisedDate));

  return {
    id: promise.customerId,
    name: promise.customerName,
    phone: promise.customerPhone,
    balance: promise.currentBalance,
    latestActivityAt: promise.updatedAt,
    lastPaymentAt: null,
    lastReminderAt: null,
    customerPhone: promise.customerPhone,
    oldestCreditAt: promise.promisedDate,
    insight: {
      behaviorHelper: 'Payment promise needs follow-up.',
      behaviorKind: 'delayed_payments',
      behaviorLabel: 'Follow up',
      behaviorTone: 'warning',
      daysOutstanding: promisedDays,
      dueAgingBucket: promisedDays >= 30 ? 'thirty_plus' : promisedDays >= 7 ? 'seven_to_thirty' : 'less_than_7',
      dueAgingHelper: 'Promise needs attention.',
      dueAgingLabel: promisedDays >= 30 ? '30+ days' : promisedDays >= 7 ? '7-30 days' : 'Recent',
      lastPaymentAt: null,
      oldestDueAt: promise.promisedDate,
      paymentCount: 0,
      totalCredit: promise.currentBalance,
      totalPayment: 0,
    },
  };
}

function comparePromiseUrgency(
  left: PaymentPromiseWithCustomer,
  right: PaymentPromiseWithCustomer,
  today: string
): number {
  const leftDays = daysBetween(today, left.promisedDate);
  const rightDays = daysBetween(today, right.promisedDate);
  const leftRank = leftDays >= 0 ? 0 : 1;
  const rightRank = rightDays >= 0 ? 0 : 1;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.promisedDate.localeCompare(right.promisedDate);
}

function daysBetween(later: string, earlier: string): number {
  const laterTime = Date.parse(`${toDateOnly(later)}T00:00:00.000Z`);
  const earlierTime = Date.parse(`${toDateOnly(earlier)}T00:00:00.000Z`);

  if (!Number.isFinite(laterTime) || !Number.isFinite(earlierTime)) {
    return 0;
  }

  return Math.floor((laterTime - earlierTime) / 86_400_000);
}

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function formatDateOnly(value: string): string {
  const date = new Date(`${toDateOnly(value)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}
