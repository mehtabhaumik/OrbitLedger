import type {
  OfficePermission,
  OfficeWorkspaceRole,
  OrbitLedgerInternalAdminRole,
} from './officeAccess';
import {
  canAssignOfficeRole,
  canOfficeRole,
  canRemoveOfficeMember,
  OFFICE_PERMISSION_DEFINITIONS,
  OFFICE_WORKSPACE_ROLES,
  ORBIT_LEDGER_INTERNAL_ADMIN_ROLES,
} from './officeAccess';

export const OFFICE_MEMBER_STATUSES = [
  'active',
  'invited',
  'suspended',
  'removed',
] as const;

export type OfficeMemberStatus = (typeof OFFICE_MEMBER_STATUSES)[number];

export const OFFICE_INVITATION_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'expired',
  'revoked',
] as const;

export type OfficeInvitationStatus = (typeof OFFICE_INVITATION_STATUSES)[number];

export const OFFICE_OWNERSHIP_TRANSFER_STATUSES = [
  'pending',
  'approved',
  'cancelled',
  'expired',
] as const;

export type OfficeOwnershipTransferStatus = (typeof OFFICE_OWNERSHIP_TRANSFER_STATUSES)[number];

export const OFFICE_SUPPORT_CASE_STATUSES = [
  'open',
  'waiting_on_customer',
  'resolved',
  'reopened',
] as const;

export type OfficeSupportCaseStatus = (typeof OFFICE_SUPPORT_CASE_STATUSES)[number];

export const OFFICE_SUPPORT_CASE_ACTIONS = [
  'add_note',
  'resolve',
  'reopen',
] as const;

export type OfficeSupportCaseAction = (typeof OFFICE_SUPPORT_CASE_ACTIONS)[number];

