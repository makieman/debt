/**
 * src/store/SecurityContext.tsx
 *
 * The app-level context that manages lock state.
 *
 * ─── WHY THIS LIVES AT THE APP LEVEL ─────────────────────────────────────────
 *
 * The lock screen must cover the ENTIRE app — including the navigation container,
 * the tab bar, and all screen content. If SecurityContext lived inside the
 * navigator, PinScreen would render inside the navigation tree and the tab bar
 * would still be visible behind it.
 *
 * By placing SecurityProvider in App.tsx OUTSIDE the NavigationContainer, the
 * lock screen can replace the entire tree when needed.
 *
 * ─── APPSTATE LISTENER ───────────────────────────────────────────────────────
 *
 * AppState tracks the app's lifecycle:
 *   "active"     → app is visible and in use
 *   "background" → user switched to another app or pressed Home
 *   "inactive"   → transitioning (iOS only, very brief)
 *
 * Our policy:
 *   background → record a timestamp (when did the app leave?)
 *   active     → check if elapsed time > 30s → if yes, lock
 *
 * ─── CRITICAL: APPSTATE CLEANUP ──────────────────────────────────────────────
 *
 * The useEffect that registers the AppState listener MUST return sub.remove().
 * Without cleanup:
 *   - Every time isAppLockEnabled changes (user enables/disables lock in Settings),
 *     the effect re-runs and adds a NEW listener
 *   - After enabling and disabling 5 times: 5 listeners, all firing simultaneously
 *   - This causes race conditions (multiple lock() calls), memory leaks, and
 *     incorrect "remaining time" calculations
 *
 * React Native's AppState doesn't de-duplicate listeners — it calls ALL of them.
 *
 * ─── WHY THE EFFECT DEPENDS ON isAppLockEnabled ──────────────────────────────
 *
 * The handleAppStateChange closure captures the current value of isAppLockEnabled.
 * If we don't put it in the dependency array, the closure would always see the
 * value from when the component first mounted — a classic stale closure bug.
 * After the user disables lock in Settings, the old listener would still lock
 * the app because it sees isAppLockEnabled = true (the old value).
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  isPinSet,
  isAppLockEnabled as getAppLockEnabled,
  setLockTimestamp,
  shouldRequireUnlock,
  clearLockTimestamp,
} from './security';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityContextValue {
  /** True when the PIN screen should be shown. */
  isLocked: boolean;
  /** True when the user has enabled app lock and has a PIN set. */
  isAppLockEnabled: boolean;
  /** True when a PIN hash exists in SecureStore. */
  pinSetupComplete: boolean;
  /** Lock the app immediately (show PinScreen). */
  lockApp: () => void;
  /** Unlock the app (hide PinScreen). */
  unlockApp: () => void;
  /** Re-read security state from SecureStore (call after PIN setup/disable). */
  refreshSecurityState: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SecurityContext = createContext<SecurityContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [isAppLockEnabledState, setIsAppLockEnabled] = useState(false);
  const [pinSetupComplete, setPinSetupComplete] = useState(false);

  // Track the previous AppState to avoid double-firing on iOS
  const appStateRef = useRef(AppState.currentState);

  // ── Load security state from SecureStore ──────────────────────────────────

  const refreshSecurityState = useCallback(async () => {
    const lockEnabled = await getAppLockEnabled();
    const pinSet = await isPinSet();
    setIsAppLockEnabled(lockEnabled);
    setPinSetupComplete(pinSet);
  }, []);

  // ── Initial mount: load state and lock if enabled ─────────────────────────

  useEffect(() => {
    async function init() {
      // Read security state directly (refreshSecurityState is fire-and-set,
      // returns void — we read the fresh values ourselves here)
      const lockEnabled = await getAppLockEnabled();
      const pinSet = await isPinSet();
      setIsAppLockEnabled(lockEnabled);
      setPinSetupComplete(pinSet);
      // App was just opened. If lock is enabled and a PIN exists: lock immediately.
      // WHY CHECK pinSet? If the user enabled lock but the app crashed before
      // saving the PIN hash, we must NOT lock them out permanently.
      if (lockEnabled && pinSet) {
        setIsLocked(true);
      }
    }
    init();
  }, []);

  // ── AppState listener ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' && isAppLockEnabledState) {
        // App going to background — record the exact moment
        await setLockTimestamp();
      }

      if (nextState === 'active' && prev !== 'active' && isAppLockEnabledState) {
        // App returned to foreground — check if grace period has elapsed
        const shouldLock = await shouldRequireUnlock();
        if (shouldLock && pinSetupComplete) {
          setIsLocked(true);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    // CRITICAL: clean up when isAppLockEnabledState changes or component unmounts.
    // Without this, every Settings toggle adds a new listener.
    return () => sub.remove();
  }, [isAppLockEnabledState, pinSetupComplete]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const lockApp = useCallback(() => setIsLocked(true), []);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
    clearLockTimestamp(); // async but fire-and-forget is fine here
  }, []);

  // ─── Value ──────────────────────────────────────────────────────────────────

  const value: SecurityContextValue = {
    isLocked,
    isAppLockEnabled: isAppLockEnabledState,
    pinSetupComplete,
    lockApp,
    unlockApp,
    refreshSecurityState,
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSecurityContext(): SecurityContextValue {
  const ctx = useContext(SecurityContext);
  if (!ctx) {
    throw new Error('useSecurityContext must be used within a SecurityProvider');
  }
  return ctx;
}
