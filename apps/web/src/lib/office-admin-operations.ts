'use client';

import {
  buildOfficeAccessReviewPlan,
  buildOfficeSupportCaseAdminActionPlan,
  buildOfficeSupportReviewPlan,
  isOfficeAccessRequestStatus,
  isOfficeSupportCaseStatus,
  OFFICE_SUPPORT_REVIEW_GUARDRAILS,
  type OfficeAccessRequestRecord,
  type OfficeAccessRequestStatus,
  type OfficeAccessReviewAction,
  type OfficeAccessReviewPlan,
  type OfficeAccessRequestedPlanId,
  type OfficeSupportCaseAction,
  type OfficeSupportCaseStatus,
} from '@orbit-ledger/core';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore';

import { getWebAuth, getWebFirebaseProjectId, getWebFirestore } from './firebase';

export type WebOfficeAdminQueueRecord = {
  id: string;
  requestId: string;
  workspaceId: string;
  requesterUid: string;
  requesterName: string;
  requesterEmail: string;
  businessName: string | null;
  requestedPlanId: OfficeAccessRequestedPlanId;
  status: OfficeAccessRequestStatus;
  reviewStatus: string;
  actionLabel: string;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WebOfficeOperationsMetric = {
  id: 'requests' | 'needs_review' | 'approved' | 'granted';
  label: string;
  value: number;
  helper: string;
  tone: 'success' | 'warning' | 'premium' | 'default';
};

export type WebOfficeOperationsQueueItem = {
  id: string;
  request: OfficeAccessRequestRecord;
  adminQueue: WebOfficeAdminQueueRecord | null;
  title: string;
  detail: string;
  statusLabel: string;
  tone: 'success' | 'warning' | 'premium' | 'default';
  actionPlans: OfficeAccessReviewPlan[];
};

export type WebSupportDiagnosticConsentRecord = {
  id: string;
  userEmail: string | null;
  supportKind: string;
  supportCaseId: string | null;
  status: string;
  sanitizedMessage: string;
  approvedFields: string[];
  redactedFields: string[];
  expiresAt: string | null;
  createdAt: string | null;
  isExpired: boolean;
  isActiveForReview: boolean;
};

export type WebSupportCaseAuditEvent = {
  id: string;
  supportCaseId: string | null;
  supportConsentId: string | null;
  title: string;
  detail: string;
  actor: string;
  status: string | null;
  createdAt: string | null;
  tone: 'success' | 'warning' | 'default';
};

export type WebSupportCaseRecord = {
  id: string;
  supportCaseId: string;
  status: OfficeSupportCaseStatus;
  latestAction: OfficeSupportCaseAction;
  latestNote: string;
  latestNoteAt: string | null;
  latestNoteByEmail: string | null;
  noteCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WebSupportCaseEmailRequestRecord = {
  id: string;
  supportCaseId: string;
  recipientEmail: string | null;
  subject: string;
  deliveryStatus: 'queued' | 'pending_provider_connection' | 'sent' | 'failed';
  queuedAt: string | null;
  sentAt: string | null;
};

export type WebOfficeOperationsSnapshot = {
  metrics: WebOfficeOperationsMetric[];
  queue: WebOfficeOperationsQueueItem[];
  supportCases: WebSupportCaseRecord[];
  supportCaseEmailRequests: WebSupportCaseEmailRequestRecord[];
  supportConsents: WebSupportDiagnosticConsentRecord[];
  supportCaseEvents: WebSupportCaseAuditEvent[];
  health: {
    title: string;
    message: string;
    tone: 'success' | 'warning';
  };
};

export type ResolveWebOfficeAccessRequestResult = {
  action: OfficeAccessReviewAction;
  requestId: string;
  status: OfficeAccessRequestStatus;
  grantedEntitlement: boolean;
  message: string | null;
};

export type WebOfficeSupportReviewResult = {
  reviewId: string;
  message: string;
};

export type WebSupportCaseAdminActionResult = {
  supportCaseId: string;
  status: OfficeSupportCaseStatus;
  message: string;
};

export type WebSupportCaseFollowUpEmailResult = {
  requestId: string;
  deliveryStatus: WebSupportCaseEmailRequestRecord['deliveryStatus'];
  message: string;
};

export { OFFICE_SUPPORT_REVIEW_GUARDRAILS };

export const OFFICE_PRODUCTION_READINESS_CHECKLIST = [
  {
    id: 'functions',
    label: 'Trusted Office functions deployed',
    detail: 'Office grants, support review, consent, case updates, and email queue functions must be deployed together.',
  },
  {
    id: 'rules',
    label: 'Firestore rules deployed',
    detail: 'Office audit, support cases, consent, and email request collections must remain server-controlled.',
  },
  {
    id: 'internal_admins',
    label: 'Internal admin allowlist configured',
    detail: 'Only approved Orbit Ledger internal reviewers should see hidden Office operations.',
  },
  {
    id: 'resend_secret',
    label: 'Email provider secret ready',
    detail: 'The email provider key must be stored in Firebase Secret Manager before support emails are sent.',
  },
  {
    id: 'email_domain',
    label: 'Support email domain verified',
    detail: 'The sending domain must be verified before switching queued support emails to live sending.',
  },
  {
    id: 'app_check',
    label: 'Production App Check reviewed',
    detail: 'Verify signed-in production traffic before enabling strict enforcement for Office workflows.',
  },
] as const;

export const OFFICE_FINAL_LAUNCH_FREEZE_ITEMS = [
  'Office access model and role controls are in place.',
  'Trusted server functions own grants, support review, consent, case updates, and email queue preparation.',
  'Client apps cannot write Office audit, support case, consent, or support email records directly.',
  'Support email delivery remains provider-pending until the real email provider is connected.',
  'Office launch should now accept bug fixes, copy polish, deployment checks, and provider wiring only.',
] as const;

export function isWebOfficeOperationsAllowed(email: string | null | undefined): boolean {
  const allowlist = parseInternalAdminEmailAllowlist();
  if (!allowlist.length) {
    return process.env.NODE_ENV !== 'production';
  }

  return Boolean(email && allowlist.includes(email.trim().toLowerCase()));
}

export async function loadWebOfficeOperationsSnapshot(
  workspaceId: string
): Promise<WebOfficeOperationsSnapshot> {
  const firestore = getWebFirestore();
  const [requestSnapshot, queueSnapshot, consentSnapshot, auditSnapshot, supportCaseSnapshot, supportEmailSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'office_access_requests'),
        orderBy('updated_at', 'desc'),
        limit(50)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'office_access_admin_queue'),
        orderBy('updated_at', 'desc'),
        limit(50)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_diagnostic_consents'),
        orderBy('created_at', 'desc'),
        limit(20)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'office_access_audit'),
        orderBy('created_at', 'desc'),
        limit(80)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_cases'),
        orderBy('updated_at', 'desc'),
        limit(50)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_case_email_requests'),
        orderBy('queued_at', 'desc'),
        limit(50)
      )
    ),
  ]);

  const requests = requestSnapshot.docs.map((doc) => parseOfficeAccessRequest(doc.id, doc.data()));
  const queueRecords = new Map(
    queueSnapshot.docs.map((doc) => {
      const record = parseOfficeAdminQueueRecord(doc.id, doc.data());
      return [record.requestId, record] as const;
    })
  );

  return buildWebOfficeOperationsSnapshot({
    requests,
    adminQueue: [...queueRecords.values()],
    supportCases: supportCaseSnapshot.docs.map((doc) => parseSupportCaseRecord(doc.id, doc.data())),
    supportCaseEmailRequests: supportEmailSnapshot.docs.map((doc) => parseSupportCaseEmailRequestRecord(doc.id, doc.data())),
    supportConsents: consentSnapshot.docs.map((doc) => parseSupportDiagnosticConsentRecord(doc.id, doc.data())),
    supportCaseEvents: auditSnapshot.docs
      .map((doc) => parseSupportCaseAuditEvent(doc.id, doc.data()))
      .filter((item) => item.supportCaseId || item.supportConsentId),
  });
}

