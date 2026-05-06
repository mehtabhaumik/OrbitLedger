import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WEB_DEVICE_SETTINGS,
  WEB_DEVICE_SETTINGS_STORAGE_KEY,
  hasStoredWebDeviceSettings,
  normalizeWebDeviceSettings,
  readWebDeviceSettings,
  writeWebDeviceSettings,
} from './device-settings';

function memoryStorage(seed: Record<string, string> = {}) {
  const store = { ...seed };
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
}

describe('web device settings', () => {
  it('keeps device-only display safety settings local and normalized', () => {
    expect(normalizeWebDeviceSettings({ mask_balances: true, larger_text: true, reduced_motion: true })).toMatchObject({
      maskBalances: true,
      largerText: true,
      reducedMotion: true,
    });
  });

  it('falls back safely when local storage is empty or malformed', () => {
    expect(readWebDeviceSettings(memoryStorage())).toEqual(DEFAULT_WEB_DEVICE_SETTINGS);
    expect(readWebDeviceSettings(memoryStorage({ [WEB_DEVICE_SETTINGS_STORAGE_KEY]: 'not-json' }))).toEqual(
      DEFAULT_WEB_DEVICE_SETTINGS
    );
  });

  it('writes and reads settings from the supplied device storage', () => {
    const storage = memoryStorage();
    const saved = writeWebDeviceSettings(
      {
        maskBalances: true,
        largerText: false,
        reducedMotion: true,
        updatedAt: null,
      },
      storage
    );

    expect(saved.updatedAt).toBeTruthy();
    expect(hasStoredWebDeviceSettings(storage)).toBe(true);
    expect(readWebDeviceSettings(storage)).toMatchObject({
      maskBalances: true,
      largerText: false,
      reducedMotion: true,
    });
  });
});
