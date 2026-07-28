'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  canSupportRoleAccessQueue,
  getSupportSlaState,
  isSupportQuietHoursActive,
  type OfficeSupportCaseAction,
  type PlatformAdminRole,
  type SupportQueueId,
  type SupportResolutionReason,
  type SupportSlaState,
} from '@orbit-ledger/core';

import {
  buildWebSupportAuditRecords,
  buildWebSupportPrintHtml,
  buildWebSupportReport,
  buildWebSupportReportCsv,
  filterWebSupportAuditRecords,
  OFFICE_FINAL_LAUNCH_FREEZE_ITEMS,
  OFFICE_PRODUCTION_READINESS_CHECKLIST,
  OFFICE_SUPPORT_REVIEW_GUARDRAILS,
  isWebOfficeOperationsAllowed,
  loadWebOfficeOperationsSnapshot,
  recordWebSupportCaseAdminAction,
  recordWebOfficeSupportReportEvent,
  recordWebSupportTicketAssignment,
  recordWebOfficeSupportReview,
  resolveWebOfficeAccessRequest,
  sendWebSupportReply,
  updateWebSupportNotificationPreferences,
  type WebSupportAuditFilters,
  type WebSupportAuditRecord,
  type WebSupportNotificationPreferenceRecord,
  type WebOfficeOperationsSnapshot,
  type WebSupportAdminContext,
  type WebSupportAssignmentRecord,
  type WebSupportCaseAuditEvent,
  type WebSupportCaseRecord,
  type WebSupportDiagnosticConsentRecord,
  type WebSupportMessageRecord,
  type WebSupportQueueRecord,
  type WebSupportReplyAction,
  type WebSupportReportType,
  type WebSupportTicketRecord,
} from '@/lib/office-admin-operations';
import {
  OperationsFieldHelp,
  actionLabel,
  assignmentSummary,
  buildCaseMap,
  buildSupportReplySubject,
  chipClassForTone,
  countSupportCases,
  countSupportConsents,
  formatDate,
  getLinkedSupportCaseEvents,
  inferDefaultAssignedRole,
  officeActionNote,
  playSupportNotificationTone,
  queueDescription,
  requiresResolutionReason,
  resolveSupportContactEmail,
  supportAllowedQueueSummary,
  supportAuditChipClass,
  supportAuditSourceLabel,
  supportCaseChipClass,
  supportCaseStatusLabel,
  supportKindLabel,
  supportNotificationToneLabel,
  supportPriorityLabel,
  supportQueueLabel,
  supportReplyActionButtonLabel,
  supportReplyActionHelper,
  supportReplyActionLabel,
  supportReportFilename,
  supportRoleLabel,
  supportRoleScopeSummary,
  supportSlaChipClass,
  supportTicketSlaLabel,
  supportTicketSlaState,
  supportTicketStatusLabel,
  operationsMetricHref,
  SUPPORT_QUEUE_LABELS,
  type SupportShellRow,
} from './operations-parts';
import { startWebUserContextSession, type WebUserContextMode } from '@/lib/user-context';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';


type SupportTimelineEntry = {
  id: string;
  createdAt: string | null;
  kind: 'message' | 'event';
  tone: 'success' | 'warning' | 'default';
  title: string;
  body: string;
  meta: string;
  badge: string;
};

export type OperationsConsoleSection =
  | 'overview'
  | 'support-inbox'
  | 'assignments'
  | 'access-requests'
  | 'diagnostics-consent'
  | 'exports-reports'
  | 'audit';

const SUPPORT_FILTER_OPTIONS = [
  {
    value: 'active',
    label: 'Open and reopened',
    helper: 'Needs operator movement.',
  },
  {
    value: 'open',
    label: 'Open',
    helper: 'Fresh cases waiting for review.',
  },
  {
    value: 'reopened',
    label: 'Reopened',
    helper: 'Customer followed up after a prior close.',
  },
  {
    value: 'waiting_on_customer',
    label: 'Waiting on customer',
    helper: 'Support is blocked on customer input.',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    helper: 'Work is complete or paused cleanly.',
  },
  {
    value: 'all',
    label: 'All cases',
    helper: 'Show every support case in this workspace.',
  },
] as const;

const CASE_ACTION_OPTIONS: Array<{ value: OfficeSupportCaseAction; label: string }> = [
  { value: 'add_note', label: 'Add internal note' },
  { value: 'start_work', label: 'Started working' },
  { value: 'wait_for_customer', label: 'Pending customer' },
  { value: 'wait_for_internal', label: 'Pending internal' },
  { value: 'resolve', label: 'Resolved' },
  { value: 'close', label: 'Closed' },
  { value: 'reopen', label: 'Reopened' },
];

const SUPPORT_RESOLUTION_REASON_OPTIONS: Array<{ value: SupportResolutionReason; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'answered', label: 'Answered' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'cannot_reproduce', label: 'Cannot reproduce' },
  { value: 'policy_blocked', label: 'Policy blocked' },
  { value: 'customer_stopped_replying', label: 'Customer stopped replying' },
  { value: 'other', label: 'Other' },
];

const ASSIGNABLE_ROLE_OPTIONS: Array<{ value: PlatformAdminRole; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'finance_admin', label: 'Finance Admin' },
  { value: 'support_admin', label: 'Support Admin' },
  { value: 'read_only_admin', label: 'Read-only Admin' },
];

