/**
 * src/repositories/transactions.ts
 *
 * CRUD functions for the transactions table.
 * Key concept: balance is calculated with a SQL aggregate query (SUM + CASE)
 * rather than fetching all rows and computing in JavaScript. This keeps the
 * work on the database engine, which is optimised for it.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { Transaction, NewTransaction } from '../types';

/**
 * Inserts a new transaction (either a debt or a payment).
 *
 * @param db             - The open SQLite database instance
 * @param newTransaction - Transaction data (customerId, type, amount, note)
 * @returns              - The auto-generated `id` of the new transaction row
 */
export async function addTransaction(
  db: SQLiteDatabase,
  newTransaction: NewTransaction
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [
      newTransaction.customerId,
      newTransaction.type,
      newTransaction.amount,
      newTransaction.note ?? null,   // undefined → null for SQLite
      new Date().toISOString(),
    ]
  );
  return result.lastInsertRowId;
}

/**
 * Fetches all transactions for a specific customer, newest first.
 *
 * "Newest first" (ORDER BY createdAt DESC) is the natural order for a
 * debt ledger — you want to see what happened recently, not from 2 years ago.
 *
 * @param db         - The open SQLite database instance
 * @param customerId - The id of the customer whose transactions to fetch
 * @returns          - Array of Transaction objects (empty if none yet)
 */
export async function getTransactionsByCustomer(
  db: SQLiteDatabase,
  customerId: number
): Promise<Transaction[]> {
  const rows = await db.getAllAsync<Transaction>(
    `SELECT id, customerId, type, amount, note, createdAt
     FROM transactions
     WHERE customerId = ?
     ORDER BY createdAt DESC`,
    [customerId]
  );
  return rows;
}

/**
 * Calculates the outstanding balance for a customer.
 *
 * Balance formula:
 *   balance = total debt amounts − total payment amounts
 *
 * A positive result means the customer still owes money.
 * A negative result (rare) would mean they've overpaid.
 * Zero means they are settled.
 *
 * The SQL uses a CASE WHEN expression (SQL's if-statement) inside SUM():
 *
 *   SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END)
 *     adds up all amounts where the type is 'debt', treating payments as 0.
 *
 *   SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END)
 *     adds up all payment amounts, treating debts as 0.
 *
 *   Subtracting the two gives the balance in a single database round-trip.
 *
 * COALESCE(x, 0) handles the edge case where a customer has NO transactions —
 * SUM of an empty set returns NULL in SQL, and NULL − NULL = NULL.
 * COALESCE replaces NULL with 0.
 *
 * @param db         - The open SQLite database instance
 * @param customerId - The customer whose balance to compute
 * @returns          - A number: positive = owes money, 0 = settled
 */
export async function getBalanceForCustomer(
  db: SQLiteDatabase,
  customerId: number
): Promise<number> {
  // `getFirstAsync` runs the query and returns only the first row (or null).
  // Our aggregate query always returns exactly one row, so this is correct.
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'debt'    THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0)
     AS balance
     FROM transactions
     WHERE customerId = ?`,
    [customerId]
  );

  // If no row returned at all (shouldn't happen with aggregate), default to 0
  return row?.balance ?? 0;
}
