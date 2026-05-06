import { describe, expect, it } from 'vitest';
import type { OfficeMembershipRecord } from '@orbit-ledger/core';

import {
  buildWebOfficeRoleSimulation,
  buildWebOfficeRoleSimulationMatrix,
  buildWebOfficeAccessState,
  canUseWebOfficePermission,
  getWebOfficeSensitiveActionChecks,
  getWebOfficeRouteAccess,
} from './web-office-access';

describe('web office access guards', () => {
  it('keeps existing solo workspaces usable with owner fallback', () => {
    const state = buildWebOfficeAccessState({ member: null, fallbackToOwner: true });

    expect(state.role).toBe('owner');
    expect(canUseWebOfficePermission(state, 'restore_backup')).toBe(true);
    expect(getWebOfficeRouteAccess('/settings', state).allowed).toBe(true);
  });

  it('allows viewers to view invoices but blocks sensitive routes', () => {
    const state = buildWebOfficeAccessState({ member: member('viewer'), fallbackToOwner: true });

    expect(getWebOfficeRouteAccess('/invoices', state).allowed).toBe(true);
    expect(getWebOfficeRouteAccess('/market', state).allowed).toBe(false);
    expect(canUseWebOfficePermission(state, 'export_documents')).toBe(false);
  });

  it('locks inactive members even when the workspace route is known', () => {
    const state = buildWebOfficeAccessState({ member: member('manager', 'suspended'), fallbackToOwner: true });

    expect(state.canAccessWorkspace).toBe(false);
    expect(getWebOfficeRouteAccess('/dashboard', state).allowed).toBe(false);
    expect(canUseWebOfficePermission(state, 'record_payments')).toBe(false);
  });

  it('lets managers handle daily work but not payment settings or backup restore', () => {
    const state = buildWebOfficeAccessState({ member: member('manager'), fallbackToOwner: true });

    expect(canUseWebOfficePermission(state, 'record_transactions')).toBe(true);
    expect(canUseWebOfficePermission(state, 'manage_recurring_rules')).toBe(true);
    expect(canUseWebOfficePermission(state, 'manage_payment_settings')).toBe(false);
    expect(canUseWebOfficePermission(state, 'restore_backup')).toBe(false);
  });

  it('simulates every Office role against route and sensitive action guards', () => {
    const matrix = buildWebOfficeRoleSimulationMatrix();

    expect(matrix.map((entry) => entry.role)).toEqual([
      'owner_fallback',
      'owner',
      'admin',
      'manager',
      'staff',
      'accountant',
      'viewer',
    ]);
    for (const entry of matrix) {
      expect(entry.routes.length).toBeGreaterThan(10);
      expect(entry.actions.length).toBe(getWebOfficeSensitiveActionChecks().length);
      expect(entry.routes.find((route) => route.pathname === '/dashboard')?.allowed).toBe(true);
    }
  });

  it('keeps owner fallback and explicit owner equivalent for launch compatibility', () => {
    const fallback = buildWebOfficeRoleSimulation('owner_fallback');
    const owner = buildWebOfficeRoleSimulation('owner');

    expect(fallback.routes.map((route) => route.allowed)).toEqual(owner.routes.map((route) => route.allowed));
    expect(fallback.actions.map((action) => action.allowed)).toEqual(owner.actions.map((action) => action.allowed));
  });

  it('keeps viewer truly read-only in the web guard simulation', () => {
    const viewer = buildWebOfficeRoleSimulation('viewer');

    expect(viewer.routes.find((route) => route.pathname === '/invoices')?.allowed).toBe(true);
    expect(viewer.routes.find((route) => route.pathname === '/customers')?.allowed).toBe(true);
    expect(viewer.routes.find((route) => route.pathname === '/customers/new')?.allowed).toBe(false);
    expect(viewer.actions.filter((action) => action.allowed).map((action) => action.id)).toEqual([]);
  });

  it('keeps accountants review-first and blocks daily money edits', () => {
    const accountant = buildWebOfficeRoleSimulation('accountant');
    const allowedActions = accountant.actions.filter((action) => action.allowed).map((action) => action.id);

    expect(accountant.routes.find((route) => route.pathname === '/reports')?.allowed).toBe(true);
    expect(accountant.routes.find((route) => route.pathname === '/team')?.allowed).toBe(true);
    expect(accountant.routes.find((route) => route.pathname === '/payments')?.allowed).toBe(true);
    expect(accountant.routes.find((route) => route.pathname === '/products')?.allowed).toBe(false);
    expect(allowedActions).toContain('export_business_report');
    expect(allowedActions).toContain('export_tax_summary');
    expect(allowedActions).toContain('export_customer_profile');
    expect(allowedActions).not.toContain('record_invoice_payment');
    expect(allowedActions).not.toContain('edit_saved_invoice');
  });

  it('keeps staff able to enter routine records without approval or export power', () => {
    const staff = buildWebOfficeRoleSimulation('staff');
    const allowedActions = staff.actions.filter((action) => action.allowed).map((action) => action.id);

    expect(staff.routes.find((route) => route.pathname === '/transactions')?.allowed).toBe(true);
    expect(staff.routes.find((route) => route.pathname === '/invoices/automation')?.allowed).toBe(false);
    expect(allowedActions).toContain('create_customer');
    expect(allowedActions).toContain('create_invoice');
    expect(allowedActions).toContain('record_invoice_payment');
    expect(allowedActions).toContain('record_transaction');
    expect(allowedActions).not.toContain('verify_payment_clearance');
    expect(allowedActions).not.toContain('approve_auto_email');
    expect(allowedActions).not.toContain('export_business_report');
  });

  it('keeps managers strong for daily operations but away from billing, team, and restore', () => {
    const manager = buildWebOfficeRoleSimulation('manager');
    const allowedActions = manager.actions.filter((action) => action.allowed).map((action) => action.id);

    expect(manager.routes.find((route) => route.pathname === '/invoices/automation')?.allowed).toBe(true);
    expect(manager.routes.find((route) => route.pathname === '/market')?.allowed).toBe(false);
    expect(manager.routes.find((route) => route.pathname === '/team')?.allowed).toBe(false);
    expect(allowedActions).toContain('manage_recurring_invoice_rule');
    expect(allowedActions).toContain('verify_payment_clearance');
    expect(allowedActions).toContain('export_business_report');
    expect(allowedActions).not.toContain('approve_auto_email');
    expect(allowedActions).not.toContain('restore_backup');
    expect(allowedActions).not.toContain('manage_billing');
  });
});

function member(
  role: OfficeMembershipRecord['role'],
  status: OfficeMembershipRecord['status'] = 'active'
): OfficeMembershipRecord {
  return {
    uid: 'user_1',
    workspaceId: 'workspace_1',
    role,
    status,
    email: 'user@example.invalid',
    displayName: 'Example User',
    invitedBy: null,
    invitedAt: null,
    acceptedAt: null,
    suspendedAt: status === 'suspended' ? '2026-05-06T00:00:00.000Z' : null,
    removedAt: status === 'removed' ? '2026-05-06T00:00:00.000Z' : null,
    lastSeenAt: null,
    createdAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-06T00:00:00.000Z',
  };
}
