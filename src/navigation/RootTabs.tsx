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
import SalesStack from './SalesStack';
import { useThemeContext } from '../theme';
import { useLanguage } from '../store/LanguageContext';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs() {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      screenOptions={{
        // Hide the top header — our screens manage their own headers
        headerShown: false,

        // ── Tab bar light theme ────────────────────────────────────────────
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.background.tertiary,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },

        // Active tab (selected): emerald green accent
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
      <Tab.Screen
        name="Customers"
        component={CustomersStack}
        options={{
          tabBarLabel: t('customers') || 'Customers',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 3: Sales → SalesStack ────────────────────────────────────── */}
      <Tab.Screen
        name="Sales"
        component={SalesStack}
        options={{
          tabBarLabel: t('sales') || 'Sales',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'trending-up' : 'trending-up-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 4: Settings ───────────────────────────────────────────────── */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('settings') || 'Settings',
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
