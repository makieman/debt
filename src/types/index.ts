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
  amount: number;              // Always a positive number (e.g. 500, not -500)
  note?: string;               // Optional description e.g. "maize flour x2"
  createdAt: string;           // ISO 8601 date string
}

/**
 * Data you provide when recording a NEW transaction.
 * Again, `id` and `createdAt` are omitted — SQLite handles them.
 */
export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;
