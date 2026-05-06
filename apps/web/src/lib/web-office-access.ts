import {
  OFFICE_WORKSPACE_ROLES,
  canOfficeMemberAccessWorkspace,
  canOfficeMemberUsePermission,
  canOfficeRole,
  getOfficePermissionDefinition,
  getOfficeRoleDefinition,
  type OfficeMembershipRecord,
  type OfficePermission,
  type OfficeWorkspaceRole,
} from '@orbit-ledger/core';

export type WebOfficeAccessSource = 'member' | 'owner_fallback' | 'inactive_member' | 'unavailable';

export type WebOfficeAccessState = {
  role: OfficeWorkspaceRole | null;
  roleLabel: string;
  member: OfficeMembershipRecord | null;
  source: WebOfficeAccessSource;
  canAccessWorkspace: boolean;
  message: string;
};

export type WebOfficeRouteAccess = {
  allowed: boolean;
  permission: OfficePermission | null;
  title: string;
  message: string;
};

type RoutePermissionRule = {
  prefix: string;
  permission: OfficePermission | null;
  title: string;
  message: string;
};

export type WebOfficeSensitiveActionId = (typeof WEB_OFFICE_SENSITIVE_ACTIONS)[number]['id'];

export type WebOfficeSensitiveActionCheck = {
  id: string;
  label: string;
  area: string;
  permission: OfficePermission;
};

export type WebOfficeRouteCheck = {
  pathname: string;
  permission: OfficePermission | null;
};

export type WebOfficeRoleSimulation = {
  role: OfficeWorkspaceRole | 'owner_fallback';
  source: WebOfficeAccessSource;
  routes: Array<WebOfficeRouteCheck & { allowed: boolean }>;
  actions: Array<WebOfficeSensitiveActionCheck & { allowed: boolean }>;
};

const WEB_OFFICE_ROUTE_RULES: readonly RoutePermissionRule[] = [
  routeRule('/customers/new', 'manage_customers', 'Customer access locked', 'Your role can view customers, but it cannot create new customer records.'),
  routeRule('/customers/detail', 'view_customers', 'Customer access locked', 'Your role cannot view customer details in this workspace.'),
  routeRule('/customers', 'view_customers', 'Customer access locked', 'Your role cannot view customer records in this workspace.'),
  routeRule('/invoices/automation', 'manage_recurring_rules', 'Monthly invoice automation locked', 'Your role cannot manage recurring invoice or automatic email rules.'),
  routeRule('/invoices/detail', 'view_invoices', 'Invoice access locked', 'Your role cannot view invoices in this workspace.'),
  routeRule('/invoices', 'view_invoices', 'Invoice access locked', 'Your role cannot view invoices in this workspace.'),
  routeRule('/transactions', 'view_transactions', 'Transaction access locked', 'Your role cannot view ledger transactions in this workspace.'),
  routeRule('/payments', 'view_payments', 'Payment access locked', 'Your role cannot view payments in this workspace.'),
  routeRule('/products', 'manage_products_inventory', 'Inventory access locked', 'Your role cannot manage products or inventory.'),
  routeRule('/documents', 'view_documents', 'Document access locked', 'Your role cannot view document packs in this workspace.'),
  routeRule('/templates', 'view_documents', 'Template access locked', 'Your role cannot view document templates in this workspace.'),
  routeRule('/reports', 'view_reports', 'Report access locked', 'Your role cannot view reports in this workspace.'),
  routeRule('/market', 'manage_billing_entitlement', 'Billing access locked', 'Your role cannot manage plans or billing for this workspace.'),
  routeRule('/team', 'view_audit_log', 'Team access locked', 'Your role cannot view Office team access history.'),
  routeRule('/backup', 'view_backup_status', 'Backup access locked', 'Your role cannot view backup readiness for this workspace.'),
  routeRule('/settings', 'manage_company_profile', 'Settings access locked', 'Your role cannot manage company settings for this workspace.'),
  routeRule('/office-operations', 'manage_billing_entitlement', 'Operations access locked', 'Your role cannot access Office operations.'),
  routeRule('/support', null, 'Support', 'Support is available for this workspace.'),
  routeRule('/dashboard', 'view_workspace_dashboard', 'Dashboard access locked', 'Your role cannot view the workspace dashboard.'),
  routeRule('/', 'view_workspace_dashboard', 'Workspace access locked', 'Your role cannot view this workspace.'),
];

