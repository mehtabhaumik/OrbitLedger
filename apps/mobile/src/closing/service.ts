import { getBusinessSettings, getDatabase } from '../database';
import { getTodayDateInput, isFutureDateInput, isValidDateInput } from '../forms/validation';
import type {
  DailyClosingInvoiceRow,
  DailyClosingLedgerEntry,
  DailyClosingLowStockProduct,
  DailyClosingOutstandingCustomer,
  DailyClosingReport,
} from './types';

type MoneyRow = {
  value: number | null;
};

type CountRow = {
  value: number | null;
};

type TransactionSummaryRow = {
  credit_given: number | null;
  payment_received: number | null;
  transaction_count: number | null;
};

type InvoiceSummaryRow = {
  invoice_sales: number | null;
  invoice_tax: number | null;
  invoice_count: number | null;
};

type PromiseSummaryRow = {
  promises_due: number | null;
  promises_fulfilled: number | null;
  promises_missed: number | null;
};

type LedgerEntryRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  type: 'credit' | 'payment';
  amount: number;
  note: string | null;
  effective_date: string;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
};

type OutstandingCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
};

type LowStockProductRow = {
  id: string;
  name: string;
  stock_quantity: number;
  unit: string;
};

export async function buildDailyClosingReport(
  reportDate = getTodayDateInput()
): Promise<DailyClosingReport> {
  if (!isValidDateInput(reportDate)) {
    throw new Error('Choose a valid closing date.');
  }

  if (isFutureDateInput(reportDate)) {
    throw new Error('Closing report date cannot be in the future.');
  }

  const business = await getBusinessSettings();
  if (!business) {
    throw new Error('Business profile is required before generating a closing report.');
  }

  const db = await getDatabase();
  const [
    openingReceivable,
    closingReceivable,
    transactionSummary,
    invoiceSummary,
    newCustomers,
    remindersSent,
    promiseSummary,
    lowStockProducts,
    outstandingCustomers,
    ledgerEntries,
    invoices,
  ] = await Promise.all([
    getReceivableAsOf(reportDate, false),
    getReceivableAsOf(reportDate, true),
    db.getFirstAsync<TransactionSummaryRow>(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS credit_given,
        COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) AS payment_received,
        COUNT(*) AS transaction_count
       FROM transactions
       WHERE effective_date = ?`,
      reportDate
    ),
    db.getFirstAsync<InvoiceSummaryRow>(
      `SELECT
        COALESCE(SUM(total_amount), 0) AS invoice_sales,
        COALESCE(SUM(tax_amount), 0) AS invoice_tax,
        COUNT(*) AS invoice_count
       FROM invoices
       WHERE issue_date = ?
         AND status != 'cancelled'`,
      reportDate
    ),
    db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS value
       FROM customers
       WHERE substr(created_at, 1, 10) = ?`,
      reportDate
    ),
    db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS value
       FROM payment_reminders
       WHERE substr(created_at, 1, 10) = ?`,
      reportDate
    ),
    db.getFirstAsync<PromiseSummaryRow>(
      `SELECT
        COALESCE(SUM(CASE WHEN promised_date = ? AND status = 'open' THEN 1 ELSE 0 END), 0) AS promises_due,
        COALESCE(SUM(CASE WHEN status = 'fulfilled' AND substr(updated_at, 1, 10) = ? THEN 1 ELSE 0 END), 0) AS promises_fulfilled,
        COALESCE(SUM(CASE WHEN promised_date < ? AND status = 'open' THEN 1 ELSE 0 END), 0) AS promises_missed
       FROM payment_promises`,
      reportDate,
      reportDate,
      reportDate
    ),
    db.getAllAsync<LowStockProductRow>(
      `SELECT id, name, stock_quantity, unit
       FROM products
       WHERE stock_quantity > 0
         AND stock_quantity <= 5
       ORDER BY stock_quantity ASC, name COLLATE NOCASE ASC
       LIMIT 8`
    ),
    getTopOutstandingCustomersAtClose(reportDate),
    db.getAllAsync<LedgerEntryRow>(
      `SELECT
        t.id,
        t.customer_id,
        c.name AS customer_name,
        t.type,
        t.amount,
        t.note,
        t.effective_date,
        t.created_at
       FROM transactions t
       INNER JOIN customers c ON c.id = t.customer_id
       WHERE t.effective_date = ?
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT 25`,
      reportDate
    ),
    db.getAllAsync<InvoiceRow>(
      `SELECT
        i.id,
        i.invoice_number,
        c.name AS customer_name,
        i.subtotal,
        i.tax_amount,
        i.total_amount,
        i.status
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.issue_date = ?
         AND i.status != 'cancelled'
       ORDER BY i.created_at DESC, i.invoice_number COLLATE NOCASE ASC
       LIMIT 25`,
      reportDate
    ),
  ]);

  return {
    schemaVersion: 1,
    reportDate,
    generatedAt: new Date().toISOString(),
    business: {
      businessName: business.businessName,
      currency: business.currency,
      countryCode: business.countryCode,
      stateCode: business.stateCode,
    },
    totals: {
      openingReceivable,
      closingReceivable,
      creditGiven: transactionSummary?.credit_given ?? 0,
      paymentReceived: transactionSummary?.payment_received ?? 0,
      netLedgerMovement:
        (transactionSummary?.credit_given ?? 0) - (transactionSummary?.payment_received ?? 0),
      transactionCount: transactionSummary?.transaction_count ?? 0,
      invoiceSales: invoiceSummary?.invoice_sales ?? 0,
      invoiceTax: invoiceSummary?.invoice_tax ?? 0,
      invoiceCount: invoiceSummary?.invoice_count ?? 0,
      newCustomers: newCustomers?.value ?? 0,
      remindersSent: remindersSent?.value ?? 0,
      promisesDue: promiseSummary?.promises_due ?? 0,
      promisesFulfilled: promiseSummary?.promises_fulfilled ?? 0,
      promisesMissed: promiseSummary?.promises_missed ?? 0,
      lowStockProducts: lowStockProducts.length,
      outstandingCustomersAtClose: await countOutstandingCustomersAtClose(reportDate),
    },
    ledgerEntries: ledgerEntries.map(mapLedgerEntry),
    invoices: invoices.map(mapInvoiceRow),
    topOutstandingCustomers: outstandingCustomers.map(mapOutstandingCustomer),
    lowStockProducts: lowStockProducts.map(mapLowStockProduct),
  };
}

async function getReceivableAsOf(reportDate: string, includeDate: boolean): Promise<number> {
  const db = await getDatabase();
  const comparison = includeDate ? '<=' : '<';
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
       AND t.effective_date ${comparison} ?
      GROUP BY c.id
     )
     WHERE balance > 0`,
    reportDate
  );

  return row?.value ?? 0;
}

