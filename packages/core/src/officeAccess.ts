export const OFFICE_WORKSPACE_ROLES = [
  'owner',
  'admin',
  'manager',
  'staff',
  'accountant',
  'viewer',
] as const;

export type OfficeWorkspaceRole = (typeof OFFICE_WORKSPACE_ROLES)[number];

export const ORBIT_LEDGER_INTERNAL_ADMIN_ROLES = [
  'internal_owner',
  'internal_billing_admin',
  'internal_support_reviewer',
  'internal_security_reviewer',
] as const;

export type OrbitLedgerInternalAdminRole = (typeof ORBIT_LEDGER_INTERNAL_ADMIN_ROLES)[number];

export type OfficePermissionRisk = 'low' | 'medium' | 'high' | 'critical';

export type OfficePermissionCategory =
  | 'workspace'
  | 'customers'
  | 'invoices'
  | 'payments'
  | 'transactions'
  | 'inventory'
  | 'documents'
  | 'reports'
  | 'automation'
  | 'settings'
  | 'backup'
  | 'team'
  | 'billing'
  | 'support';

export const OFFICE_PERMISSIONS = [
  'view_workspace_dashboard',
  'view_business_health',
  'view_customers',
  'manage_customers',
  'archive_customers',
  'view_invoices',
  'create_invoices',
  'edit_latest_invoice',
  'cancel_or_archive_invoices',
  'view_invoice_versions',
  'restore_invoice_versions',
  'view_payments',
  'record_payments',
  'verify_payments',
  'reverse_payments',
  'manage_payment_allocations',
  'view_transactions',
  'record_transactions',
  'manage_products_inventory',
  'view_documents',
  'export_documents',
  'bulk_export_documents',
  'view_reports',
  'export_reports',
  'view_tax_reports',
  'manage_recurring_rules',
  'approve_auto_email',
  'manage_company_profile',
  'manage_invoice_settings',
  'manage_tax_settings',
  'manage_payment_settings',
  'manage_security_settings',
  'view_backup_status',
  'export_backup',
  'restore_backup',
  'view_audit_log',
  'invite_team_members',
  'change_member_roles',
  'remove_team_members',
  'manage_billing_entitlement',
  'request_priority_support',
  'transfer_workspace_ownership',
] as const;

export type OfficePermission = (typeof OFFICE_PERMISSIONS)[number];

export type OfficePermissionDefinition = {
  id: OfficePermission;
  category: OfficePermissionCategory;
  label: string;
  description: string;
  risk: OfficePermissionRisk;
};

export type OfficeRoleDefinition = {
  role: OfficeWorkspaceRole;
  label: string;
  shortDescription: string;
  launchGuidance: string;
};

export type OfficePermissionMatrix = Record<OfficeWorkspaceRole, readonly OfficePermission[]>;

export type OfficeAccessValidation = {
  valid: boolean;
  missingMatrixEntries: OfficeWorkspaceRole[];
  ownerMissingPermissions: OfficePermission[];
  permissionsWithoutAnyRole: OfficePermission[];
  privilegeWarnings: string[];
};

export type OrbitLedgerInternalAdminPermission =
  | 'review_office_invitation_requests'
  | 'manage_invited_office_access'
  | 'review_billing_events'
  | 'resolve_purchase_issues'
  | 'review_diagnostics_with_customer_consent'
  | 'review_security_events';

export const OFFICE_ROLE_DEFINITIONS: Record<OfficeWorkspaceRole, OfficeRoleDefinition> = {
  owner: {
    role: 'owner',
    label: 'Owner',
    shortDescription: 'Full workspace control, including billing, team access, backups, and ownership transfer.',
    launchGuidance: 'Use only for the person legally responsible for the company workspace.',
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    shortDescription: 'Runs the office workspace and team operations, without ownership transfer rights.',
    launchGuidance: 'Good for a trusted office lead. Keep bank, tax, and security changes audited.',
  },
  manager: {
    role: 'manager',
    label: 'Manager',
    shortDescription: 'Handles daily customers, invoices, payments, inventory, reports, and recurring work.',
    launchGuidance: 'Good for someone responsible for daily business operations.',
  },
  staff: {
    role: 'staff',
    label: 'Staff',
    shortDescription: 'Creates routine records and payments, with limited correction and export access.',
    launchGuidance: 'Good for front-office entry work where sensitive settings should stay locked.',
  },
  accountant: {
    role: 'accountant',
    label: 'Accountant',
    shortDescription: 'Reviews reports, exports, tax surfaces, documents, and audit history without daily editing rights.',
    launchGuidance: 'Good for outside accountants or internal finance reviewers.',
  },
  viewer: {
    role: 'viewer',
    label: 'Viewer',
    shortDescription: 'Read-only access to approved workspace views.',
    launchGuidance: 'Good for review-only access. Keep exports off unless a higher role is assigned.',
  },
};

