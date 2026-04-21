import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { BusinessSettings, ComplianceReport } from '../database';
import type {
  ComplianceDuesSummaryData,
  ComplianceReportData,
  ComplianceSalesSummaryData,
  ComplianceTaxSummaryData,
} from './types';

export type ComplianceReportExportFormat = 'json' | 'csv';

export type SavedComplianceReportExport = {
  fileName: string;
  uri: string;
  directoryUri: string;
  format: ComplianceReportExportFormat;
  mimeType: string;
  exportedAt: string;
  report: ComplianceReport;
  data: ComplianceReportData;
};

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const COMPLIANCE_EXPORTS_DIRECTORY_NAME = 'compliance-reports';

export async function createAndSaveComplianceReportExport({
  business,
  format,
  report,
}: {
  business: BusinessSettings;
  format: ComplianceReportExportFormat;
  report: ComplianceReport;
}): Promise<SavedComplianceReportExport> {
  const data = parseComplianceReportData(report);
  const exportedAt = new Date().toISOString();
  const fileName = buildComplianceReportFileName({
    businessName: business.businessName,
    exportedAt,
    format,
    report,
  });
  const contents =
    format === 'json'
      ? `${JSON.stringify(buildComplianceJsonExport(business, report, data, exportedAt), null, 2)}\n`
      : serializeComplianceReportAsCsv(business, report, data, exportedAt);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';

  try {
    const directory = getComplianceExportsDirectory();
    const file = new File(directory, fileName);
    if (file.exists) {
      file.delete();
    }

    file.write(contents);

    return {
      fileName,
      uri: file.uri,
      directoryUri: directory.uri,
      format,
      mimeType,
      exportedAt,
      report,
      data,
    };
  } catch {
    throw new Error('Compliance report export could not be saved locally.');
  }
}

export async function shareComplianceReportExport(input: {
  business: BusinessSettings;
  format: ComplianceReportExportFormat;
  report: ComplianceReport;
}): Promise<SavedComplianceReportExport> {
  const exportFile = await createAndSaveComplianceReportExport(input);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(exportFile.uri);
  if (!file.exists) {
    throw new Error('Saved compliance report export could not be found.');
  }

  await Sharing.shareAsync(exportFile.uri, {
    mimeType: exportFile.mimeType,
    dialogTitle: exportFile.fileName,
  });

  return exportFile;
}

export function parseComplianceReportData(report: ComplianceReport): ComplianceReportData {
  const parsed = JSON.parse(report.reportDataJson) as ComplianceReportData;

  if (!parsed || typeof parsed !== 'object' || !('metadata' in parsed) || !('totals' in parsed)) {
    throw new Error('Compliance report data is incomplete.');
  }

  return parsed;
}

export function buildComplianceReportFileName({
  businessName,
  exportedAt,
  format,
  report,
}: {
  businessName: string;
  exportedAt: string;
  format: ComplianceReportExportFormat;
  report: ComplianceReport;
}): string {
  const datePart = exportedAt
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 16);
  const businessPart = fileNamePart(businessName, 'Business');
  const reportPart = fileNamePart(report.reportType, 'Report');

  return `OrbitLedger_Compliance_${reportPart}_${businessPart}_${datePart}.${format}`;
}

function buildComplianceJsonExport(
  business: BusinessSettings,
  report: ComplianceReport,
  data: ComplianceReportData,
  exportedAt: string
) {
  return {
    schemaVersion: 1,
    appName: 'Orbit Ledger by Rudraix',
    exportedAt,
    business: {
      businessName: business.businessName,
      countryCode: business.countryCode,
      stateCode: business.stateCode,
      currency: business.currency,
    },
    report,
    data,
  };
}

function serializeComplianceReportAsCsv(
  business: BusinessSettings,
  report: ComplianceReport,
  data: ComplianceReportData,
  exportedAt: string
): string {
  const rows: Array<Record<string, unknown>> = [
    {
      section: 'metadata',
      metric: 'report_type',
      value: report.reportType,
      detail: data.metadata.scopeNote,
      currency: business.currency,
      country_code: data.metadata.countryCode,
      region_code: data.metadata.regionCode,
      generated_at: data.metadata.generatedAt,
      exported_at: exportedAt,
    },
  ];

  for (const [metric, value] of Object.entries(data.totals)) {
    rows.push({
      section: 'totals',
      metric,
      value,
      detail: '',
      currency: business.currency,
      country_code: data.metadata.countryCode,
      region_code: data.metadata.regionCode,
      generated_at: data.metadata.generatedAt,
      exported_at: exportedAt,
    });
  }

  if (isTaxSummary(data)) {
    for (const row of data.taxByRate) {
      rows.push({
        section: 'tax_by_rate',
        metric: `${row.taxRate}`,
        value: row.taxAmount,
        detail: JSON.stringify(row),
        currency: business.currency,
        country_code: data.metadata.countryCode,
        region_code: data.metadata.regionCode,
        generated_at: data.metadata.generatedAt,
        exported_at: exportedAt,
      });
    }
  }

  if (isSalesSummary(data)) {
    for (const row of data.byStatus) {
      rows.push({
        section: 'sales_by_status',
        metric: row.status,
        value: row.totalAmount,
        detail: JSON.stringify(row),
        currency: business.currency,
        country_code: data.metadata.countryCode,
        region_code: data.metadata.regionCode,
        generated_at: data.metadata.generatedAt,
        exported_at: exportedAt,
      });
    }
  }

  if (isDuesSummary(data)) {
    for (const row of data.topOutstandingCustomers) {
      rows.push({
        section: 'top_outstanding_customers',
        metric: row.name,
        value: row.balance,
        detail: JSON.stringify(row),
        currency: business.currency,
        country_code: data.metadata.countryCode,
        region_code: data.metadata.regionCode,
        generated_at: data.metadata.generatedAt,
        exported_at: exportedAt,
      });
    }
  }

  return recordsToCsv(rows);
}

function getComplianceExportsDirectory(): Directory {
  const directory = new Directory(
    Paths.document,
    DOCUMENTS_DIRECTORY_NAME,
    COMPLIANCE_EXPORTS_DIRECTORY_NAME
  );
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function isTaxSummary(data: ComplianceReportData): data is ComplianceTaxSummaryData {
  return data.metadata.reportType === 'tax_summary';
}

function isSalesSummary(data: ComplianceReportData): data is ComplianceSalesSummaryData {
  return data.metadata.reportType === 'sales_summary';
}

function isDuesSummary(data: ComplianceReportData): data is ComplianceDuesSummaryData {
  return data.metadata.reportType === 'dues_summary';
}

function recordsToCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [
    'section',
    'metric',
    'value',
    'detail',
    'currency',
    'country_code',
    'region_code',
    'generated_at',
    'exported_at',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function fileNamePart(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');

  return sanitized || fallback;
}
