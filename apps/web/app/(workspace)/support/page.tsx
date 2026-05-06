'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FOUNDER_SAFE_SUPPORT_GUARDRAILS,
  FOUNDER_SAFE_SUPPORT_SURFACES,
  buildFounderSafeDiagnosticSummary,
  buildFounderSafeSupportDraft,
  type FounderSafeDiagnosticInput,
  type FounderSafeSupportKind,
} from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import {
  createWebSupportDiagnosticConsent,
  loadWebSupportCaseCustomerStatuses,
  revokeWebSupportDiagnosticConsent,
  type WebSupportCaseCustomerStatus,
} from '@/lib/support-consent';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

const supportEmail = 'support@rudraix.com';

const supportKinds: Array<{
  label: string;
  helper: string;
  value: FounderSafeSupportKind;
}> = [
  {
    value: 'invoice_issue',
    label: 'Invoice issue',
    helper: 'PDF, CSV, version, template, tax, or print problem.',
  },
  {
    value: 'payment_issue',
    label: 'Payment issue',
    helper: 'Payment status, allocation, proof, clearance, or reversal problem.',
  },
  {
    value: 'restore_help',
    label: 'Backup or restore help',
    helper: 'Backup, restore, rollback, or data protection concern.',
  },
  {
    value: 'purchase_help',
    label: 'Purchase help',
    helper: 'Plan, receipt, entitlement, billing, or checkout readiness.',
  },
  {
    value: 'feature_request',
    label: 'Feature suggestion',
    helper: 'Tell us what would make daily work smoother.',
  },
  {
    value: 'general_feedback',
    label: 'General feedback',
    helper: 'Share what feels good, confusing, slow, or missing.',
  },
];

