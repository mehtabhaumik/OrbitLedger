'use client';

import type { User } from 'firebase/auth';
import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { createGoogleProvider, getWebAuth } from '@/lib/firebase';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signIn(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOutUser(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const GOOGLE_REDIRECT_PENDING_KEY = 'orbit-ledger:web-google-redirect-pending';
const WORKSPACE_BOOTSTRAP_HINT_PREFIX = 'orbit-ledger:skip-workspace-bootstrap:';

function setWorkspaceBootstrapHint(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(`${WORKSPACE_BOOTSTRAP_HINT_PREFIX}${userId}`, '1');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const auth = getWebAuth();
    const shouldResolveRedirect =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1';
    if (shouldResolveRedirect) {
      void getRedirectResult(auth)
        .catch(() => undefined)
        .finally(() => {
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
          }
        });
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!isMounted) {
        return;
      }

      setUser(nextUser);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async signIn(email, password) {
        await signInWithEmailAndPassword(getWebAuth(), email.trim(), password);
      },
      async register(name, email, password) {
        const result = await createUserWithEmailAndPassword(getWebAuth(), email.trim(), password);
        setWorkspaceBootstrapHint(result.user.uid);
        if (name.trim()) {
          await updateProfile(result.user, { displayName: name.trim() });
        }
      },
      async sendPasswordReset(email) {
        await sendPasswordResetEmail(getWebAuth(), email.trim());
      },
      async signInWithGoogle() {
        const auth = getWebAuth();
        const provider = createGoogleProvider();

        try {
          await signInWithPopup(auth, provider, browserPopupRedirectResolver);
        } catch (error) {
          if (!shouldFallbackToGoogleRedirect(error)) {
            throw error;
          }

          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1');
          }
          await signInWithRedirect(auth, provider);
        }
      },
      async signOutUser() {
        await signOut(getWebAuth());
      },
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function shouldFallbackToGoogleRedirect(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('auth/popup-blocked') ||
    message.includes('auth/cancelled-popup-request') ||
    message.includes('auth/operation-not-supported-in-this-environment')
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
