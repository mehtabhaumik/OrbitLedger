import { getBusinessSettings, getDatabase } from '../database';
import { getDateInputFromDate, getTodayDateInput } from '../forms/validation';
import type {
  BusinessHealthActionItem,
  BusinessHealthCustomer,
  BusinessHealthLowStockProduct,
  BusinessHealthSnapshot,
  BusinessHealthTone,
} from './types';

type MoneySummaryRow = {
  payments_received: number | null;
  credit_given: number | null;
  invoice_sales: number | null;
};

type CountRow = {
  value: number | null;
};

type BalanceRow = {
  value: number | null;
};

type HealthCustomerRow = {
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

type LowStockProductRow = {
  id: string;
  name: string;
  stock_quantity: number;
  unit: string;
};

export async function buildBusinessHealthSnapshot(
  endDate = getTodayDateInput()
): Promise<BusinessHealthSnapshot> {
  const period = buildHealthPeriod(endDate);
  const business = await getBusinessSettings();
  if (!business) {
    throw new Error('Business profile is required before building a health snapshot.');
  }

  const db = await getDatabase();
  const [
    currentSummary,
    previousSummary,
    currentReceivable,
    previousReceivable,
    outstandingCustomerCount,
    customerRows,
    lowStockRows,
    missedPromiseCount,
  ] = await Promise.all([
    db.getFirstAsync<MoneySummaryRow>(
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
           AND issue_date <= ?) AS invoice_sales`,
      period.startDate,
      period.endDate,
      period.startDate,
      period.endDate,
      period.startDate,
      period.endDate
    ),
    db.getFirstAsync<MoneySummaryRow>(
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
           AND issue_date <= ?) AS invoice_sales`,
      period.previousStartDate,
      period.previousEndDate,
      period.previousStartDate,
      period.previousEndDate,
      period.previousStartDate,
      period.previousEndDate
    ),
    getReceivableAsOf(period.endDate),
    getReceivableAsOf(period.previousEndDate),
    countOutstandingCustomersAsOf(period.endDate),
    db.getAllAsync<HealthCustomerRow>(
      `WITH balances AS (
        SELECT
          c.id,
          c.name,
          c.phone,
          c.opening_balance
            + COALESCE(SUM(
              CASE
                WHEN t.type = 'credit' THEN t.amount
                WHEN t.type = 'payment' THEN -t.amount
                ELSE 0
              END
            ), 0) AS balance,
          COALESCE(SUM(CASE
            WHEN t.type = 'payment' AND t.effective_date >= ? AND t.effective_date <= ?
            THEN t.amount ELSE 0 END), 0) AS payments_received,
          COALESCE(SUM(CASE
            WHEN t.type = 'credit' AND t.effective_date >= ? AND t.effective_date <= ?
            THEN t.amount ELSE 0 END), 0) AS credit_given,
          MAX(CASE WHEN t.type = 'payment' THEN t.effective_date ELSE NULL END) AS last_payment_at,
          MIN(CASE WHEN t.type = 'credit' THEN t.effective_date ELSE NULL END) AS oldest_credit_at,
          MAX(t.effective_date) AS latest_activity_at
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id
        WHERE c.is_archived = 0
        GROUP BY c.id
      ),
      invoice_totals AS (
        SELECT
          customer_id,
          COALESCE(SUM(total_amount), 0) AS invoice_sales
        FROM invoices
        WHERE status != 'cancelled'
          AND issue_date >= ?
          AND issue_date <= ?
          AND customer_id IS NOT NULL
        GROUP BY customer_id
      )
      SELECT
        b.id,
        b.name,
        b.phone,
        b.balance,
        b.payments_received,
        b.credit_given,
        COALESCE(i.invoice_sales, 0) AS invoice_sales,
        b.last_payment_at,
        b.oldest_credit_at,
        b.latest_activity_at
      FROM balances b
      LEFT JOIN invoice_totals i ON i.customer_id = b.id
      ORDER BY (b.payments_received + b.credit_given + COALESCE(i.invoice_sales, 0)) DESC,
        b.balance DESC,
        b.name COLLATE NOCASE ASC
      LIMIT 80`,
      period.startDate,
      period.endDate,
      period.startDate,
      period.endDate,
      period.startDate,
      period.endDate
    ),
    db.getAllAsync<LowStockProductRow>(
      `SELECT id, name, stock_quantity, unit
       FROM products
       WHERE stock_quantity > 0
         AND stock_quantity <= 5
       ORDER BY stock_quantity ASC, name COLLATE NOCASE ASC
       LIMIT 5`
    ),
    db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS value
       FROM payment_promises
       WHERE promised_date < ?
         AND status = 'open'`,
      period.endDate
    ),
  ]);

  const customers = customerRows.map(mapHealthCustomer);
  const riskyCustomers = customers
    .filter((customer) => isRiskyCustomer(customer, period.startDate))
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 5);
  const improvingCustomers = customers
    .filter((customer) => customer.balance > 0 && customer.paymentsReceived > customer.creditGiven)
    .sort((left, right) => right.paymentsReceived - left.paymentsReceived)
    .slice(0, 5);
  const bestCustomers = customers
    .filter((customer) => customer.paymentsReceived + customer.invoiceSales + customer.creditGiven > 0)
    .sort(
      (left, right) =>
        right.paymentsReceived +
        right.invoiceSales +
        right.creditGiven -
        (left.paymentsReceived + left.invoiceSales + left.creditGiven)
    )
    .slice(0, 5);

  const paymentsReceived = currentSummary?.payments_received ?? 0;
  const creditGiven = currentSummary?.credit_given ?? 0;
  const collectionRate = calculateCollectionRate(paymentsReceived, creditGiven, currentReceivable);
  const totals = {
    currentReceivable,
    previousReceivable,
    receivableChange: currentReceivable - previousReceivable,
    paymentsReceived,
    previousPaymentsReceived: previousSummary?.payments_received ?? 0,
    creditGiven,
    previousCreditGiven: previousSummary?.credit_given ?? 0,
    invoiceSales: currentSummary?.invoice_sales ?? 0,
    previousInvoiceSales: previousSummary?.invoice_sales ?? 0,
    collectionRate,
    outstandingCustomerCount,
    riskyCustomerCount: riskyCustomers.length,
    improvingCustomerCount: improvingCustomers.length,
    missedPromiseCount: missedPromiseCount?.value ?? 0,
    lowStockProductCount: lowStockRows.length,
  };
  const score = buildHealthScore(totals);

  return {
    generatedAt: new Date().toISOString(),
    period,
    business: {
      businessName: business.businessName,
      currency: business.currency,
    },
    score,
    totals,
    actionItems: buildActionItems(totals),
    bestCustomers,
    riskyCustomers,
    improvingCustomers,
    lowStockProducts: lowStockRows.map(mapLowStockProduct),
  };
}

function buildHealthPeriod(endDate: string): BusinessHealthSnapshot['period'] {
  const end = new Date(`${endDate}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 29);

  return {
    label: 'Last 30 days',
    startDate: getDateInputFromDate(start),
    endDate,
    previousStartDate: getDateInputFromDate(previousStart),
    previousEndDate: getDateInputFromDate(previousEnd),
  };
}

async function getReceivableAsOf(date: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<BalanceRow>(
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

async function countOutstandingCustomersAsOf(date: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CountRow>(
    `WITH balances AS (
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
    SELECT COUNT(*) AS value
    FROM balances
    WHERE balance > 0`,
    date
  );

  return row?.value ?? 0;
}

function calculateCollectionRate(
  paymentsReceived: number,
  creditGiven: number,
  currentReceivable: number
): number {
  const collectionBase = paymentsReceived + creditGiven + Math.max(currentReceivable, 0);
  if (collectionBase <= 0) {
    return 100;
  }

  return Math.round((paymentsReceived / collectionBase) * 100);
}

function buildHealthScore(totals: BusinessHealthSnapshot['totals']): BusinessHealthSnapshot['score'] {
  let score = 100;

  if (totals.receivableChange > 0) {
    score -= totals.receivableChange > totals.paymentsReceived ? 16 : 8;
  }

  if (totals.collectionRate < 25) {
    score -= 18;
  } else if (totals.collectionRate < 45) {
    score -= 10;
  }

  score -= Math.min(totals.riskyCustomerCount * 5, 20);
  score -= Math.min(totals.missedPromiseCount * 6, 18);
  score -= Math.min(totals.lowStockProductCount * 3, 9);

  const value = Math.max(0, Math.min(100, Math.round(score)));
  const tone = getScoreTone(value);

  return {
    value,
    tone,
    label:
      tone === 'healthy'
        ? 'Healthy'
        : tone === 'watch'
          ? 'Watch closely'
          : 'Action needed',
    helper:
      tone === 'healthy'
        ? 'Collections and daily signals look steady.'
        : tone === 'watch'
          ? 'A few business signals need attention.'
          : 'Prioritize collections and follow-up today.',
  };
}

function getScoreTone(value: number): BusinessHealthTone {
  if (value >= 76) {
    return 'healthy';
  }

  if (value >= 52) {
    return 'watch';
  }

  return 'action';
}

function buildActionItems(totals: BusinessHealthSnapshot['totals']): BusinessHealthActionItem[] {
  const actions: BusinessHealthActionItem[] = [];

  if (totals.riskyCustomerCount > 0 || totals.missedPromiseCount > 0) {
    actions.push({
      id: 'collect_due_customers',
      title: 'Follow up dues first',
      message: `${totals.riskyCustomerCount} customers need attention and ${totals.missedPromiseCount} promises are missed.`,
      priority: 'high',
      actionLabel: 'Open Get Paid',
      target: 'get_paid',
    });
  }

  if (totals.receivableChange > 0) {
    actions.push({
      id: 'receivable_increased',
      title: 'Receivables increased',
      message: 'Review today’s credit movement and record payments before balances become stale.',
      priority: 'medium',
      actionLabel: 'Daily Closing',
      target: 'daily_closing',
    });
  }

  if (totals.collectionRate < 45) {
    actions.push({
      id: 'low_collection_rate',
      title: 'Collection rate is low',
      message: 'Payments are not keeping pace with credit and open dues in this period.',
      priority: 'medium',
      actionLabel: 'View Customers',
      target: 'customers',
    });
  }

  if (totals.lowStockProductCount > 0) {
    actions.push({
      id: 'low_stock',
      title: 'Check low stock',
      message: `${totals.lowStockProductCount} products are at 5 units or below.`,
      priority: 'low',
      actionLabel: 'Open Products',
      target: 'products',
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'keep_rhythm',
      title: 'Keep the daily rhythm',
      message: 'Your health signals look steady. Keep recording payments and closing the day.',
      priority: 'low',
      actionLabel: 'Daily Closing',
      target: 'daily_closing',
    });
  }

  return actions.slice(0, 4);
}

function isRiskyCustomer(customer: BusinessHealthCustomer, periodStartDate: string): boolean {
  if (customer.balance <= 0) {
    return false;
  }

  if (!customer.lastPaymentAt) {
    return true;
  }

  return customer.lastPaymentAt < periodStartDate || customer.creditGiven > customer.paymentsReceived;
}

function mapHealthCustomer(row: HealthCustomerRow): BusinessHealthCustomer {
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

function mapLowStockProduct(row: LowStockProductRow): BusinessHealthLowStockProduct {
  return {
    id: row.id,
    name: row.name,
    stockQuantity: row.stock_quantity,
    unit: row.unit,
  };
}
