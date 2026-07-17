/**
 * src/services/importService.ts
 *
 * Handles importing customer and transaction data from:
 *   - Credi JSON backups (.json)  - full restore of an app export
 *   - Credi CSV exports  (.csv)  - re-import the flat spreadsheet we generated
 *   - Excel / CSV templates      - user-filled from the downloadable template
 *
 * KEY INVARIANTS:
 *
 * 1. DEDUPLICATION BY NAME
 *    If a customer already exists in the DB (matched case-insensitively by name),
 *    their new transactions are appended to the existing record - no duplicate row.
 *
 * 2. ATOMICITY
 *    Every INSERT is wrapped in db.withTransactionAsync.
 *    If a single row fails, the entire import rolls back.
 *
 * 3. NEVER THROW TO CALLERS
 *    Return ImportResult objects instead of throwing, so UI components can
 *    display error messages rather than crashing.
 *
 * AMOUNT HANDLING:
 *    Amounts in CSV/XLSX are KES shillings (e.g. "1,500.00").
 *    Convert to cents: Math.round(parseFloat(cleaned) * 100).
 *    Unparseable amounts -> row is skipped and counted in skippedRows.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';
import * as XLSX from 'xlsx';
import { ExportData } from '../repositories/export';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export type ImportFormat = 'credi-json' | 'credi-csv' | 'template';

/** Summary returned BEFORE writing to the DB — used to show the user a preview. */
export interface ImportPreview {
  format: ImportFormat;
  fileName: string;
  customersFound: number;
  transactionsFound: number;
  /** Customers whose names do not match any existing record - will be created. */
  newCustomers: number;
  /** Customers whose names match an existing record - transactions appended. */
  matchedCustomers: number;
  /** Rows that could not be parsed (bad amount, blank name, etc.). */
  skippedRows: number;
}

/** Result returned AFTER writing to the DB. */
export interface ImportResult {
  success: boolean;
  customersAdded: number;
  customersMatched: number;
  transactionsAdded: number;
  skippedRows: number;
  error?: string;
}

/**
 * Opaque payload returned by parseImportFile() and consumed by executeImport().
 * The ImportSheet holds this in state between the preview step and the confirm step.
 */
export interface ImportPayload {
  format: ImportFormat;
  customers: ParsedCustomer[];
  skippedRows: number;
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface ParsedCustomer {
  name: string;
  phone: string | null;
  transactions: ParsedTransaction[];
}

interface ParsedTransaction {
  type: 'debt' | 'payment';
  amountCents: number;
  note: string | null;
  createdAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// STEP 1: File Picking
// ---------------------------------------------------------------------------

/**
 * Opens the native document picker.
 * Returns { uri, name } or null if the user cancelled.
 *
 * We pass a broad set of MIME types because Android devices often report
 * unexpected types for CSV and Excel files (e.g. "application/octet-stream").
 * The "*​/*" fallback ensures the picker always shows content.
 */
export async function pickImportFile(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'application/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '*/*',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name ?? 'import',
  };
}

// ---------------------------------------------------------------------------
// STEP 2: Parsing
// ---------------------------------------------------------------------------

/**
 * Reads the file at `uri`, detects its format, and parses it into the internal
 * customer/transaction structure. Does NOT touch the database.
 *
 * @throws Error if the file cannot be read or its format is unrecognised.
 */
export async function parseImportFile(uri: string, fileName: string): Promise<ImportPayload> {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();

  if (ext === 'json') return parseJSON(uri);
  if (ext === 'csv' || ext === 'txt') return parseCSV(uri);
  if (ext === 'xlsx' || ext === 'xls') return parseXLSX(uri);

  throw new Error('importUnsupportedFormat');
}

// -- JSON ------------------------------------------------------------------

async function parseJSON(uri: string): Promise<ImportPayload> {
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let data: ExportData;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('File is not valid JSON');
  }

  if (!data.customers || !Array.isArray(data.customers)) {
    throw new Error('JSON file is missing the "customers" array');
  }

  const customers: ParsedCustomer[] = data.customers.map((c) => ({
    name: c.name.trim(),
    phone: c.phone ? c.phone.trim() || null : null,
    transactions: c.transactions.map((t) => ({
      type: t.type,
      amountCents: t.amountCents,
      note: t.note ?? null,
      createdAt: t.createdAt,
    })),
  }));

  return { format: 'credi-json', customers, skippedRows: 0 };
}

// -- CSV ------------------------------------------------------------------

async function parseCSV(uri: string): Promise<ImportPayload> {
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // SheetJS handles quoted fields and escaped double-quotes correctly
  const workbook = XLSX.read(content, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length === 0) throw new Error('The CSV file is empty');

  // Credi CSV has "Credi Export" in cell A1
  const firstCell = String(rows[0]?.[0] ?? '').trim();
  if (firstCell === 'Credi Export') {
    return parseCrediCSVRows(rows);
  }

  return parseTemplateRows(rows, 'template');
}

// -- XLSX ------------------------------------------------------------------

async function parseXLSX(uri: string): Promise<ImportPayload> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length === 0) throw new Error('The Excel file is empty');

