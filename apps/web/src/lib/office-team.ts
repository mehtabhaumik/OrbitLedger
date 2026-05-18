'use client';

import {
  OFFICE_WORKSPACE_ROLES,
  canOfficeActorChangeMemberRole,
  canOfficeActorInviteRole,
  canOfficeActorRemoveMember,
  canOfficeMemberAccessWorkspace,
  getOfficeInvitationCapacityDecision,
  getOfficeMembershipPermissionSummary,
  getOfficeRoleDefinition,
  getOfficeSeatCapacity,
  isOfficeInvitationStatus,
  isOfficeMemberStatus,
  isOfficeOwnershipTransferStatus,
  isOfficeSupportCaseStatus,
  isOfficeWorkspaceRole,
  type OfficeAccessAuditRecord,
  type OfficeInvitationCapacityDecision,
  type OfficeInvitationRecord,
  type OfficeInvitationStatus,
  type OfficeMemberStatus,
  type OfficeMembershipRecord,
  type OfficeOwnershipTransferRecord,
  type OfficeSeatCapacity,
  type OfficeWorkspaceRole,
} from '@orbit-ledger/core';
import {
  collection,
  type CollectionReference,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';

import { getWebAuth, getWebFirebaseProjectId, getWebFirestore } from './firebase';
import { resolveWebFeatureAccess, type WebSubscriptionStatus } from './web-monetization';

export type WebOfficeTeamMetric = {
  id: 'seats' | 'active' | 'pending' | 'suspended' | 'audit';
  label: string;
  value: number;
  helper: string;
  tone: 'success' | 'warning' | 'premium' | 'default';
};

export type WebOfficeTeamAccess = {
  officeAllowed: boolean;
  isActiveMember: boolean;
  role: OfficeWorkspaceRole | null;
  roleLabel: string;
  canInvite: boolean;
  canChangeRoles: boolean;
  canRemoveMembers: boolean;
  message: string;
};

export type WebOfficeAuditFilter = 'all' | 'members' | 'invitations' | 'ownership' | 'internal';

export type WebOfficeAuditTimelineItem = {
  id: string;
  title: string;
  description: string;
  actor: string;
  target: string;
  createdAt: string;
  tone: 'success' | 'warning' | 'danger' | 'default';
  category: Exclude<WebOfficeAuditFilter, 'all'>;
  supportCaseId: string | null;
  supportConsentId: string | null;
};

export type WebOfficeMemberPresence = {
  status: 'active_recently' | 'seen_before' | 'not_seen' | 'inactive';
  label: string;
  tone: 'success' | 'warning' | 'default';
  lastSeenAt: string | null;
};

export type WebOfficeMemberIdentity = {
  primary: string;
  secondary: string;
  memberId: string;
  isCurrentUser: boolean;
};

export type WebOfficeTeamSnapshot = {
  access: WebOfficeTeamAccess;
  metrics: WebOfficeTeamMetric[];
  members: OfficeMembershipRecord[];
  invitations: OfficeInvitationRecord[];
  ownershipTransfers: OfficeOwnershipTransferRecord[];
  auditItems: OfficeAccessAuditRecord[];
  seatCapacity: OfficeSeatCapacity;
  inviteCapacity: OfficeInvitationCapacityDecision;
  availableInviteRoles: Array<Exclude<OfficeWorkspaceRole, 'owner'>>;
  permissionSummary: string[];
};

export type WebOfficeInviteMemberInput = {
  workspaceId: string;
  actorUid: string;
  actorName: string | null;
  email: string;
  role: Exclude<OfficeWorkspaceRole, 'owner'>;
  message?: string | null;
};

export type WebOfficeInvitationAcceptanceResult = {
  workspaceId: string;
  invitationId: string;
  role: OfficeWorkspaceRole;
  message: string | null;
};

export type WebOfficeInvitationDeliveryResult = {
  workspaceId: string;
  invitationId: string;
  deliveryStatus: 'queued' | 'pending_provider_connection' | 'sent' | 'failed';
  sentAt: string | null;
  inviteUrl: string;
  message: string | null;
};

export type WebOfficeOwnershipTransferResult = {
  workspaceId: string;
  transferId: string;
  message: string | null;
};

export async function loadWebOfficeTeamSnapshot(input: {
  workspaceId: string;
  userId: string;
  subscription: WebSubscriptionStatus;
}): Promise<WebOfficeTeamSnapshot> {
  const firestore = getWebFirestore();
  const memberRef = doc(firestore, 'workspaces', input.workspaceId, 'office_members', input.userId);
  const [currentMemberSnapshot, memberSnapshot, invitationSnapshot, ownershipTransferSnapshot, auditSnapshot] = await Promise.all([
    getDoc(memberRef),
    getDocs(collection(firestore, 'workspaces', input.workspaceId, 'office_members')),
    getOptionalDocs(collection(firestore, 'workspaces', input.workspaceId, 'office_invitations')),
    getOptionalDocs(collection(firestore, 'workspaces', input.workspaceId, 'office_ownership_transfers')),
    getOptionalDocs(collection(firestore, 'workspaces', input.workspaceId, 'office_access_audit')),
  ]);

  const currentMember = currentMemberSnapshot.exists()
    ? parseWebOfficeMember(currentMemberSnapshot.id, currentMemberSnapshot.data())
    : buildOwnerFallbackWebOfficeMember(input.workspaceId, input.userId);

  return buildWebOfficeTeamSnapshot({
    currentMember,
    members: memberSnapshot.docs.map((entry) => parseWebOfficeMember(entry.id, entry.data())),
    invitations: invitationSnapshot.docs.map((entry) => parseWebOfficeInvitation(entry.id, entry.data())),
    ownershipTransfers: ownershipTransferSnapshot.docs.map((entry) => parseWebOfficeOwnershipTransfer(entry.id, entry.data())),
    auditItems: auditSnapshot.docs.map((entry) => parseWebOfficeAuditItem(entry.id, entry.data())),
    subscription: input.subscription,
  });
}

type OptionalDocsSnapshot = {
  docs: Array<{
    id: string;
    data(): DocumentData;
  }>;
};

async function getOptionalDocs(reference: CollectionReference<DocumentData>): Promise<OptionalDocsSnapshot> {
  try {
    return await getDocs(reference);
  } catch {
    return { docs: [] };
  }
}

export async function inviteWebOfficeMember(input: WebOfficeInviteMemberInput) {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error('Enter a valid email address.');
  }
  if (!canOfficeActorInviteRoleFromString(input.role)) {
    throw new Error('Choose a valid team role.');
  }

  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before inviting a teammate.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getCreateOfficeInvitationUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      email,
      role: input.role,
      actorName: input.actorName,
      message: cleanNullable(input.message),
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'invitation_create_failed',
  }))) as
    | {
        ok: true;
        workspaceId: string;
        invitationId: string;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeInvitationCreateErrorMessage(result.error));
  }

  return result.invitationId;
}

