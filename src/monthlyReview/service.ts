import { getBusinessSettings, getDatabase } from '../database';
import { getDateInputFromDate, getTodayDateInput } from '../forms/validation';
import type {
  MonthlyBusinessReview,
  MonthlyReviewActionItem,
  MonthlyReviewCustomer,
} from './types';

type MoneyRow = {
  value: number | null;
};

type CountRow = {
  value: number | null;
};

type MonthSummaryRow = {
  payments_received: number | null;
  credit_given: number | null;
  invoice_sales: number | null;
  invoice_tax: number | null;
  new_customers: number | null;
  reminders_sent: number | null;
  missed_payment_promises: number | null;
};

type CustomerInsightRow = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  payments_received: number;
  credit_given: number;
  invoice_sales: number;
  last_payment_at: string | null;
  oldest_credit_at: string | null;
  latest_activity_at: string | null;
};

type LowStockCountRow = {
  value: number | null;
};

export async function buildMonthlyBusinessReview(
  monthKey = getTodayDateInput().slice(0, 7)
): Promise<MonthlyBusinessReview> {
  const month = buildMonthRange(monthKey);
  const business = await getBusinessSettings();
  if (!business) {
    throw new Error('Business profile is required before building a monthly review.');
  }

  const db = await getDatabase();
  const [
    currentSummary,
    previousSummary,
    monthEndReceivable,
    previousMonthEndReceivable,
    activeCustomers,
    lowStockCount,
    customerRows,
  ] = await Promise.all([
    db.getFirstAsync<MonthSummaryRow>(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0)
         FROM transactions
         WHERE type = 'payment'
           AND effective_date >= ?
           AND effective_date <= ?) AS payments_received,
        (SELECT COALESCE(SUM(amount), 0)
         FROM transactions
         WHERE type = 'credit'
           AND effective_date >= ?
           AND effective_date <= ?) AS credit_given,
        (SELECT COALESCE(SUM(total_amount), 0)
         FROM invoices
         WHERE status != 'cancelled'
           AND issue_date >= ?
           AND issue_date <= ?) AS invoice_sales,
        (SELECT COALESCE(SUM(tax_amount), 0)
         FROM invoices
         WHERE status != 'cancelled'
           AND issue_date >= ?
           AND issue_date <= ?) AS invoice_tax,
        (SELECT COUNT(*)
         FROM customers
         WHERE substr(created_at, 1, 10) >= ?
           AND substr(created_at, 1, 10) <= ?) AS new_customers,
        (SELECT COUNT(*)
         FROM payment_reminders
         WHERE substr(created_at, 1, 10) >= ?
           AND substr(created_at, 1, 10) <= ?) AS reminders_sent,
        (SELECT COUNT(*)
         FROM payment_promises
         WHERE promised_date <= ?
           AND status = 'open') AS missed_payment_promises`,
      month.startDate,
      month.endDate,
      month.startDate,
      month.endDate,
      month.startDate,
      month.endDate,
      month.startDate,
      month.endDate,
      month.startDate,
      month.endDate,
      month.startDate,
      month.endDate,
      month.endDate
    ),
    db.getFirstAsync<MonthSummaryRow>(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0)
         FROM transactions
         WHERE type = 'payment'
           AND effective_date >= ?
           AND effective_date <= ?) AS payments_received,
        (SELECT COALESCE(SUM(amount), 0)
         FROM transactions
         WHERE type = 'credit'
           AND effective_date >= ?
           AND effective_date <= ?) AS credit_given,
        (SELECT COALESCE(SUM(total_amount), 0)
         FROM invoices
         WHERE status != 'cancelled'
           AND issue_date >= ?
           AND issue_date <= ?) AS invoice_sales,
        (SELECT COALESCE(SUM(tax_amount), 0)
         FROM invoices
         WHERE status != 'cancelled'
           AND issue_date >= ?
           AND issue_date <= ?) AS invoice_tax,
        0 AS new_customers,
        0 AS reminders_sent,
        0 AS missed_payment_promises`,
      month.previousStartDate,
      month.previousEndDate,
      month.previousStartDate,
      month.previousEndDate,
      month.previousStartDate,
      month.previousEndDate,
      month.previousStartDate,
      month.previousEndDate
    ),
    getReceivableAsOf(month.endDate),
    getReceivableAsOf(month.previousEndDate),
    countActiveCustomers(month.startDate, month.endDate),
    db.getFirstAsync<LowStockCountRow>(
      `SELECT COUNT(*) AS value
       FROM products
       WHERE stock_quantity > 0
         AND stock_quantity <= 5`
    ),
    db.getAllAsync<CustomerInsightRow>(
      `WITH transaction_totals AS (
        SELECT
          customer_id,
          COALESCE(SUM(CASE WHEN type = 'payment' AND effective_date >= ? AND effective_date <= ? THEN amount ELSE 0 END), 0) AS payments_received,
          COALESCE(SUM(CASE WHEN type = 'credit' AND effective_date >= ? AND effective_date <= ? THEN amount ELSE 0 END), 0) AS credit_given,
          MAX(CASE WHEN type = 'payment' THEN effective_date ELSE NULL END) AS last_payment_at,
          MIN(CASE WHEN type = 'credit' THEN effective_date ELSE NULL END) AS oldest_credit_at,
          MAX(effective_date) AS latest_activity_at,
          COALESCE(SUM(CASE
            WHEN effective_date <= ? AND type = 'credit' THEN amount
            WHEN effective_date <= ? AND type = 'payment' THEN -amount
            ELSE 0
          END), 0) AS transaction_balance
        FROM transactions
        GROUP BY customer_id
      ),
      invoice_totals AS (
        SELECT
          customer_id,
          COALESCE(SUM(total_amount), 0) AS invoice_sales,
          MAX(issue_date) AS latest_invoice_at
        FROM invoices
        WHERE status != 'cancelled'
          AND issue_date >= ?
          AND issue_date <= ?
          AND customer_id IS NOT NULL
        GROUP BY customer_id
      )
      SELECT
        c.id,
        c.name,
        c.phone,
        c.opening_balance + COALESCE(t.transaction_balance, 0) AS balance,
        COALESCE(t.payments_received, 0) AS payments_received,
        COALESCE(t.credit_given, 0) AS credit_given,
        COALESCE(i.invoice_sales, 0) AS invoice_sales,
        t.last_payment_at,
        t.oldest_credit_at,
        COALESCE(t.latest_activity_at, i.latest_invoice_at, c.updated_at, c.created_at) AS latest_activity_at
      FROM customers c
      LEFT JOIN transaction_totals t ON t.customer_id = c.id
      LEFT JOIN invoice_totals i ON i.customer_id = c.id
      WHERE c.is_archived = 0
      ORDER BY (COALESCE(t.payments_received, 0) + COALESCE(t.credit_given, 0) + COALESCE(i.invoice_sales, 0)) DESC,
        balance DESC,
        c.name COLLATE NOCASE ASC
      LIMIT 120`,
      month.startDate,
      month.endDate,
      month.startDate,
      month.endDate,
      month.endDate,
      month.endDate,
      month.startDate,
      month.endDate
    ),
  ]);

  const customers = customerRows.map(mapMonthlyCustomer);
  const topCustomersByPayments = customers
    .filter((customer) => customer.paymentsReceived > 0)
    .sort((left, right) => right.paymentsReceived - left.paymentsReceived)
    .slice(0, 5);
  const topCustomersBySales = customers
    .filter((customer) => customer.invoiceSales > 0)
    .sort((left, right) => right.invoiceSales - left.invoiceSales)
    .slice(0, 5);
  const highestDues = customers
    .filter((customer) => customer.balance > 0)
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 5);
  const slowPayingCustomers = customers
    .filter((customer) => isSlowPayingCustomer(customer, month.startDate))
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 5);
  const improvedCustomers = customers
    .filter((customer) => customer.balance > 0 && customer.paymentsReceived > customer.creditGiven)
    .sort((left, right) => right.paymentsReceived - left.paymentsReceived)
    .slice(0, 5);

  const paymentsReceived = currentSummary?.payments_received ?? 0;
  const previousPaymentsReceived = previousSummary?.payments_received ?? 0;
  const creditGiven = currentSummary?.credit_given ?? 0;
  const previousCreditGiven = previousSummary?.credit_given ?? 0;
  const invoiceSales = currentSummary?.invoice_sales ?? 0;
  const previousInvoiceSales = previousSummary?.invoice_sales ?? 0;
  const invoiceTax = currentSummary?.invoice_tax ?? 0;
  const previousInvoiceTax = previousSummary?.invoice_tax ?? 0;
  const totals = {
    monthEndReceivable,
    previousMonthEndReceivable,
    receivableChange: monthEndReceivable - previousMonthEndReceivable,
    paymentsReceived,
    previousPaymentsReceived,
    paymentsChange: paymentsReceived - previousPaymentsReceived,
    creditGiven,
    previousCreditGiven,
    creditChange: creditGiven - previousCreditGiven,
    invoiceSales,
    previousInvoiceSales,
    salesChange: invoiceSales - previousInvoiceSales,
    invoiceTax,
    previousInvoiceTax,
    taxChange: invoiceTax - previousInvoiceTax,
    netReceivableMovement: monthEndReceivable - previousMonthEndReceivable,
    newCustomers: currentSummary?.new_customers ?? 0,
    activeCustomers,
    remindersSent: currentSummary?.reminders_sent ?? 0,
    missedPaymentPromises: currentSummary?.missed_payment_promises ?? 0,
    lowStockCount: lowStockCount?.value ?? 0,
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    month,
    business: {
      businessName: business.businessName,
      currency: business.currency,
      countryCode: business.countryCode,
      stateCode: business.stateCode,
    },
    totals,
    actionItems: buildActionItems(totals, highestDues.length),
    topCustomersByPayments,
    topCustomersBySales,
    highestDues,
    slowPayingCustomers,
    improvedCustomers,
  };
}

