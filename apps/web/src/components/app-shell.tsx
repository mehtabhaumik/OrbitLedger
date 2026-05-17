'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';

const navItems: Array<{ href: Route; label: string }> = [
  { href: '/dashboard', label: 'Home' },
  { href: '/customers', label: 'Customers' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/payments' as Route, label: 'Payments' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/products' as Route, label: 'Products' },
  { href: '/documents' as Route, label: 'Documents' },
  { href: '/templates' as Route, label: 'Templates' },
  { href: '/reports', label: 'Reports' },
  { href: '/market' as Route, label: 'Market' },
  { href: '/team' as Route, label: 'Team' },
  { href: '/backup', label: 'Backup' },
  { href: '/support' as Route, label: 'Support' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const { activeWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const [isOnline, setIsOnline] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const accountLabel = user?.displayName || user?.email || 'Owner';
  const visibleAccountLabel = user?.displayName || 'Account';
  const accountInitial = accountLabel.trim().charAt(0).toUpperCase() || 'O';
  const syncBadge = useMemo(() => {
    if (!activeWorkspace) {
      return 'No business selected';
    }

    return isOnline ? 'Online' : 'Offline';
  }, [activeWorkspace, isOnline]);

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

  function renderNavigation() {
    return (
      <>
        <div className="ol-sidebar-group">
          <div className="ol-sidebar-group-label">Status</div>
          <div className="ol-chip-row">
            <span className={`ol-chip ${isOnline ? 'ol-chip--success' : 'ol-chip--warning'}`}>
              <span className="ol-dot" />
              {syncBadge}
            </span>
          </div>
        </div>

        <div className="ol-sidebar-group ol-sidebar-nav-group">
          <div className="ol-sidebar-group-label">Navigation</div>
          <nav className="ol-nav">
            {navItems.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  href={item.href}
                  key={item.href}
                  className={`ol-nav-link${active ? ' is-active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </>
    );
  }

  return (
    <div className="ol-app-shell">
      <aside className="ol-sidebar" aria-label="Workspace navigation">
        <div className="ol-sidebar-brand">
          <div className="ol-sidebar-brand-mark">
            <img
              className="ol-brand-logo"
              alt="Orbit Ledger"
              src="/branding/orbit-ledger-logo-transparent.png"
            />
          </div>
          <span className="ol-sidebar-badge">Web</span>
        </div>

        {renderNavigation()}

        <div className="ol-sidebar-footer">
          <div className="ol-panel-glass ol-workspace-guide">
            <strong>Workspace guide</strong>
            <span className="ol-muted">
              Use the web workspace for customer records, invoices, reports, backups, and detailed review.
            </span>
          </div>
        </div>
      </aside>

      <div className="ol-workspace-shell">
        <header className="ol-topbar">
          <div className="ol-topbar-heading">
            <button
              aria-controls="workspace-mobile-nav"
              aria-expanded={isMobileNavOpen}
              aria-label="Open navigation menu"
              className="ol-mobile-menu-button"
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
            <div className="ol-topbar-title">{title}</div>
            <div className="ol-topbar-subtitle">{subtitle}</div>
            </div>
          </div>
          <div className="ol-topbar-actions">
            {workspaces.length > 0 ? (
              <select
                onChange={(event) => selectWorkspace(event.target.value)}
                className="ol-select ol-topbar-select"
                value={activeWorkspace?.workspaceId ?? ''}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                    {workspace.businessName}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="ol-account-chip" title={visibleAccountLabel}>
              <span className="ol-account-avatar">{accountInitial}</span>
              <span className="ol-account-name">{visibleAccountLabel}</span>
            </span>
            <button
              onClick={() => {
                void signOutUser().then(() => router.replace('/login'));
              }}
              className="ol-button-secondary"
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="ol-page-content">{children}</main>
      </div>
      {isMobileNavOpen ? (
        <div className="ol-mobile-nav-layer" id="workspace-mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            aria-label="Close navigation menu"
            className="ol-mobile-nav-backdrop"
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="ol-mobile-nav-panel">
            <div className="ol-sidebar-brand">
              <div className="ol-sidebar-brand-mark">
                <img className="ol-brand-logo" alt="Orbit Ledger" src="/branding/orbit-ledger-logo-transparent.png" />
              </div>
              <button className="ol-icon-button ol-button-secondary" type="button" onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation menu">
                X
              </button>
            </div>
            {renderNavigation()}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function isActiveRoute(pathname: string | null, href: Route) {
  const target = String(href);
  if (!pathname) {
    return false;
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}
