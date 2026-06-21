/**
 * src/components/Numpad.tsx
 *
 * A custom full-width calculator-style numpad rendered directly in the UI
 * (not the system keyboard). Used for amount entry in AddTransactionModal.
 *
 * WHY A STRING FOR VALUE, NOT A NUMBER?
 * The user is building a number character-by-character. Intermediate states
 * like "150." (after typing a decimal point, before any decimal digit) cannot
 * be stored as a JavaScript number — Number("150.") === 150, the dot is lost.
 * We need the raw string at all times to render what the user typed exactly.
 * Conversion to a real number only happens when the user confirms the amount.
 *
 * WHY NOT THE SYSTEM KEYBOARD?
 * 1. The system numeric keyboard layout varies across Android versions.
 * 2. We get complete control over validation (one dot, no leading zeros).
 * 3. No keyboard slide-up animation — numpad is always visible in the modal.
 * 4. Large keys are easier to tap for shopkeepers in a busy environment.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NumpadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number; // default 7 → "99999.99" KES max
}

// ─── Key layout ──────────────────────────────────────────────────────────────

// The numpad layout as a 2D array. Each inner array is one row.
// '⌫' triggers backspace logic. '.' inserts a decimal point.
const KEYS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Numpad({ value, onChange, maxLength = 7 }: NumpadProps) {

  /**
   * handleKey processes every key press with the full validation logic.
   *
   * useCallback is used here because this function is passed as an `onPress`
   * prop to every Pressable key. Without useCallback, a new function object
   * is created on each render, causing all 12 key Pressables to re-render
   * (minor performance hit, but good habit for frequently-rendered lists).
   */
  const handleKey = useCallback((key: string) => {
    if (key === '⌫') {
      // Backspace: remove the last character
      // If value becomes empty after backspace, leave it empty (not "0")
      onChange(value.slice(0, -1));
      return;
    }

    if (key === '.') {
      // Only one decimal point allowed
      if (value.includes('.')) return;
      // Tapping '.' on empty value → insert "0." so we get "0.50" not ".50"
      if (value === '' || value === '0') {
        onChange('0.');
        return;
      }
      onChange(value + '.');
      return;
    }

    // --- Digit key pressed ---

    // Enforce max length (count only digit characters, not the dot)
    const digits = value.replace('.', '');
    if (digits.length >= maxLength) return;

    // No leading zeros: if current value is "0" and user types a digit,
    // REPLACE "0" with the new digit rather than appending ("05" → "5")
    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }

    // Enforce max 2 decimal places: if there's already a dot and 2 digits
    // after it, ignore the key press
    const dotIndex = value.indexOf('.');
    if (dotIndex !== -1 && value.length - dotIndex > 2) return;

    onChange(value + key);
  }, [value, onChange, maxLength]);

  return (
    <View style={styles.container}>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <NumpadKey
              key={key}
              label={key}
              onPress={() => handleKey(key)}
              isBackspace={key === '⌫'}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Individual Key ───────────────────────────────────────────────────────────

/**
 * NumpadKey renders a single pressable key.
 *
 * We use Pressable (not TouchableOpacity) because Pressable gives us
 * fine-grained control over the pressed state via its `style` prop function.
 * style={({ pressed }) => [base, pressed && overrideStyle]} lets us change
 * the background color on press without any animation library.
 */
interface NumpadKeyProps {
  label: string;
  onPress: () => void;
  isBackspace: boolean;
}

function NumpadKey({ label, onPress, isBackspace }: NumpadKeyProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        pressed && styles.keyPressed,
      ]}
      accessibilityLabel={isBackspace ? 'backspace' : label}
      accessibilityRole="button"
    >
      <Text style={[styles.keyLabel, isBackspace && styles.backspaceLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

// Key size: screen width minus horizontal padding, divided across 3 columns
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const KEY_SIZE = Math.floor((SCREEN_WIDTH - 48 - 16) / 3); // 48px side pad, 16px gap

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE * 0.6,        // keys are wider than tall (like a real numpad)
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.background.tertiary,
  },
  keyPressed: {
    backgroundColor: colors.background.tertiary,
  },
  keyLabel: {
    fontSize: 28,
    color: colors.text.primary,
    fontWeight: '400',
    textAlign: 'center',
  },
  backspaceLabel: {
    fontSize: 22,             // slightly smaller so ⌫ fits comfortably
    color: colors.text.secondary,
  },
});
