/**
 * src/store/security.test.ts
 *
 * Tests for the security store module.
 *
 * ─── WHY WE MOCK expo-secure-store ───────────────────────────────────────────
 *
 * expo-secure-store uses native Android Keystore / iOS Keychain APIs that
 * don't exist in the Node.js test environment. Without mocking, every call
 * to SecureStore.getItemAsync() would throw "NativeModule not found".
 *
 * We replace SecureStore with a plain JavaScript object (a Map-like store)
 * that behaves identically: setItemAsync sets, getItemAsync gets,
 * deleteItemAsync removes. Tests run in milliseconds instead of seconds.
 *
 * ─── WHY WE MOCK expo-crypto ─────────────────────────────────────────────────
 *
 * Real SHA-256 works in tests, but:
 *   1. The mock lets us verify the SALT was included in the hashed string
 *      by checking what digestStringAsync was called with.
 *   2. Deterministic output: mock-hash-1234duka-deni-pin-v1 is predictable
 *      in assertions, whereas real SHA-256 requires knowing the expected hex.
 *   3. Speed: no native crypto initialization.
 *
 * ─── WHY WE TEST THAT setPin("123") THROWS ───────────────────────────────────
 *
 * A 3-digit PIN has 1,000 possible values (000–999).
 * A 4-digit PIN has 10,000 possible values (0000–9999) — 10× harder to brute-force.
 * The validation MUST reject it at the storage layer, not just at the UI layer.
 * If setPin("123") silently succeeds, the PIN entry screen will behave strangely
 * and the stored hash will never match any 4-digit input (since all UI inputs
 * are exactly 4 digits). Testing the throw catches this bug class early.
 */

// ─── Mocks must come before imports ──────────────────────────────────────────

// Mock expo-secure-store with an in-memory key-value store.
// We use a closure so the store resets when we reassign the module object.
// The `store` object persists within one test unless we clearAllMocks().
const mockStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => mockStore[key] ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
}));

// Mock expo-crypto to return deterministic, inspectable hashes.
// The mock hash format "mock-hash-{input}" lets us verify the salt was included:
//   hashPin("1234") → digestStringAsync was called with "1234duka-deni-pin-v1"
//   → mock returns "mock-hash-1234duka-deni-pin-v1"
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockImplementation(
    async (_algorithm: string, data: string) => `mock-hash-${data}`
  ),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  hashPin,
  setPin,
  verifyPin,
  isPinSet,
  clearPin,
  disableAppLock,
  recordFailedAttempt,
  clearFailedAttempts,
  getLockoutStatus,
  setLockTimestamp,
  shouldRequireUnlock,
  clearLockTimestamp,
} from './security';

import * as Crypto from 'expo-crypto';

// ─── Reset between tests ──────────────────────────────────────────────────────

beforeEach(() => {
  // Clear all mock function call history
  jest.clearAllMocks();
  // Clear the in-memory store
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
});

// ─── hashPin() ───────────────────────────────────────────────────────────────

describe('hashPin()', () => {
  test('returns a string', async () => {
    const result = await hashPin('1234');
    expect(typeof result).toBe('string');
  });

  test('same input always returns same output (deterministic)', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('1234');
    expect(hash1).toBe(hash2);
  });

  test('different PINs return different hashes', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('5678');
    expect(hash1).not.toBe(hash2);
  });

  test('PIN includes SALT in the hashed string', async () => {
    await hashPin('1234');
    // Verify that digestStringAsync was called with pin + salt
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      '1234duka-deni-pin-v1'  // salt appended to PIN
    );
  });
});

// ─── setPin() and verifyPin() ─────────────────────────────────────────────────

describe('setPin() and verifyPin()', () => {
  test('after setPin("1234"), verifyPin("1234") returns true', async () => {
    await setPin('1234');
    const result = await verifyPin('1234');
    expect(result).toBe(true);
  });

  test('after setPin("1234"), verifyPin("5678") returns false', async () => {
    await setPin('1234');
    const result = await verifyPin('5678');
    expect(result).toBe(false);
  });

  test('setPin("123") throws "PIN must be 4 digits" (too short)', async () => {
    await expect(setPin('123')).rejects.toThrow('PIN must be 4 digits');
  });

  test('setPin("abcd") throws "PIN must be 4 digits" (letters)', async () => {
    await expect(setPin('abcd')).rejects.toThrow('PIN must be 4 digits');
  });

  test('setPin("12345") throws "PIN must be 4 digits" (too long)', async () => {
    await expect(setPin('12345')).rejects.toThrow('PIN must be 4 digits');
  });

  test('setPin("") throws "PIN must be 4 digits" (empty)', async () => {
    await expect(setPin('')).rejects.toThrow('PIN must be 4 digits');
  });

  test('verifyPin returns false when no PIN is set', async () => {
    const result = await verifyPin('1234');
    expect(result).toBe(false);
  });
});

