import type { PlatformAdminRole, PlatformAdminRoleSource, PlatformAdminStatus } from '@orbit-ledger/core';

import { getWebAuth, getWebFirebaseProjectId } from './firebase';
export { isWebPlatformAdminAllowed } from './platform-admin-access';

export type WebPlatformAdminUserStatus = 'active' | 'disabled' | 'no_workspace';

export type WebPlatformAdminUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  disabled: boolean;
  providerIds: string[];
  createdAt: string | null;
  lastSignInAt: string | null;
  ownedWorkspaceCount: number;
  officeWorkspaceCount: number;
  workspaceNames: string[];
  workspaceCountries: string[];
  officeRoles: string[];
  latestWorkspaceUpdatedAt: string | null;
  platformAdminRole: PlatformAdminRole | null;
  platformAdminStatus: PlatformAdminStatus | null;
  platformAdminRoleSource: PlatformAdminRoleSource | null;
  platformAdminCustomClaimsReady: boolean;
  platformAdminCustomClaimsRole: PlatformAdminRole | null;
  platformUserStatus: string | null;
  platformUserRiskStatus: string | null;
  platformUserWarningCount: number;
  platformUserLastWarningAt: string | null;
  platformUserLastAdminAction: string | null;
  platformUserLastAdminReason: string | null;
  platformUserLastInternalNoteAt: string | null;
  platformUserLastInternalNotePreview: string | null;
  status: WebPlatformAdminUserStatus;
};

export type WebPlatformAdminAccess = {
  uid: string;
  email: string | null;
  role: PlatformAdminRole;
  status: PlatformAdminStatus;
  roleSource: PlatformAdminRoleSource;
  customClaimsReady: boolean;
  customClaimsPlatformAdmin: boolean;
  customClaimsRole: PlatformAdminRole | null;
};

export type WebPlatformAdminRegistryRecord = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: PlatformAdminRole;
  status: PlatformAdminStatus;
  roleSource: PlatformAdminRoleSource;
  customClaimsReady: boolean;
  customClaimsPlatformAdmin: boolean;
  customClaimsRole: PlatformAdminRole | null;
  createdByUid: string | null;
  createdByEmail: string | null;
  createdAt: string | null;
  updatedByUid: string | null;
  updatedByEmail: string | null;
  updatedAt: string | null;
  suspendedByUid: string | null;
  suspendedByEmail: string | null;
  suspendedAt: string | null;
  revokedByUid: string | null;
  revokedByEmail: string | null;
  revokedAt: string | null;
  reason: string | null;
  isEmergencyAllowlist: boolean;
  lastSignInAt: string | null;
};

export type WebPlatformAdminAccountAction = 'create' | 'change_role' | 'suspend' | 'reactivate' | 'revoke';
export type WebPlatformAdminUserAction =
  | 'suspend_user'
  | 'restore_user'
  | 'send_warning'
  | 'add_internal_note'
  | 'mark_under_review'
  | 'clear_under_review';

export type WebPlatformAdminOfferScope =
  | 'sitewide'
  | 'selected_users'
  | 'selected_workspaces'
  | 'selected_plans'
  | 'selected_countries';
export type WebPlatformAdminOfferDiscountType = 'fixed_price' | 'percentage' | 'amount' | 'custom_tier_price';
export type WebPlatformAdminOfferStatus = 'scheduled' | 'active' | 'expired' | 'deactivated' | 'removed';
export type WebPlatformAdminOfferAction = 'create' | 'update' | 'deactivate' | 'remove';

export type WebPlatformAdminOfferPlanPrice = {
  planId: string;
  originalAmountMinor: number;
  originalAmountDisplay: string;
  offerAmountMinor: number;
  offerAmountDisplay: string;
  currency: string;
};

export type WebPlatformAdminOffer = {
  id: string;
  label: string;
  title: string;
  publicBannerMessage: string;
  internalNote: string | null;
  scope: WebPlatformAdminOfferScope;
  discountType: WebPlatformAdminOfferDiscountType;
  discountValue: number;
  currency: string | null;
  targetEmails: string[];
  targetUids: string[];
  targetWorkspaceIds: string[];
  targetPlanIds: string[];
  targetCountries: string[];
  startAt: string | null;
  expiresAt: string | null;
  status: WebPlatformAdminOfferStatus;
  lifetimeConfirmed: boolean;
  createdAt: string | null;
  createdByUid: string | null;
  createdByEmail: string | null;
  updatedAt: string | null;
  updatedByUid: string | null;
  updatedByEmail: string | null;
  lastReason: string | null;
  planPrices?: WebPlatformAdminOfferPlanPrice[];
};

