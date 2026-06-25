/**
 * src/db/seed.ts
 *
 * Demo data seeding functions.
 *
 * ─── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 *
 * On Day 7 a shopkeeper sees this app for the first time. An empty dashboard
 * tells them nothing — there is no "wow" moment. Realistic demo data makes the
 * app feel alive and purpose-built for Kenyan shops.
 *
 * These functions are NEVER called automatically in production mode. They are
 * only called:
 *   1. On first launch (via App.tsx + AsyncStorage first-launch check)
 *   2. When the user taps "Load Demo Data" in the Settings screen
 *
 * ─── DELETE FROM vs DROP TABLE ───────────────────────────────────────────────
 *
 * clearAllData uses DELETE FROM, NOT DROP TABLE.
 *
 *   DELETE FROM customers  → removes all rows. Table structure stays.
 *                            You can immediately insert new rows.
 *
 *   DROP TABLE customers   → destroys the table itself (schema + data).
 *                            You would need to re-run migrations to use the
 *                            table again.
 *
 * We want to clear data, not destroy the schema. Always use DELETE FROM.
 *
 * ─── AMOUNT STORAGE ──────────────────────────────────────────────────────────
 *
 * All amounts are stored as INTEGER CENTS (not KES floats).
 *
 *   KES 1,500  →  150000  (1500 * 100)
 *   KES   500  →   50000  ( 500 * 100)
 *
 * This avoids floating-point rounding errors in financial calculations.
 * Never store KES 1.50 as 1.5 — store it as 150.
 *
 * ─── DATE ARITHMETIC ─────────────────────────────────────────────────────────
 *
 * We spread transactions across the last 14 days using:
 *   new Date(Date.now() - N * 24 * 60 * 60 * 1000).toISOString()
 *
 *   Date.now()        → current timestamp in milliseconds
 *   N * 86400 * 1000  → N days in milliseconds
 *   Subtracting       → N days ago
 *   .toISOString()    → "2024-01-15T10:30:00.000Z" — our storage format
 *
 * ─── SEED DATA VERIFICATION ──────────────────────────────────────────────────
 *
 * Total outstanding after seeding:
 *   Kamau Njoroge:   KES 2,350  →  235000 cents
 *   Wanjiku Muthoni: KES   850  →   85000 cents
 *   Omondi Otieno:   KES 3,100  →  310000 cents
 *   Fatuma Hassan:   KES     0  →       0 cents  (settled)
 *   Mutua Kioko:     KES   500  →   50000 cents
 *   Akinyi Adhiambo: KES 1,750  →  175000 cents
 *   Njuguna Kariuki: KES   200  →   20000 cents
 *   Zawadi Baraka:   KES   650  →   65000 cents
 *                              ─────────────────
 *   TOTAL:           KES 9,400  →  940000 cents
 *
 * The Dashboard "Total Outstanding" StatCard must show KES 9,400.00 after seeding.
 */

import { SQLiteDatabase } from 'expo-sqlite';

// ─── Helper ────────────────────────────────────────────────────────────────────

/**
 * Returns an ISO 8601 timestamp for N days ago.
 * Used to spread transactions across the last 14 days of history.
 *
 * @param daysAgo - How many days in the past (e.g. 7 = 7 days ago)
 */
function daysAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

// ─── clearAllData ─────────────────────────────────────────────────────────────

/**
 * Deletes all rows from both tables.
 *
 * ORDER MATTERS: We delete transactions first because of the FOREIGN KEY
 * constraint. transactions.customerId references customers.id. If we deleted
 * customers first, SQLite's ON DELETE CASCADE would fire and delete transactions
 * automatically — but to be explicit and safe, we delete child rows before
 * parent rows.
 *
 * Runs inside a single transaction: if either DELETE fails, neither is committed.
 * The database is left unchanged on error (atomicity).
 *
 * @param db - The open SQLite database instance
 */
export async function clearAllData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Delete child rows first (FK constraint)
    await db.execAsync('DELETE FROM transactions;');
    // Then delete parent rows
    await db.execAsync('DELETE FROM customers;');
  });

  console.log('🧹 All data cleared');
}

// ─── seedDemoData ─────────────────────────────────────────────────────────────

/**
 * Clears the database and inserts 8 realistic Kenyan shop customers with
 * transaction history spread across the last 14 days.
 *
 * WHY SWAHILI NOTES:
 * "Unga", "Sukari", "Mafuta", "Mkate" are real shop items sold in Kenyan dukas.
 * When the shopkeeper sees these in the demo, the app feels purpose-built for
 * them — not translated from somewhere else. Localised demo data = trust.
 *
 * WHY FATUMA HASSAN HAS ZERO BALANCE:
 * Settled customers are an important part of the lifecycle. The shopkeeper will
 * ask "what happens when someone pays in full?" Fatuma IS the answer — on screen,
 * before they even finish the question.
 *
 * @param db - The open SQLite database instance
 */
