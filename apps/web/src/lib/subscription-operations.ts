import type {
  WebSubscriptionCheckoutRecord,
  WebSubscriptionPurchaseEvent,
  WebSubscriptionPurchaseReview,
  WebSubscriptionRenewalChange,
} from './subscription-entitlements';
import type { WebCheckoutIntent } from './web-monetization';

export type WebPurchaseOperationsMetric = {
  id: string;
  label: string;
  value: number;
  helper: string;
  tone: 'default' | 'success' | 'warning' | 'premium';
};

export type WebPurchaseOperationsQueueItem = {
  id: string;
  title: string;
  status: string;
  detail: string;
  actionHint: string;
  actionLabel: string;
  actionType:
    | 'retry_checkout'
    | 'complete_provider_setup'
    | 'recover_receipt'
    | 'resend_receipt_email'
    | 'review_tax_details'
    | 'review_renewal_change';
  tone: 'default' | 'success' | 'warning' | 'premium';
};

export type WebPurchaseOperationsSnapshot = {
  metrics: WebPurchaseOperationsMetric[];
  queue: WebPurchaseOperationsQueueItem[];
  health: {
    title: string;
    message: string;
    tone: 'success' | 'warning';
  };
  providerSetup: {
    title: string;
    message: string;
    status: 'not_connected' | 'needs_review' | 'ready_for_test';
  };
};

export function buildWebPurchaseOperationsSnapshot(input: {
  purchaseReview: WebSubscriptionPurchaseReview | null;
  renewalChanges: WebSubscriptionRenewalChange[];
  checkoutIntent: WebCheckoutIntent | null;
}): WebPurchaseOperationsSnapshot {
  const checkouts = input.purchaseReview?.checkouts ?? [];
  const events = input.purchaseReview?.events ?? [];
  const failedCheckouts = checkouts.filter(isFailedCheckout);
  const providerPending = checkouts.filter(isProviderPendingCheckout);
  const receiptRecovery = checkouts.filter(needsReceiptRecovery);
  const emailReview = checkouts.filter(needsEmailReview);
  const taxReview = checkouts.filter(needsTaxReview);
  const renewalReview = input.renewalChanges.filter((change) =>
    change.status === 'queued' || change.reviewStatus === 'needs_review' || change.reviewStatus === 'ready_for_review'
  );
  const localCheckoutAttention = input.checkoutIntent?.status === 'failed' || input.checkoutIntent?.status === 'pending' ? 1 : 0;
  const confirmedEvents = events.filter(isConfirmedPurchaseEvent);

  const queue: WebPurchaseOperationsQueueItem[] = [
    ...failedCheckouts.map((checkout) => ({
      id: `failed:${checkout.id}`,
      title: `${planLabel(checkout.planId)} checkout failed`,
      status: 'Needs retry',
      detail: checkout.providerReference ? `Reference ${checkout.providerReference}` : 'Checkout failed before confirmation.',
      actionHint: 'Retry checkout or ask the customer to restart purchase.',
      actionLabel: 'Retry checkout',
      actionType: 'retry_checkout' as const,
      tone: 'warning' as const,
    })),
    ...providerPending.map((checkout) => ({
      id: `provider:${checkout.id}`,
      title: `${planLabel(checkout.planId)} provider setup pending`,
      status: 'Provider pending',
      detail: checkout.amountDisplay ? `${checkout.amountDisplay} checkout is waiting for live provider setup.` : 'Provider setup is pending.',
      actionHint: 'Complete Razorpay setup before opening live checkout.',
      actionLabel: 'Review Razorpay setup',
      actionType: 'complete_provider_setup' as const,
      tone: 'premium' as const,
    })),
    ...receiptRecovery.map((checkout) => ({
      id: `receipt:${checkout.id}`,
      title: `${planLabel(checkout.planId)} receipt needs recovery`,
      status: 'Recover receipt',
      detail: checkout.checkoutIntentId ? `Checkout ${checkout.checkoutIntentId}` : 'Confirmed purchase has incomplete billing document data.',
      actionHint: 'Use Recover on the billing document row.',
      actionLabel: 'Recover receipt',
      actionType: 'recover_receipt' as const,
      tone: 'warning' as const,
    })),
    ...emailReview.map((checkout) => ({
      id: `email:${checkout.id}`,
      title: `${planLabel(checkout.planId)} receipt email review`,
      status: emailStatusLabel(checkout.billingEmailDeliveryStatus ?? checkout.billingEmailAdminReviewStatus),
      detail: checkout.billingEmailLastError ?? checkout.billingEmailRecipient ?? 'Receipt email needs review.',
      actionHint: checkout.billingEmailDeliveryStatus === 'failed' ? 'Resend receipt after checking the email address.' : 'Review provider delivery status.',
      actionLabel: checkout.billingEmailDeliveryStatus === 'failed' ? 'Resend receipt' : 'Review email',
      actionType: 'resend_receipt_email' as const,
      tone: checkout.billingEmailDeliveryStatus === 'failed' ? 'warning' as const : 'premium' as const,
    })),
    ...taxReview.map((checkout) => ({
      id: `tax:${checkout.id}`,
      title: `${planLabel(checkout.planId)} tax review`,
      status: taxStatusLabel(checkout.taxComplianceReviewStatus),
      detail: checkout.taxComplianceMessage ?? checkout.taxRegistrationLabel ?? 'Tax details need review.',
      actionHint: checkout.taxComplianceReviewStatus === 'business_tax_id_missing' ? 'Add business tax details before final billing review.' : 'Complete country tax review.',
      actionLabel: 'Review tax details',
      actionType: 'review_tax_details' as const,
      tone: 'warning' as const,
    })),
    ...renewalReview.map((change) => ({
      id: `renewal:${change.id}`,
      title: `${change.currentPlanLabel} to ${change.targetPlanLabel}`,
      status: renewalStatusLabel(change.reviewStatus),
      detail: change.applyAfter ? `Requested for renewal after ${change.applyAfter}` : 'Renewal change is waiting for review.',
      actionHint: 'Review, process, cancel, or apply at renewal.',
      actionLabel: 'Review renewal',
      actionType: 'review_renewal_change' as const,
      tone: change.reviewStatus === 'ready_for_review' ? 'premium' as const : 'warning' as const,
    })),
  ];

  const attentionCount = queue.length + localCheckoutAttention;

  return {
    metrics: [
      {
        id: 'attention',
        label: 'Needs review',
        value: attentionCount,
        helper: 'Purchase items needing action.',
        tone: attentionCount ? 'warning' : 'success',
      },
      {
        id: 'failed',
        label: 'Failed checkout',
        value: failedCheckouts.length + (input.checkoutIntent?.status === 'failed' ? 1 : 0),
        helper: 'Retry or support follow-up.',
        tone: failedCheckouts.length || input.checkoutIntent?.status === 'failed' ? 'warning' : 'success',
      },
      {
        id: 'pendingProvider',
        label: 'Provider pending',
        value: providerPending.length,
        helper: 'Waiting for Razorpay setup.',
        tone: providerPending.length ? 'premium' : 'success',
      },
      {
        id: 'confirmed',
        label: 'Confirmed',
        value: confirmedEvents.length,
        helper: 'Provider-confirmed purchase events.',
        tone: 'success',
      },
    ],
    queue,
    health: attentionCount
      ? {
          title: 'Purchase operations need review',
          message: 'Review the queue before opening or expanding live checkout.',
          tone: 'warning',
        }
      : {
          title: 'Purchase operations are clear',
          message: 'No purchase items need admin attention right now.',
          tone: 'success',
        },
    providerSetup: providerPending.length
      ? {
          title: 'Razorpay setup is still pending',
          message: 'Live checkout is intentionally held until Razorpay credentials, webhooks, and price IDs are ready.',
          status: 'not_connected',
        }
      : taxReview.length || renewalReview.length
        ? {
            title: 'Provider setup is clear; review operations remain',
            message: 'Razorpay setup is not blocking this view, but admin review items still need attention.',
            status: 'needs_review',
          }
        : {
            title: 'Provider setup has no blocking records',
            message: 'No provider-pending purchase records are visible in this workspace.',
            status: 'ready_for_test',
          },
  };
}

