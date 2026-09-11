import { NextRequest, NextResponse } from 'next/server'
import { accountAuth as auth } from '@/lib/auth/account-auth'
import { db } from '@/lib/db'
import { staffInvites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'
import { validateParams } from '@/lib/validation/helpers'
import { idParamSchema } from '@/lib/validation/schemas/common'

// DELETE /api/account/invites/[id] — cancel/revoke a pending invite (account-level)
//
// Only the account that sent the invite can cancel it.
// If the invite covers multiple tenants, the entire invite is deleted.
// (Partial-tenant removal is only supported at the tenant/POS level.)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsParsed = validateParams(await params, idParamSchema)
    if (!paramsParsed.success) return paramsParsed.response
    const { id } = paramsParsed.data

    // Fetch the invite — verify it belongs to this account
    const invite = await db.query.staffInvites.findFirst({
      where: eq(staffInvites.id, id),
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Only the inviting account can cancel
    if (invite.invitedBy !== session.user.accountId) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: 'Cannot cancel an invite that has already been accepted' },
        { status: 400 }
      )
    }

    // Hard-delete the invite record
    await db.delete(staffInvites).where(eq(staffInvites.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('api/account/invites/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
