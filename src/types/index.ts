/**
 * src/types/index.ts
 *
 * Shared TypeScript interfaces for all database entities.
 * These are the "shapes" of our data — every function that touches the
 * database uses these types. Keep this file as the single source of truth.
 */

// ─── Customer ────────────────────────────────────────────────────────────────

/**
 * A customer as stored in (and read from) the database.
 * The `id` and `createdAt` fields are set by SQLite — you never provide them
 * yourself when inserting.
 */
export interface Customer {
  id: number;           // Auto-incremented primary key set by SQLite
  name: string;         // Full name of the shop customer
  phone?: string;       // Optional — not every customer has a phone
  createdAt: string;    // ISO 8601 date string e.g. "2024-01-15T10:30:00.000Z"
}

/**
 * The data you provide when creating a NEW customer.
 * Omit<Customer, 'id' | 'createdAt'> means: "take all Customer fields
 * EXCEPT id and createdAt". This is a TypeScript utility type.
 *
 * Why no `id` or `createdAt`? Because the database generates them for you.
 * Forcing you to pass them would be lying — you don't know them yet.
 */
export type NewCustomer = Omit<Customer, 'id' | 'createdAt'>;

// ─── Transaction ─────────────────────────────────────────────────────────────

/**
 * The two directions money can move in a debt tracker:
 * - "debt"    → the customer owes the shop money (they took goods on credit)
 * - "payment" → the customer paid some or all of what they owe
 *
 * We keep `amount` always positive — the `type` field carries the direction.
 * This makes balance calculations simple: sum(debt) - sum(payment).
 */
export type TransactionType = 'debt' | 'payment';

/**
 * A transaction as stored in (and read from) the database.
 */
export interface Transaction {
  id: number;                  // Auto-incremented primary key
  customerId: number;          // Foreign key → customers.id
  type: TransactionType;       // "debt" or "payment"
  amount: number;              // Stored in INTEGER CENTS — never float shillings.
                               // 150 KES = 15000 cents. 75.50 KES = 7550 cents.
                               // This prevents floating point errors (0.1+0.2 !== 0.3).
                               // Always positive — the `type` field carries direction.
  note?: string;               // Optional description e.g. "maize flour x2"
  createdAt: string;           // ISO 8601 date string
}

/**
 * Data you provide when recording a NEW transaction.
 * Again, `id` and `createdAt` are omitted — SQLite handles them.
 */
export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

// ─── Dashboard Aggregation Types ─────────────────────────────────────────────

/**
 * A customer ranked by their outstanding balance.
 *
 * Produced by the `getTopDebtors` SQL query, which JOINs the customers and
 * transactions tables and aggregates with GROUP BY. The database does the math;
 * JavaScript just receives the final ranking.
 *
 * Fields:
 *   customerId — matches customers.id (used for navigation on press)
 *   name       — customer's display name (from the JOIN, avoids a 2nd query)
 *   balance    — net amount owed IN CENTS. Always > 0 (we filter with HAVING)
 */
export interface TopDebtor {
  customerId: number;
  name: string;
  balance: number; // in cents
}

/**
 * A single transaction enriched with the owning customer's name.
 *
 * The `getRecentActivity` query JOINs transactions → customers so that the
 * Dashboard feed can show "Kamau added KES 500" without a second lookup.
 *
 * This is the "resolved" form of Transaction — everything a UI row needs.
 */
export interface ActivityItem {
  transactionId: number;
  customerId: number;
  customerName: string;
  type: 'debt' | 'payment';
  amount: number;      // in cents
  note: string | null;
  createdAt: string;   // ISO 8601 UTC
}

/**
 * A single point of data for the weekly bar chart.
 *
 *   date  — "YYYY-MM-DD" (e.g. "2026-06-21") — produced by SQLite strftime()
 *   total — total debt recorded on that day, IN CENTS
 *
 * Note: if no transactions exist on a day, the SQL query omits that day entirely.
 * The `fillMissingDays` JS function in the repository fills gaps with { total: 0 }
 * so the chart always has exactly 7 bars.
 */
export interface DailyTotal {
  date: string;  // "YYYY-MM-DD"
  total: number; // in cents
}

/**
 * A customer combined with their current outstanding balance.
 *
 * Produced by `getAllCustomersWithBalances`, which replaces the old N+1 pattern
 * in CustomerListScreen. Instead of 1 query per customer for their balance, a
 * single JOIN + GROUP BY returns all customers + all balances in one shot.
 *
 * The balance can be 0 (settled) or negative (overpaid). We treat both as
 * "no debt" in the UI.
 */
export interface CustomerWithBalance extends Customer {
  balance: number; // in cents. 0 = settled. > 0 = owes money.
}
