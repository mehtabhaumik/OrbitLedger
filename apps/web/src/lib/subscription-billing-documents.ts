'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import type { WebSubscriptionBillingFields } from './subscription-entitlements';

export type WebSubscriptionBillingDocument = WebSubscriptionBillingFields & {
  id: string;
  planLabel: string;
  status: string;
  provider: string;
  transactionId: string | null;
  providerReference: string | null;
  recordedAt: string | null;
};

type BillingPdf = InstanceType<typeof import('jspdf').jsPDF>;

const page = {
  width: 595.28,
  height: 841.89,
  margin: 42,
};

export function buildBillingDocumentFileName(document: WebSubscriptionBillingDocument) {
  return `${filePart(document.receiptNumber ?? document.taxInvoiceNumber ?? document.id)}_orbit_ledger_receipt.pdf`;
}

export function openBillingDocumentViewer(document: WebSubscriptionBillingDocument, workspace: OrbitWorkspaceSummary | null) {
  const target = window.open('', '_blank', 'noopener,noreferrer');
  if (!target) {
    throw new Error('Billing document could not open. Try downloading it instead.');
  }

  target.document.open();
  target.document.write(buildBillingDocumentHtml(document, workspace));
  target.document.close();
}

export async function downloadBillingReceiptPdf(
  document: WebSubscriptionBillingDocument,
  workspace: OrbitWorkspaceSummary | null
) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  drawBillingDocument(pdf, document, workspace);
  pdf.save(buildBillingDocumentFileName(document));
}

