/**
 * src/screens/DashboardScreen.tsx
 *
 * The business health overview screen — answers three questions at a glance:
 *   1. How much money is owed to me in total?
 *   2. Who owes me the most?
 *   3. What happened today (and this week)?
 *
 * ─── ScrollView vs FlatList ────────────────────────────────────────────────────
 * CustomerListScreen uses FlatList because it shows ONE type of item (CustomerCard)
 * repeating N times. FlatList virtualises the list — only visible items are in
 * memory. Perfect for uniform, potentially long lists.
 *
 * DashboardScreen uses ScrollView because it shows HETEROGENEOUS sections:
 *   - Header (unique)
 *   - Stat cards (horizontal scroll within vertical scroll)
 *   - Section header + chart (unique)
 *   - Section header + top 5 debtors (small fixed list)
 *   - Section header + last 10 activity items (small fixed list)
 *
 * There's no single item type to virtualise. The content is a mix of
 * components, each with different heights. ScrollView renders everything
 * at once — which is fine because we have a bounded number of items
 * (5 debtors + 10 activity rows = 15 items max, not 10,000).
 *
 * Rule: use FlatList when the list is UNIFORM and could be LONG.
 *       Use ScrollView when the content is HETEROGENEOUS and BOUNDED.
 *
 * ─── RefreshControl ────────────────────────────────────────────────────────────
 * FlatList has `refreshing` and `onRefresh` props built in.
 * ScrollView doesn't — you add a <RefreshControl> component to its
 * `refreshControl` prop:
 *
 *   <ScrollView
 *     refreshControl={
 *       <RefreshControl
 *         refreshing={loading}
 *         onRefresh={refresh}
 *       />
 *     }
 *   >
 *
 * RefreshControl renders the native platform pull-to-refresh spinner.
 * You don't draw it yourself — iOS shows its native circular spinner,
 * Android shows its Material Design swipe-refresh indicator.
 *
 * ─── "Habari 👋" — Why localisation details matter ───────────────────────────
 * "Habari" is the standard Swahili greeting in Kenya (literally "How are you?"
 * used as "Hello"). Small touches like this make the difference between
 * a generic app and one that feels built FOR the user. A shopkeeper in
 * Nairobi seeing "Habari" feels recognised — this isn't a repackaged
 * Western app, it was made for them. That emotional response is why
 * products like M-Pesa dominate Kenya despite technically inferior specs.
 * Even one localized word signals cultural understanding.
 *
 * ─── Common mistake ────────────────────────────────────────────────────────────
 * Forgetting `contentContainerStyle` vs `style` on ScrollView.
 * `style` styles the ScrollView container (the outer View).
 * `contentContainerStyle` styles the inner content box.
 * Padding must go in `contentContainerStyle` — putting it in `style` would
 * clip the scrollable content against the outer container's edges.
 */

import React from 'react';
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
import { useDashboard } from '../hooks/useDashboard';
import { colors } from '../theme';
import { formatKES } from '../utils/money';
import { StatCard } from '../components/StatCard';
import { TopDebtorRow } from '../components/TopDebtorRow';
import { ActivityFeedRow } from '../components/ActivityFeedRow';
import { WeeklyChart } from '../components/WeeklyChart';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Day abbreviations for the header date
const DAYS_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats today's date as "Tue, 24 Jun" */
function formatHeaderDate(): string {
  const now = new Date();
  const day  = DAYS_SHORT[now.getDay()];
  const date = now.getDate();
  const mon  = MONTHS_SHORT[now.getMonth()];
  return `${day}, ${date} ${mon}`;
}