// ─── isPinSet() ───────────────────────────────────────────────────────────────

describe('isPinSet()', () => {
  test('returns false before any setPin() call', async () => {
    const result = await isPinSet();
    expect(result).toBe(false);
  });

  test('returns true after setPin()', async () => {
    await setPin('1234');
    const result = await isPinSet();
    expect(result).toBe(true);
  });

  test('returns false after clearPin()', async () => {
    await setPin('1234');
    await clearPin();
    const result = await isPinSet();
    expect(result).toBe(false);
  });

  test('disableAppLock() sets lock to false without deleting hash', async () => {
    await setPin('1234');
    await disableAppLock();
    const pinStillSet = await isPinSet();
    // isPinSet reads APP_LOCK_ENABLED_KEY which is now "false"
    expect(pinStillSet).toBe(false);
    // But the hash should still be in the store (not deleted)
    expect(mockStore['pin_hash']).toBeDefined();
  });
});

// ─── recordFailedAttempt() and getLockoutStatus() ────────────────────────────

describe('recordFailedAttempt() and getLockoutStatus()', () => {
  test('4 failed attempts do NOT trigger lockout', async () => {
    // Attempt 1, 2, 3, 4 (0-indexed: 0, 1, 2, 3)
    for (let i = 0; i < 4; i++) {
      await recordFailedAttempt();
    }
    const status = await getLockoutStatus();
    expect(status.isLockedOut).toBe(false);
    expect(status.remainingMs).toBe(0);
  });

  test('5th failed attempt triggers lockout', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt();
    }
    const status = await getLockoutStatus();
    expect(status.isLockedOut).toBe(true);
    expect(status.remainingMs).toBeGreaterThan(0);
  });

  test('clearFailedAttempts() resets the lockout', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt();
    }
    await clearFailedAttempts();
    const status = await getLockoutStatus();
    expect(status.isLockedOut).toBe(false);
    expect(status.remainingMs).toBe(0);
  });

  test('recordFailedAttempt returns count BEFORE incrementing', async () => {
    // First call: count was 0 before → should return 0
    const first = await recordFailedAttempt();
    expect(first).toBe(0);
    // Second call: count was 1 before → should return 1
    const second = await recordFailedAttempt();
    expect(second).toBe(1);
  });

  test('after lockout, failed attempt counter resets to 0', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt();
    }
    // Counter should be reset to "0" after lockout triggers
    expect(mockStore['failed_attempts']).toBe('0');
    // lockout_until should be set
    expect(mockStore['lockout_until']).toBeDefined();
  });
});

// ─── shouldRequireUnlock() ────────────────────────────────────────────────────

describe('shouldRequireUnlock()', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('returns false when no lock timestamp is set', async () => {
    const result = await shouldRequireUnlock();
    expect(result).toBe(false);
  });

  test('returns false when timestamp is within the 30-second grace period', async () => {
    // Set timestamp to "now"
    await setLockTimestamp();
    // Advance time by 10 seconds (within 30s grace period)
    jest.advanceTimersByTime(10_000);
    const result = await shouldRequireUnlock();
    expect(result).toBe(false);
  });

  test('returns true when timestamp is beyond the 30-second grace period', async () => {
    // Set timestamp to "now"
    await setLockTimestamp();
    // Advance time by 35 seconds (beyond 30s grace period)
    jest.advanceTimersByTime(35_000);
    const result = await shouldRequireUnlock();
    expect(result).toBe(true);
  });

  test('clearLockTimestamp() makes shouldRequireUnlock() return false', async () => {
    await setLockTimestamp();
    jest.advanceTimersByTime(60_000);
    await clearLockTimestamp();
    const result = await shouldRequireUnlock();
    expect(result).toBe(false);
  });
});
