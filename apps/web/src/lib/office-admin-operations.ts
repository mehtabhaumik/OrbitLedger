'use client';

import {
  buildOfficeAccessReviewPlan,
  buildOfficeSupportCaseAdminActionPlan,
  buildOfficeSupportReviewPlan,
  canSupportRoleExportReports,
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
  type PlatformAdminRole,
  type SupportResolutionReason,
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
import { getWebOperationsEmailAllowlist, getWebPlatformAdminEmailAllowlist } from './platform-admin-access';

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
  ticketId: string | null;
  supportCaseId: string | null;
  supportConsentId: string | null;
  kind: string | null;
  actorRole: string | null;
  queueId: string | null;
  title: string;
  detail: string;
  actor: string;
  status: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  resolutionReason: string | null;
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

export type WebSupportTicketRecord = {
  id: string;
  ticketId: string;
  supportCaseId: string | null;
  queueId: string;
  priority: string;
  status: string;
  resolutionState: string;
  resolutionReason: string | null;
  subject: string;
  summary: string;
  customerEmail: string | null;
  customerName: string | null;
  activeConsentId: string | null;
  linkedConsentIds: string[];
  latestMessageId: string | null;
  latestMessageAt: string | null;
  firstResponseDueAt: string | null;
  slaDueAt: string | null;
  lastCustomerMessageAt: string | null;
  operatorFirstRepliedAt: string | null;
  notificationTone: 'soft' | 'standard' | 'urgent';
  currentAssignmentId: string | null;
  lastActorRole: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WebSupportMessageRecord = {
  id: string;
  ticketId: string;
  supportCaseId: string | null;
  kind: string;
  actorRole: string;
  actorEmail: string | null;
  visibleToCustomer: boolean;
  body: string;
  createdAt: string | null;
};

export type WebSupportCaseEmailRequestRecord = {
  id: string;
  supportCaseId: string;
  recipientEmail: string | null;
  subject: string;
  body: string;
  replyAction: 'reply' | 'close_with_reply' | 'close_silently' | 'reopen_with_reply';
  deliveryStatus: 'queued' | 'pending_provider_connection' | 'sent' | 'failed';
  queuedByEmail: string | null;
  queuedAt: string | null;
  sentAt: string | null;
};

export type WebSupportAssignmentRecord = {
  id: string;
  ticketId: string;
  supportCaseId: string | null;
  queueId: string;
  assignedRole: PlatformAdminRole;
  assignedAdminUid: string | null;
  assignedAdminEmail: string | null;
  assignedByUid: string | null;
  assignedByRole: PlatformAdminRole | null;
  status: string;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WebSupportQueueRecord = {
  id: string;
  label: string;
  description: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WebSupportAdminContext = {
  uid: string;
  email: string | null;
  role: PlatformAdminRole;
  supportCapability: {
    readAll: boolean;
    auditAll: boolean;
    mutateAll: boolean;
    allowedQueues: string[];
    canAssignTickets: boolean;
    canSendReplies: boolean;
    canAddInternalNotes: boolean;
    canChangeStatus: boolean;
    canViewDiagnostics: boolean;
    canExportReports: boolean;
  };
};

export type WebSupportNotificationPreferenceRecord = {
  id: string;
  workspaceId: string;
  adminUid: string;
  adminRole: PlatformAdminRole;
  muteAll: boolean;
  desktopAlertsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  browserPermissionState: 'default' | 'denied' | 'granted' | null;
  soundEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  lastViewedSupportAt: string | null;
  updatedAt: string | null;
};

export type WebSupportAuditRecord = {
  id: string;
  source: 'message' | 'event' | 'assignment' | 'email_request';
  ticketId: string | null;
  supportCaseId: string | null;
  queueId: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  status: string | null;
  resolutionReason: string | null;
  title: string;
  detail: string;
  createdAt: string | null;
  visibleToCustomer: boolean;
  tone: 'success' | 'warning' | 'default';
};

export type WebSupportAuditFilters = {
  supportCaseId?: string | null;
  queueId?: string | null;
  actorRole?: string | null;
  ticketStatus?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
};

export type WebSupportReportType =
  | 'ticket_registry'
  | 'assignment_log'
  | 'reply_delivery'
  | 'diagnostic_consents'
  | 'audit_trail';

export type WebSupportReportAction = 'download_csv' | 'print_report';

export type WebSupportReportColumn = {
  key: string;
  label: string;
};

export type WebSupportReport = {
  type: WebSupportReportType;
  title: string;
  description: string;
  generatedAt: string;
  generatedBy: string;
  adminRole: PlatformAdminRole;
  filters: string[];
  columns: WebSupportReportColumn[];
  rows: Array<Record<string, string>>;
};

export type WebOfficeOperationsSnapshot = {
  metrics: WebOfficeOperationsMetric[];
  queue: WebOfficeOperationsQueueItem[];
  supportCases: WebSupportCaseRecord[];
  supportTickets: WebSupportTicketRecord[];
  supportMessages: WebSupportMessageRecord[];
  supportAssignments: WebSupportAssignmentRecord[];
  supportQueues: WebSupportQueueRecord[];
  supportCaseEmailRequests: WebSupportCaseEmailRequestRecord[];
  supportConsents: WebSupportDiagnosticConsentRecord[];
  supportCaseEvents: WebSupportCaseAuditEvent[];
  supportNotificationPreference: WebSupportNotificationPreferenceRecord | null;
  currentAdmin: WebSupportAdminContext | null;
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

export type WebSupportReplyAction = 'reply' | 'close_with_reply' | 'close_silently' | 'reopen_with_reply';

export type WebSupportReplyResult = {
  supportCaseId: string;
  ticketId: string;
  status: OfficeSupportCaseStatus;
  deliveryStatus: WebSupportCaseEmailRequestRecord['deliveryStatus'] | null;
  messageId: string;
  emailRequestId: string | null;
  message: string;
};

export type WebSupportCaseFollowUpEmailResult = {
  requestId: string;
  deliveryStatus: WebSupportCaseEmailRequestRecord['deliveryStatus'];
  message: string;
};

export type WebSupportTicketAssignmentResult = {
  ticketId: string;
  supportCaseId: string;
  queueId: string;
  assignedRole: PlatformAdminRole;
  assignedAdminUid: string | null;
  assignedAdminEmail: string | null;
  assignmentId: string;
  status: string;
  message: string;
};

export type WebSupportReportEventResult = {
  reportId: string;
  message: string;
};

export type WebSupportNotificationPreferenceResult = {
  preference: WebSupportNotificationPreferenceRecord;
  message: string;
};

type WebOfficeSupportServerSnapshot = {
  currentAdmin: WebSupportAdminContext | null;
  supportCases: Array<{ id: string } & Record<string, unknown>>;
  supportTickets: Array<{ id: string } & Record<string, unknown>>;
  supportMessages: Array<{ id: string } & Record<string, unknown>>;
  supportAssignments: Array<{ id: string } & Record<string, unknown>>;
  supportQueues: Array<{ id: string } & Record<string, unknown>>;
  supportCaseEmailRequests: Array<{ id: string } & Record<string, unknown>>;
  supportConsents: Array<{ id: string } & Record<string, unknown>>;
  supportCaseEvents: Array<{ id: string } & Record<string, unknown>>;
  supportNotificationPreference?: ({ id: string } & Record<string, unknown>) | null;
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
  const user = getWebAuth().currentUser;
  const [
    requestSnapshot,
    queueSnapshot,
    consentSnapshot,
    auditSnapshot,
    supportCaseSnapshot,
    supportEmailSnapshot,
    supportTicketSnapshot,
    supportMessageSnapshot,
    supportEventSnapshot,
    supportServerSnapshot,
  ] = await Promise.all([
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'office_access_requests'),
        orderBy('updated_at', 'desc'),
        limit(50)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'office_access_admin_queue'),
        orderBy('updated_at', 'desc'),
        limit(50)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_diagnostic_consents'),
        orderBy('created_at', 'desc'),
        limit(20)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'office_access_audit'),
        orderBy('created_at', 'desc'),
        limit(80)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_cases'),
        orderBy('updated_at', 'desc'),
        limit(120)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_case_email_requests'),
        orderBy('queued_at', 'desc'),
        limit(160)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_tickets'),
        orderBy('updated_at', 'desc'),
        limit(120)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_messages'),
        orderBy('created_at', 'desc'),
        limit(400)
      )
    ).catch(() => null),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'support_events'),
        orderBy('created_at', 'desc'),
        limit(400)
      )
    ).catch(() => null),
    loadWebOfficeSupportServerSnapshot(workspaceId, user).catch(() => null),
  ]);

  const requests = (requestSnapshot?.docs ?? []).map((doc) => parseOfficeAccessRequest(doc.id, doc.data()));
  const queueRecords = new Map(
    (queueSnapshot?.docs ?? []).map((doc) => {
      const record = parseOfficeAdminQueueRecord(doc.id, doc.data());
      return [record.requestId, record] as const;
    })
  );

  return buildWebOfficeOperationsSnapshot({
    requests,
    adminQueue: [...queueRecords.values()],
    currentAdmin: supportServerSnapshot?.currentAdmin ?? null,
    supportCases: supportServerSnapshot?.supportCases?.length
      ? supportServerSnapshot.supportCases.map((record) => parseSupportCaseRecord(record.id, record))
      : (supportCaseSnapshot?.docs ?? []).map((doc) => parseSupportCaseRecord(doc.id, doc.data())),
    supportTickets: supportServerSnapshot?.supportTickets?.length
      ? supportServerSnapshot.supportTickets.map((record) => parseSupportTicketRecord(record.id, record))
      : (supportTicketSnapshot?.docs ?? []).map((doc) => parseSupportTicketRecord(doc.id, doc.data())),
    supportMessages: supportServerSnapshot?.supportMessages?.length
      ? supportServerSnapshot.supportMessages.map((record) => parseSupportMessageRecord(record.id, record))
      : (supportMessageSnapshot?.docs ?? []).map((doc) => parseSupportMessageRecord(doc.id, doc.data())),
    supportAssignments: supportServerSnapshot?.supportAssignments?.length
      ? supportServerSnapshot.supportAssignments.map((record) => parseSupportAssignmentRecord(record.id, record))
      : [],
    supportQueues: supportServerSnapshot?.supportQueues?.length
      ? supportServerSnapshot.supportQueues.map((record) => parseSupportQueueRecord(record.id, record))
      : [],
    supportCaseEmailRequests: supportServerSnapshot?.supportCaseEmailRequests?.length
      ? supportServerSnapshot.supportCaseEmailRequests.map((record) => parseSupportCaseEmailRequestRecord(record.id, record))
      : (supportEmailSnapshot?.docs ?? []).map((doc) => parseSupportCaseEmailRequestRecord(doc.id, doc.data())),
    supportConsents: supportServerSnapshot?.supportConsents?.length
      ? supportServerSnapshot.supportConsents.map((record) => parseSupportDiagnosticConsentRecord(record.id, record))
      : (consentSnapshot?.docs ?? []).map((doc) => parseSupportDiagnosticConsentRecord(doc.id, doc.data())),
    supportCaseEvents: (
      supportServerSnapshot?.supportCaseEvents?.length
        ? supportServerSnapshot.supportCaseEvents.map((record) => parseSupportCaseAuditEvent(record.id, record))
        : [
            ...(auditSnapshot?.docs ?? []).map((doc) => parseSupportCaseAuditEvent(doc.id, doc.data())),
            ...(supportEventSnapshot?.docs ?? []).map((doc) => parseSupportCaseAuditEvent(doc.id, doc.data())),
          ]
    )
      .filter((item) => item.supportCaseId || item.supportConsentId || item.ticketId)
      .sort((left, right) => sortIsoDesc(left.createdAt, right.createdAt)),
    supportNotificationPreference: supportServerSnapshot?.supportNotificationPreference
      ? parseSupportNotificationPreferenceRecord(
          supportServerSnapshot.supportNotificationPreference.id,
          supportServerSnapshot.supportNotificationPreference
        )
      : null,
  });
}

