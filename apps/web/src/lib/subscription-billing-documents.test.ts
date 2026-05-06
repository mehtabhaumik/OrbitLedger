import { describe, expect, it } from 'vitest';

import {
  buildBillingDocumentFileName,
  buildBillingDocumentHtml,
  type WebSubscriptionBillingDocument,
} from './subscription-billing-documents';

const baseDocument: WebSubscriptionBillingDocument = {
  id: 'checkout_test_123',
  planLabel: 'Pro Plus Monthly',
  status: 'confirmed',
  provider: 'Pending setup',
  transactionId: 'txn_test_123',
  providerReference: 'order_test_123',
  recordedAt: '2026-05-04T08:30:00.000Z',
  receiptNumber: 'OL-RCP-20260504-123',
  receiptStatus: 'ready',
  taxInvoiceNumber: 'OL-TAX-20260504-123',
  taxInvoiceStatus: 'ready',
  taxCountry: 'IN',
  taxLabel: 'GST',
  taxRegistrationLabel: 'GSTIN',
  taxRegistrationNumber: '24ABCDE1234F1Z5',
  taxDocumentLabel: 'GST tax invoice',
  receiptLabel: 'Receipt',
  taxTreatment: 'india_gst_provider_review',
  taxCalculationStatus: 'provider_review_required',
  taxComplianceReviewStatus: 'ready_for_review',
  taxComplianceMessage: 'GST tax invoice metadata is ready for review.',
  taxComplianceBasis: 'india_gst',
  taxRegistrationRequired: true,
  taxRegistrationPresent: true,
  taxInclusivePricing: false,
  amountDisplay: '₹199.00',
  amountMinor: 19900,
  subtotalMinor: 16864,
  taxMinor: 3036,
  totalMinor: 19900,
  currency: 'INR',
  buyerBusinessName: 'Rudraix PVT',
  buyerLegalName: 'Rudraix Private Limited',
  buyerEmail: 'billing@example.invalid',
  buyerCountry: 'IN',
  buyerState: 'GJ',
  sellerBrand: 'Orbit Ledger by Rudraix',
  issuedAt: '2026-05-04T08:30:00.000Z',
  createdAt: '2026-05-04T08:20:00.000Z',
  billingEmailStatus: null,
  billingEmailDeliveryStatus: null,
  billingEmailProviderStatus: null,
  billingEmailRecipient: null,
  billingEmailRequestedAt: null,
  billingEmailSentAt: null,
  billingEmailRequestId: null,
  billingEmailAdminQueueId: null,
  billingEmailAdminReviewStatus: null,
  billingEmailResendCount: null,
  billingEmailLastResendAt: null,
  billingEmailLastError: null,
  billingRecoveryStatus: null,
  billingRecoveredAt: null,
};

describe('subscription billing document output', () => {
  it('builds a clean receipt filename from the receipt number', () => {
    expect(buildBillingDocumentFileName(baseDocument)).toBe('OL_RCP_20260504_123_orbit_ledger_receipt.pdf');
  });

  it('renders receipt and tax invoice metadata in the viewer html', () => {
    const html = buildBillingDocumentHtml(baseDocument, {
      businessName: 'Rudraix PVT',
      countryCode: 'IN',
      createdAt: '2026-05-03T00:00:00.000Z',
      currency: 'INR',
      email: 'owner@example.invalid',
      address: 'Ahmedabad',
      ownerName: 'Bhaumik Mehta',
      phone: '+91 90000 00000',
      stateCode: 'GJ',
      logoUri: null,
      authorizedPersonName: 'Bhaumik Mehta',
      authorizedPersonTitle: 'Owner',
      signatureUri: null,
      paymentInstructions: {},
      updatedAt: '2026-05-03T00:00:00.000Z',
      serverRevision: 1,
      dataState: 'full_dataset',
      workspaceId: 'workspace_123',
    });

    expect(html).toContain('Orbit Ledger Receipt');
    expect(html).toContain('OL-RCP-20260504-123');
    expect(html).toContain('OL-TAX-20260504-123');
    expect(html).toContain('₹199.00');
    expect(html).toContain('GSTIN');
  });

  it('escapes customer-controlled billing text in the viewer html', () => {
    const html = buildBillingDocumentHtml(
      {
        ...baseDocument,
        buyerLegalName: '<script>alert("bad")</script>',
        buyerEmail: 'billing@example.invalid"><img src=x onerror=alert(1)>',
      },
      null
    );

    expect(html).not.toContain('<script>alert("bad")</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;script&gt;alert(&quot;bad&quot;)&lt;/script&gt;');
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });
});
