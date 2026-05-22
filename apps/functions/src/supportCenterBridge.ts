export type SupportCaseStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'pending_internal'
  | 'resolved'
  | 'closed'
  | 'reopened';
export type SupportCaseAction = 'add_note' | 'resolve' | 'reopen';
export type SupportTicketStatus =
  | 'opened'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'pending_customer'
  | 'pending_internal'
  | 'resolved'
  | 'closed'
  | 'spam';
export type SupportResolutionState = 'unresolved' | 'resolved';
export type SupportResolutionReason =
  | 'fixed'
  | 'answered'
  | 'refunded'
  | 'duplicate'
  | 'cannot_reproduce'
  | 'policy_blocked'
  | 'customer_stopped_replying'
  | 'spam'
  | 'other';
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportQueueId =
  | 'general'
  | 'billing'
  | 'technical'
  | 'privacy'
  | 'feedback'
  | 'complaint'
  | 'restore'
  | 'purchase';
export type SupportTicketSource = 'support_case' | 'support_reply_email' | 'admin_created' | 'system_triage';
export type SupportMessageKind = 'customer_message' | 'operator_reply' | 'internal_note' | 'system_event';
export type SupportEventKind =
  | 'ticket_created'
  | 'message_added'
  | 'consent_linked'
  | 'status_changed';

export type CustomerSupportSubmissionDecision = {
  supportCaseAction: SupportCaseAction;
  nextSupportCaseStatus: SupportCaseStatus;
  nextTicketStatus: SupportTicketStatus;
  nextResolutionState: SupportResolutionState;
  nextResolutionReason: SupportResolutionReason | null;
};

export function buildSupportCaseId(now: Date, suffixSeed = now.getTime()): string {
  const year = String(now.getUTCFullYear());
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const suffix = Math.abs(suffixSeed).toString(36).toUpperCase().slice(-6).padStart(6, '0');
  return `OL-SUP-${year}${month}${day}-${suffix}`;
}

export function supportQueueForKind(kind: string | null | undefined): SupportQueueId {
  switch (kind) {
    case 'invoice_issue':
      return 'billing';
    case 'payment_issue':
      return 'purchase';
    case 'restore_help':
      return 'restore';
    case 'sync_issue':
      return 'technical';
    case 'purchase_help':
      return 'purchase';
    case 'feature_request':
      return 'feedback';
    default:
      return 'general';
  }
}

export function supportPriorityForKind(kind: string | null | undefined): SupportTicketPriority {
  switch (kind) {
    case 'restore_help':
      return 'urgent';
    case 'payment_issue':
    case 'purchase_help':
    case 'sync_issue':
      return 'high';
    case 'feature_request':
      return 'low';
    default:
      return 'normal';
  }
}

export function supportSubjectForKind(kind: string | null | undefined): string {
  switch (kind) {
    case 'invoice_issue':
      return 'Invoice help request';
    case 'payment_issue':
      return 'Payment help request';
    case 'restore_help':
      return 'Backup or restore help request';
    case 'sync_issue':
      return 'Sync help request';
    case 'purchase_help':
      return 'Purchase help request';
    case 'feature_request':
      return 'Feature suggestion';
    default:
      return 'Support request';
  }
}

export function buildCustomerSupportSubmissionDecision(input: {
  currentSupportCaseStatus?: SupportCaseStatus | null;
  currentTicketStatus?: SupportTicketStatus | null;
}): CustomerSupportSubmissionDecision {
  const supportCaseStatus = input.currentSupportCaseStatus ?? 'open';
  const ticketStatus = input.currentTicketStatus ?? 'opened';

  if (
    supportCaseStatus === 'resolved' ||
    supportCaseStatus === 'closed' ||
    supportCaseStatus === 'reopened' ||
    ticketStatus === 'resolved' ||
    ticketStatus === 'closed'
  ) {
    return {
      supportCaseAction: 'reopen',
      nextSupportCaseStatus: 'reopened',
      nextTicketStatus: 'opened',
      nextResolutionState: 'unresolved',
      nextResolutionReason: null,
    };
  }

  return {
    supportCaseAction: 'add_note',
    nextSupportCaseStatus: 'open',
    nextTicketStatus: 'opened',
    nextResolutionState: 'unresolved',
    nextResolutionReason: null,
  };
}

