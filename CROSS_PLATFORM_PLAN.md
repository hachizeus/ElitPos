# ElitPOS Cross-Platform Packaging Plan

## System Analysis Summary

### Current Architecture

ElitPOS is a **multi-tenant SaaS POS and business management system** built as:

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + custom Node.js HTTP server |
| Frontend | React 19, Tailwind CSS v4, Zustand, Framer Motion |
| Database | PostgreSQL (Drizzle ORM, Row-Level Security) |
| Auth | NextAuth v5 beta (JWT, Credentials provider) |
| Real-time | Custom WebSocket server (ws package) co-hosted with Next.js |
| File Storage | Cloudflare R2 (AWS S3-compatible) |
| Email | Resend |
| AI | DeepSeek (primary) + Google Gemini (fallback) |
| Payments | PayHere, M-Pesa, PayStack, PayHero |
| Testing | Playwright E2E, k6 stress tests |

### Feature Modules
- POS Terminal (shifts, layaways, held sales, gift cards, loyalty)
- Inventory (items, warehouses, stock transfers, batches, serial numbers)
- Purchasing (requisitions → PO → GRN → invoice)
- Sales Orders & Estimates
- Restaurant Mode (tables, kitchen orders, reservations)
- HR & Payroll
- Accounting (double-entry GL, tax, exchange rates)
- Auto Service / Dealership (work orders, inspections, vehicle inventory)
- CRM / Customers
- File Management (R2, deduplication, quotas)
- Reports & Analytics
- Staff Chat (WebSocket)
- Notifications (in-app, SMS, email)
- Super Admin Panel

---

## Cross-Platform Strategy

### Platform Targets

| Platform | Technology | Output |
|---|---|---|
| **Windows Desktop** | Electron + electron-builder | `.exe` NSIS installer |
| **Android** | Capacitor | `.apk` / `.aab` |
| **iOS** | Capacitor | `.ipa` (requires macOS + Xcode to build) |

### Why Electron (not Tauri) for Windows?
- ElitPOS uses a **custom Node.js HTTP server** (`server.js`) that must run alongside Next.js. Electron ships its own Node.js runtime so we can embed the full server.
- Postgres can be replaced with **PostgreSQL embedded via `pg-embedded`** or **SQLite via better-sqlite3** for the offline DB — both are Node.js native modules that Electron handles well.
- No Rust toolchain required (Tauri would need it).

### Why Capacitor (not React Native) for Mobile?
- The app is already a full web app. Capacitor wraps the **built Next.js output as a WebView** — zero component rewrites needed.
- Capacitor provides native plugin APIs (Network, Filesystem, Storage, Notifications) that we wire into the offline sync engine.
- The same codebase runs on web + Android + iOS.

---

## Offline Architecture

### The Core Problem
The current app has:
- **No service worker** — confirmed by absence of `sw.js` or Workbox config
- **No IndexedDB** usage — only `localStorage` for lightweight preferences
- **No offline queue** — no pending mutation storage
- PostgreSQL as the only DB backend — requires live network connection

### Solution: Three-Layer Offline Stack

```
┌─────────────────────────────────────────────┐
│              Application Layer               │
│   (React components, Next.js pages/API)      │
└──────────────────┬──────────────────────────┘
                   │ uses
┌──────────────────▼──────────────────────────┐
│           Offline-Aware API Client           │
│   src/lib/offline/api-client.ts             │
│   - Wraps fetch()                            │
│   - Detects offline state                    │
│   - Returns optimistic responses             │
│   - Queues mutations to IndexedDB            │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │ Online              │ Offline
        ▼                     ▼
┌───────────────┐   ┌─────────────────────────┐
│ PostgreSQL    │   │  SQLite (local replica)  │
│ (full data)   │   │  + IndexedDB queue       │
│ (server/cloud)│   │  (pending mutations)     │
└───────────────┘   └────────────┬────────────┘
                                 │ on reconnect
                    ┌────────────▼────────────┐
                    │     Sync Manager         │
                    │ src/lib/offline/sync.ts  │
                    │ - Replays queued ops     │
                    │ - Conflict resolution    │
                    └─────────────────────────┘
```

### Offline Data Scope (what works offline)
- **Full offline**: POS transactions, sales, item lookup, customer lookup, stock check
- **Partial offline**: Reports (last cached), estimates, work orders
- **Requires online**: File uploads, email/SMS, AI features, payment gateways, billing
- **Service Worker caches**: All static assets, all API GET responses (60s TTL)

---

## File Structure Added

