/**
 * src/components/TopDebtorRow.tsx
 *
 * A single row in the "Top Debtors" section of the Dashboard.
 *
 * Displays: rank number → initials circle → name/label → balance (right-aligned)
 * Rank 1 gets a slightly highlighted background to make the #1 debtor
 * immediately visible without any extra scanning effort.
 *
 * ─── REUSE vs NEW COMPONENT ────────────────────────────────────────────────────
 * This component uses the same initials circle as CustomerCard. Before the
 * refactor in this day, `getInitials` was defined inside CustomerCard.tsx.
 * We extracted it to src/utils/strings.ts so both components share one definition.
 * That is DRY (Don't Repeat Yourself) applied to a utility function.
 *
 * ─── Common mistake ────────────────────────────────────────────────────────────
 * Developers sometimes make a "rank" component with a giant `rank` conditional
 * tree: if (rank === 1) renderGold(), else if (rank === 2) renderSilver(), etc.
 * For a simple list, a single highlighted background for rank 1 communicates
 * the same information with far less code. Reserve conditional rendering for
 * genuinely different visual structures, not just color swaps.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TopDebtor } from '../types';
import { colors } from '../theme';
import { getInitials } from '../utils/strings'; // DRY: same util as CustomerCard
import { formatKES } from '../utils/money';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopDebtorRowProps {
  debtor: TopDebtor;
  rank: number;          // 1-based position in the leaderboard
  onPress: () => void;   // navigate to that customer's TransactionScreen
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopDebtorRow({ debtor, rank, onPress }: TopDebtorRowProps) {
  const initials = getInitials(debtor.name);
  const isTopRank = rank === 1;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isTopRank && styles.rowHighlighted,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${debtor.name}, rank ${rank}, owes ${formatKES(debtor.balance)}`}
    >
      {/* ── Rank number ─────────────────────────────────────────────────── */}
      {/* A small circle with the rank number. Rank 1 gets a teal tint. */}
      <View style={[styles.rankCircle, isTopRank && styles.rankCircleTop]}>
        <Text style={[styles.rankText, isTopRank && styles.rankTextTop]}>
          {rank}
        </Text>
      </View>

      {/* ── Initials circle ─────────────────────────────────────────────── */}
      {/* Same initials logic as CustomerCard — extracted into utils/strings */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* ── Name + "owes" label ─────────────────────────────────────────── */}
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>{debtor.name}</Text>
        <Text style={styles.owesLabel}>owes</Text>
      </View>

      {/* ── Balance (right-aligned) ──────────────────────────────────────── */}
      <Text style={styles.balance} numberOfLines={1}>
        {formatKES(debtor.balance)}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  rowHighlighted: {
    // Rank 1 gets a subtle secondary background to stand out from the list
    backgroundColor: colors.background.secondary,
  },
  rowPressed: {
    opacity: 0.75,
  },

  // ── Rank circle ──────────────────────────────────────────────────────────
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankCircleTop: {
    backgroundColor: colors.accent.tealDim,
    borderWidth: 1,
    borderColor: colors.accent.teal,
  },
  rankText: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  rankTextTop: {
    color: colors.accent.teal,
  },

  // ── Initials avatar ──────────────────────────────────────────────────────
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.tealDim,
    borderWidth: 1.5,
    borderColor: colors.accent.teal,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: colors.accent.teal,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── Name section ─────────────────────────────────────────────────────────
  nameContainer: {
    flex: 1,
    gap: 1,
  },
  name: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  owesLabel: {
    color: colors.text.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Balance ──────────────────────────────────────────────────────────────
  balance: {
    color: colors.debt,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 0,
  },
});
