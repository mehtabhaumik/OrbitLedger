import { describe, expect, it } from 'vitest';
import { buildCustomerHealthScore } from '@orbit-ledger/core';

import {
  buildInvoiceWebDocument,
  buildStatementWebDocument,
  getWebDocumentTemplate,
  getWebDocumentTemplates,
} from './web-documents';
import {
  getDefaultWebSubscriptionStatus,
  getWebPaidSubscriptionStatus,
  getWebProSubscriptionStatus,
} from './web-monetization';
import type { WorkspaceCustomer, WorkspaceInvoiceDetail, WorkspaceTransaction } from './workspace-data';
import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

const workspace: OrbitWorkspaceSummary = {
  workspaceId: 'workspace-1',
  businessName: 'Asha Traders',
  ownerName: 'Asha',
  phone: '+91 98765 43210',
  email: 'billing@example.com',
  address: 'Market Road',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
  logoUri: null,
  authorizedPersonName: 'Asha',
  authorizedPersonTitle: 'Owner',
  signatureUri: null,
  paymentInstructions: {
    upiId: 'asha@okaxis',
    paymentPageUrl: null,
    paymentNote: 'Mention invoice number.',
    bankAccountName: 'Asha Traders',
    bankName: 'HDFC Bank',
    bankAccountNumber: '1234567890',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Ahmedabad',
    bankRoutingNumber: null,
    bankSortCode: null,
    bankIban: null,
    bankSwift: null,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  serverRevision: 1,
  dataState: 'full_dataset',
};

const customer: WorkspaceCustomer = {
  id: 'customer-1',
  name: 'City Mart',
  legalName: null,
  customerType: null,
  contactPerson: null,
  phone: '+91 91234 56780',
  whatsapp: null,
  email: null,
  address: 'Station Road',
  billingAddress: 'Station Road',
  shippingAddress: null,
  city: null,
  stateCode: null,
  countryCode: null,
  postalCode: null,
  gstin: null,
  pan: null,
  taxNumber: null,
  registrationNumber: null,
  placeOfSupply: null,
  defaultTaxTreatment: null,
  notes: null,
  openingBalance: 100,
  creditLimit: null,
  paymentTerms: null,
  preferredPaymentMode: null,
  preferredInvoiceTemplate: null,
  preferredLanguage: null,
  tags: [],
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  balance: 350,
  health: buildCustomerHealthScore({ balance: 350, totalCredit: 500, totalPayment: 150 }),
};

function makeInvoice(): WorkspaceInvoiceDetail {
  return {
    id: 'invoice-1',
    customerId: customer.id,
    invoiceNumber: 'INV-100',
    issueDate: '2026-05-01',
    dueDate: '2026-05-08',
    subtotal: 1000,
    taxAmount: 180,
    totalAmount: 1180,
    paidAmount: 0,
    status: 'issued',
    documentState: 'created',
    paymentStatus: 'unpaid',
    versionNumber: 3,
    isArchived: false,
    latestVersionId: 'version-3',
    latestSnapshotHash: 'snapshot-3',
    customerName: customer.name,
    serverRevision: 3,
    notes: null,
    versions: [],
    items: [
      {
        id: 'item-1',
        invoiceId: 'invoice-1',
        productId: null,
        name: 'Repair service',
        description: null,
        quantity: 1,
        price: 1000,
        taxRate: 18,
        total: 1180,
      },
    ],
  };
}

describe('web document parity', () => {
  it('uses the same India invoice template family and locks Pro templates on Free', () => {
    const templates = getWebDocumentTemplates(workspace, 'invoice');
    expect(templates.map((template) => template.key)).toContain('IN_GST_STANDARD_FREE');
    expect(templates.map((template) => template.key)).toContain('IN_GST_LETTERHEAD_PRO');

    const selected = getWebDocumentTemplate(
      workspace,
      'invoice',
      'IN_GST_LETTERHEAD_PRO',
      getDefaultWebSubscriptionStatus().isPro
    );
    expect(selected.key).toBe('IN_CLEAN_BASIC_FREE');
  });

  it('offers a clear free and Pro invoice template catalog', () => {
    const templates = getWebDocumentTemplates(workspace, 'invoice');

    expect(templates.filter((template) => template.tier === 'free').map((template) => template.label)).toEqual([
      'Clean Basic',
      'India GST Standard',
      'Simple Service Invoice',
    ]);
    expect(templates.filter((template) => template.tier === 'pro').map((template) => template.label)).toEqual([
      'Modern Business',
      'Retail GST',
      'Professional Letterhead',
      'Compact Table',
      'Payment-focused Invoice',
      'Branded Advanced',
    ]);
  });

  it('applies distinct template keys so previews, print, and HTML exports can render different layouts', () => {
    const invoice = makeInvoice();

    const freeDocument = buildInvoiceWebDocument({
      workspace,
      invoice,
      customer,
      templateKey: 'IN_SIMPLE_SERVICE_FREE',
    });
    const proDocument = buildInvoiceWebDocument({
      workspace,
      invoice,
      customer,
      subscription: getWebProSubscriptionStatus(),
      templateKey: 'IN_BRANDED_ADVANCED_PRO',
    });

    expect(freeDocument.html).toContain('template-key-in_simple_service_free');
    expect(freeDocument.html).toContain('.template-key-in_simple_service_free .document-header{display:grid');
    expect(proDocument.html).toContain('style-advanced template-premium_letterhead template-india_gst template-key-in_branded_advanced_pro');
    expect(proDocument.html).toContain('.template-key-in_branded_advanced_pro .document-header{display:grid');
  });

  it('renders invoice tax labels and PDF file names from the selected market template', () => {
    const invoice = makeInvoice();

    const document = buildInvoiceWebDocument({ workspace, invoice, customer });
    expect(document.fileName).toBe('City_Mart_INV-100_2026-05-01_3_IN.pdf');
    expect(document.csvFileName).toBe('City_Mart_INV-100_2026-05-01_3_IN.csv');
    expect(document.html).toContain('Tax Invoice');
    expect(document.html).toContain('Amount in words:</strong> One thousand one hundred eighty only');
    expect(document.html).toContain('Generated using Orbit Ledger');
    expect(document.html).toContain('GST');
    expect(document.html).toContain('CGST');
    expect(document.html).toContain('SGST');
  });

  it('does not show invoice template names on generated invoices', () => {
    const document = buildInvoiceWebDocument({ workspace, invoice: makeInvoice(), customer });

    expect(document.html).not.toContain('Clean Basic · Created');
    expect(document.html).not.toContain('Clean Basic</em>');
    expect(document.html).toContain('<span>Created</span></div></header>');
  });

  it('locks payment proof blocks on Free and renders them for Plus', () => {
    const lockedDocument = buildInvoiceWebDocument({
      workspace,
      invoice: makeInvoice(),
      customer,
      instrumentAttachment: {
        name: 'cheque.jpg',
        url: 'https://example.invalid/cheque.jpg',
        contentType: 'image/jpeg',
      },
    });
    const imageDocument = buildInvoiceWebDocument({
      workspace,
      invoice: makeInvoice(),
      customer,
      subscription: getWebPaidSubscriptionStatus('plus_monthly'),
      instrumentAttachment: {
        name: 'cheque.jpg',
        url: 'https://example.invalid/cheque.jpg',
        contentType: 'image/jpeg',
      },
    });
    const pdfDocument = buildInvoiceWebDocument({
      workspace,
      invoice: makeInvoice(),
      customer,
      subscription: getWebPaidSubscriptionStatus('plus_monthly'),
      instrumentAttachment: {
        name: 'payment-proof.pdf',
        url: 'https://example.invalid/payment-proof.pdf',
        contentType: 'application/pdf',
      },
    });

    expect(lockedDocument.html).not.toContain('Payment proof');
    expect(imageDocument.html).toContain('Payment proof');
    expect(imageDocument.html).toContain('<img src="https://example.invalid/cheque.jpg"');
    expect(pdfDocument.html).toContain('PDF proof');
    expect(pdfDocument.html).toContain('instrument-proof-file');
  });

  it('locks invoice payment links on Free and renders them for Plus', () => {
    const paymentLink = {
      provider: 'upi' as const,
      label: 'UPI payment',
      instruction: 'Use this secure payment reference.',
      url: 'upi://pay?pa=owner@bank&am=1180',
      reference: 'INV-100',
    };
    const lockedDocument = buildInvoiceWebDocument({
      workspace,
      invoice: makeInvoice(),
      customer,
      paymentLink,
    });
    const plusDocument = buildInvoiceWebDocument({
      workspace,
      invoice: makeInvoice(),
      customer,
      subscription: getWebPaidSubscriptionStatus('plus_monthly'),
      paymentLink,
    });

    expect(lockedDocument.paymentLink).toBeNull();
    expect(lockedDocument.html).not.toContain('upi://pay');
    expect(plusDocument.paymentLink?.url).toBe(paymentLink.url);
    expect(plusDocument.html).toContain('UPI payment');
  });

  it('uses a green paid stamp only for paid invoices', () => {
    const paidDocument = buildInvoiceWebDocument({
      workspace,
      invoice: { ...makeInvoice(), paidAmount: 1180, paymentStatus: 'paid', status: 'paid' },
      customer,
    });
    const unpaidDocument = buildInvoiceWebDocument({
      workspace,
      invoice: makeInvoice(),
      customer,
    });

    expect(paidDocument.html).toContain('invoice-paid-stamp');
    expect(paidDocument.html).toContain('Paid</div>');
    expect(unpaidDocument.html).not.toContain('<div class="invoice-paid-stamp">Paid</div>');
    expect(unpaidDocument.html).toContain('<strong>Unpaid</strong>');
  });

  it('shows exact payment mode and unpaid reason on invoice documents', () => {
    const document = buildInvoiceWebDocument({
      workspace,
      invoice: { ...makeInvoice(), paymentStatus: 'unpaid', paymentStatusReason: 'E-payment pending' },
      customer,
      paymentModeLine: 'UPI - owner@bank',
      paymentStatusLine: 'Unpaid - E-payment pending',
    });

    expect(document.html).toContain('UPI - owner@bank');
    expect(document.html).toContain('Unpaid - E-payment pending');
    expect(document.html).not.toContain('<div class="invoice-paid-stamp">Paid</div>');
  });

  it('applies saved document filename, footer, and Pro color defaults', () => {
    const brandedWorkspace: OrbitWorkspaceSummary = {
      ...workspace,
      documentFilenameFormat: 'invoice_customer_date',
      documentFooterPreference: 'hide_when_pro',
      documentBrandHeaderColor: '#7653D9',
      documentBrandBackgroundColor: '#F4F1FF',
      documentBrandFontColor: '#21163F',
    };

    const document = buildInvoiceWebDocument({
      workspace: brandedWorkspace,
      invoice: makeInvoice(),
      customer,
      subscription: getWebProSubscriptionStatus(),
      templateKey: 'IN_GST_LETTERHEAD_PRO',
    });

    expect(document.fileName).toBe('INV-100_City_Mart_2026-05-01.pdf');
    expect(document.html).toContain('--pro-accent:#7653D9');
    expect(document.html).not.toContain('Orbit Ledger Pro</span><span>Prepared with custom invoice branding');
    expect(document.pdfFooterText).toBe('');
  });

  it('uses the Pro line color for template borders and dividers', () => {
    const document = buildInvoiceWebDocument({
      workspace,
      invoice: makeInvoice(),
      customer,
      subscription: getWebProSubscriptionStatus(),
      templateKey: 'IN_PAYMENT_FOCUSED_PRO',
      proTheme: {
        key: 'ledger_green',
        label: 'Custom',
        description: 'Custom line color.',
        accentColor: '#145C52',
        surfaceColor: '#E5F1ED',
        lineColor: '#8C1F1F',
        textColor: '#18231F',
      },
    });

    expect(document.html).toContain('--pro-line:#8C1F1F');
    expect(document.html).toContain('.style-advanced .document-header,.style-advanced .panel');
    expect(document.html).toContain('border:2px solid var(--pro-line)');
  });

  it('renders Pro statement styling when Pro is active', () => {
    const transactions: WorkspaceTransaction[] = [
      {
        id: 'credit-1',
        customerId: customer.id,
        customerName: customer.name,
        type: 'credit',
        amount: 500,
        note: 'Credit entry',
        paymentMode: null,
        paymentDetails: null,
        paymentClearanceStatus: null,
        paymentAttachments: [],
        effectiveDate: '2026-05-01',
        createdAt: '2026-05-01T08:00:00.000Z',
      },
      {
        id: 'payment-1',
        customerId: customer.id,
        customerName: customer.name,
        type: 'payment',
        amount: 250,
        note: 'Payment received',
        paymentMode: 'cash',
        paymentDetails: null,
        paymentClearanceStatus: 'cleared',
        paymentAttachments: [],
        effectiveDate: '2026-05-02',
        createdAt: '2026-05-02T08:00:00.000Z',
      },
    ];

    const document = buildStatementWebDocument({
      workspace,
      customer,
      transactions,
      subscription: getWebProSubscriptionStatus(),
      templateKey: 'IN_STATEMENT_LETTERHEAD_PRO',
    });
    expect(document.pdfStyle).toBe('advanced');
    expect(document.fileName).toContain('Statement_2026-05-01_to_2026-05-02.pdf');
    expect(document.html).toContain('Orbit Ledger Pro');
  });
});
