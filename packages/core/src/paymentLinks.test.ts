import { describe, expect, it } from 'vitest';

import {
  appendPaymentLinkToMessage,
  buildInvoicePaymentLink,
  normalizePaymentPageUrl,
  normalizeUpiId,
} from './paymentLinks';

describe('payment links', () => {
  it('builds an India UPI payment link for INR invoices', () => {
    const link = buildInvoicePaymentLink({
      amount: 1770,
      businessName: 'Orbit Ledger',
      countryCode: 'IN',
      currency: 'INR',
      invoiceNumber: 'WEB-100',
      details: { upiId: 'owner@upi' },
    });

    expect(link?.provider).toBe('upi');
    expect(link?.url).toContain('upi://pay');
    expect(link?.url).toContain('pa=owner%40upi');
    expect(link?.reference).toBe('INV-WEB-100');
  });

  it('rejects unsafe payment page URLs', () => {
    expect(normalizePaymentPageUrl('http://example.com/pay')).toBeNull();
    expect(normalizePaymentPageUrl('https://example.com/pay')).toBe('https://example.com/pay');
  });

  it('can prefer the hosted payment page over direct UPI', () => {
    const link = buildInvoicePaymentLink({
      amount: 1770,
      businessName: 'Rudraix PVT',
      countryCode: 'IN',
      currency: 'INR',
      customerName: 'Sonali Traders',
      invoiceNumber: 'WEB-641090',
      details: {
        upiId: 'owner@upi',
        hostedPaymentPageUrl: 'https://pay.orbitledger.app/pay/',
        preferHostedPaymentPage: true,
      },
    });

    expect(link?.provider).toBe('payment_page');
    expect(link?.url).toContain('/pay/');
    expect(link?.url).toContain('upi=owner%40upi');
    expect(link?.url).toContain('business=Rudraix+PVT');
  });

  it('validates UPI IDs and appends links to messages', () => {
    expect(normalizeUpiId('Owner@UPI')).toBe('owner@upi');
    expect(normalizeUpiId('bad')).toBeNull();
    expect(
      appendPaymentLinkToMessage('Please pay.', {
        instruction: 'Use payment reference INV-1.',
        label: 'Pay now',
        provider: 'payment_page',
        reference: 'INV-1',
        url: 'https://pay.example.com?invoice=1',
      })
    ).toContain('Pay now: https://pay.example.com?invoice=1');
  });
});
