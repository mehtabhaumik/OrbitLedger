import { describe, expect, it } from 'vitest';

import {
  buildWebPlatformAdminMetrics,
  buildWebPlatformAdminReport,
  buildWebPlatformAdminReportCsv,
  buildWebPlatformAdminSaasHealthCharts,
  filterWebPlatformAdminAuditRecords,
  filterWebPlatformAdminOffers,
  filterWebPlatformAdminUsers,
  filterWebPlatformAdminUsersWithFilters,
  formatPlatformAdminDate,
  type WebPlatformAdminAuditRecord,
  type WebPlatformAdminOffer,
  type WebPlatformAdminSnapshot,
  type WebPlatformAdminUser,
  WEB_PLATFORM_ADMIN_REPORT_DEFINITIONS,
} from './platform-admin';
import {
  getWebOperationsEmailAllowlist,
  getWebPlatformAdminEmailAllowlist,
  isWebPlatformAdminAllowed,
  normalizePlatformAdminEmail,
  ORBIT_LEDGER_EMERGENCY_ADMIN_EMAILS,
} from './platform-admin-access';
import { isWebOfficeOperationsAllowed } from './office-admin-operations';

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
  workspaceContexts: [
    {
      workspaceId: 'workspace_1',
      businessName: 'Rudraix Private Limited',
      accessSource: 'owner',
      officeRole: null,
      ownerUid: 'user_1',
    },
  ],
  officeRoles: [],
  latestWorkspaceUpdatedAt: '2026-05-21T12:00:00.000Z',
  platformAdminRole: null,
  platformAdminStatus: null,
  platformAdminRoleSource: null,
  platformAdminCustomClaimsReady: false,
  platformAdminCustomClaimsRole: null,
  platformUserStatus: 'active',
  platformUserRiskStatus: null,
  platformUserWarningCount: 0,
  platformUserLastWarningAt: null,
  platformUserLastAdminAction: null,
  platformUserLastAdminReason: null,
  platformUserLastInternalNoteAt: null,
  platformUserLastInternalNotePreview: null,
  isQaUser: false,
  hasActiveSubscription: false,
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

  it('separates platform allowlist from operations allowlist while still letting platform admins enter operations', () => {
    const originalPlatform = process.env.NEXT_PUBLIC_ORBIT_LEDGER_PLATFORM_ADMIN_EMAILS;
    const originalOperations = process.env.NEXT_PUBLIC_ORBIT_LEDGER_OPERATIONS_EMAILS;
    const originalInternal = process.env.NEXT_PUBLIC_ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS;
    try {
      expect(
        getWebPlatformAdminEmailAllowlist(
          'super-admin@example.com',
          'legacy-admin@example.com,operations-only@example.com'
        )
      ).toContain('super-admin@example.com');
      expect(
        getWebOperationsEmailAllowlist(
          'operations-only@example.com,super-admin@example.com',
          'legacy-admin@example.com'
        )
      ).toContain('operations-only@example.com');

      process.env.NEXT_PUBLIC_ORBIT_LEDGER_PLATFORM_ADMIN_EMAILS = 'super-admin@example.com';
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_OPERATIONS_EMAILS = 'operations-only@example.com,super-admin@example.com';
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS = 'legacy-admin@example.com';

      expect(isWebPlatformAdminAllowed('super-admin@example.com')).toBe(true);
      expect(isWebPlatformAdminAllowed('operations-only@example.com')).toBe(false);
      expect(isWebOfficeOperationsAllowed('operations-only@example.com')).toBe(true);
      expect(isWebOfficeOperationsAllowed('super-admin@example.com')).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_PLATFORM_ADMIN_EMAILS = originalPlatform;
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_OPERATIONS_EMAILS = originalOperations;
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS = originalInternal;
    }
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
        isQaUser: true,
        hasActiveSubscription: true,
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
      usersWithWorkspaceCount: 2,
      workspaceOwnerCount: 1,
      officeMemberCount: 1,
      usersWithoutWorkspaceCount: 1,
      platformAdminCount: 1,
      activePlatformAdminCount: 1,
      emergencyAllowlistAdminCount: 1,
      qaUserCount: 1,
      subscribedUserCount: 1,
    });
  });

  it('builds SaaS health chart datasets from users, offers, admins, and audit records', () => {
    const users: WebPlatformAdminUser[] = [
      baseUser,
      {
        ...baseUser,
        uid: 'user_2',
        email: 'viewer@example.com',
        emailVerified: false,
        providerIds: ['password'],
        createdAt: '2026-04-15T12:00:00.000Z',
        ownedWorkspaceCount: 0,
        officeWorkspaceCount: 1,
        workspaceNames: [],
        officeRoles: ['viewer'],
      },
      {
        ...baseUser,
        uid: 'user_3',
        email: 'disabled@example.com',
        disabled: true,
        createdAt: '2026-03-01T12:00:00.000Z',
        ownedWorkspaceCount: 0,
        officeWorkspaceCount: 0,
        workspaceNames: [],
        status: 'disabled',
      },
      {
        ...baseUser,
        uid: 'user_4',
        email: 'new@example.com',
        createdAt: '2026-05-01T12:00:00.000Z',
        ownedWorkspaceCount: 0,
        officeWorkspaceCount: 0,
        workspaceNames: [],
        platformAdminRole: 'super_admin',
        platformAdminStatus: 'active',
        platformAdminRoleSource: 'allowlist',
        status: 'no_workspace',
      },
    ];
    const offers: WebPlatformAdminOffer[] = [
      {
        id: 'offer_1',
        label: 'Launch Offer',
        title: 'Launch pricing',
        publicBannerMessage: 'Launch pricing is available.',
        internalNote: null,
        scope: 'sitewide',
        discountType: 'percentage',
        discountValue: 20,
        currency: null,
        targetEmails: [],
        targetUids: [],
        targetWorkspaceIds: [],
        targetPlanIds: [],
        targetCountries: [],
        startAt: null,
        expiresAt: null,
        status: 'active',
        lifetimeConfirmed: false,
        createdAt: null,
        createdByUid: null,
        createdByEmail: null,
        updatedAt: null,
        updatedByUid: null,
        updatedByEmail: null,
        lastReason: null,
      },
      {
        id: 'offer_2',
        label: 'Future Offer',
        title: 'Future pricing',
        publicBannerMessage: 'Future pricing is scheduled.',
        internalNote: null,
        scope: 'selected_users',
        discountType: 'amount',
        discountValue: 5000,
        currency: 'INR',
        targetEmails: ['owner@example.com'],
        targetUids: [],
        targetWorkspaceIds: [],
        targetPlanIds: [],
        targetCountries: [],
        startAt: null,
        expiresAt: null,
        status: 'scheduled',
        lifetimeConfirmed: false,
        createdAt: null,
        createdByUid: null,
        createdByEmail: null,
        updatedAt: null,
        updatedByUid: null,
        updatedByEmail: null,
        lastReason: null,
      },
    ];
    const auditRecords: WebPlatformAdminAuditRecord[] = [
      {
        id: 'audit_1',
        action: 'platform_admin_offer_create',
        actorUid: 'admin_1',
        actorEmail: 'admin@example.com',
        actorRole: 'super_admin',
        targetUid: null,
        targetEmail: null,
        targetRole: null,
        targetStatus: null,
        workspaceId: null,
        supportCaseId: null,
        severity: 'high',
        reason: 'Launch offer created',
        timestamp: '2026-05-21T12:00:00.000Z',
        affectedSummary: 'Offer created',
      },
      {
        id: 'audit_2',
        action: 'registry_snapshot_generated',
        actorUid: 'admin_1',
        actorEmail: 'admin@example.com',
        actorRole: 'super_admin',
        targetUid: null,
        targetEmail: null,
        targetRole: null,
        targetStatus: null,
        workspaceId: null,
        supportCaseId: null,
        severity: 'low',
        reason: null,
        timestamp: '2026-05-21T12:05:00.000Z',
        affectedSummary: 'Snapshot generated',
      },
    ];
    const snapshot: WebPlatformAdminSnapshot = {
      generatedAt: '2026-05-21T12:00:00.000Z',
      nextPageToken: null,
      hasMore: false,
      adminAccess: null,
      metrics: buildWebPlatformAdminMetrics(users),
      admins: [
        {
          uid: 'admin_1',
          email: 'admin@example.com',
          displayName: 'Admin User',
          role: 'super_admin',
          status: 'active',
          roleSource: 'allowlist',
          customClaimsReady: false,
          customClaimsPlatformAdmin: false,
          customClaimsRole: null,
          createdByUid: null,
          createdByEmail: null,
          createdAt: null,
          updatedByUid: null,
          updatedByEmail: null,
          updatedAt: null,
          suspendedByUid: null,
          suspendedByEmail: null,
          suspendedAt: null,
          revokedByUid: null,
          revokedByEmail: null,
          revokedAt: null,
          reason: null,
          isEmergencyAllowlist: true,
          lastSignInAt: null,
        },
      ],
      offers,
      users,
    };

    const charts = buildWebPlatformAdminSaasHealthCharts(snapshot, auditRecords);

    expect(charts.newUsersTrend).toHaveLength(6);
    expect(charts.newUsersTrend.at(-1)).toEqual({ label: 'May', value: 2 });
    expect(charts.userStatusMix).toEqual([
      { label: 'Active', value: 2 },
      { label: 'No workspace', value: 1 },
      { label: 'Disabled', value: 1 },
    ]);
    expect(charts.workspaceAdoption).toEqual([
      { label: 'Workspace owners', value: 1 },
      { label: 'Office members', value: 1 },
      { label: 'No workspace', value: 1 },
    ]);
    expect(charts.offerStatusMix.slice(0, 2)).toEqual([
      { label: 'active', value: 1 },
      { label: 'scheduled', value: 1 },
    ]);
    expect(charts.auditSeverityMix).toEqual([
      { label: 'high', value: 1 },
      { label: 'medium', value: 0 },
      { label: 'low', value: 1 },
    ]);
    expect(charts.adminRoleMix.at(0)).toEqual({ label: 'super admin', value: 1 });
  });

  it('builds export-ready Platform Admin reports and CSV output', () => {
    const offer: WebPlatformAdminOffer = {
      id: 'offer_1',
      label: 'Launch Offer',
      title: 'Launch pricing',
      publicBannerMessage: 'Launch pricing is available.',
      internalNote: null,
      scope: 'sitewide',
      discountType: 'percentage',
      discountValue: 20,
      currency: 'INR',
      targetEmails: [],
      targetUids: [],
      targetWorkspaceIds: [],
      targetPlanIds: ['pro_yearly'],
      targetCountries: ['IN'],
      startAt: null,
      expiresAt: '2026-06-21T00:00:00.000Z',
      status: 'active',
      lifetimeConfirmed: false,
      createdAt: null,
      createdByUid: null,
      createdByEmail: null,
      updatedAt: null,
      updatedByUid: null,
      updatedByEmail: null,
      lastReason: 'Launch conversion review',
    };
    const auditRecords: WebPlatformAdminAuditRecord[] = [
      {
        id: 'audit_support_1',
        action: 'support_case_note',
        actorUid: 'admin_1',
        actorEmail: 'admin@example.com',
        actorRole: 'support_admin',
        targetUid: 'user_1',
        targetEmail: 'owner@example.com',
        targetRole: null,
        targetStatus: null,
        workspaceId: 'workspace_1',
        supportCaseId: 'case_1',
        severity: 'medium',
        reason: 'Support consent review',
        timestamp: '2026-05-21T12:00:00.000Z',
        affectedSummary: 'Support case case_1',
      },
    ];
    const snapshot: WebPlatformAdminSnapshot = {
      generatedAt: '2026-05-21T12:00:00.000Z',
      nextPageToken: null,
      hasMore: false,
      adminAccess: null,
      metrics: buildWebPlatformAdminMetrics([baseUser]),
      admins: [
        {
          uid: 'admin_1',
          email: 'admin@example.com',
          displayName: 'Admin User',
          role: 'support_admin',
          status: 'active',
          roleSource: 'registry',
          customClaimsReady: true,
          customClaimsPlatformAdmin: true,
          customClaimsRole: 'support_admin',
          createdByUid: 'root',
          createdByEmail: 'root@example.com',
          createdAt: '2026-05-20T12:00:00.000Z',
          updatedByUid: 'root',
          updatedByEmail: 'root@example.com',
          updatedAt: '2026-05-21T12:00:00.000Z',
          suspendedByUid: null,
          suspendedByEmail: null,
          suspendedAt: null,
          revokedByUid: null,
          revokedByEmail: null,
          revokedAt: null,
          reason: 'Support operations',
          isEmergencyAllowlist: false,
          lastSignInAt: '2026-05-21T12:00:00.000Z',
        },
      ],
      offers: [offer],
      users: [baseUser],
    };

    const reportTypes = WEB_PLATFORM_ADMIN_REPORT_DEFINITIONS.map((definition) => definition.type);
    const reports = reportTypes.map((type) =>
      buildWebPlatformAdminReport({
        type,
        snapshot,
        auditRecords,
        generatedBy: 'admin@example.com',
        adminRole: 'Support Admin',
        loadedFilterSummary: ['Audit severity: medium'],
      })
    );

    expect(reports.map((report) => report.title)).toEqual([
      'User Registry Report',
      'Admin Access Report',
      'Billing And Offer Report',
      'Audit Trail Report',
      'Office Access Report',
      'Support Case Report',
    ]);
    expect(reports.find((report) => report.type === 'billing_offers')?.rows[0]).toMatchObject({
      label: 'Launch Offer',
      targets: 'All eligible users',
    });
    expect(reports.find((report) => report.type === 'user_registry')?.rows[0]).toMatchObject({
      platformRole: 'No platform role',
      officeRoles: 'No Office role',
    });
    expect(reports.find((report) => report.type === 'support_cases')?.rows[0]).toMatchObject({
      case: 'case_1',
      reason: 'Support consent review',
    });

    const csv = buildWebPlatformAdminReportCsv(reports[0]);
    expect(csv).toContain('"User Registry Report"');
    expect(csv).toContain('"Generated by admin@example.com"');
    expect(csv).toContain('"Admin role Support Admin"');
    expect(csv).toContain('"Owner User"');
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
    expect(
      filterWebPlatformAdminUsers(
        [
          {
            ...baseUser,
            platformUserRiskStatus: 'under_review',
            platformUserLastAdminReason: 'Repeated failed billing recovery',
            platformUserWarningCount: 2,
          },
        ],
        'billing recovery'
      )
    ).toHaveLength(1);
    expect(filterWebPlatformAdminUsers(users, 'missing')).toHaveLength(0);
  });

  it('filters users by platform role, office access, and provider type', () => {
    const users = [
      {
        ...baseUser,
        uid: 'super-admin',
        email: 'super-admin@example.com',
        platformAdminRole: 'super_admin' as const,
        platformAdminStatus: 'active' as const,
        platformAdminRoleSource: 'registry' as const,
      },
      {
        ...baseUser,
        uid: 'support-admin',
        email: 'support-admin@example.com',
        platformAdminRole: 'support_admin' as const,
        platformAdminStatus: 'active' as const,
        platformAdminRoleSource: 'custom_claim' as const,
        officeWorkspaceCount: 1,
        officeRoles: ['support_reviewer'],
        providerIds: ['password'],
      },
      {
        ...baseUser,
        uid: 'standard-user',
        email: 'user@example.com',
        platformAdminRole: null,
        platformAdminStatus: null,
        platformAdminRoleSource: null,
        officeWorkspaceCount: 0,
        officeRoles: [],
        providerIds: [],
      },
    ];

    expect(
      filterWebPlatformAdminUsersWithFilters(users, '', {
        role: 'support_admin',
        officeAccess: 'all',
        provider: 'all',
      })
    ).toHaveLength(1);
    expect(
      filterWebPlatformAdminUsersWithFilters(users, '', {
        role: 'all',
        officeAccess: 'has_office_access',
        provider: 'all',
      })
    ).toHaveLength(1);
    expect(
      filterWebPlatformAdminUsersWithFilters(users, '', {
        role: 'all',
        officeAccess: 'all',
        provider: 'password',
      })
    ).toHaveLength(1);
    expect(
      filterWebPlatformAdminUsersWithFilters(users, '', {
        role: 'no_platform_role',
        officeAccess: 'no_office_access',
        provider: 'no_provider',
      })
    ).toHaveLength(1);
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

  it('filters platform offers by label, scope, targets, plan, country, and reason', () => {
    const offers = [
      {
        id: 'offer_1',
        label: 'Launch Offer',
        title: 'Launch pricing',
        publicBannerMessage: 'Launch pricing is available.',
        internalNote: 'First cohort',
        scope: 'sitewide' as const,
        discountType: 'percentage' as const,
        discountValue: 20,
        currency: null,
        targetEmails: [],
        targetUids: [],
        targetWorkspaceIds: [],
        targetPlanIds: ['pro_yearly'],
        targetCountries: ['IN'],
        startAt: '2026-05-21T00:00:00.000Z',
        expiresAt: '2026-06-21T00:00:00.000Z',
        status: 'active' as const,
        lifetimeConfirmed: false,
        createdAt: '2026-05-21T00:00:00.000Z',
        createdByUid: 'admin_1',
        createdByEmail: 'admin@example.com',
        updatedAt: '2026-05-21T00:00:00.000Z',
        updatedByUid: 'admin_1',
        updatedByEmail: 'admin@example.com',
        lastReason: 'Launch conversion review',
      },
      {
        id: 'offer_2',
        label: 'Selected User Offer',
        title: 'Private retention pricing',
        publicBannerMessage: 'Private pricing is available.',
        internalNote: null,
        scope: 'selected_users' as const,
        discountType: 'amount' as const,
        discountValue: 5000,
        currency: 'INR',
        targetEmails: ['owner@example.com'],
        targetUids: [],
        targetWorkspaceIds: [],
        targetPlanIds: [],
        targetCountries: [],
        startAt: null,
        expiresAt: null,
        status: 'active' as const,
        lifetimeConfirmed: true,
        createdAt: null,
        createdByUid: null,
        createdByEmail: null,
        updatedAt: null,
        updatedByUid: null,
        updatedByEmail: null,
        lastReason: 'Founder approved retention price',
      },
    ];

    expect(filterWebPlatformAdminOffers(offers, 'launch')).toHaveLength(1);
    expect(filterWebPlatformAdminOffers(offers, 'selected_users')).toHaveLength(1);
    expect(filterWebPlatformAdminOffers(offers, 'owner@example.com')).toHaveLength(1);
    expect(filterWebPlatformAdminOffers(offers, 'pro_yearly')).toHaveLength(1);
    expect(filterWebPlatformAdminOffers(offers, 'founder approved')).toHaveLength(1);
    expect(filterWebPlatformAdminOffers(offers, 'missing')).toHaveLength(0);
  });
});
