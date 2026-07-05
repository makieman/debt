/**
 * src/screens/CustomerListScreen.tsx
 *
 * The main screen of Duka Deni — redesigned to match the premium flat look,
 * support horizontal list spacing, and filter on clicking summary cards.
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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { useCustomers } from "../hooks/useCustomers";
import { CustomerCard } from "../components/CustomerCard";
import { EmptyState } from "../components/EmptyState";
import { AddCustomerModal } from "../components/AddCustomerModal";
import { CustomerListNavProp } from "../navigation/types";
import { CustomerWithBalance } from "../types";

// Helper to format KES amount
function formatKES(amount: number): string {
  const shillings = amount / 100;
  return `KES ${shillings.toLocaleString()}`;
}

export function CustomerListScreen() {
  const { customers, totalOwed, totalPaid, loading, error, refresh } = useCustomers();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CustomerListNavProp>();

  // ── State ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'owes' | 'settled'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleModalSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleCardPress = useCallback((customer: CustomerWithBalance) => {
    navigation.navigate('Transaction', { customer });
  }, [navigation]);

  // ── Filtered customer list ───────────────────────────────────────────────
  const filteredCustomers = customers.filter((c) => {
    // 1. Search Query filter
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone?.toLowerCase().includes(q) ?? false);

    if (!matchesSearch) return false;

    // 2. Filter Mode filter
    if (filterMode === 'owes') {
      return c.balance > 0;
    }
    if (filterMode === 'settled') {
      return c.balance <= 0;
    }
    return true;
  });

  // Handler for summary card clicks
  const selectFilter = (mode: 'all' | 'owes' | 'settled') => {
    setFilterMode(mode);
    setShowFilters(true); // make sure filter bar is open to show active filter feedback
  };

  // ── Render: loading state ─────────────────────────────────────────────────
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
      </View>

      {/* ── Search & Filter Bar ─────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.text.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search customers..."
            placeholderTextColor={colors.text.muted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && Platform.OS === "android" && (
            <Pressable onPress={() => setSearchQuery("")} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setShowFilters(!showFilters)}
          style={[
            styles.filterButton,
            (showFilters || filterMode !== "all") && styles.filterButtonActive,
          ]}
        >
          <Ionicons
            name="funnel"
            size={18}
            color={showFilters || filterMode !== "all" ? colors.accent.teal : colors.text.primary}
          />
        </Pressable>
      </View>

      {/* ── Filter Chips (Toggled via Funnel Icon or Card Clicks) ─────────── */}
      {showFilters && (
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFilterMode("all")}
            style={[styles.filterChip, filterMode === "all" && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterMode === "all" && styles.filterChipTextActive]}>
              All ({customers.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode("owes")}
            style={[styles.filterChip, filterMode === "owes" && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterMode === "owes" && styles.filterChipTextActive]}>
              Owes ({customers.filter((c) => c.balance > 0).length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode("settled")}
            style={[styles.filterChip, filterMode === "settled" && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterMode === "settled" && styles.filterChipTextActive]}>
              Settled ({customers.filter((c) => c.balance <= 0).length})
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Interactive Stats Row ──────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <Pressable
          onPress={() => selectFilter("all")}
          style={({ pressed }) => [
            styles.statCard,
            filterMode === "all" && styles.statCardActiveAll,
            pressed && styles.statCardPressed,
          ]}
        >
          <Text style={styles.statLabel}>Total Customers</Text>
          <Text style={styles.statValueDark}>{customers.length}</Text>
        </Pressable>

        <Pressable
          onPress={() => selectFilter("owes")}
          style={({ pressed }) => [
            styles.statCard,
            filterMode === "owes" && styles.statCardActiveOwed,
            pressed && styles.statCardPressed,
          ]}
        >
          <Text style={styles.statLabel}>Total Owed</Text>
          <Text style={styles.statValueRed}>{formatKES(totalOwed)}</Text>
        </Pressable>

        <Pressable
          onPress={() => selectFilter("settled")}
          style={({ pressed }) => [
            styles.statCard,
            filterMode === "settled" && styles.statCardActivePaid,
            pressed && styles.statCardPressed,
          ]}
        >
          <Text style={styles.statLabel}>Total Paid</Text>
          <Text style={styles.statValueGreen}>{formatKES(totalPaid)}</Text>
        </Pressable>
      </View>

      {/* ── Customer List ──────────────────────────────────────────────────── */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            balance={item.balance}
            onPress={() => handleCardPress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          searchQuery || filterMode !== "all" ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                No matching customers found.
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // ── Search & Filter ────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: 10,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  filterButtonActive: {
    borderColor: colors.accent.teal + "40",
    backgroundColor: colors.accent.tealDim,
  },

  // ── Filter Row ─────────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  filterChipActive: {
    backgroundColor: colors.accent.teal,
    borderColor: colors.accent.teal,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },

  // ── Stats Row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  statCardActiveAll: {
    borderColor: colors.text.primary + "40",
    backgroundColor: colors.background.secondary,
  },
  statCardActiveOwed: {
    borderColor: colors.debt + "60",
    backgroundColor: colors.debt + "08",
  },
  statCardActivePaid: {
    borderColor: colors.payment + "60",
    backgroundColor: colors.payment + "08",
  },
  statCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  statValueDark: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  statValueRed: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.debt,
  },
  statValueGreen: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.payment,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: {
    backgroundColor: colors.background.primary,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: colors.background.tertiary,
    marginLeft: 76,
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
    borderRadius: 28,
    backgroundColor: colors.accent.teal,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
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
    marginTop: -2,
  },
});
