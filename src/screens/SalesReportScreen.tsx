/**
 * src/screens/SalesReportScreen.tsx
 *
 * The Sales Report screen showing aggregated sales, expenses, net profit,
 * category breakdowns, and a list of daily summary entries.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeContext, Colors } from '../theme';
import { useLanguage } from '../store/LanguageContext';
import { db } from '../db';
import { DayRow } from '../components/sales/DayRow';
import { SalesTrendChart } from '../components/sales/SalesTrendChart';
import { formatMoney } from '../utils/money';
import {
  getTodayDateString,
  getSummariesForRange,
  getReportTotals,
} from '../repositories/dailySummary';
import {
  DailySummaryWithExpenses,
  ReportTotals,
  ExpenseCategory,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from '../types';
import { SalesStackParamList } from '../navigation/types';

type SalesReportNavProp = NativeStackNavigationProp<SalesStackParamList, 'SalesHome'>;

type PeriodOption = 'today' | 'thisWeek' | 'thisMonth' | 'custom';

export function SalesReportScreen() {
  const navigation = useNavigation<SalesReportNavProp>();
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const styles = makeStyles(colors);

  const [period, setPeriod] = useState<PeriodOption>('today');
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');

  const [reportTotals, setReportTotals] = useState<ReportTotals | null>(null);
  const [summaries, setSummaries] = useState<DailySummaryWithExpenses[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Compute date range based on period
  const getDateRange = useCallback((): { from: string; to: string } => {
    const todayStr = getTodayDateString();
    const now = new Date();

    if (period === 'today') {
      return { from: todayStr, to: todayStr };
    }

    if (period === 'thisWeek') {
      // Start of week (Monday)
      const dayOfWeek = now.getDay(); // 0 is Sun
      const distanceToMon = (dayOfWeek + 6) % 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - distanceToMon);
      const yyyy = mon.getFullYear();
      const mm = String(mon.getMonth() + 1).padStart(2, '0');
      const dd = String(mon.getDate()).padStart(2, '0');
      return { from: `${yyyy}-${mm}-${dd}`, to: todayStr };
    }

    if (period === 'thisMonth') {
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      return { from: `${yyyy}-${mm}-01`, to: todayStr };
    }

    // Custom
    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromDateInput) ? fromDateInput : todayStr;
    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(toDateInput) ? toDateInput : todayStr;
    return { from: validFrom, to: validTo };
  }, [period, fromDateInput, toDateInput]);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const { from, to } = getDateRange();
      const totals = await getReportTotals(db, from, to);
      const list = await getSummariesForRange(db, from, to);
      setReportTotals(totals);
      setSummaries(list);
    } catch (err) {
      console.error('[SalesReportScreen] Failed to load sales report:', err);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [loadReport])
  );

  useEffect(() => {
    loadReport();
  }, [period, loadReport]);

  const handleOpenEntry = (date?: string) => {
    navigation.navigate('DailyEntry', { date });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('salesReport')}</Text>
        <Pressable onPress={() => handleOpenEntry()} style={styles.todayEntryBtn}>
          <Ionicons name="add-circle-outline" size={18} color={colors.accent.teal} />
          <Text style={styles.todayEntryBtnText}>{t('todaySummary')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Period Pills */}
        <View style={styles.periodRow}>
          {(['today', 'thisWeek', 'thisMonth', 'custom'] as PeriodOption[]).map((p) => {
            const isSelected = period === p;
            const labelKey = p as any;
            return (
              <Pressable
                key={p}
                onPress={() => {
                  setPeriod(p);
                  if (p === 'custom' && !fromDateInput) {
                    const todayStr = getTodayDateString();
                    setFromDateInput(todayStr);
                    setToDateInput(todayStr);
                  }
                }}
                style={[styles.periodPill, isSelected && styles.periodPillSelected]}
              >
                <Text style={[styles.periodPillText, isSelected && styles.periodPillTextSelected]}>
                  {t(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom Range Input */}
        {period === 'custom' && (
          <View style={styles.customRangeRow}>
            <View style={styles.customDateCol}>
              <Text style={styles.customDateLabel}>{t('fromDate')} (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.customDateInput}
                value={fromDateInput}
                onChangeText={setFromDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
              />
            </View>
            <View style={styles.customDateCol}>
              <Text style={styles.customDateLabel}>{t('toDate')} (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.customDateInput}
                value={toDateInput}
                onChangeText={setToDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent.teal} style={{ marginVertical: 32 }} />
        ) : (
          <>
            {/* Summary Cards Horizontal Scroll */}
            {reportTotals && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll}>
                <View style={[styles.statCard, { borderLeftColor: colors.accent.teal }]}>
                  <Text style={styles.statLabel}>{t('totalRevenue')}</Text>
                  <Text style={[styles.statValue, { color: colors.accent.teal }]}>
                    {formatMoney(reportTotals.totalRevenue)}
                  </Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: colors.debt }]}>
                  <Text style={styles.statLabel}>{t('totalExpenses')}</Text>
                  <Text style={[styles.statValue, { color: colors.debt }]}>
                    {formatMoney(reportTotals.totalExpenses)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statCard,
                    {
                      borderLeftColor:
                        reportTotals.profit >= 0 ? colors.accent.teal : colors.debt,
                    },
                  ]}
                >
                  <Text style={styles.statLabel}>{t('netProfit')}</Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          reportTotals.profit >= 0 ? colors.accent.teal : colors.debt,
                      },
                    ]}
                  >
                    {formatMoney(reportTotals.profit)}
                  </Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: colors.text.secondary }]}>
                  <Text style={styles.statLabel}>{t('daysRecorded')}</Text>
                  <Text style={[styles.statValue, { color: colors.text.primary }]}>
                    {reportTotals.dayCount}
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* Sales Trend Chart */}
            <SalesTrendChart summaries={summaries} />

            {/* Revenue Breakdown */}
            {reportTotals && reportTotals.totalRevenue > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{t('revenueBreakdown')}</Text>

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>💵 {t('cashSales')}</Text>
                  <Text style={styles.breakdownValue}>
                    {formatMoney(reportTotals.totalCashSales)} (
                    {Math.round((reportTotals.totalCashSales / reportTotals.totalRevenue) * 100)}%)
                  </Text>
                </View>

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>📱 {t('mpesaSales')}</Text>
                  <Text style={styles.breakdownValue}>
                    {formatMoney(reportTotals.totalMpesaSales)} (
                    {Math.round((reportTotals.totalMpesaSales / reportTotals.totalRevenue) * 100)}%)
                  </Text>
                </View>

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>🤝 {t('creditIssued')}</Text>
                  <Text style={styles.breakdownValue}>
                    {formatMoney(reportTotals.totalCreditIssued)} (
                    {Math.round((reportTotals.totalCreditIssued / reportTotals.totalRevenue) * 100)}%)
                  </Text>
                </View>
              </View>
            )}

            {/* Expenses By Category */}
            {reportTotals && reportTotals.totalExpenses > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{t('expensesByCategory')}</Text>

                {EXPENSE_CATEGORIES.map((cat) => {
                  const catAmount = reportTotals.expenseBreakdown[cat] || 0;
                  if (catAmount <= 0) return null;

                  const percentage = Math.round((catAmount / reportTotals.totalExpenses) * 100);
                  const categoryTranslationKey = `category${cat.charAt(0).toUpperCase() + cat.slice(1)}` as any;
                  const label = t(categoryTranslationKey) || EXPENSE_CATEGORY_LABELS[cat];

                  return (
                    <View key={cat} style={styles.expenseCatRow}>
                      <View style={styles.expenseCatHeader}>
                        <Text style={styles.expenseCatLabel}>{label}</Text>
                        <Text style={styles.expenseCatAmount}>
                          {formatMoney(catAmount)} ({percentage}%)
                        </Text>
                      </View>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${percentage}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Daily Entries List */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('dailyEntries')}</Text>

              {summaries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>{t('noEntriesForPeriod')}</Text>
                  <Pressable style={styles.emptyAddBtn} onPress={() => handleOpenEntry()}>
                    <Ionicons name="add-circle" size={18} color={colors.white} />
                    <Text style={styles.emptyAddBtnText}>{t('todaySummary')}</Text>
                  </Pressable>
                </View>
              ) : (
                summaries.map((item) => (
                  <DayRow
                    key={item.id}
                    summary={item}
                    onPress={() => handleOpenEntry(item.date)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Action Button (+) */}
      <Pressable
        onPress={() => handleOpenEntry()}
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
        ]}
        accessibilityLabel={t('todaySummary') || 'Add Daily Summary'}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.background.tertiary,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text.primary,
    },
    todayEntryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accent.tealDim,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
    },
    todayEntryBtnText: {
      color: colors.accent.teal,
      fontSize: 13,
      fontWeight: '700',
    },
    scrollContent: {
      padding: 16,
    },
    periodRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 16,
    },
    periodPill: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    periodPillSelected: {
      backgroundColor: colors.accent.teal,
      borderColor: colors.accent.teal,
    },
    periodPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    periodPillTextSelected: {
      color: colors.white,
      fontWeight: '700',
    },
    customRangeRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    customDateCol: {
      flex: 1,
    },
    customDateLabel: {
      fontSize: 11,
      color: colors.text.secondary,
      marginBottom: 4,
    },
    customDateInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    cardsScroll: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    statCard: {
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      marginRight: 10,
      width: 145,
      borderLeftWidth: 4,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    statValue: {
      fontSize: 17,
      fontWeight: '800',
    },
    sectionContainer: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    breakdownLabel: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '500',
    },
    breakdownValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
    },
    expenseCatRow: {
      marginBottom: 10,
    },
    expenseCatHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    expenseCatLabel: {
      fontSize: 13,
      color: colors.text.primary,
    },
    expenseCatAmount: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.debt,
    },
    barBg: {
      height: 6,
      backgroundColor: colors.background.tertiary,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      backgroundColor: colors.debt,
      borderRadius: 3,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 36,
      paddingHorizontal: 20,
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    emptyStateText: {
      fontSize: 15,
      color: colors.text.muted,
      fontWeight: '500',
      marginBottom: 4,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accent.teal,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 24,
      marginTop: 14,
    },
    emptyAddBtnText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent.teal,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent.teal,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    fabPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.95 }],
    },
  });
