import { getBusinessSettings, getDatabase, type BusinessSettings, type InvoiceWithItems } from '../database';
import { mapInvoice, mapInvoiceItem, mapTransaction } from '../database/mappers';
import type {
  InvoiceItemRow,
  InvoiceRow,
  LedgerTransactionRow,
} from '../database/types';
import { buildComplianceReportData, loadComplianceRuleContextForBusiness } from '../compliance';
import { mapBusinessToComplianceMetadata } from '../mapping';
import { roundCurrency } from '../tax/calculator';
import type {
  AccountantComplianceSummary,
  AccountantIntegrationPayload,
  AccountantTransactionExportRow,
} from './types';

type TransactionExportRow = LedgerTransactionRow & {
  customer_name: string | null;
};

export async function createAccountantIntegrationPayload(): Promise<AccountantIntegrationPayload> {
  const business = await getBusinessSettings();
  if (!business) {
    throw new Error('Business settings are required before creating an accountant export.');
  }

  const exportedAt = new Date().toISOString();
  const [transactions, invoices, complianceSummaries] = await Promise.all([
    readTransactionsForAccountant(),
    readInvoicesForAccountant(),
    generateComplianceSummaries(business, exportedAt),
  ]);

  return {
    schemaVersion: 1,
    appName: 'Orbit Ledger by Rudraix',
    exportedAt,
    business,
    data: {
      transactions,
      invoices,
      complianceSummaries,
    },
    futureIntegration: {
      apiReady: true,
      directIntegrationsEnabled: false,
    },
  };
}

export function serializeAccountantPayloadAsJson(payload: AccountantIntegrationPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function serializeAccountantPayloadAsCsv(payload: AccountantIntegrationPayload): string {
  const rows: Array<Record<string, unknown>> = [];
  const currency = payload.business?.currency ?? '';
  const countryCode = payload.business?.countryCode ?? '';

  for (const transaction of payload.data.transactions) {
    rows.push({
      section: 'transactions',
      record_type: transaction.type,
      id: transaction.id,
      parent_id: transaction.customerId,
      date: transaction.effectiveDate,
      name: transaction.customerName,
      description: transaction.note,
      amount: transaction.amount,
      quantity: '',
      price: '',
      tax_rate: '',
      subtotal: '',
      tax_amount: '',
      total_amount: '',
      status: '',
      currency,
      country_code: countryCode,
      metadata_json: JSON.stringify({
        createdAt: transaction.createdAt,
        paymentDetails: transaction.paymentDetails,
        paymentMode: transaction.paymentMode,
        paymentClearanceStatus: transaction.paymentClearanceStatus,
        paymentAttachments: transaction.paymentAttachments,
        syncStatus: transaction.syncStatus,
      }),
    });
  }

  for (const invoice of payload.data.invoices) {
    rows.push({
      section: 'invoices',
      record_type: 'invoice',
      id: invoice.id,
      parent_id: invoice.customerId,
      date: invoice.issueDate,
      name: invoice.invoiceNumber,
      description: invoice.notes,
      amount: '',
      quantity: '',
      price: '',
      tax_rate: '',
      subtotal: invoice.subtotal,
      tax_amount: invoice.taxAmount,
      total_amount: invoice.totalAmount,
      status: invoice.status,
      currency,
      country_code: countryCode,
      metadata_json: JSON.stringify({
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        syncStatus: invoice.syncStatus,
      }),
    });

    for (const item of invoice.items) {
      rows.push({
        section: 'invoice_items',
        record_type: 'invoice_item',
        id: item.id,
        parent_id: item.invoiceId,
        date: invoice.issueDate,
        name: item.name,
        description: item.description ?? '',
        amount: '',
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.taxRate,
        subtotal: roundCurrency(item.quantity * item.price),
        tax_amount: roundCurrency(item.total - item.quantity * item.price),
        total_amount: item.total,
        status: invoice.status,
        currency,
        country_code: countryCode,
        metadata_json: JSON.stringify({
          productId: item.productId,
          syncStatus: item.syncStatus,
        }),
      });
    }
  }

  for (const summary of payload.data.complianceSummaries) {
    rows.push(...complianceSummaryToCsvRows(summary, currency, countryCode));
  }

  return recordsToCsv(rows);
}

async function readTransactionsForAccountant(): Promise<AccountantTransactionExportRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TransactionExportRow>(
    `SELECT
      t.*,
      c.name AS customer_name
     FROM transactions t
     LEFT JOIN customers c ON c.id = t.customer_id
     ORDER BY t.effective_date ASC, t.created_at ASC`
  );

  return rows.map((row) => ({
    ...mapTransaction(row),
    customerName: row.customer_name,
  }));
}

