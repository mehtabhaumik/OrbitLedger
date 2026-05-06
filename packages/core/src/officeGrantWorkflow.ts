import type {
  OfficeMembershipRecord,
} from './officeMembership';

export const OFFICE_ACCESS_REQUEST_STATUSES = [
  'submitted',
  'needs_review',
  'reviewing',
  'approved',
  'rejected',
  'granted',
  'cancelled',
] as const;

export type OfficeAccessRequestStatus = (typeof OFFICE_ACCESS_REQUEST_STATUSES)[number];

export const OFFICE_ACCESS_REVIEW_ACTIONS = [
  'mark_reviewing',
  'approve',
  'reject',
  'grant_access',
] as const;

export type OfficeAccessReviewAction = (typeof OFFICE_ACCESS_REVIEW_ACTIONS)[number];

export type OfficeAccessRequestedPlanId = 'office_monthly' | 'office_yearly';

export type OfficeAccessRequestRecord = {
  id: string;
  workspaceId: string;
  requesterUid: string;
  requesterName: string;
  requesterEmail: string;
  bestContactNumber: string;
  alternateContactNumber: string | null;
  businessName: string | null;
  requestedPlanId: OfficeAccessRequestedPlanId;
  status: OfficeAccessRequestStatus;
  message: string | null;
  adminQueueId: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  grantedBy: string | null;
  grantedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  lastReviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficeAccessAdminQueueRecord = {
  id: string;
  kind: 'office_access_request';
  workspaceId: string;
  requestId: string;
  requesterUid: string;
  requesterName: string;
  requesterEmail: string;
  businessName: string | null;
  requestedPlanId: OfficeAccessRequestedPlanId;
  status: OfficeAccessRequestStatus;
  reviewStatus: 'needs_review' | 'reviewing' | 'approved' | 'rejected' | 'completed';
  actionLabel: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficeAccessReviewInput = {
  request: Pick<
    OfficeAccessRequestRecord,
    'id' | 'workspaceId' | 'requesterUid' | 'requesterName' | 'requesterEmail' | 'businessName' | 'requestedPlanId' | 'status'
  >;
  action: OfficeAccessReviewAction;
  resolvedBy: string;
  note?: string | null;
  now?: Date;
};

export type OfficeAccessReviewPlan = {
  action: OfficeAccessReviewAction;
  previousStatus: OfficeAccessRequestStatus;
  nextStatus: OfficeAccessRequestStatus;
  reviewStatus: OfficeAccessAdminQueueRecord['reviewStatus'];
  canApply: boolean;
  shouldGrantEntitlement: boolean;
  shouldCreateOwnerMember: boolean;
  shouldWriteAccessAudit: boolean;
  customerMessage: string;
  adminMessage: string;
  reason: string | null;
  requestPatch: Record<string, string | null>;
  adminQueuePatch: Record<string, string | null>;
  ownerMemberDraft: Pick<
    OfficeMembershipRecord,
    'uid' | 'workspaceId' | 'role' | 'status' | 'email' | 'displayName' | 'invitedBy' | 'invitedAt' | 'acceptedAt' | 'createdAt' | 'updatedAt'
  > | null;
  accessAuditDraft: OfficeAccessRequestAuditDraft;
};

export type OfficeAccessRequestAuditDraft = {
  workspaceId: string;
  actorUid: string;
  action: 'member_accepted' | 'invitation_revoked' | 'internal_access_reviewed';
  targetUid: string | null;
  targetEmail: string | null;
  previousRole: null;
  nextRole: 'owner' | null;
  previousStatus: OfficeAccessRequestStatus;
  nextStatus: OfficeAccessRequestStatus;
  reason: string | null;
  createdAt: string;
};

export function isOfficeAccessRequestStatus(status: string): status is OfficeAccessRequestStatus {
  return OFFICE_ACCESS_REQUEST_STATUSES.includes(status as OfficeAccessRequestStatus);
}

export function isOfficeAccessReviewAction(action: string): action is OfficeAccessReviewAction {
  return OFFICE_ACCESS_REVIEW_ACTIONS.includes(action as OfficeAccessReviewAction);
}

export function buildOfficeAccessAdminQueueRecord(
  request: OfficeAccessRequestRecord
): OfficeAccessAdminQueueRecord {
  return {
    id: request.adminQueueId,
    kind: 'office_access_request',
    workspaceId: request.workspaceId,
    requestId: request.id,
    requesterUid: request.requesterUid,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail,
    businessName: request.businessName,
    requestedPlanId: request.requestedPlanId,
    status: request.status,
    reviewStatus: reviewStatusForRequestStatus(request.status),
    actionLabel: actionLabelForRequestStatus(request.status),
    note: request.lastReviewNote,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export function buildOfficeAccessReviewPlan(input: OfficeAccessReviewInput): OfficeAccessReviewPlan {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const status = input.request.status;
  const finalStatus = status === 'granted' || status === 'rejected' || status === 'cancelled';
  const note = cleanText(input.note);

  if (finalStatus) {
    return blockedPlan(input, 'Office access request is already finalized.', note, timestamp);
  }

  if (input.action === 'mark_reviewing') {
    return plan(input, {
      nextStatus: 'reviewing',
      reviewStatus: 'reviewing',
      shouldGrantEntitlement: false,
      shouldCreateOwnerMember: false,
      customerMessage: 'Office request is under review.',
      adminMessage: 'Office request marked for active review.',
      note,
      timestamp,
    });
  }

  if (input.action === 'approve') {
    return plan(input, {
      nextStatus: 'approved',
      reviewStatus: 'approved',
      shouldGrantEntitlement: false,
      shouldCreateOwnerMember: false,
      customerMessage: 'Office request is approved and waiting for access setup.',
      adminMessage: 'Office request approved. Grant access when workspace and contact details are confirmed.',
      note,
      timestamp,
    });
  }

  if (input.action === 'reject') {
    return plan(input, {
      nextStatus: 'rejected',
      reviewStatus: 'rejected',
      shouldGrantEntitlement: false,
      shouldCreateOwnerMember: false,
      customerMessage: 'Office request was not approved.',
      adminMessage: 'Office request rejected and recorded.',
      note,
      timestamp,
    });
  }

  if (input.action === 'grant_access' && status !== 'approved') {
    return blockedPlan(input, 'Approve the Office request before granting access.', note, timestamp);
  }

  return plan(input, {
    nextStatus: 'granted',
    reviewStatus: 'completed',
    shouldGrantEntitlement: true,
    shouldCreateOwnerMember: true,
    customerMessage: 'Office access is ready for this workspace.',
    adminMessage: 'Office entitlement and owner membership can be granted now.',
    note,
    timestamp,
  });
}

function plan(
  input: OfficeAccessReviewInput,
  options: {
    nextStatus: OfficeAccessRequestStatus;
    reviewStatus: OfficeAccessAdminQueueRecord['reviewStatus'];
    shouldGrantEntitlement: boolean;
    shouldCreateOwnerMember: boolean;
    customerMessage: string;
    adminMessage: string;
    note: string | null;
    timestamp: string;
  }
): OfficeAccessReviewPlan {
  const actor = input.resolvedBy || 'internal_admin';
  return {
    action: input.action,
    previousStatus: input.request.status,
    nextStatus: options.nextStatus,
    reviewStatus: options.reviewStatus,
    canApply: true,
    shouldGrantEntitlement: options.shouldGrantEntitlement,
    shouldCreateOwnerMember: options.shouldCreateOwnerMember,
    shouldWriteAccessAudit: true,
    customerMessage: options.customerMessage,
    adminMessage: options.adminMessage,
    reason: options.note,
    requestPatch: {
      status: options.nextStatus,
      reviewed_by: input.action === 'mark_reviewing' || input.action === 'approve' ? actor : null,
      reviewed_at: input.action === 'mark_reviewing' || input.action === 'approve' ? options.timestamp : null,
      granted_by: input.action === 'grant_access' ? actor : null,
      granted_at: input.action === 'grant_access' ? options.timestamp : null,
      rejected_by: input.action === 'reject' ? actor : null,
      rejected_at: input.action === 'reject' ? options.timestamp : null,
      last_review_note: options.note,
      updated_at: options.timestamp,
    },
    adminQueuePatch: {
      status: options.nextStatus,
      review_status: options.reviewStatus,
      action_label: actionLabelForRequestStatus(options.nextStatus),
      note: options.note,
      updated_at: options.timestamp,
    },
    ownerMemberDraft: options.shouldCreateOwnerMember
      ? {
          uid: input.request.requesterUid,
          workspaceId: input.request.workspaceId,
          role: 'owner',
          status: 'active',
          email: input.request.requesterEmail,
          displayName: input.request.requesterName,
          invitedBy: actor,
          invitedAt: options.timestamp,
          acceptedAt: options.timestamp,
          createdAt: options.timestamp,
          updatedAt: options.timestamp,
        }
      : null,
    accessAuditDraft: {
      workspaceId: input.request.workspaceId,
      actorUid: actor,
      action: input.action === 'grant_access' ? 'member_accepted' : input.action === 'reject' ? 'invitation_revoked' : 'internal_access_reviewed',
      targetUid: input.request.requesterUid,
      targetEmail: input.request.requesterEmail,
      previousRole: null,
      nextRole: options.shouldCreateOwnerMember ? 'owner' : null,
      previousStatus: input.request.status,
      nextStatus: options.nextStatus,
      reason: options.note,
      createdAt: options.timestamp,
    },
  };
}

function blockedPlan(
  input: OfficeAccessReviewInput,
  message: string,
  note: string | null,
  timestamp: string
): OfficeAccessReviewPlan {
  return {
    action: input.action,
    previousStatus: input.request.status,
    nextStatus: input.request.status,
    reviewStatus: reviewStatusForRequestStatus(input.request.status),
    canApply: false,
    shouldGrantEntitlement: false,
    shouldCreateOwnerMember: false,
    shouldWriteAccessAudit: false,
    customerMessage: 'Office request needs review before access can change.',
    adminMessage: message,
    reason: note,
    requestPatch: {},
    adminQueuePatch: {
      note,
      updated_at: timestamp,
    },
    ownerMemberDraft: null,
    accessAuditDraft: {
      workspaceId: input.request.workspaceId,
      actorUid: input.resolvedBy || 'internal_admin',
      action: 'internal_access_reviewed',
      targetUid: input.request.requesterUid,
      targetEmail: input.request.requesterEmail,
      previousRole: null,
      nextRole: null,
      previousStatus: input.request.status,
      nextStatus: input.request.status,
      reason: message,
      createdAt: timestamp,
    },
  };
}

function reviewStatusForRequestStatus(status: OfficeAccessRequestStatus): OfficeAccessAdminQueueRecord['reviewStatus'] {
  if (status === 'reviewing') {
    return 'reviewing';
  }
  if (status === 'approved') {
    return 'approved';
  }
  if (status === 'rejected' || status === 'cancelled') {
    return 'rejected';
  }
  if (status === 'granted') {
    return 'completed';
  }
  return 'needs_review';
}

function actionLabelForRequestStatus(status: OfficeAccessRequestStatus): string {
  if (status === 'reviewing') {
    return 'Continue review';
  }
  if (status === 'approved') {
    return 'Grant Office access';
  }
  if (status === 'granted') {
    return 'Access granted';
  }
  if (status === 'rejected') {
    return 'Request rejected';
  }
  return 'Review request';
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
