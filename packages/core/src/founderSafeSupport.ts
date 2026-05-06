export type FounderSafeSupportArea =
  | 'issue_report'
  | 'restore_help'
  | 'feature_request'
  | 'diagnostic_summary'
  | 'purchase_support'
  | 'privacy_review';

export type FounderSafeSupportKind =
  | 'invoice_issue'
  | 'payment_issue'
  | 'restore_help'
  | 'sync_issue'
  | 'purchase_help'
  | 'feature_request'
  | 'general_feedback';

export type FounderSafeSupportPriority = 'urgent' | 'high' | 'normal' | 'low';

export type FounderSafeSupportActionTarget =
  | 'open_support_center'
  | 'open_invoice_support'
  | 'open_payment_support'
  | 'open_backup_support'
  | 'open_purchase_support'
  | 'open_feature_feedback'
  | 'review_support_privacy';

export type FounderSafeDiagnosticInput = {
  appVersion?: string | null;
  platform?: 'web' | 'ios' | 'android' | 'unknown' | null;
  screen?: string | null;
  route?: string | null;
  workspaceMode?: string | null;
  storageMode?: string | null;
  connectivity?: 'online' | 'offline' | 'unknown' | null;
  lastSyncAt?: string | null;
  errorCode?: string | null;
  browserName?: string | null;
  osName?: string | null;
  featureFlags?: string[] | null;
  recordCounts?: {
    customers?: number | null;
    invoices?: number | null;
    payments?: number | null;
    products?: number | null;
  } | null;
  recentActionLabels?: string[] | null;
  businessName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  phoneNumber?: string | null;
  rawErrorMessage?: string | null;
  rawUrl?: string | null;
};

export type FounderSafeDiagnosticSummary = {
  safeFields: Record<string, string | number | boolean | string[]>;
  redactedFields: string[];
  privacyNote: string;
};

export type FounderSafeSupportDraftInput = {
  kind: FounderSafeSupportKind;
  message?: string | null;
  screen?: string | null;
  includeDiagnostics?: boolean | null;
  userApprovedDiagnostics?: boolean | null;
  diagnostic?: FounderSafeDiagnosticInput | null;
};

export type FounderSafeSupportDraft = {
  kind: FounderSafeSupportKind;
  title: string;
  summary: string;
  priority: FounderSafeSupportPriority;
  actionTarget: FounderSafeSupportActionTarget;
  sanitizedMessage: string;
  privateDataWarnings: string[];
  missingFields: string[];
  requiresPrivacyReview: boolean;
  canSubmit: boolean;
  diagnosticSummary: FounderSafeDiagnosticSummary | null;
  guardrails: string[];
};

export type FounderSafeSupportSurfaceBlueprint = {
  area: FounderSafeSupportArea;
  label: string;
  userPromise: string;
  safeData: string[];
  blockedData: string[];
  actionTarget: FounderSafeSupportActionTarget;
};

export const FOUNDER_SAFE_SUPPORT_SURFACES: FounderSafeSupportSurfaceBlueprint[] = [
  surface(
    'issue_report',
    'Report an issue',
    'Let the user report a broken invoice, payment, page, export, or workflow without exposing private records automatically.',
    ['screen name', 'issue category', 'user-written description', 'optional safe diagnostic summary'],
    ['full ledger rows', 'customer contact list', 'raw invoices', 'payment instrument images'],
    'open_support_center'
  ),
  surface(
    'restore_help',
    'Restore help',
    'Collect enough context to help with backup or restore problems while keeping business data local.',
    ['platform', 'backup status label', 'restore step', 'error code'],
    ['backup file contents', 'full business export', 'raw restore payload'],
    'open_backup_support'
  ),
  surface(
    'feature_request',
    'Suggest an improvement',
    'Capture user ideas with product context and no customer data requirement.',
    ['screen name', 'feature area', 'user-written idea'],
    ['customer names unless user intentionally types them', 'ledger amounts', 'tax IDs'],
    'open_feature_feedback'
  ),
  surface(
    'diagnostic_summary',
    'Safe diagnostic summary',
    'Send only product health details that help debugging without sending private business records.',
    ['app version', 'platform', 'route', 'connectivity', 'record counts', 'feature flags', 'error code'],
    ['business name', 'customer names', 'emails', 'phone numbers', 'raw URLs with IDs', 'raw error text with record data'],
    'review_support_privacy'
  ),
  surface(
    'purchase_support',
    'Purchase support',
    'Help with plan, receipt, checkout, or entitlement issues without exposing payment secrets.',
    ['plan label', 'purchase status', 'provider mode', 'receipt status', 'safe event ID'],
    ['card details', 'bank details', 'provider secret keys', 'full webhook payloads'],
    'open_purchase_support'
  ),
  surface(
    'privacy_review',
    'Privacy review before sending',
    'Show exactly what will be shared and ask the user before diagnostics leave the app.',
    ['redacted message preview', 'safe diagnostic fields', 'privacy warnings'],
    ['unreviewed diagnostics', 'attachments by default', 'hidden background uploads'],
    'review_support_privacy'
  ),
];

