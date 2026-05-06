import type { WebSubscriptionPurchaseReview } from './subscription-entitlements';

export type WebPurchaseLaunchMonitoringSnapshot = {
  status: 'not_started' | 'active' | 'completed';
  title: string;
  message: string;
  elapsedHours: number;
  remainingHours: number;
  metrics: Array<{
    id: string;
    label: string;
    value: number;
    helper: string;
    tone: 'success' | 'warning' | 'premium';
  }>;
  checkpoints: string[];
};

export function buildWebPurchaseLaunchMonitoringSnapshot(input: {
  launchStartedAt: string | null;
  now?: Date;
  purchaseReview: WebSubscriptionPurchaseReview | null;
}): WebPurchaseLaunchMonitoringSnapshot {
  const checkpoints = [
    'Review failed checkout records twice daily.',
    'Review provider callbacks and entitlement activation.',
    'Review receipt recovery and billing email delivery.',
    'Review refund, cancellation, and support messages.',
  ];

  if (!input.launchStartedAt) {
    return {
      status: 'not_started',
      title: 'First 72 hours monitoring has not started',
      message: 'Start this monitor only after live checkout is opened to users.',
      elapsedHours: 0,
      remainingHours: 72,
      metrics: buildMetrics(input.purchaseReview),
      checkpoints,
    };
  }

  const startedAt = Date.parse(input.launchStartedAt);
  const now = input.now ?? new Date();
  const elapsedHours = Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((now.getTime() - startedAt) / 3_600_000))
    : 0;
  const remainingHours = Math.max(0, 72 - elapsedHours);
  const completed = remainingHours === 0;

  return {
    status: completed ? 'completed' : 'active',
    title: completed ? 'First 72 hours monitoring is complete' : 'First 72 hours monitoring is active',
    message: completed
      ? 'Review the launch notes and keep normal purchase monitoring active.'
      : `${remainingHours} hour${remainingHours === 1 ? '' : 's'} remain in the heightened monitoring window.`,
    elapsedHours,
    remainingHours,
    metrics: buildMetrics(input.purchaseReview),
    checkpoints,
  };
}

function buildMetrics(purchaseReview: WebSubscriptionPurchaseReview | null): WebPurchaseLaunchMonitoringSnapshot['metrics'] {
  const checkouts = purchaseReview?.checkouts ?? [];
  const events = purchaseReview?.events ?? [];
  const failed = checkouts.filter((checkout) => checkout.status === 'failed' || checkout.status === 'checkout_failed').length;
  const confirmed = events.filter((event) => event.status === 'confirmed' || event.status === 'succeeded').length;
  const emailFailures = checkouts.filter((checkout) => checkout.billingEmailDeliveryStatus === 'failed').length;

  return [
    {
      id: 'failedCheckout',
      label: 'Failed checkout',
      value: failed,
      helper: 'Needs support review.',
      tone: failed ? 'warning' : 'success',
    },
    {
      id: 'confirmedPurchase',
      label: 'Confirmed purchase',
      value: confirmed,
      helper: 'Trusted purchase confirmations.',
      tone: 'success',
    },
    {
      id: 'emailFailure',
      label: 'Email failure',
      value: emailFailures,
      helper: 'Receipt emails needing review.',
      tone: emailFailures ? 'warning' : 'success',
    },
  ];
}
