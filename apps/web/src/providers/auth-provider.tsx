'use client';

import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
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
  signInWithGoogle(): Promise<void>;
  signOutUser(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(getWebAuth(), (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
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
        if (name.trim()) {
          await updateProfile(result.user, { displayName: name.trim() });
        }
      },
      async signInWithGoogle() {
        await signInWithPopup(getWebAuth(), createGoogleProvider());
      },
      async signOutUser() {
        await signOut(getWebAuth());
      },
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
