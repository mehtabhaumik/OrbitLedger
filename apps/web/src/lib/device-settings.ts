export type WebDeviceSettings = {
  maskBalances: boolean;
  largerText: boolean;
  reducedMotion: boolean;
  updatedAt: string | null;
};

type StoredWebDeviceSettings = {
  mask_balances?: boolean | null;
  larger_text?: boolean | null;
  reduced_motion?: boolean | null;
  updated_at?: string | null;
};

type DeviceSettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const WEB_DEVICE_SETTINGS_STORAGE_KEY = 'orbit-ledger:web-device-settings:v1';

export const DEFAULT_WEB_DEVICE_SETTINGS: WebDeviceSettings = {
  maskBalances: false,
  largerText: false,
  reducedMotion: false,
  updatedAt: null,
};

export function normalizeWebDeviceSettings(input: Partial<WebDeviceSettings | StoredWebDeviceSettings>): WebDeviceSettings {
  const raw = input as Partial<WebDeviceSettings & StoredWebDeviceSettings>;
  return {
    maskBalances: Boolean(raw.maskBalances ?? raw.mask_balances),
    largerText: Boolean(raw.largerText ?? raw.larger_text),
    reducedMotion: Boolean(raw.reducedMotion ?? raw.reduced_motion),
    updatedAt: typeof (raw.updatedAt ?? raw.updated_at) === 'string' ? (raw.updatedAt ?? raw.updated_at ?? null) : null,
  };
}

export function readWebDeviceSettings(storage = getBrowserLocalStorage()): WebDeviceSettings {
  if (!storage) {
    return DEFAULT_WEB_DEVICE_SETTINGS;
  }

  const raw = storage.getItem(WEB_DEVICE_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_WEB_DEVICE_SETTINGS;
  }

  try {
    return normalizeWebDeviceSettings(JSON.parse(raw) as StoredWebDeviceSettings);
  } catch {
    return DEFAULT_WEB_DEVICE_SETTINGS;
  }
}

export function hasStoredWebDeviceSettings(storage = getBrowserLocalStorage()) {
  return Boolean(storage?.getItem(WEB_DEVICE_SETTINGS_STORAGE_KEY));
}

export function writeWebDeviceSettings(settings: WebDeviceSettings, storage = getBrowserLocalStorage()): WebDeviceSettings {
  const normalized = normalizeWebDeviceSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  if (storage) {
    storage.setItem(
      WEB_DEVICE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        mask_balances: normalized.maskBalances,
        larger_text: normalized.largerText,
        reduced_motion: normalized.reducedMotion,
        updated_at: normalized.updatedAt,
      })
    );
  }

  return normalized;
}

export function clearWebDeviceSettings(storage = getBrowserLocalStorage()) {
  storage?.removeItem(WEB_DEVICE_SETTINGS_STORAGE_KEY);
}

function getBrowserLocalStorage(): DeviceSettingsStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}
