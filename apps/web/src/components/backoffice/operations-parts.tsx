'use client';

/**
 * Presentational and pure helpers for the operations console: SLA/status/queue
 * label + chip-class helpers, support-case counters and formatters, and the
 * OperationsFieldHelp control. Split out of operations-console.tsx (~3,244
 * lines) so the console file holds the data flow and section layout. Behaviour
 * is unchanged - this is a pure code move.
 */

import type { Route } from 'next';

import { getSupportSlaState } from '@orbit-ledger/core';
import type {
  OfficeSupportCaseAction,
  PlatformAdminRole,
  SupportQueueId,
  SupportSlaState,
} from '@orbit-ledger/core';

import type {
  WebSupportAdminContext,
  WebSupportAssignmentRecord,
  WebSupportAuditRecord,
  WebSupportCaseAuditEvent,
  WebSupportCaseRecord,
  WebSupportDiagnosticConsentRecord,
  WebSupportMessageRecord,
  WebSupportQueueRecord,
  WebSupportReplyAction,
  WebSupportReportType,
  WebSupportTicketRecord,
} from '@/lib/office-admin-operations';

/** One assembled row of the support shell: a case with its related records. */
export type SupportShellRow = {
  supportCase: WebSupportCaseRecord;
  ticket: WebSupportTicketRecord | null;
  currentAssignment: WebSupportAssignmentRecord | null;
  latestMessage: WebSupportMessageRecord | null;
  consentCount: number;
  pendingEmailCount: number;
  eventCount: number;
};

const SUPPORT_QUEUE_LABELS: Record<string, string> = {
  general: 'General',
  billing: 'Billing',
  technical: 'Technical',
  privacy: 'Privacy',
  feedback: 'Feedback',
  complaint: 'Complaint',
  restore: 'Restore',
  purchase: 'Purchase',
};

export { SUPPORT_QUEUE_LABELS };

/**
 * Maps an overview metric to the section that acts on it, so an operator can
 * jump from "5 open support" straight to the support inbox instead of finding
 * the sidebar item. Falls back to the support inbox for support-* metrics and
 * access requests for the Office metrics.
 */
export function operationsMetricHref(metricId: string): Route {
  if (metricId === 'support-diagnostics') {
    return '/backoffice/operations/diagnostics-consent' as Route;
  }
  if (metricId.startsWith('support-')) {
    return '/backoffice/operations/support-inbox' as Route;
  }
  // Office snapshot metrics: requests | needs_review | approved | granted
  return '/backoffice/operations/access-requests' as Route;
}

export function chipClassForTone(tone: 'success' | 'warning' | 'premium' | 'default') {
  if (tone === 'success') {
    return 'ol-chip--success';
  }
  if (tone === 'warning') {
    return 'ol-chip--warning';
  }
  if (tone === 'premium') {
    return 'ol-chip--premium';
  }
  return 'ol-chip--primary';
}

export function supportTicketSlaState(
  ticket: WebSupportTicketRecord | null,
  target: 'first_response' | 'resolution'
): SupportSlaState {
  if (!ticket) {
    return 'on_track';
  }
  const completedAt =
    target === 'first_response'
      ? ticket.operatorFirstRepliedAt
      : ticket.resolutionState === 'resolved'
        ? ticket.updatedAt
        : null;
  if (completedAt) {
    return 'on_track';
  }
  return getSupportSlaState({
    dueAt: target === 'first_response' ? ticket.firstResponseDueAt : ticket.slaDueAt,
  });
}

export function supportTicketSlaLabel(ticket: WebSupportTicketRecord | null) {
  if (!ticket) {
    return 'SLA not available';
  }
  const firstResponseState = supportTicketSlaState(ticket, 'first_response');
  const resolutionState = supportTicketSlaState(ticket, 'resolution');
  if (firstResponseState === 'overdue' || resolutionState === 'overdue') {
    return 'Overdue SLA';
  }
  if (firstResponseState === 'due_soon' || resolutionState === 'due_soon') {
    return 'Due soon';
  }
  return 'On track';
}