export async function acceptWebOfficeInvitation(input: {
  workspaceId: string;
  invitationId: string;
  displayName?: string | null;
}): Promise<WebOfficeInvitationAcceptanceResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before accepting this invitation.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getAcceptOfficeInvitationUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'invitation_accept_failed',
  }))) as
    | {
        ok: true;
        workspaceId: string;
        invitationId: string;
        role: OfficeWorkspaceRole;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeInvitationAcceptErrorMessage(result.error));
  }

  return {
    workspaceId: result.workspaceId,
    invitationId: result.invitationId,
    role: result.role,
    message: result.message ?? null,
  };
}

export async function sendWebOfficeInvitationEmail(input: {
  workspaceId: string;
  invitationId: string;
  origin: string;
}): Promise<WebOfficeInvitationDeliveryResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before sending this invitation.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getSendOfficeInvitationEmailUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'invitation_delivery_failed',
  }))) as
    | {
        ok: true;
        workspaceId: string;
        invitationId: string;
        deliveryStatus: 'queued' | 'pending_provider_connection' | 'sent' | 'failed';
        sentAt?: string | null;
        inviteUrl: string;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeInvitationDeliveryErrorMessage(result.error));
  }

  return {
    workspaceId: result.workspaceId,
    invitationId: result.invitationId,
    deliveryStatus: result.deliveryStatus,
    sentAt: result.sentAt ?? null,
    inviteUrl: result.inviteUrl,
    message: result.message ?? null,
  };
}

export async function updateWebOfficeMemberRole(input: {
  workspaceId: string;
  memberId: string;
  nextRole: Exclude<OfficeWorkspaceRole, 'owner'>;
}) {
  await requestTrustedOfficeMemberAccessUpdate({
    workspaceId: input.workspaceId,
    memberId: input.memberId,
    action: 'change_role',
    nextRole: input.nextRole,
  });
}

export async function updateWebOfficeMemberStatus(input: {
  workspaceId: string;
  memberId: string;
  nextStatus: Extract<OfficeMemberStatus, 'active' | 'suspended' | 'removed'>;
}) {
  await requestTrustedOfficeMemberAccessUpdate({
    workspaceId: input.workspaceId,
    memberId: input.memberId,
    action:
      input.nextStatus === 'active'
        ? 'restore'
        : input.nextStatus === 'suspended'
          ? 'suspend'
          : 'remove',
  });
}

export async function updateWebOfficeMemberPresence(input: {
  workspaceId: string;
  memberId: string;
  seenAt?: string;
}) {
  const seenAt = input.seenAt ?? new Date().toISOString();
  await updateDoc(doc(getWebFirestore(), 'workspaces', input.workspaceId, 'office_members', input.memberId), {
    last_seen_at: seenAt,
    updated_at: seenAt,
  });
  return seenAt;
}

export async function requestWebOfficeOwnershipTransfer(input: {
  workspaceId: string;
  targetUid: string;
}): Promise<WebOfficeOwnershipTransferResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before requesting ownership transfer.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getRequestOfficeOwnershipTransferUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'ownership_transfer_request_failed',
  }))) as
    | { ok: true; workspaceId: string; transferId: string; message?: string | null }
    | { ok: false; error: string; message?: string | null };

  if (!result.ok) {
    throw new Error(result.message ?? officeOwnershipTransferErrorMessage(result.error));
  }
  return {
    workspaceId: result.workspaceId,
    transferId: result.transferId,
    message: result.message ?? null,
  };
}

export async function resolveWebOfficeOwnershipTransfer(input: {
  workspaceId: string;
  transferId: string;
  action: 'approve' | 'cancel';
}): Promise<WebOfficeOwnershipTransferResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before updating ownership transfer.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getResolveOfficeOwnershipTransferUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'ownership_transfer_resolution_failed',
  }))) as
    | { ok: true; workspaceId: string; transferId: string; message?: string | null }
    | { ok: false; error: string; message?: string | null };

  if (!result.ok) {
    throw new Error(result.message ?? officeOwnershipTransferErrorMessage(result.error));
  }
  return {
    workspaceId: result.workspaceId,
    transferId: result.transferId,
    message: result.message ?? null,
  };
}

export async function resendWebOfficeOwnershipTransferNotification(input: {
  workspaceId: string;
  transferId: string;
}): Promise<WebOfficeOwnershipTransferResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before sending ownership reminder.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getResendOfficeOwnershipTransferNotificationUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'ownership_transfer_notification_failed',
  }))) as
    | { ok: true; workspaceId: string; transferId: string; message?: string | null }
    | { ok: false; error: string; message?: string | null };

  if (!result.ok) {
    throw new Error(result.message ?? officeOwnershipTransferErrorMessage(result.error));
  }
  return {
    workspaceId: result.workspaceId,
    transferId: result.transferId,
    message: result.message ?? null,
  };
}

