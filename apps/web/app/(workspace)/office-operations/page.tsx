'use client';

import { useEffect, useMemo, useState } from 'react';

import type { OfficeSupportCaseAction, SupportResolutionReason } from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import {
  OFFICE_FINAL_LAUNCH_FREEZE_ITEMS,
  OFFICE_PRODUCTION_READINESS_CHECKLIST,
  OFFICE_SUPPORT_REVIEW_GUARDRAILS,
  isWebOfficeOperationsAllowed,
  loadWebOfficeOperationsSnapshot,
  queueWebSupportCaseFollowUpEmail,
  recordWebSupportCaseAdminAction,
  recordWebOfficeSupportReview,
  resolveWebOfficeAccessRequest,
  type WebOfficeOperationsSnapshot,
  type WebSupportCaseAuditEvent,
  type WebSupportCaseRecord,
  type WebSupportDiagnosticConsentRecord,
  type WebSupportMessageRecord,
  type WebSupportTicketRecord,
} from '@/lib/office-admin-operations';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type SupportShellRow = {
  supportCase: WebSupportCaseRecord;
  ticket: WebSupportTicketRecord | null;
  latestMessage: WebSupportMessageRecord | null;
  consentCount: number;
  pendingEmailCount: number;
  eventCount: number;
};

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

