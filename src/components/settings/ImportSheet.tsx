/**
 * src/components/settings/ImportSheet.tsx
 *
 * A bottom-sheet that guides the user through importing data from
 * an Excel or CSV file.
 *
 * STATE MACHINE:
 *   idle       -> user sees two option cards: "Pick File" and "Download Template"
 *   picking    -> file picker is open (or file is being parsed)
 *   previewing -> parsed data shown; user must confirm before writing to DB
 *   importing  -> data is being written to the DB (spinner)
 *   success    -> import complete; shows counts
 *   error      -> parse or write error; shows message
 *
 * WHY A TWO-STEP CONFIRM FLOW?
 *   Writing to the database is irreversible. Showing a preview (N customers,
 *   M transactions, K existing customers matched) lets the user verify the
 *   file is correct before committing. This is the same pattern as the
 *   ClearDataSheet which requires typing "DELETE" before clearing.
 *
 * WHY NO UNDO?
 *   SQLite doesn't support undo. We mitigate this by:
 *     1. Showing a clear preview before confirming.
 *     2. Never deleting existing data — we only ADD transactions to existing
 *        customers, never overwrite them.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';

import { useThemeContext } from '../../theme';
import { useLanguage } from '../../store/LanguageContext';
import {
  pickImportFile,
  parseImportFile,
  buildPreview,
  executeImport,
  ImportPreview,
  ImportPayload,
} from '../../services/importService';
import { downloadImportTemplate } from '../../services/templateService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful import so parent can refresh data. */
  onImportComplete: () => void;
  db: SQLiteDatabase;
}

