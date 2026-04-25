import type {
  BusinessSettings,
  ComplianceReportType,
  Customer,
  DocumentTemplateType,
  LedgerTransaction,
} from '../database';
import { roundCurrency } from '../tax/calculator';
import type {
  ComplianceDuesSummaryData,
  ComplianceReportMetadata,
  ComplianceSalesSummaryData,
  ComplianceTaxSummaryData,
} from '../compliance/types';
import { defaultComplianceRuleContext } from '../compliance/config';
import type {
  ComplianceDateRange,
  ComplianceDuesTotalsInput,
  ComplianceInvoiceTotalsInput,
  ComplianceMetadataInput,
  ComplianceOutstandingCustomerInput,
  ComplianceSalesStatusInput,
  ComplianceTaxRateInput,
  DocumentTemplateDataContext,
  InvoiceItemTaxInputSource,
  InvoiceTemplateContextInput,
  StatementTemplateContextInput,
  TaxEngineInvoiceItemInput,
  TaxEngineTransactionInput,
} from './types';

const complianceScopeNote =
  'This is an operational business data summary for review and export preparation. It is not a legal compliance filing.';

export function mapTransactionToTaxEngineInput(
  transaction: LedgerTransaction
): TaxEngineTransactionInput {
  return {
    source: 'transaction',
    transactionId: transaction.id,
    customerId: transaction.customerId,
    transactionType: transaction.type,
    effectiveDate: transaction.effectiveDate,
    taxableAmount: transaction.type === 'credit' ? roundCurrency(transaction.amount) : 0,
    paymentAmount: transaction.type === 'payment' ? roundCurrency(transaction.amount) : 0,
    note: transaction.note,
  };
}

export function mapTransactionsToTaxEngineInputs(
  transactions: LedgerTransaction[]
): TaxEngineTransactionInput[] {
  return transactions.map(mapTransactionToTaxEngineInput);
}

export function mapInvoiceItemToTaxEngineInput(
  item: InvoiceItemTaxInputSource
): TaxEngineInvoiceItemInput {
  return {
    source: 'invoice_item',
    invoiceId: item.invoiceId,
    invoiceItemId: item.id,
    productId: item.productId,
    itemName: item.name,
    itemPrice: item.price,
    quantity: item.quantity,
    taxRate: item.taxRate,
  };
}

export function mapInvoiceToDocumentTemplateContext(
  input: InvoiceTemplateContextInput
): DocumentTemplateDataContext {
  return {
    templateType: 'invoice',
    countryCode: normalizeCode(input.businessSettings.countryCode),
    regionCode: normalizeCode(input.businessSettings.stateCode),
    currency: normalizeCode(input.businessSettings.currency),
    sourceKind: 'invoice',
    sourceId: input.invoice.id,
    customerId: input.invoice.customerId ?? input.customer?.id ?? null,
    taxMode: input.businessSettings.taxMode,
    taxProfileVersion: input.businessSettings.taxProfileVersion,
    metadata: {
      invoiceNumber: input.invoice.invoiceNumber,
      issueDate: input.invoice.issueDate,
      status: input.invoice.status,
      itemCount: input.invoice.items.length,
      subtotal: input.invoice.subtotal,
      taxAmount: input.invoice.taxAmount,
      totalAmount: input.invoice.totalAmount,
    },
  };
}

export function mapStatementToDocumentTemplateContext(
  input: StatementTemplateContextInput
): DocumentTemplateDataContext {
  return {
    templateType: 'statement',
    countryCode: normalizeCode(input.businessSettings.countryCode),
    regionCode: normalizeCode(input.businessSettings.stateCode),
    currency: normalizeCode(input.businessSettings.currency),
    sourceKind: 'statement',
    sourceId: input.customer.id,
    customerId: input.customer.id,
    taxMode: input.businessSettings.taxMode,
    taxProfileVersion: input.businessSettings.taxProfileVersion,
    metadata: {
      customerName: input.customer.name,
      transactionCount: input.transactions.length,
      openingBalance: input.customer.openingBalance,
    },
  };
}

export function mapBusinessToDocumentTemplateLookup(
  businessSettings: BusinessSettings,
  templateType: DocumentTemplateType
): {
  countryCode: string;
  regionCode: string;
  templateType: DocumentTemplateType;
} {
  return {
    countryCode: normalizeCode(businessSettings.countryCode),
    regionCode: normalizeCode(businessSettings.stateCode),
    templateType,
  };
}

