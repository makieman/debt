/**
 * src/screens/SettingsScreen.tsx
 *
 * The Settings tab — minimal, focused on demo control.
 *
 * ─── WHY THIS SCREEN EXISTS ───────────────────────────────────────────────────
 *
 * Two reasons:
 *
 *   1. DEMO CONTROL: The shopkeeper needs a way to reset demo data to a clean
 *      state between showings. Settings → "Load Demo Data" button.
 *
 *   2. APP INFO: A professional app always has version info and attribution.
 *      Without it, the app feels half-finished.
 *
 * ─── WHY CONFIRMATION BEFORE DESTRUCTIVE ACTIONS ─────────────────────────────
 *
 * "Load Demo Data" deletes ALL existing data. This cannot be undone.
 * Alert.alert() is the React Native / mobile universal pattern for this:
 *
 *   - It pauses the user's interaction with a system dialog
 *   - It names the consequence explicitly ("delete all current data")
 *   - It gives a safe escape ("Cancel")
 *   - It makes the destructive action hard to do accidentally
 *
 * Instagram, Gmail, every major app uses this pattern before irreversible actions.
 *
 * ─── WHY NAVIGATE TO DASHBOARD AFTER SEEDING ─────────────────────────────────
 *
 * The proof that seeding worked is the populated Dashboard. Leaving the user
 * staring at Settings after a loading spinner is anticlimactic. Navigate to
 * Dashboard so they immediately see KES 9,400 and 8 customers.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { db } from '../db';
import { seedDemoData } from '../db/seed';
import { colors } from '../theme';
import { RootTabParamList } from '../navigation/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SettingsNavProp = BottomTabNavigationProp<RootTabParamList, 'Settings'>;

// ─── Component ─────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNavProp>();
  const [loading, setLoading] = useState(false);

  // ── Handler: Load Demo Data ──────────────────────────────────────────────────

  function handleLoadDemoData() {
    // Step 1: Show confirmation dialog BEFORE doing anything destructive.
    // This is the standard mobile UX pattern — always gate irreversible actions.
    Alert.alert(
      'Reset all data?',
      'This will delete all current data and load 8 demo customers. This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset & Load Demo',
          style: 'destructive',
          onPress: runSeed,
        },
      ]
    );
  }

  async function runSeed() {
    setLoading(true);
    try {
      await seedDemoData(db);

      // Step 2: Show success feedback BEFORE navigating, so the user knows it worked.
      Alert.alert(
        '✅ Demo data loaded',
        'Loaded 8 customers · KES 9,400 total outstanding',
        [
          {
            text: 'View Dashboard',
            onPress: () => {
              // Step 3: Navigate to Dashboard tab so they see the results immediately.
              navigation.navigate('Dashboard');
            },
          },
        ]
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to load demo data: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* ── Section: Demo ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DEMO</Text>

          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Reset Demo Data</Text>
              <Text style={styles.cardSubtitle}>
                Clears all data and loads 8 sample customers for demonstration
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.demoButton,
                pressed && styles.demoButtonPressed,
                loading && styles.demoButtonDisabled,
              ]}
              onPress={handleLoadDemoData}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent.teal} />
              ) : (
                <Text style={styles.demoButtonText}>Load Demo Data</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Section: About ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>

          <View style={styles.card}>
            <AboutRow label="App" value="Duka Deni" />
            <View style={styles.rowDivider} />
            <AboutRow label="Version" value="1.0.0" />
            <View style={styles.rowDivider} />
            <AboutRow label="Built by" value="Lightstorm Technologies" />
          </View>
        </View>

        {/* ── Bottom padding ──────────────────────────────────────────────── */}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── AboutRow ──────────────────────────────────────────────────────────────────

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    paddingVertical: 20,
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  // ── Section ──────────────────────────────────────────────────────────────────
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    paddingBottom: 12,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Demo Button ───────────────────────────────────────────────────────────────
  demoButton: {
    margin: 12,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accent.teal,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  demoButtonPressed: {
    backgroundColor: colors.accent.tealDim,
  },
  demoButtonDisabled: {
    opacity: 0.5,
  },
  demoButtonText: {
    color: colors.accent.teal,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── About Rows ────────────────────────────────────────────────────────────────
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.background.tertiary,
    marginHorizontal: 16,
  },
  aboutLabel: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  aboutValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Bottom Padding ────────────────────────────────────────────────────────────
  bottomPad: {
    height: 40,
  },
});
