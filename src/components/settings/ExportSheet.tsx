/**
 * src/components/settings/ExportSheet.tsx
 *
 * A bottom-sheet modal with two export format options.
 *
 * WHY TWO SEPARATE OPTIONS INSTEAD OF ONE "EXPORT" BUTTON?
 *   JSON and CSV serve different audiences:
 *     - JSON: full backup for the shopkeeper, can be restored into the app later.
 *     - CSV: flat spreadsheet for an accountant to open in Excel/Google Sheets.
 *   Offering both with clear labels removes the burden of knowing file formats.
 *   The shopkeeper chooses their audience, not a technical format.
 *
 * WHY DISABLE BOTH BUTTONS DURING EXPORT?
 *   Tapping "Export" twice while the first export is running would write two
 *   files and open the share sheet twice. The loading state prevents double-firing.
 *   This pattern (optimistic disable on async action start) applies to any button
 *   that triggers async work.
 *
 * STATE MACHINE:
 *   idle → loading (tapped) → success (shareAsync returned) → idle (after 1.5s)
 *                           → error (caught)               → idle (on retry/close)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';

import { useThemeContext } from '../../theme';
import { useLanguage } from '../../store/LanguageContext';
import { useShopProfile } from '../../store/ShopProfileContext';
import { exportAsJSON, exportAsCSV, getLastExportLabel } from '../../services/exportService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  db: SQLiteDatabase;
}

type CardState = 'idle' | 'loading' | 'success' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportSheet({ visible, onClose, db }: Props) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const { profile, updateProfile } = useShopProfile();

  const [jsonState, setJsonState] = useState<CardState>('idle');
  const [csvState, setCsvState] = useState<CardState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [driveBackedUp, setDriveBackedUp] = useState(false);

  const isExporting = jsonState === 'loading' || csvState === 'loading';

  const lastExportLabel = getLastExportLabel(
    profile?.lastExportDate ?? null,
    profile?.language ?? 'en'
  );

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleExportJSON = useCallback(async () => {
    setJsonState('loading');
    setErrorMessage(null);
    setDriveBackedUp(false);
    const result = await exportAsJSON(db);
    if (result.success) {
      // Refresh context profile so the settings row label updates immediately
      await updateProfile({ lastExportDate: new Date().toISOString() });
      setDriveBackedUp(result.driveBackedUp ?? false);
      setJsonState('success');
      setTimeout(() => setJsonState('idle'), 1500);
    } else {
      setJsonState('error');
      setErrorMessage(result.error ?? 'Export failed');
    }
  }, [db, updateProfile]);

  const handleExportCSV = useCallback(async () => {
    setCsvState('loading');
    setErrorMessage(null);
    const result = await exportAsCSV(db);
    if (result.success) {
      await updateProfile({ lastExportDate: new Date().toISOString() });
      setCsvState('success');
      setTimeout(() => setCsvState('idle'), 1500);
    } else {
      setCsvState('error');
      setErrorMessage(result.error ?? 'Export failed');
    }
  }, [db, updateProfile]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  function renderButtonLabel(state: CardState, idleLabel: string) {
    if (state === 'loading') {
      return <ActivityIndicator size="small" color={colors.accent.teal} />;
    }
    if (state === 'success') {
      return (
        <Text style={[s.btnText, { color: colors.accent.teal }]}>
          ✓ {t('exportShared')}
        </Text>
      );
    }
    return <Text style={[s.btnText, { color: colors.accent.teal }]}>{idleLabel}</Text>;
  }

  const s = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>

          {/* Drag handle */}
          <View style={s.handle} />

          {/* Header */}
          <Text style={s.title}>{t('exportData')}</Text>
          <Text style={s.subtitle}>
            Your data stays on your device.{'\n'}Share it wherever you want.
          </Text>

          {/* Export cards */}
          <View style={s.cardsRow}>

            {/* JSON card */}
            <View style={[s.card, { borderColor: colors.background.tertiary }]}>
              <View style={s.badgeRow}>
                <View style={[s.badge, { backgroundColor: colors.accent.tealDim }]}>
                  <Text style={[s.badgeText, { color: colors.accent.teal }]}>JSON</Text>
                </View>
              </View>
              <Ionicons name="document-text-outline" size={28} color={colors.accent.teal} style={s.cardIcon} />
              <Text style={[s.cardTitle, { color: colors.text.primary }]}>{t('backupFile')}</Text>
              <Text style={[s.cardSubtitle, { color: colors.text.secondary }]}>{t('backupFileSubtitle')}</Text>
              <Pressable
                style={[
                  s.exportBtn,
                  { borderColor: colors.accent.teal },
                  isExporting && s.exportBtnDisabled,
                ]}
                onPress={handleExportJSON}
                disabled={isExporting}
              >
                {renderButtonLabel(jsonState, t('exportData'))}
              </Pressable>
              {/* Drive backup confirmation — appears briefly after a backed-up export */}
              {jsonState === 'success' && driveBackedUp && (
                <Text style={[s.driveLabel, { color: colors.accent.teal }]}>
                  ☁ Backed up to Google Drive
                </Text>
              )}
            </View>

            {/* CSV card */}
            <View style={[s.card, { borderColor: colors.background.tertiary }]}>
              <View style={s.badgeRow}>
                <View style={[s.badge, { backgroundColor: colors.accent.tealDim }]}>
                  <Text style={[s.badgeText, { color: colors.accent.teal }]}>CSV</Text>
                </View>
              </View>
              <Ionicons name="grid-outline" size={28} color={colors.accent.teal} style={s.cardIcon} />
              <Text style={[s.cardTitle, { color: colors.text.primary }]}>{t('spreadsheet')}</Text>
              <Text style={[s.cardSubtitle, { color: colors.text.secondary }]}>{t('spreadsheetSubtitle')}</Text>
              <Pressable
                style={[
                  s.exportBtn,
                  { borderColor: colors.accent.teal },
                  isExporting && s.exportBtnDisabled,
                ]}
                onPress={handleExportCSV}
                disabled={isExporting}
              >
                {renderButtonLabel(csvState, t('exportData'))}
              </Pressable>
            </View>

          </View>

          {/* Error message */}
          {errorMessage ? (
            <Text style={s.errorText}>
              {t('exportFailed')}: {errorMessage}
            </Text>
          ) : null}

          {/* Last exported label */}
          <Text style={[s.lastExported, { color: colors.text.muted }]}>
            {t('lastExported')}: {lastExportLabel}
          </Text>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
      paddingBottom: 40,
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
    cardsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    card: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      borderWidth: 0.5,
      borderRadius: 14,
      padding: 14,
    },
    badgeRow: {
      flexDirection: 'row',
      marginBottom: 10,
    },
    badge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    cardIcon: {
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 12,
      lineHeight: 16,
      marginBottom: 12,
    },
    exportBtn: {
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
    },
    exportBtnDisabled: {
      opacity: 0.4,
    },
    btnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 12,
    },
    lastExported: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
    },
    driveLabel: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 6,
    },
  });
}