export function supportSlaChipClass(state: SupportSlaState) {
  if (state === 'overdue') {
    return 'ol-chip--warning';
  }
  if (state === 'due_soon') {
    return 'ol-chip--premium';
  }
  return 'ol-chip--success';
}

export function OperationsFieldHelp({ text }: { text: string }) {
  return (
    <details className="ol-field-info">
      <summary aria-label="Field help">?</summary>
      <span>{text}</span>
    </details>
  );
}

export function supportNotificationToneLabel(tone: WebSupportTicketRecord['notificationTone'] | null | undefined) {
  if (tone === 'soft') {
    return 'Soft chime';
  }
  if (tone === 'urgent') {
    return 'Urgent alert';
  }
  return 'Standard alert';
}

export function playSupportNotificationTone() {
  if (typeof window === 'undefined') {
    return;
  }
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(784, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.34);
  oscillator.onended = () => {
    void context.close();
  };
}

export function supportAuditChipClass(tone: WebSupportCaseAuditEvent['tone']) {
  if (tone === 'success') {
    return 'ol-chip--success';
  }
  if (tone === 'warning') {
    return 'ol-chip--warning';
  }
  return 'ol-chip--primary';
}

export function supportCaseChipClass(status: WebSupportCaseRecord['status']) {
  if (status === 'resolved') {
    return 'ol-chip--success';
  }
  if (status === 'waiting_on_customer') {
    return 'ol-chip--warning';
  }
  if (status === 'reopened') {
    return 'ol-chip--premium';
  }
  return 'ol-chip--primary';
}

