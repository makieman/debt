/**
 * src/hooks/useCustomers.test.ts
 *
 * WHY ARE WE TESTING THIS?
 * Hooks are the glue that connect our UI components to our data repositories.
 * The `useCustomers` hook manages loading state, error states, and holds the list of customers.
 * If this hook is broken:
 *   - The UI might show an infinite spinner (if `loading` stays true on error).
 *   - Errors from the database might be swallowed silently, confusing the user.
 *   - Refreshing the screen might fail to query the database.
 * We test the hook to prove that its state machine (loading -> success or loading -> error) is correct.
 *
 * REACT NATIVE TESTING LIBRARY - `renderHook`:
 * According to the "Rules of Hooks", hooks can only be called inside a functional React component.
 * If you call a hook in a standard test function, React will throw an error: "Invalid hook call."
 * `renderHook()` solves this by wrapping the hook under test in a dummy functional component,
 * executing it inside React's environment, and returning a `result` wrapper that exposes the hook's
 * current return value at `result.current`.
 *
 * NOTE FOR REACT 19 / RNTL v14:
 * In RNTL v14, `renderHook` returns a Promise resolving to the hook result object. Therefore,
 * we must use `await renderHook(...)` to access the result containing the hook's current state.
 *
 * MOCKING THE REPOSITORY VS THE DATABASE:
 * In hook tests, we mock the *repository* (`../repositories/transactions`), not the database.
 * Why?
 * We want to test the hook's logic *in isolation*. The hook does not know or care about SQLite;
 * it only cares about the promise returned by `getAllCustomersWithBalances()`.
 * By mocking the repository, we can force that function to resolve with success data or reject with errors,
 * letting us test all code branches of the hook easily.
 *
 * TYPESCRIPT CASTING FOR JEST MOCKS:
 * In TypeScript, imports are typed. When we do `jest.mock('../repositories/transactions')`,
 * Jest intercepts imports, but TypeScript still thinks they are normal functions.
 * Casting them:
 *   `const mockGetAll = getAllCustomersWithBalances as jest.Mock;`
 * tells the TS compiler: "Treat this function as a Jest Mock so I can call `.mockResolvedValue` on it."
 *
 * TESTING BEHAVIOR VS IMPLEMENTATION DETAILS:
 * - Implementation testing asserts *how* the hook does its job (e.g., "assert `useState` was called with false").
 *   This is fragile. If you refactor to use `useReducer`, all tests break even if the hook behaves identically.
 * - Behavior testing asserts *what* the hook does from the outside (e.g., "loading becomes false, error is set").
 *   This is resilient and is the recommended way to write tests.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useCustomers } from './useCustomers';
import { getAllCustomersWithBalances, getDashboardTotals } from '../repositories/transactions';

// Mock the entire transactions repository module
jest.mock('../repositories/transactions');

// Cast the repository functions to Jest Mock types for TypeScript compile safety
const mockGetAllCustomersWithBalances = getAllCustomersWithBalances as jest.Mock;
const mockGetDashboardTotals = getDashboardTotals as jest.Mock;

describe('useCustomers Hook', () => {
  const dummyCustomers = [
    { id: 1, name: 'Kamau Wanjiku', phone: '0712345678', createdAt: '2026-06-21', balance: 15000 },
    { id: 2, name: 'John Doe', phone: undefined, createdAt: '2026-06-22', balance: 0 },
  ];

  beforeEach(() => {
    // Clear mock records between tests to prevent call counts bleeding into other tests
    jest.clearAllMocks();

    // Default mock implementation for getDashboardTotals so it doesn't return undefined
    mockGetDashboardTotals.mockResolvedValue({
      totalOutstanding: 15000,
      totalCollected: 5000,
      totalReceivables: 20000,
    });
  });

  it('should return initial loading state and then populate customers on success', async () => {
    // 1. Setup mock to resolve with our dummy data
    let resolvePromise!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockGetAllCustomersWithBalances.mockReturnValue(pendingPromise);

    // 2. Render the hook and await the promise resolution from RNTL
    const { result } = await renderHook(() => useCustomers());

    // 3. Assert initial loading state is TRUE and customers are empty
    expect(result.current.loading).toBe(true);
    expect(result.current.customers).toEqual([]);
    expect(result.current.error).toBeNull();

    // 4. Resolve the mock database promise
    await act(async () => {
      resolvePromise(dummyCustomers);
    });

    // 5. Assert that loading is FALSE and customers are populated
    expect(result.current.loading).toBe(false);
    expect(result.current.customers).toEqual(dummyCustomers);
    expect(result.current.error).toBeNull();
  });

  it('should return empty customers array when the database is empty', async () => {
    mockGetAllCustomersWithBalances.mockResolvedValue([]);

    const { result } = await renderHook(() => useCustomers());

    expect(result.current.loading).toBe(false);
    expect(result.current.customers).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully when database fetch fails', async () => {
    const mockError = new Error('Database connection failed');
    mockGetAllCustomersWithBalances.mockRejectedValue(mockError);

    const { result } = await renderHook(() => useCustomers());

    // Assert loading is false, customers is empty, and error is set
    expect(result.current.loading).toBe(false);
    expect(result.current.customers).toEqual([]);
    expect(result.current.error).toBe(mockError);
  });

  it('should trigger a re-fetch and call the repository twice when refresh is called', async () => {
    // First call for initial mount fetches empty array
    mockGetAllCustomersWithBalances.mockResolvedValue([]);

    const { result } = await renderHook(() => useCustomers());

    expect(mockGetAllCustomersWithBalances).toHaveBeenCalledTimes(1);

    // Now configure repository to return dummy data on next fetch
    mockGetAllCustomersWithBalances.mockResolvedValue(dummyCustomers);

    // Call refresh() inside act() because it updates hook state
    await act(async () => {
      result.current.refresh();
    });

    // Verify it was queried again
    expect(mockGetAllCustomersWithBalances).toHaveBeenCalledTimes(2);
    expect(result.current.customers).toEqual(dummyCustomers);
  });
});

/**
 * WHAT BUGS DID THESE TESTS CATCH?
 * 1. Infinite Loading Spinners: If the repository rejected a promise and we didn't have a `finally` block
 *    setting `setLoading(false)`, loading would remain `true` forever.
 * 2. Stale closures in useEffect: If `fetchCustomers` did not use `useCallback` or did not update references,
 *    `refresh()` might execute an old reference, query with obsolete parameters, or trigger an infinite loop.
 *
 * PASSING FOR THE WRONG REASON VS. GENUINE CORRECTNESS:
 * - A test passing for the wrong reason might happen if `refresh()` just returned a static mocked response
 *   without calling the actual repository function.
 * - Genuine correctness is proved by checking that `mockGetAllCustomersWithBalances` is invoked the exact
 *   number of times expected and returns dynamic data mock values.
 */
