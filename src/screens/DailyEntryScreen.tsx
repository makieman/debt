/**
 * src/screens/DailyEntryScreen.tsx
 *
 * End-of-day daily entry screen for cash sales, M-Pesa sales, credit issued, and expenses.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useThemeContext, Colors } from '../theme';
import { useLanguage } from '../store/LanguageContext';
import { useDailySummary } from '../hooks/useDailySummary';
import { AddExpenseSheet } from '../components/sales/AddExpenseSheet';
import { Numpad } from '../components/Numpad';
import { formatMoney, toCents } from '../utils/money';
import { getTodayDateString } from '../repositories/dailySummary';
import { EXPENSE_CATEGORY_LABELS } from '../types';

type DailyEntryRouteProp = RouteProp<{ DailyEntry: { date?: string } }, 'DailyEntry'>;

export function DailyEntryScreen() {
  const navigation = useNavigation();
  const route = useRoute<DailyEntryRouteProp>();
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const styles = makeStyles(colors);

  const targetDate = route.params?.date ?? getTodayDateString();
  const isPastDate = targetDate !== getTodayDateString();

  const {
    summary,
    loading,
    error,
    saveSummary,
    addExpense,
    deleteExpense,
  } = useDailySummary(targetDate);

  // Active Numpad editing state
  const [activeField, setActiveField] = useState<'cash' | 'mpesa' | 'credit' | null>(null);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savedBadgeVisible, setSavedBadgeVisible] = useState(false);
  const [isCreditEdited, setIsCreditEdited] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (summary) {
      setNotesText(summary.notes ?? '');
    }
  }, [summary?.id]);

  const triggerAutoSave = useCallback(
    (updates: { cashSales?: number; mpesaSales?: number; creditIssued?: number; notes?: string }) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(async () => {
        await saveSummary(updates);
        setSavedBadgeVisible(true);
        setTimeout(() => setSavedBadgeVisible(false), 2000);
      }, 800);
    },
    [saveSummary]
  );

  const openNumpad = (field: 'cash' | 'mpesa' | 'credit') => {
    setActiveField(field);
  };

  const handleNumpadConfirm = (field: 'cash' | 'mpesa' | 'credit', cents: number) => {
    if (!summary) return;

    if (field === 'cash') {
      triggerAutoSave({ cashSales: cents });
    } else if (field === 'mpesa') {
      triggerAutoSave({ mpesaSales: cents });
    } else if (field === 'credit') {
      setIsCreditEdited(true);
      triggerAutoSave({ creditIssued: cents });
    }

    setActiveField(null);
  };

  const handleNotesChange = (text: string) => {
    setNotesText(text);
    triggerAutoSave({ notes: text });
  };

  // Format header date string
  const formatHeaderDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading || !summary) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.teal} />
      </SafeAreaView>
    );
  }

  const profit = summary.profit;
  const isProfitPositive = profit > 0;
  const isProfitNegative = profit < 0;

  const profitBgColor = isProfitPositive
    ? colors.accent.tealDim
    : isProfitNegative
    ? '#EF444420'
    : colors.background.secondary;

  const profitTextColor = isProfitPositive
    ? colors.accent.teal
    : isProfitNegative
    ? colors.debt
    : colors.text.secondary;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>{t('todaySummary')}</Text>
          <Text style={[styles.headerDate, isPastDate && styles.headerDatePast]}>
            {formatHeaderDate(targetDate)}
          </Text>
        </View>

        {savedBadgeVisible && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>{t('saved')}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* REVENUE SECTION */}
        <Text style={styles.sectionTitle}>{t('revenueToday')}</Text>

        {/* Row 1: Cash */}
        <Pressable style={styles.inputRow} onPress={() => openNumpad('cash')}>
          <View style={styles.inputRowLeft}>
            <Text style={styles.rowIcon}>💵</Text>
            <Text style={styles.rowLabel}>{t('cashSales')}</Text>
          </View>
          <Text style={styles.rowAmount}>{formatMoney(summary.cashSales)}</Text>
        </Pressable>

        {/* Row 2: M-Pesa */}
        <Pressable style={styles.inputRow} onPress={() => openNumpad('mpesa')}>
          <View style={styles.inputRowLeft}>
            <Text style={styles.rowIcon}>📱</Text>
            <Text style={styles.rowLabel}>{t('mpesaSales')}</Text>
          </View>
          <Text style={styles.rowAmount}>{formatMoney(summary.mpesaSales)}</Text>
        </Pressable>

        {/* Row 3: Credit Issued */}
        <Pressable style={styles.inputRow} onPress={() => openNumpad('credit')}>
          <View style={styles.inputRowLeft}>
            <Text style={styles.rowIcon}>🤝</Text>
            <View>
              <View style={styles.creditLabelRow}>
                <Text style={styles.rowLabel}>{t('creditIssued')}</Text>
                {isCreditEdited && (
                  <View style={styles.editedBadge}>
                    <Text style={styles.editedBadgeText}>{t('edited')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.autoFilledSubtext}>{t('autoFilledFromCredit')}</Text>
            </View>
          </View>
          <Text style={styles.rowAmount}>{formatMoney(summary.creditIssued)}</Text>
        </Pressable>

        {/* Total Revenue Bar */}
        <View style={styles.revenueTotalBar}>
          <Text style={styles.revenueTotalLabel}>{t('totalRevenue')}</Text>
          <Text style={styles.revenueTotalValue}>{formatMoney(summary.totalRevenue)}</Text>
        </View>

        {/* EXPENSES SECTION */}
        <Text style={styles.sectionTitle}>{t('expensesToday')}</Text>

        {summary.expenses.map((exp) => {
          const categoryTranslationKey = `category${exp.category.charAt(0).toUpperCase() + exp.category.slice(1)}` as any;
          const categoryLabel =
            exp.category === 'custom' && exp.customCategory
              ? exp.customCategory
              : t(categoryTranslationKey) || EXPENSE_CATEGORY_LABELS[exp.category];

          return (
            <View key={exp.id} style={styles.expenseRow}>
              <View style={styles.expenseLeft}>
                <View style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{categoryLabel}</Text>
                </View>
                {exp.note ? <Text style={styles.expenseNote}>{exp.note}</Text> : null}
              </View>

              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>{formatMoney(exp.amount)}</Text>
                <Pressable onPress={() => deleteExpense(exp.id)} style={styles.deleteExpenseBtn}>
                  <Ionicons name="close-circle" size={20} color={colors.text.muted} />
                </Pressable>
              </View>
            </View>
          );
        })}

        <Pressable style={styles.addExpenseBtn} onPress={() => setIsAddExpenseOpen(true)}>
          <Ionicons name="add" size={18} color={colors.accent.teal} />
          <Text style={styles.addExpenseText}>{t('addExpense')}</Text>
        </Pressable>

        {/* Total Expenses Bar */}
        <View style={styles.expenseTotalBar}>
          <Text style={styles.expenseTotalLabel}>{t('totalExpenses')}</Text>
          <Text style={styles.expenseTotalValue}>{formatMoney(summary.totalExpenses)}</Text>
        </View>

        {/* NET PROFIT CARD */}
        <View style={[styles.profitCard, { backgroundColor: profitBgColor }]}>
          <Text style={styles.profitLabel}>{t('netProfit')}</Text>
          <Text style={[styles.profitValue, { color: profitTextColor }]}>
            {formatMoney(profit)}
          </Text>

          <View style={styles.divider} />

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('totalRevenue')}</Text>
            <Text style={[styles.breakdownValue, { color: colors.payment }]}>
              {formatMoney(summary.totalRevenue)}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('totalExpenses')}</Text>
            <Text style={[styles.breakdownValue, { color: colors.debt }]}>
              {formatMoney(summary.totalExpenses)}
            </Text>
          </View>
        </View>

        {/* NOTES INPUT */}
        <View style={styles.notesContainer}>
          <TextInput
            style={styles.notesInput}
            value={notesText}
            onChangeText={handleNotesChange}
            placeholder={t('notesPlaceholder')}
            placeholderTextColor={colors.text.muted}
            multiline
          />
        </View>
      </ScrollView>

      {/* Numpad Modal */}
      <DailyNumpadModal
        activeField={activeField}
        initialCents={
          activeField === 'cash'
            ? summary.cashSales
            : activeField === 'mpesa'
            ? summary.mpesaSales
            : summary.creditIssued
        }
        onConfirm={handleNumpadConfirm}
        onClose={() => setActiveField(null)}
      />

      {/* Add Expense Sheet */}
      <AddExpenseSheet
        visible={isAddExpenseOpen}
        onAdd={(exp) => addExpense(exp)}
        onClose={() => setIsAddExpenseOpen(false)}
      />
    </SafeAreaView>
  );
}

