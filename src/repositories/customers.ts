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
     WHERE isDeleted = 0
     ORDER BY name ASC`
  );
  return rows;
}

/**
 * Updates an existing customer's details (name and phone number).
 *
 * @param db      - The open SQLite database instance
 * @param id      - The id of the customer to update
 * @param updates - Object containing the new name and phone number
 */
export async function updateCustomer(
  db: SQLiteDatabase,
  id: number,
  updates: { name: string; phone?: string | null }
): Promise<void> {
  await db.runAsync(
    `UPDATE customers
     SET name = ?, phone = ?
     WHERE id = ?`,
    [updates.name, updates.phone ?? null, id]
  );
}

/**
 * Soft-deletes a customer by setting isDeleted = 1.
 * Their transactions remain in the database for consistency, but the customer
 * is hidden from the UI.
 *
 * @param db - The open SQLite database instance
 * @param id - The id of the customer to soft-delete
 */
export async function deleteCustomer(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(
    `UPDATE customers
     SET isDeleted = 1
     WHERE id = ?`,
    [id]
  );
}
