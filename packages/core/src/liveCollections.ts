import type {
  AllocationDerivedInvoicePaymentStatus,
  LivePaymentAuditAction,
  LivePaymentAuditEntry,
  LivePaymentEvent,
  LivePaymentEventSource,
  LivePaymentNotification,
  OnlinePaymentProviderServerConfig,
  PaymentCapabilitySettings,
  ProviderBackedPaymentStatus,
} from '@orbit-ledger/contracts';

export type LiveCollectionsGuardrailName =
  | 'backend_verified_payment_status'
  | 'provider_secret_isolation'
  | 'idempotent_provider_events'
  | 'manual_online_payment_separation'
  | 'allocation_derived_invoice_status'
  | 'automated_payment_audit_trail'
  | 'orbit_state_realtime_notifications';

export const LIVE_COLLECTIONS_GUARDRAILS: Record<LiveCollectionsGuardrailName, string> = {
  backend_verified_payment_status:
    'Payment status changes only after a verified provider webhook or trusted backend verification.',
  provider_secret_isolation:
    'Razorpay secrets are referenced by server-side secret names only and never sent to clients.',
  idempotent_provider_events:
    'Provider events use deterministic idempotency keys so duplicate webhooks cannot double-record payments.',
  manual_online_payment_separation:
    'Manual UPI and bank instructions remain separate from provider-backed online payment links.',
  allocation_derived_invoice_status:
    'Invoice paid/unpaid state is derived from captured allocations and refunds, not labels.',
  automated_payment_audit_trail:
    'Every automated payment update must create a system audit entry.',
  orbit_state_realtime_notifications:
    'Realtime UI listens to Orbit Ledger notification state, not Razorpay directly.',
};

export type LivePaymentAllocationInput = {
  invoiceTotal: number;
  capturedAmount?: number | null;
  refundedAmount?: number | null;
  needsReviewAmount?: number | null;
  dueDate?: string | null;
  today?: string | null;
};

export type LivePaymentTrustedEventDecision = {
  canChangePaymentState: boolean;
  auditAction: LivePaymentAuditAction;
  reason: string;
};

export type LivePaymentIdempotencyInput = {
  provider: string;
  providerEventId?: string | null;
  providerPaymentId?: string | null;
  providerPaymentLinkId?: string | null;
};

export type LivePaymentPublicProviderConfig = {
  provider: OnlinePaymentProviderServerConfig['provider'];
  mode: OnlinePaymentProviderServerConfig['mode'];
  workspaceId: string;
  configured: boolean;
  secretReferences: 'server_only';
  updatedAt: string;
};

export type LivePaymentAuditDraftInput = {
  id: string;
  event: LivePaymentEvent;
  action: LivePaymentAuditAction;
  message: string;
  createdAt?: string | null;
};

export type LivePaymentNotificationDraftInput = {
  id: string;
  event: LivePaymentEvent;
  title: string;
  message: string;
  createdAt?: string | null;
};

const trustedProviderStatuses = new Set<ProviderBackedPaymentStatus>([
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
  'disputed',
  'needs_review',
]);

export function deriveLiveInvoicePaymentStatus(
  input: LivePaymentAllocationInput
): AllocationDerivedInvoicePaymentStatus {
  const total = money(input.invoiceTotal);
  const captured = money(input.capturedAmount);
  const refunded = money(input.refundedAmount);
  const needsReview = money(input.needsReviewAmount);
  const effectivePaid = Math.max(captured - refunded, 0);

  if (needsReview > 0) {
    return 'needs_review';
  }

  if (total <= 0) {
    return 'unpaid';
  }

  if (captured > 0 && effectivePaid <= 0 && refunded > 0) {
    return 'refunded';
  }

  if (effectivePaid >= total) {
    return 'paid';
  }

  if (effectivePaid > 0) {
    return 'partially_paid';
  }

  if (input.dueDate && input.dueDate < (input.today ?? todayDate())) {
    return 'overdue';
  }

  return 'unpaid';
}

export function canLivePaymentEventChangePaymentState(
  event: LivePaymentEvent
): LivePaymentTrustedEventDecision {
  if (event.verificationStatus === 'duplicate') {
    return {
      canChangePaymentState: false,
      auditAction: 'duplicate_ignored',
      reason: 'Duplicate provider event ignored by idempotency key.',
    };
  }

  if (event.verificationStatus !== 'verified') {
    return {
      canChangePaymentState: false,
      auditAction: event.verificationStatus === 'rejected' ? 'event_rejected' : 'payment_review_required',
      reason: 'Payment event is not verified by the backend.',
    };
  }

  if (!isTrustedLivePaymentEventSource(event.source)) {
    return {
      canChangePaymentState: false,
      auditAction: 'event_rejected',
      reason: 'Payment event source is not trusted for payment state changes.',
    };
  }

  if (!trustedProviderStatuses.has(event.providerStatus)) {
    return {
      canChangePaymentState: false,
      auditAction: 'event_received',
      reason: 'Provider status is informational and must not alter payment allocation.',
    };
  }

  return {
    canChangePaymentState: true,
    auditAction: auditActionForProviderStatus(event.providerStatus),
    reason: 'Verified backend payment event can update Orbit Ledger payment state.',
  };
}

