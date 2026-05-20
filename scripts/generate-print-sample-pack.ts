import { chromium } from '@playwright/test';
import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import { buildCustomerHealthScore, buildInvoicePaymentLink } from '@orbit-ledger/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildInvoiceWebDocument, buildStatementWebDocument } from '../apps/web/src/lib/web-documents';
import { getWebProSubscriptionStatus } from '../apps/web/src/lib/web-monetization';
import { buildOrbitPrintDocument, formatPrintCurrency, type PrintDocumentInput } from '../apps/web/src/lib/print-system';
import type { WorkspaceCustomer, WorkspaceInvoiceDetail, WorkspaceTransaction } from '../apps/web/src/lib/workspace-data';

const outputDir = join(process.cwd(), 'artifacts', 'print-sample-pack');
const generatedAt = new Date('2026-05-20T13:15:00.000Z');

const workspace: OrbitWorkspaceSummary = {
  workspaceId: 'sample-workspace',
  businessName: 'Rudraix Private Limited',
  legalName: 'Rudraix Private Limited',
  ownerName: 'Bhaumik Mehta',
  phone: '+91 82009 52311',
  email: 'billing@rudraix.example',
  address: 'B-603, Shilpan Bliss, Near Navrachna University, Vasna Bhayli Road, Bhayli',
  addressLine1: 'B-603, Shilpan Bliss',
  addressLine2: 'Near Navrachna University, Vasna Bhayli Road',
  city: 'Vadodara',
  town: 'Bhayli',
  postalCode: '391410',
  registeredAddressSameAsCompany: false,
  registeredAddressLine1: 'Registered Office, Tower A',
  registeredAddressLine2: 'Near Navrachna University',
  registeredCity: 'Vadodara',
  registeredTown: 'Bhayli',
  registeredPostalCode: '391410',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
  gstin: '24ABCDE1234F1Z5',
  logoUri: null,
  authorizedPersonName: 'Bhaumik Mehta',
  authorizedPersonTitle: 'Owner',
  signatureUri: null,
  paymentInstructions: {
    upiId: 'rudraix@okhdfc',
    paymentPageUrl: 'https://pay.example.invalid/orbit-ledger',
    paymentNote: 'Mention invoice number before payment.',
    bankAccountName: 'Rudraix Private Limited',
    bankName: 'HDFC Bank',
    bankAccountNumber: '1234567890',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Vadodara',
    bankRoutingNumber: null,
    bankSortCode: null,
    bankIban: null,
    bankSwift: null,
  },
  documentFooterPreference: 'hide_when_pro',
  documentBrandHeaderColor: '#245B4E',
  documentBrandBackgroundColor: '#F3F7F5',
  documentBrandFontColor: '#14231F',
  documentBrandLineColor: '#8FB8AA',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-20T12:00:00.000Z',
  serverRevision: 11,
  dataState: 'full_dataset',
};

const customer: WorkspaceCustomer = {
  id: 'customer-sonali',
  name: 'Sonali Traders',
  legalName: 'Sonali Traders',
  customerType: 'Business',
  contactPerson: 'Sonali Mehta',
  phone: '+91 95869 76949',
  whatsapp: '+91 95869 76949',
  email: 'billing@sonali.example',
  address: 'Sample Market Road, Navrangpura',
  billingAddress: 'Sample Market Road, Navrangpura, Ahmedabad',
  shippingAddress: 'Warehouse 2, Sarkhej Road, Ahmedabad',
  city: 'Ahmedabad',
  stateCode: 'GJ',
  countryCode: 'IN',
  postalCode: '380009',
  gstin: '24AAQCS1234F1Z7',
  pan: 'AAQCS1234F',
  taxNumber: null,
  registrationNumber: 'GJ-SME-2048',
  placeOfSupply: 'GJ',
  defaultTaxTreatment: 'Registered business',
  notes: 'Preferred billing contact is the owner. Send monthly payment link after statement review.',
  openingBalance: 2000,
  creditLimit: 50000,
  paymentTerms: '7 days',
  preferredPaymentMode: 'UPI',
  preferredInvoiceTemplate: 'IN_PAYMENT_FOCUSED_PRO',
  preferredLanguage: 'English',
  tags: ['VIP', 'monthly-service', 'follow-up'],
  isArchived: false,
  createdAt: '2026-01-08T00:00:00.000Z',
  updatedAt: '2026-05-20T12:00:00.000Z',
  balance: 4130,
  health: buildCustomerHealthScore({ balance: 4130, totalCredit: 25130, totalPayment: 21000 }),
};

