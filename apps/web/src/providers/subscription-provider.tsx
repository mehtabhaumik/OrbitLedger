'use client';

import type { OrbitLedgerPaidPlanId } from '@orbit-ledger/core';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  WEB_BETA_FREE_ONLY,
  attachWebCheckoutProvider,
  canActivateWebCheckoutIntent,
  cancelWebCheckoutIntent,
  confirmWebCheckoutIntent,
  createWebCheckoutIntent,
  createWebCheckoutIntentStorageKey,
  createWebStoredSubscriptionStatus,
  createWebSubscriptionStorageKey,
  getDefaultWebSubscriptionStatus,
  hydrateWebSubscriptionStatus,
  failWebCheckoutIntent,
  parseWebCheckoutIntent,
  parseWebStoredSubscriptionStatus,
  retryWebCheckoutIntent,
  serializeWebCheckoutIntent,
  serializeWebStoredSubscriptionStatus,
  type AttachWebCheckoutProviderInput,
  type WebCheckoutIntent,
  type WebSubscriptionSource,
  type WebSubscriptionStatus,
  type WebStoredSubscriptionStatus,
} from '@/lib/web-monetization';
import { loadServerSubscriptionEntitlement } from '@/lib/subscription-entitlements';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace-provider';

type SubscriptionContextValue = {
  status: WebSubscriptionStatus;
  checkoutIntent: WebCheckoutIntent | null;
  isLoading: boolean;
  startCheckout(planId: OrbitLedgerPaidPlanId, countryCode?: string | null): WebCheckoutIntent;
  attachCheckoutProvider(intentId: string, input: AttachWebCheckoutProviderInput): WebCheckoutIntent | null;
  failCheckout(intentId: string, reason?: string | null): WebCheckoutIntent | null;
  retryCheckout(intentId: string): WebCheckoutIntent | null;
  confirmCheckout(intentId: string, transactionId: string, source?: WebSubscriptionSource): WebSubscriptionStatus | null;
  cancelCheckout(intentId: string): WebCheckoutIntent | null;
  resetPlan(source?: WebSubscriptionSource): WebSubscriptionStatus;
  refresh(): WebSubscriptionStatus;
  recoverFromServer(): Promise<WebSubscriptionStatus | null>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [status, setStatus] = useState<WebSubscriptionStatus>(() => getDefaultWebSubscriptionStatus());
  const [checkoutIntent, setCheckoutIntent] = useState<WebCheckoutIntent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const storageKey = user ? createWebSubscriptionStorageKey(user.uid, activeWorkspace?.workspaceId) : null;
  const checkoutStorageKey = user ? createWebCheckoutIntentStorageKey(user.uid, activeWorkspace?.workspaceId) : null;

  function readStatus() {
    if (WEB_BETA_FREE_ONLY) {
      return getDefaultWebSubscriptionStatus();
    }
    if (!storageKey || typeof window === 'undefined') {
      return getDefaultWebSubscriptionStatus();
    }
    const storedStatus = parseWebStoredSubscriptionStatus(window.localStorage.getItem(storageKey));
    return storedStatus ? hydrateWebSubscriptionStatus(storedStatus) : getDefaultWebSubscriptionStatus();
  }

  function writeStatus(nextStatus: WebStoredSubscriptionStatus) {
    if (WEB_BETA_FREE_ONLY) {
      const freeStatus = getDefaultWebSubscriptionStatus();
      setStatus(freeStatus);
      return freeStatus;
    }
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, serializeWebStoredSubscriptionStatus(nextStatus));
    }
    const hydrated = hydrateWebSubscriptionStatus(nextStatus);
    setStatus(hydrated);
    return hydrated;
  }

  function readCheckoutIntent() {
    if (WEB_BETA_FREE_ONLY) {
      return null;
    }
    if (!checkoutStorageKey || typeof window === 'undefined') {
      return null;
    }
    return parseWebCheckoutIntent(window.localStorage.getItem(checkoutStorageKey));
  }

  function writeCheckoutIntent(nextIntent: WebCheckoutIntent | null) {
    if (WEB_BETA_FREE_ONLY) {
      if (checkoutStorageKey && typeof window !== 'undefined') {
        window.localStorage.removeItem(checkoutStorageKey);
      }
      setCheckoutIntent(null);
      return null;
    }
    if (checkoutStorageKey && typeof window !== 'undefined') {
      if (nextIntent) {
        window.localStorage.setItem(checkoutStorageKey, serializeWebCheckoutIntent(nextIntent));
      } else {
        window.localStorage.removeItem(checkoutStorageKey);
      }
    }
    setCheckoutIntent(nextIntent);
    return nextIntent;
  }

  useEffect(() => {
    let isActive = true;
    const cachedStatus = readStatus();
    setStatus(cachedStatus);
    setCheckoutIntent(readCheckoutIntent());
    setIsLoading(Boolean(user?.uid && activeWorkspace?.workspaceId));
    async function recoverServerEntitlement() {
      if (!user?.uid || !activeWorkspace?.workspaceId) {
        if (isActive) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const serverStatus = await loadServerSubscriptionEntitlement(user.uid, activeWorkspace.workspaceId);
        if (isActive && serverStatus) {
          writeStatus(serverStatus);
        }
      } catch {
        // Local cache keeps the app usable when entitlement recovery is temporarily unavailable.
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    void recoverServerEntitlement();
    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, user?.uid, activeWorkspace?.workspaceId]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      status,
      checkoutIntent,
      isLoading,
      startCheckout(planId, countryCode = activeWorkspace?.countryCode) {
        return writeCheckoutIntent(createWebCheckoutIntent(planId, new Date(), countryCode))!;
      },
      attachCheckoutProvider(intentId, input) {
        const currentIntent = readCheckoutIntent();
        if (!currentIntent || currentIntent.id !== intentId || currentIntent.status !== 'pending') {
          return null;
        }
        return writeCheckoutIntent(attachWebCheckoutProvider(currentIntent, input));
      },
      failCheckout(intentId, reason) {
        const currentIntent = readCheckoutIntent();
        if (!currentIntent || currentIntent.id !== intentId || currentIntent.status !== 'pending') {
          return null;
        }
        return writeCheckoutIntent(failWebCheckoutIntent(currentIntent, { reason }));
      },
      retryCheckout(intentId) {
        const currentIntent = readCheckoutIntent();
        if (!currentIntent || currentIntent.id !== intentId || currentIntent.status !== 'failed') {
          return null;
        }
        return writeCheckoutIntent(retryWebCheckoutIntent(currentIntent));
      },
      confirmCheckout(intentId, transactionId, source = 'purchase_cache') {
        const currentIntent = readCheckoutIntent();
        if (!currentIntent || currentIntent.id !== intentId) {
          return null;
        }
        const confirmedIntent = confirmWebCheckoutIntent(currentIntent, { transactionId });
        writeCheckoutIntent(confirmedIntent);
        if (!canActivateWebCheckoutIntent(confirmedIntent)) {
          return null;
        }
        return writeStatus(
          createWebStoredSubscriptionStatus({
            planId: confirmedIntent.planId,
            source,
            validUntil: null,
          })
        );
      },
      cancelCheckout(intentId) {
        const currentIntent = readCheckoutIntent();
        if (!currentIntent || currentIntent.id !== intentId) {
          return null;
        }
        return writeCheckoutIntent(cancelWebCheckoutIntent(currentIntent));
      },
      resetPlan(source = 'manual') {
        return writeStatus(createWebStoredSubscriptionStatus({ planId: null, source, validUntil: null }));
      },
      refresh() {
        const refreshed = readStatus();
        setStatus(refreshed);
        return refreshed;
      },
      async recoverFromServer() {
        if (WEB_BETA_FREE_ONLY) {
          setStatus(getDefaultWebSubscriptionStatus());
          setCheckoutIntent(null);
          return null;
        }
        if (!user?.uid || !activeWorkspace?.workspaceId) {
          return null;
        }
        setIsLoading(true);
        try {
          const serverStatus = await loadServerSubscriptionEntitlement(user.uid, activeWorkspace.workspaceId);
          if (!serverStatus) {
            return null;
          }
          return writeStatus(serverStatus);
        } finally {
          setIsLoading(false);
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkoutIntent, isLoading, status, storageKey, checkoutStorageKey, activeWorkspace?.countryCode]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useWebSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) {
    throw new Error('useWebSubscription must be used inside SubscriptionProvider.');
  }
  return value;
}
