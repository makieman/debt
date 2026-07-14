/**
 * src/components/pin/PinDot.tsx
 *
 * A single animated circle that represents one digit position in a PIN entry.
 *
 * ─── WHY CIRCLES? ────────────────────────────────────────────────────────────
 * Circles carry no directional meaning. Every major PIN UI (iOS lock screen,
 * M-Pesa, banking apps, Google Pay) uses circles. Users recognise them instantly
 * as "digit entered/not entered". Squares or rectangles suggest text input.
 * Don't fight convention — familiarity reduces cognitive load.
 *
 * ─── ANIMATED.SPRING() EXPLAINED ─────────────────────────────────────────────
 * Animated.spring() is a physics-based animation. It simulates a real spring:
 *
 *   tension:  spring stiffness. Higher = moves faster to the target value.
 *   friction: damping. Higher = less bounce, settles faster.
 *
 * We use it here (vs Animated.timing) because:
 *   - timing() moves at a fixed rate — mechanical, robotic
 *   - spring() overshoots slightly then settles — organic, satisfying
 *
 * The "pop" when a dot fills mimics the feedback of pressing a real button.
 * This is why every good PIN UI uses spring animations for state changes.
 *
 * useNativeDriver: true — the animation runs on the UI thread (native side),
 * not the JS thread. This keeps animations smooth even when JS is busy with
 * DB queries or other async work. REQUIRED for transform/opacity animations.
 *
 * ─── THE SHAKE ANIMATION ─────────────────────────────────────────────────────
 * When the user enters a wrong PIN, all 4 dots shake horizontally.
 * The shake pattern: 0 → -8 → 8 → -8 → 8 → 0 (like a head shaking "no").
 * This is a universal "wrong" signal — used by every OS lock screen.
 *
 * ─── STAGGER EFFECT ──────────────────────────────────────────────────────────
 * Each dot has a slightly higher spring tension based on its index.
 * Dot 0 is slowest, dot 3 is fastest. This creates a subtle wave when
 * all 4 dots fill simultaneously (correct PIN) — left-to-right ripple.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface PinDotProps {
  /** Whether this position has been filled (digit entered). */
  filled: boolean;
  /** Whether to show the error state (wrong PIN entered). */
  error: boolean;
  /** Position 0–3 — used for stagger animation timing. */
  index: number;
}

export function PinDot({ filled, error, index }: PinDotProps) {
  const scaleAnim = useRef(new Animated.Value(filled ? 1 : 0.6)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fillOpacity = useRef(new Animated.Value(filled ? 1 : 0)).current;

  // ── Fill / Unfill animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (filled) {
      // Spring in: scale from 0.6 → 1.0 with a satisfying "pop"
      // Stagger: each dot has progressively higher tension (faster spring)
      // creating a left-to-right wave effect when all 4 fill at once.
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 300 + index * 40, // dot 0: 300, dot 1: 340, dot 2: 380, dot 3: 420
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(fillOpacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Shrink back down when digit is deleted (backspace)
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.6,
          tension: 400,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(fillOpacity, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [filled]);

  // ── Shake animation on error ─────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      // Head-shake pattern: 0 → -8 → 8 → -8 → 8 → 0
      // Total duration: ~400ms. Each step is ~80ms.
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,  duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,  duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          transform: [
            { scale: scaleAnim },
            { translateX: shakeAnim },
          ],
        },
      ]}
    >
      {/* Inner filled circle — opacity animates separately for colour control */}
      <Animated.View
        style={[
          styles.fill,
          error ? styles.fillError : styles.fillNormal,
          { opacity: fillOpacity },
        ]}
      />
    </Animated.View>
  );
}

const DOT_SIZE = 22;

const styles = StyleSheet.create({
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fill: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    position: 'absolute',
  },
  fillNormal: {
    backgroundColor: '#FFFFFF',
  },
  fillError: {
    backgroundColor: '#FF4444',
  },
});
