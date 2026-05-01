'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import type { User } from 'firebase/auth';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
const WORKSPACE_CACHE_PREFIX = 'orbit-ledger:workspace-cache:';
const WORKSPACE_STATE_CACHE_PREFIX = 'orbit-ledger:workspace-state:';
const WORKSPACE_STATE_HAS = 'has_workspace';
const WORKSPACE_STATE_NONE = 'no_workspace';
const WORKSPACE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_LOOKUP_FALLBACK_MS = 1800;

type CachedWorkspaceState = {
  version: 1;
  state: typeof WORKSPACE_STATE_HAS | typeof WORKSPACE_STATE_NONE;
  workspaces: OrbitWorkspaceSummary[];
  activeWorkspaceId: string | null;
  cachedAt: string;
};

function hasWorkspaceBootstrapHint(userId: string) {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.sessionStorage.getItem(`${WORKSPACE_BOOTSTRAP_HINT_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

function clearWorkspaceBootstrapHint(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(`${WORKSPACE_BOOTSTRAP_HINT_PREFIX}${userId}`);
  } catch {
    // Session storage is only used to avoid a blocking lookup after account creation.
  }
}

function readWorkspaceStateCache(userId: string) {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.localStorage.getItem(`${WORKSPACE_STATE_CACHE_PREFIX}${userId}`);
    return value === WORKSPACE_STATE_HAS || value === WORKSPACE_STATE_NONE ? value : null;
  } catch {
    return null;
  }
}

function writeWorkspaceStateCache(userId: string, hasWorkspace: boolean) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      `${WORKSPACE_STATE_CACHE_PREFIX}${userId}`,
      hasWorkspace ? WORKSPACE_STATE_HAS : WORKSPACE_STATE_NONE
    );
  } catch {
    // Local storage is only a startup accelerator.
  }
}

function isWorkspaceSummary(value: unknown): value is OrbitWorkspaceSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const workspace = value as Partial<OrbitWorkspaceSummary>;
  return typeof workspace.workspaceId === 'string' && typeof workspace.businessName === 'string';
}

function readWorkspaceCache(userId: string): CachedWorkspaceState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(`${WORKSPACE_CACHE_PREFIX}${userId}`);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<CachedWorkspaceState>;
    const cachedAt = typeof parsed.cachedAt === 'string' ? Date.parse(parsed.cachedAt) : NaN;
    const isFresh = Number.isFinite(cachedAt) && Date.now() - cachedAt <= WORKSPACE_CACHE_MAX_AGE_MS;
    const workspaces = Array.isArray(parsed.workspaces)
      ? parsed.workspaces.filter(isWorkspaceSummary)
      : [];
    const state =
      parsed.state === WORKSPACE_STATE_HAS || parsed.state === WORKSPACE_STATE_NONE
        ? parsed.state
        : null;

    if (parsed.version !== 1 || !state || !isFresh) {
      return null;
    }

    return {
      version: 1,
      state,
      workspaces,
      activeWorkspaceId:
        typeof parsed.activeWorkspaceId === 'string' ? parsed.activeWorkspaceId : null,
      cachedAt: parsed.cachedAt as string,
    };
  } catch {
    return null;
  }
}

function writeWorkspaceCache(
  userId: string,
  workspaces: OrbitWorkspaceSummary[],
  activeWorkspaceId: string | null
) {
  if (typeof window === 'undefined') {
    return;
  }

  const hasWorkspace = workspaces.length > 0;
  writeWorkspaceStateCache(userId, hasWorkspace);
  try {
    window.localStorage.setItem(
      `${WORKSPACE_CACHE_PREFIX}${userId}`,
      JSON.stringify({
        version: 1,
        state: hasWorkspace ? WORKSPACE_STATE_HAS : WORKSPACE_STATE_NONE,
        workspaces,
        activeWorkspaceId,
        cachedAt: new Date().toISOString(),
      } satisfies CachedWorkspaceState)
    );
  } catch {
    // Local cache is a speed boost only; the remote workspace lookup remains the source of truth.
  }
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
  const refreshRequestRef = useRef(0);

  async function refresh() {
    const requestId = refreshRequestRef.current + 1;
    refreshRequestRef.current = requestId;
    const isCurrentRequest = () => refreshRequestRef.current === requestId;

    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setDashboardSnapshot(null);
      setIsLoading(false);
      return;
    }
    const currentUser = user;
    const cachedWorkspaceState = readWorkspaceCache(currentUser.uid);
    const cachedState =
      cachedWorkspaceState?.state ?? readWorkspaceStateCache(currentUser.uid);

    const shouldSkipBlockingBootstrap =
      isLikelyFirstSignIn(currentUser) ||
      hasWorkspaceBootstrapHint(currentUser.uid) ||
      cachedState === WORKSPACE_STATE_NONE;

    function applyWorkspaceList(
      nextWorkspaces: OrbitWorkspaceSummary[],
      options: { cache?: boolean; preferredWorkspaceId?: string | null } = {}
    ) {
      if (!isCurrentRequest()) {
        return;
      }

      const preferredWorkspaceId = options.preferredWorkspaceId ?? activeWorkspaceId;
      const nextActiveWorkspaceId =
        nextWorkspaces.find((workspace) => workspace.workspaceId === preferredWorkspaceId)
          ?.workspaceId ??
        nextWorkspaces[0]?.workspaceId ??
        null;

      setWorkspaces(nextWorkspaces);
      if (options.cache !== false) {
        writeWorkspaceCache(currentUser.uid, nextWorkspaces, nextActiveWorkspaceId);
      }
      if (nextWorkspaces.length > 0) {
        clearWorkspaceBootstrapHint(currentUser.uid);
      }
      setActiveWorkspaceId(nextActiveWorkspaceId);
      if (!nextActiveWorkspaceId) {
        setDashboardSnapshot(null);
      }
    }

    function applyRemoteWorkspaceList(nextWorkspaces: OrbitWorkspaceSummary[]) {
      applyWorkspaceList(nextWorkspaces, {
        preferredWorkspaceId: cachedWorkspaceState?.activeWorkspaceId ?? activeWorkspaceId,
      });
    }

    const remoteWorkspacePromise = listWorkspacesForUser(currentUser.uid);

    if (cachedWorkspaceState?.workspaces.length) {
      applyWorkspaceList(cachedWorkspaceState.workspaces, {
        cache: false,
        preferredWorkspaceId: cachedWorkspaceState.activeWorkspaceId,
      });
      if (isCurrentRequest()) {
        setIsLoading(false);
      }

      void remoteWorkspacePromise.then(applyRemoteWorkspaceList).catch(() => undefined);
      return;
    }

    if (shouldSkipBlockingBootstrap) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setDashboardSnapshot(null);
      if (isCurrentRequest()) {
        setIsLoading(false);
      }

      // Resolve real workspace state in background to correct stale/no-workspace assumptions.
      void remoteWorkspacePromise.then(applyRemoteWorkspaceList).catch(() => undefined);
      return;
    }

    setIsLoading(true);

    try {
      const nextWorkspaces = await Promise.race([
        remoteWorkspacePromise,
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), WORKSPACE_LOOKUP_FALLBACK_MS);
        }),
      ]);

      if (nextWorkspaces === null) {
        if (isCurrentRequest()) {
          setIsLoading(false);
        }
        void remoteWorkspacePromise.then(applyRemoteWorkspaceList).catch(() => undefined);
        return;
      }

      applyWorkspaceList(nextWorkspaces);
    } catch {
      // Keep previous state if remote fetch fails so the UI can continue.
      setWorkspaces((current) => current);
    } finally {
      if (isCurrentRequest()) {
        setIsLoading(false);
      }
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
        writeWorkspaceCache(user.uid, [workspace], workspace.workspaceId);
        setWorkspaces([workspace]);
        setActiveWorkspaceId(workspace.workspaceId);
        setDashboardSnapshot(null);
        void loadWorkspaceDashboardSnapshot(workspace.workspaceId)
          .then(setDashboardSnapshot)
          .catch(() => undefined);
        return workspace;
      },
      selectWorkspace(workspaceId) {
        if (user) {
          writeWorkspaceCache(user.uid, workspaces, workspaceId);
        }
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
