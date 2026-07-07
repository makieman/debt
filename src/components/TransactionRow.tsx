/**
 * src/components/TransactionRow.tsx
 *
 * Renders a single transaction in the history list.
 *
 * VISUAL CONVENTION: WHY "−" FOR DEBT?
 * In the database, `amount` is ALWAYS positive. The `type` field carries
 * the direction: "debt" = money owed, "payment" = money received.
 * But users don't think in database terms — they think like a bank statement:
 *
 *   "−" RED   = money the customer owes  (their account went down)
 *   "+" GREEN = money received            (shop received payment)
 *
 * Every bank app, M-Pesa, and accounting tool uses this convention.
 * We apply the sign and color at the DISPLAY layer (here), never in the DB.
 * The DB stays clean: amount=15000 always means "150 KES was transacted".
 *
 * LAYOUT: flat row (not a card), stacked in a FlatList.
 * Cards have visual weight — in a long list they feel cluttered.
 * Flat rows with a subtle divider line feel like a real bank statement.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Transaction } from '../types';
import { useThemeContext, Colors } from '../theme';
import { useShopProfile } from '../store/ShopProfileContext';
import { formatMoney } from '../utils/money';
import { formatTransactionDate } from '../utils/dates';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransactionRowProps {
  transaction: Transaction;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionRow({ transaction }: TransactionRowProps) {
  const { colors } = useThemeContext();
  const { profile } = useShopProfile();
  const currency = profile?.currency || 'KES';
  const styles = makeStyles(colors);
  const isDebt = transaction.type === 'debt';
  const amountColor = isDebt ? colors.debt : colors.payment;
  const amountPrefix = isDebt ? '−' : '+';  // visual direction sign
  const iconChar = isDebt ? '−' : '+';

  // Fallback label when no note was provided
  const label = transaction.note || (isDebt ? 'Debt' : 'Payment');
  const dateString = formatTransactionDate(transaction.createdAt);

  return (
    <View style={styles.wrapper}>
      {/* Divider line above the row — gives a ledger/statement feel */}
      <View style={styles.divider} />

      <View style={styles.row}>
        {/* Left: icon circle showing + or − */}
        <View style={[styles.iconCircle, { borderColor: amountColor }]}>
          <Text style={[styles.iconChar, { color: amountColor }]}>
            {iconChar}
          </Text>
        </View>

        {/* Center: note text + date */}
        <View style={styles.center}>
          <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
          <Text style={styles.date}>{dateString}</Text>
        </View>

        {/* Right: formatted amount with direction prefix */}
        <Text style={[styles.amount, { color: amountColor }]}>
          {amountPrefix}{formatMoney(transaction.amount, currency)}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrapper: {
    // No card background — flat row on the screen background
  },
  divider: {
    height: 1,
    backgroundColor: colors.background.tertiary,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // background is the screen primary so it "punches through" the list bg
    backgroundColor: colors.background.primary,
    flexShrink: 0,
  },
  iconChar: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  center: {
    flex: 1,            // takes all remaining space between icon and amount
    gap: 2,
  },
  label: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  date: {
    color: colors.text.muted,
    fontSize: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 0,      // never shrink amount text — it must always be readable
  },
});
