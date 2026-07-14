/**
 * src/screens/PinScreen.tsx
 *
 * The full-screen PIN entry/setup UI. This is NOT a navigation screen —
 * it renders as an absolute-positioned overlay that covers the entire app.
 *
 * ─── WHY NOT A NAVIGATION SCREEN? ────────────────────────────────────────────
 * PinScreen replaces the entire React Navigation tree when the app is locked.
 * If we put it inside the navigator, the tab bar and headers would still be
 * visible (and interactive) behind it. By rendering it at the App.tsx level
 * as a conditional, we guarantee nothing else is mounted or visible while locked.
 *
 * ─── WHY 72px NUMPAD KEYS? ───────────────────────────────────────────────────
 * A human finger is roughly 44px wide. At 72px per key, there's 28px of error
 * tolerance on every side — important for a shopkeeper tapping while moving or
 * multitasking. Apple's HIG recommends 44px minimum; we go larger because
 * PIN entry is a critical action where misses create friction.
 *
 * ─── WHY AUTO-TRIGGER BIOMETRICS ON MOUNT? ───────────────────────────────────
 * Reducing friction for the happy path. The shopkeeper picks up their phone,
 * the fingerprint prompt appears automatically, they touch the sensor, done —
 * zero taps. If biometrics fail or they cancel, the PIN numpad is right there.
 * Every banking app (M-Pesa, Equity, KCB) auto-triggers biometrics this way.
 *
 * ─── MODE STATE MACHINE ──────────────────────────────────────────────────────
 * "unlock"         → verify existing PIN to unlock app
 * "setup"          → choose a new 4-digit PIN (step 1)
 * "setup-confirm"  → re-enter the same PIN (step 2)
 * "change-current" → verify current PIN before changing
 * "change-new"     → enter new PIN (step 1)
 * "change-confirm" → confirm new PIN (step 2)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinDot } from '../components/pin/PinDot';
import {
  verifyPin,
  recordFailedAttempt,
  clearFailedAttempts,
  clearLockTimestamp,
  getLockoutStatus,
  setPin,
} from '../store/security';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PinMode =
  | 'unlock'
  | 'setup'
  | 'setup-confirm'
  | 'change-current'
  | 'change-new'
  | 'change-confirm';

interface PinScreenProps {
  mode: PinMode;
  onSuccess: (pin?: string) => void;
  onCancel?: () => void;
  /** For confirm modes: the PIN entered in the previous step. */
  enteredPin?: string;
}

// ─── Title + Subtitle maps ────────────────────────────────────────────────────

const TITLES: Record<PinMode, string> = {
  'unlock': 'Enter PIN',
  'setup': 'Create PIN',
  'setup-confirm': 'Confirm PIN',
  'change-current': 'Enter current PIN',
  'change-new': 'Enter new PIN',
  'change-confirm': 'Confirm new PIN',
};

const SUBTITLES: Record<PinMode, string> = {
  'unlock': 'Enter your 4-digit PIN',
  'setup': 'Choose a 4-digit PIN',
  'setup-confirm': 'Enter PIN again to confirm',
  'change-current': 'Verify your identity',
  'change-new': 'Choose a new 4-digit PIN',
  'change-confirm': 'Enter new PIN again to confirm',
};


