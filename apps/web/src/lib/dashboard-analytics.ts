import { summarizePaymentMode } from '@orbit-ledger/core';

import type {
  WorkspaceCustomer,
  WorkspaceInvoice,
  WorkspaceProduct,
  WorkspaceTransaction,
} from './workspace-data';

export type DashboardChartPoint = {
  label: string;
  value: number;
  amount?: number;
  id?: string;
};

export type DashboardSegment = DashboardChartPoint & {
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'premium' | 'neutral';
};

export type DashboardAnalytics = {
  receivablesTrend: DashboardChartPoint[];
  collectionHealth: DashboardSegment[];
  cashInflow: DashboardChartPoint[];
  topCustomersOutstanding: DashboardChartPoint[];
  paymentModeBreakdown: DashboardSegment[];
  invoiceAging: DashboardSegment[];
  monthlySnapshot: Array<DashboardChartPoint & { collected: number; invoiced: number }>;
  customerRiskMix: DashboardSegment[];
  inventoryPressure: DashboardSegment[];
  dailyActionScore: {
    score: number;
    openActions: number;
    segments: DashboardSegment[];
  };
};

export type BuildDashboardAnalyticsInput = {
  customers: WorkspaceCustomer[];
  invoices: WorkspaceInvoice[];
  products: WorkspaceProduct[];
  transactions: WorkspaceTransaction[];
  today?: string;
};

const agingBuckets = [
  { id: '0-7', label: '0-7 days', min: 0, max: 7 },
  { id: '8-15', label: '8-15 days', min: 8, max: 15 },
  { id: '16-30', label: '16-30 days', min: 16, max: 30 },
  { id: '31-60', label: '31-60 days', min: 31, max: 60 },
  { id: '60+', label: '60+ days', min: 61, max: Number.POSITIVE_INFINITY },
] as const;

const paymentStatusLabels: Record<string, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  overdue: 'Overdue',
  pending_clearance: 'Pending clearance',
};

const healthRankLabels: Record<string, string> = {
  excellent: 'Excellent',
  reliable: 'Reliable',
  watch_closely: 'Watch closely',
  needs_follow_up: 'Needs follow-up',
  high_risk: 'High risk',
};

export function buildDashboardAnalytics(input: BuildDashboardAnalyticsInput): DashboardAnalytics {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const activeInvoices = input.invoices.filter((invoice) => !invoice.isArchived && invoice.documentState !== 'cancelled');
  const unpaidInvoices = activeInvoices.filter((invoice) => invoice.paymentStatus !== 'paid');
  const currentOutstanding = roundMoney(input.customers.reduce((total, customer) => total + Math.max(customer.balance, 0), 0));
  const lowStockProducts = input.products.filter((product) => product.stockQuantity <= 0);
  const atRiskProducts = input.products.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= 5);
  const pendingPayments = input.transactions.filter(
    (transaction) => transaction.type === 'payment' && transaction.paymentClearanceStatus && transaction.paymentClearanceStatus !== 'cleared'
  );

  const actionSegments: DashboardSegment[] = [
    {
      id: 'collections',
      label: 'Collections',
      value: input.customers.filter((customer) => !customer.isArchived && customer.balance > 0).length,
      tone: 'warning',
    },
    {
      id: 'invoices',
      label: 'Invoices',
      value: unpaidInvoices.length,
      tone: 'primary',
    },
    {
      id: 'payments',
      label: 'Payments',
      value: pendingPayments.length,
      tone: 'premium',
    },
    {
      id: 'stock',
      label: 'Stock',
      value: lowStockProducts.length + atRiskProducts.length,
      tone: 'danger',
    },
  ];
  const openActions = actionSegments.reduce((total, segment) => total + segment.value, 0);

  return {
    receivablesTrend: buildReceivablesTrend(input.transactions, currentOutstanding, today),
    collectionHealth: buildCollectionHealth(activeInvoices),
    cashInflow: buildCashInflow(input.transactions, today),
    topCustomersOutstanding: input.customers
      .filter((customer) => !customer.isArchived && customer.balance > 0)
      .sort((left, right) => right.balance - left.balance)
      .slice(0, 5)
      .map((customer) => ({
        id: customer.id,
        label: customer.name,
        value: roundMoney(customer.balance),
      })),
    paymentModeBreakdown: buildPaymentModeBreakdown(input.transactions),
    invoiceAging: buildInvoiceAging(unpaidInvoices, today),
    monthlySnapshot: buildMonthlySnapshot(activeInvoices, input.transactions, today),
    customerRiskMix: buildCustomerRiskMix(input.customers),
    inventoryPressure: [
      { id: 'out', label: 'Out of stock', value: lowStockProducts.length, tone: 'danger' },
      { id: 'low', label: 'Low stock', value: atRiskProducts.length, tone: 'warning' },
      {
        id: 'ready',
        label: 'Ready',
        value: Math.max(input.products.length - lowStockProducts.length - atRiskProducts.length, 0),
        tone: 'success',
      },
    ],
    dailyActionScore: {
      score: Math.max(0, Math.min(100, 100 - openActions * 8)),
      openActions,
      segments: actionSegments,
    },
  };
}

