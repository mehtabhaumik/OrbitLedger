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
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
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
