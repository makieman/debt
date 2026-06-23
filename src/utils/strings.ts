/**
 * src/utils/strings.ts
 *
 * String manipulation utilities for Duka Deni.
 *
 * ─── WHAT IS A REFACTOR? ─────────────────────────────────────────────────────
 * A refactor is a code change that improves structure WITHOUT changing behaviour.
 *
 * Before this refactor, `getInitials` lived inside CustomerCard.tsx as a local
 * function. That was fine when only one component needed it. But on Day 4,
 * TopDebtorRow also needs initials circles. We have two choices:
 *
 *   Option A — Copy the function into TopDebtorRow.tsx
 *     Pro: self-contained component.
 *     Con: two copies of the same logic. If we later want "MW" for "Mary Wanjiku"
 *          and change the algorithm, we must update both files. That's DRY violation.
 *
 *   Option B — Extract into a shared util (this file)
 *     Pro: one place to fix bugs, one place to test, one place to extend.
 *     Con: slight indirection — you have to know where to look.
 *
 * DRY = Don't Repeat Yourself. Extract shared logic when TWO OR MORE callers
 * need the same behaviour. Don't extract prematurely for hypothetical future use.
 * "Two is the magic number" is a good rule of thumb.
 *
 * The refactor steps we took:
 *   1. Created this file with getInitials (no behaviour change)
 *   2. Updated CustomerCard.tsx to import from here (no behaviour change)
 *   3. Used the same import in TopDebtorRow.tsx (new consumer)
 *
 * The app still works identically. But now we have one authoritative definition.
 */

/**
 * Derives up to two initials from a person's full name.
 *
 * Edge cases handled defensively so the UI never crashes:
 *   "Kamau Wanjiku"   → "KW"  (first letter of first two words)
 *   "Mumbua"          → "M"   (single word — only one initial)
 *   "  "              → "?"   (blank/whitespace — fallback character)
 *   ""                → "?"   (empty string — fallback character)
 *
 * ─── Common mistake ───────────────────────────────────────────────────────────
 * Developers often forget to trim() the name before splitting. A name like
 * "  Kamau Wanjiku" (leading spaces) would split into ["", "", "Kamau", ...]
 * and words[0][0] would be undefined, producing an empty string.
 * Always trim user-provided strings before processing them.
 *
 * @param name - The customer's full name as stored in the database
 * @returns    - 1 or 2 uppercase initials, or "?" if name is empty
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  // Split on any whitespace (handles double spaces, tabs, etc.)
  const words = trimmed.split(/\s+/);

  const first  = words[0]?.[0]?.toUpperCase() ?? '';
  const second = words[1]?.[0]?.toUpperCase() ?? '';

  // If somehow first is empty after trim (shouldn't happen), fall back to "?"
  return first + second || '?';
}