export async function queueWebSupportCaseFollowUpEmail(input: {
  workspaceId: string;
  supportCaseId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}): Promise<WebSupportCaseFollowUpEmailResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before preparing this support email.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getQueueSupportCaseFollowUpEmailUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_case_email_failed',
  }))) as
    | {
        ok: true;
        requestId: string;
        deliveryStatus: WebSupportCaseEmailRequestRecord['deliveryStatus'];
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeReviewErrorMessage(result.error));
  }

  return {
    requestId: result.requestId,
    deliveryStatus: result.deliveryStatus,
    message: result.message ?? 'Support follow-up email prepared.',
  };
}

export async function recordWebSupportCaseAdminAction(input: {
  workspaceId: string;
  supportCaseId: string;
  action: OfficeSupportCaseAction;
  note: string;
}): Promise<WebSupportCaseAdminActionResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before updating this support case.');
  }

  const plan = buildOfficeSupportCaseAdminActionPlan(input);
  if (!plan.canRecord || !plan.supportCaseId) {
    throw new Error(plan.message);
  }

  const token = await user.getIdToken();
  const response = await fetch(getRecordSupportCaseAdminActionUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      supportCaseId: plan.supportCaseId,
      action: plan.action,
      note: plan.note,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_case_update_failed',
  }))) as
    | {
        ok: true;
        supportCaseId: string;
        status: OfficeSupportCaseStatus;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeReviewErrorMessage(result.error));
  }

  return {
    supportCaseId: result.supportCaseId,
    status: result.status,
    message: result.message ?? plan.message,
  };
}

