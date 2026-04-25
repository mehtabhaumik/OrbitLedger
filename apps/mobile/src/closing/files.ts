import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type {
  DailyClosingExportFormat,
  DailyClosingReport,
  SavedDailyClosingReportExport,
} from './types';

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const DAILY_CLOSING_DIRECTORY_NAME = 'daily-closing';

export async function createAndSaveDailyClosingReportExport({
  format,
  report,
}: {
  format: DailyClosingExportFormat;
  report: DailyClosingReport;
}): Promise<SavedDailyClosingReportExport> {
  const exportedAt = new Date().toISOString();
  const fileName = buildDailyClosingReportFileName({
    businessName: report.business.businessName,
    exportedAt,
    format,
    reportDate: report.reportDate,
  });
  const contents =
    format === 'json'
      ? `${JSON.stringify(buildDailyClosingJsonExport(report, exportedAt), null, 2)}\n`
      : serializeDailyClosingReportAsCsv(report, exportedAt);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';

  try {
    const directory = getDailyClosingDirectory();
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
    };
  } catch {
    throw new Error('Daily closing report export could not be saved locally.');
  }
}

export async function shareDailyClosingReportExport(input: {
  format: DailyClosingExportFormat;
  report: DailyClosingReport;
}): Promise<SavedDailyClosingReportExport> {
  const exportFile = await createAndSaveDailyClosingReportExport(input);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(exportFile.uri);
  if (!file.exists) {
    throw new Error('Saved daily closing report export could not be found.');
  }

  await Sharing.shareAsync(exportFile.uri, {
    mimeType: exportFile.mimeType,
    dialogTitle: exportFile.fileName,
  });

  return exportFile;
}

export function buildDailyClosingReportFileName({
  businessName,
  exportedAt,
  format,
  reportDate,
}: {
  businessName: string;
  exportedAt: string;
  format: DailyClosingExportFormat;
  reportDate: string;
}): string {
  const exportedPart = exportedAt
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 16);
  const businessPart = fileNamePart(businessName, 'Business');

  return `OrbitLedger_DailyClosing_${businessPart}_${reportDate}_${exportedPart}.${format}`;
}

function buildDailyClosingJsonExport(report: DailyClosingReport, exportedAt: string) {
  return {
    appName: 'Orbit Ledger by Rudraix',
    exportType: 'daily_closing_report',
    exportedAt,
    report,
  };
}

function serializeDailyClosingReportAsCsv(
  report: DailyClosingReport,
  exportedAt: string
): string {
  const rows: Array<Record<string, unknown>> = [
    {
      section: 'metadata',
      metric: 'report_date',
      value: report.reportDate,
      detail: report.business.businessName,
      currency: report.business.currency,
      exported_at: exportedAt,
    },
    {
      section: 'metadata',
      metric: 'generated_at',
      value: report.generatedAt,
      detail: `${report.business.countryCode}/${report.business.stateCode}`,
      currency: report.business.currency,
      exported_at: exportedAt,
    },
  ];

  for (const [metric, value] of Object.entries(report.totals)) {
    rows.push({
      section: 'totals',
      metric,
      value,
      detail: '',
      currency: report.business.currency,
      exported_at: exportedAt,
    });
  }

  for (const entry of report.ledgerEntries) {
    rows.push({
      section: 'ledger_entry',
      metric: entry.type,
      value: entry.amount,
      detail: `${entry.customerName}${entry.note ? ` - ${entry.note}` : ''}`,
      currency: report.business.currency,
      exported_at: exportedAt,
    });
  }

  for (const invoice of report.invoices) {
    rows.push({
      section: 'invoice',
      metric: invoice.invoiceNumber,
      value: invoice.totalAmount,
      detail: `${invoice.customerName ?? 'Walk-in customer'} - ${invoice.status}`,
      currency: report.business.currency,
      exported_at: exportedAt,
    });
  }

  for (const customer of report.topOutstandingCustomers) {
    rows.push({
      section: 'top_outstanding_customer',
      metric: customer.name,
      value: customer.balance,
      detail: customer.phone ?? '',
      currency: report.business.currency,
      exported_at: exportedAt,
    });
  }

  for (const product of report.lowStockProducts) {
    rows.push({
      section: 'low_stock_product',
      metric: product.name,
      value: product.stockQuantity,
      detail: product.unit,
      currency: report.business.currency,
      exported_at: exportedAt,
    });
  }

  return serializeCsvRows(rows);
}

function serializeCsvRows(rows: Array<Record<string, unknown>>): string {
  const headers = ['section', 'metric', 'value', 'detail', 'currency', 'exported_at'];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

function escapeCsv(value: unknown): string {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function getDailyClosingDirectory(): Directory {
  const directory = new Directory(
    Paths.document,
    DOCUMENTS_DIRECTORY_NAME,
    DAILY_CLOSING_DIRECTORY_NAME
  );
  directory.create({ idempotent: true, intermediates: true });
  return directory;
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
