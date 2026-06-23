/**
 * src/components/WeeklyChart.tsx
 *
 * A 7-day bar chart showing daily debt totals for the past week.
 *
 * ─── WHAT IS react-native-svg? WHY DID WE NEED IT? ──────────────────────────
 * Web browsers have a native SVG renderer built in. React Native does NOT —
 * it only has a Canvas (via View/Image) and custom drawing primitives.
 * SVG (Scalable Vector Graphics) is the standard format for charts and
 * vector icons, so chart libraries that target React Native need either:
 *
 *   A) A polyfill that translates SVG operations into React Native primitives.
 *      → This was the `react-native-svg` approach used by older chart libraries.
 *
 *   B) A native GPU-accelerated drawing API.
 *      → This is `@shopify/react-native-skia`, which victory-native v41 uses.
 *
 * Victory Native v41 (our version) chose Skia for performance:
 *   - Charts render on the native thread (not the JS thread)
 *   - Animations run at 60fps without JS involvement
 *   - No SVG serialization/parsing overhead
 *
 * react-native-svg was still installed as a peer dep in case other packages
 * need it, but victory-native itself draws via Skia.
 *
 * ─── WHY VICTORY NATIVE vs OTHER OPTIONS? ────────────────────────────────────
 * Options for charts in Expo:
 *   1. victory-native — Expo-compatible, Skia-backed, rich API. Our choice.
 *   2. recharts — web only (DOM required). Doesn't work in React Native.
 *   3. react-native-chart-kit — SVG-based, lighter, but lower quality.
 *   4. Hand-rolled with react-native-svg — full control, but 10x the code.
 *
 * Victory Native's CartesianChart abstracts axis scaling, domain computation,
 * and hit-testing. Building equivalent behaviour manually would take days.
 * "Use a library" is the right call when the chart quality requirement is high
 * and the library actively maintains Expo support.
 *
 * ─── WEIGHT OF CHART LIBRARIES IN REACT NATIVE ───────────────────────────────
 * In a web app, a chart library adds ~50KB of JS. In React Native, Skia
 * additionally bundles a native module that loads at app startup. This adds
 * ~2–5MB to the installed app size and ~50–100ms to cold start time.
 *
 * Rule: only include a chart library if charts are a core UX feature — not
 * just a "nice to have". For Duka Deni, the weekly trend chart IS a core
 * feature (it answers "what happened this week?"). The weight is justified.
 *
 * ─── CartesianChart API (victory-native v41) ─────────────────────────────────
 * CartesianChart is a render-prop component. You pass:
 *   data       — array of objects with { x key value, y key value }
 *   xKey       — name of the field to use as X axis
 *   yKeys      — array of field names to use as Y axes (we have 1: "total")
 *
 * Inside, you receive `{ points }` where points.total is an array of
 * computed pixel positions for each data point. You render the Bar component
 * as a child.
 *
 * ─── Common mistake ────────────────────────────────────────────────────────────
 * Rendering an empty CartesianChart when all values are 0. An empty chart
 * (no visible bars) is confusing — the user might think it's broken. Always
 * detect the zero-data case and show a meaningful empty state instead.
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { DailyTotal } from '../types';
import { colors } from '../theme';
import { formatKESShort } from '../utils/money';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeeklyChartProps {
  data: DailyTotal[]; // exactly 7 items, gaps filled with total: 0
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Day abbreviations for X axis labels: "2026-06-21" → "Sat"
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Converts "YYYY-MM-DD" to a 3-letter day abbreviation.
 *
 * new Date("YYYY-MM-DD") parses the date as UTC midnight.
 * getUTCDay() returns the day of the week in UTC (0=Sun…6=Sat).
 * We use UTC here intentionally: the date string is already "YYYY-MM-DD" local,
 * and we just want the day-of-week label — timezone doesn't affect which day
 * Monday is.
 */
function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00'); // parse as local midnight
  return DAY_NAMES[d.getDay()] ?? dateStr;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklyChart({ data }: WeeklyChartProps) {
  const { width } = useWindowDimensions();
  const chartWidth = width - 40; // 20px padding each side

  // ── Zero-data guard ──────────────────────────────────────────────────────
  // If every day has 0 debt, there's nothing meaningful to chart.
  // Show a friendly message instead of a blank chart that might look broken.
  const hasData = data.some((d) => d.total > 0);
  if (!hasData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>No debt recorded this week</Text>
      </View>
    );
  }

  // ── Transform data for CartesianChart ────────────────────────────────────
  // CartesianChart expects an array of objects. We convert DailyTotal[] to
  // the shape { day: string (label), total: number (value in KES shillings) }
  // We divide by 100 to convert cents → shillings for the chart scale.
  const chartData = data.map((d) => ({
    day: dayLabel(d.date),
    total: Math.round(d.total / 100), // display as shillings for chart scale
  }));

  return (
    <View style={[styles.container, { width: chartWidth }]}>
      <CartesianChart
        data={chartData}
        xKey="day"
        yKeys={['total']}
        domainPadding={{ left: 20, right: 20 }}
        domain={{ y: [0] }}
        xAxis={{
          font: undefined,
          labelColor: colors.text.secondary,
          lineColor: colors.background.tertiary,
          labelOffset: 4,
        }}
        // Omitting yAxis prop entirely hides the Y axis in victory-native v41.
        // The library only renders a Y axis when the yAxis prop is provided.
        // Values are communicated visually by bar height, not axis labels.
      >
        {({ points, chartBounds }) => (
          <Bar
            points={points.total}
            chartBounds={chartBounds}
            color={colors.accent.teal}
            roundedCorners={{ topLeft: 6, topRight: 6 }}
            animate={{ type: 'spring', duration: 400 }}
          />
        )}
      </CartesianChart>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    height: 180,
    // width set dynamically from useWindowDimensions
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyContainer: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.background.tertiary,
  },
  emptyIcon: {
    fontSize: 32,
    opacity: 0.4,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
