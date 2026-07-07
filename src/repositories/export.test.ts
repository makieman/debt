/**
 * src/repositories/export.test.ts
 *
 * WHY WE TEST PURE FUNCTIONS FIRST:
 * getFullExportData requires a database — we'd need to set up tables, insert
 * fixtures, and tear them down. That's integration testing, slower and more
 * fragile. We test it separately via mock.
 *
 * csvEscape, slugify, generateCSV, generateFilename are PURE FUNCTIONS:
 *   - No I/O (no database, no network, no filesystem)
 *   - Same input always produces same output
 *   - Tests run in milliseconds, never flake
 *
 * WHY csvEscape TESTS MATTER SO MUCH:
 * CSV escaping bugs are SILENT. The file generates without error but opens
 * incorrectly in Excel. A shopkeeper who shares garbled records with their
 * accountant loses trust in the app permanently. These tests are the last
 * line of defence.
 *
 * WHY THE AMOUNT-IN-SHILLINGS TEST MATTERS:
 * Amounts are stored in cents. If we forget toShillings() and export 150000
 * instead of 1500.00, the accountant sees amounts inflated by 100x. This is
 * the most likely bug (easy to forget toCents/toShillings) and the most
 * damaging (financial records with wrong values).
 */

import {
  csvEscape,
  generateCSV,
  generateFilename,
  ExportData,
} from './export';
import { slugify } from '../utils/strings';
import { getLastExportLabel } from '../services/exportService';

// ─── csvEscape() ──────────────────────────────────────────────────────────────

describe('csvEscape()', () => {
  it('wraps a plain string in double quotes', () => {
    expect(csvEscape('hello')).toBe('"hello"');
  });

  it('preserves commas inside the quoted field (does not split)', () => {
    // If you forgot to quote, "Unga, Sukari" would split into two columns
    expect(csvEscape('Unga, Sukari')).toBe('"Unga, Sukari"');
  });

  it('escapes internal double quotes by doubling them (RFC 4180)', () => {
    // 'He said "yes"' → '"He said ""yes"""'
    // The outer " delimit the field; the inner "" = one literal "
    expect(csvEscape('He said "yes"')).toBe('"He said ""yes"""');
  });

  it('handles an empty string', () => {
    expect(csvEscape('')).toBe('""');
  });

  it('handles newlines inside the value (valid in quoted CSV)', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles multiple double quotes in a row', () => {
    // 'a"b"c' → each " becomes "" → '"a""b""c"'
    expect(csvEscape('a"b"c')).toBe('"a""b""c"');
    // 'say ""hello""' (4 "s) → each " becomes "" (8 "s) → wrap → '"say """"hello"""""'
    // Outer "   s  a  y  sp """" h  e  l  l  o  """"   outer "
    expect(csvEscape('say ""hello""')).toBe('"say """"hello"""""');
  });
});

// ─── slugify() ────────────────────────────────────────────────────────────────

describe('slugify()', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Duka ya Kamau')).toBe('duka-ya-kamau');
  });

  it('removes special characters', () => {
    expect(slugify('Shop 123!')).toBe('shop-123');
  });

  it('trims leading and trailing spaces', () => {
    expect(slugify('  spaces  ')).toBe('spaces');
  });

  it('returns "export" for an empty string', () => {
    expect(slugify('')).toBe('export');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(slugify('multiple   spaces')).toBe('multiple-spaces');
  });

  it('removes hyphens from start and end', () => {
    expect(slugify('-leading-trailing-')).toBe('leading-trailing');
  });

  it('handles strings that become empty after stripping', () => {
    expect(slugify('!@#$')).toBe('export');
  });
});

// ─── generateFilename() ───────────────────────────────────────────────────────