export const OFFICE_PERMISSION_DEFINITIONS: readonly OfficePermissionDefinition[] = [
  permission('view_workspace_dashboard', 'workspace', 'View workspace', 'See dashboard cards and workspace summaries.', 'low'),
  permission('view_business_health', 'workspace', 'View business health', 'See business health, action center, and follow-up signals.', 'low'),
  permission('view_customers', 'customers', 'View customers', 'See customer records and customer detail screens.', 'low'),
  permission('manage_customers', 'customers', 'Manage customers', 'Create and update customer profiles.', 'medium'),
  permission('archive_customers', 'customers', 'Archive customers', 'Mark customers inactive or hide them from active lists.', 'high'),
  permission('view_invoices', 'invoices', 'View invoices', 'See invoices, invoice detail, and invoice previews.', 'low'),
  permission('create_invoices', 'invoices', 'Create invoices', 'Create draft and saved invoices.', 'medium'),
  permission('edit_latest_invoice', 'invoices', 'Edit latest invoice', 'Edit only the latest invoice version and create revisions when needed.', 'high'),
  permission('cancel_or_archive_invoices', 'invoices', 'Cancel or archive invoices', 'Cancel, archive, or hide saved invoices from active lists.', 'critical'),
  permission('view_invoice_versions', 'invoices', 'View invoice versions', 'See version history and frozen invoice snapshots.', 'low'),
  permission('restore_invoice_versions', 'invoices', 'Restore invoice versions', 'Create a new revision from a previous invoice version.', 'high'),
  permission('view_payments', 'payments', 'View payments', 'See payments, allocations, clearance state, and payment proof.', 'low'),
  permission('record_payments', 'payments', 'Record payments', 'Record customer payments and attach proof.', 'high'),
  permission('verify_payments', 'payments', 'Verify payments', 'Mark payment review, clearance, and verification states.', 'high'),
  permission('reverse_payments', 'payments', 'Reverse payments', 'Reverse or correct payment records and update balances.', 'critical'),
  permission('manage_payment_allocations', 'payments', 'Manage payment allocation', 'Move or split payments across invoices and ledger entries.', 'critical'),
  permission('view_transactions', 'transactions', 'View transactions', 'See ledger entries and customer activity.', 'low'),
  permission('record_transactions', 'transactions', 'Record transactions', 'Create credit, payment, adjustment, or opening balance entries.', 'high'),
  permission('manage_products_inventory', 'inventory', 'Manage products and inventory', 'Create products, update stock, and review inventory value.', 'medium'),
  permission('view_documents', 'documents', 'View documents', 'See document pack, statement, invoice, and export screens.', 'low'),
  permission('export_documents', 'documents', 'Export documents', 'Download PDFs and CSV files for customer and invoice records.', 'medium'),
  permission('bulk_export_documents', 'documents', 'Bulk export documents', 'Run batch exports and statement packs.', 'high'),
  permission('view_reports', 'reports', 'View reports', 'See reports and business review surfaces.', 'low'),
  permission('export_reports', 'reports', 'Export reports', 'Export reports and review packs.', 'high'),
  permission('view_tax_reports', 'reports', 'View tax and audit reports', 'See country tax surfaces and audit-ready report packs.', 'high'),
  permission('manage_recurring_rules', 'automation', 'Manage recurring rules', 'Create and update recurring invoice and auto email rules.', 'high'),
  permission('approve_auto_email', 'automation', 'Approve auto email', 'Approve automatic invoice email rules after meaningful changes.', 'critical'),
  permission('manage_company_profile', 'settings', 'Manage company profile', 'Update legal, contact, address, and business profile details.', 'high'),
  permission('manage_invoice_settings', 'settings', 'Manage invoice settings', 'Update invoice defaults, template defaults, numbering, and document settings.', 'high'),
  permission('manage_tax_settings', 'settings', 'Manage tax settings', 'Update tax IDs, tax labels, place of supply, and tax defaults.', 'critical'),
  permission('manage_payment_settings', 'settings', 'Manage payment settings', 'Update bank, UPI, payment instructions, and payment provider settings.', 'critical'),
  permission('manage_security_settings', 'settings', 'Manage security settings', 'Update lock, privacy, access, and sensitive workspace security settings.', 'critical'),
  permission('view_backup_status', 'backup', 'View backup status', 'See backup health, restore readiness, and data protection state.', 'low'),
  permission('export_backup', 'backup', 'Export backup', 'Create or download workspace backup packs.', 'critical'),
  permission('restore_backup', 'backup', 'Restore backup', 'Restore workspace data from a backup.', 'critical'),
  permission('view_audit_log', 'team', 'View audit log', 'See important workspace, money, access, and settings changes.', 'high'),
  permission('invite_team_members', 'team', 'Invite team members', 'Invite people into the Office workspace.', 'critical'),
  permission('change_member_roles', 'team', 'Change member roles', 'Change a member role without ownership transfer.', 'critical'),
  permission('remove_team_members', 'team', 'Remove team members', 'Remove non-owner members from the workspace.', 'critical'),
  permission('manage_billing_entitlement', 'billing', 'Manage billing access', 'Review Office entitlement, plan state, and purchase recovery actions.', 'critical'),
  permission('request_priority_support', 'support', 'Request priority support', 'Send priority support requests and safe diagnostic summaries.', 'medium'),
  permission('transfer_workspace_ownership', 'team', 'Transfer ownership', 'Transfer legal control of the workspace to another member.', 'critical'),
] as const;

