import { getDatabase } from '../database';
import type {
  DailyClosingRitualSummary,
} from './types';
export { buildDailyClosingRitualSummary } from './ritualModel';

const DAILY_CLOSING_HISTORY_KEY = 'daily_closing_history_v1';

type PreferenceRow = {
  value: string;
};

export async function saveDailyClosingRitualSummary(
  summary: DailyClosingRitualSummary
): Promise<DailyClosingRitualSummary[]> {
  const history = await listDailyClosingRitualSummaries();
  const nextHistory = [
    summary,
    ...history.filter((item) => item.reportDate !== summary.reportDate),
  ].slice(0, 30);
  await setPreference(DAILY_CLOSING_HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export async function listDailyClosingRitualSummaries(): Promise<DailyClosingRitualSummary[]> {
  const raw = await getPreference(DAILY_CLOSING_HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isDailyClosingRitualSummary);
  } catch {
    return [];
  }
}

export async function getDailyClosingRitualSummary(
  reportDate: string
): Promise<DailyClosingRitualSummary | null> {
  const history = await listDailyClosingRitualSummaries();
  return history.find((summary) => summary.reportDate === reportDate) ?? null;
}

function isDailyClosingRitualSummary(value: unknown): value is DailyClosingRitualSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const summary = value as Partial<DailyClosingRitualSummary>;
  return (
    typeof summary.id === 'string' &&
    typeof summary.reportDate === 'string' &&
    typeof summary.closedAt === 'string' &&
    Array.isArray(summary.confirmations) &&
    typeof summary.mismatch === 'object' &&
    Array.isArray(summary.nextDayActions)
  );
}

async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PreferenceRow>(
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
