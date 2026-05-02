import { describe, expect, it } from 'vitest';
import { buildCustomerHealthScore } from '@orbit-ledger/core';

import {
  buildInvoiceWebDocument,
  buildStatementWebDocument,
  getWebDocumentTemplate,
  getWebDocumentTemplates,
} from './web-documents';
import { getDefaultWebSubscriptionStatus, getWebProSubscriptionStatus } from './web-monetization';
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

  it('renders invoice tax labels and PDF file names from the selected market template', () => {
    const invoice: WorkspaceInvoiceDetail = {
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
