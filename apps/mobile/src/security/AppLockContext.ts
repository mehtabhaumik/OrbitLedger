import { createContext, useContext } from 'react';

export type RefreshPinLockOptions = {
  lockIfEnabled?: boolean;
};

export type AppLockContextValue = {
  pinEnabled: boolean;
  timeoutMs: number;
  refreshPinLockState: (options?: RefreshPinLockOptions) => Promise<void>;
  setPinInactivityTimeoutMs: (timeoutMs: number) => Promise<void>;
};

export const AppLockContext = createContext<AppLockContextValue | null>(null);

export function useAppLock(): AppLockContextValue {
  const value = useContext(AppLockContext);

  if (!value) {
    throw new Error('useAppLock must be used inside AppLockProvider.');
  }

  return value;
}

export function useOptionalAppLock(): AppLockContextValue | null {
  return useContext(AppLockContext);
}
