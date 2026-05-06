export type RazorpayReadinessStatus = 'missing' | 'ready' | 'not_checked';

export type RazorpayReadinessInput = {
  keyIdReady?: boolean;
  keySecretReady?: boolean;
  webhookSecretReady?: boolean;
  liveModeReady?: boolean;
  webhookUrlReady?: boolean;
  callbackDomainReady?: boolean;
  businessVerified?: boolean;
  settlementReady?: boolean;
};

export type RazorpayReadinessCheck = {
  id: keyof Required<RazorpayReadinessInput>;
  label: string;
  helper: string;
  status: RazorpayReadinessStatus;
  requiredBeforeLive: boolean;
};

export type RazorpayProviderReadiness = {
  status: 'not_connected' | 'partially_ready' | 'ready_for_controlled_test';
  title: string;
  message: string;
  checks: RazorpayReadinessCheck[];
  missingRequiredCount: number;
};

const readinessCopy: Record<keyof Required<RazorpayReadinessInput>, { label: string; helper: string }> = {
  keyIdReady: {
    label: 'Live key ID',
    helper: 'Razorpay live key ID is saved as a secure server secret.',
  },
  keySecretReady: {
    label: 'Live key secret',
    helper: 'Razorpay live key secret is saved only on the server.',
  },
  webhookSecretReady: {
    label: 'Webhook secret',
    helper: 'Webhook signature verification secret is saved.',
  },
  liveModeReady: {
    label: 'Live mode access',
    helper: 'Razorpay account can create live payment links or checkout sessions.',
  },
  webhookUrlReady: {
    label: 'Webhook URL',
    helper: 'Production webhook URL is added in Razorpay dashboard.',
  },
  callbackDomainReady: {
    label: 'Callback domain',
    helper: 'Production Orbit Ledger domain is approved for checkout return flow.',
  },
  businessVerified: {
    label: 'Business verification',
    helper: 'Razorpay account KYC/business verification is complete.',
  },
  settlementReady: {
    label: 'Settlement account',
    helper: 'Settlement bank account and payout details are approved.',
  },
};

const requiredChecks: Array<keyof Required<RazorpayReadinessInput>> = [
  'keyIdReady',
  'keySecretReady',
  'webhookSecretReady',
  'liveModeReady',
  'webhookUrlReady',
  'callbackDomainReady',
  'businessVerified',
  'settlementReady',
];

export function buildRazorpayProviderReadiness(input: RazorpayReadinessInput = {}): RazorpayProviderReadiness {
  const checks = requiredChecks.map((id) => ({
    id,
    label: readinessCopy[id].label,
    helper: readinessCopy[id].helper,
    requiredBeforeLive: true,
    status: input[id] === true ? 'ready' as const : input[id] === false ? 'missing' as const : 'not_checked' as const,
  }));
  const missingRequiredCount = checks.filter((check) => check.status !== 'ready').length;

  if (missingRequiredCount === 0) {
    return {
      status: 'ready_for_controlled_test',
      title: 'Razorpay is ready for controlled test',
      message: 'All required setup items are marked ready. Run a small controlled payment before public launch.',
      checks,
      missingRequiredCount,
    };
  }

  const checkedCount = checks.filter((check) => check.status !== 'not_checked').length;
  return {
    status: checkedCount ? 'partially_ready' : 'not_connected',
    title: checkedCount ? 'Razorpay setup is partially ready' : 'Razorpay is not connected yet',
    message: checkedCount
      ? `${missingRequiredCount} required setup item${missingRequiredCount === 1 ? '' : 's'} still need attention.`
      : 'Keep checkout in provider-pending mode until live keys, webhook, callback, and account checks are ready.',
    checks,
    missingRequiredCount,
  };
}
