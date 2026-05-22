import { describe, expect, it } from 'vitest';

import {
  canPlatformAdminGrantRole,
  canPlatformAdminRole,
  getPlatformAdminRoleDefinition,
  isPlatformAdminRecordActive,
  isPlatformAdminRole,
  isPlatformAdminRoleSource,
  isPlatformAdminStatus,
  PLATFORM_ADMIN_ROLES,
} from './platformAdmin';

describe('platform admin role model', () => {
  it('uses the approved SaaS admin roles', () => {
    expect(PLATFORM_ADMIN_ROLES).toEqual([
      'super_admin',
      'admin',
      'finance_admin',
      'support_admin',
      'read_only_admin',
    ]);
    expect(getPlatformAdminRoleDefinition('finance_admin').label).toBe('Finance Admin');
  });

  it('keeps role, status, and source validation strict', () => {
    expect(isPlatformAdminRole('super_admin')).toBe(true);
    expect(isPlatformAdminRole('owner')).toBe(false);
    expect(isPlatformAdminStatus('active')).toBe(true);
    expect(isPlatformAdminStatus('removed')).toBe(false);
    expect(isPlatformAdminRoleSource('custom_claim')).toBe(true);
    expect(isPlatformAdminRoleSource('public_ui')).toBe(false);
  });

  it('keeps Super Admin broad while limiting finance and support boundaries', () => {
    expect(canPlatformAdminRole('super_admin', 'revoke_admin_accounts')).toBe(true);
    expect(canPlatformAdminRole('finance_admin', 'manage_billing_offers')).toBe(true);
    expect(canPlatformAdminRole('finance_admin', 'revoke_admin_accounts')).toBe(false);
    expect(canPlatformAdminRole('finance_admin', 'download_admin_reports')).toBe(true);
    expect(canPlatformAdminRole('support_admin', 'review_support_cases')).toBe(true);
    expect(canPlatformAdminRole('support_admin', 'manage_billing_offers')).toBe(false);
    expect(canPlatformAdminRole('support_admin', 'download_admin_reports')).toBe(false);
    expect(canPlatformAdminRole('read_only_admin', 'manage_user_status')).toBe(false);
    expect(canPlatformAdminRole('read_only_admin', 'download_admin_reports')).toBe(true);
  });

  it('allows only Super Admin to grant the highest roles', () => {
    expect(canPlatformAdminGrantRole('super_admin', 'super_admin')).toBe(true);
    expect(canPlatformAdminGrantRole('admin', 'support_admin')).toBe(true);
    expect(canPlatformAdminGrantRole('admin', 'finance_admin')).toBe(false);
    expect(canPlatformAdminGrantRole('finance_admin', 'support_admin')).toBe(false);
  });

  it('treats only active registry records as active', () => {
    expect(isPlatformAdminRecordActive({ status: 'active' })).toBe(true);
    expect(isPlatformAdminRecordActive({ status: 'suspended' })).toBe(false);
    expect(isPlatformAdminRecordActive({ status: 'revoked' })).toBe(false);
  });
});
