import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type {
  InventoryReorderAssistantReport,
  InventoryReorderExportFormat,
  SavedInventoryReorderExport,
} from './types';

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const INVENTORY_REORDER_DIRECTORY_NAME = 'inventory-reorder';

export async function createAndSaveInventoryReorderExport({
  format,
  report,
}: {
  format: InventoryReorderExportFormat;
  report: InventoryReorderAssistantReport;
}): Promise<SavedInventoryReorderExport> {
  const exportedAt = new Date().toISOString();
  const fileName = buildInventoryReorderFileName({
    businessName: report.business.businessName,
    exportedAt,
    format,
  });
  const contents =
    format === 'json'
      ? `${JSON.stringify(buildJsonExport(report, exportedAt), null, 2)}\n`
      : serializeInventoryReorderAsCsv(report, exportedAt);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';

  try {
    const directory = getInventoryReorderDirectory();
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
    throw new Error('Inventory reorder export could not be saved locally.');
  }
}

export async function shareInventoryReorderExport(input: {
  format: InventoryReorderExportFormat;
  report: InventoryReorderAssistantReport;
}): Promise<SavedInventoryReorderExport> {
  const exportFile = await createAndSaveInventoryReorderExport(input);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(exportFile.uri);
  if (!file.exists) {
    throw new Error('Saved inventory reorder export could not be found.');
  }

  await Sharing.shareAsync(exportFile.uri, {
    mimeType: exportFile.mimeType,
    dialogTitle: exportFile.fileName,
  });

  return exportFile;
}

export function buildInventoryReorderFileName({
  businessName,
  exportedAt,
  format,
}: {
  businessName: string;
  exportedAt: string;
  format: InventoryReorderExportFormat;
}): string {
  const datePart = exportedAt
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 16);
  const businessPart = fileNamePart(businessName, 'Business');

  return `OrbitLedger_ReorderAssistant_${businessPart}_${datePart}.${format}`;
}

function buildJsonExport(report: InventoryReorderAssistantReport, exportedAt: string) {
  return {
    appName: 'Orbit Ledger by Rudraix',
    exportType: 'inventory_reorder_assistant',
    exportedAt,
    report,
  };
}

function serializeInventoryReorderAsCsv(
  report: InventoryReorderAssistantReport,
  exportedAt: string
): string {
  const rows: Array<Record<string, unknown>> = [
    {
      section: 'metadata',
      product_name: 'sales_window',
      current_stock: `${report.window.from} to ${report.window.to}`,
      unit: '',
      quantity_sold: '',
      daily_average: '',
      days_left: '',
      suggested_reorder_quantity: '',
      estimated_reorder_cost: '',
      urgency: '',
      reason: `Coverage ${report.window.coverageDays} days, low stock ${report.window.lowStockThreshold}`,
      exported_at: exportedAt,
    },
    {
      section: 'totals',
      product_name: 'estimated_reorder_cost',
      current_stock: report.totals.estimatedReorderCost,
      unit: report.business.currency,
      quantity_sold: '',
      daily_average: '',
      days_left: '',
      suggested_reorder_quantity: '',
      estimated_reorder_cost: report.totals.estimatedReorderCost,
      urgency: '',
      reason: '',
      exported_at: exportedAt,
    },
  ];

  report.suggestions.forEach((item) => {
    rows.push({
      section: 'suggestions',
      product_name: item.product.name,
      current_stock: item.currentStock,
      unit: item.unit,
      quantity_sold: item.quantitySoldInWindow,
      daily_average: item.dailyAverage,
      days_left: item.projectedDaysLeft ?? '',
      suggested_reorder_quantity: item.suggestedReorderQuantity,
      estimated_reorder_cost: item.estimatedReorderCost,
      urgency: item.urgencyLabel,
      reason: item.reason,
      exported_at: exportedAt,
    });
  });

  return `${serializeCsvRows(rows)}\n`;
}

function getInventoryReorderDirectory(): Directory {
  const root = new Directory(Paths.document, DOCUMENTS_DIRECTORY_NAME);
  if (!root.exists) {
    root.create();
  }

  const directory = new Directory(root, INVENTORY_REORDER_DIRECTORY_NAME);
  if (!directory.exists) {
    directory.create();
  }

  return directory;
}

function serializeCsvRows(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  return [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');
}

function escapeCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function fileNamePart(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? fallback)
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
}