export async function revokeWebOfficeInvitation(input: {
  workspaceId: string;
  invitationId: string;
  actorUid: string;
}) {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before revoking an invitation.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getRevokeOfficeInvitationUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      invitationId: input.invitationId,
      actorUid: input.actorUid,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'invitation_revoke_failed',
  }))) as
    | {
        ok: true;
        workspaceId: string;
        invitationId: string;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeInvitationRevokeErrorMessage(result.error));
  }
}

export function buildWebOfficeInvitationAcceptUrl(input: {
  origin: string;
  workspaceId: string;
  invitationId: string;
}) {
  const url = new URL('/team/invite', input.origin);
  url.searchParams.set('workspaceId', input.workspaceId);
  url.searchParams.set('invitationId', input.invitationId);
  return url.toString();
}

export function getWebOfficeInvitationDisplayStatus(invitation: OfficeInvitationRecord) {
  if (invitation.status === 'pending' && isWebOfficeInvitationExpired(invitation)) {
    return 'expired';
  }
  return invitation.status;
}

export function isWebOfficeInvitationExpired(invitation: Pick<OfficeInvitationRecord, 'expiresAt' | 'status'>) {
  if (invitation.status !== 'pending' || !invitation.expiresAt) {
    return false;
  }
  const expiresAt = Date.parse(invitation.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export function buildWebOfficeTeamSnapshot(input: {
  currentMember: OfficeMembershipRecord | null;
  members: OfficeMembershipRecord[];
  invitations: OfficeInvitationRecord[];
  ownershipTransfers?: OfficeOwnershipTransferRecord[];
  auditItems: OfficeAccessAuditRecord[];
  subscription: WebSubscriptionStatus;
}): WebOfficeTeamSnapshot {
  const officeFeature = resolveWebFeatureAccess(input.subscription, 'multi_user_workspace');
  const activeMember = input.currentMember && canOfficeMemberAccessWorkspace(input.currentMember)
    ? input.currentMember
    : null;
  const role = activeMember?.role ?? null;
  const officeAllowed = officeFeature.allowed || Boolean(activeMember);
  const capacityMembers = activeMember && !input.members.some((member) => member.uid === activeMember.uid)
    ? [activeMember, ...input.members]
    : input.members;
  const availableInviteRoles = role
    ? OFFICE_WORKSPACE_ROLES.filter(
        (candidate): candidate is Exclude<OfficeWorkspaceRole, 'owner'> =>
          candidate !== 'owner' && canOfficeActorInviteRole(role, candidate)
      )
    : [];
  const activeMembers = capacityMembers.filter((member) => member.status === 'active');
  const suspendedMembers = capacityMembers.filter((member) => member.status === 'suspended');
  const pendingInvitations = input.invitations.filter((invitation) => invitation.status === 'pending');
  const seatCapacity = getOfficeSeatCapacity({
    members: capacityMembers,
    invitations: input.invitations,
  });
  const inviteCapacity = getOfficeInvitationCapacityDecision({
    members: capacityMembers,
    invitations: input.invitations,
  });
  const permissionSummary = role ? getOfficeMembershipPermissionSummary(role).slice(0, 8) : [];

  return {
    access: {
      officeAllowed,
      isActiveMember: Boolean(activeMember),
      role,
      roleLabel: role ? getOfficeRoleDefinition(role).label : 'No Office role',
      canInvite: Boolean(role && availableInviteRoles.length && !seatCapacity.atCapacity),
      canChangeRoles: Boolean(role && activeMember && getCanChangeAnyRole(role, input.members)),
      canRemoveMembers: Boolean(role && activeMember && getCanRemoveAnyMember(role, input.members)),
      message: officeAllowed
        ? activeMember
          ? `You are signed in as ${getOfficeRoleDefinition(activeMember.role).label}.`
          : 'Office is included in this plan, but your member profile is not active yet.'
        : 'Team workspaces are available with invitation-only Orbit Ledger Office.',
    },
    metrics: [
      {
        id: 'seats',
        label: 'Office seats',
        value: seatCapacity.usedSeats,
        helper: seatCapacity.label,
        tone: seatCapacity.atCapacity ? 'warning' : 'success',
      },
      {
        id: 'active',
        label: 'Active members',
        value: activeMembers.length,
        helper: 'People who can access this workspace.',
        tone: activeMembers.length ? 'success' : 'warning',
      },
      {
        id: 'pending',
        label: 'Pending invites',
        value: pendingInvitations.length,
        helper: 'Invitations waiting for acceptance.',
        tone: pendingInvitations.length ? 'warning' : 'success',
      },
      {
        id: 'suspended',
        label: 'Suspended',
        value: suspendedMembers.length,
        helper: 'Access paused by an owner or admin.',
        tone: suspendedMembers.length ? 'warning' : 'success',
      },
      {
        id: 'audit',
        label: 'Access history',
        value: input.auditItems.length,
        helper: 'Recent Office access events.',
        tone: input.auditItems.length ? 'default' : 'success',
      },
    ],
    members: sortMembers(capacityMembers),
    invitations: sortInvitations(input.invitations),
    ownershipTransfers: sortOwnershipTransfers(input.ownershipTransfers ?? []),
    auditItems: sortAuditItems(input.auditItems),
    seatCapacity,
    inviteCapacity,
    availableInviteRoles,
    permissionSummary,
  };
}

export function getWebOfficeInviteCapacityDecision(
  snapshot: Pick<WebOfficeTeamSnapshot, 'members' | 'invitations'>,
  targetEmail?: string | null
) {
  return getOfficeInvitationCapacityDecision({
    members: snapshot.members,
    invitations: snapshot.invitations,
    targetEmail,
  });
}

export function getWebOfficeOwnershipTransferCandidates(
  members: OfficeMembershipRecord[],
  currentUserId?: string | null
) {
  return sortMembers(
    members.filter((member) =>
      member.status === 'active' &&
      member.role !== 'owner' &&
      member.uid !== currentUserId
    )
  );
}

export function getWebOfficeMemberIdentity(
  member: OfficeMembershipRecord,
  context: {
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    currentUserName?: string | null;
    workspaceOwnerName?: string | null;
  } = {}
): WebOfficeMemberIdentity {
  const isCurrentUser = Boolean(context.currentUserId && member.uid === context.currentUserId);
  const memberEmail = nullableString(member.email);
  const fallbackEmail = isCurrentUser ? nullableString(context.currentUserEmail) : null;
  const email = memberEmail ?? fallbackEmail;
  const displayName =
    nullableString(member.displayName) ??
    (isCurrentUser ? nullableString(context.currentUserName) : null) ??
    (isCurrentUser && member.role === 'owner' ? nullableString(context.workspaceOwnerName) : null);
  const roleLabel = getOfficeRoleDefinition(member.role).label;

  return {
    primary: displayName ?? email ?? (isCurrentUser ? 'You' : `${roleLabel} member`),
    secondary: email
      ? isCurrentUser
        ? `${email} · You`
        : email
      : isCurrentUser
        ? 'Signed in as you'
        : `Member record ${shortMemberId(member.uid)}`,
    memberId: member.uid,
    isCurrentUser,
  };
}

export function getWebOfficeAssignableRoles(
  actorRole: OfficeWorkspaceRole | null,
  currentRole: OfficeWorkspaceRole
): Array<Exclude<OfficeWorkspaceRole, 'owner'>> {
  if (!actorRole) {
    return [];
  }

  return OFFICE_WORKSPACE_ROLES.filter(
    (role): role is Exclude<OfficeWorkspaceRole, 'owner'> =>
      role !== 'owner' && canOfficeActorChangeMemberRole(actorRole, currentRole, role)
  );
}

export function getWebOfficeMemberPresence(
  member: OfficeMembershipRecord,
  nowIso = new Date().toISOString()
): WebOfficeMemberPresence {
  if (member.status !== 'active') {
    return {
      status: 'inactive',
      label: 'Access inactive',
      tone: 'warning',
      lastSeenAt: member.lastSeenAt,
    };
  }

  if (!member.lastSeenAt) {
    return {
      status: 'not_seen',
      label: 'Not seen yet',
      tone: 'default',
      lastSeenAt: null,
    };
  }

  const now = Date.parse(nowIso);
  const lastSeen = Date.parse(member.lastSeenAt);
  if (!Number.isFinite(now) || !Number.isFinite(lastSeen)) {
    return {
      status: 'seen_before',
      label: 'Last active saved',
      tone: 'default',
      lastSeenAt: member.lastSeenAt,
    };
  }

  return now - lastSeen <= 15 * 60 * 1000
    ? {
        status: 'active_recently',
        label: 'Active recently',
        tone: 'success',
        lastSeenAt: member.lastSeenAt,
      }
    : {
        status: 'seen_before',
        label: 'Seen before',
        tone: 'default',
        lastSeenAt: member.lastSeenAt,
      };
}

export function parseWebOfficeMember(id: string, data: DocumentData): OfficeMembershipRecord {
  const role = stringValue(data.role);
  const status = stringValue(data.status);
  return {
    uid: stringValue(data.uid) || id,
    workspaceId: stringValue(data.workspace_id) || stringValue(data.workspaceId),
    role: isOfficeWorkspaceRole(role) ? role : 'viewer',
    status: isOfficeMemberStatus(status) ? status : 'removed',
    email: nullableString(data.email),
    displayName: nullableString(data.display_name ?? data.displayName),
    invitedBy: nullableString(data.invited_by ?? data.invitedBy),
    invitedAt: isoValue(data.invited_at ?? data.invitedAt),
    acceptedAt: isoValue(data.accepted_at ?? data.acceptedAt),
    suspendedAt: isoValue(data.suspended_at ?? data.suspendedAt),
    removedAt: isoValue(data.removed_at ?? data.removedAt),
    lastSeenAt: isoValue(data.last_seen_at ?? data.lastSeenAt),
    createdAt: isoValue(data.created_at ?? data.createdAt) ?? '',
    updatedAt: isoValue(data.updated_at ?? data.updatedAt) ?? '',
  };
}

function buildOwnerFallbackWebOfficeMember(workspaceId: string, userId: string): OfficeMembershipRecord {
  const now = new Date().toISOString();
  return {
    uid: userId,
    workspaceId,
    role: 'owner',
    status: 'active',
    email: null,
    displayName: null,
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

export function parseWebOfficeInvitation(id: string, data: DocumentData): OfficeInvitationRecord {
  const role = stringValue(data.role);
  const status = stringValue(data.status);
  return {
    id,
    workspaceId: stringValue(data.workspace_id) || stringValue(data.workspaceId),
    email: stringValue(data.email),
    role: assignableOfficeRole(role),
    status: isOfficeInvitationStatus(status) ? status : 'pending',
    invitedBy: stringValue(data.invited_by) || stringValue(data.invitedBy),
    invitedByName: nullableString(data.invited_by_name ?? data.invitedByName),
    message: nullableString(data.message),
    expiresAt: isoValue(data.expires_at ?? data.expiresAt),
    acceptedBy: nullableString(data.accepted_by ?? data.acceptedBy),
    acceptedAt: isoValue(data.accepted_at ?? data.acceptedAt),
    revokedBy: nullableString(data.revoked_by ?? data.revokedBy),
    revokedAt: isoValue(data.revoked_at ?? data.revokedAt),
    deliveryStatus: officeDeliveryStatus(data.delivery_status ?? data.deliveryStatus),
    emailProviderStatus: nullableString(data.email_provider_status ?? data.emailProviderStatus),
    providerMessageId: nullableString(data.provider_message_id ?? data.providerMessageId),
    sentAt: isoValue(data.sent_at ?? data.sentAt),
    failureReason: nullableString(data.failure_reason ?? data.failureReason),
    resendCount: numberOrNull(data.resend_count ?? data.resendCount),
    lastResendAt: isoValue(data.last_resend_at ?? data.lastResendAt),
    inviteUrl: nullableString(data.invite_url ?? data.inviteUrl),
    createdAt: isoValue(data.created_at ?? data.createdAt) ?? '',
    updatedAt: isoValue(data.updated_at ?? data.updatedAt) ?? '',
  };
}

export function parseWebOfficeOwnershipTransfer(id: string, data: DocumentData): OfficeOwnershipTransferRecord {
  const status = stringValue(data.status);
  return {
    id,
    workspaceId: stringValue(data.workspace_id) || stringValue(data.workspaceId),
    status: isOfficeOwnershipTransferStatus(status) ? status : 'pending',
    requestedBy: stringValue(data.requested_by) || stringValue(data.requestedBy),
    requestedByEmail: nullableString(data.requested_by_email ?? data.requestedByEmail),
    targetUid: stringValue(data.target_uid) || stringValue(data.targetUid),
    targetEmail: nullableString(data.target_email ?? data.targetEmail),
    targetName: nullableString(data.target_name ?? data.targetName),
    requestedAt: isoValue(data.requested_at ?? data.requestedAt) ?? '',
    approvedBy: nullableString(data.approved_by ?? data.approvedBy),
    approvedAt: isoValue(data.approved_at ?? data.approvedAt),
    cancelledBy: nullableString(data.cancelled_by ?? data.cancelledBy),
    cancelledAt: isoValue(data.cancelled_at ?? data.cancelledAt),
    expiresAt: isoValue(data.expires_at ?? data.expiresAt),
    notificationStatus: officeDeliveryStatus(data.notification_status ?? data.notificationStatus) ?? null,
    notificationSentAt: isoValue(data.notification_sent_at ?? data.notificationSentAt),
    notificationFailureReason: nullableString(data.notification_failure_reason ?? data.notificationFailureReason),
    notificationProviderMessageId: nullableString(data.notification_provider_message_id ?? data.notificationProviderMessageId),
    notificationResendCount: numberOrNull(data.notification_resend_count ?? data.notificationResendCount),
    notificationLastResendAt: isoValue(data.notification_last_resend_at ?? data.notificationLastResendAt),
    createdAt: isoValue(data.created_at ?? data.createdAt) ?? '',
    updatedAt: isoValue(data.updated_at ?? data.updatedAt) ?? '',
  };
}

export function parseWebOfficeAuditItem(id: string, data: DocumentData): OfficeAccessAuditRecord {
  const actorRole = stringValue(data.actor_role ?? data.actorRole);
  const previousRole = nullableString(data.previous_role ?? data.previousRole);
  const nextRole = nullableString(data.next_role ?? data.nextRole);
  const previousStatus = nullableString(data.previous_status ?? data.previousStatus);
  const nextStatus = nullableString(data.next_status ?? data.nextStatus);
  return {
    id,
    workspaceId: stringValue(data.workspace_id) || stringValue(data.workspaceId),
    actorUid: stringValue(data.actor_uid) || stringValue(data.actorUid),
    actorRole: isOfficeWorkspaceRole(actorRole) ? actorRole : 'internal_support_reviewer',
    action: officeAuditAction(data.action),
    targetUid: nullableString(data.target_uid ?? data.targetUid),
    targetEmail: nullableString(data.target_email ?? data.targetEmail),
    previousRole: previousRole && isOfficeWorkspaceRole(previousRole) ? previousRole : null,
    nextRole: nextRole && isOfficeWorkspaceRole(nextRole) ? nextRole : null,
    previousStatus: officeStatus(previousStatus),
    nextStatus: officeStatus(nextStatus),
    reason: nullableString(data.reason),
    supportConsentId: nullableString(data.support_consent_id ?? data.supportConsentId),
    supportCaseId: nullableString(data.support_case_id ?? data.supportCaseId),
    customerApprovedDiagnosticAccess: booleanOrNull(data.customer_approved_diagnostic_access ?? data.customerApprovedDiagnosticAccess),
    impersonationAllowed: booleanOrNull(data.impersonation_allowed ?? data.impersonationAllowed),
    createdAt: isoValue(data.created_at ?? data.createdAt) ?? '',
  };
}

export function buildWebOfficeAuditTimeline(
  auditItems: OfficeAccessAuditRecord[],
  filter: WebOfficeAuditFilter = 'all'
): WebOfficeAuditTimelineItem[] {
  return auditItems
    .filter((item) => filter === 'all' || getOfficeAuditCategory(item) === filter)
    .map(buildWebOfficeAuditTimelineItem);
}

export function buildWebOfficeAuditTimelineItem(item: OfficeAccessAuditRecord): WebOfficeAuditTimelineItem {
  const category = getOfficeAuditCategory(item);
  const target = item.targetEmail || item.targetUid || 'Workspace';
  const roleChange =
    item.previousRole || item.nextRole
      ? `${item.previousRole ? getOfficeRoleDefinition(item.previousRole).label : 'No role'} -> ${
          item.nextRole ? getOfficeRoleDefinition(item.nextRole).label : 'No role'
        }`
      : null;
  const statusChange = item.previousStatus || item.nextStatus
    ? `${item.previousStatus ?? 'No status'} -> ${item.nextStatus ?? 'No status'}`
    : null;

  switch (item.action) {
    case 'member_invited':
      return timelineItem(item, category, 'Invitation created', `${target} was invited${item.nextRole ? ` as ${getOfficeRoleDefinition(item.nextRole).label}` : ''}.`, target, 'success');
    case 'member_accepted':
      return timelineItem(item, category, 'Invitation accepted', `${target} accepted the Office invitation.`, target, 'success');
    case 'member_role_changed':
      return timelineItem(item, category, 'Role changed', roleChange ? `${target} changed from ${roleChange}.` : `${target} role was changed.`, target, 'warning');
    case 'member_suspended':
      return timelineItem(item, category, 'Member suspended', statusChange ? `${target} status changed from ${statusChange}.` : `${target} access was suspended.`, target, 'danger');
    case 'member_restored':
      return timelineItem(item, category, 'Member restored', statusChange ? `${target} status changed from ${statusChange}.` : `${target} access was restored.`, target, 'success');
    case 'member_removed':
      return timelineItem(item, category, 'Member removed', statusChange ? `${target} status changed from ${statusChange}.` : `${target} was removed from Office access.`, target, 'danger');
    case 'invitation_revoked':
      return timelineItem(item, category, 'Invitation revoked', `${target} invitation was revoked.`, target, 'warning');
    case 'invitation_email_sent':
      return timelineItem(item, category, 'Invitation email updated', item.reason || `${target} invitation email was updated.`, target, 'success');
    case 'ownership_transfer_requested':
      return timelineItem(item, category, 'Ownership transfer requested', `${target} was selected for an ownership transfer review.`, target, 'warning');
    case 'ownership_transferred':
      return timelineItem(item, category, 'Ownership transferred', `${target} became the workspace owner.`, target, 'danger');
    case 'ownership_transfer_cancelled':
      return timelineItem(item, category, 'Ownership transfer cancelled', item.reason || `Ownership transfer for ${target} was cancelled.`, target, 'warning');
    case 'ownership_transfer_expired':
      return timelineItem(item, category, 'Ownership transfer expired', item.reason || `Ownership transfer for ${target} expired.`, target, 'warning');
    case 'ownership_transfer_notification_sent':
      return timelineItem(item, category, 'Ownership notification updated', item.reason || `Ownership transfer notification for ${target} was updated.`, target, 'success');
    case 'internal_access_reviewed':
    default:
      if (item.supportConsentId || item.supportCaseId) {
        return buildSupportAuditTimelineItem(item, category);
      }
      return timelineItem(item, category, 'Access reviewed', item.reason || 'Office access was reviewed.', target, 'default');
  }
}

function buildSupportAuditTimelineItem(
  item: OfficeAccessAuditRecord,
  category: Exclude<WebOfficeAuditFilter, 'all'>
): WebOfficeAuditTimelineItem {
  const supportTarget = item.supportCaseId ? `Case ${item.supportCaseId}` : item.supportConsentId ? `Consent ${item.supportConsentId}` : 'Support review';
  const reason = item.reason ?? '';
  if (item.nextStatus === 'resolved' || reason.toLowerCase().includes('case resolved')) {
    return timelineItem(item, category, 'Support case resolved', reason || 'Support case was marked resolved.', supportTarget, 'success');
  }
  if (item.nextStatus === 'reopened' || reason.toLowerCase().includes('case reopened')) {
    return timelineItem(item, category, 'Support case reopened', reason || 'Support case was reopened for follow-up.', supportTarget, 'warning');
  }
  if (item.nextStatus === 'open' || reason.toLowerCase().includes('case note added')) {
    return timelineItem(item, category, 'Support case note saved', reason || 'Internal support note was saved.', supportTarget, 'default');
  }
  if (item.nextStatus === 'revoked' || reason.toLowerCase().includes('revoked')) {
    return timelineItem(item, category, 'Support approval revoked', reason || 'Support diagnostic approval was revoked.', supportTarget, 'warning');
  }
  if (item.nextStatus === 'expired' || reason.toLowerCase().includes('expired')) {
    return timelineItem(item, category, 'Support approval expired', reason || 'Support diagnostic approval expired.', supportTarget, 'warning');
  }
  if (item.customerApprovedDiagnosticAccess) {
    return timelineItem(item, category, 'Support review approved', reason || 'Safe diagnostic review was approved by the customer.', supportTarget, 'success');
  }
  return timelineItem(item, category, 'Support review recorded', reason || 'Internal support review was recorded without customer data access.', supportTarget, 'default');
}

function timelineItem(
  item: OfficeAccessAuditRecord,
  category: Exclude<WebOfficeAuditFilter, 'all'>,
  title: string,
  description: string,
  target: string,
  tone: WebOfficeAuditTimelineItem['tone']
): WebOfficeAuditTimelineItem {
  return {
    id: item.id,
    title,
    description,
    actor: getOfficeAuditActorLabel(item),
    target,
    createdAt: item.createdAt,
    tone,
    category,
    supportCaseId: item.supportCaseId ?? null,
    supportConsentId: item.supportConsentId ?? null,
  };
}

function getOfficeAuditActorLabel(item: OfficeAccessAuditRecord) {
  if (isOfficeWorkspaceRole(item.actorRole)) {
    return `${getOfficeRoleDefinition(item.actorRole).label}${item.actorUid ? ` · ${item.actorUid}` : ''}`;
  }
  return `Orbit Ledger review${item.actorUid ? ` · ${item.actorUid}` : ''}`;
}

function getOfficeAuditCategory(item: OfficeAccessAuditRecord): Exclude<WebOfficeAuditFilter, 'all'> {
  if (item.action === 'member_invited' || item.action === 'invitation_revoked' || item.action === 'invitation_email_sent') {
    return 'invitations';
  }
  if (
    item.action === 'ownership_transfer_requested' ||
    item.action === 'ownership_transferred' ||
    item.action === 'ownership_transfer_cancelled' ||
    item.action === 'ownership_transfer_expired' ||
    item.action === 'ownership_transfer_notification_sent'
  ) {
    return 'ownership';
  }
  if (item.action === 'internal_access_reviewed') {
    return 'internal';
  }
  return 'members';
}

function getCanChangeAnyRole(actorRole: OfficeWorkspaceRole, members: OfficeMembershipRecord[]) {
  return members.some((member) =>
    OFFICE_WORKSPACE_ROLES.some((nextRole) => canOfficeActorChangeMemberRole(actorRole, member.role, nextRole))
  );
}

function getCanRemoveAnyMember(actorRole: OfficeWorkspaceRole, members: OfficeMembershipRecord[]) {
  return members.some((member) => canOfficeActorRemoveMember(actorRole, member.role));
}

function sortMembers(members: OfficeMembershipRecord[]) {
  const statusRank: Record<OfficeMemberStatus, number> = {
    active: 0,
    invited: 1,
    suspended: 2,
    removed: 3,
  };
  return [...members].sort((left, right) => {
    const statusDiff = statusRank[left.status] - statusRank[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return roleRank(left.role) - roleRank(right.role) || (left.displayName ?? left.email ?? '').localeCompare(right.displayName ?? right.email ?? '');
  });
}

function sortInvitations(invitations: OfficeInvitationRecord[]) {
  const statusRank: Record<OfficeInvitationStatus, number> = {
    pending: 0,
    accepted: 1,
    declined: 2,
    expired: 3,
    revoked: 4,
  };
  return [...invitations].sort((left, right) =>
    statusRank[left.status] - statusRank[right.status] || right.updatedAt.localeCompare(left.updatedAt)
  );
}

function shortMemberId(value: string) {
  if (!value) {
    return 'unknown';
  }
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function sortOwnershipTransfers(transfers: OfficeOwnershipTransferRecord[]) {
  const statusRank: Record<OfficeOwnershipTransferRecord['status'], number> = {
    pending: 0,
    approved: 1,
    cancelled: 2,
    expired: 3,
  };
  return [...transfers].sort((left, right) =>
    statusRank[left.status] - statusRank[right.status] || right.updatedAt.localeCompare(left.updatedAt)
  );
}

function sortAuditItems(items: OfficeAccessAuditRecord[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 20);
}

function roleRank(role: OfficeWorkspaceRole) {
  return OFFICE_WORKSPACE_ROLES.indexOf(role);
}

function officeStatus(value: string | null) {
  if (!value) {
    return null;
  }
  return isOfficeMemberStatus(value) || isOfficeInvitationStatus(value) || isOfficeSupportCaseStatus(value) ? value : null;
}

function officeAuditAction(value: unknown): OfficeAccessAuditRecord['action'] {
  const normalized = stringValue(value);
  return [
    'member_invited',
    'member_accepted',
    'member_role_changed',
    'member_suspended',
    'member_restored',
    'member_removed',
    'invitation_revoked',
    'invitation_email_sent',
    'ownership_transfer_requested',
    'ownership_transferred',
    'ownership_transfer_cancelled',
    'ownership_transfer_expired',
    'ownership_transfer_notification_sent',
    'internal_access_reviewed',
  ].includes(normalized)
    ? (normalized as OfficeAccessAuditRecord['action'])
    : 'internal_access_reviewed';
}

function officeDeliveryStatus(value: unknown): OfficeInvitationRecord['deliveryStatus'] {
  const normalized = stringValue(value);
  return normalized === 'queued' || normalized === 'pending_provider_connection' || normalized === 'sent' || normalized === 'failed'
    ? normalized
    : null;
}

function canOfficeActorInviteRoleFromString(role: string): role is Exclude<OfficeWorkspaceRole, 'owner'> {
  return role !== 'owner' && isOfficeWorkspaceRole(role);
}

function assignableOfficeRole(role: string): Exclude<OfficeWorkspaceRole, 'owner'> {
  return canOfficeActorInviteRoleFromString(role) ? role : 'viewer';
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanOrNull(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function isoValue(value: unknown) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  return null;
}

function getAcceptOfficeInvitationUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/acceptOfficeInvitation`;
}

function getCreateOfficeInvitationUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/createOfficeInvitation`;
}

function getRevokeOfficeInvitationUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/revokeOfficeInvitation`;
}

function getSendOfficeInvitationEmailUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/sendOfficeInvitationEmail`;
}

function getUpdateOfficeMemberAccessUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/updateOfficeMemberAccess`;
}

function getRequestOfficeOwnershipTransferUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/requestOfficeOwnershipTransfer`;
}

function getResolveOfficeOwnershipTransferUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/resolveOfficeOwnershipTransfer`;
}

function getResendOfficeOwnershipTransferNotificationUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/resendOfficeOwnershipTransferNotification`;
}

async function requestTrustedOfficeMemberAccessUpdate(input: {
  workspaceId: string;
  memberId: string;
  action: 'change_role' | 'suspend' | 'restore' | 'remove';
  nextRole?: Exclude<OfficeWorkspaceRole, 'owner'>;
}) {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in before changing team access.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getUpdateOfficeMemberAccessUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'member_access_update_failed',
  }))) as
    | { ok: true; workspaceId: string; memberId: string; message?: string | null }
    | { ok: false; error: string; message?: string | null };

  if (!result.ok) {
    throw new Error(result.message ?? officeMemberAccessUpdateErrorMessage(result.error));
  }
  return result;
}