export async function resolveWebOfficeAccessRequest(input: {
  workspaceId: string;
  requestId: string;
  action: OfficeAccessReviewAction;
  note?: string | null;
}): Promise<ResolveWebOfficeAccessRequestResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before reviewing Office access.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getResolveOfficeAccessRequestUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'office_review_failed',
  }))) as
    | {
        ok: true;
        action: OfficeAccessReviewAction;
        requestId: string;
        status: OfficeAccessRequestStatus;
        grantedEntitlement: boolean;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeReviewErrorMessage(result.error));
  }

  return {
    action: result.action,
    requestId: result.requestId,
    status: result.status,
    grantedEntitlement: result.grantedEntitlement,
    message: result.message ?? null,
  };
}

export async function recordWebOfficeSupportReview(input: {
  workspaceId: string;
  reason: string;
  supportCaseId?: string | null;
  customerApprovedDiagnosticAccess?: boolean;
}): Promise<WebOfficeSupportReviewResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before recording support review.');
  }

  const plan = buildOfficeSupportReviewPlan(input);
  if (!plan.canRecord) {
    throw new Error(plan.message);
  }

  const token = await user.getIdToken();
  const response = await fetch(getRecordOfficeSupportReviewUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      reason: plan.reason,
      supportCaseId: plan.supportCaseId,
      customerApprovedDiagnosticAccess: plan.customerDataAccessAllowed,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_review_failed',
  }))) as
    | {
        ok: true;
        reviewId: string;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? officeReviewErrorMessage(result.error));
  }

  return {
    reviewId: result.reviewId,
    message: result.message ?? plan.message,
  };
}

export function buildWebOfficeOperationsSnapshot(input: {
  requests: OfficeAccessRequestRecord[];
  adminQueue: WebOfficeAdminQueueRecord[];
  supportCases?: WebSupportCaseRecord[];
  supportCaseEmailRequests?: WebSupportCaseEmailRequestRecord[];
  supportConsents?: WebSupportDiagnosticConsentRecord[];
  supportCaseEvents?: WebSupportCaseAuditEvent[];
}): WebOfficeOperationsSnapshot {
  const queueByRequestId = new Map(input.adminQueue.map((item) => [item.requestId, item]));
  const activeRequests = input.requests.filter((request) => request.status !== 'cancelled');
  const needsReview = activeRequests.filter((request) =>
    request.status === 'submitted' || request.status === 'needs_review' || request.status === 'reviewing'
  );
  const approved = activeRequests.filter((request) => request.status === 'approved');
  const granted = activeRequests.filter((request) => request.status === 'granted');
  const queue = activeRequests.map((request) => buildQueueItem(request, queueByRequestId.get(request.id) ?? null));
  const attentionCount = needsReview.length + approved.length;

  return {
    metrics: [
      {
        id: 'requests',
        label: 'Office requests',
        value: activeRequests.length,
        helper: 'Requests visible for this workspace.',
        tone: activeRequests.length ? 'default' : 'success',
      },
      {
        id: 'needs_review',
        label: 'Needs review',
        value: needsReview.length,
        helper: 'New or active reviews.',
        tone: needsReview.length ? 'warning' : 'success',
      },
      {
        id: 'approved',
        label: 'Approved',
        value: approved.length,
        helper: 'Ready for trusted grant action.',
        tone: approved.length ? 'premium' : 'success',
      },
      {
        id: 'granted',
        label: 'Granted',
        value: granted.length,
        helper: 'Office access completed.',
        tone: 'success',
      },
    ],
    queue,
    supportCases: input.supportCases ?? [],
    supportCaseEmailRequests: input.supportCaseEmailRequests ?? [],
    supportConsents: input.supportConsents ?? [],
    supportCaseEvents: input.supportCaseEvents ?? [],
    health: attentionCount
      ? {
          title: 'Office operations need review',
          message: 'Review requests carefully before granting team access.',
          tone: 'warning',
        }
      : {
          title: 'Office operations are clear',
          message: 'No Office access requests need action for this workspace.',
          tone: 'success',
        },
  };
}

