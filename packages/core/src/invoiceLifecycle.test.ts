import { describe, expect, it } from 'vitest';

import {
  deriveInvoicePaymentStatus,
  getInvoicePaymentDocumentStatusLine,
  legacyStatusForInvoiceLifecycle,
} from './invoiceLifecycle';

describe('invoice payment lifecycle', () => {
  it('marks invoices paid only when allocated money covers the total', () => {
    expect(deriveInvoicePaymentStatus({ totalAmount: 1000, paidAmount: 1000 })).toBe('paid');
    expect(deriveInvoicePaymentStatus({ totalAmount: 1000, paidAmount: 400 })).toBe('partially_paid');
    expect(deriveInvoicePaymentStatus({ totalAmount: 1000, paidAmount: 0 })).toBe('unpaid');
  });

  it('keeps cancelled document state separate from payment state', () => {
    expect(legacyStatusForInvoiceLifecycle('cancelled', 'paid')).toBe('cancelled');
    expect(legacyStatusForInvoiceLifecycle('created', 'paid')).toBe('paid');
  });

  it('marks unpaid invoices overdue after the due date', () => {
    expect(
      deriveInvoicePaymentStatus({
        dueDate: '2026-04-30',
        paidAmount: 0,
        today: '2026-05-01',
        totalAmount: 100,
      })
    ).toBe('overdue');
  });

  it('keeps post-dated or deposited instruments pending until cleared', () => {
    expect(
      deriveInvoicePaymentStatus({
        dueDate: '2026-04-30',
        paidAmount: 0,
        pendingAmount: 1000,
        today: '2026-05-01',
        totalAmount: 1000,
      })
    ).toBe('pending_clearance');
  });

  it('prevents contradictory paid and unpaid document status lines', () => {
    expect(
      getInvoicePaymentDocumentStatusLine({
        paymentStatus: 'paid',
        paymentStatusReason: 'Paid in full',
      })
    ).toBeNull();
    expect(
      getInvoicePaymentDocumentStatusLine({
        paymentStatus: 'paid',
        paymentStatusLine: 'Unpaid - E-payment pending',
      })
    ).toBeNull();
    expect(
      getInvoicePaymentDocumentStatusLine({
        paymentStatus: 'paid',
        paymentStatusLine: 'E-payment received',
      })
    ).toBe('E-payment received');
    expect(
      getInvoicePaymentDocumentStatusLine({
        paymentStatus: 'unpaid',
        paymentStatusReason: 'cheque pending',
      })
    ).toBe('Unpaid - cheque pending');
  });
});
