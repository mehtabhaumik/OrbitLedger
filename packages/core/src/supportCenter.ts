import type { PlatformAdminRole } from './platformAdmin';

export const SUPPORT_CENTER_COLLECTIONS = [
  'support_tickets',
  'support_messages',
  'support_assignments',
  'support_events',
  'support_queues',
  'support_notification_preferences',
] as const;

export type SupportCenterCollectionName = (typeof SUPPORT_CENTER_COLLECTIONS)[number];

export const SUPPORT_CENTER_FIRESTORE_PATHS = {
  tickets: 'workspaces/{workspaceId}/support_tickets/{ticketId}',
  messages: 'workspaces/{workspaceId}/support_messages/{messageId}',
  assignments: 'workspaces/{workspaceId}/support_assignments/{assignmentId}',
  events: 'workspaces/{workspaceId}/support_events/{eventId}',
  queues: 'workspaces/{workspaceId}/support_queues/{queueId}',
  notificationPreferences: 'workspaces/{workspaceId}/support_notification_preferences/{preferenceId}',
} as const;

export const SUPPORT_QUEUE_IDS = [
  'general',
  'billing',
  'technical',
  'privacy',
  'feedback',
  'complaint',
  'restore',
  'purchase',
] as const;

export type SupportQueueId = (typeof SUPPORT_QUEUE_IDS)[number];

export const SUPPORT_TICKET_SOURCES = [
  'support_case',
  'support_reply_email',
  'admin_created',
  'system_triage',
] as const;

export type SupportTicketSource = (typeof SUPPORT_TICKET_SOURCES)[number];

export const SUPPORT_TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];

export const SUPPORT_TICKET_STATUSES = [
  'opened',
  'triaged',
  'assigned',
  'in_progress',
  'pending_customer',
  'pending_internal',
  'resolved',
  'closed',
  'spam',
] as const;

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_RESOLUTION_STATES = ['unresolved', 'resolved'] as const;

export type SupportResolutionState = (typeof SUPPORT_RESOLUTION_STATES)[number];

export const SUPPORT_RESOLUTION_REASONS = [
  'fixed',
  'answered',
  'refunded',
  'duplicate',
  'cannot_reproduce',
  'policy_blocked',
  'customer_stopped_replying',
  'spam',
  'other',
] as const;

export type SupportResolutionReason = (typeof SUPPORT_RESOLUTION_REASONS)[number];

export const SUPPORT_MESSAGE_KINDS = [
  'customer_message',
  'operator_reply',
  'internal_note',
  'system_event',
] as const;

export type SupportMessageKind = (typeof SUPPORT_MESSAGE_KINDS)[number];

export const SUPPORT_ASSIGNMENT_STATUSES = ['active', 'reassigned', 'released'] as const;

export type SupportAssignmentStatus = (typeof SUPPORT_ASSIGNMENT_STATUSES)[number];

export const SUPPORT_EVENT_KINDS = [
  'ticket_created',
  'ticket_triaged',
  'ticket_assigned',
  'ticket_reassigned',
  'message_added',
  'reply_sent',
  'internal_note_added',
  'status_changed',
  'resolution_changed',
  'consent_linked',
  'consent_revoked',
  'queue_changed',
  'exported',
  'printed',
  'permission_denied',
] as const;

export type SupportEventKind = (typeof SUPPORT_EVENT_KINDS)[number];

export const SUPPORT_TICKET_ACTIONS = [
  'triage',
  'assign',
  'start_work',
  'wait_for_customer',
  'wait_for_internal',
  'resolve',
  'close',
  'reopen',
  'mark_spam',
] as const;

export type SupportTicketAction = (typeof SUPPORT_TICKET_ACTIONS)[number];

export type SupportTicketRecord = {
  id: string;
  workspaceId: string;
  supportCaseId: string | null;
  source: SupportTicketSource;
  queueId: SupportQueueId;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  resolutionState: SupportResolutionState;
  resolutionReason: SupportResolutionReason | null;
  subject: string;
  summary: string;
  customerUserId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  activeConsentId: string | null;
  linkedConsentIds: string[];
  latestMessageId: string | null;
  latestMessageAt: string | null;
  currentAssignmentId: string | null;
  lastActorUid: string | null;
  lastActorRole: PlatformAdminRole | null;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  schemaVersion: 1;
};

