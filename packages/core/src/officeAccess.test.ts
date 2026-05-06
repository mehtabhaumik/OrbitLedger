import { describe, expect, it } from 'vitest';

import {
  canAssignOfficeRole,
  canInternalAdminRole,
  canOfficeRole,
  canRemoveOfficeMember,
  canTransferOfficeOwnership,
  getOfficePermissionDefinition,
  getOfficeRolePermissions,
  isOfficeWorkspaceRole,
  isOrbitLedgerInternalAdminRole,
  OFFICE_PERMISSIONS,
  OFFICE_WORKSPACE_ROLES,
  validateOfficePermissionMatrix,
} from './officeAccess';

describe('office access model', () => {
  it('keeps the permission matrix internally valid', () => {
    expect(validateOfficePermissionMatrix()).toEqual({
      valid: true,
      missingMatrixEntries: [],
      ownerMissingPermissions: [],
      permissionsWithoutAnyRole: [],
      privilegeWarnings: [],
    });
  });

  it('gives the owner every Office workspace permission', () => {
    expect(getOfficeRolePermissions('owner')).toEqual(OFFICE_PERMISSIONS);
    expect(canTransferOfficeOwnership('owner')).toBe(true);
    expect(canOfficeRole('owner', 'restore_backup')).toBe(true);
    expect(canOfficeRole('owner', 'manage_billing_entitlement')).toBe(true);
  });

  it('keeps admins powerful but below ownership control', () => {
    expect(canOfficeRole('admin', 'manage_payment_settings')).toBe(true);
    expect(canOfficeRole('admin', 'approve_auto_email')).toBe(true);
    expect(canOfficeRole('admin', 'transfer_workspace_ownership')).toBe(false);
    expect(canTransferOfficeOwnership('admin')).toBe(false);
  });

  it('lets managers run daily work without sensitive settings access', () => {
    expect(canOfficeRole('manager', 'create_invoices')).toBe(true);
    expect(canOfficeRole('manager', 'record_payments')).toBe(true);
    expect(canOfficeRole('manager', 'manage_recurring_rules')).toBe(true);
    expect(canOfficeRole('manager', 'manage_payment_settings')).toBe(false);
    expect(canOfficeRole('manager', 'restore_backup')).toBe(false);
    expect(canOfficeRole('manager', 'invite_team_members')).toBe(false);
  });

  it('keeps staff focused on routine entry work', () => {
    expect(canOfficeRole('staff', 'create_invoices')).toBe(true);
    expect(canOfficeRole('staff', 'record_transactions')).toBe(true);
    expect(canOfficeRole('staff', 'reverse_payments')).toBe(false);
    expect(canOfficeRole('staff', 'bulk_export_documents')).toBe(false);
    expect(canOfficeRole('staff', 'approve_auto_email')).toBe(false);
  });

  it('gives accountants review and export access without daily editing rights', () => {
    expect(canOfficeRole('accountant', 'view_tax_reports')).toBe(true);
    expect(canOfficeRole('accountant', 'export_reports')).toBe(true);
    expect(canOfficeRole('accountant', 'view_audit_log')).toBe(true);
    expect(canOfficeRole('accountant', 'edit_latest_invoice')).toBe(false);
    expect(canOfficeRole('accountant', 'record_payments')).toBe(false);
  });

  it('keeps viewers read-only', () => {
    expect(canOfficeRole('viewer', 'view_workspace_dashboard')).toBe(true);
    expect(canOfficeRole('viewer', 'view_invoices')).toBe(true);
    expect(canOfficeRole('viewer', 'export_documents')).toBe(false);
    expect(canOfficeRole('viewer', 'manage_customers')).toBe(false);
  });

  it('prevents role assignment escalation', () => {
    expect(canAssignOfficeRole('owner', 'admin')).toBe(true);
    expect(canAssignOfficeRole('owner', 'owner')).toBe(false);
    expect(canAssignOfficeRole('admin', 'manager')).toBe(true);
    expect(canAssignOfficeRole('admin', 'staff')).toBe(true);
    expect(canAssignOfficeRole('admin', 'admin')).toBe(false);
    expect(canAssignOfficeRole('manager', 'staff')).toBe(false);
  });

  it('prevents unsafe member removal', () => {
    expect(canRemoveOfficeMember('owner', 'admin')).toBe(true);
    expect(canRemoveOfficeMember('owner', 'owner')).toBe(false);
    expect(canRemoveOfficeMember('admin', 'manager')).toBe(true);
    expect(canRemoveOfficeMember('admin', 'accountant')).toBe(true);
    expect(canRemoveOfficeMember('admin', 'admin')).toBe(false);
    expect(canRemoveOfficeMember('manager', 'staff')).toBe(false);
  });

  it('keeps Orbit Ledger internal admins separate from customer Office admins', () => {
    expect(isOfficeWorkspaceRole('admin')).toBe(true);
    expect(isOfficeWorkspaceRole('internal_billing_admin')).toBe(false);
    expect(isOrbitLedgerInternalAdminRole('internal_billing_admin')).toBe(true);
    expect(isOrbitLedgerInternalAdminRole('admin')).toBe(false);
    expect(canInternalAdminRole('internal_support_reviewer', 'review_diagnostics_with_customer_consent')).toBe(true);
    expect(canInternalAdminRole('internal_support_reviewer', 'manage_invited_office_access')).toBe(false);
  });

  it('defines every permission with user-facing metadata', () => {
    for (const permission of OFFICE_PERMISSIONS) {
      const definition = getOfficePermissionDefinition(permission);
      expect(definition.id).toBe(permission);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(definition.risk);
    }
  });

  it('keeps every Office role known to the guard', () => {
    for (const role of OFFICE_WORKSPACE_ROLES) {
      expect(isOfficeWorkspaceRole(role)).toBe(true);
    }
  });
});