export function supportCaseStatusLabel(status: WebSupportCaseRecord['status']) {
  return status
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function supportReplyActionLabel(action: WebSupportReplyAction) {
  if (action === 'close_with_reply') {
    return 'Reply and close';
  }
  if (action === 'close_silently') {
    return 'Close silently';
  }
  if (action === 'reopen_with_reply') {
    return 'Reopen and reply';
  }
  return 'Reply and wait';
}

export function supportReplyActionButtonLabel(action: WebSupportReplyAction) {
  if (action === 'close_with_reply') {
    return 'Send reply and close';
  }
  if (action === 'close_silently') {
    return 'Close silently';
  }
  if (action === 'reopen_with_reply') {
    return 'Reopen and send';
  }
  return 'Send reply';
}

export function supportReplyActionHelper(action: WebSupportReplyAction) {
  if (action === 'close_with_reply') {
    return 'Closes the ticket after the customer receives this reply.';
  }
  if (action === 'close_silently') {
    return 'Records an internal closure note without sending a customer message.';
  }
  if (action === 'reopen_with_reply') {
    return 'Reopens the ticket and starts a fresh customer-facing thread update.';
  }
  return 'Sends the reply and moves the ticket into waiting on customer.';
}

export function buildSupportReplySubject(supportCaseId: string, ticketSubject: string | null | undefined) {
  const base = ticketSubject?.trim() || `Update on ${supportCaseId}`;
  return base.toLowerCase().startsWith('re:') ? base : `Re: ${base}`;
}

export function assignmentSummary(assignment: WebSupportAssignmentRecord | null) {
  if (!assignment) {
    return 'Unassigned';
  }
  const owner = assignment.assignedAdminEmail ?? supportRoleLabel(assignment.assignedRole);
  return `${supportQueueLabel(assignment.queueId)} · ${owner}`;
}

export function supportRoleLabel(roleOrAdmin: PlatformAdminRole | WebSupportAdminContext | string | null) {
  const role = typeof roleOrAdmin === 'string' ? roleOrAdmin : roleOrAdmin?.role ?? null;
  if (!role) {
    return 'No role';
  }
  return role
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function supportRoleScopeSummary(admin: WebSupportAdminContext | null) {
  if (!admin) {
    return 'Support scope is loading.';
  }
  if (admin.supportCapability.mutateAll) {
    return 'Can assign, update, and audit every support queue.';
  }
  if (admin.supportCapability.canAssignTickets) {
    return 'Can work only the queues listed below.';
  }
  return 'Audit visibility only. No ticket mutation is allowed.';
}

export function supportAllowedQueueSummary(admin: WebSupportAdminContext | null, queues: WebSupportQueueRecord[]) {
  if (!admin) {
    return 'Queue access is loading.';
  }
  if (admin.supportCapability.readAll && admin.supportCapability.allowedQueues.length === 0) {
    return 'Can read every support queue.';
  }
  const labels = admin.supportCapability.allowedQueues
    .map((queueId) => queues.find((queue) => queue.id === queueId)?.label ?? supportQueueLabel(queueId))
    .join(', ');
  return labels ? `Queues: ${labels}` : 'No queue access recorded.';
}

export function inferDefaultAssignedRole(queueId: SupportQueueId): PlatformAdminRole {
  if (queueId === 'billing' || queueId === 'purchase') {
    return 'finance_admin';
  }
  if (queueId === 'privacy') {
    return 'admin';
  }
  return 'support_admin';
}

export function queueDescription(queueId: string, queues: WebSupportQueueRecord[]) {
  return queues.find((queue) => queue.id === queueId)?.description ?? 'No queue description recorded.';
}

export function supportPriorityLabel(priority: string | null | undefined) {
  const value = priority?.trim() || 'normal';
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function supportTicketStatusLabel(status: string | null | undefined) {
  if (!status) {
    return 'Status not set';
  }
  return status
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function supportQueueLabel(queueId: string | null | undefined) {
  return SUPPORT_QUEUE_LABELS[queueId ?? ''] ?? 'General';
}

export function supportAuditSourceLabel(source: WebSupportAuditRecord['source']) {
  if (source === 'assignment') {
    return 'Assignment';
  }
  if (source === 'email_request') {
    return 'Outbound';
  }
  if (source === 'event') {
    return 'Audit event';
  }
  return 'Message';
}

export function resolveSupportContactEmail(
  row: SupportShellRow,
  consents: WebSupportDiagnosticConsentRecord[]
) {
  return row.ticket?.customerEmail ?? consents.find((consent) => consent.userEmail)?.userEmail ?? row.supportCase.latestNoteByEmail ?? null;
}

export function requiresResolutionReason(action: OfficeSupportCaseAction) {
  return action === 'resolve' || action === 'close';
}

export function getLinkedSupportCaseEvents(
  events: WebSupportCaseAuditEvent[],
  consent: WebSupportDiagnosticConsentRecord
) {
  return events
    .filter((event) =>
      event.supportConsentId === consent.id ||
      Boolean(consent.supportCaseId && event.supportCaseId === consent.supportCaseId)
    )
    .slice(0, 4);
}

export function buildCaseMap<T>(items: T[], getSupportCaseId: (item: T) => string | null) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const supportCaseId = getSupportCaseId(item);
    if (!supportCaseId) {
      continue;
    }
    grouped.set(supportCaseId, [...(grouped.get(supportCaseId) ?? []), item]);
  }
  return grouped;
}

export function countSupportCases(
  supportCases: WebSupportCaseRecord[],
  predicate: (supportCase: WebSupportCaseRecord) => boolean
) {
  return supportCases.filter(predicate).length;
}

export function countSupportConsents(
  supportConsents: WebSupportDiagnosticConsentRecord[],
  predicate: (supportConsent: WebSupportDiagnosticConsentRecord) => boolean
) {
  return supportConsents.filter(predicate).length;
}

export function actionLabel(action: string) {
  if (action === 'mark_reviewing') {
    return 'Mark reviewing';
  }
  if (action === 'approve') {
    return 'Approve';
  }
  if (action === 'reject') {
    return 'Reject';
  }
  if (action === 'grant_access') {
    return 'Grant Office access';
  }
  return 'Review';
}

export function officeActionNote(action: string) {
  if (action === 'grant_access') {
    return 'Office access granted after internal review.';
  }
  if (action === 'approve') {
    return 'Office request approved after internal review.';
  }
  if (action === 'reject') {
    return 'Office request rejected after internal review.';
  }
  return 'Office request marked for internal review.';
}

export function supportKindLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'not set';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function supportReportFilename(report: { type: WebSupportReportType; generatedAt: string }) {
  const stamp = report.generatedAt.replace(/[:]/g, '-').replace(/\..*/, '');
  return `orbit-ledger-support-${report.type}-${stamp}.csv`;
}