export default function SupportPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [kind, setKind] = useState<FounderSafeSupportKind>('general_feedback');
  const [message, setMessage] = useState('');
  const [supportCaseId, setSupportCaseId] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [privacyReviewed, setPrivacyReviewed] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [isRevokingConsent, setIsRevokingConsent] = useState(false);
  const [savedConsent, setSavedConsent] = useState<{ consentId: string; expiresAt: string } | null>(null);
  const [supportCases, setSupportCases] = useState<WebSupportCaseCustomerStatus[]>([]);
  const [isLoadingSupportCases, setIsLoadingSupportCases] = useState(false);
  const businessName = activeWorkspace?.businessName ?? 'Orbit Ledger workspace';

  useEffect(() => {
    if (!activeWorkspace?.workspaceId) {
      setSupportCases([]);
      return;
    }

    let cancelled = false;
    setIsLoadingSupportCases(true);
    loadWebSupportCaseCustomerStatuses(activeWorkspace.workspaceId)
      .then((items) => {
        if (!cancelled) {
          setSupportCases(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSupportCases([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSupportCases(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.workspaceId]);

  const diagnosticInput = useMemo<FounderSafeDiagnosticInput>(
    () => ({
        appVersion: 'web',
        browserName: typeof navigator === 'undefined' ? 'Browser' : navigator.userAgent.split(' ')[0],
        connectivity: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online',
        platform: 'web',
        route: typeof window === 'undefined' ? '/support' : window.location.pathname,
        screen: 'Support',
        workspaceMode: activeWorkspace?.workspaceId ? 'workspace selected' : 'no workspace selected',
        businessName,
      }),
    [activeWorkspace?.workspaceId, businessName]
  );
  const diagnosticSummary = useMemo(
    () => buildFounderSafeDiagnosticSummary(diagnosticInput),
    [diagnosticInput]
  );

  const draft = useMemo(
    () =>
      buildFounderSafeSupportDraft({
        diagnostic: diagnosticInput,
        includeDiagnostics,
        kind,
        message,
        screen: 'Support',
        userApprovedDiagnostics: includeDiagnostics && privacyReviewed,
      }),
    [diagnosticInput, includeDiagnostics, kind, message, privacyReviewed]
  );
  const cleanedMessage = message.trim();
  const needsReview = draft.requiresPrivacyReview || (includeDiagnostics && !privacyReviewed);
  const canSend = cleanedMessage.length >= 10 && (!needsReview || privacyReviewed);
  const mailHref = canSend
    ? buildMailto({
        subject: `${draft.title} - Orbit Ledger`,
        body: buildSupportEmailBody({
          draft,
          includeDiagnostics,
          diagnosticSummary,
        }),
      })
    : '#';

  async function approveSupportReviewPack() {
    if (!activeWorkspace?.workspaceId) {
      showToast('Select a workspace before approving support review.', 'info');
      return;
    }
    if (!privacyReviewed || !includeDiagnostics || !draft.diagnosticSummary) {
      showToast('Review and approve the diagnostic summary first.', 'info');
      return;
    }
    if (!draft.sanitizedMessage.trim()) {
      showToast('Add a short support message before approving review.', 'info');
      return;
    }

    setIsSavingConsent(true);
    try {
      const result = await createWebSupportDiagnosticConsent({
        workspaceId: activeWorkspace.workspaceId,
        supportKind: kind,
        supportCaseId,
        sanitizedMessage: draft.sanitizedMessage,
        diagnosticSummary: draft.diagnosticSummary,
        privateDataWarnings: draft.privateDataWarnings,
      });
      setSavedConsent({
        consentId: result.consentId,
        expiresAt: result.expiresAt,
      });
      showToast(result.message, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Support review approval could not be saved.', 'danger');
    } finally {
      setIsSavingConsent(false);
    }
  }

  async function revokeSupportReviewPack() {
    if (!activeWorkspace?.workspaceId || !savedConsent) {
      return;
    }

    setIsRevokingConsent(true);
    try {
      const result = await revokeWebSupportDiagnosticConsent({
        workspaceId: activeWorkspace.workspaceId,
        consentId: savedConsent.consentId,
        reason: 'User revoked support review approval from the Support page.',
      });
      showToast(result.message, 'success');
      setSavedConsent(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Support review approval could not be revoked.', 'danger');
    } finally {
      setIsRevokingConsent(false);
    }
  }

  return (
    <AppShell title="Support" subtitle="Get help, send feedback, and review what is shared before anything leaves Orbit Ledger.">
      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Founder-safe support</div>
            <p className="ol-panel-copy" style={{ maxWidth: 760 }}>
              Tell us what happened. Orbit Ledger removes private-looking details from the support
              preview and never attaches ledger data, invoices, payment proof, or backups automatically.
            </p>
          </div>
          <span className="ol-chip ol-chip--success">Review before sending</span>
        </div>
      </section>

      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Support request
          </div>
          <div className="ol-form-stack">
            <label className="ol-field">
              <span className="ol-field-label">What do you need help with?</span>
              <select
                className="ol-select"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as FounderSafeSupportKind);
                  setPrivacyReviewed(false);
                }}
              >
                {supportKinds.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="ol-field-helper">{supportKinds.find((option) => option.value === kind)?.helper}</span>
            </label>

            <label className="ol-field">
              <span className="ol-field-label">Message</span>
              <textarea
                className="ol-textarea"
                onChange={(event) => {
                  setMessage(event.target.value);
                  setPrivacyReviewed(false);
                }}
                placeholder="Tell us what you were trying to do, what happened, and what you expected."
                rows={8}
                value={message}
              />
              <span className="ol-field-helper">
                Avoid customer details, tax IDs, bank details, private keys, or backup contents unless
                support specifically asks for them.
              </span>
            </label>

            <label className="ol-field">
              <span className="ol-field-label">Support case</span>
              <input
                className="ol-input"
                onChange={(event) => setSupportCaseId(event.target.value)}
                placeholder="Optional case number if support gave you one"
                value={supportCaseId}
              />
              <span className="ol-field-helper">
                Leave this blank if you are starting a new request.
              </span>
            </label>

            <label className="ol-checkbox-row">
              <input
                checked={includeDiagnostics}
                onChange={(event) => {
                  setIncludeDiagnostics(event.target.checked);
                  setPrivacyReviewed(false);
                }}
                type="checkbox"
              />
              Include safe diagnostic summary
            </label>

            {needsReview ? (
              <label className="ol-checkbox-row">
                <input
                  checked={privacyReviewed}
                  onChange={(event) => setPrivacyReviewed(event.target.checked)}
                  type="checkbox"
                />
                I reviewed what will be shared
              </label>
            ) : null}

            <div className="ol-actions">
              <a
                aria-disabled={!canSend}
                className={canSend ? 'ol-button' : 'ol-button ol-button-disabled'}
                href={mailHref}
                onClick={(event) => {
                  if (!canSend) {
                    event.preventDefault();
                  }
                }}
              >
                Send request
              </a>
              <span className="ol-panel-copy" style={{ alignSelf: 'center' }}>
                Your email app opens with the reviewed request.
              </span>
            </div>
          </div>
        </article>

        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Review before sending
          </div>
          <div className="ol-form-stack">
            {cleanedMessage.length < 10 ? (
              <div className="ol-message ol-message--warning">Add a short message before sending.</div>
            ) : null}

            {draft.privateDataWarnings.length > 0 ? (
              <div className="ol-message ol-message--warning">
                Private-looking details detected: {draft.privateDataWarnings.join(', ')}. The preview
                below removes them.
              </div>
            ) : (
              <div className="ol-message ol-message--success">No private-looking details detected in the message.</div>
            )}

            <div className="ol-card-mini">
              <div className="ol-card-mini-label">Message preview</div>
              <p className="ol-panel-copy" style={{ whiteSpace: 'pre-wrap' }}>
                {draft.sanitizedMessage || 'Your reviewed message will appear here.'}
              </p>
            </div>

            {includeDiagnostics ? (
              <div className="ol-card-mini">
                <div className="ol-card-mini-label">Safe diagnostic summary</div>
                <div className="ol-list" style={{ marginTop: 10 }}>
                  {Object.entries(diagnosticSummary.safeFields).map(([label, value]) => (
                    <div className="ol-list-item" key={label}>
                      <div className="ol-list-icon" data-tone="neutral">
                        i
                      </div>
                      <div className="ol-list-copy">
                        <div className="ol-list-title">{formatDiagnosticLabel(label)}</div>
                        <div className="ol-list-text">{Array.isArray(value) ? value.join(', ') : String(value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="ol-panel-copy" style={{ marginTop: 10 }}>
                  {diagnosticSummary.privacyNote}
                </p>
              </div>
            ) : null}

            <div className="ol-card-mini">
              <div className="ol-card-mini-label">Support review approval</div>
              <p className="ol-panel-copy">
                Approve this only when you want Orbit Ledger support to review the safe diagnostic summary shown above.
                This does not share customer records, invoices, payment proof, backups, or private keys.
              </p>
              {savedConsent ? (
                <div className="ol-message ol-message--success" style={{ marginTop: 12 }}>
                  Support review approval saved. It expires on {formatConsentDate(savedConsent.expiresAt)}.
                </div>
              ) : null}
              <div className="ol-actions" style={{ marginTop: 12 }}>
                <button
                  className="ol-button-secondary"
                  disabled={isSavingConsent || isRevokingConsent || !privacyReviewed || !includeDiagnostics || !draft.diagnosticSummary}
                  onClick={() => void approveSupportReviewPack()}
                  type="button"
                >
                  {isSavingConsent ? 'Saving approval' : 'Approve support review'}
                </button>
                {savedConsent ? (
                  <button
                    className="ol-button-ghost"
                    disabled={isRevokingConsent || isSavingConsent}
                    onClick={() => void revokeSupportReviewPack()}
                    type="button"
                  >
                    {isRevokingConsent ? 'Revoking' : 'Revoke approval'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="ol-page-grid ol-page-grid--3">
        {FOUNDER_SAFE_SUPPORT_SURFACES.slice(0, 3).map((surface) => (
          <article className="ol-panel-glass" key={surface.area}>
            <div className="ol-panel-title" style={{ marginBottom: 8 }}>
              {surface.label}
            </div>
            <p className="ol-panel-copy">{surface.userPromise}</p>
          </article>
        ))}
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Your support cases</div>
            <p className="ol-panel-copy">
              Track current case status and use the case number when sending a follow-up.
            </p>
          </div>
          <span className="ol-chip ol-chip--primary">
            {isLoadingSupportCases ? 'Checking' : `${supportCases.length} cases`}
          </span>
        </div>
        {supportCases.length ? (
          <div className="ol-list">
            {supportCases.map((supportCase) => (
              <article className="ol-list-item" key={supportCase.id}>
                <div className="ol-list-icon" data-tone={supportCase.status === 'resolved' ? 'success' : 'neutral'}>
                  C
                </div>
                <div className="ol-list-copy">
                  <div className="ol-market-card-header">
                    <div>
                      <div className="ol-list-title">{supportCase.supportCaseId}</div>
                      <div className="ol-list-text">Updated {formatConsentDate(supportCase.updatedAt)}</div>
                    </div>
                    <span className={`ol-chip ${supportCase.status === 'resolved' ? 'ol-chip--success' : 'ol-chip--primary'}`}>
                      {supportCase.label}
                    </span>
                  </div>
                  <p className="ol-panel-copy" style={{ marginTop: 8 }}>
                    {supportCase.followUp}
                  </p>
                  <div className="ol-inline-actions" style={{ marginTop: 10 }}>
                    <button
                      className="ol-button-secondary"
                      type="button"
                      onClick={() => setSupportCaseId(supportCase.supportCaseId)}
                    >
                      Use in new request
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="ol-message ol-message--success">
            {isLoadingSupportCases ? 'Checking support cases.' : 'No support cases are linked to this workspace yet.'}
          </div>
        )}
      </section>

      <section className="ol-panel">
        <div className="ol-panel-title" style={{ marginBottom: 12 }}>
          Privacy rules
        </div>
        <div className="ol-list">
          {FOUNDER_SAFE_SUPPORT_GUARDRAILS.slice(0, 5).map((rule, index) => (
            <div className="ol-list-item" key={rule}>
              <div className="ol-list-icon" data-tone={index < 2 ? 'success' : 'neutral'}>
                {index + 1}
              </div>
              <div className="ol-list-copy">
                <div className="ol-list-title">{rule}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function buildSupportEmailBody(input: {
  draft: ReturnType<typeof buildFounderSafeSupportDraft>;
  diagnosticSummary: ReturnType<typeof buildFounderSafeDiagnosticSummary>;
  includeDiagnostics: boolean;
}) {
  const lines = [
    'Hello Orbit Ledger team,',
    '',
    input.draft.summary,
    '',
    'Message:',
    input.draft.sanitizedMessage,
  ];

  if (input.includeDiagnostics) {
    lines.push('', 'Safe diagnostic summary:');
    for (const [label, value] of Object.entries(input.diagnosticSummary.safeFields)) {
      lines.push(`- ${formatDiagnosticLabel(label)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
    }
    lines.push('', input.diagnosticSummary.privacyNote);
  }

  lines.push('', 'No customer records, invoices, payment proof, backups, or private keys are attached automatically.');
  return lines.join('\n');
}

function formatDiagnosticLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

function formatConsentDate(value: string | null) {
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

function buildMailto(input: { subject: string; body: string }) {
  return `mailto:${supportEmail}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.body)}`;
}
