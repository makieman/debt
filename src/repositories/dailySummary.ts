/**
 * src/repositories/dailySummary.ts
 *
 * Repository functions for daily sales ledger summaries and daily expenses.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import {
  DailySummary,
  DailyExpense,
  DailySummaryWithExpenses,
  NewDailySummary,
  NewDailyExpense,
  ReportTotals,
  ExpenseCategory,
  EXPENSE_CATEGORIES,
} from '../types';

/**
 * Returns today's date as "YYYY-MM-DD" in local time.
 * We do NOT use new Date().toISOString().split('T')[0] because toISOString() uses UTC.
 * In Kenya (UTC+3), late-evening local time (e.g. 11 PM) would shift to tomorrow in UTC.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Computes credit issued from transactions for a given calendar date.
 */
export async function getCreditIssuedToday(
  db: SQLiteDatabase,
  date: string
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE type = 'debt'
       AND strftime('%Y-%m-%d', createdAt) = ?`,
    [date]
  );
  return row?.total ?? 0;
}

/**
 * Core function called when the entry screen opens.
 * Finds existing summary for the given date (defaulting to today) or creates one.
 */
export async function getOrCreateTodaySummary(
  db: SQLiteDatabase,
  targetDate?: string
): Promise<DailySummary> {
  const dateStr = targetDate ?? getTodayDateString();

  const existing = await db.getFirstAsync<DailySummary>(
    `SELECT * FROM daily_summaries WHERE date = ?`,
    [dateStr]
  );

  if (existing) {
    return existing;
  }

  const computedCredit = await getCreditIssuedToday(db, dateStr);
  const nowIso = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO daily_summaries (date, cashSales, mpesaSales, creditIssued, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [dateStr, 0, 0, computedCredit, null, nowIso, nowIso]
  );

  const newSummary = await db.getFirstAsync<DailySummary>(
    `SELECT * FROM daily_summaries WHERE date = ?`,
    [dateStr]
  );

  if (!newSummary) {
    return {
      id: 1,
      date: dateStr,
      cashSales: 0,
      mpesaSales: 0,
      creditIssued: computedCredit,
      notes: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  return newSummary;
}

/**
 * Inserts or updates a daily summary row for a specific date using ON CONFLICT.
 */
export async function upsertDailySummary(
  db: SQLiteDatabase,
  data: NewDailySummary
): Promise<DailySummary> {
  const nowIso = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO daily_summaries (date, cashSales, mpesaSales, creditIssued, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       cashSales = excluded.cashSales,
       mpesaSales = excluded.mpesaSales,
       creditIssued = excluded.creditIssued,
       notes = excluded.notes,
       updatedAt = excluded.updatedAt`,
    [
      data.date,
      data.cashSales,
      data.mpesaSales,
      data.creditIssued,
      data.notes ?? null,
      nowIso,
      nowIso,
    ]
  );

  const updated = await db.getFirstAsync<DailySummary>(
    `SELECT * FROM daily_summaries WHERE date = ?`,
    [data.date]
  );

  if (!updated) {
    return {
      id: 1,
      date: data.date,
      cashSales: data.cashSales,
      mpesaSales: data.mpesaSales,
      creditIssued: data.creditIssued,
      notes: data.notes ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  return updated;
}

/**
 * Adds an expense item linked to a daily summary.
 */
export async function addExpense(
  db: SQLiteDatabase,
  expense: NewDailyExpense
): Promise<DailyExpense> {
  const nowIso = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO daily_expenses (summaryId, category, customCategory, amount, note, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      expense.summaryId,
      expense.category,
      expense.customCategory ?? null,
      expense.amount,
      expense.note ?? null,
      nowIso,
    ]
  );

  const inserted = await db.getFirstAsync<DailyExpense>(
    `SELECT * FROM daily_expenses WHERE id = ?`,
    [result.lastInsertRowId]
  );

  if (!inserted) {
    return {
      id: Number(result?.lastInsertRowId ?? 1),
      summaryId: expense.summaryId,
      category: expense.category,
      customCategory: expense.customCategory ?? null,
      amount: expense.amount,
      note: expense.note ?? null,
      createdAt: nowIso,
    };
  }

  return inserted;
}

/**
 * Updates an expense item's amount and note.
 */
export async function updateExpense(
  db: SQLiteDatabase,
  id: number,
  amount: number,
  note?: string
): Promise<void> {
  await db.runAsync(
    `UPDATE daily_expenses SET amount = ?, note = ? WHERE id = ?`,
    [amount, note ?? null, id]
  );
}

