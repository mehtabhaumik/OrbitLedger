'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import {
  endWebUserContextSession,
  loadWebUserContextSession,
  type WebUserContextSession,
} from '@/lib/user-context';
import { useAuth } from './auth-provider';

type UserContextValue = {
  session: WebUserContextSession | null;
  isLoading: boolean;
  isUserAreaSession: boolean;
  refresh(): Promise<void>;
  endSession(): Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<WebUserContextSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isBackofficeRoute = pathname?.startsWith('/backoffice') ?? false;
  const isUserAreaSession = Boolean(session && !isBackofficeRoute);

  async function refresh() {
    if (!user) {
      setSession(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      setSession(await loadWebUserContextSession());
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void refresh();
  }, [authLoading, user?.uid]);

  async function endSession() {
    await endWebUserContextSession();
    setSession(null);
    router.replace('/dashboard');
  }

  const value = useMemo<UserContextValue>(
    () => ({
      session,
      isLoading,
      isUserAreaSession,
      refresh,
      endSession,
    }),
    [isLoading, isUserAreaSession, session]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used inside UserContextProvider.');
  }
  return context;
}
