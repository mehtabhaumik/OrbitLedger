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
  { href: '/invoices', label: 'Invoices' },
  { href: '/reports', label: 'Reports' },
  { href: '/backup', label: 'Backup' },
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

  return (
    <div className="ol-app-shell">
      <aside className="ol-sidebar">
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

        <div className="ol-sidebar-group">
          <div className="ol-sidebar-group-label">Status</div>
          <div className="ol-chip-row">
            <span className={`ol-chip ${isOnline ? 'ol-chip--success' : 'ol-chip--warning'}`}>
              <span className="ol-dot" />
              {syncBadge}
            </span>
          </div>
        </div>

        <div className="ol-sidebar-group">
          <div className="ol-sidebar-group-label">Navigation</div>
          <nav className="ol-nav">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
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

        <div className="ol-sidebar-footer">
          <Link href="/settings" className="ol-nav-link">
            Business settings
          </Link>

          <div className="ol-panel-glass" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Quick guide</strong>
            <span className="ol-muted" style={{ lineHeight: 1.6, fontSize: 13 }}>
              Use web for cleanup, reports, invoices, backups, and careful review.
            </span>
          </div>
        </div>
      </aside>

      <div className="ol-workspace-shell">
        <header className="ol-topbar">
          <div>
            <div className="ol-topbar-title">{title}</div>
            <div className="ol-topbar-subtitle">{subtitle}</div>
          </div>
          <div className="ol-topbar-actions">
            {workspaces.length > 0 ? (
              <select
                onChange={(event) => selectWorkspace(event.target.value)}
                className="ol-select"
                value={activeWorkspace?.workspaceId ?? ''}
                style={{ minWidth: 240 }}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                    {workspace.businessName}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="ol-chip ol-chip--primary">
              {user?.displayName || user?.email || 'Owner'}
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
    </div>
  );
}
