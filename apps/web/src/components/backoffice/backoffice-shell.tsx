'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { isWebPlatformAdminAllowed } from '@/lib/platform-admin-access';
import { isWebOfficeOperationsAllowed } from '@/lib/office-admin-operations';
import { getWorkspaceDisplayName } from '@/lib/workspace-profile-view';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';

const operationsNavItems: Array<{ href: Route; label: string }> = [
  { href: '/backoffice/operations/overview' as Route, label: 'Overview' },
  { href: '/backoffice/operations/support-inbox' as Route, label: 'Support inbox' },
  { href: '/backoffice/operations/assignments' as Route, label: 'Assignments' },
  { href: '/backoffice/operations/access-requests' as Route, label: 'Access requests' },
  { href: '/backoffice/operations/diagnostics-consent' as Route, label: 'Diagnostics & consent' },
  { href: '/backoffice/operations/exports-reports' as Route, label: 'Exports & reports' },
  { href: '/backoffice/operations/audit' as Route, label: 'Audit' },
];

const platformNavItems: Array<{ href: Route; label: string }> = [
  { href: '/backoffice/platform/overview' as Route, label: 'Overview' },
  { href: '/backoffice/platform/users' as Route, label: 'Users' },
  { href: '/backoffice/platform/admins' as Route, label: 'Admins' },
  { href: '/backoffice/platform/billing-offers' as Route, label: 'Billing & offers' },
  { href: '/backoffice/platform/documents' as Route, label: 'Documents' },
  { href: '/backoffice/platform/safety-controls' as Route, label: 'Safety controls' },
  { href: '/backoffice/platform/reports' as Route, label: 'Reports' },
  { href: '/backoffice/platform/audit' as Route, label: 'Audit' },
];

type BackofficeArea = 'operations' | 'platform';

type BackofficeShellProps = {
  children: ReactNode;
};

