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
import { fillMissingDays } from '../utils/dates';

/**
 * Inserts a new transaction (either a debt or a payment).
 *
 * IMPORTANT: `amount` in NewTransaction MUST be in INTEGER CENTS.
 *   150 KES → pass 15000, not 150.
 * Use toCents() from src/utils/money.ts before calling this.
 *
 * @param db             - The open SQLite database instance
 * @param newTransaction - Transaction data (customerId, type, amount in CENTS, note)
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
 * @returns          - Balance in INTEGER CENTS. Positive = customer owes shop.
 *                     Zero = settled. Negative = customer has overpaid.
 *                     Use formatKES() to display this value.
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

// ─── Dashboard Aggregate Functions ────────────────────────────────────────────
//
// These functions answer the three Dashboard questions in SQL, not JavaScript.
//
// WHY SQL AGGREGATES INSTEAD OF JS LOOPS?
// JavaScript is single-threaded. If you load all transactions and loop through
// them to compute totals, you block the JS thread proportionally to the number
// of rows. SQLite's query engine is written in C and runs aggregates in a
// tight native loop — orders of magnitude faster for large datasets.
// Always push "calculate" work into the database. Push "format" work into JS.

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the total outstanding balance across ALL customers, in cents.
 *
 * ─── CONCEPT: CASE WHEN vs WHERE ─────────────────────────────────────────────
 * Two ways to separate debts from payments in SQL:
 *
 *   Option A — Two queries with WHERE:
 *     SELECT SUM(amount) FROM transactions WHERE type = 'debt'
 *     SELECT SUM(amount) FROM transactions WHERE type = 'payment'
 *   Then subtract in JS. This is two database round-trips.
 *
 *   Option B — One query with CASE WHEN:
 *     SELECT
 *       SUM(CASE WHEN type = 'debt'    THEN amount ELSE 0 END) as debts,
 *       SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as payments
 *     FROM transactions
 *
 * CASE WHEN is SQL's inline if-statement. It evaluates row-by-row inside SUM:
 *   - If type = 'debt' → contribute amount to the debt sum
 *   - Otherwise (type = 'payment') → contribute 0
 * This lets us do both sums in a single scan of the table — one round-trip.
 *
 * Use CASE WHEN when you need to pivot or categorise values within a single
 * aggregate. Use WHERE when you want to completely exclude rows from the result.
 *
 * @returns - Total outstanding in INTEGER CENTS (0 if no transactions)
 */
