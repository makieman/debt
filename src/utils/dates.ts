/**
 * src/utils/dates.ts
 *
 * All date display formatting for Duka Deni.
 *
 * GOLDEN RULE OF DATES IN MOBILE APPS:
 *   - STORE: UTC (always). `new Date().toISOString()` produces UTC.
 *   - DISPLAY: Local time (always). JavaScript Date methods convert automatically.
 *
 * WHY UTC IN THE DATABASE?
 * Kenya is UTC+3 (East Africa Time). If we stored "2026-06-21T21:00:00" (local)
 * and the user changed their phone timezone, every stored timestamp would be
 * misread. UTC is timezone-agnostic — it's the same instant in time everywhere.
 * We only convert to local time at the last possible moment: when rendering text.
 *
 * HOW JavaScript HANDLES THIS:
 *   const d = new Date("2026-06-21T18:00:00.000Z"); // UTC 18:00
 *   d.getHours();       // → 21 on a phone in Nairobi (UTC+3) ✅
 *   d.toISOString();    // → "2026-06-21T18:00:00.000Z" (UTC, for DB storage)
 *
 * WHY FORMAT AT THE DISPLAY LAYER?
 * We never want half-formatted dates trickling through the app. By formatting
 * only here — in the component that renders text — we can change the entire
 * app's date style in one place. If tomorrow we want "21/06" instead of "21 Jun",
 * we change one function, not thirty components.
 */

import { DailyTotal } from '../types';

// ─── Helper: zero-pad hours/minutes ──────────────────────────────────────────

/**
 * Formats hours + minutes into a 12-hour clock string with AM/PM.
 * JavaScript's Date gives us 24-hour hours (0–23). We convert:
 *   0  → 12 AM (midnight)
 *   13 → 1 PM
 *   23 → 11 PM
 */
function formatTime(date: Date): string {
  let hours = date.getHours();       // 0–23 in local time
  const minutes = date.getMinutes(); // 0–59
  const ampm = hours >= 12 ? 'PM' : 'AM';

  // Convert 24h to 12h:  0→12, 13→1, 23→11
  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;  // 0 → 12 (midnight/noon)

  // Pad minutes: 9 → "09", 30 → "30"
  const paddedMin = minutes.toString().padStart(2, '0');

  return `${hours}:${paddedMin} ${ampm}`;
}

// ─── Day comparison helpers ───────────────────────────────────────────────────

/**
 * Returns a "day key" string for a date: just year-month-day.
 * Used to compare whether two Dates fall on the same calendar day,
 * regardless of time.
 *
 * Example: "2026-06-21" — same for 9:00 AM and 11:59 PM on June 21.
 */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Month abbreviations (we build this manually to avoid locale inconsistencies
// across different Android/iOS versions)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Main formatter ───────────────────────────────────────────────────────────

/**
 * Converts an ISO 8601 UTC string to a human-readable relative date string.
 *
 * Rules (evaluated in order):
 *   Today     → "Today, 2:30 PM"
 *   Yesterday → "Yesterday, 9:15 AM"
 *   This week → "Mon, 3:45 PM"     (within the last 7 days)
 *   Older     → "14 Jun, 10:00 AM"
 *
 * NEVER returns a raw ISO string. The user should never see "2026-06-21T...".
 *
 * @param isoString - A UTC ISO string, e.g. "2026-06-21T18:30:00.000Z"
 * @returns A human-readable string in local time
 */
export function formatTransactionDate(isoString: string): string {
  // Parse the ISO string. JavaScript's Date constructor always interprets
  // ISO strings ending in "Z" as UTC, then converts to local time for
  // methods like getHours(), getDate(), etc.
  const date = new Date(isoString);

  // Guard: if the date is invalid (e.g. empty string passed), return fallback
  if (isNaN(date.getTime())) {
    return 'Unknown date';
  }

  const now = new Date();
  const time = formatTime(date);

  // Compare calendar days (not timestamps) so "today" means same calendar
  // date, not "within the last 24 hours"
  if (dayKey(date) === dayKey(now)) {
    return `Today, ${time}`;
  }

  // "Yesterday" = the calendar day immediately before today
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) {
    return `Yesterday, ${time}`;
  }

  // "This week" = within the last 7 days (but not today or yesterday)
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  if (date > sevenDaysAgo) {
    const dayName = DAYS[date.getDay()]; // 0=Sun, 1=Mon...
    return `${dayName}, ${time}`;
  }

  // Older than 7 days: show the full date
  const day = date.getDate();                  // 1–31
  const month = MONTHS[date.getMonth()];       // "Jan"–"Dec"
  return `${day} ${month}, ${time}`;
}
/**
 * Fills gaps in a daily totals array so every day has an entry.
 *
 * The SQL query only returns days that have data. If no debt was recorded
 * on Wednesday, Wednesday is absent from the results. A bar chart needs
 * exactly `days` data points to render a bar for every day.
 *
 * Algorithm:
 *   1. Build a Map of { "YYYY-MM-DD" → total } from the DB results.
 *   2. Generate all `days` dates counting back from today.
 *   3. For each generated date: use the DB value or fall back to 0.
 *
 * @param dbResults - Rows returned by the SQL query
 * @param days      - Total number of days to generate (including today)
 */
export function fillMissingDays(
  dbResults: { date: string; total: number }[],
  days: number
): DailyTotal[] {
  // Step 1: index DB results by date string for O(1) lookup
  const byDate = new Map<string, number>();
  for (const row of dbResults) {
    byDate.set(row.date, row.total);
  }

  // Step 2: generate all `days` date keys
  const result: DailyTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    // Format as "YYYY-MM-DD" (same format strftime produces)
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const key  = `${yyyy}-${mm}-${dd}`;

    result.push({ date: key, total: byDate.get(key) ?? 0 });
  }

  return result;
}

// ─── Inline test (remove after verification) ─────────────────────────────────
// To run: temporarily import and call testDateFormatting() in App.tsx.
// Expected output (run on 2026-06-21, Nairobi time):
//   "Today, ..."
//   "Yesterday, ..."
//   "Wed, ..." or similar weekday
//   "14 Jun, ..."

export function testDateFormatting(): void {
  const now = new Date();

  // Test 1: Today
  const todayISO = now.toISOString();
  console.log('[date test] Today ->', formatTransactionDate(todayISO));
  // Expected: "Today, H:MM AM/PM"

  // Test 2: Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  console.log('[date test] Yesterday ->', formatTransactionDate(yesterday.toISOString()));
  // Expected: "Yesterday, H:MM AM/PM"

  // Test 3: 4 days ago (this week)
  const fourDaysAgo = new Date(now);
  fourDaysAgo.setDate(now.getDate() - 4);
  console.log('[date test] 4 days ago ->', formatTransactionDate(fourDaysAgo.toISOString()));
  // Expected: "Mon/Tue/... , H:MM AM/PM"

  // Test 4: 30 days ago (older)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  console.log('[date test] 30 days ago ->', formatTransactionDate(thirtyDaysAgo.toISOString()));
  // Expected: "22 May, H:MM AM/PM" (approx)
}
