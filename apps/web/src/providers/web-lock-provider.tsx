'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type WebLockContextValue = {
  isReady: boolean;
  isEnabled: boolean;
  isLocked: boolean;
  timeoutMs: number;
  enableLock(pin: string, timeoutMs: number): Promise<void>;
  disableLock(pin: string): Promise<void>;
  unlock(pin: string): Promise<boolean>;
  setTimeoutMs(timeoutMs: number): Promise<void>;
  lockNow(): void;
};

type StoredWebLockSettings = {
  enabled: boolean;
  pinHash: string;
  timeoutMs: number;
  updatedAt: string;
};

const STORAGE_KEY = 'orbit-ledger.web-lock.v1';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const WebLockContext = createContext<WebLockContextValue | null>(null);

export function WebLockProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState<StoredWebLockSettings | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const lastInteractionRef = useRef(Date.now());

  useEffect(() => {
    const stored = readSettings();
    setSettings(stored);
    setIsLocked(Boolean(stored?.enabled));
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!settings?.enabled) {
      return;
    }

    function handleInteraction() {
      lastInteractionRef.current = Date.now();
    }

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove', 'touchstart'];
    for (const eventName of events) {
      window.addEventListener(eventName, handleInteraction, { passive: true });
    }

    const interval = window.setInterval(() => {
      if (isLocked) {
        return;
      }

      if (Date.now() - lastInteractionRef.current > settings.timeoutMs) {
        setIsLocked(true);
      }
    }, 15000);

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handleInteraction);
      }
      window.clearInterval(interval);
    };
  }, [isLocked, settings]);

  const value = useMemo<WebLockContextValue>(
    () => ({
      isReady,
      isEnabled: Boolean(settings?.enabled),
      isLocked,
      timeoutMs: settings?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      async enableLock(pin, timeoutMs) {
        const nextSettings: StoredWebLockSettings = {
          enabled: true,
          pinHash: await hashPin(pin),
          timeoutMs,
          updatedAt: new Date().toISOString(),
        };
        writeSettings(nextSettings);
        lastInteractionRef.current = Date.now();
        setSettings(nextSettings);
        setIsLocked(false);
      },
      async disableLock(pin) {
        if (!settings?.enabled) {
          return;
        }

        const matches = (await hashPin(pin)) === settings.pinHash;
        if (!matches) {
          throw new Error('Incorrect PIN.');
        }

        clearSettings();
        setSettings(null);
        setIsLocked(false);
      },
      async unlock(pin) {
        if (!settings?.enabled) {
          return true;
        }

        const matches = (await hashPin(pin)) === settings.pinHash;
        if (matches) {
          lastInteractionRef.current = Date.now();
          setIsLocked(false);
          return true;
        }

        return false;
      },
      async setTimeoutMs(timeoutMs) {
        if (!settings?.enabled) {
          return;
        }

        const nextSettings = {
          ...settings,
          timeoutMs,
          updatedAt: new Date().toISOString(),
        };
        writeSettings(nextSettings);
        setSettings(nextSettings);
      },
      lockNow() {
        if (settings?.enabled) {
          setIsLocked(true);
        }
      },
    }),
    [isLocked, isReady, settings]
  );

  return (
    <WebLockContext.Provider value={value}>
      {children}
      {isReady && settings?.enabled && isLocked ? <WebLockOverlay onUnlock={value.unlock} /> : null}
    </WebLockContext.Provider>
  );
}

export function useWebLock() {
  const context = useContext(WebLockContext);
  if (!context) {
    throw new Error('useWebLock must be used inside WebLockProvider.');
  }

  return context;
}

function readSettings(): StoredWebLockSettings | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredWebLockSettings;
    if (!parsed.enabled || typeof parsed.pinHash !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSettings(settings: StoredWebLockSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clearSettings() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

async function hashPin(pin: string) {
  const encoder = new TextEncoder();
  const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(pin));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function WebLockOverlay({ onUnlock }: { onUnlock(pin: string): Promise<boolean> }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await onUnlock(pin);
      if (!ok) {
        setError('Incorrect PIN. Try again.');
        return;
      }
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ol-lock-backdrop">
      <div className="ol-lock-card">
        <img
          alt="Orbit Ledger"
          src="/branding/orbit-ledger-logo-transparent.png"
          style={{ height: '1.8rem', width: 'auto' }}
        />
        <strong className="ol-lock-title">Enter your PIN to continue</strong>
        <p className="ol-lock-copy">
          This browser lock protects this workspace on this device. It does not change your cloud
          sign-in state.
        </p>
        <label className={`ol-field${error ? ' is-invalid' : ''}`}>
          <span className="ol-field-label">4-digit PIN</span>
          <input
            autoFocus
            className="ol-input ol-input--pin"
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
            type="password"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
              if (error) {
                setError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submit();
              }
            }}
          />
        </label>
        {error ? <div className="ol-message ol-message--danger">{error}</div> : null}
        <button className="ol-button" disabled={isSubmitting} type="button" onClick={() => void submit()}>
          {isSubmitting ? 'Checking...' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}