```
ElitPOS/
├── electron/                    # Electron main process
│   ├── main.js                  # Entry: spawns Next.js server, creates BrowserWindow
│   ├── preload.js               # Context bridge (ipcRenderer)
│   ├── server-manager.js        # Manages embedded Next.js server lifecycle
│   └── db-setup.js              # SQLite schema init for offline/Electron
├── electron-builder.yml         # electron-builder config (Windows NSIS)
│
├── capacitor.config.ts          # Capacitor config
├── android/                     # Android native project (generated by Capacitor)
├── ios/                         # iOS native project (generated by Capacitor)
│
├── public/
│   └── sw.js                    # Service Worker (generated by build)
│
├── src/
│   └── lib/
│       └── offline/
│           ├── api-client.ts    # Offline-aware fetch wrapper
│           ├── db-offline.ts    # SQLite Drizzle setup (browser: wa-sqlite; Electron: better-sqlite3)
│           ├── schema-offline.ts # SQLite schema (subset of Postgres schema)
│           ├── sync-manager.ts  # Sync queue → server on reconnect
│           ├── conflict-resolver.ts # Conflict resolution strategies
│           └── indexed-db-queue.ts  # IndexedDB pending operations store
│
├── src/app/offline/             # Offline fallback page
│
├── CROSS_PLATFORM_PLAN.md       # This file
└── BUILDING.md                  # Step-by-step build instructions
```

---

## Key Technical Decisions

### 1. Embedded Database for Electron
- **Development / server**: PostgreSQL (existing `pg` pool)
- **Electron (desktop)**: `@embedded-postgres/linux` / `@embedded-postgres/windows` OR `better-sqlite3` (SQLite)
  - SQLite chosen for simplicity and zero-config — embedded Postgres adds 50MB+ and requires OS-level process management
  - Drizzle supports both `pg` and `better-sqlite3` dialects — we use a runtime adapter

### 2. Service Worker Strategy
- `next-pwa` (Workbox-based) added to `next.config.ts`
- Precache: JS/CSS chunks, HTML shells, fonts
- Runtime cache:
  - `GET /api/items` → NetworkFirst, 5min cache
  - `GET /api/customers` → NetworkFirst, 5min cache
  - `GET /api/pos-profiles` → CacheFirst, 1hr
  - `GET /api/categories` → CacheFirst, 1hr
  - Images → CacheFirst, 7 days
- Background sync: All `POST/PATCH/DELETE` mutations queued when offline

### 3. Auth in Offline Mode
- JWT stored in `localStorage` / `SecureStorage` (Capacitor)
- Offline: JWT validated locally (signature + expiry check only, no DB validation)
- First-time setup requires online connection to download initial data snapshot

### 4. Capacitor WebView Setup
- `webDir: 'out'` — Next.js static export (`next export`) for mobile
- Static export means: **no Next.js API routes** on mobile — all API calls go to the configured server URL or the bundled offline SQLite layer
- For mobile: API base URL configurable via `capacitor.config.ts` `server.url` (can point to cloud or local server on same network)

### 5. Multi-Mode Environment Detection

```
NEXT_PUBLIC_RUNTIME_MODE = 'web-cloud' | 'web-offline' | 'electron' | 'capacitor'
```

This controls:
- Which DB adapter to use
- Whether to start WebSocket server
- Whether to use R2 or local filesystem for files
- Whether to use Resend or skip emails

---

## Build Commands

```bash
# Web (cloud) — existing
npm run build && npm start

# Windows EXE
npm run build:electron      # builds Next.js + packages with electron-builder

# Android APK
npm run build:android       # next export → npx cap sync → cd android → ./gradlew assembleRelease

# iOS IPA (requires macOS + Xcode)
npm run build:ios           # next export → npx cap sync → xcodebuild archive

# All platforms
npm run build:all
```

---

## Limitations & Known Issues

1. **iOS build requires macOS + Xcode** — cannot be built on Windows. The code and config will be set up here, but the actual `.ipa` must be built on a Mac.
2. **Capacitor uses static export** — Next.js API routes don't run inside the mobile app. The app must connect to a server (cloud or local network) OR use the embedded SQLite layer for all data operations.
3. **WebSocket server not available in static export** — real-time features degrade to polling on mobile.
4. **File uploads offline** — files are stored locally and synced to R2 when back online.
5. **Payment gateways** (M-Pesa, PayHere, etc.) — require internet; disabled/hidden in offline mode.
6. **AI features** — require internet; disabled in offline mode.
7. **Electron code signing** — requires a code signing certificate for production Windows distribution. The build will work unsigned for internal/development use.

---

## Implementation Tasks

See the task list in the IDE task panel for the 12 implementation tasks.
