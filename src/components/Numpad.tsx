/**
 * src/components/Numpad.tsx
 *
 * A custom full-width calculator-style numpad rendered directly in the UI.
 * Optimized with React.memo and instant touch feedback for zero input lag.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
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
  const { colors } = useThemeContext();
  const styles = makeStyles(colors);

  // Keep a ref to the latest value to avoid recreating callbacks on every keystroke
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
            />
          ))}
        </View>
      ))}
    </View>
  );
}

interface NumpadKeyProps {
  label: string;
  onPress: (key: string) => void;
  isBackspace: boolean;
}

const NumpadKey = React.memo(function NumpadKey({
  label,
  onPress,
  isBackspace,
}: NumpadKeyProps) {
  const { colors } = useThemeContext();
  const styles = makeStyles(colors);

  const handlePress = useCallback(() => {
    onPress(label);
  }, [label, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: colors.background.tertiary, borderless: false }}
      style={({ pressed }) => [
        styles.keyTile,
        isBackspace && styles.actionKeyTile,
        label === '.' && styles.actionKeyTile,
        pressed && styles.keyPressed,
      ]}
      accessibilityLabel={isBackspace ? 'backspace' : label}
      accessibilityRole="button"
    >
      {isBackspace ? (
        <Ionicons name="backspace-outline" size={26} color={colors.text.primary} />
      ) : (
        <Text style={[styles.keyLabel, label === '.' && styles.dotLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
});

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: 340,
      alignSelf: 'center',
      paddingVertical: 8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    keyTile: {
      flex: 1,
      height: 58,
      borderRadius: 16,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.background.tertiary,
      // Subtle depth shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    actionKeyTile: {
      backgroundColor: colors.background.secondary,
      opacity: 0.9,
    },
    keyPressed: {
      backgroundColor: colors.background.tertiary,
      transform: [{ scale: 0.96 }],
      opacity: 0.85,
    },
    keyLabel: {
      fontSize: 26,
      fontWeight: '600',
      color: colors.text.primary,
      textAlign: 'center',
    },
    dotLabel: {
      fontSize: 30,
      fontWeight: '800',
      lineHeight: 30,
    },
  });
