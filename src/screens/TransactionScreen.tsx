/**
 * src/screens/TransactionScreen.tsx — Day 5 update
 *
 * The per-customer transaction history and action screen.
 *
 * This screen is used every time a shopkeeper records a debt or payment.
 * It must:
 *   1. Show the current balance at a glance (the card at the top)
 *   2. Make both primary actions (debt / payment) immediately visible
 *   3. Show a trustworthy history list (newest first)
 *
 * ─── DAY 5 CHANGES ───────────────────────────────────────────────────────────
 *
 * Old (Day 3 scaffolding):
 *   - Received `customer` and `onBack` as direct props
 *   - Rendered by App.tsx which held the customer in state
 *
 * New (Day 5 — React Navigation):
 *   - `customer` is read from route.params via useRoute()
 *   - Back button uses navigation.goBack() via useNavigation()
 *   - No props at all — navigators render screens with no props
 *
 * ─── WHY SCREENS IN A NAVIGATOR RECEIVE NO PROPS ─────────────────────────────
 *
 * React Navigation renders our screen components internally:
 *   <Stack.Screen name="Transaction" component={TransactionScreen} />
 * It calls TransactionScreen() with NO extra props (other than the built-in
 * `navigation` and `route` props React Navigation injects automatically).
 * We cannot pass custom props from a parent component because no parent
 * component renders TransactionScreen — the navigator does.
 *
 * The correct data channel between screens is route.params:
 *   navigation.navigate('Transaction', { customer })  ← sender
 *   const { customer } = useRoute().params            ← receiver
 *
 * ─── goBack() vs navigate() FOR A BACK BUTTON ────────────────────────────────
 *
 * WRONG: navigation.navigate('CustomerList', {})
 *   This pushes a NEW CustomerList screen onto the stack every time.
 *   After 5 taps of "back", the stack has 5 CustomerList screens.
 *   The user would need to tap "back" 5 more times to exit the stack.
 *   This is a very common React Navigation beginner bug.
 *
 * CORRECT: navigation.goBack()
 *   This POPS the current screen (TransactionScreen) off the stack.
 *   The screen that was below it (CustomerListScreen) becomes visible.
 *   Stack shrinks by 1. Correct behavior.
 *
 * ─── ANDROID HARDWARE BACK BUTTON ───────────────────────────────────────────
 *
 * React Navigation automatically listens to the Android hardware back button.
 * When pressed, it calls goBack() on the active navigator.
 * Our custom back arrow does exactly the same thing — it just provides a
 * visual button that matches our dark theme. Both routes lead to the same
 * goBack() call, so they're equivalent.
 *
 * ─── DESIGN DECISIONS (unchanged from Day 3) ─────────────────────────────────
 *
 * TWO SEPARATE MODAL STATE BOOLEANS (showDebtModal / showPaymentModal):
 * We could use one variable: `activeModal: 'debt' | 'payment' | null`
 * But then we'd have one <AddTransactionModal> and we'd need to switch its
 * `type` prop on the fly. If the user taps quickly between buttons while a
 * modal is animating, we'd get a type mismatch mid-animation. Two booleans
 * means two completely independent modal instances — simpler, safer.
 *
 * NO OPTIMISTIC UI:
 * We wait for the DB write to complete before refreshing. SQLite writes take
 * < 5ms on device — the delay is imperceptible. If we showed optimistic data
 * and the write failed, we'd have to roll back the UI, which is complex. We
 * choose correctness over a tiny perceived speed improvement.
 *
 * OVERPAYMENT HANDLING:
 * Balance can go negative if a payment exceeds total debt. We show "Overpaid"
 * in green (colors.payment) instead of a confusing "−KES X". The shopkeeper
 * understands: the customer has credit for their next purchase. We never crash
 * on negative balances — Math.abs() gives us a positive display value.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../types';
import { colors } from '../theme';
import { formatKES } from '../utils/money';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionRow } from '../components/TransactionRow';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { TransactionRouteProp, TransactionNavProp } from '../navigation/types';

// ─── Component ────────────────────────────────────────────────────────────────
//
// No props interface — screens rendered by a navigator receive no custom props.
// All data comes from route.params (the customer object) and navigation context.

export function TransactionScreen() {
  const insets = useSafeAreaInsets();  // respect notch / home indicator

  // ── Navigation hooks ───────────────────────────────────────────────────────
  //
  // useRoute() reads the params that were passed when this screen was pushed:
  //   navigation.navigate('Transaction', { customer })
  // The generic <TransactionRouteProp> types route.params.customer as Customer.
  //
  // useNavigation() gives us goBack() to pop this screen off the stack.
  // The typed generic ensures setOptions() and other calls are also typed.
  const route = useRoute<TransactionRouteProp>();
  const navigation = useNavigation<TransactionNavProp>();
  const { customer } = route.params;

  // Data from hook — both transactions and balance fetched together
  const { transactions, balance, loading, error, refresh } = useTransactions(customer.id);

  // Two independent modal booleans — see architecture note above
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ── Balance card config ────────────────────────────────────────────────────
  // Determines the color and label based on the balance value
  const balanceDisplay = (() => {
    if (balance > 0) {
      return {
        label: 'Total owed',
        amount: formatKES(balance),
        color: colors.debt,
      };
    }
    if (balance < 0) {
      // Overpayment: show absolute value in green
      return {
        label: 'Overpaid',
        amount: formatKES(Math.abs(balance)),
        color: colors.payment,
      };
    }
    // Exactly zero: all settled
    return {
      label: 'All settled',
      amount: formatKES(0),
      color: colors.payment,
    };
  })();

  // ── After a successful transaction ─────────────────────────────────────────
  // Called by AddTransactionModal after the DB write succeeds.
  // refresh() re-fetches both transactions and balance together (no race cond).
  const handleTransactionSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // ── List rendering ────────────────────────────────────────────────────────
  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => <TransactionRow transaction={item} />,
    []
  );

  const keyExtractor = useCallback(
    (item: Transaction) => String(item.id),
    []
  );

  // ── Header (rendered above the FlatList) ─────────────────────────────────
  // We render the balance card + action buttons as the FlatList's ListHeaderComponent
  // so they scroll together with the transaction list on small screens.
  const ListHeader = (
    <View style={styles.listHeader}>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{balanceDisplay.label}</Text>
        <Text style={[styles.balanceAmount, { color: balanceDisplay.color }]}>
          {balanceDisplay.amount}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {/* Add Debt button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.debtButton,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={() => setShowDebtModal(true)}
          accessibilityLabel="Add Debt"
          accessibilityRole="button"
        >
          <Text style={[styles.actionIcon, { color: colors.debt }]}>+</Text>
          <Text style={[styles.actionLabel, { color: colors.debt }]}>Add Debt</Text>
        </Pressable>

        {/* Record Payment button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.paymentButton,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={() => setShowPaymentModal(true)}
          accessibilityLabel="Record Payment"
          accessibilityRole="button"
        >
          <Text style={[styles.actionIcon, { color: colors.payment }]}>✓</Text>
          <Text style={[styles.actionLabel, { color: colors.payment }]}>Record Payment</Text>
        </Pressable>
      </View>

      {/* Section heading */}
      <Text style={styles.sectionLabel}>TRANSACTION HISTORY</Text>
    </View>
  );

  // ── Empty state for transactions ──────────────────────────────────────────
  const EmptyTransactions = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap "Add Debt" to record the first transaction
      </Text>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Screen header ── */}
      <View style={styles.header}>
        {/*
         * Back button — calls navigation.goBack() to POP TransactionScreen.
         * DO NOT use navigation.navigate() here — that would PUSH a new screen
         * instead of popping the current one, causing the stack to grow forever.
         *
         * The Android hardware back button also calls goBack() automatically
         * via React Navigation's BackHandler integration.
         */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customer.name}
          </Text>
          {customer.phone && (
            <Text style={styles.customerPhone}>{customer.phone}</Text>
          )}
        </View>

        {/* Spacer to keep name centered */}
        <View style={styles.backButton} />
      </View>

      {/* ── Loading state ── */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.accent.teal} />
        </View>
      )}

      {/* ── Error state ── */}
      {error && !loading && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Pressable onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* ── Main content: balance card + actions + transaction list ── */}
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={loading ? null : EmptyTransactions}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent.teal}
            colors={[colors.accent.teal]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Debt modal ── */}
      <AddTransactionModal
        visible={showDebtModal}
        type="debt"
        customerId={customer.id}
        onSuccess={handleTransactionSuccess}
        onClose={() => setShowDebtModal(false)}
      />

      {/* ── Payment modal ── */}
      <AddTransactionModal
        visible={showPaymentModal}
        type="payment"
        customerId={customer.id}
        onSuccess={handleTransactionSuccess}
        onClose={() => setShowPaymentModal(false)}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.tertiary,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  customerPhone: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Loading / error
  loadingOverlay: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.debt,
  },
  errorText: {
    color: colors.debt,
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    color: colors.accent.teal,
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 12,
  },

  // FlatList content
  listContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },

  // List header (balance card + action buttons + section label)
  listHeader: {
    padding: 16,
    gap: 16,
  },

  // Balance card
  balanceCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  debtButton: {
    backgroundColor: `${colors.debt}18`,    // debt color at ~10% opacity
    borderColor: colors.debt,
  },
  paymentButton: {
    backgroundColor: colors.accent.tealDim,
    borderColor: colors.payment,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
