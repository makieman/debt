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

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

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
 *
 * WHY 30 SECONDS?
 * A shopkeeper who switches to WhatsApp to check a payment notification
 * and returns in 10 seconds should not face a PIN screen. That friction
 * causes users to disable the feature entirely — defeating the purpose.
 * 30 seconds is enough time for a thief to pick up an unattended phone
 * while still being invisible to legitimate quick task-switching.
 * Banking apps (M-Pesa Business, Equity) use 30–60 second windows.
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

/**
 * FUNCTION 1: hashPin
 *
 * WHY ASYNC?
 * expo-crypto's digestStringAsync() is inherently async — it may delegate
 * to native crypto hardware on the device. We must await it. Wrapping in
 * a named async function also lets tests mock 'hashPin' directly rather
 * than needing to mock expo-crypto internals.
 *
 * WHY PIN + SALT (not SALT + PIN)?
 * Either order works for security. We choose PIN-first because the PIN
 * is the "secret" and the salt is the "context" — semantic ordering only.
 * What matters is that BOTH are in the input before hashing.
 */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + SALT
  );
}

/**
 * FUNCTION 2: setPin
 *
 * Stores a hashed PIN in SecureStore and enables app lock.
 * Throws if the PIN is not exactly 4 digits — enforces the format at the
 * storage layer, not just at the UI layer. This means even if a bug
 * bypasses the PIN screen validation, the store will reject bad PINs.
 *
 * REAL BUG DEVELOPERS MAKE:
 * Storing the plain PIN string "1234" instead of its hash. SecureStore IS
 * encrypted, but if an attacker extracts the value (rooted device, forensic
 * tool), they immediately know the PIN. Always hash before storing.
 */
export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be 4 digits');
  }
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'true');
}

/**
 * FUNCTION 3: verifyPin
 *
 * Hashes the candidate PIN and compares with the stored hash.
 * Returns false (not true) if no hash is stored — no PIN means
 * the app is not locked, so "verify" returns false (unlocked).
 */
export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!storedHash) return false;
  const candidateHash = await hashPin(pin);
  return candidateHash === storedHash;
}

/**
 * FUNCTION 4: isPinSet
 *
 * Asks: "Has the user ever configured a PIN?"
 * Reads the APP_LOCK_ENABLED_KEY. Returns true only when it equals "true".
 */
export async function isPinSet(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY);
  return value === 'true';
}

/**
 * FUNCTION 5: isAppLockEnabled
 *
 * Alias for isPinSet(). Why two functions for the same thing?
 *
 * isPinSet()        → "Has a PIN ever been configured?"
 * isAppLockEnabled() → "Is the lock feature currently turned on?"
 *
 * Right now they return the same value. But in a future version, a user
 * might set a PIN and then DISABLE the lock (keeping the hash for easy
 * re-enable). At that point these two questions diverge:
 *   isPinSet()         → true  (hash still in SecureStore)
 *   isAppLockEnabled() → false (user turned off locking)
 *
 * By naming them differently today, callers express their intent clearly
 * and future refactoring is isolated to just these functions.
 */
export async function isAppLockEnabled(): Promise<boolean> {
  return isPinSet();
}

/**
 * FUNCTION 6: disableAppLock
 *
 * Turns off locking WITHOUT deleting the PIN hash.
 * The user can re-enable lock later without re-entering their PIN.
 * This matches the behaviour of iOS Screen Time and banking apps:
 * "pause" protection without resetting credentials.
 */
export async function disableAppLock(): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'false');
}

/**
 * FUNCTION 7: clearPin
 *
 * Permanently removes the PIN hash and disables locking.
 * Used when the user explicitly removes lock protection.
 * After this, isPinSet() returns false and re-enabling will
 * require full PIN setup again.
 */
export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'false');
}