export function mapBusinessToComplianceMetadata(
  input: ComplianceMetadataInput
): ComplianceReportMetadata {
  const complianceContext = input.complianceContext ?? defaultComplianceRuleContext;

  return {
    appName: 'Orbit Ledger by Rudraix',
    reportType: input.reportType,
    countryCode: normalizeCode(input.businessSettings.countryCode),
    regionCode: normalizeCode(input.businessSettings.stateCode),
    generatedAt: input.generatedAt,
    currency: normalizeCode(input.businessSettings.currency),
    dateRange: normalizeComplianceDateRange(input.dateRange),
    scopeNote: complianceScopeNote,
    labels: complianceContext.labels,
    numberFormat: complianceContext.numberFormat,
    countryPackage: complianceContext.countryPackage,
    taxPack: complianceContext.taxPack,
    complianceConfig: complianceContext.complianceConfig,
  };
}

export function mapInvoiceTotalsToTaxSummaryTotals(
  totals: ComplianceInvoiceTotalsInput | null | undefined
): ComplianceTaxSummaryData['totals'] {
  return {
    invoiceCount: totals?.invoice_count ?? 0,
    taxableSales: roundCurrency(totals?.subtotal ?? 0),
    taxAmount: roundCurrency(totals?.tax_amount ?? 0),
    totalAmount: roundCurrency(totals?.total_amount ?? 0),
  };
}

export function mapTaxRateRowsToComplianceSummary(
  rows: ComplianceTaxRateInput[]
): ComplianceTaxSummaryData['taxByRate'] {
  return rows.map((row) => ({
    taxRate: row.tax_rate,
    itemCount: row.item_count ?? 0,
    taxableAmount: roundCurrency(row.taxable_amount ?? 0),
    taxAmount: roundCurrency(row.tax_amount ?? 0),
    totalAmount: roundCurrency(row.total_amount ?? 0),
  }));
}

export function mapInvoiceTotalsToSalesSummaryTotals(
  totals: ComplianceInvoiceTotalsInput | null | undefined
): ComplianceSalesSummaryData['totals'] {
  return {
    invoiceCount: totals?.invoice_count ?? 0,
    subtotal: roundCurrency(totals?.subtotal ?? 0),
    taxAmount: roundCurrency(totals?.tax_amount ?? 0),
    totalAmount: roundCurrency(totals?.total_amount ?? 0),
  };
}

export function mapSalesStatusRowsToComplianceSummary(
  rows: ComplianceSalesStatusInput[]
): ComplianceSalesSummaryData['byStatus'] {
  return rows.map((row) => ({
    status: row.status,
    invoiceCount: row.invoice_count ?? 0,
    subtotal: roundCurrency(row.subtotal ?? 0),
    taxAmount: roundCurrency(row.tax_amount ?? 0),
    totalAmount: roundCurrency(row.total_amount ?? 0),
  }));
}

export function mapDuesTotalsToComplianceSummary(
  totals: ComplianceDuesTotalsInput | null | undefined
): ComplianceDuesSummaryData['totals'] {
  return {
    activeCustomers: totals?.active_customers ?? 0,
    archivedCustomers: totals?.archived_customers ?? 0,
    customersWithDues: totals?.customers_with_dues ?? 0,
    customersWithAdvance: totals?.customers_with_advance ?? 0,
    totalReceivable: roundCurrency(totals?.total_receivable ?? 0),
    totalAdvance: roundCurrency(totals?.total_advance ?? 0),
    netBalance: roundCurrency(totals?.net_balance ?? 0),
  };
}

export function mapOutstandingCustomersToComplianceSummary(
  rows: ComplianceOutstandingCustomerInput[],
  generatedAt: string
): ComplianceDuesSummaryData['topOutstandingCustomers'] {
  return rows.map((row) => ({
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    balance: roundCurrency(row.balance ?? 0),
    latestActivityAt: row.latest_activity_at ?? generatedAt,
  }));
}

export function normalizeComplianceReportType(
  reportType: ComplianceReportType
): ComplianceReportType {
  if (
    reportType !== 'tax_summary' &&
    reportType !== 'sales_summary' &&
    reportType !== 'dues_summary'
  ) {
    throw new Error(`Unsupported compliance report type: ${reportType}`);
  }

  return reportType;
}

export function normalizeComplianceDateRange(
  dateRange?: ComplianceDateRange
): ComplianceReportMetadata['dateRange'] {
  const from = normalizeDate(dateRange?.from);
  const to = normalizeDate(dateRange?.to);

  if (from && to && from > to) {
    return { from: to, to: from };
  }

  return { from, to };
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  return value.trim().slice(0, 10);
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}
