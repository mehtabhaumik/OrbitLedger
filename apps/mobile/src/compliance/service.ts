import {
  getBusinessSettings,
  getCountryPackage,
  getDatabase,
  saveComplianceReport,
  type BusinessSettings,
  type ComplianceReportType,
} from '../database';
import {
  mapBusinessToComplianceMetadata,
  mapDuesTotalsToComplianceSummary,
  mapInvoiceTotalsToSalesSummaryTotals,
  mapInvoiceTotalsToTaxSummaryTotals,
  mapOutstandingCustomersToComplianceSummary,
  mapSalesStatusRowsToComplianceSummary,
  mapTaxRateRowsToComplianceSummary,
  normalizeComplianceReportType,
  type ComplianceDuesTotalsInput,
  type ComplianceInvoiceTotalsInput,
  type ComplianceOutstandingCustomerInput,
  type ComplianceSalesStatusInput,
  type ComplianceTaxRateInput,
} from '../mapping';
import type {
  ComplianceDuesSummaryData,
  ComplianceReportData,
  ComplianceReportMetadata,
  ComplianceRuleContext,
  ComplianceSalesSummaryData,
  ComplianceTaxSummaryData,
  GeneratedComplianceReport,
  GenerateComplianceReportInput,
} from './types';
import { buildComplianceRuleContext, defaultComplianceRuleContext } from './config';

export async function generateComplianceReport(
  input: GenerateComplianceReportInput
): Promise<GeneratedComplianceReport> {
  const businessSettings = await getBusinessSettings();
  if (!businessSettings) {
    throw new Error('Business settings are required before generating review summaries.');
  }

  const reportType = normalizeComplianceReportType(input.reportType);
  const generatedAt = new Date().toISOString();
  const complianceContext = await loadComplianceRuleContextForBusiness(businessSettings);
  const metadata = mapBusinessToComplianceMetadata({
    businessSettings,
    reportType,
    generatedAt,
    dateRange: input.dateRange,
    complianceContext,
  });
  const data = await buildComplianceReportData(reportType, metadata, complianceContext);
  const savedReport =
    input.persist === false
      ? null
      : await saveComplianceReport({
          countryCode: businessSettings.countryCode,
          reportType,
          generatedAt,
          reportDataJson: data,
        });

  return {
    data,
    savedReport,
  };
}

export async function buildComplianceReportData(
  reportType: ComplianceReportType,
  metadata: ComplianceReportMetadata,
  complianceContext: ComplianceRuleContext = defaultComplianceRuleContext
): Promise<ComplianceReportData> {
  switch (reportType) {
    case 'tax_summary':
      return buildTaxSummary(metadata as ComplianceTaxSummaryData['metadata'], complianceContext);
    case 'sales_summary':
      return buildSalesSummary(metadata as ComplianceSalesSummaryData['metadata'], complianceContext);
    case 'dues_summary':
      return buildDuesSummary(metadata as ComplianceDuesSummaryData['metadata'], complianceContext);
    default:
      return assertNever(reportType);
  }
}

export async function loadComplianceRuleContextForBusiness(
  businessSettings: BusinessSettings
): Promise<ComplianceRuleContext> {
  const countryPackage = await getCountryPackage({
    countryCode: businessSettings.countryCode,
    regionCode: businessSettings.stateCode,
  });

  return buildComplianceRuleContext(countryPackage);
}

async function buildTaxSummary(
  metadata: ComplianceTaxSummaryData['metadata'],
  complianceContext: ComplianceRuleContext
): Promise<ComplianceTaxSummaryData> {
  const db = await getDatabase();
  const statusFilter = buildInvoiceStatusExclusionFilter(complianceContext);
  const rangeFilter = buildInvoiceDateRangeFilter(metadata.dateRange);
  const totals = await db.getFirstAsync<ComplianceInvoiceTotalsInput>(
    `SELECT
      COUNT(*) AS invoice_count,
      COALESCE(SUM(subtotal), 0) AS subtotal,
      COALESCE(SUM(tax_amount), 0) AS tax_amount,
      COALESCE(SUM(total_amount), 0) AS total_amount
     FROM invoices
     WHERE 1 = 1
     ${statusFilter.sql}
     ${rangeFilter.sql}`,
    ...statusFilter.params,
    ...rangeFilter.params
  );
  const joinedStatusFilter = buildInvoiceStatusExclusionFilter(complianceContext, 'i');
  const joinedRangeFilter = buildInvoiceDateRangeFilter(metadata.dateRange, 'i.issue_date');
  const taxRows = await db.getAllAsync<ComplianceTaxRateInput>(
    `SELECT
      ii.tax_rate,
      COUNT(*) AS item_count,
      COALESCE(SUM(ii.quantity * ii.price), 0) AS taxable_amount,
      COALESCE(SUM(ii.total - (ii.quantity * ii.price)), 0) AS tax_amount,
      COALESCE(SUM(ii.total), 0) AS total_amount
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     WHERE 1 = 1
     ${joinedStatusFilter.sql}
     ${joinedRangeFilter.sql}
     GROUP BY ii.tax_rate
     ORDER BY ii.tax_rate ASC`,
    ...joinedStatusFilter.params,
    ...joinedRangeFilter.params
  );

  return {
    metadata,
    totals: mapInvoiceTotalsToTaxSummaryTotals(totals),
    taxByRate: mapTaxRateRowsToComplianceSummary(taxRows),
  };
}

