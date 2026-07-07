/**
 * src/components/settings/ClearDataSheet.tsx
 *
 * A bottom-sheet confirmation dialog for permanent data deletion.
 *
 * WHY TYPE-TO-CONFIRM INSTEAD OF Alert.alert()?
 *   Alert.alert() with a "Delete" button requires ONE tap — easy to trigger
 *   accidentally. Type-to-confirm ("DELETE") requires:
 *     1. The user opens the keyboard
 *     2. Types a specific 6-letter word
 *     3. Taps the now-enabled red button
 *   It is impossible to trigger accidentally. This pattern is used by GitHub
 *   (repo deletion), Vercel (project deletion), and AWS (resource termination)
 *   for all irreversible production operations.
 *
 * WHY SHOW THE EXPORT BANNER INSIDE THIS SHEET?
 *   The most dangerous moment to lose data is the second before deletion.
 *   Surfacing the export option here catches the shopkeeper before it's too
 *   late. It also makes moral sense: never show a "destroy everything" dialog
 *   without an escape hatch. The export banner IS the escape hatch.
 *
 * WHY autoCapitalize="characters"?
 *   "delete" !== "DELETE" in our comparison. Without auto-capitalize, the
 *   shopkeeper must manually switch to caps on their keyboard. autoCapitalize
 *   removes friction and prevents the confusion of "why isn't the button red?".
 *
 * RESET ON OPEN:
 *   The confirm text is reset to "" every time the sheet opens (useEffect on
 *   `visible`). If the user typed "DELETE" then closed without confirming, the
 *   field should be empty the next time they open it — not pre-filled and ready
 *   to fire immediately.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SQLiteDatabase } from 'expo-sqlite';

import { useThemeContext } from '../../theme';
import { useLanguage } from '../../store/LanguageContext';
import { useShopProfile } from '../../store/ShopProfileContext';
import { clearAllData } from '../../db/seed';
import { exportAsJSON } from '../../services/exportService';
import { RootTabParamList } from '../../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  db: SQLiteDatabase;
}

type NavProp = BottomTabNavigationProp<RootTabParamList>;

const CONFIRM_WORD = 'DELETE';

// ─── Component ────────────────────────────────────────────────────────────────

export function ClearDataSheet({ visible, onClose, db }: Props) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const { updateProfile } = useShopProfile();
  const navigation = useNavigation<NavProp>();

  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);

  const isConfirmed = confirmText === CONFIRM_WORD;

  // Reset state every time sheet opens
  useEffect(() => {
    if (visible) {
      setConfirmText('');
      setLoading(false);
      setDone(false);
    }
  }, [visible]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleExportFirst = useCallback(async () => {
    setExportingBackup(true);
    await exportAsJSON(db);
    setExportingBackup(false);
  }, [db]);

  const handleClearData = useCallback(async () => {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await clearAllData(db);
      // Reset lastExportDate since the data is gone — a future export would be empty
      await updateProfile({ lastExportDate: null });
      setDone(true);

      // Brief success moment, then close and navigate to Dashboard
      setTimeout(() => {
        onClose();
        navigation.navigate('Dashboard');
      }, 1000);
    } catch (e) {
      console.error('[ClearDataSheet] clearAllData failed:', e);
      setLoading(false);
    }
  }, [isConfirmed, db, updateProfile, onClose, navigation]);

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

          {/* Warning header */}
          <View style={s.warningHeader}>
            <Ionicons name="trash-outline" size={32} color={colors.debt} />
            <Text style={[s.warningTitle, { color: colors.debt }]}>
              {t('clearAllData')}
            </Text>
            <Text style={[s.warningMessage, { color: colors.text.secondary }]}>
              {t('clearWarning')}
            </Text>
          </View>

          {/* Export reminder banner */}
          <Pressable
            style={[s.exportBanner, { backgroundColor: colors.accent.tealDim, borderColor: colors.accent.teal }]}
            onPress={handleExportFirst}
            disabled={exportingBackup}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.accent.teal} />
            <View style={s.exportBannerText}>
              <Text style={[s.exportBannerMain, { color: colors.text.primary }]}>
                {t('clearExportFirst')}
              </Text>
              <Text style={[s.exportBannerLink, { color: colors.accent.teal }]}>
                {exportingBackup ? t('exporting') : t('exportBackup')} →
              </Text>
            </View>
            {exportingBackup && <ActivityIndicator size="small" color={colors.accent.teal} />}
          </Pressable>

          {/* Divider */}
          <View style={[s.divider, { backgroundColor: colors.background.tertiary }]} />

          {/* Type-to-confirm section */}
          <Text style={[s.confirmLabel, { color: colors.text.secondary }]}>
            {t('typeToConfirm')}
          </Text>
          <TextInput
            style={[s.confirmInput, {
              backgroundColor: colors.background.secondary,
              borderColor: isConfirmed ? colors.debt : colors.background.tertiary,
              color: colors.text.primary,
            }]}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={t('deletePlaceholder')}
            placeholderTextColor={colors.text.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading && !done}
          />

          {/* Delete button */}
          <Pressable
            style={[
              s.deleteBtn,
              {
                backgroundColor: isConfirmed ? colors.debt : colors.background.tertiary,
              },
            ]}
            onPress={handleClearData}
            disabled={!isConfirmed || loading || done}
          >
            {done ? (
              <Text style={[s.deleteBtnText, { color: '#FFFFFF' }]}>✓ {t('dataCleared')}</Text>
            ) : loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[
                s.deleteBtnText,
                { color: isConfirmed ? '#FFFFFF' : colors.text.muted }
              ]}>
                {t('clearAllData')}
              </Text>
            )}
          </Pressable>

          {/* Cancel button */}
          <Pressable style={s.cancelBtn} onPress={onClose}>
            <Text style={[s.cancelBtnText, { color: colors.text.secondary }]}>
              {t('cancel')}
            </Text>
          </Pressable>

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
      backgroundColor: 'rgba(0,0,0,0.65)',
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
    warningHeader: {
      alignItems: 'center',
      marginBottom: 16,
      gap: 6,
    },
    warningTitle: {
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
    },
    warningMessage: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    exportBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 0.5,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    exportBannerText: {
      flex: 1,
    },
    exportBannerMain: {
      fontSize: 12,
      lineHeight: 16,
    },
    exportBannerLink: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    divider: {
      height: 1,
      marginBottom: 16,
    },
    confirmLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 8,
    },
    confirmInput: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      letterSpacing: 3,
      marginBottom: 16,
    },
    deleteBtn: {
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    deleteBtnText: {
      fontSize: 16,
      fontWeight: '700',
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    cancelBtnText: {
      fontSize: 15,
    },
  });
}
