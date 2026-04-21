import type {
  CustomerBehaviorKind,
  CustomerInsightTone,
  CustomerPaymentInsight,
  DueAgingBucket,
} from './types';

type BuildCustomerInsightInput = {
  balance: number;
  latestActivityAt: string | null;
  oldestDueAt: string | null;
  lastPaymentAt: string | null;
  totalCredit: number;
  totalPayment: number;
  paymentCount: number;
  today?: Date;
};

export function buildCustomerPaymentInsight({
  balance,
  latestActivityAt,
  oldestDueAt,
  lastPaymentAt,
  totalCredit,
  totalPayment,
  paymentCount,
  today = new Date(),
}: BuildCustomerInsightInput): CustomerPaymentInsight {
  const daysOutstanding =
    balance > 0 && oldestDueAt ? calculateDayDifference(oldestDueAt, today) : null;
  const daysSincePayment = lastPaymentAt ? calculateDayDifference(lastPaymentAt, today) : null;
  const dueAgingBucket = getDueAgingBucket(daysOutstanding);
  const behavior = getBehavior({
    balance,
    daysOutstanding,
    daysSincePayment,
    latestActivityAt,
    paymentCount,
    totalCredit,
    totalPayment,
    today,
  });

  return {
    dueAgingBucket,
    dueAgingLabel: getDueAgingLabel(dueAgingBucket),
    dueAgingHelper: getDueAgingHelper(dueAgingBucket, daysOutstanding),
    oldestDueAt: balance > 0 ? oldestDueAt : null,
    daysOutstanding,
    behaviorKind: behavior.kind,
    behaviorLabel: behavior.label,
    behaviorHelper: behavior.helper,
    behaviorTone: behavior.tone,
    lastPaymentAt,
    paymentCount,
    totalCredit,
    totalPayment,
  };
}

function getDueAgingBucket(daysOutstanding: number | null): DueAgingBucket {
  if (daysOutstanding === null) {
    return 'none';
  }

  if (daysOutstanding < 7) {
    return 'less_than_7';
  }

  if (daysOutstanding <= 30) {
    return 'seven_to_thirty';
  }

  return 'thirty_plus';
}

function getDueAgingLabel(bucket: DueAgingBucket): string {
  if (bucket === 'less_than_7') {
    return '< 7 days';
  }

  if (bucket === 'seven_to_thirty') {
    return '7-30 days';
  }

  if (bucket === 'thirty_plus') {
    return '30+ days';
  }

  return 'No open dues';
}

function getDueAgingHelper(bucket: DueAgingBucket, daysOutstanding: number | null): string {
  if (bucket === 'none') {
    return 'No outstanding due aging to review.';
  }

  const dayText = daysOutstanding === 1 ? '1 day' : `${daysOutstanding ?? 0} days`;
  if (bucket === 'thirty_plus') {
    return `Oldest open due is about ${dayText} old.`;
  }

  return `Oldest open due is about ${dayText} old.`;
}

function getBehavior(input: {
  balance: number;
  daysOutstanding: number | null;
  daysSincePayment: number | null;
  latestActivityAt: string | null;
  paymentCount: number;
  totalCredit: number;
  totalPayment: number;
  today: Date;
}): {
  kind: CustomerBehaviorKind;
  label: string;
  helper: string;
  tone: CustomerInsightTone;
} {
  if (input.totalCredit <= 0 && input.totalPayment <= 0 && input.balance === 0) {
    return {
      kind: 'new_customer',
      label: 'New customer',
      helper: 'No payment pattern yet.',
      tone: 'neutral',
    };
  }

  if (input.balance < 0) {
    return {
      kind: 'advance_balance',
      label: 'Advance balance',
      helper: 'You owe or hold advance for this customer.',
      tone: 'tax',
    };
  }

  if (input.balance === 0) {
    return {
      kind: input.paymentCount > 0 ? 'pays_on_time' : 'settled',
      label: input.paymentCount > 0 ? 'Pays on time' : 'Settled',
      helper: input.paymentCount > 0 ? 'Account is settled after payments.' : 'No dues are open.',
      tone: 'success',
    };
  }

  const ratioOutstanding = input.totalCredit > 0 ? input.balance / input.totalCredit : 1;
  if ((input.daysOutstanding ?? 0) >= 14 && ratioOutstanding >= 0.75) {
    return {
      kind: 'high_outstanding_balance',
      label: 'High outstanding',
      helper: 'Most credited amount is still unpaid.',
      tone: 'danger',
    };
  }

  if (
    input.paymentCount === 0 ||
    input.daysSincePayment === null ||
    input.daysSincePayment >= 30
  ) {
    return {
      kind: 'no_recent_payment',
      label: 'No recent payment',
      helper: 'Follow up before adding more credit.',
      tone: 'warning',
    };
  }

  if ((input.daysOutstanding ?? 0) >= 7 || input.daysSincePayment >= 14) {
    return {
      kind: 'delayed_payments',
      label: 'Delayed payments',
      helper: 'Payment activity is slower than recent dues.',
      tone: 'warning',
    };
  }

  return {
    kind: 'pays_on_time',
    label: 'Recent payer',
    helper: 'Payment activity is recent.',
    tone: 'success',
  };
}

function calculateDayDifference(dateValue: string, today: Date): number {
  const parsed = new Date(`${dateValue.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.floor((todayStart.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000))
  );
}
