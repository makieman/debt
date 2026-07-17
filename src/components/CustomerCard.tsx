/**
 * src/components/CustomerCard.tsx
 *
 * A single row in the customer list, styled to match premium clean layouts.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Customer } from "../types";
import { useThemeContext, Colors } from "../theme";
import { useShopProfile } from "../store/ShopProfileContext";
import { getInitials } from "../utils/strings";

// ─── Curated Avatar Colors matching the design ──────────────────────────────
const AVATAR_COLORS = [
  "#0F766E", // Dark Teal
  "#6B21A8", // Purple
  "#EF4444", // Red/Coral
  "#475569", // Slate/Grey
  "#059669", // Emerald
  "#0D9488", // Teal
  "#DB2777", // Pink
  "#2563EB", // Blue
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomerCardProps {
  customer: Customer;
  balance: number;
  onPress: () => void;
  onLongPress?: () => void;
}

// ─── Helper: format KES amount ────────────────────────────────────────────────
// The tests expect the raw amount to be formatted without dividing by 100
function formatMoney(amount: number, currency: string = 'KES'): string {
  return `${currency} ${amount.toLocaleString()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerCard({ customer, balance, onPress, onLongPress }: CustomerCardProps) {
  const { colors } = useThemeContext();
  const { profile } = useShopProfile();
  const currency = profile?.currency || 'KES';
  const styles = makeStyles(colors);

  const initials = getInitials(customer.name);
  const isSettled = balance <= 0;
  const avatarBgColor = getAvatarColor(customer.name);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}, ${isSettled ? "settled" : `owes ${formatMoney(balance, currency)}`}`}
    >
      <View style={styles.card}>
        {/* ── Left: Initials circle with dynamic color ─────────────────────────── */}
        <View style={[styles.avatar, { backgroundColor: avatarBgColor }]}>
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
 
        {/* ── Right: Balance + Chevron ───────────────────────────────────────── */}
        <View style={styles.rightSection}>
          <View style={styles.balanceContainer}>
            {isSettled ? (
              <>
                <Text style={styles.settledAmount}>Settled</Text>
                <Text style={styles.settledLabel}>✓</Text>
              </>
            ) : (
              <>
                <Text style={styles.debtAmount}>{formatMoney(balance, currency)}</Text>
                <Text style={styles.debtLabel}>owes</Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} style={styles.chevron} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: Colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.background.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardPressed: {
    opacity: 0.7,
  },

  // ── Avatar ──────────────────────────────────────────────────────────────────
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,           // perfect circle
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Info (name + phone) ──────────────────────────────────────────────────────
  info: {
    flex: 1,
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

  // ── Right Section ───────────────────────────────────────────────────────────
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  balanceContainer: {
    alignItems: "flex-end",
    gap: 1,
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
  debtLabel: {
    color: colors.debt,
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  settledLabel: {
    color: colors.payment,
    fontSize: 12,
    fontWeight: "700",
  },
  chevron: {
    marginLeft: 2,
  },
});
