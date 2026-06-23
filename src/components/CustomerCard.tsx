/**
 * src/components/CustomerCard.tsx
 *
 * A single row in the customer list. Displays:
 *   - Initials circle (teal, left)
 *   - Customer name + phone (center)
 *   - Balance amount and label (right, color-coded)
 *
 * PRESSABLE vs TOUCHABLEOPACITY:
 * TouchableOpacity (the old API) animates opacity on press. That's all it can do.
 * Pressable (2020+) gives you a `pressed` boolean in the style prop, so you
 * can change ANYTHING on press — opacity, background color, scale, border, etc.
 * It also has proper support for long-press and concurrent React. Use Pressable
 * for all new code.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Customer } from "../types";
import { colors } from "../theme";
import { getInitials } from "../utils/strings"; // ← shared util (refactored from local copy)

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomerCardProps {
  customer: Customer;
  balance: number;
  onPress: () => void;
}

// ─── Helper: format KES amount ────────────────────────────────────────────────

function formatKES(amount: number): string {
  // toLocaleString with 'en-KE' would add commas for thousands: 1,500
  // We keep it simple for now — Day 3 we can add a proper formatter.
  return `KES ${amount.toLocaleString()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerCard({ customer, balance, onPress }: CustomerCardProps) {
  const initials = getInitials(customer.name);
  const isSettled = balance === 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed, // dim the card while finger is down
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}, ${isSettled ? "settled" : `owes ${formatKES(balance)}`}`}
    >
      {/* ── Left: Initials circle ─────────────────────────────────────────── */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* ── Center: Name + phone ──────────────────────────────────────────── */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {customer.name}
        </Text>
        {customer.phone ? (
          <Text style={styles.phone} numberOfLines={1}>
            {customer.phone}
          </Text>
        ) : (
          <Text style={styles.phoneEmpty}>No phone</Text>
        )}
      </View>

      {/* ── Right: Balance ────────────────────────────────────────────────── */}
      <View style={styles.balanceContainer}>
        {isSettled ? (
          <>
            <Text style={styles.settledAmount}>Settled</Text>
            <Text style={[styles.balanceLabel, { color: colors.payment }]}>✓</Text>
          </>
        ) : (
          <>
            <Text style={styles.debtAmount}>{formatKES(balance)}</Text>
            <Text style={styles.balanceLabel}>owes</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// We use StyleSheet here (not NativeWind) because these values come directly
// from our design tokens (colors). NativeWind works well for layout and
// spacing utilities; StyleSheet is better when referencing JS constants.
// In a real production app, you'd extend tailwind.config.js with your color
// tokens so you could write className="bg-[#00C896]" — that's a Day 6 task.

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,           // rounded-2xl equivalent
    borderWidth: 1,
    borderColor: colors.background.tertiary,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardPressed: {
    opacity: 0.75,
  },

  // ── Avatar ──────────────────────────────────────────────────────────────────
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,           // perfect circle: borderRadius = width/2
    backgroundColor: colors.accent.tealDim,
    borderWidth: 2,
    borderColor: colors.accent.teal,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,              // don't let long names shrink the circle
  },
  avatarText: {
    color: colors.accent.teal,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Info (name + phone) ──────────────────────────────────────────────────────
  info: {
    flex: 1,                    // take all remaining space between avatar and balance
    gap: 2,
  },
  name: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  phone: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  phoneEmpty: {
    color: colors.text.muted,
    fontSize: 13,
    fontStyle: "italic",
  },

  // ── Balance ──────────────────────────────────────────────────────────────────
  balanceContainer: {
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
  },
  debtAmount: {
    color: colors.debt,
    fontSize: 15,
    fontWeight: "700",
  },
  settledAmount: {
    color: colors.payment,
    fontSize: 15,
    fontWeight: "700",
  },
  balanceLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
