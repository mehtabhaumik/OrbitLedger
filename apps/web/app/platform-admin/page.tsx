'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getPlatformAdminRoleDefinition, PLATFORM_ADMIN_ROLES, type PlatformAdminRole } from '@orbit-ledger/core';

import {
  filterWebPlatformAdminAuditRecords,
  filterWebPlatformAdminUsers,
  formatPlatformAdminDate,
  loadWebPlatformAdminAuditTrail,
  loadWebPlatformAdminSnapshot,
  manageWebPlatformAdminAccount,
  manageWebPlatformAdminUser,
  type WebPlatformAdminAccountAction,
  type WebPlatformAdminAuditFilters,
  type WebPlatformAdminAuditRecord,
  type WebPlatformAdminRegistryRecord,
  type WebPlatformAdminSnapshot,
  type WebPlatformAdminUser,
  type WebPlatformAdminUserAction,
} from '@/lib/platform-admin';
import { useAuth } from '@/providers/auth-provider';

type AdminFormState = {
  action: WebPlatformAdminAccountAction;
  targetEmail: string;
  targetUid: string;
  displayName: string;
  role: PlatformAdminRole;
  reason: string;
};

type UserControlFormState = {
  action: WebPlatformAdminUserAction;
  targetEmail: string;
  targetUid: string;
  displayName: string;
  reason: string;
  message: string;
  riskLabel: string;
};

const DEFAULT_ADMIN_FORM: AdminFormState = {
  action: 'create',
  targetEmail: '',
  targetUid: '',
  displayName: '',
  role: 'read_only_admin',
  reason: '',
};

const DEFAULT_USER_CONTROL_FORM: UserControlFormState = {
  action: 'send_warning',
  targetEmail: '',
  targetUid: '',
  displayName: '',
  reason: '',
  message: '',
  riskLabel: '',
};

const DEFAULT_AUDIT_FILTERS: WebPlatformAdminAuditFilters = {
  action: '',
  actor: '',
  target: '',
  severity: '',
  fromDate: '',
  toDate: '',
};

