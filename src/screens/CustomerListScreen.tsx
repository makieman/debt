/**
 * src/screens/CustomerListScreen.tsx
 *
 * The main screen of Duka Deni — the first thing a shopkeeper sees.
 *
 * Composes:
 *   useCustomers hook   → data layer (customers + balances)
 *   CustomerCard        → individual customer row
 *   EmptyState          → zero-state when no customers
 *   AddCustomerModal    → slide-up form to add a new customer
 *
 * ─── KEY CONCEPTS ────────────────────────────────────────────────────────────
 *
 * FLATLIST vs SCROLLVIEW:
 * ScrollView renders ALL children immediately, even off-screen ones.
 * 500 customers = 500 cards in memory at once = slow render + high memory use.
 * FlatList virtualises the list: only renders visible items + a buffer.
 * Cards that scroll off screen are unmounted (or recycled). Memory stays flat.
 * Rule: any list of unknown or large length → always FlatList, never ScrollView.
 *
 * KEYEXTRACTOR:
 * FlatList needs a stable, unique key per item so React can track which
 * item is which across re-renders. We use customer.id (SQLite auto-increment).
 * Using the array index as key is a bug: if you insert at position 0, every
 * item shifts index → React thinks every item changed → full re-render.
 *
 * TOTAL OWED CALCULATION:
 * We fetch balances for each customer in a useEffect after customers load.
 * Why not a single SQL SUM? Because getBalanceForCustomer is already written
 * and correct. A future optimisation (Day 4) will be a single SQL query:
 *   SELECT customerId, SUM(CASE ...) AS balance FROM transactions GROUP BY customerId
 * For now, N individual queries is fine for small lists and keeps the code readable.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { useCustomers } from "../hooks/useCustomers";
import { CustomerCard } from "../components/CustomerCard";
import { EmptyState } from "../components/EmptyState";
import { AddCustomerModal } from "../components/AddCustomerModal";


// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerListScreen() {
  const { customers, loading, error, refresh } = useCustomers();
  // customers is now CustomerWithBalance[] — balance is included in each item
  // (N+1 fix: was 1 query per customer for balance, now 1 total query)
  const insets = useSafeAreaInsets(); // respect notch / home bar safe area

  // ── State ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  // ── Derived: total owed across all customers ──────────────────────────────
  // Sum only positive balances (negative = overpaid, which we count as 0 owed)
  const totalOwed = customers.reduce(
    (sum, c) => sum + Math.max(0, c.balance),
    0
  );

  // ── Derived: filtered customer list ─────────────────────────────────────
  // We filter in JS (not SQL) because the full list is already in memory.
  // A SQL WHERE LIKE query would be the right optimisation for 1000+ customers.
  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleModalSuccess = useCallback(() => {
    refresh(); // re-fetch customer list after adding a new one
  }, [refresh]);

  const handleCardPress = useCallback((id: number, name: string) => {
    // Navigation to transaction screen comes on Day 5.
    // For now, log so we can confirm Pressable works.
    console.log("Pressed:", name);
  }, []);

  // ── Render: loading state ─────────────────────────────────────────────────
  // We show this only on the very first load (when customers is empty AND loading)
  // not on pull-to-refresh (where we already have data and just refresh it).
  if (loading && customers.length === 0) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent.teal} />
        <Text style={styles.loadingText}>Loading customers...</Text>
      </View>
    );
  }

  // ── Render: error state ───────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>⚠️ Failed to load customers</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
        <Pressable onPress={refresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render: main screen ───────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Duka Deni</Text>
          <Text style={styles.appSubtitle}>
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
          </Text>
        </View>

        <View style={styles.totalOwedBadge}>
          <Text style={styles.totalOwedAmount}>
            KES {totalOwed.toLocaleString()}
          </Text>
          <Text style={styles.totalOwedLabel}>total owed</Text>
        </View>
      </View>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        {/* Magnifier icon — Unicode character, no library needed */}
        <Text style={styles.searchIcon}>🔍</Text>

        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search customers..."
          placeholderTextColor={colors.text.muted}
          returnKeyType="search"
          clearButtonMode="while-editing" // iOS-only: shows X button
        />

        {/* Clear button for Android (clearButtonMode doesn't work there) */}
        {searchQuery.length > 0 && Platform.OS === "android" && (
          <Pressable
            onPress={() => setSearchQuery("")}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* ── Customer list ───────────────────────────────────────────────────── */}
      {/*
        FlatList renders only the items currently visible on screen plus a
        buffer (windowSize prop). Cards that scroll off screen are unmounted.
        This is why FlatList handles 10,000 items as smoothly as 10.

        Key props:
          data             — the array of items to render
          keyExtractor     — returns a STABLE, UNIQUE string key per item
                             (must not change between renders)
          renderItem       — renders a single item; receives { item, index }
          ItemSeparatorComponent — renders between items (not before first or after last)
          ListEmptyComponent     — rendered when data is empty
          refreshing       — boolean: true while pull-to-refresh is happening
          onRefresh        — called when user pulls down to trigger a refresh
          contentContainerStyle  — style applied to the inner scroll container
                                   (needed to make flex work for EmptyState centering)
      */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            balance={item.balance}  // balance now comes from the JOIN query
            onPress={() => handleCardPress(item.id, item.name)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          searchQuery ? (
            // Different message when empty because of filtering vs genuinely empty
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                No customers match "{searchQuery}"
              </Text>
            </View>
          ) : (
            <EmptyState />
          )
        }
        refreshing={loading}
        onRefresh={refresh}
        contentContainerStyle={[
          styles.listContent,
          filteredCustomers.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Floating + button ───────────────────────────────────────────────── */}
      {/*
        We use position: "absolute" to pin the button to the bottom-right
        of its parent container. The parent (View with flex:1) is the reference
        point. paddingBottom uses insets.bottom to avoid the home bar on iPhone.
      */}
      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 24 },
          pressed && styles.fabPressed,
        ]}
        accessibilityLabel="Add new customer"
        accessibilityRole="button"
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* ── Add Customer Modal ──────────────────────────────────────────────── */}
      <AddCustomerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleModalSuccess}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // ── Loading / Error states ────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 15,
  },
  errorText: {
    color: colors.debt,
    fontSize: 18,
    fontWeight: "600",
  },
  errorSubtext: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.background.secondary,
    borderRadius: 10,
  },
  retryText: {
    color: colors.accent.teal,
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  appName: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: 2,
  },
  totalOwedBadge: {
    alignItems: "flex-end",
    backgroundColor: colors.accent.tealDim,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent.teal + "40",
  },
  totalOwedAmount: {
    color: colors.debt,
    fontSize: 18,
    fontWeight: "700",
  },
  totalOwedLabel: {
    color: colors.text.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    color: colors.text.muted,
    fontSize: 14,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // leave space for FAB so last card isn't hidden under it
  },
  listContentEmpty: {
    flex: 1, // allow EmptyState to vertically center inside the scroll container
  },
  separator: {
    height: 12, // gap between cards
  },

  // ── Empty / no results ─────────────────────────────────────────────────────
  noResultsContainer: {
    paddingTop: 60,
    alignItems: "center",
  },
  noResultsText: {
    color: colors.text.muted,
    fontSize: 15,
    textAlign: "center",
  },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,           // perfect circle
    backgroundColor: colors.accent.teal,
    alignItems: "center",
    justifyContent: "center",
    // Shadow (iOS)
    shadowColor: colors.accent.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    // Elevation (Android)
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
  },
  fabIcon: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 34,
    marginTop: -2, // optical centering of the + character
  },
});
