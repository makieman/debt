# Credi — Shop Credit & Daily Sales 

> A mobile app that helps shop owners track customer credit, record daily sales

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo)](https://docs.expo.dev/versions/v56.0.0/)
[![React Native](https://img.shields.io/badge/React%20Native-0.85-61DAFB?logo=react)](https://reactnative.dev/)
[![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android)](https://play.google.com/store)
## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Google Drive Backup Setup](#google-drive-backup-setup)
- [Building for Android](#building-for-android)
- [Running Tests](#running-tests)
- [Database Schema](#database-schema)
- [Export & Import](#export--import)
- [Contributing](#contributing)
- [License](#license)


## Overview

**Credi** is a React Native / Expo app built for duka (small shop) owners in Kenya and similar markets. It runs **fully offline** with a local SQLite database  no server required. Optional Google Drive integration provides automatic cloud backups.

### 🌟 Recent Release Highlights (Sep 2026)
- **Android Modal Window Keyboard Fix**: Added `statusBarTranslucent`, `Keyboard.addListener` height tracking, and `ScrollView` auto-scroll so bottom sheet modals resize properly above the soft keyboard in compiled APKs.
- **Fintech Numpad UI Refresh**: Modernized entry keypad with flat rounded surfaces, tactile micro-animations, and clean layout.



1. **How much money is owed to me?** — Customer credit dashboard
2. **How did the shop perform today?** — Daily cash, M-Pesa, and expense logging
3. **What is the trend?** — Weekly sales charts and top-debtor rankings

## Features

| Category | Details |
| 📊 **Dashboard** | Total receivables, amount collected, outstanding balance, recent activity feed |
| 👥 **Customer Management** | Add / edit / soft-delete customers, full transaction history per customer |
| 🗓 **Daily Entry** | Log cash sales, M-Pesa sales, credit issued, and itemized expenses (stock, rent, transport, salary, utilities, custom) |
| 📈 **Sales Reports** | Weekly chart (Victory Native + Skia), top debtors, daily summary history |
| 🔔 **Reminders** | Modal to view and act on overdue credit balances |
| 📤 **Export** | Export all data as **XLSX** or **JSON** via the native share sheet |
| 📥 **Import** | Restore data from a JSON backup or Excel file 
| 🔒 **PIN & Biometric Lock** | App lock screen using `expo-local-authentication` and `expo-secure-store` |
| 🌍 **Multilingual** | English (`en`) and Swahili (`sw`) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/) |
| **Runtime** | React Native 0.85, React 19 |
| **Language** | TypeScript 6 |
| **Navigation** | React Navigation 7 — Bottom Tabs + Native Stack |
| **Database** | [expo-sqlite](https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/) (local SQLite, no server) |
| **Charts** | [Victory Native](https://commerce.nearform.com/open-source/victory-native/) + [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/) |
| **Auth** | [expo-auth-session](https://docs.expo.dev/versions/v56.0.0/sdk/auth-session/) — OAuth 2.0 Authorization Code + PKCE |
| **Secure Storage** | [expo-secure-store](https://docs.expo.dev/versions/v56.0.0/sdk/securestore/) |
| **Biometrics** | [expo-local-authentication](https://docs.expo.dev/versions/v56.0.0/sdk/local-authentication/) |
| **Styling** | [NativeWind 4](https://www.nativewind.dev/) (Tailwind CSS for React Native) |
| **File I/O** | [expo-file-system](https://docs.expo.dev/versions/v56.0.0/sdk/filesystem/), [expo-sharing](https://docs.expo.dev/versions/v56.0.0/sdk/sharing/), [expo-document-picker](https://docs.expo.dev/versions/v56.0.0/sdk/document-picker/) |
| **Spreadsheet** | [SheetJS (xlsx)](https://sheetjs.com/) |
| **Testing** | Jest + Testing Library for React Native |
| **Build & Deploy** | [EAS Build](https://docs.expo.dev/build/introduction/) (Expo Application Services) |

---

## Project Structure
credi/
├── src/
│   ├── components/       # Reusable UI components 
│   │   ├── pin/          # PIN entry components
│   │   ├── sales/        # Sales-specific components
│   │   └── settings/     # Settings-specific components (ExportSheet…)
│   ├── db/               # SQLite layer
│   │   ├── index.ts      # Database singleton & query helpers
│   │   ├── schema.ts     # CREATE TABLE SQL statements
│   │   ├── migrations.ts # Schema migration runner
│   │   └── seed.ts       # Demo / seed data
│   ├── hooks/            # Custom React hooks (useDashboard, etc.)
│   ├── i18n/             # Translation strings (en + sw)
│   ├── navigation/       # Stack & tab navigator definitions
│   ├── repositories/     # Data-access layer (customers, transactions…)
│   ├── screens/          # Full-screen views
│   │   ├── DashboardScreen.tsx
│   │   ├── CustomerListScreen.tsx
│   │   ├── TransactionScreen.tsx
│   │   ├── DailyEntryScreen.tsx
│   │   ├── SalesReportScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── PinScreen.tsx / PinSetupScreen.tsx / PinChangeScreen.tsx
│   ├── services/         # External integrations
│   │   ├── googleDriveService.ts   # Google Drive OAuth + upload
│   │   ├── exportService.ts        # XLSX / JSON export
│   │   ├── importService.ts        # JSON / XLSX import & merge
│   │   └── templateService.ts      # Export template helpers
│   ├── store/            # Global state contexts and secure store helpers
│   ├── theme/            # Colors, typography, theme context
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Money formatting, date helpers, etc.
├── assets/               # Icons and splash screen images
├── docs/                 # Project reference guides
│   └── google-oauth-apk-guide.md  # OAuth error history & APK build checklist
├── App.tsx               # Root component
├── app.json              # Expo config
├── eas.json              # EAS build profiles
└── package.json
```

---

## Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 LTS | [nodejs.org](https://nodejs.org/) |
| [Expo CLI](https://docs.expo.dev/more/expo-cli/) | latest | `npm install -g expo-cli` |
| [EAS CLI](https://docs.expo.dev/build/setup/) | 12+ | `npm install -g eas-cli` |
| Android Studio / Emulator | latest | [developer.android.com](https://developer.android.com/studio) |

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/your-username/credi.git
cd credi

# 2. Install dependencies
npm install

# 3. Start the Metro bundler
npm start
# or equivalently: expo start

> **First launch:** The app automatically runs SQLite migrations on startup and creates an empty database. No manual database setup is required.

---

## Google Drive Backup Setup

Google Drive backup is **optional**. All other features work without it.

To enable automatic Drive backups you need an **Android-type** OAuth 2.0 client in Google Cloud. Using a Web client or the Expo Auth Proxy will work in Expo Go dev but **fail in production APKs** — see [`docs/google-oauth-apk-guide.md`](./docs/google-oauth-apk-guide.md) for the full explanation.

### Step-by-step

1. **Create a project** at [Google Cloud Console](https://console.cloud.google.com).
2. **Enable the Google Drive API** — *APIs & Services → Library → Google Drive API → Enable*.
3. **Create OAuth credentials**:
   - *Credentials → Create credentials → OAuth client ID*
   - Application type: **Android** ← must be Android, not Web
   - Package name: `com.lightstorm.credi`
   - SHA-1 fingerprint — obtain from your EAS keystore:
     ```bash
     eas credentials
     # Select: Android → production → copy the SHA1 Fingerprint
     ```
4. **Paste the Client ID** into `src/services/googleDriveService.ts`:
   ```ts
   const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
   ```
5. **Register the reverse-client-ID URI scheme** in `app.json` (already done ✅):
   ```json
   "scheme": [
     "com.lightstorm.credi",
     "com.googleusercontent.apps.YOUR_CLIENT_ID"
   ]
   ```

### How the OAuth flow works

```
App ──── openAuthSessionAsync ────▶ Google Sign-In (browser popup)
                                            │
                                user approves → auth_code returned via
                                reverse-client-ID URI scheme (on-device)
                                            │
App ──── POST /token (code + PKCE verifier) ────▶ Google
                                            │
                                access_token saved to SecureStore
```

The app uses **PKCE** (Proof Key for Code Exchange, RFC 7636) — no client secret needed on mobile. The redirect uses the **reverse client ID URI scheme** (`com.googleusercontent.apps.<id>://oauth2redirect`) which Android intercepts directly — no third-party proxy server in the loop.

Uploaded files go to Drive's hidden [`appDataFolder`](https://developers.google.com/drive/api/guides/appdata) — not visible to users in "My Drive" and not counted against their storage quota.

> ⚠️ **Cannot test in Expo Go.** The Android OAuth client requires your app's package name and SHA-1, which Expo Go's shell app does not satisfy. Test this feature using a `preview` APK build.

---

## Building for Android

The project uses **EAS Build** with three profiles defined in [`eas.json`](./eas.json):

| Profile | Output | Use Case |
|---|---|---|
| `development` | `.apk` (internal) | Local development with dev client |
| `preview` | `.apk` (internal) | Stakeholder / QA testing — **use this to verify OAuth before shipping** |
| `production` | `.aab` (app bundle) | Google Play Store submission |

```bash
# Log in to your Expo account
eas login

# Build a development APK
eas build --profile development --platform android

# Build a preview APK for sharing with testers
eas build --profile preview --platform android

# Build a production AAB for the Play Store
eas build --profile production --platform android
```

> ℹ️ Both `preview` and `production` use the same EAS-managed keystore (same SHA-1), so testing Google Drive OAuth in a `preview` APK fully validates that it will work in `production`.

> 📖 If the Google Drive OAuth flow fails after building, refer to [`docs/google-oauth-apk-guide.md`](./docs/google-oauth-apk-guide.md) for a full debugging checklist.

---

## Running Tests

```bash
# Run all tests
npm test

# Watch mode — re-runs on file changes
npm run test:watch

# Generate a coverage report (output in ./coverage)
npm run test:coverage
```

Tests are written with **Jest** and **Testing Library for React Native**. Notable test files:

- [`src/components/Numpad.test.tsx`](./src/components/Numpad.test.tsx) — Numpad component unit tests
- [`src/components/CustomerCard.test.tsx`](./src/components/CustomerCard.test.tsx) — CustomerCard rendering tests

---

## Database Schema

Credi uses a local **SQLite** database managed by `expo-sqlite`. All migrations run automatically on app launch. There are four tables:

### `customers`
| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PK` | Auto-increment |
| `name` | `TEXT NOT NULL` | |
| `phone` | `TEXT` | Optional |
| `isDeleted` | `INTEGER` | Soft delete: `0` = active, `1` = deleted |
| `createdAt` | `TEXT` | ISO 8601 datetime |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PK` | Auto-increment |
| `customerId` | `INTEGER FK` | → `customers(id)` ON DELETE CASCADE |
| `type` | `TEXT` | `'debt'` or `'payment'` (CHECK constraint) |
| `amount` | `REAL` | Must be `> 0` (CHECK constraint) |
| `note` | `TEXT` | Optional |
| `createdAt` | `TEXT` | ISO 8601 datetime |

### `daily_summaries`
| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PK` | |
| `date` | `TEXT UNIQUE` | `YYYY-MM-DD` — one row per calendar day |
| `cashSales` | `INTEGER` | Stored in **cents** |
| `mpesaSales` | `INTEGER` | Stored in **cents** |
| `creditIssued` | `INTEGER` | Stored in **cents** |
| `notes` | `TEXT` | Optional free text |
| `createdAt` / `updatedAt` | `TEXT` | ISO 8601 |

### `daily_expenses`
| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PK` | |
| `summaryId` | `INTEGER FK` | → `daily_summaries(id)` ON DELETE CASCADE |
| `category` | `TEXT` | `stock \| rent \| transport \| salary \| utilities \| other \| custom` |
| `customCategory` | `TEXT` | Free-text label when `category = 'custom'` |
| `amount` | `INTEGER` | Stored in **cents** |
| `note` | `TEXT` | Optional |
| `createdAt` | `TEXT` | ISO 8601 |

> **Why cents?** Money amounts are stored as integer cents (e.g., KES 250.50 → `25050`) to avoid floating-point rounding errors in financial calculations.

---

## Export & Import

### Export
Navigate to **Settings → Backup & Restore → Export**. Two formats are available:

- **JSON** — Full machine-readable backup of all customers, transactions, and daily summaries. Used as the format for automatic Google Drive backups (`backup-YYYY-MM-DD-HH-mm.json`).
- **XLSX (Excel)** — Human-readable spreadsheet with one sheet per data type. Shared via the device's native share sheet.

If Google Drive is connected, a JSON backup is automatically uploaded to `appDataFolder` on every export.

### Import
Navigate to **Settings → Backup & Restore → Import**. Pick a previously exported JSON or XLSX file from the device. The import service merges data intelligently — existing records are not duplicated.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make changes** and add or update tests where relevant.
3. **Run tests** to confirm nothing is broken:
   ```bash
   npm test
   ```
4. **Open a Pull Request** with a clear description of what changed and why.

### Code conventions

- TypeScript strict mode is enabled — avoid `any`.
- All database access goes through `src/repositories/` — do not query SQLite directly from components or hooks.
- Money amounts in the database are stored as **integer cents**.
- New screens go in `src/screens/`, reusable components in `src/components/`.
- New translation keys must be added to **both** `en` and `sw` in `src/i18n/strings.ts`.

---

## License

MIT © W WORKS — see [LICENSE](./LICENSE) for full text.
