/**
 * src/components/sales/SalesTrendChart.tsx
 *
 * A modern, high-contrast sales revenue chart displaying daily sales trends.
 * Supports single-day and multi-day views with fixed bar widths, period stats,
 * and clear axis descriptions. Built with victory-native (Skia engine).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { DailySummaryWithExpenses } from '../../types';
import { useThemeContext, Colors } from '../../theme';
import { useLanguage } from '../../store/LanguageContext';
import { formatMoney } from '../../utils/money';

interface SalesTrendChartProps {
  summaries: DailySummaryWithExpenses[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateLabel(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    const dayName = DAY_NAMES[dateObj.getDay()] ?? '';
    return `${dayName} ${d}`;
  } catch {
    return dateStr;
  }
}

export function SalesTrendChart({ summaries }: SalesTrendChartProps) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const chartWidth = Math.max(280, width - 40);

  // Filter and check for revenue data
  const hasRevenue = summaries.some((s) => s.totalRevenue > 0);

  // Calculate summary metrics (Peak day, Avg daily)
  const { maxRevenue, avgRevenue, formattedData } = useMemo(() => {
    if (!summaries.length) return { maxRevenue: 0, avgRevenue: 0, formattedData: [] };

    let maxRev = 0;
    let sumRev = 0;

    // Chronological order (oldest to newest)
    const reversed = [...summaries].reverse();

    const data = reversed.map((s) => {
      const revInShillings = Math.round(s.totalRevenue / 100);
      if (s.totalRevenue > maxRev) maxRev = s.totalRevenue;
      sumRev += s.totalRevenue;
      return {
        day: formatDateLabel(s.date),
        revenue: revInShillings,
      };
    });

    // If only 1 data point, pad dummy slots so a single bar doesn't stretch to 100% container width
    if (data.length === 1) {
      data.unshift({ day: '', revenue: 0 });
      data.push({ day: ' ', revenue: 0 });
    }

    const avgRev = Math.round(sumRev / summaries.length);

    return {
      maxRevenue: maxRev,
      avgRevenue: avgRev,
      formattedData: data,
    };
  }, [summaries]);

  if (!hasRevenue || formattedData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>{t('salesTrend') || 'Sales Trend'}</Text>
        <Text style={styles.emptyText}>No sales activity recorded for this period</Text>
      </View>
    );
  }

  // Calculate explicit bar width so single or few bars render elegantly
  const barWidth = Math.min(28, Math.max(12, (chartWidth - 60) / Math.max(formattedData.length, 5)));

  // Explicit domain ceiling — without this, a single bar fills 100% height (solid block)
  const maxDataValue = formattedData.reduce((acc, d) => Math.max(acc, d.revenue), 0);
  const domainMax = maxDataValue > 0 ? Math.ceil(maxDataValue * 1.2) : 100;

  return (
    <View style={styles.container}>
      {/* Chart Header */}
      <View style={styles.header}>
        <View style={styles.titleColumn}>
          <Text style={styles.chartTitle}>{t('salesTrend') || 'Sales Trend (KES)'}</Text>
          <Text style={styles.chartSubtitle}>Daily revenue totals over selected period</Text>
        </View>

        {/* Stats Badges */}
        <View style={styles.statsBadgeRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeLabel}>PEAK</Text>
            <Text style={styles.statBadgeValue}>{formatMoney(maxRevenue)}</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeLabel}>AVG/DAY</Text>
            <Text style={styles.statBadgeValue}>{formatMoney(avgRevenue)}</Text>
          </View>
        </View>
      </View>

      {/* Skia Victory Native Chart Box */}
      <View style={styles.chartBox}>
        <CartesianChart
          data={formattedData}
          xKey="day"
          yKeys={['revenue']}
          domainPadding={{ left: 30, right: 30 }}
          domain={{ y: [0, domainMax] }}
          xAxis={{
            font: undefined,
            labelColor: colors.text.secondary,
            lineColor: colors.background.tertiary,
            labelOffset: 6,
          }}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.revenue}
              chartBounds={chartBounds}
              color={colors.accent.teal}
              roundedCorners={{ topLeft: 6, topRight: 6 }}
              barWidth={barWidth}
              animate={{ type: 'spring', duration: 400 }}
            />
          )}
        </CartesianChart>
      </View>

      {/* Axis Caption / Description Footer */}
      <View style={styles.footer}>
        <View style={styles.legendDot} />
        <Text style={styles.footerText}>
          Values shown in KES shillings • Tap entries below for details
        </Text>
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
    header: {
      flexDirection: 'column',
      gap: 10,
      marginBottom: 16,
    },
    titleColumn: {
      gap: 2,
    },
    chartTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chartSubtitle: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    statsBadgeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statBadge: {
      backgroundColor: colors.background.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    statBadgeLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.text.muted,
      letterSpacing: 0.5,
    },
    statBadgeValue: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent.teal,
    },
    chartBox: {
      height: 180,
      width: '100%',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.background.tertiary,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent.teal,
    },
    footerText: {
      fontSize: 11,
      color: colors.text.muted,
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
    emptyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
    },
    emptyText: {
      color: colors.text.muted,
      fontSize: 12,
      fontWeight: '500',
    },
  });
