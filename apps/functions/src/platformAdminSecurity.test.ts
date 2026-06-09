import { describe, expect, it } from 'vitest';

import {
  buildAllowlistPlatformAdminRegistryData,
  canPlatformAdminStartUserContextSession,
  canPlatformAdminUseFunction,
  canPlatformAdminUseUserAction,
} from './index';

describe('platform admin server security helpers', () => {
  const superAdminAccess = {
    uid: 'super-1',
    email: 'super@example.com',
    display_name: 'Super Admin',
    role: 'super_admin' as const,
    status: 'active' as const,
    role_source: 'allowlist' as const,
    custom_claims_ready: true,
    custom_claims_platform_admin: true,
    custom_claims_role: 'super_admin' as const,
    created_by_uid: null,
    created_by_email: null,
    created_at: '2026-05-22T00:00:00.000Z',
    updated_by_uid: 'super-1',
    updated_by_email: 'super@example.com',
    updated_at: '2026-05-22T00:00:00.000Z',
    suspended_by_uid: null,
    suspended_by_email: null,
    suspended_at: null,
    revoked_by_uid: null,
    revoked_by_email: null,
    revoked_at: null,
    reason: 'Break-glass access.',
  };

  it('keeps emergency allowlist access as active Super Admin break-glass access', () => {
    expect(
      buildAllowlistPlatformAdminRegistryData({
        uid: 'break-glass',
        email: 'admin@example.com',
        displayName: 'Break Glass',
        existing: null,
        customClaims: {},
        now: '2026-05-22T00:00:00.000Z',
      })
    ).toMatchObject({
      role: 'super_admin',
      status: 'active',
      role_source: 'allowlist',
    });
  });

  it('blocks finance admins from revoking platform admins or changing user lifecycle', () => {
    const financeAccess = {
      ...superAdminAccess,
      role: 'finance_admin' as const,
      role_source: 'registry' as const,
      custom_claims_role: 'finance_admin' as const,
    };

    expect(canPlatformAdminUseFunction(financeAccess, 'manage_admin_accounts')).toBe(false);
    expect(canPlatformAdminUseFunction(financeAccess, 'manage_offers')).toBe(true);
    expect(canPlatformAdminUseFunction(financeAccess, 'download_admin_reports')).toBe(true);
    expect(canPlatformAdminUseFunction(financeAccess, 'review_documents')).toBe(false);
    expect(canPlatformAdminUseUserAction(financeAccess, 'suspend_user')).toBe(false);
  });

  it('blocks support admins from changing pricing and read-only admins from mutating anything', () => {
    const supportAccess = {
      ...superAdminAccess,
      role: 'support_admin' as const,
      role_source: 'registry' as const,
      custom_claims_role: 'support_admin' as const,
    };
    const readOnlyAccess = {
      ...superAdminAccess,
      role: 'read_only_admin' as const,
      role_source: 'registry' as const,
      custom_claims_role: 'read_only_admin' as const,
    };

    expect(canPlatformAdminUseFunction(supportAccess, 'manage_offers')).toBe(false);
    expect(canPlatformAdminUseFunction(supportAccess, 'review_documents')).toBe(true);
    expect(canPlatformAdminUseUserAction(supportAccess, 'send_warning')).toBe(true);
    expect(canPlatformAdminUseUserAction(supportAccess, 'suspend_user')).toBe(false);
    expect(canPlatformAdminStartUserContextSession(supportAccess, 'view_as_user')).toBe(true);
    expect(canPlatformAdminStartUserContextSession(supportAccess, 'act_as_user')).toBe(false);
    expect(canPlatformAdminUseFunction(readOnlyAccess, 'manage_admin_accounts')).toBe(false);
    expect(canPlatformAdminUseFunction(readOnlyAccess, 'manage_user_controls')).toBe(false);
    expect(canPlatformAdminUseFunction(readOnlyAccess, 'manage_user_context_sessions')).toBe(false);
    expect(canPlatformAdminUseFunction(readOnlyAccess, 'manage_offers')).toBe(false);
    expect(canPlatformAdminUseFunction(readOnlyAccess, 'review_documents')).toBe(true);
    expect(canPlatformAdminUseFunction(readOnlyAccess, 'download_admin_reports')).toBe(true);
  });

  it('removes effective access for revoked registry admins', () => {
    const revokedAccess = {
      ...superAdminAccess,
      role: 'admin' as const,
      status: 'revoked' as const,
      role_source: 'registry' as const,
      custom_claims_role: 'admin' as const,
    };

    expect(canPlatformAdminUseFunction(revokedAccess, 'view_registry')).toBe(false);
    expect(canPlatformAdminUseFunction(revokedAccess, 'download_admin_reports')).toBe(false);
  });
});