export async function queueWebSupportCaseFollowUpEmail(input: {
  workspaceId: string;
  supportCaseId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  expectedTicketUpdatedAt?: string | null;
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
    body: JSON.stringify({
      ...input,
      expectedTicketUpdatedAt: input.expectedTicketUpdatedAt ?? null,
    }),
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

export async function sendWebSupportReply(input: {
  workspaceId: string;
  supportCaseId: string;
  ticketId: string;
  recipientEmail?: string | null;
  subject?: string | null;
  body: string;
  action: WebSupportReplyAction;
  resolutionReason?: SupportResolutionReason | null;
  expectedTicketUpdatedAt?: string | null;
}): Promise<WebSupportReplyResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before sending this support reply.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getSendOfficeSupportReplyUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      supportCaseId: input.supportCaseId,
      ticketId: input.ticketId,
      recipientEmail: input.recipientEmail ?? null,
      subject: input.subject ?? null,
      body: input.body,
      action: input.action,
      resolutionReason: input.resolutionReason ?? null,
      expectedTicketUpdatedAt: input.expectedTicketUpdatedAt ?? null,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_reply_failed',
  }))) as
    | ({ ok: true } & Record<string, unknown>)
    | { ok: false; error: string; message?: string | null };

  if (!response.ok || !result.ok) {
    throw new Error(stringValue('message' in result ? result.message : null) || officeReviewErrorMessage(result.ok ? 'support_reply_failed' : result.error));
  }

  return {
    supportCaseId: stringValue(result.supportCaseId) || input.supportCaseId,
    ticketId: stringValue(result.ticketId) || input.ticketId,
    status: (stringValue(result.status) || 'open') as OfficeSupportCaseStatus,
    deliveryStatus: nullableString(result.deliveryStatus) as WebSupportCaseEmailRequestRecord['deliveryStatus'] | null,
    messageId: stringValue(result.messageId) || '',
    emailRequestId: nullableString(result.emailRequestId),
    message: stringValue(result.message) || 'Customer reply saved.',
  };
}