function buildReceivablesTrend(transactions: WorkspaceTransaction[], currentOutstanding: number, today: string): DashboardChartPoint[] {
  const days = buildRecentDays(today, 14);
  let running = currentOutstanding;
  const netByDay = new Map<string, number>();

  for (const transaction of transactions) {
    const day = normalizeDateKey(transaction.effectiveDate || transaction.createdAt);
    if (!day) {
      continue;
    }
    const current = netByDay.get(day) ?? 0;
    netByDay.set(day, current + (transaction.type === 'credit' ? transaction.amount : -transaction.amount));
  }

  const reversed: DashboardChartPoint[] = [];
  for (const day of [...days].reverse()) {
    reversed.push({ id: day, label: formatShortDay(day), value: roundMoney(Math.max(running, 0)) });
    running -= netByDay.get(day) ?? 0;
  }

  return reversed.reverse();
}

function buildCollectionHealth(invoices: WorkspaceInvoice[]): DashboardSegment[] {
  const buckets = new Map<string, { count: number; amount: number }>();
  for (const invoice of invoices) {
    const key = invoice.paymentStatus;
    const current = buckets.get(key) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Math.max(invoice.totalAmount - invoice.paidAmount, 0);
    buckets.set(key, current);
  }

  return ['paid', 'unpaid', 'partially_paid', 'pending_clearance', 'overdue'].map((status) => ({
    id: status,
    label: paymentStatusLabels[status] ?? status,
    value: buckets.get(status)?.count ?? 0,
    amount: roundMoney(buckets.get(status)?.amount ?? 0),
    tone: getPaymentStatusTone(status),
  }));
}

function buildCashInflow(transactions: WorkspaceTransaction[], today: string): DashboardChartPoint[] {
  const weeks = buildRecentWeeks(today, 8);
  const totals = new Map(weeks.map((week) => [week.id, 0]));
  for (const transaction of transactions) {
    if (transaction.type !== 'payment') {
      continue;
    }
    const key = getWeekKey(transaction.effectiveDate || transaction.createdAt);
    if (totals.has(key)) {
      totals.set(key, roundMoney((totals.get(key) ?? 0) + transaction.amount));
    }
  }
  return weeks.map((week) => ({ id: week.id, label: week.label, value: totals.get(week.id) ?? 0 }));
}

function buildPaymentModeBreakdown(transactions: WorkspaceTransaction[]): DashboardSegment[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'payment') {
      continue;
    }
    const label = summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails) || 'Not specified';
    totals.set(label, roundMoney((totals.get(label) ?? 0) + transaction.amount));
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, value], index) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label,
      value,
      tone: getPaletteTone(index),
    }));
}

function buildInvoiceAging(invoices: WorkspaceInvoice[], today: string): DashboardSegment[] {
  const todayTime = parseDate(today)?.getTime() ?? Date.now();
  const buckets = new Map<string, number>();
  for (const invoice of invoices) {
    const basis = parseDate(invoice.dueDate ?? invoice.issueDate);
    const days = basis ? Math.max(0, Math.floor((todayTime - basis.getTime()) / 86_400_000)) : 0;
    const bucket = agingBuckets.find((entry) => days >= entry.min && days <= entry.max) ?? agingBuckets[0];
    buckets.set(bucket.id, roundMoney((buckets.get(bucket.id) ?? 0) + Math.max(invoice.totalAmount - invoice.paidAmount, 0)));
  }

  return agingBuckets.map((bucket, index) => ({
    id: bucket.id,
    label: bucket.label,
    value: buckets.get(bucket.id) ?? 0,
    tone: index >= 3 ? 'danger' : index >= 2 ? 'warning' : 'primary',
  }));
}