export async function getTotalOutstanding(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ outstanding: number | null }>(
    `SELECT
       SUM(CASE WHEN type = 'debt'    THEN amount ELSE 0 END)
     - SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END)
     AS outstanding
     FROM transactions`
  );
  // SUM of zero rows = NULL in SQL. Nullish coalescing ?? ensures we return 0.
  return row?.outstanding ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the top N customers ranked by outstanding balance, highest first.
 * Only customers with a positive balance (i.e. they owe money) are included.
 *
 * ─── CONCEPT: LEFT JOIN vs INNER JOIN ────────────────────────────────────────
 * INNER JOIN (also written just JOIN): only returns rows that have a match
 * in BOTH tables. A customer with NO transactions would be excluded entirely.
 *
 * LEFT JOIN: returns ALL rows from the LEFT table (customers) plus any matching
 * rows from the RIGHT table (transactions). If a customer has no transactions,
 * they still appear — with NULL values for all transaction columns.
 *
 * We use LEFT JOIN here because we want ALL customers to participate in the
 * GROUP BY, including new customers with zero transactions. Their SUM() will
 * be 0, and HAVING balance > 0 will then correctly exclude them.
 * If we used INNER JOIN, a customer with no transactions would disappear from
 * the result before HAVING could evaluate them — same outcome but for the wrong
 * structural reason. Always match your JOIN type to your intent.
 *
 * ─── CONCEPT: GROUP BY and HAVING ────────────────────────────────────────────
 * After a JOIN, each customer appears once per transaction (fan-out):
 *   Kamau | debt   | 5000
 *   Kamau | payment| 2000
 *   Kamau | debt   | 3000
 *
 * GROUP BY c.id collapses all Kamau rows into one, letting SUM() add up amounts:
 *   Kamau | balance = 5000 + 3000 - 2000 = 6000
 *
 * WHERE vs HAVING:
 *   WHERE filters INDIVIDUAL ROWS before grouping.
 *   HAVING filters GROUPS after aggregation.
 *
 * We can't write WHERE balance > 0 because `balance` doesn't exist yet —
 * it's computed by the SUM. We must filter after the GROUP BY completes:
 *   HAVING balance > 0
 *
 * Rule of thumb: if your filter references an aggregate (SUM, COUNT, AVG),
 * use HAVING. If it references raw column values, use WHERE.
 *
 * ─── THE N+1 QUERY PROBLEM ───────────────────────────────────────────────────
 * CustomerListScreen (before Day 4 fix) does this:
 *   1. SELECT * FROM customers            → 1 query
 *   2. For each customer: SELECT balance  → N queries
 *   Total: N+1 queries for N customers.
 *
 * With 20 customers = 21 queries. With 200 = 201 queries. Linear scaling.
 *
 * This single query replaces all N balance queries with one JOIN + GROUP BY.
 * Total: 1 query regardless of how many customers you have. Constant scaling.
 *
 * The N+1 problem is one of the most common performance bugs in apps that
 * combine an ORM or repository layer with a list view. The symptom is that
 * the screen gets slower as you add more data — a red flag in any app.
 *
 * @param db    - The open SQLite database instance
 * @param limit - How many top debtors to return (default: 5 for Dashboard)
 */