export type WebPlatformAdminAuditRecord = {
  id: string;
  action: string;
  actorUid: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetUid: string | null;
  targetEmail: string | null;
  targetRole: string | null;
  targetStatus: string | null;
  workspaceId: string | null;
  supportCaseId: string | null;
  severity: string;
  reason: string | null;
  timestamp: string | null;
  affectedSummary: string;
};

export type WebPlatformAdminAuditFilters = {
  action: string;
  actor: string;
  target: string;
  severity: string;
  fromDate: string;
  toDate: string;
};

export type WebPlatformAdminAuditTrail = {
  generatedAt: string;
  records: WebPlatformAdminAuditRecord[];
};

export type WebPlatformAdminMetrics = {
  userCount: number;
  disabledCount: number;
  verifiedEmailCount: number;
  googleUserCount: number;
  passwordUserCount: number;
  workspaceOwnerCount: number;
  officeMemberCount: number;
  usersWithoutWorkspaceCount: number;
  platformAdminCount: number;
  activePlatformAdminCount: number;
  emergencyAllowlistAdminCount: number;
};

export type WebPlatformAdminSnapshot = {
  generatedAt: string;
  nextPageToken: string | null;
  hasMore: boolean;
  adminAccess: WebPlatformAdminAccess | null;
  metrics: WebPlatformAdminMetrics;
  admins: WebPlatformAdminRegistryRecord[];
  offers: WebPlatformAdminOffer[];
  users: WebPlatformAdminUser[];
};

export type WebPlatformAdminChartDatum = {
  label: string;
  value: number;
};

export type WebPlatformAdminSaasHealthCharts = {
  newUsersTrend: WebPlatformAdminChartDatum[];
  userStatusMix: WebPlatformAdminChartDatum[];
  workspaceAdoption: WebPlatformAdminChartDatum[];
  offerStatusMix: WebPlatformAdminChartDatum[];
  auditSeverityMix: WebPlatformAdminChartDatum[];
  adminRoleMix: WebPlatformAdminChartDatum[];
};

export function buildWebPlatformAdminMetrics(users: WebPlatformAdminUser[]): WebPlatformAdminMetrics {
  return {
    userCount: users.length,
    disabledCount: users.filter((user) => user.disabled).length,
    verifiedEmailCount: users.filter((user) => user.emailVerified).length,
    googleUserCount: users.filter((user) => user.providerIds.includes('google.com')).length,
    passwordUserCount: users.filter((user) => user.providerIds.includes('password')).length,
    workspaceOwnerCount: users.filter((user) => user.ownedWorkspaceCount > 0).length,
    officeMemberCount: users.filter((user) => user.officeWorkspaceCount > 0).length,
    usersWithoutWorkspaceCount: users.filter(
      (user) => !user.disabled && user.ownedWorkspaceCount === 0 && user.officeWorkspaceCount === 0
    ).length,
    platformAdminCount: users.filter((user) => Boolean(user.platformAdminRole)).length,
    activePlatformAdminCount: users.filter((user) => user.platformAdminStatus === 'active').length,
    emergencyAllowlistAdminCount: users.filter((user) => user.platformAdminRoleSource === 'allowlist').length,
  };
}

