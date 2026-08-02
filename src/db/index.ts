/**
 * src/db/index.ts
 *
 * Opens the SQLite database and exports it as a SINGLETON.
 *
 * Singleton pattern: This module is evaluated exactly once by JavaScript's
 * module system. Every file that does `import { db } from '../db'` gets the
 * same database instance — not a new one. This is the correct way to share
 * a database connection across an entire app.
 *
 * Database file location on device:
 * - Android: /data/data/<package>/databases/dukadb.db
 * - iOS:     <app-sandbox>/Documents/SQLite/dukadb.db
 * Expo manages these paths automatically — we just provide the name.
 */

import { Platform } from 'react-native';
import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';

function getDbInstance(): SQLiteDatabase {
  try {
    return openDatabaseSync('dukadb');
  } catch (err) {
    console.warn('[db] SQLite openDatabaseSync failed (web preview mode enabled):', err);
    return {
      execAsync: async () => {},
      withTransactionAsync: async (task: (db: any) => Promise<any>) => await task({
        execAsync: async () => {},
        getAllAsync: async () => [],
        getFirstAsync: async () => null,
        runAsync: async () => ({ lastInsertRowId: 1, changes: 1 }),
      }),
      getAllAsync: async () => [],
      getFirstAsync: async () => null,
      runAsync: async () => ({ lastInsertRowId: 1, changes: 1 }),
      closeAsync: async () => {},
      deleteAsync: async () => {},
    } as unknown as SQLiteDatabase;
  }
}

/**
 * The single, shared database connection for the entire app.
 * Safe for both Native (Android/iOS) and Web browser preview.
 */
export const db = getDbInstance();

// Re-export runMigrations so callers can do:
//   import { db, runMigrations } from '../db'
// instead of importing from two separate files.
export { runMigrations } from './migrations';
