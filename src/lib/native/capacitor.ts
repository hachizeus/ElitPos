/**
 * ElitPOS — Capacitor Native Plugin Bridge
 *
 * Wraps Capacitor plugin calls behind a unified interface that:
 *   - Returns no-ops when running outside a Capacitor native context
 *   - Provides TypeScript-typed helpers for every plugin we use
 *   - Is safe to import in both web and native builds
 *
 * Import this module instead of Capacitor plugins directly so the
 * same code runs in the browser (web-cloud), Electron, and Capacitor.
 */

// ── Runtime detection ─────────────────────────────────────────────────────────

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
  return w.Capacitor?.isNativePlatform?.() ?? false
}

export function getCapacitorPlatform(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined') return 'web'
  const w = window as Window & { Capacitor?: { getPlatform?: () => string } }
  const p = w.Capacitor?.getPlatform?.() ?? 'web'
  if (p === 'android') return 'android'
  if (p === 'ios') return 'ios'
  return 'web'
}

// ── Network status ────────────────────────────────────────────────────────────

export interface NetworkStatus {
  connected: boolean
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown'
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (!isCapacitorNative()) {
    return {
      connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connectionType: 'unknown',
    }
  }
  try {
    const { Network } = await import('@capacitor/network')
    const status = await Network.getStatus()
    return {
      connected: status.connected,
      connectionType: status.connectionType as NetworkStatus['connectionType'],
    }
  } catch {
    return { connected: navigator.onLine, connectionType: 'unknown' }
  }
}

export async function addNetworkListener(
  callback: (status: NetworkStatus) => void
): Promise<() => void> {
  if (!isCapacitorNative()) {
    const online = () => callback({ connected: true, connectionType: 'unknown' })
    const offline = () => callback({ connected: false, connectionType: 'none' })
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }
  try {
    const { Network } = await import('@capacitor/network')
    const handle = await Network.addListener('networkStatusChange', (status) => {
      callback({
        connected: status.connected,
        connectionType: status.connectionType as NetworkStatus['connectionType'],
      })
    })
    return () => handle.remove()
  } catch {
    return () => {}
  }
}

// ── Local storage (Capacitor Preferences — replaces localStorage on native) ──

export async function nativeGet(key: string): Promise<string | null> {
  if (!isCapacitorNative()) {
    return localStorage.getItem(key)
  }
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key })
    return value
  } catch {
    return localStorage.getItem(key)
  }
}

export async function nativeSet(key: string, value: string): Promise<void> {
  if (!isCapacitorNative()) {
    localStorage.setItem(key, value)
    return
  }
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key, value })
  } catch {
    localStorage.setItem(key, value)
  }
}

export async function nativeRemove(key: string): Promise<void> {
  if (!isCapacitorNative()) {
    localStorage.removeItem(key)
    return
  }
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key })
  } catch {
    localStorage.removeItem(key)
  }
}

// ── File system ───────────────────────────────────────────────────────────────

export interface SaveFileOptions {
  /** File name (no path) */
  fileName: string
  /** Base64-encoded data or plain text */
  data: string
  /** 'base64' (default) or 'utf8' */
  encoding?: 'base64' | 'utf8'
}

export async function saveFileToDownloads(options: SaveFileOptions): Promise<{ uri: string } | null> {
  if (!isCapacitorNative()) {
    // Web fallback: trigger browser download
    const a = document.createElement('a')
    a.href = options.encoding === 'utf8'
      ? `data:text/plain;charset=utf-8,${encodeURIComponent(options.data)}`
      : `data:application/octet-stream;base64,${options.data}`
    a.download = options.fileName
    a.click()
    return null
  }
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const result = await Filesystem.writeFile({
      path: options.fileName,
      data: options.data,
      directory: Directory.Documents,
      encoding: options.encoding === 'utf8' ? ('utf8' as never) : undefined,
      recursive: true,
    })
    return { uri: result.uri }
  } catch (err) {
    console.error('[Capacitor] File write failed:', err)
    return null
  }
}

// ── Splash screen ─────────────────────────────────────────────────────────────

export async function hideSplashScreen(): Promise<void> {
  if (!isCapacitorNative()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch { /* ignore */ }
}

// ── Status bar ────────────────────────────────────────────────────────────────

export async function setStatusBarStyle(style: 'dark' | 'light'): Promise<void> {
  if (!isCapacitorNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: style === 'dark' ? Style.Dark : Style.Light })
  } catch { /* ignore */ }
}

export async function setStatusBarColor(color: string): Promise<void> {
  if (!isCapacitorNative()) return
  if (getCapacitorPlatform() !== 'android') return // iOS doesn't support bg color
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color })
  } catch { /* ignore */ }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

export async function addAppStateListener(
  callback: (isActive: boolean) => void
): Promise<() => void> {
  if (!isCapacitorNative()) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const handle = await App.addListener('appStateChange', ({ isActive }) => {
      callback(isActive)
    })
    return () => handle.remove()
  } catch {
    return () => {}
  }
}

export async function exitApp(): Promise<void> {
  if (!isCapacitorNative()) return
  try {
    const { App } = await import('@capacitor/app')
    await App.exitApp()
  } catch { /* ignore */ }
}
