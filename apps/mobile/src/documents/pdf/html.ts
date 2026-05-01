import { File } from 'expo-file-system';

import type {
  CustomerStatementData,
  DocumentImageAsset,
  DocumentLayoutRole,
  DocumentTableColumn,
  InvoiceDocumentData,
  InvoiceItemTableRow,
  StatementTransactionRow,
  StructuredDocument,
} from '../types';

type PdfImageAsset = DocumentImageAsset & {
  source: string;
};

const DEFAULT_STATEMENT_TABLE_COLUMNS: DocumentTableColumn[] = [
  { key: 'date', label: 'Date', align: 'left' },
  { key: 'description', label: 'Description', align: 'left' },
  { key: 'credit', label: 'Credit', align: 'right' },
  { key: 'payment', label: 'Payment', align: 'right' },
  { key: 'runningBalance', label: 'Running balance', align: 'right' },
];

const DEFAULT_INVOICE_TABLE_COLUMNS: DocumentTableColumn[] = [
  { key: 'name', label: 'Item', align: 'left' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'taxRate', label: 'Tax', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
];

export async function buildPdfHtml(document: StructuredDocument): Promise<string> {
  if (document.data.kind === 'invoice') {
    return buildInvoicePdfHtml(document as StructuredDocument<InvoiceDocumentData>);
  }

  return buildStatementPdfHtml(document as StructuredDocument<CustomerStatementData>);
}

async function buildStatementPdfHtml(
  document: StructuredDocument<CustomerStatementData>
): Promise<string> {
  const data = document.data;
  const logo = await resolvePdfImageAsset(data.businessIdentity.logo);
  const signature = await resolvePdfImageAsset(data.footer.signature);
  const proThemeStyle = buildProThemeStyle(data.rendering.proTheme);
  const customerTitle = sectionTitle(document, 'customer_identity', 'Customer');
  const statementMetadataTitle = sectionTitle(document, 'statement_metadata', 'Statement Period');
  const transactionTableTitle = tableTitle(document, 'transaction_table', 'Ledger History');
  const summaryTitle = sectionTitle(document, 'summary', 'Totals');
  const taxTitle = sectionTitle(document, 'tax_placeholder', 'Tax Details');
  const showCustomer = isLayoutRoleVisible(document, 'customer_identity');
  const showStatementMetadata = isLayoutRoleVisible(document, 'statement_metadata');
  const showTransactionTable = isLayoutRoleVisible(document, 'transaction_table');
  const showSummary = isLayoutRoleVisible(document, 'summary');
  const showTax = isLayoutRoleVisible(document, 'tax_placeholder');
  const showFooter = isLayoutRoleVisible(document, 'footer');
  const statementColumns = tableColumns(
    document,
    'transaction_table',
    DEFAULT_STATEMENT_TABLE_COLUMNS
  );

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.title)}</title>
    <style>${pdfStyles}</style>
  </head>
  <body class="document-statement ${data.rendering.pdfStyle === 'advanced' ? 'style-advanced' : 'style-basic'} template-${escapeAttribute(data.rendering.template.visualStyle)}"${proThemeStyle}>
    <main class="page">
      <header class="document-header">
        <div class="brand-row">
          ${logo ? imageTag(logo, 'logo') : fallbackLogo(data.businessIdentity.businessName)}
          <div class="business-copy">
            <h1>${escapeHtml(data.businessIdentity.businessName)}</h1>
            <p>${escapeHtml(data.businessIdentity.address)}</p>
            <p class="business-contact">${escapeHtml(data.businessIdentity.phone)} | ${escapeHtml(data.businessIdentity.email)}</p>
          </div>
        </div>
        <div class="statement-title">
          <p class="label">${escapeHtml(document.layout.title)}</p>
          <strong>${escapeHtml(data.metadata.statementDate)}</strong>
          <span>${escapeHtml(data.rendering.template.label)}</span>
          ${templateBadge(data.rendering.template)}
        </div>
      </header>

      ${
        showCustomer || showStatementMetadata
          ? `<section class="identity-grid">
        ${
          showCustomer
            ? `<div class="panel">
          <p class="label">${escapeHtml(customerTitle)}</p>
          <h2>${escapeHtml(data.customerIdentity.name)}</h2>
          ${detailLine('Phone', data.customerIdentity.phone)}
          ${detailLine('Address', data.customerIdentity.address)}
        </div>`
            : ''
        }
        ${
          showStatementMetadata
            ? `<div class="panel">
          <p class="label">${escapeHtml(statementMetadataTitle)}</p>
          <h2>${escapeHtml(data.metadata.dateRange.from)} to ${escapeHtml(data.metadata.dateRange.to)}</h2>
          <p>Statement date: ${escapeHtml(data.metadata.statementDate)}</p>
        </div>`
            : ''
        }
      </section>`
          : ''
      }

      ${
        showTransactionTable
          ? `<section class="table-section">
        <h2>${escapeHtml(transactionTableTitle)}</h2>
        ${transactionTable(data.transactions, statementColumns)}
      </section>`
          : ''
      }

      ${
        showSummary || showFooter
          ? `<section class="summary-signature">
        ${
          showSummary
            ? `<div class="panel account-summary-panel">
          <p class="label">Amount due</p>
          <h2>${escapeHtml(data.summary.amountDue.formatted)}</h2>
          <p>${escapeHtml(data.summary.dueMessage)}</p>
          ${data.summary.lastTransactionDate ? `<p>Last activity: ${escapeHtml(data.summary.lastTransactionDate)}</p>` : ''}
        </div>
        <div class="summary-card">
          <h2>${escapeHtml(summaryTitle)}</h2>
          ${summaryLine('Opening balance', data.summary.openingBalance.formatted)}
          ${summaryLine('Credit / charges', data.summary.totalCredit.formatted)}
          ${summaryLine('Payments received', data.summary.totalPayment.formatted)}
          ${summaryLine('Closing balance', data.summary.finalBalance.formatted, true)}
        </div>`
            : ''
        }

        ${
          showFooter
            ? `<div class="signature-card">
          <p class="label">Authorized by</p>
          <div class="signature-box">
            ${signature ? imageTag(signature, 'signature') : '<span>Signature not added</span>'}
          </div>
          <div class="signature-line"></div>
          <h2>${escapeHtml(data.footer.authorizedPersonName)}</h2>
          <p>${escapeHtml(data.footer.designation)}</p>
        </div>`
            : ''
        }
      </section>`
          : ''
      }
      ${
        showTax
          ? `<section class="tax-note">
        <p class="label">${escapeHtml(taxTitle)}</p>
        <p>${escapeHtml(data.taxPlaceholder.taxSection.message)}</p>
        <p>Please review this statement and contact us if anything looks incorrect.</p>
      </section>`
          : ''
      }
      ${
        data.rendering.pdfStyle === 'advanced'
          ? '<section class="brand-footer"><span>Orbit Ledger Pro</span><span>Prepared with custom document branding</span></section>'
          : ''
      }
    </main>
  </body>
