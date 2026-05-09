import { describe, expect, it } from 'vitest';

import { buildDashboardAnalytics } from './dashboard-analytics';
import type {
  WorkspaceCustomer,
  WorkspaceInvoice,
  WorkspaceProduct,
  WorkspaceTransaction,
} from './workspace-data';

describe('dashboard analytics', () => {
  it('builds receivables, collection, payment, customer, and stock chart models', () => {
    const analytics = buildDashboardAnalytics({
      today: '2026-05-08',
      customers: [
        customer({ id: 'c1', name: 'Aarav Stores', balance: 5000, rank: 'needs_follow_up' }),
        customer({ id: 'c2', name: 'Sonali Traders', balance: 1500, rank: 'excellent' }),
        customer({ id: 'c3', name: 'Advance Customer', balance: -300, rank: 'reliable' }),
      ],
      invoices: [
        invoice({ id: 'i1', totalAmount: 5000, paidAmount: 0, paymentStatus: 'overdue', dueDate: '2026-04-01' }),
        invoice({ id: 'i2', totalAmount: 1770, paidAmount: 1770, paymentStatus: 'paid', dueDate: '2026-05-03' }),
        invoice({ id: 'i3', totalAmount: 1200, paidAmount: 200, paymentStatus: 'partially_paid', dueDate: '2026-05-06' }),
      ],
      products: [
        product({ id: 'p1', stockQuantity: 0 }),
        product({ id: 'p2', stockQuantity: 3 }),
        product({ id: 'p3', stockQuantity: 10 }),
      ],
      transactions: [
        transaction({ id: 't1', amount: 1770, type: 'payment', paymentMode: 'upi', effectiveDate: '2026-05-02' }),
        transaction({ id: 't2', amount: 1200, type: 'credit', effectiveDate: '2026-05-04' }),
        transaction({ id: 't3', amount: 500, type: 'payment', paymentMode: 'cash', paymentClearanceStatus: 'received', effectiveDate: '2026-05-07' }),
      ],
    });

    expect(analytics.receivablesTrend).toHaveLength(14);
    expect(analytics.collectionHealth.find((segment) => segment.id === 'overdue')?.value).toBe(1);
    expect(analytics.collectionHealth.find((segment) => segment.id === 'paid')?.value).toBe(1);
    expect(analytics.topCustomersOutstanding.map((point) => point.label)).toEqual(['Aarav Stores', 'Sonali Traders']);
    expect(analytics.paymentModeBreakdown.map((segment) => segment.label)).toContain('UPI');
    expect(analytics.invoiceAging.find((segment) => segment.id === '31-60')?.value).toBe(5000);
    expect(analytics.customerRiskMix.find((segment) => segment.id === 'excellent')?.value).toBe(1);
    expect(analytics.inventoryPressure.find((segment) => segment.id === 'out')?.value).toBe(1);
    expect(analytics.dailyActionScore.openActions).toBeGreaterThan(0);
  });
});

function customer(input: {
  id: string;
  name: string;
  balance: number;
  rank: WorkspaceCustomer['health']['rank'];
}): WorkspaceCustomer {
  return {
    id: input.id,
    name: input.name,
    legalName: null,
    customerType: null,
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
    balance: input.balance,
    health: {
      rank: input.rank,
      label: input.rank,
      score: 80,
      helper: '',
      tone: input.rank === 'excellent' ? 'success' : input.rank === 'needs_follow_up' ? 'warning' : 'primary',
    },
  };
}

function invoice(input: {
  id: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: WorkspaceInvoice['paymentStatus'];
  dueDate: string;
}): WorkspaceInvoice {
  return {
    id: input.id,
    customerId: 'c1',
    customerName: 'Aarav Stores',
    invoiceNumber: input.id.toUpperCase(),
    issueDate: input.dueDate,
    dueDate: input.dueDate,
    billingMonth: input.dueDate.slice(0, 7),
    totalAmount: input.totalAmount,
    paidAmount: input.paidAmount,
    status: input.paymentStatus,
    documentState: 'created',
    paymentStatus: input.paymentStatus,
    versionNumber: 1,
    isArchived: false,
  };
}

function product(input: { id: string; stockQuantity: number }): WorkspaceProduct {
  return {
    id: input.id,
    name: input.id,
    price: 100,
    stockQuantity: input.stockQuantity,
    unit: 'pcs',
    createdAt: '2026-05-01T00:00:00.000Z',
    lastModified: '2026-05-01T00:00:00.000Z',
    serverRevision: 1,
  };
}

function transaction(input: {
  id: string;
  amount: number;
  type: WorkspaceTransaction['type'];
  paymentMode?: WorkspaceTransaction['paymentMode'];
  paymentClearanceStatus?: WorkspaceTransaction['paymentClearanceStatus'];
  effectiveDate: string;
}): WorkspaceTransaction {
  return {
    id: input.id,
    customerId: 'c1',
    customerName: 'Aarav Stores',
    type: input.type,
    amount: input.amount,
    note: null,
    paymentMode: input.paymentMode ?? null,
    paymentDetails: null,
    paymentClearanceStatus: input.paymentClearanceStatus ?? null,
    paymentAttachments: [],
    effectiveDate: input.effectiveDate,
    createdAt: `${input.effectiveDate}T00:00:00.000Z`,
  };
}