describe('generateFilename()', () => {
  it('returns a json filename with slugified shop name and today date', () => {
    const filename = generateFilename('json', 'Duka ya Kamau');
    expect(filename).toMatch(/^duka-deni-duka-ya-kamau-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('returns a csv filename with correct extension', () => {
    const filename = generateFilename('csv', 'Shop Owner');
    expect(filename).toMatch(/^duka-deni-shop-owner-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('handles special chars in shop name', () => {
    const filename = generateFilename('json', 'Kamau\'s Duka!');
    // apostrophe and ! are non-alphanumeric, get stripped
    expect(filename).toMatch(/^duka-deni-kamaus-duka-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

// ─── generateCSV() ────────────────────────────────────────────────────────────

describe('generateCSV()', () => {
  // Build a mock ExportData with 2 customers and 3 transactions
  const mockData: ExportData = {
    exportedAt: '2024-06-14T05:30:00.000Z', // UTC 05:30 = local 08:30 (UTC+3)
    appVersion: '1.0.0',
    shopProfile: {
      shopName: 'Duka ya Kamau',
      ownerName: 'Kamau Njoroge',
      currency: 'KES',
    },
    summary: {
      totalCustomers: 2,
      totalTransactions: 3,
      totalOutstandingCents: 235000, // KES 2350
    },
    customers: [
      {
        id: 1,
        name: 'Kamau Njoroge',
        phone: '0712 345 678',
        createdAt: '2024-06-01T00:00:00.000Z',
        balanceCents: 235000, // KES 2350
        transactions: [
          {
            id: 1,
            type: 'debt',
            amountCents: 150000, // KES 1500
            note: 'Unga 2kg, Sukari',
            createdAt: '2024-06-02T00:00:00.000Z',
          },
          {
            id: 2,
            type: 'payment',
            amountCents: 50000, // KES 500
            note: null,
            createdAt: '2024-06-03T00:00:00.000Z',
          },
        ],
      },
      {
        id: 2,
        name: 'Wanjiku Muthoni',
        phone: null,
        createdAt: '2024-06-01T00:00:00.000Z',
        balanceCents: 85000, // KES 850
        transactions: [
          {
            id: 3,
            type: 'debt',
            amountCents: 85000, // KES 850
            note: 'He said "hello"', // note with a double quote — tests escaping
            createdAt: '2024-06-04T00:00:00.000Z',
          },
        ],
      },
    ],
  };

  let csv: string;
  let lines: string[];

  beforeEach(() => {
    csv = generateCSV(mockData);
    lines = csv.split('\n');
  });

  it('starts with the Credi Export header', () => {
    expect(lines[0]).toBe('"Credi Export"');
  });

  it('includes the shop name in the summary header', () => {
    expect(csv).toContain('Duka ya Kamau');
  });

  it('includes a column header row with all expected columns', () => {
    const headerLine = lines.find((l) => l.includes('Customer Name'));
    expect(headerLine).toBeDefined();
    expect(headerLine).toContain('"Customer Name"');
    expect(headerLine).toContain('"Transaction Type"');
    expect(headerLine).toContain('"Amount (KES)"');
    expect(headerLine).toContain('"Date"');
  });

  it('includes both customer names', () => {
    expect(csv).toContain('Kamau Njoroge');
    expect(csv).toContain('Wanjiku Muthoni');
  });

  it('exports amounts in shillings (not cents)', () => {
    // 150000 cents → "1500.00" KES
    expect(csv).toContain('"1500.00"');
    // NOT the raw cent value
    expect(csv).not.toContain('"150000"');
  });

  it('exports KES 500 payment correctly', () => {
    expect(csv).toContain('"500.00"');
  });

  it('wraps notes containing commas in quotes (prevents column splitting)', () => {
    // "Unga 2kg, Sukari" must be wrapped so the comma doesn't split columns
    expect(csv).toContain('"Unga 2kg, Sukari"');
  });

  it('escapes double quotes in notes', () => {
    // 'He said "hello"' → '"He said ""hello"""'
    expect(csv).toContain('"He said ""hello"""');
  });

  it('handles null phone gracefully (empty quoted field)', () => {
    // Wanjiku has no phone — field should be ""
    const wanjikuLine = lines.find((l) => l.startsWith('"Wanjiku'));
    expect(wanjikuLine).toBeDefined();
    expect(wanjikuLine).toContain('""'); // empty phone field
  });

  it('outputs customers in alphabetical order (Kamau before Wanjiku)', () => {
    const kamauIdx = lines.findIndex((l) => l.startsWith('"Kamau'));
    const wanjikuIdx = lines.findIndex((l) => l.startsWith('"Wanjiku'));
    expect(kamauIdx).toBeLessThan(wanjikuIdx);
  });

  it('includes the total outstanding in shillings in the summary', () => {
    // 235000 cents = KES 2350.00
    expect(csv).toContain('2350.00');
  });
});

// ─── getLastExportLabel() ─────────────────────────────────────────────────────

describe('getLastExportLabel()', () => {
  // These tests run in UTC (set by jest.setup.js: process.env.TZ = 'UTC')

  it('returns "Never exported" when lastExportDate is null', () => {
    expect(getLastExportLabel(null, 'en')).toBe('Never exported');
  });

  it('returns Swahili equivalent when language is sw and date is null', () => {
    expect(getLastExportLabel(null, 'sw')).toBe('Haijawahi kuhamishwa');
  });

  it('contains "Today" for today\'s date (en)', () => {
    const now = new Date().toISOString();
    const label = getLastExportLabel(now, 'en');
    expect(label).toContain('Today');
  });

  it('contains "Leo" (Swahili for Today) for today\'s date (sw)', () => {
    const now = new Date().toISOString();
    const label = getLastExportLabel(now, 'sw');
    expect(label).toContain('Leo');
  });

  it('contains "Yesterday" for yesterday\'s date (en)', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const label = getLastExportLabel(yesterday.toISOString(), 'en');
    expect(label).toContain('Yesterday');
  });

  it('contains "Jana" (Swahili for Yesterday) for yesterday (sw)', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const label = getLastExportLabel(yesterday.toISOString(), 'sw');
    expect(label).toContain('Jana');
  });

  it('returns a date-like string for older dates', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const label = getLastExportLabel(tenDaysAgo.toISOString(), 'en');
    // Should not say Today or Yesterday
    expect(label).not.toContain('Today');
    expect(label).not.toContain('Yesterday');
    // Should contain AM or PM (time is always present)
    expect(label).toMatch(/AM|PM/);
  });
});
