'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import type { WorkspaceCustomer } from './workspace-data';

type CustomerExportPdf = InstanceType<typeof import('jspdf').jsPDF>;

const page = {
  width: 595.28,
  height: 841.89,
  margin: 42,
};

export async function downloadCustomerProfilePdf(input: {
  workspace: OrbitWorkspaceSummary;
  customers: WorkspaceCustomer[];
}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const currency = input.workspace.currency;

  if (input.customers.length > 1) {
    drawCoverPage(pdf, input.workspace, input.customers);
  }

  input.customers.forEach((customer, index) => {
    if (index > 0 || input.customers.length > 1) {
      pdf.addPage();
    }
    drawCustomerPage(pdf, input.workspace, customer, currency);
  });

  pdf.save(buildCustomerPdfFileName(input.workspace.businessName, input.customers));
}

function drawCoverPage(
  pdf: CustomerExportPdf,
  workspace: OrbitWorkspaceSummary,
  customers: WorkspaceCustomer[]
) {
  const totals = customers.reduce(
    (summary, customer) => {
      summary.balance += customer.balance;
      if (customer.balance > 0) {
        summary.outstanding += customer.balance;
        summary.outstandingCount += 1;
      }
      if (customer.balance < 0) {
        summary.advance += Math.abs(customer.balance);
        summary.advanceCount += 1;
      }
      return summary;
    },
    { balance: 0, outstanding: 0, outstandingCount: 0, advance: 0, advanceCount: 0 }
  );

  let y = page.margin;
  drawBrandHeader(pdf, workspace, 'Customer Profile Report', 'Selected customer export');
  y += 116;
  y = drawSectionTitle(pdf, 'Export summary', y);
  y = drawCards(pdf, y, [
    ['Customers', String(customers.length)],
    ['Outstanding', formatCurrency(totals.outstanding, workspace.currency)],
    ['Advance', formatCurrency(totals.advance, workspace.currency)],
    ['Net balance', formatCurrency(totals.balance, workspace.currency)],
  ]);
  y += 18;
  y = drawSectionTitle(pdf, 'Customer index', y);

  const rowHeight = 28;
  drawTableHeader(pdf, y, ['Customer', 'Phone', 'Health', 'Balance'], [170, 130, 115, 95]);
  y += rowHeight;
  for (const customer of customers.slice(0, 18)) {
    drawTableRow(
      pdf,
      y,
      [
        customer.name,
        customer.phone ?? 'Not saved',
        `${customer.health.label} ${customer.health.score}/100`,
        formatCurrency(customer.balance, workspace.currency),
      ],
      [170, 130, 115, 95]
    );
    y += rowHeight;
  }

  if (customers.length > 18) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(96, 112, 135);
    pdf.text(`${customers.length - 18} more customer pages follow.`, page.margin, y + 12);
  }
  drawFooter(pdf);
}

function drawCustomerPage(
  pdf: CustomerExportPdf,
  workspace: OrbitWorkspaceSummary,
  customer: WorkspaceCustomer,
  currency: string
) {
  let y = page.margin;
  drawBrandHeader(pdf, workspace, customer.name, customer.legalName || customer.customerType || 'Customer profile');
  y += 112;

  y = drawCards(pdf, y, [
    ['Current balance', formatCurrency(customer.balance, currency)],
    ['Opening balance', formatCurrency(customer.openingBalance, currency)],
    ['Health', `${customer.health.label} ${customer.health.score}/100`],
    ['Status', customer.isArchived ? 'Archived' : 'Active'],
  ]);

  y += 18;
  y = drawSectionTitle(pdf, 'Important customer information', y);
  y = drawTwoColumnSection(pdf, y, [
    ['Display name', customer.name],
    ['Legal / business name', customer.legalName ?? 'Not saved'],
    ['Customer type', customer.customerType ?? 'Not saved'],
    ['Contact person', customer.contactPerson ?? 'Not saved'],
    ['Phone', customer.phone ?? 'Not saved'],
    ['WhatsApp', customer.whatsapp ?? 'Not saved'],
    ['Email', customer.email ?? 'Not saved'],
    ['Tags', customer.tags.length ? customer.tags.join(', ') : 'Not saved'],
  ]);

  y += 12;
  y = drawSectionTitle(pdf, 'Address', y);
  y = drawTwoColumnSection(pdf, y, [
    ['Billing address', customer.billingAddress ?? customer.address ?? 'Not saved'],
    ['Shipping address', customer.shippingAddress ?? 'Not saved'],
    ['City', customer.city ?? 'Not saved'],
    ['State', customer.stateCode ?? 'Not saved'],
    ['Country', customer.countryCode ?? 'Not saved'],
    ['PIN / postcode', customer.postalCode ?? 'Not saved'],
  ]);

  y += 12;
  y = drawSectionTitle(pdf, 'Tax and payment settings', y);
  y = drawTwoColumnSection(pdf, y, [
    ['GSTIN', customer.gstin ?? 'Not saved'],
    ['PAN', customer.pan ?? 'Not saved'],
    ['VAT / tax number', customer.taxNumber ?? 'Not saved'],
    ['Registration number', customer.registrationNumber ?? 'Not saved'],
    ['Place of supply', customer.placeOfSupply ?? 'Not saved'],
    ['Tax treatment', customer.defaultTaxTreatment ?? 'Not saved'],
    ['Payment terms', customer.paymentTerms ?? 'Not saved'],
    ['Credit limit', customer.creditLimit !== null ? formatCurrency(customer.creditLimit, currency) : 'Not saved'],
  ]);

  y += 12;
  y = drawSectionTitle(pdf, 'Health note', y);
  y = drawParagraph(
    pdf,
    [
      customer.health.helper,
      customer.balance > 0
        ? 'This customer currently has an outstanding balance.'
        : customer.balance < 0
          ? 'This customer has an advance balance.'
          : 'This customer is currently settled.',
      customer.notes ? `Notes: ${customer.notes}` : 'No notes saved.',
    ].join(' '),
    y
  );

  drawFooter(pdf);
}