export const OFFICE_PERMISSION_MATRIX: OfficePermissionMatrix = {
  owner: OFFICE_PERMISSIONS,
  admin: [
    'view_workspace_dashboard',
    'view_business_health',
    'view_customers',
    'manage_customers',
    'archive_customers',
    'view_invoices',
    'create_invoices',
    'edit_latest_invoice',
    'cancel_or_archive_invoices',
    'view_invoice_versions',
    'restore_invoice_versions',
    'view_payments',
    'record_payments',
    'verify_payments',
    'reverse_payments',
    'manage_payment_allocations',
    'view_transactions',
    'record_transactions',
    'manage_products_inventory',
    'view_documents',
    'export_documents',
    'bulk_export_documents',
    'view_reports',
    'export_reports',
    'view_tax_reports',
    'manage_recurring_rules',
    'approve_auto_email',
    'manage_company_profile',
    'manage_invoice_settings',
    'manage_tax_settings',
    'manage_payment_settings',
    'manage_security_settings',
    'view_backup_status',
    'export_backup',
    'restore_backup',
    'view_audit_log',
    'invite_team_members',
    'change_member_roles',
    'remove_team_members',
    'manage_billing_entitlement',
    'request_priority_support',
  ],
  manager: [
    'view_workspace_dashboard',
    'view_business_health',
    'view_customers',
    'manage_customers',
    'view_invoices',
    'create_invoices',
    'edit_latest_invoice',
    'view_invoice_versions',
    'view_payments',
    'record_payments',
    'verify_payments',
    'manage_payment_allocations',
    'view_transactions',
    'record_transactions',
    'manage_products_inventory',
    'view_documents',
    'export_documents',
    'view_reports',
    'export_reports',
    'manage_recurring_rules',
    'view_backup_status',
    'request_priority_support',
  ],
  staff: [
    'view_workspace_dashboard',
    'view_customers',
    'manage_customers',
    'view_invoices',
    'create_invoices',
    'view_invoice_versions',
    'view_payments',
    'record_payments',
    'view_transactions',
    'record_transactions',
    'manage_products_inventory',
    'view_documents',
    'view_reports',
  ],
  accountant: [
    'view_workspace_dashboard',
    'view_business_health',
    'view_customers',
    'view_invoices',
    'view_invoice_versions',
    'view_payments',
    'view_transactions',
    'view_documents',
    'export_documents',
    'bulk_export_documents',
    'view_reports',
    'export_reports',
    'view_tax_reports',
    'view_backup_status',
    'view_audit_log',
    'request_priority_support',
  ],
  viewer: [
    'view_workspace_dashboard',
    'view_business_health',
    'view_customers',
    'view_invoices',
    'view_invoice_versions',
    'view_payments',
    'view_transactions',
    'view_documents',
    'view_reports',
    'view_backup_status',
  ],
};

export const ORBIT_LEDGER_INTERNAL_ADMIN_PERMISSION_MATRIX: Record<
  OrbitLedgerInternalAdminRole,
  readonly OrbitLedgerInternalAdminPermission[]
> = {
  internal_owner: [
    'review_office_invitation_requests',
    'manage_invited_office_access',
    'review_billing_events',
    'resolve_purchase_issues',
    'review_diagnostics_with_customer_consent',
    'review_security_events',
  ],
  internal_billing_admin: [
    'review_office_invitation_requests',
    'manage_invited_office_access',
    'review_billing_events',
    'resolve_purchase_issues',
  ],
  internal_support_reviewer: [
    'review_office_invitation_requests',
    'review_diagnostics_with_customer_consent',
  ],
  internal_security_reviewer: [
    'review_diagnostics_with_customer_consent',
    'review_security_events',
  ],
};

