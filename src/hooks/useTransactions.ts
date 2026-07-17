/**
 * src/hooks/useTransactions.ts
 *
 * Custom hook that manages transaction data for a specific customer.
 *
 * WHAT IT DOES:
 * Fetches both the transaction list AND the balance for a customer in one
 * coordinated cycle. Exposes loading/error state and a refresh() function.
 *
 * WHY ONE CYCLE, NOT TWO useEffects?
 * If we fetched transactions and balance in separate useEffects, we'd create
 * a RACE CONDITION:
 *
 *   Effect 1 starts fetchTransactions() ...
 *   Effect 2 starts fetchBalance()      ...
 *   Balance resolves at t=80ms  → setBalance(150)
 *   Transactions resolves at t=100ms → setTransactions([...new data])
 *
 * During the 20ms gap, the screen shows the NEW balance but OLD transactions.
 * The data is briefly inconsistent. By using Promise.all, both fetches run
 * in parallel but we setstate ONCE when BOTH finish — the screen is always
 * consistent.
 *
 * WHAT IS Promise.all?
 * Promise.all([p1, p2]) takes an array of Promises and returns a new Promise
 * that resolves when ALL of them resolve. The result is an array of values
 * in the same order: [result1, result2].
 *
 *   const [transactions, balance] = await Promise.all([
 *     getTransactionsByCustomer(db, customerId),
 *     getBalanceForCustomer(db, customerId),
 *   ]);
 *
 * Both DB queries run in parallel (faster) and we get both results at once.
 */

import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import { getTransactionsByCustomer, getBalanceForCustomer } from '../repositories/transactions';
import { db } from '../db';

// ─── Return Type ─────────────────────────────────────────────────────────────

interface UseTransactionsResult {
  transactions: Transaction[];
  balance: number;
  loading: boolean;     // true only on the very first fetch
  refreshing: boolean;  // true during subsequent refreshes
  error: string | null;
  refresh: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTransactions(customerId: number): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<number>(0);     // cents
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── fetchAll ────────────────────────────────────────────────────────────────
  // useCallback with [customerId] dependency:
  // → If the same customer's screen is open, fetchAll has a STABLE reference
  //   (doesn't change between renders → useEffect doesn't loop).
  // → If customerId changes (different customer opened), a new fetchAll is
  //   created → useEffect re-runs → data refreshes for the new customer.
  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);

      // Promise.all: both queries run in parallel, we get both results at once.
      // This is faster than awaiting them sequentially AND prevents the
      // race condition described above.
      const [txns, bal] = await Promise.all([
        getTransactionsByCustomer(db, customerId),
        getBalanceForCustomer(db, customerId),
      ]);

      setTransactions(txns);
      setBalance(bal);

    } catch (err) {
      // We store error as a string (not Error object) because:
      // 1. Strings serialize safely for display in <Text> components
      // 2. Avoids passing Error objects through React state (can cause issues)
      // We never crash — we always set the error state and let the UI decide
      // what to show. A crashed hook means a blank screen with no explanation.
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useTransactions] Fetch failed:', message);
      setError(message);

    } finally {
      // finally ALWAYS runs, even if catch fired. This guarantees that
      // loading goes false whether the fetch succeeded or failed.
      // Without this, a failed fetch would leave the spinner spinning forever.
      setRefreshing(false);
      setInitialLoad(false);
    }
  }, [customerId]); // re-create fetchAll only when customerId changes

  // ── Effect: fetch on mount and when customerId changes ────────────────────
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    transactions,
    balance,
    loading: initialLoad,
    refreshing,
    error,
    refresh: fetchAll,
  };
}
