'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import type { User } from 'firebase/auth';
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
const WORKSPACE_BOOTSTRAP_HINT_PREFIX = 'orbit-ledger:skip-workspace-bootstrap:';
const WORKSPACE_STATE_CACHE_PREFIX = 'orbit-ledger:workspace-state:';
const WORKSPACE_STATE_HAS = 'has_workspace';
const WORKSPACE_STATE_NONE = 'no_workspace';

function hasWorkspaceBootstrapHint(userId: string) {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.sessionStorage.getItem(`${WORKSPACE_BOOTSTRAP_HINT_PREFIX}${userId}`) === '1';
}

function clearWorkspaceBootstrapHint(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(`${WORKSPACE_BOOTSTRAP_HINT_PREFIX}${userId}`);
}

function readWorkspaceStateCache(userId: string) {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.localStorage.getItem(`${WORKSPACE_STATE_CACHE_PREFIX}${userId}`);
  return value === WORKSPACE_STATE_HAS || value === WORKSPACE_STATE_NONE ? value : null;
}

function writeWorkspaceStateCache(userId: string, hasWorkspace: boolean) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    `${WORKSPACE_STATE_CACHE_PREFIX}${userId}`,
    hasWorkspace ? WORKSPACE_STATE_HAS : WORKSPACE_STATE_NONE
  );
}

function isLikelyFirstSignIn(user: User) {
  const createdAt = Number(user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : NaN);
  const lastSignInAt = Number(user.metadata.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : NaN);
  if (!Number.isFinite(createdAt) || !Number.isFinite(lastSignInAt)) {
    return false;
  }
  return Math.abs(lastSignInAt - createdAt) < 2 * 60 * 1000;
}

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
    const currentUser = user;

    const shouldSkipBlockingBootstrap =
      isLikelyFirstSignIn(currentUser) ||
      hasWorkspaceBootstrapHint(currentUser.uid);

    function applyWorkspaceList(nextWorkspaces: OrbitWorkspaceSummary[]) {
      setWorkspaces(nextWorkspaces);
      writeWorkspaceStateCache(currentUser.uid, nextWorkspaces.length > 0);
      if (nextWorkspaces.length > 0) {
        clearWorkspaceBootstrapHint(currentUser.uid);
      }
      const nextActiveWorkspaceId =
        nextWorkspaces.find((workspace) => workspace.workspaceId === activeWorkspaceId)?.workspaceId ??
        nextWorkspaces[0]?.workspaceId ??
        null;
      setActiveWorkspaceId(nextActiveWorkspaceId);
      if (!nextActiveWorkspaceId) {
        setDashboardSnapshot(null);
      }
    }

    if (shouldSkipBlockingBootstrap) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setDashboardSnapshot(null);
      setIsLoading(false);

      // Resolve real workspace state in background to correct stale/no-workspace assumptions.
      void listWorkspacesForUser(currentUser.uid)
        .then((nextWorkspaces) => {
          applyWorkspaceList(nextWorkspaces);
        })
        .catch(() => undefined);
      return;
    }

    setIsLoading(true);

    try {
      const nextWorkspaces = await listWorkspacesForUser(currentUser.uid);
      applyWorkspaceList(nextWorkspaces);
    } catch {
      // Keep previous state if remote fetch fails so the UI can continue.
      setWorkspaces((current) => current);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void refresh();
  }, [authLoading, user]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setDashboardSnapshot(null);
      return;
    }

    void loadWorkspaceDashboardSnapshot(activeWorkspaceId)
      .then(setDashboardSnapshot)
      .catch(() => undefined);
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
        clearWorkspaceBootstrapHint(user.uid);
        writeWorkspaceStateCache(user.uid, true);
        setWorkspaces([workspace]);
        setActiveWorkspaceId(workspace.workspaceId);
        setDashboardSnapshot(null);
        void loadWorkspaceDashboardSnapshot(workspace.workspaceId)
          .then(setDashboardSnapshot)
          .catch(() => undefined);
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