export function buildWebPlatformAdminSaasHealthCharts(
  snapshot: WebPlatformAdminSnapshot,
  auditRecords: WebPlatformAdminAuditRecord[]
): WebPlatformAdminSaasHealthCharts {
  return {
    newUsersTrend: buildMonthlyUserTrend(snapshot.users, snapshot.generatedAt),
    userStatusMix: [
      {
        label: 'Active',
        value: snapshot.users.filter((user) => !user.disabled && user.status === 'active').length,
      },
      {
        label: 'No workspace',
        value: snapshot.users.filter((user) => !user.disabled && user.status === 'no_workspace').length,
      },
      {
        label: 'Disabled',
        value: snapshot.users.filter((user) => user.disabled || user.status === 'disabled').length,
      },
    ],
    workspaceAdoption: [
      {
        label: 'Workspace owners',
        value: snapshot.users.filter((user) => user.ownedWorkspaceCount > 0).length,
      },
      {
        label: 'Office members',
        value: snapshot.users.filter((user) => user.officeWorkspaceCount > 0).length,
      },
      {
        label: 'No workspace',
        value: snapshot.users.filter(
          (user) => !user.disabled && user.ownedWorkspaceCount === 0 && user.officeWorkspaceCount === 0
        ).length,
      },
    ],
    offerStatusMix: countByLabels(snapshot.offers, ['active', 'scheduled', 'expired', 'deactivated', 'removed'], (offer) => offer.status),
    auditSeverityMix: countByLabels(auditRecords, ['high', 'medium', 'low'], (record) => record.severity),
    adminRoleMix: countByLabels(
      snapshot.admins,
      ['super_admin', 'admin', 'finance_admin', 'support_admin', 'read_only_admin'],
      (admin) => admin.role
    ),
  };
}

function buildMonthlyUserTrend(users: WebPlatformAdminUser[], generatedAt: string): WebPlatformAdminChartDatum[] {
  const endDate = parseDate(generatedAt) ?? new Date();
  const monthKeys: string[] = [];
  for (let index = 5; index >= 0; index -= 1) {
    const month = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - index, 1));
    monthKeys.push(monthKey(month));
  }
  const counts = new Map(monthKeys.map((key) => [key, 0]));

  for (const user of users) {
    const createdAt = parseDate(user.createdAt);
    if (!createdAt) {
      continue;
    }
    const key = monthKey(createdAt);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return monthKeys.map((key) => ({
    label: formatMonthLabel(key),
    value: counts.get(key) ?? 0,
  }));
}

function countByLabels<T>(items: T[], labels: string[], getLabel: (item: T) => string | null | undefined): WebPlatformAdminChartDatum[] {
  const counts = new Map(labels.map((label) => [label, 0]));
  for (const item of items) {
    const label = getLabel(item);
    if (label && counts.has(label)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return labels.map((label) => ({
    label: label.replaceAll('_', ' '),
    value: counts.get(label) ?? 0,
  }));
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) {
    return key;
  }
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function filterWebPlatformAdminUsers(users: WebPlatformAdminUser[], searchTerm: string): WebPlatformAdminUser[] {
  const search = searchTerm.trim().toLowerCase();
  if (!search) {
    return users;
  }
  return users.filter((user) =>
    [
      user.uid,
      user.email ?? '',
      user.displayName ?? '',
      user.status,
      ...user.providerIds,
      ...user.workspaceNames,
      ...user.officeRoles,
      user.platformAdminRole ?? '',
      user.platformAdminStatus ?? '',
      user.platformAdminRoleSource ?? '',
      user.platformUserStatus ?? '',
      user.platformUserRiskStatus ?? '',
      String(user.platformUserWarningCount),
      user.platformUserLastAdminAction ?? '',
      user.platformUserLastAdminReason ?? '',
      user.platformUserLastInternalNotePreview ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search)
  );
}

export function filterWebPlatformAdminAuditRecords(
  records: WebPlatformAdminAuditRecord[],
  searchTerm: string
): WebPlatformAdminAuditRecord[] {
  const search = searchTerm.trim().toLowerCase();
  if (!search) {
    return records;
  }
  return records.filter((record) =>
    [
      record.id,
      record.action,
      record.actorUid ?? '',
      record.actorEmail ?? '',
      record.actorRole ?? '',
      record.targetUid ?? '',
      record.targetEmail ?? '',
      record.targetRole ?? '',
      record.targetStatus ?? '',
      record.workspaceId ?? '',
      record.supportCaseId ?? '',
      record.severity,
      record.reason ?? '',
      record.affectedSummary,
    ]
      .join(' ')
      .toLowerCase()
      .includes(search)
  );
}

export function filterWebPlatformAdminOffers(
  offers: WebPlatformAdminOffer[],
  searchTerm: string
): WebPlatformAdminOffer[] {
  const search = searchTerm.trim().toLowerCase();
  if (!search) {
    return offers;
  }
  return offers.filter((offer) =>
    [
      offer.id,
      offer.label,
      offer.title,
      offer.publicBannerMessage,
      offer.internalNote ?? '',
      offer.scope,
      offer.discountType,
      offer.status,
      offer.currency ?? '',
      ...offer.targetEmails,
      ...offer.targetUids,
      ...offer.targetWorkspaceIds,
      ...offer.targetPlanIds,
      ...offer.targetCountries,
      offer.lastReason ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search)
  );
}

export function formatPlatformAdminDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not seen yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export async function loadWebPlatformAdminSnapshot(input: {
  limit?: number;
  pageToken?: string | null;
} = {}): Promise<WebPlatformAdminSnapshot> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before opening platform admin.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getPlatformAdminSnapshotUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit: input.limit ?? 450,
      pageToken: input.pageToken ?? null,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'platform_admin_snapshot_failed',
  }))) as
    | ({
        ok: true;
      } & WebPlatformAdminSnapshot)
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(platformAdminErrorMessage(result.error));
  }

  return {
    generatedAt: result.generatedAt,
    nextPageToken: result.nextPageToken,
    hasMore: result.hasMore,
    adminAccess: result.adminAccess ?? null,
    metrics: result.metrics,
    admins: result.admins ?? [],
    offers: result.offers ?? [],
    users: result.users,
  };
}