function officeInvitationCreateErrorMessage(error: string) {
  if (error === 'sign_in_required') {
    return 'Sign in before inviting a teammate.';
  }
  if (error === 'team_admin_required') {
    return 'Only an owner or Office admin can create team invitations.';
  }
  if (error === 'seat_limit_reached') {
    return 'Office seats are full. Remove or suspend an unused invitation before inviting another teammate.';
  }
  if (error === 'existing_member') {
    return 'This email already belongs to an Office member in this workspace.';
  }
  if (error === 'pending_invitation') {
    return 'This email already has a pending Office invitation.';
  }
  if (error === 'workspace_not_found') {
    return 'This workspace could not be found.';
  }
  return 'Team invitation could not be created.';
}

function officeInvitationRevokeErrorMessage(error: string) {
  if (error === 'sign_in_required') {
    return 'Sign in before revoking this invitation.';
  }
  if (error === 'team_admin_required') {
    return 'Only an owner or Office admin can revoke team invitations.';
  }
  if (error === 'invitation_accepted') {
    return 'Accepted invitations cannot be revoked.';
  }
  if (error === 'invitation_revoked') {
    return 'This invitation has already been revoked.';
  }
  if (error === 'invitation_not_found' || error === 'workspace_not_found') {
    return 'This invitation could not be found.';
  }
  return 'Invitation could not be revoked.';
}

