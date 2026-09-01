/**
 * src/components/Numpad.tsx
 *
 * Clean, modern fintech-style numpad for Credi.
 *
 * Design: Flat rounded-rectangle keys with no borders, subtle background,
 * and smooth press feedback. Inspired by Cash App / M-Pesa numpads.
 * No phone-dialer sub-labels — this is a payment amount entry, not a dialer.
 *
 * PERFORMANCE NOTE — why styles live in Numpad, not NumpadKey:
 *
 * Each keypress triggers a state update in the parent (e.g. AddTransactionModal).
 * If NumpadKey calls useThemeContext() + makeStyles() internally, that causes
 * 12 separate StyleSheet.create() calls on every keypress — one per key.
 * StyleSheet.create() serialises styles over the JS-Native bridge and is NOT free.
 *
 * Fix: compute styles ONCE in Numpad (with useMemo) and pass them down as a
 * stable prop. NumpadKey receives a pre-built styles object and never calls
 * makeStyles or useThemeContext itself. Combined with the ThemeContext.Provider
 * useMemo fix, the keys are completely skipped by React on every keypress.
 *
 * ACCESSIBILITY & PRESS FEEDBACK:
 * Keys feature scale micro-animations and accessibility labels for screen readers.
 */

import React, { useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext, Colors } from '../theme';

interface NumpadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number; // default 7 → "99999.99" KES max
}

const KEYS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export function Numpad({ value, onChange, maxLength = 7 }: NumpadProps) {
  const { colors, isDark } = useThemeContext();

  // ONE StyleSheet.create() per theme change, not per keypress.
  // Without useMemo this ran on every render (every keystroke).
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const valueRef = useRef(value);
  valueRef.current = value;

  const handleKeyPress = useCallback(
    (key: string) => {
      const current = valueRef.current;

      if (key === '⌫') {
        onChange(current.slice(0, -1));
        return;
      }

      if (key === '.') {
        if (current.includes('.')) return;
        if (current === '' || current === '0') {
          onChange('0.');
          return;
        }
        onChange(current + '.');
        return;
      }

      // Digit handling
      const digits = current.replace('.', '');
      if (digits.length >= maxLength) return;

      if (current === '0' && key !== '.') {
        onChange(key);
        return;
      }

      const dotIndex = current.indexOf('.');
      if (dotIndex !== -1 && current.length - dotIndex > 2) return;

      onChange(current + key);
    },
    [onChange, maxLength]
  );

  return (
    <View style={styles.container}>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <NumpadKey
              key={key}
              label={key}
              onPress={handleKeyPress}
              isBackspace={key === '⌫'}
              isDot={key === '.'}
              styles={styles}
              isDark={isDark}
              primaryColor={colors.text.primary}
              mutedColor={colors.text.muted}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── NumpadKey ────────────────────────────────────────────────────────────────

type NumpadStyles = ReturnType<typeof makeStyles>;

interface NumpadKeyProps {
  label: string;
  onPress: (key: string) => void;
  isBackspace: boolean;
  isDot: boolean;
  // Styles computed once by parent — avoids 12× StyleSheet.create per keypress
  styles: NumpadStyles;
  isDark: boolean;
  primaryColor: string;
  mutedColor: string;
}

const NumpadKey = React.memo(
  function NumpadKey({
    label,
    onPress,
    isBackspace,
    isDot,
    styles,
    isDark,
    primaryColor,
    mutedColor,
  }: NumpadKeyProps) {
    const handlePress = useCallback(() => {
      onPress(label);
    }, [label, onPress]);

    const [isPressed, setIsPressed] = React.useState(false);

    return (
      <Pressable
        onPress={handlePress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        style={[
          styles.key,
          (isBackspace || isDot) && styles.actionKey,
          isPressed && styles.keyPressed,
        ]}
        accessibilityLabel={isBackspace ? 'backspace' : label}
        accessibilityRole="button"
        accessibilityState={{ selected: isPressed }}
      >
        {isBackspace ? (
          <Ionicons name="backspace-outline" size={24} color={mutedColor} />
        ) : (
          <Text style={[styles.keyLabel, isDot && styles.dotLabel]}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  },
  // Custom comparator: keys never need to re-render during typing because
  // their label/isBackspace are constants, and styles/colors only
  // change when the theme switches — which is rare.
  (prev, next) =>
    prev.label === next.label &&
    prev.isBackspace === next.isBackspace &&
    prev.isDot === next.isDot &&
    prev.styles === next.styles &&
    prev.isDark === next.isDark &&
    prev.primaryColor === next.primaryColor &&
    prev.mutedColor === next.mutedColor &&
    prev.onPress === next.onPress
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: Colors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: 340,
      alignSelf: 'center',
      paddingVertical: 4,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      marginBottom: 10,
    },
    key: {
      width: 88,
      height: 52,
      borderRadius: 14,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.06)'
        : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionKey: {
      backgroundColor: 'transparent',
    },
    keyPressed: {
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.10)',
      transform: [{ scale: 0.95 }],
    },
    keyLabel: {
      fontSize: 26,
      fontWeight: '500',
      color: colors.text.primary,
      lineHeight: 30,
    },
    dotLabel: {
      fontSize: 28,
      fontWeight: '700',
    },
  });
