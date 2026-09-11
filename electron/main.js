/**
 * ElitPOS Electron Main Process
 *
 * Responsibilities:
 * 1. Spawn the embedded Next.js server (server.js) as a child process
 * 2. Create the BrowserWindow pointed at localhost:<port>
 * 3. Handle app lifecycle (ready, window-all-closed, will-quit)
 * 4. Provide IPC channels for the renderer (online/offline status, DB queries)
 * 5. Show a loading splash while the server warms up
 */

'use strict'

const { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme, Menu } = require('electron')
const path = require('path')
const { fork, spawn } = require('child_process')
const ServerManager = require('./server-manager')
const { setupIpcHandlers } = require('./ipc-handlers')

// ── Constants ─────────────────────────────────────────────────────────────────
const PORT = process.env.ELITPOS_PORT ? parseInt(process.env.ELITPOS_PORT, 10) : 3000
const DEV = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true'
const APP_URL = `http://localhost:${PORT}`

// ── Single-instance lock ───────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// ── Window reference ──────────────────────────────────────────────────────────
let mainWindow = null
let splashWindow = null
let serverManager = null

// ── App event handlers ────────────────────────────────────────────────────────

app.on('ready', async () => {
  // Set application name and user data path
  app.setName('ElitPOS')

  // Dark mode: respect system preference
  nativeTheme.themeSource = 'system'

  // Remove default menu bar (we build our own)
  Menu.setApplicationMenu(buildMenu())

  // Show splash screen immediately
  splashWindow = createSplashWindow()

  // Start the Next.js + WebSocket server
  serverManager = new ServerManager({ port: PORT, dev: DEV })

  try {
    await serverManager.start()
    // Server is ready — open the main window
    createMainWindow()
  } catch (err) {
    dialog.showErrorBox(
      'ElitPOS — Failed to start',
      `The internal server could not start.\n\n${err.message}\n\nPlease check that port ${PORT} is not in use and try again.`
    )
    app.quit()
  }
})

app.on('second-instance', () => {
  // Focus the existing window when a second instance is launched
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  // On macOS, apps stay alive until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // macOS: re-open window on dock click
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

app.on('will-quit', async (event) => {
  event.preventDefault()
  if (serverManager) {
    try {
      await serverManager.stop()
    } catch { /* ignore */ }
  }
  app.exit(0)
})

// ── Window factories ──────────────────────────────────────────────────────────

function createSplashWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadFile(path.join(__dirname, 'splash.html'))
  return win
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false, // shown after 'ready-to-show'
    icon: path.join(__dirname, '..', 'public', 'icons', 'mainlogo.png'),
    title: 'ElitPOS',
    backgroundColor: '#071209', // matches app background
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // Allow localStorage / IndexedDB (needed for offline queue)
      partition: 'persist:elitpos',
    },
  })

  // Load the app
  mainWindow.loadURL(APP_URL)

  // Show once the page is ready and close splash
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow.show()
    if (DEV) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Handle failed navigation (server not ready, network error)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc, url) => {
    console.error(`[Electron] Page failed to load: ${errorCode} ${errorDesc} — ${url}`)
    // Retry after 1 second if server is still starting
    if (serverManager && serverManager.isStarting()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(APP_URL)
        }
      }, 1500)
    }
  })

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Prevent navigation to external URLs within the app window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith('http://localhost:')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Register IPC handlers now that we have a window
  setupIpcHandlers(ipcMain, mainWindow, serverManager)
}

// ── Application menu ──────────────────────────────────────────────────────────

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    // macOS: app menu
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'F5',
          click: () => mainWindow?.webContents.reload(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const level = mainWindow.webContents.getZoomLevel()
              mainWindow.webContents.setZoomLevel(Math.min(level + 0.5, 5))
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const level = mainWindow.webContents.getZoomLevel()
              mainWindow.webContents.setZoomLevel(Math.max(level - 0.5, -5))
            }
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.setZoomLevel(0),
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen())
            }
          },
        },
        ...(DEV ? [
          { type: 'separator' },
          {
            label: 'Developer Tools',
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => mainWindow?.webContents.toggleDevTools(),
          },
        ] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ElitPOS',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About ElitPOS',
              message: 'ElitPOS',
              detail: `Version: ${app.getVersion()}\nAI-Powered Point of Sale & Business Management\n\nBuilt by Elitjohns Digital Agency`,
              icon: path.join(__dirname, '..', 'public', 'icons', 'mainlogo.png'),
            })
          },
        },
        {
          label: 'Open Logs Folder',
          click: () => shell.openPath(app.getPath('logs')),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
