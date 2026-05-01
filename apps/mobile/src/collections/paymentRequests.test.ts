import { describe, expect, it } from 'vitest';

import {
  buildPaymentRequestMessage,
  formatPaymentDetailsLine,
  normalizeUpiId,
} from './paymentRequests';

describe('payment request sharing', () => {
  it('normalizes valid UPI ids and rejects unsafe values', () => {
    expect(normalizeUpiId(' Owner.Store@OKICICI ')).toBe('owner.store@okicici');
    expect(normalizeUpiId('not a upi')).toBeNull();
  });

  it('formats India payment details with UPI', () => {
    expect(
      formatPaymentDetailsLine(
        { upiId: 'owner@okaxis', paymentNote: 'Use invoice number in note.' },
        'IN'
      )
    ).toBe('Payment details: UPI ID: owner@okaxis · Use invoice number in note.');
  });

  it('builds truthful invoice payment copy', () => {
    const message = buildPaymentRequestMessage({
      kind: 'invoice',
      businessName: 'Orbit Test Store',
      customerName: 'Asha Traders',
      amount: 1250,
      currency: 'INR',
      countryCode: 'IN',
      invoiceNumber: 'INV-001',
      paymentDetails: { upiId: 'owner@upi' },
    });

    expect(message).toContain('invoice INV-001');
    expect(message).toContain('UPI ID: owner@upi');
    expect(message).toContain('I will mark it received once I confirm it.');
    expect(message).not.toContain('payment received');
  });
});
