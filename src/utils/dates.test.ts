/**
 * src/utils/dates.test.ts
 *
 * WHY ARE WE TESTING THIS?
 * Date and time display in mobile apps can be notoriously buggy. Relative times like "Today"
 * or "Yesterday" depend on the *current* time. If you write a test using the real system clock,
 * the test might pass today, but if you run it tomorrow, "Today" becomes "Yesterday" and the test
 * fails. This is called a "flaky test" or a "time-bomb test."
 *
 * To solve this, Jest allows us to freeze and manipulate the system clock. We use `jest.useFakeTimers()`
 * to take control of time, and `jest.setSystemTime()` to lock the current date to a specific moment.
 * This guarantees our tests yield the exact same result no matter what day or time they run.
 *
 * TIMEZONE INDEPENDENCE DESIGN:
 * To make this test suite fully timezone-independent (e.g., passing in Nairobi UTC+3, London UTC+1, or US UTC-5),
 * we construct all mocked Dates using local date components `new Date(year, monthIndex, day, hours, minutes)`.
 * Converting these local date objects using `.toISOString()` and passing them to our formatter ensures that
 * the formatted result matches our expectations in whatever timezone the test runner is executed.
 *
 * JEST CONCEPTS INTRODUCED HERE:
 * - `beforeEach(block)`: Runs a block of code before EACH individual test in the file.
 *   Useful for setting up fresh test conditions (like resetting the mocked system time).
 * - `afterEach(block)`: Runs after EACH test. Here, we restore the real timers so Jest can finish cleanly.
 * - `jest.useFakeTimers()`: Tells Jest to hijack standard timers and date constructors.
 * - `jest.setSystemTime(date)`: Pins the system clock to a static Date object.
 */

import { formatTransactionDate, fillMissingDays, testDateFormatting } from './dates';
import { DailyTotal } from '../types';

