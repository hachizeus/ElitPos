import { NextRequest, NextResponse } from 'next/server'
import { accountAuth as auth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { logError } from '@/lib/ai/error-logger'
import { uploadToR2, deleteFromR2, keyFromUrl } from '@/lib/files'
import { imagekitEnabled, uploadToImageKit } from '@/lib/files/imagekit'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPEG, WebP' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 2MB' }, { status: 400 })
    }

    const accountId = session.user.accountId
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12)
    const ext = file.name.split('.').pop() || 'png'

    // Delete old avatar if exists
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { avatarUrl: true }
    })

    if (account?.avatarUrl) {
      const ikOld = decodeImageKitUrl(account.avatarUrl)
      if (ikOld) {
        const { deleteFromImageKit } = await import('@/lib/files/imagekit')
        await deleteFromImageKit(ikOld.fileId).catch(() => {})
      } else {
        const oldKey = keyFromUrl(account.avatarUrl)
        if (oldKey) await deleteFromR2(oldKey).catch(() => {})
      }
    }

    let avatarUrl: string
    if (imagekitEnabled()) {
      const ikResult = await uploadToImageKit(buffer, `avatar-${hash}.${ext}`, file.type, 'avatars')
      avatarUrl = ikResult.url  // store plain URL — works directly as <img src>
    } else {
      const r2Key = `avatars/${hash}.${ext}`
      avatarUrl = await uploadToR2(r2Key, buffer, file.type)
    }

    await db.update(accounts)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(accounts.id, accountId))

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    logError('api/account/avatar', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = session.user.accountId

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { avatarUrl: true }
    })

    if (account?.avatarUrl) {
      // ImageKit URLs can't be deleted by URL alone — just unset in DB
      if (!account.avatarUrl.includes('imagekit.io')) {
        const key = keyFromUrl(account.avatarUrl)
        if (key) await deleteFromR2(key).catch(() => {})
      }
    }

    await db.update(accounts)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(accounts.id, accountId))

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('api/account/avatar', error)
    return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 })
  }
}
