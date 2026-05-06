'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { getOfficeRoleDefinition, type OfficeMembershipRecord, type OfficeWorkspaceRole } from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import {
  buildWebOfficeAuditTimeline,
  getWebOfficeAssignableRoles,
  getWebOfficeInviteCapacityDecision,
  buildWebOfficeInvitationAcceptUrl,
  getWebOfficeInvitationDisplayStatus,
  getWebOfficeMemberPresence,
  inviteWebOfficeMember,
  loadWebOfficeTeamSnapshot,
  requestWebOfficeOwnershipTransfer,
  resendWebOfficeOwnershipTransferNotification,
  resolveWebOfficeOwnershipTransfer,
  revokeWebOfficeInvitation,
  sendWebOfficeInvitationEmail,
  updateWebOfficeMemberRole,
  updateWebOfficeMemberStatus,
  type WebOfficeAuditFilter,
  type WebOfficeTeamSnapshot,
} from '@/lib/office-team';
import { useAuth } from '@/providers/auth-provider';
import { useWebSubscription } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type InviteForm = {
  email: string;
  role: Exclude<OfficeWorkspaceRole, 'owner'> | '';
  message: string;
};

export default function TeamPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { status: subscription } = useWebSubscription();
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState<WebOfficeTeamSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<WebOfficeAuditFilter>('all');
  const [ownershipTargetUid, setOwnershipTargetUid] = useState('');
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '',
    role: '',
    message: '',
  });

  const defaultInviteRole = useMemo(
    () => snapshot?.availableInviteRoles[0] ?? '',
    [snapshot?.availableInviteRoles]
  );

  useEffect(() => {
    if (!activeWorkspace?.workspaceId || !user?.uid) {
      setSnapshot(null);
      return;
    }
    void refreshTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.workspaceId, user?.uid, subscription.tier]);

  useEffect(() => {
    setInviteForm((current) => ({
      ...current,
      role: current.role || defaultInviteRole,
    }));
  }, [defaultInviteRole]);

  async function refreshTeam() {
    if (!activeWorkspace?.workspaceId || !user?.uid) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setSnapshot(
        await loadWebOfficeTeamSnapshot({
          workspaceId: activeWorkspace.workspaceId,
          userId: user.uid,
          subscription,
        })
      );
    } catch {
      setError('Team controls could not be loaded for this workspace.');
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function inviteMember() {
    if (!activeWorkspace?.workspaceId || !user?.uid || !snapshot?.access.canInvite || !inviteForm.role) {
      return;
    }

    const capacityDecision = getWebOfficeInviteCapacityDecision(snapshot, inviteForm.email);
    if (!capacityDecision.allowed) {
      showToast(capacityDecision.message, 'info');
      return;
    }

    setIsSaving(true);
    try {
      const invitationId = await inviteWebOfficeMember({
        workspaceId: activeWorkspace.workspaceId,
        actorUid: user.uid,
        actorName: user.displayName || user.email || null,
        email: inviteForm.email,
        role: inviteForm.role,
        message: inviteForm.message,
      });
      setInviteForm({ email: '', role: defaultInviteRole, message: '' });
      showToast('Team invitation created.', 'success');
      await refreshTeam();
      if (typeof window !== 'undefined') {
        await copyInvitationLink(invitationId);
      }
    } catch (inviteError) {
      showToast(inviteError instanceof Error ? inviteError.message : 'Team invitation could not be created.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeMemberRole(member: OfficeMembershipRecord, nextRole: Exclude<OfficeWorkspaceRole, 'owner'>) {
    if (!activeWorkspace?.workspaceId || !snapshot?.access.role) {
      return;
    }

    const actionId = `${member.uid}:role`;
    setBusyActionId(actionId);
    try {
      await updateWebOfficeMemberRole({
        workspaceId: activeWorkspace.workspaceId,
        memberId: member.uid,
        nextRole,
      });
      showToast('Team role updated.', 'success');
      await refreshTeam();
    } catch {
      showToast('Team role could not be updated.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  async function changeMemberStatus(
    member: OfficeMembershipRecord,
    nextStatus: 'active' | 'suspended' | 'removed'
  ) {
    if (!activeWorkspace?.workspaceId) {
      return;
    }

    const actionId = `${member.uid}:${nextStatus}`;
    setBusyActionId(actionId);
    try {
      await updateWebOfficeMemberStatus({
        workspaceId: activeWorkspace.workspaceId,
        memberId: member.uid,
        nextStatus,
      });
      showToast(nextStatus === 'active' ? 'Member access restored.' : 'Member access updated.', 'success');
      await refreshTeam();
    } catch {
      showToast('Member access could not be updated.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (!activeWorkspace?.workspaceId || !user?.uid) {
      return;
    }

    const actionId = `${invitationId}:revoke`;
    setBusyActionId(actionId);
    try {
      await revokeWebOfficeInvitation({
        workspaceId: activeWorkspace.workspaceId,
        invitationId,
        actorUid: user.uid,
      });
      showToast('Invitation revoked.', 'success');
      await refreshTeam();
    } catch {
      showToast('Invitation could not be revoked.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  async function copyInvitationLink(invitationId: string) {
    if (!activeWorkspace?.workspaceId || typeof window === 'undefined') {
      return;
    }
    const url = buildWebOfficeInvitationAcceptUrl({
      origin: window.location.origin,
      workspaceId: activeWorkspace.workspaceId,
      invitationId,
    });
    await navigator.clipboard.writeText(url);
    showToast('Invitation link copied.', 'success');
  }

  async function sendInvitationEmail(invitationId: string) {
    if (!activeWorkspace?.workspaceId || typeof window === 'undefined') {
      return;
    }

    const actionId = `${invitationId}:send`;
    setBusyActionId(actionId);
    try {
      const result = await sendWebOfficeInvitationEmail({
        workspaceId: activeWorkspace.workspaceId,
        invitationId,
        origin: window.location.origin,
      });
      showToast(result.message ?? 'Invitation email updated.', result.deliveryStatus === 'sent' ? 'success' : 'info');
      await refreshTeam();
    } catch (sendError) {
      showToast(sendError instanceof Error ? sendError.message : 'Invitation email could not be sent.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  async function requestOwnershipTransfer() {
    if (!activeWorkspace?.workspaceId || !ownershipTargetUid) {
      return;
    }

    setBusyActionId('ownership:request');
    try {
      const result = await requestWebOfficeOwnershipTransfer({
        workspaceId: activeWorkspace.workspaceId,
        targetUid: ownershipTargetUid,
      });
      setOwnershipTargetUid('');
      showToast(result.message ?? 'Ownership transfer requested.', 'success');
      await refreshTeam();
    } catch (ownershipError) {
      showToast(ownershipError instanceof Error ? ownershipError.message : 'Ownership transfer could not be requested.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  async function resolveOwnershipTransfer(transferId: string, action: 'approve' | 'cancel') {
    if (!activeWorkspace?.workspaceId) {
      return;
    }

    setBusyActionId(`ownership:${transferId}:${action}`);
    try {
      const result = await resolveWebOfficeOwnershipTransfer({
        workspaceId: activeWorkspace.workspaceId,
        transferId,
        action,
      });
      showToast(result.message ?? (action === 'approve' ? 'Ownership transfer approved.' : 'Ownership transfer cancelled.'), 'success');
      await refreshTeam();
    } catch (ownershipError) {
      showToast(ownershipError instanceof Error ? ownershipError.message : 'Ownership transfer could not be updated.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  async function resendOwnershipReminder(transferId: string) {
    if (!activeWorkspace?.workspaceId) {
      return;
    }

    setBusyActionId(`ownership:${transferId}:remind`);
    try {
      const result = await resendWebOfficeOwnershipTransferNotification({
        workspaceId: activeWorkspace.workspaceId,
        transferId,
      });
      showToast(result.message ?? 'Ownership approval reminder updated.', 'success');
      await refreshTeam();
    } catch (ownershipError) {
      showToast(ownershipError instanceof Error ? ownershipError.message : 'Ownership approval reminder could not be sent.', 'danger');
    } finally {
      setBusyActionId(null);
    }
  }

  const access = snapshot?.access;
  const isLocked = Boolean(snapshot && !access?.officeAllowed);
  const auditTimeline = useMemo(
    () => buildWebOfficeAuditTimeline(snapshot?.auditItems ?? [], auditFilter),
    [auditFilter, snapshot?.auditItems]
  );
  const inviteCapacity = useMemo(
    () => snapshot ? getWebOfficeInviteCapacityDecision(snapshot, inviteForm.email) : null,
    [inviteForm.email, snapshot]
  );
  const ownershipCandidates = useMemo(
    () => (snapshot?.members ?? []).filter((member) => member.status === 'active' && member.role !== 'owner' && member.uid !== user?.uid),
    [snapshot?.members, user?.uid]
  );
  const pendingOwnershipTransfer = useMemo(
    () => (snapshot?.ownershipTransfers ?? []).find((transfer) => transfer.status === 'pending') ?? null,
    [snapshot?.ownershipTransfers]
  );

  return (
    <AppShell title="Team" subtitle="Manage Office members, invitations, and role-based access.">
      {error ? <div className="ol-message ol-message--danger">{error}</div> : null}

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Office team access</div>
            <p className="ol-panel-copy">
              Team controls are available after Office access is granted. Roles decide which screens and actions are available.
            </p>
          </div>
          <div className="ol-actions ol-actions--compact">
            <span className={`ol-chip ${access?.isActiveMember ? 'ol-chip--success' : 'ol-chip--warning'}`}>
              {access?.roleLabel ?? 'Checking'}
            </span>
            <button className="ol-button-secondary" disabled={isLoading} type="button" onClick={() => void refreshTeam()}>
              {isLoading ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className={`ol-message ${access?.isActiveMember ? 'ol-message--success' : 'ol-message--warning'}`}>
          <strong>{access?.isActiveMember ? 'Office team is active' : 'Office team is invitation-only'}</strong>
          <p>{access?.message ?? 'Checking team access for this workspace.'}</p>
        </div>
        {isLocked ? (
          <div className="ol-actions">
            <Link className="ol-button" href={'/market' as Route}>
              Request Office access
            </Link>
          </div>
        ) : null}
      </section>

      <section className="ol-metric-grid">
        {(snapshot?.metrics ?? []).map((metric) => (
          <article className="ol-metric-card" data-tone={metric.tone} key={metric.id}>
            <div className="ol-metric-label">{metric.label}</div>
            <div className="ol-metric-value">{metric.value}</div>
            <div className="ol-metric-helper">{metric.helper}</div>
          </article>
        ))}
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Invite teammate</div>
            <p className="ol-panel-copy">
              Owners can invite admins and lower roles. Admins can invite manager, staff, accountant, and viewer roles.
            </p>
          </div>
          <div className="ol-chip-row">
            <span className={`ol-chip ${snapshot?.seatCapacity.atCapacity ? 'ol-chip--warning' : 'ol-chip--success'}`}>
              {snapshot?.seatCapacity.label ?? 'Checking seats'}
            </span>
            <span className={`ol-chip ${snapshot?.access.canInvite ? 'ol-chip--success' : 'ol-chip--warning'}`}>
              {snapshot?.access.canInvite ? 'Invite enabled' : 'Invite locked'}
            </span>
          </div>
        </div>
        <div className={`ol-message ${snapshot?.seatCapacity.atCapacity ? 'ol-message--warning' : 'ol-message--success'}`}>
          <strong>{snapshot?.seatCapacity.atCapacity ? 'Office seats are full' : 'Office seats available'}</strong>
          <p>{snapshot?.seatCapacity.message ?? 'Checking Office seat capacity.'}</p>
        </div>
        <div className="ol-form-grid">
          <label className="ol-field">
            <span className="ol-field-label">Email</span>
            <input
              className="ol-input"
              disabled={!snapshot?.access.canInvite || isSaving}
              onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="teammate@example.com"
              type="email"
              value={inviteForm.email}
            />
            <span className="ol-field-help">Use the email your teammate will use to sign in.</span>
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Role</span>
            <select
              className="ol-select"
              disabled={!snapshot?.access.canInvite || isSaving}
              onChange={(event) =>
                setInviteForm((current) => ({
                  ...current,
                  role: event.target.value as Exclude<OfficeWorkspaceRole, 'owner'>,
                }))
              }
              value={inviteForm.role}
            >
              {snapshot?.availableInviteRoles.length ? null : <option value="">No role available</option>}
              {snapshot?.availableInviteRoles.map((role) => (
                <option key={role} value={role}>
                  {getOfficeRoleDefinition(role).label}
                </option>
              ))}
            </select>
            <span className="ol-field-help">The role controls what this person can see and do.</span>
          </label>
          <label className="ol-field ol-field--wide">
            <span className="ol-field-label">Invite note</span>
            <textarea
              className="ol-textarea"
              disabled={!snapshot?.access.canInvite || isSaving}
              onChange={(event) => setInviteForm((current) => ({ ...current, message: event.target.value }))}
              placeholder="Optional message for this invitation"
              value={inviteForm.message}
            />
            <span className="ol-field-help">Keep this short and practical. Delivery and acceptance are handled in the next Office phase.</span>
          </label>
        </div>
        <div className="ol-actions">
          <button className="ol-button" disabled={!snapshot?.access.canInvite || isSaving || !inviteForm.email || !inviteForm.role || inviteCapacity?.allowed === false} type="button" onClick={() => void inviteMember()}>
            {isSaving ? 'Creating invite' : 'Create invitation'}
          </button>
          {inviteForm.email && inviteCapacity?.allowed === false ? (
            <span className="ol-muted">{inviteCapacity.message}</span>
          ) : null}
        </div>
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <div>
            <div className="ol-panel-title">Members</div>
            <p className="ol-panel-copy">Active, suspended, and removed Office member records.</p>
          </div>
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '1.2fr 0.65fr 0.65fr 0.85fr 1fr 1.05fr' }}>
          <span>Member</span>
          <span>Role</span>
          <span>Status</span>
          <span>Last active</span>
          <span>Access summary</span>
          <span>Actions</span>
        </div>
        {snapshot?.members.map((member) => {
          const assignableRoles = getWebOfficeAssignableRoles(snapshot.access.role, member.role);
          const canEditThisMember = member.uid !== user?.uid && member.role !== 'owner';
          const canChangeRole = canEditThisMember && assignableRoles.length > 0;
          const canRemove = canEditThisMember && snapshot.access.canRemoveMembers && member.status !== 'removed';
          const presence = getWebOfficeMemberPresence(member);
          return (
            <div className="ol-table-row" key={member.uid} style={{ gridTemplateColumns: '1.2fr 0.65fr 0.65fr 0.85fr 1fr 1.05fr' }}>
              <div>
                <strong>{member.displayName || member.email || member.uid}</strong>
                <div className="ol-muted">{member.email || 'No email saved'}</div>
              </div>
              <div>
                {canChangeRole ? (
                  <select
                    className="ol-select"
                    disabled={busyActionId === `${member.uid}:role`}
                    onChange={(event) => void changeMemberRole(member, event.target.value as Exclude<OfficeWorkspaceRole, 'owner'>)}
                    value={member.role === 'owner' ? '' : member.role}
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {getOfficeRoleDefinition(role).label}
                      </option>
                    ))}
                  </select>
                ) : (
                  getOfficeRoleDefinition(member.role).label
                )}
              </div>
              <span className={`ol-chip ${member.status === 'active' ? 'ol-chip--success' : member.status === 'suspended' ? 'ol-chip--warning' : ''}`}>
                {member.status}
              </span>
              <div>
                <span className={`ol-chip ${presence.tone === 'success' ? 'ol-chip--success' : presence.tone === 'warning' ? 'ol-chip--warning' : 'ol-chip--muted'}`}>
                  {presence.label}
                </span>
                {presence.lastSeenAt ? <div className="ol-muted">{formatTeamDateTime(presence.lastSeenAt)}</div> : null}
              </div>
              <span className="ol-muted">{getOfficeMembershipPreview(member.role)}</span>
              <div className="ol-actions ol-actions--compact">
                {member.status === 'suspended' && canRemove ? (
                  <button className="ol-button-secondary" disabled={Boolean(busyActionId)} type="button" onClick={() => void changeMemberStatus(member, 'active')}>
                    Restore
                  </button>
                ) : null}
                {member.status === 'active' && canRemove ? (
                  <button className="ol-button-secondary" disabled={Boolean(busyActionId)} type="button" onClick={() => void changeMemberStatus(member, 'suspended')}>
                    Suspend
                  </button>
                ) : null}
                {canRemove ? (
                  <button className="ol-button-ghost" disabled={Boolean(busyActionId)} type="button" onClick={() => void changeMemberStatus(member, 'removed')}>
                    Remove
                  </button>
                ) : (
                  <span className="ol-muted">Protected</span>
                )}
              </div>
            </div>
          );
        })}
        {!snapshot?.members.length ? <div className="ol-empty">Office members will appear here after access is granted.</div> : null}
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Ownership transfer</div>
            <p className="ol-panel-copy">
              Transfer ownership only when another active member should become legally responsible for this workspace.
            </p>
          </div>
          <span className={`ol-chip ${pendingOwnershipTransfer ? 'ol-chip--warning' : 'ol-chip--muted'}`}>
            {pendingOwnershipTransfer ? 'Approval pending' : 'No pending transfer'}
          </span>
        </div>
        {snapshot?.access.role === 'owner' ? (
          <div className="ol-form-grid">
            <label className="ol-field">
              <span className="ol-field-label">Receiving member</span>
              <select
                className="ol-select"
                disabled={Boolean(pendingOwnershipTransfer) || Boolean(busyActionId)}
                onChange={(event) => setOwnershipTargetUid(event.target.value)}
                value={ownershipTargetUid}
              >
                <option value="">Choose active member</option>
                {ownershipCandidates.map((member) => (
                  <option key={member.uid} value={member.uid}>
                    {member.displayName || member.email || member.uid} · {getOfficeRoleDefinition(member.role).label}
                  </option>
                ))}
              </select>
              <span className="ol-field-help">The receiving member must sign in and approve before ownership changes.</span>
            </label>
            <div className="ol-field">
              <span className="ol-field-label">Action</span>
              <button
                className="ol-button"
                disabled={!ownershipTargetUid || Boolean(pendingOwnershipTransfer) || Boolean(busyActionId)}
                type="button"
                onClick={() => void requestOwnershipTransfer()}
              >
                Request transfer
              </button>
              <span className="ol-field-help">A pending request blocks new transfer requests until it is approved or cancelled.</span>
            </div>
          </div>
        ) : (
          <div className="ol-message ol-message--warning">
            <strong>Owner action required</strong>
            <p>Only the current owner can start an ownership transfer.</p>
          </div>
        )}
        <div className="ol-list">
          {(snapshot?.ownershipTransfers ?? []).map((transfer) => {
            const canApprove = transfer.status === 'pending' && transfer.targetUid === user?.uid;
            const canCancel = transfer.status === 'pending' && (snapshot?.access.role === 'owner' || transfer.targetUid === user?.uid);
            const canRemind = transfer.status === 'pending' && (snapshot?.access.role === 'owner' || transfer.targetUid === user?.uid);
            return (
              <article className="ol-list-item" key={transfer.id}>
                <div className="ol-list-icon" data-tone={transfer.status === 'pending' ? 'warning' : transfer.status === 'approved' ? 'success' : 'default'}>
                  -&gt;
                </div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">
                    {transfer.targetName || transfer.targetEmail || transfer.targetUid}
                  </div>
                  <div className="ol-list-text">
                    Requested {formatTeamDateTime(transfer.requestedAt)}
                    {transfer.expiresAt && transfer.status === 'pending' ? ` · Expires ${formatTeamDate(transfer.expiresAt)}` : ''}
                  </div>
                  <div className="ol-list-text">
                    {transfer.status === 'approved' && transfer.approvedAt
                      ? `Approved ${formatTeamDateTime(transfer.approvedAt)}`
                      : transfer.status === 'cancelled' && transfer.cancelledAt
                        ? `Cancelled ${formatTeamDateTime(transfer.cancelledAt)}`
                        : transfer.status === 'expired'
                          ? 'Expired before approval.'
                          : 'Waiting for receiving member approval.'}
                  </div>
                  <div className="ol-list-text">
                    {getOwnershipNotificationLabel(transfer.notificationStatus)}
                    {transfer.notificationSentAt ? ` · ${formatTeamDateTime(transfer.notificationSentAt)}` : ''}
                    {transfer.notificationFailureReason ? ` · ${transfer.notificationFailureReason}` : ''}
                  </div>
                </div>
                <span className={`ol-chip ${transfer.status === 'pending' ? 'ol-chip--warning' : transfer.status === 'approved' ? 'ol-chip--success' : 'ol-chip--muted'}`}>
                  {transfer.status}
                </span>
                {canApprove || canCancel || canRemind ? (
                  <div className="ol-actions ol-actions--compact">
                    {canApprove ? (
                      <button className="ol-button" disabled={Boolean(busyActionId)} type="button" onClick={() => void resolveOwnershipTransfer(transfer.id, 'approve')}>
                        Approve
                      </button>
                    ) : null}
                    {canRemind ? (
                      <button className="ol-button-secondary" disabled={Boolean(busyActionId)} type="button" onClick={() => void resendOwnershipReminder(transfer.id)}>
                        Send reminder
                      </button>
                    ) : null}
                    {canCancel ? (
                      <button className="ol-button-ghost" disabled={Boolean(busyActionId)} type="button" onClick={() => void resolveOwnershipTransfer(transfer.id, 'cancel')}>
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
          {!snapshot?.ownershipTransfers.length ? (
            <div className="ol-empty">Ownership transfer history will appear here.</div>
          ) : null}
        </div>
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <div>
            <div className="ol-panel-title">Invitations</div>
            <p className="ol-panel-copy">Pending and historical Office invitations for this workspace.</p>
          </div>
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1fr' }}>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {snapshot?.invitations.map((invitation) => (
          <div className="ol-table-row" key={invitation.id} style={{ gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1fr' }}>
            <div>
              <strong>{invitation.email}</strong>
              <div className="ol-muted">
                {invitation.deliveryStatus === 'sent'
                  ? `Email sent${invitation.sentAt ? ` ${formatTeamDate(invitation.sentAt)}` : ''}`
                  : invitation.deliveryStatus === 'pending_provider_connection'
                    ? 'Email ready; provider not connected'
                    : invitation.deliveryStatus === 'failed'
                      ? invitation.failureReason || 'Email failed'
                      : invitation.expiresAt
                        ? `Expires ${formatTeamDate(invitation.expiresAt)}`
                        : invitation.message || 'No invite note'}
              </div>
            </div>
            <span>{getOfficeRoleDefinition(invitation.role).label}</span>
            <span className={`ol-chip ${getWebOfficeInvitationDisplayStatus(invitation) === 'pending' ? 'ol-chip--warning' : getWebOfficeInvitationDisplayStatus(invitation) === 'accepted' ? 'ol-chip--success' : ''}`}>
              {getWebOfficeInvitationDisplayStatus(invitation)}
            </span>
            <div className="ol-actions ol-actions--compact">
              {getWebOfficeInvitationDisplayStatus(invitation) === 'pending' && snapshot.access.canInvite ? (
                <>
                  <button className="ol-button" disabled={Boolean(busyActionId)} type="button" onClick={() => void sendInvitationEmail(invitation.id)}>
                    {invitation.deliveryStatus === 'sent' ? 'Resend email' : 'Send email'}
                  </button>
                  <button className="ol-button-secondary" disabled={Boolean(busyActionId)} type="button" onClick={() => void copyInvitationLink(invitation.id)}>
                    Copy link
                  </button>
                  <button className="ol-button-ghost" disabled={Boolean(busyActionId)} type="button" onClick={() => void revokeInvitation(invitation.id)}>
                    Revoke
                  </button>
                </>
              ) : (
                <span className="ol-muted">No action</span>
              )}
            </div>
          </div>
        ))}
        {!snapshot?.invitations.length ? <div className="ol-empty">No team invitations have been created yet.</div> : null}
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Access event timeline</div>
            <p className="ol-panel-copy">
              Review invitation, role, status, ownership, and internal access events for this workspace.
            </p>
          </div>
          <label className="ol-field" style={{ maxWidth: 280 }}>
            <span className="ol-field-label">Show</span>
            <select
              className="ol-select"
              value={auditFilter}
              onChange={(event) => setAuditFilter(event.target.value as WebOfficeAuditFilter)}
            >
              <option value="all">All access events</option>
              <option value="members">Member changes</option>
              <option value="invitations">Invitations</option>
              <option value="ownership">Ownership</option>
              <option value="internal">Internal reviews</option>
            </select>
          </label>
        </div>
        <div className="ol-list">
          {auditTimeline.map((event) => (
            <article className="ol-list-item" key={event.id}>
              <div className="ol-list-icon" data-tone={event.tone}>
                {getAuditIcon(event.category)}
              </div>
              <div className="ol-list-copy">
                <div className="ol-list-title">
                  {event.title} · <span className="ol-status-text" data-tone={event.tone}>{event.target}</span>
                </div>
                <div className="ol-list-text">{event.description}</div>
                <div className="ol-list-text">
                  {formatTeamDateTime(event.createdAt)} · {event.actor}
                </div>
                {event.supportCaseId || event.supportConsentId ? (
                  <div className="ol-inline-actions" style={{ marginTop: 8 }}>
                    {event.supportCaseId ? (
                      <span className="ol-chip ol-chip--primary">Case {event.supportCaseId}</span>
                    ) : null}
                    {event.supportConsentId ? (
                      <span className="ol-chip ol-chip--success">Consent {event.supportConsentId}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className={`ol-chip ${getAuditChipClass(event.tone)}`}>{event.category}</span>
            </article>
          ))}
          {!auditTimeline.length ? (
            <div className="ol-empty">
              {auditFilter === 'all'
                ? 'No Office access events are available yet.'
                : 'No access events match this view.'}
            </div>
          ) : null}
        </div>
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Your role controls</div>
            <p className="ol-panel-copy">A quick view of the first permissions available to your current role.</p>
          </div>
        </div>
        {snapshot?.permissionSummary.length ? (
          <div className="ol-chip-row">
            {snapshot.permissionSummary.map((permission) => (
              <span className="ol-chip" key={permission}>
                {permission}
              </span>
            ))}
          </div>
        ) : (
          <div className="ol-empty">No active Office role is available for this account yet.</div>
        )}
      </section>
    </AppShell>
  );
}

function getOfficeMembershipPreview(role: OfficeWorkspaceRole) {
  return getOfficeMembershipSummary(role).join(', ');
}

function getOfficeMembershipSummary(role: OfficeWorkspaceRole) {
  if (role === 'owner') {
    return ['Full control', 'Billing', 'Team'];
  }
  if (role === 'admin') {
    return ['Operations', 'Settings', 'Team'];
  }
  if (role === 'manager') {
    return ['Daily work', 'Reports', 'Recurring'];
  }
  if (role === 'staff') {
    return ['Entry work', 'Invoices', 'Payments'];
  }
  if (role === 'accountant') {
    return ['Reports', 'Exports', 'Audit'];
  }
  return ['Read-only'];
}

function getOwnershipNotificationLabel(status: string | null) {
  if (status === 'sent') {
    return 'Approval email sent';
  }
  if (status === 'pending_provider_connection') {
    return 'Approval email ready';
  }
  if (status === 'failed') {
    return 'Approval email needs attention';
  }
  if (status === 'queued') {
    return 'Approval email queued';
  }
  return 'Approval email not sent yet';
}

function formatTeamDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTeamDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value || 'Date not saved';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAuditIcon(category: WebOfficeAuditFilter) {
  if (category === 'invitations') {
    return 'Invite';
  }
  if (category === 'ownership') {
    return 'Owner';
  }
  if (category === 'internal') {
    return 'Review';
  }
  return 'Team';
}

function getAuditChipClass(tone: 'success' | 'warning' | 'danger' | 'default') {
  if (tone === 'success') {
    return 'ol-chip--success';
  }
  if (tone === 'warning' || tone === 'danger') {
    return 'ol-chip--warning';
  }
  return '';
}
