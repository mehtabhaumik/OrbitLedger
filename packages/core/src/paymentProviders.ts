export type PaymentProviderMode = 'manual' | 'razorpay_test_ready' | 'razorpay_connected';

export type PaymentProviderPlan = {
  mode: PaymentProviderMode;
  collectionLabel: string;
  statusLabel: string;
  statusTone: 'manual' | 'ready' | 'connected';
  canCreateOnlineCheckout: boolean;
  canCopyGatewayDraft: boolean;
  paymentPageCopy: string;
  adminCopy: string;
};

export function normalizePaymentProviderMode(value?: string | null): PaymentProviderMode {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'razorpay_connected') {
    return 'razorpay_connected';
  }
  if (normalized === 'razorpay_test_ready') {
    return 'razorpay_test_ready';
  }
  return 'manual';
}

export function getPaymentProviderPlan(value?: string | null): PaymentProviderPlan {
  const mode = normalizePaymentProviderMode(value);
  if (mode === 'razorpay_connected') {
    return {
      mode,
      collectionLabel: 'Online checkout',
      statusLabel: 'Connected',
      statusTone: 'connected',
      canCreateOnlineCheckout: true,
      canCopyGatewayDraft: true,
      paymentPageCopy: 'Create a secure checkout link or send manual payment details.',
      adminCopy: 'Online checkout is connected. Keep reviewing successful, failed, pending, and refunded payments.',
    };
  }

  if (mode === 'razorpay_test_ready') {
    return {
      mode,
      collectionLabel: 'Test checkout',
      statusLabel: 'Test setup',
      statusTone: 'ready',
      canCreateOnlineCheckout: false,
      canCopyGatewayDraft: true,
      paymentPageCopy: 'Manual collection is active while provider test setup is being verified.',
      adminCopy: 'Provider test setup is prepared. Manual collection remains active until connected checkout passes.',
    };
  }

  return {
    mode,
    collectionLabel: 'Manual collection',
    statusLabel: 'Manual mode',
    statusTone: 'manual',
    canCreateOnlineCheckout: false,
    canCopyGatewayDraft: false,
    paymentPageCopy: 'Use UPI, payment instructions, and recorded payments. Online checkout can be connected later.',
    adminCopy: 'Manual payment collection is active. Record payments directly and add UPI or payment page details to invoices.',
  };
}
