// Paystack payment integration

export { buildPaystackConfig } from './config'
export type { PaystackConfig } from './config'

const PAYSTACK_API = 'https://api.paystack.co'

function paystackHeaders(secretKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  }
}

export interface InitializeTransactionOptions {
  secretKey: string
  email: string
  amountKobo: number        // amount in smallest unit (kobo for NGN, pesewas for GHS, cents for KES/ZAR)
  currency: string
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}

export interface PaystackInitResponse {
  status: boolean
  message: string
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

/**
 * Initialize a Paystack transaction and get the hosted payment URL.
 */
export async function initializeTransaction(
  opts: InitializeTransactionOptions
): Promise<PaystackInitResponse['data']> {
  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: 'POST',
    headers: paystackHeaders(opts.secretKey),
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      currency: opts.currency,
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  })
  const data = await res.json() as PaystackInitResponse
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Paystack initialization failed')
  }
  return data.data
}

export interface PaystackVerifyResponse {
  status: boolean
  message: string
  data: {
    status: string        // 'success' | 'failed' | 'abandoned' | 'pending'
    reference: string
    amount: number
    currency: string
    paid_at: string | null
    channel: string
    authorization: {
      last4: string
      card_type: string
      bank: string
    }
    customer: {
      email: string
    }
  }
}

/**
 * Verify a Paystack transaction by reference.
 */
export async function verifyTransaction(
  secretKey: string,
  reference: string
): Promise<PaystackVerifyResponse['data']> {
  const res = await fetch(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: paystackHeaders(secretKey) }
  )
  const data = await res.json() as PaystackVerifyResponse
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Paystack verification failed')
  }
  return data.data
}

/**
 * Verify a Paystack webhook HMAC-SHA512 signature.
 */
export async function verifyPaystackWebhook(
  payload: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secretKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return computed === signature
  } catch {
    return false
  }
}

/**
 * Map Paystack transaction status to our internal status.
 */
export function paystackStatusToInternal(
  status: string
): 'success' | 'failed' | 'cancelled' | 'pending' {
  switch (status) {
    case 'success': return 'success'
    case 'failed':  return 'failed'
    case 'abandoned': return 'cancelled'
    default: return 'pending'
  }
}

/**
 * Generate a unique reference for Paystack transactions.
 */
export function generatePaystackReference(prefix = 'ELITPOS'): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${prefix}-${ts}-${rand}`
}