export type SupportMessageRecord = {
  id: string;
  workspaceId: string;
  ticketId: string;
  supportCaseId: string | null;
  kind: SupportMessageKind;
  actorUid: string | null;
  actorRole: PlatformAdminRole | 'customer' | 'system';
  actorEmail: string | null;
  visibleToCustomer: boolean;
  body: string;
  emailThreadId: string | null;
  providerMessageId: string | null;
  createdAt: string | null;
  schemaVersion: 1;
};

export type SupportAssignmentRecord = {
  id: string;
  workspaceId: string;
  ticketId: string;
  queueId: SupportQueueId;
  assignedRole: PlatformAdminRole;
  assignedAdminUid: string | null;
  assignedAdminEmail: string | null;
  assignedByUid: string | null;
  assignedByRole: PlatformAdminRole | null;
  status: SupportAssignmentStatus;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  schemaVersion: 1;
};

export type SupportEventRecord = {
  id: string;
  workspaceId: string;
  ticketId: string;
  supportCaseId: string | null;
  kind: SupportEventKind;
  actorUid: string | null;
  actorRole: PlatformAdminRole | 'system';
  actorEmail: string | null;
  queueId: SupportQueueId | null;
  statusBefore: SupportTicketStatus | null;
  statusAfter: SupportTicketStatus | null;
  resolutionStateBefore: SupportResolutionState | null;
  resolutionStateAfter: SupportResolutionState | null;
  resolutionReason: SupportResolutionReason | null;
  detail: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string | null;
  schemaVersion: 1;
};

export type SupportQueueRecord = {
  id: SupportQueueId;
  label: string;
  description: string;
  visibleToRoles: PlatformAdminRole[];
  mutableByRoles: PlatformAdminRole[];
  createdAt: string | null;
  updatedAt: string | null;
  schemaVersion: 1;
};

export type SupportNotificationPreferenceRecord = {
  id: string;
  workspaceId: string;
  adminUid: string;
  adminRole: PlatformAdminRole;
  muteAll: boolean;
  browserNotificationsEnabled: boolean;
  soundEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string | null;
  schemaVersion: 1;
};

export type SupportRoleScope = 'none' | 'allowed_queues' | 'all';

export type SupportRoleCapability = {
  readScope: SupportRoleScope;
  auditScope: SupportRoleScope;
  mutateScope: SupportRoleScope;
  allowedQueues: SupportQueueId[];
  canAssignTickets: boolean;
  canSendReplies: boolean;
  canAddInternalNotes: boolean;
  canChangeStatus: boolean;
  canViewDiagnostics: boolean;
  canExportReports: boolean;
};

export const SUPPORT_ROLE_CAPABILITIES: Record<PlatformAdminRole, SupportRoleCapability> = {
  super_admin: {
    readScope: 'all',
    auditScope: 'all',
    mutateScope: 'all',
    allowedQueues: [...SUPPORT_QUEUE_IDS],
    canAssignTickets: true,
    canSendReplies: true,
    canAddInternalNotes: true,
    canChangeStatus: true,
    canViewDiagnostics: true,
    canExportReports: true,
  },
  admin: {
    readScope: 'all',
    auditScope: 'all',
    mutateScope: 'all',
    allowedQueues: [...SUPPORT_QUEUE_IDS],
    canAssignTickets: true,
    canSendReplies: true,
    canAddInternalNotes: true,
    canChangeStatus: true,
    canViewDiagnostics: true,
    canExportReports: true,
  },
  finance_admin: {
    readScope: 'all',
    auditScope: 'all',
    mutateScope: 'allowed_queues',
    allowedQueues: ['billing', 'purchase'],
    canAssignTickets: true,
    canSendReplies: true,
    canAddInternalNotes: true,
    canChangeStatus: true,
    canViewDiagnostics: false,
    canExportReports: true,
  },
  support_admin: {
    readScope: 'allowed_queues',
    auditScope: 'allowed_queues',
    mutateScope: 'allowed_queues',
    allowedQueues: ['general', 'technical', 'privacy', 'feedback', 'complaint', 'restore', 'purchase'],
    canAssignTickets: true,
    canSendReplies: true,
    canAddInternalNotes: true,
    canChangeStatus: true,
    canViewDiagnostics: true,
    canExportReports: false,
  },
  read_only_admin: {
    readScope: 'all',
    auditScope: 'all',
    mutateScope: 'none',
    allowedQueues: [...SUPPORT_QUEUE_IDS],
    canAssignTickets: false,
    canSendReplies: false,
    canAddInternalNotes: false,
    canChangeStatus: false,
    canViewDiagnostics: false,
    canExportReports: true,
  },
};

