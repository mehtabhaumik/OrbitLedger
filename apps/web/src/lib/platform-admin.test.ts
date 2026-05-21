import { describe, expect, it } from 'vitest';

import {
  buildWebPlatformAdminMetrics,
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
    expect(filterWebPlatformAdminUsers(users, 'missing')).toHaveLength(0);
  });

  it('formats missing and valid dates safely', () => {
    expect(formatPlatformAdminDate(null)).toBe('Not seen yet');
    expect(formatPlatformAdminDate('not-a-date')).toBe('not-a-date');
    expect(formatPlatformAdminDate('2026-05-21T12:00:00.000Z')).toContain('2026');
  });
});
