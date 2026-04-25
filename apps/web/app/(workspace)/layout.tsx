'use client';

import type { CSSProperties, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { WorkspaceSetupCard } from '@/components/workspace-setup-card';
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
    return <div style={styles.center}>Preparing workspace...</div>;
  }

  if (!user) {
    return null;
  }

  if (!activeWorkspace) {
    return (
      <div style={styles.center}>
        <WorkspaceSetupCard />
      </div>
    );
  }

  return children;
}

const styles: Record<string, CSSProperties> = {
  center: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
  },
};
