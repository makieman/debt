/**
 * src/components/ActivityFeedRow.tsx
 *
 * A single row in the "Recent Activity" cross-customer feed on the Dashboard.
 *
 * ─── WHY A NEW COMPONENT INSTEAD OF REUSING TransactionRow? ──────────────────
 * TransactionRow (from TransactionScreen) shows a transaction for ONE customer.
 * It doesn't show the customer's name because the entire screen is already about
 * one customer — the name is the screen title.
 *
 * ActivityFeedRow shows a transaction from the GLOBAL feed across ALL customers.
 * The customer's name is the primary identifier here — without it, "KES 500 debt"
 * is meaningless in a list of 10 different customers' transactions.
 *
 * We COULD add an optional `showCustomerName?: boolean` prop to TransactionRow
 * and reuse it. But that turns a simple, focused component into a conditional
 * mess. Each `if (showCustomerName)` is a branch you must mentally track.
 *
 * The rule: reuse a component when it serves the SAME context with minor data
 * variations. Build a new component when the CONTEXT changes meaningfully.
 * TransactionRow = single-customer ledger context.
 * ActivityFeedRow = global feed context. Different enough → new component.
 *
 * The code similarity (~60%) is acceptable duplication because each component
 * can evolve independently. If the activity feed later needs avatars and the
 * transaction screen doesn't, we add them here without touching TransactionRow.
 *
 * ─── Common mistake ────────────────────────────────────────────────────────────
 * Building a "super-component" with 15 optional props to handle every context.
 * The caller site becomes hard to read:
 *   <Row showName showAvatar hideNote colorByType condensed={false} ... />
 * A focused component with clear purpose is always easier to understand.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ActivityItem } from '../types';
import { useThemeContext, Colors } from '../theme';
import { useShopProfile } from '../store/ShopProfileContext';
import { useLanguage } from '../store/LanguageContext';
import { formatMoney } from '../utils/money';
import { formatTransactionDate } from '../utils/dates';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityFeedRowProps {
  item: ActivityItem;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityFeedRow({ item }: ActivityFeedRowProps) {
  const { colors } = useThemeContext();
  const { profile } = useShopProfile();
  const { t } = useLanguage();
  const currency = profile?.currency || 'KES';
  const styles = makeStyles(colors);
  const isDebt = item.type === 'debt';
  const typeColor = isDebt ? colors.debt : colors.payment;

  return (
    <View style={styles.row}>
      {/* ── Type icon circle ───────────────────────────────────────────────── */}
      {/* "+" for payment (money came in), "−" for debt (money owed)           */}
      <View style={[styles.iconCircle, { backgroundColor: isDebt ? colors.debt + '20' : colors.payment + '20' }]}>
        <Text style={[styles.iconText, { color: typeColor }]}>
          {isDebt ? '−' : '+'}
        </Text>
      </View>

      {/* ── Customer name + note ───────────────────────────────────────────── */}
      <View style={styles.textSection}>
        <Text style={styles.customerName} numberOfLines={1}>
          {item.customerName}
        </Text>
        <Text style={styles.noteText} numberOfLines={1}>
          {item.note ?? (isDebt ? t('debtRecorded') : t('paymentReceived'))}
        </Text>
      </View>

      {/* ── Amount + time ─────────────────────────────────────────────────── */}
      <View style={styles.rightSection}>
        <Text style={[styles.amount, { color: typeColor }]} numberOfLines={1}>
          {formatMoney(item.amount, currency)}
        </Text>
        <Text style={styles.time}>
          {formatTransactionDate(item.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },

  // ── Type icon circle ────────────────────────────────────────────────────────
  // Background color is set inline (debt red 12% opacity / payment teal 12% opacity)
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    // color set inline from typeColor
  },

  // ── Name + note ─────────────────────────────────────────────────────────────
  textSection: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  noteText: {
    color: colors.text.muted,
    fontSize: 11,
  },

  // ── Amount + time ───────────────────────────────────────────────────────────
  rightSection: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    // color set inline from typeColor
  },
  time: {
    color: colors.text.muted,
    fontSize: 10,
  },
});