export async function recordWebSupportCaseAdminAction(input: {
  workspaceId: string;
  supportCaseId: string;
  action: OfficeSupportCaseAction;
  note: string;
  resolutionReason?: SupportResolutionReason | null;
  expectedTicketUpdatedAt?: string | null;
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
      resolutionReason: plan.resolutionReason,
      expectedTicketUpdatedAt: input.expectedTicketUpdatedAt ?? null,
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

export async function recordWebSupportTicketAssignment(input: {
  workspaceId: string;
  supportCaseId: string;
  ticketId: string;
  queueId: string;
  assignedRole: PlatformAdminRole;
  assignedAdminUid?: string | null;
  assignedAdminEmail?: string | null;
  reason: string;
  expectedTicketUpdatedAt?: string | null;
}): Promise<WebSupportTicketAssignmentResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before assigning this support ticket.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getAssignOfficeSupportTicketUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      supportCaseId: input.supportCaseId,
      ticketId: input.ticketId,
      queueId: input.queueId,
      assignedRole: input.assignedRole,
      assignedAdminUid: input.assignedAdminUid ?? null,
      assignedAdminEmail: input.assignedAdminEmail ?? null,
      reason: input.reason,
      expectedTicketUpdatedAt: input.expectedTicketUpdatedAt ?? null,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_assignment_failed',
  }))) as
    | ({ ok: true } & Record<string, unknown>)
    | { ok: false; error: string; message?: string | null };

  if (!response.ok || !result.ok) {
    throw new Error(stringValue('message' in result ? result.message : null) || officeReviewErrorMessage(result.ok ? 'support_assignment_failed' : result.error));
  }

  return {
    ticketId: stringValue(result.ticketId) || input.ticketId,
    supportCaseId: stringValue(result.supportCaseId) || input.supportCaseId,
    queueId: stringValue(result.queueId) || input.queueId,
    assignedRole: (stringValue(result.assignedRole) || input.assignedRole) as PlatformAdminRole,
    assignedAdminUid: nullableString(result.assignedAdminUid),
    assignedAdminEmail: nullableString(result.assignedAdminEmail),
    assignmentId: stringValue(result.assignmentId) || '',
    status: stringValue(result.status) || 'assigned',
    message: stringValue(result.message) || 'Ticket assignment saved.',
  };
}

