import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, StyleSheet, Easing } from 'react-native';
import { useThemeContext } from '../../theme';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  testID,
  accessibilityLabel,
}) => {
  const { colors } = useThemeContext();

  // Create two separate Animated.Values to allow useNativeDriver optimization
  // animPosition controls translateX (can run on native thread)
  const animPosition = useRef(new Animated.Value(value ? 1 : 0)).current;
  // animColor controls track background color (must run on JS thread)
  const animColor = useRef(new Animated.Value(value ? 1 : 0)).current;

  // Track the previous value to prevent unnecessary animations on mount
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      // Animate both values in parallel
      Animated.parallel([
        Animated.timing(animPosition, {
          toValue: value ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(animColor, {
          toValue: value ? 1 : 0,
          duration: 200,
          useNativeDriver: false,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    }
  }, [value, animPosition, animColor]);

  const handleToggle = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  // Interpolate the thumb translation
  // 3px from left to 23px from left (48px width - 22px thumb - 3px margin)
  const thumbTranslate = animPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 23],
  });

  // Interpolate track background color
  const trackBgColor = animColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.background.tertiary, colors.accent.teal],
  });

  return (
    <Pressable
      onPress={handleToggle}
      disabled={disabled}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.container,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackBgColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX: thumbTranslate }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    position: 'relative',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 3,
    // Shadow for depth on the thumb
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
    elevation: 3,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    // Slight scale effect on press for tactile feedback
    transform: [{ scale: 0.96 }],
  },
});
