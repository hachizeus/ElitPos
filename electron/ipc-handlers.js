/**
 * ElitPOS Electron — IPC Handlers
 *
 * All ipcMain.handle() registrations live here to keep main.js clean.
 * Each handler corresponds to a contextBridge method in preload.js.
 */

'use strict'

const { app, shell, dialog, nativeTheme, Notification } = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const fs = require('fs')
const os = require('os')

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {import('electron').BrowserWindow} mainWindow
 * @param {import('./server-manager')} serverManager
 */
function setupIpcHandlers(ipcMain, mainWindow, serverManager) {

  // ── App info ───────────────────────────────────────────────────────────────
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:path', () => app.getAppPath())
  ipcMain.handle('app:data-path', () => app.getPath('userData'))
  ipcMain.handle('app:logs-path', () => app.getPath('logs'))

  // ── Server status ──────────────────────────────────────────────────────────
  ipcMain.handle('server:status', () => ({
    ready: serverManager?.isReady() ?? false,
    port: serverManager?.port ?? 3000,
  }))

  // ── Network ────────────────────────────────────────────────────────────────
  ipcMain.handle('network:is-online', () => {
    return checkInternetConnectivity()
  })

  // Poll network state every 10s and notify renderer on change
  let lastOnlineState = true
  const networkPoller = setInterval(async () => {
    const isOnline = await checkInternetConnectivity()
    if (isOnline !== lastOnlineState) {
      lastOnlineState = isOnline
      mainWindow?.webContents.send('network:changed', { isOnline })
    }
  }, 10_000)

  // Clean up poller when window is closed
  mainWindow?.on('closed', () => clearInterval(networkPoller))

  // ── Window controls ────────────────────────────────────────────────────────
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)

  mainWindow?.on('maximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', true)
  })
  mainWindow?.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', false)
  })

  // ── Theme ──────────────────────────────────────────────────────────────────
  ipcMain.handle('theme:get', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })

  // ── Files ──────────────────────────────────────────────────────────────────
  ipcMain.handle('files:save', async (_event, { data, defaultName, filters }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: filters || [
        { name: 'All Files', extensions: ['*'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Excel', extensions: ['xlsx', 'xls'] },
        { name: 'CSV', extensions: ['csv'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      // data can be a base64 string or Buffer serialized as array
      const buffer = Buffer.isBuffer(data)
        ? data
        : Buffer.from(data, typeof data === 'string' ? 'base64' : undefined)

      fs.writeFileSync(result.filePath, buffer)
      return { success: true, filePath: result.filePath }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('files:open', async (_event, { filters }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const filePath = result.filePaths[0]
      const buffer = fs.readFileSync(filePath)
      return {
        success: true,
        filePath,
        fileName: path.basename(filePath),
        data: buffer.toString('base64'),
        size: buffer.length,
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('files:show-in-explorer', async (_event, { filePath }) => {
    shell.showItemInFolder(filePath)
  })

  // ── Print ──────────────────────────────────────────────────────────────────
  ipcMain.handle('print:page', (_event, options = {}) => {
    mainWindow?.webContents.print({
      silent: options.silent ?? false,
      printBackground: options.printBackground ?? true,
      copies: options.copies ?? 1,
      pageSize: options.pageSize ?? 'A4',
      margins: options.margins ?? { marginType: 'default' },
    }, (success, errorType) => {
      if (!success) console.error('[Print] Failed:', errorType)
    })
  })

  ipcMain.handle('print:to-pdf', async (_event, options = {}) => {
    try {
      const pdfBuffer = await mainWindow?.webContents.printToPDF({
        printBackground: options.printBackground ?? true,
        pageSize: options.pageSize ?? 'A4',
        landscape: options.landscape ?? false,
        margins: options.margins,
      })

      if (!pdfBuffer) return { success: false, error: 'No content' }

      // Save to temp file
      const tmpPath = path.join(os.tmpdir(), `elitpos-print-${Date.now()}.pdf`)
      fs.writeFileSync(tmpPath, pdfBuffer)
      return { success: true, filePath: tmpPath, data: pdfBuffer.toString('base64') }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── External links ─────────────────────────────────────────────────────────
  ipcMain.handle('shell:open-external', (_event, { url }) => {
    // Security: only allow http/https
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
  })

  // ── Notifications ──────────────────────────────────────────────────────────
  ipcMain.handle('notify:show', (_event, { title, body, options = {} }) => {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: path.join(__dirname, '..', 'public', 'icons', 'mainlogo.png'),
        ...options,
      }).show()
    }
  })

  // ── Updates ────────────────────────────────────────────────────────────────
  ipcMain.handle('updates:check', async () => {
    // Simple version check against a remote JSON endpoint
    const updateUrl = process.env.ELITPOS_UPDATE_URL
    if (!updateUrl) return { hasUpdate: false }

    try {
      const data = await fetchJson(updateUrl)
      const latestVersion = data.version
      const currentVersion = app.getVersion()
      return {
        hasUpdate: latestVersion !== currentVersion,
        latestVersion,
        currentVersion,
        downloadUrl: data.downloadUrl,
        releaseNotes: data.releaseNotes,
      }
    } catch {
      return { hasUpdate: false }
    }
  })

  // ── Sync queue ─────────────────────────────────────────────────────────────
  ipcMain.handle('sync:queue-length', async () => {
    // Forward to the embedded server
    try {
      const res = await fetch(`http://127.0.0.1:${serverManager?.port ?? 3000}/api/offline/queue-length`)
      const data = await res.json()
      return data.count ?? 0
    } catch {
      return 0
    }
  })

  ipcMain.handle('sync:force', async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:${serverManager?.port ?? 3000}/api/offline/sync`,
        { method: 'POST' }
      )
      return res.ok
    } catch {
      return false
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lightweight internet connectivity check (hits DNS + HTTP) */
function checkInternetConnectivity() {
  return new Promise((resolve) => {
    // Try to reach Google's DNS over HTTP — if that's too strict, loosen to any public endpoint
    const req = https.get('https://dns.google/resolve?name=elitjohnsdigital.co.ke&type=A', {
      timeout: 3000,
    }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500)
      res.resume()
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

/** Fetch a JSON URL (http or https) */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { timeout: 5000 }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

module.exports = { setupIpcHandlers }
