/**
 * src/components/Numpad.tsx
 *
 * Professional circular phone-dialer style numpad for Duka Deni.
 * Features distinct circular key buttons with sub-letters, contrast framing,
 * native ripples, and zero-lag memoization.
 */

import React, { useCallback, useRef } from 'react';
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

const KEY_SUB_LABELS: Record<string, string> = {
  '1': '',
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
  '.': '',
  '0': '+',
};

export function Numpad({ value, onChange, maxLength = 7 }: NumpadProps) {
  const { colors, isDark } = useThemeContext();
  const styles = makeStyles(colors, isDark);

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
              subLabel={KEY_SUB_LABELS[key]}
              onPress={handleKeyPress}
              isBackspace={key === '⌫'}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

interface NumpadKeyProps {
  label: string;
  subLabel?: string;
  onPress: (key: string) => void;
  isBackspace: boolean;
}

const NumpadKey = React.memo(function NumpadKey({
  label,
  subLabel,
  onPress,
  isBackspace,
}: NumpadKeyProps) {
  const { colors, isDark } = useThemeContext();
  const styles = makeStyles(colors, isDark);

  const handlePress = useCallback(() => {
    onPress(label);
  }, [label, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{
        color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)',
        borderless: true,
        radius: 34,
      }}
      style={({ pressed }) => [
        styles.keyCircle,
        isBackspace && styles.actionKeyCircle,
        label === '.' && styles.actionKeyCircle,
        pressed && styles.keyPressed,
      ]}
      accessibilityLabel={isBackspace ? 'backspace' : label}
      accessibilityRole="button"
    >
      {isBackspace ? (
        <Ionicons name="backspace-outline" size={26} color={colors.text.primary} />
      ) : (
        <View style={styles.keyTextCol}>
          <Text style={[styles.keyLabel, label === '.' && styles.dotLabel]}>
            {label}
          </Text>
          {Boolean(subLabel) && (
            <Text style={styles.subLabel}>{subLabel}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
});

const makeStyles = (colors: Colors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: 320,
      alignSelf: 'center',
      paddingVertical: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: 16,
    },
    keyCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: isDark ? '#263143' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 4,
    },
    actionKeyCircle: {
      backgroundColor: isDark ? '#1E2736' : '#E2E8F0',
    },
    keyPressed: {
      backgroundColor: isDark ? '#3B4A63' : '#CBD5E1',
      transform: [{ scale: 0.93 }],
    },
    keyTextCol: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyLabel: {
      fontSize: 25,
      fontWeight: '600',
      color: colors.text.primary,
      lineHeight: 28,
    },
    dotLabel: {
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 28,
    },
    subLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 1.2,
      marginTop: -2,
    },
  });
