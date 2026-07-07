/**
 * src/navigation/RootStack.tsx
 *
 * The ROOT stack navigator that wraps the entire app.
 *
 * ─── WHY THIS EXISTS ABOVE RootTabs ──────────────────────────────────────────
 *
 * PIN setup and PIN change are app-level flows. They need to:
 *   1. Cover the ENTIRE screen including the tab bar
 *   2. Be reachable from any tab (not just Settings)
 *   3. Feel like a focused, serious task (fullScreenModal)
 *
 * If we added PinSetupScreen inside CustomersStack or the Settings tab,
 * the tab bar would still show at the bottom — wrong UX for a security flow.
 *
 * By placing them in a NativeStack ABOVE RootTabs, presentation="fullScreenModal"
 * makes the screen slide up from the bottom and cover everything, including
 * the bottom tab navigator.
 *
 * ─── presentation: "fullScreenModal" ─────────────────────────────────────────
 *
 * React Navigation's NativeStack supports several presentation styles:
 *   "card"              → default, slides in from the right (iOS) or fades (Android)
 *   "modal"             → slides up, but parent tab bar can peek through on iOS
 *   "fullScreenModal"   → slides up, covers EVERYTHING including tab bar
 *   "transparentModal"  → same but background shows through
 *
 * We use "fullScreenModal" for PIN screens because:
 *   - The tab bar should be completely hidden (security context = focused task)
 *   - "modal" on iOS can still show the parent tab bar underneath
 *   - "fullScreenModal" matches the UX of iOS Screen Time and banking app PINs
 *
 * ─── NAVIGATOR STRUCTURE ─────────────────────────────────────────────────────
 *
 *   RootStack (NativeStack)
 *   ├── "Main"     → RootTabs (the 3-tab bottom navigator)
 *   ├── "PinSetup" → PinSetupScreen (fullScreenModal)
 *   └── "PinChange"→ PinChangeScreen (fullScreenModal)
 *
 * Navigating to "PinSetup" from Settings:
 *   navigation.navigate("PinSetup")
 *
 * The navigation prop in SettingsScreen must be typed as:
 *   NativeStackNavigationProp<RootStackParamList, "Main">
 *   NOT the BottomTabNavigationProp — we're navigating to a screen
 *   outside the tab navigator.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import RootTabs from './RootTabs';
import { PinSetupScreen } from '../screens/PinSetupScreen';
import { PinChangeScreen } from '../screens/PinChangeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/*
       * "Main" renders the full 3-tab bottom navigator.
       * This is the normal app state — Dashboard, Customers, Settings.
       */}
      <Stack.Screen name="Main" component={RootTabs} />

      {/*
       * "PinSetup" — triggered from Settings when the user enables App Lock
       * for the first time (no PIN hash exists in SecureStore yet).
       *
       * presentation: "fullScreenModal" makes this slide up from the bottom
       * and completely cover the tab bar. The back gesture (swipe down on iOS,
       * hardware back on Android) dismisses the screen.
       *
       * REAL BUG DEVELOPERS MAKE:
       * Not setting headerShown: false here. By default, the modal would show
       * a native header with a "Dismiss" button — which would let users close
       * the PIN setup without completing it, leaving App Lock enabled but no
       * PIN set. Always explicitly hide headers on security flows.
       */}
      <Stack.Screen
        name="PinSetup"
        component={PinSetupScreen}
        options={{ presentation: 'fullScreenModal' }}
      />

      {/*
       * "PinChange" — triggered from Settings → Change PIN.
       * Requires the user to enter their current PIN first,
       * then enter + confirm a new one. Same fullScreenModal presentation.
       */}
      <Stack.Screen
        name="PinChange"
        component={PinChangeScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}
