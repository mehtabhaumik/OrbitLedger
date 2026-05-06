import { describe, expect, it } from 'vitest';

import {
  LOCAL_BUSINESS_INTELLIGENCE_GUARDRAILS,
  LOCAL_BUSINESS_INTELLIGENCE_SURFACES,
  buildLocalBusinessIntelligence,
} from './localBusinessIntelligence';

describe('local business intelligence blueprint', () => {
  it('prioritizes India tax and payment setup when local details are missing', () => {
    const intelligence = buildLocalBusinessIntelligence({
      businessName: 'Rudraix PVT',
      signal: {
        countryCode: 'IN',
        stateCode: 'GJ',
        city: 'Ahmedabad',
        hasTaxProfile: false,
        hasLocalPaymentDetails: false,
        hasInvoiceTemplate: true,
        localCurrency: 'INR',
      },
    });

    expect(intelligence.title).toBe('Rudraix PVT local intelligence');
    expect(intelligence.topInsight).toMatchObject({
      id: 'tax_labels',
      actionTarget: 'open_tax_setup',
      localityLabel: 'Ahmedabad, GJ, IN',
    });
    expect(intelligence.items.map((item) => item.id)).toContain('payment_wording');
  });

  it('raises collection timing when overdue customers exist', () => {
    const intelligence = buildLocalBusinessIntelligence({
      signal: {
        countryCode: 'IN',
        hasTaxProfile: true,
        hasLocalPaymentDetails: true,
        hasInvoiceTemplate: true,
        overdueCustomerCount: 2,
        unpaidInvoiceCount: 5,
        localCurrency: 'INR',
      },
    });

    expect(intelligence.topInsight).toMatchObject({
      id: 'collection_timing',
      priority: 'critical',
      tone: 'danger',
      actionTarget: 'open_collection_coach',
    });
    expect(intelligence.summary).toContain('reviewed first');
  });

  it('adds seasonal and compliance review insights without claiming filing', () => {
    const intelligence = buildLocalBusinessIntelligence({
      signal: {
        countryCode: 'IN',
        month: 3,
        hasTaxProfile: true,
        hasLocalPaymentDetails: true,
        hasInvoiceTemplate: true,
        taxInvoiceCount: 8,
        localCurrency: 'INR',
      },
    });

    expect(intelligence.items.map((item) => item.id)).toEqual(['seasonal_nudge', 'compliance_review']);
    expect(LOCAL_BUSINESS_INTELLIGENCE_GUARDRAILS).toContain(
      'Country packs can suggest labels, wording, and review reminders, but they must not claim official filing.'
    );
  });

  it('defines all local intelligence surfaces with required data', () => {
    expect(LOCAL_BUSINESS_INTELLIGENCE_SURFACES.map((surface) => surface.area)).toEqual([
      'tax_labels',
      'payment_wording',
      'document_pack',
      'collection_timing',
      'seasonal_nudge',
      'regional_formatting',
      'compliance_review',
    ]);
    expect(LOCAL_BUSINESS_INTELLIGENCE_SURFACES.every((surface) => surface.requiredData.length > 0)).toBe(true);
  });
});
