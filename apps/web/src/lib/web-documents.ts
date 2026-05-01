import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import {
  getGeneratedInvoiceDocumentLabel,
  getLocalBusinessPack,
  normalizeInvoiceDocumentState,
  type InvoicePaymentLink,
} from '@orbit-ledger/core';

import type {
  WorkspaceCustomer,
  WorkspaceInvoiceDetail,
  WorkspaceTransaction,
} from './workspace-data';
import { buildCsv, downloadTextFile } from './workspace-power';
import {
  getDefaultWebSubscriptionStatus,
  getWebProBrandTheme,
  resolveWebFeatureAccess,
  type WebProBrandTheme,
  type WebSubscriptionStatus,
} from './web-monetization';

export type WebDocumentKind = 'invoice' | 'statement';
export type WebDocumentTier = 'free' | 'pro';
export type WebDocumentTemplateRole = 'invoice' | 'statement';

export type WebDocumentTemplate = {
  key: string;
  role: WebDocumentTemplateRole;
  countryCode: 'IN' | 'US' | 'GB' | 'GENERIC';
  tier: WebDocumentTier;
  label: string;
  description: string;
  visualStyle: 'classic_tax' | 'modern_minimal' | 'premium_letterhead' | 'balance_forward' | 'account_letterhead';
  countryFormat?: 'india_gst' | 'us_sales_tax' | 'uk_vat' | 'generic_tax';
  taxLabel: string;
  taxRegistrationLabel: string;
  locale?: string;
  columns: Array<{ key: string; label: string; align: 'left' | 'right' }>;
};

type BuildInvoiceDocumentInput = {
  workspace: OrbitWorkspaceSummary;
  invoice: WorkspaceInvoiceDetail;
  customer: WorkspaceCustomer | null;
  subscription?: WebSubscriptionStatus;
  templateKey?: string | null;
  proTheme?: WebProBrandTheme | null;
  urgentPaymentRequired?: boolean;
  instrumentAttachment?: {
    name: string;
    url: string;
  } | null;
  paymentLink?: InvoicePaymentLink | null;
};

type BuildStatementDocumentInput = {
  workspace: OrbitWorkspaceSummary;
  customer: WorkspaceCustomer;
  transactions: WorkspaceTransaction[];
  dateFrom?: string;
  dateTo?: string;
  subscription?: WebSubscriptionStatus;
  templateKey?: string | null;
  proTheme?: WebProBrandTheme | null;
};

type InvoiceDocumentLine = {
  name: string;
  description: string | null;
  quantity: number;
  priceAmount: number;
  taxRate: number;
  taxableValueAmount: number;
  taxAmount: number;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  totalAmount: number;
};

type InvoiceDocumentData = {
  title: string;
  businessName: string;
  businessAddress: string;
  businessContact: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  countryCode: string;
  revisionNumber: number;
  taxLabel: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountWords: string;
  notes: string | null;
  rows: InvoiceDocumentLine[];
};

type StatementDocumentLine = {
  date: string;
  description: string;
  creditAmount: number;
  paymentAmount: number;
  runningBalance: number;
};

type StatementDocumentData = {
  title: string;
  businessName: string;
  businessAddress: string;
  businessContact: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  from: string;
  to: string;
  amountDue: number;
  dueMessage: string;
  openingBalance: number;
  totalCredit: number;
  totalPayment: number;
  closingBalance: number;
  rows: StatementDocumentLine[];
};

type JsPdfDocument = InstanceType<typeof import('jspdf').jsPDF>;

