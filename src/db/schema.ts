/**
 * src/db/schema.ts
 *
 * Raw SQL CREATE TABLE statements for the duka-deni database.
 * We export these as plain string constants so they can be imported
 * and run inside migrations.ts. Keeping SQL here (not in the migration
 * function) makes the schema easy to read, version, and test independently.
 */

/**
 * The `customers` table.
 *
 * Notes:
 * - `INTEGER PRIMARY KEY` in SQLite is the same as AUTO INCREMENT — SQLite
 *   assigns the next available integer id automatically.
 * - `createdAt` stores an ISO 8601 string (e.g. "2024-01-15T10:30:00.000Z").
 *   SQLite has no native Date type; TEXT is the idiomatic choice.
 * - `NOT NULL` on name ensures every customer has a name — phone is nullable
 *   because it's optional in our TypeScript type.
 */
export const CREATE_CUSTOMERS_TABLE = `
  CREATE TABLE IF NOT EXISTS customers (
    id        INTEGER PRIMARY KEY,
    name      TEXT    NOT NULL,
    phone     TEXT,
    createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

/**
 * The `transactions` table.
 *
 * Notes:
 * - `customerId` is a FOREIGN KEY that references customers(id).
 * - `ON DELETE CASCADE` means: if a customer row is deleted, SQLite will
 *   automatically delete all transaction rows where customerId matches.
 *   This prevents orphaned transactions (records with no owner).
 * - `type` stores "debt" or "payment" as a plain string. The CHECK constraint
 *   enforces that only those two values are allowed at the database level —
 *   a second layer of safety beyond TypeScript.
 * - `amount` is REAL (floating point) to support amounts like 50.50 KES.
 */
export const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    id         INTEGER PRIMARY KEY,
    customerId INTEGER NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('debt', 'payment')),
    amount     REAL    NOT NULL CHECK(amount > 0),
    note       TEXT,
    createdAt  TEXT    NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
  );
`;