  return parseTemplateRows(rows, 'template');
}

// ---------------------------------------------------------------------------
// Credi CSV Row Parser
// ---------------------------------------------------------------------------

/**
 * Credi CSV layout (produced by exportService.ts):
 *   Row 0: "Credi Export"
 *   Row 1: "Shop:", "<shop name>"
 *   Row 2: "Owner:", "<owner>"
 *   Row 3: "Exported:", "<date>"
 *   Row 4: "Total Outstanding:", "<amount>"
 *   Row 5: blank
 *   Row 6: "Customer Name" | "Phone" | "Transaction Type" | "Amount (KES)" | "Note" | "Date" | "Customer Balance (KES)"
 *   Row 7+: one transaction per row
 */
function parseCrediCSVRows(rows: string[][]): ImportPayload {
  // Find the header row (first row containing "Customer Name")
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((c) => String(c).trim() === 'Customer Name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('Could not find the column header row in the Credi CSV');
  }

  const headers   = rows[headerIdx].map((h) => String(h).trim());
  const nameIdx   = headers.findIndex((h) => h === 'Customer Name');
  const phoneIdx  = headers.findIndex((h) => h === 'Phone');
  const typeIdx   = headers.findIndex((h) => h === 'Transaction Type');
  const amountIdx = headers.findIndex((h) => h.startsWith('Amount'));
  const noteIdx   = headers.findIndex((h) => h === 'Note');
  const dateIdx   = headers.findIndex((h) => h === 'Date');

  const customerMap = new Map<string, ParsedCustomer>();
  let skippedRows = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => String(c).trim() === '')) continue; // blank row

    const name = String(row[nameIdx] ?? '').trim();
    if (!name) { skippedRows++; continue; }

    const key    = name.toLowerCase();
    const phone  = phoneIdx >= 0 ? String(row[phoneIdx] ?? '').trim() || null : null;
    const txType = typeIdx  >= 0 ? String(row[typeIdx]  ?? '').trim().toLowerCase() : '';
    const rawAmt = amountIdx >= 0 ? String(row[amountIdx] ?? '').trim() : '';
    const note   = noteIdx  >= 0 ? String(row[noteIdx]  ?? '').trim() || null : null;
    const rawDate= dateIdx  >= 0 ? String(row[dateIdx]  ?? '').trim() : '';

    if (!customerMap.has(key)) {
      customerMap.set(key, { name, phone, transactions: [] });
    }
    const customer = customerMap.get(key)!;

    // Backfill phone if the existing slot had none
    if (phone && !customer.phone) customer.phone = phone;

    // Rows with no transaction type are customer-only rows (no transactions to add)
    if (!txType || (txType !== 'debt' && txType !== 'payment')) continue;

    const amountCents = parseCents(rawAmt);
    if (amountCents === null || amountCents <= 0) { skippedRows++; continue; }

    customer.transactions.push({
      type: txType as 'debt' | 'payment',
      amountCents,
      note,
      createdAt: parseDate(rawDate),
    });
  }

  return {
    format: 'credi-csv',
    customers: Array.from(customerMap.values()),
    skippedRows,
  };
}

// ---------------------------------------------------------------------------
// Template Row Parser
// ---------------------------------------------------------------------------

/**
 * Template layout (Excel or simple CSV):
 *   Row 0: Name | Phone (optional) | Opening Balance (KES)
 *   Row 1+: data - one customer per row
 *
 * Column headers are matched case-insensitively by substring:
 *   "Opening Balance (KES)" and "Balance" both match the balance column.
 * The opening balance is recorded as a 'debt' transaction.
 */
