import { describe, expect, it } from 'vitest';

import { buildLivePaymentLinkStatus } from './live-collections-status';
import type { WorkspaceInvoice, WorkspacePaymentProviderEvent } from './workspace-data';

function invoice(overrides: Partial<WorkspaceInvoice> = {}): WorkspaceInvoice {
  return {
    id: 'invoice-1',
    customerId: 'customer-1',
    customerName: 'Sonali Traders',
    invoiceNumber: 'INV-1',
    issueDate: '2026-05-20',
    totalAmount: 1770,
    paidAmount: 0,
    status: 'created',
    documentState: 'created',
    paymentStatus: 'unpaid',
    versionNumber: 1,
    isArchived: false,
    ...overrides,
  };
}

function event(overrides: Partial<WorkspacePaymentProviderEvent> = {}): WorkspacePaymentProviderEvent {
  return {
    id: 'event-1',
    source: 'payment_page',
    status: 'pending',
    applyStatus: 'needs_review',
    applied: false,
    amount: 1770,
    currency: 'INR',
    reference: 'pay_1',
    providerPaymentId: 'pay_1',
    payerName: null,
    payerContact: null,
    invoiceId: 'invoice-1',
    customerId: 'customer-1',
    transactionId: null,
    allocationId: null,
    allocationAmount: 0,
    reversed: false,
    reversedAt: null,
    reversalId: null,
    reversalTransactionId: null,
    refundedAmount: 0,
    error: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: '2026-05-20T10:00:00.000Z',
    lastModified: '2026-05-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('live collections payment link status', () => {
  it('shows waiting state from saved payment link state without deciding payment success', () => {
    expect(buildLivePaymentLinkStatus({ invoice: invoice(), events: [], hasPaymentLink: true })).toMatchObject({
      state: 'waiting',
      title: 'Waiting for payment',
      tone: 'info',
    });
  });

  it('uses verified allocation math for paid invoices', () => {
    expect(
      buildLivePaymentLinkStatus({
        invoice: invoice({ paidAmount: 1770, paymentStatus: 'paid' }),
        events: [event({ status: 'captured', applied: true })],
        hasPaymentLink: true,
      })
    ).toMatchObject({
      state: 'invoice_paid',
      title: 'Invoice marked paid',
      tone: 'success',
    });
  });

  it('keeps captured-but-unapplied events in verifying state', () => {
    expect(
      buildLivePaymentLinkStatus({
        invoice: invoice(),
        events: [event({ status: 'captured', applied: false, applyStatus: 'needs_review' })],
        hasPaymentLink: true,
      })
    ).toMatchObject({
      state: 'received_verifying',
      title: 'Payment received, verifying',
    });
  });

  it('surfaces failed and review events without changing invoice state in the browser', () => {
    expect(
      buildLivePaymentLinkStatus({
        invoice: invoice(),
        events: [event({ status: 'failed', error: 'card failed' })],
        hasPaymentLink: true,
      })
    ).toMatchObject({
      state: 'failed',
      tone: 'danger',
    });

    expect(
      buildLivePaymentLinkStatus({
        invoice: invoice(),
        events: [event({ status: 'disputed' })],
        hasPaymentLink: true,
      })
    ).toMatchObject({
      state: 'needs_review',
      tone: 'warning',
    });
  });
});
