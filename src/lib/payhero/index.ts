// PayHero payment integration
// Docs: https://payhero.co.ke/developers

export { buildPayheroConfig, PAYHERO_API } from './config'
export type { PayheroConfig } from './config'

import { PAYHERO_API, type PayheroConfig } from './config'

function payheroHeaders(config: PayheroConfig): HeadersInit {
  const credentials = Buffer.from(`${config.apiUsername}:${config.apiPassword}`).toString('base64')
  return {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  }
}

export interface PayheroStkRequest {
  phone: string           // customer phone (format: 0712345678 or +254712345678)
  amount: number          // KES integer
  externalReference: string // your order/invoice reference
  callbackUrl: string
}

export interface PayheroStkResponse {
  success: boolean
  response_code: string   // '200' on success
  merchant_reference: string
  CheckoutRequestID?: string
  ResponseDescription?: string
  [key: string]: unknown
}

/**
 * Initiate a PayHero STK Push (M-Pesa channel via PayHero).
 */
export async function initiatePayheroPayment(
  config: PayheroConfig,
  req: PayheroStkRequest
): Promise<PayheroStkResponse> {
  // Normalise phone: PayHero expects format like 0712345678
  const phone = req.phone.replace(/^\+254/, '0').replace(/^254/, '0')

  const res = await fetch(`${PAYHERO_API}/payments`, {
    method: 'POST',
    headers: payheroHeaders(config),
    body: JSON.stringify({
      amount: Math.ceil(req.amount),
      phone_number: phone,
      channel_id: config.channelId,
      provider: 'm-pesa',
      external_reference: req.externalReference,
      callback_url: req.callbackUrl,
    }),
  })

  const data = await res.json() as PayheroStkResponse
  if (!res.ok || !data.success) {
    throw new Error(
      (data.ResponseDescription as string) ||
      `PayHero payment initiation failed (${res.status})`
    )
  }
  return data
}

export interface PayheroStatusResponse {
  success: boolean
  status: string      // 'SUCCESS' | 'FAILED' | 'PENDING'
  amount?: number
  phone_number?: string
  external_reference?: string
  [key: string]: unknown
}

/**
 * Query PayHero payment status by merchant reference (CheckoutRequestID).
 */
export async function queryPayheroStatus(
  config: PayheroConfig,
  merchantReference: string
): Promise<PayheroStatusResponse> {
  const res = await fetch(
    `${PAYHERO_API}/transaction-status?reference=${encodeURIComponent(merchantReference)}`,
    { headers: payheroHeaders(config) }
  )
  return res.json() as Promise<PayheroStatusResponse>
}

/**
 * Map PayHero status string to internal gateway status.
 */
export function payheroStatusToInternal(
  status: string
): 'success' | 'failed' | 'cancelled' | 'pending' {
  const s = status.toUpperCase()
  if (s === 'SUCCESS' || s === 'COMPLETE' || s === 'COMPLETED') return 'success'
  if (s === 'FAILED' || s === 'FAIL') return 'failed'
  if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled'
  return 'pending'
}

/**
 * Generate a unique reference for PayHero transactions.
 */
export function generatePayheroReference(prefix = 'ELITPOS'): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${prefix}-${ts}-${rand}`
}
