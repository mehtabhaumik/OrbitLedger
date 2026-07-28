'use client';

/**
 * Presentational parts of the platform-admin console: metric/chart cards, table
 * rows, status pills, and the pure formatting/print helpers. Split out of
 * platform-admin-console.tsx (which was ~3,660 lines) so the console file holds
 * the data flow and section layout, and these leaf pieces are reusable and
 * readable on their own. Behaviour is unchanged - this is a pure code move.
 */

import type { Route } from 'next';
import Link from 'next/link';

import { getPlatformAdminRoleDefinition } from '@orbit-ledger/core';

import {
  formatPlatformAdminDate,
  type WebPlatformAdminAccountAction,
  type WebPlatformAdminAuditRecord,
  type WebPlatformAdminChartDatum,
  type WebPlatformAdminDocumentVaultRecord,
  type WebPlatformAdminOffer,
  type WebPlatformAdminOfferAction,
  type WebPlatformAdminRegistryRecord,
  type WebPlatformAdminReport,
  type WebPlatformAdminUser,
  type WebPlatformAdminUserAction,
  type WebPlatformAdminUserOfficeFilter,
  type WebPlatformAdminUserProviderFilter,
  type WebPlatformAdminUserRoleFilter,
  type WebPlatformAdminUserWorkspaceContext,
} from '@/lib/platform-admin';

