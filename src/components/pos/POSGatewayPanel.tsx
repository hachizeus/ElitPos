'use client'

/**
 * POSGatewayPanel
 *
 * Renders an inline payment sub-panel inside the POS payment modal when the
 * cashier selects a digital gateway (M-Pesa, Paystack, PayHero) or Stripe card.
 *
 * Each gateway follows the same two-step UX:
 *   1. Cashier enters customer's phone / email → hits "Send Request"
 *   2. A polling loop shows live status until confirmed or failed
 *
 * For Stripe the customer is redirected to a hosted Checkout page instead.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle, RefreshCw, Smartphone, CreditCard, Zap, Globe, ExternalLink } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'

// ── Types ──────────────────────────────────────────────────────────────────

export type GatewayType = 'mpesa' | 'stripe' | 'paystack' | 'payhero'

export interface POSGatewayPanelProps {
  gateway: GatewayType
  amount: number            // exact amount to charge
  saleId?: string           // set after sale record has been pre-created (optional)
  customerPhone?: string    // pre-fill from selected customer
  customerEmail?: string    // pre-fill from selected customer
  onSuccess: (ref: string) => void   // called when gateway confirms payment
  onCancel: () => void
  disabled?: boolean
}

// ── Status types ───────────────────────────────────────────────────────────

type PanelStatus = 'idle' | 'sending' | 'polling' | 'success' | 'failed' | 'cancelled'

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 40  // 2 minutes total

// ── Gateway meta (icon, colours, labels) ──────────────────────────────────

const GATEWAY_META: Record<GatewayType, {
  label: string
  Icon: React.ElementType
  colour: string
  phonePlaceholder?: string
  emailPlaceholder?: string
  usePhone: boolean
  useEmail: boolean
}> = {
  mpesa: {
    label: 'M-Pesa',
    Icon: Smartphone,
    colour: '#4caf50',
    phonePlaceholder: '07XX XXX XXX',
    usePhone: true,
    useEmail: false,
  },
  paystack: {
    label: 'Paystack',
    Icon: Zap,
    colour: '#0a9b79',
    emailPlaceholder: 'customer@email.com',
    usePhone: false,
    useEmail: true,
  },
  payhero: {
    label: 'PayHero',
    Icon: Globe,
    colour: '#f57c00',
    phonePlaceholder: '07XX XXX XXX',
    usePhone: true,
    useEmail: false,
  },
  stripe: {
    label: 'Stripe Card',
    Icon: CreditCard,
    colour: '#6772e5',
    emailPlaceholder: 'customer@email.com (optional)',
    usePhone: false,
    useEmail: true,
  },
}

// ── Helper ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Main component ─────────────────────────────────────────────────────────

export function POSGatewayPanel({
  gateway,
  amount,
  saleId,
  customerPhone = '',
  customerEmail = '',
  onSuccess,
  onCancel,
  disabled = false,
}: POSGatewayPanelProps) {
  const { currency: currencyCode } = useCurrency()
  const meta = GATEWAY_META[gateway]

  const [phone, setPhone] = useState(customerPhone)
  const [email, setEmail] = useState(customerEmail)
  const [status, setStatus] = useState<PanelStatus>('idle')
  const [message, setMessage] = useState('')
  const [internalRef, setInternalRef] = useState('')
  const [checkoutRequestId, setCheckoutRequestId] = useState('')  // M-Pesa / PayHero
  const [stripeUrl, setStripeUrl] = useState('')                  // Stripe redirect URL
  const [pollAttempts, setPollAttempts] = useState(0)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  // ── Polling ─────────────────────────────────────────────────────────────

  const pollMpesaStatus = useCallback(async (ref: string, attempt: number) => {
    if (!mountedRef.current) return
    if (attempt >= POLL_MAX_ATTEMPTS) {
      setStatus('failed')
      setMessage('Payment timed out. Ask the customer to check their phone and try again.')
      return
    }

    try {
      const res = await fetch(`/api/mpesa/status?checkoutRequestId=${encodeURIComponent(ref)}`)
      const data = await res.json() as { status: string }

      if (!mountedRef.current) return

      if (data.status === 'success') {
        setStatus('success')
        setMessage('Payment confirmed!')
        onSuccess(internalRef || ref)
        return
      }
      if (data.status === 'failed') {
        setStatus('failed')
        setMessage('Payment declined. The customer may have entered the wrong PIN.')
        return
      }
      if (data.status === 'cancelled') {
        setStatus('cancelled')
        setMessage('Payment was cancelled by the customer.')
        return
      }
    } catch {
      // Network error — keep polling
    }

    setPollAttempts(attempt + 1)
    pollRef.current = setTimeout(() => pollMpesaStatus(ref, attempt + 1), POLL_INTERVAL_MS)
  }, [internalRef, onSuccess])

  const pollPayheroStatus = useCallback(async (ref: string, attempt: number) => {
    if (!mountedRef.current) return
    if (attempt >= POLL_MAX_ATTEMPTS) {
      setStatus('failed')
      setMessage('Payment timed out.')
      return
    }

    try {
      // Poll the gateway_transactions table via a lightweight status endpoint.
      // We query by internalReference which is stored in both our table and sent as external_reference.
      const res = await fetch(`/api/payhero/status?ref=${encodeURIComponent(ref)}`)
      const data = await res.json() as { status: string }

      if (!mountedRef.current) return

      if (data.status === 'success') {
        setStatus('success')
        setMessage('Payment confirmed!')
        onSuccess(ref)
        return
      }
      if (data.status === 'failed' || data.status === 'cancelled') {
        setStatus(data.status as PanelStatus)
        setMessage(data.status === 'cancelled' ? 'Payment was cancelled.' : 'Payment failed.')
        return
      }
    } catch { /* keep polling */ }

    setPollAttempts(attempt + 1)
    pollRef.current = setTimeout(() => pollPayheroStatus(ref, attempt + 1), POLL_INTERVAL_MS)
  }, [onSuccess])

  // ── Initiators ───────────────────────────────────────────────────────────

  async function handleSend() {
    if (disabled) return
    setStatus('sending')
    setMessage('')

    try {
      if (gateway === 'mpesa') {
        const res = await fetch('/api/mpesa/stkpush', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            amount,
            context: 'pos_sale',
            saleId: saleId || undefined,
          }),
        })
        const data = await res.json() as {
          success?: boolean
          checkoutRequestId?: string
          internalReference?: string
          error?: string
        }

        if (!res.ok || !data.success) {
          setStatus('failed')
          setMessage(data.error || 'Failed to send STK Push')
          return
        }

        setInternalRef(data.internalReference || '')
        setCheckoutRequestId(data.checkoutRequestId || '')
        setStatus('polling')
        setMessage('STK Push sent. Waiting for customer to enter PIN…')
        setPollAttempts(0)
        pollMpesaStatus(data.checkoutRequestId || '', 0)

      } else if (gateway === 'stripe') {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            description: 'POS Sale',
            context: 'pos_sale',
            saleId: saleId || undefined,
            customerEmail: email || undefined,
          }),
        })
        const data = await res.json() as {
          checkoutUrl?: string
          internalReference?: string
          error?: string
        }

        if (!res.ok || !data.checkoutUrl) {
          setStatus('failed')
          setMessage(data.error || 'Failed to create Stripe checkout session')
          return
        }

        setInternalRef(data.internalReference || '')
        setStripeUrl(data.checkoutUrl)
        setStatus('polling')
        setMessage('Stripe checkout ready — open the link for the customer.')

      } else if (gateway === 'paystack') {
        if (!email) {
          setStatus('idle')
          setMessage('A customer email is required for Paystack.')
          return
        }
        const res = await fetch('/api/paystack/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            email,
            context: 'pos_sale',
            saleId: saleId || undefined,
          }),
        })
        const data = await res.json() as {
          authorizationUrl?: string
          reference?: string
          error?: string
        }

        if (!res.ok || !data.authorizationUrl) {
          setStatus('failed')
          setMessage(data.error || 'Failed to initialize Paystack')
          return
        }

        setInternalRef(data.reference || '')
        setStripeUrl(data.authorizationUrl)  // reuse stripeUrl slot for any redirect URL
        setStatus('polling')
        setMessage('Paystack checkout ready — open the link for the customer.')

      } else if (gateway === 'payhero') {
        const res = await fetch('/api/payhero/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            amount,
            context: 'pos_sale',
            saleId: saleId || undefined,
          }),
        })
        const data = await res.json() as {
          success?: boolean
          internalReference?: string
          merchantReference?: string
          error?: string
        }

        if (!res.ok || !data.success) {
          setStatus('failed')
          setMessage(data.error || 'Failed to initiate PayHero payment')
          return
        }

        const ref = data.internalReference || data.merchantReference || ''
        setInternalRef(ref)
        setCheckoutRequestId(ref)
        setStatus('polling')
        setMessage('PayHero request sent. Waiting for customer to confirm…')
        setPollAttempts(0)
        // PayHero polls via the same gateway_transactions table
        pollPayheroStatus(ref, 0)
      }
    } catch (err) {
      setStatus('failed')
      setMessage('Network error. Please try again.')
    }
  }

  function handleRetry() {
    if (pollRef.current) clearTimeout(pollRef.current)
    setStatus('idle')
    setMessage('')
    setInternalRef('')
    setCheckoutRequestId('')
    setStripeUrl('')
    setPollAttempts(0)
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const { Icon } = meta
  const isHostedGateway = gateway === 'stripe' || gateway === 'paystack'

  return (
    <div className="mt-3 rounded-2xl border-2 border-gray-200 overflow-hidden">
      {/* Gateway header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `${meta.colour}18`, borderBottom: '1px solid #e5e7eb' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: meta.colour }}
        >
          <Icon size={16} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-800">{meta.label} Payment</span>
        <span className="ml-auto text-sm font-bold text-gray-700">
          {currencyCode} {amount.toFixed(2)}
        </span>
      </div>

      <div className="p-4 space-y-3 bg-white">
        {/* Idle / Input state */}
        {status === 'idle' && (
          <>
            {meta.usePhone && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Customer Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={meta.phonePlaceholder}
                  className="w-full h-9 px-3 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
            {meta.useEmail && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Customer Email {gateway === 'stripe' && <span className="text-gray-400">(optional)</span>}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={meta.emailPlaceholder}
                  className="w-full h-9 px-3 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
            {message && (
              <p className="text-xs text-red-500">{message}</p>
            )}
            <button
              onClick={handleSend}
              disabled={disabled || (meta.usePhone && !phone.trim()) || (meta.useEmail && gateway === 'paystack' && !email.trim())}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              style={{ background: meta.colour }}
            >
              {gateway === 'stripe' ? 'Generate Checkout Link' :
               gateway === 'paystack' ? 'Generate Payment Link' :
               'Send Payment Request'}
            </button>
          </>
        )}

        {/* Sending */}
        {status === 'sending' && (
          <div className="flex items-center justify-center gap-3 py-4 text-gray-600">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Sending request…</span>
          </div>
        )}

        {/* Polling — M-Pesa / PayHero wait for customer */}
        {status === 'polling' && !isHostedGateway && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-2">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-green-500 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{message}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Attempt {pollAttempts + 1} / {POLL_MAX_ATTEMPTS}
                </p>
              </div>
            </div>
            <button
              onClick={() => { if (pollRef.current) clearTimeout(pollRef.current); setStatus('cancelled'); setMessage('Cancelled.') }}
              className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Polling — Stripe / Paystack: show clickable link */}
        {status === 'polling' && isHostedGateway && stripeUrl && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{message}</p>
            <a
              href={stripeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: meta.colour }}
            >
              <ExternalLink size={15} />
              Open {meta.label} Checkout
            </a>
            <p className="text-xs text-gray-400 text-center">
              Complete the payment in the opened tab, then click below.
            </p>
            <button
              onClick={async () => {
                // Re-check payment status for Paystack
                if (gateway === 'paystack' && internalRef) {
                  setStatus('sending')
                  const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(internalRef)}`)
                  const data = await res.json() as { status: string }
                  if (data.status === 'success') {
                    setStatus('success')
                    setMessage('Payment confirmed!')
                    onSuccess(internalRef)
                  } else {
                    setStatus('polling')
                    setMessage('Payment not yet confirmed. Try again in a moment.')
                  }
                } else {
                  // Stripe success/cancel is handled via redirect; just notify
                  onSuccess(internalRef)
                }
              }}
              className="w-full py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              I&apos;ve completed the payment
            </button>
            <button
              onClick={onCancel}
              className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle2 size={36} className="text-green-500" />
            <p className="text-sm font-semibold text-green-700">{message}</p>
          </div>
        )}

        {/* Failed / Cancelled */}
        {(status === 'failed' || status === 'cancelled') && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-2">
              <XCircle size={24} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{message}</p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
