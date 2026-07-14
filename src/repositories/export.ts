/**
 * src/repositories/export.ts
 *
 * WHY IS THIS A REPOSITORY?
 * A repository is a module whose job is to read from the database and return
 * data in a useful shape. This file reads all customers and transactions from
 * SQLite and packages them for export. The difference from other repositories:
 * instead of returning model objects, it returns FORMATTED OUTPUT (JSON strings,
 * CSV strings) ready to write to disk.
 *
 * WHY NEST TRANSACTIONS INSIDE CUSTOMERS IN THE JSON?
 * A flat transactions array would require an importer to reconstruct which
 * transaction belongs to which customer via customerId foreign keys. The nested
 * format is self-describing: open the file and you immediately see each
 * customer's complete ledger. It's the same reason a receipt prints every item
 * under the shop name — context belongs with its data.
 *
 * WHY INCLUDE balanceCents IN THE JSON EVEN THOUGH IT'S COMPUTABLE?
 * Redundancy for verification. When restoring, we can recompute the balance
 * from the transactions and compare it to the stored balanceCents. A mismatch
 * signals data corruption — a valuable safety net.
 *
 * THE MOST COMMON CSV BUG:
 * If a note field contains a comma — e.g. "Unga, Sukari" — and you don't quote
 * the field, the CSV parser splits it into TWO columns. The rest of the row
 * shifts right and every column is misread. Always wrap CSV values in double
 * quotes, and escape any double quotes INSIDE the value by doubling them:
 *   "He said ""yes"""  ← the outer quotes delimit; the inner "" = one literal "
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { getAllCustomersWithBalances } from './transactions';
import { getTransactionsByCustomer } from './transactions';
import { toShillings } from '../utils/money';
import { formatTransactionDate } from '../utils/dates';
import { slugify } from '../utils/strings';
import { CustomerWithBalance } from '../types';

// ─── Export Data Types ────────────────────────────────────────────────────────

export interface ExportTransaction {
  id: number;
  type: 'debt' | 'payment';
  amountCents: number;
  note: string | null;
  createdAt: string; // ISO 8601 UTC
}

export interface ExportCustomer {
  id: number;
  name: string;
  phone: string | null;
  createdAt: string; // ISO 8601 UTC
  balanceCents: number;
  transactions: ExportTransaction[];
}

export interface ExportData {
  exportedAt: string;      // ISO 8601 UTC timestamp of when the export ran
  appVersion: string;      // Hardcoded "1.0.0" — useful for future import logic
  shopProfile: {
    shopName: string;
    ownerName: string;
    currency: string;
  };
  summary: {
    totalCustomers: number;
    totalTransactions: number;
    totalOutstandingCents: number;
  };
  customers: ExportCustomer[];
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  rowCount?: number;    // number of transactions in this export
  driveBackedUp?: boolean; // true if the file was also uploaded to Google Drive
}

// ─── FUNCTION 1: getFullExportData ──────────────────────────────────────────

/**
 * Reads all data from the database and builds the nested export structure.
 *
 * Steps:
 *   1. Fetch all customers with their pre-computed balances (one SQL query)
 *   2. For each customer, fetch their transactions (N queries — acceptable
 *      for an export operation that runs once; not a live list view)
 *   3. Build nested ExportCustomer[] with embedded ExportTransaction[]
 *   4. Compute summary totals
 *
 * @param db          - The open SQLite database instance
 * @param shopProfile - Shop name/owner/currency for the export header
 */
export async function getFullExportData(
  db: SQLiteDatabase,
  shopProfile: { shopName: string; ownerName: string; currency: string }
): Promise<ExportData> {
  const customersWithBalances = await getAllCustomersWithBalances(db);

  let totalTransactions = 0;
  let totalOutstandingCents = 0;

  const customers: ExportCustomer[] = await Promise.all(
    customersWithBalances.map(async (customer: CustomerWithBalance) => {
      const transactions = await getTransactionsByCustomer(db, customer.id);
      totalTransactions += transactions.length;

      // Only count positive balances (customers who owe money)
      if (customer.balance > 0) {
        totalOutstandingCents += customer.balance;
      }

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone ?? null,
        createdAt: customer.createdAt,
        balanceCents: customer.balance,
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amountCents: t.amount,
          note: t.note ?? null,
          createdAt: t.createdAt,
        })),
      };
    })
  );

  return {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    shopProfile,
    summary: {
      totalCustomers: customers.length,
      totalTransactions,
      totalOutstandingCents,
    },
    customers,
  };
}

// ─── FUNCTION 2: csvEscape ────────────────────────────────────────────────────