function buildMonthRange(monthKey: string): MonthlyBusinessReview['month'] {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error('Choose a valid review month.');
  }

  const monthStart = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(monthStart.getTime())) {
    throw new Error('Choose a valid review month.');
  }

  const todayMonthKey = getTodayDateInput().slice(0, 7);
  if (monthKey > todayMonthKey) {
    throw new Error('Monthly review cannot be generated for a future month.');
  }

  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);

  const previousStart = new Date(monthStart);
  previousStart.setMonth(previousStart.getMonth() - 1);
  const previousEnd = new Date(monthStart);
  previousEnd.setDate(0);

  return {
    monthKey,
    label: formatMonthLabel(monthStart),
    startDate: getDateInputFromDate(monthStart),
    endDate: getDateInputFromDate(monthEnd),
    previousMonthKey: getDateInputFromDate(previousStart).slice(0, 7),
    previousLabel: formatMonthLabel(previousStart),
    previousStartDate: getDateInputFromDate(previousStart),
    previousEndDate: getDateInputFromDate(previousEnd),
  };
}

async function getReceivableAsOf(date: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<MoneyRow>(
    `SELECT COALESCE(SUM(balance), 0) AS value
     FROM (
      SELECT
        c.id,
        c.opening_balance
          + COALESCE(SUM(
            CASE
              WHEN t.type = 'credit' THEN t.amount
              WHEN t.type = 'payment' THEN -t.amount
              ELSE 0
            END
          ), 0) AS balance
      FROM customers c
      LEFT JOIN transactions t
        ON t.customer_id = c.id
       AND t.effective_date <= ?
      WHERE c.is_archived = 0
      GROUP BY c.id
     )
     WHERE balance > 0`,
    date
  );

  return row?.value ?? 0;
}

