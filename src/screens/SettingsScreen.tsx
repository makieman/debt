import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { db } from '../db';
import { useThemeContext } from '../theme';
import { useShopProfile } from '../store/ShopProfileContext';
import { useLanguage } from '../store/LanguageContext';
import { useSecurityContext } from '../store/SecurityContext';
import { disableAppLock, isPinSet } from '../store/security';
import * as SecureStore from 'expo-secure-store';
import { APP_LOCK_ENABLED_KEY } from '../store/security';
import { RootTabParamList, RootStackParamList } from '../navigation/types';
import { SettingsPickerModal } from '../components/SettingsPickerModal';
import { SettingsRow } from '../components/settings/SettingsRow';
import { Switch } from '../components/settings/Switch';
import { ExportSheet } from '../components/settings/ExportSheet';
import { ClearDataSheet } from '../components/settings/ClearDataSheet';
import { playPaymentSound } from '../utils/sound';
import { ShopProfile } from '../store/shopProfile';
import { getLastExportLabel } from '../services/exportService';

/**
 * ─── NAVIGATION TYPE FOR SETTINGS ────────────────────────────────────────────
 *
 * SettingsScreen lives inside the bottom tab navigator (RootTabParamList).
 * BUT it needs to navigate to PinSetup and PinChange, which are in the
 * ROOT stack (RootStackParamList) above the tab navigator.
 *
 * Solution: CompositeNavigationProp
 *   - First type: the screen's own navigator (BottomTab, "Settings" screen)
 *   - Second type: the parent navigator (NativeStack, any screen)
 *
 * With this, Settings can call:
 *   navigation.navigate('Settings')    ← tab navigation (own navigator)
 *   navigation.navigate('PinSetup')    ← root stack navigation (parent)
 *
 * Without CompositeNavigationProp, TypeScript would reject navigation to
 * "PinSetup" because BottomTabNavigationProp doesn't know about it.
 */
type SettingsNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Settings'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNavProp>();
  const { colors, themeMode } = useThemeContext();
  const { profile, updateProfile } = useShopProfile();
  const { t } = useLanguage();
  const { isAppLockEnabled, pinSetupComplete, refreshSecurityState } = useSecurityContext();

  const [loading, setLoading] = useState(false);
  const [versionTaps, setVersionTaps] = useState(0);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showClearSheet, setShowClearSheet] = useState(false);
  const [lastExportLabel, setLastExportLabel] = useState('Never exported');

  /**
   * WHY THIS useEffect UPDATES AUTOMATICALLY AFTER EXPORT:
   * When exportAsJSON/exportAsCSV succeeds, the ExportSheet calls
   * updateProfile({ lastExportDate: new Date().toISOString() }). That updates
   * the ShopProfileContext, so `profile` re-renders everywhere that consumes it
   * — including this screen. The effect below depends on profile.lastExportDate,
   * so it re-runs every time that field changes, re-computing the label.
   * No manual setState needed here — the data flow handles it reactively.
   */
  useEffect(() => {
    setLastExportLabel(
      getLastExportLabel(profile?.lastExportDate ?? null, profile?.language ?? 'en')
    );
  }, [profile?.lastExportDate, profile?.language]);

  const handleToggle = async (field: keyof ShopProfile, value: boolean) => {
    console.log('Saved notification setting:', field, '=', value);
    await updateProfile({ [field]: value });
  };

  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    title: string;
    options: { label: string; value: string }[];
    selectedValue: string;
    onSelect: (val: string) => void;
  }>({
    visible: false,
    title: '',
    options: [],
    selectedValue: '',
    onSelect: () => {},
  });

  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState(profile?.ownerName || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');

  // Keep state updated when profile loads
  React.useEffect(() => {
    if (profile) {
      setEditName(profile.ownerName);
      setEditPhone(profile.phone);
    }
  }, [profile]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSaveProfile() {
    updateProfile({ ownerName: editName, phone: editPhone });
    setEditProfileVisible(false);
  }



  function handleVersionTap() {
    const newTaps = versionTaps + 1;
    setVersionTaps(newTaps);
    if (newTaps === 7) {
      Alert.alert('Developer Mode', t('developerMode'));
    }
  }

  // ── Security handlers ──────────────────────────────────────────────────────

  /**
   * WHY CONFIRM BEFORE DISABLING BUT NOT BEFORE ENABLING?
   *
   * Enabling app lock is a PROTECTIVE action — it adds security. No risk.
   * Disabling removes that protection — some risk. The confirmation Alert
   * should match the risk level of the action.
   *
   * Analogies:
   *   Locking your car: you just do it (no confirmation needed)
   *   Removing your car's lock: the manufacturer asks "are you sure?"
   *
   * Same principle in banking apps: enabling PIN is immediate,
   * disabling it requires a confirmation step.
   */
  const handleAppLockToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!pinSetupComplete) {
        // No PIN exists yet → go through the setup flow
        // Do NOT enable lock yet — only enable after PIN is confirmed
        navigation.navigate('PinSetup');
      } else {
        // PIN already exists → just re-enable the lock (no PIN re-entry needed)
        // This is the "pause and resume" pattern:
        // User disabled lock but kept their hash → easy re-enable
        await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'true');
        await refreshSecurityState();
      }
    } else {
      Alert.alert(
        t('disableAppLock'),
        t('disableAppLockMsg'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('disable'),
            style: 'destructive',
            onPress: async () => {
              await disableAppLock();
              await refreshSecurityState();
            },
          },
        ]
      );
    }
  };

  // ── Open Pickers ────────────────────────────────────────────────────────────

  function openCurrencyPicker() {
    setPickerConfig({
      visible: true,
      title: t('currency'),
      options: [
        { label: 'KES - Kenyan Shilling', value: 'KES' },
        { label: 'UGX - Ugandan Shilling', value: 'UGX' },
        { label: 'TZS - Tanzanian Shilling', value: 'TZS' },
        { label: 'USD - US Dollar', value: 'USD' },
      ],
      selectedValue: profile?.currency || 'KES',
      onSelect: (val) => updateProfile({ currency: val as any }),
    });
  }

  function openDateFormatPicker() {
    setPickerConfig({
      visible: true,
      title: t('dateFormat'),
      options: [
        { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
        { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
        { label: 'D MMM YYYY', value: 'D MMM YYYY' },
      ],
      selectedValue: profile?.dateFormat || 'DD/MM/YYYY',
      onSelect: (val) => updateProfile({ dateFormat: val as any }),
    });
  }

  function openLanguagePicker() {
    setPickerConfig({
      visible: true,
      title: t('language'),
      options: [
        { label: 'English', value: 'en' },
        { label: 'Kiswahili', value: 'sw' },
      ],
      selectedValue: profile?.language || 'en',
      onSelect: (val) => updateProfile({ language: val as any }),
    });
  }

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SO';
  };

  // Styles defined dynamically inside render to capture current colors
  const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background.primary },
    container: { flex: 1 },
    contentContainer: { paddingHorizontal: 20, paddingTop: 8 },
    headerTitle: { color: colors.text.primary, fontSize: 32, fontWeight: '800', marginVertical: 24, letterSpacing: -0.5 },
    
    // Profile Card
    profileCard: { backgroundColor: colors.background.secondary, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent.teal, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    avatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
    profileInfo: { flex: 1 },
    profileName: { color: colors.text.primary, fontSize: 20, fontWeight: '700', marginBottom: 4 },
    profilePhone: { color: colors.text.secondary, fontSize: 14 },
    editIcon: { padding: 8 },

    // Section
    sectionLabel: { color: colors.text.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4, marginTop: 16 },
    card: { backgroundColor: colors.background.secondary, borderRadius: 16, overflow: 'hidden' },
    
    // Row
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowLabel: { color: colors.text.primary, fontSize: 16, fontWeight: '500' },
    rowValue: { color: colors.text.secondary, fontSize: 16, marginRight: 8 },
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    divider: { height: 1, backgroundColor: colors.background.tertiary, marginLeft: 50 },

    // Segmented Control
    segmentContainer: { flexDirection: 'row', backgroundColor: colors.background.tertiary, borderRadius: 8, padding: 2, marginTop: 12, marginHorizontal: 16, marginBottom: 16 },
    segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    segmentBtnActive: { backgroundColor: colors.background.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    segmentText: { color: colors.text.secondary, fontSize: 14, fontWeight: '600' },
    segmentTextActive: { color: colors.text.primary },

    // Demo
    demoButton: { margin: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.accent.teal, alignItems: 'center', justifyContent: 'center' },
    demoButtonText: { color: colors.accent.teal, fontSize: 16, fontWeight: '600' },
    bottomPad: { height: 60 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.background.primary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 20 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: 8 },
    input: { backgroundColor: colors.background.secondary, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text.primary, marginBottom: 16, borderWidth: 1, borderColor: colors.background.tertiary },
    saveBtn: { backgroundColor: colors.accent.teal, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>{t('settings')}</Text>

        {/* ── Owner Profile Card ── */}
        <Pressable style={styles.profileCard} onPress={() => setEditProfileVisible(true)}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profile?.ownerName || 'SO')}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.ownerName || 'Shop Owner'}</Text>
            <Text style={styles.profilePhone}>{profile?.phone || 'Add phone number'}</Text>
          </View>
          <Feather name="edit-2" size={20} color={colors.text.secondary} style={styles.editIcon} />
        </Pressable>

        {/* ── Preferences ── */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Feather name="moon" size={20} color={colors.text.secondary} />
              <Text style={styles.rowLabel}>{t('appearance')}</Text>
            </View>
          </View>
          <View style={styles.segmentContainer}>
            <Pressable 
              style={[styles.segmentBtn, themeMode === 'light' && styles.segmentBtnActive]}
              onPress={() => updateProfile({ theme: 'light' })}
            >
              <Text style={[styles.segmentText, themeMode === 'light' && styles.segmentTextActive]}>{t('light')}</Text>
            </Pressable>
            <Pressable 
              style={[styles.segmentBtn, themeMode === 'dark' && styles.segmentBtnActive]}
              onPress={() => updateProfile({ theme: 'dark' })}
            >
              <Text style={[styles.segmentText, themeMode === 'dark' && styles.segmentTextActive]}>{t('dark')}</Text>
            </Pressable>
          </View>
          
          <View style={styles.divider} />
          
          <Pressable style={styles.row} onPress={openCurrencyPicker}>
            <View style={styles.rowLeft}>
              <Feather name="dollar-sign" size={20} color={colors.text.secondary} />
              <Text style={styles.rowLabel}>{t('currency')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{profile?.currency || 'KES'}</Text>
              <Feather name="chevron-right" size={20} color={colors.text.muted} />
            </View>
          </Pressable>

          <View style={styles.divider} />
          
          <Pressable style={styles.row} onPress={openDateFormatPicker}>
            <View style={styles.rowLeft}>
              <Feather name="calendar" size={20} color={colors.text.secondary} />
              <Text style={styles.rowLabel}>{t('dateFormat')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{profile?.dateFormat || 'DD/MM/YYYY'}</Text>
              <Feather name="chevron-right" size={20} color={colors.text.muted} />
            </View>
          </Pressable>

          <View style={styles.divider} />
          
          <Pressable style={styles.row} onPress={openLanguagePicker}>
            <View style={styles.rowLeft}>
              <Feather name="globe" size={20} color={colors.text.secondary} />
              <Text style={styles.rowLabel}>{t('language')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{profile?.language === 'sw' ? 'Kiswahili' : 'English'}</Text>
              <Feather name="chevron-right" size={20} color={colors.text.muted} />
            </View>
          </Pressable>
        </View>

        {/* ── Notifications Section ── */}
        <Text style={styles.sectionLabel}>{t('notifications').toUpperCase()}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            iconColor={colors.accent.teal}
            title={t('notificationReminders')}
            subtitle={t('notificationRemindersSubtitle')}
            showChevron={false}
            rightElement={
              <Switch
                value={!!profile?.notificationReminders}
                onValueChange={(v) => handleToggle('notificationReminders', v)}
              />
            }
          />
          <SettingsRow
            icon="bar-chart-outline"
            iconColor={colors.accent.teal}
            title={t('notificationDailySummary')}
            subtitle={t('notificationDailySummarySubtitle')}
            showChevron={false}
            rightElement={
              <Switch
                value={!!profile?.notificationDailySummary}
                onValueChange={(v) => handleToggle('notificationDailySummary', v)}
              />
            }
          />
          <SettingsRow
            icon="person-add-outline"
            iconColor={colors.accent.teal}
            title={t('notificationNewCustomer')}
            subtitle={t('notificationNewCustomerSubtitle')}
            showChevron={false}
            rightElement={
              <Switch
                value={!!profile?.notificationNewCustomer}
                onValueChange={(v) => handleToggle('notificationNewCustomer', v)}
              />
            }
          />
          <SettingsRow
            icon="volume-high-outline"
            iconColor={colors.accent.teal}
            title={t('notificationSound')}
            subtitle={t('notificationSoundSubtitle')}
            showChevron={false}
            rightElement={
              <Switch
                value={!!profile?.notificationSound}
                onValueChange={async (v) => {
                  await handleToggle('notificationSound', v);
                  if (v) {
                    await playPaymentSound();
                  }
                }}
              />
            }
          />
        </View>

        {/* ── Security Section ── */}
        {/*
         * WHY "Change PIN" ONLY SHOWS WHEN LOCK IS ENABLED?
         * Changing a PIN that protects nothing is meaningless. The row
         * appears only in the context where it's relevant — when lock is on.
         * This matches every banking app: security options only appear
         * when security is active. Showing irrelevant options adds clutter.
         */}
        <Text style={styles.sectionLabel}>{t('security').toUpperCase()}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="lock-closed-outline"
            iconColor={colors.accent.teal}
            title={t('appLock')}
            subtitle={isAppLockEnabled ? t('appLockEnabled') : t('appLockDisabled')}
            showChevron={false}
            rightElement={
              <Switch
                value={isAppLockEnabled}
                onValueChange={handleAppLockToggle}
              />
            }
          />
          {isAppLockEnabled && (
            <SettingsRow
              icon="keypad-outline"
              iconColor={colors.accent.teal}
              title={t('changePIN')}
              subtitle={t('changePINSubtitle')}
              showChevron={true}
              onPress={() => navigation.navigate('PinChange')}
            />
          )}
        </View>

        {/* ── Data & Backup Section ── */}
        <Text style={styles.sectionLabel}>{t('backupSync').toUpperCase()}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="cloud-outline"
            iconColor={colors.accent.teal}
            title={t('backupSync')}
            subtitle={`${t('lastExported')}: ${lastExportLabel}`}
            showChevron={true}
            onPress={() => setShowExportSheet(true)}
          />
          <SettingsRow
            icon="download-outline"
            iconColor={colors.accent.teal}
            title={t('exportData')}
            subtitle={t('exportDataSubtitle')}
            showChevron={true}
            onPress={() => setShowExportSheet(true)}
          />
          <SettingsRow
            icon="trash-outline"
            iconColor={colors.debt}
            title={t('clearAllData')}
            subtitle={t('clearAllDataSubtitle')}
            showChevron={true}
            onPress={() => setShowClearSheet(true)}
          />
        </View>

        {/* ── App Info & Demo ── */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>App</Text>
            <Text style={styles.rowValue}>Credi</Text>
          </View>
          <View style={[styles.divider, { marginLeft: 16 }]} />
          <Pressable style={styles.row} onPress={handleVersionTap}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </Pressable>
          <View style={[styles.divider, { marginLeft: 16 }]} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Built by</Text>
            <Text style={styles.rowValue}>Lightstorm</Text>
          </View>
        </View>


        <View style={styles.bottomPad} />
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editProfileVisible} transparent animationType="slide" onRequestClose={() => setEditProfileVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditProfileVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('editProfile')}</Text>
            
            <Text style={styles.inputLabel}>{t('name')}</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Shop Owner Name"
              placeholderTextColor={colors.text.muted}
              autoFocus
            />

            <Text style={styles.inputLabel}>{t('phone')}</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Phone Number"
              placeholderTextColor={colors.text.muted}
              keyboardType="phone-pad"
            />

            <Pressable style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Shared Picker Modal ── */}
      <SettingsPickerModal
        visible={pickerConfig.visible}
        title={pickerConfig.title}
        options={pickerConfig.options}
        selectedValue={pickerConfig.selectedValue}
        onSelect={pickerConfig.onSelect}
        onClose={() => setPickerConfig(prev => ({ ...prev, visible: false }))}
      />

      {/* ── Export Sheet ── */}
      <ExportSheet
        visible={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        db={db}
      />

      {/* ── Clear Data Sheet ── */}
      <ClearDataSheet
        visible={showClearSheet}
        onClose={() => setShowClearSheet(false)}
        db={db}
      />
    </SafeAreaView>
  );
}