export default function PlatformAdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<WebPlatformAdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [adminActionMessage, setAdminActionMessage] = useState<string | null>(null);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminFormState>(DEFAULT_ADMIN_FORM);
  const [userControlMessage, setUserControlMessage] = useState<string | null>(null);
  const [userControlError, setUserControlError] = useState<string | null>(null);
  const [isSavingUserControl, setIsSavingUserControl] = useState(false);
  const [userControlForm, setUserControlForm] = useState<UserControlFormState>(DEFAULT_USER_CONTROL_FORM);
  const [selectedUser, setSelectedUser] = useState<WebPlatformAdminUser | null>(null);
  const [auditTrail, setAuditTrail] = useState<WebPlatformAdminAuditRecord[]>([]);
  const [auditGeneratedAt, setAuditGeneratedAt] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditFilters, setAuditFilters] = useState<WebPlatformAdminAuditFilters>(DEFAULT_AUDIT_FILTERS);
  const [auditSearch, setAuditSearch] = useState('');
  const users = useMemo(() => filterWebPlatformAdminUsers(snapshot?.users ?? [], search), [search, snapshot?.users]);
  const visibleAuditRecords = useMemo(
    () => filterWebPlatformAdminAuditRecords(auditTrail, auditSearch),
    [auditSearch, auditTrail]
  );
  const admins = snapshot?.admins ?? [];
  const isSuperAdmin = snapshot?.adminAccess?.role === 'super_admin';
  const canControlUsers =
    snapshot?.adminAccess?.role === 'super_admin' ||
    snapshot?.adminAccess?.role === 'admin' ||
    snapshot?.adminAccess?.role === 'support_admin';
  const canSuspendUsers = snapshot?.adminAccess?.role === 'super_admin' || snapshot?.adminAccess?.role === 'admin';
  const userControlNeedsMessage =
    userControlForm.action === 'send_warning' || userControlForm.action === 'add_internal_note';
  const userControlSubmitDisabled =
    isSavingUserControl ||
    !userControlForm.targetUid.trim() ||
    userControlForm.reason.trim().length < 10 ||
    (userControlNeedsMessage && userControlForm.message.trim().length < 10);

  useEffect(() => {
    if (isAuthLoading || !user) {
      return;
    }
    void refresh(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user?.uid]);

  async function refresh(nextPageToken: string | null) {
    setIsLoading(true);
    setError(null);
    try {
      const nextSnapshot = await loadWebPlatformAdminSnapshot({ pageToken: nextPageToken });
      setSnapshot(nextSnapshot);
      setPageToken(nextPageToken);
      void refreshAudit(auditFilters);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Platform admin registry could not be loaded.');
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshAudit(filters: WebPlatformAdminAuditFilters) {
    setIsLoadingAudit(true);
    setAuditError(null);
    try {
      const trail = await loadWebPlatformAdminAuditTrail({ ...filters, limit: 100 });
      setAuditTrail(trail.records);
      setAuditGeneratedAt(trail.generatedAt);
    } catch (loadError) {
      setAuditError(loadError instanceof Error ? loadError.message : 'Platform admin audit trail could not be loaded.');
      setAuditTrail([]);
      setAuditGeneratedAt(null);
    } finally {
      setIsLoadingAudit(false);
    }
  }

  function handleRefresh() {
    void refresh(pageToken);
  }

  function handlePreviousPage() {
    void refresh(null);
  }

  async function handleNextPage() {
    if (!snapshot?.nextPageToken) {
      return;
    }
    await refresh(snapshot.nextPageToken);
  }

  function openCreateAdminForm() {
    setAdminActionError(null);
    setAdminActionMessage(null);
    setAdminForm(DEFAULT_ADMIN_FORM);
  }

  function openManageAdminForm(admin: WebPlatformAdminRegistryRecord, action: WebPlatformAdminAccountAction = 'change_role') {
    setAdminActionError(null);
    setAdminActionMessage(null);
    setAdminForm({
      action,
      targetEmail: admin.email ?? '',
      targetUid: admin.uid,
      displayName: admin.displayName ?? '',
      role: admin.role,
      reason: '',
    });
  }

  async function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminActionError(null);
    setAdminActionMessage(null);
    setIsSavingAdmin(true);
    try {
      await manageWebPlatformAdminAccount({
        action: adminForm.action,
        targetEmail: adminForm.targetEmail,
        targetUid: adminForm.targetUid,
        displayName: adminForm.displayName,
        role: adminForm.role,
        reason: adminForm.reason,
      });
      setAdminActionMessage('Platform admin access was updated and recorded for audit.');
      await refresh(pageToken);
      await refreshAudit(auditFilters);
      if (adminForm.action === 'create') {
        setAdminForm(DEFAULT_ADMIN_FORM);
      } else {
        setAdminForm((current) => ({ ...current, reason: '' }));
      }
    } catch (submitError) {
      setAdminActionError(submitError instanceof Error ? submitError.message : 'Platform admin access could not be updated.');
    } finally {
      setIsSavingAdmin(false);
    }
  }

  function openManageUserForm(userRecord: WebPlatformAdminUser, action: WebPlatformAdminUserAction = 'send_warning') {
    setUserControlError(null);
    setUserControlMessage(null);
    setSelectedUser(userRecord);
    setUserControlForm({
      action,
      targetEmail: userRecord.email ?? '',
      targetUid: userRecord.uid,
      displayName: userRecord.displayName ?? userRecord.email ?? userRecord.uid,
      reason: '',
      message: '',
      riskLabel: '',
    });
  }

  async function handleUserControlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserControlError(null);
    setUserControlMessage(null);
    setIsSavingUserControl(true);
    try {
      await manageWebPlatformAdminUser({
        action: userControlForm.action,
        targetEmail: userControlForm.targetEmail,
        targetUid: userControlForm.targetUid,
        reason: userControlForm.reason,
        message: userControlForm.message,
        riskLabel: userControlForm.riskLabel,
      });
      setUserControlMessage('User control action was completed and recorded for audit.');
      await refresh(pageToken);
      await refreshAudit(auditFilters);
      setUserControlForm((current) => ({ ...current, reason: '', message: '', riskLabel: '' }));
    } catch (submitError) {
      setUserControlError(submitError instanceof Error ? submitError.message : 'Platform user control action failed.');
    } finally {
      setIsSavingUserControl(false);
    }
  }

  function applyAuditFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void refreshAudit(auditFilters);
  }

  function resetAuditFilters() {
    setAuditFilters(DEFAULT_AUDIT_FILTERS);
    setAuditSearch('');
    void refreshAudit(DEFAULT_AUDIT_FILTERS);
  }

  function downloadAuditCsv() {
    const csv = buildAuditCsv(visibleAuditRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orbit-ledger-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function printAuditReport() {
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
      setAuditError('Browser blocked the print report. Allow pop-ups for Orbit Ledger and try again.');
      return;
    }
    popup.document.write(buildAuditPrintHtml(visibleAuditRecords, user?.email ?? 'Platform admin', auditGeneratedAt));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  if (isAuthLoading) {
    return (
      <main className="ol-platform-admin-page">
        <section className="ol-platform-admin-shell">
          <div className="ol-loading-orbit" aria-label="Loading platform admin">
            <span>O</span>
          </div>
          <p className="ol-muted">Checking internal admin access.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="ol-platform-admin-page">
        <section className="ol-platform-admin-shell">
          <div className="ol-platform-admin-empty">
            <p className="ol-chip">Internal admin</p>
            <h1>Sign in required</h1>
            <p>Use an approved Orbit Ledger admin account to open the internal user registry.</p>
            <Link className="ol-button" href="/login">
              Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (error === 'This account is not enabled for internal platform administration.') {
    return (
      <main className="ol-platform-admin-page">
        <section className="ol-platform-admin-shell">
          <div className="ol-platform-admin-empty">
            <p className="ol-chip" data-tone="warning">
              Restricted
            </p>
            <h1>Internal access only</h1>
            <p>This signed-in account is not enabled for Orbit Ledger platform administration.</p>
            <div className="ol-actions">
              <Link className="ol-button-secondary" href="/dashboard">
                Open dashboard
              </Link>
              <Link className="ol-button-ghost" href="/">
                Back to website
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ol-platform-admin-page">
      <section className="ol-platform-admin-shell">
        <header className="ol-platform-admin-hero">
          <div>
            <p className="ol-chip">Internal platform admin</p>
            <h1>Registered user registry</h1>
            <p>
              Firebase Auth users, workspace ownership, and Office membership visibility for approved Orbit Ledger
              administrators.
            </p>
          </div>
          <div className="ol-platform-admin-hero-actions">
            <Link className="ol-button-secondary" href="/dashboard">
              Open dashboard
            </Link>
            <button className="ol-button" type="button" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh registry'}
            </button>
          </div>
        </header>

        {error ? (
          <div className="ol-message" data-tone="danger">
            {error}
          </div>
        ) : null}

        <section className="ol-platform-admin-metrics" aria-label="Platform user metrics">
          <MetricCard label="Registered users" value={snapshot?.metrics.userCount ?? 0} />
          <MetricCard label="Verified emails" value={snapshot?.metrics.verifiedEmailCount ?? 0} />
          <MetricCard label="Workspace owners" value={snapshot?.metrics.workspaceOwnerCount ?? 0} />
          <MetricCard label="Platform admins" value={snapshot?.metrics.activePlatformAdminCount ?? 0} tone="premium" />
          <MetricCard label="No workspace" value={snapshot?.metrics.usersWithoutWorkspaceCount ?? 0} tone="warning" />
          <MetricCard label="Disabled users" value={snapshot?.metrics.disabledCount ?? 0} tone="danger" />
        </section>

        <section className="ol-panel ol-platform-admin-control-panel">
          <div className="ol-platform-admin-status">
            <div>
              <span className="ol-muted">Role</span>
              <strong>
                {snapshot?.adminAccess
                  ? `${getPlatformAdminRoleDefinition(snapshot.adminAccess.role).label} · ${snapshot.adminAccess.roleSource}`
                  : 'Emergency allowlist'}
              </strong>
            </div>
            <div>
              <span className="ol-muted">Claims readiness</span>
              <strong>{snapshot?.adminAccess?.customClaimsReady ? 'Custom claims active' : 'Allowlist fallback'}</strong>
            </div>
            <div>
              <span className="ol-muted">Admin account</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span className="ol-muted">Generated</span>
              <strong>{formatPlatformAdminDate(snapshot?.generatedAt)}</strong>
            </div>
            <div>
              <span className="ol-muted">Page state</span>
              <strong>{snapshot?.hasMore ? 'More users available' : 'Current page loaded'}</strong>
            </div>
          </div>
          <div className="ol-platform-admin-search">
            <label className="ol-field-label" htmlFor="platform-admin-search">
              Search users
            </label>
            <input
              id="platform-admin-search"
              className="ol-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email, name, uid, workspace, or role"
            />
          </div>
          <p className="ol-panel-copy">
            This registry never shows passwords, provider secrets, payment secrets, or customer ledger data.
          </p>
        </section>

        <section className="ol-platform-admin-table-card">
          <div className="ol-platform-admin-table-head">
            <div>
              <strong>Admin accounts</strong>
              <span>{admins.length} registered</span>
            </div>
            {isSuperAdmin ? (
              <button className="ol-button-secondary" type="button" onClick={openCreateAdminForm}>
                Add admin
              </button>
            ) : (
              <span className="ol-platform-admin-status-pill" data-tone="warning">
                Super Admin only
              </span>
            )}
          </div>
          <div className="ol-platform-admin-management">
            <div className="ol-platform-admin-admin-list">
              {admins.length ? (
                admins.map((admin) => (
                  <AdminAccountRow
                    key={admin.uid}
                    admin={admin}
                    canManage={isSuperAdmin}
                    onManage={openManageAdminForm}
                  />
                ))
              ) : (
                <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
                  <h2>No admin registry records</h2>
                  <p>Open this page from an emergency Super Admin account to sync the first registry record.</p>
                </div>
              )}
            </div>

            {isSuperAdmin ? (
              <form className="ol-platform-admin-admin-form" onSubmit={handleAdminSubmit}>
                <div>
                  <p className="ol-chip">Super Admin action</p>
                  <h2>{adminForm.action === 'create' ? 'Add platform admin' : 'Manage admin access'}</h2>
                  <p>
                    Every role or status change requires a reason and writes an audit record. Emergency allowlist accounts
                    remain protected as break-glass access.
                  </p>
                </div>

                {adminActionMessage ? (
                  <div className="ol-message" data-tone="success">
                    {adminActionMessage}
                  </div>
                ) : null}
                {adminActionError ? (
                  <div className="ol-message" data-tone="danger">
                    {adminActionError}
                  </div>
                ) : null}

                <div className="ol-platform-admin-form-grid">
                  <label className="ol-form-field">
                    <span>Action</span>
                    <select
                      className="ol-select"
                      value={adminForm.action}
                      onChange={(event) =>
                        setAdminForm((current) => ({
                          ...current,
                          action: event.target.value as WebPlatformAdminAccountAction,
                        }))
                      }
                    >
                      <option value="create">Add admin</option>
                      <option value="change_role">Change role</option>
                      <option value="suspend">Suspend</option>
                      <option value="reactivate">Reactivate</option>
                      <option value="revoke">Revoke</option>
                    </select>
                  </label>
                  <label className="ol-form-field">
                    <span>Email</span>
                    <input
                      className="ol-input"
                      value={adminForm.targetEmail}
                      onChange={(event) => setAdminForm((current) => ({ ...current, targetEmail: event.target.value }))}
                      placeholder="admin@example.com"
                      type="email"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Firebase UID</span>
                    <input
                      className="ol-input"
                      value={adminForm.targetUid}
                      onChange={(event) => setAdminForm((current) => ({ ...current, targetUid: event.target.value }))}
                      placeholder="Optional for existing admin"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Display name</span>
                    <input
                      className="ol-input"
                      value={adminForm.displayName}
                      onChange={(event) => setAdminForm((current) => ({ ...current, displayName: event.target.value }))}
                      placeholder="Full name"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Role</span>
                    <select
                      className="ol-select"
                      value={adminForm.role}
                      onChange={(event) =>
                        setAdminForm((current) => ({ ...current, role: event.target.value as PlatformAdminRole }))
                      }
                      disabled={adminForm.action === 'suspend' || adminForm.action === 'revoke'}
                    >
                      {PLATFORM_ADMIN_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {getPlatformAdminRoleDefinition(role).label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {adminForm.role === 'super_admin' || adminForm.action === 'revoke' ? (
                  <div className="ol-message" data-tone="warning">
                    This is a high-impact admin change. Confirm the target account and reason before saving.
                  </div>
                ) : null}

                <label className="ol-form-field">
                  <span>Reason</span>
                  <textarea
                    className="ol-input ol-textarea"
                    value={adminForm.reason}
                    onChange={(event) => setAdminForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Example: Granting support access for beta operations review."
                    rows={4}
                  />
                </label>

                <button
                  className="ol-button"
                  type="submit"
                  disabled={isSavingAdmin || adminForm.reason.trim().length < 10}
                >
                  {isSavingAdmin ? 'Saving admin change...' : 'Save admin change'}
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="ol-platform-admin-table-card ol-platform-admin-audit-card">
          <div className="ol-platform-admin-table-head">
            <div>
              <strong>Admin audit trail</strong>
              <span>
                {visibleAuditRecords.length} shown · Generated {formatPlatformAdminDate(auditGeneratedAt)}
              </span>
            </div>
            <div className="ol-platform-admin-row-actions">
              <button
                className="ol-button-secondary"
                type="button"
                onClick={downloadAuditCsv}
                disabled={!visibleAuditRecords.length}
              >
                Download CSV
              </button>
              <button
                className="ol-button-secondary"
                type="button"
                onClick={printAuditReport}
                disabled={!visibleAuditRecords.length}
              >
                Print audit
              </button>
            </div>
          </div>

          <form className="ol-platform-admin-audit-filters" onSubmit={applyAuditFilters}>
            <label className="ol-form-field">
              <span>Action</span>
              <input
                className="ol-input"
                value={auditFilters.action}
                onChange={(event) => setAuditFilters((current) => ({ ...current, action: event.target.value }))}
                placeholder="role, warning, pricing"
              />
            </label>
            <label className="ol-form-field">
              <span>Actor</span>
              <input
                className="ol-input"
                value={auditFilters.actor}
                onChange={(event) => setAuditFilters((current) => ({ ...current, actor: event.target.value }))}
                placeholder="Admin email or UID"
              />
            </label>
            <label className="ol-form-field">
              <span>Target</span>
              <input
                className="ol-input"
                value={auditFilters.target}
                onChange={(event) => setAuditFilters((current) => ({ ...current, target: event.target.value }))}
                placeholder="User, workspace, case"
              />
            </label>
            <label className="ol-form-field">
              <span>Severity</span>
              <select
                className="ol-select"
                value={auditFilters.severity}
                onChange={(event) => setAuditFilters((current) => ({ ...current, severity: event.target.value }))}
              >
                <option value="">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="ol-form-field">
              <span>From</span>
              <input
                className="ol-input"
                type="date"
                value={auditFilters.fromDate}
                onChange={(event) => setAuditFilters((current) => ({ ...current, fromDate: event.target.value }))}
              />
            </label>
            <label className="ol-form-field">
              <span>To</span>
              <input
                className="ol-input"
                type="date"
                value={auditFilters.toDate}
                onChange={(event) => setAuditFilters((current) => ({ ...current, toDate: event.target.value }))}
              />
            </label>
            <label className="ol-form-field ol-platform-admin-audit-search">
              <span>Search loaded audit</span>
              <input
                className="ol-input"
                value={auditSearch}
                onChange={(event) => setAuditSearch(event.target.value)}
                placeholder="Reason, action, target, actor"
              />
            </label>
            <div className="ol-platform-admin-audit-filter-actions">
              <button className="ol-button" type="submit" disabled={isLoadingAudit}>
                {isLoadingAudit ? 'Loading audit...' : 'Apply filters'}
              </button>
              <button className="ol-button-secondary" type="button" onClick={resetAuditFilters} disabled={isLoadingAudit}>
                Reset
              </button>
            </div>
          </form>

          {auditError ? (
            <div className="ol-message ol-platform-admin-audit-message" data-tone="danger">
              {auditError}
            </div>
          ) : null}

          {isLoadingAudit && !auditTrail.length ? (
            <div className="ol-platform-admin-empty">
              <div className="ol-loading-orbit" aria-label="Loading audit trail">
                <span>O</span>
              </div>
              <p>Loading audit trail.</p>
            </div>
          ) : visibleAuditRecords.length ? (
            <div className="ol-platform-admin-audit-list">
              {visibleAuditRecords.map((record) => (
                <AuditRecordRow key={record.id} record={record} />
              ))}
            </div>
          ) : (
            <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
              <h2>No audit records found</h2>
              <p>Adjust the filters or refresh the audit trail.</p>
            </div>
          )}
        </section>

        {canControlUsers ? (
          <section className="ol-platform-admin-table-card">
            <div className="ol-platform-admin-table-head">
              <div>
                <strong>User control actions</strong>
                <span>Warnings, notes, risk review, and account status changes</span>
              </div>
              <span className="ol-platform-admin-status-pill" data-tone="warning">
                Reason required
              </span>
            </div>
            <div className="ol-platform-admin-user-control">
              <div className="ol-platform-admin-selected-user">
                {selectedUser ? (
                  <>
                    <div className="ol-platform-admin-user-main">
                      <span className="ol-platform-admin-avatar">{initials(userControlForm.displayName)}</span>
                      <div>
                        <strong>{userControlForm.displayName}</strong>
                        <span>{userControlForm.targetEmail || 'No email saved'}</span>
                        <code>{userControlForm.targetUid}</code>
                      </div>
                    </div>
                    <div className="ol-platform-admin-selected-summary">
                      <span>{selectedUser.ownedWorkspaceCount} owned workspace(s)</span>
                      <span>{selectedUser.workspaceNames.length ? selectedUser.workspaceNames.join(', ') : 'No workspace names'}</span>
                      <span>{selectedUser.officeWorkspaceCount} Office workspace(s)</span>
                      <span>
                        {selectedUser.platformUserWarningCount
                          ? `${selectedUser.platformUserWarningCount} warning(s)`
                          : 'No warnings recorded'}
                      </span>
                      <span>{selectedUser.platformUserRiskStatus ?? 'No active risk flag'}</span>
                      {selectedUser.platformUserLastAdminReason ? (
                        <span>Last reason: {selectedUser.platformUserLastAdminReason}</span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
                    <h2>Select a user</h2>
                    <p>
                      Use the action buttons in the user registry. Workspace summaries are shown here without exposing
                      customer ledger records.
                    </p>
                  </div>
                )}
              </div>

              <form className="ol-platform-admin-admin-form" onSubmit={handleUserControlSubmit}>
                <div>
                  <p className="ol-chip">Server authorized</p>
                  <h2>Manage selected user</h2>
                  <p>
                    User lifecycle actions require an audit reason. Support admins can warn, note, and flag review;
                    suspend and restore stay with Super Admin/Admin.
                  </p>
                </div>

                {userControlMessage ? (
                  <div className="ol-message" data-tone="success">
                    {userControlMessage}
                  </div>
                ) : null}
                {userControlError ? (
                  <div className="ol-message" data-tone="danger">
                    {userControlError}
                  </div>
                ) : null}

                <div className="ol-platform-admin-form-grid">
                  <label className="ol-form-field">
                    <span>Action</span>
                    <select
                      className="ol-select"
                      value={userControlForm.action}
                      onChange={(event) =>
                        setUserControlForm((current) => ({
                          ...current,
                          action: event.target.value as WebPlatformAdminUserAction,
                        }))
                      }
                    >
                      {canSuspendUsers ? <option value="suspend_user">Suspend user</option> : null}
                      {canSuspendUsers ? <option value="restore_user">Restore user</option> : null}
                      <option value="send_warning">Send warning</option>
                      <option value="add_internal_note">Add internal note</option>
                      <option value="mark_under_review">Mark under review</option>
                      <option value="clear_under_review">Clear review flag</option>
                    </select>
                  </label>
                  <label className="ol-form-field">
                    <span>Risk label</span>
                    <input
                      className="ol-input"
                      value={userControlForm.riskLabel}
                      onChange={(event) => setUserControlForm((current) => ({ ...current, riskLabel: event.target.value }))}
                      placeholder="Billing risk, misuse review, support follow-up"
                    />
                  </label>
                </div>

                {userControlNeedsMessage ? (
                  <label className="ol-form-field">
                    <span>{userControlForm.action === 'send_warning' ? 'Warning message' : 'Internal note'}</span>
                    <textarea
                      className="ol-input ol-textarea"
                      value={userControlForm.message}
                      onChange={(event) => setUserControlForm((current) => ({ ...current, message: event.target.value }))}
                      placeholder={
                        userControlForm.action === 'send_warning'
                          ? 'Example: Please update your billing contact details before the next review.'
                          : 'Example: Customer reported onboarding confusion. Follow up after next login.'
                      }
                      rows={4}
                    />
                  </label>
                ) : null}

                <label className="ol-form-field">
                  <span>Reason</span>
                  <textarea
                    className="ol-input ol-textarea"
                    value={userControlForm.reason}
                    onChange={(event) => setUserControlForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Example: User requested account suspension during support verification."
                    rows={4}
                  />
                </label>

                <button className="ol-button" type="submit" disabled={userControlSubmitDisabled}>
                  {isSavingUserControl ? 'Saving user action...' : 'Save user action'}
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <section className="ol-platform-admin-table-card">
          <div className="ol-platform-admin-table-head">
            <strong>Users</strong>
            <span>{users.length} shown</span>
          </div>
          {isLoading && !snapshot ? (
            <div className="ol-platform-admin-empty">
              <div className="ol-loading-orbit" aria-label="Loading users">
                <span>O</span>
              </div>
              <p>Loading registry.</p>
            </div>
          ) : users.length ? (
            <div className="ol-platform-admin-user-list">
              {users.map((item) => (
                <UserRow
                  key={item.uid}
                  user={item}
                  canControl={canControlUsers}
                  canSuspend={canSuspendUsers}
                  onManage={openManageUserForm}
                />
              ))}
            </div>
          ) : (
            <div className="ol-platform-admin-empty">
              <h2>No users found</h2>
              <p>Adjust the search term or refresh the registry.</p>
            </div>
          )}
          <div className="ol-platform-admin-pagination">
            <button className="ol-button-secondary" type="button" onClick={handlePreviousPage} disabled={isLoading || !pageToken}>
              First page
            </button>
            <button className="ol-button-secondary" type="button" onClick={handleNextPage} disabled={isLoading || !snapshot?.hasMore}>
              Next page
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger' | 'premium';
}) {
  return (
    <article className="ol-platform-admin-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value.toLocaleString('en-IN')}</strong>
    </article>
  );
}

function AdminAccountRow({
  admin,
  canManage,
  onManage,
}: {
  admin: WebPlatformAdminRegistryRecord;
  canManage: boolean;
  onManage: (admin: WebPlatformAdminRegistryRecord, action?: WebPlatformAdminAccountAction) => void;
}) {
  const title = admin.displayName || admin.email || admin.uid;
  const role = getPlatformAdminRoleDefinition(admin.role);
  const statusTone = admin.status === 'active' ? 'success' : admin.status === 'suspended' ? 'warning' : 'danger';

  return (
    <article className="ol-platform-admin-admin-row">
      <div className="ol-platform-admin-user-main">
        <span className="ol-platform-admin-avatar">{initials(title)}</span>
        <div>
          <strong>{title}</strong>
          <span>{admin.email ?? 'No email saved'}</span>
          <code>{admin.uid}</code>
        </div>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span className="ol-platform-admin-status-pill" data-tone={statusTone}>
          {admin.status}
        </span>
        <span>
          {role.label} · {admin.roleSource}
        </span>
        {admin.isEmergencyAllowlist ? <span>Emergency allowlist protected</span> : null}
      </div>
      <div className="ol-platform-admin-user-meta">
        <span>Last active {formatPlatformAdminDate(admin.lastSignInAt)}</span>
        <span>Created {formatPlatformAdminDate(admin.createdAt)}</span>
        <span>Updated {formatPlatformAdminDate(admin.updatedAt)}</span>
        <span>By {admin.updatedByEmail ?? admin.createdByEmail ?? 'Unknown admin'}</span>
      </div>
      {canManage ? (
        <div className="ol-platform-admin-row-actions">
          <button className="ol-button-secondary" type="button" onClick={() => onManage(admin, 'change_role')}>
            Manage
          </button>
          {admin.status === 'active' ? (
            <button className="ol-button-ghost" type="button" onClick={() => onManage(admin, 'suspend')}>
              Suspend
            </button>
          ) : (
            <button className="ol-button-ghost" type="button" onClick={() => onManage(admin, 'reactivate')}>
              Reactivate
            </button>
          )}
          <button className="ol-button-ghost" type="button" onClick={() => onManage(admin, 'revoke')}>
            Revoke
          </button>
        </div>
      ) : null}
    </article>
  );
}

function AuditRecordRow({ record }: { record: WebPlatformAdminAuditRecord }) {
  const severityTone = record.severity === 'high' ? 'danger' : record.severity === 'medium' ? 'warning' : 'success';

  return (
    <article className="ol-platform-admin-audit-row">
      <div className="ol-platform-admin-user-meta">
        <span className="ol-platform-admin-status-pill" data-tone={severityTone}>
          {record.severity}
        </span>
        <strong>{humanizeAuditAction(record.action)}</strong>
        <span>{formatPlatformAdminDate(record.timestamp)}</span>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span>Actor</span>
        <strong>{record.actorEmail ?? record.actorUid ?? 'System'}</strong>
        <span>{record.actorRole ?? 'No role recorded'}</span>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span>Affected record</span>
        <strong>{record.affectedSummary}</strong>
        <span>{record.targetEmail ?? record.targetUid ?? record.workspaceId ?? record.supportCaseId ?? record.id}</span>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span>Reason</span>
        <strong>{record.reason ?? 'No reason recorded'}</strong>
        <code>{record.id}</code>
      </div>
    </article>
  );
}

function UserRow({
  user,
  canControl,
  canSuspend,
  onManage,
}: {
  user: WebPlatformAdminUser;
  canControl: boolean;
  canSuspend: boolean;
  onManage: (user: WebPlatformAdminUser, action?: WebPlatformAdminUserAction) => void;
}) {
  const title = user.displayName || user.email || user.uid;
  const workspaceSummary = user.workspaceNames.length
    ? user.workspaceNames.join(', ')
    : user.ownedWorkspaceCount > 0
      ? `${user.ownedWorkspaceCount} workspace${user.ownedWorkspaceCount === 1 ? '' : 's'}`
      : 'No owned workspace';
  const officeSummary = user.officeWorkspaceCount
    ? `${user.officeWorkspaceCount} Office workspace${user.officeWorkspaceCount === 1 ? '' : 's'}${
        user.officeRoles.length ? ` · ${user.officeRoles.join(', ')}` : ''
      }`
    : 'No Office membership';

  return (
    <article className="ol-platform-admin-user-row">
      <div className="ol-platform-admin-user-main">
        <span className="ol-platform-admin-avatar">{initials(title)}</span>
        <div>
          <strong>{title}</strong>
          <span>{user.email ?? 'No email saved'}</span>
          <code>{user.uid}</code>
        </div>
      </div>
      <div className="ol-platform-admin-user-meta">
        <StatusPill user={user} />
        {user.platformUserRiskStatus === 'under_review' ? (
          <span className="ol-platform-admin-status-pill" data-tone="warning">
            Under review
          </span>
        ) : null}
        {user.platformUserWarningCount ? (
          <span className="ol-platform-admin-status-pill" data-tone="warning">
            {user.platformUserWarningCount} warning{user.platformUserWarningCount === 1 ? '' : 's'}
          </span>
        ) : null}
        {user.platformAdminRole ? (
          <span>
            {getPlatformAdminRoleDefinition(user.platformAdminRole).label} · {user.platformAdminRoleSource ?? 'registry'}
          </span>
        ) : null}
        <span>{user.providerIds.length ? user.providerIds.join(', ') : 'No provider'}</span>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span>Created {formatPlatformAdminDate(user.createdAt)}</span>
        <span>Last sign-in {formatPlatformAdminDate(user.lastSignInAt)}</span>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span>{workspaceSummary}</span>
        <span>{officeSummary}</span>
        {user.platformUserLastAdminReason ? <span>Last action: {user.platformUserLastAdminReason}</span> : null}
      </div>
      {canControl ? (
        <div className="ol-platform-admin-row-actions">
          <button className="ol-button-secondary" type="button" onClick={() => onManage(user, 'send_warning')}>
            Manage
          </button>
          <button className="ol-button-ghost" type="button" onClick={() => onManage(user, 'add_internal_note')}>
            Note
          </button>
          {canSuspend ? (
            user.disabled ? (
              <button className="ol-button-ghost" type="button" onClick={() => onManage(user, 'restore_user')}>
                Restore
              </button>
            ) : (
              <button className="ol-button-ghost" type="button" onClick={() => onManage(user, 'suspend_user')}>
                Suspend
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function StatusPill({ user }: { user: WebPlatformAdminUser }) {
  const tone = user.disabled ? 'danger' : user.status === 'no_workspace' ? 'warning' : 'success';
  const label = user.disabled ? 'Disabled' : user.status === 'no_workspace' ? 'No workspace' : 'Active';
  return (
    <span className="ol-platform-admin-status-pill" data-tone={tone}>
      {label}
    </span>
  );
}

function initials(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function humanizeAuditAction(value: string) {
  return value
    .replace(/^platform_admin_/, 'admin_')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildAuditCsv(records: WebPlatformAdminAuditRecord[]) {
  const rows = [
    ['Timestamp', 'Action', 'Severity', 'Actor', 'Actor role', 'Target', 'Affected', 'Reason', 'Audit ID'],
    ...records.map((record) => [
      formatPlatformAdminDate(record.timestamp),
      record.action,
      record.severity,
      record.actorEmail ?? record.actorUid ?? 'System',
      record.actorRole ?? '',
      record.targetEmail ?? record.targetUid ?? record.workspaceId ?? record.supportCaseId ?? '',
      record.affectedSummary,
      record.reason ?? '',
      record.id,
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildAuditPrintHtml(records: WebPlatformAdminAuditRecord[], generatedBy: string, generatedAt: string | null) {
  const rows = records
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(formatPlatformAdminDate(record.timestamp))}</td>
          <td>${escapeHtml(humanizeAuditAction(record.action))}</td>
          <td>${escapeHtml(record.severity)}</td>
          <td>${escapeHtml(record.actorEmail ?? record.actorUid ?? 'System')}</td>
          <td>${escapeHtml(record.affectedSummary)}</td>
          <td>${escapeHtml(record.reason ?? 'No reason recorded')}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
    <html>
      <head>
        <title>Orbit Ledger Platform Admin Audit</title>
        <style>
          @page { margin: 18mm; }
          body { font-family: Inter, Arial, sans-serif; color: #111827; margin: 0; }
          header { border-bottom: 2px solid #d7e2f2; padding-bottom: 14px; margin-bottom: 18px; }
          h1 { margin: 0 0 8px; font-size: 26px; }
          p { margin: 0; color: #607087; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; color: #607087; border-bottom: 1px solid #d7e2f2; padding: 8px; }
          td { border-bottom: 1px solid #e4ebf5; padding: 8px; vertical-align: top; }
          footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #d7e2f2; color: #607087; font-size: 11px; }
        </style>
      </head>
      <body>
        <header>
          <h1>Platform Admin Audit Trail</h1>
          <p>Generated by ${escapeHtml(generatedBy)} · ${escapeHtml(formatPlatformAdminDate(generatedAt))}</p>
        </header>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Severity</th>
              <th>Actor</th>
              <th>Affected</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <footer>Created with Orbit Ledger · Internal platform admin report</footer>
      </body>
    </html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