export async function manageWebPlatformAdminAccount(input: {
  action: WebPlatformAdminAccountAction;
  targetEmail?: string | null;
  targetUid?: string | null;
  role?: PlatformAdminRole | null;
  displayName?: string | null;
  reason: string;
}): Promise<void> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before changing platform admin access.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getPlatformAdminAccountUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'admin_account_update_failed',
  }))) as
    | {
        ok: true;
      }
    | {
        ok: false;
        error: string;
      };

  if (!result.ok) {
    throw new Error(platformAdminAccountErrorMessage(result.error));
  }
}

export async function manageWebPlatformAdminUser(input: {
  action: WebPlatformAdminUserAction;
  targetEmail?: string | null;
  targetUid?: string | null;
  reason: string;
  message?: string | null;
  riskLabel?: string | null;
}): Promise<void> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before changing platform user status.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getPlatformAdminUserUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'platform_user_update_failed',
  }))) as
    | {
        ok: true;
      }
    | {
        ok: false;
        error: string;
      };

  if (!result.ok) {
    throw new Error(platformAdminUserErrorMessage(result.error));
  }
}

export async function manageWebPlatformAdminOffer(input: {
  action: WebPlatformAdminOfferAction;
  offerId?: string | null;
  label?: string | null;
  title?: string | null;
  publicBannerMessage?: string | null;
  internalNote?: string | null;
  scope?: WebPlatformAdminOfferScope | null;
  discountType?: WebPlatformAdminOfferDiscountType | null;
  discountValue?: number | null;
  currency?: string | null;
  targetEmails?: string | string[] | null;
  targetUids?: string | string[] | null;
  targetWorkspaceIds?: string | string[] | null;
  targetPlanIds?: string | string[] | null;
  targetCountries?: string | string[] | null;
  startAt?: string | null;
  expiresAt?: string | null;
  lifetimeConfirmed?: boolean;
  reason: string;
}): Promise<WebPlatformAdminOffer | null> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before changing platform offers.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getPlatformAdminOfferUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'platform_offer_update_failed',
  }))) as
    | {
        ok: true;
        offer?: WebPlatformAdminOffer | null;
      }
    | {
        ok: false;
        error: string;
      };

  if (!result.ok) {
    throw new Error(platformAdminOfferErrorMessage(result.error));
  }

  return result.offer ?? null;
}

export async function loadWebPlatformAdminAuditTrail(input: Partial<WebPlatformAdminAuditFilters> & {
  limit?: number;
} = {}): Promise<WebPlatformAdminAuditTrail> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before opening the platform admin audit trail.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getPlatformAdminAuditTrailUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit: input.limit ?? 100,
      action: input.action ?? '',
      actor: input.actor ?? '',
      target: input.target ?? '',
      severity: input.severity ?? '',
      fromDate: input.fromDate ?? '',
      toDate: input.toDate ?? '',
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'platform_admin_audit_failed',
  }))) as
    | ({
        ok: true;
      } & WebPlatformAdminAuditTrail)
    | {
        ok: false;
        error: string;
      };

  if (!result.ok) {
    throw new Error(platformAdminAuditErrorMessage(result.error));
  }

  return {
    generatedAt: result.generatedAt,
    records: result.records ?? [],
  };
}

function getPlatformAdminSnapshotUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/getPlatformAdminSnapshot`;
}

function getPlatformAdminAccountUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/managePlatformAdminAccount`;
}

function getPlatformAdminUserUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/managePlatformAdminUser`;
}

function getPlatformAdminAuditTrailUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/getPlatformAdminAuditTrail`;
}

function getPlatformAdminOfferUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/managePlatformAdminOffer`;
}

function platformAdminErrorMessage(error: string): string {
  if (error === 'internal_admin_required') {
    return 'This account is not enabled for internal platform administration.';
  }
  if (error === 'method_not_allowed') {
    return 'Platform admin request method is not supported.';
  }
  return 'Platform admin registry could not be loaded.';
}

function platformAdminAccountErrorMessage(error: string): string {
  if (error === 'admin_reason_required') {
    return 'Add a clear reason with at least 10 characters before changing admin access.';
  }
  if (error === 'admin_role_required') {
    return 'Choose an admin role before saving this change.';
  }
  if (error === 'admin_email_invalid') {
    return 'Enter a valid admin email address.';
  }
  if (error === 'admin_target_not_found') {
    return 'No Firebase Auth user was found for that admin target.';
  }
  if (error === 'cannot_change_own_admin_status') {
    return 'You cannot suspend or revoke your own platform admin access.';
  }
  if (error === 'emergency_admin_protected') {
    return 'Emergency Super Admin allowlist accounts cannot be revoked or downgraded from the UI.';
  }
  if (error === 'internal_admin_required') {
    return 'Only a Super Admin can manage platform admin accounts.';
  }
  return 'Platform admin access could not be updated.';
}

function platformAdminUserErrorMessage(error: string): string {
  if (error === 'user_reason_required') {
    return 'Add a clear reason with at least 10 characters before changing this user record.';
  }
  if (error === 'user_message_required') {
    return 'Add a warning or note message with at least 10 characters before saving.';
  }
  if (error === 'user_email_invalid') {
    return 'Enter a valid user email address.';
  }
  if (error === 'user_target_not_found') {
    return 'No Firebase Auth user was found for that target.';
  }
  if (error === 'user_action_not_allowed') {
    return 'Your admin role cannot perform that user control action.';
  }
  if (error === 'cannot_change_own_user_status') {
    return 'You cannot suspend or restore your own user account from this control.';
  }
  if (error === 'platform_admin_user_protected') {
    return 'Platform admin accounts are protected from regular user lifecycle actions.';
  }
  if (error === 'internal_admin_required') {
    return 'This account is not enabled to manage platform users.';
  }
  return 'Platform user control action could not be completed.';
}

function platformAdminAuditErrorMessage(error: string): string {
  if (error === 'internal_admin_required') {
    return 'This account is not enabled to view the platform admin audit trail.';
  }
  if (error === 'method_not_allowed') {
    return 'Platform admin audit request method is not supported.';
  }
  return 'Platform admin audit trail could not be loaded.';
}

function platformAdminOfferErrorMessage(error: string): string {
  if (error === 'offer_reason_required') {
    return 'Add a clear reason with at least 10 characters before changing an offer.';
  }
  if (error === 'offer_copy_required') {
    return 'Add an offer label, title, and public banner message.';
  }
  if (error === 'offer_configuration_required') {
    return 'Choose an offer scope and discount type.';
  }
  if (error === 'offer_targets_required') {
    return 'Add at least one matching target for this selected offer scope.';
  }
  if (error === 'offer_discount_invalid') {
    return 'Enter a valid discount. Percentage discounts must be between 1 and 90.';
  }
  if (error === 'offer_lifetime_confirmation_required') {
    return 'Add an expiry date, or explicitly confirm this is a lifetime offer.';
  }
  if (error === 'offer_expiry_required') {
    return 'Choose a future expiry date for this offer.';
  }
  if (error === 'offer_expired_read_only') {
    return 'Expired offers are historical records and cannot be edited.';
  }
  if (error === 'internal_admin_required') {
    return 'Only Super Admin and Finance Admin accounts can change offers.';
  }
  return 'Platform offer could not be updated.';
}
