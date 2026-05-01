import { describe, expect, it } from 'vitest';

import {
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
    expect(normalizePaymentClearanceStatus(null, 'upi', {}, '2026-05-01')).toBe('cleared');
  });
});
