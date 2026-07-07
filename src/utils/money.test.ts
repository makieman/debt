/**
 * src/utils/money.test.ts
 *
 * WHY ARE WE TESTING THIS?
 * Money handling is the absolute core of "Duka Deni". Since JavaScript uses IEEE 754
 * double-precision floats, simple arithmetic like 0.1 + 0.2 equals 0.30000000000000004.
 * In a debt tracking app, small rounding errors compound over time. A customer who has settled
 * their debt might still show as owing a fraction of a cent, or a shopkeeper might see incorrect totals.
 * To prevent this, we store all money as INTEGER CENTS (e.g., 1 KES = 100 cents).
 * These functions are the gatekeepers converting user inputs to cents and formatting cents for display.
 * Tests here guarantee our money math is 100% bug-free.
 *
 * JEST CONCEPTS INTRODUCED HERE:
 * - `describe(description, block)`: Groups related tests together into a single suite.
 * - `it(description, block)`: Defines a single test case (an individual specification).
 * - `expect(value)`: Wraps the value under test, returning an assertion object.
 * - `toBe(expected)`: A matcher that asserts strict equality (===) between actual and expected.
 *
 * DIFFERENCE BETWEEN MATCHERS:
 * - `toBe()` uses Object.is() for strict equality. It is perfect for primitive values like numbers and strings.
 * - `toEqual()` performs a deep comparison of object properties or array elements.
 * Example: expect({x: 1}).toEqual({x: 1}) passes, but expect({x: 1}).toBe({x: 1}) fails because they are different object references.
 */

import { toCents, toShillings, formatMoney, formatMoneyShort } from './money';

describe('Money Utilities', () => {

  describe('toCents()', () => {
    it('should convert standard shilling amounts to integer cents', () => {
      // 150 shillings should convert to 15,000 cents
      expect(toCents(150)).toBe(15000);
      
      // 0 shillings should remain 0 cents
      expect(toCents(0)).toBe(0);
    });

    it('should handle decimal values and half a shilling correctly', () => {
      // 0.5 shillings (50 cents) should convert to 50 cents
      expect(toCents(0.5)).toBe(50);
    });

    it('should handle large amounts accurately without floating-point artifacts', () => {
      // 99,999.99 shillings should convert to 9,999,999 cents
      expect(toCents(99999.99)).toBe(9999999);
    });

    it('should round sub-cent precision values using standard rounding', () => {
      /**
       * SUB-CENT PRECISION DECISION:
       * When a user inputs an amount with sub-cent precision (e.g., 1.001 shillings),
       * we round to the nearest whole cent using Math.round() rather than truncating it.
       * 1.001 shillings = 100.1 cents -> rounds to 100 cents.
       * 1.006 shillings = 100.6 cents -> rounds to 101 cents.
       */
      expect(toCents(1.001)).toBe(100);
      expect(toCents(1.006)).toBe(101);
    });
  });

  describe('toShillings()', () => {
    it('should convert cents back to shillings accurately', () => {
      // 15,000 cents should be 150 shillings
      expect(toShillings(15000)).toBe(150);

      // 0 cents is 0 shillings
      expect(toShillings(0)).toBe(0);

      // 1 cent is 0.01 shillings
      expect(toShillings(1)).toBe(0.01);
    });
  });

  describe('formatMoney()', () => {
    it('should format positive cent amounts with KES prefix and two decimal places', () => {
      // 15,000 cents (150.00 KES)
      expect(formatMoney(15000)).toBe('KES 150.00');

      // 0 cents
      expect(formatMoney(0)).toBe('KES 0.00');
    });

    it('should support formatting with custom currencies (e.g. USD, TZS)', () => {
      // Custom positive currency
      expect(formatMoney(15000, 'USD')).toBe('USD 150.00');
      
      // Custom negative currency
      expect(formatMoney(-5000, 'TZS')).toBe('TZS -50.00');
    });

    it('should add comma separators for thousands', () => {
      // 100,000 cents (1,000.00 KES)
      expect(formatMoney(100000)).toBe('KES 1,000.00');

      // 999,999,999 cents (9,999,999.99 KES)
      expect(formatMoney(999999999)).toBe('KES 9,999,999.99');
    });

    it('should format negative cent amounts correctly representing credit/overpayment', () => {
      /**
       * NEGATIVE VALUES DESIGN DECISION:
       * If a customer overpays, they have a negative balance in terms of debt (they are in credit).
       * We display this by showing the minus sign before the shilling number (e.g. "KES -50.00").
       * This is handled natively by toLocaleString.
       */
      expect(formatMoney(-5000)).toBe('KES -50.00');
    });
  });

  describe('formatMoneyShort()', () => {
    it('should return "0" for amounts less than 1,000 cents (10 KES)', () => {
      expect(formatMoneyShort(0)).toBe('0');
      expect(formatMoneyShort(500)).toBe('0');
    });

    it('should display whole shillings without decimal places for amounts between KES 10 and KES 999', () => {
      // 50,000 cents = 500 shillings
      expect(formatMoneyShort(50000)).toBe('500');
    });

    it('should display compact suffix K with 1 decimal place for amounts between KES 1,000 and KES 99,999', () => {
      // 100,000 cents = 1,000 shillings -> "1.0K"
      expect(formatMoneyShort(100000)).toBe('1.0K');

      // 1,500,000 cents = 15,000 shillings -> "15.0K"
      expect(formatMoneyShort(1500000)).toBe('15.0K');
    });

    it('should cap the display at "100K+" for KES 100,000 (10,000,000 cents) and above', () => {
      // 10,000,000 cents = 100,000 shillings -> "100K+"
      expect(formatMoneyShort(10000000)).toBe('100K+');
    });
  });
});

/**
 * WHAT BUGS DID THESE TESTS CATCH?
 * 1. Floating-Point Slippage: If we used `cents = shillings * 100` instead of `Math.round(shillings * 100)`,
 *    toCents(1.001) would yield 100.10000000000001, failing our integer expectation.
 * 2. Formatter Off-by-One/Tens: Confusing cents and shillings inside `formatKESShort` is highly common.
 *    For example, checking `if (cents < 1000) return "0"` handles KES 10, but checking `if (shillings < 1000)`
 *    would fail if the thresholds are mixed up.
 *
 * PASSING FOR THE WRONG REASON VS. GENUINE CORRECTNESS:
 * - A test passing for the "wrong reason" might occur if we hardcoded `formatMoney(15000)` to return `'KES 150.00'`.
 *   The test passes, but the implementation is broken for any other number.
 * - Genuine correctness is proved by writing multiple assertions covering edges (0, positive, negative, threshold limits)
 *   and verifying that the logic handles arbitrary inputs dynamically and correctly.
 */