</html>`;
}

async function buildInvoicePdfHtml(
  document: StructuredDocument<InvoiceDocumentData>
): Promise<string> {
  const data = document.data;
  const logo = await resolvePdfImageAsset(data.businessIdentity.logo);
  const signature = await resolvePdfImageAsset(data.footer.signature);
  const proThemeStyle = buildProThemeStyle(data.rendering.proTheme);
  const customerTitle = sectionTitle(document, 'customer_identity', 'Bill To');
  const invoiceMetadataTitle = sectionTitle(document, 'invoice_metadata', 'Invoice Details');
  const invoiceTableTitle = tableTitle(document, 'invoice_item_table', 'Items');
  const summaryTitle = sectionTitle(document, 'invoice_summary', 'Totals');
  const taxTitle = sectionTitle(document, 'tax_placeholder', 'Tax Details');
  const showCustomer = isLayoutRoleVisible(document, 'customer_identity');
  const showInvoiceMetadata = isLayoutRoleVisible(document, 'invoice_metadata');
  const showInvoiceTable = isLayoutRoleVisible(document, 'invoice_item_table');
  const showSummary = isLayoutRoleVisible(document, 'invoice_summary');
  const showTax = isLayoutRoleVisible(document, 'tax_placeholder');
  const showFooter = isLayoutRoleVisible(document, 'footer');
  const invoiceColumns = tableColumns(document, 'invoice_item_table', DEFAULT_INVOICE_TABLE_COLUMNS);
  const invoiceTaxSummaryLabel =
    data.taxPlaceholder.taxSummaryLabel ??
    invoiceColumns.find((column) => column.key === 'taxRate')?.label ??
    'Tax';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.title)}</title>
    <style>${pdfStyles}</style>
  </head>
  <body class="document-invoice ${data.rendering.pdfStyle === 'advanced' ? 'style-advanced' : 'style-basic'} template-${escapeAttribute(data.rendering.template.visualStyle)} template-${escapeAttribute(data.rendering.template.countryFormat ?? 'generic_tax')}"${proThemeStyle}>
    <main class="page">
      <header class="document-header">
        <div class="brand-row">
          ${logo ? imageTag(logo, 'logo') : fallbackLogo(data.businessIdentity.businessName)}
          <div class="business-copy">
            <h1>${escapeHtml(data.businessIdentity.businessName)}</h1>
            <p>${escapeHtml(data.businessIdentity.address)}</p>
            <p class="business-contact">${escapeHtml(data.businessIdentity.phone)} | ${escapeHtml(data.businessIdentity.email)}</p>
            ${data.businessIdentity.taxRegistrationNumber ? `<p class="business-contact">${escapeHtml(data.taxPlaceholder.taxRegistrationLabel ?? 'Tax ID')}: ${escapeHtml(data.businessIdentity.taxRegistrationNumber)}</p>` : ''}
          </div>
        </div>
        <div class="statement-title">
          <p class="label">${escapeHtml(document.layout.title)}</p>
          <strong>${escapeHtml(data.metadata.invoiceNumber)}</strong>
          <span>${escapeHtml(data.rendering.template.label)} · ${escapeHtml(data.metadata.status)}</span>
          ${templateBadge(data.rendering.template)}
        </div>
      </header>

      ${
        showCustomer || showInvoiceMetadata
          ? `<section class="identity-grid">
        ${
          showCustomer
            ? `<div class="panel">
          <p class="label">${escapeHtml(customerTitle)}</p>
          <h2>${escapeHtml(data.customerIdentity.name)}</h2>
          ${detailLine('Phone', data.customerIdentity.phone)}
          ${detailLine('Address', data.customerIdentity.address)}
        </div>`
            : ''
        }
        ${
          showInvoiceMetadata
            ? `<div class="panel">
          <p class="label">${escapeHtml(invoiceMetadataTitle)}</p>
          <h2>${escapeHtml(data.metadata.invoiceNumber)}</h2>
          <p><strong>Issue date:</strong> ${escapeHtml(data.metadata.issueDate)}</p>
          ${detailLine('Due date', data.metadata.dueDate)}
          ${detailLine('Place of supply', data.taxPlaceholder.placeOfSupply ?? null)}
          ${data.taxPlaceholder.taxPointLabel ? detailLine(data.taxPlaceholder.taxPointLabel, data.taxPlaceholder.taxPointDate ?? null) : ''}
        </div>`
            : ''
        }
      </section>`
          : ''
      }

      ${
        showInvoiceTable
          ? `<section class="table-section">
        <h2>${escapeHtml(invoiceTableTitle)}</h2>
        ${invoiceItemTable(data.items, invoiceColumns)}
      </section>`
          : ''
      }

      ${
        showSummary || showFooter
          ? `<section class="summary-signature">
        ${
          showSummary
            ? `<div class="summary-card">
          <h2>${escapeHtml(summaryTitle)}</h2>
          ${summaryLine('Subtotal', data.summary.subtotal.formatted)}
          ${summaryLine(invoiceTaxSummaryLabel, data.summary.taxAmount.formatted)}
          ${summaryLine('Total', data.summary.totalAmount.formatted, true)}
          <p class="amount-words"><strong>Amount in words:</strong> ${escapeHtml(data.summary.amountInWords)}</p>
        </div>`
            : ''
        }

        ${
          showFooter
            ? `<div class="signature-card">
          <p class="label">Authorized by</p>
          <div class="signature-box">
            ${signature ? imageTag(signature, 'signature') : '<span>Signature not added</span>'}
          </div>
          <div class="signature-line"></div>
          <h2>${escapeHtml(data.footer.authorizedPersonName)}</h2>
          <p>${escapeHtml(data.footer.designation)}</p>
        </div>`
            : ''
        }
      </section>`
          : ''
      }

      ${data.paymentLink ? paymentLinkBlock(data.paymentLink) : ''}
      ${data.manualPaymentInstructions.length ? manualPaymentInstructionBlock(data.manualPaymentInstructions) : ''}

      ${
        showTax
          ? `<section class="tax-note">
        <p class="label">${escapeHtml(taxTitle)}</p>
        ${data.taxPlaceholder.taxRegistrationNumber ? `<p><strong>${escapeHtml(data.taxPlaceholder.taxRegistrationLabel ?? 'Tax ID')}:</strong> ${escapeHtml(data.taxPlaceholder.taxRegistrationNumber)}</p>` : ''}
        <p>${escapeHtml(data.taxPlaceholder.taxSection.message)}</p>
        ${taxBreakdownList(data.taxPlaceholder.taxBreakdown.rows)}
        <p>${escapeHtml(data.taxPlaceholder.taxBreakdown.message)}</p>
      </section>`
          : ''
      }
      ${
        data.rendering.pdfStyle === 'advanced'
          ? '<section class="brand-footer"><span>Orbit Ledger Pro</span><span>Prepared with custom invoice branding</span></section>'
          : ''
      }
    </main>
  </body>
</html>`;
}

