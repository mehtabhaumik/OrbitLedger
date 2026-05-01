import type {
  DashboardSummary,
  PaymentPromiseWithCustomer,
  Product,
  RecentTransaction,
  TopDueCustomer,
} from '../database';
import { formatCurrency } from '../lib/format';

export type DailyCommandTarget =
  | 'get_paid'
  | 'add_payment'
  | 'add_credit'
  | 'products'
  | 'statement_batch'
  | 'daily_closing'
  | 'business_health';

export type DailyCommandTone = 'success' | 'warning' | 'primary';

export type DailyCommandCard = {
  id:
    | 'collect_today'
    | 'paid_today'
    | 'follow_up'
    | 'stock_risk'
    | 'documents_to_send'
    | 'business_health';
  title: string;
  message: string;
  value: string;
  actionLabel: string;
  target: DailyCommandTarget;
  tone: DailyCommandTone;
  priority: number;
};

export type DailyCommandCenterInput = {
  currency: string;
  date?: Date;
  lowStockProducts: Product[];
  productsEnabled: boolean;
  recentTransactions: RecentTransaction[];
  summary: DashboardSummary | null;
  topDueCustomers: TopDueCustomer[];
  upcomingPromises: PaymentPromiseWithCustomer[];
};

export function buildDailyCommandCenter(input: DailyCommandCenterInput): DailyCommandCard[] {
  const today = toDateOnly(input.date ?? new Date());
  const duePromises = input.upcomingPromises.filter(
    (promise) => promise.status === 'missed' || promise.promisedDate <= today
  );
  const missedPromises = duePromises.filter(
    (promise) => promise.status === 'missed' || promise.promisedDate < today
  );
  const paymentsToday = input.recentTransactions.filter(
    (transaction) => transaction.type === 'payment' && toDateOnly(transaction.effectiveDate) === today
  );
  const paymentTotal = paymentsToday.reduce((total, transaction) => total + transaction.amount, 0);
  const highestDue = input.topDueCustomers[0] ?? null;
  const followUpCount = input.summary?.followUpCustomerCount ?? 0;
  const trend = getActivityTrend(input.summary);
  const cards: DailyCommandCard[] = [
    buildCollectCard(highestDue, input.currency),
    buildPaidTodayCard(paymentsToday, paymentTotal, input.currency),
    buildFollowUpCard(duePromises, missedPromises, followUpCount),
    buildDocumentsCard(input.topDueCustomers),
    buildBusinessHealthCard(trend),
  ];

  if (input.productsEnabled) {
    cards.push(buildStockRiskCard(input.lowStockProducts));
  }

  return cards.sort((left, right) => right.priority - left.priority);
}

function buildCollectCard(customer: TopDueCustomer | null, currency: string): DailyCommandCard {
  if (!customer || customer.balance <= 0) {
    return {
      id: 'collect_today',
      title: 'No urgent collection',
      message: 'Keep today fresh by recording new credit or payments as they happen.',
      value: 'Clear',
      actionLabel: 'Add Credit',
      target: 'add_credit',
      tone: 'success',
      priority: 20,
    };
  }

  return {
    id: 'collect_today',
    title: `Collect from ${customer.name}`,
    message: customer.lastPaymentAt
      ? `Last payment was ${formatShortDate(customer.lastPaymentAt)}.`
      : 'No payment recorded yet.',
    value: formatCurrency(customer.balance, currency),
    actionLabel: 'Open Get Paid',
    target: 'get_paid',
    tone: 'warning',
    priority: 95,
  };
}

function buildPaidTodayCard(
  paymentsToday: RecentTransaction[],
  paymentTotal: number,
  currency: string
): DailyCommandCard {
  if (!paymentsToday.length) {
    return {
      id: 'paid_today',
      title: 'No payments today yet',
      message: 'Record payments as soon as cash or bank transfer arrives.',
      value: '0',
      actionLabel: 'Add Payment',
      target: 'add_payment',
      tone: 'primary',
      priority: 55,
    };
  }

  return {
    id: 'paid_today',
    title: 'Payments received today',
    message: joinNames(paymentsToday.map((transaction) => transaction.customerName)),
    value: formatCurrency(paymentTotal, currency),
    actionLabel: 'Add Payment',
    target: 'add_payment',
    tone: 'success',
    priority: 58,
  };
}

