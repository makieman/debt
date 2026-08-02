/**
 * src/store/security.ts
 *
 * THE SECURITY STORE — Single source of truth for all PIN and lock state.
 *
 * ─── WHY THIS MODULE EXISTS ───────────────────────────────────────────────────
 *
 * Every SecureStore call in the app flows through this file. No other component
 * or screen calls SecureStore directly. This gives us:
 *
 *   1. A single place to change the key names or storage strategy
 *   2. Easy mocking in tests — mock this module, not expo-secure-store
 *   3. All business logic (validation, hashing, lockout) in one place
 *   4. Clear separation between "what to store" (here) and "how to show it" (UI)
 *
 * ─── ASYNCSTORAGE vs SECURESTORE ─────────────────────────────────────────────
 *
 * ShopProfile uses AsyncStorage — it stores preferences (theme, language, currency).
 * None of that data is sensitive. AsyncStorage is plain-text on disk.
 *
 * Security data (PIN hash, lockout timestamps) uses SecureStore because:
 *   - Android Keystore: hardware-backed AES-256 encryption
 *   - iOS Keychain: Secure Enclave protection
 *   - Cannot be read without device unlock credential
 *   - A rooted device + ADB can read AsyncStorage but NOT SecureStore
 *
 * ─── WHY WE HASH THE PIN ─────────────────────────────────────────────────────
 *
 * Storing "1234" in SecureStore is encrypted at rest. But if someone uses a
 * forensic tool on a rooted device, they see the value directly.
 *
 * We store: SHA256("1234" + SALT) → 64-character hex string
 * When verifying: we hash the user's input and compare hashes.
 * The original PIN never exists in storage anywhere.
 *
 * ─── WHAT IS A SALT? ──────────────────────────────────────────────────────────
 *
 * A rainbow table is a precomputed dictionary: hash → original value.
 * An attacker with a table for SHA256 can reverse "03ac674..." → "1234" instantly.
 *
 * A salt is a constant string we prepend to the PIN before hashing:
 *   SHA256("1234" + "duka-deni-pin-v1") → completely different hash
 *
 * The attacker's rainbow table is for SHA256("1234"), not SHA256("1234duka-deni-pin-v1").
 * They must rebuild the entire table for our specific salt — making the attack
 * computationally infeasible.
 *
 * The salt includes the app name (namespace) and version (so PIN format changes
 * in a future version don't collide with stored hashes from this version).
 *
 * ─── LOCK vs LOCKOUT ──────────────────────────────────────────────────────────
 *
 * LOCK: The app requires PIN entry because it went to the background.
 *   → Resolved by: entering the correct PIN or biometric auth
 *   → State lives in: SecurityContext (isLocked)
 *
 * LOCKOUT: Too many wrong PINs entered. Temporary ban.
 *   → Resolved by: waiting for the countdown timer to expire
 *   → State lives in: SecureStore (LOCKOUT_UNTIL_KEY)
 *
 * These are INDEPENDENT. You can be locked AND locked out simultaneously.
 * A locked-out user must wait before they can even attempt to enter a PIN.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// ─── Web Fallback Helpers ─────────────────────────────────────────────────────

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Salt prepended to PIN before hashing.
 * "duka-deni" = app namespace (prevents cross-app hash collisions)
 * "pin-v1"    = version (bump to "pin-v2" if PIN format ever changes)
 */
const SALT = 'duka-deni-pin-v1';

/** SecureStore key for the hashed PIN. Value: 64-char SHA-256 hex string. */
export const PIN_HASH_KEY = 'pin_hash';

/** SecureStore key for the app lock enabled flag. Value: "true" | "false". */
export const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';

/** SecureStore key for when the app last went to background. Value: timestamp ms string. */
const LOCK_TIMESTAMP_KEY = 'lock_timestamp';

/** SecureStore key for failed attempt count. Value: integer string. */
const FAILED_ATTEMPTS_KEY = 'failed_attempts';

/** SecureStore key for lockout end time. Value: timestamp ms string. */
const LOCKOUT_UNTIL_KEY = 'lockout_until';

/**
 * Grace period: app coming back from background within this window
 * does NOT require re-authentication.
 */
const GRACE_PERIOD_MS = 30 * 1000; // 30 seconds

/** Maximum wrong PIN attempts before lockout. */
const MAX_ATTEMPTS = 5;

/** Duration of lockout after MAX_ATTEMPTS failures. */
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LockoutStatus {
  /** Whether the user is currently locked out (too many wrong attempts). */
  isLockedOut: boolean;
  /** Milliseconds until lockout expires. 0 if not locked out. */
  remainingMs: number;
}

// ─── Functions ────────────────────────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + SALT
  );
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be 4 digits');
  }
  const hash = await hashPin(pin);
  await setItem(PIN_HASH_KEY, hash);
  await setItem(APP_LOCK_ENABLED_KEY, 'true');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = await getItem(PIN_HASH_KEY);
  if (!storedHash) return false;
  const candidateHash = await hashPin(pin);
  return candidateHash === storedHash;
}

export async function isPinSet(): Promise<boolean> {
  const value = await getItem(APP_LOCK_ENABLED_KEY);
  return value === 'true';
}

export async function isAppLockEnabled(): Promise<boolean> {
  return isPinSet();
}

export async function disableAppLock(): Promise<void> {
  await setItem(APP_LOCK_ENABLED_KEY, 'false');
}

export async function clearPin(): Promise<void> {
  await deleteItem(PIN_HASH_KEY);
  await setItem(APP_LOCK_ENABLED_KEY, 'false');
}

export async function recordFailedAttempt(): Promise<number> {
  const raw = await getItem(FAILED_ATTEMPTS_KEY);
  const current = raw ? parseInt(raw, 10) : 0;

  if (current + 1 >= MAX_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    await setItem(LOCKOUT_UNTIL_KEY, lockoutUntil.toString());
    await setItem(FAILED_ATTEMPTS_KEY, '0');
  } else {
    await setItem(FAILED_ATTEMPTS_KEY, (current + 1).toString());
  }

  return current;
}

export async function clearFailedAttempts(): Promise<void> {
  await setItem(FAILED_ATTEMPTS_KEY, '0');
  await deleteItem(LOCKOUT_UNTIL_KEY);
}

export async function getLockoutStatus(): Promise<LockoutStatus> {
  const raw = await getItem(LOCKOUT_UNTIL_KEY);
  if (!raw) return { isLockedOut: false, remainingMs: 0 };

  const lockoutUntil = parseInt(raw, 10);
  const now = Date.now();

  if (now >= lockoutUntil) {
    await deleteItem(LOCKOUT_UNTIL_KEY);
    return { isLockedOut: false, remainingMs: 0 };
  }

  return { isLockedOut: true, remainingMs: lockoutUntil - now };
}

export async function setLockTimestamp(): Promise<void> {
  await setItem(LOCK_TIMESTAMP_KEY, Date.now().toString());
}

export async function shouldRequireUnlock(): Promise<boolean> {
  const raw = await getItem(LOCK_TIMESTAMP_KEY);
  if (!raw) return false;

  const timestamp = parseInt(raw, 10);
  const elapsed = Date.now() - timestamp;
  return elapsed > GRACE_PERIOD_MS;
}

export async function clearLockTimestamp(): Promise<void> {
  await deleteItem(LOCK_TIMESTAMP_KEY);
}
