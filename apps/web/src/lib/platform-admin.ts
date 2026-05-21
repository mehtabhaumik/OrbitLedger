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
    users: result.users,
  };
}

function getPlatformAdminSnapshotUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/getPlatformAdminSnapshot`;
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