export type BuildSupportTicketActionPlanInput = {
  action?: string | null;
  currentStatus?: SupportTicketStatus | null;
  reason?: string | null;
  resolutionReason?: string | null;
  resolutionState?: SupportResolutionState | null;
};

export type SupportTicketActionPlan = {
  canApply: boolean;
  action: SupportTicketAction | null;
  nextStatus: SupportTicketStatus | null;
  nextResolutionState: SupportResolutionState | null;
  nextResolutionReason: SupportResolutionReason | null;
  requiresReason: boolean;
  message: string;
};

const SUPPORT_CLOSE_REASONS: readonly SupportResolutionReason[] = [
  'fixed',
  'answered',
  'refunded',
  'duplicate',
  'cannot_reproduce',
  'policy_blocked',
  'customer_stopped_replying',
  'other',
] as const;

const SUPPORT_RESOLVE_REASONS: readonly SupportResolutionReason[] = [
  'fixed',
  'answered',
  'refunded',
  'duplicate',
  'cannot_reproduce',
  'policy_blocked',
  'other',
] as const;

export function isSupportCenterCollection(value: unknown): value is SupportCenterCollectionName {
  return typeof value === 'string' && SUPPORT_CENTER_COLLECTIONS.includes(value as SupportCenterCollectionName);
}

export function isSupportQueueId(value: unknown): value is SupportQueueId {
  return typeof value === 'string' && SUPPORT_QUEUE_IDS.includes(value as SupportQueueId);
}

export function isSupportTicketStatus(value: unknown): value is SupportTicketStatus {
  return typeof value === 'string' && SUPPORT_TICKET_STATUSES.includes(value as SupportTicketStatus);
}

export function isSupportResolutionState(value: unknown): value is SupportResolutionState {
  return typeof value === 'string' && SUPPORT_RESOLUTION_STATES.includes(value as SupportResolutionState);
}

export function isSupportResolutionReason(value: unknown): value is SupportResolutionReason {
  return typeof value === 'string' && SUPPORT_RESOLUTION_REASONS.includes(value as SupportResolutionReason);
}

export function isSupportMessageKind(value: unknown): value is SupportMessageKind {
  return typeof value === 'string' && SUPPORT_MESSAGE_KINDS.includes(value as SupportMessageKind);
}

export function isSupportEventKind(value: unknown): value is SupportEventKind {
  return typeof value === 'string' && SUPPORT_EVENT_KINDS.includes(value as SupportEventKind);
}

export function isSupportTicketAction(value: unknown): value is SupportTicketAction {
  return typeof value === 'string' && SUPPORT_TICKET_ACTIONS.includes(value as SupportTicketAction);
}

export function getSupportRoleCapability(role: PlatformAdminRole): SupportRoleCapability {
  return SUPPORT_ROLE_CAPABILITIES[role];
}

export function canSupportRoleAccessQueue(role: PlatformAdminRole, queueId: SupportQueueId): boolean {
  const capability = SUPPORT_ROLE_CAPABILITIES[role];
  return capability.readScope === 'all' || capability.allowedQueues.includes(queueId);
}

export function canSupportRoleAuditAllTickets(role: PlatformAdminRole): boolean {
  return SUPPORT_ROLE_CAPABILITIES[role].auditScope === 'all';
}

export function canSupportRoleMutateQueue(role: PlatformAdminRole, queueId: SupportQueueId): boolean {
  const capability = SUPPORT_ROLE_CAPABILITIES[role];
  if (capability.mutateScope === 'all') {
    return true;
  }
  if (capability.mutateScope === 'none') {
    return false;
  }
  return capability.allowedQueues.includes(queueId);
}