async function readInvoicesForAccountant(): Promise<InvoiceWithItems[]> {
  const db = await getDatabase();
  const [invoiceRows, itemRows] = await Promise.all([
    db.getAllAsync<InvoiceRow>(
      `SELECT * FROM invoices
       ORDER BY issue_date ASC, created_at ASC`
    ),
    db.getAllAsync<InvoiceItemRow>(
      `SELECT * FROM invoice_items
       ORDER BY invoice_id ASC, rowid ASC`
    ),
  ]);
  const itemsByInvoiceId = new Map<string, ReturnType<typeof mapInvoiceItem>[]>();

  for (const itemRow of itemRows) {
    const item = mapInvoiceItem(itemRow);
    const items = itemsByInvoiceId.get(item.invoiceId) ?? [];
    items.push(item);
    itemsByInvoiceId.set(item.invoiceId, items);
  }

  return invoiceRows.map((invoiceRow) => {
    const invoice = mapInvoice(invoiceRow);
    return {
      ...invoice,
      items: itemsByInvoiceId.get(invoice.id) ?? [],
    };
  });
}

async function generateComplianceSummaries(
  business: BusinessSettings,
  generatedAt: string
): Promise<AccountantComplianceSummary[]> {
  const reportTypes: AccountantComplianceSummary['reportType'][] = [
    'tax_summary',
    'sales_summary',
    'dues_summary',
  ];
  const complianceContext = await loadComplianceRuleContextForBusiness(business);
  const reports = await Promise.all(
    reportTypes.map((reportType) => {
      const metadata = mapBusinessToComplianceMetadata({
        businessSettings: business,
        reportType,
        generatedAt,
        complianceContext,
      });

      return buildComplianceReportData(reportType, metadata, complianceContext);
    })
  );

  return reports.map((report, index) => ({
    reportType: reportTypes[index],
    data: report,
  }));
}

function complianceSummaryToCsvRows(
  summary: AccountantComplianceSummary,
  currency: string,
  countryCode: string
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [
    {
      section: 'compliance_summaries',
      record_type: summary.reportType,
      id: `${summary.reportType}_totals`,
      parent_id: '',
      date: summary.data.metadata.generatedAt,
      name: summary.reportType,
      description: summary.data.metadata.scopeNote,
      amount: '',
      quantity: '',
      price: '',
      tax_rate: '',
      subtotal: '',
      tax_amount: '',
      total_amount: '',
      status: '',
      currency,
      country_code: countryCode,
      metadata_json: JSON.stringify(summary.data.totals),
    },
  ];

  if ('taxByRate' in summary.data) {
    for (const row of summary.data.taxByRate) {
      rows.push({
        section: 'compliance_summaries',
        record_type: 'tax_by_rate',
        id: `tax_rate_${row.taxRate}`,
        parent_id: summary.reportType,
        date: summary.data.metadata.generatedAt,
        name: `${row.taxRate}%`,
        description: '',
        amount: '',
        quantity: row.itemCount,
        price: '',
        tax_rate: row.taxRate,
        subtotal: row.taxableAmount,
        tax_amount: row.taxAmount,
        total_amount: row.totalAmount,
        status: '',
        currency,
        country_code: countryCode,
        metadata_json: '',
      });
    }
  }

  if ('byStatus' in summary.data) {
    for (const row of summary.data.byStatus) {
      rows.push({
        section: 'compliance_summaries',
        record_type: 'sales_by_status',
        id: `sales_status_${row.status}`,
        parent_id: summary.reportType,
        date: summary.data.metadata.generatedAt,
        name: row.status,
        description: '',
        amount: '',
        quantity: row.invoiceCount,
        price: '',
        tax_rate: '',
        subtotal: row.subtotal,
        tax_amount: row.taxAmount,
        total_amount: row.totalAmount,
        status: row.status,
        currency,
        country_code: countryCode,
        metadata_json: '',
      });
    }
  }

  if ('topOutstandingCustomers' in summary.data) {
    for (const customer of summary.data.topOutstandingCustomers) {
      rows.push({
        section: 'compliance_summaries',
        record_type: 'top_outstanding_customer',
        id: customer.customerId,
        parent_id: summary.reportType,
        date: customer.latestActivityAt,
        name: customer.name,
        description: customer.phone,
        amount: customer.balance,
        quantity: '',
        price: '',
        tax_rate: '',
        subtotal: '',
        tax_amount: '',
        total_amount: '',
        status: 'outstanding',
        currency,
        country_code: countryCode,
        metadata_json: '',
      });
    }
  }

  return rows;
}

function recordsToCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [
    'section',
    'record_type',
    'id',
    'parent_id',
    'date',
    'name',
    'description',
    'amount',
    'quantity',
    'price',
    'tax_rate',
    'subtotal',
    'tax_amount',
    'total_amount',
    'status',
    'currency',
    'country_code',
    'metadata_json',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}
