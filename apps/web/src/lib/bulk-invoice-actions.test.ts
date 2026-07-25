import { describe, expect, it } from 'vitest';

import { invoiceDetailToPaidInput, isEligibleForBulkPaid } from './bulk-invoice-actions';
import type { WorkspaceInvoiceDetail } from './workspace-data';

function makeDetail(overrides: Partial<WorkspaceInvoiceDetail> = {}): WorkspaceInvoiceDetail {
  const base = {
    id: 'inv-1',
    invoiceNumber: 'INV-1001',
    customerId: 'cust-1',
    customerName: 'Sonali Traders',
    documentState: 'created',
    paymentStatus: 'unpaid',
    issueDate: '2026-07-15',
    dueDate: '2026-07-22',
    subtotal: 1500,
    taxAmount: 270,
    totalAmount: 1770,
    notes: 'Thanks',
    items: [
      {
        id: 'item-1',
        invoiceId: 'inv-1',
        productId: 'prod-1',
        name: 'Printer Maintenance',
        description: 'Service',
        quantity: 1,
        price: 1500,
        taxRate: 18,
        total: 1770,
      },
    ],
    latestVersionId: null,
    latestSnapshotHash: null,
  } as WorkspaceInvoiceDetail;
  return { ...base, ...overrides };
}

describe('invoiceDetailToPaidInput', () => {
  it('flips only the payment status and carries everything else through', () => {
    const input = invoiceDetailToPaidInput(makeDetail());
    expect(input.paymentStatus).toBe('paid');
    expect(input.paymentStatusReason).toBeNull();
    // Unchanged fields preserved so the re-save is a no-op apart from status.
    expect(input.invoiceNumber).toBe('INV-1001');
    expect(input.customerId).toBe('cust-1');
    expect(input.issueDate).toBe('2026-07-15');
    expect(input.notes).toBe('Thanks');
  });

  it('preserves every line item with its priced fields', () => {
    const input = invoiceDetailToPaidInput(makeDetail());
    expect(input.items).toHaveLength(1);
    expect(input.items[0]).toMatchObject({
      id: 'item-1',
      name: 'Printer Maintenance',
      quantity: 1,
      price: 1500,
      taxRate: 18,
    });
    // The derived per-item total is intentionally not sent - the save pipeline
    // recomputes it - so a stale total can never be persisted.
    expect('total' in input.items[0]).toBe(false);
  });

  it('carries a null customer through as null rather than dropping the field', () => {
    const input = invoiceDetailToPaidInput(makeDetail({ customerId: null }));
    expect(input.customerId).toBeNull();
  });
});

describe('isEligibleForBulkPaid', () => {
  it('excludes already-paid invoices', () => {
    expect(isEligibleForBulkPaid('paid', 'created')).toBe(false);
  });

  it('excludes cancelled invoices even if unpaid', () => {
    expect(isEligibleForBulkPaid('unpaid', 'cancelled')).toBe(false);
  });

  it('allows unpaid, partially paid, and overdue non-cancelled invoices', () => {
    expect(isEligibleForBulkPaid('unpaid', 'created')).toBe(true);
    expect(isEligibleForBulkPaid('partially_paid', 'sent')).toBe(true);
    expect(isEligibleForBulkPaid('overdue', 'sent')).toBe(true);
  });
});
