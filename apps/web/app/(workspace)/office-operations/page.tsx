'use client';

import { useEffect, useMemo, useState } from 'react';

import type { OfficeSupportCaseAction } from '@orbit-ledger/core';

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
} from '@/lib/office-admin-operations';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

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
  const [caseIdForUpdate, setCaseIdForUpdate] = useState('');
  const [emailCaseId, setEmailCaseId] = useState('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('active');
  const [supportCaseFilter, setSupportCaseFilter] = useState('active');
  const [operationsSearch, setOperationsSearch] = useState('');
  const [isRecordingSupportReview, setIsRecordingSupportReview] = useState(false);
  const [isSavingSupportCase, setIsSavingSupportCase] = useState(false);
  const [isQueueingSupportEmail, setIsQueueingSupportEmail] = useState(false);
  const isAllowed = useMemo(() => isWebOfficeOperationsAllowed(user?.email), [user?.email]);
  const filteredReviewQueue = useMemo(
    () =>
      (snapshot?.queue ?? []).filter((item) => {
        const matchesStatus =
          reviewStatusFilter === 'all' ||
          (reviewStatusFilter === 'active' && item.actionPlans.length > 0) ||
          item.request.status === reviewStatusFilter;
        const search = operationsSearch.trim().toLowerCase();
        const matchesSearch = !search ||
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
        const search = operationsSearch.trim().toLowerCase();
        const matchesSearch = !search ||
          supportCase.supportCaseId.toLowerCase().includes(search) ||
          supportCase.latestNote.toLowerCase().includes(search);
        return matchesStatus && matchesSearch;
      }),
    [operationsSearch, snapshot?.supportCases, supportCaseFilter]
  );

  useEffect(() => {
    if (!activeWorkspace?.workspaceId || !isAllowed) {
      setSnapshot(null);
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.workspaceId, isAllowed]);

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
      });
      showToast(result.message, 'success');
      setCaseIdForUpdate('');
      setCaseNote('');
      setCaseAction('add_note');
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

  function prepareSupportEmail(supportCase: WebSupportCaseRecord) {
    setEmailCaseId(supportCase.supportCaseId);
    setEmailSubject(`Update on ${supportCase.supportCaseId}`);
    setEmailBody(`Hello,\n\nWe have an update for support case ${supportCase.supportCaseId}.\n\nThank you,\nOrbit Ledger Support`);
  }

  return (
    <AppShell
      title="Office operations"
      subtitle="Hidden review surface for invitation-only Office access."
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
                <div className="ol-panel-title">Office access review</div>
                <p className="ol-panel-copy">
                  Review invitation requests, approval state, and grant readiness without exposing these controls in the customer navigation.
                </p>
              </div>
              <div className="ol-actions ol-actions--compact">
                <span className={`ol-chip ${snapshot?.health.tone === 'success' ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                  {snapshot?.health.tone === 'success' ? 'Clear' : 'Review'}
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
                  Office is now in controlled-invite hardening. New work should be limited to fixes, deployment checks, and provider wiring.
                </p>
              </div>
              <span className="ol-chip ol-chip--success">Freeze active</span>
            </div>
            <div className="ol-list">
              {OFFICE_FINAL_LAUNCH_FREEZE_ITEMS.map((item, index) => (
                <div className="ol-list-item" key={item}>
                  <div className="ol-list-icon" data-tone="success">{index + 1}</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">{item}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Operations filters</div>
                <p className="ol-panel-copy">
                  Narrow review requests and support cases without changing the workspace data.
                </p>
              </div>
              <span className="ol-chip ol-chip--primary">Local view</span>
            </div>
            <div className="ol-filter-grid">
              <label className="ol-field">
                <span className="ol-field-label">Search</span>
                <input
                  className="ol-input"
                  onChange={(event) => setOperationsSearch(event.target.value)}
                  placeholder="Business, email, case, or note"
                  value={operationsSearch}
                />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Review queue</span>
                <select className="ol-select" value={reviewStatusFilter} onChange={(event) => setReviewStatusFilter(event.target.value)}>
                  <option value="active">Needs action</option>
                  <option value="submitted">Submitted</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="approved">Approved</option>
                  <option value="granted">Granted</option>
                  <option value="all">All requests</option>
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Support cases</span>
                <select className="ol-select" value={supportCaseFilter} onChange={(event) => setSupportCaseFilter(event.target.value)}>
                  <option value="active">Open and reopened</option>
                  <option value="open">Open</option>
                  <option value="reopened">Reopened</option>
                  <option value="waiting_on_customer">Waiting for customer</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All cases</option>
                </select>
              </label>
            </div>
          </section>

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
            <div className="ol-form-band" style={{ marginTop: 16 }}>
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
            <div className="ol-review-grid" style={{ marginTop: 16 }}>
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
                <div className="ol-panel-title">Diagnostic review packs</div>
                <p className="ol-panel-copy">
                  Customer-approved diagnostic packs that support can reference without opening a customer session.
                </p>
              </div>
              <span className="ol-chip ol-chip--primary">{snapshot?.supportConsents.length ?? 0} approved</span>
            </div>
            {snapshot?.supportConsents.length ? (
              <div className="ol-list">
                {snapshot.supportConsents.map((consent) => {
                  const linkedEvents = getLinkedSupportCaseEvents(snapshot.supportCaseEvents, consent);
                  return (
                    <article className="ol-list-item" key={consent.id}>
                      <div className="ol-list-icon">S</div>
                      <div className="ol-list-copy">
                        <div className="ol-market-card-header">
                          <div>
                            <div className="ol-list-title">
                              {consent.supportCaseId ? `${consent.supportCaseId} · ` : ''}{supportKindLabel(consent.supportKind)}
                            </div>
                            <div className="ol-list-text">
                              {consent.userEmail ?? 'Workspace user'} · expires {formatDate(consent.expiresAt)}
                            </div>
                          </div>
                          <span className={`ol-chip ${consent.isActiveForReview ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                            {consent.isExpired && consent.status === 'active' ? 'expired' : consent.status}
                          </span>
                        </div>
                        <p className="ol-panel-copy" style={{ marginTop: 8 }}>
                          {consent.sanitizedMessage}
                        </p>
                        <div className="ol-inline-actions" style={{ marginTop: 10 }}>
                          <span className="ol-chip ol-chip--primary">{consent.approvedFields.length} fields approved</span>
                          <span className="ol-chip ol-chip--warning">{consent.redactedFields.length} fields redacted</span>
                          {!consent.isActiveForReview ? (
                            <span className="ol-chip ol-chip--warning">Not active for support</span>
                          ) : null}
                        </div>
                        <div className="ol-review-grid" style={{ marginTop: 14 }}>
                          {linkedEvents.length ? (
                            linkedEvents.map((event) => (
                              <div className="ol-review-item" key={event.id}>
                                <span className="ol-review-label">{event.title}</span>
                                <strong className="ol-review-value">{event.detail}</strong>
                                <span className="ol-list-text">
                                  {formatDate(event.createdAt)} · {event.actor}
                                </span>
                                <span className={`ol-chip ${supportAuditChipClass(event.tone)}`}>
                                  {event.status ?? 'recorded'}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="ol-review-item">
                              <span className="ol-review-label">Timeline</span>
                              <strong className="ol-review-value">No linked audit events yet.</strong>
                            </div>
                          )}
                        </div>
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
                <div className="ol-panel-title">Support case resolution</div>
                <p className="ol-panel-copy">
                  Add internal notes, resolve cases, or reopen follow-up without changing customer data or creating a customer session.
                </p>
              </div>
              <span className="ol-chip ol-chip--primary">{filteredSupportCases.length} shown</span>
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
                    <option value="add_note">Add internal note</option>
                    <option value="resolve">Mark resolved</option>
                    <option value="reopen">Reopen case</option>
                  </select>
                </label>
                <label className="ol-field ol-field--span-2">
                  <span className="ol-field-label">Internal note</span>
                  <input
                    className="ol-input"
                    onChange={(event) => setCaseNote(event.target.value)}
                    placeholder="Short resolution note visible in the audit trail"
                    value={caseNote}
                  />
                </label>
                <div className="ol-field ol-field--action">
                  <span className="ol-field-label">Action</span>
                  <button
                    className="ol-button"
                    disabled={isSavingSupportCase || !caseIdForUpdate.trim() || !caseNote.trim()}
                    onClick={() => void saveSupportCaseUpdate()}
                    type="button"
                  >
                    {isSavingSupportCase ? 'Saving' : 'Save case update'}
                  </button>
                </div>
              </div>
            </div>
            {filteredSupportCases.length ? (
              <div className="ol-list" style={{ marginTop: 16 }}>
                {filteredSupportCases.map((supportCase) => (
                  <article className="ol-list-item" key={supportCase.id}>
                    <div className="ol-list-icon">C</div>
                    <div className="ol-list-copy">
                      <div className="ol-market-card-header">
                        <div>
                          <div className="ol-list-title">{supportCase.supportCaseId}</div>
                          <div className="ol-list-text">
                            {supportCase.noteCount} {supportCase.noteCount === 1 ? 'note' : 'notes'} · updated {formatDate(supportCase.updatedAt)}
                          </div>
                        </div>
                        <span className={`ol-chip ${supportCaseChipClass(supportCase.status)}`}>
                          {supportCaseStatusLabel(supportCase.status)}
                        </span>
                      </div>
                      <p className="ol-panel-copy" style={{ marginTop: 8 }}>
                        {supportCase.latestNote}
                      </p>
                      <div className="ol-inline-actions" style={{ marginTop: 10 }}>
                        <button
                          className="ol-button-secondary"
                          type="button"
                          onClick={() => prepareCaseUpdate(supportCase, 'add_note')}
                        >
                          Add note
                        </button>
                        <button
                          className="ol-button-secondary"
                          type="button"
                          onClick={() => prepareSupportEmail(supportCase)}
                        >
                          Prepare email
                        </button>
                        {supportCase.status === 'resolved' ? (
                          <button
                            className="ol-button-secondary"
                            type="button"
                            onClick={() => prepareCaseUpdate(supportCase, 'reopen')}
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            className="ol-button"
                            type="button"
                            onClick={() => prepareCaseUpdate(supportCase, 'resolve')}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ol-message ol-message--success" style={{ marginTop: 16 }}>
                No support cases match this view.
              </div>
            )}
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Support email readiness</div>
                <p className="ol-panel-copy">
                  Prepare safe follow-up emails now. Delivery stays pending until the email provider is connected.
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
              <div className="ol-list" style={{ marginTop: 16 }}>
                {snapshot.supportCaseEmailRequests.map((request) => (
                  <article className="ol-list-item" key={request.id}>
                    <div className="ol-list-icon">E</div>
                    <div className="ol-list-copy">
                      <div className="ol-market-card-header">
                        <div>
                          <div className="ol-list-title">{request.subject}</div>
                          <div className="ol-list-text">
                            {request.supportCaseId} · {request.recipientEmail ?? 'No recipient'} · queued {formatDate(request.queuedAt)}
                          </div>
                        </div>
                        <span className={`ol-chip ${request.deliveryStatus === 'sent' ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                          {request.deliveryStatus === 'pending_provider_connection' ? 'provider pending' : request.deliveryStatus}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ol-message ol-message--success" style={{ marginTop: 16 }}>
                No support follow-up emails are waiting for provider connection.
              </div>
            )}
          </section>

          <div className="ol-metric-grid">
            {(snapshot?.metrics ?? []).map((metric) => (
              <article className="ol-metric-card" data-tone={metric.tone} key={metric.id}>
                <div className="ol-metric-label">{metric.label}</div>
                <div className="ol-metric-value">{metric.value}</div>
                <div className="ol-metric-helper">{metric.helper}</div>
              </article>
            ))}
          </div>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Review queue</div>
                <p className="ol-panel-copy">
                  Review requests with trusted actions only. Filters above do not change the underlying queue.
                </p>
              </div>
              <span className="ol-chip ol-chip--primary">{filteredReviewQueue.length} shown</span>
            </div>
            {filteredReviewQueue.length ? (
              <div className="ol-list">
                {filteredReviewQueue.map((item) => (
                  <article className="ol-list-item" key={item.id}>
                    <div className="ol-list-icon">O</div>
                    <div className="ol-list-copy">
                      <div className="ol-market-card-header">
                        <div>
                          <div className="ol-list-title">{item.title}</div>
                          <div className="ol-list-text">{item.detail || 'Contact details were not provided.'}</div>
                        </div>
                        <span className={`ol-chip ${chipClassForTone(item.tone)}`}>{item.statusLabel}</span>
                      </div>
                      {item.request.message ? (
                        <div className="ol-message" style={{ marginTop: 10 }}>
                          {item.request.message}
                        </div>
                      ) : null}
                      <div className="ol-actions ol-actions--compact" style={{ marginTop: 12 }}>
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

function formatDate(value: string | null) {
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
