'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BackofficeShell } from '@/components/backoffice/backoffice-shell';
import { OfficeRouteLockedScreen } from '@/components/office-route-locked-screen';
import { WorkspaceLoadingScreen } from '@/components/workspace-loading-screen';
import { isWebOfficeOperationsAllowed } from '@/lib/office-admin-operations';
import { isWebPlatformAdminAllowed } from '@/lib/platform-admin-access';
import { useAuth } from '@/providers/auth-provider';
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const officeAccess = useOfficeAccess();
  const { isLoading: workspaceLoading } = useWorkspace();
  const isPlatformAdmin = isWebPlatformAdminAllowed(user?.email);
  const hasOperationsAccess = isWebOfficeOperationsAllowed(user?.email);
  const hasPlatformAccess = isPlatformAdmin;
  const needsPlatformAccess = pathname?.startsWith('/backoffice/platform');
  const allowed = needsPlatformAccess ? hasPlatformAccess : hasOperationsAccess || hasPlatformAccess;

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

  if (!allowed) {
    return (
      <OfficeRouteLockedScreen
        title="Back-office access locked"
        message="This control surface is reserved for Orbit Ledger operators and approved platform administrators."
        roleLabel={officeAccess.roleLabel}
        permissionLabel={needsPlatformAccess ? 'Platform admin allowlist' : 'Operations or platform access'}
      />
    );
  }

  return <BackofficeShell>{children}</BackofficeShell>;
}
