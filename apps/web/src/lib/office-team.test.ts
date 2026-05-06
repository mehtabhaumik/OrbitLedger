import { getWebPaidSubscriptionStatus } from './web-monetization';
import {
  buildWebOfficeInvitationAcceptUrl,
  buildWebOfficeAuditTimeline,
  buildWebOfficeTeamSnapshot,
  getWebOfficeAssignableRoles,
  getWebOfficeInviteCapacityDecision,
  getWebOfficeInvitationDisplayStatus,
  getWebOfficeMemberPresence,
  parseWebOfficeAuditItem,
  parseWebOfficeInvitation,
  parseWebOfficeMember,
  parseWebOfficeOwnershipTransfer,
} from './office-team';
import { getDefaultWebSubscriptionStatus } from './web-monetization';
import { describe, expect, it } from 'vitest';

describe('office team management', () => {
  it('unlocks team controls for active Office owners', () => {
    const snapshot = buildWebOfficeTeamSnapshot({
      currentMember: member('owner-1', 'owner', 'active'),
      members: [member('owner-1', 'owner', 'active'), member('manager-1', 'manager', 'active')],
      invitations: [invitation('invite-1', 'staff', 'pending')],
      auditItems: [],
      subscription: getDefaultWebSubscriptionStatus(),
    });

    expect(snapshot.access).toMatchObject({
      officeAllowed: true,
      isActiveMember: true,
      role: 'owner',
      canInvite: true,
      canChangeRoles: true,
      canRemoveMembers: true,
    });
    expect(snapshot.availableInviteRoles).toEqual(['admin', 'manager', 'staff', 'accountant', 'viewer']);
    expect(snapshot.metrics.map((metric) => [metric.id, metric.value])).toEqual([
      ['seats', 3],
      ['active', 2],
      ['pending', 1],
      ['suspended', 0],
      ['audit', 0],
    ]);
    expect(snapshot.seatCapacity).toMatchObject({
      usedSeats: 3,
      remainingSeats: 2,
      atCapacity: false,
    });
  });

  it('keeps admins below owner and admin escalation', () => {
    const snapshot = buildWebOfficeTeamSnapshot({
      currentMember: member('admin-1', 'admin', 'active'),
      members: [member('owner-1', 'owner', 'active'), member('admin-1', 'admin', 'active'), member('staff-1', 'staff', 'active')],
      invitations: [],
      auditItems: [],
      subscription: getWebPaidSubscriptionStatus('office_yearly'),
    });

    expect(snapshot.availableInviteRoles).toEqual(['manager', 'staff', 'accountant', 'viewer']);
    expect(getWebOfficeAssignableRoles('admin', 'staff')).toEqual(['manager', 'staff', 'accountant', 'viewer']);
    expect(getWebOfficeAssignableRoles('admin', 'admin')).toEqual([]);
    expect(getWebOfficeAssignableRoles('admin', 'owner')).toEqual([]);
  });

  it('shows a locked state when Office has not been granted', () => {
    const snapshot = buildWebOfficeTeamSnapshot({
      currentMember: null,
      members: [],
      invitations: [],
      auditItems: [],
      subscription: getDefaultWebSubscriptionStatus(),
    });

    expect(snapshot.access).toMatchObject({
      officeAllowed: false,
      isActiveMember: false,
      canInvite: false,
    });
  });

  it('parses Firestore team documents defensively', () => {
    expect(parseWebOfficeMember('member-1', {
      uid: 'member-1',
      workspace_id: 'workspace-1',
      role: 'manager',
      status: 'active',
      email: 'manager@example.com',
      display_name: 'Manager One',
    })).toMatchObject({
      uid: 'member-1',
      role: 'manager',
      status: 'active',
      email: 'manager@example.com',
    });

    expect(parseWebOfficeInvitation('invite-1', {
      email: 'staff@example.com',
      role: 'owner',
      status: 'strange',
      workspace_id: 'workspace-1',
      delivery_status: 'sent',
      sent_at: '2026-05-06T00:00:00.000Z',
      resend_count: 2,
    })).toMatchObject({
      id: 'invite-1',
      role: 'viewer',
      status: 'pending',
      deliveryStatus: 'sent',
      sentAt: '2026-05-06T00:00:00.000Z',
      resendCount: 2,
    });

    expect(parseWebOfficeOwnershipTransfer('transfer-1', {
      workspace_id: 'workspace-1',
      status: 'pending',
      requested_by: 'owner-1',
      requested_by_email: 'owner@example.com',
      target_uid: 'admin-1',
      target_email: 'admin@example.com',
      target_name: 'Admin One',
      requested_at: '2026-05-06T10:00:00.000Z',
      expires_at: '2026-05-13T10:00:00.000Z',
      notification_status: 'sent',
      notification_sent_at: '2026-05-06T10:01:00.000Z',
      notification_resend_count: 1,
    })).toMatchObject({
      id: 'transfer-1',
      status: 'pending',
      requestedBy: 'owner-1',
      targetUid: 'admin-1',
      targetEmail: 'admin@example.com',
      expiresAt: '2026-05-13T10:00:00.000Z',
      notificationStatus: 'sent',
      notificationSentAt: '2026-05-06T10:01:00.000Z',
      notificationResendCount: 1,
    });
  });

  it('builds stable invite acceptance URLs and computes expired display state', () => {
    expect(buildWebOfficeInvitationAcceptUrl({
      origin: 'https://orbit-ledger-f41c2.web.app',
      workspaceId: 'workspace-1',
      invitationId: 'invite-1',
    })).toBe('https://orbit-ledger-f41c2.web.app/team/invite?workspaceId=workspace-1&invitationId=invite-1');

    expect(getWebOfficeInvitationDisplayStatus({
      ...invitation('invite-1', 'staff', 'pending'),
      expiresAt: '2020-01-01T00:00:00.000Z',
    })).toBe('expired');
    expect(getWebOfficeInvitationDisplayStatus({
      ...invitation('invite-2', 'staff', 'pending'),
      expiresAt: '2999-01-01T00:00:00.000Z',
    })).toBe('pending');
  });

  it('parses and formats Office audit events for the team timeline', () => {
    const roleChange = parseWebOfficeAuditItem('audit-1', {
      workspace_id: 'workspace-1',
      actor_uid: 'owner-1',
      actor_role: 'owner',
      action: 'member_role_changed',
      target_uid: 'manager-1',
      target_email: 'manager@example.com',
      previous_role: 'staff',
      next_role: 'manager',
      previous_status: 'active',
      next_status: 'active',
      reason: 'Promoted for daily operations.',
      created_at: '2026-05-06T10:00:00.000Z',
    });
    const revokedInvite = parseWebOfficeAuditItem('audit-2', {
      workspace_id: 'workspace-1',
      actor_uid: 'admin-1',
      actor_role: 'admin',
      action: 'invitation_revoked',
      target_email: 'staff@example.com',
      created_at: '2026-05-06T09:00:00.000Z',
    });
    const deliveryUpdate = parseWebOfficeAuditItem('audit-3', {
      workspace_id: 'workspace-1',
      actor_uid: 'owner-1',
      actor_role: 'owner',
      action: 'invitation_email_sent',
      target_email: 'staff@example.com',
      reason: 'Invitation email sent.',
      created_at: '2026-05-06T08:00:00.000Z',
    });
    const restoredMember = parseWebOfficeAuditItem('audit-4', {
      workspace_id: 'workspace-1',
      actor_uid: 'owner-1',
      actor_role: 'owner',
      action: 'member_restored',
      target_uid: 'staff-1',
      target_email: 'staff@example.com',
      previous_status: 'suspended',
      next_status: 'active',
      created_at: '2026-05-06T07:00:00.000Z',
    });
    const cancelledTransfer = parseWebOfficeAuditItem('audit-5', {
      workspace_id: 'workspace-1',
      actor_uid: 'owner-1',
      actor_role: 'owner',
      action: 'ownership_transfer_cancelled',
      target_uid: 'admin-1',
      target_email: 'admin@example.com',
      reason: 'Ownership transfer cancelled.',
      created_at: '2026-05-06T06:00:00.000Z',
    });
    const expiredTransfer = parseWebOfficeAuditItem('audit-6', {
      workspace_id: 'workspace-1',
      actor_uid: 'system',
      actor_role: 'internal_support_reviewer',
      action: 'ownership_transfer_expired',
      target_uid: 'admin-1',
      target_email: 'admin@example.com',
      reason: 'Ownership transfer expired automatically.',
      created_at: '2026-05-06T05:00:00.000Z',
    });
    const supportConsent = parseWebOfficeAuditItem('audit-7', {
      workspace_id: 'workspace-1',
      actor_uid: 'owner-1',
      actor_role: 'owner',
      action: 'internal_access_reviewed',
      support_consent_id: 'consent-1',
      support_case_id: 'CASE-2001',
      customer_approved_diagnostic_access: true,
      reason: 'Customer approved a safe diagnostic review pack.',
      created_at: '2026-05-06T04:00:00.000Z',
    });
    const supportRevoked = parseWebOfficeAuditItem('audit-8', {
      workspace_id: 'workspace-1',
      actor_uid: 'owner-1',
      actor_role: 'owner',
      action: 'internal_access_reviewed',
      support_consent_id: 'consent-1',
      support_case_id: 'CASE-2001',
      previous_status: 'active',
      next_status: 'revoked',
      reason: 'Support diagnostic approval revoked.',
      created_at: '2026-05-06T03:00:00.000Z',
    });
    const supportResolved = parseWebOfficeAuditItem('audit-9', {
      workspace_id: 'workspace-1',
      actor_uid: 'support-1',
      actor_role: 'internal_support_reviewer',
      action: 'internal_access_reviewed',
      support_case_id: 'CASE-2001',
      previous_status: 'open',
      next_status: 'resolved',
      reason: 'Support case resolved: Customer confirmed the issue is fixed.',
      created_at: '2026-05-06T02:00:00.000Z',
    });

    expect(buildWebOfficeAuditTimeline([roleChange, revokedInvite, deliveryUpdate, restoredMember, cancelledTransfer, expiredTransfer, supportConsent, supportRevoked, supportResolved], 'all')).toEqual([
      expect.objectContaining({
        id: 'audit-1',
        title: 'Role changed',
        category: 'members',
        target: 'manager@example.com',
      }),
      expect.objectContaining({
        id: 'audit-2',
        title: 'Invitation revoked',
        category: 'invitations',
        target: 'staff@example.com',
      }),
      expect.objectContaining({
        id: 'audit-3',
        title: 'Invitation email updated',
        category: 'invitations',
        target: 'staff@example.com',
      }),
      expect.objectContaining({
        id: 'audit-4',
        title: 'Member restored',
        category: 'members',
        target: 'staff@example.com',
      }),
      expect.objectContaining({
        id: 'audit-5',
        title: 'Ownership transfer cancelled',
        category: 'ownership',
        target: 'admin@example.com',
      }),
      expect.objectContaining({
        id: 'audit-6',
        title: 'Ownership transfer expired',
        category: 'ownership',
        target: 'admin@example.com',
      }),
      expect.objectContaining({
        id: 'audit-7',
        title: 'Support review approved',
        category: 'internal',
        target: 'Case CASE-2001',
        supportCaseId: 'CASE-2001',
        supportConsentId: 'consent-1',
      }),
      expect.objectContaining({
        id: 'audit-8',
        title: 'Support approval revoked',
        category: 'internal',
        target: 'Case CASE-2001',
      }),
      expect.objectContaining({
        id: 'audit-9',
        title: 'Support case resolved',
        category: 'internal',
        target: 'Case CASE-2001',
      }),
    ]);
    expect(buildWebOfficeAuditTimeline([roleChange, revokedInvite, deliveryUpdate], 'invitations')).toEqual([
      expect.objectContaining({ id: 'audit-2' }),
      expect.objectContaining({ id: 'audit-3' }),
    ]);
  });

  it('summarizes Office member presence without exposing inactive members as online', () => {
    expect(getWebOfficeMemberPresence({
      ...member('staff-1', 'staff', 'active'),
      lastSeenAt: '2026-05-06T10:00:00.000Z',
    }, '2026-05-06T10:10:00.000Z')).toMatchObject({
      status: 'active_recently',
      label: 'Active recently',
      tone: 'success',
    });

    expect(getWebOfficeMemberPresence({
      ...member('staff-1', 'staff', 'active'),
      lastSeenAt: '2026-05-06T09:00:00.000Z',
    }, '2026-05-06T10:10:00.000Z')).toMatchObject({
      status: 'seen_before',
      label: 'Seen before',
      tone: 'default',
    });

    expect(getWebOfficeMemberPresence(member('staff-1', 'staff', 'active'))).toMatchObject({
      status: 'not_seen',
      label: 'Not seen yet',
    });

    expect(getWebOfficeMemberPresence(member('staff-1', 'staff', 'suspended'))).toMatchObject({
      status: 'inactive',
      label: 'Access inactive',
      tone: 'warning',
    });
  });

  it('guards Office invitations when seats are full or the email already exists', () => {
    const snapshot = buildWebOfficeTeamSnapshot({
      currentMember: member('owner-1', 'owner', 'active'),
      members: [
        member('owner-1', 'owner', 'active'),
        member('admin-1', 'admin', 'active'),
        member('manager-1', 'manager', 'active'),
        member('staff-1', 'staff', 'active'),
      ],
      invitations: [invitation('invite-1', 'viewer', 'pending')],
      auditItems: [],
      subscription: getWebPaidSubscriptionStatus('office_yearly'),
    });

    expect(snapshot.access.canInvite).toBe(false);
    expect(snapshot.seatCapacity).toMatchObject({
      usedSeats: 5,
      remainingSeats: 0,
      atCapacity: true,
    });
    expect(getWebOfficeInviteCapacityDecision(snapshot, 'new@example.com')).toMatchObject({
      allowed: false,
      reason: 'seat_limit_reached',
    });

    const duplicateSnapshot = buildWebOfficeTeamSnapshot({
      currentMember: member('owner-1', 'owner', 'active'),
      members: [member('owner-1', 'owner', 'active')],
      invitations: [invitation('invite-1', 'viewer', 'pending')],
      auditItems: [],
      subscription: getWebPaidSubscriptionStatus('office_yearly'),
    });

    expect(getWebOfficeInviteCapacityDecision(duplicateSnapshot, 'invite-1@example.com')).toMatchObject({
      allowed: false,
      reason: 'pending_invitation',
    });
  });
});

