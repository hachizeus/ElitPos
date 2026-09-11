import { db } from '@/lib/db'
import { accountNotifications, accounts, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from './email'
import { sendSMS } from './sms'

export interface NotificationOptions {
  accountId: string
  type: string
  title: string
  message: string
  link?: string
  metadata?: Record<string, unknown>
  
  // Channel control
  sendInApp?: boolean
  sendEmail?: boolean
  sendSMS?: boolean
}

export interface NotificationResult {
  success: boolean
  notificationId?: string
  channels: {
    inApp: { sent: boolean; error?: string }
    email: { sent: boolean; error?: string }
    sms: { sent: boolean; error?: string }
  }
}

/**
 * Send a notification through multiple channels (in-app, email, SMS).
 * 
 * @param options - Notification details and channel preferences
 * @returns Result with delivery status for each channel
 */
export async function sendNotification(options: NotificationOptions): Promise<NotificationResult> {
  const {
    accountId,
    type,
    title,
    message,
    link,
    metadata = {},
    sendInApp = true,
    sendEmail: shouldSendEmail = true,
    sendSMS: shouldSendSMS = true,
  } = options

  const result: NotificationResult = {
    success: false,
    channels: {
      inApp: { sent: false },
      email: { sent: false },
      sms: { sent: false },
    },
  }

  try {
    // 1. Get account details (email, phone, notification preferences)
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: {
        email: true,
        phone: true,
        fullName: true,
        notifyEmail: true,
        notifySms: true,
      },
    })

    if (!account) {
      throw new Error(`Account ${accountId} not found`)
    }

    // Respect user preferences - override send flags if user has disabled the channel
    const finalSendEmail = shouldSendEmail && account.notifyEmail
    const finalSendSMS = shouldSendSMS && account.notifySms

    // 2. Create in-app notification record
    if (sendInApp) {
      try {
        const [notif] = await db
          .insert(accountNotifications)
          .values({
            accountId,
            type,
            title,
            message,
            link: link || null,
            metadata,
            emailSent: false,
            smsSent: false,
          })
          .returning({ id: accountNotifications.id })

        result.notificationId = notif.id
        result.channels.inApp.sent = true
        result.success = true
      } catch (error) {
        result.channels.inApp.error = error instanceof Error ? error.message : 'Failed to create in-app notification'
      }
    }

    // 3. Send email
    if (finalSendEmail && account.email && result.notificationId) {
      try {
        await sendEmail({
          to: account.email,
          subject: title,
          body: message,
          recipientName: account.fullName || account.email,
          link,
        })

        await db
          .update(accountNotifications)
          .set({
            emailSent: true,
            emailSentAt: new Date(),
          })
          .where(eq(accountNotifications.id, result.notificationId))

        result.channels.email.sent = true
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Email failed'
        result.channels.email.error = errorMsg

        if (result.notificationId) {
          await db
            .update(accountNotifications)
            .set({ emailError: errorMsg })
            .where(eq(accountNotifications.id, result.notificationId))
        }
      }
    }

    // 4. Send SMS
    if (finalSendSMS && account.phone && result.notificationId) {
      try {
        await sendSMS({
          to: account.phone,
          message: `${title}: ${message}`,
        })

        await db
          .update(accountNotifications)
          .set({
            smsSent: true,
            smsSentAt: new Date(),
          })
          .where(eq(accountNotifications.id, result.notificationId))

        result.channels.sms.sent = true
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'SMS failed'
        result.channels.sms.error = errorMsg

        if (result.notificationId) {
          await db
            .update(accountNotifications)
            .set({ smsError: errorMsg })
            .where(eq(accountNotifications.id, result.notificationId))
        }
      }
    }

    return result
  } catch (error) {
    console.error('[sendNotification] Error:', error)
    return {
      success: false,
      channels: {
        inApp: { sent: false, error: error instanceof Error ? error.message : 'Unknown error' },
        email: { sent: false },
        sms: { sent: false },
      },
    }
  }
}

/**
 * Send notification to multiple accounts in parallel.
 */
export async function sendBulkNotification(
  accountIds: string[],
  notification: Omit<NotificationOptions, 'accountId'>
): Promise<{ sent: number; failed: number; results: NotificationResult[] }> {
  const results = await Promise.all(
    accountIds.map(accountId =>
      sendNotification({ ...notification, accountId })
    )
  )

  const sent = results.filter(r => r.success).length
  const failed = results.length - sent

  return { sent, failed, results }
}
