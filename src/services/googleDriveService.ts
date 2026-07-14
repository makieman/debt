/**
 * src/services/googleDriveService.ts
 *
 * Provides two public functions:
 *   1. connectGoogleDrive()         — runs the OAuth flow and stores the token
 *   2. uploadBackupToDrive()        — uploads a local file to Drive's appDataFolder
 *
 * ── HOW GOOGLE OAUTH WORKS IN EXPO ──────────────────────────────────────────
 *
 *  The flow uses the "Authorization Code with PKCE" grant type (RFC 7636):
 *
 *   App                         Expo AuthSession           Google
 *    │──── openAuthSessionAsync ──────▶│                     │
 *    │                                 │──── redirect ──────▶│
 *    │                                 │  (user sees login)  │
 *    │                                 │◀── auth_code ───────│
 *    │◀── returns { code } ────────────│                     │
 *    │──── POST /token (code + verifier) ─────────────────▶  │
 *    │◀──────────────── access_token ──────────────────────  │
 *    │  (saved to SecureStore)
 *
 *  Why PKCE? It eliminates the need for a client secret on public clients
 *  (mobile apps). The code_verifier proves the requester is the same app that
 *  started the flow — prevents code interception attacks.
 *
 * ── WHAT IS appDataFolder? ──────────────────────────────────────────────────
 *
 *  A hidden Drive space only your app can see. Files stored here:
 *    - Do NOT appear in the user's "My Drive"
 *    - Are NOT counted against the user's storage quota (up to 10GB)
 *    - Are deleted automatically if the user uninstalls the app
 *    - Require scope: https://www.googleapis.com/auth/drive.appdata
 *
 *  This is the correct place for automatic app backups — no Drive clutter.
 *
 * ── MULTIPART UPLOAD FORMAT ─────────────────────────────────────────────────
 *
 *  Drive's multipart upload sends two "parts" in a single POST:
 *    Part 1: metadata (JSON) — file name, MIME type, parent folder
 *    Part 2: media (the file content)
 *
 *  Boundary: a unique string that separates the parts. The server reads until
 *  it sees "--{boundary}--" to know the upload is complete.
 *
 * ── SETUP REQUIRED (one-time) ───────────────────────────────────────────────
 *
 *  1. Create a project at https://console.cloud.google.com
 *  2. Enable "Google Drive API"
 *  3. Create OAuth 2.0 credentials → type: Android
 *     - Package name: com.lightstorm.credi
 *     - SHA-1: from your EAS keystore (run: eas credentials)
 *  4. Copy the Client ID and paste it as GOOGLE_CLIENT_ID below.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import {
  saveGoogleToken,
  getValidGoogleToken,
  clearGoogleToken,
  saveLastDriveBackupTime,
} from '../store/googleAuth';

// ─── CONFIGURE THIS ───────────────────────────────────────────────────────────
// Paste your Google Cloud OAuth Client ID here.
// It looks like: 123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// ─────────────────────────────────────────────────────────────────────────────

// Required so expo-web-browser can dismiss the auth popup when it's done.
WebBrowser.maybeCompleteAuthSession();

// OAuth discovery document — tells AuthSession where Google's auth endpoints are.
const DISCOVERY = AuthSession.useAutoDiscovery
  ? undefined // handled at call site
  : undefined;

const GOOGLE_DISCOVERY_URI = 'https://accounts.google.com';

// The only scope we request: access to the hidden appDataFolder.
// Requesting the minimum scope is best practice (principle of least privilege).
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

// Drive API endpoint for multipart upload
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

// ─── RESULT TYPE ─────────────────────────────────────────────────────────────

export interface DriveUploadResult {
  success: boolean;
  fileId?: string; // Drive file ID on success
  error?: string;  // Error message on failure
}

// ─── FUNCTION 1: connectGoogleDrive ──────────────────────────────────────────

/**
 * Opens a browser-based Google sign-in flow. On success, stores the access
 * token securely. Returns true if connection succeeded, false otherwise.
 *
 * USAGE: Call this from a "Connect Google Drive" button in the UI.
 * After this resolves with true, subsequent calls to uploadBackupToDrive()
 * will work silently without any more user interaction.
 */
