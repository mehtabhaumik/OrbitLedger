import { describe, expect, it } from 'vitest';

import { buildWebPurchaseOperationsSnapshot } from './subscription-operations';
import type {
  WebSubscriptionCheckoutRecord,
  WebSubscriptionPurchaseReview,
  WebSubscriptionRenewalChange,
} from './subscription-entitlements';

const billingDefaults = {
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
} satisfies Omit<
  WebSubscriptionCheckoutRecord,
  'id' | 'planId' | 'status' | 'provider' | 'checkoutIntentId' | 'transactionId' | 'providerReference' | 'updatedAt'
>;

function checkout(input: Partial<WebSubscriptionCheckoutRecord> & { id: string; status: string }): WebSubscriptionCheckoutRecord {
  const { id, status, ...rest } = input;
  return {
    ...billingDefaults,
    id,
    planId: input.planId ?? 'pro_yearly',
    status,
    provider: input.provider ?? 'Razorpay',
    checkoutIntentId: input.checkoutIntentId ?? `checkout_${id}`,
    transactionId: input.transactionId ?? null,
    providerReference: input.providerReference ?? null,
    updatedAt: input.updatedAt ?? '2026-05-04T00:00:00.000Z',
    ...rest,
  };
}

const emptyReview: WebSubscriptionPurchaseReview = {
  auditItems: [],
  checkouts: [],
  events: [],
};

describe('web purchase operations dashboard model', () => {
  it('returns a clear state when no purchase operations need review', () => {
    const snapshot = buildWebPurchaseOperationsSnapshot({
      checkoutIntent: null,
      purchaseReview: {
        ...emptyReview,
        events: [
          {
            ...billingDefaults,
            id: 'event_1',
            planId: 'pro_yearly',
            status: 'confirmed',
            provider: 'Razorpay',
            checkoutIntentId: 'checkout_1',
            transactionId: 'txn_1',
            providerReference: 'order_1',
            receivedAt: '2026-05-04T00:00:00.000Z',
          },
        ],
      },
      renewalChanges: [],
    });

    expect(snapshot.health).toMatchObject({
      tone: 'success',
      title: 'Purchase operations are clear',
    });
    expect(snapshot.providerSetup).toMatchObject({
      status: 'ready_for_test',
    });
    expect(snapshot.queue).toEqual([]);
    expect(snapshot.metrics.find((metric) => metric.id === 'confirmed')).toMatchObject({
      value: 1,
    });
  });

  it('groups failed, provider-pending, receipt, email, tax, and renewal review items', () => {
    const renewal: WebSubscriptionRenewalChange = {
      id: 'renewal_1',
      workspaceId: 'workspace_1',
      requestedBy: 'user_1',
      currentPlanId: 'pro_yearly',
      targetPlanId: 'plus_yearly',
      currentPlanLabel: 'Pro Plus Yearly',
      targetPlanLabel: 'Plus Yearly',
      changeKind: 'downgrade',
      status: 'queued',
      reviewStatus: 'ready_for_review',
      serverSyncStatus: 'ready_for_admin_review',
      requestedAt: '2026-05-04T00:00:00.000Z',
      applyAfter: '2027-05-04T00:00:00.000Z',
      adminQueueId: 'admin_1',
      providerPortalStatus: 'pending_provider_connection',
      providerActionRequired: true,
      lastReviewNote: null,
    };

    const snapshot = buildWebPurchaseOperationsSnapshot({
      checkoutIntent: null,
      purchaseReview: {
        ...emptyReview,
        checkouts: [
          checkout({ id: 'failed', status: 'failed' }),
          checkout({ id: 'provider', status: 'provider_not_connected', amountDisplay: '₹1,999' }),
          checkout({ id: 'receipt', status: 'confirmed' }),
          checkout({
            id: 'email',
            status: 'confirmed',
            receiptNumber: 'OL-1',
            billingEmailDeliveryStatus: 'failed',
            billingEmailLastError: 'Mailbox rejected the message.',
          }),
          checkout({
            id: 'tax',
            status: 'confirmed',
            receiptNumber: 'OL-2',
            taxComplianceReviewStatus: 'business_tax_id_missing',
            taxRegistrationLabel: 'GSTIN / PAN',
          }),
        ],
      },
      renewalChanges: [renewal],
    });

    expect(snapshot.health.tone).toBe('warning');
    expect(snapshot.queue.map((item) => item.id)).toEqual([
      'failed:failed',
      'provider:provider',
      'receipt:receipt',
      'email:email',
      'tax:tax',
      'renewal:renewal_1',
    ]);
    expect(snapshot.queue.map((item) => item.actionType)).toEqual([
      'retry_checkout',
      'complete_provider_setup',
      'recover_receipt',
      'resend_receipt_email',
      'review_tax_details',
      'review_renewal_change',
    ]);
    expect(snapshot.providerSetup).toMatchObject({
      status: 'not_connected',
      title: 'Razorpay setup is still pending',
    });
    expect(snapshot.metrics.find((metric) => metric.id === 'attention')).toMatchObject({
      value: 6,
      tone: 'warning',
    });
  });
});
