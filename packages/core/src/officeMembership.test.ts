import { describe, expect, it } from 'vitest';

import {
  canOfficeActorChangeMemberRole,
  canOfficeActorInviteRole,
  canOfficeActorRemoveMember,
  buildOfficeSupportCaseAdminActionPlan,
  buildOfficeSupportReviewPlan,
  canOfficeMemberAccessWorkspace,
  canOfficeMemberUsePermission,
  getOfficeInvitationCapacityDecision,
  getOfficeMembershipPermissionSummary,
  getOfficeSeatCapacity,
  isOfficeInvitationStatus,
  isOfficeMemberStatus,
  isOfficeMembershipCollection,
  isOfficeSupportCaseAction,
  isOfficeSupportCaseStatus,
  isOrbitLedgerInternalAdminAllowedForCustomerData,
  OFFICE_ACCESS_SECURITY_RULES,
  OFFICE_MEMBERSHIP_FIRESTORE_PATHS,
} from './officeMembership';

describe('office membership schema', () => {
  it('recognizes member, invitation, and Office collection states', () => {
    expect(isOfficeMemberStatus('active')).toBe(true);
    expect(isOfficeMemberStatus('pending')).toBe(false);
    expect(isOfficeInvitationStatus('pending')).toBe(true);
    expect(isOfficeInvitationStatus('suspended')).toBe(false);
    expect(isOfficeSupportCaseStatus('resolved')).toBe(true);
    expect(isOfficeSupportCaseAction('resolve')).toBe(true);
    expect(isOfficeMembershipCollection('office_members')).toBe(true);
    expect(isOfficeMembershipCollection('customers')).toBe(false);
  });

  it('allows only active workspace members to access workspace data', () => {
    expect(canOfficeMemberAccessWorkspace({ role: 'manager', status: 'active' })).toBe(true);
    expect(canOfficeMemberAccessWorkspace({ role: 'manager', status: 'invited' })).toBe(false);
    expect(canOfficeMemberAccessWorkspace({ role: 'admin', status: 'suspended' })).toBe(false);
    expect(canOfficeMemberAccessWorkspace({ role: 'owner', status: 'removed' })).toBe(false);
  });

  it('checks role permissions through active membership state', () => {
    expect(canOfficeMemberUsePermission({ role: 'manager', status: 'active' }, 'create_invoices')).toBe(true);
    expect(canOfficeMemberUsePermission({ role: 'manager', status: 'active' }, 'manage_payment_settings')).toBe(false);
    expect(canOfficeMemberUsePermission({ role: 'owner', status: 'suspended' }, 'transfer_workspace_ownership')).toBe(false);
  });

  it('prevents unsafe invitation and role escalation', () => {
    expect(canOfficeActorInviteRole('owner', 'admin')).toBe(true);
    expect(canOfficeActorInviteRole('owner', 'owner')).toBe(false);
    expect(canOfficeActorInviteRole('admin', 'manager')).toBe(true);
    expect(canOfficeActorInviteRole('admin', 'admin')).toBe(false);
    expect(canOfficeActorInviteRole('manager', 'staff')).toBe(false);
  });

  it('keeps role changes below ownership and admin escalation boundaries', () => {
    expect(canOfficeActorChangeMemberRole('owner', 'staff', 'admin')).toBe(true);
    expect(canOfficeActorChangeMemberRole('owner', 'admin', 'owner')).toBe(false);
    expect(canOfficeActorChangeMemberRole('admin', 'staff', 'manager')).toBe(true);
    expect(canOfficeActorChangeMemberRole('admin', 'manager', 'admin')).toBe(false);
    expect(canOfficeActorChangeMemberRole('admin', 'owner', 'viewer')).toBe(false);
    expect(canOfficeActorChangeMemberRole('manager', 'staff', 'viewer')).toBe(false);
  });

  it('keeps member removal safe', () => {
    expect(canOfficeActorRemoveMember('owner', 'admin')).toBe(true);
    expect(canOfficeActorRemoveMember('owner', 'owner')).toBe(false);
    expect(canOfficeActorRemoveMember('admin', 'staff')).toBe(true);
    expect(canOfficeActorRemoveMember('admin', 'admin')).toBe(false);
    expect(canOfficeActorRemoveMember('manager', 'staff')).toBe(false);
  });

  it('summarizes permissions for user-facing Office setup screens', () => {
    const managerSummary = getOfficeMembershipPermissionSummary('manager');
    expect(managerSummary).toContain('Create invoices');
    expect(managerSummary).toContain('Record payments');
    expect(managerSummary).not.toContain('Manage payment settings');
  });

  it('keeps internal admin customer-data access consent-bound', () => {
    expect(isOrbitLedgerInternalAdminAllowedForCustomerData('internal_support_reviewer', false)).toBe(false);
    expect(isOrbitLedgerInternalAdminAllowedForCustomerData('internal_support_reviewer', true)).toBe(true);
  });

  it('keeps internal support review impersonation-proof', () => {
    expect(buildOfficeSupportReviewPlan({
      reason: 'Reviewing a customer-approved support ticket',
      supportCaseId: 'CASE-1001',
      customerApprovedDiagnosticAccess: true,
    })).toMatchObject({
      canRecord: true,
      supportCaseId: 'CASE-1001',
      impersonationAllowed: false,
      customerDataAccessAllowed: true,
    });

    expect(buildOfficeSupportReviewPlan({
      reason: 'Attempted account takeover',
      requestedImpersonation: true,
    })).toMatchObject({
      canRecord: false,
      impersonationAllowed: false,
      message: 'Support review cannot impersonate a workspace member.',
    });
  });

  it('keeps support case admin notes structured and resolution-oriented', () => {
    expect(buildOfficeSupportCaseAdminActionPlan({
      supportCaseId: 'CASE-2001',
      action: 'resolve',
      note: 'Customer confirmed that the diagnostic review solved the issue.',
    })).toMatchObject({
      canRecord: true,
      supportCaseId: 'CASE-2001',
      action: 'resolve',
      nextStatus: 'resolved',
      message: 'Support case marked resolved.',
    });

    expect(buildOfficeSupportCaseAdminActionPlan({
      supportCaseId: '',
      action: 'reopen',
      note: 'Needs more review.',
    })).toMatchObject({
      canRecord: false,
      message: 'Choose a support case before saving this update.',
    });

    expect(buildOfficeSupportCaseAdminActionPlan({
      supportCaseId: 'CASE-2001',
      action: 'add_note',
      note: '',
    })).toMatchObject({
      canRecord: false,
      message: 'Add a short support note before saving this update.',
    });
  });

  it('documents stable Firestore paths and safety rules', () => {
    expect(OFFICE_MEMBERSHIP_FIRESTORE_PATHS.members).toBe('workspaces/{workspaceId}/office_members/{userId}');
    expect(OFFICE_MEMBERSHIP_FIRESTORE_PATHS.invitations).toBe('workspaces/{workspaceId}/office_invitations/{invitationId}');
    expect(OFFICE_ACCESS_SECURITY_RULES.join(' ')).toContain('Suspended');
  });

  it('counts Office seats across active members, suspended members, and pending invitations', () => {
    const capacity = getOfficeSeatCapacity({
      members: [
        { status: 'active' },
        { status: 'active' },
        { status: 'suspended' },
        { status: 'removed' },
      ],
      invitations: [{ status: 'pending' }, { status: 'accepted' }, { status: 'revoked' }],
      seatLimit: 4,
    });

    expect(capacity).toMatchObject({
      seatLimit: 4,
      usedSeats: 4,
      remainingSeats: 0,
      activeMembers: 2,
      suspendedMembers: 1,
      pendingInvitations: 1,
      atCapacity: true,
    });
  });

  it('blocks duplicate and over-capacity Office invitations', () => {
    const members = [
      { email: 'owner@example.com', status: 'active' as const },
      { email: 'manager@example.com', status: 'active' as const },
    ];
    const invitations = [{ email: 'pending@example.com', status: 'pending' as const }];

    expect(getOfficeInvitationCapacityDecision({
      members,
      invitations,
      targetEmail: 'PENDING@example.com',
      seatLimit: 5,
    })).toMatchObject({
      allowed: false,
      reason: 'pending_invitation',
    });

    expect(getOfficeInvitationCapacityDecision({
      members,
      invitations,
      targetEmail: 'manager@example.com',
      seatLimit: 5,
    })).toMatchObject({
      allowed: false,
      reason: 'existing_member',
    });

    expect(getOfficeInvitationCapacityDecision({
      members,
      invitations,
      targetEmail: 'new@example.com',
      seatLimit: 3,
    })).toMatchObject({
      allowed: false,
      reason: 'seat_limit_reached',
    });

    expect(getOfficeInvitationCapacityDecision({
      members,
      invitations,
      targetEmail: 'new@example.com',
      seatLimit: 4,
    })).toMatchObject({
      allowed: true,
      reason: 'available',
      remainingSeats: 1,
    });
  });
});
