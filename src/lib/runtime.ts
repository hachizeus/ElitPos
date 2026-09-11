/**
 * ElitPOS — Runtime Mode Detection
 *
 * Centralises all runtime environment checks so the rest of the codebase
 * has one consistent place to ask "am I running in Electron?" etc.
 *
 * Safe to call on server and client. Uses env var on server, window checks
 * on client.
 */

export type RuntimeMode = 'web-cloud' | 'electron' | 'capacitor' | 'capacitor-android' | 'capacitor-ios'

/** Detect the current runtime mode. */
export function getRuntimeMode(): RuntimeMode {
  // Server-side: rely entirely on env var
  if (typeof window === 'undefined') {
    const mode = process.env.ELITPOS_RUNTIME_MODE ?? process.env.NEXT_PUBLIC_RUNTIME_MODE
    if (mode === 'electron') return 'electron'
    if (mode === 'capacitor') return 'capacitor'
    return 'web-cloud'
  }

  // Client-side: check injected globals
  const w = window as Window & {
    electronAPI?: unknown
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }

  if (w.electronAPI) return 'electron'

  if (w.Capacitor?.isNativePlatform?.()) {
    const platform = w.Capacitor.getPlatform?.()
    if (platform === 'android') return 'capacitor-android'
    if (platform === 'ios') return 'capacitor-ios'
    return 'capacitor'
  }

  // Fallback to env var (set at build time)
  const envMode = process.env.NEXT_PUBLIC_RUNTIME_MODE
  if (envMode === 'electron') return 'electron'
  if (envMode === 'capacitor') return 'capacitor'

  return 'web-cloud'
}

export const isElectron = (): boolean => getRuntimeMode() === 'electron'
export const isCapacitor = (): boolean => getRuntimeMode().startsWith('capacitor')
export const isNative = (): boolean => isElectron() || isCapacitor()
export const isWebCloud = (): boolean => getRuntimeMode() === 'web-cloud'

/**
 * Features that are unavailable in certain runtimes.
 * Call these before rendering UI that depends on network features.
 */
export const features = {
  /** File upload to cloud storage (R2) */
  cloudFileUpload: (): boolean => !!(
    typeof process !== 'undefined' && process.env.R2_ENDPOINT
  ),
  /** AI features (DeepSeek / Gemini) */
  aiFeatures: (): boolean => !!(
    typeof process !== 'undefined' &&
    (process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY)
  ),
  /** Payment gateways */
  payments: (): boolean => isWebCloud(),
  /** Real-time WebSocket */
  realtime: (): boolean => !isCapacitor(),
  /** SMS notifications */
  sms: (): boolean => isWebCloud(),
  /** Email notifications */
  email: (): boolean => isWebCloud(),
  /** Print to PDF */
  printToPdf: (): boolean => isElectron(),
  /** Native file save dialog */
  nativeFileSave: (): boolean => isElectron(),
  /** Background sync */
  backgroundSync: (): boolean => isNative() || (
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window
  ),
}
