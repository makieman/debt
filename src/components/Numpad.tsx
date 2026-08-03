/**
 * src/components/Numpad.tsx
 *
 * Professional circular phone-dialer style numpad for Credi.
 * Optimized with custom React.memo comparator for 0ms tap latency.
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

const NumpadKey = React.memo(
  function NumpadKey({ label, subLabel, onPress, isBackspace }: NumpadKeyProps) {
    const { colors, isDark } = useThemeContext();
    const styles = makeStyles(colors, isDark);

    const handlePress = useCallback(() => {
      onPress(label);
    }, [label, onPress]);

    return (
      <Pressable
        onPress={handlePress}
        android_ripple={{
          color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)',
          borderless: true,
          radius: 35,
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
  },
  (prev, next) =>
    prev.label === next.label &&
    prev.subLabel === next.subLabel &&
    prev.isBackspace === next.isBackspace
);

const makeStyles = (colors: Colors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: 320,
      alignSelf: 'center',
      paddingVertical: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: 14,
    },
    keyCircle: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: isDark ? '#2D3748' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.12)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 4,
    },
    actionKeyCircle: {
      backgroundColor: isDark ? '#1F2733' : '#E2E8F0',
    },
    keyPressed: {
      backgroundColor: isDark ? '#4A5568' : '#CBD5E1',
      transform: [{ scale: 0.93 }],
    },
    keyTextCol: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyLabel: {
      fontSize: 26,
      fontWeight: '600',
      color: colors.text.primary,
      lineHeight: 28,
    },
    dotLabel: {
      fontSize: 30,
      fontWeight: '800',
      lineHeight: 30,
    },
    subLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.text.muted,
      letterSpacing: 1.2,
      marginTop: -2,
    },
  });