export const WEB_OFFICE_SENSITIVE_ACTIONS = [
  actionCheck('create_customer', 'Create customer', 'Customers', 'manage_customers'),
  actionCheck('update_customer_profile', 'Update customer profile', 'Customers', 'manage_customers'),
  actionCheck('record_customer_follow_up', 'Record customer follow-up', 'Customers', 'manage_customers'),
  actionCheck('export_customer_profile', 'Export customer profile', 'Customers', 'export_documents'),
  actionCheck('create_invoice', 'Create invoice', 'Invoices', 'create_invoices'),
  actionCheck('edit_saved_invoice', 'Edit saved invoice', 'Invoices', 'edit_latest_invoice'),
  actionCheck('cancel_archive_invoice', 'Cancel or archive invoice', 'Invoices', 'cancel_or_archive_invoices'),
  actionCheck('manage_recurring_invoice_rule', 'Manage monthly invoice rule', 'Invoices', 'manage_recurring_rules'),
  actionCheck('approve_auto_email', 'Approve automatic email', 'Invoices', 'approve_auto_email'),
  actionCheck('record_invoice_payment', 'Record invoice payment', 'Payments', 'record_payments'),
  actionCheck('verify_payment_clearance', 'Verify payment clearance', 'Payments', 'verify_payments'),
  actionCheck('reverse_payment', 'Reverse payment', 'Payments', 'reverse_payments'),
  actionCheck('manage_payment_allocation', 'Apply provider event to invoice', 'Payments', 'manage_payment_allocations'),
  actionCheck('record_transaction', 'Record transaction', 'Transactions', 'record_transactions'),
  actionCheck('export_transactions', 'Export transactions', 'Transactions', 'export_reports'),
  actionCheck('manage_products_inventory', 'Manage products and inventory', 'Products', 'manage_products_inventory'),
  actionCheck('export_inventory_review', 'Export inventory review', 'Products', 'export_reports'),
  actionCheck('export_business_report', 'Export business report', 'Reports', 'export_reports'),
  actionCheck('export_tax_summary', 'Export tax summary', 'Reports', 'view_tax_reports'),
  actionCheck('export_backup', 'Export backup', 'Backup', 'export_backup'),
  actionCheck('restore_backup', 'Restore backup', 'Backup', 'restore_backup'),
  actionCheck('manage_billing', 'Manage billing and plans', 'Market', 'manage_billing_entitlement'),
  actionCheck('manage_company_settings', 'Manage company settings', 'Settings', 'manage_company_profile'),
] as const satisfies readonly WebOfficeSensitiveActionCheck[];

export function buildWebOfficeAccessState(input: {
  member: OfficeMembershipRecord | null;
  fallbackToOwner: boolean;
}): WebOfficeAccessState {
  if (input.member) {
    const canAccessWorkspace = canOfficeMemberAccessWorkspace(input.member);
    const roleLabel = getOfficeRoleDefinition(input.member.role).label;
    return {
      role: input.member.role,
      roleLabel,
      member: input.member,
      source: canAccessWorkspace ? 'member' : 'inactive_member',
      canAccessWorkspace,
      message: canAccessWorkspace
        ? `You are signed in as ${roleLabel}.`
        : 'Your Office access is not active for this workspace.',
    };
  }

  if (input.fallbackToOwner) {
    return {
      role: 'owner',
      roleLabel: getOfficeRoleDefinition('owner').label,
      member: null,
      source: 'owner_fallback',
      canAccessWorkspace: true,
      message: 'You have owner access for this workspace.',
    };
  }

  return {
    role: null,
    roleLabel: 'No Office role',
    member: null,
    source: 'unavailable',
    canAccessWorkspace: false,
    message: 'Office access could not be confirmed for this workspace.',
  };
}

export function canUseWebOfficePermission(state: WebOfficeAccessState, permission: OfficePermission) {
  if (!state.canAccessWorkspace || !state.role) {
    return false;
  }

  if (state.member) {
    return canOfficeMemberUsePermission(state.member, permission);
  }

  return state.source === 'owner_fallback' && canOfficeRole(state.role, permission);
}

