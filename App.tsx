/**
 * App.tsx — DAY 2 PRODUCTION BUILD
 *
 * Replaces the Day 1 test harness.
 *
 * RESPONSIBILITIES:
 *   1. Import global.css (MUST be first — initialises NativeWind)
 *   2. Run database migrations on mount (tables must exist before screens use them)
 *   3. Wrap the app in SafeAreaProvider (needed for useSafeAreaInsets in screens)
 *   4. Show a loading indicator while migrations run
 *   5. Show an error screen if migrations fail (rare but defensive)
 *   6. Render CustomerListScreen once migrations are complete
 *
 * WHY WAIT FOR MIGRATIONS?
 * CustomerListScreen calls getAllCustomers(db) the moment it mounts.
 * If the customers table doesn't exist yet, that SQL throws:
 *   "no such table: customers"
 * Running migrations first guarantees all tables exist before any screen
 * touches the database. After the first run, subsequent launches skip
 * already-applied migrations (they're idempotent — safe to call every time).
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

// ─── Migration State ───────────────────────────────────────────────────────────

type MigrationState = "pending" | "running" | "done" | "error";

// ─── App Component ─────────────────────────────────────────────────────────────

export default function App() {
  const [migrationState, setMigrationState] = useState<MigrationState>("pending");
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0); // incrementing this re-triggers the useEffect

  // ── Run migrations on mount ───────────────────────────────────────────────
  // useEffect with [] runs exactly once — when the component first mounts.
  // We can't make the effect itself async (React restriction), so we define
  // an inner async function and call it immediately. This is the standard
  // React pattern for async work in useEffect.
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
  }, [retryCount]); // re-runs when user taps Retry (retryCount increments)

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
  // This is a last-resort screen. In practice, SQLite migrations almost
  // never fail on device. If they do, the user can't use the app until
  // the schema issue is resolved — so we show a clear error.
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
              // Increment retryCount → useEffect dependency changes → re-runs
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
  // SafeAreaProvider must wrap the entire app so useSafeAreaInsets()
  // can read the device's safe area (notch, home bar) inside any screen.
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <CustomerListScreen />
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
});
