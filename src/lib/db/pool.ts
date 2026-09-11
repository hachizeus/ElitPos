import { Pool } from 'pg'

// Single shared database connection pool for the entire application.
// Both db/index.ts (legacy queries) and tenant-context.ts (RLS queries)
// share this pool to prevent exhausting Railway's connection limit.
let pool: Pool | null = null

export function getSharedPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Optimized for Windows development
      max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Reduced from 100 - Windows can't handle that many
      min: 2, // Keep minimum 2 connections alive
      // Keep connections alive longer (Windows is slow to establish new ones)
      idleTimeoutMillis: 60_000, // 60 seconds (was 20)
      // Much longer connection timeout for Windows
      connectionTimeoutMillis: 30_000, // 30 seconds (was 3!)
      // Longer statement timeout for complex queries on Windows
      options: '-c statement_timeout=60000', // 60 seconds (was 20)
      // Keep-alive prevents idle connections from being dropped
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    })

    pool.on('error', (err) => {
      console.error('[Pool] Unexpected error on idle client:', err.message)
    })

    // Monitor pool health
    pool.on('connect', () => {
      console.log('[Pool] Client connected. Total:', pool.totalCount, 'Idle:', pool.idleCount, 'Waiting:', pool.waitingCount)
    })
  }
  return pool
}

export async function closeSharedPool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