export async function recordWebOfficeSupportReportEvent(input: {
  workspaceId: string;
  action: WebSupportReportAction;
  report: Pick<WebSupportReport, 'type' | 'title' | 'generatedAt' | 'generatedBy' | 'adminRole' | 'filters' | 'rows'>;
  supportCaseId?: string | null;
  ticketId?: string | null;
  queueId?: string | null;
}): Promise<WebSupportReportEventResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before exporting this support report.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getRecordOfficeSupportReportEventUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      action: input.action,
      reportType: input.report.type,
      reportTitle: input.report.title,
      generatedAt: input.report.generatedAt,
      generatedBy: input.report.generatedBy,
      adminRole: input.report.adminRole,
      filters: input.report.filters,
      rowCount: input.report.rows.length,
      supportCaseId: input.supportCaseId ?? null,
      ticketId: input.ticketId ?? null,
      queueId: input.queueId ?? null,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_report_action_failed',
  }))) as
    | {
        ok: true;
        reportId: string;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? officeReviewErrorMessage(result.ok ? 'support_report_action_failed' : result.error));
  }

  return {
    reportId: result.reportId,
    message: result.message ?? 'Support report export recorded.',
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
  currentAdmin?: WebSupportAdminContext | null;
  supportCases?: WebSupportCaseRecord[];
  supportTickets?: WebSupportTicketRecord[];
  supportMessages?: WebSupportMessageRecord[];
  supportAssignments?: WebSupportAssignmentRecord[];
  supportQueues?: WebSupportQueueRecord[];
  supportCaseEmailRequests?: WebSupportCaseEmailRequestRecord[];
  supportConsents?: WebSupportDiagnosticConsentRecord[];
  supportCaseEvents?: WebSupportCaseAuditEvent[];
  supportNotificationPreference?: WebSupportNotificationPreferenceRecord | null;
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
    currentAdmin: input.currentAdmin ?? null,
    supportCases: input.supportCases ?? [],
    supportTickets: input.supportTickets ?? [],
    supportMessages: input.supportMessages ?? [],
    supportAssignments: input.supportAssignments ?? [],
    supportQueues: input.supportQueues ?? [],
    supportCaseEmailRequests: input.supportCaseEmailRequests ?? [],
    supportConsents: input.supportConsents ?? [],
    supportCaseEvents: input.supportCaseEvents ?? [],
    supportNotificationPreference: input.supportNotificationPreference ?? null,
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

export function buildWebSupportAuditRecords(input: {
  supportTickets: WebSupportTicketRecord[];
  supportMessages: WebSupportMessageRecord[];
  supportAssignments: WebSupportAssignmentRecord[];
  supportCaseEmailRequests: WebSupportCaseEmailRequestRecord[];
  supportCaseEvents: WebSupportCaseAuditEvent[];
}): WebSupportAuditRecord[] {
  const ticketByCaseId = new Map(
    input.supportTickets
      .filter((ticket) => ticket.supportCaseId)
      .map((ticket) => [ticket.supportCaseId as string, ticket] as const)
  );
  const assignmentByTicketId = new Map(
    input.supportAssignments.map((assignment) => [assignment.ticketId, assignment] as const)
  );

  const records: WebSupportAuditRecord[] = [
    ...input.supportMessages.map((message) => {
      const ticket = message.supportCaseId ? ticketByCaseId.get(message.supportCaseId) ?? null : null;
      return {
        id: `message:${message.id}`,
        source: 'message' as const,
        ticketId: message.ticketId || ticket?.id || null,
        supportCaseId: message.supportCaseId,
        queueId: ticket?.queueId ?? assignmentByTicketId.get(message.ticketId)?.queueId ?? null,
        actorRole: message.actorRole,
        actorEmail: message.actorEmail,
        status: ticket?.status ?? null,
        resolutionReason: ticket?.resolutionReason ?? null,
        title: supportMessageKindLabel(message.kind),
        detail: message.body,
        createdAt: message.createdAt,
        visibleToCustomer: message.visibleToCustomer,
        tone: supportMessageTone(message.kind),
      };
    }),
    ...input.supportAssignments.map((assignment) => {
      const ticket = ticketByCaseId.get(assignment.supportCaseId ?? '') ?? null;
      const tone: WebSupportAuditRecord['tone'] = assignment.status === 'reassigned' ? 'warning' : 'default';
      return {
        id: `assignment:${assignment.id}`,
        source: 'assignment' as const,
        ticketId: assignment.ticketId,
        supportCaseId: assignment.supportCaseId,
        queueId: assignment.queueId,
        actorRole: assignment.assignedByRole,
        actorEmail: assignment.assignedAdminEmail,
        status: ticket?.status ?? null,
        resolutionReason: ticket?.resolutionReason ?? null,
        title: assignment.status === 'reassigned' ? 'Ticket reassigned' : 'Ticket assigned',
        detail: assignment.reason ?? 'Queue ownership updated.',
        createdAt: assignment.updatedAt ?? assignment.createdAt,
        visibleToCustomer: false,
        tone,
      };
    }),
    ...input.supportCaseEmailRequests.map((request) => {
      const ticket = ticketByCaseId.get(request.supportCaseId) ?? null;
      const tone: WebSupportAuditRecord['tone'] =
        request.deliveryStatus === 'failed'
          ? 'warning'
          : request.deliveryStatus === 'sent'
            ? 'success'
            : 'default';
      return {
        id: `email:${request.id}`,
        source: 'email_request' as const,
        ticketId: ticket?.id ?? null,
        supportCaseId: request.supportCaseId,
        queueId: ticket?.queueId ?? null,
        actorRole: null,
        actorEmail: request.queuedByEmail,
        status: ticket?.status ?? null,
        resolutionReason: ticket?.resolutionReason ?? null,
        title: `Outbound ${supportReplyActionLabel(request.replyAction)}`,
        detail: request.body,
        createdAt: request.sentAt ?? request.queuedAt,
        visibleToCustomer: request.replyAction !== 'close_silently',
        tone,
      };
    }),
    ...input.supportCaseEvents.map((event) => ({
      id: `event:${event.id}`,
      source: 'event' as const,
      ticketId: event.ticketId,
      supportCaseId: event.supportCaseId,
      queueId: event.queueId,
      actorRole: event.actorRole,
      actorEmail: extractActorEmail(event.actor),
      status: event.statusAfter ?? event.status ?? null,
      resolutionReason: event.resolutionReason,
      title: event.title,
      detail: event.detail,
      createdAt: event.createdAt,
      visibleToCustomer: false,
      tone: event.tone,
    })),
  ];

  return records.sort((left, right) => sortIsoDesc(left.createdAt, right.createdAt));
}

export function filterWebSupportAuditRecords(
  records: WebSupportAuditRecord[],
  filters: WebSupportAuditFilters
): WebSupportAuditRecord[] {
  const fromAt = normalizeDateFloor(filters.dateFrom);
  const toAt = normalizeDateCeiling(filters.dateTo);
  const actorRole = nullableString(filters.actorRole);
  const ticketStatus = nullableString(filters.ticketStatus);
  const supportCaseId = nullableString(filters.supportCaseId);
  const queueId = nullableString(filters.queueId);
  const search = nullableString(filters.search)?.toLowerCase();

  return records.filter((record) => {
    const createdAt = record.createdAt ? Date.parse(record.createdAt) : NaN;
    if (fromAt !== null && Number.isFinite(createdAt) && createdAt < fromAt) {
      return false;
    }
    if (toAt !== null && Number.isFinite(createdAt) && createdAt > toAt) {
      return false;
    }
    if (supportCaseId && record.supportCaseId !== supportCaseId) {
      return false;
    }
    if (queueId && record.queueId !== queueId) {
      return false;
    }
    if (actorRole && (record.actorRole ?? '') !== actorRole) {
      return false;
    }
    if (ticketStatus && (record.status ?? '') !== ticketStatus) {
      return false;
    }
    if (search) {
      const haystack = [
        record.supportCaseId ?? '',
        record.queueId ?? '',
        record.actorRole ?? '',
        record.actorEmail ?? '',
        record.status ?? '',
        record.title,
        record.detail,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export function buildWebSupportReport(input: {
  type: WebSupportReportType;
  generatedAt: string;
  generatedBy: string;
  adminRole: PlatformAdminRole;
  filters: WebSupportAuditFilters;
  supportTickets: WebSupportTicketRecord[];
  supportAssignments: WebSupportAssignmentRecord[];
  supportCaseEmailRequests: WebSupportCaseEmailRequestRecord[];
  supportConsents: WebSupportDiagnosticConsentRecord[];
  auditRecords: WebSupportAuditRecord[];
}): WebSupportReport {
  const filterLabels = describeSupportAuditFilters(input.filters);
  if (input.type === 'ticket_registry') {
    const filteredTickets = input.supportTickets.filter((ticket) => matchesTicketAuditFilters(ticket, input.filters));
    return {
      type: input.type,
      title: 'Support Ticket Registry Report',
      description: 'Current support ticket coverage for the selected workspace view.',
      generatedAt: input.generatedAt,
      generatedBy: input.generatedBy,
      adminRole: input.adminRole,
      filters: filterLabels,
      columns: [
        { key: 'case_id', label: 'Case ID' },
        { key: 'queue', label: 'Queue' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status' },
        { key: 'resolution', label: 'Resolution' },
        { key: 'customer', label: 'Customer' },
        { key: 'updated_at', label: 'Updated' },
      ],
      rows: filteredTickets.map((ticket) => ({
        case_id: ticket.supportCaseId ?? ticket.ticketId,
        queue: supportQueueLabel(ticket.queueId),
        priority: supportPriorityLabel(ticket.priority),
        status: supportTicketStatusLabel(ticket.status),
        resolution: ticket.resolutionReason ? supportResolutionReasonLabel(ticket.resolutionReason) : ticket.resolutionState,
        customer: ticket.customerEmail ?? ticket.customerName ?? 'Unknown customer',
        updated_at: formatDate(ticket.updatedAt ?? ticket.latestMessageAt ?? ticket.createdAt),
      })),
    };
  }
  if (input.type === 'assignment_log') {
    const filteredAssignments = input.supportAssignments.filter((assignment) =>
      matchesAssignmentAuditFilters(assignment, input.filters)
    );
    return {
      type: input.type,
      title: 'Support Assignment Report',
      description: 'Queue ownership and manual routing decisions for the current support scope.',
      generatedAt: input.generatedAt,
      generatedBy: input.generatedBy,
      adminRole: input.adminRole,
      filters: filterLabels,
      columns: [
        { key: 'case_id', label: 'Case ID' },
        { key: 'queue', label: 'Queue' },
        { key: 'assigned_role', label: 'Assigned Role' },
        { key: 'assigned_admin', label: 'Assigned Admin' },
        { key: 'status', label: 'Assignment Status' },
        { key: 'reason', label: 'Reason' },
        { key: 'updated_at', label: 'Updated' },
      ],
      rows: filteredAssignments.map((assignment) => ({
        case_id: assignment.supportCaseId ?? assignment.ticketId,
        queue: supportQueueLabel(assignment.queueId),
        assigned_role: supportRoleLabel(assignment.assignedRole),
        assigned_admin: assignment.assignedAdminEmail ?? 'Unassigned',
        status: assignment.status,
        reason: assignment.reason ?? 'No reason recorded',
        updated_at: formatDate(assignment.updatedAt ?? assignment.createdAt),
      })),
    };
  }
  if (input.type === 'reply_delivery') {
    const filteredReplies = input.supportCaseEmailRequests.filter((request) =>
      matchesEmailAuditFilters(request, input.filters)
    );
    return {
      type: input.type,
      title: 'Support Reply Delivery Report',
      description: 'Customer-visible reply preparation and delivery outcomes.',
      generatedAt: input.generatedAt,
      generatedBy: input.generatedBy,
      adminRole: input.adminRole,
      filters: filterLabels,
      columns: [
        { key: 'case_id', label: 'Case ID' },
        { key: 'action', label: 'Reply Action' },
        { key: 'recipient', label: 'Recipient' },
        { key: 'delivery_status', label: 'Delivery Status' },
        { key: 'queued_by', label: 'Queued By' },
        { key: 'queued_at', label: 'Queued' },
        { key: 'sent_at', label: 'Sent' },
      ],
      rows: filteredReplies.map((request) => ({
        case_id: request.supportCaseId,
        action: supportReplyActionLabel(request.replyAction),
        recipient: request.recipientEmail ?? 'No recipient',
        delivery_status: request.deliveryStatus,
        queued_by: request.queuedByEmail ?? 'Orbit Ledger',
        queued_at: formatDate(request.queuedAt),
        sent_at: formatDate(request.sentAt),
      })),
    };
  }
  if (input.type === 'diagnostic_consents') {
    const filteredConsents = input.supportConsents.filter((consent) =>
      matchesConsentAuditFilters(consent, input.filters)
    );
    return {
      type: input.type,
      title: 'Support Diagnostic Consent Report',
      description: 'Customer-approved diagnostic access linked to support cases.',
      generatedAt: input.generatedAt,
      generatedBy: input.generatedBy,
      adminRole: input.adminRole,
      filters: filterLabels,
      columns: [
        { key: 'case_id', label: 'Case ID' },
        { key: 'support_kind', label: 'Support Kind' },
        { key: 'status', label: 'Status' },
        { key: 'customer', label: 'Customer' },
        { key: 'approved_fields', label: 'Approved Fields' },
        { key: 'expires_at', label: 'Expires' },
      ],
      rows: filteredConsents.map((consent) => ({
        case_id: consent.supportCaseId ?? 'Unlinked',
        support_kind: supportKindLabel(consent.supportKind),
        status: consent.isExpired && consent.status === 'active' ? 'expired' : consent.status,
        customer: consent.userEmail ?? 'Workspace user',
        approved_fields: consent.approvedFields.join(', ') || 'No fields recorded',
        expires_at: formatDate(consent.expiresAt),
      })),
    };
  }

  return {
    type: input.type,
    title: 'Support Audit Trail Report',
    description: 'Immutable support interactions filtered for the selected audit view.',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    adminRole: input.adminRole,
    filters: filterLabels,
    columns: [
      { key: 'time', label: 'Time' },
      { key: 'case_id', label: 'Case ID' },
      { key: 'queue', label: 'Queue' },
      { key: 'actor_role', label: 'Actor Role' },
      { key: 'actor_email', label: 'Actor' },
      { key: 'status', label: 'Ticket Status' },
      { key: 'event', label: 'Event' },
      { key: 'detail', label: 'Detail' },
    ],
    rows: input.auditRecords.map((record) => ({
      time: formatDate(record.createdAt),
      case_id: record.supportCaseId ?? 'Unlinked',
      queue: supportQueueLabel(record.queueId),
      actor_role: supportActorRoleLabel(record.actorRole),
      actor_email: record.actorEmail ?? 'Orbit Ledger',
      status: supportTicketStatusLabel(record.status),
      event: record.title,
      detail: record.detail,
    })),
  };
}

export function buildWebSupportReportCsv(report: WebSupportReport): string {
  const rows = [
    [report.title],
    [
      `Generated by ${report.generatedBy}`,
      `Admin role ${supportRoleLabel(report.adminRole)}`,
      `Generated ${formatDate(report.generatedAt)}`,
    ],
    report.filters.length ? [`Filters: ${report.filters.join(' · ')}`] : [],
    [],
    report.columns.map((column) => column.label),
    ...report.rows.map((row) => report.columns.map((column) => row[column.key] ?? '')),
  ].filter((row) => row.length);

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function buildWebSupportPrintHtml(report: WebSupportReport): string {
  const filterMarkup = report.filters.length
    ? `<p><strong>Filters:</strong> ${escapeSupportReportHtml(report.filters.join(' · '))}</p>`
    : '';
  const headerCells = report.columns.map((column) => `<th>${escapeSupportReportHtml(column.label)}</th>`).join('');
  const rowMarkup = report.rows
    .map(
      (row) =>
        `<tr>${report.columns
          .map((column) => `<td>${escapeSupportReportHtml(row[column.key] ?? '')}</td>`)
          .join('')}</tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeSupportReportHtml(report.title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      body {
        margin: 0;
        padding: 32px;
        color: #172033;
        background: #ffffff;
      }
      .report-shell {
        display: grid;
        gap: 20px;
      }
      .report-header {
        display: grid;
        gap: 8px;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.2;
      }
      p {
        margin: 0;
        color: #4f5e79;
        line-height: 1.55;
      }
      .report-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 20px;
        font-size: 13px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead th {
        background: #eff5ff;
        color: #1f3452;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      th,
      td {
        padding: 12px 14px;
        border: 1px solid #dbe5f2;
        text-align: left;
        vertical-align: top;
        font-size: 13px;
      }
      tbody tr:nth-child(even) {
        background: #f9fbff;
      }
      @media print {
        body {
          padding: 14mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="report-shell">
      <header class="report-header">
        <h1>${escapeSupportReportHtml(report.title)}</h1>
        <p>${escapeSupportReportHtml(report.description)}</p>
        <div class="report-meta">
          <span><strong>Generated by:</strong> ${escapeSupportReportHtml(report.generatedBy)}</span>
          <span><strong>Admin role:</strong> ${escapeSupportReportHtml(supportRoleLabel(report.adminRole))}</span>
          <span><strong>Generated at:</strong> ${escapeSupportReportHtml(formatDate(report.generatedAt))}</span>
          <span><strong>Rows:</strong> ${report.rows.length}</span>
        </div>
        ${filterMarkup}
      </header>
      <table>
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${rowMarkup}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
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
    body: stringValue(data.body) || 'No outbound message recorded.',
    replyAction: normalizeSupportReplyAction(stringValue(data.reply_action) || stringValue(data.replyAction)),
    deliveryStatus: supportEmailDeliveryStatus(data.delivery_status ?? data.deliveryStatus),
    queuedByEmail: nullableString(data.queued_by_email ?? data.queuedByEmail),
    queuedAt: nullableString(data.queued_at ?? data.queuedAt),
    sentAt: nullableString(data.sent_at ?? data.sentAt),
  };
}

export function parseSupportTicketRecord(id: string, data: DocumentData): WebSupportTicketRecord {
  return {
    id,
    ticketId: stringValue(data.ticket_id) || stringValue(data.ticketId) || id,
    supportCaseId: nullableString(data.support_case_id ?? data.supportCaseId),
    queueId: stringValue(data.queue_id) || stringValue(data.queueId) || 'general',
    priority: stringValue(data.priority) || 'normal',
    status: stringValue(data.status) || 'opened',
    resolutionState: stringValue(data.resolution_state) || stringValue(data.resolutionState) || 'unresolved',
    resolutionReason: nullableString(data.resolution_reason ?? data.resolutionReason),
    subject: stringValue(data.subject) || 'Support request',
    summary: stringValue(data.summary) || 'No support summary recorded.',
    customerEmail: nullableString(data.customer_email ?? data.customerEmail),
    customerName: nullableString(data.customer_name ?? data.customerName),
    activeConsentId: nullableString(data.active_support_consent_id ?? data.activeSupportConsentId),
    linkedConsentIds: stringList(data.linked_support_consent_ids ?? data.linkedSupportConsentIds),
    latestMessageId: nullableString(data.latest_message_id ?? data.latestMessageId),
    latestMessageAt: nullableString(data.latest_message_at ?? data.latestMessageAt),
    firstResponseDueAt: nullableString(data.first_response_due_at ?? data.firstResponseDueAt),
    slaDueAt: nullableString(data.sla_due_at ?? data.slaDueAt),
    lastCustomerMessageAt: nullableString(data.last_customer_message_at ?? data.lastCustomerMessageAt),
    operatorFirstRepliedAt: nullableString(data.operator_first_replied_at ?? data.operatorFirstRepliedAt),
    notificationTone: supportNotificationTone(data.notification_tone ?? data.notificationTone),
    currentAssignmentId: nullableString(data.current_assignment_id ?? data.currentAssignmentId),
    lastActorRole: nullableString(data.last_actor_role ?? data.lastActorRole),
    createdAt: nullableString(data.created_at ?? data.createdAt),
    updatedAt: nullableString(data.updated_at ?? data.updatedAt),
  };
}

export function parseSupportNotificationPreferenceRecord(
  id: string,
  data: DocumentData
): WebSupportNotificationPreferenceRecord {
  return {
    id,
    workspaceId: stringValue(data.workspace_id) || stringValue(data.workspaceId) || '',
    adminUid: stringValue(data.admin_uid) || stringValue(data.adminUid) || '',
    adminRole: (stringValue(data.admin_role) || stringValue(data.adminRole) || 'read_only_admin') as PlatformAdminRole,
    muteAll: data.mute_all === true || data.muteAll === true,
    desktopAlertsEnabled: data.desktop_alerts_enabled !== false && data.desktopAlertsEnabled !== false,
    browserNotificationsEnabled: data.browser_notifications_enabled === true || data.browserNotificationsEnabled === true,
    browserPermissionState: supportNotificationPermissionState(
      data.browser_permission_state ?? data.browserPermissionState
    ),
    soundEnabled: data.sound_enabled === true || data.soundEnabled === true,
    quietHoursStart: nullableString(data.quiet_hours_start ?? data.quietHoursStart),
    quietHoursEnd: nullableString(data.quiet_hours_end ?? data.quietHoursEnd),
    lastViewedSupportAt: nullableString(data.last_viewed_support_at ?? data.lastViewedSupportAt),
    updatedAt: nullableString(data.updated_at ?? data.updatedAt),
  };
}

export async function updateWebSupportNotificationPreferences(input: {
  workspaceId: string;
  muteAll: boolean;
  desktopAlertsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  browserPermissionState?: 'default' | 'denied' | 'granted' | null;
  soundEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  lastViewedSupportAt?: string | null;
}): Promise<WebSupportNotificationPreferenceResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before saving support notification settings.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getUpdateOfficeSupportNotificationPreferencesUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      muteAll: input.muteAll,
      desktopAlertsEnabled: input.desktopAlertsEnabled,
      browserNotificationsEnabled: input.browserNotificationsEnabled,
      browserPermissionState: input.browserPermissionState ?? null,
      soundEnabled: input.soundEnabled,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      lastViewedSupportAt: input.lastViewedSupportAt ?? null,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_notification_preferences_failed',
  }))) as
    | {
        ok: true;
        preference: { id: string } & Record<string, unknown>;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? officeReviewErrorMessage(result.ok ? 'support_notification_preferences_failed' : result.error));
  }

  return {
    preference: parseSupportNotificationPreferenceRecord(result.preference.id, result.preference),
    message: result.message ?? 'Support notification preferences saved.',
  };
}

export function parseSupportMessageRecord(id: string, data: DocumentData): WebSupportMessageRecord {
  return {
    id,
    ticketId: stringValue(data.ticket_id) || stringValue(data.ticketId) || '',
    supportCaseId: nullableString(data.support_case_id ?? data.supportCaseId),
    kind: stringValue(data.kind) || 'customer_message',
    actorRole: stringValue(data.actor_role) || stringValue(data.actorRole) || 'system',
    actorEmail: nullableString(data.actor_email ?? data.actorEmail),
    visibleToCustomer: data.visible_to_customer === true || data.visibleToCustomer === true,
    body: stringValue(data.body) || 'No message body recorded.',
    createdAt: nullableString(data.created_at ?? data.createdAt),
  };
}

export function parseSupportAssignmentRecord(id: string, data: DocumentData): WebSupportAssignmentRecord {
  return {
    id,
    ticketId: stringValue(data.ticket_id) || stringValue(data.ticketId) || '',
    supportCaseId: nullableString(data.support_case_id ?? data.supportCaseId),
    queueId: stringValue(data.queue_id) || stringValue(data.queueId) || 'general',
    assignedRole: (stringValue(data.assigned_role) || stringValue(data.assignedRole) || 'support_admin') as PlatformAdminRole,
    assignedAdminUid: nullableString(data.assigned_admin_uid ?? data.assignedAdminUid),
    assignedAdminEmail: nullableString(data.assigned_admin_email ?? data.assignedAdminEmail),
    assignedByUid: nullableString(data.assigned_by_uid ?? data.assignedByUid),
    assignedByRole: nullableString(data.assigned_by_role ?? data.assignedByRole) as PlatformAdminRole | null,
    status: stringValue(data.status) || 'active',
    reason: nullableString(data.reason),
    createdAt: nullableString(data.created_at ?? data.createdAt),
    updatedAt: nullableString(data.updated_at ?? data.updatedAt),
  };
}

export function parseSupportQueueRecord(id: string, data: DocumentData): WebSupportQueueRecord {
  return {
    id: stringValue(data.queue_id) || stringValue(data.id) || id,
    label: stringValue(data.label) || 'Support queue',
    description: stringValue(data.description) || 'No queue description recorded.',
    createdAt: nullableString(data.created_at ?? data.createdAt),
    updatedAt: nullableString(data.updated_at ?? data.updatedAt),
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
  const kind = normalizeSupportAuditEventKind(nullableString(data.kind) ?? nullableString(data.action));
  const ticketId = nullableString(data.ticket_id ?? data.ticketId);
  const supportCaseId = nullableString(data.support_case_id ?? data.supportCaseId);
  const supportConsentId = nullableString(data.support_consent_id ?? data.supportConsentId);
  const nextStatus = nullableString(data.next_status ?? data.nextStatus ?? data.status_after ?? data.statusAfter);
  const reason = nullableString(data.reason);
  const approved = data.customer_approved_diagnostic_access === true || data.customerApprovedDiagnosticAccess === true;
  const title = supportAuditEventTitle({
    kind,
    reason,
    nextStatus,
    approved,
  });
  return {
    id,
    ticketId,
    supportCaseId,
    supportConsentId,
    kind,
    actorRole: nullableString(data.actor_role ?? data.actorRole),
    queueId: nullableString(data.queue_id ?? data.queueId),
    title,
    detail: reason ?? nullableString(data.detail) ?? 'Support review event recorded.',
    actor:
      nullableString(data.actor_email ?? data.actorEmail) ??
      nullableString(data.actor_uid ?? data.actorUid) ??
      'Orbit Ledger',
    status: nextStatus,
    statusBefore: nullableString(data.status_before ?? data.statusBefore),
    statusAfter: nullableString(data.status_after ?? data.statusAfter ?? data.next_status ?? data.nextStatus),
    resolutionReason: nullableString(data.resolution_reason ?? data.resolutionReason),
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

function supportAuditEventTitle(input: {
  kind: string | null;
  reason: string | null;
  nextStatus: string | null;
  approved: boolean;
}) {
  if (input.kind === 'ticket_created') {
    return 'Ticket created';
  }
  if (input.kind === 'message_added') {
    return 'Customer message added';
  }
  if (input.kind === 'reply_sent') {
    return 'Reply sent';
  }
  if (input.kind === 'reply_queued') {
    return 'Reply queued';
  }
  if (input.kind === 'reply_failed') {
    return 'Reply failed';
  }
  if (input.kind === 'ticket_assigned') {
    return 'Ticket assigned';
  }
  if (input.kind === 'ticket_reassigned') {
    return 'Ticket reassigned';
  }
  if (input.kind === 'internal_note_added') {
    return 'Internal note added';
  }
  if (input.kind === 'status_changed') {
    return 'Ticket status changed';
  }
  if (input.kind === 'exported') {
    return 'Report exported';
  }
  if (input.kind === 'printed') {
    return 'Report printed';
  }
  if (input.kind === 'consent_linked') {
    return 'Diagnostic consent linked';
  }
  if (input.kind === 'permission_denied') {
    return 'Permission denied';
  }
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
  if (title === 'Approval saved' || title === 'Case resolved' || title === 'Reply sent' || title === 'Report exported' || title === 'Report printed') {
    return 'success';
  }
  if (title === 'Approval revoked' || title === 'Approval expired' || title === 'Case reopened' || title === 'Reply failed') {
    return 'warning';
  }
  return 'default';
}

function normalizeSupportAuditEventKind(value: string | null): string | null {
  if (value === 'support_report_download_csv') {
    return 'exported';
  }
  if (value === 'support_report_print') {
    return 'printed';
  }
  return value;
}

function supportMessageKindLabel(kind: string) {
  if (kind === 'customer_message') {
    return 'Customer message';
  }
  if (kind === 'operator_reply') {
    return 'Operator reply';
  }
  if (kind === 'internal_note') {
    return 'Internal note';
  }
  return 'System event';
}

function supportMessageTone(kind: string): WebSupportAuditRecord['tone'] {
  if (kind === 'operator_reply') {
    return 'success';
  }
  if (kind === 'internal_note') {
    return 'default';
  }
  return 'warning';
}

function supportReplyActionLabel(action: WebSupportCaseEmailRequestRecord['replyAction']) {
  if (action === 'close_with_reply') {
    return 'reply and close';
  }
  if (action === 'close_silently') {
    return 'close silently';
  }
  if (action === 'reopen_with_reply') {
    return 'reopen and reply';
  }
  return 'reply and wait';
}

function supportQueueLabel(queueId: string | null | undefined) {
  return (
    {
      general: 'General',
      billing: 'Billing',
      technical: 'Technical',
      privacy: 'Privacy',
      feedback: 'Feedback',
      complaint: 'Complaint',
      restore: 'Restore',
      purchase: 'Purchase',
    }[queueId ?? ''] ?? 'Unassigned queue'
  );
}

function supportPriorityLabel(priority: string | null | undefined) {
  return (
    {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
    }[priority ?? ''] ?? 'Normal'
  );
}

function supportTicketStatusLabel(status: string | null | undefined) {
  return (
    {
      opened: 'Opened',
      triaged: 'Triaged',
      assigned: 'Assigned',
      in_progress: 'In progress',
      pending_customer: 'Pending customer',
      pending_internal: 'Pending internal',
      resolved: 'Resolved',
      closed: 'Closed',
      spam: 'Spam',
      open: 'Open',
      reopened: 'Reopened',
      waiting_on_customer: 'Waiting on customer',
    }[status ?? ''] ?? 'Status not set'
  );
}

function supportResolutionReasonLabel(reason: string | null | undefined) {
  return (
    {
      fixed: 'Fixed',
      answered: 'Answered',
      refunded: 'Refunded',
      duplicate: 'Duplicate',
      cannot_reproduce: 'Cannot reproduce',
      policy_blocked: 'Policy blocked',
      customer_stopped_replying: 'Customer stopped replying',
      spam: 'Spam',
      other: 'Other',
    }[reason ?? ''] ?? 'Unresolved'
  );
}

function supportKindLabel(kind: string | null | undefined) {
  return kind
    ? kind
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Support';
}

function supportRoleLabel(role: string | null | undefined) {
  return (
    {
      super_admin: 'Super Admin',
      admin: 'Admin',
      finance_admin: 'Finance Admin',
      support_admin: 'Support Admin',
      read_only_admin: 'Read-only Admin',
      customer: 'Customer',
      system: 'System',
    }[role ?? ''] ?? 'Unassigned'
  );
}

function supportActorRoleLabel(role: string | null | undefined) {
  return supportRoleLabel(role);
}

function matchesTicketAuditFilters(ticket: WebSupportTicketRecord, filters: WebSupportAuditFilters) {
  if (filters.supportCaseId && ticket.supportCaseId !== filters.supportCaseId) {
    return false;
  }
  if (filters.queueId && ticket.queueId !== filters.queueId) {
    return false;
  }
  if (filters.ticketStatus && ticket.status !== filters.ticketStatus) {
    return false;
  }
  const fromAt = normalizeDateFloor(filters.dateFrom);
  const toAt = normalizeDateCeiling(filters.dateTo);
  const ticketAt = Date.parse(ticket.updatedAt ?? ticket.latestMessageAt ?? ticket.createdAt ?? '');
  if (fromAt !== null && Number.isFinite(ticketAt) && ticketAt < fromAt) {
    return false;
  }
  if (toAt !== null && Number.isFinite(ticketAt) && ticketAt > toAt) {
    return false;
  }
  const search = nullableString(filters.search)?.toLowerCase();
  if (!search) {
    return true;
  }
  const haystack = [
    ticket.supportCaseId ?? '',
    ticket.subject,
    ticket.summary,
    ticket.customerEmail ?? '',
    ticket.customerName ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(search);
}

function matchesAssignmentAuditFilters(assignment: WebSupportAssignmentRecord, filters: WebSupportAuditFilters) {
  if (filters.supportCaseId && assignment.supportCaseId !== filters.supportCaseId) {
    return false;
  }
  if (filters.queueId && assignment.queueId !== filters.queueId) {
    return false;
  }
  if (filters.actorRole && assignment.assignedByRole !== filters.actorRole) {
    return false;
  }
  const fromAt = normalizeDateFloor(filters.dateFrom);
  const toAt = normalizeDateCeiling(filters.dateTo);
  const assignmentAt = Date.parse(assignment.updatedAt ?? assignment.createdAt ?? '');
  if (fromAt !== null && Number.isFinite(assignmentAt) && assignmentAt < fromAt) {
    return false;
  }
  if (toAt !== null && Number.isFinite(assignmentAt) && assignmentAt > toAt) {
    return false;
  }
  return true;
}

function matchesEmailAuditFilters(request: WebSupportCaseEmailRequestRecord, filters: WebSupportAuditFilters) {
  if (filters.supportCaseId && request.supportCaseId !== filters.supportCaseId) {
    return false;
  }
  const fromAt = normalizeDateFloor(filters.dateFrom);
  const toAt = normalizeDateCeiling(filters.dateTo);
  const emailAt = Date.parse(request.sentAt ?? request.queuedAt ?? '');
  if (fromAt !== null && Number.isFinite(emailAt) && emailAt < fromAt) {
    return false;
  }
  if (toAt !== null && Number.isFinite(emailAt) && emailAt > toAt) {
    return false;
  }
  const search = nullableString(filters.search)?.toLowerCase();
  if (!search) {
    return true;
  }
  return [request.supportCaseId, request.subject, request.body, request.recipientEmail ?? ''].join(' ').toLowerCase().includes(search);
}

function matchesConsentAuditFilters(consent: WebSupportDiagnosticConsentRecord, filters: WebSupportAuditFilters) {
  if (filters.supportCaseId && consent.supportCaseId !== filters.supportCaseId) {
    return false;
  }
  const fromAt = normalizeDateFloor(filters.dateFrom);
  const toAt = normalizeDateCeiling(filters.dateTo);
  const consentAt = Date.parse(consent.createdAt ?? '');
  if (fromAt !== null && Number.isFinite(consentAt) && consentAt < fromAt) {
    return false;
  }
  if (toAt !== null && Number.isFinite(consentAt) && consentAt > toAt) {
    return false;
  }
  const search = nullableString(filters.search)?.toLowerCase();
  if (!search) {
    return true;
  }
  return [consent.supportCaseId ?? '', consent.userEmail ?? '', consent.sanitizedMessage, consent.supportKind].join(' ').toLowerCase().includes(search);
}

function describeSupportAuditFilters(filters: WebSupportAuditFilters) {
  return [
    filters.supportCaseId ? `Case ${filters.supportCaseId}` : null,
    filters.queueId ? `Queue ${supportQueueLabel(filters.queueId)}` : null,
    filters.actorRole ? `Actor ${supportActorRoleLabel(filters.actorRole)}` : null,
    filters.ticketStatus ? `Status ${supportTicketStatusLabel(filters.ticketStatus)}` : null,
    filters.dateFrom ? `From ${filters.dateFrom}` : null,
    filters.dateTo ? `To ${filters.dateTo}` : null,
    filters.search ? `Search ${filters.search}` : null,
  ].filter((value): value is string => Boolean(value));
}

function normalizeDateFloor(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeDateCeiling(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(`${value}T23:59:59.999Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function extractActorEmail(actor: string) {
  return actor.includes('@') ? actor : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not recorded';
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function escapeSupportReportHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sortIsoDesc(left: string | null, right: string | null) {
  const leftValue = left ? Date.parse(left) : 0;
  const rightValue = right ? Date.parse(right) : 0;
  return rightValue - leftValue;
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
  return Array.from(new Set([...getWebOperationsEmailAllowlist(), ...getWebPlatformAdminEmailAllowlist()]));
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

function getAssignOfficeSupportTicketUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/assignOfficeSupportTicket`;
}

function getOfficeSupportSnapshotUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/getOfficeSupportSnapshot`;
}

function getUpdateOfficeSupportNotificationPreferencesUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/updateOfficeSupportNotificationPreferences`;
}

function getRecordOfficeSupportReportEventUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/recordOfficeSupportReportEvent`;
}

function getSendOfficeSupportReplyUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/sendOfficeSupportReply`;
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
  if (error === 'support_review_not_allowed') {
    return 'This admin role cannot record review notes for the selected support queue.';
  }
  if (error === 'support_case_update_required') {
    return 'Add a support case and note before saving this update.';
  }
  if (error === 'support_reply_required') {
    return 'Add the customer reply details before sending from the support center.';
  }
  if (error === 'support_reply_resolution_reason_required') {
    return 'Choose an outcome reason before closing this ticket from the reply composer.';
  }
  if (error === 'support_reply_not_allowed') {
    return 'This admin role cannot send customer replies for the selected support queue.';
  }
  if (error === 'support_case_resolution_reason_required') {
    return 'Choose a support outcome before saving this status change.';
  }
  if (error === 'support_case_action_not_allowed') {
    return 'This admin role cannot update the selected support queue.';
  }
  if (error === 'support_assignment_required') {
    return 'Choose a queue, role, and assignment note before saving this ticket assignment.';
  }
  if (error === 'support_assignment_not_allowed') {
    return 'This admin role cannot assign tickets in the selected support queue.';
  }
  if (error === 'support_assignment_role_mismatch') {
    return 'Choose an assignee role that is allowed to work in the selected support queue.';
  }
  if (error === 'support_case_email_required') {
    return 'Add a valid recipient, subject, and message before preparing this email.';
  }
  if (error === 'support_case_email_not_allowed') {
    return 'This admin role cannot prepare follow-up email for the selected support queue.';
  }
  if (error === 'support_report_action_required') {
    return 'Choose whether you want to download CSV or print the support report.';
  }
  if (error === 'support_report_type_required') {
    return 'Choose a valid support report before exporting.';
  }
  if (error === 'support_report_not_allowed' || error === 'support_report_scope_not_allowed') {
    return 'This admin role cannot export support reports for the selected scope.';
  }
  if (error === 'support_report_action_failed') {
    return 'Support report export could not be recorded.';
  }
  if (error === 'support_rate_limited') {
    return 'This action was rate-limited. Wait a moment and try again.';
  }
  if (error === 'support_ticket_conflict') {
    return 'This ticket changed in another admin session. Refresh the support center and try again.';
  }
  if (error === 'support_notification_preferences_invalid') {
    return 'Quiet hours must use a valid 24-hour time like 22:00 or 07:00.';
  }
  if (error === 'support_notification_preferences_failed') {
    return 'Support notification settings could not be saved.';
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

function supportNotificationPermissionState(
  value: unknown
): WebSupportNotificationPreferenceRecord['browserPermissionState'] {
  return value === 'default' || value === 'denied' || value === 'granted' ? value : null;
}

function supportNotificationTone(value: unknown): WebSupportTicketRecord['notificationTone'] {
  return value === 'soft' || value === 'urgent' ? value : 'standard';
}

function normalizeSupportReplyAction(value: string | null | undefined): WebSupportReplyAction {
  if (
    value === 'reply' ||
    value === 'close_with_reply' ||
    value === 'close_silently' ||
    value === 'reopen_with_reply'
  ) {
    return value;
  }
  return 'reply';
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

async function loadWebOfficeSupportServerSnapshot(
  workspaceId: string,
  user: ReturnType<typeof getWebAuth>['currentUser']
): Promise<WebOfficeSupportServerSnapshot | null> {
  if (!user) {
    return null;
  }

  const token = await user.getIdToken();
  const response = await fetch(getOfficeSupportSnapshotUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'office_support_snapshot_failed',
  }))) as
    | ({
        ok: true;
      } & WebOfficeSupportServerSnapshot)
    | {
        ok: false;
        error: string;
      };

  if (!result.ok) {
    return null;
  }

  return {
    currentAdmin:
      result.currentAdmin && typeof result.currentAdmin === 'object'
        ? {
            uid: stringValue(result.currentAdmin.uid) || '',
            email: nullableString(result.currentAdmin.email),
            role: (stringValue(result.currentAdmin.role) || 'read_only_admin') as PlatformAdminRole,
            supportCapability: {
              readAll: result.currentAdmin.supportCapability?.readAll === true,
              auditAll: result.currentAdmin.supportCapability?.auditAll === true,
              mutateAll: result.currentAdmin.supportCapability?.mutateAll === true,
              allowedQueues: stringList(result.currentAdmin.supportCapability?.allowedQueues),
              canAssignTickets: result.currentAdmin.supportCapability?.canAssignTickets === true,
              canSendReplies: result.currentAdmin.supportCapability?.canSendReplies === true,
              canAddInternalNotes: result.currentAdmin.supportCapability?.canAddInternalNotes === true,
              canChangeStatus: result.currentAdmin.supportCapability?.canChangeStatus === true,
              canViewDiagnostics: result.currentAdmin.supportCapability?.canViewDiagnostics === true,
              canExportReports:
                result.currentAdmin.supportCapability?.canExportReports === true ||
                canSupportRoleExportReports((stringValue(result.currentAdmin.role) || 'read_only_admin') as PlatformAdminRole),
            },
          }
        : null,
    supportCases: result.supportCases ?? [],
    supportTickets: result.supportTickets ?? [],
    supportMessages: result.supportMessages ?? [],
    supportAssignments: result.supportAssignments ?? [],
    supportQueues: result.supportQueues ?? [],
    supportCaseEmailRequests: result.supportCaseEmailRequests ?? [],
    supportConsents: result.supportConsents ?? [],
    supportCaseEvents: result.supportCaseEvents ?? [],
    supportNotificationPreference:
      result.supportNotificationPreference && typeof result.supportNotificationPreference === 'object'
        ? result.supportNotificationPreference
        : null,
  };
}