export function buildSupportTicketRecord(input: {
  workspaceId: string;
  ticketId: string;
  supportCaseId: string;
  supportKind: string | null | undefined;
  subject: string;
  summary: string;
  customerUserId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  messageId: string;
  consentId?: string | null;
  linkedConsentIds?: string[] | null;
  existingQueueId?: SupportQueueId | null;
  existingSource?: SupportTicketSource | null;
  existingCreatedAt?: string | null;
  existingFirstResponseDueAt?: string | null;
  existingSlaDueAt?: string | null;
  existingOperatorFirstRepliedAt?: string | null;
  currentAssignmentId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const linkedConsentIds = uniqueStrings(input.linkedConsentIds ?? []);
  const priority = supportPriorityForKind(input.supportKind);
  const firstResponseDueAt = new Date(now.getTime() + getSupportFirstResponseSlaHours(priority) * 3_600_000).toISOString();
  const slaDueAt = new Date(now.getTime() + getSupportResolutionSlaHours(priority) * 3_600_000).toISOString();
  if (input.consentId) {
    linkedConsentIds.push(input.consentId);
  }

  return {
    version: 1,
    ticket_id: input.ticketId,
    workspace_id: input.workspaceId,
    support_case_id: input.supportCaseId,
    source: input.existingSource ?? ('support_case' as SupportTicketSource),
    queue_id: input.existingQueueId ?? supportQueueForKind(input.supportKind),
    priority,
    status: 'opened' as SupportTicketStatus,
    resolution_state: 'unresolved' as SupportResolutionState,
    resolution_reason: null,
    subject: input.subject,
    summary: input.summary,
    customer_user_id: input.customerUserId ?? null,
    customer_email: input.customerEmail ?? null,
    customer_name: input.customerName ?? null,
    active_support_consent_id: input.consentId ?? null,
    linked_support_consent_ids: uniqueStrings(linkedConsentIds),
    latest_message_id: input.messageId,
    latest_message_at: timestamp,
    first_response_due_at: input.existingFirstResponseDueAt ?? firstResponseDueAt,
    sla_due_at: input.existingSlaDueAt ?? slaDueAt,
    last_customer_message_at: timestamp,
    operator_first_replied_at: input.existingOperatorFirstRepliedAt ?? null,
    notification_tone: notificationToneForTicket(input.existingQueueId ?? supportQueueForKind(input.supportKind), priority),
    current_assignment_id: input.currentAssignmentId ?? null,
    last_actor_uid: input.customerUserId ?? null,
    last_actor_role: 'customer',
    created_at: input.existingCreatedAt ?? timestamp,
    updated_at: timestamp,
    resolved_at: null,
    closed_at: null,
  };
}

export function buildSupportMessageRecord(input: {
  workspaceId: string;
  ticketId: string;
  supportCaseId: string;
  actorUid?: string | null;
  actorEmail?: string | null;
  body: string;
  emailThreadId?: string | null;
  providerMessageId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    ticket_id: input.ticketId,
    support_case_id: input.supportCaseId,
    kind: 'customer_message' as SupportMessageKind,
    actor_uid: input.actorUid ?? null,
    actor_role: 'customer',
    actor_email: input.actorEmail ?? null,
    visible_to_customer: true,
    body: input.body,
    email_thread_id: input.emailThreadId ?? null,
    provider_message_id: input.providerMessageId ?? null,
    created_at: now.toISOString(),
  };
}

export function buildSupportEventRecord(input: {
  workspaceId: string;
  ticketId: string;
  supportCaseId: string;
  eventKind: SupportEventKind;
  detail: string;
  queueId: SupportQueueId;
  actorUid?: string | null;
  actorRole?: 'customer' | 'system';
  actorEmail?: string | null;
  statusBefore?: SupportTicketStatus | null;
  statusAfter?: SupportTicketStatus | null;
  resolutionStateBefore?: SupportResolutionState | null;
  resolutionStateAfter?: SupportResolutionState | null;
  resolutionReason?: SupportResolutionReason | null;
  metadata?: Record<string, string | number | boolean | null>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    ticket_id: input.ticketId,
    support_case_id: input.supportCaseId,
    kind: input.eventKind,
    actor_uid: input.actorUid ?? null,
    actor_role: input.actorRole ?? (input.actorUid ? 'customer' : 'system'),
    actor_email: input.actorEmail ?? null,
    queue_id: input.queueId,
    status_before: input.statusBefore ?? null,
    status_after: input.statusAfter ?? null,
    resolution_state_before: input.resolutionStateBefore ?? null,
    resolution_state_after: input.resolutionStateAfter ?? null,
    resolution_reason: input.resolutionReason ?? null,
    detail: input.detail,
    metadata: input.metadata ?? {},
    created_at: now.toISOString(),
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function getSupportFirstResponseSlaHours(priority: SupportTicketPriority) {
  if (priority === 'urgent') {
    return 2;
  }
  if (priority === 'high') {
    return 8;
  }
  if (priority === 'low') {
    return 72;
  }
  return 24;
}

function getSupportResolutionSlaHours(priority: SupportTicketPriority) {
  if (priority === 'urgent') {
    return 24;
  }
  if (priority === 'high') {
    return 72;
  }
  if (priority === 'low') {
    return 336;
  }
  return 168;
}

function notificationToneForTicket(queueId: SupportQueueId, priority: SupportTicketPriority) {
  if (priority === 'urgent' || queueId === 'complaint' || queueId === 'privacy') {
    return 'urgent';
  }
  if (queueId === 'feedback' && priority === 'low') {
    return 'soft';
  }
  return 'standard';
}
