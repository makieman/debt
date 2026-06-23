/**
 * src/components/StatCard.tsx
 *
 * A generic "number at a glance" card for the Dashboard.
 *
 * ─── WHY A GENERIC STATCARD? ──────────────────────────────────────────────────
 * The Dashboard has three stat numbers:
 *   - Total Outstanding
 *   - Active Debtors count
 *   - Today's Debts
 *
 * Each number needs the same visual treatment: a card with a label, a big
 * coloured value, an optional sublabel, and an icon. We have three choices:
 *
 *   Option A — Hardcode all three separately:
 *     <TotalOwedCard />  <ActiveDebtorsCard />  <TodaysDebtCard />
 *     Pro: zero props, no abstraction.
 *     Con: three files, three StyleSheets, three times the maintenance surface.
 *     When you want to tweak the card border radius, you change it THREE times.
 *
 *   Option B — One generic StatCard with props:
 *     <StatCard label="Total Owed" value="KES 12,450" ... />
 *     Pro: one file, one StyleSheet, tested once, changed once.
 *     Con: slight indirection — you have to pass props instead of just seeing
 *          the hardcoded string.
 *
 *   Option C — Over-abstraction:
 *     A data-driven chart/dashboard system with config objects.
 *     Overkill. We have 3 cards. Use Option B.
 *
 * Rule: extract into a generic component when 2+ callers share the SAME
 * visual structure. Don't extract for hypothetical future callers.
 * Don't over-genericise when callers have meaningfully different structures.
 *
 * ─── Common mistake ───────────────────────────────────────────────────────────
 * Developers sometimes make StatCard too generic: adding 20 optional props
 * for every possible variation. This creates a "god component" that's harder
 * to understand than writing separate components. Keep generics focused on
 * the actual shared structure, not every conceivable future variation.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;           // Small uppercase label at top: "TOTAL OWED"
  value: string;           // Large prominent number: "KES 12,450.00"
  sublabel?: string;       // Optional description below value: "8 customers"
  color?: string;          // Color of the value text (default: colors.text.primary)
  icon?: string;           // Emoji/character in top-right corner
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sublabel,
  color = colors.text.primary,
  icon,
}: StatCardProps) {
  return (
    <View style={styles.card}>
      {/* ── Top row: label + icon ──────────────────────────────────────────── */}
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      </View>

      {/* ── Value ─────────────────────────────────────────────────────────── */}
      {/* color prop overrides the default text color — debt amounts are red, */}
      {/* customer counts are teal, etc.                                       */}
      <Text style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>

      {/* ── Sublabel ──────────────────────────────────────────────────────── */}
      {sublabel ? (
        <Text style={styles.sublabel} numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 20,            // rounded-2xl equivalent
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    padding: 16,
    minWidth: 140,               // prevent cards from becoming too narrow
    flex: 1,                     // in a horizontal ScrollView, grow equally
    gap: 4,
  },

  // ── Top row ────────────────────────────────────────────────────────────────
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  icon: {
    fontSize: 18,
    opacity: 0.6,
  },

  // ── Value ──────────────────────────────────────────────────────────────────
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    // color is set via inline style from `color` prop
  },

  // ── Sublabel ───────────────────────────────────────────────────────────────
  sublabel: {
    color: colors.text.secondary,
    fontSize: 11,
    marginTop: 2,
  },
});
