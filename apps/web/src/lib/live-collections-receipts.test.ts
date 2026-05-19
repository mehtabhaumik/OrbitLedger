import { describe, expect, it } from 'vitest';

import {
  buildLiveCollectionReceiptAutomation,
  shouldStopInvoiceFollowUps,
} from './live-collections-receipts';
import type { WorkspaceInvoiceDetail, WorkspacePaymentProviderEvent } from './workspace-data';

const workspace = {
  businessName: 'Rudraix Private Limited',
  email: 'billing@example.invalid',
  phone: '+91 90000 00000',
  currency: 'INR',
};

describe('live collection receipt automation', () => {
  it('creates receipt copy and stops follow-ups for a fully paid verified event', () => {
    const automation = buildLiveCollectionReceiptAutomation({
      workspace,
      customer: { name: 'Sonali Traders', email: 'sonali@example.invalid', whatsapp: '+91 91111 11111' },
      invoice: invoice({ paymentStatus: 'paid', paidAmount: 1770 }),
      events: [event({ applied: true, amount: 1770, allocationAmount: 1770, status: 'succeeded' })],
    });

    expect(automation.eligible).toBe(true);
    expect(automation.title).toBe('Receipt ready');
    expect(automation.sourceLabel).toBe('Verified online payment');
    expect(automation.receiptMessage).toContain('Sonali Traders');
    expect(automation.receiptMessage).toContain('₹1,770.00');
    expect(automation.whatsappMessage).toContain('Receipt recorded by Rudraix Private Limited.');
    expect(automation.followUpState).toBe('stop');
    expect(automation.followUpLabel).toBe('Follow-ups stopped');
    expect(shouldStopInvoiceFollowUps(automation)).toBe(true);
  });

  it('keeps follow-ups adjusted when a verified payment leaves balance due', () => {
    const automation = buildLiveCollectionReceiptAutomation({
      workspace,
      customer: { name: 'Sonali Traders', email: null, whatsapp: null },
      invoice: invoice({ paymentStatus: 'partially_paid', paidAmount: 500 }),
      events: [event({ applied: true, amount: 500, allocationAmount: 500, status: 'captured' })],
    });

    expect(automation.eligible).toBe(true);
    expect(automation.followUpState).toBe('adjust');
    expect(automation.followUpHelper).toContain('remaining balance');
    expect(shouldStopInvoiceFollowUps(automation)).toBe(false);
  });

  it('does not create receipt copy from failed or unapplied provider events', () => {
    const automation = buildLiveCollectionReceiptAutomation({
      workspace,
      customer: { name: 'Sonali Traders', email: null, whatsapp: null },
      invoice: invoice({ paymentStatus: 'unpaid', paidAmount: 0 }),
      events: [event({ applied: false, status: 'failed', error: 'Payment failed' })],
    });

    expect(automation.eligible).toBe(false);
    expect(automation.sourceLabel).toBe('Waiting for verified payment');
    expect(automation.followUpState).toBe('continue');
    expect(automation.receiptMessage).toContain('after a verified payment');
  });

  it('can create a receipt from saved payment allocation when no live event exists', () => {
    const automation = buildLiveCollectionReceiptAutomation({
      workspace,
      customer: { name: 'Aarav Sample Stores', email: null, whatsapp: null },
      invoice: invoice({ paymentStatus: 'paid', paidAmount: 1770 }),
      events: [],
    });

    expect(automation.eligible).toBe(true);
    expect(automation.sourceLabel).toBe('Saved payment allocation');
    expect(automation.followUpState).toBe('stop');
  });
});

function invoice(overrides: Partial<WorkspaceInvoiceDetail> = {}): WorkspaceInvoiceDetail {
  return {
    id: 'invoice-1',
    customerId: 'customer-1',
    customerName: 'Sonali Traders',
    invoiceNumber: 'RPL-2026-0001',
    issueDate: '2026-05-20',
    dueDate: '2026-05-27',
    billingMonth: '2026-05',
    totalAmount: 1770,
    paidAmount: 0,
    status: 'created',
    documentState: 'created',
    paymentStatus: 'unpaid',
    paymentStatusReason: null,
    useForMonthlyAutoEmail: false,
    recurringRuleId: null,
    autoEmailPreparedAt: null,
    autoEmailScheduledFor: null,
    hasAutoEmailHistory: false,
    latestAutoEmailStatus: null,
    latestAutoEmailSentAt: null,
    latestAutoEmailVersionId: null,
    versionNumber: 1,
    serverRevision: 1,
    isArchived: false,
    versions: [],
    subtotal: 1500,
    taxAmount: 270,
    notes: null,
    items: [],
    latestVersionId: null,
    latestSnapshotHash: null,
    ...overrides,
  };
}

function event(overrides: Partial<WorkspacePaymentProviderEvent> = {}): WorkspacePaymentProviderEvent {
  return {
    id: 'event-1',
    source: 'payment_page',
    status: 'succeeded',
    applyStatus: 'backend_applied',
    applied: true,
    amount: 1770,
    currency: 'INR',
    reference: 'pay_123',
    providerPaymentId: 'pay_123',
    payerName: 'Sonali Traders',
    payerContact: null,
    invoiceId: 'invoice-1',
    customerId: 'customer-1',
    transactionId: 'transaction-1',
    allocationId: 'allocation-1',
    allocationAmount: 1770,
    reversed: false,
    reversedAt: null,
    reversalId: null,
    reversalTransactionId: null,
    refundedAmount: 0,
    error: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: '2026-05-20T10:00:00.000Z',
    lastModified: '2026-05-20T10:01:00.000Z',
    ...overrides,
  };
}