function drawBrandHeader(
  pdf: CustomerExportPdf,
  workspace: OrbitWorkspaceSummary,
  title: string,
  subtitle: string
) {
  const x = page.margin;
  pdf.setFillColor(239, 245, 255);
  pdf.roundedRect(x, page.margin, 58, 58, 14, 14, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(47, 99, 183);
  pdf.text(initials(workspace.businessName), x + 29, page.margin + 36, { align: 'center' });

  pdf.setFontSize(18);
  pdf.setTextColor(24, 34, 51);
  pdf.text(workspace.businessName, x + 74, page.margin + 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(96, 112, 135);
  pdf.text([workspace.legalName, workspace.phone, workspace.email].filter(Boolean).join(' | '), x + 74, page.margin + 40);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(24, 34, 51);
  pdf.text(title, page.width - page.margin, page.margin + 22, { align: 'right', maxWidth: 230 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(96, 112, 135);
  pdf.text(subtitle, page.width - page.margin, page.margin + 42, { align: 'right', maxWidth: 230 });

  pdf.setDrawColor(211, 222, 238);
  pdf.line(page.margin, page.margin + 82, page.width - page.margin, page.margin + 82);
}

function drawCards(pdf: CustomerExportPdf, y: number, cards: Array<[string, string]>) {
  const gap = 10;
  const width = (page.width - page.margin * 2 - gap * 3) / 4;
  cards.forEach(([label, value], index) => {
    const x = page.margin + index * (width + gap);
    pdf.setFillColor(248, 251, 255);
    pdf.setDrawColor(218, 228, 241);
    pdf.roundedRect(x, y, width, 72, 12, 12, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(128, 142, 164);
    pdf.text(label.toUpperCase(), x + 12, y + 20);
    pdf.setFontSize(13);
    pdf.setTextColor(24, 34, 51);
    pdf.text(pdf.splitTextToSize(value, width - 24), x + 12, y + 45);
  });
  return y + 84;
}

function drawSectionTitle(pdf: CustomerExportPdf, title: string, y: number) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(24, 34, 51);
  pdf.text(title, page.margin, y);
  return y + 14;
}

function drawTwoColumnSection(pdf: CustomerExportPdf, y: number, rows: Array<[string, string]>) {
  const gap = 16;
  const width = (page.width - page.margin * 2 - gap) / 2;
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = page.margin + column * (width + gap);
    const rowY = y + row * 34;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(128, 142, 164);
    pdf.text(label.toUpperCase(), x, rowY);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(24, 34, 51);
    pdf.text(pdf.splitTextToSize(value, width), x, rowY + 14);
  });
  return y + Math.ceil(rows.length / 2) * 34 + 4;
}

function drawParagraph(pdf: CustomerExportPdf, text: string, y: number) {
  pdf.setFillColor(248, 251, 255);
  pdf.setDrawColor(218, 228, 241);
  pdf.roundedRect(page.margin, y, page.width - page.margin * 2, 76, 12, 12, 'FD');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(78, 92, 115);
  pdf.text(pdf.splitTextToSize(text, page.width - page.margin * 2 - 24), page.margin + 12, y + 20);
  return y + 88;
}

function drawTableHeader(pdf: CustomerExportPdf, y: number, headers: string[], widths: number[]) {
  pdf.setFillColor(244, 248, 252);
  pdf.rect(page.margin, y - 16, widths.reduce((sum, width) => sum + width, 0), 28, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(96, 112, 135);
  let x = page.margin + 8;
  headers.forEach((header, index) => {
    pdf.text(header.toUpperCase(), x, y);
    x += widths[index] ?? 0;
  });
}

function drawTableRow(pdf: CustomerExportPdf, y: number, values: string[], widths: number[]) {
  pdf.setDrawColor(226, 234, 244);
  pdf.line(page.margin, y + 12, page.width - page.margin, y + 12);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(24, 34, 51);
  let x = page.margin + 8;
  values.forEach((value, index) => {
    pdf.text(pdf.splitTextToSize(value, (widths[index] ?? 90) - 12), x, y);
    x += widths[index] ?? 0;
  });
}

function drawFooter(pdf: CustomerExportPdf) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(128, 142, 164);
  pdf.text('Generated using Orbit Ledger', page.margin, page.height - 28);
  pdf.text(new Date().toISOString().slice(0, 10), page.width - page.margin, page.height - 28, { align: 'right' });
}

function buildCustomerPdfFileName(businessName: string, customers: WorkspaceCustomer[]) {
  const name = customers.length === 1 ? customers[0]?.name ?? 'customer' : `${customers.length}-customers`;
  return `${filePart(businessName)}_${filePart(name)}_customer_profile.pdf`;
}

function filePart(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'export';
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'OL';
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
