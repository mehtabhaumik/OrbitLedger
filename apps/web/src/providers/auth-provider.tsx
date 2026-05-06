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
import {
  WEB_AUTH_ABSOLUTE_TIMEOUT_MS,
  WEB_AUTH_IDLE_TIMEOUT_MS,
  WEB_AUTH_SESSION_STORAGE_KEY,
  createOrResumeWebAuthSession,
  getWebAuthSessionExpiryMessage,
  getWebAuthSessionExpiryReason,
  parseStoredWebAuthSession,
  refreshWebAuthSessionActivity,
  type WebAuthSession,
} from '@/lib/session-security';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  sessionExpiryMessage: string | null;
  signIn(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOutUser(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const GOOGLE_REDIRECT_PENDING_KEY = 'orbit-ledger:web-google-redirect-pending';
const WORKSPACE_BOOTSTRAP_HINT_PREFIX = 'orbit-ledger:skip-workspace-bootstrap:';
const AUTH_SESSION_EXPIRED_MESSAGE_KEY = 'orbit-ledger:web-auth-session-expired-message';

function setWorkspaceBootstrapHint(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(`${WORKSPACE_BOOTSTRAP_HINT_PREFIX}${userId}`, '1');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiryMessage, setSessionExpiryMessage] = useState<string | null>(null);

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

      const message = readSessionExpiryMessage();
      if (message) {
        setSessionExpiryMessage(message);
      }

      if (nextUser) {
        const nextSession = createOrResumeWebAuthSession(readWebAuthSession(), nextUser.uid);
        writeWebAuthSession(nextSession);
      } else {
        clearWebAuthSession();
      }

      setUser(nextUser);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const auth = getWebAuth();
    let session = createOrResumeWebAuthSession(readWebAuthSession(), user.uid);
    writeWebAuthSession(session);

    async function expireIfNeeded(candidate: WebAuthSession) {
      const reason = getWebAuthSessionExpiryReason(candidate);
      if (!reason) {
        return false;
      }

      const message = getWebAuthSessionExpiryMessage(reason);
      writeSessionExpiryMessage(message);
      setSessionExpiryMessage(message);
      clearWebAuthSession();
      await signOut(auth);
      return true;
    }

    function handleActivity() {
      if (document.visibilityState === 'hidden') {
        return;
      }

      const current = readWebAuthSession() ?? session;
      const reason = getWebAuthSessionExpiryReason(current);
      if (reason) {
        void expireIfNeeded(current);
        return;
      }

      session = refreshWebAuthSessionActivity(current);
      writeWebAuthSession(session);
    }

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'focus'];
    for (const eventName of events) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      void expireIfNeeded(readWebAuthSession() ?? session);
    }, Math.min(60_000, WEB_AUTH_IDLE_TIMEOUT_MS, WEB_AUTH_ABSOLUTE_TIMEOUT_MS));

    void expireIfNeeded(session);

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handleActivity);
      }
      window.clearInterval(interval);
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      sessionExpiryMessage,
      async signIn(email, password) {
        await signInWithEmailAndPassword(getWebAuth(), email.trim(), password);
        clearSessionExpiryMessage();
        setSessionExpiryMessage(null);
      },
      async register(name, email, password) {
        const result = await createUserWithEmailAndPassword(getWebAuth(), email.trim(), password);
        clearSessionExpiryMessage();
        setSessionExpiryMessage(null);
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
          clearSessionExpiryMessage();
          setSessionExpiryMessage(null);
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
        clearWebAuthSession();
        await signOut(getWebAuth());
      },
    }),
    [isLoading, sessionExpiryMessage, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function readWebAuthSession() {
  if (typeof window === 'undefined') {
    return null;
  }
  return parseStoredWebAuthSession(window.localStorage.getItem(WEB_AUTH_SESSION_STORAGE_KEY));
}

function writeWebAuthSession(session: WebAuthSession) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(WEB_AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearWebAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(WEB_AUTH_SESSION_STORAGE_KEY);
}

function readSessionExpiryMessage() {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.sessionStorage.getItem(AUTH_SESSION_EXPIRED_MESSAGE_KEY);
  if (value) {
    window.sessionStorage.removeItem(AUTH_SESSION_EXPIRED_MESSAGE_KEY);
  }
  return value;
}

function writeSessionExpiryMessage(message: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(AUTH_SESSION_EXPIRED_MESSAGE_KEY, message);
}

function clearSessionExpiryMessage() {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(AUTH_SESSION_EXPIRED_MESSAGE_KEY);
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
