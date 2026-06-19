/**
 * src/repositories/customers.ts
 *
 * CRUD (Create, Read, Update, Delete) functions for the customers table.
 * These are the only functions that should ever touch the customers table
 * directly. Screens import from here — never write raw SQL in a component.
 *
 * All functions:
 * - Accept the `db` instance as the first argument (makes them testable)
 * - Are async (database I/O is always asynchronous on mobile)
 * - Are fully typed (parameters and return values use our shared interfaces)
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { Customer, NewCustomer } from '../types';

/**
 * Inserts a new customer into the database.
 *
 * @param db          - The open SQLite database instance
 * @param newCustomer - Customer data provided by the user (no id/createdAt)
 * @returns           - The auto-generated `id` of the newly created row
 *
 * How `runAsync` works: it runs a parameterized SQL statement and returns
 * a result object. The `?` placeholders are replaced by the values array —
 * this prevents SQL injection (never use string concatenation for user data!).
 */
export async function addCustomer(
  db: SQLiteDatabase,
  newCustomer: NewCustomer
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt)
     VALUES (?, ?, ?)`,
    [
      newCustomer.name,
      newCustomer.phone ?? null,          // Convert undefined → null for SQLite
      new Date().toISOString(),           // Always store in ISO format
    ]
  );

  // `lastInsertRowId` is the id that SQLite assigned to the new row.
  // We return it so the caller can immediately use the new customer's id
  // (e.g. to add a first transaction for them).
  return result.lastInsertRowId;
}

/**
 * Fetches all customers, sorted A→Z by name.
 *
 * `getAllAsync` executes a SELECT and returns all matching rows as an array.
 * We tell TypeScript these rows match the `Customer` interface by casting —
 * the column names in the SQL must match the interface property names exactly.
 *
 * @returns - An array of Customer objects (empty array if no customers yet)
 */
export async function getAllCustomers(db: SQLiteDatabase): Promise<Customer[]> {
  const rows = await db.getAllAsync<Customer>(
    `SELECT id, name, phone, createdAt
     FROM customers
     ORDER BY name ASC`
  );
  return rows;
}

/**
 * Deletes a customer and — via ON DELETE CASCADE — all their transactions.
 *
 * This is why the FOREIGN KEY ... ON DELETE CASCADE in our schema matters:
 * we only delete one row here, but SQLite silently cleans up all associated
 * transaction rows automatically. No second DELETE statement needed.
 *
 * @param db - The open SQLite database instance
 * @param id - The id of the customer to delete
 */
export async function deleteCustomer(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(
    `DELETE FROM customers WHERE id = ?`,
    [id]
  );
}
