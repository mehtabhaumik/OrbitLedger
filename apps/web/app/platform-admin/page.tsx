'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  canPlatformAdminRole,
  getPlatformAdminRoleDefinition,
  PLATFORM_ADMIN_ROLES,
  type PlatformAdminRole,
} from '@orbit-ledger/core';

import {
  buildWebPlatformAdminReport,
  buildWebPlatformAdminReportCsv,
  buildWebPlatformAdminSaasHealthCharts,
  filterWebPlatformAdminAuditRecords,
  filterWebPlatformAdminOffers,
  filterWebPlatformAdminUsers,
  formatPlatformAdminDate,
  loadWebPlatformAdminAuditTrail,
  loadWebPlatformAdminSnapshot,
  manageWebPlatformAdminAccount,
  manageWebPlatformAdminOffer,
  manageWebPlatformAdminUser,
  recordWebPlatformAdminReportEvent,
  type WebPlatformAdminAccountAction,
  type WebPlatformAdminAuditFilters,
  type WebPlatformAdminAuditRecord,
  type WebPlatformAdminChartDatum,
  type WebPlatformAdminOffer,
  type WebPlatformAdminOfferAction,
  type WebPlatformAdminOfferDiscountType,
  type WebPlatformAdminOfferScope,
  type WebPlatformAdminReport,
  type WebPlatformAdminReportType,
  type WebPlatformAdminRegistryRecord,
  type WebPlatformAdminSnapshot,
  type WebPlatformAdminUser,
  type WebPlatformAdminUserAction,
  WEB_PLATFORM_ADMIN_REPORT_DEFINITIONS,
} from '@/lib/platform-admin';
import {
  WEB_PLATFORM_ADMIN_ABSOLUTE_TIMEOUT_MS,
  WEB_PLATFORM_ADMIN_IDLE_TIMEOUT_MS,
} from '@/lib/session-security';
import { useAuth } from '@/providers/auth-provider';
import { useConfirmDialog } from '@/providers/confirm-dialog-provider';

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