function parseTemplateRows(rows: string[][], format: ImportFormat): ImportPayload {
  if (rows.length < 2) throw new Error('The template file has no data rows');

  const headers    = rows[0].map((h) => String(h).trim().toLowerCase());
  const nameIdx    = headers.findIndex((h) => h.includes('name'));
  const phoneIdx   = headers.findIndex((h) => h.includes('phone') || h.includes('mobile'));
  const balanceIdx = headers.findIndex(
    (h) => h.includes('balance') || h.includes('amount') || h.includes('opening')
  );

  if (nameIdx === -1) {
    throw new Error(
      'The file must have a "Name" column in the first row.\n' +
      'Download the Credi template for the correct format.'
    );
  }

  const customers: ParsedCustomer[] = [];
  let skippedRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => String(c).trim() === '')) continue;

    const name = String(row[nameIdx] ?? '').trim();
    if (!name) { skippedRows++; continue; }

    const phone      = phoneIdx   >= 0 ? String(row[phoneIdx]   ?? '').trim() || null : null;
    const rawBalance = balanceIdx >= 0 ? String(row[balanceIdx] ?? '').trim() : '';

    const transactions: ParsedTransaction[] = [];

    if (rawBalance && rawBalance !== '0') {
      const amountCents = parseCents(rawBalance);
      if (amountCents !== null && amountCents > 0) {
        transactions.push({
          type: 'debt',
          amountCents,
          note: 'Opening balance',
          createdAt: new Date().toISOString(),
        });
      }
    }

    customers.push({ name, phone, transactions });
  }

  return { format, customers, skippedRows };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Converts a currency string to integer cents.
 *   "1,500.00"  -> 150000
 *   "KES 1500"  -> 150000
 *   ""          -> null
 */
function parseCents(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const clean = raw.replace(/[A-Z\s,]/gi, '').replace(/[^0-9.]/g, '');
  const val = parseFloat(clean);
  if (isNaN(val)) return null;
  return Math.round(val * 100);
}

/**
 * Parses a date string to ISO 8601. Falls back to "now" if unparseable.
 */
function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ---------------------------------------------------------------------------
// STEP 3: Preview
// ---------------------------------------------------------------------------

/**
 * Compares the parsed payload against the existing DB to compute preview numbers.
 * Call this after parseImportFile() and before asking the user to confirm.
 */
export async function buildPreview(
  db: SQLiteDatabase,
  payload: ImportPayload,
  fileName: string
): Promise<ImportPreview> {
  const existingRows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM customers WHERE isDeleted = 0`
  );
  const existingNames = new Set(existingRows.map((r) => r.name.toLowerCase()));

  let newCustomers     = 0;
  let matchedCustomers = 0;
  let transactionsFound = 0;

  for (const c of payload.customers) {
    if (existingNames.has(c.name.toLowerCase())) {
      matchedCustomers++;
    } else {
      newCustomers++;
    }
    transactionsFound += c.transactions.length;
  }

  return {
    format: payload.format,
    fileName,
    customersFound: payload.customers.length,
    transactionsFound,
    newCustomers,
    matchedCustomers,
    skippedRows: payload.skippedRows,
  };
}

// ---------------------------------------------------------------------------
// STEP 4: Execute
// ---------------------------------------------------------------------------

/**
 * Writes the parsed data into the database atomically.
 *
 * For each customer:
 *   - If matched by name -> append transactions, backfill phone if blank.
 *   - Otherwise -> create new customer row.
 *
 * All inserts happen inside a single db.withTransactionAsync call.
 */
export async function executeImport(
  db: SQLiteDatabase,
  payload: ImportPayload
): Promise<ImportResult> {
  let customersAdded    = 0;
  let customersMatched  = 0;
  let transactionsAdded = 0;
  const skippedRows = payload.skippedRows;

  try {
    await db.withTransactionAsync(async () => {
      for (const customer of payload.customers) {
        const existing = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM customers
           WHERE lower(name) = lower(?) AND isDeleted = 0`,
          [customer.name]
        );

        let customerId: number;

        if (existing) {
          customerId = existing.id;
          customersMatched++;

          if (customer.phone) {
            await db.runAsync(
              `UPDATE customers SET phone = ?
               WHERE id = ? AND (phone IS NULL OR phone = '')`,
              [customer.phone, customerId]
            );
          }
        } else {
          const result = await db.runAsync(
            `INSERT INTO customers (name, phone, createdAt, isDeleted)
             VALUES (?, ?, ?, 0)`,
            [customer.name, customer.phone ?? null, new Date().toISOString()]
          );
          customerId = result.lastInsertRowId;
          customersAdded++;
        }

        for (const tx of customer.transactions) {
          await db.runAsync(
            `INSERT INTO transactions (customerId, type, amount, note, createdAt)
             VALUES (?, ?, ?, ?, ?)`,
            [customerId, tx.type, tx.amountCents, tx.note ?? null, tx.createdAt]
          );
          transactionsAdded++;
        }
      }
    });

    return { success: true, customersAdded, customersMatched, transactionsAdded, skippedRows };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[importService] executeImport failed:', error);
    return { success: false, customersAdded: 0, customersMatched: 0, transactionsAdded: 0, skippedRows, error };
  }
}
