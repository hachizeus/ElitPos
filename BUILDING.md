# ElitPOS — Build Guide

Complete instructions for packaging ElitPOS as a Windows EXE installer, Android APK, and iOS IPA.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Windows EXE (Electron)](#windows-exe-electron)
3. [Android APK (Capacitor)](#android-apk-capacitor)
4. [iOS IPA (Capacitor)](#ios-ipa-capacitor)
5. [Development Workflow](#development-workflow)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### All platforms
```bash
node >= 20 LTS
npm >= 10
```

### Windows EXE
- Windows 10/11 x64 (build machine)
- No additional tools required — electron-builder downloads everything it needs

### Android APK
- [Android Studio](https://developer.android.com/studio) with SDK Platform 33+ installed
- `ANDROID_HOME` environment variable set (e.g. `C:\Users\<you>\AppData\Local\Android\Sdk`)
- Java 17 (bundled with Android Studio — use `File > Project Structure > SDK Location`)

### iOS IPA
- **macOS only** — iOS builds cannot be produced on Windows
- Xcode 15+ from the Mac App Store
- Apple Developer Program membership (for device builds and App Store distribution)
- `xcode-select --install` run at least once

---

## Windows EXE (Electron)

The installer bundles:
- The full Next.js app (pre-built `.next/` output)
- The custom Node.js + WebSocket server (`server.js`)
- Electron runtime (Chromium + Node.js)
- SQLite database for offline operation (`better-sqlite3`)

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Set environment variables
Copy the Electron env template and fill in your secrets:
```bash
copy .env.electron .env
```
Edit `.env` and set at minimum:
```env
NEXTAUTH_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### Step 3 — Build the Next.js app + server
```bash
npm run build:electron
```
This runs:
1. `next build` (with `NEXT_PUBLIC_RUNTIME_MODE=electron`)
2. `node scripts/build-server.mjs` (compiles `server.ts` → `server.js`)
3. `electron-builder --win` (packages into `dist-electron/`)

### Step 4 — Output
```
dist-electron/
  ElitPOS Setup 1.0.7.exe          # NSIS installer (x64)
  ElitPOS Setup 1.0.7 (32bit).exe  # NSIS installer (ia32)
  ElitPOS-1.0.7-portable-x64.exe   # Portable (no install needed)
```

### Step 5 — Install on Windows
Double-click `ElitPOS Setup 1.0.7.exe` → follow the wizard → launch from Start Menu or Desktop shortcut.

### Code signing (optional but recommended for distribution)
Set these environment variables before building:
```env
WIN_CERT_FILE=path\to\certificate.pfx
WIN_CERT_PASSWORD=your_cert_password
```
Then uncomment the signing section in `electron-builder.yml`.

### Development run (no packaging)
```bash
npm run dev:electron
```
Opens Electron pointing at the dev Next.js server. Hot reload works.

---

## Android APK (Capacitor)

The APK wraps the Next.js static export in a native Android WebView. API calls go to the configured remote server. Offline operations use the IndexedDB queue.

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Set mobile environment
```bash
copy .env.capacitor .env.local
```
Edit `.env.local` and set:
```env
NEXT_PUBLIC_API_BASE_URL=https://your-server.elitjohnsdigital.co.ke
```

### Step 3 — Initialize Capacitor (first time only)
If `android/` does not exist yet:
```bash
npx cap add android
```

### Step 4 — Build the static Next.js export
```bash
npm run build:android
```
This runs:
1. `next build` with `output: 'export'` (produces `out/` directory)
2. `npx cap sync android` (copies web assets into `android/app/src/main/assets/public/`)

### Step 5 — Open in Android Studio
```bash
npx cap open android
```
OR manually: `File > Open` → select the `android/` directory.

### Step 6 — Build the APK
In Android Studio:
- **Debug APK**: `Build > Build Bundle(s) / APK(s) > Build APK(s)`
  - Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `Build > Generate Signed Bundle / APK` → select APK → sign with your keystore
  - Output: `android/app/build/outputs/apk/release/app-release.apk`

### Step 7 — Install on Android device
```bash
# Enable USB debugging on device, then:
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
Or simply share the `.apk` file and open it on the device (enable "Install from unknown sources").

### Generating a release keystore (first time)
```bash
keytool -genkey -v -keystore elitpos-release.keystore -alias elitpos -keyalg RSA -keysize 2048 -validity 10000
```
Store `elitpos-release.keystore` securely — you need the same keystore for every future update.

---

## iOS IPA (Capacitor)

> **Requires macOS with Xcode 15+**

### Step 1 — Install dependencies (on Mac)
```bash
npm install
sudo gem install cocoapods   # if not already installed
```

### Step 2 — Initialize Capacitor iOS (first time only)
```bash
npx cap add ios
```

### Step 3 — Build the static Next.js export
```bash
npm run build:ios
```
This runs:
1. `next build` with `output: 'export'`
2. `npx cap sync ios`

### Step 4 — Install CocoaPods dependencies
```bash
cd ios/App && pod install && cd ../..
```

### Step 5 — Open in Xcode
```bash
npx cap open ios
```

### Step 6 — Configure signing in Xcode
- Select the `App` target → `Signing & Capabilities`
- Set your Team (Apple Developer account)
- Bundle Identifier: `ke.co.elitjohnsdigital.elitpos`

### Step 7 — Build the IPA
**For device testing (ad-hoc)**:
- `Product > Destination` → select a connected device or "Any iOS Device"
- `Product > Archive`
- In the Organizer: `Distribute App > Ad Hoc`

**For App Store submission**:
- `Product > Archive`
- In the Organizer: `Distribute App > App Store Connect`

### Step 8 — Install on iOS device
For ad-hoc builds: share the `.ipa` via AirDrop, Apple Configurator, or TestFlight.

---

## Development Workflow

### Web (cloud) — default
```bash
npm run dev
# Opens on http://localhost:3000
```

### Electron (desktop dev)
```bash
npm run dev:electron
# Builds server.js then opens Electron window
```

### Capacitor Android (live reload on device)
```bash
# 1. Start the Next.js dev server
npm run dev

# 2. In capacitor.config.ts, set:
#    server: { url: 'http://<YOUR_LAN_IP>:3000' }

# 3. Sync and run on connected device
npm run cap:run:android
```

### Capacitor iOS (live reload on simulator — macOS only)
```bash
npm run dev
# Set server.url in capacitor.config.ts to your LAN IP
npm run cap:run:ios
```

---

## Environment Variables Reference

| Variable | Web | Electron | Capacitor |
|---|---|---|---|
| `DATABASE_URL` | ✅ Required | ❌ Uses SQLite | ❌ Uses remote API |
| `NEXTAUTH_SECRET` | ✅ Required | ✅ Required | ✅ Server-side only |
| `NEXT_PUBLIC_RUNTIME_MODE` | `web-cloud` | `electron` | `capacitor` |
| `NEXT_PUBLIC_API_BASE_URL` | ❌ | ❌ | ✅ Required |
| `R2_ENDPOINT` | Optional | Optional | ❌ |
| `RESEND_API_KEY` | Optional | Optional | ❌ |
| `DEEPSEEK_API_KEY` | Optional | Optional | ❌ |
| `ELITPOS_DATA_DIR` | ❌ | Auto-set by Electron | ❌ |

See `.env.electron` and `.env.capacitor` for full templates.

---

## Troubleshooting

### Electron: "Could not locate server.js"
Run `npm run build` first to generate `server.js`. The Electron app requires the compiled server file.

### Electron: App won't start, port in use
The server-manager auto-finds a free port starting from 3000. Check the Electron logs at:
- Windows: `%APPDATA%\ElitPOS\logs\main.log`

### Android: WebView shows blank page
1. Make sure `npm run build:android` completed without errors
2. Check that `out/` directory exists and contains `index.html`
3. In `capacitor.config.ts`, ensure `webDir: 'out'` is set

### Android: API calls fail (CORS / network error)
- For local dev: ensure `server.url` in `capacitor.config.ts` points to your machine's LAN IP (not `localhost` — that refers to the device itself)
- For production: ensure your API server has CORS configured for the Capacitor app origin

### Android: `cleartext traffic` error
In `capacitor.config.ts` set `server.androidScheme: 'https'`. If you need HTTP for a local dev server, add a `network_security_config.xml` to allow it.

### iOS: Build fails with "No signing certificate"
Set up your Apple Developer account in Xcode under `Preferences > Accounts`, then configure the signing in the target settings.

### iOS: `pod install` fails
```bash
sudo gem update cocoapods
pod repo update
cd ios/App && pod install
```

### TypeScript errors after updating files
```bash
npx tsc --noEmit
```
Fix any reported errors before packaging.

### Offline sync not working
1. Open DevTools (F12) → Application → IndexedDB → `elitpos-offline` → `mutation_queue`
2. Verify mutations are being queued when offline
3. Go online — the `SyncManager` should fire automatically on the `online` event
4. For Electron: use the "Sync now" button in the OfflineStatusBar or trigger `POST /api/offline/sync`
