import { buildProductReorderSuggestions } from './workspace-products';
import type {
  WorkspaceCustomer,
  WorkspaceInvoice,
  WorkspacePaymentPromise,
  WorkspaceProduct,
  WorkspaceTransaction,
} from './workspace-data';

export type ReviewSignalTone = 'primary' | 'success' | 'warning' | 'premium';

export type ReviewMetric = {
  label: string;
  value: number;
  tone: ReviewSignalTone;
};

export type ReviewAction = {
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
};

export type WebDailyClosingReview = {
  date: string;
  metrics: ReviewMetric[];
  actions: ReviewAction[];
};

export type WebBusinessHealthReview = {
  score: number;
  label: string;
  actions: ReviewAction[];
};

export type WebMonthlyReview = {
  month: string;
  metrics: ReviewMetric[];
  actions: ReviewAction[];
};

export function buildWebDailyClosingReview(input: {
  date: string;
  transactions: WorkspaceTransaction[];
  products: WorkspaceProduct[];
  promises: WorkspacePaymentPromise[];
}): WebDailyClosingReview {
  const todayTransactions = input.transactions.filter((transaction) => transaction.effectiveDate === input.date);
  const todayPayments = sum(todayTransactions.filter((transaction) => transaction.type === 'payment').map((entry) => entry.amount));
  const todayCredits = sum(todayTransactions.filter((transaction) => transaction.type === 'credit').map((entry) => entry.amount));
  const duePromises = input.promises.filter(
    (promise) => promise.status === 'open' && promise.promisedDate <= input.date
  );
  const reorderCount = buildProductReorderSuggestions(input.products).filter(
    (suggestion) => suggestion.urgency === 'out_of_stock' || suggestion.urgency === 'reorder_now'
  ).length;
  const actions: ReviewAction[] = [];

  if (duePromises.length) {
    actions.push({
      title: 'Review promised payments',
      message: `${duePromises.length} payment promise${duePromises.length === 1 ? ' needs' : 's need'} follow-up.`,
      priority: 'high',
    });
  }
  if (reorderCount) {
    actions.push({
      title: 'Check low stock',
      message: `${reorderCount} product${reorderCount === 1 ? '' : 's'} reached reorder level.`,
      priority: 'medium',
    });
  }
  if (!todayPayments && !todayCredits) {
    actions.push({
      title: 'No money movement recorded',
      message: 'Record today’s credits and payments before closing the day.',
      priority: 'low',
    });
  }
  if (!actions.length) {
    actions.push({
      title: 'Day looks ready to close',
      message: 'Payments, dues, promises, and stock do not show urgent review items.',
      priority: 'low',
    });
  }

  return {
    date: input.date,
    metrics: [
      { label: 'Payments today', value: todayPayments, tone: 'success' },
      { label: 'Credit today', value: todayCredits, tone: 'warning' },
      { label: 'Promises due', value: duePromises.length, tone: duePromises.length ? 'warning' : 'success' },
      { label: 'Low stock', value: reorderCount, tone: reorderCount ? 'warning' : 'success' },
    ],
    actions,
  };
}

export function buildWebBusinessHealthReview(input: {
  customers: WorkspaceCustomer[];
  invoices: WorkspaceInvoice[];
  products: WorkspaceProduct[];
  promises: WorkspacePaymentPromise[];
  today: string;
}): WebBusinessHealthReview {
  const riskyCustomers = input.customers.filter((customer) =>
    ['needs_follow_up', 'high_risk'].includes(customer.health.rank)
  ).length;
  const unpaidInvoices = input.invoices.filter((invoice) =>
    ['unpaid', 'partially_paid', 'overdue', 'pending_clearance'].includes(invoice.paymentStatus)
  ).length;
  const lowStock = buildProductReorderSuggestions(input.products).filter((suggestion) => suggestion.urgency !== 'healthy').length;
  const missedPromises = input.promises.filter(
    (promise) => promise.status === 'missed' || (promise.status === 'open' && promise.promisedDate < input.today)
  ).length;
  const penalty = riskyCustomers * 7 + unpaidInvoices * 4 + lowStock * 3 + missedPromises * 6;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const actions: ReviewAction[] = [];

  if (riskyCustomers) {
    actions.push({ title: 'Call priority customers', message: `${riskyCustomers} customer${riskyCustomers === 1 ? '' : 's'} ${riskyCustomers === 1 ? 'needs' : 'need'} follow-up.`, priority: 'high' });
  }
  if (unpaidInvoices) {
    actions.push({ title: 'Review unpaid invoices', message: `${unpaidInvoices} invoice${unpaidInvoices === 1 ? '' : 's'} still need payment attention.`, priority: 'medium' });
  }
  if (lowStock) {
    actions.push({ title: 'Prepare reorder list', message: `${lowStock} product${lowStock === 1 ? '' : 's'} need stock review.`, priority: 'medium' });
  }
  if (!actions.length) {
    actions.push({ title: 'Business health looks steady', message: 'No major receivable, invoice, or stock issue is showing right now.', priority: 'low' });
  }

  return {
    score,
    label: score >= 82 ? 'Healthy' : score >= 62 ? 'Watch closely' : 'Needs attention',
    actions,
  };
}

export function buildWebMonthlyReview(input: {
  month: string;
  transactions: WorkspaceTransaction[];
  invoices: WorkspaceInvoice[];
  customers: WorkspaceCustomer[];
}): WebMonthlyReview {
  const monthTransactions = input.transactions.filter((transaction) => transaction.effectiveDate.startsWith(input.month));
  const monthInvoices = input.invoices.filter((invoice) => invoice.issueDate.startsWith(input.month));
  const payments = sum(monthTransactions.filter((transaction) => transaction.type === 'payment').map((entry) => entry.amount));
  const credits = sum(monthTransactions.filter((transaction) => transaction.type === 'credit').map((entry) => entry.amount));
  const invoiced = sum(monthInvoices.map((invoice) => invoice.totalAmount));
  const activeCustomers = input.customers.filter((customer) => !customer.isArchived).length;

  return {
    month: input.month,
    metrics: [
      { label: 'Payments', value: payments, tone: 'success' },
      { label: 'Credits', value: credits, tone: 'warning' },
      { label: 'Invoiced', value: invoiced, tone: 'primary' },
      { label: 'Customers', value: activeCustomers, tone: 'premium' },
    ],
    actions: [
      payments < credits
        ? { title: 'Collections need attention', message: 'Credits are higher than payments this month.', priority: 'high' }
        : { title: 'Collections look balanced', message: 'Payments are keeping pace with credit movement.', priority: 'low' },
      monthInvoices.length
        ? { title: 'Save month review', message: `${monthInvoices.length} invoice${monthInvoices.length === 1 ? ' is' : 's are'} included in this month’s review.`, priority: 'low' }
        : { title: 'No invoices this month', message: 'Create or review invoices before exporting the month summary.', priority: 'medium' },
    ],
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}