/**
 * Deletes an expense item by ID.
 */
export async function deleteExpense(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(`DELETE FROM daily_expenses WHERE id = ?`, [id]);
}

/**
 * Fetches a summary + expenses for a date, computing calculated fields.
 */
export async function getSummaryWithExpenses(
  db: SQLiteDatabase,
  date: string
): Promise<DailySummaryWithExpenses | null> {
  const summary = await db.getFirstAsync<DailySummary>(
    `SELECT * FROM daily_summaries WHERE date = ?`,
    [date]
  );

  if (!summary) {
    const nowIso = new Date().toISOString();
    return {
      id: 1,
      date,
      cashSales: 0,
      mpesaSales: 0,
      creditIssued: 0,
      notes: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      expenses: [],
      totalExpenses: 0,
      totalRevenue: 0,
      profit: 0,
    };
  }

  const expenses = await db.getAllAsync<DailyExpense>(
    `SELECT * FROM daily_expenses WHERE summaryId = ? ORDER BY id ASC`,
    [summary.id]
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = summary.cashSales + summary.mpesaSales + summary.creditIssued;
  const profit = totalRevenue - totalExpenses;

  return {
    ...summary,
    expenses,
    totalExpenses,
    totalRevenue,
    profit,
  };
}

/**
 * Fetches summaries and their expenses for a date range ("YYYY-MM-DD").
 */
export async function getSummariesForRange(
  db: SQLiteDatabase,
  fromDate: string,
  toDate: string
): Promise<DailySummaryWithExpenses[]> {
  const summaries = await db.getAllAsync<DailySummary>(
    `SELECT * FROM daily_summaries
     WHERE date BETWEEN ? AND ?
     ORDER BY date DESC`,
    [fromDate, toDate]
  );

  const results: DailySummaryWithExpenses[] = [];

  for (const summary of summaries) {
    const expenses = await db.getAllAsync<DailyExpense>(
      `SELECT * FROM daily_expenses WHERE summaryId = ? ORDER BY id ASC`,
      [summary.id]
    );

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalRevenue = summary.cashSales + summary.mpesaSales + summary.creditIssued;
    const profit = totalRevenue - totalExpenses;

    results.push({
      ...summary,
      expenses,
      totalExpenses,
      totalRevenue,
      profit,
    });
  }

  return results;
}

/**
 * Computes aggregated report totals across a date range.
 */
export async function getReportTotals(
  db: SQLiteDatabase,
  fromDate: string,
  toDate: string
): Promise<ReportTotals> {
  const salesRow = await db.getFirstAsync<{
    cash: number | null;
    mpesa: number | null;
    credit: number | null;
    days: number | null;
  }>(
    `SELECT
       COALESCE(SUM(cashSales), 0)    AS cash,
       COALESCE(SUM(mpesaSales), 0)   AS mpesa,
       COALESCE(SUM(creditIssued), 0) AS credit,
       COUNT(*)                       AS days
     FROM daily_summaries
     WHERE date BETWEEN ? AND ?`,
    [fromDate, toDate]
  );

  const totalCashSales = salesRow?.cash ?? 0;
  const totalMpesaSales = salesRow?.mpesa ?? 0;
  const totalCreditIssued = salesRow?.credit ?? 0;
  const dayCount = salesRow?.days ?? 0;
  const totalRevenue = totalCashSales + totalMpesaSales + totalCreditIssued;

  const expenseBreakdown: Record<ExpenseCategory, number> = {
    stock: 0,
    rent: 0,
    transport: 0,
    salary: 0,
    utilities: 0,
    other: 0,
    custom: 0,
  };

  const expenseRows = await db.getAllAsync<{ category: ExpenseCategory; total: number }>(
    `SELECT de.category, COALESCE(SUM(de.amount), 0) AS total
     FROM daily_expenses de
     JOIN daily_summaries ds ON ds.id = de.summaryId
     WHERE ds.date BETWEEN ? AND ?
     GROUP BY de.category`,
    [fromDate, toDate]
  );

  for (const row of expenseRows) {
    if (row.category in expenseBreakdown) {
      expenseBreakdown[row.category] = row.total;
    }
  }

  const totalExpenses = Object.values(expenseBreakdown).reduce((a, b) => a + b, 0);
  const profit = totalRevenue - totalExpenses;

  return {
    totalCashSales,
    totalMpesaSales,
    totalCreditIssued,
    totalRevenue,
    totalExpenses,
    profit,
    dayCount,
    expenseBreakdown,
  };
}
