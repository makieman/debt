/**
 * src/components/sales/AddExpenseSheet.tsx
 *
 * Bottom sheet modal component for adding a daily expense.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext, Colors } from '../../theme';
import { useLanguage } from '../../store/LanguageContext';
import { Numpad } from '../Numpad';
import { toCents, formatMoney } from '../../utils/money';
import {
  ExpenseCategory,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  NewDailyExpense,
} from '../../types';

interface AddExpenseSheetProps {
  visible: boolean;
  onAdd: (expense: Omit<NewDailyExpense, 'summaryId'>) => void;
  onClose: () => void;
}

export function AddExpenseSheet({ visible, onAdd, onClose }: AddExpenseSheetProps) {
  const { colors } = useThemeContext();
  const { t } = useLanguage();
  const styles = makeStyles(colors);

  const [category, setCategory] = useState<ExpenseCategory>('stock');
  const [customCategory, setCustomCategory] = useState('');
  const [numpadValue, setNumpadValue] = useState('');
  const [note, setNote] = useState('');

  const handleNumpadChange = useCallback((val: string) => {
    setNumpadValue(val);
  }, []);

  const amountCents = toCents(numpadValue);
  const isValid = amountCents > 0 && (category !== 'custom' || customCategory.trim().length > 0);

  const handleAdd = () => {
    if (!isValid) return;

    onAdd({
      category,
      customCategory: category === 'custom' ? customCategory.trim() : undefined,
      amount: amountCents,
      note: note.trim() || undefined,
    });

    // Reset form
    setCategory('stock');
    setCustomCategory('');
    setNumpadValue('');
    setNote('');
    onClose();
  };

  const handleClose = () => {
    setCategory('stock');
    setCustomCategory('');
    setNumpadValue('');
    setNote('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheetContainer}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('addExpenseTitle')}</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Category selection */}
            <Text style={styles.sectionLabel}>{t('expenseCategory')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                const categoryTranslationKey = `category${cat.charAt(0).toUpperCase() + cat.slice(1)}` as any;
                const label = t(categoryTranslationKey) || EXPENSE_CATEGORY_LABELS[cat];

                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Custom category field */}
            {category === 'custom' && (
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  placeholder={t('customCategoryPlaceholder')}
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            )}

            {/* Amount display */}
            <Text style={styles.sectionLabel}>{t('expenseAmount')}</Text>
            <View style={styles.amountDisplayContainer}>
              <Text style={styles.currencyPrefix}>KES</Text>
              <Text style={styles.amountText}>
                {numpadValue ? formatMoney(amountCents, '') : '0.00'}
              </Text>
            </View>

            {/* Numpad */}
            <Numpad value={numpadValue} onChange={handleNumpadChange} maxLength={7} />

            {/* Note field */}
            <Text style={styles.sectionLabel}>{t('expenseNote')}</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Bought 10 bags unga"
                placeholderTextColor={colors.text.muted}
              />
            </View>

            {/* Add Expense Button */}
            <Pressable
              onPress={handleAdd}
              disabled={!isValid}
              style={[styles.addBtn, !isValid && styles.addBtnDisabled]}
            >
              <Text style={styles.addBtnText}>{t('addExpenseBtn')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheetContainer: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: 24,
      maxHeight: '90%',
    },
    dragHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.background.tertiary,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    closeBtn: {
      padding: 4,
    },
    scrollContent: {
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.secondary,
      textTransform: 'uppercase',
      marginTop: 12,
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    categoryRow: {
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 8,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.background.tertiary,
    },
    categoryChipSelected: {
      backgroundColor: colors.accent.teal,
      borderColor: colors.accent.teal,
    },
    categoryChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    categoryChipTextSelected: {
      color: colors.white,
    },
    amountDisplayContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
      paddingVertical: 14,
      borderRadius: 18,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: colors.accent.tealDim,
      gap: 8,
    },
    currencyPrefix: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    amountText: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.text.primary,
    },
    inputBox: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    textInput: {
      fontSize: 14,
      color: colors.text.primary,
    },
    addBtn: {
      backgroundColor: colors.accent.teal,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 20,
    },
    addBtnDisabled: {
      opacity: 0.4,
    },
    addBtnText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '700',
    },
  });