type OfferFormState = {
  action: WebPlatformAdminOfferAction;
  offerId: string;
  label: string;
  title: string;
  publicBannerMessage: string;
  internalNote: string;
  scope: WebPlatformAdminOfferScope;
  discountType: WebPlatformAdminOfferDiscountType;
  discountValue: string;
  currency: string;
  targetEmails: string;
  targetUids: string;
  targetWorkspaceIds: string;
  targetPlanIds: string;
  targetCountries: string;
  startAt: string;
  expiresAt: string;
  lifetimeConfirmed: boolean;
  reason: string;
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

const DEFAULT_OFFER_FORM: OfferFormState = {
  action: 'create',
  offerId: '',
  label: '',
  title: '',
  publicBannerMessage: '',
  internalNote: '',
  scope: 'sitewide',
  discountType: 'percentage',
  discountValue: '10',
  currency: '',
  targetEmails: '',
  targetUids: '',
  targetWorkspaceIds: '',
  targetPlanIds: '',
  targetCountries: '',
  startAt: '',
  expiresAt: '',
  lifetimeConfirmed: false,
  reason: '',
};

const DEFAULT_AUDIT_FILTERS: WebPlatformAdminAuditFilters = {
  action: '',
  actor: '',
  target: '',
  severity: '',
  fromDate: '',
  toDate: '',
};

const PLATFORM_ADMIN_NAV_ITEMS = [
  { href: '#overview', label: 'Overview' },
  { href: '#saas-health', label: 'SaaS Health' },
  { href: '#settings', label: 'Safety' },
  { href: '#users', label: 'Users' },
  { href: '#admins', label: 'Admins' },
  { href: '#offers', label: 'Billing & Offers' },
  { href: '#office', label: 'Office' },
  { href: '#support', label: 'Support' },
  { href: '#live-collections', label: 'Live Collections' },
  { href: '#reports', label: 'Reports' },
  { href: '#audit', label: 'Audit' },
] as const;

const MFA_READINESS_COPY: Record<
  PlatformAdminRole,
  {
    requirement: string;
    detail: string;
  }
> = {
  super_admin: {
    requirement: 'Required before scale',
    detail: 'Break-glass Super Admin access should be protected with MFA before the admin surface scales beyond a tiny operator group.',
  },
  finance_admin: {
    requirement: 'Required before scale',
    detail: 'Pricing overrides, offer control, and billing exports should move behind MFA before broader finance operations begin.',
  },
  admin: {
    requirement: 'Strongly recommended',
    detail: 'User lifecycle and support-sensitive actions should use MFA whenever this role is actively used.',
  },
  support_admin: {
    requirement: 'Strongly recommended',
    detail: 'Support review and warning workflows should use MFA when real customer-impact operations begin.',
  },
  read_only_admin: {
    requirement: 'Optional but recommended',
    detail: 'Read-only reporting can stay available without MFA, but operational review is safer with it turned on.',
  },
};

export default function PlatformAdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { confirm, prompt } = useConfirmDialog();
  const [snapshot, setSnapshot] = useState<WebPlatformAdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pageTokens, setPageTokens] = useState<Array<string | null>>([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
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
  const [offerSearch, setOfferSearch] = useState('');
  const [offerMessage, setOfferMessage] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [offerForm, setOfferForm] = useState<OfferFormState>(DEFAULT_OFFER_FORM);
  const [reportType, setReportType] = useState<WebPlatformAdminReportType>('user_registry');
  const [reportPreviewPage, setReportPreviewPage] = useState(0);
  const users = useMemo(() => filterWebPlatformAdminUsers(snapshot?.users ?? [], search), [search, snapshot?.users]);
  const visibleOffers = useMemo(
    () => filterWebPlatformAdminOffers(snapshot?.offers ?? [], offerSearch),
    [offerSearch, snapshot?.offers]
  );
  const visibleAuditRecords = useMemo(
    () => filterWebPlatformAdminAuditRecords(auditTrail, auditSearch),
    [auditSearch, auditTrail]
  );
  const admins = snapshot?.admins ?? [];
  const isSuperAdmin = snapshot?.adminAccess?.role === 'super_admin';
  const adminRole = snapshot?.adminAccess?.role ?? null;
  const adminRoleLabel = adminRole ? getPlatformAdminRoleDefinition(adminRole).label : 'Emergency allowlist Super Admin';
  const canManageOffers = isSuperAdmin || snapshot?.adminAccess?.role === 'finance_admin';
  const canControlUsers =
    snapshot?.adminAccess?.role === 'super_admin' ||
    snapshot?.adminAccess?.role === 'admin' ||
    snapshot?.adminAccess?.role === 'support_admin';
  const canSuspendUsers = snapshot?.adminAccess?.role === 'super_admin' || snapshot?.adminAccess?.role === 'admin';
  const canDownloadReports = adminRole ? canPlatformAdminRole(adminRole, 'download_admin_reports') : true;
  const mfaEnrolledCount = getUserMfaEnrollmentCount(user);
  const mfaRequirement = adminRole ? MFA_READINESS_COPY[adminRole] : null;
  const mfaStatusTone =
    mfaEnrolledCount > 0
      ? 'success'
      : adminRole === 'super_admin' || adminRole === 'finance_admin'
        ? 'danger'
        : 'warning';
  const adminSessionLabel = `${Math.round(WEB_PLATFORM_ADMIN_IDLE_TIMEOUT_MS / 60_000)} min idle · ${Math.round(
    WEB_PLATFORM_ADMIN_ABSOLUTE_TIMEOUT_MS / 3_600_000
  )} hr max`;
  const userControlNeedsMessage =
    userControlForm.action === 'send_warning' || userControlForm.action === 'add_internal_note';
  const userControlSubmitDisabled =
    isSavingUserControl ||
    !userControlForm.targetUid.trim() ||
    userControlForm.reason.trim().length < 10 ||
    (userControlNeedsMessage && userControlForm.message.trim().length < 10);
  const activeOfferCount = useMemo(
    () => (snapshot?.offers ?? []).filter((offer) => offer.status === 'active').length,
    [snapshot?.offers]
  );
  const scheduledOfferCount = useMemo(
    () => (snapshot?.offers ?? []).filter((offer) => offer.status === 'scheduled').length,
    [snapshot?.offers]
  );
  const highSeverityAuditCount = useMemo(
    () => auditTrail.filter((record) => record.severity === 'high').length,
    [auditTrail]
  );
  const underReviewUserCount = useMemo(
    () => (snapshot?.users ?? []).filter((userRecord) => userRecord.platformUserRiskStatus === 'under_review').length,
    [snapshot?.users]
  );
  const suspendedUserCount = useMemo(
    () => (snapshot?.users ?? []).filter((userRecord) => userRecord.disabled || userRecord.platformUserStatus === 'suspended').length,
    [snapshot?.users]
  );
  const quickActionCount = [
    isSuperAdmin,
    canManageOffers,
    canControlUsers,
    visibleAuditRecords.length > 0,
  ].filter(Boolean).length;
  const saasHealthCharts = useMemo(
    () => (snapshot ? buildWebPlatformAdminSaasHealthCharts(snapshot, auditTrail) : null),
    [auditTrail, snapshot]
  );
  const reportFilterSummary = useMemo(
    () =>
      [
        search.trim() ? `User search: ${search.trim()}` : '',
        offerSearch.trim() ? `Offer search: ${offerSearch.trim()}` : '',
        auditSearch.trim() ? `Audit search: ${auditSearch.trim()}` : '',
        auditFilters.action.trim() ? `Audit action: ${auditFilters.action.trim()}` : '',
        auditFilters.actor.trim() ? `Audit actor: ${auditFilters.actor.trim()}` : '',
        auditFilters.target.trim() ? `Audit target: ${auditFilters.target.trim()}` : '',
        auditFilters.severity.trim() ? `Audit severity: ${auditFilters.severity.trim()}` : '',
        auditFilters.fromDate ? `From: ${auditFilters.fromDate}` : '',
        auditFilters.toDate ? `To: ${auditFilters.toDate}` : '',
      ].filter(Boolean),
    [auditFilters, auditSearch, offerSearch, search]
  );
  const selectedReport = useMemo(() => {
    if (!snapshot) {
      return null;
    }
    return buildWebPlatformAdminReport({
      type: reportType,
      snapshot: {
        ...snapshot,
        users,
        offers: visibleOffers,
      },
      auditRecords: visibleAuditRecords,
      generatedBy: user?.email ?? 'Platform admin',
      adminRole: adminRoleLabel,
      loadedFilterSummary: reportFilterSummary,
    });
  }, [adminRoleLabel, reportFilterSummary, reportType, snapshot, user?.email, users, visibleAuditRecords, visibleOffers]);
  const reportPreviewPageSize = 8;
  const reportPreviewPageCount = selectedReport ? Math.max(1, Math.ceil(selectedReport.rows.length / reportPreviewPageSize)) : 1;
  const visibleReportRows = selectedReport
    ? selectedReport.rows.slice(
        reportPreviewPage * reportPreviewPageSize,
        reportPreviewPage * reportPreviewPageSize + reportPreviewPageSize
      )
    : [];
  const currentPageToken = pageTokens[currentPageIndex] ?? null;
  const auditTrailReport = useMemo(() => {
    if (!snapshot) {
      return null;
    }
    return buildWebPlatformAdminReport({
      type: 'audit_trail',
      snapshot: {
        ...snapshot,
        users,
        offers: visibleOffers,
      },
      auditRecords: visibleAuditRecords,
      generatedBy: user?.email ?? 'Platform admin',
      adminRole: adminRoleLabel,
      loadedFilterSummary: reportFilterSummary,
    });
  }, [adminRoleLabel, reportFilterSummary, snapshot, user?.email, users, visibleAuditRecords, visibleOffers]);

  useEffect(() => {
    if (isAuthLoading || !user) {
      return;
    }
    setPageTokens([null]);
    setCurrentPageIndex(0);
    void refresh(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user?.uid]);

  useEffect(() => {
    setReportPreviewPage(0);
  }, [reportType, search, offerSearch, auditSearch, auditFilters, snapshot?.generatedAt]);

  async function refresh(nextPageToken: string | null, options?: { nextPageIndex?: number; rememberedTokens?: Array<string | null> }) {
    setIsLoading(true);
    setError(null);
    try {
      const nextSnapshot = await loadWebPlatformAdminSnapshot({ pageToken: nextPageToken });
      setSnapshot(nextSnapshot);
      if (options?.rememberedTokens) {
        setPageTokens(options.rememberedTokens);
      }
      setCurrentPageIndex(options?.nextPageIndex ?? 0);
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
    void refresh(currentPageToken, { nextPageIndex: currentPageIndex, rememberedTokens: pageTokens });
  }

  function handlePreviousPage() {
    const nextPageIndex = Math.max(0, currentPageIndex - 1);
    const nextPageToken = pageTokens[nextPageIndex] ?? null;
    void refresh(nextPageToken, { nextPageIndex, rememberedTokens: pageTokens });
  }

  async function handleNextPage() {
    if (!snapshot?.nextPageToken) {
      return;
    }
    const nextPageIndex = currentPageIndex + 1;
    const nextTokens = [...pageTokens];
    nextTokens[nextPageIndex] = snapshot.nextPageToken;
    await refresh(snapshot.nextPageToken, { nextPageIndex, rememberedTokens: nextTokens });
  }

  function handleFirstPage() {
    void refresh(null, { nextPageIndex: 0, rememberedTokens: [null] });
  }

  function scrollToAdminSection(sectionId: string) {
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function openCreateAdminForm() {
    setAdminActionError(null);
    setAdminActionMessage(null);
    setAdminForm(DEFAULT_ADMIN_FORM);
  }

  function openCreateAdminFromOverview() {
    openCreateAdminForm();
    scrollToAdminSection('admins');
  }

  function focusUserSearchFromOverview() {
    scrollToAdminSection('users');
    window.setTimeout(() => document.getElementById('platform-admin-search')?.focus(), 160);
  }

  function reviewWarningsFromOverview() {
    setSearch('under_review');
    scrollToAdminSection('user-controls');
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

  async function confirmAdminFormSubmission() {
    const isDestructive = adminForm.action === 'suspend' || adminForm.action === 'revoke';
    const isElevatedRoleChange = adminForm.action === 'change_role' && adminForm.role === 'super_admin';
    if (!isDestructive && !isElevatedRoleChange) {
      return true;
    }

    const confirmed = await confirm({
      title: isDestructive ? 'Confirm admin access change' : 'Confirm elevated admin change',
      message:
        adminForm.action === 'revoke'
          ? 'Revoking platform admin access immediately removes future admin access for this account.'
          : 'This admin change affects who can operate sensitive Orbit Ledger controls.',
      detail: adminForm.reason.trim(),
      confirmLabel: adminForm.action === 'revoke' ? 'Continue revoke' : 'Continue',
      tone: isDestructive ? 'danger' : 'default',
    });
    if (!confirmed) {
      return false;
    }

    if (adminForm.action === 'revoke' && adminForm.role === 'super_admin') {
      const typed = await prompt({
        title: 'Second confirmation required',
        message: 'Type REVOKE SUPER ADMIN to confirm this break-glass revoke.',
        detail: 'This protects accidental removal of the highest privilege account.',
        inputLabel: 'Type REVOKE SUPER ADMIN',
        placeholder: 'REVOKE SUPER ADMIN',
        required: true,
        confirmLabel: 'Confirm revoke',
        tone: 'danger',
      });
      if (typed !== 'REVOKE SUPER ADMIN') {
        setAdminActionError('Type REVOKE SUPER ADMIN exactly to continue.');
        return false;
      }
    }

    return true;
  }

  async function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminActionError(null);
    setAdminActionMessage(null);
    const confirmed = await confirmAdminFormSubmission();
    if (!confirmed) {
      return;
    }
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
      await refresh(currentPageToken, { nextPageIndex: currentPageIndex, rememberedTokens: pageTokens });
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

  async function confirmUserControlSubmission() {
    const isDestructive = userControlForm.action === 'suspend_user' || userControlForm.action === 'restore_user';
    const isRiskReview = userControlForm.action === 'mark_under_review' || userControlForm.action === 'clear_under_review';
    if (!isDestructive && !isRiskReview) {
      return true;
    }

    return confirm({
      title: isDestructive ? 'Confirm user status change' : 'Confirm risk review update',
      message:
        userControlForm.action === 'suspend_user'
          ? 'Suspending a user immediately blocks sign-in until an admin restores access.'
          : userControlForm.action === 'restore_user'
            ? 'Restoring a user allows sign-in again after review.'
            : 'This updates the user risk state shown in the admin registry and audit trail.',
      detail: userControlForm.reason.trim(),
      confirmLabel: 'Continue',
      tone: isDestructive ? 'danger' : 'default',
    });
  }

  async function handleUserControlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserControlError(null);
    setUserControlMessage(null);
    const confirmed = await confirmUserControlSubmission();
    if (!confirmed) {
      return;
    }
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
      await refresh(currentPageToken, { nextPageIndex: currentPageIndex, rememberedTokens: pageTokens });
      await refreshAudit(auditFilters);
      setUserControlForm((current) => ({ ...current, reason: '', message: '', riskLabel: '' }));
    } catch (submitError) {
      setUserControlError(submitError instanceof Error ? submitError.message : 'Platform user control action failed.');
    } finally {
      setIsSavingUserControl(false);
    }
  }

  function openOfferForm(offer: WebPlatformAdminOffer, action: WebPlatformAdminOfferAction = 'update') {
    setOfferError(null);
    setOfferMessage(null);
    setOfferForm({
      action,
      offerId: offer.id,
      label: offer.label,
      title: offer.title,
      publicBannerMessage: offer.publicBannerMessage,
      internalNote: offer.internalNote ?? '',
      scope: offer.scope,
      discountType: offer.discountType,
      discountValue: String(offer.discountValue),
      currency: offer.currency ?? '',
      targetEmails: offer.targetEmails.join(', '),
      targetUids: offer.targetUids.join(', '),
      targetWorkspaceIds: offer.targetWorkspaceIds.join(', '),
      targetPlanIds: offer.targetPlanIds.join(', '),
      targetCountries: offer.targetCountries.join(', '),
      startAt: offer.startAt ? offer.startAt.slice(0, 16) : '',
      expiresAt: offer.expiresAt ? offer.expiresAt.slice(0, 16) : '',
      lifetimeConfirmed: offer.lifetimeConfirmed,
      reason: '',
    });
  }

  function openCreateOfferForm() {
    setOfferError(null);
    setOfferMessage(null);
    setOfferForm(DEFAULT_OFFER_FORM);
  }

  function openCreateOfferFromOverview() {
    openCreateOfferForm();
    scrollToAdminSection('offers');
  }

  function openReportsFromOverview() {
    scrollToAdminSection('reports');
  }

  async function confirmOfferFormSubmission() {
    const isDestructive = offerForm.action === 'deactivate' || offerForm.action === 'remove';
    const isPricingChange = offerForm.action === 'create' || offerForm.action === 'update';
    if (isDestructive || isPricingChange) {
      const confirmed = await confirm({
        title: isDestructive ? 'Confirm offer removal' : 'Confirm pricing change',
        message:
          offerForm.action === 'remove'
            ? 'Removing an offer stops future eligibility and preserves only the historical audit trail.'
            : 'This changes what eligible users see in offer banners and checkout pricing.',
        detail: offerForm.reason.trim(),
        confirmLabel: isDestructive ? 'Continue' : 'Apply pricing change',
        tone: isDestructive ? 'danger' : 'default',
      });
      if (!confirmed) {
        return false;
      }
    }

    if (offerForm.lifetimeConfirmed && !offerForm.expiresAt) {
      const typed = await prompt({
        title: 'Second confirmation required',
        message: 'Type LIFETIME OFFER to confirm this no-expiry discount.',
        detail: 'Lifetime discounts should be rare and explicitly reviewed before saving.',
        inputLabel: 'Type LIFETIME OFFER',
        placeholder: 'LIFETIME OFFER',
        required: true,
        confirmLabel: 'Confirm lifetime offer',
        tone: 'danger',
      });
      if (typed !== 'LIFETIME OFFER') {
        setOfferError('Type LIFETIME OFFER exactly to continue.');
        return false;
      }
    }

    return true;
  }

  async function handleOfferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOfferError(null);
    setOfferMessage(null);
    const confirmed = await confirmOfferFormSubmission();
    if (!confirmed) {
      return;
    }
    setIsSavingOffer(true);
    try {
      await manageWebPlatformAdminOffer({
        action: offerForm.action,
        offerId: offerForm.offerId || null,
        label: offerForm.label,
        title: offerForm.title,
        publicBannerMessage: offerForm.publicBannerMessage,
        internalNote: offerForm.internalNote,
        scope: offerForm.scope,
        discountType: offerForm.discountType,
        discountValue: Number(offerForm.discountValue),
        currency: offerForm.currency || null,
        targetEmails: offerForm.targetEmails,
        targetUids: offerForm.targetUids,
        targetWorkspaceIds: offerForm.targetWorkspaceIds,
        targetPlanIds: offerForm.targetPlanIds,
        targetCountries: offerForm.targetCountries,
        startAt: offerForm.startAt || null,
        expiresAt: offerForm.expiresAt || null,
        lifetimeConfirmed: offerForm.lifetimeConfirmed,
        reason: offerForm.reason,
      });
      setOfferMessage('Offer change was saved and recorded for audit.');
      await refresh(currentPageToken, { nextPageIndex: currentPageIndex, rememberedTokens: pageTokens });
      await refreshAudit(auditFilters);
      setOfferForm((current) => (current.action === 'create' ? DEFAULT_OFFER_FORM : { ...current, reason: '' }));
    } catch (submitError) {
      setOfferError(submitError instanceof Error ? submitError.message : 'Offer change could not be saved.');
    } finally {
      setIsSavingOffer(false);
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

  async function recordReportEvent(report: WebPlatformAdminReport, action: 'download_csv' | 'print_report') {
    await recordWebPlatformAdminReportEvent({
      action,
      report,
    });
  }

  async function downloadAuditCsv() {
    if (!auditTrailReport) {
      return;
    }
    try {
      await recordReportEvent(auditTrailReport, 'download_csv');
      downloadTextFile(
        buildWebPlatformAdminReportCsv(auditTrailReport),
        `orbit-ledger-${auditTrailReport.type}-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8'
      );
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Platform admin report export could not be recorded.');
    }
  }

  async function printAuditReport() {
    if (!auditTrailReport) {
      return;
    }
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
      setAuditError('Browser blocked the print report. Allow pop-ups for Orbit Ledger and try again.');
      return;
    }
    try {
      await recordReportEvent(auditTrailReport, 'print_report');
    } catch (error) {
      popup.close();
      setAuditError(error instanceof Error ? error.message : 'Platform admin report export could not be recorded.');
      return;
    }
    popup.document.write(buildPlatformAdminReportPrintHtml(auditTrailReport));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function downloadSelectedReport() {
    if (!selectedReport) {
      return;
    }
    try {
      await recordReportEvent(selectedReport, 'download_csv');
      downloadTextFile(
        buildWebPlatformAdminReportCsv(selectedReport),
        `orbit-ledger-${selectedReport.type}-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8'
      );
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Platform admin report export could not be recorded.');
    }
  }

  async function printSelectedReport() {
    if (!selectedReport) {
      return;
    }
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
      setAuditError('Browser blocked the report print view. Allow pop-ups for Orbit Ledger and try again.');
      return;
    }
    try {
      await recordReportEvent(selectedReport, 'print_report');
    } catch (error) {
      popup.close();
      setAuditError(error instanceof Error ? error.message : 'Platform admin report export could not be recorded.');
      return;
    }
    popup.document.write(buildPlatformAdminReportPrintHtml(selectedReport));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function downloadTextFile(contents: string, filename: string, type: string) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

        <div className="ol-platform-admin-layout">
          <aside className="ol-platform-admin-sidebar" aria-label="Platform admin navigation">
            <div>
              <span className="ol-platform-admin-sidebar-label">Admin navigation</span>
              <strong>Control center</strong>
            </div>
            <nav>
              {PLATFORM_ADMIN_NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="ol-platform-admin-workspace">
            <section className="ol-platform-admin-overview" id="overview">
              <div className="ol-platform-admin-section-head">
                <div>
                  <p className="ol-chip">Overview</p>
                  <h2>Platform operations</h2>
                  <p>Users, admins, offers, access signals, and audit readiness in one review surface.</p>
                </div>
                <span className="ol-platform-admin-status-pill" data-tone={highSeverityAuditCount ? 'danger' : 'success'}>
                  {highSeverityAuditCount ? `${highSeverityAuditCount} high-risk audit item(s)` : 'No high-risk audit items loaded'}
                </span>
              </div>

              <section className="ol-platform-admin-metrics" aria-label="Platform user metrics">
                <MetricCard label="Registered users" value={snapshot?.metrics.userCount ?? 0} />
                <MetricCard label="Google users" value={snapshot?.metrics.googleUserCount ?? 0} />
                <MetricCard label="Email/password users" value={snapshot?.metrics.passwordUserCount ?? 0} />
                <MetricCard label="Users with workspace" value={snapshot?.metrics.usersWithWorkspaceCount ?? 0} />
                <MetricCard label="Workspace owners" value={snapshot?.metrics.workspaceOwnerCount ?? 0} />
                <MetricCard label="Office members" value={snapshot?.metrics.officeMemberCount ?? 0} />
                <MetricCard label="Total admin users" value={snapshot?.metrics.platformAdminCount ?? 0} tone="premium" />
                <MetricCard label="Active admin users" value={snapshot?.metrics.activePlatformAdminCount ?? 0} tone="premium" />
                <MetricCard label="QA users" value={snapshot?.metrics.qaUserCount ?? 0} tone="warning" />
                <MetricCard label="Subscribed users" value={snapshot?.metrics.subscribedUserCount ?? 0} tone="success" />
                <MetricCard label="Verified emails" value={snapshot?.metrics.verifiedEmailCount ?? 0} />
                <MetricCard label="No workspace" value={snapshot?.metrics.usersWithoutWorkspaceCount ?? 0} tone="warning" />
                <MetricCard label="Disabled users" value={snapshot?.metrics.disabledCount ?? 0} tone="danger" />
              </section>

              <div className="ol-platform-admin-dashboard-grid">
                <section className="ol-platform-admin-quick-actions" aria-label="Platform admin quick actions">
                  <div>
                    <span className="ol-platform-admin-sidebar-label">Quick actions</span>
                    <strong>{quickActionCount} available for your role</strong>
                  </div>
                  <div className="ol-platform-admin-quick-action-list">
                    {isSuperAdmin ? (
                      <button className="ol-button-secondary" type="button" onClick={openCreateAdminFromOverview}>
                        Add admin
                      </button>
                    ) : null}
                    <button className="ol-button-secondary" type="button" onClick={focusUserSearchFromOverview}>
                      Search user
                    </button>
                    {canManageOffers ? (
                      <button className="ol-button-secondary" type="button" onClick={openCreateOfferFromOverview}>
                        Create offer
                      </button>
                    ) : null}
                    {canControlUsers ? (
                      <button className="ol-button-secondary" type="button" onClick={reviewWarningsFromOverview}>
                        Review warnings
                      </button>
                    ) : null}
                    <button
                      className="ol-button-secondary"
                      type="button"
                      onClick={openReportsFromOverview}
                      disabled={!selectedReport}
                    >
                      {canDownloadReports ? 'Export report' : 'Open reports'}
                    </button>
                  </div>
                </section>

                <section className="ol-platform-admin-health-card">
                  <span className="ol-platform-admin-sidebar-label">Signals</span>
                  <div className="ol-platform-admin-health-list">
                    <StatusSignal label="Users under review" value={underReviewUserCount} tone={underReviewUserCount ? 'warning' : 'success'} />
                    <StatusSignal label="Suspended users" value={suspendedUserCount} tone={suspendedUserCount ? 'danger' : 'success'} />
                    <StatusSignal label="Active offers" value={activeOfferCount} tone={activeOfferCount ? 'premium' : 'default'} />
                    <StatusSignal label="Scheduled offers" value={scheduledOfferCount} tone={scheduledOfferCount ? 'warning' : 'default'} />
                  </div>
                </section>
              </div>

              {saasHealthCharts ? (
                <section className="ol-platform-admin-chart-suite" id="saas-health" aria-label="SaaS health metrics">
                  <div className="ol-platform-admin-section-head ol-platform-admin-chart-head">
                    <div>
                      <p className="ol-chip">SaaS health</p>
                      <h2>Growth, adoption, and risk signals</h2>
                      <p>Compact charts for user growth, activation, offer exposure, admin role mix, and audit severity.</p>
                    </div>
                    <span className="ol-platform-admin-status-pill" data-tone="premium">
                      {(snapshot?.users.length ?? 0).toLocaleString('en-IN')} of {(snapshot?.metrics.userCount ?? 0).toLocaleString('en-IN')} user record(s) loaded
                    </span>
                  </div>
                  <div className="ol-platform-admin-chart-grid">
                    <AdminTrendChart
                      title="New users"
                      subtitle="Last six months"
                      data={saasHealthCharts.newUsersTrend}
                      actionLabel="Open users"
                      actionHref="#users"
                    />
                    <AdminDonutChart
                      title="User status"
                      subtitle="Active, not onboarded, disabled"
                      data={saasHealthCharts.userStatusMix}
                      actionLabel="Review users"
                      actionHref="#users"
                    />
                    <AdminStackedChart
                      title="Workspace adoption"
                      subtitle="Workspace and Office activation"
                      data={saasHealthCharts.workspaceAdoption}
                      actionLabel="Open Office"
                      actionHref="#office"
                    />
                    <AdminStackedChart
                      title="Offer status"
                      subtitle="Pricing exposure by lifecycle"
                      data={saasHealthCharts.offerStatusMix}
                      actionLabel="Open offers"
                      actionHref="#offers"
                    />
                    <AdminHorizontalBars
                      title="Audit severity"
                      subtitle="Loaded audit events"
                      data={saasHealthCharts.auditSeverityMix}
                      actionLabel="Open audit"
                      actionHref="#audit"
                    />
                    <AdminHorizontalBars
                      title="Admin roles"
                      subtitle="Registry role distribution"
                      data={saasHealthCharts.adminRoleMix}
                      actionLabel="Open admins"
                      actionHref="#admins"
                    />
                  </div>
                </section>
              ) : null}

              <section className="ol-platform-admin-operations-map" aria-label="Platform admin work areas">
                <AdminAreaCard id="office" title="Office" value={`${snapshot?.metrics.officeMemberCount ?? 0} active member(s)`} detail="Team access and multi-company operations." />
                <AdminAreaCard id="support" title="Support" value="Consent-bound" detail="Support review stays separate from user-led workspace control." />
                <AdminAreaCard id="live-collections" title="Live Collections" value="Payment events" detail="Razorpay-linked payment updates and review signals." />
                <AdminAreaCard title="Reports" value="Print-ready" detail="Admin reports export from audit and registry data." />
                <AdminAreaCard title="Settings" value={snapshot?.adminAccess?.customClaimsReady ? 'Claims active' : 'Allowlist fallback'} detail="Admin session, permissions, and sensitive controls." />
              </section>
            </section>

            <section className="ol-panel ol-platform-admin-control-panel">
              <div className="ol-platform-admin-status">
                <div>
                  <span className="ol-muted">Role</span>
                  <strong>
                    {snapshot?.adminAccess ? `${adminRoleLabel} · ${snapshot.adminAccess.roleSource}` : 'Emergency allowlist'}
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

            <section className="ol-platform-admin-table-card" id="settings">
              <div className="ol-platform-admin-table-head">
                <div>
                  <strong>Safety controls</strong>
                  <span>Session policy, MFA readiness, export permissions, and abuse guardrails for the admin surface</span>
                </div>
                <span className="ol-platform-admin-status-pill" data-tone={mfaStatusTone}>
                  {mfaEnrolledCount > 0 ? `${mfaEnrolledCount} MFA factor(s) ready` : mfaRequirement?.requirement ?? 'Review required'}
                </span>
              </div>
              <div className="ol-platform-admin-safety-grid">
                <article className="ol-platform-admin-safety-card">
                  <span className="ol-platform-admin-sidebar-label">Session policy</span>
                  <strong>{adminSessionLabel}</strong>
                  <p>
                    Platform Admin uses a stricter tracked session than the regular workspace shell so sensitive admin tabs do
                    not stay open unattended.
                  </p>
                </article>
                <article className="ol-platform-admin-safety-card">
                  <span className="ol-platform-admin-sidebar-label">MFA readiness</span>
                  <strong>{mfaRequirement?.requirement ?? 'Emergency allowlist review'}</strong>
                  <p>{mfaRequirement?.detail ?? 'Break-glass allowlist access should be reviewed carefully before broader use.'}</p>
                </article>
                <article className="ol-platform-admin-safety-card">
                  <span className="ol-platform-admin-sidebar-label">Report exports</span>
                  <strong>{canDownloadReports ? 'Export allowed for this role' : 'View-only for this role'}</strong>
                  <p>
                    CSV downloads and print actions are audit logged, permission checked on the server, and rate-limited to
                    reduce abuse.
                  </p>
                </article>
              </div>
            </section>

            <section className="ol-platform-admin-table-card ol-platform-admin-report-card" id="reports">
              <div className="ol-platform-admin-table-head">
                <div>
                  <strong>Reports</strong>
                  <span>CSV and print-safe exports generated from loaded Platform Admin data</span>
                </div>
                <div className="ol-platform-admin-row-actions">
                  {canDownloadReports ? (
                    <>
                      <button className="ol-button-secondary" type="button" onClick={downloadSelectedReport} disabled={!selectedReport}>
                        Download CSV
                      </button>
                      <button className="ol-button-secondary" type="button" onClick={printSelectedReport} disabled={!selectedReport}>
                        Print report
                      </button>
                    </>
                  ) : (
                    <span className="ol-platform-admin-status-pill" data-tone="warning">
                      Export limited to Admin, Finance, Read-only, and Super Admin
                    </span>
                  )}
                </div>
              </div>
              <div className="ol-platform-admin-report-builder">
                <div className="ol-platform-admin-report-list" aria-label="Admin report types">
                  {WEB_PLATFORM_ADMIN_REPORT_DEFINITIONS.map((definition) => (
                    <button
                      key={definition.type}
                      className="ol-platform-admin-report-option"
                      data-active={reportType === definition.type}
                      type="button"
                      onClick={() => setReportType(definition.type)}
                    >
                      <strong>{definition.title}</strong>
                      <span>{definition.description}</span>
                    </button>
                  ))}
                </div>

                <div className="ol-platform-admin-report-preview">
                  {selectedReport ? (
                    <>
                      <div className="ol-platform-admin-report-summary">
                        <div>
                          <span className="ol-platform-admin-sidebar-label">Selected report</span>
                          <strong>{selectedReport.title}</strong>
                          <p>{selectedReport.description}</p>
                        </div>
                        <div className="ol-platform-admin-report-meta">
                          <span>{selectedReport.rows.length.toLocaleString('en-IN')} row(s)</span>
                          <span>
                            Preview page {Math.min(reportPreviewPage + 1, reportPreviewPageCount)} of {reportPreviewPageCount}
                          </span>
                          <span>{selectedReport.adminRole}</span>
                          <span>Generated by {selectedReport.generatedBy}</span>
                          <span>{formatPlatformAdminDate(selectedReport.generatedAt)}</span>
                        </div>
                      </div>
                      {selectedReport.filters.length ? (
                        <div className="ol-platform-admin-report-filters">
                          {selectedReport.filters.map((filter) => (
                            <span key={filter}>{filter}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="ol-platform-admin-report-note">No local filters are currently applied.</p>
                      )}
                      <div className="ol-platform-admin-report-table-wrap">
                        <table className="ol-platform-admin-report-table">
                          <thead>
                            <tr>
                              {selectedReport.columns.map((column) => (
                                <th key={column.key}>{column.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleReportRows.map((row, rowIndex) => (
                              <tr key={`${selectedReport.type}-${reportPreviewPage}-${rowIndex}`}>
                                {selectedReport.columns.map((column) => (
                                  <td key={column.key}>{row[column.key] ?? ''}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="ol-platform-admin-pagination">
                        <button
                          className="ol-button-secondary"
                          type="button"
                          onClick={() => setReportPreviewPage((current) => Math.max(0, current - 1))}
                          disabled={reportPreviewPage === 0}
                        >
                          Previous preview page
                        </button>
                        <button
                          className="ol-button-secondary"
                          type="button"
                          onClick={() => setReportPreviewPage((current) => Math.min(reportPreviewPageCount - 1, current + 1))}
                          disabled={reportPreviewPage >= reportPreviewPageCount - 1}
                        >
                          Next preview page
                        </button>
                      </div>
                      <p className="ol-platform-admin-report-note">
                        Preview shows {visibleReportRows.length.toLocaleString('en-IN')} row(s) from the current report page. CSV and print include {selectedReport.rows.length.toLocaleString('en-IN')} loaded row(s).
                      </p>
                    </>
                  ) : (
                    <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
                      <h2>No report available</h2>
                      <p>Refresh the registry, then choose a report type.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

        <section className="ol-platform-admin-table-card" id="admins">
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

        <section className="ol-platform-admin-table-card" id="offers">
          <div className="ol-platform-admin-table-head">
            <div>
              <strong>Offers</strong>
              <span>{visibleOffers.length} shown · dashboard banners and market prices use the server resolver</span>
            </div>
            <div className="ol-platform-admin-row-actions">
              {canManageOffers ? (
                <button className="ol-button-secondary" type="button" onClick={openCreateOfferForm}>
                  Create offer
                </button>
              ) : (
                <span className="ol-platform-admin-status-pill" data-tone="warning">
                  Finance Admin or Super Admin
                </span>
              )}
            </div>
          </div>

          <div className="ol-platform-admin-offer-tools">
            <label className="ol-form-field">
              <span>Search offers</span>
              <input
                className="ol-input"
                value={offerSearch}
                onChange={(event) => setOfferSearch(event.target.value)}
                placeholder="Label, scope, target, plan, country, reason"
              />
            </label>
          </div>

          <div className="ol-platform-admin-management ol-platform-admin-offer-management">
            <div className="ol-platform-admin-admin-list">
              {visibleOffers.length ? (
                visibleOffers.map((offer) => (
                  <OfferRow key={offer.id} offer={offer} canManage={canManageOffers} onManage={openOfferForm} />
                ))
              ) : (
                <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
                  <h2>No offers found</h2>
                  <p>Create a future, sitewide, or selected-account offer from the form.</p>
                </div>
              )}
            </div>

            {canManageOffers ? (
              <form className="ol-platform-admin-admin-form" onSubmit={handleOfferSubmit}>
                <div>
                  <p className="ol-chip">Pricing control</p>
                  <h2>{offerForm.action === 'create' ? 'Create offer' : 'Manage offer'}</h2>
                  <p>
                    Dashboard banners and checkout pricing resolve from this server-owned record. Every change requires
                    a reason and writes to the admin audit trail.
                  </p>
                </div>

                {offerMessage ? (
                  <div className="ol-message" data-tone="success">
                    {offerMessage}
                  </div>
                ) : null}
                {offerError ? (
                  <div className="ol-message" data-tone="danger">
                    {offerError}
                  </div>
                ) : null}

                <div className="ol-platform-admin-form-grid">
                  <label className="ol-form-field">
                    <span>Action</span>
                    <select
                      className="ol-select"
                      value={offerForm.action}
                      onChange={(event) =>
                        setOfferForm((current) => ({ ...current, action: event.target.value as WebPlatformAdminOfferAction }))
                      }
                    >
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="deactivate">Deactivate</option>
                      <option value="remove">Remove</option>
                    </select>
                  </label>
                  <label className="ol-form-field">
                    <span>Offer ID</span>
                    <input
                      className="ol-input"
                      value={offerForm.offerId}
                      onChange={(event) => setOfferForm((current) => ({ ...current, offerId: event.target.value }))}
                      placeholder="Only needed for update/remove"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Label</span>
                    <input
                      className="ol-input"
                      value={offerForm.label}
                      onChange={(event) => setOfferForm((current) => ({ ...current, label: event.target.value }))}
                      placeholder="Launch Offer"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Title</span>
                    <input
                      className="ol-input"
                      value={offerForm.title}
                      onChange={(event) => setOfferForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Public beta launch pricing"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Scope</span>
                    <select
                      className="ol-select"
                      value={offerForm.scope}
                      onChange={(event) =>
                        setOfferForm((current) => ({ ...current, scope: event.target.value as WebPlatformAdminOfferScope }))
                      }
                    >
                      <option value="sitewide">Sitewide</option>
                      <option value="selected_users">Selected users</option>
                      <option value="selected_workspaces">Selected workspaces</option>
                      <option value="selected_plans">Selected plans</option>
                      <option value="selected_countries">Selected countries</option>
                    </select>
                  </label>
                  <label className="ol-form-field">
                    <span>Discount type</span>
                    <select
                      className="ol-select"
                      value={offerForm.discountType}
                      onChange={(event) =>
                        setOfferForm((current) => ({
                          ...current,
                          discountType: event.target.value as WebPlatformAdminOfferDiscountType,
                        }))
                      }
                    >
                      <option value="percentage">Percentage</option>
                      <option value="amount">Amount off, minor units</option>
                      <option value="fixed_price">Fixed price, minor units</option>
                      <option value="custom_tier_price">Custom tier price, minor units</option>
                    </select>
                  </label>
                  <label className="ol-form-field">
                    <span>Discount value</span>
                    <input
                      className="ol-input"
                      value={offerForm.discountValue}
                      onChange={(event) => setOfferForm((current) => ({ ...current, discountValue: event.target.value }))}
                      inputMode="numeric"
                      placeholder="20 or 49900"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Currency lock</span>
                    <input
                      className="ol-input"
                      value={offerForm.currency}
                      onChange={(event) => setOfferForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                      placeholder="Optional: INR, USD, CAD, AUD, GBP"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Start date</span>
                    <input
                      className="ol-input"
                      value={offerForm.startAt}
                      onChange={(event) => setOfferForm((current) => ({ ...current, startAt: event.target.value }))}
                      type="datetime-local"
                    />
                  </label>
                  <label className="ol-form-field">
                    <span>Expiry date</span>
                    <input
                      className="ol-input"
                      value={offerForm.expiresAt}
                      onChange={(event) => setOfferForm((current) => ({ ...current, expiresAt: event.target.value }))}
                      type="datetime-local"
                    />
                  </label>
                </div>

                <label className="ol-form-field">
                  <span>Public banner message</span>
                  <textarea
                    className="ol-input ol-textarea"
                    value={offerForm.publicBannerMessage}
                    onChange={(event) =>
                      setOfferForm((current) => ({ ...current, publicBannerMessage: event.target.value }))
                    }
                    placeholder="Example: Launch pricing is available for eligible workspaces until this offer expires."
                    rows={3}
                  />
                </label>
                <label className="ol-form-field">
                  <span>Targets</span>
                  <textarea
                    className="ol-input ol-textarea"
                    value={
                      offerForm.scope === 'selected_users'
                        ? offerForm.targetEmails
                        : offerForm.scope === 'selected_workspaces'
                          ? offerForm.targetWorkspaceIds
                          : offerForm.scope === 'selected_plans'
                            ? offerForm.targetPlanIds
                            : offerForm.scope === 'selected_countries'
                              ? offerForm.targetCountries
                              : ''
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      setOfferForm((current) => ({
                        ...current,
                        ...(current.scope === 'selected_users'
                          ? { targetEmails: value }
                          : current.scope === 'selected_workspaces'
                            ? { targetWorkspaceIds: value }
                            : current.scope === 'selected_plans'
                              ? { targetPlanIds: value }
                              : current.scope === 'selected_countries'
                                ? { targetCountries: value }
                                : {}),
                      }));
                    }}
                    placeholder="Comma-separated emails, workspace IDs, plan IDs, or country codes depending on scope"
                    rows={3}
                    disabled={offerForm.scope === 'sitewide'}
                  />
                </label>
                <label className="ol-form-field">
                  <span>Internal note</span>
                  <textarea
                    className="ol-input ol-textarea"
                    value={offerForm.internalNote}
                    onChange={(event) => setOfferForm((current) => ({ ...current, internalNote: event.target.value }))}
                    placeholder="Optional finance/admin context."
                    rows={3}
                  />
                </label>
                <label className="ol-checkbox-row">
                  <input
                    checked={offerForm.lifetimeConfirmed}
                    onChange={(event) =>
                      setOfferForm((current) => ({ ...current, lifetimeConfirmed: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span>I explicitly confirm this offer has no expiry date.</span>
                </label>
                <label className="ol-form-field">
                  <span>Reason</span>
                  <textarea
                    className="ol-input ol-textarea"
                    value={offerForm.reason}
                    onChange={(event) => setOfferForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Example: Creating a launch offer for first-wave beta conversion review."
                    rows={4}
                  />
                </label>

                <button
                  className="ol-button"
                  type="submit"
                  disabled={isSavingOffer || offerForm.reason.trim().length < 10}
                >
                  {isSavingOffer ? 'Saving offer...' : 'Save offer change'}
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="ol-platform-admin-table-card ol-platform-admin-audit-card" id="audit">
          <div className="ol-platform-admin-table-head">
            <div>
              <strong>Admin audit trail</strong>
              <span>
                {visibleAuditRecords.length} shown · Generated {formatPlatformAdminDate(auditGeneratedAt)}
              </span>
            </div>
            <div className="ol-platform-admin-row-actions">
              {canDownloadReports ? (
                <>
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
                </>
              ) : (
                <span className="ol-platform-admin-status-pill" data-tone="warning">
                  Audit export not enabled for this role
                </span>
              )}
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
          <section className="ol-platform-admin-table-card" id="user-controls">
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

        <section className="ol-platform-admin-table-card" id="users">
          <div className="ol-platform-admin-table-head">
            <strong>Users</strong>
            <span>
              {users.length.toLocaleString('en-IN')} shown · page {currentPageIndex + 1}
              {snapshot ? ` of ${snapshot.hasMore ? `${currentPageIndex + 2}+` : currentPageIndex + 1}` : ''}
            </span>
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
            <button className="ol-button-secondary" type="button" onClick={handleFirstPage} disabled={isLoading || currentPageIndex === 0}>
              First page
            </button>
            <button className="ol-button-secondary" type="button" onClick={handlePreviousPage} disabled={isLoading || currentPageIndex === 0}>
              Previous page
            </button>
            <button className="ol-button-secondary" type="button" onClick={handleNextPage} disabled={isLoading || !snapshot?.hasMore}>
              Next page
            </button>
          </div>
        </section>
          </div>
        </div>
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
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'premium';
}) {
  return (
    <article className="ol-platform-admin-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value.toLocaleString('en-IN')}</strong>
    </article>
  );
}

function AdminTrendChart({
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

function AdminDonutChart({
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

function AdminStackedChart({
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

function AdminHorizontalBars({
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

function StatusSignal({
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

function AdminAreaCard({ id, title, value, detail }: { id?: string; title: string; value: string; detail: string }) {
  return (
    <article className="ol-platform-admin-area-card" id={id}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
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

function OfferRow({
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
  const workspaceSummary = user.ownedWorkspaceCount
    ? `${user.ownedWorkspaceCount} owned workspace${user.ownedWorkspaceCount === 1 ? '' : 's'}${
        user.workspaceNames.length ? ` · ${user.workspaceNames.join(', ')}` : ''
      }`
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
        {user.isQaUser ? (
          <span className="ol-platform-admin-status-pill" data-tone="warning">
            QA user
          </span>
        ) : null}
        {user.hasActiveSubscription ? (
          <span className="ol-platform-admin-status-pill" data-tone="success">
            Active subscription
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

function getUserMfaEnrollmentCount(user: object | null) {
  const multiFactor = user ? (user as { multiFactor?: { enrolledFactors?: unknown[] } }).multiFactor : null;
  return Array.isArray(multiFactor?.enrolledFactors) ? multiFactor.enrolledFactors.length : 0;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildPlatformAdminReportPrintHtml(report: WebPlatformAdminReport) {
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
