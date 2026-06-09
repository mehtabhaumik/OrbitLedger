'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  canPlatformAdminRole,
  getPlatformAdminRoleDefinition,
  ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS,
  PLATFORM_ADMIN_ROLES,
  type OrbitVerificationDocumentCategory,
  type PlatformAdminRole,
} from '@orbit-ledger/core';

import { WEB_DOCUMENT_VAULT_CATEGORY_OPTIONS } from '@/lib/document-vault';
import {
  buildWebPlatformAdminReport,
  buildWebPlatformAdminReportCsv,
  buildWebPlatformAdminSaasHealthCharts,
  filterWebPlatformAdminAuditRecords,
  filterWebPlatformAdminDocumentVaultRecords,
  filterWebPlatformAdminOffers,
  filterWebPlatformAdminUsersWithFilters,
  formatPlatformAdminDate,
  loadWebPlatformAdminAuditTrail,
  loadWebPlatformAdminDocumentVault,
  loadWebPlatformAdminSnapshot,
  manageWebPlatformAdminAccount,
  manageWebPlatformAdminOffer,
  manageWebPlatformAdminUser,
  recordWebPlatformAdminReportEvent,
  type WebPlatformAdminAccountAction,
  type WebPlatformAdminAuditFilters,
  type WebPlatformAdminAuditRecord,
  type WebPlatformAdminChartDatum,
  type WebPlatformAdminDocumentVaultFilters,
  type WebPlatformAdminDocumentVaultRecord,
  type WebPlatformAdminOffer,
  type WebPlatformAdminOfferAction,
  type WebPlatformAdminOfferDiscountType,
  type WebPlatformAdminOfferScope,
  type WebPlatformAdminReport,
  type WebPlatformAdminReportType,
  type WebPlatformAdminRegistryRecord,
  type WebPlatformAdminSnapshot,
  type WebPlatformAdminUserFilters,
  type WebPlatformAdminUserOfficeFilter,
  type WebPlatformAdminUserProviderFilter,
  type WebPlatformAdminUserRoleFilter,
  type WebPlatformAdminUser,
  type WebPlatformAdminUserAction,
  type WebPlatformAdminUserWorkspaceContext,
  WEB_PLATFORM_ADMIN_REPORT_DEFINITIONS,
} from '@/lib/platform-admin';
import { startWebUserContextSession, type WebUserContextMode } from '@/lib/user-context';
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

const DEFAULT_DOCUMENT_VAULT_FILTERS: WebPlatformAdminDocumentVaultFilters = {
  company: '',
  documentType: '',
  documentCategory: '',
  fromDate: '',
  toDate: '',
};

const DEFAULT_USER_FILTERS: WebPlatformAdminUserFilters = {
  role: 'all',
  officeAccess: 'all',
  provider: 'all',
};

const DOCUMENT_VAULT_TYPE_OPTIONS = Object.values(ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS).sort((left, right) =>
  left.label.localeCompare(right.label)
);

export type PlatformAdminConsoleSection =
  | 'overview'
  | 'users'
  | 'admins'
  | 'billing-offers'
  | 'documents'
  | 'safety-controls'
  | 'reports'
  | 'audit';

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

