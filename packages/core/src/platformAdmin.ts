export const PLATFORM_ADMIN_ROLES = [
  'super_admin',
  'admin',
  'finance_admin',
  'support_admin',
  'read_only_admin',
] as const;

export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const PLATFORM_ADMIN_STATUSES = ['active', 'suspended', 'revoked'] as const;

export type PlatformAdminStatus = (typeof PLATFORM_ADMIN_STATUSES)[number];

export const PLATFORM_ADMIN_ROLE_SOURCES = ['allowlist', 'registry', 'custom_claim'] as const;

export type PlatformAdminRoleSource = (typeof PLATFORM_ADMIN_ROLE_SOURCES)[number];

export const PLATFORM_ADMIN_PERMISSIONS = [
  'view_platform_dashboard',
  'view_user_registry',
  'manage_user_status',
  'send_user_warning',
  'manage_admin_accounts',
  'revoke_admin_accounts',
  'manage_billing_offers',
  'view_billing_reports',
  'review_support_cases',
  'review_diagnostics',
  'review_documents',
  'view_audit_trail',
  'download_admin_reports',
] as const;

export type PlatformAdminPermission = (typeof PLATFORM_ADMIN_PERMISSIONS)[number];

export type PlatformAdminRoleDefinition = {
  role: PlatformAdminRole;
  label: string;
  description: string;
  canGrantRoles: PlatformAdminRole[];
};

export type PlatformAdminRegistryRecord = {
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
};

export const PLATFORM_ADMIN_ROLE_DEFINITIONS: Record<PlatformAdminRole, PlatformAdminRoleDefinition> = {
  super_admin: {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Full platform control, including admin roles, user lifecycle, offers, reports, and audit.',
    canGrantRoles: ['super_admin', 'admin', 'finance_admin', 'support_admin', 'read_only_admin'],
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    description: 'User operations, warnings, workspace review, and non-financial reports.',
    canGrantRoles: ['support_admin', 'read_only_admin'],
  },
  finance_admin: {
    role: 'finance_admin',
    label: 'Finance Admin',
    description: 'Billing reports, offer review, pricing overrides, and purchase recovery support.',
    canGrantRoles: ['read_only_admin'],
  },
  support_admin: {
    role: 'support_admin',
    label: 'Support Admin',
    description: 'Support cases and diagnostic review with consent boundaries.',
    canGrantRoles: ['read_only_admin'],
  },
  read_only_admin: {
    role: 'read_only_admin',
    label: 'Read-only Admin',
    description: 'Read-only dashboards, reports, and audit views.',
    canGrantRoles: [],
  },
};

const PLATFORM_ADMIN_PERMISSION_MATRIX: Record<PlatformAdminRole, readonly PlatformAdminPermission[]> = {
  super_admin: PLATFORM_ADMIN_PERMISSIONS,
  admin: [
    'view_platform_dashboard',
    'view_user_registry',
    'manage_user_status',
    'send_user_warning',
    'review_support_cases',
    'review_diagnostics',
    'review_documents',
    'view_audit_trail',
    'download_admin_reports',
  ],
  finance_admin: [
    'view_platform_dashboard',
    'view_user_registry',
    'manage_billing_offers',
    'view_billing_reports',
    'view_audit_trail',
    'download_admin_reports',
  ],
  support_admin: [
    'view_platform_dashboard',
    'view_user_registry',
    'send_user_warning',
    'review_support_cases',
    'review_diagnostics',
    'review_documents',
    'view_audit_trail',
  ],
  read_only_admin: [
    'view_platform_dashboard',
    'view_user_registry',
    'view_billing_reports',
    'review_documents',
    'view_audit_trail',
    'download_admin_reports',
  ],
};

export function isPlatformAdminRole(value: unknown): value is PlatformAdminRole {
  return typeof value === 'string' && PLATFORM_ADMIN_ROLES.includes(value as PlatformAdminRole);
}

export function isPlatformAdminStatus(value: unknown): value is PlatformAdminStatus {
  return typeof value === 'string' && PLATFORM_ADMIN_STATUSES.includes(value as PlatformAdminStatus);
}

export function isPlatformAdminRoleSource(value: unknown): value is PlatformAdminRoleSource {
  return typeof value === 'string' && PLATFORM_ADMIN_ROLE_SOURCES.includes(value as PlatformAdminRoleSource);
}

export function getPlatformAdminRoleDefinition(role: PlatformAdminRole): PlatformAdminRoleDefinition {
  return PLATFORM_ADMIN_ROLE_DEFINITIONS[role];
}

export function canPlatformAdminRole(role: PlatformAdminRole, permission: PlatformAdminPermission): boolean {
  return PLATFORM_ADMIN_PERMISSION_MATRIX[role].includes(permission);
}

export function canPlatformAdminGrantRole(actorRole: PlatformAdminRole, targetRole: PlatformAdminRole): boolean {
  return PLATFORM_ADMIN_ROLE_DEFINITIONS[actorRole].canGrantRoles.includes(targetRole);
}

export function isPlatformAdminRecordActive(record: Pick<PlatformAdminRegistryRecord, 'status'>): boolean {
  return record.status === 'active';
}
