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
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCustomers(): UseCustomersResult {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ── fetchCustomers ──────────────────────────────────────────────────────────
  // useCallback memoises this function so it has a stable reference between
  // renders. If we defined it as a plain arrow function, it would be a new
  // function object on every render — that matters because we put it in the
  // useEffect dependency array below. A new function reference on every render
  // would cause the effect to re-run on every render → infinite loop.
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null); // clear any previous error before retrying
      // Fetch customers and dashboard totals in parallel for maximum efficiency
      const [rows, totals] = await Promise.all([
        getAllCustomersWithBalances(db),
        getDashboardTotals(db),
      ]);
      setCustomers(rows);
      setTotalOwed(totals.totalOutstanding);
      setTotalPaid(totals.totalCollected);
    } catch (err) {
      // Always store Error objects, never raw unknowns
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      // finally runs whether the try succeeded or the catch fired.
      // This guarantees loading goes false even if there's an error.
      setLoading(false);
    }
  }, []); // [] because getAllCustomersWithBalances, getDashboardTotals and db are module-level constants

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
    loading,
    error,
    refresh: fetchCustomers,
  };
}
