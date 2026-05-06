import { describe, expect, it } from 'vitest';

import {
  doesPaymentAwaitClearance,
  doesPaymentClearInvoice,
  getPaymentClearanceDocumentStatusLine,
  getPaymentClearanceStatusesForMode,
  getPaymentDocumentModeLine,
  normalizePaymentMode,
  normalizePaymentClearanceStatus,
  normalizePaymentModeDetails,
  summarizePaymentMode,
  validatePaymentModeDetails,
} from './paymentModes';

describe('payment modes', () => {
  it('normalizes unknown modes to cash', () => {
    expect(normalizePaymentMode('not-real')).toBe('cash');
  });

  it('requires country-friendly cheque details', () => {
    expect(
      validatePaymentModeDetails('cheque', {
        referenceNumber: 'CHK-10',
        bankName: 'ABC Bank',
        branchName: 'Main',
        instrumentDate: '2026-05-01',
      })
    ).toBeNull();
    expect(validatePaymentModeDetails('cheque', normalizePaymentModeDetails({}))).toBe(
      'Cheque needs a reference number.'
    );
  });

  it('summarizes card and provider payments for ledgers', () => {
    expect(summarizePaymentMode('card', { cardLastFour: '4242' })).toBe('Card - Card 4242');
    expect(summarizePaymentMode('wallet', { provider: 'Paytm', referenceNumber: 'TXN1' })).toBe(
      'Wallet / provider - Paytm - Ref TXN1'
    );
  });

  it('keeps future cheque instruments pending by default', () => {
    expect(
      normalizePaymentClearanceStatus(null, 'cheque', { instrumentDate: '2026-06-01' }, '2026-05-01')
    ).toBe('post_dated');
    expect(normalizePaymentClearanceStatus(null, 'upi', {}, '2026-05-01')).toBe('pending');
  });

  it('limits clearance choices by payment mode', () => {
    expect(getPaymentClearanceStatusesForMode('cash')).toEqual(['pending', 'received']);
    expect(getPaymentClearanceStatusesForMode('cheque')).toEqual([
      'pending',
      'received',
      'post_dated',
      'deposited',
      'cleared',
      'bounced',
      'cancelled',
    ]);
    expect(getPaymentClearanceStatusesForMode('upi')).toEqual([
      'pending',
      'initiated',
      'cleared',
      'errored',
      'cancelled',
    ]);
    expect(getPaymentClearanceStatusesForMode('demand_draft')).toEqual([
      'pending',
      'received',
      'deposited',
      'cleared',
      'errored',
      'cancelled',
    ]);
  });

  it('coerces invalid mode/status combinations to a safe default', () => {
    expect(normalizePaymentClearanceStatus('post_dated', 'cash')).toBe('received');
    expect(normalizePaymentClearanceStatus('deposited', 'upi')).toBe('pending');
    expect(normalizePaymentClearanceStatus('bounced', 'upi')).toBe('pending');
    expect(normalizePaymentClearanceStatus('errored', 'upi')).toBe('errored');
  });

  it('treats cash received as settled and other received payments as pending', () => {
    expect(doesPaymentClearInvoice('received', 'cash')).toBe(true);
    expect(doesPaymentAwaitClearance('received', 'cash')).toBe(false);
    expect(doesPaymentClearInvoice('received', 'upi')).toBe(false);
    expect(doesPaymentAwaitClearance('received', 'upi')).toBe(true);
    expect(doesPaymentAwaitClearance('pending', 'cash')).toBe(true);
  });

  it('builds clear invoice payment wording for unpaid and electronic payment states', () => {
    expect(getPaymentClearanceDocumentStatusLine('pending', 'cash')).toBe('Unpaid - pending');
    expect(getPaymentClearanceDocumentStatusLine('post_dated', 'cheque')).toBe(
      'Unpaid - post-dated cheque received'
    );
    expect(getPaymentClearanceDocumentStatusLine('errored', 'demand_draft')).toBe('Unpaid - DD errored');
    expect(getPaymentClearanceDocumentStatusLine('initiated', 'upi')).toBe('Unpaid - E-payment initiated');
    expect(getPaymentClearanceDocumentStatusLine('cleared', 'upi')).toBe('E-payment received');
    expect(getPaymentDocumentModeLine('upi', { upiId: 'owner@bank' })).toBe('UPI - owner@bank');
    expect(getPaymentDocumentModeLine('card')).toBe('Credit/Debit Card');
    expect(getPaymentDocumentModeLine('wallet')).toBe('E-Wallet');
  });
});
