import { describe, expect, it } from 'vitest';

import {
  SMART_DOCUMENT_PACK_GUARDRAILS,
  SMART_DOCUMENT_PACK_SURFACES,
  buildSmartDocumentPack,
} from './smartDocumentPack';

describe('smart document pack blueprint', () => {
  it('recommends statements for customers with open balances on the free plan', () => {
    const pack = buildSmartDocumentPack({
      businessName: 'Rudraix PVT',
      currentTier: 'free',
      signals: [
        {
          id: 'customer-1',
          kind: 'customer_has_balance',
          customerName: 'Sonali Traders',
          amountDue: 4100,
          invoiceCount: 3,
        },
      ],
    });

    expect(pack.title).toBe('Rudraix PVT document pack');
    expect(pack.recommendedPack).toMatchObject({
      kind: 'statement',
      available: true,
      requiredTier: 'free',
      actionTarget: 'send_statement',
    });
    expect(pack.summary).toContain('ready');
  });

  it('keeps overdue and audit packs protected behind higher tiers', () => {
    const pack = buildSmartDocumentPack({
      currentTier: 'plus',
      signals: [
        {
          id: 'overdue-1',
          kind: 'invoice_overdue',
          customerName: 'Aarav Stores',
          overdueInvoiceCount: 2,
          daysOverdue: 45,
        },
        {
          id: 'audit-1',
          kind: 'audit_review',
          needsAuditTrail: true,
        },
      ],
    });

    expect(pack.recommendedPack).toMatchObject({
      kind: 'audit_packet',
      priority: 'critical',
      available: false,
      requiredTier: 'office',
    });
    expect(pack.items.find((item) => item.kind === 'overdue_notice')).toMatchObject({
      available: false,
      requiredTier: 'pro_plus',
    });
  });

  it('unlocks pro and office document packs when the plan allows them', () => {
    const pack = buildSmartDocumentPack({
      currentTier: 'office',
      signals: [
        {
          id: 'tax-1',
          kind: 'tax_period_review',
          countryCode: 'IN',
          hasTaxData: true,
        },
        {
          id: 'audit-1',
          kind: 'audit_review',
          needsAuditTrail: true,
        },
      ],
    });

    expect(pack.items.every((item) => item.available)).toBe(true);
    expect(pack.items.map((item) => item.kind)).toEqual(['audit_packet', 'tax_summary']);
  });

  it('defines every launch document surface with required data and guardrails', () => {
    expect(SMART_DOCUMENT_PACK_SURFACES.map((surface) => surface.kind)).toEqual([
      'invoice',
      'statement',
      'payment_notice',
      'overdue_notice',
      'customer_profile',
      'tax_summary',
      'audit_packet',
    ]);
    expect(SMART_DOCUMENT_PACK_SURFACES.every((surface) => surface.requiredData.length > 0)).toBe(true);
    expect(SMART_DOCUMENT_PACK_GUARDRAILS).toContain(
      'Every generated document must use frozen source data so later edits do not change old exports.'
    );
  });
});
