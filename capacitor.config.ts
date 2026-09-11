import type { CapacitorConfig } from '@capacitor/cli'

/**
 * ElitPOS — Capacitor Configuration
 *
 * For MOBILE (Android/iOS): the app is a static Next.js export loaded in a
 * native WebView. API calls go to the remote server URL configured here, OR
 * fall through to the offline SQLite layer when there's no connection.
 *
 * For LOCAL DEVELOPMENT with a device on the same Wi-Fi as your dev machine:
 *   - Set server.url to your machine's LAN IP, e.g. 'http://192.168.1.50:3000'
 *   - Comment it out for production builds (uses bundled static files)
 */

const config: CapacitorConfig = {
  // ── App identity ─────────────────────────────────────────────────────────
  appId: 'ke.co.elitjohnsdigital.elitpos',
  appName: 'ElitPOS',

  // ── Web directory: Next.js static export output ──────────────────────────
  // Run `npm run build:mobile` to produce this directory
  webDir: 'out',

  // ── Server config ─────────────────────────────────────────────────────────
  server: {
    // Production: leave url unset → app uses bundled static files in WebView
    // Development: point to your dev server on the same network
    // url: 'http://192.168.1.50:3000',

    // Allow mixed content (HTTP API calls from HTTPS pages) in dev
    // Set to false in production
    androidScheme: 'https',
    cleartext: false,

    // Allow navigation within the app
    allowNavigation: [
      '*.elitjohnsdigital.co.ke',
      'localhost',
    ],
  },

  // ── Plugin configuration ──────────────────────────────────────────────────
  plugins: {
    // SplashScreen: shown while the WebView loads
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#071209',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // StatusBar: match app chrome
    StatusBar: {
      style: 'dark',             // 'dark' text on light bg, or 'light' text on dark bg
      backgroundColor: '#071209',
    },

    // Local Notifications (for sync completion, low stock alerts)
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#00FF88',
    },

    // Keyboard: push content up when keyboard appears
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },

  // ── Android-specific ──────────────────────────────────────────────────────
  android: {
    // Build output directory
    buildOptions: {
      releaseType: 'APK',
    },
    // Enable back-button handling (navigates back in-app)
    // handleApplicationNotifications: false,
  },

  // ── iOS-specific ──────────────────────────────────────────────────────────
  ios: {
    contentInset: 'always',
    // scrollEnabled: true,
  },
}

export default config
