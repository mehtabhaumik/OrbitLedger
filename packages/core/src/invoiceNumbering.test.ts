import { describe, expect, it } from 'vitest';

import {
  buildInvoiceNumberMigrationPlan,
  buildCompanyInvoiceCode,
  buildSmartInvoiceNumber,
  getInvoiceNumberCountryRules,
  normalizeInvoiceNumberKey,
  normalizeInvoicePrefix,
} from './invoiceNumbering';

describe('smart invoice numbering', () => {
  it('builds a compact India-ready number within the statutory length envelope', () => {
    const result = buildSmartInvoiceNumber({
      businessName: 'Rudraix Private Limited',
      countryCode: 'IN',
      issueDate: '2026-05-17',
      sequenceNumber: 1,
      workspaceId: 'workspace-alpha',
    });

    expect(result.invoiceNumber).toMatch(/^[A-Z0-9]+\/26\/0001$/);
    expect(result.invoiceNumber.length).toBeLessThanOrEqual(16);
    expect(result.fiscalYear).toBe('2026-2027');
    expect(result.formatStyle).toBe('smart_company_fy_sequence');
  });

  it('keeps same-sounding businesses distinct by including a workspace checksum', () => {
    const left = buildSmartInvoiceNumber({
      businessName: 'Sonali Traders',
      countryCode: 'IN',
      issueDate: '2026-05-17',
      sequenceNumber: 12,
      workspaceId: 'workspace-a',
    });
    const right = buildSmartInvoiceNumber({
      businessName: 'Sonali Traders',
      countryCode: 'IN',
      issueDate: '2026-05-17',
      sequenceNumber: 12,
      workspaceId: 'workspace-b',
    });

    expect(left.companyCode).not.toBe(right.companyCode);
    expect(left.invoiceNumber).not.toBe(right.invoiceNumber);
  });

  it('uses calendar years for countries without a financial-year rule', () => {
    const result = buildSmartInvoiceNumber({
      businessName: 'Northstar Supply Co.',
      countryCode: 'US',
      issueDate: '2026-01-02',
      sequenceNumber: 42,
      workspaceId: 'workspace-us',
    });

    expect(result.invoiceNumber).toMatch(/\/26\/0042$/);
    expect(result.fiscalYear).toBe('2026');
  });

  it('supports a user-controlled prefix without accepting unsafe characters', () => {
    expect(normalizeInvoicePrefix(' auto ')).toBeNull();
    expect(normalizeInvoicePrefix('rdx-gst/01')).toBe('RDXGST01');

    const result = buildSmartInvoiceNumber({
      businessName: 'Ignored Name',
      countryCode: 'IN',
      issueDate: '2026-04-01',
      sequenceNumber: 7,
      workspaceId: 'workspace-custom',
      settings: { customPrefix: 'rdx-gst/01', separator: '-' },
    });

    expect(result.invoiceNumber).toBe('RDXGST01-26-0007');
    expect(result.formatStyle).toBe('custom_prefix_year_sequence');
  });

  it('returns country defaults for known and unknown countries', () => {
    expect(getInvoiceNumberCountryRules('IN').maxLength).toBe(16);
    expect(getInvoiceNumberCountryRules('UK').countryCode).toBe('GB');
    expect(getInvoiceNumberCountryRules('XX').countryCode).toBe('XX');
  });

  it('creates a fallback company code for names without latin letters', () => {
    expect(buildCompanyInvoiceCode('***', 'workspace')).toMatch(/^INV[A-Z0-9]{2}$/);
  });

  it('normalizes invoice keys and finds legacy duplicate groups', () => {
    expect(normalizeInvoiceNumberKey(' st/26/0001 ')).toBe('ST/26/0001');

    const plan = buildInvoiceNumberMigrationPlan([
      { id: 'invoice-1', invoiceNumber: 'ST/26/0001', documentState: 'created' },
      { id: 'invoice-2', invoiceNumber: ' st/26/0001 ', documentState: 'revised' },
      { id: 'invoice-3', invoiceNumber: 'ST/26/0002', invoiceNumberKey: 'ST/26/0002', documentState: 'created' },
      { id: 'invoice-4', invoiceNumber: 'ST/26/0001', documentState: 'cancelled' },
    ]);

    expect(plan.totalInvoices).toBe(4);
    expect(plan.missingKeyInvoiceIds).toEqual(['invoice-1', 'invoice-2']);
    expect(plan.duplicateGroups).toEqual([
      {
        invoiceNumberKey: 'ST/26/0001',
        invoiceNumber: 'ST/26/0001',
        invoiceIds: ['invoice-1', 'invoice-2'],
      },
    ]);
  });
});
