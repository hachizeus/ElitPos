/**
 * ElitPOS Electron — Server Manager
 *
 * Spawns and manages the Next.js + WebSocket server process inside Electron.
 * Handles:
 * - Starting the server (child_process.fork of server.js)
 * - Polling for readiness via HTTP health check
 * - Graceful shutdown
 * - Log forwarding to Electron's console
 * - Port detection and conflict resolution
 */

'use strict'

const { fork } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

const HEALTH_ENDPOINT = '/api/health'
const READY_TIMEOUT_MS = 60_000      // 60 seconds max wait
const HEALTH_POLL_INTERVAL_MS = 500  // poll every 500ms
const MAX_PORT_ATTEMPTS = 10

class ServerManager {
  constructor({ port, dev }) {
    this.port = port
    this.dev = dev
    this.process = null
    this._starting = false
    this._ready = false
    this._stopped = false
    this._readyResolve = null
    this._readyReject = null
  }

  isStarting() {
    return this._starting && !this._ready
  }

  isReady() {
    return this._ready
  }

  /**
   * Start the Next.js server and wait until it responds to health checks.
   * Returns a Promise that resolves when the server is ready.
   */
  async start() {
    if (this._ready) return
    if (this._starting) return new Promise((res, rej) => {
      this._readyResolve = res
      this._readyReject = rej
    })

    this._starting = true

    // Find the actual server.js path (works in both dev and packaged builds)
    const serverPath = this._resolveServerPath()
    if (!serverPath) {
      throw new Error(
        'Could not locate server.js. Make sure you ran `npm run build` before packaging.'
      )
    }

    // Resolve the port (find a free one if default is taken)
    this.port = await this._findFreePort(this.port)

    // Environment variables for the embedded server
    const serverEnv = {
      ...process.env,
      PORT: String(this.port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: this.dev ? 'development' : 'production',
      // Point to user-data dir for the local SQLite DB
      ELITPOS_DATA_DIR: app.getPath('userData'),
      ELITPOS_RUNTIME_MODE: 'electron',
      NEXT_PUBLIC_RUNTIME_MODE: 'electron',
      // Disable RLS-based subdomain routing (single-tenant desktop mode)
      NEXT_PUBLIC_BASE_DOMAIN: `localhost:${this.port}`,
      NEXT_PUBLIC_LANDING_DOMAIN: `localhost:${this.port}`,
      NEXT_PUBLIC_APP_DOMAIN: `localhost:${this.port}`,
      // Disable migrations auto-run if local SQLite is used (handled by db-setup.js)
      SKIP_MIGRATIONS: process.env.ELITPOS_DB_TYPE === 'sqlite' ? 'true' : 'false',
    }

    console.log(`[ServerManager] Starting server on port ${this.port}`)
    console.log(`[ServerManager] Server path: ${serverPath}`)

    this.process = fork(serverPath, [], {
      env: serverEnv,
      // Don't inherit stdio — capture it
      silent: true,
      // Run in the app's resource directory
      cwd: path.dirname(serverPath),
    })

    // Forward server logs to Electron console (prefixed for clarity)
    this.process.stdout?.on('data', (data) => {
      const text = data.toString().trim()
      if (text) console.log(`[Server] ${text}`)
    })

    this.process.stderr?.on('data', (data) => {
      const text = data.toString().trim()
      if (text) console.error(`[Server:err] ${text}`)
    })

    this.process.on('error', (err) => {
      console.error('[ServerManager] Process error:', err)
      if (!this._ready && this._readyReject) {
        this._readyReject(err)
      }
    })

    this.process.on('exit', (code, signal) => {
      console.log(`[ServerManager] Server exited: code=${code} signal=${signal}`)
      this._ready = false
      this._starting = false
      if (code !== 0 && !this._stopped && !this._ready && this._readyReject) {
        this._readyReject(new Error(`Server process exited with code ${code}`))
      }
    })

    // Wait for the server to be reachable
    return this._waitForReady()
  }

  /**
   * Gracefully stop the server process.
   */
  async stop() {
    this._stopped = true
    if (!this.process) return

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL')
        resolve()
      }, 8_000)

      this.process.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.process.kill('SIGTERM')
    })
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _resolveServerPath() {
    // In a packaged Electron app, resources live in process.resourcesPath
    const candidates = [
      // Packaged: extraResources/server.js
      path.join(process.resourcesPath || '', 'server.js'),
      // Dev: project root server.js
      path.join(app.getAppPath(), 'server.js'),
      path.join(app.getAppPath(), '..', 'server.js'),
      path.join(__dirname, '..', 'server.js'),
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
    return null
  }

  async _waitForReady() {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      this._readyResolve = resolve
      this._readyReject = reject

      const interval = setInterval(async () => {
        // Timeout check
        if (Date.now() - startTime > READY_TIMEOUT_MS) {
          clearInterval(interval)
          this._starting = false
          reject(new Error(`Server did not become ready within ${READY_TIMEOUT_MS / 1000}s`))
          return
        }

        // Process died check
        if (this.process?.exitCode !== null && this.process?.exitCode !== undefined) {
          clearInterval(interval)
          this._starting = false
          reject(new Error(`Server process exited prematurely with code ${this.process.exitCode}`))
          return
        }

        // Health check
        try {
          await this._healthCheck()
          clearInterval(interval)
          this._ready = true
          this._starting = false
          console.log(`[ServerManager] Server ready at http://localhost:${this.port}`)
          resolve()
        } catch {
          // Not ready yet — keep polling
        }
      }, HEALTH_POLL_INTERVAL_MS)
    })
  }

  _healthCheck() {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `http://127.0.0.1:${this.port}${HEALTH_ENDPOINT}`,
        { timeout: 2000 },
        (res) => {
          // Accept any 2xx or 3xx as "server is up"
          if (res.statusCode && res.statusCode < 500) {
            resolve()
          } else {
            reject(new Error(`Health check returned ${res.statusCode}`))
          }
          res.resume() // drain response
        }
      )
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Health check timed out'))
      })
    })
  }

  async _findFreePort(startPort) {
    for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
      const port = startPort + i
      const isFree = await this._isPortFree(port)
      if (isFree) return port
    }
    throw new Error(`Could not find a free port starting from ${startPort}`)
  }

  _isPortFree(port) {
    return new Promise((resolve) => {
      const server = require('net').createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => {
        server.close(() => resolve(true))
      })
      server.listen(port, '127.0.0.1')
    })
  }
}

module.exports = ServerManager