export default function PlatformAdminConsole({ section }: { section: PlatformAdminConsoleSection }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { confirm, prompt } = useConfirmDialog();
  const [snapshot, setSnapshot] = useState<WebPlatformAdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [userFilters, setUserFilters] = useState<WebPlatformAdminUserFilters>(DEFAULT_USER_FILTERS);
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
  const [userContextWorkspaceId, setUserContextWorkspaceId] = useState('');
  const [userContextReason, setUserContextReason] = useState('');
  const [isStartingUserContext, setIsStartingUserContext] = useState(false);
  const [userContextMessage, setUserContextMessage] = useState<string | null>(null);
  const [userContextError, setUserContextError] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<WebPlatformAdminAuditRecord[]>([]);
  const [auditGeneratedAt, setAuditGeneratedAt] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditFilters, setAuditFilters] = useState<WebPlatformAdminAuditFilters>(DEFAULT_AUDIT_FILTERS);
  const [auditSearch, setAuditSearch] = useState('');
  const [documentVault, setDocumentVault] = useState<WebPlatformAdminDocumentVaultRecord[]>([]);
  const [documentVaultGeneratedAt, setDocumentVaultGeneratedAt] = useState<string | null>(null);
  const [documentVaultError, setDocumentVaultError] = useState<string | null>(null);
  const [isLoadingDocumentVault, setIsLoadingDocumentVault] = useState(false);
  const [documentVaultFilters, setDocumentVaultFilters] =
    useState<WebPlatformAdminDocumentVaultFilters>(DEFAULT_DOCUMENT_VAULT_FILTERS);
  const [documentVaultSearch, setDocumentVaultSearch] = useState('');
  const [offerSearch, setOfferSearch] = useState('');
  const [offerMessage, setOfferMessage] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [offerForm, setOfferForm] = useState<OfferFormState>(DEFAULT_OFFER_FORM);
  const [reportType, setReportType] = useState<WebPlatformAdminReportType>('user_registry');
  const [reportPreviewPage, setReportPreviewPage] = useState(0);
  const users = useMemo(
    () => filterWebPlatformAdminUsersWithFilters(snapshot?.users ?? [], search, userFilters),
    [search, snapshot?.users, userFilters]
  );
  const visibleOffers = useMemo(
    () => filterWebPlatformAdminOffers(snapshot?.offers ?? [], offerSearch),
    [offerSearch, snapshot?.offers]
  );
  const visibleAuditRecords = useMemo(
    () => filterWebPlatformAdminAuditRecords(auditTrail, auditSearch),
    [auditSearch, auditTrail]
  );
  const visibleDocumentVaultRecords = useMemo(
    () => filterWebPlatformAdminDocumentVaultRecords(documentVault, documentVaultSearch),
    [documentVault, documentVaultSearch]
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
  const canStartReadOnlyUserContext = canControlUsers;
  const canStartActionEnabledUserContext = snapshot?.adminAccess?.role === 'super_admin' || snapshot?.adminAccess?.role === 'admin';
  const canDownloadReports = adminRole ? canPlatformAdminRole(adminRole, 'download_admin_reports') : true;
  const canReviewDocuments = adminRole ? canPlatformAdminRole(adminRole, 'review_documents') : true;
  const selfAttestedDocumentCount = visibleDocumentVaultRecords.filter((record) => record.selfAttested).length;
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
  const adminRoleRequired =
    adminForm.action === 'create' || adminForm.action === 'change_role' || adminForm.action === 'reactivate';
  const offerNeedsId =
    offerForm.action === 'update' || offerForm.action === 'deactivate' || offerForm.action === 'remove';
  const offerNeedsCopy = offerForm.action === 'create' || offerForm.action === 'update';
  const offerNeedsTargets = offerForm.scope !== 'sitewide';
  const offerTargetValue =
    offerForm.scope === 'selected_users'
      ? `${offerForm.targetEmails},${offerForm.targetUids}`.replace(/^,|,$/g, '')
      : offerForm.scope === 'selected_workspaces'
        ? offerForm.targetWorkspaceIds
        : offerForm.scope === 'selected_plans'
          ? offerForm.targetPlanIds
          : offerForm.scope === 'selected_countries'
            ? offerForm.targetCountries
            : '';
  const offerSubmitDisabled =
    isSavingOffer ||
    offerForm.reason.trim().length < 10 ||
    (offerNeedsId && !offerForm.offerId.trim()) ||
    (offerNeedsCopy &&
      (!offerForm.label.trim() ||
        !offerForm.title.trim() ||
        !offerForm.publicBannerMessage.trim() ||
        !offerForm.discountValue.trim() ||
        (!offerForm.expiresAt && !offerForm.lifetimeConfirmed) ||
        (offerNeedsTargets && !offerTargetValue.trim())));
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
        userFilters.role !== 'all' ? `Platform role: ${humanizeUserRoleFilter(userFilters.role)}` : '',
        userFilters.officeAccess !== 'all' ? `Office access: ${humanizeOfficeAccessFilter(userFilters.officeAccess)}` : '',
        userFilters.provider !== 'all' ? `Provider: ${humanizeProviderFilter(userFilters.provider)}` : '',
        offerSearch.trim() ? `Offer search: ${offerSearch.trim()}` : '',
        auditSearch.trim() ? `Audit search: ${auditSearch.trim()}` : '',
        auditFilters.action.trim() ? `Audit action: ${auditFilters.action.trim()}` : '',
        auditFilters.actor.trim() ? `Audit actor: ${auditFilters.actor.trim()}` : '',
        auditFilters.target.trim() ? `Audit target: ${auditFilters.target.trim()}` : '',
        auditFilters.severity.trim() ? `Audit severity: ${auditFilters.severity.trim()}` : '',
        auditFilters.fromDate ? `From: ${auditFilters.fromDate}` : '',
        auditFilters.toDate ? `To: ${auditFilters.toDate}` : '',
      ].filter(Boolean),
    [auditFilters, auditSearch, offerSearch, search, userFilters]
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
  const selectedUserRecord = useMemo(() => {
    if (!users.length) {
      return null;
    }
    if (!selectedUser) {
      return users[0];
    }
    return users.find((userRecord) => userRecord.uid === selectedUser.uid) ?? users[0];
  }, [selectedUser, users]);
  const selectedUserControlActive = Boolean(selectedUserRecord && userControlForm.targetUid === selectedUserRecord.uid);
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
    if (isAuthLoading || !user || section !== 'documents') {
      return;
    }
    void refreshDocumentVault(documentVaultFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, section, user?.uid]);

  useEffect(() => {
    setReportPreviewPage(0);
  }, [reportType, search, offerSearch, auditSearch, auditFilters, snapshot?.generatedAt]);

  useEffect(() => {
    const nextWorkspaceId = selectedUserRecord?.workspaceContexts[0]?.workspaceId ?? '';
    setUserContextWorkspaceId((current) =>
      selectedUserRecord?.workspaceContexts.some((workspace) => workspace.workspaceId === current) ? current : nextWorkspaceId
    );
    setUserContextMessage(null);
    setUserContextError(null);
  }, [selectedUserRecord]);

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

  async function refreshDocumentVault(filters: WebPlatformAdminDocumentVaultFilters) {
    setIsLoadingDocumentVault(true);
    setDocumentVaultError(null);
    try {
      const vault = await loadWebPlatformAdminDocumentVault({ ...filters, limit: 150 });
      setDocumentVault(vault.records);
      setDocumentVaultGeneratedAt(vault.generatedAt);
    } catch (loadError) {
      setDocumentVaultError(loadError instanceof Error ? loadError.message : 'Platform document vault could not be loaded.');
      setDocumentVault([]);
      setDocumentVaultGeneratedAt(null);
    } finally {
      setIsLoadingDocumentVault(false);
    }
  }

  function handleRefresh() {
    void refresh(currentPageToken, { nextPageIndex: currentPageIndex, rememberedTokens: pageTokens });
    if (section === 'documents') {
      void refreshDocumentVault(documentVaultFilters);
    }
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

  function openCreateAdminForm() {
    setAdminActionError(null);
    setAdminActionMessage(null);
    setAdminForm(DEFAULT_ADMIN_FORM);
  }

  function openCreateAdminFromOverview() {
    router.push('/backoffice/platform/admins');
  }

  function focusUserSearchFromOverview() {
    router.push('/backoffice/platform/users');
  }

  function reviewWarningsFromOverview() {
    setSearch('under_review');
    router.push('/backoffice/platform/users');
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

  function selectUser(userRecord: WebPlatformAdminUser) {
    setSelectedUser(userRecord);
    setUserControlMessage(null);
    setUserControlError(null);
    setUserControlForm((current) =>
      current.targetUid === userRecord.uid
        ? current
        : {
            action: 'send_warning',
            targetEmail: userRecord.email ?? '',
            targetUid: userRecord.uid,
            displayName: userRecord.displayName ?? userRecord.email ?? userRecord.uid,
            reason: '',
            message: '',
            riskLabel: '',
          }
    );
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

  async function launchUserContext(mode: WebUserContextMode) {
    if (!selectedUserRecord || !userContextWorkspaceId || userContextReason.trim().length < 10) {
      setUserContextError('Choose a workspace and add a clear reason with at least 10 characters before opening the user area.');
      return;
    }

    setIsStartingUserContext(true);
    setUserContextError(null);
    setUserContextMessage(null);
    try {
      await startWebUserContextSession({
        mode,
        reason: userContextReason.trim(),
        targetUid: selectedUserRecord.uid,
        targetEmail: selectedUserRecord.email,
        targetWorkspaceId: userContextWorkspaceId,
      });
      setUserContextMessage(
        mode === 'act_as_user'
          ? 'Action-enabled user session started. The user area is opening in a new tab with a visible debug banner.'
          : 'Read-only user session started. The user area is opening in a new tab with a visible debug banner.'
      );
      window.open('/dashboard', '_blank', 'noopener,noreferrer');
    } catch (sessionError) {
      setUserContextError(sessionError instanceof Error ? sessionError.message : 'The user area could not be opened.');
    } finally {
      setIsStartingUserContext(false);
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
    router.push('/backoffice/platform/billing-offers');
  }

  function openReportsFromOverview() {
    router.push('/backoffice/platform/reports');
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

  function applyDocumentVaultFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void refreshDocumentVault(documentVaultFilters);
  }

  function resetDocumentVaultFilters() {
    setDocumentVaultFilters(DEFAULT_DOCUMENT_VAULT_FILTERS);
    setDocumentVaultSearch('');
    void refreshDocumentVault(DEFAULT_DOCUMENT_VAULT_FILTERS);
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

  const showOverview = section === 'overview';
  const showUsers = section === 'users';
  const showAdmins = section === 'admins';
  const showBillingOffers = section === 'billing-offers';
  const showDocuments = section === 'documents';
  const showSafetyControls = section === 'safety-controls';
  const showReports = section === 'reports';
  const showAudit = section === 'audit';
  const platformRouteMeta: Record<PlatformAdminConsoleSection, { title: string; description: string }> = {
    overview: {
      title: 'Platform operations',
      description: 'Users, admins, offers, access signals, and audit readiness in one review surface.',
    },
    users: {
      title: 'Registered user registry',
      description: 'Scan users by role, workspace footprint, subscription state, and sign-in method.',
    },
    admins: {
      title: 'Admin registry',
      description: 'Manage privileged accounts without dragging user-registry controls into the flow.',
    },
    'billing-offers': {
      title: 'Billing and offers',
      description: 'Review pricing, active offers, and operator actions in a tighter route-specific surface.',
    },
    documents: {
      title: 'Document vault',
      description: 'Review uploaded company, tax, address, identity, and nonprofit documents with attestation metadata.',
    },
    'safety-controls': {
      title: 'Safety controls',
      description: 'Session policy, MFA readiness, and abuse guardrails without unrelated registry chrome.',
    },
    reports: {
      title: 'Reports',
      description: 'Build export and print views from a focused reporting route.',
    },
    audit: {
      title: 'Audit',
      description: 'Inspect platform history with the event list and route-specific filters up front.',
    },
  };
  const showRouteBar = !showOverview;

  return (
    <main className="ol-platform-admin-page">
      <section className="ol-platform-admin-shell">
        {showRouteBar ? (
          <header className="ol-platform-admin-route-bar">
            <div className="ol-platform-admin-route-copy">
              <p className="ol-chip">Internal platform admin</p>
              <h1>{platformRouteMeta[section].title}</h1>
              <p>{platformRouteMeta[section].description}</p>
            </div>
            <div className="ol-platform-admin-route-actions">
              <Link className="ol-button-secondary" href="/dashboard">
                Open dashboard
              </Link>
              <button className="ol-button" type="button" onClick={handleRefresh} disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </header>
        ) : (
          <header className="ol-platform-admin-hero">
            <div>
              <p className="ol-chip">Internal platform admin</p>
              <h1>{platformRouteMeta.overview.title}</h1>
              <p>{platformRouteMeta.overview.description}</p>
            </div>
            <div className="ol-platform-admin-hero-actions">
              <Link className="ol-button-secondary" href="/dashboard">
                Open dashboard
              </Link>
              <button className="ol-button" type="button" onClick={handleRefresh} disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </header>
        )}

        {error ? (
          <div className="ol-message" data-tone="danger">
            {error}
          </div>
        ) : null}

        <div className="ol-platform-admin-layout ol-platform-admin-layout--single">
          <div className="ol-platform-admin-workspace">
            {showOverview ? (
            <section className="ol-platform-admin-overview">
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
                      actionHref="/backoffice/platform/users"
                    />
                    <AdminDonutChart
                      title="User status"
                      subtitle="Active, not onboarded, disabled"
                      data={saasHealthCharts.userStatusMix}
                      actionLabel="Review users"
                      actionHref="/backoffice/platform/users"
                    />
                    <AdminStackedChart
                      title="Workspace adoption"
                      subtitle="Workspace and Office activation"
                      data={saasHealthCharts.workspaceAdoption}
                      actionLabel="Open user registry"
                      actionHref="/backoffice/platform/users"
                    />
                    <AdminStackedChart
                      title="Offer status"
                      subtitle="Pricing exposure by lifecycle"
                      data={saasHealthCharts.offerStatusMix}
                      actionLabel="Open offers"
                      actionHref="/backoffice/platform/billing-offers"
                    />
                    <AdminHorizontalBars
                      title="Audit severity"
                      subtitle="Loaded audit events"
                      data={saasHealthCharts.auditSeverityMix}
                      actionLabel="Open audit"
                      actionHref="/backoffice/platform/audit"
                    />
                    <AdminHorizontalBars
                      title="Admin roles"
                      subtitle="Registry role distribution"
                      data={saasHealthCharts.adminRoleMix}
                      actionLabel="Open admins"
                      actionHref="/backoffice/platform/admins"
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
            ) : null}

            {!showOverview && !showUsers ? (
              <section className="ol-panel ol-platform-admin-route-status-card">
                <div className="ol-platform-admin-status-strip">
                  <span className="ol-platform-admin-status-pill" data-tone="premium">
                    {snapshot?.adminAccess ? `${adminRoleLabel} · ${snapshot.adminAccess.roleSource}` : 'Emergency allowlist'}
                  </span>
                  <span className="ol-platform-admin-status-pill" data-tone={snapshot?.adminAccess?.customClaimsReady ? 'success' : 'warning'}>
                    {snapshot?.adminAccess?.customClaimsReady ? 'Custom claims active' : 'Allowlist fallback'}
                  </span>
                  <span className="ol-platform-admin-status-pill" data-tone="default">
                    {formatPlatformAdminDate(snapshot?.generatedAt)}
                  </span>
                  <span className="ol-platform-admin-status-pill" data-tone="default">
                    {user.email}
                  </span>
                </div>
              </section>
            ) : null}

            {showSafetyControls ? (
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
            ) : null}

            {showReports ? (
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
            ) : null}

        {showAdmins ? (
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
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Action
	                        <span className="ol-required-badge">Required</span>
	                      </span>
	                      <BackofficeFieldHelp text="Choose the admin access change to perform. Every action is server-authorized and audited." />
	                    </span>
	                    <select
	                      aria-required="true"
	                      className="ol-select"
	                      required
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
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Email
	                        {!adminForm.targetUid.trim() ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required when Firebase UID is not provided. Use the admin account email that should receive or keep access." />
	                    </span>
	                    <input
	                      aria-required={!adminForm.targetUid.trim() || undefined}
	                      className="ol-input"
	                      value={adminForm.targetEmail}
                      onChange={(event) => setAdminForm((current) => ({ ...current, targetEmail: event.target.value }))}
	                      placeholder="admin@example.com"
	                      required={!adminForm.targetUid.trim()}
	                      type="email"
	                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Firebase UID
	                        {!adminForm.targetEmail.trim() ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required only when email is not provided. UID is useful for existing admin records or exact account targeting." />
	                    </span>
	                    <input
	                      aria-required={!adminForm.targetEmail.trim() || undefined}
	                      className="ol-input"
	                      value={adminForm.targetUid}
                      onChange={(event) => setAdminForm((current) => ({ ...current, targetUid: event.target.value }))}
	                      placeholder="Optional when email is provided"
	                      required={!adminForm.targetEmail.trim()}
	                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">Display name</span>
	                      <BackofficeFieldHelp text="Optional. Add it when creating a new admin so the registry and audit trail are easier to read." />
	                    </span>
	                    <input
                      className="ol-input"
                      value={adminForm.displayName}
                      onChange={(event) => setAdminForm((current) => ({ ...current, displayName: event.target.value }))}
                      placeholder="Full name"
                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Role
	                        {adminRoleRequired ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required for add, role change, and reactivate actions. Suspend/revoke keep the current record role." />
	                    </span>
	                    <select
	                      aria-required={adminRoleRequired || undefined}
	                      className="ol-select"
	                      value={adminForm.role}
                      onChange={(event) =>
                        setAdminForm((current) => ({ ...current, role: event.target.value as PlatformAdminRole }))
	                      }
	                      disabled={adminForm.action === 'suspend' || adminForm.action === 'revoke'}
	                      required={adminRoleRequired}
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
	                  <span className="ol-field-label ol-field-label--with-meta">
	                    <span className="ol-field-label-text">
	                      Reason
	                      <span className="ol-required-badge">Required</span>
	                    </span>
	                    <BackofficeFieldHelp text="Required for audit. Add at least 10 characters explaining why this admin access change is needed." />
	                  </span>
	                  <textarea
	                    aria-required="true"
	                    className="ol-input ol-textarea"
	                    value={adminForm.reason}
                    onChange={(event) => setAdminForm((current) => ({ ...current, reason: event.target.value }))}
	                    placeholder="Example: Granting support access for beta operations review."
	                    required
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
        ) : null}

        {showBillingOffers ? (
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
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Action
	                        <span className="ol-required-badge">Required</span>
	                      </span>
	                      <BackofficeFieldHelp text="Choose whether to create, update, deactivate, or remove an offer. Every change is audited." />
	                    </span>
	                    <select
	                      aria-required="true"
	                      className="ol-select"
	                      required
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
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Offer ID
	                        {offerNeedsId ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required for update, deactivate, or remove. New offers generate an ID from the label/title." />
	                    </span>
	                    <input
	                      aria-required={offerNeedsId || undefined}
	                      className="ol-input"
	                      value={offerForm.offerId}
                      onChange={(event) => setOfferForm((current) => ({ ...current, offerId: event.target.value }))}
	                      placeholder="Only needed for update/deactivate/remove"
	                      required={offerNeedsId}
	                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Label
	                        {offerNeedsCopy ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required for create/update. This short label appears in admin lists and offer summaries." />
	                    </span>
	                    <input
	                      aria-required={offerNeedsCopy || undefined}
	                      className="ol-input"
	                      value={offerForm.label}
	                      onChange={(event) => setOfferForm((current) => ({ ...current, label: event.target.value }))}
	                      placeholder="Launch Offer"
	                      required={offerNeedsCopy}
	                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Title
	                        {offerNeedsCopy ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required for create/update. Customers may see this title in offer banners or checkout context." />
	                    </span>
	                    <input
	                      aria-required={offerNeedsCopy || undefined}
	                      className="ol-input"
	                      value={offerForm.title}
	                      onChange={(event) => setOfferForm((current) => ({ ...current, title: event.target.value }))}
	                      placeholder="Public beta launch pricing"
	                      required={offerNeedsCopy}
	                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Scope
	                        {offerNeedsCopy ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required for create/update. Scope controls who is eligible for the offer." />
	                    </span>
	                    <select
	                      aria-required={offerNeedsCopy || undefined}
	                      className="ol-select"
	                      required={offerNeedsCopy}
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
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Discount type
	                        {offerNeedsCopy ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required for create/update. This determines how the discount value is interpreted." />
	                    </span>
	                    <select
	                      aria-required={offerNeedsCopy || undefined}
	                      className="ol-select"
	                      required={offerNeedsCopy}
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
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Discount value
	                        {offerNeedsCopy ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required for create/update. Use percent for percentage offers or minor units for amount/fixed-price offers." />
	                    </span>
	                    <input
	                      aria-required={offerNeedsCopy || undefined}
	                      className="ol-input"
	                      value={offerForm.discountValue}
                      onChange={(event) => setOfferForm((current) => ({ ...current, discountValue: event.target.value }))}
	                      inputMode="numeric"
	                      placeholder="20 or 49900"
	                      required={offerNeedsCopy}
	                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">Currency lock</span>
	                      <BackofficeFieldHelp text="Optional. Add a currency only when the offer should apply to one currency, such as INR or USD." />
	                    </span>
	                    <input
                      className="ol-input"
                      value={offerForm.currency}
                      onChange={(event) => setOfferForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                      placeholder="Optional: INR, USD, CAD, AUD, GBP"
                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">Start date</span>
	                      <BackofficeFieldHelp text="Optional. If blank, the offer starts when saved. Add a future time for scheduled launch pricing." />
	                    </span>
	                    <input
                      className="ol-input"
                      value={offerForm.startAt}
                      onChange={(event) => setOfferForm((current) => ({ ...current, startAt: event.target.value }))}
                      type="datetime-local"
                    />
	                  </label>
	                  <label className="ol-form-field">
	                    <span className="ol-field-label ol-field-label--with-meta">
	                      <span className="ol-field-label-text">
	                        Expiry date
	                        {offerNeedsCopy && !offerForm.lifetimeConfirmed ? <span className="ol-required-badge">Required</span> : null}
	                      </span>
	                      <BackofficeFieldHelp text="Required unless lifetime confirmation is checked. Expiry must be in the future." />
	                    </span>
	                    <input
	                      aria-required={(offerNeedsCopy && !offerForm.lifetimeConfirmed) || undefined}
	                      className="ol-input"
	                      value={offerForm.expiresAt}
	                      onChange={(event) => setOfferForm((current) => ({ ...current, expiresAt: event.target.value }))}
	                      required={offerNeedsCopy && !offerForm.lifetimeConfirmed}
	                      type="datetime-local"
	                    />
	                  </label>
                </div>

	                <label className="ol-form-field">
	                  <span className="ol-field-label ol-field-label--with-meta">
	                    <span className="ol-field-label-text">
	                      Public banner message
	                      {offerNeedsCopy ? <span className="ol-required-badge">Required</span> : null}
	                    </span>
	                    <BackofficeFieldHelp text="Required for create/update. This is the customer-facing offer copy, so keep it clear and safe." />
	                  </span>
	                  <textarea
	                    aria-required={offerNeedsCopy || undefined}
	                    className="ol-input ol-textarea"
                    value={offerForm.publicBannerMessage}
                    onChange={(event) =>
                      setOfferForm((current) => ({ ...current, publicBannerMessage: event.target.value }))
                    }
	                    placeholder="Example: Launch pricing is available for eligible workspaces until this offer expires."
	                    required={offerNeedsCopy}
	                    rows={3}
	                  />
	                </label>
	                <label className="ol-form-field">
	                  <span className="ol-field-label ol-field-label--with-meta">
	                    <span className="ol-field-label-text">
	                      Targets
	                      {offerNeedsCopy && offerNeedsTargets ? <span className="ol-required-badge">Required</span> : null}
	                    </span>
	                    <BackofficeFieldHelp text="Required for selected scopes. Add comma-separated emails, UIDs, workspace IDs, plan IDs, or country codes depending on the scope." />
	                  </span>
	                  <textarea
	                    aria-required={(offerNeedsCopy && offerNeedsTargets) || undefined}
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
	                    required={offerNeedsCopy && offerNeedsTargets}
	                    rows={3}
	                    disabled={offerForm.scope === 'sitewide'}
	                  />
	                </label>
	                <label className="ol-form-field">
	                  <span className="ol-field-label ol-field-label--with-meta">
	                    <span className="ol-field-label-text">Internal note</span>
	                    <BackofficeFieldHelp text="Optional. Add finance/admin context that should not appear in public offer copy." />
	                  </span>
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
	                  <span>
	                    I explicitly confirm this offer has no expiry date.
	                    <small className="ol-checkbox-helper">Required only when no expiry date is set. This protects accidental lifetime discounts.</small>
	                  </span>
	                </label>
                <label className="ol-form-field">
                  <span className="ol-field-label ol-field-label--with-meta">
                    <span className="ol-field-label-text">
                      Reason
                      <span className="ol-required-badge">Required</span>
                    </span>
                    <BackofficeFieldHelp text="Required for audit. Explain why this billing or offer change is being made before saving it." />
                  </span>
                  <textarea
                    aria-required="true"
                    className="ol-input ol-textarea"
                    value={offerForm.reason}
                    onChange={(event) => setOfferForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="Example: Creating a launch offer for first-wave beta conversion review."
                    required
                    rows={4}
                  />
                </label>

                <button
                  className="ol-button"
                  type="submit"
	                  disabled={offerSubmitDisabled}
	                >
                  {isSavingOffer ? 'Saving offer...' : 'Save offer change'}
                </button>
              </form>
            ) : null}
          </div>
        </section>
        ) : null}

        {showDocuments ? (
        <section className="ol-platform-admin-table-card ol-platform-admin-document-card" id="documents">
          <div className="ol-platform-admin-table-head">
            <div>
              <strong>Document vault</strong>
              <span>
                {visibleDocumentVaultRecords.length.toLocaleString('en-IN')} shown · Generated {formatPlatformAdminDate(documentVaultGeneratedAt)}
              </span>
            </div>
            <div className="ol-platform-admin-row-actions">
              <span className="ol-platform-admin-status-pill" data-tone={canReviewDocuments ? 'success' : 'warning'}>
                {canReviewDocuments ? 'Review access enabled' : 'Document review not enabled for this role'}
              </span>
              <span className="ol-platform-admin-status-pill" data-tone={selfAttestedDocumentCount === visibleDocumentVaultRecords.length && visibleDocumentVaultRecords.length ? 'success' : 'warning'}>
                {selfAttestedDocumentCount.toLocaleString('en-IN')} self-attested
              </span>
            </div>
          </div>

          <form className="ol-platform-admin-document-filters" onSubmit={applyDocumentVaultFilters}>
            <label className="ol-form-field ol-platform-admin-document-company">
              <span>Company or email</span>
              <input
                className="ol-input"
                value={documentVaultFilters.company}
                onChange={(event) => setDocumentVaultFilters((current) => ({ ...current, company: event.target.value }))}
                placeholder="Workspace, owner email, uploader email"
              />
            </label>
            <label className="ol-form-field">
              <span>Document type</span>
              <select
                className="ol-select"
                value={documentVaultFilters.documentType}
                onChange={(event) => setDocumentVaultFilters((current) => ({ ...current, documentType: event.target.value }))}
              >
                <option value="">All types</option>
                {DOCUMENT_VAULT_TYPE_OPTIONS.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ol-form-field">
              <span>Category</span>
              <select
                className="ol-select"
                value={documentVaultFilters.documentCategory}
                onChange={(event) =>
                  setDocumentVaultFilters((current) => ({
                    ...current,
                    documentCategory: event.target.value as OrbitVerificationDocumentCategory | '',
                  }))
                }
              >
                <option value="">All categories</option>
                {WEB_DOCUMENT_VAULT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ol-form-field">
              <span>From</span>
              <input
                className="ol-input"
                type="date"
                value={documentVaultFilters.fromDate}
                onChange={(event) => setDocumentVaultFilters((current) => ({ ...current, fromDate: event.target.value }))}
              />
            </label>
            <label className="ol-form-field">
              <span>To</span>
              <input
                className="ol-input"
                type="date"
                value={documentVaultFilters.toDate}
                onChange={(event) => setDocumentVaultFilters((current) => ({ ...current, toDate: event.target.value }))}
              />
            </label>
            <label className="ol-form-field ol-platform-admin-document-search">
              <span>Search loaded documents</span>
              <input
                className="ol-input"
                value={documentVaultSearch}
                onChange={(event) => setDocumentVaultSearch(event.target.value)}
                placeholder="Name, reason, uploader, file, status"
              />
            </label>
            <div className="ol-platform-admin-audit-filter-actions">
              <button className="ol-button" type="submit" disabled={isLoadingDocumentVault || !canReviewDocuments}>
                {isLoadingDocumentVault ? 'Loading documents...' : 'Apply filters'}
              </button>
              <button className="ol-button-secondary" type="button" onClick={resetDocumentVaultFilters} disabled={isLoadingDocumentVault}>
                Reset
              </button>
            </div>
          </form>

          {documentVaultError ? (
            <div className="ol-message ol-platform-admin-audit-message" data-tone="danger">
              {documentVaultError}
            </div>
          ) : null}

          {isLoadingDocumentVault && !documentVault.length ? (
            <div className="ol-platform-admin-empty">
              <div className="ol-loading-orbit" aria-label="Loading document vault">
                <span>O</span>
              </div>
              <p>Loading document vault.</p>
            </div>
          ) : visibleDocumentVaultRecords.length ? (
            <div className="ol-platform-admin-document-table-wrap">
              <table className="ol-platform-admin-document-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Document</th>
                    <th>Upload</th>
                    <th>Attestation</th>
                    <th>Reason</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocumentVaultRecords.map((record) => (
                    <DocumentVaultRow key={`${record.workspaceId}-${record.id}`} record={record} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
              <h2>No documents found</h2>
              <p>Adjust the company, type, category, date, or loaded-document search filters.</p>
            </div>
          )}
        </section>
        ) : null}

        {showAudit ? (
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
        ) : null}

        {showUsers ? (
        <section className="ol-platform-admin-table-card" id="users">
          <div className="ol-platform-admin-table-head">
            <div>
              <strong>User registry</strong>
              <span>
                {users.length.toLocaleString('en-IN')} shown · {(snapshot?.users.length ?? 0).toLocaleString('en-IN')} loaded on page{' '}
                {currentPageIndex + 1}
                {snapshot ? ` of ${snapshot.hasMore ? `${currentPageIndex + 2}+` : currentPageIndex + 1}` : ''}
              </span>
            </div>
            <span>
              {(snapshot?.metrics.userCount ?? 0).toLocaleString('en-IN')} total platform user{snapshot?.metrics.userCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="ol-platform-admin-user-toolbar">
            <div className="ol-platform-admin-user-toolbar-grid">
              <label className="ol-form-field ol-platform-admin-user-toolbar-search">
                <span>Search users</span>
                <input
                  id="platform-admin-search"
                  className="ol-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Email, name, uid, workspace, or role"
                />
              </label>
              <label className="ol-form-field">
                <span>Platform role</span>
                <select
                  className="ol-select"
                  value={userFilters.role}
                  onChange={(event) =>
                    setUserFilters((current) => ({
                      ...current,
                      role: event.target.value as WebPlatformAdminUserRoleFilter,
                    }))
                  }
                >
                  <option value="all">All roles</option>
                  {PLATFORM_ADMIN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {getPlatformAdminRoleDefinition(role).label}
                    </option>
                  ))}
                  <option value="no_platform_role">No platform role</option>
                </select>
              </label>
              <label className="ol-form-field">
                <span>Office access</span>
                <select
                  className="ol-select"
                  value={userFilters.officeAccess}
                  onChange={(event) =>
                    setUserFilters((current) => ({
                      ...current,
                      officeAccess: event.target.value as WebPlatformAdminUserOfficeFilter,
                    }))
                  }
                >
                  <option value="all">All users</option>
                  <option value="has_office_access">Has Office access</option>
                  <option value="no_office_access">No Office access</option>
                </select>
              </label>
              <label className="ol-form-field">
                <span>Sign-in method</span>
                <select
                  className="ol-select"
                  value={userFilters.provider}
                  onChange={(event) =>
                    setUserFilters((current) => ({
                      ...current,
                      provider: event.target.value as WebPlatformAdminUserProviderFilter,
                    }))
                  }
                >
                  <option value="all">All methods</option>
                  <option value="google">Google</option>
                  <option value="password">Email and password</option>
                  <option value="multi_provider">Multiple providers</option>
                  <option value="no_provider">No provider</option>
                </select>
              </label>
            </div>
            <div className="ol-platform-admin-user-toolbar-meta">
              <div className="ol-platform-admin-status-strip">
                <span className="ol-platform-admin-status-pill" data-tone="premium">
                  {snapshot?.adminAccess ? `${adminRoleLabel} · ${snapshot.adminAccess.roleSource}` : 'Emergency allowlist'}
                </span>
                <span className="ol-platform-admin-status-pill" data-tone={snapshot?.adminAccess?.customClaimsReady ? 'success' : 'warning'}>
                  {snapshot?.adminAccess?.customClaimsReady ? 'Custom claims active' : 'Allowlist fallback'}
                </span>
                <span className="ol-platform-admin-status-pill" data-tone="default">
                  {users.length.toLocaleString('en-IN')} shown
                </span>
                <span className="ol-platform-admin-status-pill" data-tone="default">
                  {(snapshot?.users.length ?? 0).toLocaleString('en-IN')} loaded
                </span>
                <span className="ol-platform-admin-status-pill" data-tone="default">
                  {snapshot?.hasMore ? 'More users available' : 'Current page loaded'}
                </span>
              </div>
              <p className="ol-platform-admin-user-toolbar-note">
                Existing passwords are never shown. Raw UIDs stay in the inspector while the table stays focused on role, workspace footprint, sign-in, and account state.
              </p>
            </div>
          </div>
          {isLoading && !snapshot ? (
            <div className="ol-platform-admin-empty">
              <div className="ol-loading-orbit" aria-label="Loading users">
                <span>O</span>
              </div>
              <p>Loading registry.</p>
            </div>
          ) : users.length ? (
            <div className="ol-platform-admin-user-registry-layout">
              <div className="ol-platform-admin-user-registry-surface">
                <div className="ol-platform-admin-user-table-wrap">
                  <table className="ol-platform-admin-user-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Platform role</th>
                        <th>Office role</th>
                        <th>Workspaces</th>
                        <th>Sign-in</th>
                        <th>Subscription</th>
                        <th>Last sign-in</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((item) => (
                        <UserTableRow
                          key={item.uid}
                          user={item}
                          isSelected={selectedUserRecord?.uid === item.uid}
                          canControl={canControlUsers}
                          canSuspend={canSuspendUsers}
                          onSelect={selectUser}
                          onManage={openManageUserForm}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <aside className="ol-platform-admin-user-inspector">
                {selectedUserRecord ? (
                  <>
                    <div className="ol-platform-admin-user-inspector-head">
                      <div className="ol-platform-admin-user-main">
                        <span className="ol-platform-admin-avatar">{initials(selectedUserRecord.displayName ?? selectedUserRecord.email ?? selectedUserRecord.uid)}</span>
                        <div>
                          <strong>{selectedUserRecord.displayName ?? selectedUserRecord.email ?? selectedUserRecord.uid}</strong>
                          <span>{selectedUserRecord.email ?? 'No email saved'}</span>
                          <code>{selectedUserRecord.uid}</code>
                        </div>
                      </div>
                      <div className="ol-platform-admin-user-inspector-pills">
                        <StatusPill user={selectedUserRecord} />
                        {selectedUserRecord.platformAdminRole ? (
                          <span className="ol-platform-admin-status-pill" data-tone="premium">
                            {getPlatformAdminRoleDefinition(selectedUserRecord.platformAdminRole).label}
                          </span>
                        ) : null}
                        {selectedUserRecord.hasActiveSubscription ? (
                          <span className="ol-platform-admin-status-pill" data-tone="success">
                            Active subscription
                          </span>
                        ) : null}
                        {selectedUserRecord.isQaUser ? (
                          <span className="ol-platform-admin-status-pill" data-tone="warning">
                            QA user
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="ol-platform-admin-selected-summary">
                      <span>
                        <strong>Platform role</strong>
                        {selectedUserRecord.platformAdminRole
                          ? `${getPlatformAdminRoleDefinition(selectedUserRecord.platformAdminRole).label} · ${selectedUserRecord.platformAdminRoleSource ?? 'registry'}`
                          : 'No platform role'}
                      </span>
                      <span>
                        <strong>Office roles</strong>
                        {selectedUserRecord.officeRoles.length ? selectedUserRecord.officeRoles.join(', ') : 'No Office role'}
                      </span>
                      <span>
                        <strong>Workspace footprint</strong>
                        {selectedUserRecord.ownedWorkspaceCount} owned · {selectedUserRecord.officeWorkspaceCount} Office
                      </span>
                      <span>
                        <strong>Sign-in methods</strong>
                        {selectedUserRecord.providerIds.length ? selectedUserRecord.providerIds.join(', ') : 'No provider'}
                      </span>
                      <span>
                        <strong>Last sign-in</strong>
                        {formatPlatformAdminDate(selectedUserRecord.lastSignInAt)}
                      </span>
                      <span>
                        <strong>Risk state</strong>
                        {summarizeUserRisk(selectedUserRecord)}
                      </span>
                      <span className="ol-platform-admin-selected-summary--wide">
                        <strong>Workspace names</strong>
                        {selectedUserRecord.workspaceNames.length
                          ? selectedUserRecord.workspaceNames.join(', ')
                          : 'No workspace names saved'}
                      </span>
                      {selectedUserRecord.platformUserLastAdminReason ? (
                        <span className="ol-platform-admin-selected-summary--wide">
                          <strong>Last admin reason</strong>
                          {selectedUserRecord.platformUserLastAdminReason}
                        </span>
                      ) : null}
                    </div>

                    {canStartReadOnlyUserContext ? (
                      <section className="ol-platform-admin-user-context-card">
                        <div className="ol-platform-admin-section-head">
                          <div>
                            <h2>Debug user area</h2>
                            <p>
                              Open the real user workspace in a new tab, or start a bannered user-context session for
                              support debugging. Existing passwords are never shown or used here.
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
                        <div className="ol-platform-admin-form-grid">
                          <label className="ol-form-field">
                            <span className="ol-field-label ol-field-label--with-meta">
                              <span className="ol-field-label-text">
                                Workspace
                                <span className="ol-required-badge">Required</span>
                              </span>
                              <BackofficeFieldHelp text="Choose the exact customer workspace to open. User-context sessions cannot start without a target workspace." />
                            </span>
                            <select
                              aria-required="true"
                              className="ol-select"
                              required
                              value={userContextWorkspaceId}
                              onChange={(event) => setUserContextWorkspaceId(event.target.value)}
                            >
                              {selectedUserRecord.workspaceContexts.length ? (
                                selectedUserRecord.workspaceContexts.map((workspace) => (
                                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                                    {workspace.businessName} · {workspace.accessSource === 'owner' ? 'Owner' : workspace.officeRole ?? 'Member'}
                                  </option>
                                ))
                              ) : (
                                <option value="">No workspace available</option>
                              )}
                            </select>
                          </label>
                          <label className="ol-form-field">
                            <span className="ol-field-label ol-field-label--with-meta">
                              <span className="ol-field-label-text">Target access</span>
                              <BackofficeFieldHelp text="Read-only summary of the user’s available workspaces. This helps confirm you are debugging the right customer context." />
                            </span>
                            <input
                              className="ol-input"
                              value={summarizeWorkspaceContexts(selectedUserRecord.workspaceContexts)}
                              readOnly
                            />
                          </label>
                        </div>
                        <label className="ol-form-field">
                          <span className="ol-field-label ol-field-label--with-meta">
                            <span className="ol-field-label-text">
                              Reason
                              <span className="ol-required-badge">Required</span>
                            </span>
                            <BackofficeFieldHelp text="Required for audit. Explain the support issue or workflow bug before opening, viewing, or acting as a user." />
                          </span>
                          <textarea
                            aria-required="true"
                            className="ol-input ol-textarea"
                            value={userContextReason}
                            onChange={(event) => setUserContextReason(event.target.value)}
                            placeholder="Explain the customer issue, workflow bug, or debug purpose for this session."
                            required
                            rows={3}
                          />
                        </label>
                        <div className="ol-actions">
                          <button
                            className="ol-button-secondary"
                            type="button"
                            disabled={isStartingUserContext || !selectedUserRecord.workspaceContexts.length}
                            onClick={() => void launchUserContext('open_workspace')}
                          >
                            Open workspace
                          </button>
                          <button
                            className="ol-button-secondary"
                            type="button"
                            disabled={isStartingUserContext || !selectedUserRecord.workspaceContexts.length}
                            onClick={() => void launchUserContext('view_as_user')}
                          >
                            View as user
                          </button>
                          {canStartActionEnabledUserContext ? (
                            <button
                              className="ol-button"
                              type="button"
                              disabled={isStartingUserContext || !selectedUserRecord.workspaceContexts.length}
                              onClick={() => void launchUserContext('act_as_user')}
                            >
                              Act as user
                            </button>
                          ) : null}
                        </div>
                      </section>
                    ) : null}

                    {canControlUsers ? (
                      <>
                        <div className="ol-platform-admin-user-action-strip">
                          <button
                            className="ol-button-secondary"
                            type="button"
                            onClick={() => openManageUserForm(selectedUserRecord, 'send_warning')}
                          >
                            Send warning
                          </button>
                          <button
                            className="ol-button-secondary"
                            type="button"
                            onClick={() => openManageUserForm(selectedUserRecord, 'add_internal_note')}
                          >
                            Add note
                          </button>
                          <button
                            className="ol-button-secondary"
                            type="button"
                            onClick={() => openManageUserForm(selectedUserRecord, 'mark_under_review')}
                          >
                            Mark review
                          </button>
                          {canSuspendUsers ? (
                            <button
                              className="ol-button-ghost"
                              type="button"
                              onClick={() =>
                                openManageUserForm(
                                  selectedUserRecord,
                                  selectedUserRecord.disabled ? 'restore_user' : 'suspend_user'
                                )
                              }
                            >
                              {selectedUserRecord.disabled ? 'Restore user' : 'Suspend user'}
                            </button>
                          ) : null}
                        </div>

                        <form className="ol-platform-admin-admin-form ol-platform-admin-user-action-form" onSubmit={handleUserControlSubmit}>
                          <div>
                            <p className="ol-chip">Server authorized</p>
                            <h2>Manage selected user</h2>
                            <p>
                              Audit reason is mandatory. Support admins can warn, note, and review. Suspend and restore stay
                              with Super Admin and Admin.
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
                              <span className="ol-field-label ol-field-label--with-meta">
                                <span className="ol-field-label-text">
                                  Action
                                  <span className="ol-required-badge">Required</span>
                                </span>
                                <BackofficeFieldHelp text="Choose the lifecycle action to record. Destructive actions remain server-authorized by role." />
                              </span>
                              <select
                                aria-required="true"
                                className="ol-select"
                                required
                                value={selectedUserControlActive ? userControlForm.action : 'send_warning'}
                                onChange={(event) =>
                                  setUserControlForm((current) => ({
                                    ...current,
                                    targetEmail: selectedUserRecord.email ?? current.targetEmail,
                                    targetUid: selectedUserRecord.uid,
                                    displayName:
                                      selectedUserRecord.displayName ?? selectedUserRecord.email ?? selectedUserRecord.uid,
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
                              <span className="ol-field-label ol-field-label--with-meta">
                                <span className="ol-field-label-text">Risk label</span>
                                <BackofficeFieldHelp text="Optional. Add a short label only when the account needs special attention, such as billing risk or misuse review." />
                              </span>
                              <input
                                className="ol-input"
                                value={selectedUserControlActive ? userControlForm.riskLabel : ''}
                                onChange={(event) =>
                                  setUserControlForm((current) => ({
                                    ...current,
                                    targetEmail: selectedUserRecord.email ?? current.targetEmail,
                                    targetUid: selectedUserRecord.uid,
                                    displayName:
                                      selectedUserRecord.displayName ?? selectedUserRecord.email ?? selectedUserRecord.uid,
                                    riskLabel: event.target.value,
                                  }))
                                }
                                placeholder="Billing risk, misuse review, support follow-up"
                              />
                            </label>
                          </div>

                          {selectedUserControlActive && userControlNeedsMessage ? (
                            <label className="ol-form-field">
                              <span className="ol-field-label ol-field-label--with-meta">
                                <span className="ol-field-label-text">
                                  {userControlForm.action === 'add_internal_note' ? 'Internal note' : 'Warning message'}
                                  <span className="ol-required-badge">Required</span>
                                </span>
                                <BackofficeFieldHelp text="Required for warning/note actions so the operator record contains the actual customer-facing warning or internal context." />
                              </span>
                              <textarea
                                aria-required="true"
                                className="ol-input ol-textarea"
                                value={selectedUserControlActive ? userControlForm.message : ''}
                                onChange={(event) =>
                                  setUserControlForm((current) => ({
                                    ...current,
                                    targetEmail: selectedUserRecord.email ?? current.targetEmail,
                                    targetUid: selectedUserRecord.uid,
                                    displayName:
                                      selectedUserRecord.displayName ?? selectedUserRecord.email ?? selectedUserRecord.uid,
                                    message: event.target.value,
                                  }))
                                }
                                placeholder="Describe the user-facing warning or the internal note for the audit trail."
                                required
                                rows={4}
                              />
                            </label>
                          ) : null}

                          <label className="ol-form-field">
                            <span className="ol-field-label ol-field-label--with-meta">
                              <span className="ol-field-label-text">
                                Reason
                                <span className="ol-required-badge">Required</span>
                              </span>
                              <BackofficeFieldHelp text="Required for audit. State why the selected user action is needed, ideally with ticket or support context." />
                            </span>
                            <textarea
                              aria-required="true"
                              className="ol-input ol-textarea"
                              value={selectedUserControlActive ? userControlForm.reason : ''}
                              onChange={(event) =>
                                setUserControlForm((current) => ({
                                  ...current,
                                  targetEmail: selectedUserRecord.email ?? current.targetEmail,
                                  targetUid: selectedUserRecord.uid,
                                  displayName:
                                    selectedUserRecord.displayName ?? selectedUserRecord.email ?? selectedUserRecord.uid,
                                  reason: event.target.value,
                                }))
                              }
                              placeholder="State clearly why this user action is needed."
                              required
                              rows={4}
                            />
                          </label>

                          <button className="ol-button" type="submit" disabled={isSavingUserControl || userControlSubmitDisabled}>
                            {isSavingUserControl ? 'Saving user action...' : 'Save user action'}
                          </button>
                        </form>
                      </>
                    ) : (
                      <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
                        <h2>Read-only user details</h2>
                        <p>This role can inspect the registry but cannot run lifecycle actions for the selected user.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ol-platform-admin-empty ol-platform-admin-empty-compact">
                    <h2>No user selected</h2>
                    <p>Choose a user from the registry table to inspect role, workspace, and account details.</p>
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <div className="ol-platform-admin-empty">
              <h2>No users found</h2>
              <p>Adjust the search and role filters or refresh the registry.</p>
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
        ) : null}
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

function DocumentVaultRow({ record }: { record: WebPlatformAdminDocumentVaultRecord }) {
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

function humanizeUserRoleFilter(role: WebPlatformAdminUserRoleFilter): string {
  if (role === 'all') {
    return 'All roles';
  }
  if (role === 'no_platform_role') {
    return 'No platform role';
  }
  return getPlatformAdminRoleDefinition(role).label;
}

function humanizeOfficeAccessFilter(filter: WebPlatformAdminUserOfficeFilter): string {
  if (filter === 'all') {
    return 'All users';
  }
  return filter === 'has_office_access' ? 'Has Office access' : 'No Office access';
}

function humanizeProviderFilter(filter: WebPlatformAdminUserProviderFilter): string {
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

function UserTableRow({
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

function StatusPill({ user }: { user: WebPlatformAdminUser }) {
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

function summarizeUserRisk(user: WebPlatformAdminUser) {
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

function summarizeWorkspaceContexts(workspaces: WebPlatformAdminUserWorkspaceContext[]) {
  if (!workspaces.length) {
    return 'No workspace attached';
  }
  if (workspaces.length === 1) {
    const workspace = workspaces[0];
    return workspace.accessSource === 'owner' ? 'Owner access' : workspace.officeRole ?? 'Office member';
  }
  return `${workspaces.length} workspace contexts available`;
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

function BackofficeFieldHelp({ text }: { text: string }) {
  return (
    <details className="ol-field-info">
      <summary aria-label="Field help">?</summary>
      <span>{text}</span>
    </details>
  );
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
