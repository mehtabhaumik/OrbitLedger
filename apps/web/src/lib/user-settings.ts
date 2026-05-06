import { doc, getDoc, serverTimestamp, setDoc, type FieldValue, type Timestamp } from 'firebase/firestore';
import {
  DEFAULT_ORBIT_LEDGER_USER_SETTINGS,
  normalizeOrbitLedgerUserSettings,
  serializeOrbitLedgerUserSettings,
  type OrbitLedgerCustomerFilterPreference,
  type OrbitLedgerDashboardView,
  type OrbitLedgerDateRangePreference,
  type OrbitLedgerExportFormatPreference,
  type OrbitLedgerInvoiceFilterPreference,
  type OrbitLedgerTableDensity,
  type OrbitLedgerUserSettings,
} from '@orbit-ledger/core';

import { getWebFirestore } from './firebase';

export type WebDashboardView = OrbitLedgerDashboardView;
export type WebTableDensity = OrbitLedgerTableDensity;
export type WebDateRangePreference = OrbitLedgerDateRangePreference;
export type WebCustomerFilterPreference = OrbitLedgerCustomerFilterPreference;
export type WebInvoiceFilterPreference = OrbitLedgerInvoiceFilterPreference;
export type WebExportFormatPreference = OrbitLedgerExportFormatPreference;
export type WebUserSettings = OrbitLedgerUserSettings;

type FirestoreUserSettings = {
  dashboard_view?: string | null;
  table_density?: string | null;
  rows_per_page?: number | null;
  default_date_range?: string | null;
  default_customer_filter?: string | null;
  default_invoice_filter?: string | null;
  balance_privacy_mode?: boolean | null;
  larger_text?: boolean | null;
  reduced_motion?: boolean | null;
  default_export_format?: string | null;
  updated_at?: Timestamp | string | FieldValue | null;
};

export const DEFAULT_WEB_USER_SETTINGS: WebUserSettings = DEFAULT_ORBIT_LEDGER_USER_SETTINGS;

export async function loadWebUserSettings(userId: string, workspaceId: string): Promise<WebUserSettings> {
  const snapshot = await getDoc(getUserSettingsRef(userId, workspaceId));
  if (!snapshot.exists()) {
    return DEFAULT_WEB_USER_SETTINGS;
  }

  return normalizeWebUserSettings(snapshot.data() as FirestoreUserSettings);
}

export async function saveWebUserSettings(
  userId: string,
  workspaceId: string,
  settings: WebUserSettings
): Promise<WebUserSettings> {
  const normalized = normalizeWebUserSettings(settings);
  const payload = serializeOrbitLedgerUserSettings(normalized);
  await setDoc(
    getUserSettingsRef(userId, workspaceId),
    {
      owner_uid: userId,
      workspace_id: workspaceId,
      ...payload,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeWebUserSettings(input: Partial<WebUserSettings | FirestoreUserSettings>): WebUserSettings {
  const raw = input as Partial<WebUserSettings & FirestoreUserSettings>;
  return normalizeOrbitLedgerUserSettings({
    ...raw,
    updatedAt: toIsoString(raw.updatedAt ?? raw.updated_at),
    updated_at: toIsoString(raw.updatedAt ?? raw.updated_at),
  });
}

function getUserSettingsRef(userId: string, workspaceId: string) {
  return doc(getWebFirestore(), 'workspaces', workspaceId, 'user_settings', userId);
}

function toIsoString(value: Timestamp | string | FieldValue | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}