const OWNER_FILTER_OPTIONS = [
  { value: 'all', label: 'All ownership' },
  { value: 'mine', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
] as const;

const SUPPORT_REPLY_ACTION_OPTIONS: Array<{ value: WebSupportReplyAction; label: string; helper: string }> = [
  { value: 'reply', label: 'Reply and wait', helper: 'Sends the customer reply and moves the ticket to waiting on customer.' },
  { value: 'close_with_reply', label: 'Reply and close', helper: 'Sends the customer reply and closes the ticket with an outcome reason.' },
  { value: 'close_silently', label: 'Close silently', helper: 'Closes the ticket without sending a customer email.' },
  { value: 'reopen_with_reply', label: 'Reopen and reply', helper: 'Reopens the ticket and sends the customer a new reply.' },
];

export default function OperationsConsole({ section }: { section: OperationsConsoleSection }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState<WebOfficeOperationsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [supportCaseId, setSupportCaseId] = useState('');
  const [supportReason, setSupportReason] = useState('');
  const [supportDiagnosticsApproved, setSupportDiagnosticsApproved] = useState(false);
  const [caseAction, setCaseAction] = useState<OfficeSupportCaseAction>('add_note');
  const [caseNote, setCaseNote] = useState('');
  const [caseResolutionReason, setCaseResolutionReason] = useState<SupportResolutionReason | ''>('');
  const [caseIdForUpdate, setCaseIdForUpdate] = useState('');
  const [emailCaseId, setEmailCaseId] = useState('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [replyAction, setReplyAction] = useState<WebSupportReplyAction>('reply');
  const [replyResolutionReason, setReplyResolutionReason] = useState<SupportResolutionReason | ''>('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('active');
  const [supportCaseFilter, setSupportCaseFilter] = useState<(typeof SUPPORT_FILTER_OPTIONS)[number]['value']>('active');
  const [supportQueueFilter, setSupportQueueFilter] = useState('all');
  const [supportOwnerFilter, setSupportOwnerFilter] = useState<(typeof OWNER_FILTER_OPTIONS)[number]['value']>('all');
  const [operationsSearch, setOperationsSearch] = useState('');
  const [supportAuditActorRoleFilter, setSupportAuditActorRoleFilter] = useState('all');
  const [supportAuditStatusFilter, setSupportAuditStatusFilter] = useState('all');
  const [supportAuditDateFrom, setSupportAuditDateFrom] = useState('');
  const [supportAuditDateTo, setSupportAuditDateTo] = useState('');
  const [supportAuditSearch, setSupportAuditSearch] = useState('');
  const [supportReportType, setSupportReportType] = useState<WebSupportReportType>('audit_trail');
  const [supportReportScope, setSupportReportScope] = useState<'selected_case' | 'workspace_view'>('selected_case');
  const [selectedSupportCaseId, setSelectedSupportCaseId] = useState('');
  const [isRecordingSupportReview, setIsRecordingSupportReview] = useState(false);
  const [isSavingSupportCase, setIsSavingSupportCase] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isQueueingSupportEmail, setIsQueueingSupportEmail] = useState(false);
  const [busySupportReportAction, setBusySupportReportAction] = useState<'download_csv' | 'print_report' | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<WebSupportNotificationPreferenceRecord | null>(null);
  const [isSavingNotificationPreferences, setIsSavingNotificationPreferences] = useState(false);
  const [assignmentQueueId, setAssignmentQueueId] = useState('general');
  const [assignmentRole, setAssignmentRole] = useState<PlatformAdminRole>('support_admin');
  const [assignmentAdminEmail, setAssignmentAdminEmail] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [userContextReason, setUserContextReason] = useState('');
  const [userContextError, setUserContextError] = useState<string | null>(null);
  const [userContextMessage, setUserContextMessage] = useState<string | null>(null);
  const [isStartingUserContext, setIsStartingUserContext] = useState(false);
  const previousUnreadCountRef = useRef(0);
  const isAllowed = useMemo(() => isWebOfficeOperationsAllowed(user?.email), [user?.email]);

  const supportTicketByCaseId = useMemo(() => {
    const entries = (snapshot?.supportTickets ?? [])
      .filter((ticket) => ticket.supportCaseId)
      .map((ticket) => [ticket.supportCaseId as string, ticket] as const);
    return new Map(entries);
  }, [snapshot?.supportTickets]);
  const currentAdmin = snapshot?.currentAdmin ?? null;
  const canStartReadOnlyUserContext =
    currentAdmin?.role === 'super_admin' || currentAdmin?.role === 'admin' || currentAdmin?.role === 'support_admin';
  const canStartActionEnabledUserContext = currentAdmin?.role === 'super_admin' || currentAdmin?.role === 'admin';
  const supportQueues = snapshot?.supportQueues ?? [];
  const notificationPreference = notificationPreferences ?? snapshot?.supportNotificationPreference ?? null;
  const supportAssignmentById = useMemo(
    () => new Map((snapshot?.supportAssignments ?? []).map((assignment) => [assignment.id, assignment] as const)),
    [snapshot?.supportAssignments]
  );

  const supportConsentsByCaseId = useMemo(
    () => buildCaseMap(snapshot?.supportConsents ?? [], (consent) => consent.supportCaseId),
    [snapshot?.supportConsents]
  );
  const supportMessagesByCaseId = useMemo(
    () => buildCaseMap(snapshot?.supportMessages ?? [], (message) => message.supportCaseId),
    [snapshot?.supportMessages]
  );
  const supportEventsByCaseId = useMemo(
    () => buildCaseMap(snapshot?.supportCaseEvents ?? [], (event) => event.supportCaseId),
    [snapshot?.supportCaseEvents]
  );
  const supportEmailsByCaseId = useMemo(
    () => buildCaseMap(snapshot?.supportCaseEmailRequests ?? [], (request) => request.supportCaseId),
    [snapshot?.supportCaseEmailRequests]
  );
  const supportAuditRecords = useMemo(
    () =>
      buildWebSupportAuditRecords({
        supportTickets: snapshot?.supportTickets ?? [],
        supportMessages: snapshot?.supportMessages ?? [],
        supportAssignments: snapshot?.supportAssignments ?? [],
        supportCaseEmailRequests: snapshot?.supportCaseEmailRequests ?? [],
        supportCaseEvents: snapshot?.supportCaseEvents ?? [],
      }),
    [
      snapshot?.supportAssignments,
      snapshot?.supportCaseEmailRequests,
      snapshot?.supportCaseEvents,
      snapshot?.supportMessages,
      snapshot?.supportTickets,
    ]
  );
  const unreadSupportRecords = useMemo(() => {
    const seenAt = notificationPreference?.lastViewedSupportAt ? Date.parse(notificationPreference.lastViewedSupportAt) : 0;
    return supportAuditRecords.filter((record) => {
      const createdAt = record.createdAt ? Date.parse(record.createdAt) : NaN;
      return Number.isFinite(createdAt) && createdAt > seenAt;
    });
  }, [notificationPreference?.lastViewedSupportAt, supportAuditRecords]);
  const unreadCustomerRecords = useMemo(
    () =>
      unreadSupportRecords.filter(
        (record) => record.source === 'message' && record.actorRole === 'customer'
      ),
    [unreadSupportRecords]
  );

  const filteredReviewQueue = useMemo(
    () =>
      (snapshot?.queue ?? []).filter((item) => {
        const matchesStatus =
          reviewStatusFilter === 'all' ||
          (reviewStatusFilter === 'active' && item.actionPlans.length > 0) ||
          item.request.status === reviewStatusFilter;
        const search = operationsSearch.trim().toLowerCase();
        const matchesSearch =
          !search ||
          item.title.toLowerCase().includes(search) ||
          item.detail.toLowerCase().includes(search) ||
          item.request.requesterEmail.toLowerCase().includes(search);
        return matchesStatus && matchesSearch;
      }),
    [operationsSearch, reviewStatusFilter, snapshot?.queue]
  );

  const filteredSupportCases = useMemo(
    () =>
      (snapshot?.supportCases ?? []).filter((supportCase) => {
        const matchesStatus =
          supportCaseFilter === 'all' ||
          (supportCaseFilter === 'active' && supportCase.status !== 'resolved' && supportCase.status !== 'closed') ||
          supportCase.status === supportCaseFilter;
        const ticket = supportTicketByCaseId.get(supportCase.supportCaseId) ?? null;
        const currentAssignment = ticket?.currentAssignmentId ? supportAssignmentById.get(ticket.currentAssignmentId) ?? null : null;
        const matchesQueue = supportQueueFilter === 'all' || ticket?.queueId === supportQueueFilter;
        const matchesOwner =
          supportOwnerFilter === 'all' ||
          (supportOwnerFilter === 'mine' && Boolean(currentAssignment?.assignedAdminUid && currentAssignment.assignedAdminUid === user?.uid)) ||
          (supportOwnerFilter === 'unassigned' && !currentAssignment);
        const search = operationsSearch.trim().toLowerCase();
        const searchHaystack = [
          supportCase.supportCaseId,
          supportCase.latestNote,
          ticket?.subject ?? '',
          ticket?.summary ?? '',
          ticket?.customerEmail ?? '',
          ticket?.customerName ?? '',
          supportQueueLabel(ticket?.queueId),
          currentAssignment?.assignedAdminEmail ?? '',
          assignmentSummary(currentAssignment),
        ]
          .join(' ')
          .toLowerCase();
        const matchesSearch = !search || searchHaystack.includes(search);
        return matchesStatus && matchesQueue && matchesOwner && matchesSearch;
      }),
    [operationsSearch, snapshot?.supportCases, supportCaseFilter, supportQueueFilter, supportOwnerFilter, supportTicketByCaseId, supportAssignmentById, user?.uid]
  );

  const supportShellRows = useMemo<SupportShellRow[]>(
    () =>
      filteredSupportCases.map((supportCase) => {
        const ticket = supportTicketByCaseId.get(supportCase.supportCaseId) ?? null;
        const messages = supportMessagesByCaseId.get(supportCase.supportCaseId) ?? [];
        return {
          supportCase,
          ticket,
          currentAssignment: ticket?.currentAssignmentId ? supportAssignmentById.get(ticket.currentAssignmentId) ?? null : null,
          latestMessage: messages[0] ?? null,
          consentCount: (supportConsentsByCaseId.get(supportCase.supportCaseId) ?? []).length,
          pendingEmailCount: (supportEmailsByCaseId.get(supportCase.supportCaseId) ?? []).length,
          eventCount: (supportEventsByCaseId.get(supportCase.supportCaseId) ?? []).length,
        };
      }),
    [
      filteredSupportCases,
      supportConsentsByCaseId,
      supportEmailsByCaseId,
      supportEventsByCaseId,
      supportMessagesByCaseId,
      supportAssignmentById,
      supportTicketByCaseId,
    ]
  );
  const supportRowsWithSla = useMemo(
    () =>
      supportShellRows.map((row) => ({
        row,
        firstResponseState: supportTicketSlaState(row.ticket, 'first_response'),
        resolutionState: supportTicketSlaState(row.ticket, 'resolution'),
      })),
    [supportShellRows]
  );
  const overdueSupportRows = useMemo(
    () =>
      supportRowsWithSla.filter(
        (entry) => entry.firstResponseState === 'overdue' || entry.resolutionState === 'overdue'
      ),
    [supportRowsWithSla]
  );
  const dueSoonSupportRows = useMemo(
    () =>
      supportRowsWithSla.filter(
        (entry) =>
          entry.firstResponseState === 'due_soon' ||
          entry.resolutionState === 'due_soon'
      ),
    [supportRowsWithSla]
  );
  const urgentSupportRows = useMemo(
    () =>
      supportShellRows.filter(
        (row) => row.ticket?.notificationTone === 'urgent' || row.ticket?.priority === 'urgent'
      ),
    [supportShellRows]
  );
  const quietHoursActive = useMemo(
    () =>
      isSupportQuietHoursActive({
        quietHoursStart: notificationPreference?.quietHoursStart ?? null,
        quietHoursEnd: notificationPreference?.quietHoursEnd ?? null,
      }),
    [notificationPreference?.quietHoursEnd, notificationPreference?.quietHoursStart]
  );

  const selectedSupportRow = useMemo(
    () => supportShellRows.find((row) => row.supportCase.supportCaseId === selectedSupportCaseId) ?? supportShellRows[0] ?? null,
    [selectedSupportCaseId, supportShellRows]
  );

  const selectedSupportEvents = useMemo(
    () =>
      selectedSupportRow
        ? supportEventsByCaseId.get(selectedSupportRow.supportCase.supportCaseId) ?? []
        : [],
    [selectedSupportRow, supportEventsByCaseId]
  );
  const selectedSupportConsents = useMemo(
    () =>
      selectedSupportRow
        ? supportConsentsByCaseId.get(selectedSupportRow.supportCase.supportCaseId) ?? []
        : [],
    [selectedSupportRow, supportConsentsByCaseId]
  );
  const selectedSupportEmails = useMemo(
    () =>
      selectedSupportRow
        ? supportEmailsByCaseId.get(selectedSupportRow.supportCase.supportCaseId) ?? []
        : [],
    [selectedSupportRow, supportEmailsByCaseId]
  );
  const selectedSupportAssignment = selectedSupportRow?.currentAssignment ?? null;
  const supportAuditActorRoleOptions = useMemo(
    () =>
      Array.from(new Set(supportAuditRecords.map((record) => record.actorRole).filter(Boolean) as string[])).sort((left, right) =>
        left.localeCompare(right)
      ),
    [supportAuditRecords]
  );
  const supportAuditStatusOptions = useMemo(
    () =>
      Array.from(new Set(supportAuditRecords.map((record) => record.status).filter(Boolean) as string[])).sort((left, right) =>
        left.localeCompare(right)
      ),
    [supportAuditRecords]
  );
  const supportAuditFilters = useMemo<WebSupportAuditFilters>(
    () => ({
      supportCaseId:
        supportReportScope === 'selected_case' ? selectedSupportRow?.supportCase.supportCaseId ?? null : null,
      queueId: supportQueueFilter === 'all' ? null : supportQueueFilter,
      actorRole: supportAuditActorRoleFilter === 'all' ? null : supportAuditActorRoleFilter,
      ticketStatus: supportAuditStatusFilter === 'all' ? null : supportAuditStatusFilter,
      dateFrom: supportAuditDateFrom || null,
      dateTo: supportAuditDateTo || null,
      search: supportAuditSearch || null,
    }),
    [
      selectedSupportRow?.supportCase.supportCaseId,
      supportAuditActorRoleFilter,
      supportAuditDateFrom,
      supportAuditDateTo,
      supportAuditSearch,
      supportAuditStatusFilter,
      supportQueueFilter,
      supportReportScope,
    ]
  );
  const filteredSupportAuditRecords = useMemo(
    () => filterWebSupportAuditRecords(supportAuditRecords, supportAuditFilters),
    [supportAuditFilters, supportAuditRecords]
  );
  const selectedSupportExactHistory = useMemo(
    () =>
      selectedSupportRow
        ? filterWebSupportAuditRecords(supportAuditRecords, {
            ...supportAuditFilters,
            supportCaseId: selectedSupportRow.supportCase.supportCaseId,
          })
        : [],
    [selectedSupportRow, supportAuditFilters, supportAuditRecords]
  );
  const supportReport = useMemo(
    () =>
      currentAdmin
        ? buildWebSupportReport({
            type: supportReportType,
            generatedAt: new Date().toISOString(),
            generatedBy: currentAdmin.email ?? 'Orbit Ledger',
            adminRole: currentAdmin.role,
            filters: supportAuditFilters,
            supportTickets: snapshot?.supportTickets ?? [],
            supportAssignments: snapshot?.supportAssignments ?? [],
            supportCaseEmailRequests: snapshot?.supportCaseEmailRequests ?? [],
            supportConsents: snapshot?.supportConsents ?? [],
            auditRecords: filteredSupportAuditRecords,
          })
        : null,
    [
      currentAdmin,
      filteredSupportAuditRecords,
      snapshot?.supportAssignments,
      snapshot?.supportCaseEmailRequests,
      snapshot?.supportConsents,
      snapshot?.supportTickets,
      supportAuditFilters,
      supportReportType,
    ]
  );
  const supportAuditSummary = useMemo(
    () => [
      {
        id: 'history-total',
        label: 'Audit rows',
        value: filteredSupportAuditRecords.length,
        helper: 'Filtered interactions in the current report scope.',
      },
      {
        id: 'history-customer',
        label: 'Customer-visible',
        value: filteredSupportAuditRecords.filter((record) => record.visibleToCustomer).length,
        helper: 'Replies or messages that were visible to the customer.',
      },
      {
        id: 'history-operator',
        label: 'Internal only',
        value: filteredSupportAuditRecords.filter((record) => !record.visibleToCustomer).length,
        helper: 'Notes, assignment changes, and internal audit events.',
      },
    ],
    [filteredSupportAuditRecords]
  );
  const assignmentQueueOptions = useMemo(
    () => (supportQueues.length ? supportQueues : Object.entries(SUPPORT_QUEUE_LABELS).map(([id, label]) => ({ id, label, description: '', createdAt: null, updatedAt: null }))),
    [supportQueues]
  );
  const assignableQueueOptions = useMemo(
    () =>
      currentAdmin
        ? assignmentQueueOptions.filter(
            (queue) => currentAdmin.supportCapability.mutateAll || currentAdmin.supportCapability.allowedQueues.includes(queue.id)
          )
        : [],
    [assignmentQueueOptions, currentAdmin]
  );
  const allowedAssignmentRoles = useMemo(
    () =>
      ASSIGNABLE_ROLE_OPTIONS.filter(
        (option) => option.value !== 'read_only_admin' && canSupportRoleAccessQueue(option.value, assignmentQueueId as SupportQueueId)
      ),
    [assignmentQueueId]
  );
  const canAssignSelectedTicket = Boolean(
    currentAdmin &&
      selectedSupportRow?.ticket &&
      currentAdmin.supportCapability.canAssignTickets &&
      (currentAdmin.supportCapability.mutateAll ||
        currentAdmin.supportCapability.allowedQueues.includes(selectedSupportRow.ticket.queueId))
  );
  const canEditSelectedTicket = Boolean(
    currentAdmin &&
      selectedSupportRow?.ticket &&
      (currentAdmin.supportCapability.mutateAll ||
        currentAdmin.supportCapability.allowedQueues.includes(selectedSupportRow.ticket.queueId))
  );
  const canRecordSupportReview = Boolean(
    currentAdmin &&
      (currentAdmin.supportCapability.mutateAll ||
        currentAdmin.supportCapability.canAddInternalNotes ||
        currentAdmin.supportCapability.canChangeStatus ||
        currentAdmin.supportCapability.canAssignTickets)
  );
  const canPrepareFollowUp = Boolean(
    currentAdmin &&
      selectedSupportRow?.ticket &&
      (currentAdmin.supportCapability.mutateAll ||
        currentAdmin.supportCapability.allowedQueues.includes(selectedSupportRow.ticket.queueId)) &&
      (currentAdmin.supportCapability.canSendReplies || currentAdmin.supportCapability.canChangeStatus)
  );
  const replyActionNeedsDelivery = replyAction !== 'close_silently';
  const replyActionNeedsResolution = replyAction === 'close_with_reply' || replyAction === 'close_silently';
  const selectedSupportTimeline = useMemo<SupportTimelineEntry[]>(
    () =>
      selectedSupportExactHistory.map((record) => ({
        id: record.id,
        createdAt: record.createdAt,
        kind: record.source === 'event' ? ('event' as const) : ('message' as const),
        tone: record.tone,
        title: record.title,
        body: record.detail,
        meta: `${record.actorEmail ?? supportRoleLabel(record.actorRole)} · ${
          record.visibleToCustomer ? 'Customer-visible' : 'Internal only'
        }`,
        badge: `${supportAuditSourceLabel(record.source)}${record.status ? ` · ${supportTicketStatusLabel(record.status)}` : ''}`,
      })),
    [selectedSupportExactHistory]
  );

  const supportRailHighlights = useMemo(
    () => [
      {
        id: 'open',
        label: 'Open cases',
        helper: 'Still waiting for operator movement.',
        count: countSupportCases(snapshot?.supportCases ?? [], (item) => item.status === 'open' || item.status === 'reopened'),
      },
      {
        id: 'diagnostics',
        label: 'Diagnostics linked',
        helper: 'Cases with customer-approved review data.',
        count: supportShellRows.filter((row) => row.consentCount > 0).length,
      },
      {
        id: 'followups',
        label: 'Follow-ups prepared',
        helper: 'Customer update drafts already prepared.',
        count: snapshot?.supportCaseEmailRequests.length ?? 0,
      },
      {
        id: 'sla-overdue',
        label: 'Overdue SLAs',
        helper: 'Tickets that are past first-response or resolution targets.',
        count: overdueSupportRows.length,
      },
    ],
    [overdueSupportRows.length, snapshot?.supportCaseEmailRequests.length, snapshot?.supportCases, supportShellRows]
  );

  const supportShellSummary = useMemo(
    () => [
      {
        id: 'support-open',
        label: 'Open support',
        value: countSupportCases(snapshot?.supportCases ?? [], (item) => item.status === 'open' || item.status === 'reopened'),
        helper: 'Cases that still need operator movement.',
        tone: countSupportCases(snapshot?.supportCases ?? [], (item) => item.status === 'open' || item.status === 'reopened') ? 'warning' : 'success',
      },
      {
        id: 'support-waiting',
        label: 'Waiting on customer',
        value: countSupportCases(snapshot?.supportCases ?? [], (item) => item.status === 'waiting_on_customer'),
        helper: 'Cases paused until a customer replies.',
        tone: 'default',
      },
      {
        id: 'support-resolved',
        label: 'Resolved cases',
        value: countSupportCases(snapshot?.supportCases ?? [], (item) => item.status === 'resolved'),
        helper: 'Closed-loop support work for this workspace.',
        tone: 'success',
      },
      {
        id: 'support-diagnostics',
        label: 'Active diagnostics',
        value: countSupportConsents(snapshot?.supportConsents ?? [], (item) => item.isActiveForReview),
        helper: 'Customer-approved diagnostic packs still valid for review.',
        tone: countSupportConsents(snapshot?.supportConsents ?? [], (item) => item.isActiveForReview) ? 'premium' : 'default',
      },
      {
        id: 'support-unread',
        label: 'Unread support',
        value: unreadSupportRecords.length,
        helper: 'Audit and message activity newer than your seen marker.',
        tone: unreadSupportRecords.length ? 'warning' : 'success',
      },
    ],
    [snapshot?.supportCases, snapshot?.supportConsents, unreadSupportRecords.length]
  );

  useEffect(() => {
    if (!activeWorkspace?.workspaceId || !isAllowed) {
      setSnapshot(null);
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.workspaceId, isAllowed]);

  useEffect(() => {
    if (!supportShellRows.length) {
      setSelectedSupportCaseId('');
      return;
    }

    if (!supportShellRows.some((row) => row.supportCase.supportCaseId === selectedSupportCaseId)) {
      setSelectedSupportCaseId(supportShellRows[0].supportCase.supportCaseId);
    }
  }, [selectedSupportCaseId, supportShellRows]);

  useEffect(() => {
    if (!selectedSupportRow?.ticket) {
      setAssignmentQueueId('general');
      setAssignmentRole('support_admin');
      setAssignmentAdminEmail('');
      setAssignmentReason('');
      setEmailCaseId('');
      setEmailRecipient('');
      setEmailSubject('');
      setEmailBody('');
      setReplyAction('reply');
      setReplyResolutionReason('');
      return;
    }

    setAssignmentQueueId(selectedSupportRow.ticket.queueId);
    setAssignmentRole(selectedSupportRow.currentAssignment?.assignedRole ?? inferDefaultAssignedRole(selectedSupportRow.ticket.queueId as SupportQueueId));
    setAssignmentAdminEmail(selectedSupportRow.currentAssignment?.assignedAdminEmail ?? '');
    setAssignmentReason(selectedSupportRow.currentAssignment?.reason ?? '');
    setEmailCaseId(selectedSupportRow.supportCase.supportCaseId);
    setEmailRecipient(selectedSupportRow.ticket.customerEmail ?? '');
    setEmailSubject(buildSupportReplySubject(selectedSupportRow.supportCase.supportCaseId, selectedSupportRow.ticket.subject));
    setEmailBody('');
    setReplyAction('reply');
    setReplyResolutionReason('');
    setUserContextReason('');
    setUserContextError(null);
    setUserContextMessage(null);
  }, [selectedSupportRow]);

  useEffect(() => {
    if (!allowedAssignmentRoles.some((option) => option.value === assignmentRole)) {
      setAssignmentRole(inferDefaultAssignedRole(assignmentQueueId as SupportQueueId));
    }
  }, [allowedAssignmentRoles, assignmentQueueId, assignmentRole]);

  useEffect(() => {
    if (!snapshot?.supportNotificationPreference) {
      return;
    }
    setNotificationPreferences(snapshot.supportNotificationPreference);
  }, [snapshot?.supportNotificationPreference]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return;
    }

    setNotificationPreferences((current) => {
      if (!current || current.browserPermissionState === Notification.permission) {
        return current;
      }
      return {
        ...current,
        browserPermissionState: Notification.permission,
      };
    });
  }, []);

  useEffect(() => {
    const nextUnreadCount = unreadCustomerRecords.length;
    const previousUnreadCount = previousUnreadCountRef.current;
    previousUnreadCountRef.current = nextUnreadCount;

    if (nextUnreadCount <= previousUnreadCount) {
      return;
    }
    if (!notificationPreference || notificationPreference.muteAll || quietHoursActive) {
      return;
    }
    if (!notificationPreference.browserNotificationsEnabled || notificationPreference.browserPermissionState !== 'granted') {
      return;
    }
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return;
    }

    const latestUnread = unreadCustomerRecords[0];
    const notification = new Notification('OrbitLedger support update', {
      body: latestUnread
        ? `${latestUnread.supportCaseId ?? 'Support ticket'}: ${latestUnread.title}`
        : 'New customer-visible support activity is waiting in the support center.',
      tag: `support-${latestUnread?.supportCaseId ?? 'workspace'}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    if (notificationPreference.soundEnabled) {
      playSupportNotificationTone();
    }
  }, [
    notificationPreference,
    quietHoursActive,
    unreadCustomerRecords,
  ]);

  async function refresh() {
    if (!activeWorkspace?.workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setSnapshot(await loadWebOfficeOperationsSnapshot(activeWorkspace.workspaceId));
    } catch {
      setError('Office operations could not be loaded for this workspace.');
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSupportNotificationPreferences(nextSeenAt?: string | null) {
    if (!activeWorkspace?.workspaceId || !notificationPreference) {
      showToast('Load the support center before saving notification settings.', 'info');
      return;
    }

    setIsSavingNotificationPreferences(true);
    try {
      const result = await updateWebSupportNotificationPreferences({
        workspaceId: activeWorkspace.workspaceId,
        muteAll: notificationPreference.muteAll,
        desktopAlertsEnabled: notificationPreference.desktopAlertsEnabled,
        browserNotificationsEnabled: notificationPreference.browserNotificationsEnabled,
        browserPermissionState: notificationPreference.browserPermissionState,
        soundEnabled: notificationPreference.soundEnabled,
        quietHoursStart: notificationPreference.quietHoursStart,
        quietHoursEnd: notificationPreference.quietHoursEnd,
        lastViewedSupportAt: nextSeenAt ?? notificationPreference.lastViewedSupportAt,
      });
      setNotificationPreferences(result.preference);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              supportNotificationPreference: result.preference,
            }
          : current
      );
      showToast(result.message, 'success');
    } catch (notificationError) {
      showToast(
        notificationError instanceof Error
          ? notificationError.message
          : 'Support notification settings could not be saved.',
        'danger'
      );
    } finally {
      setIsSavingNotificationPreferences(false);
    }
  }

  async function requestBrowserNotificationPermission() {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      showToast('Browser notifications are not supported in this browser.', 'info');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPreferences((current) =>
      current
        ? {
            ...current,
            browserPermissionState: permission,
            browserNotificationsEnabled: permission === 'granted' ? current.browserNotificationsEnabled : false,
          }
        : current
    );
    showToast(
      permission === 'granted'
        ? 'Browser notifications are now allowed for the support center.'
        : permission === 'denied'
          ? 'Browser notifications were denied for this browser.'
          : 'Browser notification permission was dismissed.',
      permission === 'granted' ? 'success' : 'info'
    );
  }

  function markCurrentSupportActivitySeen() {
    const nowIso = new Date().toISOString();
    setNotificationPreferences((current) =>
      current
        ? {
            ...current,
            lastViewedSupportAt: nowIso,
          }
        : current
    );
    void saveSupportNotificationPreferences(nowIso);
  }

  async function runAction(requestId: string, action: 'mark_reviewing' | 'approve' | 'reject' | 'grant_access') {
    if (!activeWorkspace?.workspaceId) {
      return;
    }

    const actionId = `${requestId}:${action}`;
    setBusyActionId(actionId);
    try {
      const result = await resolveWebOfficeAccessRequest({
        workspaceId: activeWorkspace.workspaceId,
        requestId,
        action,
        note: officeActionNote(action),
      });
      showToast(result.message ?? 'Office request updated.', result.grantedEntitlement ? 'success' : 'info');
      await refresh();
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'Office request could not be updated.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  async function recordSupportReview() {
    if (!activeWorkspace?.workspaceId || !supportReason.trim()) {
      showToast('Add a short support reason before recording review.', 'info');
      return;
    }
    if (!canRecordSupportReview) {
      showToast('This admin role cannot record review notes for the selected support queue.', 'danger');
      return;
    }

    setIsRecordingSupportReview(true);
    try {
      const result = await recordWebOfficeSupportReview({
        workspaceId: activeWorkspace.workspaceId,
        reason: supportReason,
        supportCaseId,
        customerApprovedDiagnosticAccess: supportDiagnosticsApproved,
      });
      showToast(result.message, 'success');
      setSupportCaseId('');
      setSupportReason('');
      setSupportDiagnosticsApproved(false);
      await refresh();
    } catch (supportError) {
      showToast(supportError instanceof Error ? supportError.message : 'Support review could not be recorded.', 'danger');
    } finally {
      setIsRecordingSupportReview(false);
    }
  }

  async function saveSupportCaseUpdate() {
    if (!activeWorkspace?.workspaceId || !caseIdForUpdate.trim() || !caseNote.trim()) {
      showToast('Add a support case and note before saving this update.', 'info');
      return;
    }
    if (!canEditSelectedTicket) {
      showToast('This admin role cannot update the selected support queue.', 'danger');
      return;
    }

    setIsSavingSupportCase(true);
    try {
      const result = await recordWebSupportCaseAdminAction({
        workspaceId: activeWorkspace.workspaceId,
        supportCaseId: caseIdForUpdate,
        action: caseAction,
        note: caseNote,
        resolutionReason: caseResolutionReason || null,
        expectedTicketUpdatedAt: selectedSupportRow?.ticket?.updatedAt ?? null,
      });
      showToast(result.message, 'success');
      setCaseIdForUpdate('');
      setCaseNote('');
      setCaseAction('add_note');
      setCaseResolutionReason('');
      await refresh();
    } catch (caseError) {
      showToast(caseError instanceof Error ? caseError.message : 'Support case could not be updated.', 'danger');
    } finally {
      setIsSavingSupportCase(false);
    }
  }

  function prepareCaseUpdate(supportCase: WebSupportCaseRecord, action: OfficeSupportCaseAction) {
    setCaseIdForUpdate(supportCase.supportCaseId);
    setCaseAction(action);
    setCaseNote('');
    setCaseResolutionReason('');
  }

  function prepareSupportReview(supportCase: WebSupportCaseRecord) {
    setSupportCaseId(supportCase.supportCaseId);
    setSupportReason('');
  }

  async function launchUserContext(mode: WebUserContextMode) {
    if (!selectedSupportRow?.ticket?.customerEmail || !activeWorkspace?.workspaceId || userContextReason.trim().length < 10) {
      showToast('Add a clear reason and pick a support case with a customer email before opening the user area.', 'info');
      return;
    }
    if (mode === 'act_as_user' && !canStartActionEnabledUserContext) {
      showToast('Only Admin or Super Admin can start an action-enabled user session.', 'danger');
      return;
    }
    if (!canStartReadOnlyUserContext) {
      showToast('This role cannot open user-context debugging sessions.', 'danger');
      return;
    }

    setIsStartingUserContext(true);
    setUserContextError(null);
    setUserContextMessage(null);
    try {
      await startWebUserContextSession({
        mode,
        reason: userContextReason.trim(),
        targetEmail: selectedSupportRow.ticket.customerEmail,
        targetWorkspaceId: activeWorkspace.workspaceId,
      });
      setUserContextMessage(
        mode === 'act_as_user'
          ? 'Action-enabled user session started. The workspace is opening in a new tab.'
          : 'Read-only debug session started. The workspace is opening in a new tab.'
      );
      window.open('/dashboard', '_blank', 'noopener,noreferrer');
    } catch (sessionError) {
      const message = sessionError instanceof Error ? sessionError.message : 'The user area could not be opened.';
      setUserContextError(message);
      showToast(message, 'danger');
    } finally {
      setIsStartingUserContext(false);
    }
  }

  async function saveTicketAssignment() {
    if (!activeWorkspace?.workspaceId || !selectedSupportRow?.ticket) {
      showToast('Choose a support ticket before saving an assignment.', 'info');
      return;
    }
    if (!assignmentReason.trim()) {
      showToast('Add a short assignment reason before saving.', 'info');
      return;
    }
    if (!canAssignSelectedTicket) {
      showToast('This admin role cannot assign the selected support queue.', 'danger');
      return;
    }
    if (!allowedAssignmentRoles.some((option) => option.value === assignmentRole)) {
      showToast('Choose an assignee role that is allowed to work in the selected support queue.', 'danger');
      return;
    }

    setIsSavingAssignment(true);
    try {
      const result = await recordWebSupportTicketAssignment({
        workspaceId: activeWorkspace.workspaceId,
        supportCaseId: selectedSupportRow.supportCase.supportCaseId,
        ticketId: selectedSupportRow.ticket.id,
        queueId: assignmentQueueId,
        assignedRole: assignmentRole,
        assignedAdminEmail: assignmentAdminEmail || null,
        reason: assignmentReason,
        expectedTicketUpdatedAt: selectedSupportRow.ticket.updatedAt ?? null,
      });
      showToast(result.message, 'success');
      await refresh();
    } catch (assignmentError) {
      showToast(assignmentError instanceof Error ? assignmentError.message : 'Ticket assignment could not be saved.', 'danger');
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function sendSupportReply() {
    if (!activeWorkspace?.workspaceId || !selectedSupportRow?.ticket || !emailCaseId.trim() || !emailBody.trim()) {
      showToast('Add the selected case and reply message before sending from the support center.', 'info');
      return;
    }
    if (!canPrepareFollowUp) {
      showToast('This admin role cannot send customer replies for the selected support queue.', 'danger');
      return;
    }
    if (replyActionNeedsDelivery && (!emailRecipient.trim() || !emailSubject.trim())) {
      showToast('Add the customer recipient and subject before sending this reply.', 'info');
      return;
    }
    if (replyActionNeedsResolution && !replyResolutionReason) {
      showToast('Choose an outcome reason before closing this ticket from the reply composer.', 'info');
      return;
    }

    setIsQueueingSupportEmail(true);
    try {
      const result = await sendWebSupportReply({
        workspaceId: activeWorkspace.workspaceId,
        supportCaseId: emailCaseId,
        ticketId: selectedSupportRow.ticket.id,
        recipientEmail: replyActionNeedsDelivery ? emailRecipient : null,
        subject: replyActionNeedsDelivery ? emailSubject : null,
        body: emailBody,
        action: replyAction,
        resolutionReason: replyActionNeedsResolution ? (replyResolutionReason || null) : null,
        expectedTicketUpdatedAt: selectedSupportRow.ticket.updatedAt ?? null,
      });
      showToast(result.message, 'success');
      setEmailBody('');
      setReplyAction('reply');
      setReplyResolutionReason('');
      await refresh();
    } catch (emailError) {
      showToast(emailError instanceof Error ? emailError.message : 'Customer reply could not be sent from the support center.', 'danger');
    } finally {
      setIsQueueingSupportEmail(false);
    }
  }

  function prepareSupportReply(supportCase: WebSupportCaseRecord, ticket: WebSupportTicketRecord | null) {
    setEmailCaseId(supportCase.supportCaseId);
    setEmailRecipient(ticket?.customerEmail ?? '');
    setEmailSubject(buildSupportReplySubject(supportCase.supportCaseId, ticket?.subject));
    setEmailBody(`Hello,\n\nWe have an update for support case ${supportCase.supportCaseId}.\n\nThank you,\nOrbit Ledger Support`);
    setReplyAction('reply');
    setReplyResolutionReason('');
  }

  async function runSupportReportAction(action: 'download_csv' | 'print_report') {
    if (!activeWorkspace?.workspaceId || !supportReport || !currentAdmin) {
      showToast('Load the support center before exporting reports.', 'info');
      return;
    }
    if (!currentAdmin.supportCapability.canExportReports) {
      showToast('This admin role cannot export support reports for the current workspace view.', 'danger');
      return;
    }
    if (!supportReport.rows.length) {
      showToast('There are no rows in the current report view to export.', 'info');
      return;
    }

    setBusySupportReportAction(action);
    try {
      await recordWebOfficeSupportReportEvent({
        workspaceId: activeWorkspace.workspaceId,
        action,
        report: supportReport,
        supportCaseId: supportAuditFilters.supportCaseId,
        ticketId:
          supportReportScope === 'selected_case' && selectedSupportRow?.supportCase.supportCaseId === supportAuditFilters.supportCaseId
            ? selectedSupportRow.ticket?.id ?? null
            : null,
        queueId:
          (supportAuditFilters.queueId as SupportQueueId | null) ??
          (supportReportScope === 'selected_case' ? (selectedSupportRow?.ticket?.queueId as SupportQueueId | null) : null),
      });

      if (action === 'download_csv') {
        const blob = new Blob([buildWebSupportReportCsv(supportReport)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = supportReportFilename(supportReport);
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1120,height=820');
        if (!printWindow) {
          throw new Error('Allow pop-ups temporarily so the support report can open for printing.');
        }
        printWindow.document.open();
        printWindow.document.write(buildWebSupportPrintHtml(supportReport));
        printWindow.document.close();
        printWindow.focus();
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      showToast(
        action === 'download_csv' ? 'Support report CSV downloaded and audited.' : 'Support report print view opened and audited.',
        'success'
      );
    } catch (reportError) {
      showToast(reportError instanceof Error ? reportError.message : 'Support report could not be exported.', 'danger');
    } finally {
      setBusySupportReportAction(null);
    }
  }

  const showOverview = section === 'overview';
  const showSupportConsole =
    section === 'support-inbox' ||
    section === 'assignments' ||
    section === 'diagnostics-consent' ||
    section === 'audit';
  const showAssignments = section === 'assignments';
  const showAccessRequests = section === 'access-requests';
  const showDiagnostics = section === 'diagnostics-consent';
  const showExportsReports = section === 'exports-reports';
  const showAudit = section === 'audit';
  const operationsRouteMeta: Record<OperationsConsoleSection, { title: string; description: string }> = {
    overview: {
      title: 'Support center shell',
      description: 'Scan customer support, diagnostic approvals, and hidden Office review activity in one internal workspace console.',
    },
    'support-inbox': {
      title: 'Support inbox',
      description: 'Land directly on the queue, ticket list, and detail pane without a long preamble.',
    },
    assignments: {
      title: 'Assignments',
      description: 'Route tickets faster by queue, assignee, and current workload.',
    },
    'access-requests': {
      title: 'Access requests',
      description: 'Review office access requests in a focused operator surface.',
    },
    'diagnostics-consent': {
      title: 'Diagnostics and consent',
      description: 'Open active diagnostic approvals and linked ticket context without digging through stacked cards.',
    },
    'exports-reports': {
      title: 'Exports and reports',
      description: 'Build print and export views from a tighter reporting route.',
    },
    audit: {
      title: 'Audit',
      description: 'Inspect immutable support history with filters up front and the event list immediately below.',
    },
  };
  const compactSupportSignals = [
    `${supportShellSummary[0]?.value ?? 0} open`,
    `${unreadSupportRecords.length} unread`,
    `${overdueSupportRows.length} overdue`,
    `${countSupportConsents(snapshot?.supportConsents ?? [], (item) => item.isActiveForReview)} active diagnostics`,
    quietHoursActive ? 'Quiet hours active' : 'Quiet hours inactive',
  ];
  const showFullSupportSidebar = section === 'support-inbox';
  const showCompactBuckets = section === 'assignments';
  const showCompactDiagnosticsSignals = section === 'diagnostics-consent';

  return (
    <>
      {!isAllowed ? (
        <section className="ol-panel">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Restricted operations area</div>
              <p className="ol-panel-copy">
                This screen is reserved for internal Office access review. It is not part of the customer workspace flow.
              </p>
            </div>
            <span className="ol-chip ol-chip--warning">Restricted</span>
          </div>
          <div className="ol-message ol-message--warning">
            Your account is not enabled for Office operations review.
          </div>
        </section>
      ) : !activeWorkspace ? (
        <section className="ol-panel">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Workspace context required</div>
              <p className="ol-panel-copy">
                Operations modules work against a selected workspace. Pick a workspace from the back-office switcher to continue.
              </p>
            </div>
            <span className="ol-chip ol-chip--warning">Select workspace</span>
          </div>
        </section>
      ) : (
        <>
          <section className={`ol-panel ${showOverview ? '' : 'ol-operations-route-bar'}`}>
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">{operationsRouteMeta[section].title}</div>
                <p className="ol-panel-copy">
                  {operationsRouteMeta[section].description}
                </p>
              </div>
              <div className="ol-actions ol-actions--compact">
                <span className={`ol-chip ${snapshot?.health.tone === 'success' ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                  {snapshot?.health.tone === 'success' ? 'Operationally clear' : 'Needs review'}
                </span>
                <button className="ol-button-secondary" disabled={isLoading} type="button" onClick={() => void refresh()}>
                  {isLoading ? 'Refreshing' : 'Refresh'}
                </button>
              </div>
            </div>
            {showOverview ? (
              error ? (
                <div className="ol-message ol-message--danger">{error}</div>
              ) : (
                <div className={`ol-message ${snapshot?.health.tone === 'success' ? 'ol-message--success' : 'ol-message--warning'}`}>
                  <strong>{snapshot?.health.title ?? 'Loading Office operations'}</strong>
                  <p>{snapshot?.health.message ?? 'Checking Office access requests for this workspace.'}</p>
                </div>
              )
            ) : (
              <div className="ol-support-chip-row ol-support-chip-row--compact">
                <span className="ol-chip ol-chip--premium">{supportRoleLabel(currentAdmin)}</span>
                {compactSupportSignals.map((signal) => (
                  <span className="ol-chip ol-chip--primary" key={signal}>
                    {signal}
                  </span>
                ))}
              </div>
            )}
          </section>

          {showOverview ? (
            <div className="ol-metric-grid ol-metric-grid--ops">
              {supportShellSummary.map((metric) => (
                <Link
                  className="ol-metric-card ol-metric-card--link"
                  data-tone={metric.tone}
                  data-active={metric.value > 0 ? 'true' : undefined}
                  href={operationsMetricHref(metric.id)}
                  key={metric.id}
                >
                  <div className="ol-metric-label">{metric.label}</div>
                  <div className="ol-metric-value">{metric.value}</div>
                  <div className="ol-metric-helper">{metric.helper}</div>
                </Link>
              ))}
              {(snapshot?.metrics ?? []).map((metric) => (
                <Link
                  className="ol-metric-card ol-metric-card--link"
                  data-tone={metric.tone}
                  data-active={metric.value > 0 ? 'true' : undefined}
                  href={operationsMetricHref(metric.id)}
                  key={metric.id}
                >
                  <div className="ol-metric-label">{metric.label}</div>
                  <div className="ol-metric-value">{metric.value}</div>
                  <div className="ol-metric-helper">{metric.helper}</div>
                </Link>
              ))}
            </div>
          ) : null}

          {showOverview ? (
            <div className="ol-support-secondary-grid">
              <section className="ol-panel">
                <div className="ol-panel-header">
                  <div>
                    <div className="ol-panel-title">Operations overview</div>
                    <p className="ol-panel-copy">
                      Route support, watch queue pressure, and spot diagnostics or Office review risks without opening a single endless page.
                    </p>
                  </div>
                  <span className="ol-chip ol-chip--primary">{supportShellRows.length} active case view</span>
                </div>
                <div className="ol-support-queue-summary">
                  {supportRailHighlights.map((item) => (
                    <div className="ol-support-queue-card" key={item.id}>
                      <strong>{item.label}</strong>
                      <span>
                        {item.count} {item.count === 1 ? 'case' : 'cases'}
                      </span>
                      <span>{item.helper}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ol-panel">
                <div className="ol-panel-header">
                  <div>
                    <div className="ol-panel-title">Queue watch</div>
                    <p className="ol-panel-copy">
                      Current support scope, Office review load, and notification state in a compact operational snapshot.
                    </p>
                  </div>
                  <span className="ol-chip ol-chip--success">{supportRoleLabel(currentAdmin)}</span>
                </div>
                <div className="ol-support-detail-grid">
                  <article className="ol-support-detail-card">
                    <span className="ol-review-label">Allowed queues</span>
                    <strong className="ol-review-value">{supportQueues.length}</strong>
                    <span className="ol-list-text">{supportAllowedQueueSummary(currentAdmin, supportQueues)}</span>
                  </article>
                  <article className="ol-support-detail-card">
                    <span className="ol-review-label">Unread</span>
                    <strong className="ol-review-value">{unreadSupportRecords.length}</strong>
                    <span className="ol-list-text">{unreadCustomerRecords.length} customer follow-up items</span>
                  </article>
                  <article className="ol-support-detail-card">
                    <span className="ol-review-label">Office queue</span>
                    <strong className="ol-review-value">{filteredReviewQueue.length}</strong>
                    <span className="ol-list-text">Needs-action review items in current scope</span>
                  </article>
                  <article className="ol-support-detail-card">
                    <span className="ol-review-label">Diagnostics</span>
                    <strong className="ol-review-value">{countSupportConsents(snapshot?.supportConsents ?? [], (item) => item.isActiveForReview)}</strong>
                    <span className="ol-list-text">Active customer-approved diagnostic packs</span>
                  </article>
                </div>
              </section>
            </div>
          ) : null}

          {showSupportConsole ? (
          <div className="ol-support-center-shell">
            <aside className="ol-panel-dark ol-support-center-sidebar">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Queue and scope</div>
                  <p className="ol-panel-copy">
                    {showFullSupportSidebar
                      ? 'Narrow the shell without changing customer data or mutating ticket history.'
                      : 'Keep the filters close while the main work surface stays in view.'}
                  </p>
                </div>
                <span className="ol-chip ol-chip--primary">Internal only</span>
              </div>

              <div className="ol-support-rail-block">
                <div className="ol-support-queue-card">
                  <strong>{supportRoleLabel(currentAdmin)}</strong>
                  <span>{supportRoleScopeSummary(currentAdmin)}</span>
                  <span>{supportAllowedQueueSummary(currentAdmin, supportQueues)}</span>
                </div>
                <label className="ol-field">
                  <span className="ol-field-label">Search</span>
                  <input
                    className="ol-input"
                    onChange={(event) => setOperationsSearch(event.target.value)}
                    placeholder="Case, customer, queue, note"
                    value={operationsSearch}
                  />
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">Support view</span>
                  <select
                    className="ol-select"
                    value={supportCaseFilter}
                    onChange={(event) => setSupportCaseFilter(event.target.value as (typeof SUPPORT_FILTER_OPTIONS)[number]['value'])}
                  >
                    {SUPPORT_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">Queue</span>
                  <select className="ol-select" value={supportQueueFilter} onChange={(event) => setSupportQueueFilter(event.target.value)}>
                    <option value="all">All queues</option>
                    {assignmentQueueOptions.map((queue) => (
                      <option key={queue.id} value={queue.id}>
                        {queue.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">Ownership</span>
                  <select
                    className="ol-select"
                    value={supportOwnerFilter}
                    onChange={(event) => setSupportOwnerFilter(event.target.value as (typeof OWNER_FILTER_OPTIONS)[number]['value'])}
                  >
                    {OWNER_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">Office review queue</span>
                  <select className="ol-select" value={reviewStatusFilter} onChange={(event) => setReviewStatusFilter(event.target.value)}>
                    <option value="active">Needs action</option>
                    <option value="submitted">Submitted</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="approved">Approved</option>
                    <option value="granted">Granted</option>
                    <option value="all">All requests</option>
                  </select>
                </label>
              </div>

              {showFullSupportSidebar || showCompactBuckets ? (
                <div className="ol-support-rail-section">
                  <div className="ol-support-rail-label">Case buckets</div>
                  <div className="ol-support-nav-list">
                    {SUPPORT_FILTER_OPTIONS.map((option) => {
                      const count = countSupportCases(snapshot?.supportCases ?? [], (supportCase) =>
                        option.value === 'all'
                          ? true
                          : option.value === 'active'
                            ? supportCase.status !== 'resolved' && supportCase.status !== 'closed'
                            : supportCase.status === option.value
                      );
                      return (
                        <button
                          className={`ol-support-nav-button ${supportCaseFilter === option.value ? 'ol-support-nav-button--active' : ''}`}
                          key={option.value}
                          onClick={() => setSupportCaseFilter(option.value)}
                          type="button"
                        >
                          <span className="ol-support-nav-copy">
                            <strong>{option.label}</strong>
                            <span>{option.helper}</span>
                          </span>
                          <span className="ol-support-nav-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {showFullSupportSidebar ? (
                <div className="ol-support-rail-section">
                  <div className="ol-support-rail-label">Workstream signals</div>
                  <div className="ol-support-queue-summary">
                    {supportRailHighlights.map((item) => (
                      <div className="ol-support-queue-card" key={item.id}>
                        <strong>{item.label}</strong>
                        <span>
                          {item.count} {item.count === 1 ? 'case' : 'cases'}
                        </span>
                        <span>{item.helper}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {showFullSupportSidebar || showCompactDiagnosticsSignals ? (
                <div className="ol-support-rail-section">
                  <div className="ol-support-rail-label">Support signals</div>
                  <div className="ol-support-chip-row">
                    <span className="ol-chip ol-chip--premium">{countSupportConsents(snapshot?.supportConsents ?? [], (item) => item.isActiveForReview)} active diagnostics</span>
                    <span className="ol-chip ol-chip--warning">{snapshot?.supportCaseEmailRequests.length ?? 0} follow-up emails</span>
                    <span className="ol-chip ol-chip--primary">{filteredReviewQueue.length} Office review items</span>
                  </div>
                </div>
              ) : null}

              {showFullSupportSidebar ? (
                <div className="ol-support-rail-section">
                  <div className="ol-support-rail-label">Alerts and SLAs</div>
                  <div className="ol-support-signal-grid">
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Unread</span>
                      <strong className="ol-review-value">{unreadSupportRecords.length}</strong>
                      <span className="ol-list-text">{unreadCustomerRecords.length} customer follow-up{unreadCustomerRecords.length === 1 ? '' : 's'}</span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Overdue</span>
                      <strong className="ol-review-value">{overdueSupportRows.length}</strong>
                      <span className="ol-list-text">{dueSoonSupportRows.length} due soon</span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Urgent</span>
                      <strong className="ol-review-value">{urgentSupportRows.length}</strong>
                      <span className="ol-list-text">{quietHoursActive ? 'Quiet hours active now' : 'Quiet hours inactive'}</span>
                    </article>
                  </div>

                  <div className="ol-support-notification-panel">
                    <label className="ol-checkbox-row">
                      <input
                        checked={notificationPreference?.muteAll === true}
                        className="ol-checkbox"
                        onChange={(event) =>
                          setNotificationPreferences((current) =>
                            current
                              ? {
                                  ...current,
                                  muteAll: event.target.checked,
                                }
                              : current
                          )
                        }
                        type="checkbox"
                      />
                      <span>Mute all support alerts</span>
                    </label>
                    <label className="ol-checkbox-row">
                      <input
                        checked={notificationPreference?.desktopAlertsEnabled === true}
                        className="ol-checkbox"
                        onChange={(event) =>
                          setNotificationPreferences((current) =>
                            current
                              ? {
                                  ...current,
                                  desktopAlertsEnabled: event.target.checked,
                                }
                              : current
                          )
                        }
                        type="checkbox"
                      />
                      <span>Enable in-app desktop alerts</span>
                    </label>
                    <label className="ol-checkbox-row">
                      <input
                        checked={notificationPreference?.browserNotificationsEnabled === true}
                        className="ol-checkbox"
                        disabled={notificationPreference?.browserPermissionState === 'denied'}
                        onChange={(event) =>
                          setNotificationPreferences((current) =>
                            current
                              ? {
                                  ...current,
                                  browserNotificationsEnabled: event.target.checked,
                                }
                              : current
                          )
                        }
                        type="checkbox"
                      />
                      <span>Enable browser notifications</span>
                    </label>
                    <label className="ol-checkbox-row">
                      <input
                        checked={notificationPreference?.soundEnabled === true}
                        className="ol-checkbox"
                        onChange={(event) =>
                          setNotificationPreferences((current) =>
                            current
                              ? {
                                  ...current,
                                  soundEnabled: event.target.checked,
                                }
                              : current
                          )
                        }
                        type="checkbox"
                      />
                      <span>Enable support sound chime</span>
                    </label>
                    <div className="ol-form-band-grid">
                      <label className="ol-field">
                        <span className="ol-field-label">Quiet hours start</span>
                        <input
                          className="ol-input"
                          onChange={(event) =>
                            setNotificationPreferences((current) =>
                              current
                                ? {
                                    ...current,
                                    quietHoursStart: event.target.value || null,
                                  }
                                : current
                            )
                          }
                          type="time"
                          value={notificationPreference?.quietHoursStart ?? ''}
                        />
                      </label>
                      <label className="ol-field">
                        <span className="ol-field-label">Quiet hours end</span>
                        <input
                          className="ol-input"
                          onChange={(event) =>
                            setNotificationPreferences((current) =>
                              current
                                ? {
                                    ...current,
                                    quietHoursEnd: event.target.value || null,
                                  }
                                : current
                            )
                          }
                          type="time"
                          value={notificationPreference?.quietHoursEnd ?? ''}
                        />
                      </label>
                    </div>
                    <div className="ol-support-inline-actions">
                      <button className="ol-button-secondary" onClick={() => void requestBrowserNotificationPermission()} type="button">
                        Request browser permission
                      </button>
                      <button className="ol-button-secondary" onClick={() => playSupportNotificationTone()} type="button">
                        Test sound
                      </button>
                      <button className="ol-button-secondary" onClick={() => markCurrentSupportActivitySeen()} type="button">
                        Mark current activity seen
                      </button>
                      <button
                        className="ol-button"
                        disabled={!notificationPreference || isSavingNotificationPreferences}
                        onClick={() => void saveSupportNotificationPreferences()}
                        type="button"
                      >
                        {isSavingNotificationPreferences ? 'Saving settings' : 'Save notification settings'}
                      </button>
                    </div>
                    <div className="ol-support-chip-row">
                      <span className={`ol-chip ${notificationPreference?.muteAll ? 'ol-chip--warning' : 'ol-chip--success'}`}>
                        {notificationPreference?.muteAll ? 'Muted' : 'Alerts active'}
                      </span>
                      <span className={`ol-chip ${quietHoursActive ? 'ol-chip--warning' : 'ol-chip--primary'}`}>
                        {quietHoursActive ? 'Quiet hours active' : 'Quiet hours inactive'}
                      </span>
                      <span className="ol-chip ol-chip--primary">
                        Browser {notificationPreference?.browserPermissionState ?? 'unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </aside>

            <section className="ol-panel ol-support-center-listpane">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Ticket list</div>
                  <p className="ol-panel-copy">
                    Scan cases quickly, then open the selected ticket context in the detail pane.
                  </p>
                </div>
                <span className="ol-chip ol-chip--primary">{supportShellRows.length} shown</span>
              </div>

              {supportShellRows.length ? (
                <div className="ol-support-case-list">
                  {supportShellRows.map((row) => {
                    const isSelected = row.supportCase.supportCaseId === selectedSupportRow?.supportCase.supportCaseId;
                    return (
                      <button
                        className={`ol-support-case-row ${isSelected ? 'ol-support-case-row--active' : ''}`}
                        key={row.supportCase.id}
                        onClick={() => setSelectedSupportCaseId(row.supportCase.supportCaseId)}
                        type="button"
                      >
                        <div className="ol-support-case-row-top">
                          <div className="ol-support-case-row-copy">
                            <strong>{row.supportCase.supportCaseId}</strong>
                            <span>{row.ticket?.subject ?? 'Support request'}</span>
                          </div>
                          <div className="ol-support-case-row-badges">
                            <span className={`ol-chip ${supportCaseChipClass(row.supportCase.status)}`}>
                              {supportCaseStatusLabel(row.supportCase.status)}
                            </span>
                            {row.ticket ? (
                              <span className={`ol-chip ${supportSlaChipClass(supportTicketSlaState(row.ticket, 'resolution'))}`}>
                                {supportTicketSlaLabel(row.ticket)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p>{row.ticket?.summary ?? row.supportCase.latestNote}</p>
                        <div className="ol-support-case-row-meta">
                          <span>{supportQueueLabel(row.ticket?.queueId)}</span>
                          <span>{assignmentSummary(row.currentAssignment)}</span>
                          <span>{supportPriorityLabel(row.ticket?.priority)}</span>
                          <span>{row.supportCase.noteCount} note{row.supportCase.noteCount === 1 ? '' : 's'}</span>
                          <span>{row.consentCount} consent{row.consentCount === 1 ? '' : 's'}</span>
                          <span>{formatDate(row.ticket?.latestMessageAt ?? row.supportCase.latestNoteAt ?? row.supportCase.updatedAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="ol-support-empty-state">
                  <strong>No support cases match this view.</strong>
                  <p>Try a broader filter or clear the current search term.</p>
                </div>
              )}
            </section>

            <section className="ol-panel ol-support-center-detailpane">
              {selectedSupportRow ? (
                <>
                  <div className="ol-panel-header">
                    <div>
                      <div className="ol-panel-title">Ticket detail</div>
                      <p className="ol-panel-copy">
                        Customer-safe context, audit visibility, and prep actions for the selected case.
                      </p>
                    </div>
                    <div className="ol-actions ol-actions--compact">
                      <button
                        className="ol-button-secondary"
                        onClick={() => prepareSupportReview(selectedSupportRow.supportCase)}
                        disabled={!canRecordSupportReview || !canEditSelectedTicket}
                        type="button"
                      >
                        Use in review log
                      </button>
                      <button
                        className="ol-button-secondary"
                        disabled={!canEditSelectedTicket}
                        onClick={() => prepareCaseUpdate(selectedSupportRow.supportCase, 'add_note')}
                        type="button"
                      >
                        Add note
                      </button>
                      <button
                        className="ol-button-secondary"
                        disabled={!canPrepareFollowUp}
                        onClick={() => prepareSupportReply(selectedSupportRow.supportCase, selectedSupportRow.ticket)}
                        type="button"
                      >
                        Open reply composer
                      </button>
                    </div>
                  </div>

                  <div className="ol-support-detail-hero">
                    <div>
                      <div className="ol-support-ticket-subject">
                        {selectedSupportRow.ticket?.subject ?? 'Support request'}
                      </div>
                      <p className="ol-panel-copy">
                        {selectedSupportRow.ticket?.summary ?? selectedSupportRow.supportCase.latestNote}
                      </p>
                    </div>
                    <div className="ol-support-chip-row">
                      <span className={`ol-chip ${supportCaseChipClass(selectedSupportRow.supportCase.status)}`}>
                        {supportCaseStatusLabel(selectedSupportRow.supportCase.status)}
                      </span>
                      <span className="ol-chip ol-chip--primary">{supportQueueLabel(selectedSupportRow.ticket?.queueId)}</span>
                      <span className="ol-chip ol-chip--premium">{supportPriorityLabel(selectedSupportRow.ticket?.priority)}</span>
                    </div>
                  </div>

                  <div className="ol-support-detail-grid">
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Customer</span>
                      <strong className="ol-review-value">
                        {selectedSupportRow.ticket?.customerName ?? 'Workspace member'}
                      </strong>
                      <span className="ol-list-text">
                        {resolveSupportContactEmail(selectedSupportRow, selectedSupportConsents) ?? 'Email unavailable'}
                      </span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Latest update</span>
                      <strong className="ol-review-value">
                        {formatDate(selectedSupportRow.ticket?.latestMessageAt ?? selectedSupportRow.supportCase.latestNoteAt ?? selectedSupportRow.supportCase.updatedAt)}
                      </strong>
                      <span className="ol-list-text">
                        {selectedSupportRow.supportCase.latestNoteByEmail ?? resolveSupportContactEmail(selectedSupportRow, selectedSupportConsents) ?? 'Orbit Ledger'}
                      </span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">SLA state</span>
                      <strong className="ol-review-value">{supportTicketSlaLabel(selectedSupportRow.ticket)}</strong>
                      <span className="ol-list-text">
                        First response {formatDate(selectedSupportRow.ticket?.firstResponseDueAt)} · Resolution {formatDate(selectedSupportRow.ticket?.slaDueAt)}
                      </span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Diagnostics</span>
                      <strong className="ol-review-value">
                        {selectedSupportRow.consentCount} pack{selectedSupportRow.consentCount === 1 ? '' : 's'}
                      </strong>
                      <span className="ol-list-text">
                        {selectedSupportConsents.some((consent) => consent.isActiveForReview)
                          ? 'Customer-approved review is active.'
                          : 'No active diagnostic pack right now.'}
                      </span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Assignment</span>
                      <strong className="ol-review-value">
                        {assignmentSummary(selectedSupportAssignment)}
                      </strong>
                      <span className="ol-list-text">
                        {selectedSupportAssignment?.reason ?? 'No queue assignment reason recorded yet.'}
                      </span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Follow-ups</span>
                      <strong className="ol-review-value">
                        {selectedSupportEmails.length} queued
                      </strong>
                      <span className="ol-list-text">
                        {selectedSupportEvents.length} audit event{selectedSupportEvents.length === 1 ? '' : 's'}
                      </span>
                    </article>
                    <article className="ol-support-detail-card">
                      <span className="ol-review-label">Notification tone</span>
                      <strong className="ol-review-value">
                        {supportNotificationToneLabel(selectedSupportRow.ticket?.notificationTone)}
                      </strong>
                      <span className="ol-list-text">
                        {selectedSupportRow.ticket?.operatorFirstRepliedAt
                          ? `First operator reply ${formatDate(selectedSupportRow.ticket.operatorFirstRepliedAt)}`
                          : 'No operator reply recorded yet.'}
                      </span>
                    </article>
                  </div>

                  {canStartReadOnlyUserContext ? (
                    <section className="ol-panel ol-user-context-operator-card">
                      <div className="ol-panel-header">
                        <div>
                          <div className="ol-panel-title">Debug user area</div>
                          <p className="ol-panel-copy">
                            Open the affected workspace in a new tab, or launch a bannered user-context session for this
                            support case.
                          </p>
                        </div>
                        <span className="ol-chip ol-chip--warning">Audited</span>
                      </div>
                      {userContextMessage ? (
                        <div className="ol-message" data-tone="success">
                          {userContextMessage}
                        </div>
                      ) : null}
                      {userContextError ? (
                        <div className="ol-message" data-tone="danger">
                          {userContextError}
                        </div>
                      ) : null}
                      <label className="ol-form-field">
                        <span className="ol-field-label ol-field-label--with-meta">
                          <span className="ol-field-label-text">
                            Reason
                            <span className="ol-required-badge">Required</span>
                          </span>
                          <OperationsFieldHelp text="Required for audit. Explain the customer issue or reproduction path before opening any user-context session." />
                        </span>
                        <textarea
                          aria-required="true"
                          className="ol-input ol-textarea"
                          value={userContextReason}
                          onChange={(event) => setUserContextReason(event.target.value)}
                          placeholder="Explain the customer issue or reproduction path for this debug session."
                          required
                          rows={3}
                        />
                      </label>
                      <div className="ol-actions">
                        <button className="ol-button-secondary" type="button" disabled={isStartingUserContext} onClick={() => void launchUserContext('open_workspace')}>
                          Open workspace
                        </button>
                        <button className="ol-button-secondary" type="button" disabled={isStartingUserContext} onClick={() => void launchUserContext('view_as_user')}>
                          View as user
                        </button>
                        {canStartActionEnabledUserContext ? (
                          <button className="ol-button" type="button" disabled={isStartingUserContext} onClick={() => void launchUserContext('act_as_user')}>
                            Act as user
                          </button>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {section === 'support-inbox' || showAssignments ? (
                  <div className="ol-support-thread-section">
                    <div className="ol-support-section-heading">
                      <div>
                        <h3>Assignment and queue control</h3>
                        <p>Route the ticket to the right queue and operator role with a required audit reason.</p>
                      </div>
                      <span className={`ol-chip ${canAssignSelectedTicket ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                        {canAssignSelectedTicket ? 'Assignment enabled' : 'Read-only scope'}
                      </span>
                    </div>
                    <div className="ol-form-band">
                      <div className="ol-form-band-grid">
                        <label className="ol-field">
                          <span className="ol-field-label ol-field-label--with-meta">
                            <span className="ol-field-label-text">
                              Queue
                              <span className="ol-required-badge">Required</span>
                            </span>
                            <OperationsFieldHelp text="Choose the support queue responsible for the selected ticket." />
                          </span>
                          <select
                            aria-required="true"
                            className="ol-select"
                            disabled={!canAssignSelectedTicket}
                            required
                            value={assignmentQueueId}
                            onChange={(event) => setAssignmentQueueId(event.target.value)}
                          >
                            {assignableQueueOptions.map((queue) => (
                              <option key={queue.id} value={queue.id}>
                                {queue.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="ol-field">
                          <span className="ol-field-label ol-field-label--with-meta">
                            <span className="ol-field-label-text">
                              Assigned role
                              <span className="ol-required-badge">Required</span>
                            </span>
                            <OperationsFieldHelp text="Choose the operator role responsible for the ticket inside that queue." />
                          </span>
                          <select
                            aria-required="true"
                            className="ol-select"
                            disabled={!canAssignSelectedTicket}
                            required
                            value={assignmentRole}
                            onChange={(event) => setAssignmentRole(event.target.value as PlatformAdminRole)}
                          >
                            {allowedAssignmentRoles.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="ol-field">
                          <span className="ol-field-label ol-field-label--with-meta">
                            <span className="ol-field-label-text">Assigned admin email</span>
                            <OperationsFieldHelp text="Optional. Add a specific owner email when one operator should be responsible for follow-up." />
                          </span>
                          <input
                            className="ol-input"
                            disabled={!canAssignSelectedTicket}
                            onChange={(event) => setAssignmentAdminEmail(event.target.value)}
                            placeholder="Optional owner email"
                            value={assignmentAdminEmail}
                          />
                        </label>
                        <label className="ol-field ol-field--span-2">
                          <span className="ol-field-label ol-field-label--with-meta">
                            <span className="ol-field-label-text">
                              Assignment reason
                              <span className="ol-required-badge">Required</span>
                            </span>
                            <OperationsFieldHelp text="Required for audit. Explain why this queue, role, or owner should take the ticket." />
                          </span>
                          <textarea
                            aria-required="true"
                            className="ol-textarea"
                            disabled={!canAssignSelectedTicket}
                            onChange={(event) => setAssignmentReason(event.target.value)}
                            placeholder="Explain why this queue or owner should take the ticket."
                            required
                            rows={3}
                            value={assignmentReason}
                          />
                        </label>
                        <div className="ol-field ol-field--action">
                          <span className="ol-field-label">Action</span>
                          <button
                            className="ol-button"
                            disabled={isSavingAssignment || !canAssignSelectedTicket || !assignmentReason.trim()}
                            onClick={() => void saveTicketAssignment()}
                            type="button"
                          >
                            {isSavingAssignment ? 'Saving' : 'Save assignment'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="ol-support-detail-grid">
                      <article className="ol-support-detail-card">
                        <span className="ol-review-label">Current owner</span>
                        <strong className="ol-review-value">{selectedSupportAssignment?.assignedAdminEmail ?? 'Unassigned'}</strong>
                        <span className="ol-list-text">{supportRoleLabel(selectedSupportAssignment?.assignedRole ?? null)}</span>
                      </article>
                      <article className="ol-support-detail-card">
                        <span className="ol-review-label">Queue description</span>
                        <strong className="ol-review-value">{supportQueueLabel(assignmentQueueId)}</strong>
                        <span className="ol-list-text">{queueDescription(assignmentQueueId, assignmentQueueOptions)}</span>
                      </article>
                      <article className="ol-support-detail-card">
                        <span className="ol-review-label">Scope note</span>
                        <strong className="ol-review-value">{canAssignSelectedTicket ? 'Writable' : 'Audit only'}</strong>
                        <span className="ol-list-text">
                          {canAssignSelectedTicket
                            ? 'This role can re-route and assign the selected ticket.'
                            : 'This role can inspect the ticket history but cannot reassign this queue.'}
                        </span>
                      </article>
                    </div>
                  </div>
                  ) : null}

                  {section === 'support-inbox' || showAudit ? (
                  <div className="ol-support-thread-section">
                    <div className="ol-support-section-heading">
                      <div>
                        <h3>Exact history</h3>
                        <p>Customer messages, internal notes, assignments, replies, and immutable ticket events in one filtered history view.</p>
                      </div>
                      <span className="ol-chip ol-chip--primary">{selectedSupportExactHistory.length} entries</span>
                    </div>
                    {selectedSupportTimeline.length ? (
                      <div className="ol-support-message-list">
                        {selectedSupportTimeline.map((entry) => (
                          <article className="ol-support-message" data-kind={entry.kind} key={entry.id}>
                            <div className="ol-support-message-head">
                              <strong>{entry.title}</strong>
                              <span>{formatDate(entry.createdAt)}</span>
                            </div>
                            <p>{entry.body}</p>
                            <span className="ol-list-text">
                              {entry.meta}
                            </span>
                            <div className="ol-support-band-spacing">
                              <span className={`ol-chip ${supportAuditChipClass(entry.tone)}`}>{entry.badge}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="ol-support-message-list">
                        <article className="ol-support-message" data-kind="system_event">
                          <div className="ol-support-message-head">
                            <strong>Latest support note</strong>
                            <span>{formatDate(selectedSupportRow.supportCase.latestNoteAt ?? selectedSupportRow.supportCase.updatedAt)}</span>
                          </div>
                          <p>{selectedSupportRow.supportCase.latestNote}</p>
                          <span className="ol-list-text">
                            {selectedSupportRow.supportCase.latestNoteByEmail ?? 'Orbit Ledger'} · Internal workspace review note
                          </span>
                        </article>
                      </div>
                    )}
                  </div>
                  ) : null}

                  {section === 'support-inbox' || showAssignments ? (
                  <div className="ol-support-thread-section">
                    <div className="ol-support-section-heading">
                      <div>
                        <h3>Status controls</h3>
                        <p>Record the current ticket state with a required note and support outcome when needed.</p>
                      </div>
                    </div>
                    <div className="ol-support-detail-grid">
                      <article className="ol-support-detail-card">
                        <span className="ol-review-label">Quick state</span>
                        <div className="ol-support-chip-row">
                          {CASE_ACTION_OPTIONS.map((option) => (
                            <button
                              className={caseAction === option.value ? 'ol-button' : 'ol-button-secondary'}
                              disabled={!canEditSelectedTicket}
                              key={option.value}
                              onClick={() => prepareCaseUpdate(selectedSupportRow.supportCase, option.value)}
                              type="button"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </article>
                    </div>
                  </div>
                  ) : null}

                  {section === 'support-inbox' || showAudit ? (
                  <div className="ol-support-thread-section">
                    <div className="ol-support-section-heading">
                      <div>
                        <h3>Audit timeline</h3>
                        <p>Immutable support and diagnostic events already linked to this ticket context.</p>
                      </div>
                    </div>
                    {selectedSupportEvents.length ? (
                      <div className="ol-support-timeline">
                        {selectedSupportEvents.map((event) => (
                          <article className="ol-support-timeline-item" key={event.id}>
                            <div className="ol-support-timeline-head">
                              <strong>{event.title}</strong>
                              <span className={`ol-chip ${supportAuditChipClass(event.tone)}`}>
                                {event.status ?? event.kind ?? 'recorded'}
                              </span>
                            </div>
                            <p>{event.detail}</p>
                            <span className="ol-list-text">
                              {formatDate(event.createdAt)} · {event.actor}
                            </span>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="ol-message ol-message--success">
                        No audit events are linked to this support case yet.
                      </div>
                    )}
                  </div>
                  ) : null}

                  {section === 'support-inbox' || showDiagnostics ? (
                  <div className="ol-support-thread-section">
                    <div className="ol-support-section-heading">
                      <div>
                        <h3>Diagnostic access</h3>
                        <p>Only customer-approved diagnostic packs are visible in this shell.</p>
                      </div>
                    </div>
                    {selectedSupportConsents.length ? (
                      <div className="ol-support-consent-list">
                        {selectedSupportConsents.map((consent) => (
                          <article className="ol-support-consent-card" key={consent.id}>
                            <div className="ol-support-timeline-head">
                              <strong>{supportKindLabel(consent.supportKind)}</strong>
                              <span className={`ol-chip ${consent.isActiveForReview ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                                {consent.isExpired && consent.status === 'active' ? 'expired' : consent.status}
                              </span>
                            </div>
                            <p>{consent.sanitizedMessage}</p>
                            <div className="ol-support-case-row-meta">
                              <span>{consent.userEmail ?? 'Workspace user'}</span>
                              <span>{consent.approvedFields.length} approved fields</span>
                              <span>{consent.redactedFields.length} redacted fields</span>
                              <span>Expires {formatDate(consent.expiresAt)}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="ol-message ol-message--warning">
                        No diagnostic pack is currently linked to this support case.
                      </div>
                    )}
                  </div>
                  ) : null}
                </>
              ) : (
                <div className="ol-support-empty-state">
                  <strong>Select a support case to load ticket detail.</strong>
                  <p>The detail pane fills automatically once a case is available in the current filter.</p>
                </div>
              )}
            </section>
          </div>
          ) : null}

          {showExportsReports ? (
          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Audit explorer and reporting</div>
                <p className="ol-panel-copy">
                  Filter immutable support history by date, role, queue, and ticket status, then export or print the exact current report view.
                </p>
              </div>
              <div className="ol-actions ol-actions--compact">
                <span className={`ol-chip ${currentAdmin?.supportCapability.canExportReports ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                  {currentAdmin?.supportCapability.canExportReports ? 'Export enabled' : 'Audit only'}
                </span>
                <button
                  className="ol-button-secondary"
                  disabled={!supportReport || busySupportReportAction !== null || !currentAdmin?.supportCapability.canExportReports}
                  type="button"
                  onClick={() => void runSupportReportAction('print_report')}
                >
                  {busySupportReportAction === 'print_report' ? 'Preparing print' : 'Print report'}
                </button>
                <button
                  className="ol-button"
                  disabled={!supportReport || busySupportReportAction !== null || !currentAdmin?.supportCapability.canExportReports}
                  type="button"
                  onClick={() => void runSupportReportAction('download_csv')}
                >
                  {busySupportReportAction === 'download_csv' ? 'Preparing CSV' : 'Download CSV'}
                </button>
              </div>
            </div>

            <div className="ol-form-band">
              <div className="ol-form-band-grid">
                <label className="ol-field">
                  <span className="ol-field-label">Report type</span>
                  <select className="ol-select" value={supportReportType} onChange={(event) => setSupportReportType(event.target.value as WebSupportReportType)}>
                    <option value="audit_trail">Audit trail</option>
                    <option value="ticket_registry">Ticket registry</option>
                    <option value="assignment_log">Assignment log</option>
                    <option value="reply_delivery">Reply delivery</option>
                    <option value="diagnostic_consents">Diagnostic consents</option>
                  </select>
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">Report scope</span>
                  <select className="ol-select" value={supportReportScope} onChange={(event) => setSupportReportScope(event.target.value as 'selected_case' | 'workspace_view')}>
                    <option value="selected_case">Selected case only</option>
                    <option value="workspace_view">Current workspace view</option>
                  </select>
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">Actor role</span>
                  <select className="ol-select" value={supportAuditActorRoleFilter} onChange={(event) => setSupportAuditActorRoleFilter(event.target.value)}>
                    <option value="all">All roles</option>
                    {supportAuditActorRoleOptions.map((role) => (
                    <option key={role} value={role}>
                        {supportRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">Ticket status</span>
                  <select className="ol-select" value={supportAuditStatusFilter} onChange={(event) => setSupportAuditStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    {supportAuditStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {supportTicketStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">From date</span>
                  <input className="ol-input" type="date" value={supportAuditDateFrom} onChange={(event) => setSupportAuditDateFrom(event.target.value)} />
                </label>
                <label className="ol-field">
                  <span className="ol-field-label">To date</span>
                  <input className="ol-input" type="date" value={supportAuditDateTo} onChange={(event) => setSupportAuditDateTo(event.target.value)} />
                </label>
                <label className="ol-field ol-field--span-2">
                  <span className="ol-field-label">Audit search</span>
                  <input
                    className="ol-input"
                    value={supportAuditSearch}
                    onChange={(event) => setSupportAuditSearch(event.target.value)}
                    placeholder="Search case, actor, event, note, or reply content"
                  />
                </label>
              </div>
            </div>

            <div className="ol-support-audit-summary-grid ol-support-band-spacing">
              {supportAuditSummary.map((item) => (
                <article className="ol-support-detail-card" key={item.id}>
                  <span className="ol-review-label">{item.label}</span>
                  <strong className="ol-review-value">{item.value}</strong>
                  <span className="ol-list-text">{item.helper}</span>
                </article>
              ))}
            </div>

            {supportReport ? (
              <div className="ol-table ol-support-band-spacing">
                <div className="ol-table-tools">
                  <label className="ol-field">
                    <span className="ol-field-label">Current report</span>
                    <div className="ol-support-report-copy">
                      <strong>{supportReport.title}</strong>
                      <span>{supportReport.description}</span>
                    </div>
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Generated by</span>
                    <div className="ol-support-report-copy">
                      <strong>{supportReport.generatedBy}</strong>
                      <span>{supportRoleLabel(supportReport.adminRole)}</span>
                    </div>
                  </label>
                </div>
                <div className="ol-table-summary">
                  {supportReport.rows.length} row{supportReport.rows.length === 1 ? '' : 's'} · {supportReport.filters.length ? supportReport.filters.join(' · ') : 'No additional filters'}
                </div>
                <div className="ol-table-head" style={{ gridTemplateColumns: `repeat(${supportReport.columns.length}, minmax(160px, 1fr))` }}>
                  {supportReport.columns.map((column) => (
                    <span key={column.key}>{column.label}</span>
                  ))}
                </div>
                {(supportReport.rows.slice(0, 12)).map((row, index) => (
                  <div className="ol-table-row" key={`${supportReport.type}:${index}`} style={{ gridTemplateColumns: `repeat(${supportReport.columns.length}, minmax(160px, 1fr))` }}>
                    {supportReport.columns.map((column) => (
                      <span key={column.key}>{row[column.key] ?? 'Not recorded'}</span>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
          ) : null}

          {showAccessRequests || showAssignments ? (
          <div className="ol-support-workbench-grid">
            {showAccessRequests ? (
            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Support review guard</div>
                  <p className="ol-panel-copy">
                    Record why internal support reviewed this workspace. This does not impersonate a customer account or start a member session.
                  </p>
                </div>
                <span className="ol-chip ol-chip--success">No impersonation</span>
              </div>
              <div className="ol-message ol-message--success">
                Internal support may record a review reason only. Workspace actions still require the normal trusted Office functions.
              </div>
              <div className="ol-form-band ol-support-band-spacing">
                <div className="ol-form-band-grid">
                  <label className="ol-field">
                    <span className="ol-field-label ol-field-label--with-meta">
                      <span className="ol-field-label-text">Support case</span>
                      <OperationsFieldHelp text="Optional. Add the case number when available so the review record is easier to trace." />
                    </span>
                    <input
                      className="ol-input"
                      onChange={(event) => setSupportCaseId(event.target.value)}
                      placeholder="Optional case number"
                      value={supportCaseId}
                    />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label ol-field-label--with-meta">
                      <span className="ol-field-label-text">
                        Review reason
                        <span className="ol-required-badge">Required</span>
                      </span>
                      <OperationsFieldHelp text="Required before recording review. Explain why support is reviewing this workspace or Office setup." />
                    </span>
                    <input
                      aria-required="true"
                      className="ol-input"
                      onChange={(event) => setSupportReason(event.target.value)}
                      placeholder="Example: Customer asked us to review Office setup"
                      required
                      value={supportReason}
                    />
                  </label>
                  <label className="ol-checkbox-row">
                    <input
                      checked={supportDiagnosticsApproved}
                      className="ol-checkbox"
                      disabled={!canRecordSupportReview || !currentAdmin?.supportCapability.canViewDiagnostics}
                      onChange={(event) => setSupportDiagnosticsApproved(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Customer approved diagnostic context</span>
                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Action</span>
                    <button
                      className="ol-button"
                      disabled={isRecordingSupportReview || !canRecordSupportReview || !supportReason.trim()}
                      onClick={() => void recordSupportReview()}
                      type="button"
                    >
                      {isRecordingSupportReview ? 'Recording' : 'Record support review'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="ol-review-grid ol-support-band-spacing">
                {OFFICE_SUPPORT_REVIEW_GUARDRAILS.map((guardrail) => (
                  <div className="ol-review-item" key={guardrail}>
                    <span className="ol-review-label">Guardrail</span>
                    <strong className="ol-review-value">{guardrail}</strong>
                  </div>
                ))}
              </div>
            </section>
            ) : null}

            {showAssignments ? (
            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Case workbench</div>
                  <p className="ol-panel-copy">
                    Prepare a case note, resolve a ticket, or reopen follow-up using the selected case as your starting point.
                  </p>
                </div>
                <span className="ol-chip ol-chip--primary">
                  {selectedSupportRow?.supportCase.supportCaseId ?? 'Pick a case'}
                </span>
              </div>
              <div className="ol-form-band">
                <div className="ol-form-band-grid">
                  <label className="ol-field">
                    <span className="ol-field-label ol-field-label--with-meta">
                      <span className="ol-field-label-text">
                        Support case
                        <span className="ol-required-badge">Required</span>
                      </span>
                      <OperationsFieldHelp text="Required to save a case update. Use the selected support case or enter the exact case number." />
                    </span>
                    <input
                      aria-required="true"
                      className="ol-input"
                      onChange={(event) => setCaseIdForUpdate(event.target.value)}
                      placeholder="CASE-2001"
                      required
                      value={caseIdForUpdate}
                    />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label ol-field-label--with-meta">
                      <span className="ol-field-label-text">
                        Action
                        <span className="ol-required-badge">Required</span>
                      </span>
                      <OperationsFieldHelp text="Choose the ticket status action to record in the case history." />
                    </span>
                    <select
                      aria-required="true"
                      className="ol-select"
                      required
                      value={caseAction}
                      onChange={(event) => setCaseAction(event.target.value as OfficeSupportCaseAction)}
                    >
                      {CASE_ACTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label ol-field-label--with-meta">
                      <span className="ol-field-label-text">
                        Outcome reason
                        {requiresResolutionReason(caseAction) ? <span className="ol-required-badge">Required</span> : null}
                      </span>
                      <OperationsFieldHelp text="Required only for resolved or closed outcomes. It helps reports explain why the ticket ended." />
                    </span>
                    <select
                      aria-required={requiresResolutionReason(caseAction) || undefined}
                      className="ol-select"
                      required={requiresResolutionReason(caseAction)}
                      value={caseResolutionReason}
                      onChange={(event) => setCaseResolutionReason(event.target.value as SupportResolutionReason | '')}
                    >
                      <option value="">Not needed</option>
                      {SUPPORT_RESOLUTION_REASON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ol-field ol-field--span-2">
                    <span className="ol-field-label ol-field-label--with-meta">
                      <span className="ol-field-label-text">
                        Internal note
                        <span className="ol-required-badge">Required</span>
                      </span>
                      <OperationsFieldHelp text="Required for case updates so the audit trail explains what changed and why." />
                    </span>
                    <textarea
                      aria-required="true"
                      className="ol-textarea"
                      onChange={(event) => setCaseNote(event.target.value)}
                      placeholder="Short operator note visible in the audit trail"
                      required
                      value={caseNote}
                      rows={4}
                    />
                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Action</span>
                    <button
                      className="ol-button"
                      disabled={
                        isSavingSupportCase ||
                        !canEditSelectedTicket ||
                        !caseIdForUpdate.trim() ||
                        !caseNote.trim() ||
                        (requiresResolutionReason(caseAction) && !caseResolutionReason)
                      }
                      onClick={() => void saveSupportCaseUpdate()}
                      type="button"
                    >
                      {isSavingSupportCase ? 'Saving' : 'Save case update'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
            ) : null}

            {showAssignments ? (
            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Customer reply composer</div>
                  <p className="ol-panel-copy">
                    Send customer replies from Orbit Ledger, close tickets with a customer message, or close silently when no external message should go out.
                  </p>
                </div>
                <span className={`ol-chip ${canPrepareFollowUp ? 'ol-chip--warning' : 'ol-chip--primary'}`}>
                  {canPrepareFollowUp ? 'In-app outbound' : 'Read-only scope'}
                </span>
              </div>
              <div className="ol-form-band">
	                <div className="ol-form-band-grid">
	                  <label className="ol-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Reply action
	                        <span className="ol-required-badge">Required</span>
	                      </span>
	                      <OperationsFieldHelp text="Choose whether this sends a reply, closes the ticket, or reopens the customer thread." />
	                    </span>
	                    <select aria-required="true" className="ol-select" disabled={!canPrepareFollowUp} required value={replyAction} onChange={(event) => setReplyAction(event.target.value as WebSupportReplyAction)}>
	                      {SUPPORT_REPLY_ACTION_OPTIONS.map((option) => (
	                        <option key={option.value} value={option.value}>
	                          {option.label}
                        </option>
                      ))}
	                    </select>
	                  </label>
	                  <label className="ol-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Support case
	                        <span className="ol-required-badge">Required</span>
	                      </span>
	                      <OperationsFieldHelp text="Required so the reply, note, and delivery history attach to the correct support thread." />
	                    </span>
	                    <input aria-required="true" className="ol-input" disabled={!canPrepareFollowUp} required value={emailCaseId} onChange={(event) => setEmailCaseId(event.target.value)} placeholder="CASE-2001" />
	                  </label>
	                  <label className="ol-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Recipient email
	                        {replyActionNeedsDelivery ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <OperationsFieldHelp text="Required only when a customer email will be sent. Silent closures keep this optional and disabled." />
	                    </span>
	                    <input aria-required={replyActionNeedsDelivery || undefined} className="ol-input" disabled={!canPrepareFollowUp || !replyActionNeedsDelivery} required={replyActionNeedsDelivery} value={emailRecipient} onChange={(event) => setEmailRecipient(event.target.value)} placeholder="customer@example.com" />
	                  </label>
	                  <label className="ol-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Outcome reason
	                        {replyActionNeedsResolution ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <OperationsFieldHelp text="Required for close actions so reports show why the case was resolved or closed." />
	                    </span>
	                    <select aria-required={replyActionNeedsResolution || undefined} className="ol-select" disabled={!canPrepareFollowUp || !replyActionNeedsResolution} required={replyActionNeedsResolution} value={replyResolutionReason} onChange={(event) => setReplyResolutionReason(event.target.value as SupportResolutionReason | '')}>
	                      <option value="">Not needed</option>
	                      {SUPPORT_RESOLUTION_REASON_OPTIONS.map((option) => (
	                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
	                    </select>
	                  </label>
	                  <label className="ol-field ol-field--span-2">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Subject
	                        {replyActionNeedsDelivery ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <OperationsFieldHelp text="Required for customer emails. Keep it short and tied to the support case so the thread stays recognizable." />
	                    </span>
	                    <input aria-required={replyActionNeedsDelivery || undefined} className="ol-input" disabled={!canPrepareFollowUp || !replyActionNeedsDelivery} required={replyActionNeedsDelivery} value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} placeholder="Update on CASE-2001" />
	                  </label>
	                  <label className="ol-field ol-field--span-2">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        {replyAction === 'close_silently' ? 'Internal closure note' : 'Customer reply'}
	                        <span className="ol-required-badge">Required</span>
	                      </span>
	                      <OperationsFieldHelp text={replyAction === 'close_silently' ? 'Required. This records why the ticket closed without a customer email.' : 'Required. Write a customer-safe reply that will be saved into the ticket thread.'} />
	                    </span>
	                    <textarea aria-required="true" className="ol-textarea" disabled={!canPrepareFollowUp} required value={emailBody} onChange={(event) => setEmailBody(event.target.value)} placeholder={replyAction === 'close_silently' ? 'Explain why this ticket is closing without a customer email.' : 'Write a clear customer-safe reply message.'} rows={4} />
	                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Action</span>
                    <button
                      className="ol-button"
                      disabled={
                        isQueueingSupportEmail ||
                        !canPrepareFollowUp ||
                        !emailCaseId.trim() ||
                        !emailBody.trim() ||
                        (replyActionNeedsDelivery && (!emailRecipient.trim() || !emailSubject.trim())) ||
                        (replyActionNeedsResolution && !replyResolutionReason)
                      }
                      onClick={() => void sendSupportReply()}
                      type="button"
                    >
                      {isQueueingSupportEmail ? 'Sending' : supportReplyActionButtonLabel(replyAction)}
                    </button>
                  </div>
                </div>
              </div>
              <div className="ol-message ol-support-band-spacing">
                <strong>{supportReplyActionHelper(replyAction)}</strong>
                <p>
                  {replyActionNeedsDelivery
                    ? 'The reply is written back into the ticket thread and sent through the app-managed email transport.'
                    : 'No customer email goes out. The closure note stays inside the internal audit trail only.'}
                </p>
              </div>
              {snapshot?.supportCaseEmailRequests.length ? (
                <div className="ol-support-library-list ol-support-band-spacing">
                  {snapshot.supportCaseEmailRequests.map((request) => (
                    <article className="ol-support-library-card" key={request.id}>
                      <div className="ol-support-timeline-head">
                        <strong>{request.subject}</strong>
                        <span
                          className={`ol-chip ${
                            request.deliveryStatus === 'sent' || request.deliveryStatus === 'delivered'
                              ? 'ol-chip--success'
                              : request.deliveryStatus === 'queued' || request.deliveryStatus === 'pending_provider_connection'
                                ? ''
                                : 'ol-chip--warning'
                          }`}
                        >
                          {request.deliveryStatus === 'pending_provider_connection' ? 'delivery pending' : request.deliveryStatus}
                        </span>
                      </div>
                      <p className="ol-panel-copy">
                        {request.supportCaseId} · {supportReplyActionLabel(request.replyAction)} · {request.recipientEmail ?? 'No recipient'} · queued {formatDate(request.queuedAt)}
                      </p>
                      <p className="ol-panel-copy">{request.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ol-message ol-message--success ol-support-band-spacing">
                  No outbound support replies have been recorded for this workspace yet.
                </div>
              )}
            </section>
            ) : null}
          </div>
          ) : null}

          {showDiagnostics || showAccessRequests ? (
          <div className="ol-support-secondary-grid">
            {showDiagnostics ? (
            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Diagnostic pack library</div>
                  <p className="ol-panel-copy">
                    Customer-approved diagnostic packs that support can reference without opening a customer session.
                  </p>
                </div>
                <span className="ol-chip ol-chip--primary">{snapshot?.supportConsents.length ?? 0} approved</span>
              </div>
              {snapshot?.supportConsents.length ? (
                <div className="ol-support-library-list">
                  {snapshot.supportConsents.map((consent) => {
                    const linkedEvents = getLinkedSupportCaseEvents(snapshot.supportCaseEvents, consent);
                    return (
                      <article className="ol-support-library-card" key={consent.id}>
                        <div className="ol-support-timeline-head">
                          <strong>
                            {consent.supportCaseId ? `${consent.supportCaseId} · ` : ''}
                            {supportKindLabel(consent.supportKind)}
                          </strong>
                          <span className={`ol-chip ${consent.isActiveForReview ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                            {consent.isExpired && consent.status === 'active' ? 'expired' : consent.status}
                          </span>
                        </div>
                        <p>{consent.sanitizedMessage}</p>
                        <div className="ol-support-case-row-meta">
                          <span>{consent.userEmail ?? 'Workspace user'}</span>
                          <span>{consent.approvedFields.length} fields approved</span>
                          <span>{consent.redactedFields.length} fields redacted</span>
                          <span>Expires {formatDate(consent.expiresAt)}</span>
                        </div>
                        <div className="ol-support-timeline ol-support-band-spacing">
                          {linkedEvents.length ? (
                            linkedEvents.map((event) => (
                              <article className="ol-support-timeline-item" key={event.id}>
                                <div className="ol-support-timeline-head">
                                  <strong>{event.title}</strong>
                                  <span className={`ol-chip ${supportAuditChipClass(event.tone)}`}>
                                    {event.status ?? 'recorded'}
                                  </span>
                                </div>
                                <p>{event.detail}</p>
                                <span className="ol-list-text">
                                  {formatDate(event.createdAt)} · {event.actor}
                                </span>
                              </article>
                            ))
                          ) : (
                            <div className="ol-message ol-message--success">
                              No linked audit events yet.
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="ol-message ol-message--success">
                  No customer-approved diagnostic packs are waiting in this workspace.
                </div>
              )}
            </section>
            ) : null}

            {showAccessRequests ? (
            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Office review queue</div>
                  <p className="ol-panel-copy">
                    Trusted Office access actions remain available here while the support shell evolves around them.
                  </p>
                </div>
                <span className="ol-chip ol-chip--primary">{filteredReviewQueue.length} shown</span>
              </div>
              {filteredReviewQueue.length ? (
                <div className="ol-support-library-list">
                  {filteredReviewQueue.map((item) => (
                    <article className="ol-support-library-card" key={item.id}>
                      <div className="ol-support-timeline-head">
                        <strong>{item.title}</strong>
                        <span className={`ol-chip ${chipClassForTone(item.tone)}`}>{item.statusLabel}</span>
                      </div>
                      <p>{item.detail || 'Contact details were not provided.'}</p>
                      {item.request.message ? (
                        <div className="ol-message ol-support-band-spacing">
                          {item.request.message}
                        </div>
                      ) : null}
                      <div className="ol-actions ol-actions--compact ol-support-band-spacing">
                        {item.actionPlans.length ? (
                          item.actionPlans.map((plan) => (
                            <button
                              className={plan.action === 'grant_access' ? 'ol-button' : 'ol-button-secondary'}
                              disabled={!plan.canApply || Boolean(busyActionId)}
                              key={plan.action}
                              type="button"
                              onClick={() => {
                                void runAction(item.request.id, plan.action);
                              }}
                            >
                              {busyActionId === `${item.request.id}:${plan.action}` ? 'Working' : actionLabel(plan.action)}
                            </button>
                          ))
                        ) : (
                          <span className="ol-chip ol-chip--success">No action needed</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ol-message ol-message--success">
                  No Office access requests match this view.
                </div>
              )}
            </section>
            ) : null}
          </div>
          ) : null}

          {showOverview ? (
          <div className="ol-support-secondary-grid">
            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Production readiness</div>
                  <p className="ol-panel-copy">
                    Deployment checks for Office support workflows. Secret values are never shown here.
                  </p>
                </div>
                <span className="ol-chip ol-chip--warning">Review before launch</span>
              </div>
              <div className="ol-review-grid">
                {OFFICE_PRODUCTION_READINESS_CHECKLIST.map((item) => (
                  <div className="ol-review-item" key={item.id}>
                    <span className="ol-review-label">{item.label}</span>
                    <strong className="ol-review-value">{item.detail}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Office launch freeze</div>
                  <p className="ol-panel-copy">
                    Office is in controlled-invite review. Limit changes to fixes, deployment checks, and payment setup readiness.
                  </p>
                </div>
                <span className="ol-chip ol-chip--success">Freeze active</span>
              </div>
              <div className="ol-list">
                {OFFICE_FINAL_LAUNCH_FREEZE_ITEMS.map((item, index) => (
                  <div className="ol-list-item" key={item}>
                    <div className="ol-list-icon" data-tone="success">
                      {index + 1}
                    </div>
                    <div className="ol-list-copy">
                      <div className="ol-list-title">{item}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          ) : null}
        </>
      )}
    </>
  );
}
