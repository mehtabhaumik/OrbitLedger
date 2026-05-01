import { getDatabase } from '../database';

type BackupNudgeReason = 'important_records' | 'many_transactions' | 'recent_statement';

export type BackupTrustNudge = {
  reason: BackupNudgeReason;
  title: string;
  message: string;
};

export type BackupProtectionStatus = {
  state: 'protected' | 'needs_backup' | 'not_protected';
  title: string;
  message: string;
  lastProtectedAt: string | null;
  recordsSinceBackup: number;
  transactionsSinceBackup: number;
  statementGeneratedSinceBackup: boolean;
};

type LedgerChangeKind = 'customer' | 'transaction';

type AppPreferenceRow = {
  value: string;
};

const RECORDS_SINCE_BACKUP_KEY = 'backup_nudge_records_since_backup';
const TRANSACTIONS_SINCE_BACKUP_KEY = 'backup_nudge_transactions_since_backup';
const STATEMENT_GENERATED_SINCE_BACKUP_KEY = 'backup_nudge_statement_generated_since_backup';
const FIRST_STATEMENT_NUDGE_RECORDED_KEY = 'backup_nudge_first_statement_recorded';
const LAST_BACKUP_AT_KEY = 'backup_nudge_last_backup_at';
const LAST_DISMISSED_AT_KEY = 'backup_nudge_last_dismissed_at';

const IMPORTANT_RECORD_THRESHOLD = 3;
const MANY_TRANSACTION_THRESHOLD = 8;
const BACKUP_STALE_DAYS = 14;
const DISMISS_SNOOZE_HOURS = 24;

export async function recordLedgerDataChangedForBackupNudge(
  kind: LedgerChangeKind
): Promise<void> {
  try {
    const [recordsSinceBackup, transactionsSinceBackup] = await Promise.all([
      getNumericPreference(RECORDS_SINCE_BACKUP_KEY),
      getNumericPreference(TRANSACTIONS_SINCE_BACKUP_KEY),
    ]);

    await setPreference(RECORDS_SINCE_BACKUP_KEY, String(recordsSinceBackup + 1));

    if (kind === 'transaction') {
      await setPreference(
        TRANSACTIONS_SINCE_BACKUP_KEY,
        String(transactionsSinceBackup + 1)
      );
    }
  } catch (error) {
    console.warn('[backup-nudge] Could not record ledger change', error);
  }
}

export async function recordStatementGeneratedForBackupNudge(): Promise<void> {
  try {
    const alreadyRecorded = await getPreference(FIRST_STATEMENT_NUDGE_RECORDED_KEY);
    if (alreadyRecorded === 'true') {
      return;
    }

    await Promise.all([
      setPreference(FIRST_STATEMENT_NUDGE_RECORDED_KEY, 'true'),
      setPreference(STATEMENT_GENERATED_SINCE_BACKUP_KEY, 'true'),
    ]);
  } catch (error) {
    console.warn('[backup-nudge] Could not record statement generation', error);
  }
}

export async function recordLedgerBackupCompletedForNudge(): Promise<void> {
  try {
    await Promise.all([
      setPreference(LAST_BACKUP_AT_KEY, new Date().toISOString()),
      setPreference(RECORDS_SINCE_BACKUP_KEY, '0'),
      setPreference(TRANSACTIONS_SINCE_BACKUP_KEY, '0'),
      setPreference(STATEMENT_GENERATED_SINCE_BACKUP_KEY, 'false'),
    ]);
  } catch (error) {
    console.warn('[backup-nudge] Could not record backup completion', error);
  }
}

export async function dismissBackupTrustNudge(): Promise<void> {
  try {
    await setPreference(LAST_DISMISSED_AT_KEY, new Date().toISOString());
  } catch (error) {
    console.warn('[backup-nudge] Could not dismiss backup nudge', error);
  }
}

