// M-Pesa Daraja STK Push integration

import { getMpesaUrl, type MpesaConfig } from './config'

export { buildMpesaConfig } from './config'
export type { MpesaConfig, MpesaEnvironment } from './config'

// ── Token cache (in-process, per config key) ──────────────────────────────
interface CachedToken { token: string; expiresAt: number }
const tokenCache = new Map<string, CachedToken>()

/**
 * Fetch (and cache) an OAuth2 access token from Safaricom.
 * Tokens are valid for 1 hour; we refresh 60 s before expiry.
 */
export async function getMpesaToken(config: MpesaConfig): Promise<string> {
  const cacheKey = config.consumerKey
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
  const res = await fetch(getMpesaUrl(config.environment, 'auth'), {
    method: 'GET',
    headers: { Authorization: `Basic ${credentials}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`M-Pesa auth failed (${res.status}): ${text}`)
  }
  const data = await res.json() as { access_token: string; expires_in: string }
  const expiresIn = parseInt(data.expires_in, 10) || 3600
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  })
  return data.access_token
}

/**
 * Generate the M-Pesa STK Push password.
 * password = base64(shortcode + passkey + timestamp)
 */
export function generateStkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
}

/**
 * Format a phone number to the E.164 format Safaricom expects (254XXXXXXXXX).
 */
export function formatMpesaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('7') || digits.startsWith('1')) return `254${digits}`
  return digits
}

export interface StkPushRequest {
  phone: string           // customer phone (will be formatted)
  amount: number          // KES, must be integer
  accountReference: string // e.g. invoice number or order ID
  description: string
}

export interface StkPushResponse {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription: string
  CustomerMessage: string
}

/**
 * Initiate an M-Pesa STK Push (Lipa na M-Pesa Online).
 */
export async function initiateStkPush(
  config: MpesaConfig,
  req: StkPushRequest
): Promise<StkPushResponse> {
  const token = await getMpesaToken(config)

  const now = new Date()
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')

  const password = generateStkPassword(config.shortcode, config.passkey, timestamp)
  const formattedPhone = formatMpesaPhone(req.phone)
  const amount = Math.ceil(req.amount) // M-Pesa requires integer KES

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: formattedPhone,
    PartyB: config.shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: `${config.callbackBaseUrl}/api/mpesa/callback`,
    AccountReference: req.accountReference.slice(0, 12), // max 12 chars
    TransactionDesc: req.description.slice(0, 13),       // max 13 chars
  }

  const res = await fetch(getMpesaUrl(config.environment, 'stkpush'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json() as StkPushResponse & { errorCode?: string; errorMessage?: string }
  if (!res.ok || data.ResponseCode !== '0') {
    throw new Error(data.errorMessage || data.ResponseDescription || 'STK Push failed')
  }
  return data
}

export interface StkQueryResponse {
  ResponseCode: string
  ResponseDescription: string
  MerchantRequestID: string
  CheckoutRequestID: string
  ResultCode: string
  ResultDesc: string
}

/**
 * Query the status of an STK Push request.
 */
export async function queryStkStatus(
  config: MpesaConfig,
  checkoutRequestId: string
): Promise<StkQueryResponse> {
  const token = await getMpesaToken(config)

  const now = new Date()
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')

  const password = generateStkPassword(config.shortcode, config.passkey, timestamp)

  const res = await fetch(getMpesaUrl(config.environment, 'query'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  })

  return res.json() as Promise<StkQueryResponse>
}

/**
 * Map M-Pesa result code to our internal status.
 * ResultCode 0 = success; 1032 = cancelled by user; others = failed.
 */
export function mpesaResultToStatus(resultCode: string): 'success' | 'cancelled' | 'failed' {
  if (resultCode === '0') return 'success'
  if (resultCode === '1032') return 'cancelled'
  return 'failed'
}
