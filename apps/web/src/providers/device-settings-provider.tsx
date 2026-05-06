'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_WEB_DEVICE_SETTINGS,
  readWebDeviceSettings,
  writeWebDeviceSettings,
  type WebDeviceSettings,
} from '@/lib/device-settings';

type DeviceSettingsContextValue = {
  isReady: boolean;
  settings: WebDeviceSettings;
  updateSetting<K extends keyof WebDeviceSettings>(field: K, value: WebDeviceSettings[K]): void;
};

const DeviceSettingsContext = createContext<DeviceSettingsContextValue | null>(null);

export function DeviceSettingsProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState<WebDeviceSettings>(DEFAULT_WEB_DEVICE_SETTINGS);

  useEffect(() => {
    const stored = readWebDeviceSettings();
    setSettings(stored);
    applyDeviceSettings(stored);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) {
      applyDeviceSettings(settings);
    }
  }, [isReady, settings]);

  const value = useMemo<DeviceSettingsContextValue>(
    () => ({
      isReady,
      settings,
      updateSetting(field, value) {
        setSettings((current) => {
          const next = writeWebDeviceSettings({ ...current, [field]: value });
          applyDeviceSettings(next);
          return next;
        });
      },
    }),
    [isReady, settings]
  );

  return <DeviceSettingsContext.Provider value={value}>{children}</DeviceSettingsContext.Provider>;
}

export function useWebDeviceSettings() {
  const context = useContext(DeviceSettingsContext);
  if (!context) {
    throw new Error('useWebDeviceSettings must be used inside DeviceSettingsProvider.');
  }
  return context;
}

function applyDeviceSettings(settings: WebDeviceSettings) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('ol-device-mask-balances', settings.maskBalances);
  document.documentElement.classList.toggle('ol-device-larger-text', settings.largerText);
  document.documentElement.classList.toggle('ol-device-reduced-motion', settings.reducedMotion);
}