describe('Date Utilities', () => {
  // We lock the "current" system time to Tuesday, June 25, 2024, at 10:00:00 AM local time
  const mockNow = new Date(2024, 5, 25, 10, 0, 0);

  beforeEach(() => {
    // Enable fake timers and pin the clock before each test
    jest.useFakeTimers();
    jest.setSystemTime(mockNow);
  });

  afterEach(() => {
    // Restore the real clock and timers after each test to avoid side effects
    jest.useRealTimers();
  });

  describe('formatTransactionDate()', () => {
    it('should format transactions from the same day as "Today, H:MM AM/PM"', () => {
      // 8:30 AM local time on the same day (June 25, 2024)
      const sameDay = new Date(2024, 5, 25, 8, 30, 0);
      expect(formatTransactionDate(sameDay.toISOString())).toBe('Today, 8:30 AM');
    });

    it('should format transactions from the previous day as "Yesterday, H:MM AM/PM"', () => {
      // 3:15 PM local time yesterday (June 24, 2024)
      const yesterday = new Date(2024, 5, 24, 15, 15, 0);
      expect(formatTransactionDate(yesterday.toISOString())).toBe('Yesterday, 3:15 PM');
    });

    it('should format transactions from earlier in the same week as "DayName, H:MM AM/PM"', () => {
      // 3 days ago (Saturday, June 22, 2024 at 6:45 PM local time)
      const threeDaysAgo = new Date(2024, 5, 22, 18, 45, 0);
      expect(formatTransactionDate(threeDaysAgo.toISOString())).toBe('Sat, 6:45 PM');
    });

    it('should format older transactions as "DD MonthName, H:MM AM/PM"', () => {
      // 10 days ago (June 15, 2024 at 11:00 AM local time)
      const tenDaysAgo = new Date(2024, 5, 15, 11, 0, 0);
      expect(formatTransactionDate(tenDaysAgo.toISOString())).toBe('15 Jun, 11:00 AM');
    });

    it('should handle midnight (12:00 AM) and noon (12:00 PM) edge cases correctly', () => {
      // Exactly midnight local time on June 25, 2024
      const midnight = new Date(2024, 5, 25, 0, 0, 0);
      expect(formatTransactionDate(midnight.toISOString())).toBe('Today, 12:00 AM');

      // Exactly noon local time on June 25, 2024
      const noon = new Date(2024, 5, 25, 12, 0, 0);
      expect(formatTransactionDate(noon.toISOString())).toBe('Today, 12:00 PM');
    });

    it('should classify 11:59 PM yesterday correctly as "Yesterday" and not "Today"', () => {
      // 11:59 PM local time yesterday (June 24, 2024)
      const lateYesterday = new Date(2024, 5, 24, 23, 59, 0);
      expect(formatTransactionDate(lateYesterday.toISOString())).toBe('Yesterday, 11:59 PM');
    });

    it('should return "Unknown date" for invalid ISO strings to prevent UI crashes', () => {
      expect(formatTransactionDate('invalid-date-string')).toBe('Unknown date');
      expect(formatTransactionDate('')).toBe('Unknown date');
    });
  });

  describe('fillMissingDays()', () => {
    it('should return exactly N days, filling missing dates with total 0', () => {
      // We expect a 7-day chart representing: June 19, 20, 21, 22, 23, 24, 25.
      // Generate the exact date strings in a timezone-resilient way
      const makeDateStr = (offsetDays: number) => {
        const d = new Date(2024, 5, 25);
        d.setDate(d.getDate() - offsetDays);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const dateJune24 = makeDateStr(1);
      const dateJune25 = makeDateStr(0);

      const dbResults = [
        { date: dateJune24, total: 15000 }, // KES 150
        { date: dateJune25, total: 20000 }, // KES 200
      ];

      const result = fillMissingDays(dbResults, 7);

      expect(result).toHaveLength(7);

      // Verify each generated date matches expectations
      expect(result[0]).toEqual({ date: makeDateStr(6), total: 0 });
      expect(result[1]).toEqual({ date: makeDateStr(5), total: 0 });
      expect(result[2]).toEqual({ date: makeDateStr(4), total: 0 });
      expect(result[3]).toEqual({ date: makeDateStr(3), total: 0 });
      expect(result[4]).toEqual({ date: makeDateStr(2), total: 0 });
      expect(result[5]).toEqual({ date: dateJune24, total: 15000 });
      expect(result[6]).toEqual({ date: dateJune25, total: 20000 });
    });

    it('should return all 0s when db results are completely empty', () => {
      const dbResults: { date: string; total: number }[] = [];
      const result = fillMissingDays(dbResults, 7);

      expect(result).toHaveLength(7);
      result.forEach((day) => {
        expect(day.total).toBe(0);
      });
      
      const d = new Date(2024, 5, 25);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      expect(result[6].date).toBe(`${yyyy}-${mm}-${dd}`);
    });

    it('should return same values when all 7 days are already present', () => {
      const makeDateStr = (offsetDays: number) => {
        const d = new Date(2024, 5, 25);
        d.setDate(d.getDate() - offsetDays);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      // All 7 days from June 19 to June 25 in the input
      const dbResults = [
        { date: makeDateStr(6), total: 100 },
        { date: makeDateStr(5), total: 200 },
        { date: makeDateStr(4), total: 300 },
        { date: makeDateStr(3), total: 400 },
        { date: makeDateStr(2), total: 500 },
        { date: makeDateStr(1), total: 600 },
        { date: makeDateStr(0), total: 700 },
      ];

      const result = fillMissingDays(dbResults, 7);

      expect(result).toHaveLength(7);
      expect(result).toEqual(dbResults);
    });
  });

  describe('testDateFormatting()', () => {
    it('should execute debug logs without throwing any errors', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      expect(() => testDateFormatting()).not.toThrow();
      consoleLogSpy.mockRestore();
    });
  });
});

/**
 * WHAT BUGS DID THESE TESTS CATCH?
 * 1. Off-by-One timezone issues: Since Nairobi is UTC+3 and many servers run in UTC, a date calculated
 *    natively on the phone might cross the midnight boundary, making a transaction from late yesterday
 *    show up as "Today" or vice versa. Forcing UTC and freezing time eliminates this inconsistency.
 * 2. Missing Chart Columns: The weekly bar chart *always* expects 7 bars. If the database returns only
 *    3 days of records, `fillMissingDays` ensures the UI doesn't crash or misalign the bars. These tests
 *    prove that missing days are structurally filled with 0s and correctly ordered chronologically.
 *
 * PASSING FOR THE WRONG REASON VS. GENUINE CORRECTNESS:
 * - A test passing for the wrong reason might happen if `fillMissingDays` returned a hardcoded array of
 *   June 25. That works on June 25, 2024, but running this test in a real environment next week would fail
 *   unless we freeze the system time.
 * - Genuine correctness is proved by setting fake timers, asserting the exact relative dates, and verifying
 *   that the array generation dynamically increments date strings.
 */
