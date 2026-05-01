import { normalizePaymentProviderMode, type PaymentProviderMode } from './paymentProviders';

export type PaymentProviderReadinessInput = {
  mode?: string | null;
  paymentPageUrl?: string | null;
  webhookUrl?: string | null;
};

export type PaymentProviderReadiness = {
  mode: PaymentProviderMode;
  label: string;
  canShowOnlineCheckout: boolean;
  launchMessage: string;
  blockers: string[];
  checks: Array<{ label: string; ready: boolean }>;
};

export function getPaymentProviderReadiness(input: PaymentProviderReadinessInput): PaymentProviderReadiness {
  const mode = normalizePaymentProviderMode(input.mode);
  const hasPaymentPage = isHttpsUrl(input.paymentPageUrl);
  const hasWebhook = isHttpsUrl(input.webhookUrl);

  if (mode === 'razorpay_connected') {
    const blockers = [
      hasPaymentPage ? null : 'Payment page URL is missing or unsafe.',
      hasWebhook ? null : 'Provider webhook URL is missing or unsafe.',
    ].filter(Boolean) as string[];
    return {
      mode,
      label: blockers.length ? 'Connected setup needs review' : 'Connected checkout ready',
      canShowOnlineCheckout: blockers.length === 0,
      launchMessage: blockers.length
        ? 'Online checkout is configured but needs review before public use.'
        : 'Online checkout can be shown to customers.',
      blockers,
      checks: [
        { label: 'Payment page', ready: hasPaymentPage },
        { label: 'Provider webhook', ready: hasWebhook },
        { label: 'Provider mode', ready: true },
      ],
    };
  }

  if (mode === 'razorpay_test_ready') {
    return {
      mode,
      label: 'Provider test setup only',
      canShowOnlineCheckout: false,
      launchMessage: 'Manual collection remains active. Do not show online checkout until real provider verification passes.',
      blockers: ['Real provider account and live verification are not connected.'],
      checks: [
        { label: 'Payment page', ready: hasPaymentPage },
        { label: 'Provider webhook', ready: hasWebhook },
        { label: 'Provider mode', ready: false },
      ],
    };
  }

  return {
    mode,
    label: 'Manual collection ready',
    canShowOnlineCheckout: false,
    launchMessage: 'Manual UPI, bank transfer, cash, cheque, and draft workflows are active. Online checkout is intentionally hidden.',
    blockers: ['No real payment provider is connected yet.'],
    checks: [
      { label: 'Payment page', ready: hasPaymentPage },
      { label: 'Manual payment flow', ready: true },
      { label: 'Online checkout hidden', ready: true },
    ],
  };
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
