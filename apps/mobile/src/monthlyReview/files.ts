import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type {
  MonthlyBusinessReview,
  MonthlyReviewExportFormat,
  SavedMonthlyReviewExport,
} from './types';

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const MONTHLY_REVIEW_DIRECTORY_NAME = 'monthly-reviews';

export async function createAndSaveMonthlyReviewExport({
  format,
  review,
}: {
  format: MonthlyReviewExportFormat;
  review: MonthlyBusinessReview;
}): Promise<SavedMonthlyReviewExport> {
  const exportedAt = new Date().toISOString();
  const fileName = buildMonthlyReviewFileName({
    businessName: review.business.businessName,
    exportedAt,
    format,
    monthKey: review.month.monthKey,
  });
  const contents =
    format === 'json'
      ? `${JSON.stringify(buildMonthlyReviewJsonExport(review, exportedAt), null, 2)}\n`
      : serializeMonthlyReviewAsCsv(review, exportedAt);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';

  try {
    const directory = getMonthlyReviewDirectory();
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
      review,
    };
  } catch {
    throw new Error('Monthly review export could not be saved locally.');
  }
}

export async function shareMonthlyReviewExport(input: {
  format: MonthlyReviewExportFormat;
  review: MonthlyBusinessReview;
}): Promise<SavedMonthlyReviewExport> {
  const exportFile = await createAndSaveMonthlyReviewExport(input);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(exportFile.uri);
  if (!file.exists) {
    throw new Error('Saved monthly review export could not be found.');
  }

  await Sharing.shareAsync(exportFile.uri, {
    mimeType: exportFile.mimeType,
    dialogTitle: exportFile.fileName,
  });

  return exportFile;
}

export function buildMonthlyReviewFileName({
  businessName,
  exportedAt,
  format,
  monthKey,
}: {
  businessName: string;
  exportedAt: string;
  format: MonthlyReviewExportFormat;
  monthKey: string;
}): string {
  const datePart = exportedAt
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 16);
  const businessPart = fileNamePart(businessName, 'Business');

  return `OrbitLedger_MonthlyReview_${businessPart}_${monthKey}_${datePart}.${format}`;
}

function buildMonthlyReviewJsonExport(review: MonthlyBusinessReview, exportedAt: string) {
  return {
    appName: 'Orbit Ledger by Rudraix',
    exportType: 'monthly_business_review',
    exportedAt,
    review,
  };
}

function serializeMonthlyReviewAsCsv(
  review: MonthlyBusinessReview,
  exportedAt: string
): string {
  const rows: Array<Record<string, unknown>> = [
    {
      section: 'metadata',
      metric: 'month',
      value: review.month.monthKey,
      detail: review.month.label,
      currency: review.business.currency,
      exported_at: exportedAt,
    },
    {
      section: 'metadata',
      metric: 'generated_at',
      value: review.generatedAt,
      detail: `${review.business.countryCode}/${review.business.stateCode}`,
      currency: review.business.currency,
      exported_at: exportedAt,
    },
  ];

  for (const [metric, value] of Object.entries(review.totals)) {
    rows.push({
      section: 'totals',
      metric,
      value,
      detail: '',
      currency: review.business.currency,
      exported_at: exportedAt,
    });
  }

  for (const action of review.actionItems) {
    rows.push({
      section: 'action_item',
      metric: action.priority,
      value: action.title,
      detail: action.message,
      currency: review.business.currency,
      exported_at: exportedAt,
    });
  }

  appendCustomerRows(rows, 'top_payments', review.topCustomersByPayments, review.business.currency, exportedAt);
  appendCustomerRows(rows, 'top_sales', review.topCustomersBySales, review.business.currency, exportedAt);
  appendCustomerRows(rows, 'highest_dues', review.highestDues, review.business.currency, exportedAt);
  appendCustomerRows(rows, 'slow_paying', review.slowPayingCustomers, review.business.currency, exportedAt);
  appendCustomerRows(rows, 'improved', review.improvedCustomers, review.business.currency, exportedAt);

  return serializeCsvRows(rows);
}

function appendCustomerRows(
  rows: Array<Record<string, unknown>>,
  section: string,
  customers: MonthlyBusinessReview['topCustomersByPayments'],
  currency: string,
  exportedAt: string
) {
  for (const customer of customers) {
    rows.push({
      section,
      metric: customer.name,
      value: customer.balance,
      detail: JSON.stringify({
        paymentsReceived: customer.paymentsReceived,
        creditGiven: customer.creditGiven,
        invoiceSales: customer.invoiceSales,
        phone: customer.phone,
        lastPaymentAt: customer.lastPaymentAt,
      }),
      currency,
      exported_at: exportedAt,
    });
  }
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

function getMonthlyReviewDirectory(): Directory {
  const directory = new Directory(
    Paths.document,
    DOCUMENTS_DIRECTORY_NAME,
    MONTHLY_REVIEW_DIRECTORY_NAME
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
