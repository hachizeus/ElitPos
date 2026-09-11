/**
 * ElitPOS Electron — Preload Script
 *
 * Runs in the renderer process with contextIsolation: true.
 * Exposes a safe, controlled API bridge via contextBridge.
 * The renderer (Next.js) can call `window.electronAPI.*` to:
 * - Get runtime information (platform, app version, paths)
 * - Detect online/offline status (via main process network check)
 * - Request local DB queries (offline SQLite)
 * - Trigger OS-level operations (file save dialog, open external URL)
 * - Receive IPC events from main (server status, sync events)
 */

'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// ── Exposed API ────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Runtime info ────────────────────────────────────────────────────────
  platform: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },
  runtimeMode: 'electron',

  // ── App info (async) ─────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getAppPath: () => ipcRenderer.invoke('app:path'),
  getDataPath: () => ipcRenderer.invoke('app:data-path'),
  getLogsPath: () => ipcRenderer.invoke('app:logs-path'),

  // ── Server status ────────────────────────────────────────────────────────
  getServerStatus: () => ipcRenderer.invoke('server:status'),
  onServerStatusChange: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('server:status-changed', listener)
    // Return cleanup function
    return () => ipcRenderer.removeListener('server:status-changed', listener)
  },

  // ── Network / Offline ────────────────────────────────────────────────────
  isOnline: () => ipcRenderer.invoke('network:is-online'),
  onNetworkChange: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('network:changed', listener)
    return () => ipcRenderer.removeListener('network:changed', listener)
  },

  // ── Local SQLite DB (offline mode) ──────────────────────────────────────
  // All queries are executed in the main process (secure — renderer has no
  // direct DB access). Queries are scoped to the active tenant.
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
    execute: (sql, params) => ipcRenderer.invoke('db:execute', { sql, params }),
    transaction: (operations) => ipcRenderer.invoke('db:transaction', { operations }),
  },

  // ── Offline sync queue ────────────────────────────────────────────────────
  sync: {
    getQueueLength: () => ipcRenderer.invoke('sync:queue-length'),
    forcSync: () => ipcRenderer.invoke('sync:force'),
    onSyncComplete: (callback) => {
      const listener = (_event, result) => callback(result)
      ipcRenderer.on('sync:completed', listener)
      return () => ipcRenderer.removeListener('sync:completed', listener)
    },
    onSyncError: (callback) => {
      const listener = (_event, error) => callback(error)
      ipcRenderer.on('sync:error', listener)
      return () => ipcRenderer.removeListener('sync:error', listener)
    },
  },

  // ── File system ────────────────────────────────────────────────────────────
  files: {
    // Open a save-file dialog and save data to the chosen path
    saveFile: (data, defaultName, filters) =>
      ipcRenderer.invoke('files:save', { data, defaultName, filters }),
    // Open a file-open dialog and return file contents
    openFile: (filters) =>
      ipcRenderer.invoke('files:open', { filters }),
    // Open a folder in the OS file explorer
    showInExplorer: (filePath) =>
      ipcRenderer.invoke('files:show-in-explorer', { filePath }),
  },

  // ── Print ─────────────────────────────────────────────────────────────────
  print: {
    printCurrentPage: (options) => ipcRenderer.invoke('print:page', options),
    printToPdf: (options) => ipcRenderer.invoke('print:to-pdf', options),
  },

  // ── External links ────────────────────────────────────────────────────────
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', { url }),

  // ── Window controls ──────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (callback) => {
      const listener = (_event, isMax) => callback(isMax)
      ipcRenderer.on('window:maximize-changed', listener)
      return () => ipcRenderer.removeListener('window:maximize-changed', listener)
    },
  },

  // ── Theme ─────────────────────────────────────────────────────────────────
  getSystemTheme: () => ipcRenderer.invoke('theme:get'),
  onThemeChange: (callback) => {
    const listener = (_event, theme) => callback(theme)
    ipcRenderer.on('theme:changed', listener)
    return () => ipcRenderer.removeListener('theme:changed', listener)
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  showNotification: (title, body, options) =>
    ipcRenderer.invoke('notify:show', { title, body, options }),

  // ── Updates ───────────────────────────────────────────────────────────────
  updates: {
    checkForUpdates: () => ipcRenderer.invoke('updates:check'),
    onUpdateAvailable: (callback) => {
      const listener = (_event, info) => callback(info)
      ipcRenderer.on('updates:available', listener)
      return () => ipcRenderer.removeListener('updates:available', listener)
    },
  },
})
