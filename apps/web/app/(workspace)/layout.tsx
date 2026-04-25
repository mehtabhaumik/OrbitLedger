'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { WorkspaceSetupCard } from '@/components/workspace-setup-card';
import { WorkspaceLoadingScreen } from '@/components/workspace-loading-screen';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();

  useEffect(() => {
    if (!authLoading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [authLoading, pathname, router, user]);

  if (authLoading || workspaceLoading) {
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

  return children;
}
