/**
 * src/screens/DashboardScreen.tsx
 *
 * The redesigned home/dashboard screen — answers business overview questions:
 *   1. How much money is owed in total (receivables)?
 *   2. Amount collected vs outstanding?
 *   3. Quick actions: Add Credit, Record Payment, Add Customer.
 *   4. Recent transactions.
 *
 * Implements a clean, premium light-mode interface following user guidelines.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useDashboard } from '../hooks/useDashboard';
import { colors } from '../theme';
import { formatKES } from '../utils/money';
import { ActivityFeedRow } from '../components/ActivityFeedRow';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { RootTabParamList } from '../navigation/types';

type DashboardNavProp = BottomTabNavigationProp<RootTabParamList, 'Dashboard'>;

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DashboardNavProp>();
  const {
    totalOutstanding,
    totalReceivables,
    totalCollected,
    customerCount,
    recentActivity,
    loading,
    error,
    refresh,
  } = useDashboard();

  // ── States ─────────────────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [showValues, setShowValues] = useState(true);

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Couldn't load dashboard</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <Pressable onPress={refresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main screen ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent.teal}
            colors={[colors.accent.teal]}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable style={styles.iconButton}>
            <Ionicons name="menu-outline" size={24} color={colors.text.primary} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.greeting}>Good morning, Alex 👋</Text>
            <Text style={styles.greetingSub}>Here's your business overview</Text>
          </View>
          <Pressable style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          </Pressable>
        </View>

        {/* ── Prominent Receivables Card ──────────────────────────────────── */}
        <View style={styles.receivablesCard}>
          {/* Green Part */}
          <View style={styles.receivablesGreenPart}>
            <View style={styles.receivablesHeader}>
              <Text style={styles.receivablesLabel}>Total Receivables</Text>
              <Pressable
                onPress={() => setShowValues(!showValues)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showValues ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={colors.white}
                />
              </Pressable>
            </View>
            <Text style={styles.receivablesAmount}>
              {showValues ? formatKES(totalReceivables) : '••••••'}
            </Text>
            <Text style={styles.receivablesCustomers}>
              from {customerCount} customer{customerCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Sub Details (Amount Collected & Outstanding) */}
          <View style={styles.receivablesSubDetails}>
            <View style={styles.subDetailCol}>
              <Text style={styles.subDetailLabel}>Amount Collected</Text>
              <Text style={[styles.subDetailValue, { color: colors.accent.teal }]}>
                {showValues ? formatKES(totalCollected) : '••••••'}
              </Text>
            </View>
            <View style={styles.subDetailDivider} />
            <View style={styles.subDetailCol}>
              <Text style={styles.subDetailLabel}>Outstanding</Text>
              <Text style={[styles.subDetailValue, { color: colors.debt }]}>
                {showValues ? formatKES(totalOutstanding) : '••••••'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions Section ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {/* Add Credit */}
            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.cardPressed,
              ]}
              onPress={() => {
                navigation.navigate('Customers');
              }}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#EF444412' }]}>
                <Ionicons name="document-text-outline" size={22} color={colors.debt} />
              </View>
              <Text style={styles.actionCardTitle}>Add Credit</Text>
              <Text style={styles.actionCardSubtitle}>Give credit</Text>
            </Pressable>

            {/* Record Payment */}
            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.cardPressed,
              ]}
              onPress={() => {
                navigation.navigate('Customers');
              }}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#10B98112' }]}>
                <Ionicons name="cash-outline" size={22} color={colors.accent.teal} />
              </View>
              <Text style={styles.actionCardTitle}>Record Payment</Text>
              <Text style={styles.actionCardSubtitle}>Receive payment</Text>
            </Pressable>

            {/* Add Customer */}
            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.cardPressed,
              ]}
              onPress={() => {
                setModalVisible(true);
              }}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#3B82F612' }]}>
                <Ionicons name="person-add-outline" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.actionCardTitle}>Add Customer</Text>
              <Text style={styles.actionCardSubtitle}>New customer</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Recent Transactions Section ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable onPress={() => navigation.navigate('Customers')}>
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          </View>

          {recentActivity.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.activityContainer}>
              {recentActivity.map((item, index) => (
                <View key={item.transactionId}>
                  <ActivityFeedRow item={item} />
                  {index < recentActivity.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom padding for safety */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* ── Add Customer Modal ───────────────────────────────────────────── */}
      <AddCustomerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setModalVisible(false);
          refresh();
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // ── Loading / Error ────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  errorMsg: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent.teal,
    marginTop: 8,
  },
  retryText: {
    color: colors.accent.teal,
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  greeting: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  greetingSub: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },

  // ── Receivables Card ─────────────────────────────────────────────────────
  receivablesCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 8,
  },
  receivablesGreenPart: {
    backgroundColor: colors.accent.teal,
    padding: 20,
  },
  receivablesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receivablesLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  receivablesAmount: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: 6,
  },
  receivablesCustomers: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
  },
  receivablesSubDetails: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  subDetailCol: {
    flex: 1,
  },
  subDetailLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  subDetailValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  subDetailDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.background.tertiary,
    marginHorizontal: 16,
  },

  // ── Quick Actions ────────────────────────────────────────────────────────
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  viewAllText: {
    color: colors.accent.teal,
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  actionCardSubtitle: {
    fontSize: 10,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  // ── Recent Activity ──────────────────────────────────────────────────────
  activityContainer: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    paddingHorizontal: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.background.tertiary,
  },
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 13,
  },

  // ── Bottom Padding ───────────────────────────────────────────────────────
  bottomPadding: {
    height: 40,
  },
});