export async function getTopDebtors(
  db: SQLiteDatabase,
  limit: number
): Promise<import('../types').TopDebtor[]> {
  const rows = await db.getAllAsync<import('../types').TopDebtor>(
    `SELECT
       c.id   AS customerId,
       c.name AS name,
       SUM(CASE WHEN t.type = 'debt'    THEN t.amount ELSE 0 END)
     - SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END)
       AS balance
     FROM customers c
     LEFT JOIN transactions t ON t.customerId = c.id
     GROUP BY c.id, c.name
     HAVING balance > 0
     ORDER BY balance DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the last N transactions across ALL customers, with customer names.
 *
 * This is the "Recent Activity" feed. It crosses customer boundaries —
 * unlike getTransactionsByCustomer which scopes to one customer.
 *
 * The JOIN here is INNER (just "JOIN") because every transaction MUST have
 * a customer (foreign key). A transaction without a customer is a data error.
 * We use t.* to get all transaction columns, and c.name aliased as customerName.
 *
 * @param db    - The open SQLite database instance
 * @param limit - How many recent items to return (10 for Dashboard feed)
 */
export async function getRecentActivity(
  db: SQLiteDatabase,
  limit: number
): Promise<import('../types').ActivityItem[]> {
  const rows = await db.getAllAsync<{
    transactionId: number;  // matches SQL alias "t.id AS transactionId"
    customerId: number;
    customerName: string;
    type: 'debt' | 'payment';
    amount: number;
    note: string | null;
    createdAt: string;
  }>(
    `SELECT
       t.id          AS transactionId,
       t.customerId,
       c.name        AS customerName,
       t.type,
       t.amount,
       t.note,
       t.createdAt
     FROM transactions t
     JOIN customers c ON c.id = t.customerId
     ORDER BY t.createdAt DESC
     LIMIT ?`,
    [limit]
  );
  // The SQL column aliases already match ActivityItem field names — direct return
  return rows as import('../types').ActivityItem[];
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the total number of customers in the shop.
 *
 * COUNT(*) counts all rows, including those with NULL values in any column.
 * It's the most efficient way to count rows — the database engine often
 * satisfies it from an index without scanning the full table.
 */
export async function getCustomerCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM customers`
  );
  return row?.count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns daily debt totals for the past N days (for the bar chart).
 *
 * ─── CONCEPT: SQLite dates and strftime ──────────────────────────────────────
 * SQLite has NO native date type. Dates are stored as TEXT (ISO strings),
 * REAL (Julian day numbers), or INTEGER (Unix timestamps). We use TEXT / ISO.
 *
 * strftime(format, column) formats a date string. Here:
 *   strftime('%Y-%m-%d', createdAt)  →  "2026-06-21"
 * strips the time part so all transactions on the same calendar day map to
 * the same group key. Without strftime, each row's unique timestamp would
 * create its own group — you'd get 1 row per transaction instead of per day.
 *
 * date('now', '-6 days') is SQLite's way of computing "6 days ago":
 *   date('now')          →  "2026-06-23"
 *   date('now', '-6 days') →  "2026-06-17"
 * Combined with WHERE createdAt >= ..., we get the last 7 calendar days
 * (today + 6 previous days).
 *
 * ─── WHY FILL MISSING DAYS IN JAVASCRIPT, NOT SQL ───────────────────────────
 * SQL's strength is transforming existing rows. It cannot GENERATE rows for
 * dates where no data exists. To fill gaps, you'd need a "date dimension table"
 * (a table containing every date) or a recursive CTE — both are complex to
 * maintain in SQLite.
 *
 * JavaScript can easily generate a range of dates with a loop. The `fillMissingDays`
 * function below creates all 7 date keys and merges in the DB results. Each day
 * with no DB data gets { total: 0 }. This is a clean division of responsibility:
 *   SQL: aggregate real data
 *   JS:  fill structural gaps for the UI
 *
 * @param db   - The open SQLite database instance
 * @param days - How many days back to include (7 for the weekly chart)
 */
export async function getDailyTotals(
  db: SQLiteDatabase,
  days: number
): Promise<import('../types').DailyTotal[]> {
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT
       strftime('%Y-%m-%d', createdAt) AS date,
       SUM(amount)                     AS total
     FROM transactions
     WHERE type = 'debt'
       AND createdAt >= date('now', '-' || ? || ' days')
     GROUP BY date
     ORDER BY date ASC`,
    [days - 1] // -6 days = 7 days total including today
  );

  return fillMissingDays(rows, days);
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all customers with their current outstanding balance.
 *
 * ─── THIS IS THE N+1 FIX ─────────────────────────────────────────────────────
 * CustomerListScreen used to:
 *   1 query: SELECT * FROM customers             → get 20 customers
 *   20 queries: SELECT balance WHERE customerId=? → one per customer
 *   Total: 21 queries
 *
 * This single query replaces all 21 with 1:
 *   JOIN transactions → GROUP BY c.id → compute balance in one scan
 *
 * Difference from getTopDebtors:
 *   - No HAVING filter (we return ALL customers, including settled ones)
 *   - No LIMIT (we return every customer)
 *   - COALESCE handles customers with NO transactions (LEFT JOIN gives NULL SUM)
 *   - ORDER BY name ASC (alphabetical, same as getAllCustomers)
 *
 * @param db - The open SQLite database instance
 */
export async function getAllCustomersWithBalances(
  db: SQLiteDatabase
): Promise<import('../types').CustomerWithBalance[]> {
  console.log('[DB] getAllCustomersWithBalances — single query for all customers+balances');
  const rows = await db.getAllAsync<import('../types').CustomerWithBalance>(
    `SELECT
       c.id,
       c.name,
       c.phone,
       c.createdAt,
       COALESCE(
         SUM(CASE WHEN t.type = 'debt'    THEN t.amount ELSE 0 END)
       - SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END),
         0
       ) AS balance
     FROM customers c
     LEFT JOIN transactions t ON t.customerId = c.id
     GROUP BY c.id, c.name, c.phone, c.createdAt
     ORDER BY c.name ASC`
  );
  return rows;
}