export function getWebOfficeRouteAccess(pathname: string | null, state: WebOfficeAccessState): WebOfficeRouteAccess {
  const rule = getWebOfficeRouteRule(pathname);
  if (!rule.permission) {
    return {
      allowed: state.canAccessWorkspace,
      permission: null,
      title: state.canAccessWorkspace ? rule.title : 'Workspace access locked',
      message: state.canAccessWorkspace ? rule.message : state.message,
    };
  }

  const allowed = canUseWebOfficePermission(state, rule.permission);
  return {
    allowed,
    permission: rule.permission,
    title: allowed ? rule.title : rule.title,
    message: allowed ? rule.message : buildPermissionDeniedMessage(state, rule.permission, rule.message),
  };
}

export function getOfficeSensitiveActionMessage(permission: OfficePermission) {
  const definition = getOfficePermissionDefinition(permission);
  return `${definition.label} is locked for your Office role. Ask the workspace owner to update your role if this is part of your work.`;
}

export function getWebOfficeRouteChecks(): WebOfficeRouteCheck[] {
  return WEB_OFFICE_ROUTE_RULES.map((rule) => ({
    pathname: rule.prefix === '/' ? '/dashboard' : rule.prefix,
    permission: rule.permission,
  }));
}

export function getWebOfficeSensitiveActionChecks(): WebOfficeSensitiveActionCheck[] {
  return [...WEB_OFFICE_SENSITIVE_ACTIONS];
}

export function buildWebOfficeRoleSimulation(role: OfficeWorkspaceRole | 'owner_fallback'): WebOfficeRoleSimulation {
  const state = buildWebOfficeAccessState({
    member: role === 'owner_fallback' ? null : buildSimulationMember(role),
    fallbackToOwner: role === 'owner_fallback',
  });

  return {
    role,
    source: state.source,
    routes: getWebOfficeRouteChecks().map((route) => ({
      ...route,
      allowed: getWebOfficeRouteAccess(route.pathname, state).allowed,
    })),
    actions: getWebOfficeSensitiveActionChecks().map((action) => ({
      ...action,
      allowed: canUseWebOfficePermission(state, action.permission),
    })),
  };
}

export function buildWebOfficeRoleSimulationMatrix() {
  return ['owner_fallback', ...OFFICE_WORKSPACE_ROLES].map((role) =>
    buildWebOfficeRoleSimulation(role as OfficeWorkspaceRole | 'owner_fallback')
  );
}

function getWebOfficeRouteRule(pathname: string | null) {
  const currentPathname = pathname || '/dashboard';
  return WEB_OFFICE_ROUTE_RULES.find((rule) =>
    currentPathname === rule.prefix || currentPathname.startsWith(`${rule.prefix}/`)
  ) ?? WEB_OFFICE_ROUTE_RULES[WEB_OFFICE_ROUTE_RULES.length - 1];
}

function buildPermissionDeniedMessage(
  state: WebOfficeAccessState,
  permission: OfficePermission,
  fallbackMessage: string
) {
  if (!state.canAccessWorkspace) {
    return state.message;
  }

  const definition = getOfficePermissionDefinition(permission);
  return `${fallbackMessage} Current role: ${state.roleLabel}. Required access: ${definition.label}.`;
}

function routeRule(
  prefix: string,
  permission: OfficePermission | null,
  title: string,
  message: string
): RoutePermissionRule {
  return {
    prefix,
    permission,
    title,
    message,
  };
}

function actionCheck(
  id: string,
  label: string,
  area: string,
  permission: OfficePermission
): WebOfficeSensitiveActionCheck {
  return {
    id,
    label,
    area,
    permission,
  };
}

function buildSimulationMember(role: OfficeWorkspaceRole): OfficeMembershipRecord {
  const now = '2026-05-06T00:00:00.000Z';
  return {
    uid: `simulated_${role}`,
    workspaceId: 'simulated_workspace',
    role,
    status: 'active',
    email: `${role}@example.invalid`,
    displayName: getOfficeRoleDefinition(role).label,
    invitedBy: null,
    invitedAt: null,
    acceptedAt: now,
    suspendedAt: null,
    removedAt: null,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
