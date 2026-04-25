import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, View } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { PinLockScreen } from '../screens/PinLockScreen';
import { colors, spacing, typography } from '../theme/theme';
import { AppLockContext } from './AppLockContext';
import type { RefreshPinLockOptions } from './AppLockContext';
import {
  DEFAULT_PIN_INACTIVITY_TIMEOUT_MS,
  getPinInactivityTimeoutMs,
  isPinLockEnabled,
  savePinInactivityTimeoutMs,
} from './pinLock';
import { useAppPreviewPrivacy } from './screenPrivacy';

type AppLockProviderProps = {
  children: ReactNode;
};

type LockStatus = 'checking' | 'ready' | 'locked' | 'error';

const INTERACTION_TIMER_RESCHEDULE_MS = 1_000;

export function AppLockProvider({ children }: AppLockProviderProps) {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_PIN_INACTIVITY_TIMEOUT_MS);
  const [status, setStatus] = useState<LockStatus>('checking');
  const [hasUnlockedThisSession, setHasUnlockedThisSession] = useState(false);
  const pinEnabledRef = useRef(pinEnabled);
  const timeoutMsRef = useRef(timeoutMs);
  const statusRef = useRef(status);
  const hasUnlockedThisSessionRef = useRef(hasUnlockedThisSession);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const inactiveAtRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef(Date.now());
  const lastTimerScheduledAtRef = useRef(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useAppPreviewPrivacy(pinEnabled);

  useEffect(() => {
    pinEnabledRef.current = pinEnabled;
  }, [pinEnabled]);

  useEffect(() => {
    timeoutMsRef.current = timeoutMs;
  }, [timeoutMs]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    hasUnlockedThisSessionRef.current = hasUnlockedThisSession;
  }, [hasUnlockedThisSession]);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    lastTimerScheduledAtRef.current = 0;
  }, []);

  const shouldTrackInactivity = useCallback(() => {
    return (
      pinEnabledRef.current &&
      hasUnlockedThisSessionRef.current &&
      statusRef.current === 'ready' &&
      appStateRef.current === 'active'
    );
  }, []);

  const scheduleInactivityLock = useCallback(
    (delayMs = timeoutMsRef.current) => {
      clearInactivityTimer();

      if (!shouldTrackInactivity()) {
        return;
      }

      lastTimerScheduledAtRef.current = Date.now();
      inactivityTimerRef.current = setTimeout(() => {
        if (!shouldTrackInactivity()) {
          return;
        }

        const idleMs = Date.now() - lastInteractionAtRef.current;
        if (idleMs >= timeoutMsRef.current) {
          setStatus('locked');
          return;
        }

        scheduleInactivityLock(timeoutMsRef.current - idleMs);
      }, Math.max(delayMs, 500));
    },
    [clearInactivityTimer, shouldTrackInactivity]
  );

  const recordUserInteraction = useCallback(() => {
    if (shouldTrackInactivity()) {
      const now = Date.now();
      lastInteractionAtRef.current = now;

      if (
        !inactivityTimerRef.current ||
        now - lastTimerScheduledAtRef.current >= INTERACTION_TIMER_RESCHEDULE_MS
      ) {
        scheduleInactivityLock();
      }
    }

    return false;
  }, [scheduleInactivityLock, shouldTrackInactivity]);

  const refreshPinLockState = useCallback(
    async (options: RefreshPinLockOptions = {}) => {
      const { lockIfEnabled = true } = options;

      try {
        const [enabled, savedTimeoutMs] = await Promise.all([
          isPinLockEnabled(),
          getPinInactivityTimeoutMs(),
        ]);
        setPinEnabled(enabled);
        setTimeoutMs(savedTimeoutMs);

        if (enabled && lockIfEnabled) {
          clearInactivityTimer();
          setStatus('locked');
          return;
        }

        setHasUnlockedThisSession(true);
        lastInteractionAtRef.current = Date.now();
        setStatus('ready');
      } catch {
        clearInactivityTimer();
        setStatus('error');
      }
    },
    [clearInactivityTimer]
  );

  useEffect(() => {
    refreshPinLockState();
  }, [refreshPinLockState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState.match(/inactive|background/)) {
        clearInactivityTimer();
        inactiveAtRef.current = Date.now();
        return;
      }

      if (previousState.match(/inactive|background/) && nextState === 'active') {
        const inactiveAt = inactiveAtRef.current;
        const inactiveDuration = inactiveAt ? Date.now() - inactiveAt : 0;

        if (pinEnabledRef.current && inactiveDuration >= timeoutMsRef.current) {
          clearInactivityTimer();
          setStatus('locked');
          return;
        }

        lastInteractionAtRef.current = Date.now();
        scheduleInactivityLock();
      }
    });

    return () => subscription.remove();
  }, [clearInactivityTimer, scheduleInactivityLock]);

  useEffect(() => {
    if (shouldTrackInactivity()) {
      scheduleInactivityLock();
      return;
    }

    clearInactivityTimer();
  }, [
    clearInactivityTimer,
    hasUnlockedThisSession,
    pinEnabled,
    scheduleInactivityLock,
    shouldTrackInactivity,
    status,
    timeoutMs,
  ]);

  useEffect(() => {
    if (status !== 'locked') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [status]);

  useEffect(() => {
    return () => {
      clearInactivityTimer();
    };
  }, [clearInactivityTimer]);

  const setPinInactivityTimeoutMs = useCallback(async (nextTimeoutMs: number) => {
    await savePinInactivityTimeoutMs(nextTimeoutMs);
    setTimeoutMs(nextTimeoutMs);
    timeoutMsRef.current = nextTimeoutMs;
    lastInteractionAtRef.current = Date.now();
    scheduleInactivityLock(nextTimeoutMs);
  }, [scheduleInactivityLock]);

  const contextValue = useMemo(
    () => ({
      pinEnabled,
      timeoutMs,
      refreshPinLockState,
      setPinInactivityTimeoutMs,
    }),
    [pinEnabled, refreshPinLockState, setPinInactivityTimeoutMs, timeoutMs]
  );

  const handleUnlocked = useCallback(() => {
    setHasUnlockedThisSession(true);
    inactiveAtRef.current = null;
    lastInteractionAtRef.current = Date.now();
    setStatus('ready');
  }, []);

  if (status === 'checking') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Orbit Ledger</Text>
        <Text style={styles.message}>Preparing PIN protection</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>PIN protection could not start</Text>
        <Text style={styles.message}>Close Orbit Ledger and try again.</Text>
      </View>
    );
  }

  return (
    <AppLockContext.Provider value={contextValue}>
      {status === 'locked' ? (
        <PinLockScreen
          onUnlocked={handleUnlocked}
          onLockUnavailable={() => refreshPinLockState({ lockIfEnabled: false })}
        />
      ) : (
        <View
          onMoveShouldSetResponderCapture={recordUserInteraction}
          onStartShouldSetResponderCapture={recordUserInteraction}
          style={styles.appContent}
        >
          {children}
        </View>
      )}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
  },
  appContent: {
    flex: 1,
  },
});
