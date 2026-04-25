'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  createWorkspace,
  listWorkspacesForUser,
  loadWorkspaceDashboardSnapshot,
  type WorkspaceProfileInput,
} from '@/lib/workspaces';
import { useAuth } from './auth-provider';

type WorkspaceContextValue = {
  workspaces: OrbitWorkspaceSummary[];
  activeWorkspace: OrbitWorkspaceSummary | null;
  isLoading: boolean;
  refresh(): Promise<void>;
  createFirstWorkspace(input: WorkspaceProfileInput): Promise<OrbitWorkspaceSummary>;
  selectWorkspace(workspaceId: string): void;
  dashboardSnapshot: Awaited<ReturnType<typeof loadWorkspaceDashboardSnapshot>> | null;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<OrbitWorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<Awaited<
    ReturnType<typeof loadWorkspaceDashboardSnapshot>
  > | null>(null);

  async function refresh() {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setDashboardSnapshot(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const nextWorkspaces = await listWorkspacesForUser(user.uid);
    setWorkspaces(nextWorkspaces);
    const nextActiveWorkspaceId =
      nextWorkspaces.find((workspace) => workspace.workspaceId === activeWorkspaceId)?.workspaceId ??
      nextWorkspaces[0]?.workspaceId ??
      null;
    setActiveWorkspaceId(nextActiveWorkspaceId);
    if (nextActiveWorkspaceId) {
      setDashboardSnapshot(await loadWorkspaceDashboardSnapshot(nextActiveWorkspaceId));
    } else {
      setDashboardSnapshot(null);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void refresh();
  }, [authLoading, user]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }
    void loadWorkspaceDashboardSnapshot(activeWorkspaceId).then(setDashboardSnapshot).catch(() => undefined);
  }, [activeWorkspaceId]);

  const value = useMemo<WorkspaceContextValue>(() => {
    const activeWorkspace =
      workspaces.find((workspace) => workspace.workspaceId === activeWorkspaceId) ?? null;

    return {
      workspaces,
      activeWorkspace,
      isLoading,
      refresh,
      async createFirstWorkspace(input) {
        if (!user) {
          throw new Error('Sign in before creating a workspace.');
        }
        const workspace = await createWorkspace(user.uid, user.email, input);
        setWorkspaces([workspace]);
        setActiveWorkspaceId(workspace.workspaceId);
        setDashboardSnapshot(await loadWorkspaceDashboardSnapshot(workspace.workspaceId));
        return workspace;
      },
      selectWorkspace(workspaceId) {
        setActiveWorkspaceId(workspaceId);
      },
      dashboardSnapshot,
    };
  }, [activeWorkspaceId, dashboardSnapshot, isLoading, user, workspaces]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  }

  return context;
}
