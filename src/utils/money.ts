/**
 * src/utils/money.ts
 *
 * All monetary arithmetic in Duka Deni happens in INTEGER CENTS.
 * This file provides the two conversion functions and the display formatter.
 *
 * WHY INTEGER CENTS?
 * JavaScript (and every language using IEEE 754 floating point) cannot
 * represent all decimal fractions exactly in binary:
 *
 *   console.log(0.1 + 0.2);  // → 0.30000000000000004  ← not 0.3!
 *
 * Over many transactions this error compounds. A customer who has paid in
 * full might show a balance of 0.00000000003 instead of 0, breaking your
 * "settled" check. Banks and financial systems always use integers for this
 * exact reason.
 *
 * THE CONVENTION:
 *   - 1 KES = 100 cents
 *   - KES 150    → stored as 15000 (integer)
 *   - KES 75.50  → stored as 7550  (integer)
 *   - KES 0.10   → stored as 10    (integer)
 *
 * RULE OF THUMB:
 *   Input from user (string) → toCents() → store in DB
 *   Read from DB (cents)     → toShillings() / formatKES() → display
 */

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Converts a shilling amount to integer cents for storage.
 *
 * We use Math.round() to handle the one edge case where floating point
 * bites us: when the USER has typed "75.50", parseFloat gives us exactly
 * 75.5 (safe). But multiplying 75.5 × 100 in IEEE 754 could give 7549.999...
 * Math.round fixes that rounding artifact.
 *
 * Example:
 *   toCents(150)    → 15000
 *   toCents(75.5)   → 7550
 *   toCents(0.1)    → 10   (not 9.999999...)
 */
export function toCents(shillings: number): number {
  return Math.round(shillings * 100);
}

/**
 * Converts integer cents from the database back to shillings for arithmetic.
 *
 * Use this only when you need a numeric shilling value for calculations
 * (rare). For display, use formatKES() directly.
 *
 * Example:
 *   toShillings(15000)  → 150
 *   toShillings(7550)   → 75.5
 */
export function toShillings(cents: number): number {
  return cents / 100;
}

// ─── Display Formatter ────────────────────────────────────────────────────────

/**
 * Formats a cent amount as a human-readable KES string.
 *
 * HOW toLocaleString WORKS:
 * JavaScript's built-in number formatter. We configure it with:
 *   - minimumFractionDigits: 2  → always show 2 decimal places
 *   - maximumFractionDigits: 2  → never show more than 2
 * This produces "1,500.00" with comma thousand separators automatically.
 *
 * We prepend "KES " manually (not a currency symbol like "Ksh") because
 * toLocaleString's currency formatting varies by device locale — we want
 * consistent output regardless of the phone's language setting.
 *
 * Examples:
 *   formatKES(15000)   → "KES 150.00"
 *   formatKES(150050)  → "KES 1,500.50"
 *   formatKES(0)       → "KES 0.00"
 *   formatKES(7550)    → "KES 75.50"
 *   formatKES(-10000)  → "KES -100.00"  (for overpayment display)
 */
export function formatKES(cents: number): string {
  const shillings = cents / 100;
  const formatted = shillings.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `KES ${formatted}`;
}