async function countActiveCustomers(startDate: string, endDate: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CountRow>(
    `SELECT COUNT(DISTINCT customer_id) AS value
     FROM (
      SELECT customer_id
      FROM transactions
      WHERE effective_date >= ?
        AND effective_date <= ?
      UNION ALL
      SELECT customer_id
      FROM invoices
      WHERE customer_id IS NOT NULL
        AND issue_date >= ?
        AND issue_date <= ?
        AND status != 'cancelled'
     )`,
    startDate,
    endDate,
    startDate,
    endDate
  );

  return row?.value ?? 0;
}

function buildActionItems(
  totals: MonthlyBusinessReview['totals'],
  highestDueCount: number
): MonthlyReviewActionItem[] {
  const actions: MonthlyReviewActionItem[] = [];

  if (highestDueCount > 0 || totals.missedPaymentPromises > 0) {
    actions.push({
      id: 'follow_up_dues',
      title: 'Follow up top dues',
      message: `${highestDueCount} high-balance customers and ${totals.missedPaymentPromises} missed promises need review.`,
      priority: 'high',
      actionLabel: 'Open Get Paid',
      target: 'get_paid',
    });
  }

  if (totals.monthEndReceivable > 0) {
    actions.push({
      id: 'generate_statements',
      title: 'Generate customer statements',
      message: 'Prepare month-end statements for customers with outstanding balances.',
      priority: 'medium',
      actionLabel: 'Statement Batch',
      target: 'statement_batch',
    });
  }

  if (totals.lowStockCount > 0) {
    actions.push({
      id: 'review_reorder',
      title: 'Review reorder needs',
      message: `${totals.lowStockCount} stock item${totals.lowStockCount === 1 ? '' : 's'} need reorder attention.`,
      priority: 'medium',
      actionLabel: 'Reorder Assistant',
      target: 'reorder_assistant',
    });
  }

  actions.push({
    id: 'export_backup',
    title: 'Export a backup',
    message: 'Save a private copy after completing month-end review.',
    priority: totals.activeCustomers > 0 ? 'medium' : 'low',
    actionLabel: 'Open Backup',
    target: 'backup',
  });

  actions.push({
    id: 'review_compliance',
    title: 'Review compliance reports',
    message: 'Check sales, dues, and tax summaries before sharing records.',
    priority: totals.invoiceSales > 0 || totals.invoiceTax > 0 ? 'medium' : 'low',
    actionLabel: 'Compliance Reports',
    target: 'compliance',
  });

  return actions.slice(0, 4);
}

function isSlowPayingCustomer(customer: MonthlyReviewCustomer, monthStartDate: string): boolean {
  if (customer.balance <= 0) {
    return false;
  }

  if (!customer.lastPaymentAt) {
    return true;
  }

  return customer.lastPaymentAt < monthStartDate || customer.creditGiven > customer.paymentsReceived;
}

function mapMonthlyCustomer(row: CustomerInsightRow): MonthlyReviewCustomer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    balance: row.balance,
    paymentsReceived: row.payments_received,
    creditGiven: row.credit_given,
    invoiceSales: row.invoice_sales,
    lastPaymentAt: row.last_payment_at,
    oldestCreditAt: row.oldest_credit_at,
    latestActivityAt: row.latest_activity_at,
  };
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
