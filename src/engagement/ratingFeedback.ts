import { Linking, Share } from 'react-native';

import { getDatabase } from '../database';

export type RatingPositiveMoment = 'backup_success' | 'transaction_saved' | 'pdf_generated';

export type RatingPrompt = {
  reason: 'backup_success' | 'repeated_usage';
  title: string;
  message: string;
};

type AppPreferenceRow = {
  value: string;
};

const POSITIVE_USAGE_COUNT_KEY = 'rating_positive_usage_count';
const BACKUP_SUCCESS_COUNT_KEY = 'rating_backup_success_count';
const LAST_PROMPTED_AT_KEY = 'rating_last_prompted_at';
const LAST_DISMISSED_AT_KEY = 'rating_last_dismissed_at';
const LAST_ACTIONED_AT_KEY = 'rating_last_actioned_at';
const RATING_COMPLETED_KEY = 'rating_completed';

const REPEATED_USAGE_THRESHOLD = 8;
const PROMPT_SNOOZE_DAYS = 21;
const DISMISS_SNOOZE_DAYS = 30;
const ACTION_SNOOZE_DAYS = 60;
const PLAY_STORE_PACKAGE_NAME = 'com.bhaumikmehta.orbitledger';
const FEEDBACK_EMAIL = 'support@bhaumikmehta.com';

export async function recordRatingPositiveMoment(
  moment: RatingPositiveMoment
): Promise<void> {
  try {
    const [positiveUsageCount, backupSuccessCount] = await Promise.all([
      getNumericPreference(POSITIVE_USAGE_COUNT_KEY),
      getNumericPreference(BACKUP_SUCCESS_COUNT_KEY),
    ]);

    const writes = [setPreference(POSITIVE_USAGE_COUNT_KEY, String(positiveUsageCount + 1))];

    if (moment === 'backup_success') {
      writes.push(setPreference(BACKUP_SUCCESS_COUNT_KEY, String(backupSuccessCount + 1)));
    }

    await Promise.all(writes);
  } catch (error) {
    console.warn('[rating-feedback] Could not record positive usage moment', error);
  }
}

export async function getRatingPrompt(): Promise<RatingPrompt | null> {
  try {
    const [ratingCompleted, lastPromptedAt, lastDismissedAt, lastActionedAt] =
      await Promise.all([
        getPreference(RATING_COMPLETED_KEY),
        getPreference(LAST_PROMPTED_AT_KEY),
        getPreference(LAST_DISMISSED_AT_KEY),
        getPreference(LAST_ACTIONED_AT_KEY),
      ]);

    if (
      ratingCompleted === 'true' ||
      isWithinDays(lastPromptedAt, PROMPT_SNOOZE_DAYS) ||
      isWithinDays(lastDismissedAt, DISMISS_SNOOZE_DAYS) ||
      isWithinDays(lastActionedAt, ACTION_SNOOZE_DAYS)
    ) {
      return null;
    }

    const [positiveUsageCount, backupSuccessCount] = await Promise.all([
      getNumericPreference(POSITIVE_USAGE_COUNT_KEY),
      getNumericPreference(BACKUP_SUCCESS_COUNT_KEY),
    ]);

    if (backupSuccessCount >= 1) {
      return {
        reason: 'backup_success',
        title: 'Enjoying Orbit Ledger?',
        message: 'If Orbit Ledger is helping you manage business records, a Play Store rating would help us improve and reach more users.',
      };
    }

    if (positiveUsageCount >= REPEATED_USAGE_THRESHOLD) {
      return {
        reason: 'repeated_usage',
        title: 'Orbit Ledger seems useful for your work',
        message: 'A quick rating or feedback note helps shape the next improvements.',
      };
    }

    return null;
  } catch (error) {
    console.warn('[rating-feedback] Could not load rating prompt', error);
    return null;
  }
}

export async function markRatingPromptShown(): Promise<void> {
  await setPreferenceSafely(LAST_PROMPTED_AT_KEY, new Date().toISOString(), 'prompt shown');
}

export async function dismissRatingPrompt(): Promise<void> {
  await setPreferenceSafely(LAST_DISMISSED_AT_KEY, new Date().toISOString(), 'prompt dismissed');
}

export async function markRatingPromptActioned(): Promise<void> {
  await setPreferenceSafely(LAST_ACTIONED_AT_KEY, new Date().toISOString(), 'prompt actioned');
}

export async function markRatingCompleted(): Promise<void> {
  try {
    await Promise.all([
      setPreference(RATING_COMPLETED_KEY, 'true'),
      setPreference(LAST_ACTIONED_AT_KEY, new Date().toISOString()),
    ]);
  } catch (error) {
    console.warn('[rating-feedback] Could not mark rating completed', error);
  }
}

export async function openPlayStoreRating(): Promise<void> {
  const marketUrl = `market://details?id=${PLAY_STORE_PACKAGE_NAME}`;
  const webUrl = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_NAME}`;

  try {
    const canOpenMarket = await Linking.canOpenURL(marketUrl);
    if (canOpenMarket) {
      await Linking.openURL(marketUrl);
      return;
    }

    await Linking.openURL(webUrl);
  } catch (error) {
    console.warn('[rating-feedback] Could not open Play Store rating link', error);
    throw new Error('Play Store could not be opened on this device.');
  }
}

export async function submitUserFeedback(message: string): Promise<void> {
  const cleanedMessage = message.trim();
  if (!cleanedMessage) {
    throw new Error('Feedback message is empty.');
  }

  const subject = encodeURIComponent('Orbit Ledger feedback');
  const body = encodeURIComponent(cleanedMessage);
  const mailUrl = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;

  try {
    const canOpenMail = await Linking.canOpenURL(mailUrl);
    if (canOpenMail) {
      await Linking.openURL(mailUrl);
      return;
    }

    await Share.share({
      title: 'Orbit Ledger feedback',
      message: cleanedMessage,
    });
  } catch (error) {
    console.warn('[rating-feedback] Could not submit feedback', error);
    throw new Error('Feedback could not be sent from this device.');
  }
}

async function setPreferenceSafely(key: string, value: string, action: string): Promise<void> {
  try {
    await setPreference(key, value);
  } catch (error) {
    console.warn(`[rating-feedback] Could not record ${action}`, error);
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
