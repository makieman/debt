/**
 * src/services/exportService.ts
 *
 * REPOSITORY vs SERVICE — THE DIFFERENCE:
 *   Repository: reads/writes to ONE data source (the SQLite database).
 *               Returns model objects or formatted output.
 *               Does NOT know about the filesystem, networking, or UI.
 *
 *   Service: orchestrates MULTIPLE operations to achieve a higher-level goal.
 *            This service uses:
 *              - export.ts (repository) → reads all data from the database
 *              - expo-file-system       → writes the export to disk
 *              - expo-sharing           → opens the native share sheet
 *              - ShopProfile store      → reads shop name, saves lastExportDate
 *
 * WHY WRITE TO cacheDirectory, NOT documentDirectory?
 *
 *   FileSystem.documentDirectory:
 *     Persistent storage. Survives app updates. Cleared only on uninstall.
 *     Use this for data the user needs to access later: local databases,
 *     downloaded files the user explicitly saves.
 *
 *   FileSystem.cacheDirectory:
 *     Temporary storage. The OS may delete files here when storage is low.
 *     Use this for files you create, use once, then discard.
 *
 *   We write exports to cacheDirectory because:
 *     1. We create the file, open the share sheet, and the user saves it
 *        to their chosen destination (WhatsApp, Drive, phone storage).
 *     2. After sharing, we don't need the file anymore.
 *     3. Storing exports permanently in documentDirectory would waste space
 *        — every export creates a new file we never clean up.
 *
 * WHY NEVER THROW?
 *   This service is called from UI components. Components cannot catch thrown
 *   errors (there's no try/catch in JSX render). We return ExportResult objects
 *   instead — { success: false, error: "..." } — so the UI can display the
 *   error message in place, not crash.
 *
 * WHY UPDATE lastExportDate INSIDE THE SERVICE?
 *   The service owns the "export transaction" from start to finish. If the
 *   share sheet opens successfully, the export is done — update the record.
 *   If we updated lastExportDate before sharing (optimistically), we'd show
 *   "Last exported: Today" even if the user cancelled sharing. We update AFTER.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SQLiteDatabase } from 'expo-sqlite';

import {
  getFullExportData,
  generateCSV,
  generateFilename,
  ExportResult,
} from '../repositories/export';
import { loadShopProfile, saveShopProfile } from '../store/shopProfile';
import { formatTransactionDate } from '../utils/dates';
import { uploadBackupToDrive, makeDriveFilename } from './googleDriveService';

// ─── FUNCTION 1: exportAsJSON ─────────────────────────────────────────────────

/**
 * Exports all customer and transaction data as a structured JSON backup.
 *
 * JSON is the format for complete backups:
 *   - Nested structure preserves all relationships.
 *   - Can be parsed back into the app for a future "Restore from backup" feature.
 *   - Human-readable with pretty-printing (2-space indent).
 *
 * @param db - The open SQLite database instance
 * @returns  - ExportResult with success flag, filePath, and transaction count
 */