function isFailedCheckout(checkout: WebSubscriptionCheckoutRecord) {
  return checkout.status === 'failed' || checkout.status === 'checkout_failed';
}

function isProviderPendingCheckout(checkout: WebSubscriptionCheckoutRecord) {
  return (
    checkout.status === 'provider_not_connected' ||
    checkout.status === 'pending_provider_connection' ||
    checkout.billingEmailDeliveryStatus === 'pending_provider_connection'
  );
}

function needsReceiptRecovery(checkout: WebSubscriptionCheckoutRecord) {
  return checkout.status === 'confirmed' && !checkout.receiptNumber;
}

function needsEmailReview(checkout: WebSubscriptionCheckoutRecord) {
  return (
    checkout.billingEmailDeliveryStatus === 'failed' ||
    checkout.billingEmailDeliveryStatus === 'pending_provider_connection' ||
    checkout.billingEmailAdminReviewStatus === 'needs_review'
  );
}

function needsTaxReview(checkout: WebSubscriptionCheckoutRecord) {
  return (
    checkout.taxComplianceReviewStatus === 'business_tax_id_missing' ||
    checkout.taxComplianceReviewStatus === 'country_tax_review_required' ||
    checkout.taxComplianceReviewStatus === 'ready_for_review'
  );
}

function isConfirmedPurchaseEvent(event: WebSubscriptionPurchaseEvent) {
  return event.status === 'confirmed' || event.status === 'succeeded';
}

function planLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function emailStatusLabel(value: string | null) {
  if (value === 'failed') {
    return 'Email failed';
  }
  if (value === 'pending_provider_connection') {
    return 'Delivery pending';
  }
  if (value === 'needs_review') {
    return 'Needs review';
  }
  return 'Email review';
}

function taxStatusLabel(value: string | null) {
  if (value === 'business_tax_id_missing') {
    return 'Tax ID missing';
  }
  if (value === 'country_tax_review_required') {
    return 'Tax review';
  }
  return 'Ready for review';
}

function renewalStatusLabel(value: WebSubscriptionRenewalChange['reviewStatus']) {
  if (value === 'ready_for_review') {
    return 'Ready for review';
  }
  if (value === 'processing') {
    return 'Processing';
  }
  if (value === 'completed') {
    return 'Completed';
  }
  if (value === 'cancelled') {
    return 'Cancelled';
  }
  if (value === 'rejected') {
    return 'Rejected';
  }
  return 'Needs review';
}