/**
 * Wraps a string in double quotes for CSV and escapes any internal double quotes.
 *
 * THE CSV QUOTING RULE (RFC 4180):
 *   - Fields MAY be enclosed in double quotes.
 *   - If a field contains a comma, a newline, or a double quote, it MUST
 *     be enclosed in double quotes.
 *   - A double quote inside a quoted field is represented by TWO double quotes.
 *
 * Example:
 *   csvEscape('He said "yes"')  →  '"He said ""yes"""'
 *   csvEscape('Unga, Sukari')   →  '"Unga, Sukari"'
 *   csvEscape('')               →  '""'
 *
 * BUG IF YOU SKIP THIS:
 *   Note "Unga, Sukari" without quoting becomes two CSV columns: "Unga" and
 *   " Sukari". The rest of the row shifts right. The accountant sees garbled
 *   data and loses trust in the entire export.
 */
export function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// ─── FUNCTION 3: generateCSV ──────────────────────────────────────────────────

/**
 * Converts ExportData to a flat CSV string suitable for Excel/Google Sheets.
 *
 * WHY A SUMMARY HEADER?
 * When a shopkeeper opens this in Excel, the first thing they see is their
 * shop name and total outstanding — context before data. Without it, the file
 * looks like raw numbers with no owner. The summary makes the file meaningful
 * as a standalone document.
 *
 * THE AMOUNT-IN-SHILLINGS REQUIREMENT:
 * Amounts are stored in cents. If we export 150000 instead of 1500.00, the
 * accountant sees amounts inflated by 100x. Always call toShillings() before
 * formatting monetary values in the CSV.
 */
export function generateCSV(data: ExportData): string {
  const lines: string[] = [];
  const currency = data.shopProfile.currency;

  // ─── Summary header ───────────────────────────────────────────────────────
  lines.push(csvEscape('Credi Export'));
  lines.push(`${csvEscape('Shop:')},${csvEscape(data.shopProfile.shopName)}`);
  lines.push(`${csvEscape('Owner:')},${csvEscape(data.shopProfile.ownerName)}`);
  lines.push(`${csvEscape('Exported:')},${csvEscape(formatTransactionDate(data.exportedAt))}`);
  lines.push(
    `${csvEscape('Total Outstanding:')},${csvEscape(
      `${currency} ${toShillings(data.summary.totalOutstandingCents).toFixed(2)}`
    )}`
  );
  lines.push(''); // blank separator row

  // ─── Column headers ───────────────────────────────────────────────────────
  lines.push(
    [
      csvEscape('Customer Name'),
      csvEscape('Phone'),
      csvEscape('Transaction Type'),
      csvEscape(`Amount (${currency})`),
      csvEscape('Note'),
      csvEscape('Date'),
      csvEscape(`Customer Balance (${currency})`),
    ].join(',')
  );

  // ─── Data rows — one row per transaction ─────────────────────────────────
  const sortedCustomers = [...data.customers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const customer of sortedCustomers) {
    if (customer.transactions.length === 0) {
      // Customer with no transactions — emit one row with empty tx columns
      lines.push(
        [
          csvEscape(customer.name),
          csvEscape(customer.phone ?? ''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(toShillings(customer.balanceCents).toFixed(2)),
        ].join(',')
      );
    } else {
      const sortedTransactions = [...customer.transactions].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (const tx of sortedTransactions) {
        lines.push(
          [
            csvEscape(customer.name),
            csvEscape(customer.phone ?? ''),
            csvEscape(tx.type),
            csvEscape(toShillings(tx.amountCents).toFixed(2)),
            csvEscape(tx.note ?? ''),
            csvEscape(formatTransactionDate(tx.createdAt)),
            csvEscape(toShillings(customer.balanceCents).toFixed(2)),
          ].join(',')
        );
      }
    }
  }

  return lines.join('\n');
}

// ─── FUNCTION 4: generateFilename ────────────────────────────────────────────

/**
 * Generates a filesystem-safe export filename.
 *
 * WHY A STRUCTURED FILENAME?
 * "duka-deni-kamau-shop-2024-06-14.json" tells you what it is, who it belongs
 * to, and when it was made — without opening the file. WhatsApp shows filenames
 * in chat; a generic "export.json" is useless context.
 *
 * Uses slugify() so shop names like "Duka ya Kamau!" become "duka-ya-kamau".
 *
 * @param extension - "json" or "csv"
 * @param shopName  - The shop owner's shop name (from ShopProfile)
 * @returns         - e.g. "duka-deni-kamau-shop-2024-06-14.json"
 */
export function generateFilename(
  extension: 'json' | 'csv',
  shopName: string
): string {
  const slug = slugify(shopName);
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `duka-deni-${slug}-${yyyy}-${mm}-${dd}.${extension}`;
}
