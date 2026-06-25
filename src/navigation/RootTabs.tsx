/**
 * src/navigation/RootTabs.tsx
 *
 * The top-level Bottom Tab Navigator.
 *
 * This is the first navigator the app renders after migrations complete.
 * Every screen in the app is reachable from here — either directly as a tab,
 * or nested inside a tab's stack.
 *
 * ─── NESTED NAVIGATORS ───────────────────────────────────────────────────────
 *
 * CustomersStack (a NativeStack Navigator) is registered as a Screen inside
 * this Tab Navigator. React Navigation supports this nesting pattern:
 *
 *   Tab Navigator (RootTabs)
 *   ├── Screen: "Dashboard" → DashboardScreen (a normal screen)
 *   └── Screen: "Customers" → CustomersStack (a Stack Navigator!)
 *                             ├── Screen: CustomerListScreen
 *                             └── Screen: TransactionScreen
 *
 * When the user taps "Customers":
 *   → RootTabs activates the "Customers" tab
 *   → CustomersStack renders as the tab content
 *   → CustomersStack shows CustomerListScreen (its initial screen)
 *
 * When the user taps a customer card:
 *   → CustomersStack pushes TransactionScreen on top
 *   → TransactionScreen renders full-screen (visually hides the tab bar)
 *   → Tab bar is still mounted, just behind the full-screen native stack view
 *
 * ─── WHY TAB BAR SEEMS TO DISAPPEAR ─────────────────────────────────────────
 *
 * The tab bar does NOT disappear — it's still mounted. The native stack inside
 * CustomersStack renders its screens at full height, visually covering the tab
 * bar. When the user goes back, the stack pops and the tab bar is visible again.
 * This is standard mobile UX — detail screens (Transaction) are full-screen
 * and don't need the tab bar. List screens (CustomerList, Dashboard) do.
 *
 * ─── TAB BAR STYLING ─────────────────────────────────────────────────────────
 *
 * We override the default white tab bar with our dark theme colors.
 * `tabBarActiveTintColor`   → the selected tab uses teal (accent color)
 * `tabBarInactiveTintColor` → unselected tabs use muted gray
 * This follows the universal mobile convention: active = filled/colored,
 * inactive = outline/muted. (Instagram, WhatsApp, every major app does this.)
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootTabParamList } from './types';
import { DashboardScreen } from '../screens/DashboardScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import CustomersStack from './CustomersStack';
import { colors } from '../theme';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        // Hide the top header — our screens manage their own headers
        headerShown: false,

        // ── Tab bar dark theme ────────────────────────────────────────────
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopColor: colors.background.tertiary,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },

        // Active tab (selected): teal accent
        tabBarActiveTintColor: colors.accent.teal,

        // Inactive tabs (not selected): muted gray
        tabBarInactiveTintColor: colors.text.secondary,

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      {/* ── Tab 1: Dashboard ─────────────────────────────────────────────── */}
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          // tabBarIcon receives `focused` (boolean) and `color` (already the
          // correct active/inactive tint color based on tabBarActiveTintColor).
          // Convention: filled icon when active, outline when inactive.
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 2: Customers → CustomersStack ────────────────────────────── */}
      {/*
       * We register CustomersStack (a navigator component) as the screen
       * for the "Customers" tab. React Navigation renders it as a nested
       * navigator — the tab bar handles tab switching, the stack handles
       * pushing/popping CustomerList ↔ Transaction.
       */}
      <Tab.Screen
        name="Customers"
        component={CustomersStack}
        options={{
          tabBarLabel: 'Customers',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 3: Settings ───────────────────────────────────────────────── */}
      {/*
       * Settings is always the rightmost tab — universal mobile convention.
       * WhatsApp, Instagram, Gmail all follow this. Users find Settings on the
       * right without thinking. Breaking this convention creates friction.
       */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