const officeRoleRank: Record<OfficeWorkspaceRole, number> = {
  owner: 60,
  admin: 50,
  manager: 40,
  accountant: 30,
  staff: 20,
  viewer: 10,
};

const permissionDefinitionById = new Map(
  OFFICE_PERMISSION_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function isOfficeWorkspaceRole(role: string): role is OfficeWorkspaceRole {
  return OFFICE_WORKSPACE_ROLES.includes(role as OfficeWorkspaceRole);
}

export function isOrbitLedgerInternalAdminRole(role: string): role is OrbitLedgerInternalAdminRole {
  return ORBIT_LEDGER_INTERNAL_ADMIN_ROLES.includes(role as OrbitLedgerInternalAdminRole);
}

export function getOfficeRoleDefinition(role: OfficeWorkspaceRole): OfficeRoleDefinition {
  return OFFICE_ROLE_DEFINITIONS[role];
}

export function getOfficePermissionDefinition(permission: OfficePermission): OfficePermissionDefinition {
  const definition = permissionDefinitionById.get(permission);
  if (!definition) {
    throw new Error(`Unknown Office permission: ${permission}`);
  }

  return definition;
}

export function getOfficeRolePermissions(role: OfficeWorkspaceRole): readonly OfficePermission[] {
  return OFFICE_PERMISSION_MATRIX[role];
}

export function canOfficeRole(
  role: OfficeWorkspaceRole,
  permission: OfficePermission
): boolean {
  return OFFICE_PERMISSION_MATRIX[role].includes(permission);
}

export function canInternalAdminRole(
  role: OrbitLedgerInternalAdminRole,
  permission: OrbitLedgerInternalAdminPermission
): boolean {
  return ORBIT_LEDGER_INTERNAL_ADMIN_PERMISSION_MATRIX[role].includes(permission);
}

export function canAssignOfficeRole(
  actorRole: OfficeWorkspaceRole,
  targetRole: OfficeWorkspaceRole
): boolean {
  if (targetRole === 'owner') {
    return false;
  }

  if (actorRole === 'owner') {
    return true;
  }

  if (actorRole === 'admin') {
    return ['manager', 'staff', 'accountant', 'viewer'].includes(targetRole);
  }

  return false;
}

export function canRemoveOfficeMember(
  actorRole: OfficeWorkspaceRole,
  targetRole: OfficeWorkspaceRole
): boolean {
  if (targetRole === 'owner') {
    return false;
  }

  if (actorRole === 'owner') {
    return true;
  }

  if (actorRole === 'admin') {
    return officeRoleRank[targetRole] < officeRoleRank.admin;
  }

  return false;
}

export function canTransferOfficeOwnership(actorRole: OfficeWorkspaceRole): boolean {
  return canOfficeRole(actorRole, 'transfer_workspace_ownership');
}

export function validateOfficePermissionMatrix(): OfficeAccessValidation {
  const missingMatrixEntries = OFFICE_WORKSPACE_ROLES.filter((role) => !OFFICE_PERMISSION_MATRIX[role]);
  const ownerPermissions = new Set(OFFICE_PERMISSION_MATRIX.owner);
  const ownerMissingPermissions = OFFICE_PERMISSIONS.filter((permission) => !ownerPermissions.has(permission));
  const permissionsWithoutAnyRole = OFFICE_PERMISSIONS.filter(
    (permission) => !OFFICE_WORKSPACE_ROLES.some((role) => canOfficeRole(role, permission))
  );
  const privilegeWarnings: string[] = [];

  if (canOfficeRole('admin', 'transfer_workspace_ownership')) {
    privilegeWarnings.push('Admin must not be able to transfer workspace ownership.');
  }

  if (canAssignOfficeRole('admin', 'admin')) {
    privilegeWarnings.push('Admin must not be able to create another admin without owner approval.');
  }

  if (canRemoveOfficeMember('admin', 'owner')) {
    privilegeWarnings.push('Admin must not be able to remove the owner.');
  }

  return {
    valid:
      missingMatrixEntries.length === 0 &&
      ownerMissingPermissions.length === 0 &&
      permissionsWithoutAnyRole.length === 0 &&
      privilegeWarnings.length === 0,
    missingMatrixEntries,
    ownerMissingPermissions,
    permissionsWithoutAnyRole,
    privilegeWarnings,
  };
}

function permission(
  id: OfficePermission,
  category: OfficePermissionCategory,
  label: string,
  description: string,
  risk: OfficePermissionRisk
): OfficePermissionDefinition {
  return {
    id,
    category,
    label,
    description,
    risk,
  };
}