const invoice: WorkspaceInvoiceDetail = {
  id: 'sample-invoice-001',
  customerId: customer.id,
  customerName: customer.name,
  invoiceNumber: 'RPL-SON-2026-0007',
  issueDate: '2026-05-20',
  dueDate: '2026-05-27',
  billingMonth: '2026-05',
  subtotal: 11300,
  taxAmount: 2034,
  totalAmount: 13334,
  paidAmount: 5000,
  status: 'issued',
  documentState: 'created',
  paymentStatus: 'partially_paid',
  paymentStatusReason: 'Part payment received',
  useForMonthlyAutoEmail: true,
  recurringRuleId: 'monthly-service-sonali',
  autoEmailPreparedAt: '2026-05-17T09:00:00.000Z',
  autoEmailScheduledFor: '2026-05-21T10:00:00.000Z',
  hasAutoEmailHistory: true,
  latestAutoEmailStatus: 'scheduled',
  latestAutoEmailSentAt: null,
  latestAutoEmailVersionId: 'sample-invoice-001-v2',
  versionNumber: 2,
  serverRevision: 5,
  isArchived: false,
  latestVersionId: 'sample-invoice-001-v2',
  latestSnapshotHash: 'sample-snapshot-v2',
  notes: 'Recurring service package for May 2026. Payment link and manual bank details are included.',
  versions: [],
  items: [
    {
      id: 'item-1',
      invoiceId: 'sample-invoice-001',
      productId: 'service-ledger',
      name: 'Monthly Ledger Review',
      description: 'Accounts review, customer balance check, and report preparation',
      quantity: 1,
      price: 6500,
      taxRate: 18,
      total: 7670,
    },
    {
      id: 'item-2',
      invoiceId: 'sample-invoice-001',
      productId: 'service-followup',
      name: 'Payment Follow-up Setup',
      description: 'Reminder templates and follow-up cadence for active customers',
      quantity: 1,
      price: 3200,
      taxRate: 18,
      total: 3776,
    },
    {
      id: 'item-3',
      invoiceId: 'sample-invoice-001',
      productId: 'service-print',
      name: 'Print-ready Document Pack',
      description: 'Invoice, statement, receipt, and closing summary review',
      quantity: 1,
      price: 1600,
      taxRate: 18,
      total: 1888,
    },
  ],
};

const transactions: WorkspaceTransaction[] = [
  {
    id: 'txn-1',
    customerId: customer.id,
    customerName: customer.name,
    type: 'credit',
    amount: 13334,
    note: 'Invoice RPL-SON-2026-0007 created',
    paymentMode: null,
    paymentDetails: null,
    paymentClearanceStatus: null,
    paymentAttachments: [],
    effectiveDate: '2026-05-20',
    createdAt: '2026-05-20T09:00:00.000Z',
  },
  {
    id: 'txn-2',
    customerId: customer.id,
    customerName: customer.name,
    type: 'payment',
    amount: 5000,
    note: 'UPI part payment received for May invoice',
    paymentMode: 'UPI',
    paymentDetails: { upiId: 'sonali@okaxis', reference: 'UPI-489201' },
    paymentClearanceStatus: 'Cleared',
    paymentAttachments: [],
    effectiveDate: '2026-05-20',
    createdAt: '2026-05-20T11:30:00.000Z',
  },
  {
    id: 'txn-3',
    customerId: customer.id,
    customerName: customer.name,
    type: 'credit',
    amount: 1796,
    note: 'Additional statement preparation requested',
    paymentMode: null,
    paymentDetails: null,
    paymentClearanceStatus: null,
    paymentAttachments: [],
    effectiveDate: '2026-05-21',
    createdAt: '2026-05-21T10:00:00.000Z',
  },
];

const paymentLink = buildInvoicePaymentLink({
  businessName: workspace.businessName,
  customerName: customer.name,
  amount: invoice.totalAmount - invoice.paidAmount,
  currency: workspace.currency,
  countryCode: workspace.countryCode,
  invoiceNumber: invoice.invoiceNumber,
  dueDate: invoice.dueDate,
  details: workspace.paymentInstructions,
});

