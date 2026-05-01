import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { CustomerHealthScore } from '@orbit-ledger/core';

import { formatCurrency } from '../lib/format';

export type CustomerExportProfile = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  openingBalance: number;
  balance: number;
  isArchived: boolean;
  updatedAt: string;
  latestActivityAt: string;
  health: CustomerHealthScore;
};

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const CUSTOMER_EXPORTS_DIRECTORY_NAME = 'customer-exports';

export async function shareCustomerCsvExport(input: {
  businessName: string;
  currency: string;
  customers: CustomerExportProfile[];
}): Promise<{ fileName: string; uri: string }> {
  const contents = buildCustomerExportCsv(input.customers);
  const fileName = buildCustomerExportFileName(input.businessName, input.customers, 'csv');
  const file = saveCustomerExportFile(fileName, contents);
  await shareExportFile(file.uri, 'text/csv', fileName);
  return { fileName, uri: file.uri };
}

export async function shareCustomerPdfExport(input: {
  businessName: string;
  currency: string;
  customers: CustomerExportProfile[];
}): Promise<{ fileName: string; uri: string }> {
  const html = buildCustomerPdfHtml(input);
  const printed = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const sourceFile = new File(printed.uri);
  if (!sourceFile.exists) {
    throw new Error('Customer PDF could not be created.');
  }

  const fileName = buildCustomerExportFileName(input.businessName, input.customers, 'pdf');
  const directory = getCustomerExportsDirectory();
  const destination = new File(directory, fileName);
  if (destination.exists) {
    destination.delete();
  }
  sourceFile.copy(destination);
  await shareExportFile(destination.uri, 'application/pdf', fileName);
  return { fileName, uri: destination.uri };
}

export function buildCustomerExportCsv(customers: CustomerExportProfile[]): string {
  const headers = [
    'Name',
    'Phone',
    'Address',
    'Status',
    'Health rank',
    'Health score',
    'Balance',
    'Opening balance',
    'Last activity',
    'Last updated',
    'Important notes',
  ];
  const rows = customers.map((customer) => [
    customer.name,
    customer.phone ?? '',
    customer.address ?? '',
    customer.isArchived ? 'Archived' : 'Active',
    customer.health.label,
    customer.health.score,
    customer.balance,
    customer.openingBalance,
    customer.latestActivityAt,
    customer.updatedAt,
    customer.notes ?? '',
  ]);

  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n');
}

function buildCustomerPdfHtml({
  businessName,
  currency,
  customers,
}: {
  businessName: string;
  currency: string;
  customers: CustomerExportProfile[];
}) {
  const pages = customers
    .map((customer) => {
      const balanceText =
        customer.balance > 0
          ? 'This customer currently owes money.'
          : customer.balance < 0
            ? 'This customer has an advance balance.'
            : 'This customer is settled.';

      return `
        <section class="page">
          <header>
            <div>
              <p class="eyebrow">Customer profile</p>
              <h1>${escapeHtml(customer.name)}</h1>
            </div>
            <p class="business">${escapeHtml(businessName)}</p>
          </header>
          <div class="rule"></div>
          <div class="summary">
            ${metric('Health rank', `${customer.health.label} (${customer.health.score}/100)`)}
            ${metric('Balance', formatCurrency(customer.balance, currency))}
            ${metric('Opening balance', formatCurrency(customer.openingBalance, currency))}
            ${metric('Phone', customer.phone || 'Not saved')}
            ${metric('Address', customer.address || 'Not saved')}
            ${metric('Status', customer.isArchived ? 'Archived' : 'Active')}
            ${metric('Last activity', formatDate(customer.latestActivityAt))}
          </div>
          <h2>Important customer information</h2>
          <ul>
            <li>${escapeHtml(customer.health.helper)}</li>
            <li>${escapeHtml(balanceText)}</li>
            <li>${escapeHtml(customer.notes ? `Notes: ${customer.notes}` : 'No notes saved.')}</li>
          </ul>
          <footer>Generated using Orbit Ledger</footer>
        </section>
      `;
    })
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 32px; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #182233; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .page { min-height: 778px; page-break-after: always; padding: 8px 0 0; position: relative; }
          .page:last-child { page-break-after: auto; }
          header { align-items: flex-start; display: flex; justify-content: space-between; gap: 24px; }
          h1 { font-size: 24px; line-height: 1.18; margin: 4px 0 0; }
          h2 { font-size: 15px; margin: 28px 0 12px; }
          .eyebrow, .business, .label, footer { color: #607087; font-size: 11px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
          .business { max-width: 220px; text-align: right; }
          .rule { border-top: 1px solid #cedaeb; margin: 24px 0; }
          .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .metric { border: 1px solid #d9e3f2; border-radius: 8px; min-height: 78px; padding: 14px; }
          .value { color: #182233; font-size: 15px; font-weight: 900; line-height: 1.35; margin-top: 8px; }
          ul { color: #4e5c73; font-size: 13px; line-height: 1.6; margin: 0; padding-left: 18px; }
          footer { bottom: 0; left: 0; position: absolute; }
        </style>
      </head>
      <body>${pages}</body>
    </html>
  `;
}

function metric(label: string, value: string) {
  return `
    <div class="metric">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `;
}

function saveCustomerExportFile(fileName: string, contents: string): File {
  const directory = getCustomerExportsDirectory();
  const file = new File(directory, fileName);
  if (file.exists) {
    file.delete();
  }
  file.write(contents);
  return file;
}

async function shareExportFile(uri: string, mimeType: string, fileName: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: fileName,
    mimeType,
    UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });
}

function getCustomerExportsDirectory(): Directory {
  const directory = new Directory(
    Paths.document,
    DOCUMENTS_DIRECTORY_NAME,
    CUSTOMER_EXPORTS_DIRECTORY_NAME
  );
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function buildCustomerExportFileName(
  businessName: string,
  customers: CustomerExportProfile[],
  extension: 'csv' | 'pdf'
) {
  const exportedPart = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 16);
  const customerPart =
    customers.length === 1 ? fileNamePart(customers[0]?.name ?? 'Customer', 'Customer') : `${customers.length}_Customers`;

  return `OrbitLedger_${fileNamePart(businessName, 'Business')}_${customerPart}_${exportedPart}.${extension}`;
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not saved';
  }

  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
