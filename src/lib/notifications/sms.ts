import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface SMSOptions {
  to: string // Phone number in international format (e.g., +254712345678)
  message: string
}

interface SMSCredentials {
  provider: 'africas_talking' | 'twilio'
  apiKey: string
  username?: string // Africa's Talking username
  senderId?: string // Sender ID/shortcode
  accountSid?: string // Twilio Account SID
  authToken?: string // Twilio Auth Token
}

/**
 * Send SMS notification via configured provider (Africa's Talking or Twilio).
 * 
 * @throws Error if SMS credentials not configured or sending fails
 */
export async function sendSMS(options: SMSOptions): Promise<void> {
  const { to, message } = options

  // Get SMS credentials from system settings
  const credSetting = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'sms_credentials'),
  })

  if (!credSetting?.value) {
    throw new Error('SMS credentials not configured')
  }

  const credentials = credSetting.value as SMSCredentials

  if (credentials.provider === 'africas_talking') {
    await sendViaAfricasTalking(to, message, credentials)
  } else if (credentials.provider === 'twilio') {
    await sendViaTwilio(to, message, credentials)
  } else {
    throw new Error(`Unsupported SMS provider: ${credentials.provider}`)
  }
}

/**
 * Send SMS via Africa's Talking API.
 */
async function sendViaAfricasTalking(
  to: string,
  message: string,
  credentials: SMSCredentials
): Promise<void> {
  if (!credentials.apiKey || !credentials.username) {
    throw new Error('Africa\'s Talking credentials incomplete (apiKey and username required)')
  }

  // Ensure phone number is in international format (remove spaces, add + if missing)
  let formattedPhone = to.replace(/\s/g, '')
  if (!formattedPhone.startsWith('+')) {
    // If it starts with 0, assume Kenya and convert to +254
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+254' + formattedPhone.substring(1)
    } else if (formattedPhone.startsWith('254')) {
      formattedPhone = '+' + formattedPhone
    } else {
      // Already in correct format or needs manual intervention
      formattedPhone = '+' + formattedPhone
    }
  }

  console.log('[SMS] Sending via Africa\'s Talking to:', formattedPhone)

  const params = new URLSearchParams({
    username: credentials.username,
    to: formattedPhone,
    message,
    ...(credentials.senderId && { from: credentials.senderId }),
  })

  try {
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': credentials.apiKey,
        'Accept': 'application/json',
      },
      body: params.toString(),
    })

    const result = await response.json()
    console.log('[SMS] Africa\'s Talking response:', JSON.stringify(result))

    if (!response.ok) {
      throw new Error(`Africa's Talking API error: ${JSON.stringify(result)}`)
    }

    // Check if message was accepted
    if (result.SMSMessageData?.Recipients?.length > 0) {
      const recipient = result.SMSMessageData.Recipients[0]
      // Status code 101 = "Sent" in Africa's Talking
      if (recipient.statusCode !== 101 && recipient.statusCode !== 102) {
        throw new Error(`SMS rejected: ${recipient.status} (code: ${recipient.statusCode})`)
      }
      console.log('[SMS] Successfully sent to', formattedPhone, '- Status:', recipient.status)
    } else {
      throw new Error('No recipients in response')
    }
  } catch (error) {
    console.error('[sendViaAfricasTalking] Failed:', error)
    throw new Error('Failed to send SMS via Africa\'s Talking: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Send SMS via Twilio API.
 */
async function sendViaTwilio(
  to: string,
  message: string,
  credentials: SMSCredentials
): Promise<void> {
  if (!credentials.accountSid || !credentials.authToken || !credentials.senderId) {
    throw new Error('Twilio credentials incomplete (accountSid, authToken, and senderId required)')
  }

  const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64')

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        body: new URLSearchParams({
          To: to,
          From: credentials.senderId,
          Body: message,
        }).toString(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Twilio API error: ${error.message || response.statusText}`)
    }
  } catch (error) {
    console.error('[sendViaTwilio] Failed:', error)
    throw new Error('Failed to send SMS via Twilio')
  }
}

/**
 * Test SMS credentials by sending a test message.
 */
export async function testSMSCredentials(testPhone: string): Promise<{ success: boolean; error?: string }> {
  try {
    await sendSMS({
      to: testPhone,
      message: 'Test message from ElitPOS. Your SMS notifications are configured correctly.',
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
