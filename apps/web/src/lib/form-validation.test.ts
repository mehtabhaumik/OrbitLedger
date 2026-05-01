import { describe, expect, it } from 'vitest';

import {
  normalizePhoneForCountry,
  parseAmount,
  validateEmail,
  validateName,
  validatePhone,
  validatePositiveAmount,
} from './form-validation';

describe('web form validation', () => {
  it('normalizes supported phone formats', () => {
    expect(normalizePhoneForCountry('IN', '9876543210')).toBe('+91 98765 43210');
    expect(normalizePhoneForCountry('US', '+1 (415) 555-0123')).toBe('+1 415 555 0123');
    expect(normalizePhoneForCountry('UK', '+44 7400 123456')).toBe('+44 7400 123456');
  });

  it('returns plain field errors for invalid input', () => {
    expect(validateName('A', 'Customer name')).toBe('Customer name must use letters only.');
    expect(validateEmail('owner@', true)).toBe('Enter a valid email address.');
    expect(validatePhone('123', 'IN')).toBe('Use a valid phone number (+91 98765 43210).');
    expect(validatePositiveAmount('0', 'Amount')).toBe('Amount must be greater than 0.');
  });

  it('parses formatted money input safely', () => {
    expect(parseAmount('₹ 1,234.50')).toBe(1234.5);
    expect(parseAmount('not money')).toBeNull();
  });
});