interface DailyNumpadModalProps {
  activeField: 'cash' | 'mpesa' | 'credit' | null;
  initialCents: number;
  onConfirm: (field: 'cash' | 'mpesa' | 'credit', cents: number) => void;
  onClose: () => void;
}

const DailyNumpadModal = React.memo(function DailyNumpadModal({
  activeField,
  initialCents,
  onConfirm,
  onClose,
}: DailyNumpadModalProps) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const styles = makeStyles(colors);

  const [numpadValue, setNumpadValue] = useState('');

  useEffect(() => {
    if (activeField !== null) {
      setNumpadValue(initialCents > 0 ? (initialCents / 100).toString() : '');
    }
  }, [activeField, initialCents]);

  if (activeField === null) return null;

  const handleConfirm = () => {
    onConfirm(activeField, toCents(numpadValue));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.numpadSheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.numpadHeader}>
          <Text style={styles.numpadTitle}>
            {activeField === 'cash'
              ? t('cashSales')
              : activeField === 'mpesa'
              ? t('mpesaSales')
              : t('creditIssued')}
          </Text>
          <Pressable onPress={handleConfirm} style={styles.confirmBtn}>
            <Text style={styles.confirmBtnText}>{t('save')}</Text>
          </Pressable>
        </View>

        <View style={styles.numpadDisplay}>
          <Text style={styles.numpadCurrency}>KES</Text>
          <Text style={styles.numpadAmount}>
            {numpadValue ? formatMoney(toCents(numpadValue), '') : '0.00'}
          </Text>
        </View>

        <Numpad value={numpadValue} onChange={setNumpadValue} maxLength={7} />
      </View>
    </Modal>
  );
});

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.background.tertiary,
    },
    backBtn: {
      padding: 4,
      marginRight: 12,
    },
    headerTitleCol: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    headerDate: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    headerDatePast: {
      color: '#F59E0B',
      fontWeight: '700',
    },
    savedBadge: {
      backgroundColor: colors.accent.tealDim,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    savedBadgeText: {
      color: colors.accent.teal,
      fontSize: 12,
      fontWeight: '700',
    },
    scrollContent: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.secondary,
      textTransform: 'uppercase',
      marginTop: 8,
      marginBottom: 10,
      letterSpacing: 0.5,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    inputRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    rowIcon: {
      fontSize: 18,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    creditLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    autoFilledSubtext: {
      fontSize: 11,
      color: colors.accent.teal,
    },
    editedBadge: {
      backgroundColor: '#F59E0B20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    editedBadgeText: {
      fontSize: 10,
      color: '#F59E0B',
      fontWeight: '700',
    },
    rowAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text.primary,
    },
    revenueTotalBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.accent.tealDim,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 16,
    },
    revenueTotalLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent.teal,
    },
    revenueTotalValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.accent.teal,
    },
    expenseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 6,
    },
    expenseLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    categoryChip: {
      backgroundColor: colors.background.tertiary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    categoryChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text.primary,
    },
    expenseNote: {
      fontSize: 12,
      color: colors.text.secondary,
      flexShrink: 1,
    },
    expenseRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    expenseAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.debt,
    },
    deleteExpenseBtn: {
      padding: 2,
    },
    addExpenseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accent.teal,
      borderStyle: 'dashed',
      marginTop: 4,
      marginBottom: 8,
    },
    addExpenseText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent.teal,
    },
    expenseTotalBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#EF444415',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 16,
    },
    expenseTotalLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.debt,
    },
    expenseTotalValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.debt,
    },
    profitCard: {
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
    },
    profitLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    profitValue: {
      fontSize: 28,
      fontWeight: '800',
      marginVertical: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.background.tertiary,
      marginVertical: 10,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    breakdownLabel: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    breakdownValue: {
      fontSize: 12,
      fontWeight: '700',
    },
    notesContainer: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 24,
    },
    notesInput: {
      fontSize: 13,
      color: colors.text.primary,
      minHeight: 50,
      textAlignVertical: 'top',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    numpadSheet: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderColor: colors.background.tertiary,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.background.tertiary,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 14,
    },
    numpadHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    numpadTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    confirmBtn: {
      backgroundColor: colors.accent.teal,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 12,
    },
    confirmBtnText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 14,
    },
    numpadDisplay: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
      paddingVertical: 14,
      borderRadius: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.accent.tealDim,
      gap: 8,
    },
    numpadCurrency: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    numpadAmount: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.text.primary,
    },
  });
