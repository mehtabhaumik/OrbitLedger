import { getDatabase } from '../database';

export type RetentionNudgeId = 'record_today_transactions' | 'pending_dues';

type AppPreferenceRow = {
  value: string;
};

const RETENTION_NUDGE_PREFIX = 'retention_nudge_dismissed_at';

export async function dismissRetentionNudge(id: RetentionNudgeId): Promise<void> {
  try {
    await setPreference(retentionNudgeKey(id), new Date().toISOString());
  } catch (error) {
    console.warn('[retention] Could not dismiss retention nudge', error);
  }
}

export async function getDismissedRetentionNudgeIds(): Promise<RetentionNudgeId[]> {
  try {
    const entries = await Promise.all([
      getDismissedRetentionNudgeId('record_today_transactions'),
      getDismissedRetentionNudgeId('pending_dues'),
    ]);

    return entries.filter((entry): entry is RetentionNudgeId => entry !== null);
  } catch (error) {
    console.warn('[retention] Could not load dismissed retention nudges', error);
    return [];
  }
}

async function getDismissedRetentionNudgeId(
  id: RetentionNudgeId
): Promise<RetentionNudgeId | null> {
  const dismissedAt = await getPreference(retentionNudgeKey(id));
  return isToday(dismissedAt) ? id : null;
}

function retentionNudgeKey(id: RetentionNudgeId): string {
  return `${RETENTION_NUDGE_PREFIX}_${id}`;
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

function isToday(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  );
}
