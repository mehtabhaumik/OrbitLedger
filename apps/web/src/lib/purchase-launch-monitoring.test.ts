import { describe, expect, it } from 'vitest';

import { buildWebPurchaseLaunchMonitoringSnapshot } from './purchase-launch-monitoring';

describe('purchase launch monitoring', () => {
  it('stays not started until live checkout is opened', () => {
    const snapshot = buildWebPurchaseLaunchMonitoringSnapshot({
      launchStartedAt: null,
      purchaseReview: null,
    });

    expect(snapshot).toMatchObject({
      status: 'not_started',
      elapsedHours: 0,
      remainingHours: 72,
    });
  });

  it('tracks elapsed and remaining hours inside the launch window', () => {
    const snapshot = buildWebPurchaseLaunchMonitoringSnapshot({
      launchStartedAt: '2026-05-04T00:00:00.000Z',
      now: new Date('2026-05-05T06:00:00.000Z'),
      purchaseReview: {
        auditItems: [],
        checkouts: [
          {
            id: 'checkout_1',
            planId: 'pro_yearly',
            status: 'failed',
            provider: 'Razorpay',
            checkoutIntentId: 'checkout_1',
            transactionId: null,
            providerReference: null,
            updatedAt: '2026-05-04T00:00:00.000Z',
            receiptNumber: null,
            receiptStatus: null,
            taxInvoiceNumber: null,
            taxInvoiceStatus: null,
            taxCountry: null,
            taxLabel: null,
            taxRegistrationLabel: null,
            taxRegistrationNumber: null,
            taxDocumentLabel: null,
            receiptLabel: null,
            taxTreatment: null,
            taxCalculationStatus: null,
            taxComplianceReviewStatus: null,
            taxComplianceMessage: null,
            taxComplianceBasis: null,
            taxRegistrationRequired: null,
            taxRegistrationPresent: null,
            taxInclusivePricing: null,
            amountDisplay: null,
            amountMinor: null,
            subtotalMinor: null,
            taxMinor: null,
            totalMinor: null,
            currency: null,
            buyerBusinessName: null,
            buyerLegalName: null,
            buyerEmail: null,
            buyerCountry: null,
            buyerState: null,
            sellerBrand: null,
            issuedAt: null,
            createdAt: null,
            billingEmailStatus: null,
            billingEmailDeliveryStatus: 'failed',
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
          },
        ],
        events: [],
      },
    });

    expect(snapshot).toMatchObject({
      status: 'active',
      elapsedHours: 30,
      remainingHours: 42,
    });
    expect(snapshot.metrics.find((metric) => metric.id === 'failedCheckout')).toMatchObject({
      value: 1,
      tone: 'warning',
    });
    expect(snapshot.metrics.find((metric) => metric.id === 'emailFailure')).toMatchObject({
      value: 1,
    });
  });
});