function buildFollowUpCard(
  duePromises: PaymentPromiseWithCustomer[],
  missedPromises: PaymentPromiseWithCustomer[],
  followUpCount: number
): DailyCommandCard {
  if (missedPromises.length > 0) {
    return {
      id: 'follow_up',
      title: 'Missed promises need follow-up',
      message: joinNames(missedPromises.map((promise) => promise.customerName)),
      value: `${missedPromises.length}`,
      actionLabel: 'Open Follow-Ups',
      target: 'get_paid',
      tone: 'warning',
      priority: 105,
    };
  }

  if (duePromises.length > 0) {
    return {
      id: 'follow_up',
      title: 'Promises due today',
      message: joinNames(duePromises.map((promise) => promise.customerName)),
      value: `${duePromises.length}`,
      actionLabel: 'Review Follow-Ups',
      target: 'get_paid',
      tone: 'warning',
      priority: 100,
    };
  }

  if (followUpCount > 0) {
    return {
      id: 'follow_up',
      title: 'Follow up old dues',
      message: `${followUpCount} customer${followUpCount === 1 ? '' : 's'} have dues without a recent payment.`,
      value: `${followUpCount}`,
      actionLabel: 'Open Get Paid',
      target: 'get_paid',
      tone: 'warning',
      priority: 90,
    };
  }

  return {
    id: 'follow_up',
    title: 'Follow-ups are clear',
    message: 'No overdue promises or stale dues need attention right now.',
    value: 'Clear',
    actionLabel: 'Review Dues',
    target: 'get_paid',
    tone: 'success',
    priority: 30,
  };
}

function buildStockRiskCard(products: Product[]): DailyCommandCard {
  if (!products.length) {
    return {
      id: 'stock_risk',
      title: 'Stock risk is low',
      message: 'No low-stock products need attention right now.',
      value: 'Clear',
      actionLabel: 'Review Products',
      target: 'products',
      tone: 'success',
      priority: 25,
    };
  }

  return {
    id: 'stock_risk',
    title: 'Restock soon',
    message: joinNames(products.map((product) => product.name)),
    value: `${products.length}`,
    actionLabel: 'Open Products',
    target: 'products',
    tone: 'warning',
    priority: 80,
  };
}

function buildDocumentsCard(customers: TopDueCustomer[]): DailyCommandCard {
  const customerCount = customers.filter((customer) => customer.balance > 0).length;
  if (!customerCount) {
    return {
      id: 'documents_to_send',
      title: 'No statements waiting',
      message: 'When customers have dues, prepare statements from here.',
      value: 'Clear',
      actionLabel: 'Statement Batch',
      target: 'statement_batch',
      tone: 'success',
      priority: 18,
    };
  }

  return {
    id: 'documents_to_send',
    title: 'Statements can help',
    message: `Prepare statements for ${customerCount} customer${customerCount === 1 ? '' : 's'} with dues.`,
    value: `${customerCount}`,
    actionLabel: 'Create Statements',
    target: 'statement_batch',
    tone: 'primary',
    priority: 70,
  };
}

function buildBusinessHealthCard(trend: ReturnType<typeof getActivityTrend>): DailyCommandCard {
  if (trend.delta < 0) {
    return {
      id: 'business_health',
      title: 'Activity slowed',
      message: `${trend.recent} entries in the last 7 days. Review what changed.`,
      value: `Down ${Math.abs(trend.delta)}`,
      actionLabel: 'Check Health',
      target: 'business_health',
      tone: 'warning',
      priority: 65,
    };
  }

  if (trend.delta > 0) {
    return {
      id: 'business_health',
      title: 'Business activity is up',
      message: `${trend.recent} entries in the last 7 days.`,
      value: `Up ${trend.delta}`,
      actionLabel: 'Check Health',
      target: 'business_health',
      tone: 'success',
      priority: 45,
    };
  }

  return {
    id: 'business_health',
    title: 'Business is steady',
    message: `${trend.recent} entries in the last 7 days.`,
    value: 'Steady',
    actionLabel: 'Check Health',
    target: 'business_health',
    tone: 'primary',
    priority: 40,
  };
}

function getActivityTrend(summary: DashboardSummary | null) {
  const recent = summary?.recentActivityCount ?? 0;
  const previous = summary?.previousActivityCount ?? 0;
  return {
    delta: recent - previous,
    previous,
    recent,
  };
}

function joinNames(names: string[]) {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (uniqueNames.length === 0) {
    return 'No customer names found.';
  }
  if (uniqueNames.length <= 2) {
    return uniqueNames.join(', ');
  }
  return `${uniqueNames.slice(0, 2).join(', ')} and ${uniqueNames.length - 2} more`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