export type OfficeMembershipRecord = {
  uid: string;
  workspaceId: string;
  role: OfficeWorkspaceRole;
  status: OfficeMemberStatus;
  email: string | null;
  displayName: string | null;
  invitedBy: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  suspendedAt: string | null;
  removedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficeInvitationRecord = {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<OfficeWorkspaceRole, 'owner'>;
  status: OfficeInvitationStatus;
  invitedBy: string;
  invitedByName: string | null;
  message: string | null;
  expiresAt: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  deliveryStatus?: 'queued' | 'pending_provider_connection' | 'sent' | 'failed' | null;
  emailProviderStatus?: string | null;
  providerMessageId?: string | null;
  sentAt?: string | null;
  failureReason?: string | null;
  resendCount?: number | null;
  lastResendAt?: string | null;
  inviteUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficeOwnershipTransferRecord = {
  id: string;
  workspaceId: string;
  status: OfficeOwnershipTransferStatus;
  requestedBy: string;
  requestedByEmail: string | null;
  targetUid: string;
  targetEmail: string | null;
  targetName: string | null;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  notificationStatus: 'queued' | 'pending_provider_connection' | 'sent' | 'failed' | null;
  notificationSentAt: string | null;
  notificationFailureReason: string | null;
  notificationProviderMessageId: string | null;
  notificationResendCount: number | null;
  notificationLastResendAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficeAccessAuditRecord = {
  id: string;
  workspaceId: string;
  actorUid: string;
  actorRole: OfficeWorkspaceRole | OrbitLedgerInternalAdminRole;
  action:
    | 'member_invited'
    | 'member_accepted'
    | 'member_role_changed'
    | 'member_suspended'
    | 'member_restored'
    | 'member_removed'
    | 'invitation_revoked'
    | 'invitation_email_sent'
    | 'ownership_transfer_requested'
    | 'ownership_transferred'
    | 'ownership_transfer_cancelled'
    | 'ownership_transfer_expired'
    | 'ownership_transfer_notification_sent'
    | 'internal_access_reviewed';
  targetUid: string | null;
  targetEmail: string | null;
  previousRole: OfficeWorkspaceRole | null;
  nextRole: OfficeWorkspaceRole | null;
  previousStatus: OfficeMemberStatus | OfficeInvitationStatus | OfficeSupportCaseStatus | null;
  nextStatus: OfficeMemberStatus | OfficeInvitationStatus | OfficeSupportCaseStatus | null;
  reason: string | null;
  supportConsentId?: string | null;
  supportCaseId?: string | null;
  customerApprovedDiagnosticAccess?: boolean | null;
  impersonationAllowed?: boolean | null;
  createdAt: string;
};

export type OfficeMembershipCollectionName =
  | 'office_members'
  | 'office_invitations'
  | 'office_ownership_transfers'
  | 'office_access_audit';

export const OFFICE_MEMBERSHIP_COLLECTIONS: readonly OfficeMembershipCollectionName[] = [
  'office_members',
  'office_invitations',
  'office_ownership_transfers',
  'office_access_audit',
] as const;

export const OFFICE_MEMBERSHIP_FIRESTORE_PATHS = {
  members: 'workspaces/{workspaceId}/office_members/{userId}',
  invitations: 'workspaces/{workspaceId}/office_invitations/{invitationId}',
  ownershipTransfers: 'workspaces/{workspaceId}/office_ownership_transfers/{transferId}',
  accessAudit: 'workspaces/{workspaceId}/office_access_audit/{auditId}',
} as const;

export const OFFICE_ACCESS_SECURITY_RULES = [
  'Workspace owners remain the only role that can transfer ownership.',
  'Office admins can invite and manage manager, staff, accountant, and viewer roles only.',
  'Office admins cannot create another admin, change an owner, or remove an owner.',
  'Orbit Ledger internal admin roles are separate from customer Office workspace roles.',
  'Orbit Ledger internal support review never impersonates a workspace member.',
  'Suspended, removed, and invited members cannot read workspace data.',
  'Office access audit records are read-only for client apps.',
] as const;

export const OFFICE_SUPPORT_REVIEW_GUARDRAILS = [
  'Support review records why Orbit Ledger looked at a workspace.',
  'Support review does not create a member session for Orbit Ledger.',
  'Support review does not change roles, ownership, invoices, payments, settings, backups, or billing.',
  'Customer data access still requires customer-approved diagnostic consent.',
  'The workspace audit log stays visible to owners and allowed Office reviewers.',
] as const;

export const OFFICE_INCLUDED_SEAT_LIMIT = 5;

export type OfficeSeatCapacityInput = {
  members: Array<Pick<OfficeMembershipRecord, 'status'>>;
  invitations: Array<Pick<OfficeInvitationRecord, 'status'>>;
  seatLimit?: number | null;
};

export type OfficeSeatCapacity = {
  seatLimit: number;
  usedSeats: number;
  remainingSeats: number;
  activeMembers: number;
  suspendedMembers: number;
  pendingInvitations: number;
  atCapacity: boolean;
  label: string;
  message: string;
};

export type OfficeInvitationCapacityInput = {
  members: Array<Pick<OfficeMembershipRecord, 'email' | 'status'>>;
  invitations: Array<Pick<OfficeInvitationRecord, 'email' | 'status'>>;
  targetEmail?: string | null;
  seatLimit?: number | null;
};

export type OfficeInvitationCapacityDecision = OfficeSeatCapacity & {
  allowed: boolean;
  reason: 'available' | 'seat_limit_reached' | 'existing_member' | 'pending_invitation';
};

export type OfficeSupportReviewPlanInput = {
  reason?: string | null;
  supportCaseId?: string | null;
  customerApprovedDiagnosticAccess?: boolean;
  requestedImpersonation?: boolean;
};

export type OfficeSupportCaseAdminActionInput = {
  supportCaseId?: string | null;
  action?: string | null;
  note?: string | null;
};

export type OfficeSupportCaseAdminActionPlan = {
  canRecord: boolean;
  supportCaseId: string | null;
  action: OfficeSupportCaseAction;
  note: string;
  nextStatus: OfficeSupportCaseStatus;
  message: string;
};

export type OfficeSupportReviewPlan = {
  canRecord: boolean;
  reason: string;
  supportCaseId: string | null;
  impersonationAllowed: false;
  customerDataAccessAllowed: boolean;
  message: string;
};

export function isOfficeMemberStatus(status: string): status is OfficeMemberStatus {
  return OFFICE_MEMBER_STATUSES.includes(status as OfficeMemberStatus);
}

export function isOfficeInvitationStatus(status: string): status is OfficeInvitationStatus {
  return OFFICE_INVITATION_STATUSES.includes(status as OfficeInvitationStatus);
}

export function isOfficeOwnershipTransferStatus(status: string): status is OfficeOwnershipTransferStatus {
  return OFFICE_OWNERSHIP_TRANSFER_STATUSES.includes(status as OfficeOwnershipTransferStatus);
}

export function isOfficeSupportCaseStatus(status: string): status is OfficeSupportCaseStatus {
  return OFFICE_SUPPORT_CASE_STATUSES.includes(status as OfficeSupportCaseStatus);
}

export function isOfficeSupportCaseAction(action: string): action is OfficeSupportCaseAction {
  return OFFICE_SUPPORT_CASE_ACTIONS.includes(action as OfficeSupportCaseAction);
}

export function isOfficeMembershipCollection(collectionName: string): collectionName is OfficeMembershipCollectionName {
  return OFFICE_MEMBERSHIP_COLLECTIONS.includes(collectionName as OfficeMembershipCollectionName);
}

export function canOfficeMemberAccessWorkspace(member: Pick<OfficeMembershipRecord, 'role' | 'status'>): boolean {
  return member.status === 'active' && OFFICE_WORKSPACE_ROLES.includes(member.role);
}

export function canOfficeMemberUsePermission(
  member: Pick<OfficeMembershipRecord, 'role' | 'status'>,
  permission: OfficePermission
): boolean {
  return canOfficeMemberAccessWorkspace(member) && canOfficeRole(member.role, permission);
}

export function canOfficeActorInviteRole(
  actorRole: OfficeWorkspaceRole,
  targetRole: OfficeWorkspaceRole
): boolean {
  return targetRole !== 'owner' && canAssignOfficeRole(actorRole, targetRole);
}

export function canOfficeActorChangeMemberRole(
  actorRole: OfficeWorkspaceRole,
  currentRole: OfficeWorkspaceRole,
  nextRole: OfficeWorkspaceRole
): boolean {
  if (currentRole === 'owner' || nextRole === 'owner') {
    return false;
  }

  if (actorRole === 'owner') {
    return true;
  }

  return actorRole === 'admin' && canAssignOfficeRole(actorRole, nextRole) && currentRole !== 'admin';
}

export function canOfficeActorRemoveMember(
  actorRole: OfficeWorkspaceRole,
  targetRole: OfficeWorkspaceRole
): boolean {
  return canRemoveOfficeMember(actorRole, targetRole);
}

export function getOfficeMembershipPermissionSummary(role: OfficeWorkspaceRole): string[] {
  return OFFICE_PERMISSION_DEFINITIONS
    .filter((definition) => canOfficeRole(role, definition.id))
    .map((definition) => definition.label);
}

export function getOfficeSeatCapacity(input: OfficeSeatCapacityInput): OfficeSeatCapacity {
  const seatLimit = normalizeOfficeSeatLimit(input.seatLimit);
  const activeMembers = input.members.filter((member) => member.status === 'active').length;
  const suspendedMembers = input.members.filter((member) => member.status === 'suspended').length;
  const pendingInvitations = input.invitations.filter((invitation) => invitation.status === 'pending').length;
  const usedSeats = activeMembers + suspendedMembers + pendingInvitations;
  const remainingSeats = Math.max(0, seatLimit - usedSeats);
  const atCapacity = remainingSeats <= 0;

  return {
    seatLimit,
    usedSeats,
    remainingSeats,
    activeMembers,
    suspendedMembers,
    pendingInvitations,
    atCapacity,
    label: `${usedSeats} of ${seatLimit} seats used`,
    message: atCapacity
      ? 'Office seats are full. Remove or suspend an unused invitation before inviting another teammate.'
      : `${remainingSeats} Office ${remainingSeats === 1 ? 'seat is' : 'seats are'} available.`,
  };
}

export function getOfficeInvitationCapacityDecision(
  input: OfficeInvitationCapacityInput
): OfficeInvitationCapacityDecision {
  const capacity = getOfficeSeatCapacity(input);
  const targetEmail = normalizeOfficeEmail(input.targetEmail);
  const existingMember = targetEmail
    ? input.members.some(
        (member) =>
          member.status !== 'removed' &&
          normalizeOfficeEmail(member.email) === targetEmail
      )
    : false;
  const pendingInvitation = targetEmail
    ? input.invitations.some(
        (invitation) =>
          invitation.status === 'pending' &&
          normalizeOfficeEmail(invitation.email) === targetEmail
      )
    : false;

  if (existingMember) {
    return {
      ...capacity,
      allowed: false,
      reason: 'existing_member',
      message: 'This email already belongs to an Office member in this workspace.',
    };
  }

  if (pendingInvitation) {
    return {
      ...capacity,
      allowed: false,
      reason: 'pending_invitation',
      message: 'This email already has a pending Office invitation.',
    };
  }

  if (capacity.atCapacity) {
    return {
      ...capacity,
      allowed: false,
      reason: 'seat_limit_reached',
      message: capacity.message,
    };
  }

  return {
    ...capacity,
    allowed: true,
    reason: 'available',
  };
}

export function isOrbitLedgerInternalAdminAllowedForCustomerData(
  role: OrbitLedgerInternalAdminRole,
  customerApprovedDiagnosticAccess: boolean
): boolean {
  if (!ORBIT_LEDGER_INTERNAL_ADMIN_ROLES.includes(role)) {
    return false;
  }

  return customerApprovedDiagnosticAccess;
}

export function buildOfficeSupportReviewPlan(input: OfficeSupportReviewPlanInput = {}): OfficeSupportReviewPlan {
  const reason = normalizeOfficeSupportReviewText(input.reason) ?? 'Support review recorded by Orbit Ledger.';
  const supportCaseId = normalizeOfficeSupportReviewText(input.supportCaseId);
  const customerDataAccessAllowed = Boolean(input.customerApprovedDiagnosticAccess);

  if (input.requestedImpersonation) {
    return {
      canRecord: false,
      reason,
      supportCaseId,
      impersonationAllowed: false,
      customerDataAccessAllowed,
      message: 'Support review cannot impersonate a workspace member.',
    };
  }

  return {
    canRecord: true,
    reason,
    supportCaseId,
    impersonationAllowed: false,
    customerDataAccessAllowed,
    message: customerDataAccessAllowed
      ? 'Support review recorded with customer-approved diagnostic context.'
      : 'Support review recorded without customer data access.',
  };
}

export function buildOfficeSupportCaseAdminActionPlan(
  input: OfficeSupportCaseAdminActionInput = {}
): OfficeSupportCaseAdminActionPlan {
  const supportCaseId = normalizeOfficeSupportReviewText(input.supportCaseId);
  const rawAction = input.action ?? '';
  const action: OfficeSupportCaseAction = isOfficeSupportCaseAction(rawAction) ? rawAction : 'add_note';
  const note = normalizeOfficeSupportReviewText(input.note);

  if (!supportCaseId) {
    return {
      canRecord: false,
      supportCaseId,
      action,
      note: '',
      nextStatus: 'open',
      message: 'Choose a support case before saving this update.',
    };
  }

  if (!note) {
    return {
      canRecord: false,
      supportCaseId,
      action,
      note: '',
      nextStatus: supportCaseStatusForAction(action),
      message: 'Add a short support note before saving this update.',
    };
  }

  return {
    canRecord: true,
    supportCaseId,
    action,
    note,
    nextStatus: supportCaseStatusForAction(action),
    message: supportCaseMessageForAction(action),
  };
}

function supportCaseStatusForAction(action: OfficeSupportCaseAction): OfficeSupportCaseStatus {
  if (action === 'resolve') {
    return 'resolved';
  }
  if (action === 'reopen') {
    return 'reopened';
  }
  return 'open';
}

function supportCaseMessageForAction(action: OfficeSupportCaseAction) {
  if (action === 'resolve') {
    return 'Support case marked resolved.';
  }
  if (action === 'reopen') {
    return 'Support case reopened.';
  }
  return 'Support note saved.';
}

function normalizeOfficeSeatLimit(value?: number | null) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : OFFICE_INCLUDED_SEAT_LIMIT;
}

function normalizeOfficeEmail(value?: string | null) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeOfficeSupportReviewText(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, 240) : null;
}