export async function connectGoogleDrive(): Promise<boolean> {
  try {
    // Build the redirect URI — this must match what you registered in Google Cloud.
    // For Expo, it follows the format: com.lightstorm.credi:/oauth2redirect
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'com.lightstorm.credi',
      path: 'oauth2redirect',
    });

    // Create the auth request with PKCE
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      usePKCE: true, // Generate code_verifier + code_challenge automatically
    });

    // Fetch the discovery document to find Google's authorization endpoint
    const discovery = await AuthSession.fetchDiscoveryAsync(GOOGLE_DISCOVERY_URI);

    // Open the browser and wait for redirect back to the app
    const result = await request.promptAsync(discovery);

    if (result.type !== 'success') {
      console.log('[googleDriveService] OAuth cancelled or failed:', result.type);
      return false;
    }

    // Exchange the authorization code for an access token
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        code: result.params.code,
        clientId: GOOGLE_CLIENT_ID,
        redirectUri,
        extraParams: {
          // code_verifier is required for PKCE token exchange
          code_verifier: request.codeVerifier ?? '',
        },
      },
      discovery
    );

    // Save token to SecureStore
    const expiresIn = tokenResult.expiresIn ?? 3600; // default 1 hour
    await saveGoogleToken(tokenResult.accessToken, expiresIn);
    console.log('[googleDriveService] Connected to Google Drive successfully');
    return true;
  } catch (e) {
    console.error('[googleDriveService] connectGoogleDrive error:', e);
    return false;
  }
}

// ─── FUNCTION 2: disconnectGoogleDrive ───────────────────────────────────────

/**
 * Removes stored credentials. The next export will skip the Drive upload.
 * Call this from a "Disconnect" button in Settings.
 */
export async function disconnectGoogleDrive(): Promise<void> {
  await clearGoogleToken();
  console.log('[googleDriveService] Disconnected from Google Drive');
}

// ─── FUNCTION 3: uploadBackupToDrive ─────────────────────────────────────────

/**
 * Uploads a local file to the user's Google Drive appDataFolder.
 *
 * This function:
 *   1. Checks for a valid access token — skips silently if none
 *   2. Reads the local file content
 *   3. Builds a multipart HTTP request (metadata + file content)
 *   4. POSTs to the Drive Files API
 *   5. Saves the backup timestamp on success
 *
 * @param localFilePath  - Absolute path to the file on device (e.g. from cacheDirectory)
 * @param driveFilename  - The name to save the file as on Google Drive
 *                         Format: backup-YYYY-MM-DD-HH-mm.json
 */
export async function uploadBackupToDrive(
  localFilePath: string,
  driveFilename: string
): Promise<DriveUploadResult> {
  // Step 1: Get a valid access token. If expired or missing, skip silently.
  const token = await getValidGoogleToken();
  if (!token) {
    console.log('[googleDriveService] No valid token — skipping Drive upload');
    return { success: false, error: 'No valid token' };
  }

  // Step 2: Read the local file as a UTF-8 string
  let fileContent: string;
  try {
    fileContent = await FileSystem.readAsStringAsync(localFilePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[googleDriveService] Could not read local file:', msg);
    return { success: false, error: `Could not read file: ${msg}` };
  }

  // Step 3: Build multipart request body
  // A unique boundary string separates the metadata and file parts.
  const boundary = `credi_backup_${Date.now()}`;

  // Part 1: metadata — tells Drive the file name, type, and destination folder
  const metadata = JSON.stringify({
    name: driveFilename,
    mimeType: 'application/json',
    parents: ['appDataFolder'], // the special hidden app storage
  });

  // Assemble the multipart body as a string.
  // The spec requires \r\n (CRLF) line endings between parts.
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    fileContent,
    `--${boundary}--`,
  ].join('\r\n');

  // Step 4: POST to Drive
  try {
    const response = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(new TextEncoder().encode(body).length),
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[googleDriveService] Drive API error:', response.status, errorText);
      return { success: false, error: `Drive API ${response.status}: ${errorText}` };
    }

    const json = await response.json();
    const fileId: string = json.id;

    // Step 5: Save timestamp
    await saveLastDriveBackupTime(new Date().toISOString());

    console.log('[googleDriveService] Uploaded to Drive. File ID:', fileId);
    return { success: true, fileId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[googleDriveService] Network error during upload:', msg);
    return { success: false, error: msg };
  }
}

// ─── FUNCTION 4: makeDriveFilename ───────────────────────────────────────────

/**
 * Generates a Drive filename in the format: backup-YYYY-MM-DD-HH-mm.json
 * Example: backup-2025-07-14-16-30.json
 */
export function makeDriveFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    'backup',
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('-') + '.json';
}