export function BackofficeShell({ children }: BackofficeShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const { activeWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const [isOnline, setIsOnline] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const hasOperationsAccess = isWebOfficeOperationsAllowed(user?.email);
  const hasPlatformAccess = isWebPlatformAdminAllowed(user?.email);
  const accountLabel = user?.displayName || user?.email || 'Operator';
  const accountInitial = accountLabel.trim().charAt(0).toUpperCase() || 'O';
  const routeCopy = useMemo(() => getBackofficeRouteCopy(pathname), [pathname]);
  const activeArea = useMemo<BackofficeArea>(() => getBackofficeArea(pathname), [pathname]);
  const activeNavItems = activeArea === 'platform' ? platformNavItems : operationsNavItems;
  const activeAreaCopy = activeArea === 'platform' ? getPlatformAreaCopy() : getOperationsAreaCopy();
  const visibleAreas = useMemo(() => {
    const areas: Array<{
      area: BackofficeArea;
      href: Route;
      label: string;
      caption: string;
    }> = [];
    if (hasOperationsAccess) {
      areas.push({
        area: 'operations',
        href: '/backoffice/operations/overview' as Route,
        label: 'Operations',
        caption: 'Support, access, diagnostics',
      });
    }
    if (hasPlatformAccess) {
      areas.push({
        area: 'platform',
        href: '/backoffice/platform/overview' as Route,
        label: 'Platform Admin',
        caption: 'Users, billing, safety',
      });
    }
    return areas;
  }, [hasOperationsAccess, hasPlatformAccess]);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(window.navigator.onLine);
    }

    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  function renderNavGroup(title: string, description: string, items: Array<{ href: Route; label: string }>) {
    return (
      <div className="ol-backoffice-nav-group">
        <span className="ol-backoffice-nav-label">{title}</span>
        <p className="ol-backoffice-nav-helper">{description}</p>
        <nav className="ol-backoffice-nav-list">
          {items.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`ol-backoffice-nav-link${active ? ' is-active' : ''}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  function renderAreaSwitcher() {
    if (visibleAreas.length <= 1) {
      return null;
    }

    return (
      <div className="ol-backoffice-nav-group">
        <span className="ol-backoffice-nav-label">Workspace</span>
        <div className="ol-backoffice-area-switcher">
          {visibleAreas.map((area) => {
            const isActive = area.area === activeArea;
            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`ol-backoffice-area-card${isActive ? ' is-active' : ''}`}
                href={area.href}
                key={area.area}
              >
                <strong>{area.label}</strong>
                <span>{area.caption}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  function renderNavigation() {
    return (
      <>
        <div className="ol-backoffice-sidebar-scroll">
          <div className="ol-backoffice-status-card">
            <span className="ol-backoffice-nav-label">Session</span>
            <strong>{isOnline ? 'Connected' : 'Offline'}</strong>
            <p>
              {activeWorkspace
                ? `Workspace context: ${getWorkspaceDisplayName(activeWorkspace)}`
                : 'No workspace selected. Platform work is still available, and operations routes can be entered once a workspace is chosen.'}
            </p>
          </div>

          {renderAreaSwitcher()}

          {renderNavGroup(activeAreaCopy.title, activeAreaCopy.description, activeNavItems)}

          <div className="ol-backoffice-nav-group">
            <span className="ol-backoffice-nav-label">Workspace app</span>
            <nav className="ol-backoffice-nav-list">
              <Link className="ol-backoffice-nav-link" href="/dashboard">
                Return to user area
              </Link>
            </nav>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="ol-backoffice-app">
      <aside className="ol-backoffice-sidebar" aria-label="Back-office navigation">
        <div className="ol-backoffice-brand">
          <div className="ol-backoffice-brand-mark">
            <img className="ol-brand-logo" alt="Orbit Ledger" src="/branding/orbit-ledger-logo-primary.png" />
          </div>
          <span className="ol-backoffice-badge">Back-office</span>
        </div>
        {renderNavigation()}
      </aside>

      <div className="ol-backoffice-main">
        <header className="ol-backoffice-topbar">
          <div className="ol-backoffice-topbar-head">
            <button
              aria-controls="backoffice-mobile-nav"
              aria-expanded={isMobileNavOpen}
              aria-label="Open back-office navigation"
              className="ol-mobile-menu-button"
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <span className="ol-backoffice-topbar-kicker">{routeCopy.kicker}</span>
              <h1>{routeCopy.title}</h1>
              <p>{routeCopy.subtitle}</p>
            </div>
          </div>
          <div className="ol-backoffice-topbar-actions">
            {workspaces.length ? (
              <select
                className="ol-select ol-topbar-select"
                onChange={(event) => selectWorkspace(event.target.value)}
                value={activeWorkspace?.workspaceId ?? ''}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                    {getWorkspaceDisplayName(workspace)}
                  </option>
                ))}
              </select>
            ) : null}
            <span className={`ol-chip ${isOnline ? 'ol-chip--success' : 'ol-chip--warning'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span className="ol-account-chip" title={accountLabel}>
              <span className="ol-account-avatar">{accountInitial}</span>
              <span className="ol-account-name">{user?.displayName || 'Operator'}</span>
            </span>
            <button
              className="ol-button-secondary"
              onClick={() => {
                void signOutUser().then(() => router.replace('/login'));
              }}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="ol-backoffice-content">{children}</main>
      </div>

      {isMobileNavOpen ? (
        <div className="ol-mobile-nav-layer" id="backoffice-mobile-nav" role="dialog" aria-modal="true" aria-label="Back-office navigation">
          <button
            aria-label="Close back-office navigation"
            className="ol-mobile-nav-backdrop"
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="ol-mobile-nav-panel ol-backoffice-mobile-panel">
            <div className="ol-backoffice-brand">
              <div className="ol-backoffice-brand-mark">
                <img className="ol-brand-logo" alt="Orbit Ledger" src="/branding/orbit-ledger-logo-primary.png" />
              </div>
              <button className="ol-mobile-nav-close" type="button" onClick={() => setIsMobileNavOpen(false)} aria-label="Close back-office navigation">
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </button>
            </div>
            {renderNavigation()}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function getBackofficeRouteCopy(pathname: string | null) {
  if (pathname?.startsWith('/backoffice/platform/users')) {
    return {
      kicker: 'Platform Admin',
      title: 'User Registry',
      subtitle: 'Inspect registered users, workspace attachment, and platform-level account status without scanning the whole control surface.',
    };
  }
  if (pathname?.startsWith('/backoffice/platform/admins')) {
    return {
      kicker: 'Platform Admin',
      title: 'Admin Registry',
      subtitle: 'Manage privileged access from a focused registry instead of a stacked all-in-one admin page.',
    };
  }
  if (pathname?.startsWith('/backoffice/platform/billing-offers')) {
    return {
      kicker: 'Platform Admin',
      title: 'Billing & Offers',
      subtitle: 'Control commercial exposure, pricing, and offer state in one dedicated finance-safe workspace.',
    };
  }
  if (pathname?.startsWith('/backoffice/platform/documents')) {
    return {
      kicker: 'Platform Admin',
      title: 'Document Vault',
      subtitle: 'Review company, tax, address, identity, and nonprofit uploads with dates, reasons, and self-attestation.',
    };
  }
  if (pathname?.startsWith('/backoffice/platform/safety-controls')) {
    return {
      kicker: 'Platform Admin',
      title: 'Safety Controls',
      subtitle: 'Session policy, MFA readiness, and sensitive-action guardrails live here instead of buried in a mega page.',
    };
  }
  if (pathname?.startsWith('/backoffice/platform/reports')) {
    return {
      kicker: 'Platform Admin',
      title: 'Reports',
      subtitle: 'Print-safe and CSV-ready reporting with no need to scroll through unrelated admin controls.',
    };
  }
  if (pathname?.startsWith('/backoffice/platform/audit')) {
    return {
      kicker: 'Platform Admin',
      title: 'Audit Trail',
      subtitle: 'Immutable platform history with dedicated filters and review space.',
    };
  }
  if (pathname?.startsWith('/backoffice/platform')) {
    return {
      kicker: 'Platform Admin',
      title: 'Platform Overview',
      subtitle: 'Growth, adoption, and admin risk signals belong in a focused platform console, not a giant anchor page.',
    };
  }
  if (pathname?.startsWith('/backoffice/operations/support-inbox')) {
    return {
      kicker: 'Operations',
      title: 'Support Inbox',
      subtitle: 'Queue, list, and detail flow for real support handling without burying the operator in stacked workspace panels.',
    };
  }
  if (pathname?.startsWith('/backoffice/operations/assignments')) {
    return {
      kicker: 'Operations',
      title: 'Assignments',
      subtitle: 'Route tickets, owners, and workload decisions in a focused assignment console.',
    };
  }
  if (pathname?.startsWith('/backoffice/operations/access-requests')) {
    return {
      kicker: 'Operations',
      title: 'Access Requests',
      subtitle: 'Review office access and support-review intake in a dedicated operational queue.',
    };
  }
  if (pathname?.startsWith('/backoffice/operations/diagnostics-consent')) {
    return {
      kicker: 'Operations',
      title: 'Diagnostics & Consent',
      subtitle: 'Customer-approved diagnostic packs stay visible here without mixing into the customer-facing workspace flow.',
    };
  }
  if (pathname?.startsWith('/backoffice/operations/exports-reports')) {
    return {
      kicker: 'Operations',
      title: 'Exports & Reports',
      subtitle: 'Support audit exports and print-safe reporting in a route that is built for that one job.',
    };
  }
  if (pathname?.startsWith('/backoffice/operations/audit')) {
    return {
      kicker: 'Operations',
      title: 'Operations Audit',
      subtitle: 'Trace support and office actions in a dedicated audit workspace with room for filters and exact history.',
    };
  }
  return {
    kicker: 'Operations',
    title: 'Operations Overview',
    subtitle: 'Support, access review, diagnostics, and export readiness in a separate back-office product.',
  };
}

function getBackofficeArea(pathname: string | null): BackofficeArea {
  if (pathname?.startsWith('/backoffice/platform')) {
    return 'platform';
  }
  return 'operations';
}

function getOperationsAreaCopy() {
  return {
    title: 'Operations',
    description: 'Support, access review, diagnostics, exports, and audit in one focused operator workspace.',
  };
}

function getPlatformAreaCopy() {
  return {
    title: 'Platform Admin',
    description: 'Users, admins, billing, safety controls, reports, and audit in a separate platform console.',
  };
}
