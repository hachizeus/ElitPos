/**
 * GET /api/health
 *
 * Lightweight health-check endpoint used by:
 *   - Electron server-manager.js: polls this to know when the Next.js server
 *     is ready before opening the BrowserWindow
 *   - E2E global-setup: verifies dev server is running before tests start
 *   - Load balancers / uptime monitors in production
 *   - Cron job guards
 *
 * Returns 200 with basic runtime info. Intentionally avoids DB queries
 * so it stays fast and doesn't block startup.
 */

import { NextResponse } from 'next/server'

// Tell Next.js: do not cache this route — always evaluate at request time
export const dynamic = 'force-dynamic'

const startTime = Date.now()

export async function GET() {
  const uptimeSec = Math.floor((Date.now() - startTime) / 1000)

  return NextResponse.json(
    {
      status: 'ok',
      version: process.env.APP_VERSION ?? '1.0.0',
      runtime: process.env.ELITPOS_RUNTIME_MODE ?? 'web-cloud',
      uptime: uptimeSec,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        // Never cache — always live status
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json',
      },
    }
  )
}
