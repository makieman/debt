# Google OAuth + Drive — APK Build Reference Guide

> **App:** Credi · Package: `com.lightstorm.credi`
> **Last updated:** 2026-08-26
> **Relevant file:** `src/services/googleDriveService.ts`

---

## What this feature does

The Google Drive integration lets users back up their Credi SQLite database to their
personal Google Drive (`appDataFolder` — hidden from their My Drive, private to the app).
The flow uses **OAuth 2.0 Authorization Code + PKCE** (no client secret needed on mobile).

---

## The History of Errors (so you understand why the code is the way it is)

### ❌ Attempt 1 — Web OAuth Client + Expo Auth Proxy

**Setup:**
- OAuth client type in Google Cloud Console: **Web application**
- Redirect URI in code used `native: 'https://auth.expo.io/@avatarmano/duka-deni'`
- Authorized redirect URI in Google Console: `https://auth.expo.io`

**What happened in dev (Expo Go):** ✅ Worked fine — the Expo proxy handled the redirect.

**What happened in the APK:** ❌ OAuth failed at runtime.

**Why it broke in the APK:**
The Expo Auth Proxy (`auth.expo.io`) is a middleman server run by Expo. After the user
signs in, Google sends the code to `auth.expo.io`, which then deep-links back into your app.
In a sideloaded APK this deep-link does not resolve reliably — the proxy cannot guarantee
the installed app intercepts it. The result is a silent failure or a browser that stays open.

---

### ❌ Attempt 2 — Android OAuth Client, tested in Expo Go

**What happened in Expo Go:** ❌ Error 400: invalid_request

```
redirect_uri=exp://172.16.135.20:8081
flowName=GeneralOAuthFlow
```

**Why it broke:**
Expo Go runs inside Expo's own shell app (`host.exp.exponent`). The redirect URI becomes
your local machine IP. Google's Android client rejects this because:
1. Package name does not match (`host.exp.exponent` ≠ `com.lightstorm.credi`)
2. SHA-1 of Expo Go's key ≠ your EAS keystore SHA-1
3. The `exp://` scheme is unknown to Google

**This is expected — Android OAuth clients CANNOT be tested in Expo Go.** You must use a real APK/dev-client build.

---

### ✅ Current Fix — Android OAuth Client, correct redirect URI

**File changed:** `src/services/googleDriveService.ts` · `connectGoogleDrive()`

```ts
// BEFORE (proxy — broken in APK)
const redirectUri = AuthSession.makeRedirectUri({
  native: 'https://auth.expo.io/@avatarmano/duka-deni',
});

// AFTER (correct for Android client)
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'com.googleusercontent.apps.104870381302-p5p3k8kjcnusuulpid6h7q27uhtpvrfp',
  path: 'oauth2redirect',
});
```

**How it works:**
For Android OAuth clients, Google sends the auth code back via a reverse client ID URI scheme:

```
Client ID:  104870381302-p5p3k8kjcnusuulpid6h7q27uhtpvrfp.apps.googleusercontent.com
Scheme:     com.googleusercontent.apps.104870381302-p5p3k8kjcnusuulpid6h7q27uhtpvrfp
Full URI:   com.googleusercontent.apps.104870381302-p5p3k8kjcnusuulpid6h7q27uhtpvrfp://oauth2redirect
```

Android's intent system intercepts this URI and hands it to your app. No proxy, no server.

**`app.json` already registers this scheme (confirmed ✅):**
```json
"scheme": [
  "com.lightstorm.credi",
  "com.googleusercontent.apps.104870381302-p5p3k8kjcnusuulpid6h7q27uhtpvrfp"
]
```

---

## Google Cloud Console Setup (one-time)

Go to: https://console.cloud.google.com → APIs & Services → Credentials

### OAuth Client ID settings

| Field | Value |
|---|---|
| Application type | **Android** |
| Package name | `com.lightstorm.credi` |
| SHA-1 certificate fingerprint | from EAS keystore (see below) |

> ⚠️ The SHA-1 must be from your EAS production keystore, NOT a local debug key.

### Get your EAS keystore SHA-1

```bash
eas credentials
# Select: Android → production
# Copy the SHA-1 fingerprint shown
```

If no keystore exists yet, EAS generates one on your first build.
After the first build: run `eas credentials`, copy the SHA-1, paste it in Google Console.

### OAuth Consent Screen

| Field | Value |
|---|---|
| App name | Credi |
| Scopes | `https://www.googleapis.com/auth/drive.appdata` |
| Publishing status | **Production** (NOT Testing — Testing caps at 100 users, tokens expire in 7 days) |

---

## APK Build Pre-flight Checklist

- [ ] OAuth client type in Google Console is **Android** (not Web)
- [ ] Package name in Google Console = `com.lightstorm.credi`
- [ ] SHA-1 in Google Console matches EAS keystore (`eas credentials`)
- [ ] `app.json` scheme array includes the reverse client ID
- [ ] `connectGoogleDrive()` uses `scheme:` (not `native:`) in `makeRedirectUri`
- [ ] OAuth consent screen is set to **Production** (not Testing)
- [ ] Google Drive API is **enabled** in the project

### Build commands

```bash
# Internal APK — for direct install/testing (no Play Store)
eas build --platform android --profile preview

# Production AAB — for Play Store submission
eas build --platform android --profile production
```

---

## If OAuth Fails in the APK — Debugging Guide

### "Access blocked: This app's request is invalid"
Cause: Wrong OAuth client type or wrong redirect URI scheme.
Fix: Confirm client type is **Android** in Google Console. Check `scheme:` in `connectGoogleDrive()` matches the Client ID exactly.

### "redirect_uri_mismatch"
Cause: App is sending a redirect URI that Google does not recognize.
Fix: Android clients have NO redirect URI field in Google Console — they use package name + SHA-1. If you see this, you likely have a Web client active. Switch to Android type.

### "invalid_client"
Cause: Wrong `GOOGLE_CLIENT_ID` constant, or SHA-1 mismatch (APK signed with different keystore).
Fix: Re-run `eas credentials`, copy the SHA-1, update Google Console.

### Sign-in succeeds but upload returns 401 Unauthorized
Cause: Access token expired (tokens last 1 hour). No refresh token is stored.
Fix: User must disconnect and reconnect Google Drive. See the NOTE in `googleAuth.ts` about implementing refresh tokens in the future.

### OAuth browser opens but never returns to the app
Cause: The `scheme` in `makeRedirectUri` does not match what is in `app.json`.
Fix: Confirm `app.json` has the full reverse client ID in the `scheme` array and it exactly matches the `scheme:` in `connectGoogleDrive()`.

### OAuth works but nothing appears in the user's Drive
Note: Files go to `appDataFolder` which is HIDDEN — this is correct. Users will not see
the backup in their Google Drive UI. It is stored in a private, app-only space by design.

---

## Key Files

| File | Purpose |
|---|---|
| `src/services/googleDriveService.ts` | OAuth flow + Drive upload/download logic |
| `src/store/googleAuth.ts` | Token storage in SecureStore (hardware-backed) |
| `app.json` | URI schemes, package name, EAS project ID |

---

## Why NOT to use the Expo Auth Proxy for production

1. **Reliability** — your app auth depends on Expo's servers being up
2. **Privacy** — the auth code passes through Expo's servers
3. **Deep-link fragility** — sideloaded APKs may not intercept the proxy redirect
4. **Google policy** — Google recommends the reverse-client-ID scheme for native apps

The current implementation (Android client + reverse scheme) is the correct production
pattern per both Google's OAuth 2.0 for Mobile & Desktop Apps guide and the Expo docs.
