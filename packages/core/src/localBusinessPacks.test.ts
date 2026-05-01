import { describe, expect, it } from 'vitest';

import {
  formatPhoneForLocalBusinessPack,
  getLocalBusinessPack,
  getLocalPhoneExample,
} from './localBusinessPacks';

describe('local business packs', () => {
  it('selects India wording without overclaiming compliance', () => {
    const pack = getLocalBusinessPack({ countryCode: 'IN', regionCode: 'mh' });

    expect(pack.marketName).toBe('India');
    expect(pack.regionCode).toBe('MH');
    expect(pack.locale).toBe('en-IN');
    expect(pack.labels.taxName).toBe('GST');
    expect(pack.labels.taxId).toBe('GSTIN');
    expect(pack.documents.invoiceTitle).toBe('Tax Invoice');
    expect(pack.documents.buyerLabel).toBe('Buyer Details');
    expect(pack.compliance.disclaimer).toContain('Starter GST labels and summaries only');
    expect(pack.compliance.disclaimer).not.toMatch(/ready|guarantee/i);
  });

  it('keeps US and UK packs safe and specific', () => {
    expect(getLocalBusinessPack({ countryCode: 'US' }).labels.taxName).toBe('Sales tax');
    expect(getLocalBusinessPack({ countryCode: 'UK' }).labels.taxName).toBe('VAT');
    expect(getLocalBusinessPack({ countryCode: 'GB' }).documents.invoiceDetailsLabel).toBe(
      'VAT Invoice Details'
    );
  });

  it('formats phone examples from the shared pack language', () => {
    expect(getLocalPhoneExample('IN')).toBe('+91 98765 43210');
    expect(formatPhoneForLocalBusinessPack('IN', '9876543210')).toBe('+91 98765 43210');
    expect(formatPhoneForLocalBusinessPack('US', '+1 (415) 555-0123')).toBe('+1 415 555 0123');
    expect(formatPhoneForLocalBusinessPack('IN', '123')).toBeNull();
  });

  it('falls back to generic language for unsupported countries', () => {
    const pack = getLocalBusinessPack({ countryCode: 'BR' });

    expect(pack.marketCode).toBe('GENERIC');
    expect(pack.labels.taxName).toBe('Tax');
    expect(pack.documents.invoiceTitle).toBe('Invoice');
  });
});
