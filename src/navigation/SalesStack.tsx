/**
 * src/navigation/SalesStack.tsx
 *
 * Native stack navigator for the Sales tab (SalesReport ↔ DailyEntry).
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SalesStackParamList } from './types';
import { SalesReportScreen } from '../screens/SalesReportScreen';
import { DailyEntryScreen } from '../screens/DailyEntryScreen';

const Stack = createNativeStackNavigator<SalesStackParamList>();

export default function SalesStack() {
  return (
    <Stack.Navigator
      initialRouteName="SalesHome"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="SalesHome" component={SalesReportScreen} />
      <Stack.Screen name="DailyEntry" component={DailyEntryScreen} />
    </Stack.Navigator>
  );
}