export async function seedDemoData(db: SQLiteDatabase): Promise<void> {
  // Step 1: Wipe existing data
  await clearAllData(db);

  // ─── Insert customers and capture their auto-generated IDs ───────────────────
  //
  // We INSERT each customer and immediately capture the lastInsertRowId.
  // We then use those IDs to INSERT the correct transactions for each customer.
  // This is the proper way to handle FK relationships in SQLite — never
  // hardcode IDs, always read them back from the database.

  // ── 1. Kamau Njoroge — KES 2,350 outstanding ─────────────────────────────────
  // Debts:    1500 + 800 + 1200 = KES 3,500 (350000 cents)
  // Payments: 500 + 650          = KES 1,150 (115000 cents)
  // Balance:  3500 - 1150        = KES 2,350 ✓
  const r1 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Kamau Njoroge', '0712 345 678', daysAgo(15)]
  );
  const kamauId = r1.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [kamauId, 'debt', 150000, 'Unga 2kg, Sukari', daysAgo(14)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [kamauId, 'debt', 80000, 'Mafuta, Chumvi', daysAgo(12)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [kamauId, 'payment', 50000, 'Partial payment', daysAgo(10)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [kamauId, 'debt', 120000, 'Mkate, Maziwa', daysAgo(7)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [kamauId, 'payment', 65000, '', daysAgo(3)]
  );

  // ── 2. Wanjiku Muthoni — KES 850 outstanding ─────────────────────────────────
  // Debts:    600 + 450 = KES 1,050 (105000 cents)
  // Payments: 200        = KES   200 (20000  cents)
  // Balance:  1050 - 200 = KES   850 ✓
  const r2 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Wanjiku Muthoni', '0723 456 789', daysAgo(12)]
  );
  const wanjikuId = r2.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [wanjikuId, 'debt', 60000, 'Sabuni, Pampers', daysAgo(11)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [wanjikuId, 'debt', 45000, 'Soda 2, Juice', daysAgo(9)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [wanjikuId, 'payment', 20000, 'Cash payment', daysAgo(6)]
  );

  // ── 3. Omondi Otieno — KES 3,100 outstanding ─────────────────────────────────
  // Debts:    2000 + 1800 = KES 3,800 (380000 cents)
  // Payments: 700          = KES   700 (70000  cents)
  // Balance:  3800 - 700   = KES 3,100 ✓
  const r3 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Omondi Otieno', '0734 567 890', daysAgo(14)]
  );
  const omondiId = r3.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [omondiId, 'debt', 200000, 'Wholesale unga', daysAgo(13)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [omondiId, 'debt', 180000, 'Mafuta cooking', daysAgo(8)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [omondiId, 'payment', 70000, '', daysAgo(5)]
  );

  // ── 4. Fatuma Hassan — KES 0 (SETTLED) ───────────────────────────────────────
  // Debts:    900  = KES 900 (90000 cents)
  // Payments: 900  = KES 900 (90000 cents)
  // Balance:  0    = KES 0   ✓
  //
  // WHY A ZERO-BALANCE CUSTOMER EXISTS IN THE SEED DATA:
  // The shopkeeper will ask "what happens when someone pays in full?"
  // Fatuma is the on-screen answer — settled, no explanation needed.
  const r4 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Fatuma Hassan', '0745 678 901', daysAgo(11)]
  );
  const fatumaId = r4.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [fatumaId, 'debt', 90000, 'Mkate, Maziwa daily', daysAgo(10)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [fatumaId, 'payment', 90000, 'Full payment asante', daysAgo(4)]
  );

  // ── 5. Mutua Kioko — KES 500 outstanding ─────────────────────────────────────
  const r5 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Mutua Kioko', '0756 789 012', daysAgo(7)]
  );
  const mutuaId = r5.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [mutuaId, 'debt', 50000, 'Unga 1kg', daysAgo(6)]
  );

  // ── 6. Akinyi Adhiambo — KES 1,750 outstanding ───────────────────────────────
  // Debts: 1000 + 750 = KES 1,750 ✓
  const r6 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Akinyi Adhiambo', '0767 890 123', daysAgo(10)]
  );
  const akinyiId = r6.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [akinyiId, 'debt', 100000, 'Monthly supplies', daysAgo(9)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [akinyiId, 'debt', 75000, 'Soda crate', daysAgo(7)]
  );

  // ── 7. Njuguna Kariuki — KES 200 outstanding ─────────────────────────────────
  const r7 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Njuguna Kariuki', '0778 901 234', daysAgo(4)]
  );
  const njugunaId = r7.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [njugunaId, 'debt', 20000, 'Chumvi, Sukari', daysAgo(3)]
  );

  // ── 8. Zawadi Baraka — KES 650 outstanding ───────────────────────────────────
  // No phone (optional field) — proves the app works without phone numbers
  // Debts: 400 + 250 = KES 650 ✓
  const r8 = await db.runAsync(
    `INSERT INTO customers (name, phone, createdAt) VALUES (?, ?, ?)`,
    ['Zawadi Baraka', null, daysAgo(9)]
  );
  const zawadiId = r8.lastInsertRowId;

  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [zawadiId, 'debt', 40000, 'Uji flour', daysAgo(8)]
  );
  await db.runAsync(
    `INSERT INTO transactions (customerId, type, amount, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [zawadiId, 'debt', 25000, 'Mandazi', daysAgo(5)]
  );

  console.log(
    '🌱 Demo data seeded: 8 customers, KES 9,400 total outstanding\n' +
    '   Kamau Njoroge:   KES 2,350\n' +
    '   Wanjiku Muthoni: KES   850\n' +
    '   Omondi Otieno:   KES 3,100\n' +
    '   Fatuma Hassan:   KES     0 (settled)\n' +
    '   Mutua Kioko:     KES   500\n' +
    '   Akinyi Adhiambo: KES 1,750\n' +
    '   Njuguna Kariuki: KES   200\n' +
    '   Zawadi Baraka:   KES   650\n' +
    '   ─────────────────────────────\n' +
    '   TOTAL:           KES 9,400'
  );
}