function officeInvitationAcceptErrorMessage(error: string) {
  if (error === 'sign_in_required') {
    return 'Sign in before accepting this invitation.';
  }
  if (error === 'invitation_email_mismatch') {
    return 'Sign in with the email address that received this invitation.';
  }
  if (error === 'invitation_accepted') {
    return 'This invitation has already been accepted.';
  }
  if (error === 'invitation_revoked') {
    return 'This invitation has been revoked.';
  }
  if (error === 'invitation_expired') {
    return 'This invitation has expired.';
  }
  if (error === 'invitation_not_found' || error === 'workspace_not_found') {
    return 'This invitation could not be found.';
  }
  return 'This invitation could not be accepted.';
}

function officeInvitationDeliveryErrorMessage(error: string) {
  if (error === 'team_admin_required') {
    return 'Only an owner or Office admin can send team invitations.';
  }
  if (error === 'invitation_expired') {
    return 'This invitation has expired. Create a new invitation.';
  }
  if (error === 'invitation_revoked') {
    return 'This invitation has been revoked.';
  }
  if (error === 'invitation_accepted') {
    return 'This invitation has already been accepted.';
  }
  if (error === 'invitation_not_found' || error === 'workspace_not_found') {
    return 'This invitation could not be found.';
  }
  return 'Invitation email could not be sent.';
}

