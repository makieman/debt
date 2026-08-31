/**
 * src/components/AddTransactionModal.tsx
 *
 * The primary action modal for recording debts and payments.
 *
 * This modal is the most-used screen in the entire app — it opens every
 * time a shopkeeper records a transaction. Design priorities:
 *   1. FAST: numpad is immediately visible, no keyboard wait
 *   2. CLEAR: the amount is the hero element (40px font)
 *   3. SAFE: impossible to record a zero-amount transaction
 *
 * SLIDE-UP ANIMATION:
 * We use animationType="slide" on Modal, which gives us the native
 * iOS/Android bottom-sheet slide animation for free. No animation library
 * needed. On Android this slides up from the bottom; on iOS it matches
 * the native sheet behavior.
 *
 * WHY IS THE BUTTON DISABLED AT ZERO?
 * A zero-amount transaction is data pollution. It writes a ghost row to
 * the database (type='debt', amount=0) that appears in the history list
 * but means nothing. The shopkeeper sees "Debt: KES 0.00" and thinks the
 * app is broken. We prevent it at the UI layer — costs nothing, saves trust.
 *
 * WHY CALL onSuccess() BEFORE onClose()?
 * onSuccess() triggers a data refresh in the parent screen. This is an
 * async DB operation. Starting it BEFORE closing the modal means the data
 * refresh is already in flight while the modal animates closed. By the time
 * the modal is fully gone, the new balance and transaction row are ready.
 * Calling onClose() first would mean the screen shows stale data.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useThemeContext, Colors } from '../theme';
import { useShopProfile } from '../store/ShopProfileContext';
import { useLanguage } from '../store/LanguageContext';
import { Numpad } from './Numpad';
import { toCents, formatMoney } from '../utils/money';
import { addTransaction } from '../repositories/transactions';
import {
  getTodayDateString,
  getOrCreateTodaySummary,
  getCreditIssuedToday,
  upsertDailySummary,
} from '../repositories/dailySummary';
import { TransactionType } from '../types';
import { isSoundEnabled, playPaymentSound } from '../utils/sound';
import { db } from '../db';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddTransactionModalProps {
  visible: boolean;
  type: TransactionType;        // "debt" | "payment"
  customerId: number;
  onSuccess: () => void;        // called after successful DB write
  onClose: () => void;          // called to dismiss the modal
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddTransactionModal = React.memo(function AddTransactionModal({
  visible,
  type,
  customerId,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const { colors } = useThemeContext();
  const { profile } = useShopProfile();
  const { t } = useLanguage();
  const currency = profile?.currency || 'KES';
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // numpadValue is a string — see Numpad.tsx for why strings, not numbers
  const [numpadValue, setNumpadValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Derived values ─────────────────────────────────────────────────────────

  const parsedAmount = numpadValue === '' ? 0 : parseFloat(numpadValue);
  const amountInCents = toCents(parsedAmount);
  const isValid = amountInCents > 0;

  const displayAmount = (() => {
    if (numpadValue === '' || numpadValue === '0') return `${currency} 0.00`;
    if (numpadValue.endsWith('.')) return `${currency} ${numpadValue}`;
    return formatMoney(amountInCents, currency);
  })();

  const accentColor = type === 'debt' ? colors.debt : colors.payment;
  const title = type === 'debt' ? t('addDebt') : t('recordPayment');
  const buttonLabel = type === 'debt' ? t('recordDebt') : t('recordPayment');

  const handleNumpadChange = useCallback((val: string) => {
    setNumpadValue(val);
  }, []);

  // ── handleConfirm ──────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!isValid || saving) return;

    try {
      setSaving(true);

      // Write to database. amount is in CENTS.
      await addTransaction(db, {
        customerId,
        type,
        amount: amountInCents,    // ← integer cents, never floats
        note: note.trim() || undefined,
      });

      // Sync creditIssued on daily summary if debt transaction
      if (type === 'debt') {
        try {
          const today = getTodayDateString();
          const existing = await getOrCreateTodaySummary(db, today);
          const todayCredit = await getCreditIssuedToday(db, today);
          await upsertDailySummary(db, {
            date: today,
            cashSales: existing.cashSales,
            mpesaSales: existing.mpesaSales,
            creditIssued: todayCredit,
            notes: existing.notes ?? undefined,
          });
        } catch (err) {
          console.warn('[AddTransactionModal] Failed to sync creditIssued to daily summary:', err);
        }
      }

      // 1. Notify parent FIRST so the data refresh starts immediately
      onSuccess();

      // Play sound for payments (not debts) if enabled
      if (type === 'payment') {
        const soundOn = await isSoundEnabled();
        if (soundOn) {
          await playPaymentSound();
        }
      }

      // 2. Reset our local state for next time the modal opens
      setNumpadValue('');
      setNote('');

      // 3. Close the modal
      onClose();

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AddTransactionModal] Save failed:', message);
      // In a future day we'll show a toast/snackbar here.
      // For now, log it — at least we don't crash.
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, customerId, type, amountInCents, note, onSuccess, onClose]);

  // ── handleClose ────────────────────────────────────────────────────────────
  // Reset state when closing without saving, so the modal opens fresh
  const handleClose = useCallback(() => {
    setNumpadValue('');
    setNote('');
    onClose();
  }, [onClose]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"      // native slide-up from bottom
      transparent                // background shows through (we color the sheet)
      onRequestClose={handleClose}  // Android back button dismisses modal
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>

          {/* Drag handle — visual affordance that this is swipeable */}
          <View style={styles.dragHandle} />

          {/* Title */}
          <Text style={[styles.title, { color: accentColor }]}>{title}</Text>

          {/* Hero amount display */}
          <Text
            style={[
              styles.amountDisplay,
              { color: isValid ? accentColor : colors.text.muted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayAmount}
          </Text>

          {/* Numpad */}
          <Numpad
            value={numpadValue}
            onChange={handleNumpadChange}
            maxLength={7}
          />

          {/* Note input */}
          <TextInput
            style={styles.noteInput}
            placeholder={t('placeholderNote')}
            placeholderTextColor={colors.text.muted}
            value={note}
            onChangeText={setNote}
            maxLength={100}
            returnKeyType="done"
          // Don't show the system keyboard when note is focused
          // on the same screen as the numpad — it would scroll the view
          />

          {/* Confirm button */}
          <Pressable
            style={[
              styles.confirmButton,
              { backgroundColor: accentColor },
              !isValid && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isValid || saving}
            accessibilityLabel={buttonLabel}
            accessibilityState={{ disabled: !isValid }}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmButtonLabel}>{buttonLabel}</Text>
            )}
          </Pressable>

        </View>
      </View>
    </Modal>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.background.tertiary,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    minHeight: 64,   // prevents layout shift when value changes length
  },
  noteInput: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  confirmButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  confirmButtonDisabled: {
    opacity: 0.35,
  },
  confirmButtonLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
