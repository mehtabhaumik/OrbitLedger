import {
  buildManualPaymentInstructionLines,
  getManualPaymentInstructionTemplate,
  normalizeManualPaymentInstructionDetails,
} from './manualPaymentInstructions';
import { describe, expect, it } from 'vitest';

describe('manual payment instructions', () => {
  it('builds India UPI and bank transfer lines', () => {
    const lines = buildManualPaymentInstructionLines(
      {
        upiId: 'Owner@OkAxis',
        bankAccountName: 'Rudraix Pvt Ltd',
        bankName: 'HDFC Bank',
        bankAccountNumber: '1234567890',
        bankIfsc: 'hdfc0001234',
        bankBranch: 'Ahmedabad',
        paymentNote: 'Mention invoice number.',
      },
      'IN'
    );

    expect(lines).toEqual([
      'UPI ID: owner@okaxis',
      'Account name: Rudraix Pvt Ltd',
      'Bank: HDFC Bank',
      'Account number: 1234567890',
      'IFSC: HDFC0001234',
      'Branch: Ahmedabad',
      'Mention invoice number.',
    ]);
  });

  it('uses country-specific template fields', () => {
    expect(getManualPaymentInstructionTemplate('IN').fields.some((field) => field.key === 'upiId')).toBe(true);
    expect(getManualPaymentInstructionTemplate('US').fields.some((field) => field.key === 'bankRoutingNumber')).toBe(true);
    expect(getManualPaymentInstructionTemplate('GB').fields.some((field) => field.key === 'bankSortCode')).toBe(true);
  });

  it('drops invalid URLs and invalid UPI IDs', () => {
    const details = normalizeManualPaymentInstructionDetails({
      upiId: 'bad-upi',
      paymentPageUrl: 'http://unsafe.example',
      bankIfsc: ' icic0001 ',
    });

    expect(details.upiId).toBeNull();
    expect(details.paymentPageUrl).toBeNull();
    expect(details.bankIfsc).toBe('ICIC0001');
  });
});