function buildProThemeStyle(theme: StructuredDocument['data']['rendering']['proTheme']): string {
  if (!theme) {
    return '';
  }

  return ` style="--pro-accent:${escapeAttribute(theme.accentColor)};--pro-surface:${escapeAttribute(
    theme.surfaceColor
  )};--pro-line:${escapeAttribute(theme.lineColor)};--pro-text:${escapeAttribute(
    theme.textColor
  )}"`;
}

function invoiceItemTable(
  rows: InvoiceItemTableRow[],
  columns: DocumentTableColumn[] = DEFAULT_INVOICE_TABLE_COLUMNS
): string {
  if (rows.length === 0) {
    return `<div class="empty-table">No items added to this invoice.</div>`;
  }

  return `<table>
    <thead>
      <tr>
        ${columns
          .map(
            (column) =>
              `<th class="${column.align === 'right' ? 'numeric' : ''}">${escapeHtml(column.label)}</th>`
          )
          .join('')}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>
            ${columns.map((column) => invoiceItemCell(row, column)).join('')}
          </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

async function resolvePdfImageAsset(asset: DocumentImageAsset | null): Promise<PdfImageAsset | null> {
  if (!asset) {
    return null;
  }

  try {
    const file = new File(asset.uri);
    if (!file.exists) {
      return { ...asset, source: asset.uri };
    }

    const base64 = file.base64Sync();
    return {
      ...asset,
      source: `data:${mimeTypeForUri(asset.uri)};base64,${base64}`,
    };
  } catch {
    return { ...asset, source: asset.uri };
  }
}

function transactionTable(
  rows: StatementTransactionRow[],
  columns: DocumentTableColumn[] = DEFAULT_STATEMENT_TABLE_COLUMNS
): string {
  if (rows.length === 0) {
    return `<div class="empty-table">No transactions in this statement period.</div>`;
  }

  return `<table>
    <thead>
      <tr>
        ${columns
          .map(
            (column) =>
              `<th class="${column.align === 'right' ? 'numeric' : ''}">${escapeHtml(column.label)}</th>`
          )
          .join('')}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>
            ${columns.map((column) => statementCell(row, column)).join('')}
          </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

function statementCell(row: StatementTransactionRow, column: DocumentTableColumn): string {
  const value = (() => {
    if (column.key === 'date') {
      return row.date;
    }
    if (column.key === 'description') {
      return row.description;
    }
    if (column.key === 'credit') {
      return row.credit?.formatted ?? '-';
    }
    if (column.key === 'payment') {
      return row.payment?.formatted ?? '-';
    }
    if (column.key === 'runningBalance') {
      return row.runningBalance.formatted;
    }

    return '';
  })();
  const classes = [
    column.align === 'right' ? 'numeric' : '',
    column.key === 'description' ? 'description' : '',
    column.key === 'runningBalance' ? 'balance' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<td class="${classes}">${escapeHtml(value)}</td>`;
}

function invoiceItemCell(row: InvoiceItemTableRow, column: DocumentTableColumn): string {
  const classes = [
    column.align === 'right' ? 'numeric' : '',
    column.key === 'name' || column.key === 'description' ? 'description' : '',
    column.key === 'total' ? 'balance' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (column.key === 'name') {
    const description = row.description
      ? `<span class="cell-note">${escapeHtml(row.description)}</span>`
      : '';
    return `<td class="${classes}">${escapeHtml(row.name)}${description}</td>`;
  }

  const value = (() => {
    if (column.key === 'description') {
      return row.description ?? '';
    }
    if (column.key === 'quantity') {
      return String(row.quantity);
    }
    if (column.key === 'price') {
      return row.price.formatted;
    }
    if (column.key === 'taxRate') {
      return row.taxRate;
    }
    if (column.key === 'hsnSac') {
      return row.hsnSac;
    }
    if (column.key === 'taxableValue') {
      return row.taxableValue.formatted;
    }
    if (column.key === 'taxAmount') {
      return row.taxAmount.formatted;
    }
    if (column.key === 'cgst') {
      return row.cgst?.formatted ?? '-';
    }
    if (column.key === 'sgst') {
      return row.sgst?.formatted ?? '-';
    }
    if (column.key === 'igst') {
      return row.igst?.formatted ?? '-';
    }
    if (column.key === 'total') {
      return row.total.formatted;
    }

    return '';
  })();

  return `<td class="${classes}">${escapeHtml(value)}</td>`;
}

function sectionTitle(
  document: StructuredDocument,
  role: DocumentLayoutRole,
  fallback: string
): string {
  const section = document.layout.sections.find(
    (node) => node.type === 'section' && node.role === role
  );

  return section?.title ?? fallback;
}

function tableTitle(
  document: StructuredDocument,
  role: DocumentLayoutRole,
  fallback: string
): string {
  const table = document.layout.sections.find((node) => node.type === 'table' && node.role === role);

  return table?.title ?? fallback;
}

function tableColumns(
  document: StructuredDocument,
  role: DocumentLayoutRole,
  fallback: DocumentTableColumn[]
): DocumentTableColumn[] {
  const table = document.layout.sections.find((node) => node.type === 'table' && node.role === role);

  return table?.type === 'table' && table.columns.length > 0 ? table.columns : fallback;
}

function isLayoutRoleVisible(document: StructuredDocument, role: DocumentLayoutRole): boolean {
  return document.layout.sections.some((node) => node.role === role);
}

function detailLine(label: string, value: string | null): string {
  return value ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>` : '';
}

function summaryLine(label: string, value: string, emphasized = false): string {
  return `<div class="summary-line ${emphasized ? 'emphasized' : ''}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function paymentLinkBlock(link: NonNullable<InvoiceDocumentData['paymentLink']>): string {
  return `<section class="payment-link-block">
    <p class="label">Payment link</p>
    <h2>${escapeHtml(link.label)}</h2>
    <p>${escapeHtml(link.instruction)}</p>
    <a href="${escapeAttribute(link.url)}">${escapeHtml(link.url)}</a>
  </section>`;
}

function manualPaymentInstructionBlock(lines: string[]): string {
  return `<section class="payment-link-block">
    <p class="label">Payment instructions</p>
    <h2>Manual payment details</h2>
    ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
  </section>`;
}

function templateBadge(template: StructuredDocument['data']['rendering']['template']): string {
  return `<em class="style-badge">${escapeHtml(
    template.tier === 'pro' ? `${template.label} · Pro` : template.label
  )}</em>`;
}

function taxBreakdownList(rows: InvoiceDocumentData['taxPlaceholder']['taxBreakdown']['rows']): string {
  if (!rows.length) {
    return '';
  }

  return `<div class="tax-breakdown">
    ${rows
      .map(
        (row) => `<div class="summary-line">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.amount.formatted)}</strong>
    </div>`
      )
      .join('')}
  </div>`;
}

function fallbackLogo(businessName: string): string {
  const initials = businessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return `<div class="logo-fallback">${escapeHtml(initials || 'OL')}</div>`;
}

function imageTag(asset: PdfImageAsset, className: string): string {
  return `<img class="${className}" src="${escapeAttribute(asset.source)}" alt="${escapeAttribute(asset.alt)}" />`;
}

function mimeTypeForUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

const pdfStyles = `
  @page {
    margin: 30px;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #ffffff;
    color: #18231F;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 10.5px;
    line-height: 1.48;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 100%;
  }

  .document-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    border-bottom: 2px solid #145C52;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }

  .brand-row {
    display: flex;
    gap: 13px;
    min-width: 0;
    flex: 1;
  }

  .business-copy {
    min-width: 0;
  }

  .logo,
  .logo-fallback {
    width: 58px;
    height: 58px;
    border-radius: 6px;
    object-fit: cover;
    flex: 0 0 auto;
  }

  .logo-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #D6E0DA;
    background: #E5F1ED;
    color: #145C52;
    font-weight: 800;
    font-size: 17px;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    font-size: 18px;
    line-height: 1.18;
    margin-bottom: 7px;
  }

  h2 {
    font-size: 12.5px;
    line-height: 1.3;
    margin-bottom: 8px;
  }

  .business-copy p,
  .panel p,
  .signature-card p,
  .tax-note p {
    color: #64736B;
  }

  .business-contact {
    margin-top: 3px;
  }

  .panel p + p {
    margin-top: 4px;
  }

  .statement-title {
    text-align: right;
    min-width: 150px;
    border-left: 1px solid #D6E0DA;
    padding-left: 18px;
  }

  .statement-title p,
  .label {
    color: #64736B;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .statement-title strong {
    display: block;
    font-size: 15px;
    line-height: 1.2;
    margin-bottom: 5px;
  }

  .statement-title span {
    display: block;
    color: #64736B;
    font-size: 10px;
    font-weight: 700;
  }

  .style-badge {
    display: inline-block;
    border-radius: 8px;
    font-size: 8.5px;
    font-style: normal;
    font-weight: 800;
    letter-spacing: 0;
    margin-top: 10px;
    padding: 4px 8px;
    text-transform: uppercase;
  }

  .identity-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  .panel,
  .summary-card,
  .signature-card,
  .tax-note {
    border: 1px solid #D6E0DA;
    border-radius: 6px;
    padding: 12px;
    page-break-inside: avoid;
  }

  .table-section {
    margin-bottom: 16px;
  }

  .table-section h2 {
    margin-bottom: 10px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9.7px;
  }

  thead {
    display: table-header-group;
  }

  tbody {
    page-break-inside: auto;
  }

  tfoot {
    display: table-row-group;
  }

  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  th {
    background: #F6F8F7;
    color: #18231F;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  th,
  td {
    border: 1px solid #D6E0DA;
    padding: 7px 8px;
    vertical-align: top;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  tbody tr:nth-child(even) td {
    background: #FBFCFA;
  }

  th:nth-child(1),
  td:nth-child(1) {
    width: 14%;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 36%;
  }

  th:nth-child(3),
  td:nth-child(3),
  th:nth-child(4),
  td:nth-child(4),
  th:nth-child(5),
  td:nth-child(5) {
    width: 17%;
  }

  .document-invoice th:nth-child(1),
  .document-invoice td:nth-child(1) {
    width: 30%;
  }

  .document-invoice th:nth-child(2),
  .document-invoice td:nth-child(2) {
    width: 10%;
  }

  .document-invoice th:nth-child(3),
  .document-invoice td:nth-child(3) {
    width: 18%;
  }

  .document-invoice th:nth-child(4),
  .document-invoice td:nth-child(4) {
    width: 14%;
  }

  .document-invoice th:nth-child(5),
  .document-invoice td:nth-child(5) {
    width: 20%;
  }

  .template-india_gst table {
    font-size: 8.2px;
  }

  .template-india_gst th,
  .template-india_gst td {
    padding: 6px 5px;
  }

  .amount-words {
    border-top: 1px solid #D6E0DA;
    color: #64736B;
    margin-top: 8px;
    padding-top: 8px;
  }

  .payment-link-block {
    border: 1px solid #B9D7FF;
    border-radius: 12px;
    background: #F4F8FF;
    margin: 14px 0;
    padding: 12px;
    break-inside: avoid;
  }

  .payment-link-block h2 {
    color: #1A62D3;
    margin: 4px 0;
  }

  .payment-link-block p,
  .payment-link-block a {
    font-size: 10px;
    overflow-wrap: anywhere;
  }

  .payment-link-block a {
    color: #1A62D3;
    font-weight: 800;
  }

  .account-summary-panel h2 {
    color: #145C52;
    font-size: 18px;
    margin-bottom: 6px;
  }

  .tax-breakdown {
    margin: 8px 0;
    max-width: 260px;
  }

  .numeric {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .description {
    overflow-wrap: anywhere;
  }

  .cell-note {
    display: block;
    margin-top: 3px;
    color: #667085;
    font-size: 10px;
    line-height: 1.35;
  }

  .balance {
    font-weight: 800;
  }

  .summary-signature {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 12px;
    align-items: stretch;
    margin-bottom: 16px;
  }

  .signature-card {
    text-align: right;
  }

  .summary-line {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px solid #D6E0DA;
  }

  .summary-line span,
  .summary-line strong {
    font-variant-numeric: tabular-nums;
  }

  .summary-line.emphasized {
    border-bottom: 0;
    border-top: 2px solid #145C52;
    margin-top: 3px;
    padding-top: 10px;
    font-size: 13px;
    color: #145C52;
  }

  .signature-box {
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    color: #64736B;
  }

  .signature {
    max-width: 180px;
    max-height: 52px;
    object-fit: contain;
  }

  .signature-line {
    border-top: 1px solid #18231F;
    margin: 0 0 8px auto;
    width: 78%;
  }

  .empty-table {
    border: 1px solid #D6E0DA;
    border-radius: 6px;
    padding: 18px;
    color: #64736B;
  }

  .tax-note {
    color: #64736B;
    font-size: 9.5px;
  }

  .style-basic .document-header {
    border-bottom-color: #D6E0DA;
    border-bottom-width: 1px;
  }

  .style-basic .logo-fallback,
  .style-basic th,
  .style-basic tbody tr:nth-child(even) td {
    background: #ffffff;
  }

  .style-basic .summary-line.emphasized {
    border-top-color: #18231F;
    color: #18231F;
  }

  body.style-advanced {
    font-size: 10.8px;
  }

  .style-advanced .page {
    border-top: 5px solid var(--pro-accent, #145C52);
    padding-top: 16px;
  }

  .style-advanced .document-header {
    background: #F6F8F7;
    border: 1px solid var(--pro-line, #D6E0DA);
    border-bottom: 3px solid var(--pro-accent, #145C52);
    border-radius: 8px;
    margin-bottom: 18px;
    padding: 16px;
  }

  .style-advanced .brand-row {
    gap: 15px;
  }

  .style-advanced .business-copy h1 {
    color: var(--pro-accent, #145C52);
    font-size: 20px;
    letter-spacing: 0;
    margin-bottom: 8px;
  }

  .style-advanced .logo,
  .style-advanced .logo-fallback {
    width: 68px;
    height: 68px;
    border-radius: 8px;
  }

  .style-advanced .logo {
    border: 1px solid var(--pro-line, #D6E0DA);
  }

  .style-advanced .logo-fallback {
    background: var(--pro-surface, #E5F1ED);
    color: var(--pro-accent, #145C52);
    font-size: 19px;
  }

  .style-advanced .statement-title {
    background: #ffffff;
    border: 1px solid var(--pro-line, #D6E0DA);
    border-left: 4px solid var(--pro-accent, #145C52);
    border-radius: 8px;
    min-width: 164px;
    padding: 12px 14px;
  }

  .style-advanced .statement-title strong {
    color: var(--pro-text, #18231F);
    font-size: 16px;
  }

  .style-advanced .style-badge {
    background: var(--pro-surface, #E5F1ED);
    color: var(--pro-accent, #145C52);
  }

  .style-advanced .identity-grid {
    gap: 14px;
    margin-bottom: 18px;
  }

  .style-advanced .panel,
  .style-advanced .summary-card,
  .style-advanced .signature-card,
  .style-advanced .tax-note {
    background: #FBFCFA;
    border-color: var(--pro-line, #D6E0DA);
    border-radius: 8px;
    padding: 14px;
  }

  .style-advanced .panel {
    border-top: 3px solid var(--pro-accent, #145C52);
  }

  .style-advanced .table-section h2 {
    color: var(--pro-accent, #145C52);
    font-size: 13px;
  }

  .style-advanced table {
    font-size: 9.9px;
  }

  .style-advanced th {
    background: var(--pro-surface, #E5F1ED);
    color: var(--pro-accent, #145C52);
  }

  .style-advanced tbody tr:nth-child(even) td {
    background: #F6F8F7;
  }

  .style-advanced .summary-signature {
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 18px;
  }

  .style-advanced .summary-card {
    border-top: 3px solid var(--pro-accent, #145C52);
  }

  .style-advanced .summary-card h2,
  .style-advanced .signature-card h2 {
    color: var(--pro-accent, #145C52);
    font-size: 13px;
  }

  .style-advanced .summary-line {
    padding: 8px 0;
  }

  .style-advanced .summary-line.emphasized {
    background: var(--pro-surface, #E5F1ED);
    border: 0;
    border-radius: 6px;
    color: var(--pro-accent, #145C52);
    margin-top: 8px;
    padding: 10px;
  }

  .style-advanced .signature-card {
    border-top: 3px solid var(--pro-accent, #145C52);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 168px;
    text-align: center;
  }

  .style-advanced .signature-box {
    background: #ffffff;
    border: 1px dashed var(--pro-line, #D6E0DA);
    border-radius: 8px;
    height: 76px;
    margin-bottom: 12px;
  }

  .style-advanced .signature {
    max-height: 66px;
    max-width: 210px;
  }

  .style-advanced .signature-line {
    border-top-color: var(--pro-accent, #145C52);
    margin: 0 auto 9px;
    width: 70%;
  }

  .style-advanced .brand-footer {
    border-top: 1px solid var(--pro-line, #D6E0DA);
    color: #64736B;
    display: flex;
    font-size: 9px;
    font-weight: 800;
    justify-content: space-between;
    margin-top: 18px;
    padding-top: 10px;
  }
`;
