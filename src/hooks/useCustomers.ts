/**
 * src/hooks/useCustomers.ts
 *
 * A custom hook that manages the customer list state.
 *
 * ─── DAY 4 UPDATE: N+1 FIX ────────────────────────────────────────────────────
 * Before this change, useCustomers called getAllCustomers() (1 query) and then
 * CustomerListScreen ran N additional getBalanceForCustomer() calls — one per
 * customer. With 20 customers that's 21 SQL queries every time the screen loads.
 *
 * Now we call getAllCustomersWithBalances() — a single JOIN + GROUP BY query
 * that returns customers AND their balances in one round-trip.
 *   20 customers → before: 21 queries → after: 1 query
 *
 * The CustomerListScreen no longer needs its own balance-fetching useEffect.
 * The CustomerCard receives `balance` from the hook result directly.
 *
 * WHAT IS A CUSTOM HOOK?
 * It's just a regular function whose name starts with "use". By convention,
 * React will enforce the Rules of Hooks inside it (no conditional hook calls,
 * etc.). This lets you compose React primitives (useState, useEffect) into
 * reusable, named units of logic.
 *
 * WHY NOT JUST PUT THIS IN THE COMPONENT?
 * If you put the fetch logic directly in CustomerListScreen, you'd have to
 * copy-paste it into any other screen that needs customer data. With a hook,
 * any component can say `const { customers } = useCustomers()` and get
 * the same behaviour, same error handling, same loading state — for free.
 *
 * RETURNED SHAPE:
 *   customers  — array of CustomerWithBalance (customer + balance in cents)
 *   loading    — true only during the first fetch; false once we have data
 *   error      — the Error object if something went wrong, null otherwise
 *   refresh    — call this to re-run the fetch (e.g. after adding a customer)
 */

import { useState, useEffect, useCallback } from 'react';
import { CustomerWithBalance } from '../types';
import { getAllCustomersWithBalances, getDashboardTotals } from '../repositories/transactions';
import { db } from '../db';

// ─── Return Type ────────────────────────────────────────────────────────────

interface UseCustomersResult {
  customers: CustomerWithBalance[];
  totalOwed: number;
  totalPaid: number;
  loading: boolean;     // true only on the very first fetch (no data yet)
  refreshing: boolean;  // true on subsequent background refreshes
  error: Error | null;
  refresh: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCustomers(): UseCustomersResult {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  // `initialLoad` is true only until the very first fetch finishes.
  // `refreshing` is true during any subsequent refresh — it does NOT
  // clear the existing list from the screen, preventing the glitch/flash.
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const [rows, totals] = await Promise.all([
        getAllCustomersWithBalances(db),
        getDashboardTotals(db),
      ]);
      setCustomers(rows);
      setTotalOwed(totals.totalOutstanding);
      setTotalPaid(totals.totalCollected);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setRefreshing(false);
      setInitialLoad(false); // first fetch is done — never show full-screen spinner again
    }
  }, []);

  // ── Effect: fetch on mount ──────────────────────────────────────────────────
  // This runs once when the hook is first used by a component.
  // Dependency array: [fetchCustomers] — if fetchCustomers changes identity,
  // we re-run. It won't, because we wrapped it in useCallback above.
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── Return ──────────────────────────────────────────────────────────────────
  // Exposing `refresh` as an alias for `fetchCustomers` so callers
  // don't need to know our internal function name.
  return {
    customers,
    totalOwed,
    totalPaid,
    loading: initialLoad,   // only true before the first data arrives
    refreshing,             // true during background refreshes
    error,
    refresh: fetchCustomers,
  };
}
