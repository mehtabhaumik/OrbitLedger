import { describe, expect, it } from 'vitest';

import { reconcileProviderPayment } from './paymentReconciliation';

const invoices = [
  {
    id: 'inv_1',
    invoiceNumber: 'WEB-641090',
    customerId: 'cust_1',
    customerName: 'Sonali Traders',
    totalAmount: 1770,
    paidAmount: 0,
    documentState: 'created',
    paymentStatus: 'unpaid',
  },
  {
    id: 'inv_2',
    invoiceNumber: 'WEB-555111',
    customerId: 'cust_2',
    customerName: 'Apex Retail',
    totalAmount: 900,
    paidAmount: 900,
    documentState: 'created',
    paymentStatus: 'paid',
  },
];

describe('reconcileProviderPayment', () => {
  it('matches payment links by invoice reference and prepares selected invoice allocation', () => {
    const decision = reconcileProviderPayment({
      source: 'upi',
      reference: 'INV-WEB-641090',
      amount: 1770,
      currency: 'INR',
      payerContact: 'buyer@upi',
      invoices,
    });

    expect(decision.status).toBe('matched');
    expect(decision.confidence).toBe('high');
    expect(decision.invoice?.id).toBe('inv_1');
    expect(decision.allocationStrategy).toBe('selected_invoice');
    expect(decision.allocationAmount).toBe(1770);
    expect(decision.paymentMode).toBe('upi');
    expect(decision.paymentDetails.referenceNumber).toBe('INV-WEB-641090');
  });

  it('keeps partial payments matched but clearly marked for partial allocation', () => {
    const decision = reconcileProviderPayment({
      source: 'bank_transfer',
      reference: 'WEB641090',
      amount: 1000,
      invoices,
    });

    expect(decision.status).toBe('partial_match');
    expect(decision.invoice?.id).toBe('inv_1');
    expect(decision.allocationAmount).toBe(1000);
    expect(decision.message).toContain('partially paid');
  });

  it('caps overpayments to invoice due and leaves the remainder for ledger handling', () => {
    const decision = reconcileProviderPayment({
      source: 'payment_page',
      reference: 'INV-WEB-641090',
      amount: 2000,
      invoices,
    });

    expect(decision.status).toBe('overpaid_match');
    expect(decision.allocationAmount).toBe(1770);
    expect(decision.note).toContain('Extra amount');
  });

  it('flags references that point to invoices already paid', () => {
    const decision = reconcileProviderPayment({
      source: 'upi',
      reference: 'INV-WEB-555111',
      amount: 900,
      invoices,
    });

    expect(decision.status).toBe('duplicate');
    expect(decision.allocationStrategy).toBe('ledger_only');
  });

  it('does not allocate missing or unknown references', () => {
    expect(
      reconcileProviderPayment({
        source: 'upi',
        reference: '',
        amount: 1770,
        invoices,
      }).status
    ).toBe('missing_reference');

    expect(
      reconcileProviderPayment({
        source: 'upi',
        reference: 'UNKNOWN',
        amount: 1770,
        invoices,
      }).allocationStrategy
    ).toBe('ledger_only');
  });
});
