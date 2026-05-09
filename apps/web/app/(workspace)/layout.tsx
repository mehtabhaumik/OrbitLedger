'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getOfficePermissionDefinition } from '@orbit-ledger/core';

import { OfficeRouteLockedScreen } from '@/components/office-route-locked-screen';
import { WorkspaceSetupCard } from '@/components/workspace-setup-card';
import { WorkspaceLoadingScreen } from '@/components/workspace-loading-screen';
import { getWebOfficeRouteAccess } from '@/lib/web-office-access';
import { useAuth } from '@/providers/auth-provider';
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { activeWorkspace, isLoading: workspaceLoading, workspaceLookupError, refresh } = useWorkspace();
  const officeAccess = useOfficeAccess();

  useEffect(() => {
    if (!authLoading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [authLoading, pathname, router, user]);

  if (authLoading || workspaceLoading || officeAccess.isLoading) {
    return <WorkspaceLoadingScreen />;
  }

  if (!user) {
    return null;
  }

  if (workspaceLookupError) {
    return (
      <main className="ol-onboarding-page">
        <section className="ol-onboarding-shell" style={{ maxWidth: 760 }}>
          <div className="ol-brand-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <img
              className="ol-brand-logo"
              alt="Orbit Ledger"
              src="/branding/orbit-ledger-logo-transparent.png"
              style={{ height: 32, maxWidth: 'min(420px, 100%)', objectFit: 'contain' }}
            />
            <span className="ol-brand-header-copy">Workspace check</span>
          </div>
          <div className="ol-panel" style={{ marginTop: 24 }}>
            <div className="ol-onboarding-headline" style={{ fontSize: '2.1rem' }}>
              We could not load your saved workspace
            </div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              Orbit Ledger could not confirm your workspace from the cloud. Please retry before
              creating a new workspace.
            </p>
            <div className="ol-toolbar-actions" style={{ justifyContent: 'flex-start', marginTop: 20 }}>
              <button type="button" className="ol-button ol-button--primary" onClick={() => void refresh()}>
                Retry
              </button>
              <button type="button" className="ol-button" onClick={() => router.replace('/login')}>
                Back to sign in
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!activeWorkspace) {
    return (
      <main className="ol-onboarding-page">
        <WorkspaceSetupCard />
      </main>
    );
  }

  const routeAccess = getWebOfficeRouteAccess(pathname, officeAccess);
  if (!routeAccess.allowed) {
    return (
      <OfficeRouteLockedScreen
        title={routeAccess.title}
        message={routeAccess.message}
        roleLabel={officeAccess.roleLabel}
        permissionLabel={routeAccess.permission ? getOfficePermissionDefinition(routeAccess.permission).label : null}
      />
    );
  }

  return children;
}