async function buildSalesSummary(
  metadata: ComplianceSalesSummaryData['metadata'],
  complianceContext: ComplianceRuleContext
): Promise<ComplianceSalesSummaryData> {
  const db = await getDatabase();
  const statusFilter = buildInvoiceStatusExclusionFilter(complianceContext);
  const rangeFilter = buildInvoiceDateRangeFilter(metadata.dateRange);
  const totals = await db.getFirstAsync<ComplianceInvoiceTotalsInput>(
    `SELECT
      COUNT(*) AS invoice_count,
      COALESCE(SUM(subtotal), 0) AS subtotal,
      COALESCE(SUM(tax_amount), 0) AS tax_amount,
      COALESCE(SUM(total_amount), 0) AS total_amount
     FROM invoices
     WHERE 1 = 1
     ${statusFilter.sql}
     ${rangeFilter.sql}`,
    ...statusFilter.params,
    ...rangeFilter.params
  );
  const statusRows = await db.getAllAsync<ComplianceSalesStatusInput>(
    `SELECT
      status,
      COUNT(*) AS invoice_count,
      COALESCE(SUM(subtotal), 0) AS subtotal,
      COALESCE(SUM(tax_amount), 0) AS tax_amount,
      COALESCE(SUM(total_amount), 0) AS total_amount
     FROM invoices
     WHERE 1 = 1
     ${statusFilter.sql}
     ${rangeFilter.sql}
     GROUP BY status
     ORDER BY status ASC`,
    ...statusFilter.params,
    ...rangeFilter.params
  );

  return {
    metadata,
    totals: mapInvoiceTotalsToSalesSummaryTotals(totals),
    byStatus: mapSalesStatusRowsToComplianceSummary(statusRows),
  };
}

async function buildDuesSummary(
  metadata: ComplianceDuesSummaryData['metadata'],
  complianceContext: ComplianceRuleContext
): Promise<ComplianceDuesSummaryData> {
  const db = await getDatabase();
  const totals = await db.getFirstAsync<ComplianceDuesTotalsInput>(
    `WITH balances AS (
      SELECT
        c.id,
        c.name,
        c.phone,
        c.is_archived,
        c.opening_balance
          + COALESCE(SUM(
            CASE
              WHEN t.type = 'credit' THEN t.amount
              WHEN t.type = 'payment' THEN -t.amount
              ELSE 0
            END
          ), 0) AS balance
      FROM customers c
      LEFT JOIN transactions t ON t.customer_id = c.id
      GROUP BY c.id
    )
    SELECT
      COALESCE(SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END), 0) AS active_customers,
      COALESCE(SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END), 0) AS archived_customers,
      COALESCE(SUM(CASE WHEN is_archived = 0 AND balance > 0 THEN 1 ELSE 0 END), 0) AS customers_with_dues,
      COALESCE(SUM(CASE WHEN is_archived = 0 AND balance < 0 THEN 1 ELSE 0 END), 0) AS customers_with_advance,
      COALESCE(SUM(CASE WHEN is_archived = 0 AND balance > 0 THEN balance ELSE 0 END), 0) AS total_receivable,
      COALESCE(SUM(CASE WHEN is_archived = 0 AND balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS total_advance,
      COALESCE(SUM(CASE WHEN is_archived = 0 THEN balance ELSE 0 END), 0) AS net_balance
    FROM balances`
  );
  const topRows = await db.getAllAsync<ComplianceOutstandingCustomerInput>(
    `WITH balances AS (
      SELECT
        c.id AS customer_id,
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
        COALESCE(MAX(t.created_at), c.updated_at, c.created_at) AS latest_activity_at
      FROM customers c
      LEFT JOIN transactions t ON t.customer_id = c.id
      WHERE c.is_archived = 0
      GROUP BY c.id
    )
    SELECT *
    FROM balances
    WHERE balance > 0
    ORDER BY balance DESC, latest_activity_at DESC, name COLLATE NOCASE ASC
    LIMIT ?`,
    complianceContext.reportRules.topOutstandingCustomerLimit
  );

  return {
    metadata,
    totals: mapDuesTotalsToComplianceSummary(totals),
    topOutstandingCustomers: mapOutstandingCustomersToComplianceSummary(
      topRows,
      metadata.generatedAt
    ),
  };
}

function buildInvoiceStatusExclusionFilter(
  complianceContext: ComplianceRuleContext,
  tableAlias?: string
): {
  sql: string;
  params: string[];
} {
  const excludedStatuses = complianceContext.reportRules.excludedInvoiceStatuses
    .map((status) => status.trim())
    .filter(Boolean);

  if (!excludedStatuses.length) {
    return {
      sql: '',
      params: [],
    };
  }

  const statusColumn = tableAlias ? `${tableAlias}.status` : 'status';
  const placeholders = excludedStatuses.map(() => '?').join(', ');

  return {
    sql: `AND ${statusColumn} NOT IN (${placeholders})`,
    params: excludedStatuses,
  };
}

function buildInvoiceDateRangeFilter(
  dateRange: ComplianceReportMetadata['dateRange'],
  issueDateColumn = 'issue_date'
): {
  sql: string;
  params: string[];
} {
  const filters: string[] = [];
  const params: string[] = [];

  if (dateRange.from) {
    filters.push(`AND ${issueDateColumn} >= ?`);
    params.push(dateRange.from);
  }

  if (dateRange.to) {
    filters.push(`AND ${issueDateColumn} <= ?`);
    params.push(dateRange.to);
  }

  return {
    sql: filters.length ? `\n     ${filters.join('\n     ')}` : '',
    params,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported compliance report type: ${value}`);
}