const invoiceTemplates: WebDocumentTemplate[] = [
  invoiceTemplate('IN_GST_STANDARD_FREE', 'IN', 'free', 'India GST Standard', 'Classic India invoice wording with GSTIN, HSN/SAC, CGST/SGST/IGST and amount in words.', 'classic_tax', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Description', 'left'],
    ['hsnSac', 'HSN/SAC', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxableValue', 'Taxable value', 'right'],
    ['taxRate', 'GST', 'right'],
    ['cgst', 'CGST', 'right'],
    ['sgst', 'SGST', 'right'],
    ['igst', 'IGST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_GST_LETTERHEAD_PRO', 'IN', 'pro', 'India GST Letterhead', 'Premium India letterhead with branding, GSTIN focus, signature and polished totals.', 'premium_letterhead', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Item / Service', 'left'],
    ['hsnSac', 'HSN/SAC', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxRate', 'GST', 'right'],
    ['cgst', 'CGST', 'right'],
    ['sgst', 'SGST', 'right'],
    ['igst', 'IGST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('US_SALES_STANDARD_FREE', 'US', 'free', 'US Sales Standard', 'Modern sales invoice with taxable subtotal, sales tax and item descriptions.', 'modern_minimal', 'us_sales_tax', 'Sales tax', 'Seller permit', 'en-US', [
    ['name', 'Description', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Unit price', 'right'],
    ['taxableValue', 'Taxable amount', 'right'],
    ['taxRate', 'Sales tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('US_SALES_PRO', 'US', 'pro', 'US Sales Pro', 'Premium sales invoice with branding, seller permit field and strong totals panel.', 'premium_letterhead', 'us_sales_tax', 'Sales tax', 'Seller permit', 'en-US', [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxAmount', 'Sales tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('UK_VAT_STANDARD_FREE', 'GB', 'free', 'UK VAT Standard', 'UK VAT invoice wording with VAT number, tax point and net/VAT/gross totals.', 'classic_tax', 'uk_vat', 'VAT', 'VAT reg no.', 'en-GB', [
    ['name', 'Description', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Unit price', 'right'],
    ['taxableValue', 'Net', 'right'],
    ['taxRate', 'VAT', 'right'],
    ['taxAmount', 'VAT amount', 'right'],
    ['total', 'Gross', 'right'],
  ]),
  invoiceTemplate('UK_VAT_LETTERHEAD_PRO', 'GB', 'pro', 'UK VAT Letterhead', 'Premium UK invoice wording with logo, VAT number highlight, signature and refined totals.', 'premium_letterhead', 'uk_vat', 'VAT', 'VAT reg no.', 'en-GB', [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Net', 'right'],
    ['taxRate', 'VAT', 'right'],
    ['taxAmount', 'VAT', 'right'],
    ['total', 'Gross', 'right'],
  ]),
  invoiceTemplate('GENERIC_INVOICE_STANDARD_FREE', 'GENERIC', 'free', 'Standard Invoice', 'Clean general invoice for countries without a specific local template yet.', 'modern_minimal', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Description', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Price', 'right'],
    ['taxRate', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('GENERIC_INVOICE_LETTERHEAD_PRO', 'GENERIC', 'pro', 'Premium Letterhead', 'Premium general invoice with richer branding and signature treatment.', 'premium_letterhead', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxAmount', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
];

const statementTemplates: WebDocumentTemplate[] = [
  statementTemplate('IN_STATEMENT_STANDARD_FREE', 'IN', 'free', 'India Statement Standard', 'Balance-forward customer statement for Indian ledger dues.', 'en-IN'),
  statementTemplate('IN_STATEMENT_LETTERHEAD_PRO', 'IN', 'pro', 'India Statement Letterhead', 'Premium branded statement with stronger account summary and signature.', 'en-IN'),
  statementTemplate('US_STATEMENT_STANDARD_FREE', 'US', 'free', 'US Statement Standard', 'Balance-forward statement for US customers and payments.', 'en-US'),
  statementTemplate('US_STATEMENT_LETTERHEAD_PRO', 'US', 'pro', 'US Statement Letterhead', 'Premium branded US customer statement.', 'en-US'),
  statementTemplate('UK_STATEMENT_STANDARD_FREE', 'GB', 'free', 'UK Statement Standard', 'Balance-forward statement for UK accounts.', 'en-GB'),
  statementTemplate('UK_STATEMENT_LETTERHEAD_PRO', 'GB', 'pro', 'UK Statement Letterhead', 'Premium branded UK statement with professional account summary.', 'en-GB'),
  statementTemplate('GENERIC_STATEMENT_STANDARD_FREE', 'GENERIC', 'free', 'Statement Standard', 'Clean balance-forward customer statement.', undefined),
  statementTemplate('GENERIC_STATEMENT_LETTERHEAD_PRO', 'GENERIC', 'pro', 'Statement Letterhead', 'Premium branded customer statement.', undefined),
];

export function getWebDocumentTemplates(workspace: OrbitWorkspaceSummary, role: WebDocumentTemplateRole) {
  const countryCode = normalizeSupportedCountry(workspace.countryCode);
  const templates = role === 'invoice' ? invoiceTemplates : statementTemplates;
  const localTemplates = templates.filter((template) => template.countryCode === countryCode);
  return localTemplates.length ? localTemplates : templates.filter((template) => template.countryCode === 'GENERIC');
}

export function getDefaultWebDocumentTemplate(
  workspace: OrbitWorkspaceSummary,
  role: WebDocumentTemplateRole,
  isPro: boolean
) {
  const templates = getWebDocumentTemplates(workspace, role);
  return templates.find((template) => template.tier === (isPro ? 'pro' : 'free')) ?? templates[0];
}

export function getWebDocumentTemplate(
  workspace: OrbitWorkspaceSummary,
  role: WebDocumentTemplateRole,
  key: string | null | undefined,
  isPro: boolean
) {
  const templates = getWebDocumentTemplates(workspace, role);
  const selected = key ? templates.find((template) => template.key === key) : null;
  if (selected && canUseWebTemplate(selected, isPro)) {
    return selected;
  }
  return getDefaultWebDocumentTemplate(workspace, role, isPro);
}

export function canUseWebTemplate(template: WebDocumentTemplate, isPro: boolean) {
  return template.tier === 'free' || isPro;
}

export function buildInvoiceWebDocument(input: BuildInvoiceDocumentInput) {
  const subscription = input.subscription ?? getDefaultWebSubscriptionStatus();
  const access = resolveWebFeatureAccess(subscription, 'advanced_pdf_styling');
  const template = getWebDocumentTemplate(input.workspace, 'invoice', input.templateKey, subscription.isPro);
  const pdfStyle = template.tier === 'pro' && access.allowed ? 'advanced' : 'basic';
  const includeBranding = resolveWebFeatureAccess(subscription, 'custom_document_branding').allowed;
  const pack = getLocalBusinessPack({
    countryCode: input.workspace.countryCode,
    regionCode: input.workspace.stateCode,
  });
  const proTheme = pdfStyle === 'advanced' ? input.proTheme ?? getWebProBrandTheme() : null;
  const subtotal = input.invoice.items.reduce((total, item) => total + item.quantity * item.price, 0);
  const taxAmount = input.invoice.items.reduce((total, item) => total + item.quantity * item.price * (item.taxRate / 100), 0);
  const total = subtotal + taxAmount;
  const taxMode = taxModeForTemplate(template);
  const rawRows: InvoiceDocumentLine[] = input.invoice.items.map((item) => {
    const taxableValue = roundCurrency(item.quantity * item.price);
    const rowTaxAmount = roundCurrency(taxableValue * (item.taxRate / 100));
    const split = splitTax(rowTaxAmount, taxMode);
    return {
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      priceAmount: item.price,
      taxRate: item.taxRate,
      taxableValueAmount: taxableValue,
      taxAmount: rowTaxAmount,
      cgstAmount: split.cgst,
      sgstAmount: split.sgst,
      igstAmount: split.igst,
      totalAmount: item.total,
    };
  });
  const rows = rawRows.map((item) => {
    return {
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: money(item.priceAmount, input.workspace.currency, template.locale),
      taxRate: `${item.taxRate}%`,
      hsnSac: taxMode.startsWith('india') ? 'HSN/SAC' : '-',
      taxableValue: money(item.taxableValueAmount, input.workspace.currency, template.locale),
      taxAmount: money(item.taxAmount, input.workspace.currency, template.locale),
      cgst: item.cgstAmount === null ? '-' : money(item.cgstAmount, input.workspace.currency, template.locale),
      sgst: item.sgstAmount === null ? '-' : money(item.sgstAmount, input.workspace.currency, template.locale),
      igst: item.igstAmount === null ? '-' : money(item.igstAmount, input.workspace.currency, template.locale),
      total: money(item.totalAmount, input.workspace.currency, template.locale),
    };
  });
  const taxBreakdown = buildTaxBreakdown(taxAmount, taxMode, input.workspace.currency, template.locale);
  const customerName = input.customer?.name ?? 'Customer';
  const revisionNumber = getInvoiceRevisionNumber(input.invoice);
  const countryCode = normalizeSupportedCountry(input.workspace.countryCode);
  const fileName = buildInvoicePdfFileName(
    customerName,
    input.invoice.invoiceNumber,
    input.invoice.issueDate,
    revisionNumber,
    countryCode
  );
  const amountWords = amountInWords(total, input.workspace.currency);
  const documentStatusLabel = getGeneratedInvoiceDocumentLabel(
    normalizeInvoiceDocumentState(input.invoice.documentState ?? input.invoice.status)
  );
  const invoiceData: InvoiceDocumentData = {
    title: pack.documents.invoiceTitle,
    businessName: input.workspace.businessName,
    businessAddress: input.workspace.address,
    businessContact: `${input.workspace.phone} | ${input.workspace.email}`,
    customerName,
    customerPhone: input.customer?.phone ?? null,
    customerAddress: input.customer?.address ?? null,
    invoiceNumber: input.invoice.invoiceNumber,
    issueDate: input.invoice.issueDate,
    dueDate: input.invoice.dueDate,
    status: documentStatusLabel,
    countryCode,
    revisionNumber,
    taxLabel: template.taxLabel,
    subtotal,
    taxAmount,
    total,
    amountWords,
    notes: input.invoice.notes,
    rows: rawRows,
  };
  const html = documentShell({
    title: `Invoice - ${input.invoice.invoiceNumber}`,
    bodyClass: `document-invoice style-${pdfStyle} template-${template.visualStyle} template-${template.countryFormat}`,
    proTheme,
    content: `
      ${headerBlock({
        workspace: input.workspace,
        title: pack.documents.invoiceTitle,
        strong: input.invoice.invoiceNumber,
        meta: `${template.label} · ${documentStatusLabel}`,
        includeBranding,
        template,
      })}
      ${input.urgentPaymentRequired ? urgentPaymentStamp() : ''}
      <section class="identity-grid">
        <div class="panel">
          <p class="label">${escapeHtml(pack.documents.buyerLabel)}</p>
          <h2>${escapeHtml(input.customer?.name ?? 'Unlinked customer')}</h2>
          ${detailLine('Phone', input.customer?.phone ?? null)}
          ${detailLine('Address', input.customer?.address ?? null)}
        </div>
        <div class="panel">
          <p class="label">${escapeHtml(pack.documents.invoiceDetailsLabel)}</p>
          <h2>${escapeHtml(input.invoice.invoiceNumber)}</h2>
          ${detailLine('Issue date', input.invoice.issueDate)}
          ${detailLine('Due date', input.invoice.dueDate)}
          ${detailLine('Place of supply', input.workspace.stateCode || null)}
        </div>
      </section>
      <section class="table-section">
        <h2>${escapeHtml(pack.documents.itemTableLabel)}</h2>
        ${invoiceTable(rows, template.columns)}
      </section>
      <section class="summary-signature">
        <div class="summary-card">
          <h2>Totals</h2>
          ${summaryLine('Subtotal', money(subtotal, input.workspace.currency, template.locale))}
          ${summaryLine(template.taxLabel, money(taxAmount, input.workspace.currency, template.locale))}
          ${summaryLine('Total', money(total, input.workspace.currency, template.locale), true)}
          <p class="amount-words"><strong>Amount in words:</strong> ${escapeHtml(amountWords)} only</p>
        </div>
        ${signatureBlock(input.workspace, includeBranding)}
      </section>
      ${input.paymentLink ? paymentLinkBlock(input.paymentLink) : ''}
      ${input.instrumentAttachment ? instrumentAttachmentBlock(input.instrumentAttachment) : ''}
      <section class="tax-note">
        <p class="label">${escapeHtml(template.taxLabel)} Details</p>
        <p>${escapeHtml(taxAmount > 0 ? `${template.taxLabel} is included from saved invoice item rates.` : `No ${template.taxLabel.toLowerCase()} amount is applied to this invoice.`)}</p>
        ${taxBreakdownList(taxBreakdown)}
        <p>${escapeHtml(pack.compliance.disclaimer)}</p>
      </section>
      ${pdfStyle === 'advanced' ? proFooter('Prepared with custom invoice branding') : freeFooter()}
    `,
  });
  return {
    kind: 'invoice' as const,
    html,
    fileName,
    csvFileName: fileName.replace(/\.pdf$/i, '.csv'),
    template,
    pdfStyle,
    subscription,
    invoiceData,
    paymentLink: input.paymentLink ?? null,
  };
}

export function buildStatementWebDocument(input: BuildStatementDocumentInput) {
  const subscription = input.subscription ?? getDefaultWebSubscriptionStatus();
  const template = getWebDocumentTemplate(input.workspace, 'statement', input.templateKey, subscription.isPro);
  const pdfStyle = template.tier === 'pro' && subscription.isPro ? 'advanced' : 'basic';
  const includeBranding = resolveWebFeatureAccess(subscription, 'custom_document_branding').allowed;
  const proTheme = pdfStyle === 'advanced' ? input.proTheme ?? getWebProBrandTheme() : null;
  const sortedTransactions = [...input.transactions].sort((left, right) =>
    `${left.effectiveDate}${left.createdAt}`.localeCompare(`${right.effectiveDate}${right.createdAt}`)
  );
  const firstDate = sortedTransactions[0]?.effectiveDate ?? today();
  const lastDate = sortedTransactions[sortedTransactions.length - 1]?.effectiveDate ?? today();
  const from = normalizeDate(input.dateFrom || firstDate);
  const to = normalizeDate(input.dateTo || lastDate);
  let openingBalance = input.customer.openingBalance;
  for (const transaction of sortedTransactions) {
    if (normalizeDate(transaction.effectiveDate) >= from) {
      continue;
    }
    openingBalance += transaction.type === 'credit' ? transaction.amount : -transaction.amount;
  }
  let runningBalance = openingBalance;
  let totalCredit = 0;
  let totalPayment = 0;
  const rawRows: StatementDocumentLine[] = [];
  const rows = sortedTransactions
    .filter((transaction) => normalizeDate(transaction.effectiveDate) >= from && normalizeDate(transaction.effectiveDate) <= to)
    .map((transaction) => {
      if (transaction.type === 'credit') {
        totalCredit += transaction.amount;
        runningBalance += transaction.amount;
      } else {
        totalPayment += transaction.amount;
        runningBalance -= transaction.amount;
      }
      rawRows.push({
        date: normalizeDate(transaction.effectiveDate),
        description: transaction.note || (transaction.type === 'credit' ? 'Credit entry' : 'Payment received'),
        creditAmount: transaction.type === 'credit' ? transaction.amount : 0,
        paymentAmount: transaction.type === 'payment' ? transaction.amount : 0,
        runningBalance,
      });
      return {
        date: normalizeDate(transaction.effectiveDate),
        description: transaction.note || (transaction.type === 'credit' ? 'Credit entry' : 'Payment received'),
        credit: transaction.type === 'credit' ? money(transaction.amount, input.workspace.currency, template.locale) : '-',
        payment: transaction.type === 'payment' ? money(transaction.amount, input.workspace.currency, template.locale) : '-',
        runningBalance: money(runningBalance, input.workspace.currency, template.locale),
      };
    });
  const pack = getLocalBusinessPack({
    countryCode: input.workspace.countryCode,
    regionCode: input.workspace.stateCode,
  });
  const fileName = buildStatementPdfFileName(input.customer.name, from, to);
  const amountDue = Math.abs(runningBalance);
  const dueMessage =
    runningBalance > 0
      ? `${input.customer.name} owes you ${money(amountDue, input.workspace.currency, template.locale)}.`
      : runningBalance < 0
        ? `You owe ${input.customer.name} ${money(amountDue, input.workspace.currency, template.locale)}.`
        : 'This account is settled for the selected statement period.';
  const statementData: StatementDocumentData = {
    title: pack.documents.statementTitle,
    businessName: input.workspace.businessName,
    businessAddress: input.workspace.address,
    businessContact: `${input.workspace.phone} | ${input.workspace.email}`,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    customerAddress: input.customer.address,
    from,
    to,
    amountDue,
    dueMessage,
    openingBalance,
    totalCredit,
    totalPayment,
    closingBalance: runningBalance,
    rows: rawRows,
  };
  const html = documentShell({
    title: `Statement - ${input.customer.name}`,
    bodyClass: `document-statement style-${pdfStyle} template-${template.visualStyle}`,
    proTheme,
    content: `
      ${headerBlock({
        workspace: input.workspace,
        title: pack.documents.statementTitle,
        strong: today(),
        meta: template.label,
        includeBranding,
        template,
      })}
      <section class="identity-grid">
        <div class="panel">
          <p class="label">Statement For</p>
          <h2>${escapeHtml(input.customer.name)}</h2>
          ${detailLine('Phone', input.customer.phone)}
          ${detailLine('Address', input.customer.address)}
        </div>
        <div class="panel">
          <p class="label">Statement Period</p>
          <h2>${escapeHtml(from)} to ${escapeHtml(to)}</h2>
          <p>Statement date: ${escapeHtml(today())}</p>
        </div>
      </section>
      <section class="summary-signature">
        <div class="panel account-summary-panel">
          <p class="label">Amount due</p>
          <h2>${escapeHtml(money(amountDue, input.workspace.currency, template.locale))}</h2>
          <p>${escapeHtml(dueMessage)}</p>
        </div>
        <div class="summary-card">
          <h2>${escapeHtml(pack.documents.statementSummaryLabel)}</h2>
          ${summaryLine('Opening balance', money(openingBalance, input.workspace.currency, template.locale))}
          ${summaryLine('Credit / charges', money(totalCredit, input.workspace.currency, template.locale))}
          ${summaryLine('Payments received', money(totalPayment, input.workspace.currency, template.locale))}
          ${summaryLine('Closing balance', money(runningBalance, input.workspace.currency, template.locale), true)}
        </div>
      </section>
      <section class="table-section">
        <h2>${escapeHtml(pack.documents.statementActivityLabel)}</h2>
        ${statementTable(rows, template.columns)}
      </section>
      <section class="summary-signature">${signatureBlock(input.workspace, includeBranding)}</section>
      <section class="tax-note">
        <p class="label">Statement Note</p>
        <p>Customer statements summarize ledger dues and payments. Invoice tax totals are handled in invoice documents and reports.</p>
        <p>Please review this statement and contact us if anything looks incorrect.</p>
      </section>
      ${pdfStyle === 'advanced' ? proFooter('Prepared with custom document branding') : freeFooter()}
    `,
  });
  return { kind: 'statement' as const, html, fileName, template, pdfStyle, subscription, statementData };
}

export type WebInvoiceDocument = ReturnType<typeof buildInvoiceWebDocument>;
export type WebStatementDocument = ReturnType<typeof buildStatementWebDocument>;

export function openPrintableDocument(html: string) {
  const target = window.open('', '_blank', 'width=960,height=720');
  if (!target) {
    throw new Error('Allow popups to view or save this PDF.');
  }
  try {
    target.document.open();
    target.document.write(html);
    target.document.close();
    target.focus();
    window.setTimeout(() => target.print(), 450);
  } catch {
    target.close();
    throw new Error('Invoice preview could not open. Try downloading the document instead.');
  }
}

export async function downloadInvoicePdf(document: WebInvoiceDocument) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ format: 'a4', unit: 'pt' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const data = document.invoiceData;
  let y = margin;

  const addText = (
    text: string,
    x: number,
    currentY: number,
    options: { size?: number; style?: 'normal' | 'bold'; maxWidth?: number; align?: 'left' | 'right' | 'center' } = {}
  ) => {
    pdf.setFont('helvetica', options.style ?? 'normal');
    pdf.setFontSize(options.size ?? 10);
    const lines = pdf.splitTextToSize(text, options.maxWidth ?? pageWidth - margin * 2) as string[];
    pdf.text(lines, x, currentY, { align: options.align ?? 'left' });
    return currentY + lines.length * ((options.size ?? 10) + 4);
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin - 34) {
      return;
    }
    addPdfFooter(pdf, document);
    pdf.addPage();
    y = margin;
  };

  pdf.setDrawColor(214, 226, 242);
  pdf.setFillColor(247, 250, 255);
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 74, 8, 8, 'FD');
  y = addText(data.businessName, margin + 16, y + 24, { size: 16, style: 'bold', maxWidth: 260 });
  y = addText(data.businessAddress, margin + 16, y + 2, { size: 9, maxWidth: 260 });
  addText(data.businessContact, margin + 16, y + 2, { size: 9, maxWidth: 260 });
  addText(data.title, pageWidth - margin - 16, margin + 24, { size: 10, style: 'bold', align: 'right', maxWidth: 230 });
  addText(data.invoiceNumber, pageWidth - margin - 16, margin + 44, { size: 16, style: 'bold', align: 'right', maxWidth: 230 });
  addText(`${document.template.label} · ${data.status}`, pageWidth - margin - 16, margin + 62, { size: 9, align: 'right', maxWidth: 230 });
  y = margin + 98;

  ensureSpace(96);
  const halfWidth = (pageWidth - margin * 2 - 14) / 2;
  pdf.setFillColor(251, 253, 255);
  pdf.roundedRect(margin, y, halfWidth, 90, 8, 8, 'FD');
  pdf.roundedRect(margin + halfWidth + 14, y, halfWidth, 90, 8, 8, 'FD');
  addText('Customer', margin + 14, y + 20, { size: 8, style: 'bold' });
  addText(data.customerName, margin + 14, y + 40, { size: 13, style: 'bold', maxWidth: halfWidth - 28 });
  addText([data.customerPhone, data.customerAddress].filter(Boolean).join(' · ') || 'No customer contact saved', margin + 14, y + 58, { size: 9, maxWidth: halfWidth - 28 });
  addText('Invoice details', margin + halfWidth + 28, y + 20, { size: 8, style: 'bold' });
  addText(`Issue date: ${data.issueDate}`, margin + halfWidth + 28, y + 40, { size: 9, maxWidth: halfWidth - 28 });
  addText(`Due date: ${data.dueDate ?? '-'}`, margin + halfWidth + 28, y + 56, { size: 9, maxWidth: halfWidth - 28 });
  addText(`Country: ${data.countryCode} · Revision: ${data.revisionNumber}`, margin + halfWidth + 28, y + 72, { size: 9, maxWidth: halfWidth - 28 });
  y += 114;

  ensureSpace(90);
  y = addText('Line items', margin, y, { size: 12, style: 'bold' }) + 8;
  const columns = [
    { label: 'Item', width: 150, align: 'left' as const },
    { label: 'Qty', width: 42, align: 'right' as const },
    { label: 'Rate', width: 70, align: 'right' as const },
    { label: data.taxLabel, width: 56, align: 'right' as const },
    { label: 'Tax', width: 70, align: 'right' as const },
    { label: 'Total', width: 84, align: 'right' as const },
  ];
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  pdf.setFillColor(244, 248, 252);
  pdf.rect(margin, y, tableWidth, 26, 'F');
  let x = margin;
  for (const column of columns) {
    addText(column.label, column.align === 'right' ? x + column.width - 6 : x + 6, y + 17, { size: 8, style: 'bold', align: column.align, maxWidth: column.width - 10 });
    x += column.width;
  }
  y += 28;

  for (const row of data.rows) {
    ensureSpace(42);
    const rowHeight = Math.max(34, (pdf.splitTextToSize(row.name, columns[0].width - 12) as string[]).length * 12 + 14);
    pdf.setDrawColor(228, 236, 246);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    x = margin;
    const values = [
      row.name,
      formatQuantity(row.quantity),
      formatPlainAmount(row.priceAmount),
      `${formatQuantity(row.taxRate)}%`,
      formatPlainAmount(row.taxAmount),
      formatPlainAmount(row.totalAmount),
    ];
    values.forEach((value, index) => {
      const column = columns[index];
      addText(value, column.align === 'right' ? x + column.width - 6 : x + 6, y + 16, { size: 9, align: column.align, maxWidth: column.width - 12 });
      x += column.width;
    });
    y += rowHeight;
  }

  ensureSpace(138);
  const summaryX = pageWidth - margin - 230;
  y += 14;
  pdf.setFillColor(251, 253, 255);
  pdf.roundedRect(summaryX, y, 230, 112, 8, 8, 'FD');
  addText('Totals', summaryX + 14, y + 22, { size: 12, style: 'bold' });
  addSummaryLine(pdf, 'Subtotal', formatPlainAmount(data.subtotal), summaryX + 14, y + 44, 202);
  addSummaryLine(pdf, data.taxLabel, formatPlainAmount(data.taxAmount), summaryX + 14, y + 62, 202);
  addSummaryLine(pdf, 'Total', formatPlainAmount(data.total), summaryX + 14, y + 84, 202, true);
  y += 130;
  y = addText(`Amount in words: ${data.amountWords} only`, margin, y, { size: 10, style: 'bold', maxWidth: pageWidth - margin * 2 });

  if (document.paymentLink) {
    ensureSpace(74);
    y += 14;
    pdf.setFillColor(244, 248, 255);
    pdf.roundedRect(margin, y, pageWidth - margin * 2, 62, 8, 8, 'FD');
    addText(document.paymentLink.label, margin + 14, y + 20, { size: 11, style: 'bold', maxWidth: pageWidth - margin * 2 - 28 });
    addText(document.paymentLink.instruction, margin + 14, y + 36, { size: 9, maxWidth: pageWidth - margin * 2 - 28 });
    addText(document.paymentLink.url, margin + 14, y + 52, { size: 8, maxWidth: pageWidth - margin * 2 - 28 });
    pdf.link(margin, y, pageWidth - margin * 2, 62, { url: document.paymentLink.url });
    y += 76;
  }

  if (data.notes) {
    ensureSpace(42);
    y = addText(`Notes: ${data.notes}`, margin, y + 12, { size: 9, maxWidth: pageWidth - margin * 2 });
  }

  addPdfFooter(pdf, document);
  pdf.save(document.fileName);
}

export function downloadInvoiceCsv(document: WebInvoiceDocument) {
  const data = document.invoiceData;
  const csv = buildCsv(
    [
      'Customer Name',
      'Invoice Number',
      'Issue Date',
      'Due Date',
      'Revision',
      'Country Code',
      'Status',
      'Item',
      'Description',
      'Quantity',
      'Rate',
      'Tax Rate %',
      'Taxable Value',
      'Tax Amount',
      'CGST',
      'SGST',
      'IGST',
      'Line Total',
      'Invoice Total',
      'Amount In Words',
    ],
    data.rows.map((row) => [
      data.customerName,
      data.invoiceNumber,
      data.issueDate,
      data.dueDate ?? '',
      data.revisionNumber,
      data.countryCode,
      data.status,
      row.name,
      row.description ?? '',
      row.quantity,
      row.priceAmount,
      row.taxRate,
      row.taxableValueAmount,
      row.taxAmount,
      row.cgstAmount ?? '',
      row.sgstAmount ?? '',
      row.igstAmount ?? '',
      row.totalAmount,
      data.total,
      `${data.amountWords} only`,
    ])
  );
  downloadTextFile(document.csvFileName, csv);
}

export async function downloadStatementPdf(document: WebStatementDocument) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ format: 'a4', unit: 'pt' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const data = document.statementData;
  let y = margin;

  const addText = (
    text: string,
    x: number,
    currentY: number,
    options: { size?: number; style?: 'normal' | 'bold'; maxWidth?: number; align?: 'left' | 'right' | 'center' } = {}
  ) => {
    pdf.setFont('helvetica', options.style ?? 'normal');
    pdf.setFontSize(options.size ?? 10);
    const lines = pdf.splitTextToSize(text, options.maxWidth ?? pageWidth - margin * 2) as string[];
    pdf.text(lines, x, currentY, { align: options.align ?? 'left' });
    return currentY + lines.length * ((options.size ?? 10) + 4);
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin - 34) {
      return;
    }
    addDocumentFooter(pdf, document.pdfStyle === 'advanced' ? 'Prepared with Orbit Ledger Pro' : 'Generated using Orbit Ledger', `${data.from} to ${data.to}`);
    pdf.addPage();
    y = margin;
  };

  pdf.setDrawColor(214, 226, 242);
  pdf.setFillColor(247, 250, 255);
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 76, 8, 8, 'FD');
  y = addText(data.businessName, margin + 16, y + 24, { size: 16, style: 'bold', maxWidth: 270 });
  y = addText(data.businessAddress, margin + 16, y + 2, { size: 9, maxWidth: 270 });
  addText(data.businessContact, margin + 16, y + 2, { size: 9, maxWidth: 270 });
  addText(data.title, pageWidth - margin - 16, margin + 24, { size: 10, style: 'bold', align: 'right', maxWidth: 230 });
  addText(`${data.from} to ${data.to}`, pageWidth - margin - 16, margin + 46, { size: 14, style: 'bold', align: 'right', maxWidth: 230 });
  addText(document.template.label, pageWidth - margin - 16, margin + 64, { size: 9, align: 'right', maxWidth: 230 });
  y = margin + 100;

  ensureSpace(112);
  const halfWidth = (pageWidth - margin * 2 - 14) / 2;
  pdf.setFillColor(251, 253, 255);
  pdf.roundedRect(margin, y, halfWidth, 94, 8, 8, 'FD');
  pdf.roundedRect(margin + halfWidth + 14, y, halfWidth, 94, 8, 8, 'FD');
  addText('Customer', margin + 14, y + 20, { size: 8, style: 'bold' });
  addText(data.customerName, margin + 14, y + 40, { size: 13, style: 'bold', maxWidth: halfWidth - 28 });
  addText([data.customerPhone, data.customerAddress].filter(Boolean).join(' · ') || 'No customer contact saved', margin + 14, y + 58, { size: 9, maxWidth: halfWidth - 28 });
  addText('Account summary', margin + halfWidth + 28, y + 20, { size: 8, style: 'bold' });
  addText(`Amount due: ${formatPlainAmount(data.amountDue)}`, margin + halfWidth + 28, y + 42, { size: 12, style: 'bold', maxWidth: halfWidth - 28 });
  addText(data.dueMessage, margin + halfWidth + 28, y + 62, { size: 9, maxWidth: halfWidth - 28 });
  y += 118;

  ensureSpace(108);
  const summaryX = margin;
  pdf.setFillColor(251, 253, 255);
  pdf.roundedRect(summaryX, y, pageWidth - margin * 2, 82, 8, 8, 'FD');
  addSummaryLine(pdf, 'Opening balance', formatPlainAmount(data.openingBalance), summaryX + 14, y + 26, pageWidth - margin * 2 - 28);
  addSummaryLine(pdf, 'Credit / charges', formatPlainAmount(data.totalCredit), summaryX + 14, y + 44, pageWidth - margin * 2 - 28);
  addSummaryLine(pdf, 'Payments received', formatPlainAmount(data.totalPayment), summaryX + 14, y + 62, pageWidth - margin * 2 - 28);
  addSummaryLine(pdf, 'Closing balance', formatPlainAmount(data.closingBalance), summaryX + 14, y + 80, pageWidth - margin * 2 - 28, true);
  y += 110;

  y = addText('Activity', margin, y, { size: 12, style: 'bold' }) + 8;
  const columns = [
    { label: 'Date', width: 76, align: 'left' as const },
    { label: 'Details', width: 190, align: 'left' as const },
    { label: 'Credit', width: 78, align: 'right' as const },
    { label: 'Payment', width: 78, align: 'right' as const },
    { label: 'Balance', width: 82, align: 'right' as const },
  ];
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  pdf.setFillColor(244, 248, 252);
  pdf.rect(margin, y, tableWidth, 26, 'F');
  let x = margin;
  for (const column of columns) {
    addText(column.label, column.align === 'right' ? x + column.width - 6 : x + 6, y + 17, { size: 8, style: 'bold', align: column.align, maxWidth: column.width - 10 });
    x += column.width;
  }
  y += 28;

  for (const row of data.rows) {
    ensureSpace(40);
    const rowHeight = Math.max(32, (pdf.splitTextToSize(row.description, columns[1].width - 12) as string[]).length * 12 + 12);
    pdf.setDrawColor(228, 236, 246);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    x = margin;
    const values = [
      row.date,
      row.description,
      row.creditAmount ? formatPlainAmount(row.creditAmount) : '-',
      row.paymentAmount ? formatPlainAmount(row.paymentAmount) : '-',
      formatPlainAmount(row.runningBalance),
    ];
    values.forEach((value, index) => {
      const column = columns[index];
      addText(value, column.align === 'right' ? x + column.width - 6 : x + 6, y + 16, { size: 9, align: column.align, maxWidth: column.width - 12 });
      x += column.width;
    });
    y += rowHeight;
  }

  if (!data.rows.length) {
    addText('No transactions in this statement period.', margin + 8, y + 18, { size: 9 });
  }

  addDocumentFooter(pdf, document.pdfStyle === 'advanced' ? 'Prepared with Orbit Ledger Pro' : 'Generated using Orbit Ledger', `${data.from} to ${data.to}`);
  pdf.save(document.fileName);
}

export function buildPaymentRequestMessage(input: {
  businessName: string;
  customerName: string;
  amount: number;
  currency: string;
  documentLabel: string;
  documentNumber?: string;
}) {
  const amount = money(input.amount, input.currency);
  const reference = input.documentNumber ? ` for ${input.documentLabel} ${input.documentNumber}` : '';
  return `Hello ${input.customerName}, please share the payment of ${amount}${reference} when convenient. Thank you, ${input.businessName}.`;
}

function invoiceTemplate(
  key: string,
  countryCode: WebDocumentTemplate['countryCode'],
  tier: WebDocumentTier,
  label: string,
  description: string,
  visualStyle: Extract<WebDocumentTemplate['visualStyle'], 'classic_tax' | 'modern_minimal' | 'premium_letterhead'>,
  countryFormat: NonNullable<WebDocumentTemplate['countryFormat']>,
  taxLabel: string,
  taxRegistrationLabel: string,
  locale: string | undefined,
  columns: Array<[string, string, 'left' | 'right']>
): WebDocumentTemplate {
  return {
    key,
    role: 'invoice',
    countryCode,
    tier,
    label,
    description,
    visualStyle,
    countryFormat,
    taxLabel,
    taxRegistrationLabel,
    locale,
    columns: columns.map(([columnKey, columnLabel, align]) => ({ key: columnKey, label: columnLabel, align })),
  };
}

function statementTemplate(
  key: string,
  countryCode: WebDocumentTemplate['countryCode'],
  tier: WebDocumentTier,
  label: string,
  description: string,
  locale: string | undefined
): WebDocumentTemplate {
  return {
    key,
    role: 'statement',
    countryCode,
    tier,
    label,
    description,
    visualStyle: tier === 'pro' ? 'account_letterhead' : 'balance_forward',
    taxLabel: 'Tax',
    taxRegistrationLabel: 'Tax ID',
    locale,
    columns: [
      { key: 'date', label: 'Date', align: 'left' },
      { key: 'description', label: 'Details', align: 'left' },
      { key: 'credit', label: 'Credit / Charges', align: 'right' },
      { key: 'payment', label: 'Payments', align: 'right' },
      { key: 'runningBalance', label: 'Balance', align: 'right' },
    ],
  };
}

function normalizeSupportedCountry(countryCode: string): WebDocumentTemplate['countryCode'] {
  const normalized = countryCode.trim().toUpperCase();
  return normalized === 'IN' || normalized === 'US' || normalized === 'GB' ? normalized : 'GENERIC';
}

function taxModeForTemplate(template: WebDocumentTemplate) {
  if (template.countryFormat === 'india_gst') {
    return 'india_intra_state';
  }
  if (template.countryFormat === 'us_sales_tax') {
    return 'us_sales_tax';
  }
  if (template.countryFormat === 'uk_vat') {
    return 'uk_vat';
  }
  return 'generic';
}

function splitTax(amount: number, mode: string) {
  const rounded = roundCurrency(amount);
  if (rounded <= 0) {
    return { cgst: null, sgst: null, igst: null };
  }
  if (mode === 'india_intra_state') {
    const half = roundCurrency(rounded / 2);
    return { cgst: half, sgst: roundCurrency(rounded - half), igst: null };
  }
  if (mode === 'india_inter_state') {
    return { cgst: null, sgst: null, igst: rounded };
  }
  if (mode === 'us_sales_tax') {
    return { cgst: null, sgst: null, igst: rounded };
  }
  if (mode === 'uk_vat') {
    return { cgst: null, sgst: null, igst: rounded };
  }
  return { cgst: null, sgst: null, igst: rounded };
}

function buildTaxBreakdown(amount: number, mode: string, currency: string, locale?: string) {
  const rounded = roundCurrency(amount);
  if (rounded <= 0) {
    return [];
  }
  if (mode === 'india_intra_state') {
    const cgst = roundCurrency(rounded / 2);
    return [
      { label: 'CGST', amount: money(cgst, currency, locale) },
      { label: 'SGST', amount: money(roundCurrency(rounded - cgst), currency, locale) },
    ];
  }
  if (mode === 'india_inter_state') {
    return [{ label: 'IGST', amount: money(rounded, currency, locale) }];
  }
  if (mode === 'us_sales_tax') {
    return [{ label: 'Sales tax', amount: money(rounded, currency, locale) }];
  }
  if (mode === 'uk_vat') {
    return [{ label: 'VAT', amount: money(rounded, currency, locale) }];
  }
  return [{ label: 'Tax', amount: money(rounded, currency, locale) }];
}

function documentShell(input: { title: string; bodyClass: string; proTheme: WebProBrandTheme | null; content: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(input.title)}</title><style>${pdfStyles}</style></head><body class="${escapeAttribute(input.bodyClass)}"${proThemeStyle(input.proTheme)}><main class="page">${input.content}</main></body></html>`;
}

function headerBlock(input: {
  workspace: OrbitWorkspaceSummary;
  title: string;
  strong: string;
  meta: string;
  includeBranding: boolean;
  template: WebDocumentTemplate;
}) {
  const logo = input.includeBranding && input.workspace.logoUri
    ? `<img class="logo" src="${escapeAttribute(input.workspace.logoUri)}" alt="${escapeAttribute(input.workspace.businessName)} logo">`
    : `<div class="logo-fallback">${escapeHtml(initials(input.workspace.businessName))}</div>`;
  return `<header class="document-header"><div class="brand-row">${logo}<div class="business-copy"><h1>${escapeHtml(input.workspace.businessName)}</h1><p>${escapeHtml(input.workspace.address)}</p><p class="business-contact">${escapeHtml(input.workspace.phone)} | ${escapeHtml(input.workspace.email)}</p></div></div><div class="statement-title"><p class="label">${escapeHtml(input.title)}</p><strong>${escapeHtml(input.strong)}</strong><span>${escapeHtml(input.meta)}</span><em class="style-badge">${escapeHtml(input.template.tier === 'pro' ? `${input.template.label} · Pro` : input.template.label)}</em></div></header>`;
}

function signatureBlock(workspace: OrbitWorkspaceSummary, includeBranding: boolean) {
  const signature = includeBranding && workspace.signatureUri
    ? `<img class="signature" src="${escapeAttribute(workspace.signatureUri)}" alt="Authorized signature">`
    : '<span>Signature not added</span>';
  return `<div class="signature-card"><p class="label">Authorized by</p><div class="signature-box">${signature}</div><div class="signature-line"></div><h2>${escapeHtml(workspace.authorizedPersonName || workspace.ownerName || workspace.businessName)}</h2><p>${escapeHtml(workspace.authorizedPersonTitle || 'Authorized person')}</p></div>`;
}

function urgentPaymentStamp() {
  return '<section class="urgent-stamp">Payment required urgently</section>';
}

function instrumentAttachmentBlock(attachment: { name: string; url: string }) {
  return `<section class="instrument-proof"><div><p class="label">Payment instrument proof</p><h2>${escapeHtml(attachment.name)}</h2><p>Included by the business for payment review.</p></div><img src="${escapeAttribute(attachment.url)}" alt="${escapeAttribute(attachment.name)}"></section>`;
}

function paymentLinkBlock(link: InvoicePaymentLink) {
  return `<section class="payment-link-block"><div><p class="label">Payment link</p><h2>${escapeHtml(link.label)}</h2><p>${escapeHtml(link.instruction)}</p><a href="${escapeAttribute(link.url)}">${escapeHtml(link.url)}</a></div></section>`;
}

function invoiceTable(rows: Array<Record<string, string | number | null>>, columns: WebDocumentTemplate['columns']) {
  if (!rows.length) {
    return '<div class="empty-table">No items added to this invoice.</div>';
  }
  return `<table><thead><tr>${columns.map((column) => `<th class="${column.align === 'right' ? 'numeric' : ''}">${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td class="${column.align === 'right' ? 'numeric' : ''} ${column.key === 'name' ? 'description' : ''}">${escapeHtml(String(row[column.key] ?? '-'))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function statementTable(rows: Array<Record<string, string>>, columns: WebDocumentTemplate['columns']) {
  if (!rows.length) {
    return '<div class="empty-table">No transactions in this statement period.</div>';
  }
  return `<table><thead><tr>${columns.map((column) => `<th class="${column.align === 'right' ? 'numeric' : ''}">${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td class="${column.align === 'right' ? 'numeric' : ''} ${column.key === 'description' ? 'description' : ''}">${escapeHtml(row[column.key] ?? '-')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function detailLine(label: string, value: string | null | undefined) {
  return value ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>` : '';
}

function summaryLine(label: string, value: string, emphasized = false) {
  return `<div class="summary-line ${emphasized ? 'emphasized' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function taxBreakdownList(rows: Array<{ label: string; amount: string }>) {
  if (!rows.length) {
    return '';
  }
  return `<div class="tax-breakdown">${rows.map((row) => summaryLine(row.label, row.amount)).join('')}</div>`;
}

function proFooter(message: string) {
  return `<section class="brand-footer"><span>Orbit Ledger Pro</span><span>${escapeHtml(message)}</span></section>`;
}

function freeFooter() {
  return '<section class="brand-footer brand-footer--free"><span>Generated using Orbit Ledger</span><span>Clear records for serious small businesses</span></section>';
}

function addSummaryLine(
  pdf: JsPdfDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  emphasized = false
) {
  pdf.setFont('helvetica', emphasized ? 'bold' : 'normal');
  pdf.setFontSize(emphasized ? 11 : 9);
  pdf.text(label, x, y);
  pdf.text(value, x + width, y, { align: 'right' });
}

function addPdfFooter(pdf: JsPdfDocument, document: WebInvoiceDocument) {
  addDocumentFooter(
    pdf,
    document.pdfStyle === 'advanced' ? 'Prepared with Orbit Ledger Pro' : 'Generated using Orbit Ledger',
    `${document.invoiceData.invoiceNumber} · ${document.invoiceData.countryCode}`
  );
}

function addDocumentFooter(pdf: JsPdfDocument, footerText: string, rightText: string) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setDrawColor(214, 226, 242);
  pdf.line(40, pageHeight - 36, pageWidth - 40, pageHeight - 36);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(70, 84, 103);
  pdf.text(footerText, 40, pageHeight - 20);
  pdf.setFont('helvetica', 'normal');
  pdf.text(rightText, pageWidth - 40, pageHeight - 20, { align: 'right' });
  pdf.setTextColor(24, 35, 31);
}

function proThemeStyle(theme: WebProBrandTheme | null) {
  if (!theme) {
    return '';
  }
  return ` style="--pro-accent:${escapeAttribute(theme.accentColor)};--pro-surface:${escapeAttribute(theme.surfaceColor)};--pro-line:${escapeAttribute(theme.lineColor)};--pro-text:${escapeAttribute(theme.textColor)}"`;
}

function buildInvoicePdfFileName(
  customerName: string,
  invoiceNumber: string,
  issueDate: string,
  revisionNumber: number,
  countryCode: string
) {
  return `${fileNamePart(customerName, 'Customer')}_${fileNamePart(invoiceNumber, 'Invoice')}_${fileNamePart(issueDate, today())}_${fileNamePart(String(revisionNumber), '1')}_${fileNamePart(countryCode, 'GENERIC')}.pdf`;
}

function buildStatementPdfFileName(customerName: string, from: string, to: string) {
  const range = from === to ? fileNamePart(from, today()) : `${fileNamePart(from, today())}_to_${fileNamePart(to, today())}`;
  return `OrbitLedger_${fileNamePart(customerName, 'Customer')}_Statement_${range}.pdf`;
}

function fileNamePart(value: string, fallback: string) {
  return (value || fallback).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
}

function money(amount: number, currency: string, locale?: string) {
  return new Intl.NumberFormat(locale ?? (currency === 'INR' ? 'en-IN' : 'en-US'), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function amountInWords(amount: number, currency: string) {
  const safeAmount = Math.abs(roundCurrency(amount));
  const whole = Math.floor(safeAmount);
  const fraction = Math.round((safeAmount - whole) * 100);
  const wholeWords = numberToWords(whole);
  if (!fraction) {
    return wholeWords;
  }

  const minorUnit = currency.toUpperCase() === 'INR' ? 'paise' : 'cents';
  return `${wholeWords} and ${numberToWords(fraction)} ${minorUnit}`;
}

function numberToWords(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return 'Zero';
  }

  const ones = [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function underThousand(input: number): string {
    const parts: string[] = [];
    const hundreds = Math.floor(input / 100);
    const rest = input % 100;
    if (hundreds) {
      parts.push(`${ones[hundreds]} hundred`);
    }
    if (rest) {
      if (rest < 20) {
        parts.push(ones[rest]);
      } else {
        const ten = Math.floor(rest / 10);
        const one = rest % 10;
        parts.push(one ? `${tens[ten]} ${ones[one]}` : tens[ten]);
      }
    }
    return parts.join(' ');
  }

  const scales = [
    { value: 1_000_000_000, label: 'billion' },
    { value: 1_000_000, label: 'million' },
    { value: 1_000, label: 'thousand' },
    { value: 1, label: '' },
  ];
  let remaining = Math.floor(value);
  const parts: string[] = [];
  for (const scale of scales) {
    const chunk = Math.floor(remaining / scale.value);
    if (!chunk) {
      continue;
    }
    parts.push(`${underThousand(chunk)}${scale.label ? ` ${scale.label}` : ''}`);
    remaining %= scale.value;
  }

  return sentenceCase(parts.join(' '));
}

function sentenceCase(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function formatPlainAmount(value: number): string {
  return roundCurrency(value).toFixed(2);
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function getInvoiceRevisionNumber(invoice: WorkspaceInvoiceDetail): number {
  const revision = Number((invoice as WorkspaceInvoiceDetail & { serverRevision?: number }).serverRevision ?? 1);
  return Number.isFinite(revision) && revision > 0 ? Math.floor(revision) : 1;
}

function roundCurrency(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function normalizeDate(value: string) {
  return value.slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'OL';
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

const pdfStyles = `
  :root{--pro-accent:#145C52;--pro-surface:#E5F1ED;--pro-line:#D6E0DA;--pro-text:#18231F}
  *{box-sizing:border-box}
  body{margin:0;background:#edf2f7;color:#18231f;font-family:Inter,Arial,sans-serif}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:18mm;box-shadow:0 20px 60px rgba(20,32,51,.16)}
  .document-header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #dce6f2;padding-bottom:18px;margin-bottom:20px}
  .brand-row{display:flex;gap:14px;align-items:flex-start;min-width:0}
  .logo,.logo-fallback{width:58px;height:58px;border-radius:16px;object-fit:contain;flex:0 0 auto}
  .logo-fallback{display:grid;place-items:center;background:#e8f1ff;color:#245db5;font-weight:900;font-size:18px}
  h1,h2,p{margin:0}.business-copy h1{font-size:24px;line-height:1.1}.business-copy p{margin-top:6px;color:#516173;font-size:12px;line-height:1.5}
  .statement-title{text-align:right;display:grid;gap:6px;justify-items:end}.label{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#66758a}.statement-title strong{font-size:22px}.statement-title span{font-size:12px;color:#66758a}
  .style-badge{display:inline-flex;border:1px solid #cdd8e8;border-radius:999px;padding:5px 9px;font-size:10px;font-style:normal;font-weight:800;color:#245db5;background:#f5f8fc}
  .identity-grid,.summary-signature{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.panel,.summary-card,.signature-card,.tax-note{border:1px solid #dce6f2;border-radius:16px;padding:14px;background:#fbfdff}
  .panel h2,.summary-card h2,.signature-card h2{font-size:16px;margin-top:6px}.panel p{font-size:12px;line-height:1.6;color:#516173;margin-top:6px}
  .table-section{margin:18px 0}.table-section h2{font-size:15px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid #e2eaf4;padding:9px 8px;text-align:left;vertical-align:top}th{background:#f4f8fc;color:#516173;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.numeric{text-align:right}.description{font-weight:700}.empty-table{border:1px dashed #cdd8e8;border-radius:14px;padding:18px;color:#66758a}
  .summary-line{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #e5edf6;font-size:12px}.summary-line.emphasized{font-size:15px;font-weight:900;color:#145C52;border-bottom:0}.amount-words{font-size:11px;line-height:1.5;margin-top:10px;color:#516173}
  .signature-box{height:60px;border:1px dashed #cad6e6;border-radius:12px;display:grid;place-items:center;color:#8390a3;margin:12px 0}.signature{max-width:100%;max-height:52px;object-fit:contain}.signature-line{height:1px;background:#aebace;margin-bottom:8px}
  .urgent-stamp{margin:0 0 14px auto;width:max-content;max-width:100%;border:2px solid #b42318;color:#b42318;border-radius:12px;padding:8px 14px;text-transform:uppercase;font-weight:900;letter-spacing:.08em;transform:rotate(-1deg)}
  .instrument-proof{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:16px;align-items:center;border:1px solid #dce6f2;border-radius:16px;padding:14px;background:#fbfdff;margin:16px 0;break-inside:avoid}.instrument-proof h2{font-size:15px;margin:6px 0}.instrument-proof p{font-size:11px;color:#516173}.instrument-proof img{width:100%;max-height:140px;object-fit:contain;border:1px solid #dce6f2;border-radius:12px;background:#fff}
  .payment-link-block{border:1px solid #b9d7ff;border-radius:16px;padding:14px;background:#f4f8ff;margin:16px 0;break-inside:avoid}.payment-link-block h2{font-size:16px;margin:6px 0;color:#1a62d3}.payment-link-block p,.payment-link-block a{font-size:11px;line-height:1.5;word-break:break-word}.payment-link-block a{color:#1a62d3;font-weight:800}
  .tax-note{font-size:11px;color:#516173;line-height:1.55}.tax-breakdown{margin:8px 0}.account-summary-panel h2{font-size:26px;color:#b56a18}
  .style-advanced .page{border-top:8px solid var(--pro-accent)}.style-advanced .logo-fallback,.style-advanced .style-badge{background:var(--pro-surface);color:var(--pro-accent);border-color:var(--pro-line)}.style-advanced .statement-title strong,.style-advanced .summary-line.emphasized{color:var(--pro-accent)}
  .brand-footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:12px;border-top:1px solid var(--pro-line);font-size:10px;font-weight:800;color:var(--pro-accent)}
  .brand-footer--free{border:1px solid #dce6f2;border-radius:999px;padding:9px 12px;background:#f7faff;color:#516173}
  @media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;box-shadow:none;padding:12mm}@page{size:A4;margin:10mm}}
`;
