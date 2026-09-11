import { NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { getStorageQuota } from '@/lib/db/storage-quota'
import { dbCache, CacheTTL } from '@/lib/db/query-cache'

// GET /api/company/storage-quota - Returns storage quota for current tenant
export async function GET() {
  const session = await authWithCompany()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cache storage quota (expensive to calculate, changes slowly)
  const cacheKey = `storage-quota:${session.user.tenantId}`
  
  const quota = await dbCache.query(
    cacheKey,
    () => getStorageQuota(session.user.tenantId),
    CacheTTL.DYNAMIC // 30 seconds - balances accuracy with performance
  )

  // Add browser cache headers
  return NextResponse.json(quota, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  })
}
