import {
  DEFAULT_ORBIT_LEDGER_USER_SETTINGS,
  normalizeOrbitLedgerUserSettings,
  serializeOrbitLedgerUserSettings,
  type OrbitLedgerUserSettings,
} from '@orbit-ledger/core';

import { getDatabase } from '../database';

type AppPreferenceRow = {
  value: string;
};

const USER_SETTINGS_KEY_PREFIX = 'user_settings';

export type MobileUserSettings = OrbitLedgerUserSettings;

export const DEFAULT_MOBILE_USER_SETTINGS: MobileUserSettings =
  DEFAULT_ORBIT_LEDGER_USER_SETTINGS;

export async function loadMobileUserSettings(
  workspaceId: string | null | undefined
): Promise<MobileUserSettings> {
  const raw = await getPreference(buildUserSettingsKey(workspaceId));
  if (!raw) {
    return DEFAULT_MOBILE_USER_SETTINGS;
  }

  try {
    return normalizeOrbitLedgerUserSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_MOBILE_USER_SETTINGS;
  }
}

export async function saveMobileUserSettings(
  workspaceId: string | null | undefined,
  input: MobileUserSettings
): Promise<MobileUserSettings> {
  const normalized = {
    ...normalizeOrbitLedgerUserSettings(input),
    updatedAt: new Date().toISOString(),
  };
  await setPreference(
    buildUserSettingsKey(workspaceId),
    JSON.stringify({
      ...serializeOrbitLedgerUserSettings(normalized),
      updated_at: normalized.updatedAt,
    })
  );
  return normalized;
}

function buildUserSettingsKey(workspaceId: string | null | undefined) {
  return `${USER_SETTINGS_KEY_PREFIX}:${workspaceId?.trim() || 'local'}`;
}

async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppPreferenceRow>(
    'SELECT value FROM app_preferences WHERE key = ? LIMIT 1',
    key
  );
  return row?.value ?? null;
}

async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString()
  );
}
