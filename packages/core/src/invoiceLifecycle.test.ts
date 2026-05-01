import { describe, expect, it } from 'vitest';

import {
  deriveInvoicePaymentStatus,
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
});
