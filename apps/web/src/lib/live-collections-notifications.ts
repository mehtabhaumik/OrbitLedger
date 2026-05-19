export type LiveCollectionNotificationKind =
  | 'payment_received'
  | 'payment_failed'
  | 'payment_needs_review'
  | 'payment_refunded';

export type LiveCollectionNotificationTone = 'success' | 'warning' | 'danger' | 'info';

export type LiveCollectionNotification = {
  id: string;
  kind: LiveCollectionNotificationKind;
  title: string;
  message: string;
  amount: number | null;
  currency: string;
  invoiceId: string | null;
  customerId: string | null;
  deepLinkPath: string;
  createdAt: string;
  tone: LiveCollectionNotificationTone;
};

const KNOWN_KINDS = new Set<LiveCollectionNotificationKind>([
  'payment_received',
  'payment_failed',
  'payment_needs_review',
  'payment_refunded',
]);

export function parseLiveCollectionNotification(
  id: string,
  data: Record<string, unknown>
): LiveCollectionNotification | null {
  const kind = stringValue(data.kind);
  if (!kind || !KNOWN_KINDS.has(kind as LiveCollectionNotificationKind)) {
    return null;
  }

  const createdAt = stringValue(data.created_at) ?? stringValue(data.createdAt);
  if (!createdAt) {
    return null;
  }

  return {
    id,
    kind: kind as LiveCollectionNotificationKind,
    title: stringValue(data.title) ?? titleForNotificationKind(kind as LiveCollectionNotificationKind),
    message: sanitizeLiveCollectionMessage(stringValue(data.message) ?? 'Payment activity updated.'),
    amount: numberValue(data.amount),
    currency: normalizeCurrency(stringValue(data.currency)),
    invoiceId: stringValue(data.invoice_id) ?? stringValue(data.invoiceId),
    customerId: stringValue(data.customer_id) ?? stringValue(data.customerId),
    deepLinkPath: normalizeNotificationDeepLink(stringValue(data.deep_link_path) ?? stringValue(data.deepLinkPath)),
    createdAt,
    tone: toneForNotificationKind(kind as LiveCollectionNotificationKind),
  };
}

export function shouldSurfaceLiveCollectionNotification(input: {
  notification: LiveCollectionNotification;
  knownIds: Set<string>;
  mountedAtMs: number;
  nowMs?: number;
}) {
  if (input.knownIds.has(input.notification.id)) {
    return false;
  }

  const createdAtMs = Date.parse(input.notification.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  const nowMs = input.nowMs ?? Date.now();
  const tenMinutesMs = 10 * 60 * 1000;
  return createdAtMs >= input.mountedAtMs - 5_000 && nowMs - createdAtMs <= tenMinutesMs;
}

export function formatLiveCollectionAmount(amount: number | null, currency: string) {
  if (amount === null) {
    return null;
  }

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function titleForNotificationKind(kind: LiveCollectionNotificationKind) {
  switch (kind) {
    case 'payment_received':
      return 'Payment received';
    case 'payment_failed':
      return 'Payment failed';
    case 'payment_refunded':
      return 'Payment refunded';
    case 'payment_needs_review':
    default:
      return 'Payment needs review';
  }
}

function toneForNotificationKind(kind: LiveCollectionNotificationKind): LiveCollectionNotificationTone {
  switch (kind) {
    case 'payment_received':
      return 'success';
    case 'payment_failed':
      return 'danger';
    case 'payment_refunded':
    case 'payment_needs_review':
      return 'warning';
    default:
      return 'info';
  }
}

function normalizeNotificationDeepLink(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/payments';
  }

  if (value.startsWith('//')) {
    return '/payments';
  }

  return value;
}

function normalizeCurrency(value: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : 'INR';
}

function sanitizeLiveCollectionMessage(value: string) {
  return value
    .replace(/\bRazorpay\b/gi, 'Online')
    .replace(/\bonline payment status\b/gi, 'online payment status')
    .trim();
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