function buildMonthlySnapshot(
  invoices: WorkspaceInvoice[],
  transactions: WorkspaceTransaction[],
  today: string
): Array<DashboardChartPoint & { collected: number; invoiced: number }> {
  const months = buildRecentMonths(today, 6);
  const invoiced = new Map(months.map((month) => [month.id, 0]));
  const collected = new Map(months.map((month) => [month.id, 0]));

  for (const invoice of invoices) {
    const month = (invoice.issueDate || '').slice(0, 7);
    if (invoiced.has(month)) {
      invoiced.set(month, roundMoney((invoiced.get(month) ?? 0) + invoice.totalAmount));
    }
  }

  for (const transaction of transactions) {
    if (transaction.type !== 'payment') {
      continue;
    }
    const month = (transaction.effectiveDate || transaction.createdAt || '').slice(0, 7);
    if (collected.has(month)) {
      collected.set(month, roundMoney((collected.get(month) ?? 0) + transaction.amount));
    }
  }

  return months.map((month) => ({
    id: month.id,
    label: month.label,
    value: roundMoney((invoiced.get(month.id) ?? 0) - (collected.get(month.id) ?? 0)),
    invoiced: invoiced.get(month.id) ?? 0,
    collected: collected.get(month.id) ?? 0,
  }));
}

function buildCustomerRiskMix(customers: WorkspaceCustomer[]): DashboardSegment[] {
  const totals = new Map<string, number>();
  for (const customer of customers.filter((entry) => !entry.isArchived)) {
    totals.set(customer.health.rank, (totals.get(customer.health.rank) ?? 0) + 1);
  }
  return ['excellent', 'reliable', 'watch_closely', 'needs_follow_up', 'high_risk'].map((rank) => ({
    id: rank,
    label: healthRankLabels[rank] ?? rank,
    value: totals.get(rank) ?? 0,
    tone: getHealthTone(rank),
  }));
}

function buildRecentDays(today: string, count: number) {
  const base = parseDate(today) ?? new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function buildRecentWeeks(today: string, count: number) {
  const base = parseDate(today) ?? new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (count - 1 - index) * 7);
    const id = getWeekKey(date.toISOString().slice(0, 10));
    return { id, label: `W${id.slice(5)}` };
  });
}

function buildRecentMonths(today: string, count: number) {
  const base = parseDate(`${today.slice(0, 7)}-01`) ?? new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setMonth(base.getMonth() - (count - 1 - index));
    const id = date.toISOString().slice(0, 7);
    return { id, label: date.toLocaleDateString('en-IN', { month: 'short' }) };
  });
}

function getWeekKey(value: string) {
  const date = parseDate(value) ?? new Date();
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const week = Math.ceil((day + start.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function normalizeDateKey(value: string) {
  return parseDate(value)?.toISOString().slice(0, 10) ?? null;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatShortDay(value: string) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : value;
}

function getPaymentStatusTone(status: string): DashboardSegment['tone'] {
  if (status === 'paid') {
    return 'success';
  }
  if (status === 'overdue') {
    return 'danger';
  }
  if (status === 'pending_clearance' || status === 'partially_paid') {
    return 'warning';
  }
  return 'primary';
}

function getHealthTone(rank: string): DashboardSegment['tone'] {
  if (rank === 'excellent') {
    return 'success';
  }
  if (rank === 'high_risk') {
    return 'danger';
  }
  if (rank === 'needs_follow_up' || rank === 'watch_closely') {
    return 'warning';
  }
  return 'primary';
}

function getPaletteTone(index: number): DashboardSegment['tone'] {
  return (['primary', 'success', 'warning', 'premium', 'danger', 'neutral'] as const)[index] ?? 'neutral';
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