export const FOUNDER_SAFE_SUPPORT_GUARDRAILS = [
  'Support must never upload customer, ledger, invoice, payment, backup, or tax records automatically.',
  'Diagnostics must be opt-in and must show a clear preview before sending.',
  'Private identifiers in diagnostics must be redacted or omitted by default.',
  'Attachments must be chosen by the user and reviewed before upload.',
  'Payment provider keys, card details, bank account numbers, and backup file contents must never be included in support payloads.',
  'Support copy should avoid scary technical wording on user screens.',
  'Web and mobile may use different layouts, but support categories, privacy rules, and safe diagnostic fields must match.',
];

export function buildFounderSafeDiagnosticSummary(
  input: FounderSafeDiagnosticInput = {}
): FounderSafeDiagnosticSummary {
  const safeFields = removeEmpty({
    appVersion: safeText(input.appVersion),
    platform: input.platform ?? undefined,
    screen: safeText(input.screen),
    route: sanitizeRoute(input.route),
    workspaceMode: safeText(input.workspaceMode),
    storageMode: safeText(input.storageMode),
    connectivity: input.connectivity ?? undefined,
    lastSyncAt: safeText(input.lastSyncAt),
    errorCode: safeText(input.errorCode),
    browserName: safeText(input.browserName),
    osName: safeText(input.osName),
    featureFlags: input.featureFlags?.map((flag) => safeText(flag)).filter(isNonEmptyString),
    customerCount: input.recordCounts?.customers ?? undefined,
    invoiceCount: input.recordCounts?.invoices ?? undefined,
    paymentCount: input.recordCounts?.payments ?? undefined,
    productCount: input.recordCounts?.products ?? undefined,
    recentActions: input.recentActionLabels?.map((label) => redactPrivateText(label)).filter(isNonEmptyString),
  });

  const redactedFields = [
    input.businessName ? 'business name' : null,
    input.customerName ? 'customer name' : null,
    input.customerEmail ? 'customer email' : null,
    input.phoneNumber ? 'phone number' : null,
    input.rawErrorMessage ? 'raw error message' : null,
    input.rawUrl ? 'raw URL' : null,
  ].filter(Boolean) as string[];

  return {
    safeFields,
    redactedFields,
    privacyNote:
      redactedFields.length > 0
        ? 'Private business details were removed from this diagnostic summary.'
        : 'This diagnostic summary contains app context only.',
  };
}

export function buildFounderSafeSupportDraft(
  input: FounderSafeSupportDraftInput
): FounderSafeSupportDraft {
  const message = input.message?.trim() ?? '';
  const privateDataWarnings = detectPrivateData(message);
  const sanitizedMessage = redactPrivateText(message);
  const missingFields = message ? [] : ['message'];
  const diagnosticSummary =
    input.includeDiagnostics && input.userApprovedDiagnostics
      ? buildFounderSafeDiagnosticSummary(input.diagnostic ?? {})
      : null;
  const requiresPrivacyReview =
    privateDataWarnings.length > 0 || Boolean(input.includeDiagnostics && !input.userApprovedDiagnostics);

  return {
    kind: input.kind,
    title: getSupportTitle(input.kind),
    summary: getSupportSummary(input.kind, input.screen),
    priority: getSupportPriority(input.kind),
    actionTarget: getSupportActionTarget(input.kind),
    sanitizedMessage,
    privateDataWarnings,
    missingFields,
    requiresPrivacyReview,
    canSubmit: missingFields.length === 0 && !requiresPrivacyReview,
    diagnosticSummary,
    guardrails: FOUNDER_SAFE_SUPPORT_GUARDRAILS,
  };
}

