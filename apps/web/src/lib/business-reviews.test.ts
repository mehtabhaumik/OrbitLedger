import { describe, expect, it } from 'vitest';

import {
  buildWebBusinessHealthReview,
  buildWebDailyClosingReview,
  buildWebMonthlyReview,
} from './business-reviews';
import type {
  WorkspaceCustomer,
  WorkspaceInvoice,
  WorkspacePaymentPromise,
  WorkspaceProduct,
  WorkspaceTransaction,
} from './workspace-data';

describe('web business review helpers', () => {
  it('builds a daily closing review from payments, credits, promises, and stock', () => {
    const review = buildWebDailyClosingReview({
      date: '2026-05-02',
      transactions: [
        transaction({ type: 'payment', amount: 1000 }),
        transaction({ type: 'credit', amount: 1500 }),
      ],
      products: [product({ stockQuantity: 2 })],
      promises: [promise({ promisedDate: '2026-05-02' })],
    });

    expect(review.metrics.map((metric) => metric.value)).toEqual([1000, 1500, 1, 1]);
    expect(review.actions[0].title).toBe('Review promised payments');
  });

  it('lowers health score when receivables, invoices, stock, and promises need attention', () => {
    const review = buildWebBusinessHealthReview({
      today: '2026-05-02',
      customers: [customer()],
      invoices: [invoice()],
      products: [product({ stockQuantity: 0 })],
      promises: [promise({ promisedDate: '2026-05-01' })],
    });

    expect(review.score).toBeLessThan(100);
    expect(review.actions.map((action) => action.title)).toContain('Call priority customers');
    expect(review.actions.find((action) => action.title === 'Call priority customers')?.message).toBe(
      '1 customer needs follow-up.'
    );
  });

  it('summarizes the selected month', () => {
    const review = buildWebMonthlyReview({
      month: '2026-05',
      transactions: [
        transaction({ type: 'payment', amount: 2000 }),
        transaction({ type: 'credit', amount: 1000 }),
      ],
      invoices: [invoice({ totalAmount: 1770 })],
      customers: [customer()],
    });

    expect(review.metrics.find((metric) => metric.label === 'Invoiced')?.value).toBe(1770);
    expect(review.actions[0].title).toBe('Collections look balanced');
    expect(review.actions[1].message).toBe('1 invoice is included in this month’s review.');
  });
});

function transaction(overrides: Partial<WorkspaceTransaction> = {}): WorkspaceTransaction {
  return {
    id: 'txn1',
    customerId: 'cus1',
    customerName: 'Asha Traders',
    type: 'payment',
    amount: 1000,
    note: null,
    paymentMode: 'cash',
    paymentDetails: null,
    paymentClearanceStatus: 'cleared',
    paymentAttachments: [],
    effectiveDate: '2026-05-02',
    createdAt: '2026-05-02T10:00:00.000Z',
    ...overrides,
  };
}

function product(overrides: Partial<WorkspaceProduct> = {}): WorkspaceProduct {
  return {
    id: 'prd1',
    name: 'Ink',
    price: 100,
    stockQuantity: 10,
    unit: 'pcs',
    createdAt: '2026-05-01T00:00:00.000Z',
    lastModified: '2026-05-01T00:00:00.000Z',
    serverRevision: 1,
    ...overrides,
  };
}

function promise(overrides: Partial<WorkspacePaymentPromise> = {}): WorkspacePaymentPromise {
  return {
    id: 'prm1',
    customerId: 'cus1',
    promisedAmount: 1000,
    promisedDate: '2026-05-05',
    note: null,
    status: 'open',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function invoice(overrides: Partial<WorkspaceInvoice> = {}): WorkspaceInvoice {
  return {
    id: 'inv1',
    customerId: 'cus1',
    customerName: 'Asha Traders',
    invoiceNumber: 'WEB-1',
    issueDate: '2026-05-01',
    totalAmount: 1000,
    paidAmount: 0,
    status: 'created',
    documentState: 'created',
    paymentStatus: 'unpaid',
    versionNumber: 1,
    isArchived: false,
    ...overrides,
  };
}

function customer(overrides: Partial<WorkspaceCustomer> = {}): WorkspaceCustomer {
  return {
    id: 'cus1',
    name: 'Asha Traders',
    legalName: null,
    customerType: 'business',
    contactPerson: null,
    phone: null,
    whatsapp: null,
    email: null,
    address: null,
    billingAddress: null,
    shippingAddress: null,
    city: null,
    stateCode: null,
    countryCode: 'IN',
    postalCode: null,
    gstin: null,
    pan: null,
    taxNumber: null,
    registrationNumber: null,
    placeOfSupply: null,
    defaultTaxTreatment: null,
    notes: null,
    openingBalance: 0,
    creditLimit: null,
    paymentTerms: null,
    preferredPaymentMode: null,
    preferredInvoiceTemplate: null,
    preferredLanguage: null,
    tags: [],
    isArchived: false,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    balance: 5000,
    health: {
      rank: 'needs_follow_up',
      label: 'Needs follow-up',
      helper: 'Needs payment review.',
      score: 55,
      tone: 'warning',
    },
    ...overrides,
  };
}