/**
 * FUNCTION 8: recordFailedAttempt
 *
 * Increments the failed attempt counter. On the 5th failure:
 *   - Sets LOCKOUT_UNTIL_KEY to now + LOCKOUT_DURATION_MS
 *   - Resets FAILED_ATTEMPTS_KEY to 0 (clean slate for next window)
 *
 * Returns the attempt count BEFORE incrementing, so the caller
 * can compute "attempts remaining" = MAX_ATTEMPTS - (returned value + 1).
 *
 * REAL BUG DEVELOPERS MAKE:
 * Not resetting FAILED_ATTEMPTS_KEY after the lockout starts. Then after
 * the 30-second lockout expires, the counter is still at 5 and the user
 * is immediately locked out again on their very first attempt. Always
 * reset the counter when you start the lockout.
 */
export async function recordFailedAttempt(): Promise<number> {
  const raw = await SecureStore.getItemAsync(FAILED_ATTEMPTS_KEY);
  const current = raw ? parseInt(raw, 10) : 0;

  if (current + 1 >= MAX_ATTEMPTS) {
    // Trigger lockout
    const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    await SecureStore.setItemAsync(LOCKOUT_UNTIL_KEY, lockoutUntil.toString());
    await SecureStore.setItemAsync(FAILED_ATTEMPTS_KEY, '0');
  } else {
    await SecureStore.setItemAsync(FAILED_ATTEMPTS_KEY, (current + 1).toString());
  }

  return current; // return BEFORE incrementing, so caller can show "N remaining"
}

/**
 * FUNCTION 9: clearFailedAttempts
 *
 * Resets both the attempt counter and the lockout timestamp.
 * Called after a successful PIN entry or biometric auth.
 */
export async function clearFailedAttempts(): Promise<void> {
  await SecureStore.setItemAsync(FAILED_ATTEMPTS_KEY, '0');
  await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
}

/**
 * FUNCTION 10: getLockoutStatus
 *
 * Returns whether the user is currently locked out and, if so,
 * how many milliseconds until the lockout expires.
 */
export async function getLockoutStatus(): Promise<LockoutStatus> {
  const raw = await SecureStore.getItemAsync(LOCKOUT_UNTIL_KEY);
  if (!raw) return { isLockedOut: false, remainingMs: 0 };

  const lockoutUntil = parseInt(raw, 10);
  const now = Date.now();

  if (now >= lockoutUntil) {
    // Lockout has expired — clean up stale key
    await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
    return { isLockedOut: false, remainingMs: 0 };
  }

  return { isLockedOut: true, remainingMs: lockoutUntil - now };
}

/**
 * FUNCTION 11: setLockTimestamp
 *
 * Records the moment the app went to the background.
 * Called by SecurityContext's AppState listener on 'background'.
 * Used by shouldRequireUnlock() to compute elapsed time.
 */
export async function setLockTimestamp(): Promise<void> {
  await SecureStore.setItemAsync(LOCK_TIMESTAMP_KEY, Date.now().toString());
}

/**
 * FUNCTION 12: shouldRequireUnlock
 *
 * Compares the stored lock timestamp against the current time.
 * Returns true if more than GRACE_PERIOD_MS has elapsed since the
 * app went to the background.
 *
 * Returns false if:
 *   - No timestamp exists (app was never backgrounded)
 *   - Elapsed time is within the grace period (quick task-switch)
 */
export async function shouldRequireUnlock(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(LOCK_TIMESTAMP_KEY);
  if (!raw) return false;

  const timestamp = parseInt(raw, 10);
  const elapsed = Date.now() - timestamp;
  return elapsed > GRACE_PERIOD_MS;
}

/**
 * FUNCTION 13: clearLockTimestamp
 *
 * Removes the background timestamp after successful unlock.
 * If we don't clear it, every subsequent app open would see a stale
 * timestamp from the last background event and require unlock again.
 */
export async function clearLockTimestamp(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCK_TIMESTAMP_KEY);
}