function getSupportTitle(kind: FounderSafeSupportKind) {
  switch (kind) {
    case 'invoice_issue':
      return 'Invoice help request';
    case 'payment_issue':
      return 'Payment help request';
    case 'restore_help':
      return 'Backup or restore help request';
    case 'sync_issue':
      return 'Sync help request';
    case 'purchase_help':
      return 'Purchase help request';
    case 'feature_request':
      return 'Feature suggestion';
    default:
      return 'Support request';
  }
}

function getSupportSummary(kind: FounderSafeSupportKind, screen?: string | null) {
  const location = screen?.trim() ? ` from ${screen.trim()}` : '';
  switch (kind) {
    case 'invoice_issue':
      return `Report an invoice problem${location}.`;
    case 'payment_issue':
      return `Report a payment or collection problem${location}.`;
    case 'restore_help':
      return `Ask for help with backup or restore${location}.`;
    case 'sync_issue':
      return `Ask for help with online sync${location}.`;
    case 'purchase_help':
      return `Ask for help with plans, receipts, or purchase access${location}.`;
    case 'feature_request':
      return `Suggest an improvement${location}.`;
    default:
      return `Send a support request${location}.`;
  }
}

function getSupportPriority(kind: FounderSafeSupportKind): FounderSafeSupportPriority {
  if (kind === 'restore_help') {
    return 'urgent';
  }
  if (kind === 'payment_issue' || kind === 'purchase_help' || kind === 'sync_issue') {
    return 'high';
  }
  if (kind === 'feature_request') {
    return 'low';
  }
  return 'normal';
}

function getSupportActionTarget(kind: FounderSafeSupportKind): FounderSafeSupportActionTarget {
  if (kind === 'invoice_issue') {
    return 'open_invoice_support';
  }
  if (kind === 'payment_issue') {
    return 'open_payment_support';
  }
  if (kind === 'restore_help' || kind === 'sync_issue') {
    return 'open_backup_support';
  }
  if (kind === 'purchase_help') {
    return 'open_purchase_support';
  }
  if (kind === 'feature_request') {
    return 'open_feature_feedback';
  }
  return 'open_support_center';
}

function detectPrivateData(value: string): string[] {
  const warnings = new Set<string>();
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    warnings.add('email address');
  }
  if (/(?:\+?\d[\s-]?){8,}/.test(value)) {
    warnings.add('phone or account number');
  }
  if (/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i.test(value)) {
    warnings.add('GSTIN');
  }
  if (/\b[A-Z]{5}\d{4}[A-Z]\b/i.test(value)) {
    warnings.add('PAN');
  }
  if (/\b(?:INV|WEB|MOB)-?\d+\b/i.test(value)) {
    warnings.add('document number');
  }
  return [...warnings];
}

function redactPrivateText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/gi, '[GSTIN removed]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[tax ID removed]')
    .replace(/\b(?:INV|WEB|MOB)-?\d+\b/gi, '[document number removed]')
    .replace(/(?:\+?\d[\s-]?){8,}/g, '[number removed]')
    .trim();
}

function sanitizeRoute(route?: string | null) {
  if (!route) {
    return undefined;
  }
  return route.split('?')[0]?.replace(/[a-f0-9]{16,}/gi, '[id]') || undefined;
}

function safeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? redactPrivateText(trimmed) : undefined;
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value);
}

function removeEmpty<T extends Record<string, string | number | boolean | string[] | undefined>>(
  input: T
) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== '';
    })
  ) as Record<string, string | number | boolean | string[]>;
}

function surface(
  area: FounderSafeSupportArea,
  label: string,
  userPromise: string,
  safeData: string[],
  blockedData: string[],
  actionTarget: FounderSafeSupportActionTarget
): FounderSafeSupportSurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    safeData,
    blockedData,
    actionTarget,
  };
}
