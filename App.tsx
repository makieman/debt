/**
 * App.tsx — DAY 4 BUILD
 *
 * RESPONSIBILITIES (same as Day 2 + Day 3 + Day 4 additions):
 *   1. Import global.css (MUST be first — initialises NativeWind)
 *   2. Run database migrations on mount
 *   3. Wrap the app in SafeAreaProvider
 *   4. Show loading / error states during migrations
 *   5. Render a temporary screen switcher (Dashboard | Customers)
 *   6. Keep the Day 3 customer→TransactionScreen wiring
 *
 * ─── WHY STATE-BASED NAVIGATION IS SCAFFOLDING ONLY ─────────────────────────
 * We're swapping screens by toggling a `screen` state variable. This works
 * visually but has NONE of the features a real navigation stack provides:
 *
 *   1. No animation: screens appear instantly with no transition.
 *      A real stack animates the new screen sliding in from the right.
 *
 *   2. No back button: the Android hardware back button does nothing.
 *      React Navigation listens to it and pops the stack. We don't.
 *
 *   3. No deep linking: there's no URL/route to link to a specific screen.
 *      React Navigation maps URLs to screens automatically.
 *
 *   4. No history: there's no "stack" of screens. Pressing back has
 *      nowhere to go except the state we set manually.
 *
 *   5. No tab bar: navigation tabs are a first-class concept in
 *      React Navigation (createBottomTabNavigator). We fake them with buttons.
 *
 * This pattern (state-based screen switching) is ONLY acceptable during
 * active development when the navigation library isn't wired up yet.
 * Never ship it to users. Day 5 replaces this with React Navigation.
 */

import "./global.css"; // ← MUST be the very first import — initialises NativeWind

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { db, runMigrations } from "./src/db";
import { colors } from "./src/theme";
import { CustomerListScreen } from "./src/screens/CustomerListScreen";
import { TransactionScreen } from "./src/screens/TransactionScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { getAllCustomers } from "./src/repositories/customers";
import { Customer } from "./src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type MigrationState = "pending" | "running" | "done" | "error";

// The three top-level screens reachable from the tab switcher
type Screen = "dashboard" | "customers";

// ─── App Component ─────────────────────────────────────────────────────────────

export default function App() {
  const [migrationState, setMigrationState] = useState<MigrationState>("pending");
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // DAY 4 SCAFFOLDING: active top-level screen tab
  const [activeScreen, setActiveScreen] = useState<Screen>("dashboard");

  // DAY 3 SCAFFOLDING: navigate to TransactionScreen by selecting a customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // ── Run migrations on mount ───────────────────────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      try {
        setMigrationState("running");
        await runMigrations(db);
        setMigrationState("done");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[App] Migration failed:", msg);
        setMigrationError(msg);
        setMigrationState("error");
      }
    }

    bootstrap();
  }, [retryCount]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (migrationState === "pending" || migrationState === "running") {
    return (
      <SafeAreaProvider>
        <View style={styles.centeredScreen}>
          <StatusBar style="light" />
          <ActivityIndicator size="large" color={colors.accent.teal} />
          <Text style={styles.loadingLabel}>Starting Duka Deni...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // ── Error screen ──────────────────────────────────────────────────────────
  if (migrationState === "error") {
    return (
      <SafeAreaProvider>
        <View style={styles.centeredScreen}>
          <StatusBar style="light" />
          <Text style={styles.errorTitle}>⚠️ Database Error</Text>
          <Text style={styles.errorMessage}>
            The app failed to start. Please restart.{"\n"}
            {migrationError}
          </Text>
          <Pressable
            onPress={() => {
              setMigrationState("pending");
              setMigrationError(null);
              setRetryCount((n) => n + 1);
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  // DAY 4 SCAFFOLDING:
  // If a customer is selected → show their TransactionScreen
  // Otherwise → show the active tab (Dashboard or Customers)
  // On Day 5 this entire block is replaced with React Navigation.
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      {selectedCustomer ? (
        // Transaction screen: wired with Day 3 customer-selection logic
        <TransactionScreen
          customer={selectedCustomer}
          onBack={() => setSelectedCustomer(null)}
        />
      ) : (
        <View style={styles.appContainer}>
          {/* ── Temporary tab switcher ────────────────────────────────── */}
          {/*
           * This is scaffold navigation. On Day 5, replace with:
           *   createBottomTabNavigator from React Navigation.
           * The tab bar will be real, animated, and handle the back button.
           */}
          <View style={styles.tabBar}>
            <Pressable
              id="tab-dashboard"
              style={[styles.tab, activeScreen === "dashboard" && styles.tabActive]}
              onPress={() => setActiveScreen("dashboard")}
            >
              <Text style={[styles.tabText, activeScreen === "dashboard" && styles.tabTextActive]}>
                📊 Dashboard
              </Text>
            </Pressable>
            <Pressable
              id="tab-customers"
              style={[styles.tab, activeScreen === "customers" && styles.tabActive]}
              onPress={() => setActiveScreen("customers")}
            >
              <Text style={[styles.tabText, activeScreen === "customers" && styles.tabTextActive]}>
                👥 Customers
              </Text>
            </Pressable>
          </View>

          {/* ── Screen content ────────────────────────────────────────── */}
          {activeScreen === "dashboard" ? (
            <DashboardScreen />
          ) : (
            <CustomerListScreen />
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centeredScreen: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  loadingLabel: {
    color: colors.text.secondary,
    fontSize: 15,
  },
  errorTitle: {
    color: colors.debt,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  errorMessage: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent.teal,
  },
  retryText: {
    color: colors.accent.teal,
    fontWeight: "600",
    fontSize: 15,
  },

  // ── Main app layout ───────────────────────────────────────────────────────
  appContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // ── Tab bar scaffolding ───────────────────────────────────────────────────
  // This mimics a real tab bar but is a simple View with two Pressables.
  // It sits at the TOP (not bottom) during scaffolding because we don't yet
  // handle safe area insets for a bottom tab bar correctly.
  // Day 5 moves this to the bottom with createBottomTabNavigator.
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.tertiary,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent.teal,
  },
  tabText: {
    color: colors.text.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.accent.teal,
  },
});