async function main() {
  await mkdir(outputDir, { recursive: true });

  const proofImage = buildPaymentProofDataUrl();
  const invoiceDocument = buildInvoiceWebDocument({
    workspace,
    invoice,
    customer,
    subscription: getWebProSubscriptionStatus(),
    templateKey: 'IN_PAYMENT_FOCUSED_PRO',
    proTheme: {
      key: 'ledger_green',
      label: 'Print pack',
      description: 'Sample print pack branding',
      accentColor: '#245B4E',
      surfaceColor: '#F3F7F5',
      lineColor: '#8FB8AA',
      textColor: '#14231F',
    },
    brandWatermarkText: 'SAMPLE',
    brandWatermarkOpacity: 0.08,
    paymentLink,
    paymentModeLine: 'UPI - rudraix@okhdfc',
    paymentStatusLine: 'Partially paid - balance due',
    instrumentAttachment: {
      name: 'sample-payment-proof.svg',
      url: proofImage,
      contentType: 'image/svg+xml',
    },
  });

  const statementDocument = buildStatementWebDocument({
    workspace,
    customer,
    transactions,
    generatedAt,
  });

  const reportDocument = buildOrbitPrintDocument(buildBusinessReportInput());
  const closingDocument = buildOrbitPrintDocument(buildDailyClosingInput());
  const receiptDocument = buildOrbitPrintDocument(buildPaymentReceiptInput(proofImage));

  const samples = [
    ['01-invoice-payment-focused', invoiceDocument.html],
    ['02-customer-ledger-statement', statementDocument.html],
    ['03-business-report-snapshot', reportDocument],
    ['04-daily-closing-summary', closingDocument],
    ['05-payment-receipt-with-proof', receiptDocument],
  ] as const;

  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, html] of samples) {
      await renderSample(browser, name, stripAutoPrint(html));
    }
  } finally {
    await browser.close();
  }

  await writeFile(
    join(outputDir, 'README.md'),
    [
      '# Orbit Ledger sample business PDF pack',
      '',
      'Generated from the shared invoice, statement, and universal print systems.',
      '',
      'Files:',
      ...samples.map(([name]) => `- ${name}.pdf`),
      '',
      'QA notes:',
      '- No app shell, navigation, filters, or CTAs are included in the PDFs.',
      '- Print headers include business identity, address/contact details, prepared-by context, and India-readable timestamps.',
      '- Payment proof uses an embedded sample image here; production invoice prints render the uploaded payment proof image/PDF reference from the saved attachment URL.',
      '- All samples are generated under `artifacts/print-sample-pack/`, which is intentionally ignored by git.',
      '',
    ].join('\n'),
    'utf8'
  );

  console.log(`Generated ${samples.length} PDF samples in ${outputDir}`);
}

async function renderSample(browser: Awaited<ReturnType<typeof chromium.launch>>, name: string, html: string) {
  const htmlPath = join(outputDir, `${name}.html`);
  const pdfPath = join(outputDir, `${name}.pdf`);
  const pngPath = join(outputDir, `${name}.png`);

  await writeFile(htmlPath, html, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await page.emulateMedia({ media: 'screen' });
    await page.screenshot({ path: pngPath, fullPage: true });
  } finally {
    await page.close();
  }
}

function buildBusinessReportInput(): PrintDocumentInput {
  return {
    title: 'Business Health Snapshot',
    subtitle: 'Receivables, collections, risk, and stock pressure for May 2026.',
    workspace,
    preparedBy: preparedBy(),
    generatedAt,
    classification: 'Management report',
    sections: [
      {
        type: 'summary',
        title: 'Month summary',
        description: 'A compact view of current operating health.',
        metrics: [
          { label: 'Outstanding', value: formatPrintCurrency(4130, workspace.currency, workspace.countryCode), helper: 'Customer balances after recorded payments' },
          { label: 'Collected', value: formatPrintCurrency(21000, workspace.currency, workspace.countryCode), helper: 'Payments cleared this month' },
          { label: 'Overdue', value: formatPrintCurrency(1770, workspace.currency, workspace.countryCode), helper: 'Requires follow-up' },
          { label: 'Low stock', value: 2, helper: 'Products below review threshold' },
        ],
      },
      {
        type: 'table',
        title: 'Aging and action list',
        description: 'Items that need owner attention.',
        columns: [
          { key: 'bucket', label: 'Bucket' },
          { key: 'records', label: 'Records', align: 'center' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'action', label: 'Next action' },
        ],
        rows: [
          { bucket: '0-7 days', records: 3, amount: formatPrintCurrency(13334, workspace.currency, workspace.countryCode), action: 'Monitor payment link activity' },
          { bucket: '8-15 days', records: 1, amount: formatPrintCurrency(1770, workspace.currency, workspace.countryCode), action: 'Send polite follow-up' },
          { bucket: '31+ days', records: 1, amount: formatPrintCurrency(2500, workspace.currency, workspace.countryCode), action: 'Call customer before next credit' },
        ],
      },
      {
        type: 'notes',
        title: 'Owner notes',
        lines: [
          'Keep automatic email enabled only for invoices selected for monthly auto email.',
          'Review payment proof attachments before marking manually received payments as verified.',
          'Stock pressure is low, but printer rolls should be reviewed before next week.',
        ],
      },
    ],
  };
}

