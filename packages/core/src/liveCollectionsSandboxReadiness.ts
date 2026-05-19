import { getLiveCollectionsQaBlockers } from './liveCollectionsQa';

export type LiveCollectionsSandboxReadinessStatus =
  | 'blocked'
  | 'ready_for_signed_smoke'
  | 'ready_for_real_test_payment'
  | 'ready_for_live_pilot';

export type LiveCollectionsSandboxReadinessInput = {
  checkoutUrl?: string | null;
  webhookUrl?: string | null;
  publicAppUrl?: string | null;
  hostedPaymentPageUrl?: string | null;
  hasRazorpayKeyId?: boolean;
  hasRazorpayKeySecret?: boolean;
  hasRazorpayWebhookSecret?: boolean;
  checkoutSmokePassed?: boolean;
  signedCaptureSmokePassed?: boolean;
  signedWebhookBoundarySmokePassed?: boolean;
  duplicateWebhookSmokePassed?: boolean;
  refundSmokePassed?: boolean;
  manualRazorpayTestPaymentPassed?: boolean;
  failureMatrixBlockers?: string[];
};

export type LiveCollectionsSandboxReadinessStep = {
  id: string;
  label: string;
  ready: boolean;
  requiredFor: LiveCollectionsSandboxReadinessStatus;
  evidence: string;
};

export type LiveCollectionsSandboxReadiness = {
  status: LiveCollectionsSandboxReadinessStatus;
  title: string;
  message: string;
  readyForSandboxPayment: boolean;
  readyForLivePilot: boolean;
  blockers: string[];
  steps: LiveCollectionsSandboxReadinessStep[];
};

