import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { measurePerformance } from '../performance';
import { throwDatabaseError } from './errors';
import { APP_SECURITY_ID, DATABASE_NAME, initializeSchema } from './schema';

let databasePromise: Promise<SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndInitializeDatabase();
  }

  return databasePromise;
}

async function openAndInitializeDatabase(): Promise<SQLiteDatabase> {
  return measurePerformance('sqlite_initialization', 'SQLite initialization', async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await initializeSchema(db);
      await ensureAppSecurityDefaults(db);
      return db;
    } catch (error) {
      databasePromise = null;
      return throwDatabaseError('openAndInitializeDatabase', error);
    }
  });
}

async function ensureAppSecurityDefaults(db: SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR IGNORE INTO app_security (id, pin_enabled, pin_hash, updated_at)
     VALUES (?, 0, NULL, ?)`,
    APP_SECURITY_ID,
    now
  );
}