export async function exportAsJSON(db: SQLiteDatabase): Promise<ExportResult> {
  try {
    const profile = await loadShopProfile();

    const data = await getFullExportData(db, {
      shopName: profile.ownerName, // use ownerName as shop name until shopName field added
      ownerName: profile.ownerName,
      currency: profile.currency,
    });

    // JSON.stringify with 2-space indent makes the file readable when opened in
    // a text editor. Without indent, the entire file would be one long line.
    const jsonString = JSON.stringify(data, null, 2);

    const filename = generateFilename('json', profile.ownerName);
    const filePath = (FileSystem.cacheDirectory ?? '') + filename;

    await FileSystem.writeAsStringAsync(filePath, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // shareAsync opens the Android share sheet (or iOS share extension).
    // The share sheet shows all apps that can handle this file type:
    //   WhatsApp (sends as document), Gmail (attaches), Google Drive (uploads),
    //   Files app (saves to phone storage).
    // mimeType tells the OS what kind of file it is so it knows which apps to offer.
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Save Credi backup',
      UTI: 'public.json', // iOS: Uniform Type Identifier
    });

    // ── SILENT DRIVE BACKUP ────────────────────────────────────────────────
    // Attempt to upload the same file to Google Drive's hidden appDataFolder.
    // This runs AFTER sharing so it never delays or blocks the share sheet.
    // If Drive is not connected (no token), uploadBackupToDrive returns
    // immediately without error. Any failure is logged but does NOT affect
    // the export result — the user's local share always succeeds independently.
    let driveBackedUp = false;
    try {
      const driveResult = await uploadBackupToDrive(filePath, makeDriveFilename());
      driveBackedUp = driveResult.success;
    } catch (driveError) {
      console.error('[exportService] Silent Drive backup failed:', driveError);
    }

    // Only update lastExportDate AFTER sharing completes successfully.
    // If we updated before, we'd show "Last exported: Today" even if sharing was cancelled.
    const updatedProfile = { ...profile, lastExportDate: new Date().toISOString() };
    await saveShopProfile(updatedProfile);

    return {
      success: true,
      filePath,
      rowCount: data.summary.totalTransactions,
      driveBackedUp,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[exportService] exportAsJSON failed:', error);
    return { success: false, error };
  }
}

// ─── FUNCTION 2: exportAsCSV ─────────────────────────────────────────────────

/**
 * Exports all customer and transaction data as a flat CSV spreadsheet.
 *
 * CSV is the format for accountant-sharing and printing:
 *   - Opens directly in Excel and Google Sheets.
 *   - One row per transaction — flat structure the accountant can filter/sort.
 *   - Customer name repeated on every row (denormalized intentionally).
 *
 * @param db - The open SQLite database instance
 * @returns  - ExportResult with success flag, filePath, and transaction count
 */
export async function exportAsCSV(db: SQLiteDatabase): Promise<ExportResult> {
  try {
    const profile = await loadShopProfile();

    const data = await getFullExportData(db, {
      shopName: profile.ownerName,
      ownerName: profile.ownerName,
      currency: profile.currency,
    });

    const csvString = generateCSV(data);

    const filename = generateFilename('csv', profile.ownerName);
    const filePath = (FileSystem.cacheDirectory ?? '') + filename;

    await FileSystem.writeAsStringAsync(filePath, csvString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'Save to Excel or Google Sheets',
      UTI: 'public.comma-separated-values-text', // iOS UTI for CSV
    });

    const updatedProfile = { ...profile, lastExportDate: new Date().toISOString() };
    await saveShopProfile(updatedProfile);

    return {
      success: true,
      filePath,
      rowCount: data.summary.totalTransactions,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[exportService] exportAsCSV failed:', error);
    return { success: false, error };
  }
}

// ─── FUNCTION 3: getLastExportLabel ──────────────────────────────────────────

/**
 * Converts the ISO lastExportDate string into a human-readable label.
 *
 * WHY DOES THIS LIVE IN THE SERVICE, NOT THE SCREEN?
 * The screen's job is to display data, not to format it. Formatting logic
 * belongs in services and utils. If we need the same label in a widget or
 * notification someday, we just import this function — no duplication.
 *
 * Examples (en):
 *   null             → "Never exported"
 *   Today's date     → "Today, 8:30 AM"
 *   Yesterday's date → "Yesterday, 3:15 PM"
 *   Older            → "14 Jun, 10:00 AM"
 *
 * @param lastExportDate - ISO string from ShopProfile, or null
 * @param language       - 'en' or 'sw' (Swahili)
 * @returns              - Human-readable label string
 */
export function getLastExportLabel(
  lastExportDate: string | null,
  language: 'en' | 'sw' = 'en'
): string {
  if (!lastExportDate) {
    return language === 'sw' ? 'Haijawahi kuhamishwa' : 'Never exported';
  }

  const formatted = formatTransactionDate(lastExportDate);

  if (language === 'sw') {
    // Swahili translations for relative prefixes
    if (formatted.startsWith('Today')) {
      return formatted.replace('Today', 'Leo');
    }
    if (formatted.startsWith('Yesterday')) {
      return formatted.replace('Yesterday', 'Jana');
    }
  }

  return formatted;
}
