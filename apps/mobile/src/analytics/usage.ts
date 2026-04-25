import { getDatabase } from '../database';

export type UsageAnalyticsEventName =
  | 'app_opened'
  | 'transaction_added'
  | 'pdf_generated'
  | 'backup_created';

export type UsageAnalyticsEvent = {
  name: UsageAnalyticsEventName;
  occurredAt: string;
};

export type UsageAnalyticsSummary = {
  appOpens: number;
  transactionsAdded: number;
  pdfsGenerated: number;
  backupsCreated: number;
  firstTrackedAt: string | null;
  lastTrackedAt: string | null;
  recentEvents: UsageAnalyticsEvent[];
};

type AppPreferenceRow = {
  value: string;
};

const USAGE_ANALYTICS_KEY = 'usage_analytics_summary';
const RECENT_EVENT_LIMIT = 25;

const defaultSummary: UsageAnalyticsSummary = {
  appOpens: 0,
  transactionsAdded: 0,
  pdfsGenerated: 0,
  backupsCreated: 0,
  firstTrackedAt: null,
  lastTrackedAt: null,
  recentEvents: [],
};

export async function recordUsageAnalyticsEvent(
  eventName: UsageAnalyticsEventName
): Promise<void> {
  try {
    const summary = await getUsageAnalyticsSummary();
    const occurredAt = new Date().toISOString();
    const nextSummary: UsageAnalyticsSummary = {
      ...summary,
      firstTrackedAt: summary.firstTrackedAt ?? occurredAt,
      lastTrackedAt: occurredAt,
      recentEvents: [
        { name: eventName, occurredAt },
        ...summary.recentEvents,
      ].slice(0, RECENT_EVENT_LIMIT),
    };

    switch (eventName) {
      case 'app_opened':
        nextSummary.appOpens += 1;
        break;
      case 'transaction_added':
        nextSummary.transactionsAdded += 1;
        break;
      case 'pdf_generated':
        nextSummary.pdfsGenerated += 1;
        break;
      case 'backup_created':
        nextSummary.backupsCreated += 1;
        break;
    }

    await setPreference(USAGE_ANALYTICS_KEY, JSON.stringify(nextSummary));
  } catch (error) {
    console.warn('[usage-analytics] Could not record usage event', error);
  }
}

export async function getUsageAnalyticsSummary(): Promise<UsageAnalyticsSummary> {
  try {
    const rawSummary = await getPreference(USAGE_ANALYTICS_KEY);
    if (!rawSummary) {
      return defaultSummary;
    }

    return normalizeUsageAnalyticsSummary(JSON.parse(rawSummary));
  } catch (error) {
    console.warn('[usage-analytics] Could not load usage summary', error);
    return defaultSummary;
  }
}

export async function resetUsageAnalyticsSummary(): Promise<void> {
  try {
    await setPreference(USAGE_ANALYTICS_KEY, JSON.stringify(defaultSummary));
  } catch (error) {
    console.warn('[usage-analytics] Could not reset usage summary', error);
  }
}

function normalizeUsageAnalyticsSummary(value: unknown): UsageAnalyticsSummary {
  if (!value || typeof value !== 'object') {
    return defaultSummary;
  }

  const summary = value as Partial<UsageAnalyticsSummary>;
  return {
    appOpens: safeCount(summary.appOpens),
    transactionsAdded: safeCount(summary.transactionsAdded),
    pdfsGenerated: safeCount(summary.pdfsGenerated),
    backupsCreated: safeCount(summary.backupsCreated),
    firstTrackedAt: safeTimestamp(summary.firstTrackedAt),
    lastTrackedAt: safeTimestamp(summary.lastTrackedAt),
    recentEvents: Array.isArray(summary.recentEvents)
      ? summary.recentEvents.filter(isUsageAnalyticsEvent).slice(0, RECENT_EVENT_LIMIT)
      : [],
  };
}

function isUsageAnalyticsEvent(value: unknown): value is UsageAnalyticsEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<UsageAnalyticsEvent>;
  return (
    isUsageAnalyticsEventName(event.name) &&
    typeof event.occurredAt === 'string' &&
    !Number.isNaN(new Date(event.occurredAt).getTime())
  );
}

function isUsageAnalyticsEventName(value: unknown): value is UsageAnalyticsEventName {
  return (
    value === 'app_opened' ||
    value === 'transaction_added' ||
    value === 'pdf_generated' ||
    value === 'backup_created'
  );
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function safeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return Number.isNaN(new Date(value).getTime()) ? null : value;
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