export function parseSupportCaseEmailRequestRecord(
  id: string,
  data: DocumentData
): WebSupportCaseEmailRequestRecord {
  return {
    id,
    supportCaseId: stringValue(data.support_case_id) || stringValue(data.supportCaseId) || 'Support case',
    recipientEmail: nullableString(data.recipient_email ?? data.recipientEmail),
    subject: stringValue(data.subject) || 'Support case update',
    deliveryStatus: supportEmailDeliveryStatus(data.delivery_status ?? data.deliveryStatus),
    queuedAt: nullableString(data.queued_at ?? data.queuedAt),
    sentAt: nullableString(data.sent_at ?? data.sentAt),
  };
}

export function parseSupportCaseRecord(id: string, data: DocumentData): WebSupportCaseRecord {
  const status = stringValue(data.status);
  const latestAction = stringValue(data.latest_action) || stringValue(data.latestAction);
  return {
    id,
    supportCaseId: stringValue(data.support_case_id) || stringValue(data.supportCaseId) || id,
    status: isOfficeSupportCaseStatus(status) ? status : 'open',
    latestAction: latestAction === 'resolve' || latestAction === 'reopen' ? latestAction : 'add_note',
    latestNote: stringValue(data.latest_note) || stringValue(data.latestNote) || 'No support note recorded.',
    latestNoteAt: nullableString(data.latest_note_at ?? data.latestNoteAt),
    latestNoteByEmail: nullableString(data.latest_note_by_email ?? data.latestNoteByEmail),
    noteCount: numberValue(data.note_count ?? data.noteCount),
    createdAt: nullableString(data.created_at ?? data.createdAt),
    updatedAt: nullableString(data.updated_at ?? data.updatedAt),
  };
}

export function parseSupportCaseAuditEvent(id: string, data: DocumentData): WebSupportCaseAuditEvent {
  const supportCaseId = nullableString(data.support_case_id ?? data.supportCaseId);
  const supportConsentId = nullableString(data.support_consent_id ?? data.supportConsentId);
  const nextStatus = nullableString(data.next_status ?? data.nextStatus);
  const reason = nullableString(data.reason);
  const approved = data.customer_approved_diagnostic_access === true || data.customerApprovedDiagnosticAccess === true;
  const title = supportAuditEventTitle({
    reason,
    nextStatus,
    approved,
  });
  return {
    id,
    supportCaseId,
    supportConsentId,
    title,
    detail: reason ?? 'Support review event recorded.',
    actor:
      nullableString(data.actor_email ?? data.actorEmail) ??
      nullableString(data.actor_uid ?? data.actorUid) ??
      'Orbit Ledger',
    status: nextStatus,
    createdAt: nullableString(data.created_at ?? data.createdAt),
    tone: supportAuditEventTone(title),
  };
}

