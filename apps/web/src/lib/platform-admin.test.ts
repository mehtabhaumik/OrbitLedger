import { describe, expect, it } from 'vitest';

import {
  buildWebPlatformAdminMetrics,
  filterWebPlatformAdminAuditRecords,
  filterWebPlatformAdminUsers,
  formatPlatformAdminDate,
  type WebPlatformAdminUser,
} from './platform-admin';
import {
  getWebPlatformAdminEmailAllowlist,
  isWebPlatformAdminAllowed,
  normalizePlatformAdminEmail,
  ORBIT_LEDGER_EMERGENCY_ADMIN_EMAILS,
} from './platform-admin-access';

const baseUser: WebPlatformAdminUser = {
  uid: 'user_1',
  email: 'owner@example.com',
  displayName: 'Owner User',
  emailVerified: true,
  disabled: false,
  providerIds: ['google.com'],
  createdAt: '2026-05-20T12:00:00.000Z',
  lastSignInAt: '2026-05-21T12:00:00.000Z',
  ownedWorkspaceCount: 1,
  officeWorkspaceCount: 0,
  workspaceNames: ['Rudraix Private Limited'],
  workspaceCountries: ['IN'],
  officeRoles: [],
  latestWorkspaceUpdatedAt: '2026-05-21T12:00:00.000Z',
  platformAdminRole: null,
  platformAdminStatus: null,
  platformAdminRoleSource: null,
  platformAdminCustomClaimsReady: false,
  platformAdminCustomClaimsRole: null,
  status: 'active',
};

describe('platform admin registry helpers', () => {
  it('keeps emergency Super Admin emails available without relying on UI config', () => {
    expect(ORBIT_LEDGER_EMERGENCY_ADMIN_EMAILS).toEqual([
      'bvmehta1980@gmail.com',
      'ui.bhaumik@gmail.com',
      'mehtabhaumik.2007@gmail.com',
    ]);
    expect(getWebPlatformAdminEmailAllowlist('extra-admin@example.com')).toContain('extra-admin@example.com');
    expect(isWebPlatformAdminAllowed(' BVMEHTA1980@gmail.com ')).toBe(true);
    expect(isWebPlatformAdminAllowed('normal@example.com')).toBe(false);
    expect(normalizePlatformAdminEmail(' UI.BHAUMIK@gmail.com ')).toBe('ui.bhaumik@gmail.com');
  });

  it('summarizes registered users without counting disabled accounts as missing workspace', () => {
    const users: WebPlatformAdminUser[] = [
      baseUser,
      {
        ...baseUser,
        uid: 'user_2',
        email: 'viewer@example.com',
        emailVerified: false,
        providerIds: ['password'],
        ownedWorkspaceCount: 0,
        officeWorkspaceCount: 1,
        officeRoles: ['viewer'],
      },
      {
        ...baseUser,
        uid: 'user_3',
        email: 'disabled@example.com',
        disabled: true,
        emailVerified: false,
        providerIds: [],
        ownedWorkspaceCount: 0,
        officeWorkspaceCount: 0,
        workspaceNames: [],
        status: 'disabled',
      },
      {
        ...baseUser,
        uid: 'user_4',
        email: 'new@example.com',
        ownedWorkspaceCount: 0,
        officeWorkspaceCount: 0,
        workspaceNames: [],
        platformAdminRole: 'super_admin',
        platformAdminStatus: 'active',
        platformAdminRoleSource: 'allowlist',
        platformAdminCustomClaimsReady: false,
        platformAdminCustomClaimsRole: null,
        status: 'no_workspace',
      },
    ];

    expect(buildWebPlatformAdminMetrics(users)).toEqual({
      userCount: 4,
      disabledCount: 1,
      verifiedEmailCount: 2,
      googleUserCount: 2,
      passwordUserCount: 1,
      workspaceOwnerCount: 1,
      officeMemberCount: 1,
      usersWithoutWorkspaceCount: 1,
      platformAdminCount: 1,
      activePlatformAdminCount: 1,
      emergencyAllowlistAdminCount: 1,
    });
  });

  it('filters by email, uid, workspace, provider, and role', () => {
    const users = [
      baseUser,
      {
        ...baseUser,
        uid: 'accountant_2',
        email: 'accountant@example.com',
        workspaceNames: [],
        officeRoles: ['accountant'],
      },
    ];

    expect(filterWebPlatformAdminUsers(users, 'rudraix')).toHaveLength(1);
    expect(filterWebPlatformAdminUsers(users, 'accountant_2')).toHaveLength(1);
    expect(filterWebPlatformAdminUsers(users, 'google.com')).toHaveLength(2);
    expect(filterWebPlatformAdminUsers([{ ...baseUser, platformAdminRole: 'finance_admin' }], 'finance_admin')).toHaveLength(1);
    expect(filterWebPlatformAdminUsers(users, 'missing')).toHaveLength(0);
  });

  it('formats missing and valid dates safely', () => {
    expect(formatPlatformAdminDate(null)).toBe('Not seen yet');
    expect(formatPlatformAdminDate('not-a-date')).toBe('not-a-date');
    expect(formatPlatformAdminDate('2026-05-21T12:00:00.000Z')).toContain('2026');
  });

  it('filters admin audit records by actor, target, action, severity, and reason', () => {
    const records = [
      {
        id: 'audit_1',
        action: 'platform_admin_revoke',
        actorUid: 'admin_1',
        actorEmail: 'owner@example.com',
        actorRole: 'super_admin',
        targetUid: 'user_1',
        targetEmail: 'target@example.com',
        targetRole: 'support_admin',
        targetStatus: 'revoked',
        workspaceId: null,
        supportCaseId: null,
        severity: 'high',
        reason: 'Security review',
        timestamp: '2026-05-21T12:00:00.000Z',
        affectedSummary: 'User target@example.com',
      },
      {
        id: 'audit_2',
        action: 'registry_snapshot_generated',
        actorUid: 'admin_2',
        actorEmail: 'viewer@example.com',
        actorRole: 'read_only_admin',
        targetUid: null,
        targetEmail: null,
        targetRole: null,
        targetStatus: null,
        workspaceId: null,
        supportCaseId: null,
        severity: 'low',
        reason: null,
        timestamp: '2026-05-21T12:05:00.000Z',
        affectedSummary: 'Platform record',
      },
    ];

    expect(filterWebPlatformAdminAuditRecords(records, 'revoke')).toHaveLength(1);
    expect(filterWebPlatformAdminAuditRecords(records, 'target@example.com')).toHaveLength(1);
    expect(filterWebPlatformAdminAuditRecords(records, 'security review')).toHaveLength(1);
    expect(filterWebPlatformAdminAuditRecords(records, 'read_only_admin')).toHaveLength(1);
    expect(filterWebPlatformAdminAuditRecords(records, 'missing')).toHaveLength(0);
  });
});
