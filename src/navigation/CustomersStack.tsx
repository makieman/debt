/**
 * src/navigation/CustomersStack.tsx
 *
 * The Stack Navigator for the "Customers" tab.
 *
 * A Stack Navigator is a container that manages screens in a push/pop model:
 *   - Navigate forward → new screen slides in from the right (push)
 *   - Go back         → current screen slides out to the right (pop)
 *   - Android back button → automatically calls goBack() (pop)
 *
 * ─── SCREEN MOUNTING IN A STACK ─────────────────────────────────────────────
 *
 * When TransactionScreen is pushed on top of CustomerListScreen:
 *   1. CustomerListScreen stays MOUNTED (not destroyed) below the top screen.
 *   2. TransactionScreen renders on top.
 *   3. When the user goes back, TransactionScreen is unmounted.
 *   4. CustomerListScreen is already there — no re-fetch, no flash.
 *
 * Memory implication: with only 2 screens in this stack, keeping both mounted
 * is negligible. If our stack had 10 deep screens, we'd use `unmountOnBlur`
 * on individual screens to reclaim memory. For now, the default behavior is
 * exactly what we want.
 *
 * ─── WHY headerShown: false ──────────────────────────────────────────────────
 *
 * React Navigation renders its own header bar by default (light-themed,
 * standard Android/iOS style). Our screens have CUSTOM headers built in
 * Days 2–3 that match the dark Duka Deni theme. Showing both would result
 * in two header bars stacked on top of each other. We disable the library
 * header and let our own header take full control.
 *
 * ─── contentStyle backgroundColor ───────────────────────────────────────────
 *
 * Without this, the screen background defaults to white during the push/pop
 * transition animation. You'd see a white flash before the screen's own
 * backgroundColor kicks in. Setting it here ensures the native screen
 * component itself has our dark background from the first frame.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomersStackParamList } from './types';
import { CustomerListScreen } from '../screens/CustomerListScreen';
import { TransactionScreen } from '../screens/TransactionScreen';
import { useThemeContext } from '../theme';

// createNativeStackNavigator<T>() creates two components:
//   Stack.Navigator — the container that manages navigation state
//   Stack.Screen    — declares a single screen within the navigator
// The generic <T> is our ParamList — TypeScript uses it to validate
// that screen `name` props match the keys in CustomersStackParamList.
const Stack = createNativeStackNavigator<CustomersStackParamList>();

export default function CustomersStack() {
  const { colors } = useThemeContext();

  return (
    <Stack.Navigator
      screenOptions={{
        // Hide the built-in header — our screens have custom headers
        headerShown: false,
        // Prevent white flash during push/pop animations by giving the
        // native screen component itself our dark background color
        contentStyle: { backgroundColor: colors.background.primary },
        // Native animation: slide in from the right (default on both platforms)
        animation: 'slide_from_right',
      }}
    >
      {/*
       * Screen 1: CustomerList
       * This is the initial screen — it renders first when the Customers
       * tab is opened. `name` must exactly match the key in CustomersStackParamList.
       */}
      <Stack.Screen
        name="CustomerList"
        component={CustomerListScreen}
      />

      {/*
       * Screen 2: Transaction
       * Pushed on top of CustomerList when the user taps a CustomerCard.
       * Receives { customer } via route.params (defined in types.ts).
       * When the user taps back, this screen is unmounted and CustomerList
       * reappears (already mounted, no reload needed).
       */}
      <Stack.Screen
        name="Transaction"
        component={TransactionScreen}
      />
    </Stack.Navigator>
  );
}
