/**
 * src/components/sales/DayRow.tsx
 *
 * A single row component in the sales report daily entries list.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext, Colors } from '../../theme';
import { DailySummaryWithExpenses } from '../../types';
import { formatMoney } from '../../utils/money';

interface DayRowProps {
  summary: DailySummaryWithExpenses;
  onPress: (date?: string) => void;
}

// Format date string "YYYY-MM-DD" into "Mon 14 Jul"
function formatDateLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

export const DayRow = React.memo(function DayRow({ summary, onPress }: DayRowProps) {
  const { colors } = useThemeContext();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const handlePress = React.useCallback(() => {
    onPress(summary.date);
  }, [onPress, summary.date]);

  const isPositive = summary.profit > 0;
  const isNegative = summary.profit < 0;

  const profitColor = isPositive
    ? colors.accent.teal
    : isNegative
    ? colors.debt
    : colors.text.secondary;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.leftCol}>
        <Text style={styles.dateText}>{formatDateLabel(summary.date)}</Text>
        <Text style={styles.revenueSubtext}>
          Rev: {formatMoney(summary.totalRevenue)} • Exp: {formatMoney(summary.totalExpenses)}
        </Text>
      </View>

      <View style={styles.rightCol}>
        <View style={[styles.profitBadge, { backgroundColor: isPositive ? colors.accent.tealDim : isNegative ? `${colors.debt}15` : colors.background.tertiary }]}>
          <Text style={[styles.profitText, { color: profitColor }]}>
            {formatMoney(summary.profit)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </View>
    </Pressable>
  );
});

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    pressed: {
      opacity: 0.7,
    },
    leftCol: {
      gap: 2,
    },
    dateText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text.primary,
    },
    revenueSubtext: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    rightCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    profitBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    profitText: {
      fontSize: 14,
      fontWeight: '800',
    },
  });