function officeMemberAccessUpdateErrorMessage(error: string) {
  if (error === 'sign_in_required') {
    return 'Sign in before changing team access.';
  }
  if (error === 'team_admin_required') {
    return 'Only an owner or Office admin can change team access.';
  }
  if (error === 'owner_member_locked') {
    return 'Workspace owner access cannot be changed here.';
  }
  if (error === 'self_member_locked') {
    return 'You cannot change your own Office access.';
  }
  if (error === 'member_not_found' || error === 'workspace_not_found') {
    return 'This team member could not be found.';
  }
  if (error === 'member_removed') {
    return 'Removed members cannot be changed.';
  }
  if (error === 'member_already_active') {
    return 'This member is already active.';
  }
  if (error === 'member_already_suspended') {
    return 'This member is already suspended.';
  }
  if (error === 'member_already_removed') {
    return 'This member has already been removed.';
  }
  if (error === 'role_required' || error === 'member_action_required') {
    return 'Choose a valid team access change.';
  }
  return 'Team access could not be updated.';
}

function officeOwnershipTransferErrorMessage(error: string) {
  if (error === 'sign_in_required') {
    return 'Sign in before updating ownership transfer.';
  }
  if (error === 'owner_required') {
    return 'Only the current workspace owner can request ownership transfer.';
  }
  if (error === 'self_transfer_locked') {
    return 'Choose another active member before requesting ownership transfer.';
  }
  if (error === 'ownership_transfer_pending') {
    return 'A pending ownership transfer already exists for this workspace.';
  }
  if (error === 'target_already_owner') {
    return 'This member is already the workspace owner.';
  }
  if (error === 'target_member_inactive') {
    return 'Ownership can only be transferred to an active Office member.';
  }
  if (error === 'ownership_transfer_target_required') {
    return 'Only the receiving member can approve this ownership transfer.';
  }
  if (error === 'ownership_transfer_cancel_forbidden') {
    return 'Only the owner or receiving member can cancel this ownership transfer.';
  }
  if (error === 'ownership_transfer_notification_forbidden') {
    return 'Only the owner or receiving member can send this reminder.';
  }
  if (error === 'ownership_transfer_expired') {
    return 'This ownership transfer has expired. Create a new request.';
  }
  if (error === 'ownership_transfer_approved') {
    return 'This ownership transfer has already been approved.';
  }
  if (error === 'ownership_transfer_cancelled') {
    return 'This ownership transfer has already been cancelled.';
  }
  if (error === 'member_not_found' || error === 'workspace_not_found' || error === 'ownership_transfer_not_found') {
    return 'Ownership transfer details could not be found.';
  }
  if (error === 'ownership_transfer_notification_required' || error === 'ownership_transfer_notification_failed') {
    return 'Ownership approval reminder could not be sent.';
  }
  return 'Ownership transfer could not be updated.';
}
