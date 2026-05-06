import { describe, expect, it } from 'vitest';

import {
  buildPaymentInstructionAuditChanges,
  summarizePaymentInstructionChanges,
  validateManualPaymentSettings,
} from './payment-settings-hardening';

describe('payment settings hardening', () => {
  it('detects and masks sensitive payment detail changes', () => {
    const changes = buildPaymentInstructionAuditChanges(
      {
        bankAccountNumber: '1234567890',
        bankIfsc: 'HDFC0001234',
        paymentNote: 'Old note',
      },
      {
        bankAccountNumber: '9876543210',
        bankIfsc: 'ICIC0009999',
        paymentNote: 'New note',
      }
    );

    expect(changes.map((change) => change.label)).toEqual(['Payment note', 'Account number', 'IFSC']);
    expect(changes.find((change) => change.field === 'bankAccountNumber')?.maskedPreviousValue).toBe('******7890');
    expect(changes.find((change) => change.field === 'bankIfsc')?.maskedNextValue).toBe('*******9999');
    expect(summarizePaymentInstructionChanges(changes)).toBe('Payment note, Account number, IFSC');
  });

  it('validates country-specific manual payment settings', () => {
    expect(
      validateManualPaymentSettings(
        {
          paymentPageUrl: 'http://example.com/pay',
          upiId: 'bad-upi',
          bankIfsc: 'bad',
        },
        'IN'
      )
    ).toEqual([
      'Payment page must use a secure https link.',
      'Enter a valid UPI ID.',
      'Enter a valid IFSC code.',
    ]);

    expect(
      validateManualPaymentSettings(
        {
          paymentPageUrl: 'https://example.com/pay',
          upiId: 'orbit@okaxis',
          bankIfsc: 'HDFC0001234',
          bankAccountNumber: '1234567890',
        },
        'IN'
      )
    ).toEqual([]);
  });
});
