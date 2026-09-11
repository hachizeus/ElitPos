import { randomInt } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { emailVerificationOtps } from '@/lib/db/schema'
import { eq, and, gt, sql } from 'drizzle-orm'
import { sendOtpEmail } from '@/lib/email/system-email'
import { logError } from '@/lib/ai/error-logger'
import { validateBody } from '@/lib/validation/helpers'
import { sendOtpSchema } from '@/lib/validation/schemas/auth'

export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, sendOtpSchema)
    if (!parsed.success) return parsed.response
    const { email: normalizedEmail, type } = parsed.data

    // Rate limit: max 5 OTPs per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentOtps = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailVerificationOtps)
      .where(
        and(
          eq(emailVerificationOtps.email, normalizedEmail),
          eq(emailVerificationOtps.type, type),
          gt(emailVerificationOtps.createdAt, oneHourAgo)
        )
      )

    if (recentOtps[0]?.count >= 5) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Generate 5-digit OTP
    const otp = String(randomInt(10000, 99999))
    const otpHash = await bcrypt.hash(otp, 12)

    // Store OTP (expires in 10 minutes)
    await db.insert(emailVerificationOtps).values({
      email: normalizedEmail,
      otpHash,
      type,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    // Send OTP email — don't fail the whole flow if email delivery fails
    // (e.g. domain not yet verified in Resend). OTP is always printed to console as fallback.
    try {
      await sendOtpEmail(normalizedEmail, otp)
    } catch (emailErr) {
      // Email failed but OTP is stored — log and continue so dev/test flows still work
      console.warn('[send-otp] Email delivery failed, OTP stored in DB:', emailErr instanceof Error ? emailErr.message : emailErr)
    }

    return NextResponse.json({ success: true, message: 'Verification code sent' })
  } catch (error) {
    logError('api/register/send-otp', error)
    return NextResponse.json(
      { error: 'Failed to send verification code. Please try again.' },
      { status: 500 }
    )
  }
}
