import { getDatabase } from '../database';
import type { SubscriptionFeature } from './types';
import { getSubscriptionStatus } from './subscription';

type UpgradeNudgeReason = 'multiple_pdfs' | 'heavy_usage' | 'premium_feature';

export type UpgradeNudge = {
  reason: UpgradeNudgeReason;
  title: string;
  message: string;
};

type AppPreferenceRow = {
  value: string;
};

const PDFS_GENERATED_KEY = 'upgrade_nudge_pdfs_generated';
const LEDGER_ACTIVITY_KEY = 'upgrade_nudge_ledger_activity';
const PREMIUM_FEATURE_ATTEMPTS_KEY = 'upgrade_nudge_premium_feature_attempts';
const LAST_PREMIUM_FEATURE_KEY = 'upgrade_nudge_last_premium_feature';
const LAST_DISMISSED_AT_KEY = 'upgrade_nudge_last_dismissed_at';
const LAST_ACTIONED_AT_KEY = 'upgrade_nudge_last_actioned_at';

const PDF_NUDGE_THRESHOLD = 3;
const LEDGER_ACTIVITY_THRESHOLD = 15;
const PREMIUM_ATTEMPT_THRESHOLD = 1;
const DISMISS_SNOOZE_DAYS = 7;
const ACTION_SNOOZE_DAYS = 14;

export async function recordPdfGeneratedForUpgradeNudge(): Promise<void> {
  await incrementNudgeCounter(PDFS_GENERATED_KEY, '[upgrade-nudge] Could not record PDF generation');
}

export async function recordLedgerActivityForUpgradeNudge(): Promise<void> {
  await incrementNudgeCounter(LEDGER_ACTIVITY_KEY, '[upgrade-nudge] Could not record ledger activity');
}

export async function recordPremiumFeatureAttemptForUpgradeNudge(
  feature: SubscriptionFeature
): Promise<void> {
  try {
    const attempts = await getNumericPreference(PREMIUM_FEATURE_ATTEMPTS_KEY);
    await Promise.all([
      setPreference(PREMIUM_FEATURE_ATTEMPTS_KEY, String(attempts + 1)),
      setPreference(LAST_PREMIUM_FEATURE_KEY, feature),
    ]);
  } catch (error) {
    console.warn('[upgrade-nudge] Could not record premium feature attempt', error);
  }
}

export async function dismissUpgradeNudge(): Promise<void> {
  try {
    await setPreference(LAST_DISMISSED_AT_KEY, new Date().toISOString());
  } catch (error) {
    console.warn('[upgrade-nudge] Could not dismiss upgrade nudge', error);
  }
}

export async function recordUpgradeNudgeActioned(): Promise<void> {
  try {
    await Promise.all([
      setPreference(LAST_ACTIONED_AT_KEY, new Date().toISOString()),
      setPreference(PDFS_GENERATED_KEY, '0'),
      setPreference(LEDGER_ACTIVITY_KEY, '0'),
      setPreference(PREMIUM_FEATURE_ATTEMPTS_KEY, '0'),
    ]);
  } catch (error) {
    console.warn('[upgrade-nudge] Could not record upgrade nudge action', error);
  }
}

export async function getUpgradeNudge(): Promise<UpgradeNudge | null> {
  try {
    const subscriptionStatus = await getSubscriptionStatus();
    if (subscriptionStatus.isPro) {
      return null;
    }

    const [
      lastDismissedAt,
      lastActionedAt,
      pdfsGenerated,
      ledgerActivity,
      premiumAttempts,
      lastPremiumFeature,
    ] = await Promise.all([
      getPreference(LAST_DISMISSED_AT_KEY),
      getPreference(LAST_ACTIONED_AT_KEY),
      getNumericPreference(PDFS_GENERATED_KEY),
      getNumericPreference(LEDGER_ACTIVITY_KEY),
      getNumericPreference(PREMIUM_FEATURE_ATTEMPTS_KEY),
      getPreference(LAST_PREMIUM_FEATURE_KEY),
    ]);

    if (
      isWithinDays(lastDismissedAt, DISMISS_SNOOZE_DAYS) ||
      isWithinDays(lastActionedAt, ACTION_SNOOZE_DAYS)
    ) {
      return null;
    }

    if (premiumAttempts >= PREMIUM_ATTEMPT_THRESHOLD) {
      return {
        reason: 'premium_feature',
        title: premiumFeatureTitle(lastPremiumFeature),
        message: 'Pro adds branded documents and advanced statement styling. Free ledger tools stay available offline.',
      };
    }

    if (pdfsGenerated >= PDF_NUDGE_THRESHOLD) {
      return {
        reason: 'multiple_pdfs',
        title: 'Unlock better statements with Pro',
        message: 'You share statements often. Pro gives documents a cleaner branded layout after activation.',
      };
    }

    if (ledgerActivity >= LEDGER_ACTIVITY_THRESHOLD) {
      return {
        reason: 'heavy_usage',
        title: 'Get more from Orbit Ledger Pro',
        message: 'Your ledger is active. Pro is built for businesses that rely on frequent records and documents.',
      };
    }

    return null;
  } catch (error) {
    console.warn('[upgrade-nudge] Could not load upgrade nudge', error);
    return null;
  }
}

async function incrementNudgeCounter(key: string, warningMessage: string): Promise<void> {
  try {
    const count = await getNumericPreference(key);
    await setPreference(key, String(count + 1));
  } catch (error) {
    console.warn(warningMessage, error);
  }
}

async function getNumericPreference(key: string): Promise<number> {
  const value = await getPreference(key);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

function premiumFeatureTitle(feature: string | null): string {
  if (feature === 'custom_document_branding') {
    return 'Pro adds branded documents';
  }

  if (feature === 'advanced_pdf_styling') {
    return 'Pro adds better statements';
  }

  return 'Pro adds more document polish';
}

function isWithinDays(value: string | null, days: number): boolean {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return false;
  }

  return Date.now() - timestamp.getTime() < days * 24 * 60 * 60 * 1000;
}

function parseTimestamp(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