export function parseSupportDiagnosticConsentRecord(id: string, data: DocumentData): WebSupportDiagnosticConsentRecord {
  return {
    id,
    userEmail: nullableString(data.user_email ?? data.userEmail),
    supportKind: stringValue(data.support_kind) || stringValue(data.supportKind) || 'Support',
    supportCaseId: nullableString(data.support_case_id ?? data.supportCaseId),
    status: stringValue(data.status) || 'active',
    sanitizedMessage: stringValue(data.sanitized_message) || stringValue(data.sanitizedMessage) || '',
    approvedFields: stringList(data.approved_fields ?? data.approvedFields),
    redactedFields: stringList(data.redacted_fields ?? data.redactedFields),
    expiresAt: nullableString(data.expires_at ?? data.expiresAt),
    createdAt: nullableString(data.created_at ?? data.createdAt),
    isExpired: isConsentExpired(nullableString(data.expires_at ?? data.expiresAt)),
    isActiveForReview:
      (stringValue(data.status) || 'active') === 'active' &&
      !isConsentExpired(nullableString(data.expires_at ?? data.expiresAt)),
  };
}

export function parseOfficeAccessRequest(id: string, data: DocumentData): OfficeAccessRequestRecord {
  const status = stringValue(data.status);
  return {
    id,
    workspaceId: stringValue(data.workspace_id) || stringValue(data.workspaceId) || '',
    requesterUid: stringValue(data.requester_uid) || stringValue(data.requesterUid) || '',
    requesterName: stringValue(data.requester_name) || stringValue(data.requesterName) || 'Requester',
    requesterEmail: stringValue(data.requester_email) || stringValue(data.requesterEmail) || '',
    bestContactNumber: stringValue(data.best_contact_number) || stringValue(data.bestContactNumber) || '',
    alternateContactNumber: nullableString(data.alternate_contact_number ?? data.alternateContactNumber),
    businessName: nullableString(data.business_name ?? data.businessName),
    requestedPlanId: requestedPlanId(data.requested_plan_id ?? data.requestedPlanId),
    status: isOfficeAccessRequestStatus(status) ? status : 'needs_review',
    message: nullableString(data.message),
    adminQueueId: stringValue(data.admin_queue_id) || stringValue(data.adminQueueId) || '',
    reviewedBy: nullableString(data.reviewed_by ?? data.reviewedBy),
    reviewedAt: nullableString(data.reviewed_at ?? data.reviewedAt),
    grantedBy: nullableString(data.granted_by ?? data.grantedBy),
    grantedAt: nullableString(data.granted_at ?? data.grantedAt),
    rejectedBy: nullableString(data.rejected_by ?? data.rejectedBy),
    rejectedAt: nullableString(data.rejected_at ?? data.rejectedAt),
    lastReviewNote: nullableString(data.last_review_note ?? data.lastReviewNote),
    createdAt: stringValue(data.created_at) || stringValue(data.createdAt) || '',
    updatedAt: stringValue(data.updated_at) || stringValue(data.updatedAt) || '',
  };
}

export function parseOfficeAdminQueueRecord(id: string, data: DocumentData): WebOfficeAdminQueueRecord {
  const status = stringValue(data.status);
  return {
    id,
    requestId: stringValue(data.request_id) || stringValue(data.requestId) || '',
    workspaceId: stringValue(data.workspace_id) || stringValue(data.workspaceId) || '',
    requesterUid: stringValue(data.requester_uid) || stringValue(data.requesterUid) || '',
    requesterName: stringValue(data.requester_name) || stringValue(data.requesterName) || 'Requester',
    requesterEmail: stringValue(data.requester_email) || stringValue(data.requesterEmail) || '',
    businessName: nullableString(data.business_name ?? data.businessName),
    requestedPlanId: requestedPlanId(data.requested_plan_id ?? data.requestedPlanId),
    status: isOfficeAccessRequestStatus(status) ? status : 'needs_review',
    reviewStatus: stringValue(data.review_status) || stringValue(data.reviewStatus) || 'needs_review',
    actionLabel: stringValue(data.action_label) || stringValue(data.actionLabel) || 'Review request',
    note: nullableString(data.note),
    createdAt: nullableString(data.created_at ?? data.createdAt),
    updatedAt: nullableString(data.updated_at ?? data.updatedAt),
  };
}