function member(uid: string, role: 'owner' | 'admin' | 'manager' | 'staff' | 'accountant' | 'viewer', status: 'active' | 'invited' | 'suspended' | 'removed') {
  return {
    uid,
    workspaceId: 'workspace-1',
    role,
    status,
    email: `${uid}@example.com`,
    displayName: uid,
    invitedBy: null,
    invitedAt: null,
    acceptedAt: status === 'active' ? '2026-05-06T00:00:00.000Z' : null,
    suspendedAt: status === 'suspended' ? '2026-05-06T00:00:00.000Z' : null,
    removedAt: status === 'removed' ? '2026-05-06T00:00:00.000Z' : null,
    lastSeenAt: null,
    createdAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-06T00:00:00.000Z',
  };
}

function invitation(id: string, role: 'admin' | 'manager' | 'staff' | 'accountant' | 'viewer', status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked') {
  return {
    id,
    workspaceId: 'workspace-1',
    email: `${id}@example.com`,
    role,
    status,
    invitedBy: 'owner-1',
    invitedByName: 'Owner',
    message: null,
    expiresAt: null,
    acceptedBy: null,
    acceptedAt: null,
    revokedBy: null,
    revokedAt: null,
    deliveryStatus: null,
    emailProviderStatus: null,
    providerMessageId: null,
    sentAt: null,
    failureReason: null,
    resendCount: null,
    lastResendAt: null,
    inviteUrl: null,
    createdAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-06T00:00:00.000Z',
  };
}
