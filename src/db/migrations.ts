/**
 * src/db/migrations.ts
 *
 * The runMigrations function sets up (or upgrades) the database schema.
 * It is called once on app startup, before any other database operations.
 *
 * Key design decisions:
 * 1. Uses "CREATE TABLE IF NOT EXISTS" → safe to run on every app launch
 * 2. Runs all statements inside a single transaction → atomic (all or nothing)
 * 3. Enables foreign keys explicitly → SQLite has them OFF by default (!)
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_CUSTOMERS_TABLE, CREATE_TRANSACTIONS_TABLE } from './schema';

/**
 * Runs all database setup statements.
 *
 * @param db - The open SQLite database instance (passed in from index.ts)
 *
 * IMPORTANT: Foreign key support in SQLite is DISABLED by default.
 * We must run `PRAGMA foreign_keys = ON` every time we open the database —
 * this setting does NOT persist between connections.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  try {
    // Step 1: Enable foreign key enforcement.
    // Without this, ON DELETE CASCADE silently does nothing.
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Step 2: Run all CREATE TABLE statements inside a single transaction.
    // `withTransactionAsync` automatically commits on success and rolls back
    // on any error — no manual BEGIN/COMMIT/ROLLBACK needed.
    await db.withTransactionAsync(async () => {
      await db.execAsync(CREATE_CUSTOMERS_TABLE);
      await db.execAsync(CREATE_TRANSACTIONS_TABLE);

      // Check if `isDeleted` column exists, add it if not
      const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(customers);');
      const hasDeletedColumn = tableInfo.some((col) => col.name === 'isDeleted');
      if (!hasDeletedColumn) {
        console.log('[migrations] Adding isDeleted column to customers table');
        await db.execAsync('ALTER TABLE customers ADD COLUMN isDeleted INTEGER NOT NULL DEFAULT 0;');
      }
    });

    console.log('✅ Database ready');
  } catch (error) {
    // Re-throw so the caller (App.tsx) can catch it and show an error to
    // the user instead of silently failing.
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
