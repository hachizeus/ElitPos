// Stripe payment integration
// Uses the Stripe REST API directly to avoid bundling the heavy stripe npm package.
// This keeps the edge-compatible path light. Stripe SDK can be added later if needed.

export { buildStripeConfig } from './config'
export type { StripeConfig } from './config'

const STRIPE_API = 'https://api.stripe.com/v1'

function stripeHeaders(secretKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

/** Encode an object as x-www-form-urlencoded (Stripe's required format). */
function encodeForm(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (value === null || value === undefined) continue
    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(encodeForm(value as Record<string, unknown>, fullKey))
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'object') {
          parts.push(encodeForm(v as Record<string, unknown>, `${fullKey}[${i}]`))
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(v))}`)
        }
      })
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.join('&')
}

export interface CreateCheckoutSessionOptions {
  secretKey: string
  currency: string
  amountCents: number       // amount in smallest currency unit
  description: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export interface StripeSession {
  id: string
  url: string
  payment_status: string
  status: string
}

/**
 * Create a Stripe Checkout Session (hosted payment page).
 */
export async function createCheckoutSession(
  opts: CreateCheckoutSessionOptions
): Promise<StripeSession> {
  const body: Record<string, unknown> = {
    'payment_method_types[0]': 'card',
    'line_items[0][price_data][currency]': opts.currency,
    'line_items[0][price_data][product_data][name]': opts.description,
    'line_items[0][price_data][unit_amount]': opts.amountCents,
    'line_items[0][quantity]': 1,
    mode: 'payment',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  }
  if (opts.customerEmail) body['customer_email'] = opts.customerEmail
  if (opts.metadata) {
    for (const [k, v] of Object.entries(opts.metadata)) {
      body[`metadata[${k}]`] = v
    }
  }

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: stripeHeaders(opts.secretKey),
    body: encodeForm(body),
  })
  const data = await res.json() as StripeSession & { error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message || 'Stripe checkout session creation failed')
  return data
}

/**
 * Retrieve a Stripe Checkout Session by ID.
 */
export async function retrieveCheckoutSession(
  secretKey: string,
  sessionId: string
): Promise<StripeSession> {
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json() as StripeSession & { error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message || 'Failed to retrieve Stripe session')
  return data
}

/**
 * Verify a Stripe webhook signature.
 * Stripe uses HMAC-SHA256 with the raw request body.
 */
export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    // Stripe-Signature header: t=timestamp,v1=sig1[,v1=sig2...]
    const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [key, val] = part.split('=')
      acc[key] = val
      return acc
    }, {})

    const timestamp = parts['t']
    const v1sig = parts['v1']
    if (!timestamp || !v1sig) return false

    // Replay attack: reject if > 5 minutes old
    const ts = parseInt(timestamp, 10)
    if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

    const signedPayload = `${timestamp}.${payload}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return computed === v1sig
  } catch {
    return false
  }
}

/**
 * Convert Stripe payment_status to internal gateway status.
 */
export function stripeStatusToInternal(
  status: string,
  paymentStatus: string
): 'success' | 'failed' | 'cancelled' | 'pending' {
  if (paymentStatus === 'paid') return 'success'
  if (status === 'expired') return 'expired' as 'failed'
  return 'pending'
}
