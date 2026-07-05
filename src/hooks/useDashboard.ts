/**
 * src/hooks/useDashboard.ts
 *
 * Custom hook that fetches all data needed by DashboardScreen.
 *
 * ─── CONCEPT: Promise.all vs sequential awaits ────────────────────────────────
 * Imagine fetching 5 pieces of data from SQLite:
 *
 * SEQUENTIAL (slow — each awaits the previous):
 *   const a = await queryA();   // starts at 0ms,  done at 10ms
 *   const b = await queryB();   // starts at 10ms, done at 20ms
 *   const c = await queryC();   // starts at 20ms, done at 30ms
 *   // Total: 30ms (sum of all)
 *
 * PARALLEL with Promise.all (fast — all start simultaneously):
 *   const [a, b, c] = await Promise.all([queryA(), queryB(), queryC()]);
 *   // All three start at 0ms, all finish around 10ms
 *   // Total: ~10ms (max of all, not sum)
 *
 * SQLite on a mobile device uses a single file with a sequential writer, but
 * it supports concurrent readers. Our 5 queries are all SELECTs — they can
 * safely run in parallel. Promise.all sends all 5 to the SQLite thread
 * simultaneously and resolves when the LAST one finishes.
 *
 * On a phone with slower flash storage, sequential queries for a dashboard
 * could take 50–200ms total. Promise.all cuts this to ~20–40ms (the slowest
 * single query). The user sees content faster.
 *
 * ─── RISK: What if one query fails in Promise.all? ────────────────────────────
 * Promise.all is "fail fast" — if ANY promise rejects, the entire Promise.all
 * immediately rejects and you lose the results of all other queries, even if
 * they succeeded.
 *
 * The alternative is Promise.allSettled:
 *   const results = await Promise.allSettled([queryA(), queryB(), queryC()]);
 *   // results[0] = { status: 'fulfilled', value: ... } or { status: 'rejected', reason: ... }
 *
 * Promise.allSettled always waits for ALL promises and gives you individual
 * success/failure per promise. Use it when:
 *   - Partial failure is acceptable (show what you have, gray out what failed)
 *   - You need to diagnose WHICH query failed specifically
 *
 * For our Dashboard, we use Promise.all because:
 *   - All 5 queries touch the same SQLite database. If one fails, they all
 *     likely fail (e.g. database locked). Partial data would be confusing.
 *   - We catch the whole error and show a single "Refresh" button.
 *   - The dashboard is all-or-nothing: partial stats are misleading.
 *
 * If we had network requests mixed with local queries (some slow, some fast),
 * Promise.allSettled would be the right choice to avoid blocking on failures.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import {
  getDashboardTotals,
  getTopDebtors,
  getRecentActivity,
  getCustomerCount,
  getDailyTotals,
} from '../repositories/transactions';
import { TopDebtor, ActivityItem, DailyTotal } from '../types';

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseDashboardResult {
  totalOutstanding: number;   // cents
  totalReceivables: number;   // cents
  totalCollected: number;     // cents
  topDebtors: TopDebtor[];
  recentActivity: ActivityItem[];
  customerCount: number;
  dailyTotals: DailyTotal[];  // 7 entries, including days with 0
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard(): UseDashboardResult {
  const [totalOutstanding, setTotalOutstanding] = useState<number>(0);
  const [totalReceivables, setTotalReceivables] = useState<number>(0);
  const [totalCollected, setTotalCollected] = useState<number>(0);
  const [topDebtors, setTopDebtors] = useState<TopDebtor[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── fetchAll ────────────────────────────────────────────────────────────────
  // Wrapped in useCallback so it has a stable reference — avoiding an infinite
  // loop in the useEffect that lists it as a dependency.
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // All 5 queries fire at the same time — Promise.all collects results
      // when the LAST one resolves. If any rejects, the catch fires.
      const [totals, debtors, activity, count, daily] = await Promise.all([
        getDashboardTotals(db),         // query 1: SUM receivables and payments
        getTopDebtors(db, 5),           // query 2: JOIN + GROUP BY + HAVING
        getRecentActivity(db, 10),      // query 3: JOIN + ORDER BY + LIMIT
        getCustomerCount(db),           // query 4: COUNT(*)
        getDailyTotals(db, 7),          // query 5: strftime + GROUP BY
      ]);

      setTotalReceivables(totals.totalReceivables);
      setTotalCollected(totals.totalCollected);
      setTotalOutstanding(totals.totalOutstanding);
      setTopDebtors(debtors);
      setRecentActivity(activity);
      setCustomerCount(count);
      setDailyTotals(daily);
    } catch (err) {
      // Capture whatever error string we can for display
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useDashboard] Error fetching dashboard data:', msg);
      setError(msg);
    } finally {
      // finally always runs — even if catch threw again.
      // This guarantees loading = false so the spinner doesn't spin forever.
      setLoading(false);
    }
  }, []); // no external deps — db and all repo functions are module-level constants

  // ── Initial fetch on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    totalOutstanding,
    totalReceivables,
    totalCollected,
    topDebtors,
    recentActivity,
    customerCount,
    dailyTotals,
    loading,
    error,
    refresh: fetchAll,
  };
}