export function MetricCard({
  label,
  value,
  tone = 'default',
  href,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'premium';
  /** When set, the card becomes a link to the section that acts on it. */
  href?: Route;
}) {
  // data-active drives the prioritised styling: a non-zero card gets its tone
  // rail and full-strength value; a zero card recedes so real numbers stand out.
  const active = value > 0 ? 'true' : undefined;
  const content = (
    <>
      <span>{label}</span>
      <strong>{value.toLocaleString('en-IN')}</strong>
    </>
  );

  if (href) {
    return (
      <Link className="ol-platform-admin-metric ol-platform-admin-metric--link" data-tone={tone} data-active={active} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <article className="ol-platform-admin-metric" data-tone={tone} data-active={active}>
      {content}
    </article>
  );
}

export function AdminTrendChart({
  title,
  subtitle,
  data,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle: string;
  data: WebPlatformAdminChartDatum[];
  actionLabel: string;
  actionHref: string;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  return (
    <article className="ol-platform-admin-chart-card">
      <ChartCardHeader title={title} subtitle={subtitle} actionLabel={actionLabel} actionHref={actionHref} />
      <div className="ol-platform-admin-trend-chart" role="img" aria-label={`${title}: ${chartSummary(data)}`}>
        {data.map((item) => (
          <div key={item.label} className="ol-platform-admin-trend-column">
            <span style={{ height: `${Math.max(8, (item.value / maxValue) * 100)}%` }} />
            <strong>{item.value.toLocaleString('en-IN')}</strong>
            <em>{item.label}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AdminDonutChart({
  title,
  subtitle,
  data,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle: string;
  data: WebPlatformAdminChartDatum[];
  actionLabel: string;
  actionHref: string;
}) {
  const total = sumChartData(data);
  const gradient = buildDonutGradient(data);
  return (
    <article className="ol-platform-admin-chart-card">
      <ChartCardHeader title={title} subtitle={subtitle} actionLabel={actionLabel} actionHref={actionHref} />
      <div className="ol-platform-admin-donut-wrap">
        <div className="ol-platform-admin-donut" style={{ background: gradient }} aria-hidden="true">
          <span>{total.toLocaleString('en-IN')}</span>
        </div>
        <ChartLegend data={data} />
      </div>
    </article>
  );
}

export function AdminStackedChart({
  title,
  subtitle,
  data,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle: string;
  data: WebPlatformAdminChartDatum[];
  actionLabel: string;
  actionHref: string;
}) {
  const total = Math.max(1, sumChartData(data));
  return (
    <article className="ol-platform-admin-chart-card">
      <ChartCardHeader title={title} subtitle={subtitle} actionLabel={actionLabel} actionHref={actionHref} />
      <div className="ol-platform-admin-stacked-chart" role="img" aria-label={`${title}: ${chartSummary(data)}`}>
        <div className="ol-platform-admin-stacked-track">
          {data.map((item, index) => (
            <span
              key={item.label}
              data-chart-tone={index % 6}
              style={{ flexBasis: `${(item.value / total) * 100}%` }}
              title={`${item.label}: ${item.value}`}
            />
          ))}
        </div>
        <ChartLegend data={data} />
      </div>
    </article>
  );
}

export function AdminHorizontalBars({
  title,
  subtitle,
  data,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle: string;
  data: WebPlatformAdminChartDatum[];
  actionLabel: string;
  actionHref: string;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  return (
    <article className="ol-platform-admin-chart-card">
      <ChartCardHeader title={title} subtitle={subtitle} actionLabel={actionLabel} actionHref={actionHref} />
      <div className="ol-platform-admin-horizontal-bars" role="img" aria-label={`${title}: ${chartSummary(data)}`}>
        {data.map((item, index) => (
          <div key={item.label} className="ol-platform-admin-horizontal-row">
            <div>
              <span>{item.label}</span>
              <strong>{item.value.toLocaleString('en-IN')}</strong>
            </div>
            <i>
              <b data-chart-tone={index % 6} style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }} />
            </i>
          </div>
        ))}
      </div>
    </article>
  );
}

function ChartCardHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="ol-platform-admin-chart-title">
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <a href={actionHref}>{actionLabel}</a>
    </div>
  );
}

function ChartLegend({ data }: { data: WebPlatformAdminChartDatum[] }) {
  return (
    <div className="ol-platform-admin-chart-legend">
      {data.map((item, index) => (
        <span key={item.label}>
          <i data-chart-tone={index % 6} />
          {item.label}
          <strong>{item.value.toLocaleString('en-IN')}</strong>
        </span>
      ))}
    </div>
  );
}

function sumChartData(data: WebPlatformAdminChartDatum[]) {
  return data.reduce((total, item) => total + item.value, 0);
}

function chartSummary(data: WebPlatformAdminChartDatum[]) {
  return data.map((item) => `${item.label} ${item.value}`).join(', ');
}

function buildDonutGradient(data: WebPlatformAdminChartDatum[]) {
  const total = sumChartData(data);
  if (!total) {
    return 'conic-gradient(rgba(191, 205, 225, 0.52) 0deg 360deg)';
  }
  let cursor = 0;
  const stops = data.map((item, index) => {
    const next = cursor + (item.value / total) * 360;
    const color = `var(--ol-admin-chart-${index % 6})`;
    const segment = `${color} ${cursor}deg ${next}deg`;
    cursor = next;
    return segment;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export function StatusSignal({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'premium';
}) {
  return (
    <div className="ol-platform-admin-status-signal" data-tone={tone}>
      <span>{label}</span>
      <strong>{value.toLocaleString('en-IN')}</strong>
    </div>
  );
}

export function AdminAreaCard({ id, title, value, detail }: { id?: string; title: string; value: string; detail: string }) {
  return (
    <article className="ol-platform-admin-area-card" id={id}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function AdminAccountRow({
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

export function OfferRow({
  offer,
  canManage,
  onManage,
}: {
  offer: WebPlatformAdminOffer;
  canManage: boolean;
  onManage: (offer: WebPlatformAdminOffer, action?: WebPlatformAdminOfferAction) => void;
}) {
  const tone =
    offer.status === 'active'
      ? 'success'
      : offer.status === 'scheduled'
        ? 'warning'
        : offer.status === 'expired'
          ? 'warning'
          : 'danger';
  const targetSummary = summarizeOfferTargets(offer);
  const discountSummary =
    offer.discountType === 'percentage'
      ? `${offer.discountValue}% off`
      : `${offer.discountValue.toLocaleString('en-IN')} minor units`;

  return (
    <article className="ol-platform-admin-admin-row ol-platform-admin-offer-row">
      <div className="ol-platform-admin-user-main">
        <span className="ol-platform-admin-avatar">%</span>
        <div>
          <strong>{offer.label}</strong>
          <span>{offer.title}</span>
          <code>{offer.id}</code>
        </div>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span className="ol-platform-admin-status-pill" data-tone={tone}>
          {offer.status}
        </span>
        <span>{offer.scope.replaceAll('_', ' ')}</span>
        <span>{targetSummary}</span>
      </div>
      <div className="ol-platform-admin-user-meta">
        <span>{discountSummary}</span>
        <span>
          {offer.expiresAt
            ? `Expires ${formatPlatformAdminDate(offer.expiresAt)}`
            : offer.lifetimeConfirmed
              ? 'Lifetime confirmed'
              : 'No expiry saved'}
        </span>
        <span>Updated {formatPlatformAdminDate(offer.updatedAt)}</span>
      </div>
      {canManage ? (
        <div className="ol-platform-admin-row-actions">
          <button className="ol-button-secondary" type="button" onClick={() => onManage(offer, 'update')}>
            Edit
          </button>
          {offer.status === 'active' || offer.status === 'scheduled' ? (
            <button className="ol-button-ghost" type="button" onClick={() => onManage(offer, 'deactivate')}>
              Deactivate
            </button>
          ) : null}
          {offer.status !== 'expired' && offer.status !== 'removed' ? (
            <button className="ol-button-ghost" type="button" onClick={() => onManage(offer, 'remove')}>
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function DocumentVaultRow({ record }: { record: WebPlatformAdminDocumentVaultRecord }) {
  const attestationTone = record.selfAttested ? 'success' : 'warning';
  const uploadActor = record.uploadedByEmail ?? record.uploadedByUid;
  const entityLabel = [record.entityType.replaceAll('_', ' '), record.entitySubtype?.replaceAll('_', ' ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <tr>
      <td>
        <strong>{record.workspaceName}</strong>
        <span>{record.workspaceEmail ?? 'No workspace email saved'}</span>
        <code>{record.workspaceId}</code>
      </td>
      <td>
        <strong>{record.documentName}</strong>
        <span>{record.documentTypeLabel}</span>
        <span>{record.documentCategoryLabel}</span>
      </td>
      <td>
        <strong>{formatPlatformAdminDate(record.uploadedAt)}</strong>
        <span>{uploadActor}</span>
        <span>{entityLabel || 'No entity type saved'}</span>
      </td>
      <td>
        <span className="ol-platform-admin-status-pill" data-tone={attestationTone}>
          {record.selfAttested ? 'Self-attested' : 'Missing attestation'}
        </span>
        <span>{record.verificationStatus.replaceAll('_', ' ')}</span>
        {record.linkedProfileRevisionId ? <code>{record.linkedProfileRevisionId}</code> : null}
      </td>
      <td>
        <strong>{record.reasonToUpload}</strong>
        {record.attestationText ? <span>{record.attestationText}</span> : null}
      </td>
      <td>
        <strong>{record.fileName}</strong>
        <span>
          {record.contentType} · {formatDocumentSize(record.size)}
        </span>
        {record.downloadUrl ? (
          <a className="ol-button-secondary ol-platform-admin-document-link" href={record.downloadUrl} target="_blank" rel="noreferrer">
            Open / download
          </a>
        ) : (
          <span className="ol-platform-admin-status-pill" data-tone="warning">
            File link missing
          </span>
        )}
      </td>
    </tr>
  );
}

export function AuditRecordRow({ record }: { record: WebPlatformAdminAuditRecord }) {
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

function summarizeOfferTargets(offer: WebPlatformAdminOffer): string {
  if (offer.scope === 'sitewide') {
    return 'All eligible users';
  }
  if (offer.scope === 'selected_users') {
    return `${offer.targetEmails.length + offer.targetUids.length} user target(s)`;
  }
  if (offer.scope === 'selected_workspaces') {
    return `${offer.targetWorkspaceIds.length} workspace target(s)`;
  }
  if (offer.scope === 'selected_plans') {
    return offer.targetPlanIds.length ? offer.targetPlanIds.join(', ') : 'Plan targets missing';
  }
  if (offer.scope === 'selected_countries') {
    return offer.targetCountries.length ? offer.targetCountries.join(', ') : 'Country targets missing';
  }
  return 'Selected targets';
}

function formatDocumentSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 bytes';
  }
  if (size < 1024) {
    return `${size} bytes`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function humanizeUserRoleFilter(role: WebPlatformAdminUserRoleFilter): string {
  if (role === 'all') {
    return 'All roles';
  }
  if (role === 'no_platform_role') {
    return 'No platform role';
  }
  return getPlatformAdminRoleDefinition(role).label;
}

export function humanizeOfficeAccessFilter(filter: WebPlatformAdminUserOfficeFilter): string {
  if (filter === 'all') {
    return 'All users';
  }
  return filter === 'has_office_access' ? 'Has Office access' : 'No Office access';
}

export function humanizeProviderFilter(filter: WebPlatformAdminUserProviderFilter): string {
  switch (filter) {
    case 'google':
      return 'Google';
    case 'password':
      return 'Email and password';
    case 'multi_provider':
      return 'Multiple providers';
    case 'no_provider':
      return 'No provider';
    default:
      return 'All methods';
  }
}

export function UserTableRow({
  user,
  isSelected,
  canControl,
  canSuspend,
  onSelect,
  onManage,
}: {
  user: WebPlatformAdminUser;
  isSelected: boolean;
  canControl: boolean;
  canSuspend: boolean;
  onSelect: (user: WebPlatformAdminUser) => void;
  onManage: (user: WebPlatformAdminUser, action?: WebPlatformAdminUserAction) => void;
}) {
  const title = user.displayName || user.email || user.uid;
  const platformRoleLabel = user.platformAdminRole
    ? getPlatformAdminRoleDefinition(user.platformAdminRole).label
    : 'No platform role';
  const officeRoleSummary = user.officeRoles.length ? user.officeRoles.join(', ') : 'No Office role';
  const workspaceSummary = `${user.ownedWorkspaceCount} owned · ${user.officeWorkspaceCount} Office`;
  const workspaceNamesSummary = user.workspaceNames.length ? user.workspaceNames.slice(0, 2).join(', ') : 'No workspace names';
  const signInSummary = user.providerIds.length ? user.providerIds.join(', ') : 'No provider';
  const riskBadges = buildUserRiskBadges(user);

  return (
    <tr className="ol-platform-admin-user-table-row" data-selected={isSelected ? 'true' : 'false'}>
      <td>
        <button className="ol-platform-admin-user-table-user" type="button" onClick={() => onSelect(user)}>
          <span className="ol-platform-admin-avatar">{initials(title)}</span>
          <span className="ol-platform-admin-user-cell">
            <strong>{title}</strong>
            <em>{user.email ?? 'No email saved'}</em>
            {riskBadges.length ? (
              <span className="ol-platform-admin-user-inline-badges">
                {riskBadges.map((badge) => (
                  <span className="ol-platform-admin-status-pill" data-tone={badge.tone} key={badge.label}>
                    {badge.label}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </button>
      </td>
      <td>
        <strong>{platformRoleLabel}</strong>
        <span>{user.platformAdminRole ? `Source: ${user.platformAdminRoleSource ?? 'registry'}` : 'Standard user'}</span>
      </td>
      <td>
        <strong>{officeRoleSummary}</strong>
        <span>{user.officeWorkspaceCount ? `${user.officeWorkspaceCount} Office workspace(s)` : 'No Office access'}</span>
      </td>
      <td>
        <strong>{workspaceSummary}</strong>
        <span>{workspaceNamesSummary}</span>
      </td>
      <td>
        <strong>{signInSummary}</strong>
        <span>{user.emailVerified ? 'Verified email' : 'Email not verified'}</span>
      </td>
      <td>
        <strong>{user.hasActiveSubscription ? 'Active' : 'None'}</strong>
        <span>{user.hasActiveSubscription ? 'Billing live' : 'No active plan'}</span>
      </td>
      <td>
        <strong>{formatPlatformAdminDate(user.lastSignInAt)}</strong>
        <span>{summarizeAccountState(user)}</span>
      </td>
      <td>
        <div className="ol-platform-admin-user-table-actions">
          <button className="ol-button-secondary" type="button" onClick={() => onSelect(user)}>
            View
          </button>
          {canControl ? (
            <button className="ol-button-ghost" type="button" onClick={() => onManage(user, 'send_warning')}>
              Manage
            </button>
          ) : null}
          {canSuspend ? (
            <button
              className="ol-button-ghost"
              type="button"
              onClick={() => onManage(user, user.disabled ? 'restore_user' : 'suspend_user')}
            >
              {user.disabled ? 'Restore' : 'Suspend'}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function StatusPill({ user }: { user: WebPlatformAdminUser }) {
  const tone = user.disabled ? 'danger' : user.status === 'no_workspace' ? 'warning' : 'success';
  const label = user.disabled ? 'Disabled' : user.status === 'no_workspace' ? 'No workspace' : 'Active';
  return (
    <span className="ol-platform-admin-status-pill" data-tone={tone}>
      {label}
    </span>
  );
}

function buildUserRiskBadges(user: WebPlatformAdminUser): Array<{ label: string; tone: 'warning' | 'danger' | 'success' }> {
  const badges: Array<{ label: string; tone: 'warning' | 'danger' | 'success' }> = [];
  if (user.disabled) {
    badges.push({ label: 'Disabled', tone: 'danger' });
  }
  if (user.platformUserRiskStatus === 'under_review') {
    badges.push({ label: 'Under review', tone: 'warning' });
  } else if (user.platformUserRiskStatus && user.platformUserRiskStatus !== 'clear') {
    badges.push({ label: humanizeRiskLabel(user.platformUserRiskStatus), tone: 'warning' });
  }
  if (user.platformUserWarningCount > 0) {
    badges.push({ label: user.platformUserWarningCount === 1 ? 'Warning' : `${user.platformUserWarningCount} warnings`, tone: 'warning' });
  }
  if (user.isQaUser) {
    badges.push({ label: 'QA', tone: 'warning' });
  }
  return badges;
}

export function summarizeUserRisk(user: WebPlatformAdminUser) {
  if (user.platformUserRiskStatus === 'under_review') {
    return user.platformUserWarningCount > 0
      ? `Under review · ${user.platformUserWarningCount} warning${user.platformUserWarningCount === 1 ? '' : 's'}`
      : 'Under review';
  }
  if (user.platformUserRiskStatus && user.platformUserRiskStatus !== 'clear') {
    return humanizeRiskLabel(user.platformUserRiskStatus);
  }
  if (user.platformUserWarningCount > 0) {
    return `${user.platformUserWarningCount} warning${user.platformUserWarningCount === 1 ? '' : 's'}`;
  }
  return 'No active risk signal';
}

function summarizeAccountState(user: WebPlatformAdminUser) {
  if (user.disabled) {
    return 'Disabled';
  }
  if (user.status === 'no_workspace') {
    return 'No workspace attached';
  }
  return 'Active account';
}

function humanizeRiskLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function summarizeWorkspaceContexts(workspaces: WebPlatformAdminUserWorkspaceContext[]) {
  if (!workspaces.length) {
    return 'No workspace attached';
  }
  if (workspaces.length === 1) {
    const workspace = workspaces[0];
    return workspace.accessSource === 'owner' ? 'Owner access' : workspace.officeRole ?? 'Office member';
  }
  return `${workspaces.length} workspace contexts available`;
}

export function initials(value: string) {
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

export function getUserMfaEnrollmentCount(user: object | null) {
  const multiFactor = user ? (user as { multiFactor?: { enrolledFactors?: unknown[] } }).multiFactor : null;
  return Array.isArray(multiFactor?.enrolledFactors) ? multiFactor.enrolledFactors.length : 0;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function BackofficeFieldHelp({ text }: { text: string }) {
  return (
    <details className="ol-field-info">
      <summary aria-label="Field help">?</summary>
      <span>{text}</span>
    </details>
  );
}

export function buildPlatformAdminReportPrintHtml(report: WebPlatformAdminReport) {
  const filterMarkup = report.filters.length
    ? `<p>Filters: ${escapeHtml(report.filters.join(' · '))}</p>`
    : '<p>No local filters applied.</p>';
  const headerCells = report.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const rows = report.rows.length
    ? report.rows
        .map(
          (row) => `
        <tr>
          ${report.columns.map((column) => `<td>${escapeHtml(row[column.key] ?? '')}</td>`).join('')}
        </tr>`
        )
        .join('')
    : `<tr><td colspan="${report.columns.length}">No rows available for this report.</td></tr>`;

  return `<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(report.title)}</title>
        <style>
          @page { margin: 18mm; }
          body { font-family: Inter, Arial, sans-serif; color: #111827; margin: 0; }
          header { border-bottom: 2px solid #d7e2f2; padding-bottom: 14px; margin-bottom: 18px; }
          h1 { margin: 0 0 8px; font-size: 26px; }
          p { margin: 4px 0 0; color: #607087; line-height: 1.45; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 18px; }
          .meta div { border: 1px solid #d7e2f2; border-radius: 12px; padding: 10px; }
          .meta span { display: block; color: #607087; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
          .meta strong { display: block; margin-top: 5px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th { text-align: left; color: #607087; border: 1px solid #d7e2f2; background: #f4f7fb; padding: 7px; }
          td { border: 1px solid #e4ebf5; padding: 7px; vertical-align: top; overflow-wrap: anywhere; }
          footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #d7e2f2; color: #607087; font-size: 11px; }
        </style>
      </head>
      <body>
        <header>
          <h1>${escapeHtml(report.title)}</h1>
          <p>${escapeHtml(report.description)}</p>
          ${filterMarkup}
        </header>
        <section class="meta">
          <div><span>Generated by</span><strong>${escapeHtml(report.generatedBy)}</strong></div>
          <div><span>Admin role</span><strong>${escapeHtml(report.adminRole)}</strong></div>
          <div><span>Generated</span><strong>${escapeHtml(formatPlatformAdminDate(report.generatedAt))}</strong></div>
          <div><span>Rows</span><strong>${report.rows.length.toLocaleString('en-IN')}</strong></div>
        </section>
        <table>
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <footer>Created with Orbit Ledger · Internal platform admin report · ${escapeHtml(report.type.replaceAll('_', ' '))}</footer>
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
