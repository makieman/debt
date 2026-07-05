/**
 * App.tsx — DAY 6 BUILD
 *
 * RESPONSIBILITIES:
 *   1. Import global.css (MUST be first — initialises NativeWind)
 *   2. Run database migrations on mount
 *   3. Check AsyncStorage for first-launch flag
 *   4. Auto-seed demo data on first launch
 *   5. Wrap the app in SafeAreaProvider + NavigationContainer
 *   6. Render RootTabs (the real React Navigation bottom tab navigator)
 *
 * ─── THE NAVIGATION CONTAINER ─────────────────────────────────────────────────
 *
 * NavigationContainer is the root component that React Navigation REQUIRES.
 * It:
 *   1. Holds the navigation state (which tab is active, which screens are
 *      on the stack) in memory.
 *   2. Integrates with the Android back button — when the user presses back,
 *      NavigationContainer knows whether to pop the stack or let the OS handle it.
 *   3. Enables deep linking — URL schemes can navigate to specific screens.
 *   4. Provides the navigation context that ALL child hooks (useNavigation,
 *      useRoute) rely on. Without this wrapper, those hooks throw an error.
 *
 * RULE: NavigationContainer must be rendered exactly ONCE, at the root.
 * Nesting multiple NavigationContainers causes subtle, hard-to-debug errors.
 *
 * ─── FIRST LAUNCH SEEDING ─────────────────────────────────────────────────────
 *
 * When the shopkeeper installs Duka Deni for the first time, the SQLite
 * database is completely empty. An empty dashboard looks broken — no data,
 * no "wow" moment.
 *
 * We detect first launch using AsyncStorage:
 *
 *   const hasLaunched = await AsyncStorage.getItem('hasLaunched')
 *
 * AsyncStorage is a simple key-value store (like localStorage in a browser).
 * It persists across app restarts. It is NOT a database — no queries, no
 * relations. Just strings, indexed by key.
 *
 * WHY ASYNCSTORAGE INSTEAD OF SQLITE FOR THIS FLAG?
 *   We need to check "has this app been opened before" BEFORE displaying any
 *   UI. AsyncStorage is designed for exactly this — reading small flags
 *   quickly at startup. SQLite would require opening a database connection,
 *   running a query, and parsing a result row. Overkill for a boolean.
 *
 * The first-launch pattern is universal in production apps:
 *   - Onboarding screens ("Welcome to…")
 *   - Default settings initialization
 *   - "Rate the app" prompt (shown after N launches)
 *   - Tutorial overlays (shown once, never again)
 *
 * WHAT HAPPENS:
 *   First open  → hasLaunched is null → seed demo data → set 'hasLaunched'
 *   Every other open → hasLaunched is 'true' → skip seeding → show real data
 *
 * The shopkeeper can reset to demo data anytime via Settings → Load Demo Data.
 * This does NOT reset the 'hasLaunched' flag — the auto-seed only happens once.
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
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { db, runMigrations } from "./src/db";
import { seedDemoData } from "./src/db/seed";
import { RootTabs } from "./src/navigation";
import { colors } from "./src/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type BootState = "pending" | "running" | "done" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

/** AsyncStorage key for the first-launch flag */
const FIRST_LAUNCH_KEY = "hasLaunched_v1";
//                                       ^^^ Include a version suffix.
//                                       If you ever need to re-run first-launch
//                                       logic (e.g. for a major update), bump
//                                       this to 'hasLaunched_v2' — the old key
//                                       is ignored automatically.

// ─── App Component ────────────────────────────────────────────────────────────

export default function App() {
  const [bootState, setBootState] = useState<BootState>("pending");
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ── Bootstrap: migrations + first-launch seed ────────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      try {
        setBootState("running");

        // Step 1: Run database migrations.
        // This creates the customers and transactions tables if they don't
        // exist yet. Safe to run every launch — uses CREATE TABLE IF NOT EXISTS.
        await runMigrations(db);

        // Step 2: Check if this is the very first launch.
        //
        // AsyncStorage.getItem returns null if the key has never been set.
        // We use this to detect: has the app ever been opened before?
        const hasLaunched = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);

        if (!hasLaunched) {
          // First time ever. Seed demo data so the dashboard is populated.
          console.log("[App] First launch detected — seeding demo data");
          await seedDemoData(db);

          // Mark this launch so we never auto-seed again.
          await AsyncStorage.setItem(FIRST_LAUNCH_KEY, "true");
          console.log("[App] First launch flag set");
        } else {
          console.log("[App] Returning user — skipping seed");
        }

        setBootState("done");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[App] Bootstrap failed:", msg);
        setBootError(msg);
        setBootState("error");
      }
    }

    bootstrap();
  }, [retryCount]);

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (bootState === "pending" || bootState === "running") {
    return (
      <SafeAreaProvider>
        <View style={styles.centeredScreen}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color={colors.accent.teal} />
          <Text style={styles.loadingLabel}>Starting Duka Deni...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // ── Error screen ─────────────────────────────────────────────────────────────
  if (bootState === "error") {
    return (
      <SafeAreaProvider>
        <View style={styles.centeredScreen}>
          <StatusBar style="dark" />
          <Text style={styles.errorTitle}>⚠️ Startup Error</Text>
          <Text style={styles.errorMessage}>
            The app failed to start. Please restart.{"\n"}
            {bootError}
          </Text>
          <Pressable
            onPress={() => {
              setBootState("pending");
              setBootError(null);
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

  // ── Main app — React Navigation wired up ────────────────────────────────────
  //
  // NavigationContainer is the REQUIRED root wrapper for React Navigation.
  // Everything that uses useNavigation() or useRoute() must be a descendant
  // of this component. Rendering it here (at the top level, after migrations
  // are confirmed complete) ensures the DB is ready before any screen mounts.
  //
  // RootTabs renders the bottom tab navigator with 3 tabs:
  //   📊 Dashboard | 👥 Customers | ⚙️ Settings
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
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