/** Formats today's YYYY-MM-DD key to look up in dailyTotals */
function todayKey(): string {
  const now  = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    totalOutstanding,
    topDebtors,
    recentActivity,
    customerCount,
    dailyTotals,
    loading,
    error,
    refresh,
  } = useDashboard();

  // ── Derived values ─────────────────────────────────────────────────────────
  // These are computed from data in JS — not requiring extra SQL queries.

  // Count of customers who actually have a balance > 0
  const activeDebtorCount = topDebtors.length;

  // Today's total debt from the daily totals array
  const key = todayKey();
  const todayEntry = dailyTotals.find((d) => d.date === key);
  const todayTotal = todayEntry?.total ?? 0;

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
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          /*
           * RefreshControl is the pull-to-refresh affordance for ScrollView.
           * FlatList has `refreshing` + `onRefresh` as direct props because
           * it's designed for lists. ScrollView is generic — you attach a
           * RefreshControl as a prop explicitly.
           *
           * tintColor: the spinner colour on iOS.
           * colors: the spinner colour on Android (array for animation frames).
           */
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
          <View>
            {/*
             * "Habari 👋" — Swahili for "Hello" / "How are you?" (greeting form).
             * In Kenya, shopkeepers greet customers with "Habari?" and customers
             * reply "Nzuri" (good). This single word signals the app was made
             * for Kenyan users — it's the difference between a product and
             * a productised spreadsheet.
             */}
            <Text style={styles.greeting}>Habari 👋</Text>
            <Text style={styles.greetingSub}>Here's your shop overview</Text>
          </View>
          <View style={styles.dateChip}>
            <Text style={styles.dateText}>{formatHeaderDate()}</Text>
          </View>
        </View>

        {/* ── Stat cards — horizontal scroll ─────────────────────────────── */}
        {/*
         * Three cards side by side. On small phones, they may overflow — a
         * horizontal ScrollView lets the user swipe to see all three without
         * shrinking them. `showsHorizontalScrollIndicator={false}` hides the
         * scroll bar indicator (clean look on dark theme).
         */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statCardsRow}
        >
          <StatCard
            label="Total Owed"
            value={formatKES(totalOutstanding)}
            sublabel={`${customerCount} customer${customerCount !== 1 ? 's' : ''}`}
            color={colors.debt}
            icon="📋"
          />
          <StatCard
            label="Active Debtors"
            value={String(activeDebtorCount)}
            sublabel="with unpaid balance"
            color={colors.accent.teal}
            icon="👥"
          />
          <StatCard
            label="Today's Debts"
            value={formatKES(todayTotal)}
            sublabel="recorded today"
            color={todayTotal > 0 ? colors.debt : colors.text.primary}
            icon="📅"
          />
        </ScrollView>

        {/* ── Section: This Week ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="This Week" />
          <WeeklyChart data={dailyTotals} />
        </View>

        {/* ── Section: Top Debtors ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="Top Debtors"
            action="See all"
            onAction={() => {
              // Day 5: navigate to CustomerListScreen (sorted by balance)
              console.log('[Dashboard] navigate to customers');
            }}
          />
          {topDebtors.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No outstanding debts 🎉</Text>
            </View>
          ) : (
            <View style={styles.debtorsContainer}>
              {topDebtors.map((debtor, index) => (
                <TopDebtorRow
                  key={debtor.customerId}
                  debtor={debtor}
                  rank={index + 1}
                  onPress={() => {
                    // Day 5: navigate to that customer's TransactionScreen
                    console.log('[Dashboard] navigate to customer', debtor.customerId);
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Section: Recent Activity ──────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Recent Activity" />
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

        {/* ── Bottom padding for tab bar (added Day 5) ─────────────────── */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View style={headerStyles.container}>
      <Text style={headerStyles.title}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={headerStyles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  action: {
    color: colors.accent.teal,
    fontSize: 12,
    fontWeight: '600',
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root ──────────────────────────────────────────────────────────────────
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
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  greeting: {
    color: colors.text.primary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  greetingSub: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  dateChip: {
    backgroundColor: colors.background.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    marginTop: 4,
  },
  dateText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Stat cards row ────────────────────────────────────────────────────────
  statCardsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 4,
    paddingRight: 4, // prevent last card from being clipped
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    marginTop: 24,
  },

  // ── Debtors container ─────────────────────────────────────────────────────
  debtorsContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    overflow: 'hidden',
    paddingVertical: 4,
  },

  // ── Activity container ────────────────────────────────────────────────────
  activityContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    paddingHorizontal: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.background.tertiary,
    marginHorizontal: 0,
  },

  // ── Empty states ──────────────────────────────────────────────────────────
  emptySection: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 13,
  },

  // ── Bottom padding ────────────────────────────────────────────────────────
  bottomPadding: {
    height: 100, // space for Day 5 tab bar
  },
});