export function buildLiveCollectionsSandboxReadiness(
  input: LiveCollectionsSandboxReadinessInput
): LiveCollectionsSandboxReadiness {
  const matrixBlockers = input.failureMatrixBlockers ?? getLiveCollectionsQaBlockers();
  const steps: LiveCollectionsSandboxReadinessStep[] = [
    {
      id: 'failure-matrix',
      label: 'Failure matrix has no blockers',
      ready: matrixBlockers.length === 0,
      requiredFor: 'ready_for_signed_smoke',
      evidence: 'packages/core/src/liveCollectionsQa.test.ts',
    },
    {
      id: 'checkout-url',
      label: 'Checkout Function URL is HTTPS',
      ready: isHttpsUrl(input.checkoutUrl),
      requiredFor: 'ready_for_signed_smoke',
      evidence: input.checkoutUrl || 'missing',
    },
    {
      id: 'webhook-url',
      label: 'Webhook Function URL is HTTPS',
      ready: isHttpsUrl(input.webhookUrl),
      requiredFor: 'ready_for_signed_smoke',
      evidence: input.webhookUrl || 'missing',
    },
    {
      id: 'public-app-url',
      label: 'Public app URL is HTTPS',
      ready: isHttpsUrl(input.publicAppUrl),
      requiredFor: 'ready_for_signed_smoke',
      evidence: input.publicAppUrl || 'missing',
    },
    {
      id: 'hosted-payment-page',
      label: 'Hosted payment page URL is HTTPS',
      ready: isHttpsUrl(input.hostedPaymentPageUrl),
      requiredFor: 'ready_for_signed_smoke',
      evidence: input.hostedPaymentPageUrl || 'missing',
    },
    {
      id: 'razorpay-key-id',
      label: 'Razorpay key id stored in server secret',
      ready: Boolean(input.hasRazorpayKeyId),
      requiredFor: 'ready_for_signed_smoke',
      evidence: 'RAZORPAY_KEY_ID',
    },
    {
      id: 'razorpay-key-secret',
      label: 'Razorpay key secret stored in server secret',
      ready: Boolean(input.hasRazorpayKeySecret),
      requiredFor: 'ready_for_signed_smoke',
      evidence: 'RAZORPAY_KEY_SECRET',
    },
    {
      id: 'razorpay-webhook-secret',
      label: 'Razorpay webhook secret stored in server secret',
      ready: Boolean(input.hasRazorpayWebhookSecret),
      requiredFor: 'ready_for_signed_smoke',
      evidence: 'RAZORPAY_WEBHOOK_SECRET',
    },
    {
      id: 'signed-webhook-boundary-smoke',
      label: 'Signed webhook boundary smoke passed',
      ready: Boolean(input.signedWebhookBoundarySmokePassed),
      requiredFor: 'ready_for_real_test_payment',
      evidence: 'RAZORPAY_WEBHOOK_SECRET=... npm run smoke:razorpay-live-collections-webhook',
    },
    {
      id: 'checkout-smoke',
      label: 'Checkout smoke passed',
      ready: Boolean(input.checkoutSmokePassed),
      requiredFor: 'ready_for_real_test_payment',
      evidence: 'npm run smoke:razorpay-checkout:connected',
    },
    {
      id: 'signed-capture-smoke',
      label: 'Signed capture webhook smoke passed',
      ready: Boolean(input.signedCaptureSmokePassed),
      requiredFor: 'ready_for_real_test_payment',
      evidence: 'RAZORPAY_WEBHOOK_SECRET=... npm run smoke:razorpay-capture',
    },
    {
      id: 'duplicate-webhook-smoke',
      label: 'Duplicate webhook smoke passed',
      ready: Boolean(input.duplicateWebhookSmokePassed),
      requiredFor: 'ready_for_live_pilot',
      evidence: 'Replay captured webhook and verify no duplicate allocation.',
    },
    {
      id: 'refund-smoke',
      label: 'Refund smoke passed',
      ready: Boolean(input.refundSmokePassed),
      requiredFor: 'ready_for_live_pilot',
      evidence: 'Create test refund and verify reversal records.',
    },
    {
      id: 'manual-razorpay-test-payment',
      label: 'Manual Razorpay test payment passed',
      ready: Boolean(input.manualRazorpayTestPaymentPassed),
      requiredFor: 'ready_for_live_pilot',
      evidence: 'Pay a real Razorpay test link and verify Orbit Ledger state.',
    },
  ];
  const signedSmokeBlockers = blockersForStatus(steps, 'ready_for_signed_smoke').concat(matrixBlockers);
  const realPaymentBlockers = blockersForStatus(steps, 'ready_for_real_test_payment');
  const livePilotBlockers = blockersForStatus(steps, 'ready_for_live_pilot');

  if (signedSmokeBlockers.length > 0) {
    return {
      status: 'blocked',
      title: 'Razorpay sandbox is blocked',
      message: 'Complete server secrets, HTTPS endpoints, and the failure matrix before sending signed sandbox traffic.',
      readyForSandboxPayment: false,
      readyForLivePilot: false,
      blockers: unique(signedSmokeBlockers),
      steps,
    };
  }

  if (realPaymentBlockers.length > 0) {
    return {
      status: 'ready_for_signed_smoke',
      title: 'Ready for signed webhook smoke',
      message: 'Run checkout and signed capture smoke before a real Razorpay test payment.',
      readyForSandboxPayment: false,
      readyForLivePilot: false,
      blockers: unique(realPaymentBlockers),
      steps,
    };
  }

  if (livePilotBlockers.length > 0) {
    return {
      status: 'ready_for_real_test_payment',
      title: 'Ready for real Razorpay test payment',
      message: 'Run a real Razorpay test payment, duplicate retry, and refund before live pilot.',
      readyForSandboxPayment: true,
      readyForLivePilot: false,
      blockers: unique(livePilotBlockers),
      steps,
    };
  }

  return {
    status: 'ready_for_live_pilot',
    title: 'Ready for controlled live pilot',
    message: 'All sandbox readiness checks are complete. Keep live rollout limited and monitored.',
    readyForSandboxPayment: true,
    readyForLivePilot: true,
    blockers: [],
    steps,
  };
}

function blockersForStatus(
  steps: LiveCollectionsSandboxReadinessStep[],
  status: LiveCollectionsSandboxReadinessStatus
): string[] {
  return steps
    .filter((step) => step.requiredFor === status && !step.ready)
    .map((step) => step.label);
}

function isHttpsUrl(value?: string | null): boolean {
  if (!value) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
