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
  users: WebPlatformAdminUser[];
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

function getPlatformAdminAuditTrailUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/getPlatformAdminAuditTrail`;
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

function platformAdminAuditErrorMessage(error: string): string {
  if (error === 'internal_admin_required') {
    return 'This account is not enabled to view the platform admin audit trail.';
  }
  if (error === 'method_not_allowed') {
    return 'Platform admin audit request method is not supported.';
  }
  return 'Platform admin audit trail could not be loaded.';
}
