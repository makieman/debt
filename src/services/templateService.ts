/**
 * src/services/templateService.ts
 *
 * Generates and shares a blank Excel import template.
 *
 * WHY A SEPARATE TEMPLATE FILE?
 *   New clients who have paper records or an Excel file they built themselves
 *   need a starting point that matches exactly what the importer expects.
 *   Rather than documenting the format in a README, we hand them a pre-built
 *   spreadsheet with correct column headers and two example rows — they just
 *   delete the examples and fill in their own data.
 *
 * TEMPLATE COLUMNS:
 *   A: Name              - Customer full name (required)
 *   B: Phone (optional)  - Phone number, any format
 *   C: Opening Balance (KES) - Amount they currently owe; recorded as a debt
 *
 * EXAMPLE ROWS:
 *   Two rows of realistic Kenyan data help the shopkeeper understand the format
 *   at a glance — names, phone formats, and decimal amounts.
 */

import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Generates a .xlsx template, writes it to the cache directory, and opens
 * the native share sheet so the user can save it to their phone or send it
 * to themselves on WhatsApp.
 *
 * @throws Error if the file cannot be written or shared.
 */
export async function downloadImportTemplate(): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Rows: header + 2 example rows
  const templateData: (string | number)[][] = [
    ['Name', 'Phone (optional)', 'Opening Balance (KES)'],
    ['Kamau Njoroge', '0712 345 678', 1500],
    ['Wanjiku Muthoni', '0723 456 789', 850],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateData);

  // Set column widths so the template looks presentable when opened in Excel
  ws['!cols'] = [
    { wch: 28 }, // Name
    { wch: 22 }, // Phone
    { wch: 26 }, // Opening Balance
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Customers');

  // Write as base64 so we can store with expo-file-system
  const xlsxData: string = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filePath = (FileSystem.cacheDirectory ?? '') + 'credi-import-template.xlsx';

  await FileSystem.writeAsStringAsync(filePath, xlsxData, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Sharing.shareAsync(filePath, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Save Credi Import Template',
    UTI: 'com.microsoft.excel.xlsx', // iOS
  });
}