export async function getBackupTrustNudge(): Promise<BackupTrustNudge | null> {
  try {
    const [
      lastDismissedAt,
      lastBackupAt,
      recordsSinceBackup,
      transactionsSinceBackup,
      statementGenerated,
    ] = await Promise.all([
      getPreference(LAST_DISMISSED_AT_KEY),
      getPreference(LAST_BACKUP_AT_KEY),
      getNumericPreference(RECORDS_SINCE_BACKUP_KEY),
      getNumericPreference(TRANSACTIONS_SINCE_BACKUP_KEY),
      getPreference(STATEMENT_GENERATED_SINCE_BACKUP_KEY),
    ]);

    if (isWithinHours(lastDismissedAt, DISMISS_SNOOZE_HOURS)) {
      return null;
    }

    if (statementGenerated === 'true') {
      return {
        reason: 'recent_statement',
        title: 'Protect your statement records',
        message: 'You generated a statement. Consider exporting a backup of your ledger.',
      };
    }

    if (transactionsSinceBackup >= MANY_TRANSACTION_THRESHOLD) {
      return {
        reason: 'many_transactions',
        title: 'Backup recommended',
        message: 'You have added several ledger entries. Consider exporting a backup.',
      };
    }

    if (recordsSinceBackup >= IMPORTANT_RECORD_THRESHOLD) {
      return {
        reason: 'important_records',
        title: 'Keep a safe copy',
        message: 'You have added important records. Consider exporting a backup.',
      };
    }

    if (
      lastBackupAt &&
      recordsSinceBackup > 0 &&
      isOlderThanDays(lastBackupAt, BACKUP_STALE_DAYS)
    ) {
      return {
        reason: 'important_records',
        title: 'Backup reminder',
        message: 'It looks like you have not backed up your ledger recently.',
      };
    }

    return null;
  } catch (error) {
    console.warn('[backup-nudge] Could not load backup nudge', error);
    return null;
  }
}

export async function getBackupProtectionStatus(): Promise<BackupProtectionStatus> {
  try {
    const [lastBackupAt, recordsSinceBackup, transactionsSinceBackup, statementGenerated] =
      await Promise.all([
        getPreference(LAST_BACKUP_AT_KEY),
        getNumericPreference(RECORDS_SINCE_BACKUP_KEY),
        getNumericPreference(TRANSACTIONS_SINCE_BACKUP_KEY),
        getPreference(STATEMENT_GENERATED_SINCE_BACKUP_KEY),
      ]);

    const hasChanges = recordsSinceBackup > 0 || transactionsSinceBackup > 0 || statementGenerated === 'true';
    if (!lastBackupAt) {
      return {
        state: 'not_protected',
        title: 'Backup not created yet',
        message: 'Create your first backup so your business has a private copy saved outside the app.',
        lastProtectedAt: null,
        recordsSinceBackup,
        transactionsSinceBackup,
        statementGeneratedSinceBackup: statementGenerated === 'true',
      };
    }

    if (hasChanges || isOlderThanDays(lastBackupAt, BACKUP_STALE_DAYS)) {
      return {
        state: 'needs_backup',
        title: 'New work needs a backup',
        message: 'You have added or changed records since the last backup. Save a fresh copy when you can.',
        lastProtectedAt: lastBackupAt,
        recordsSinceBackup,
        transactionsSinceBackup,
        statementGeneratedSinceBackup: statementGenerated === 'true',
      };
    }

    return {
      state: 'protected',
      title: 'Your business has a backup',
      message: 'No new ledger changes are waiting for a backup.',
      lastProtectedAt: lastBackupAt,
      recordsSinceBackup,
      transactionsSinceBackup,
      statementGeneratedSinceBackup: false,
    };
  } catch (error) {
    console.warn('[backup-nudge] Could not load backup protection status', error);
    return {
      state: 'needs_backup',
      title: 'Backup status needs a check',
      message: 'Create a fresh backup if you are not sure when the last copy was saved.',
      lastProtectedAt: null,
      recordsSinceBackup: 0,
      transactionsSinceBackup: 0,
      statementGeneratedSinceBackup: false,
    };
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

function isWithinHours(value: string | null, hours: number): boolean {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return false;
  }

  return Date.now() - timestamp.getTime() < hours * 60 * 60 * 1000;
}

function isOlderThanDays(value: string | null, days: number): boolean {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return true;
  }

  return Date.now() - timestamp.getTime() > days * 24 * 60 * 60 * 1000;
}

function parseTimestamp(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