export function buildBillingDocumentHtml(
  document: WebSubscriptionBillingDocument,
  workspace: OrbitWorkspaceSummary | null
) {
  const rows = buildBillingRows(document, workspace);
  const status = billingStatusLabel(document);
  const safeReceipt = escapeHtml(document.receiptNumber ?? 'Pending receipt');
  const safeTaxInvoice = escapeHtml(document.taxInvoiceNumber ?? 'Pending tax invoice');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeReceipt}</title>
  <style>
    :root{color:#182233;background:#eef3f9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{margin:0;padding:32px;background:#eef3f9}
    .page{max-width:860px;margin:0 auto;background:#fff;border:1px solid #d8e2ef;border-radius:18px;padding:38px;box-shadow:0 20px 60px rgba(27,45,75,.12)}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #d8e2ef;padding-bottom:24px}
    .brand{display:flex;gap:16px;align-items:flex-start}
    .logo{width:58px;height:58px;border-radius:16px;background:#eaf2ff;color:#2f63b7;display:grid;place-items:center;font-weight:800;font-size:20px}
    h1{margin:0;font-size:28px;line-height:1.1}
    p{margin:6px 0 0;color:#607087;font-size:14px;line-height:1.5}
    .doc{text-align:right}
    .doc strong{display:block;font-size:22px}
    .chip{display:inline-flex;margin-top:10px;padding:7px 12px;border-radius:999px;background:#edf7f1;color:#20734f;font-weight:800;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:26px}
    .card{border:1px solid #d8e2ef;border-radius:14px;padding:16px;background:#fbfdff}
    .label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7b8ba3;font-weight:800;margin-bottom:6px}
    .value{font-size:15px;font-weight:750;color:#182233;word-break:break-word}
    .total{margin-top:26px;border:1px solid #d8e2ef;border-radius:16px;overflow:hidden}
    .line{display:grid;grid-template-columns:1fr auto;gap:12px;padding:14px 16px;border-bottom:1px solid #e6edf6}
    .line:last-child{border-bottom:0;background:#f6f9fe;font-weight:850}
    .footer{margin-top:28px;color:#7b8ba3;font-size:12px;display:flex;justify-content:space-between;gap:16px}
    @media print{body{background:#fff;padding:0}.page{box-shadow:none;border:0;border-radius:0;max-width:none}@page{size:A4;margin:12mm}}
  </style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div class="brand">
        <div class="logo">OL</div>
        <div>
          <h1>Orbit Ledger Receipt</h1>
          <p>${escapeHtml(document.sellerBrand ?? 'Orbit Ledger by Rudraix')}</p>
          <p>${escapeHtml(workspace?.businessName ?? document.buyerBusinessName ?? 'Workspace')}</p>
        </div>
      </div>
      <div class="doc">
        <strong>${safeReceipt}</strong>
        <p>${safeTaxInvoice}</p>
        <span class="chip">${escapeHtml(status)}</span>
      </div>
    </section>
    <section class="grid">
      ${rows.map(([label, value]) => `<div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join('')}
    </section>
    <section class="total">
      <div class="line"><span>Subtotal</span><strong>${escapeHtml(formatMinor(document.subtotalMinor ?? document.amountMinor, document.currency, document.amountDisplay))}</strong></div>
      <div class="line"><span>${escapeHtml(document.taxLabel ?? 'Tax')}</span><strong>${escapeHtml(formatMinor(document.taxMinor ?? 0, document.currency, null))}</strong></div>
      <div class="line"><span>Total</span><strong>${escapeHtml(formatMinor(document.totalMinor ?? document.amountMinor, document.currency, document.amountDisplay))}</strong></div>
    </section>
    <footer class="footer">
      <span>Generated using Orbit Ledger</span>
      <span>${escapeHtml(formatDate(document.issuedAt ?? document.recordedAt ?? document.createdAt))}</span>
    </footer>
  </main>
</body>
</html>`;
}

function drawBillingDocument(
  pdf: BillingPdf,
  document: WebSubscriptionBillingDocument,
  workspace: OrbitWorkspaceSummary | null
) {
  drawHeader(pdf, document, workspace);
  let y = page.margin + 112;
  y = drawCards(pdf, y, buildBillingRows(document, workspace).slice(0, 8));
  y += 20;
  drawTotals(pdf, y, document);
  drawFooter(pdf);
}

function drawHeader(pdf: BillingPdf, document: WebSubscriptionBillingDocument, workspace: OrbitWorkspaceSummary | null) {
  pdf.setFillColor(239, 245, 255);
  pdf.roundedRect(page.margin, page.margin, 58, 58, 14, 14, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(47, 99, 183);
  pdf.text('OL', page.margin + 29, page.margin + 36, { align: 'center' });
  pdf.setFontSize(18);
  pdf.setTextColor(24, 34, 51);
  pdf.text('Orbit Ledger Receipt', page.margin + 74, page.margin + 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(96, 112, 135);
  pdf.text(document.sellerBrand ?? 'Orbit Ledger by Rudraix', page.margin + 74, page.margin + 40);
  pdf.text(workspace?.businessName ?? document.buyerBusinessName ?? 'Workspace', page.margin + 74, page.margin + 56);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(24, 34, 51);
  pdf.text(document.receiptNumber ?? 'Pending receipt', page.width - page.margin, page.margin + 22, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(96, 112, 135);
  pdf.text(document.taxInvoiceNumber ?? 'Pending tax invoice', page.width - page.margin, page.margin + 42, { align: 'right' });

  pdf.setDrawColor(211, 222, 238);
  pdf.line(page.margin, page.margin + 82, page.width - page.margin, page.margin + 82);
}

function drawCards(pdf: BillingPdf, y: number, rows: Array<[string, string]>) {
  const gap = 10;
  const width = (page.width - page.margin * 2 - gap) / 2;
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = page.margin + column * (width + gap);
    const cardY = y + row * 66;
    pdf.setFillColor(248, 251, 255);
    pdf.setDrawColor(218, 228, 241);
    pdf.roundedRect(x, cardY, width, 54, 10, 10, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(128, 142, 164);
    pdf.text(label.toUpperCase(), x + 12, cardY + 18);
    pdf.setFontSize(10);
    pdf.setTextColor(24, 34, 51);
    pdf.text(pdf.splitTextToSize(value, width - 24), x + 12, cardY + 35);
  });
  return y + Math.ceil(rows.length / 2) * 66;
}

function drawTotals(pdf: BillingPdf, y: number, document: WebSubscriptionBillingDocument) {
  const rows: Array<[string, string]> = [
    ['Subtotal', formatMinor(document.subtotalMinor ?? document.amountMinor, document.currency, document.amountDisplay)],
    [document.taxLabel ?? 'Tax', formatMinor(document.taxMinor ?? 0, document.currency, null)],
    ['Total', formatMinor(document.totalMinor ?? document.amountMinor, document.currency, document.amountDisplay)],
  ];
  pdf.setDrawColor(218, 228, 241);
  pdf.roundedRect(page.margin, y, page.width - page.margin * 2, 104, 12, 12, 'S');
  rows.forEach(([label, value], index) => {
    const rowY = y + 26 + index * 28;
    pdf.setFont('helvetica', index === 2 ? 'bold' : 'normal');
    pdf.setFontSize(index === 2 ? 13 : 10);
    pdf.setTextColor(24, 34, 51);
    pdf.text(label, page.margin + 16, rowY);
    pdf.text(value, page.width - page.margin - 16, rowY, { align: 'right' });
  });
}

function drawFooter(pdf: BillingPdf) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(128, 142, 164);
  pdf.text('Generated using Orbit Ledger', page.margin, page.height - 28);
  pdf.text(new Date().toISOString().slice(0, 10), page.width - page.margin, page.height - 28, { align: 'right' });
}

function buildBillingRows(
  document: WebSubscriptionBillingDocument,
  workspace: OrbitWorkspaceSummary | null
): Array<[string, string]> {
  return [
    ['Plan', document.planLabel],
    ['Status', billingStatusLabel(document)],
    ['Buyer', document.buyerLegalName ?? document.buyerBusinessName ?? workspace?.businessName ?? 'Workspace'],
    ['Email', document.buyerEmail ?? workspace?.email ?? 'Not saved'],
    ['Country', [document.buyerCountry, document.buyerState].filter(Boolean).join(' / ') || 'Not saved'],
    [document.taxRegistrationLabel ?? 'Tax ID', document.taxRegistrationNumber ?? 'Not saved'],
    ['Transaction', document.transactionId ?? document.providerReference ?? 'Pending confirmation'],
    ['Recorded', formatDate(document.issuedAt ?? document.recordedAt ?? document.createdAt)],
  ];
}

function billingStatusLabel(document: WebSubscriptionBillingDocument) {
  if (document.receiptStatus === 'ready' || document.status === 'confirmed') {
    return 'Receipt ready';
  }
  if (document.status === 'failed') {
    return 'Payment failed';
  }
  if (document.status === 'blocked_plan_change') {
    return 'Change not available';
  }
  return 'Pending confirmation';
}

function formatMinor(amountMinor: number | null, currency: string | null, fallback: string | null) {
  if (amountMinor === null || !Number.isFinite(Number(amountMinor))) {
    return fallback ?? 'Not available';
  }
  const currencyCode = currency && /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    currency: currencyCode,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(Number(amountMinor) / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not recorded';
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

function filePart(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'billing_document';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