function buildQueueItem(
  request: OfficeAccessRequestRecord,
  adminQueue: WebOfficeAdminQueueRecord | null
): WebOfficeOperationsQueueItem {
  const actionPlans = officeReviewActionsForStatus(request.status).map((action) =>
    buildOfficeAccessReviewPlan({
      request,
      action,
      resolvedBy: 'internal_admin',
    })
  );
  return {
    id: request.id,
    request,
    adminQueue,
    title: request.businessName ? `${request.businessName} Office request` : 'Office access request',
    detail: [request.requesterName, request.requesterEmail, request.bestContactNumber].filter(Boolean).join(' · '),
    statusLabel: officeRequestStatusLabel(request.status),
    tone: officeRequestTone(request.status),
    actionPlans,
  };
}

function officeReviewActionsForStatus(status: OfficeAccessRequestStatus): OfficeAccessReviewAction[] {
  if (status === 'approved') {
    return ['grant_access', 'reject'];
  }
  if (status === 'granted' || status === 'rejected' || status === 'cancelled') {
    return [];
  }
  return ['mark_reviewing', 'approve', 'reject'];
}

function officeRequestStatusLabel(status: OfficeAccessRequestStatus): string {
  return status
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function officeRequestTone(status: OfficeAccessRequestStatus): WebOfficeOperationsQueueItem['tone'] {
  if (status === 'granted') {
    return 'success';
  }
  if (status === 'approved') {
    return 'premium';
  }
  if (status === 'rejected' || status === 'cancelled') {
    return 'default';
  }
  return 'warning';
}

function supportAuditEventTitle(input: { reason: string | null; nextStatus: string | null; approved: boolean }) {
  const reason = input.reason?.toLowerCase() ?? '';
  if (input.nextStatus === 'resolved' || reason.includes('case resolved')) {
    return 'Case resolved';
  }
  if (input.nextStatus === 'reopened' || reason.includes('case reopened')) {
    return 'Case reopened';
  }
  if (input.nextStatus === 'open' || reason.includes('case note added')) {
    return 'Case note saved';
  }
  if (input.nextStatus === 'revoked' || reason.includes('revoked')) {
    return 'Approval revoked';
  }
  if (input.nextStatus === 'expired' || reason.includes('expired')) {
    return 'Approval expired';
  }
  if (input.approved || reason.includes('approved')) {
    return 'Approval saved';
  }
  if (reason.includes('recorded')) {
    return 'Support review recorded';
  }
  return 'Support event';
}

function supportAuditEventTone(title: string): WebSupportCaseAuditEvent['tone'] {
  if (title === 'Approval saved' || title === 'Case resolved') {
    return 'success';
  }
  if (title === 'Approval revoked' || title === 'Approval expired' || title === 'Case reopened') {
    return 'warning';
  }
  return 'default';
}

function requestedPlanId(value: unknown): OfficeAccessRequestedPlanId {
  return value === 'office_monthly' ? 'office_monthly' : 'office_yearly';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown): string | null {
  const text = stringValue(value);
  return text || null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean).slice(0, 24)
    : [];
}

function isConsentExpired(value: string | null) {
  if (!value) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function parseInternalAdminEmailAllowlist(): string[] {
  return (process.env.NEXT_PUBLIC_ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getResolveOfficeAccessRequestUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/resolveOfficeAccessRequest`;
}

function getRecordOfficeSupportReviewUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/recordOfficeSupportReview`;
}

function getRecordSupportCaseAdminActionUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/recordSupportCaseAdminAction`;
}

function getQueueSupportCaseFollowUpEmailUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/queueSupportCaseFollowUpEmail`;
}

function officeReviewErrorMessage(error: string) {
  if (error === 'internal_admin_required') {
    return 'This account is not enabled for Office review.';
  }
  if (error === 'support_review_required') {
    return 'Add a short support reason before recording review.';
  }
  if (error === 'support_case_update_required') {
    return 'Add a support case and note before saving this update.';
  }
  if (error === 'support_case_email_required') {
    return 'Add a valid recipient, subject, and message before preparing this email.';
  }
  if (error === 'office_request_not_ready') {
    return 'Approve the Office request before granting access.';
  }
  if (error === 'office_request_finalized') {
    return 'This Office request is already finalized.';
  }
  return 'Office review action could not be completed.';
}

function supportEmailDeliveryStatus(value: unknown): WebSupportCaseEmailRequestRecord['deliveryStatus'] {
  return value === 'queued' || value === 'sent' || value === 'failed' ? value : 'pending_provider_connection';
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}