export default function OfficeOperationsPage() {
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
  const [reviewStatusFilter, setReviewStatusFilter] = useState('active');
  const [supportCaseFilter, setSupportCaseFilter] = useState<(typeof SUPPORT_FILTER_OPTIONS)[number]['value']>('active');
  const [operationsSearch, setOperationsSearch] = useState('');
  const [selectedSupportCaseId, setSelectedSupportCaseId] = useState('');
  const [isRecordingSupportReview, setIsRecordingSupportReview] = useState(false);
  const [isSavingSupportCase, setIsSavingSupportCase] = useState(false);
  const [isQueueingSupportEmail, setIsQueueingSupportEmail] = useState(false);
  const isAllowed = useMemo(() => isWebOfficeOperationsAllowed(user?.email), [user?.email]);

  const supportTicketByCaseId = useMemo(() => {
    const entries = (snapshot?.supportTickets ?? [])
      .filter((ticket) => ticket.supportCaseId)
      .map((ticket) => [ticket.supportCaseId as string, ticket] as const);
    return new Map(entries);
  }, [snapshot?.supportTickets]);

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
          (supportCaseFilter === 'active' && supportCase.status !== 'resolved') ||
          supportCase.status === supportCaseFilter;
        const ticket = supportTicketByCaseId.get(supportCase.supportCaseId) ?? null;
        const search = operationsSearch.trim().toLowerCase();
        const searchHaystack = [
          supportCase.supportCaseId,
          supportCase.latestNote,
          ticket?.subject ?? '',
          ticket?.summary ?? '',
          ticket?.customerEmail ?? '',
          ticket?.customerName ?? '',
          supportQueueLabel(ticket?.queueId),
        ]
          .join(' ')
          .toLowerCase();
        const matchesSearch = !search || searchHaystack.includes(search);
        return matchesStatus && matchesSearch;
      }),
    [operationsSearch, snapshot?.supportCases, supportCaseFilter, supportTicketByCaseId]
  );

  const supportShellRows = useMemo<SupportShellRow[]>(
    () =>
      filteredSupportCases.map((supportCase) => {
        const ticket = supportTicketByCaseId.get(supportCase.supportCaseId) ?? null;
        const messages = supportMessagesByCaseId.get(supportCase.supportCaseId) ?? [];
        return {
          supportCase,
          ticket,
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
      supportTicketByCaseId,
    ]
  );

  const selectedSupportRow = useMemo(
    () => supportShellRows.find((row) => row.supportCase.supportCaseId === selectedSupportCaseId) ?? supportShellRows[0] ?? null,
    [selectedSupportCaseId, supportShellRows]
  );

  const selectedSupportMessages = useMemo(
    () =>
      selectedSupportRow
        ? (supportMessagesByCaseId.get(selectedSupportRow.supportCase.supportCaseId) ?? []).slice(0, 6)
        : [],
    [selectedSupportRow, supportMessagesByCaseId]
  );
  const selectedSupportEvents = useMemo(
    () =>
      selectedSupportRow
        ? (supportEventsByCaseId.get(selectedSupportRow.supportCase.supportCaseId) ?? []).slice(0, 6)
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
  const selectedSupportTimeline = useMemo<SupportTimelineEntry[]>(
    () =>
      [
        ...selectedSupportMessages.map((message) => ({
          id: `message:${message.id}`,
          createdAt: message.createdAt,
          kind: 'message' as const,
          tone: supportMessageTone(message.kind),
          title: supportMessageKindLabel(message.kind),
          body: message.body,
          meta: `${message.actorEmail ?? message.actorRole} · ${message.visibleToCustomer ? 'Customer-visible' : 'Internal only'}`,
          badge: supportMessageKindBadge(message.kind),
        })),
        ...selectedSupportEvents.map((event) => ({
          id: `event:${event.id}`,
          createdAt: event.createdAt,
          kind: 'event' as const,
          tone: event.tone,
          title: event.title,
          body: event.detail,
          meta: event.actor,
          badge: event.status ?? event.kind ?? 'recorded',
        })),
      ].sort((left, right) => sortSupportTimeline(left.createdAt, right.createdAt)),
    [selectedSupportEvents, selectedSupportMessages]
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
    ],
    [snapshot?.supportCaseEmailRequests.length, snapshot?.supportCases, supportShellRows]
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
    ],
    [snapshot?.supportCases, snapshot?.supportConsents]
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

    setIsSavingSupportCase(true);
    try {
      const result = await recordWebSupportCaseAdminAction({
        workspaceId: activeWorkspace.workspaceId,
        supportCaseId: caseIdForUpdate,
        action: caseAction,
        note: caseNote,
        resolutionReason: caseResolutionReason || null,
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

  async function queueSupportEmail() {
    if (!activeWorkspace?.workspaceId || !emailCaseId.trim() || !emailRecipient.trim() || !emailSubject.trim() || !emailBody.trim()) {
      showToast('Add the case, recipient, subject, and message before preparing this email.', 'info');
      return;
    }

    setIsQueueingSupportEmail(true);
    try {
      const result = await queueWebSupportCaseFollowUpEmail({
        workspaceId: activeWorkspace.workspaceId,
        supportCaseId: emailCaseId,
        recipientEmail: emailRecipient,
        subject: emailSubject,
        body: emailBody,
      });
      showToast(result.message, 'success');
      setEmailCaseId('');
      setEmailRecipient('');
      setEmailSubject('');
      setEmailBody('');
      await refresh();
    } catch (emailError) {
      showToast(emailError instanceof Error ? emailError.message : 'Support email could not be prepared.', 'danger');
    } finally {
      setIsQueueingSupportEmail(false);
    }
  }

  function prepareSupportEmail(supportCase: WebSupportCaseRecord, ticket: WebSupportTicketRecord | null) {
    setEmailCaseId(supportCase.supportCaseId);
    setEmailRecipient(ticket?.customerEmail ?? '');
    setEmailSubject(`Update on ${supportCase.supportCaseId}`);
    setEmailBody(`Hello,\n\nWe have an update for support case ${supportCase.supportCaseId}.\n\nThank you,\nOrbit Ledger Support`);
  }

  return (
    <AppShell
      title="Support operations"
      subtitle="Internal support center shell for workspace-safe review, diagnostics, and Office follow-up."
    >
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
      ) : (
        <>
          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Support center shell</div>
                <p className="ol-panel-copy">
                  Scan customer support, diagnostic approvals, and hidden Office review activity in one internal workspace console.
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
            {error ? (
              <div className="ol-message ol-message--danger">{error}</div>
            ) : (
              <div className={`ol-message ${snapshot?.health.tone === 'success' ? 'ol-message--success' : 'ol-message--warning'}`}>
                <strong>{snapshot?.health.title ?? 'Loading Office operations'}</strong>
                <p>{snapshot?.health.message ?? 'Checking Office access requests for this workspace.'}</p>
              </div>
            )}
          </section>

          <div className="ol-metric-grid">
            {supportShellSummary.map((metric) => (
              <article className="ol-metric-card" data-tone={metric.tone} key={metric.id}>
                <div className="ol-metric-label">{metric.label}</div>
                <div className="ol-metric-value">{metric.value}</div>
                <div className="ol-metric-helper">{metric.helper}</div>
              </article>
            ))}
            {(snapshot?.metrics ?? []).map((metric) => (
              <article className="ol-metric-card" data-tone={metric.tone} key={metric.id}>
                <div className="ol-metric-label">{metric.label}</div>
                <div className="ol-metric-value">{metric.value}</div>
                <div className="ol-metric-helper">{metric.helper}</div>
              </article>
            ))}
          </div>

          <div className="ol-support-center-shell">
            <aside className="ol-panel-dark ol-support-center-sidebar">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Queue and scope</div>
                  <p className="ol-panel-copy">
                    Narrow the shell without changing customer data or mutating ticket history.
                  </p>
                </div>
                <span className="ol-chip ol-chip--primary">Internal only</span>
              </div>

              <div className="ol-support-rail-block">
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

              <div className="ol-support-rail-section">
                <div className="ol-support-rail-label">Case buckets</div>
                <div className="ol-support-nav-list">
                  {SUPPORT_FILTER_OPTIONS.map((option) => {
                    const count = countSupportCases(snapshot?.supportCases ?? [], (supportCase) =>
                      option.value === 'all'
                        ? true
                        : option.value === 'active'
                          ? supportCase.status !== 'resolved'
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

              <div className="ol-support-rail-section">
                <div className="ol-support-rail-label">Support signals</div>
                <div className="ol-support-chip-row">
                  <span className="ol-chip ol-chip--premium">{countSupportConsents(snapshot?.supportConsents ?? [], (item) => item.isActiveForReview)} active diagnostics</span>
                  <span className="ol-chip ol-chip--warning">{snapshot?.supportCaseEmailRequests.length ?? 0} follow-up emails</span>
                  <span className="ol-chip ol-chip--primary">{filteredReviewQueue.length} Office review items</span>
                </div>
              </div>
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
                          <span className={`ol-chip ${supportCaseChipClass(row.supportCase.status)}`}>
                            {supportCaseStatusLabel(row.supportCase.status)}
                          </span>
                        </div>
                        <p>{row.ticket?.summary ?? row.supportCase.latestNote}</p>
                        <div className="ol-support-case-row-meta">
                          <span>{supportQueueLabel(row.ticket?.queueId)}</span>
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
                        type="button"
                      >
                        Use in review log
                      </button>
                      <button
                        className="ol-button-secondary"
                        onClick={() => prepareCaseUpdate(selectedSupportRow.supportCase, 'add_note')}
                        type="button"
                      >
                        Add note
                      </button>
                      <button
                        className="ol-button-secondary"
                        onClick={() => prepareSupportEmail(selectedSupportRow.supportCase, selectedSupportRow.ticket)}
                        type="button"
                      >
                        Prepare follow-up
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
                      <span className="ol-review-label">Follow-ups</span>
                      <strong className="ol-review-value">
                        {selectedSupportEmails.length} queued
                      </strong>
                      <span className="ol-list-text">
                        {selectedSupportEvents.length} audit event{selectedSupportEvents.length === 1 ? '' : 's'}
                      </span>
                    </article>
                  </div>

                  <div className="ol-support-thread-section">
                    <div className="ol-support-section-heading">
                      <div>
                        <h3>Thread and activity</h3>
                        <p>Customer messages, internal notes, and ticket events in one operator timeline.</p>
                      </div>
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
                </>
              ) : (
                <div className="ol-support-empty-state">
                  <strong>Select a support case to load ticket detail.</strong>
                  <p>The detail pane fills automatically once a case is available in the current filter.</p>
                </div>
              )}
            </section>
          </div>

          <div className="ol-support-workbench-grid">
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
                    <span className="ol-field-label">Support case</span>
                    <input
                      className="ol-input"
                      onChange={(event) => setSupportCaseId(event.target.value)}
                      placeholder="Optional case number"
                      value={supportCaseId}
                    />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Review reason</span>
                    <input
                      className="ol-input"
                      onChange={(event) => setSupportReason(event.target.value)}
                      placeholder="Example: Customer asked us to review Office setup"
                      value={supportReason}
                    />
                  </label>
                  <label className="ol-checkbox-row">
                    <input
                      checked={supportDiagnosticsApproved}
                      className="ol-checkbox"
                      onChange={(event) => setSupportDiagnosticsApproved(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Customer approved diagnostic context</span>
                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Action</span>
                    <button
                      className="ol-button"
                      disabled={isRecordingSupportReview || !supportReason.trim()}
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
                    <span className="ol-field-label">Support case</span>
                    <input
                      className="ol-input"
                      onChange={(event) => setCaseIdForUpdate(event.target.value)}
                      placeholder="CASE-2001"
                      value={caseIdForUpdate}
                    />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Action</span>
                    <select
                      className="ol-select"
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
                    <span className="ol-field-label">Outcome reason</span>
                    <select
                      className="ol-select"
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
                    <span className="ol-field-label">Internal note</span>
                    <textarea
                      className="ol-textarea"
                      onChange={(event) => setCaseNote(event.target.value)}
                      placeholder="Short operator note visible in the audit trail"
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

            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Follow-up composer</div>
                  <p className="ol-panel-copy">
                    Prepare safe customer follow-up inside Orbit Ledger while provider delivery remains behind trusted server controls.
                  </p>
                </div>
                <span className="ol-chip ol-chip--warning">Provider pending</span>
              </div>
              <div className="ol-form-band">
                <div className="ol-form-band-grid">
                  <label className="ol-field">
                    <span className="ol-field-label">Support case</span>
                    <input className="ol-input" value={emailCaseId} onChange={(event) => setEmailCaseId(event.target.value)} placeholder="CASE-2001" />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Recipient email</span>
                    <input className="ol-input" value={emailRecipient} onChange={(event) => setEmailRecipient(event.target.value)} placeholder="customer@example.com" />
                  </label>
                  <label className="ol-field ol-field--span-2">
                    <span className="ol-field-label">Subject</span>
                    <input className="ol-input" value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} placeholder="Update on CASE-2001" />
                  </label>
                  <label className="ol-field ol-field--span-2">
                    <span className="ol-field-label">Message</span>
                    <textarea className="ol-textarea" value={emailBody} onChange={(event) => setEmailBody(event.target.value)} placeholder="Write a safe follow-up message." rows={4} />
                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Action</span>
                    <button
                      className="ol-button"
                      disabled={isQueueingSupportEmail || !emailCaseId.trim() || !emailRecipient.trim() || !emailSubject.trim() || !emailBody.trim()}
                      onClick={() => void queueSupportEmail()}
                      type="button"
                    >
                      {isQueueingSupportEmail ? 'Preparing' : 'Prepare follow-up email'}
                    </button>
                  </div>
                </div>
              </div>
              {snapshot?.supportCaseEmailRequests.length ? (
                <div className="ol-support-library-list ol-support-band-spacing">
                  {snapshot.supportCaseEmailRequests.map((request) => (
                    <article className="ol-support-library-card" key={request.id}>
                      <div className="ol-support-timeline-head">
                        <strong>{request.subject}</strong>
                        <span className={`ol-chip ${request.deliveryStatus === 'sent' ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                          {request.deliveryStatus === 'pending_provider_connection' ? 'delivery pending' : request.deliveryStatus}
                        </span>
                      </div>
                      <p className="ol-panel-copy">
                        {request.supportCaseId} · {request.recipientEmail ?? 'No recipient'} · queued {formatDate(request.queuedAt)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ol-message ol-message--success ol-support-band-spacing">
                  No support follow-up emails are waiting for provider connection.
                </div>
              )}
            </section>
          </div>

          <div className="ol-support-secondary-grid">
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
          </div>

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
        </>
      )}
    </AppShell>
  );
}

function chipClassForTone(tone: 'success' | 'warning' | 'premium' | 'default') {
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

function supportAuditChipClass(tone: WebSupportCaseAuditEvent['tone']) {
  if (tone === 'success') {
    return 'ol-chip--success';
  }
  if (tone === 'warning') {
    return 'ol-chip--warning';
  }
  return 'ol-chip--primary';
}

function supportCaseChipClass(status: WebSupportCaseRecord['status']) {
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

function supportCaseStatusLabel(status: WebSupportCaseRecord['status']) {
  return status
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function supportMessageKindLabel(kind: string) {
  if (kind === 'operator_reply') {
    return 'Operator reply';
  }
  if (kind === 'internal_note') {
    return 'Internal note';
  }
  if (kind === 'system_event') {
    return 'System event';
  }
  return 'Customer message';
}

function supportMessageKindBadge(kind: string) {
  if (kind === 'internal_note') {
    return 'Internal note';
  }
  if (kind === 'operator_reply') {
    return 'Reply';
  }
  if (kind === 'system_event') {
    return 'System';
  }
  return 'Customer';
}

function supportMessageTone(kind: string): SupportTimelineEntry['tone'] {
  if (kind === 'operator_reply') {
    return 'success';
  }
  return 'default';
}

function supportPriorityLabel(priority: string | null | undefined) {
  const value = priority?.trim() || 'normal';
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function supportQueueLabel(queueId: string | null | undefined) {
  return SUPPORT_QUEUE_LABELS[queueId ?? ''] ?? 'General';
}

function resolveSupportContactEmail(
  row: SupportShellRow,
  consents: WebSupportDiagnosticConsentRecord[]
) {
  return row.ticket?.customerEmail ?? consents.find((consent) => consent.userEmail)?.userEmail ?? row.supportCase.latestNoteByEmail ?? null;
}

function requiresResolutionReason(action: OfficeSupportCaseAction) {
  return action === 'resolve' || action === 'close';
}

function getLinkedSupportCaseEvents(
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

function buildCaseMap<T>(items: T[], getSupportCaseId: (item: T) => string | null) {
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

function countSupportCases(
  supportCases: WebSupportCaseRecord[],
  predicate: (supportCase: WebSupportCaseRecord) => boolean
) {
  return supportCases.filter(predicate).length;
}

function countSupportConsents(
  supportConsents: WebSupportDiagnosticConsentRecord[],
  predicate: (supportConsent: WebSupportDiagnosticConsentRecord) => boolean
) {
  return supportConsents.filter(predicate).length;
}

function actionLabel(action: string) {
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

function officeActionNote(action: string) {
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

function supportKindLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null | undefined) {
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

function sortSupportTimeline(left: string | null, right: string | null) {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return rightTime - leftTime;
}
