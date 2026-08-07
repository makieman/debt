/**
 * src/components/sales/SalesTrendChart.tsx
 *
 * A modern sales revenue bar chart displaying daily sales totals.
 * Built using victory-native (Skia-backed 60fps rendering).
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { DailySummaryWithExpenses } from '../../types';
import { useThemeContext, Colors } from '../../theme';

interface SalesTrendChartProps {
  summaries: DailySummaryWithExpenses[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateShort(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return DAY_NAMES[dateObj.getDay()] ?? dateStr;
  } catch {
    return dateStr;
  }
}

export function SalesTrendChart({ summaries }: SalesTrendChartProps) {
  const { colors } = useThemeContext();
  const styles = makeStyles(colors);
  const { width } = useWindowDimensions();
  const chartWidth = width - 40; // padding each side

  // Filter or take recent entries and check if there's any revenue data
  const hasRevenue = summaries.some((s) => s.totalRevenue > 0);

  if (!hasRevenue) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>No sales activity to chart for this period</Text>
      </View>
    );
  }

  // Reverse so chronological order (oldest -> newest left to right)
  const sortedSummaries = [...summaries].reverse();

  const chartData = sortedSummaries.map((s) => ({
    day: formatDateShort(s.date),
    revenue: Math.round(s.totalRevenue / 100), // convert cents -> shillings
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.chartTitle}>Sales Trend (KES)</Text>
      <View style={styles.chartBox}>
        <CartesianChart
          data={chartData}
          xKey="day"
          yKeys={['revenue']}
          domainPadding={{ left: 16, right: 16 }}
          domain={{ y: [0] }}
          xAxis={{
            font: undefined,
            labelColor: colors.text.secondary,
            lineColor: colors.background.tertiary,
            labelOffset: 4,
          }}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.revenue}
              chartBounds={chartBounds}
              color={colors.accent.teal}
              roundedCorners={{ topLeft: 6, topRight: 6 }}
              animate={{ type: 'spring', duration: 400 }}
            />
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    chartTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    chartBox: {
      height: 160,
    },
    emptyContainer: {
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.background.tertiary,
      marginBottom: 20,
    },
    emptyIcon: {
      fontSize: 28,
      opacity: 0.5,
    },
    emptyText: {
      color: colors.text.muted,
      fontSize: 13,
      fontWeight: '500',
    },
  });
