'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { OfficeMembershipRecord, OfficePermission } from '@orbit-ledger/core';
import { doc, getDoc } from 'firebase/firestore';

import { getWebFirestore } from '@/lib/firebase';
import { parseWebOfficeMember, updateWebOfficeMemberPresence } from '@/lib/office-team';
import { isWebPlatformAdminAllowed } from '@/lib/platform-admin-access';
import {
  buildWebOfficeAccessState,
  canUseWebOfficePermission,
  getOfficeSensitiveActionMessage,
  type WebOfficeAccessState,
} from '@/lib/web-office-access';
import { useAuth } from './auth-provider';
import { useUserContext } from './user-context-provider';
import { useWorkspace } from './workspace-provider';

type OfficeAccessContextValue = WebOfficeAccessState & {
  isLoading: boolean;
  can(permission: OfficePermission): boolean;
  getLockedMessage(permission: OfficePermission): string;
};

const fallbackOfficeAccess = buildWebOfficeAccessState({
  member: null,
  fallbackToOwner: false,
});
const OFFICE_PRESENCE_REFRESH_MS = 5 * 60 * 1000;

const OfficeAccessContext = createContext<OfficeAccessContextValue | null>(null);

export function OfficeAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { session: userContextSession, isUserAreaSession } = useUserContext();
  const { activeWorkspace } = useWorkspace();
  const isPlatformAdmin = isWebPlatformAdminAllowed(user?.email);
  const [state, setState] = useState<WebOfficeAccessState>(fallbackOfficeAccess);
  const [isLoading, setIsLoading] = useState(false);
  const presenceInFlight = useRef(false);

  useEffect(() => {
    let isMounted = true;

    if (!user || !activeWorkspace) {
      setState(buildWebOfficeAccessState({ member: null, fallbackToOwner: false, platformAdmin: isPlatformAdmin }));
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    if (isUserAreaSession && userContextSession) {
      const sessionState =
        userContextSession.mode === 'open_workspace'
          ? buildWebOfficeAccessState({ member: null, fallbackToOwner: false, platformAdmin: false })
          : buildWebOfficeAccessState({
              member:
                userContextSession.targetIsOwner || !userContextSession.targetOfficeRole
                  ? null
                  : {
                      uid: userContextSession.targetUid,
                      workspaceId: userContextSession.targetWorkspaceId,
                      role: userContextSession.targetOfficeRole as OfficeMembershipRecord['role'],
                      status: 'active',
                      email: userContextSession.targetEmail,
                      displayName: userContextSession.targetDisplayName,
                      invitedBy: null,
                      invitedAt: null,
                      acceptedAt: userContextSession.startedAt,
                      suspendedAt: null,
                      removedAt: null,
                      lastSeenAt: null,
                      createdAt: userContextSession.startedAt ?? new Date().toISOString(),
                      updatedAt: userContextSession.startedAt ?? new Date().toISOString(),
                    },
              fallbackToOwner: userContextSession.targetIsOwner,
            });
      setState(sessionState);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    if (isPlatformAdmin) {
      setState(buildWebOfficeAccessState({ member: null, fallbackToOwner: false, platformAdmin: true }));
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const workspaceSummary = activeWorkspace as typeof activeWorkspace & {
      ownerUid?: string | null;
      accessSource?: 'owner' | 'member';
      email?: string | null;
      ownerName?: string | null;
    };
    const workspaceOwnerUid = workspaceSummary?.ownerUid ?? null;
    const normalizedUserEmail = user.email?.trim().toLowerCase() ?? null;
    const normalizedWorkspaceEmail = workspaceSummary?.email?.trim().toLowerCase() ?? null;
    const normalizedDisplayName = user.displayName?.trim().toLowerCase() ?? null;
    const normalizedOwnerName = workspaceSummary?.ownerName?.trim().toLowerCase() ?? null;
    const isWorkspaceOwner =
      workspaceOwnerUid === user.uid ||
      workspaceSummary?.accessSource === 'owner' ||
      (normalizedUserEmail !== null && normalizedWorkspaceEmail === normalizedUserEmail) ||
      (normalizedDisplayName !== null && normalizedOwnerName === normalizedDisplayName);

    setIsLoading(true);
    void getDoc(doc(getWebFirestore(), 'workspaces', activeWorkspace.workspaceId, 'office_members', user.uid))
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }
        const member: OfficeMembershipRecord | null = snapshot.exists()
          ? parseWebOfficeMember(snapshot.id, snapshot.data())
          : null;
        setState(buildWebOfficeAccessState({ member, fallbackToOwner: !member && isWorkspaceOwner }));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setState(buildWebOfficeAccessState({ member: null, fallbackToOwner: isWorkspaceOwner }));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace, isPlatformAdmin, isUserAreaSession, user?.uid, user?.email, userContextSession]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !activeWorkspace?.workspaceId ||
      !user?.uid ||
      state.source !== 'member' ||
      state.member?.status !== 'active'
    ) {
      return;
    }

    const workspaceId = activeWorkspace.workspaceId;
    const memberId = user.uid;
    const storageKey = `orbit-ledger:office-presence:${workspaceId}:${memberId}`;

    const markPresence = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (presenceInFlight.current) {
        return;
      }

      const now = Date.now();
      const lastSaved = Number(window.localStorage.getItem(storageKey) ?? '0');
      if (Number.isFinite(lastSaved) && now - lastSaved < OFFICE_PRESENCE_REFRESH_MS) {
        return;
      }

      presenceInFlight.current = true;
      window.localStorage.setItem(storageKey, String(now));
      void updateWebOfficeMemberPresence({
        workspaceId,
        memberId,
        seenAt: new Date(now).toISOString(),
      })
        .catch(() => {
          window.localStorage.removeItem(storageKey);
        })
        .finally(() => {
          presenceInFlight.current = false;
        });
    };

    markPresence();
    window.addEventListener('focus', markPresence);
    document.addEventListener('visibilitychange', markPresence);
    const intervalId = window.setInterval(markPresence, OFFICE_PRESENCE_REFRESH_MS);

    return () => {
      window.removeEventListener('focus', markPresence);
      document.removeEventListener('visibilitychange', markPresence);
      window.clearInterval(intervalId);
    };
  }, [activeWorkspace?.workspaceId, state.member?.status, state.source, user?.uid]);

  const can = useCallback(
    (permission: OfficePermission) => {
      if (isUserAreaSession && userContextSession && userContextSession.mode !== 'act_as_user') {
        return permission.startsWith('view_') || permission.startsWith('export_');
      }
      return canUseWebOfficePermission(state, permission);
    },
    [isUserAreaSession, state, userContextSession]
  );

  const value = useMemo<OfficeAccessContextValue>(
    () => ({
      ...state,
      isLoading,
      can,
      getLockedMessage: getOfficeSensitiveActionMessage,
    }),
    [can, isLoading, state]
  );

  return <OfficeAccessContext.Provider value={value}>{children}</OfficeAccessContext.Provider>;
}

export function useOfficeAccess() {
  const context = useContext(OfficeAccessContext);
  if (!context) {
    throw new Error('useOfficeAccess must be used inside OfficeAccessProvider.');
  }
  return context;
}
