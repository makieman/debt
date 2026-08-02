/**
 * src/repositories/dailySummary.test.ts
 *
 * Unit tests for the Daily Sales Ledger repository functions.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import {
  getTodayDateString,
  getOrCreateTodaySummary,
  getReportTotals,
  getCreditIssuedToday,
} from './dailySummary';

describe('dailySummary repository', () => {
  describe('getTodayDateString()', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns date in YYYY-MM-DD local format', () => {
      // Mock system time to 2026-07-15 23:00:00 local time
      const mockDate = new Date(2026, 6, 15, 23, 0, 0); // Month is 0-indexed (6 = July)
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const dateStr = getTodayDateString();
      expect(dateStr).toBe('2026-07-15');
    });

    it('handles midnight date transition correctly', () => {
      const mockDate = new Date(2026, 6, 16, 0, 0, 0);
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const dateStr = getTodayDateString();
      expect(dateStr).toBe('2026-07-16');
    });
  });

  describe('getOrCreateTodaySummary()', () => {
    it('returns existing summary if found in DB', async () => {
      const mockSummary = {
        id: 1,
        date: '2026-07-15',
        cashSales: 350000,
        mpesaSales: 120000,
        creditIssued: 50000,
        notes: 'Good day',
        createdAt: '2026-07-15T10:00:00.000Z',
        updatedAt: '2026-07-15T10:00:00.000Z',
      };

      const mockDb = {
        getFirstAsync: jest.fn().mockResolvedValueOnce(mockSummary),
      } as unknown as SQLiteDatabase;

      const summary = await getOrCreateTodaySummary(mockDb, '2026-07-15');

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM daily_summaries WHERE date = ?',
        ['2026-07-15']
      );
      expect(summary).toEqual(mockSummary);
    });

    it('creates new summary if not found in DB', async () => {
      const createdSummary = {
        id: 2,
        date: '2026-07-15',
        cashSales: 0,
        mpesaSales: 0,
        creditIssued: 25000,
        notes: null,
        createdAt: '2026-07-15T10:00:00.000Z',
        updatedAt: '2026-07-15T10:00:00.000Z',
      };

      const mockDb = {
        getFirstAsync: jest
          .fn()
          .mockResolvedValueOnce(null) // first lookup (not found)
          .mockResolvedValueOnce({ total: 25000 }) // getCreditIssuedToday sum
          .mockResolvedValueOnce(createdSummary), // lookup after insert
        runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 2, changes: 1 }),
      } as unknown as SQLiteDatabase;

      const summary = await getOrCreateTodaySummary(mockDb, '2026-07-15');

      expect(mockDb.runAsync).toHaveBeenCalled();
      expect(summary).toEqual(createdSummary);
    });
  });

  describe('getReportTotals()', () => {
    it('aggregates sales and expenses correctly', async () => {
      const mockSalesRow = {
        cash: 500000, // 5,000 KES
        mpesa: 200000, // 2,000 KES
        credit: 100000, // 1,000 KES
        days: 3,
      };

      const mockExpenseRows = [
        { category: 'stock', total: 300000 },
        { category: 'transport', total: 50000 },
      ];

      const mockDb = {
        getFirstAsync: jest.fn().mockResolvedValueOnce(mockSalesRow),
        getAllAsync: jest.fn().mockResolvedValueOnce(mockExpenseRows),
      } as unknown as SQLiteDatabase;

      const report = await getReportTotals(mockDb, '2026-07-01', '2026-07-31');

      expect(report.totalCashSales).toBe(500000);
      expect(report.totalMpesaSales).toBe(200000);
      expect(report.totalCreditIssued).toBe(100000);
      expect(report.totalRevenue).toBe(800000); // 8,000 KES
      expect(report.totalExpenses).toBe(350000); // 3,500 KES
      expect(report.profit).toBe(450000); // 4,500 KES
      expect(report.dayCount).toBe(3);
      expect(report.expenseBreakdown.stock).toBe(300000);
      expect(report.expenseBreakdown.transport).toBe(50000);
      expect(report.expenseBreakdown.rent).toBe(0);
    });
  });
});
