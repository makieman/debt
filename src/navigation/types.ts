/**
 * src/navigation/types.ts
 *
 * TypeScript type definitions for every navigator in the app.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * React Navigation is a JavaScript library. Without explicit TypeScript types,
 * every call to useNavigation() returns `any` — you lose all autocomplete and
 * compile-time safety. A typo in a screen name only surfaces at runtime.
 *
 * With this file:
 *   navigation.navigate('Transction', { customer })  ← TypeScript error: typo
 *   navigation.navigate('Transaction', { id: 1 })    ← TypeScript error: wrong params
 *   navigation.navigate('Transaction', { customer })  ← ✅ correct
 *
 * ─── PARAMLIST CONCEPT ───────────────────────────────────────────────────────
 *
 * A ParamList is a TypeScript object type where:
 *   key   = screen name (must match the `name` prop on <Stack.Screen>)
 *   value = the params that screen accepts
 *
 *   `undefined` as a value means "this screen takes NO params".
 *   An object type means "this screen requires these specific props".
 *
 * ─── NAVIGATION PROP vs ROUTE PROP ──────────────────────────────────────────
 *
 * NavigationProp — what you use to NAVIGATE (push screens, go back):
 *   const navigation = useNavigation<CustomerListNavProp>()
 *   navigation.navigate('Transaction', { customer })   ← push
 *   navigation.goBack()                                ← pop
 *
 * RouteProp — what you use to READ the params of the CURRENT screen:
 *   const route = useRoute<TransactionRouteProp>()
 *   const { customer } = route.params                  ← read
 */

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Customer } from '../types';

// ─── Customers Stack ──────────────────────────────────────────────────────────
//
// This ParamList defines every screen inside the Customers tab stack.
// The stack has two screens:
//   1. CustomerList — the main list (no params needed)
//   2. Transaction  — per-customer view (requires a Customer object)
//
// Why pass a full Customer object instead of just customerId?
// We already have the Customer in memory when the user taps a card.
// Passing it avoids a second DB fetch on TransactionScreen mount.
// Trade-off: if the customer record is edited between tap and open,
// the screen shows slightly stale data. Acceptable for this app stage.

export type CustomersStackParamList = {
  CustomerList: undefined;            // No params — just show the list
  Transaction: { customer: Customer }; // Must have a customer object
};

// ─── Root Tab Navigator ───────────────────────────────────────────────────────
//
// This ParamList defines every tab in the root BottomTab navigator.
// Both tabs take no params (undefined) — you switch to them without any data.
// The "Customers" tab renders a Stack Navigator, not a screen directly.

export type RootTabParamList = {
  Dashboard: undefined;
  Customers: undefined;
  Settings: undefined;
};

// ─── Typed Navigation Props ───────────────────────────────────────────────────
//
// These convenience types are what you pass to useNavigation<T>().
// Each is scoped to a specific screen so TypeScript knows:
//   - which screens you can navigate() to FROM this screen
//   - what params each target screen requires

export type CustomerListNavProp = NativeStackNavigationProp<
  CustomersStackParamList,
  'CustomerList'
>;

export type TransactionNavProp = NativeStackNavigationProp<
  CustomersStackParamList,
  'Transaction'
>;

// ─── Typed Route Prop ────────────────────────────────────────────────────────
//
// Used with useRoute<T>() to read the params of the current screen.
// TransactionScreen uses this to access route.params.customer.

export type TransactionRouteProp = RouteProp<
  CustomersStackParamList,
  'Transaction'
>;