type SheetState =
  | 'idle'
  | 'picking'       // file picker open / file being parsed
  | 'previewing'    // parsed; waiting for user to confirm
  | 'importing'     // writing to DB
  | 'success'
  | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportSheet({ visible, onClose, onImportComplete, db }: Props) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();

  const [state, setState]     = useState<SheetState>('idle');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Import result numbers (for success screen)
  const [result, setResult] = useState({ added: 0, matched: 0, transactions: 0, skipped: 0 });

  // Template download state
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // ---------------------------------------------------------------------------
  // Reset when sheet closes
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    setState('idle');
    setPreview(null);
    setPayload(null);
    setErrorMsg(null);
    onClose();
  }, [onClose]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePickFile = useCallback(async () => {
    setState('picking');
    setErrorMsg(null);

    try {
      const picked = await pickImportFile();
      if (!picked) {
        // User cancelled the picker
        setState('idle');
        return;
      }

      const parsedPayload = await parseImportFile(picked.uri, picked.name);
      const importPreview = await buildPreview(db, parsedPayload, picked.name);

      setPayload(parsedPayload);
      setPreview(importPreview);
      setState('previewing');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ImportSheet] parse error:', msg);
      setErrorMsg(msg);
      setState('error');
    }
  }, [db]);

  const handleConfirmImport = useCallback(async () => {
    if (!payload) return;
    setState('importing');

    const importResult = await executeImport(db, payload);

    if (importResult.success) {
      setResult({
        added:        importResult.customersAdded,
        matched:      importResult.customersMatched,
        transactions: importResult.transactionsAdded,
        skipped:      importResult.skippedRows,
      });
      setState('success');
      onImportComplete(); // tell parent to refresh
    } else {
      setErrorMsg(importResult.error ?? t('importFailed'));
      setState('error');
    }
  }, [db, payload, onImportComplete, t]);

  const handleDownloadTemplate = useCallback(async () => {
    setDownloadingTemplate(true);
    try {
      await downloadImportTemplate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setState('error');
    } finally {
      setDownloadingTemplate(false);
    }
  }, []);

  const s = makeStyles(colors);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={s.overlay} onPress={handleClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>

          {/* Drag handle */}
          <View style={s.handle} />

          {/* ── IDLE: two option cards ───────────────────────────────────── */}
          {state === 'idle' && (
            <>
              <Text style={s.title}>{t('importData')}</Text>
              <Text style={s.subtitle}>{t('importDataSubtitle')}</Text>

              {/* Pick File card */}
              <Pressable style={[s.optionCard, { borderColor: colors.accent.teal }]} onPress={handlePickFile}>
                <View style={[s.iconCircle, { backgroundColor: colors.accent.tealDim }]}>
                  <Ionicons name="cloud-upload-outline" size={26} color={colors.accent.teal} />
                </View>
                <View style={s.optionText}>
                  <Text style={[s.optionTitle, { color: colors.text.primary }]}>
                    {t('importPickFile')}
                  </Text>
                  <Text style={[s.optionSub, { color: colors.text.secondary }]}>
                    {t('importPickFileSubtitle')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </Pressable>

              {/* Download Template card */}
              <Pressable
                style={[s.optionCard, { borderColor: colors.background.tertiary }]}
                onPress={handleDownloadTemplate}
                disabled={downloadingTemplate}
              >
                <View style={[s.iconCircle, { backgroundColor: colors.background.tertiary }]}>
                  {downloadingTemplate
                    ? <ActivityIndicator size="small" color={colors.accent.teal} />
                    : <Ionicons name="document-outline" size={26} color={colors.text.secondary} />
                  }
                </View>
                <View style={s.optionText}>
                  <Text style={[s.optionTitle, { color: colors.text.primary }]}>
                    {t('downloadTemplate')}
                  </Text>
                  <Text style={[s.optionSub, { color: colors.text.secondary }]}>
                    {t('downloadTemplateSubtitle')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </Pressable>
            </>
          )}

          {/* ── PICKING / PARSING: spinner ───────────────────────────────── */}
          {state === 'picking' && (
            <View style={s.centred}>
              <ActivityIndicator size="large" color={colors.accent.teal} />
              <Text style={[s.statusText, { color: colors.text.secondary }]}>
                {t('importReading')}
              </Text>
            </View>
          )}

          {/* ── PREVIEWING: show counts and confirm button ───────────────── */}
          {state === 'previewing' && preview && (
            <>
              <Text style={s.title}>{t('importPreviewTitle')}</Text>

              <View style={[s.previewCard, { backgroundColor: colors.background.secondary, borderColor: colors.background.tertiary }]}>

                <View style={s.previewRow}>
                  <Text style={[s.previewLabel, { color: colors.text.secondary }]}>
                    {t('importFileName')}
                  </Text>
                  <Text style={[s.previewValue, { color: colors.text.primary }]} numberOfLines={1}>
                    {preview.fileName}
                  </Text>
                </View>

                <View style={[s.previewDivider, { backgroundColor: colors.background.tertiary }]} />

                <View style={s.previewRow}>
                  <Text style={[s.previewLabel, { color: colors.text.secondary }]}>
                    {t('importCustomersNew')}
                  </Text>
                  <Text style={[s.previewValue, { color: colors.accent.teal, fontWeight: '700' }]}>
                    {preview.newCustomers}
                  </Text>
                </View>

                <View style={[s.previewDivider, { backgroundColor: colors.background.tertiary }]} />

                <View style={s.previewRow}>
                  <Text style={[s.previewLabel, { color: colors.text.secondary }]}>
                    {t('importCustomersMatched')}
                  </Text>
                  <Text style={[s.previewValue, { color: colors.text.primary }]}>
                    {preview.matchedCustomers}
                  </Text>
                </View>

                <View style={[s.previewDivider, { backgroundColor: colors.background.tertiary }]} />

                <View style={s.previewRow}>
                  <Text style={[s.previewLabel, { color: colors.text.secondary }]}>
                    {t('importTransactions')}
                  </Text>
                  <Text style={[s.previewValue, { color: colors.text.primary }]}>
                    {preview.transactionsFound}
                  </Text>
                </View>

                {preview.skippedRows > 0 && (
                  <>
                    <View style={[s.previewDivider, { backgroundColor: colors.background.tertiary }]} />
                    <View style={s.previewRow}>
                      <Text style={[s.previewLabel, { color: '#EF4444' }]}>
                        {t('importSkipped')}
                      </Text>
                      <Text style={[s.previewValue, { color: '#EF4444' }]}>
                        {preview.skippedRows}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {preview.matchedCustomers > 0 && (
                <Text style={[s.noteText, { color: colors.text.muted }]}>
                  {t('importMatchedNote')}
                </Text>
              )}

              <Pressable style={[s.confirmBtn, { backgroundColor: colors.accent.teal }]} onPress={handleConfirmImport}>
                <Text style={[s.confirmBtnText, { color: colors.white }]}>
                  {t('importConfirm')}
                </Text>
              </Pressable>

              <Pressable style={s.cancelLink} onPress={() => setState('idle')}>
                <Text style={[s.cancelLinkText, { color: colors.text.muted }]}>
                  {t('cancel')}
                </Text>
              </Pressable>
            </>
          )}

          {/* ── IMPORTING: spinner ───────────────────────────────────────── */}
          {state === 'importing' && (
            <View style={s.centred}>
              <ActivityIndicator size="large" color={colors.accent.teal} />
              <Text style={[s.statusText, { color: colors.text.secondary }]}>
                {t('importInProgress')}
              </Text>
            </View>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────────────── */}
          {state === 'success' && (
            <View style={s.centred}>
              <View style={[s.successCircle, { backgroundColor: colors.accent.tealDim }]}>
                <Ionicons name="checkmark-circle" size={56} color={colors.accent.teal} />
              </View>
              <Text style={[s.successTitle, { color: colors.text.primary }]}>
                {t('importSuccess')}
              </Text>
              <Text style={[s.successBody, { color: colors.text.secondary }]}>
                {result.added > 0
                  ? `${result.added} ${t('importNewAdded')}${result.matched > 0 ? `, ${result.matched} ${t('importExistingUpdated')}` : ''}.`
                  : `${result.matched} ${t('importExistingUpdated')}.`}
                {'\n'}
                {result.transactions} {t('importTransactionsAdded')}.
              </Text>
              {result.skipped > 0 && (
                <Text style={[s.successSkipped, { color: colors.text.muted }]}>
                  {result.skipped} {t('importRowsSkipped')}.
                </Text>
              )}
              <Pressable style={[s.confirmBtn, { backgroundColor: colors.accent.teal, marginTop: 24 }]} onPress={handleClose}>
                <Text style={[s.confirmBtnText, { color: colors.white }]}>
                  {t('importDone')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── ERROR ─────────────────────────────────────────────────── */}
          {state === 'error' && (
            <View style={s.centred}>
              <Ionicons name="alert-circle" size={56} color="#EF4444" />
              <Text style={[s.successTitle, { color: colors.text.primary }]}>
                {t('importFailed')}
              </Text>
              <Text style={[s.errorBody, { color: colors.text.secondary }]}>
                {errorMsg === 'importUnsupportedFormat'
                  ? t('importUnsupportedFormat')
                  : errorMsg}
              </Text>
              <Pressable style={[s.confirmBtn, { backgroundColor: colors.accent.teal, marginTop: 16 }]} onPress={() => setState('idle')}>
                <Text style={[s.confirmBtnText, { color: colors.white }]}>
                  {t('retry')}
                </Text>
              </Pressable>
            </View>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(colors: ReturnType<typeof import('../../theme').useThemeContext>['colors']) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 44,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.background.tertiary,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 18,
      marginBottom: 20,
    },

    // Option cards (idle state)
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      gap: 14,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 3,
    },
    optionSub: {
      fontSize: 12,
      lineHeight: 16,
    },

    // Preview state
    previewCard: {
      borderWidth: 1,
      borderRadius: 14,
      marginBottom: 16,
      overflow: 'hidden',
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    previewLabel: {
      fontSize: 14,
      flex: 1,
    },
    previewValue: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'right',
      flexShrink: 1,
      marginLeft: 12,
    },
    previewDivider: {
      height: StyleSheet.hairlineWidth,
    },
    noteText: {
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 16,
      textAlign: 'center',
    },

    // Buttons
    confirmBtn: {
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    confirmBtnText: {
      fontSize: 16,
      fontWeight: '700',
    },
    cancelLink: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    cancelLinkText: {
      fontSize: 14,
    },

    // Centred states (picking, importing, success, error)
    centred: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 12,
    },
    statusText: {
      fontSize: 15,
      textAlign: 'center',
    },
    successCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    successBody: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    successSkipped: {
      fontSize: 12,
      textAlign: 'center',
    },
    errorBody: {
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
  });
}
