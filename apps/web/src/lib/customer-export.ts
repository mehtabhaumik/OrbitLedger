'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import type { WorkspaceCustomer } from './workspace-data';

export async function downloadCustomerProfilePdf(input: {
  workspace: OrbitWorkspaceSummary;
  customers: WorkspaceCustomer[];
}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 48;

  input.customers.forEach((customer, index) => {
    if (index > 0) {
      pdf.addPage();
    }

    const currency = input.workspace.currency;
    let y = margin;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(customer.name, margin, y);
    pdf.setFontSize(10);
    pdf.setTextColor(96, 112, 135);
    pdf.text(input.workspace.businessName, pageWidth - margin, y, { align: 'right' });
    y += 28;

    pdf.setDrawColor(206, 218, 235);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 26;

    y = drawMetric(pdf, 'Health rank', `${customer.health.label} (${customer.health.score}/100)`, margin, y);
    y = drawMetric(pdf, 'Balance', formatCurrency(customer.balance, currency), margin, y);
    y = drawMetric(pdf, 'Opening balance', formatCurrency(customer.openingBalance, currency), margin, y);
    y = drawMetric(pdf, 'Legal name', customer.legalName ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Customer type', customer.customerType ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Contact person', customer.contactPerson ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Phone', customer.phone ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'WhatsApp', customer.whatsapp ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Email', customer.email ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Billing address', customer.billingAddress ?? customer.address ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Shipping address', customer.shippingAddress ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Tax IDs', [customer.gstin && `GSTIN ${customer.gstin}`, customer.pan && `PAN ${customer.pan}`, customer.taxNumber].filter(Boolean).join(' | ') || 'Not saved', margin, y);
    y = drawMetric(pdf, 'Payment terms', customer.paymentTerms ?? 'Not saved', margin, y);
    y = drawMetric(pdf, 'Credit limit', customer.creditLimit !== null ? formatCurrency(customer.creditLimit, currency) : 'Not saved', margin, y);
    y = drawMetric(pdf, 'Tags', customer.tags.length ? customer.tags.join(', ') : 'Not saved', margin, y);
    y = drawMetric(pdf, 'Status', customer.isArchived ? 'Archived' : 'Active', margin, y);
    y = drawMetric(pdf, 'Last updated', customer.updatedAt ? formatDate(customer.updatedAt) : 'Not saved', margin, y);
    y += 10;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(24, 34, 51);
    pdf.text('Important customer information', margin, y);
    y += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(78, 92, 115);
    const notes = [
      customer.health.helper,
      customer.notes ? `Notes: ${customer.notes}` : 'No notes saved.',
      customer.balance > 0
        ? 'This customer currently owes money.'
        : customer.balance < 0
          ? 'This customer has an advance balance.'
          : 'This customer is settled.',
    ];
    for (const note of notes) {
      const lines = pdf.splitTextToSize(`- ${note}`, pageWidth - margin * 2);
      pdf.text(lines, margin, y);
      y += lines.length * 14 + 8;
    }

    pdf.setFontSize(9);
    pdf.setTextColor(128, 142, 164);
    pdf.text('Generated using Orbit Ledger', margin, 800);
  });

  pdf.save(buildCustomerPdfFileName(input.workspace.businessName, input.customers));
}

function drawMetric(
  pdf: InstanceType<typeof import('jspdf').jsPDF>,
  label: string,
  value: string,
  x: number,
  y: number
) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(128, 142, 164);
  pdf.text(label.toUpperCase(), x, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(24, 34, 51);
  pdf.text(value, x + 150, y);
  return y + 24;
}

function buildCustomerPdfFileName(businessName: string, customers: WorkspaceCustomer[]) {
  const name = customers.length === 1 ? customers[0]?.name ?? 'customer' : `${customers.length}-customers`;
  return `${filePart(businessName)}_${filePart(name)}_customer_profile.pdf`;
}

function filePart(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'export';
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(value));
}