export function buildSupportTicketActionPlan(
  input: BuildSupportTicketActionPlanInput
): SupportTicketActionPlan {
  const action = isSupportTicketAction(input.action) ? input.action : null;
  const reason = normalizeReason(input.reason);
  const resolutionReason = isSupportResolutionReason(input.resolutionReason)
    ? input.resolutionReason
    : null;
  const currentStatus = isSupportTicketStatus(input.currentStatus) ? input.currentStatus : 'opened';

  if (!action) {
    return {
      canApply: false,
      action: null,
      nextStatus: null,
      nextResolutionState: null,
      nextResolutionReason: null,
      requiresReason: false,
      message: 'Choose a valid support ticket action before saving.',
    };
  }

  if (action === 'triage') {
    return successPlan(action, 'triaged', 'unresolved', null, false, 'Ticket marked triaged.');
  }

  if (action === 'assign') {
    return successPlan(action, 'assigned', 'unresolved', null, false, 'Ticket assigned.');
  }

  if (action === 'start_work') {
    return successPlan(action, 'in_progress', 'unresolved', null, false, 'Ticket moved to in progress.');
  }

  if (action === 'wait_for_customer') {
    return successPlan(action, 'pending_customer', 'unresolved', null, false, 'Waiting for customer reply.');
  }

  if (action === 'wait_for_internal') {
    return successPlan(action, 'pending_internal', 'unresolved', null, false, 'Waiting for internal follow-up.');
  }

  if (action === 'resolve') {
    if (!resolutionReason || !SUPPORT_RESOLVE_REASONS.includes(resolutionReason)) {
      return invalidReasonPlan(action, 'Choose a valid resolution reason before resolving this ticket.');
    }
    if (!reason) {
      return missingReasonPlan(action, 'Add a short resolution note before resolving this ticket.');
    }
    return successPlan(action, 'resolved', 'resolved', resolutionReason, true, 'Ticket marked resolved.');
  }

  if (action === 'close') {
    const nextResolutionState = input.resolutionState ?? (currentStatus === 'resolved' ? 'resolved' : 'unresolved');
    if (!isSupportResolutionState(nextResolutionState)) {
      return invalidReasonPlan(action, 'Choose whether the ticket is resolved before closing it.');
    }
    if (!resolutionReason || !SUPPORT_CLOSE_REASONS.includes(resolutionReason)) {
      return invalidReasonPlan(action, 'Choose a valid close reason before closing this ticket.');
    }
    if (!reason) {
      return missingReasonPlan(action, 'Add a short closing note before closing this ticket.');
    }
    return successPlan(action, 'closed', nextResolutionState, resolutionReason, true, 'Ticket closed.');
  }

  if (action === 'reopen') {
    if (!reason) {
      return missingReasonPlan(action, 'Add a short reason before reopening this ticket.');
    }
    return successPlan(action, 'opened', 'unresolved', null, true, 'Ticket reopened.');
  }

  if (!reason) {
    return missingReasonPlan('mark_spam', 'Add a short reason before marking this ticket as spam.');
  }

  return successPlan('mark_spam', 'spam', 'unresolved', 'spam', true, 'Ticket marked as spam.');
}

function successPlan(
  action: SupportTicketAction,
  nextStatus: SupportTicketStatus,
  nextResolutionState: SupportResolutionState,
  nextResolutionReason: SupportResolutionReason | null,
  requiresReason: boolean,
  message: string
): SupportTicketActionPlan {
  return {
    canApply: true,
    action,
    nextStatus,
    nextResolutionState,
    nextResolutionReason,
    requiresReason,
    message,
  };
}

function invalidReasonPlan(action: SupportTicketAction, message: string): SupportTicketActionPlan {
  return {
    canApply: false,
    action,
    nextStatus: null,
    nextResolutionState: null,
    nextResolutionReason: null,
    requiresReason: true,
    message,
  };
}

function missingReasonPlan(action: SupportTicketAction, message: string): SupportTicketActionPlan {
  return {
    canApply: false,
    action,
    nextStatus: null,
    nextResolutionState: null,
    nextResolutionReason: null,
    requiresReason: true,
    message,
  };
}

function normalizeReason(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
