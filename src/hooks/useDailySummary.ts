/**
 * src/hooks/useDailySummary.ts
 *
 * Custom hook to load and manage daily sales summary + expenses state.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import {
  DailySummaryWithExpenses,
  NewDailySummary,
  NewDailyExpense,
} from '../types';
import {
  getTodayDateString,
  getOrCreateTodaySummary,
  getSummaryWithExpenses,
  upsertDailySummary,
  addExpense as addExpenseRepo,
  deleteExpense as deleteExpenseRepo,
} from '../repositories/dailySummary';

export function useDailySummary(targetDate?: string) {
  const dateStr = targetDate ?? getTodayDateString();

  const [summary, setSummary] = useState<DailySummaryWithExpenses | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await getOrCreateTodaySummary(db, dateStr);
      const data = await getSummaryWithExpenses(db, dateStr);
      setSummary(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useDailySummary] Failed to load daily summary:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSummary = useCallback(
    async (partialData: Partial<NewDailySummary>) => {
      if (!summary) return;
      try {
        const payload: NewDailySummary = {
          date: dateStr,
          cashSales: partialData.cashSales ?? summary.cashSales,
          mpesaSales: partialData.mpesaSales ?? summary.mpesaSales,
          creditIssued: partialData.creditIssued ?? summary.creditIssued,
          notes: partialData.notes !== undefined ? partialData.notes : (summary.notes ?? undefined),
        };
        await upsertDailySummary(db, payload);
        const updated = await getSummaryWithExpenses(db, dateStr);
        setSummary(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useDailySummary] Failed to save summary:', msg);
        setError(msg);
      }
    },
    [summary, dateStr]
  );

  const addExpense = useCallback(
    async (expense: Omit<NewDailyExpense, 'summaryId'>) => {
      if (!summary) return;
      try {
        await addExpenseRepo(db, {
          ...expense,
          summaryId: summary.id,
        });
        const updated = await getSummaryWithExpenses(db, dateStr);
        setSummary(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useDailySummary] Failed to add expense:', msg);
        setError(msg);
      }
    },
    [summary, dateStr]
  );

  const deleteExpense = useCallback(
    async (id: number) => {
      try {
        await deleteExpenseRepo(db, id);
        const updated = await getSummaryWithExpenses(db, dateStr);
        setSummary(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useDailySummary] Failed to delete expense:', msg);
        setError(msg);
      }
    },
    [dateStr]
  );

  return {
    summary,
    loading,
    error,
    saveSummary,
    addExpense,
    deleteExpense,
    refresh: loadData,
  };
}
