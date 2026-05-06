'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { OfficeMembershipRecord, OfficePermission } from '@orbit-ledger/core';
import { doc, getDoc } from 'firebase/firestore';

import { getWebFirestore } from '@/lib/firebase';
import { parseWebOfficeMember, updateWebOfficeMemberPresence } from '@/lib/office-team';
import {
  buildWebOfficeAccessState,
  canUseWebOfficePermission,
  getOfficeSensitiveActionMessage,
  type WebOfficeAccessState,
} from '@/lib/web-office-access';
import { useAuth } from './auth-provider';
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
  const { activeWorkspace } = useWorkspace();
  const [state, setState] = useState<WebOfficeAccessState>(fallbackOfficeAccess);
  const [isLoading, setIsLoading] = useState(false);
  const presenceInFlight = useRef(false);

  useEffect(() => {
    let isMounted = true;

    if (!user || !activeWorkspace) {
      setState(fallbackOfficeAccess);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);
    void getDoc(doc(getWebFirestore(), 'workspaces', activeWorkspace.workspaceId, 'office_members', user.uid))
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }
        const member: OfficeMembershipRecord | null = snapshot.exists()
          ? parseWebOfficeMember(snapshot.id, snapshot.data())
          : null;
        setState(buildWebOfficeAccessState({ member, fallbackToOwner: !member }));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setState(buildWebOfficeAccessState({ member: null, fallbackToOwner: false }));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.workspaceId, user?.uid]);

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

  const can = useCallback((permission: OfficePermission) => canUseWebOfficePermission(state, permission), [state]);

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