const NUMPAD_ROWS: (string | null)[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [ '0', '\u232B'],
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PinScreen({ mode, onSuccess, onCancel, enteredPin }: PinScreenProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dotError, setDotError] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Animated value for error message slide-in
  const errorSlide = useRef(new Animated.Value(-10)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;

  // Countdown interval ref
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Lockout check ──────────────────────────────────────────────────────────

  const checkAndStartLockout = useCallback(async () => {
    const status = await getLockoutStatus();
    if (status.isLockedOut) {
      setIsLockedOut(true);
      setLockoutRemaining(Math.ceil(status.remainingMs / 1000));
      startCountdown(Math.ceil(status.remainingMs / 1000));
    } else {
      setIsLockedOut(false);
    }
  }, []);

  function startCountdown(seconds: number) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    let remaining = seconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setIsLockedOut(false);
        setError(null);
      }
    }, 1000);
  }

  // ── Biometric check ────────────────────────────────────────────────────────

  const checkBiometrics = useCallback(async () => {
    if (mode !== 'unlock') return;
    try {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHW && enrolled) {
        setShowBiometric(true);
        // Auto-trigger biometric prompt on mount
        // Small delay so the screen has rendered first
        setTimeout(() => handleBiometric(), 300);
      }
    } catch {
      // Biometrics not available — silent failure, PIN always works
    }
  }, [mode]);

  // ── Mount effects ──────────────────────────────────────────────────────────

  useEffect(() => {
    checkAndStartLockout();
    if (mode === 'unlock') {
      checkBiometrics();
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Error animation ────────────────────────────────────────────────────────

  const showError = useCallback((message: string) => {
    setError(message);
    errorSlide.setValue(-10);
    errorOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(errorSlide, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(errorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const triggerDotError = useCallback(() => {
    setDotError(true);
    setTimeout(() => {
      setDotError(false);
      setCurrentPin('');
    }, 700);
  }, []);

  // ── Biometric handler ──────────────────────────────────────────────────────

  const handleBiometric = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Credi',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
      });
      if (result.success) {
        await clearFailedAttempts();
        await clearLockTimestamp();
        onSuccess();
      }
      // Cancelled or failed: do nothing, PIN numpad is available
    } catch {
      // Silent — biometric errors should never block PIN entry
    }
  }, [onSuccess]);

  // ── PIN complete handler ───────────────────────────────────────────────────

  const handlePinComplete = useCallback(async (pin: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      switch (mode) {
        case 'unlock': {
          const status = await getLockoutStatus();
          if (status.isLockedOut) {
            setIsLockedOut(true);
            setLockoutRemaining(Math.ceil(status.remainingMs / 1000));
            startCountdown(Math.ceil(status.remainingMs / 1000));
            setCurrentPin('');
            return;
          }

          const correct = await verifyPin(pin);
          if (correct) {
            await clearFailedAttempts();
            await clearLockTimestamp();
            onSuccess();
          } else {
            const attemptsBefore = await recordFailedAttempt();
            const newCount = attemptsBefore + 1;

            // Check if just locked out
            const newStatus = await getLockoutStatus();
            if (newStatus.isLockedOut) {
              showError(`Too many attempts. Try again in ${Math.ceil(newStatus.remainingMs / 1000)}s`);
              setIsLockedOut(true);
              setLockoutRemaining(Math.ceil(newStatus.remainingMs / 1000));
              startCountdown(Math.ceil(newStatus.remainingMs / 1000));
            } else {
              const remaining = MAX_ATTEMPTS - newCount;
              showError(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
            }
            triggerDotError();
          }
          break;
        }

        case 'setup':
        case 'change-new': {
          // No verification — pass PIN to parent to go to confirm step
          onSuccess(pin);
          break;
        }

        case 'setup-confirm':
        case 'change-confirm': {
          if (pin === enteredPin) {
            await setPin(pin);
            onSuccess(pin);
          } else {
            showError('PINs do not match. Try again.');
            triggerDotError();
          }
          break;
        }

        case 'change-current': {
          const status = await getLockoutStatus();
          if (status.isLockedOut) {
            setIsLockedOut(true);
            setLockoutRemaining(Math.ceil(status.remainingMs / 1000));
            startCountdown(Math.ceil(status.remainingMs / 1000));
            setCurrentPin('');
            return;
          }

          const correct = await verifyPin(pin);
          if (correct) {
            await clearFailedAttempts();
            onSuccess(pin);
          } else {
            const attemptsBefore = await recordFailedAttempt();
            const newCount = attemptsBefore + 1;
            const newStatus = await getLockoutStatus();
            if (newStatus.isLockedOut) {
              showError(`Too many attempts. Try again in ${Math.ceil(newStatus.remainingMs / 1000)}s`);
              setIsLockedOut(true);
              setLockoutRemaining(Math.ceil(newStatus.remainingMs / 1000));
              startCountdown(Math.ceil(newStatus.remainingMs / 1000));
            } else {
              const remaining = MAX_ATTEMPTS - newCount;
              showError(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
            }
            triggerDotError();
          }
          break;
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, [mode, enteredPin, isProcessing, onSuccess, showError, triggerDotError]);

  // ── Digit press ────────────────────────────────────────────────────────────

  const handleDigit = useCallback((digit: string) => {
    if (isLockedOut || isProcessing) return;
    if (currentPin.length >= 4) return;

    const newPin = currentPin + digit;
    setCurrentPin(newPin);

    if (newPin.length === 4) {
      // Brief delay so the 4th dot animates before we process
      setTimeout(() => handlePinComplete(newPin), 100);
    }
  }, [currentPin, isLockedOut, isProcessing, handlePinComplete]);

  const handleBackspace = useCallback(() => {
    if (isLockedOut || isProcessing) return;
    setCurrentPin(prev => prev.slice(0, -1));
  }, [isLockedOut, isProcessing]);

  // ── Countdown formatter ────────────────────────────────────────────────────

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* ── Cancel / Back button (only in setup/change flows) ── */}
        {onCancel && (
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}

        {/* ── Top section ── */}
        <View style={styles.topSection}>
          {/* App monogram */}
          <View style={styles.monogram}>
            <Text style={styles.monogramText}>DD</Text>
          </View>

          <Text style={styles.title}>{TITLES[mode]}</Text>
          <Text style={styles.subtitle}>{SUBTITLES[mode]}</Text>
        </View>

        {/* ── Middle: PIN dots + error/lockout ── */}
        <View style={styles.middleSection}>
          {/* PIN dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <PinDot
                key={i}
                index={i}
                filled={i < currentPin.length}
                error={dotError}
              />
            ))}
          </View>

          {/* Error message */}
          <Animated.View
            style={[
              styles.errorContainer,
              { transform: [{ translateY: errorSlide }], opacity: errorOpacity },
            ]}
          >
            {error && !isLockedOut && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </Animated.View>

          {/* Lockout countdown */}
          {isLockedOut && (
            <View style={styles.lockoutContainer}>
              <Text style={styles.lockoutLabel}>Too many attempts</Text>
              <Text style={styles.countdownText}>{formatCountdown(lockoutRemaining)}</Text>
              <Text style={styles.lockoutSub}>Try again after the countdown</Text>
            </View>
          )}
        </View>

        {/* ── Numpad — 4 rows × 3 columns ── */}
        <View style={[styles.numpad, isLockedOut && styles.numpadDisabled]}>
          {NUMPAD_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.numpadRow}>
              {row.map((key, colIndex) => {
                const isEmpty = key === null;
                const isBio = isEmpty && showBiometric && mode === 'unlock';

                // Empty placeholder cell
                if (isEmpty && !isBio) {
                  return (
                    <View key={`empty-${colIndex}`} style={styles.key}>
                      <View style={[styles.keyCircle, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />
                    </View>
                  );
                }

                // Biometric key cell
                if (isBio) {
                  return (
                    <Pressable
                      key="biometric"
                      style={({ pressed }) => [
                        styles.key,
                        pressed && styles.keyPressed,
                      ]}
                      onPress={handleBiometric}
                      disabled={isLockedOut}
                    >
                      <View style={[styles.keyCircle, { backgroundColor: 'transparent', borderColor: 'transparent' }]}>
                        <Ionicons
                          name="finger-print"
                          size={28}
                          color={isLockedOut ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)'}
                        />
                      </View>
                    </Pressable>
                  );
                }

                // Backspace key
                if (key === '\u232B') {
                  return (
                    <Pressable
                      key="backspace"
                      style={({ pressed }) => [
                        styles.key,
                        pressed && styles.keyPressed,
                      ]}
                      onPress={handleBackspace}
                      disabled={isLockedOut}
                    >
                      <View style={styles.keyCircle}>
                        <Ionicons
                          name="backspace-outline"
                          size={24}
                          color={isLockedOut ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)'}
                        />
                      </View>
                    </Pressable>
                  );
                }

                // Digit key
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.key,
                      pressed && !isLockedOut && styles.keyPressed,
                    ]}
                    onPress={() => handleDigit(key)}
                    disabled={isLockedOut}
                  >
                    <View style={styles.keyCircle}>
                      <Text style={[styles.keyText, isLockedOut && styles.keyTextDisabled]}>
                        {key}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Bottom padding ── */}
        <View style={styles.bottomPad} />
      </SafeAreaView>
    </View>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;

// ─── Styles ────────────────────────────────────────────────────────────────────

const KEY_SIZE = 72;
const KEY_CIRCLE = 68;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  cancelButton: {
    alignSelf: 'center',
    padding: 16,
    marginTop: 4,
  },

  // ── Top section ──
  topSection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  monogram: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(45, 212, 191, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    // Soft glow
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  monogramText: {
    color: '#2DD4BF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
  },

  // ── Middle section (dots + feedback) ──
  middleSection: {
    alignItems: 'center',
    gap: 4,
  },

  // ── Dots ──
  dotsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 4,
  },

  // ── Error ──
  errorContainer: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ── Lockout ──
  lockoutContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockoutLabel: {
    color: '#FF4444',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  countdownText: {
    color: '#2DD4BF',
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  lockoutSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },

  // ── Numpad ──
  numpad: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    gap: 8,
  },
  numpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  numpadDisabled: {
    opacity: 0.3,
  },
  key: {
    flex: 1,
    height: KEY_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyCircle: {
    width: KEY_CIRCLE,
    height: KEY_CIRCLE,
    borderRadius: KEY_CIRCLE / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyPressed: {
    opacity: 0.4,
  },
  keyText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  keyTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },

  bioKey: {
    width: KEY_CIRCLE,
    height: KEY_CIRCLE,
    borderRadius: KEY_CIRCLE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomPad: { height: 16 },
});