function buildDailyClosingInput(): PrintDocumentInput {
  return {
    title: 'Daily Closing Summary',
    subtitle: 'Three-minute closing record for 20 May 2026.',
    workspace,
    preparedBy: preparedBy(),
    generatedAt,
    classification: 'Daily close',
    sections: [
      {
        type: 'summary',
        title: 'Closing checks',
        description: 'Confirmed checks before carrying work into tomorrow.',
        metrics: [
          { label: 'Cash counted', value: formatPrintCurrency(0, workspace.currency, workspace.countryCode), helper: 'No cash variance' },
          { label: 'Payments reviewed', value: 2, helper: 'One UPI payment cleared, one proof reviewed' },
          { label: 'Credit entries', value: 1, helper: 'Additional service credit reviewed' },
          { label: 'Follow-ups tomorrow', value: 3, helper: 'Customers needing contact' },
        ],
      },
      {
        type: 'table',
        title: 'Tomorrow actions',
        columns: [
          { key: 'priority', label: 'Priority' },
          { key: 'record', label: 'Record' },
          { key: 'owner', label: 'Owner' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { priority: 'High', record: 'Sonali Traders balance follow-up', owner: 'Bhaumik Mehta', status: 'Ready' },
          { priority: 'Medium', record: 'Payment proof verification', owner: 'Bhaumik Mehta', status: 'Review' },
          { priority: 'Low', record: 'Stock unit review', owner: 'Operations', status: 'Waiting' },
        ],
      },
    ],
  };
}

function buildPaymentReceiptInput(proofImage: string): PrintDocumentInput {
  return {
    title: 'Payment Receipt',
    subtitle: 'Receipt for verified UPI part payment against invoice RPL-SON-2026-0007.',
    workspace,
    preparedBy: preparedBy(),
    generatedAt,
    classification: 'Payment receipt',
    sections: [
      {
        type: 'summary',
        title: 'Receipt details',
        metrics: [
          { label: 'Customer', value: customer.name },
          { label: 'Amount received', value: formatPrintCurrency(5000, workspace.currency, workspace.countryCode) },
          { label: 'Mode', value: 'UPI' },
          { label: 'Status', value: 'Verified cleared' },
        ],
      },
      {
        type: 'table',
        title: 'Allocation',
        columns: [
          { key: 'invoice', label: 'Invoice' },
          { key: 'amount', label: 'Applied amount', align: 'right' },
          { key: 'balance', label: 'Balance after payment', align: 'right' },
        ],
        rows: [
          {
            invoice: invoice.invoiceNumber,
            amount: formatPrintCurrency(5000, workspace.currency, workspace.countryCode),
            balance: formatPrintCurrency(invoice.totalAmount - invoice.paidAmount, workspace.currency, workspace.countryCode),
          },
        ],
      },
      {
        type: 'image',
        title: 'Payment proof attachment',
        description: 'Attached proof is contained so it does not break the print layout.',
        src: proofImage,
        caption: 'Sample payment proof preview. Production prints use the saved attachment uploaded by the user.',
      },
    ],
  };
}

function preparedBy() {
  return {
    name: 'Bhaumik Mehta',
    email: 'bhaumik@rudraix.example',
    role: 'Owner',
  };
}

function buildPaymentProofDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520">
    <rect width="1200" height="520" rx="42" fill="#F6FAF9" stroke="#9DBFB4" stroke-width="10"/>
    <text x="78" y="128" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#14231F">Payment proof</text>
    <text x="78" y="215" font-family="Arial, sans-serif" font-size="42" fill="#516174">Sample cheque / DD / receipt image</text>
    <text x="78" y="302" font-family="Arial, sans-serif" font-size="34" fill="#516174">RPL-SON-2026-0007 · UPI-489201</text>
    <text x="860" y="130" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#2F8B63">VERIFIED</text>
    <line x1="78" y1="390" x2="1122" y2="390" stroke="#2F8B63" stroke-width="16" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function stripAutoPrint(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, '');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
