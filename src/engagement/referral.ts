import { Share } from 'react-native';

import { getDatabase } from '../database';

type AppPreferenceRow = {
  value: string;
};

export type ReferralShareResult = {
  shared: boolean;
  sharedAt: string | null;
  totalShares: number;
};

const REFERRAL_SHARE_COUNT_KEY = 'referral_share_count';
const REFERRAL_LAST_SHARED_AT_KEY = 'referral_last_shared_at';
const PLAY_STORE_PACKAGE_NAME = 'com.bhaumikmehta.orbitledger';

const referralMessage = `I use Orbit Ledger by Bhaumik Mehta to manage customer dues, credits, payments, statements, and backups offline.

Try it here:
https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_NAME}`;

export async function shareOrbitLedgerReferral(): Promise<ReferralShareResult> {
  try {
    const result = await Share.share({
      title: 'Orbit Ledger by Bhaumik Mehta',
      message: referralMessage,
    });

    const wasShared =
      result.action === Share.sharedAction ||
      (result.action !== Share.dismissedAction && result.action !== undefined);

    if (!wasShared) {
      return {
        shared: false,
        sharedAt: null,
        totalShares: await getReferralShareCount(),
      };
    }

    const sharedAt = new Date().toISOString();
    const totalShares = (await getReferralShareCount()) + 1;
    await Promise.all([
      setPreference(REFERRAL_SHARE_COUNT_KEY, String(totalShares)),
      setPreference(REFERRAL_LAST_SHARED_AT_KEY, sharedAt),
    ]);

    return {
      shared: true,
      sharedAt,
      totalShares,
    };
  } catch (error) {
    console.warn('[referral] Orbit Ledger share failed', error);
    throw new Error('Orbit Ledger could not be shared from this device.');
  }
}

export async function getReferralShareCount(): Promise<number> {
  const value = await getPreference(REFERRAL_SHARE_COUNT_KEY);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function getLastReferralSharedAt(): Promise<string | null> {
  return getPreference(REFERRAL_LAST_SHARED_AT_KEY);
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