export function isTrustedLivePaymentEventSource(source: string): source is LivePaymentEventSource {
  return source === 'provider_webhook' || source === 'trusted_backend_verification';
}

export function buildLivePaymentIdempotencyKey(input: LivePaymentIdempotencyInput): string {
  const eventPart = cleanKeyPart(input.providerEventId);
  const paymentPart = cleanKeyPart(input.providerPaymentId);
  const linkPart = cleanKeyPart(input.providerPaymentLinkId);
  const identity = eventPart || paymentPart || linkPart;
  return [cleanKeyPart(input.provider), identity || 'missing-provider-identity'].join(':');
}

export function validatePaymentCapabilitySeparation(settings: PaymentCapabilitySettings): string[] {
  const issues: string[] = [];
  if (!settings.manualInstructionsEnabled && !settings.onlinePayments?.enabled) {
    issues.push('At least one payment collection method should be available.');
  }

  if (settings.manualInstructionsSource !== 'workspace_payment_instructions') {
    issues.push('Manual payment instructions must come from workspace payment instructions.');
  }

  if (settings.onlinePayments && settings.onlinePayments.provider !== 'razorpay') {
    issues.push('Online payment settings must use the supported provider contract.');
  }

  return issues;
}

export function redactOnlinePaymentProviderConfig(
  config: OnlinePaymentProviderServerConfig | null
): LivePaymentPublicProviderConfig | null {
  if (!config) {
    return null;
  }

  return {
    provider: config.provider,
    mode: config.mode,
    workspaceId: config.workspaceId,
    configured: Boolean(config.keyIdSecretName && config.keySecretSecretName && config.webhookSecretName),
    secretReferences: 'server_only',
    updatedAt: config.updatedAt,
  };
}

export function buildLivePaymentAuditEntry(input: LivePaymentAuditDraftInput): LivePaymentAuditEntry {
  return {
    id: input.id,
    workspaceId: input.event.workspaceId,
    action: input.action,
    paymentEventId: input.event.id,
    invoiceId: input.event.invoiceId ?? null,
    invoiceVersionId: input.event.invoiceVersionId ?? null,
    customerId: input.event.customerId ?? null,
    actor: 'system',
    source: input.event.source,
    provider: input.event.provider,
    providerEventId: input.event.providerEventId,
    idempotencyKey: input.event.idempotencyKey,
    amount: input.event.amount,
    currency: input.event.currency,
    message: input.message,
    createdAt: input.createdAt ?? input.event.verifiedAt ?? input.event.receivedAt,
  };
}

export function buildLivePaymentNotification(
  input: LivePaymentNotificationDraftInput
): LivePaymentNotification | null {
  if (!shouldCreateLivePaymentNotification(input.event)) {
    return null;
  }

  return {
    id: input.id,
    workspaceId: input.event.workspaceId,
    kind: notificationKindForProviderStatus(input.event.providerStatus),
    source: 'orbit_ledger_state',
    invoiceId: input.event.invoiceId ?? null,
    invoiceVersionId: input.event.invoiceVersionId ?? null,
    customerId: input.event.customerId ?? null,
    paymentEventId: input.event.id,
    amount: input.event.amount,
    currency: input.event.currency,
    title: input.title,
    message: input.message,
    deepLinkPath: buildLivePaymentDeepLink(input.event),
    createdAt: input.createdAt ?? input.event.verifiedAt ?? input.event.receivedAt,
    readAt: null,
  };
}

export function shouldCreateLivePaymentNotification(event: LivePaymentEvent): boolean {
  const decision = canLivePaymentEventChangePaymentState(event);
  return decision.canChangePaymentState && event.providerStatus !== 'authorized';
}

function auditActionForProviderStatus(status: ProviderBackedPaymentStatus): LivePaymentAuditAction {
  switch (status) {
    case 'captured':
      return 'payment_applied';
    case 'failed':
    case 'disputed':
    case 'needs_review':
      return 'payment_review_required';
    case 'refunded':
    case 'partially_refunded':
      return 'payment_refunded';
    default:
      return 'event_received';
  }
}

function notificationKindForProviderStatus(status: ProviderBackedPaymentStatus): LivePaymentNotification['kind'] {
  switch (status) {
    case 'captured':
      return 'payment_received';
    case 'failed':
      return 'payment_failed';
    case 'refunded':
    case 'partially_refunded':
      return 'payment_refunded';
    case 'disputed':
    case 'needs_review':
    default:
      return 'payment_needs_review';
  }
}

function buildLivePaymentDeepLink(event: LivePaymentEvent): string {
  if (event.invoiceId) {
    return `/invoices/detail/?invoiceId=${encodeURIComponent(event.invoiceId)}`;
  }

  if (event.customerId) {
    return `/customers/detail/?customerId=${encodeURIComponent(event.customerId)}`;
  }

  return '/payments';
}

function cleanKeyPart(value?: string | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function money(value?: number | null): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(Math.max(amount, 0) * 100) / 100 : 0;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
