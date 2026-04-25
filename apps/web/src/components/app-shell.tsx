'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { webFoundation } from '@orbit-ledger/ui';
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
  const syncBadge = useMemo(
    () => {
      if (!activeWorkspace) {
        return 'No workspace';
      }
      return isOnline ? 'Cloud workspace' : 'Offline cache';
    },
    [activeWorkspace, isOnline]
  );

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
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.logoRow}>
          <img
            alt="Orbit Ledger"
            src="/branding/orbit-ledger-logo-transparent.png"
            style={{ height: '1.6rem', width: 'auto' }}
          />
        </div>
        <nav style={styles.nav}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                href={item.href}
                key={item.href}
                style={{
                  ...styles.navLink,
                  ...(active ? styles.navLinkActive : null),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.sidebarBadge}>{syncBadge}</div>
          <Link href="/settings" style={styles.sidebarFooterLink}>
            Business settings
          </Link>
        </div>
      </aside>

      <div style={styles.workspace}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.pageTitle}>{title}</div>
            <div style={styles.pageSubtitle}>{subtitle}</div>
          </div>
          <div style={styles.topbarActions}>
            {workspaces.length > 0 ? (
              <select
                onChange={(event) => selectWorkspace(event.target.value)}
                style={styles.workspaceSelect}
                value={activeWorkspace?.workspaceId ?? ''}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                    {workspace.businessName}
                  </option>
                ))}
              </select>
            ) : null}
            <div style={styles.userBadge}>
              {user?.displayName || user?.email || 'Signed-in owner'}
            </div>
            <button
              onClick={() => {
                void signOutUser().then(() => router.replace('/login'));
              }}
              style={styles.secondaryButton}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>
        <main style={styles.main}>{children}</main>
      </div>
    </div>
  );
}

const foundation = webFoundation;

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: `${foundation.shell.sidebarWidth}px minmax(0, 1fr)`,
    background: foundation.surface.app,
  },
  sidebar: {
    background: foundation.surface.sidebar,
    borderRight: `1px solid ${foundation.surface.divider}`,
    padding: '28px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  logoRow: {
    minHeight: 42,
    display: 'flex',
    alignItems: 'center',
  },
  nav: {
    display: 'grid',
    gap: 10,
  },
  navLink: {
    padding: '12px 14px',
    borderRadius: 8,
    color: 'var(--text-muted)',
    fontWeight: 700,
  },
  navLinkActive: {
    background: 'var(--primary-surface)',
    color: 'var(--primary)',
  },
  sidebarFooter: {
    marginTop: 'auto',
    display: 'grid',
    gap: 10,
  },
  sidebarBadge: {
    alignSelf: 'flex-start',
    padding: '8px 10px',
    borderRadius: 999,
    background: 'var(--premium-surface)',
    color: 'var(--premium)',
    fontSize: 12,
    fontWeight: 800,
  },
  sidebarFooterLink: {
    color: 'var(--text-muted)',
    fontSize: 14,
    fontWeight: 700,
  },
  workspace: {
    minWidth: 0,
    display: 'grid',
    gridTemplateRows: `${foundation.shell.topbarHeight}px minmax(0, 1fr)`,
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 28px',
    background: 'rgba(255,255,255,0.84)',
    borderBottom: `1px solid ${foundation.surface.glassBorder}`,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  pageTitle: {
    fontSize: foundation.typography.pageTitle,
    fontWeight: 900,
  },
  pageSubtitle: {
    fontSize: foundation.typography.pageSubtitle,
    color: 'var(--text-muted)',
  },
  topbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  workspaceSelect: {
    minHeight: 42,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#fff',
    padding: '0 12px',
  },
  userBadge: {
    padding: '10px 12px',
    borderRadius: 999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#fff',
    padding: '0 14px',
    color: 'var(--text)',
    fontWeight: 700,
  },
  main: {
    padding: '28px',
    display: 'grid',
    gap: 24,
  },
};
