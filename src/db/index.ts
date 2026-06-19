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

import { openDatabaseSync } from 'expo-sqlite';

/**
 * The single, shared database connection for the entire app.
 * All repository functions receive this `db` object as their first argument.
 *
 * "dukadb" is the filename (without extension) of the SQLite file on disk.
 * Changing this name would create a new, empty database — don't rename in
 * production unless you add a data migration!
 */
export const db = openDatabaseSync('dukadb');

// Re-export runMigrations so callers can do:
//   import { db, runMigrations } from '../db'
// instead of importing from two separate files.
export { runMigrations } from './migrations';
