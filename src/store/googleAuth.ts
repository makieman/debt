/**
 * src/store/googleAuth.ts
 *
 * Stores and retrieves the Google OAuth access token using expo-secure-store.
 *
 * WHY SECURE STORE, NOT ASYNC STORAGE?
 *   AsyncStorage is unencrypted — any process that can read the device's
 *   filesystem can read the token. SecureStore uses the platform keychain
 *   (Android Keystore / iOS Keychain), which is hardware-backed encryption.
 *   An OAuth token grants write access to the user's Google Drive — it must
 *   be treated as a secret credential, not general app preferences.
 *
 * WHAT IS STORED?
 *   - accessToken:  The short-lived Bearer token sent with every Drive API call.
 *   - expiresAt:    Unix timestamp (ms) when the token expires. We check this
 *                   before each upload to skip the upload if the token is stale
 *                   rather than letting the API return a 401.
 *   - driveConnected: A simple AsyncStorage flag (non-secret) so the UI can
 *                   show the connected state without decrypting the token.
 *
 * NOTE: Refresh tokens are NOT stored. Google's OAuth2 for installed apps
 * issues short-lived access tokens only (1 hour). When the token expires,
 * the user must reconnect. A future improvement could request offline_access
 * and store the refresh token to silently renew — but that requires a backend
 * proxy to exchange tokens securely. Out of scope for now.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@credi_gdrive_access_token';
const EXPIRES_KEY = '@credi_gdrive_expires_at';
const CONNECTED_FLAG = '@credi_gdrive_connected';
const LAST_BACKUP_KEY = '@credi_gdrive_last_backup';

// ─── Token Storage ────────────────────────────────────────────────────────────

/**
 * Save an OAuth access token and its expiry to the secure keychain.
 */
export async function saveGoogleToken(accessToken: string, expiresInSeconds: number): Promise<void> {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(EXPIRES_KEY, String(expiresAt));
  await AsyncStorage.setItem(CONNECTED_FLAG, 'true');
}

/**
 * Return the stored access token if it still has more than 5 minutes of life,
 * otherwise return null (caller should prompt user to reconnect).
 */
export async function getValidGoogleToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const expiresAtStr = await SecureStore.getItemAsync(EXPIRES_KEY);
    if (!token || !expiresAtStr) return null;

    const expiresAt = Number(expiresAtStr);
    const fiveMinutesMs = 5 * 60 * 1000;
    if (Date.now() > expiresAt - fiveMinutesMs) {
      // Token is expired or about to expire — treat as missing
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Remove all stored Drive credentials (used on disconnect).
 */
export async function clearGoogleToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_KEY);
  await AsyncStorage.removeItem(CONNECTED_FLAG);
}

// ─── Connected State (non-secret, for UI) ────────────────────────────────────

/**
 * Returns true if the user has previously connected Google Drive.
 * Does NOT verify the token is still valid — call getValidGoogleToken() for that.
 */
export async function isDriveConnected(): Promise<boolean> {
  const val = await AsyncStorage.getItem(CONNECTED_FLAG);
  return val === 'true';
}

// ─── Last Backup Timestamp ────────────────────────────────────────────────────

/**
 * Save the ISO timestamp of the most recent successful Drive backup.
 */
export async function saveLastDriveBackupTime(isoTimestamp: string): Promise<void> {
  await AsyncStorage.setItem(LAST_BACKUP_KEY, isoTimestamp);
}

/**
 * Return the ISO timestamp of the last Drive backup, or null if never backed up.
 */
export async function getLastDriveBackupTime(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_BACKUP_KEY);
}