async function countOutstandingCustomersAtClose(reportDate: string): Promise<number> {
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
    reportDate
  );

  return row?.value ?? 0;
}

async function getTopOutstandingCustomersAtClose(
  reportDate: string
): Promise<OutstandingCustomerRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<OutstandingCustomerRow>(
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
          ), 0) AS balance
      FROM customers c
      LEFT JOIN transactions t
        ON t.customer_id = c.id
       AND t.effective_date <= ?
      WHERE c.is_archived = 0
      GROUP BY c.id
    )
    SELECT id, name, phone, balance
    FROM balances
    WHERE balance > 0
    ORDER BY balance DESC, name COLLATE NOCASE ASC
    LIMIT 5`,
    reportDate
  );
}

function mapLedgerEntry(row: LedgerEntryRow): DailyClosingLedgerEntry {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    type: row.type,
    amount: row.amount,
    note: row.note,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
  };
}

function mapInvoiceRow(row: InvoiceRow): DailyClosingInvoiceRow {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    status: row.status,
  };
}

function mapOutstandingCustomer(row: OutstandingCustomerRow): DailyClosingOutstandingCustomer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    balance: row.balance,
  };
}

function mapLowStockProduct(row: LowStockProductRow): DailyClosingLowStockProduct {
  return {
    id: row.id,
    name: row.name,
    stockQuantity: row.stock_quantity,
    unit: row.unit,
  };
}
