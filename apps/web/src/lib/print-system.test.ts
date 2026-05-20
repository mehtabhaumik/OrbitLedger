import { describe, expect, it } from 'vitest';

import {
  buildOrbitPrintDocument,
  formatPrintCurrency,
  formatPrintDateTime,
  type PrintDocumentInput,
} from './print-system';

const workspace: PrintDocumentInput['workspace'] = {
  workspaceId: 'workspace_1',
  businessName: 'Rudraix Private Limited',
  legalName: 'Rudraix Private Limited',
  ownerName: 'Bhaumik Mehta',
  phone: '+91 82009 52311',
  email: 'billing@example.com',
  address: 'Block B, Bhayli',
  addressLine1: 'Registered Block B',
  addressLine2: 'Business Park',
  city: 'Vadodara',
  town: 'Bhayli',
  postalCode: '391410',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
  logoUri: null,
  authorizedPersonName: 'Bhaumik Mehta',
  authorizedPersonTitle: 'Owner',
  signatureUri: null,
  paymentInstructions: {},
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  serverRevision: 1,
  dataState: 'full_dataset',
};

describe('premium print system', () => {
  it('creates a shell with business identity, creator, timestamp, and footer', () => {
    const html = buildOrbitPrintDocument({
      title: 'Customer Profile',
      subtitle: 'Sonali Traders account summary.',
      workspace,
      preparedBy: {
        name: 'Bhaumik Mehta',
        email: 'owner@example.com',
      },
      generatedAt: new Date('2026-05-20T10:30:00+05:30'),
      sections: [
        {
          type: 'summary',
          title: 'Overview',
          metrics: [
            { label: 'Balance', value: '₹1,770.00', helper: 'Current outstanding amount.' },
            { label: 'Invoices', value: 2 },
          ],
        },
      ],
    });

    expect(html).toContain('Rudraix Private Limited');
    expect(html).toContain('Registered Block B, Business Park, Bhayli, Vadodara, GJ, 391410, IN');
    expect(html).toContain('Customer Profile');
    expect(html).toContain('Prepared by Bhaumik Mehta (owner@example.com)');
    expect(html).toContain('Created with Orbit Ledger');
    expect(html).toContain('Print copy');
    expect(html).toContain('box-shadow: 0 0 0 .35px var(--line), inset 0 0 0 .35px var(--line);');
    expect(html).not.toContain('.ol-print-page { width: 210mm; min-height: 297mm;');
    expect(html).toContain('html,\n    body { background: #fff !important; }');
  });

  it('protects rows and images from broken print output', () => {
    const html = buildOrbitPrintDocument({
      title: 'Payment Proof',
      workspace,
      sections: [
        {
          type: 'image',
          title: 'Cheque image',
          src: 'data:image/png;base64,abc123',
          caption: 'Scaled proof image.',
        },
        {
          type: 'table',
          title: 'Ledger',
          columns: [
            { key: 'date', label: 'Date' },
            { key: 'amount', label: 'Amount', align: 'right' },
          ],
          rows: [{ date: '2026-05-20', amount: '₹1,770.00' }],
        },
      ],
    });

    expect(html).toContain('max-height: 120mm');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('data:image/png;base64,abc123');
  });

  it('formats country-aware timestamps and currency', () => {
    expect(formatPrintDateTime('2026-05-20T10:30:00+05:30', 'IN')).toContain('2026');
    expect(formatPrintCurrency(1770, 'INR', 'IN')).toContain('1,770');
    expect(formatPrintCurrency(99.5, 'USD', 'US')).toContain('$');
  });
});
