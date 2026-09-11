'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRealtimeData } from '@/hooks'
import {
  Wallet, ArrowUpRight, ArrowDownRight, Clock, Loader2,
  Zap, Banknote, CreditCard, AlertCircle,
  Sparkles, CheckCircle2, XCircle, RefreshCw, X, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrencyWithSymbol } from '@/lib/utils/currency'

// ── Types ──────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  createdAt: string
  balanceAfter: number
}

interface GatewayOption {
  id: 'mpesa' | 'stripe' | 'paystack' | 'payhero'
  type: 'mobile' | 'card'
  enabled: boolean
  currency?: string
}

// 'redirect'  = payment link created, waiting for user to open it and pay
// 'verifying' = user clicked "I've paid", checking with Paystack
type PayStep = 'input' | 'waiting' | 'redirect' | 'verifying' | 'success' | 'failed'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000]

export default function WalletPage() {
  const [balance, setBalance]           = useState(0)
  const [currency, setCurrency]         = useState('KES')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(true)

  // Payment modal state
  const [showModal, setShowModal]   = useState(false)
  const [amount, setAmount]         = useState('')
  const [phone, setPhone]           = useState('')
  const [email, setEmail]           = useState('')  // kept for Stripe
  const [step, setStep]             = useState<PayStep>('input')
  const [statusMsg, setStatusMsg]   = useState('')
  const [internalRef, setInternalRef] = useState('')
  const [authUrl, setAuthUrl]       = useState('')   // Paystack / Stripe hosted URL
  const [pollCount, setPollCount]   = useState(0)
  const [gateways, setGateways]     = useState<GatewayOption[]>([])
  const [gwLoading, setGwLoading]   = useState(false)
  const [activeGw, setActiveGw]     = useState<GatewayOption | null>(null)

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted   = useRef(true)
  const searchParams = useSearchParams()

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  // ── Handle return from Paystack redirect ─────────────────────────────
  // /api/paystack/callback redirects here with ?paystack_ref=...&paystack_status=...
  useEffect(() => {
    const ref    = searchParams.get('paystack_ref')
    const status = searchParams.get('paystack_status')
    if (!ref) return

    // Clean params from URL without a full reload
    const clean = new URL(window.location.href)
    clean.searchParams.delete('paystack_ref')
    clean.searchParams.delete('paystack_status')
    window.history.replaceState({}, '', clean.toString())

    if (status === 'success') {
      setStep('success')
      setStatusMsg('Payment confirmed! Your wallet has been credited.')
      setShowModal(true)
      fetchWallet()
    } else {
      setStep('failed')
      setStatusMsg('Payment was not completed. Please try again.')
      setShowModal(true)
    }
  // fetchWallet is stable (useCallback with no deps) so it's safe to omit here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Data fetch ────────────────────────────────────────────────────────

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/account/wallet')
      if (res.ok) {
        const data = await res.json()
        setBalance(data.balance || 0)
        setCurrency(data.currency || 'KES')
        setTransactions(data.transactions || [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const fetchGateways = useCallback(async () => {
    try {
      const res = await fetch('/api/account/gateway-config')
      if (res.ok) {
        const data = await res.json() as Record<string, { enabled: boolean; publishableKey?: string; currency?: string }>
        const opts: GatewayOption[] = []
        if (data.mpesa?.enabled)    opts.push({ id: 'mpesa',    type: 'mobile', enabled: true })
        if (data.payhero?.enabled)  opts.push({ id: 'payhero',  type: 'mobile', enabled: true })
        if (data.paystack?.enabled) opts.push({ id: 'paystack', type: 'card',   enabled: true, currency: data.paystack?.currency })
        if (data.stripe?.enabled)   opts.push({ id: 'stripe',   type: 'card',   enabled: true, currency: data.stripe?.currency })
        setGateways(opts)
        setActiveGw(opts[0] || null)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchGateways() }, [fetchGateways])
  useRealtimeData(fetchWallet, { entityType: 'account-wallet' })

  // ── Modal open / close ───────────────────────────────────────────────

  const openModal = async () => {
    setAmount('')
    setPhone('')
    setEmail('')
    setStep('input')
    setStatusMsg('')
    setInternalRef('')
    setAuthUrl('')
    setPollCount(0)
    setShowModal(true)

    if (gateways.length === 0) {
      setGwLoading(true)
      try {
        const res = await fetch('/api/account/gateway-config')
        if (res.ok) {
          const data = await res.json() as Record<string, { enabled: boolean; publishableKey?: string; currency?: string }>
          const opts: GatewayOption[] = []
          if (data.mpesa?.enabled)    opts.push({ id: 'mpesa',    type: 'mobile', enabled: true })
          if (data.payhero?.enabled)  opts.push({ id: 'payhero',  type: 'mobile', enabled: true })
          if (data.paystack?.enabled) opts.push({ id: 'paystack', type: 'card',   enabled: true, currency: data.paystack?.currency })
          if (data.stripe?.enabled)   opts.push({ id: 'stripe',   type: 'card',   enabled: true, currency: data.stripe?.currency })
          setGateways(opts)
          setActiveGw(opts[0] || null)
        }
      } catch { /* silent */ }
      finally { setGwLoading(false) }
    }
  }

  const closeModal = () => {
    if (step === 'waiting' || step === 'verifying') return
    if (pollTimer.current) clearTimeout(pollTimer.current)
    setShowModal(false)
    setStep('input')
    setAuthUrl('')
    setStatusMsg('')
  }

  // ── Trigger payment ──────────────────────────────────────────────────

  const handlePay = async () => {
    const gw = activeGw || gateways[0] || null
    if (!gw) { setStatusMsg('No payment method available'); return }
    if (gw !== activeGw) setActiveGw(gw)

    const n = Number(amount)
    if (!n || n < 1) { setStatusMsg('Please enter an amount'); return }
    if (gw.type === 'mobile' && !phone.trim()) { setStatusMsg('Please enter your mobile number'); return }

    setStatusMsg('')
    setStep('waiting')

    try {
      // ── Paystack: server-initialize → show link to hosted checkout ───
      if (gw.id === 'paystack') {
        const initRes = await fetch('/api/paystack/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: n, context: 'subscription' }),
        })
        const initData = await initRes.json() as {
          authorizationUrl?: string
          reference?: string
          error?: string
        }

        if (!initRes.ok || !initData.authorizationUrl) {
          setStep('failed')
          setStatusMsg(initData.error || 'Could not create payment link. Please try again.')
          return
        }

        setInternalRef(initData.reference || '')
        setAuthUrl(initData.authorizationUrl)
        setStep('redirect')
        return
      }

      // ── Stripe: server-initialize → show link to hosted checkout ─────
      if (gw.id === 'stripe') {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: n, description: 'Wallet top-up', context: 'subscription', customerEmail: email || undefined }),
        })
        const data = await res.json() as { checkoutUrl?: string; internalReference?: string; error?: string }
        if (!res.ok || !data.checkoutUrl) {
          setStep('failed')
          setStatusMsg(data.error || 'Could not create checkout')
          return
        }
        setInternalRef(data.internalReference || '')
        setAuthUrl(data.checkoutUrl)
        setStep('redirect')
        return
      }

      // ── M-Pesa / PayHero: STK push ────────────────────────────────────
      const endpoint = gw.id === 'mpesa' ? '/api/mpesa/stkpush' : '/api/payhero/checkout'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: n, context: 'subscription' }),
      })
      const data = await res.json() as { success?: boolean; internalReference?: string; checkoutRequestId?: string; error?: string }

      if (!res.ok || !data.success) {
        setStep('failed')
        setStatusMsg(data.error || 'Could not send payment request')
        return
      }

      const ref = data.internalReference || ''
      const pollRef = data.checkoutRequestId || ref
      setInternalRef(ref)
      setPollCount(0)

      const pollEndpoint = gw.id === 'mpesa'
        ? `/api/mpesa/status?checkoutRequestId=${encodeURIComponent(pollRef)}`
        : `/api/payhero/status?ref=${encodeURIComponent(ref)}`

      const poll = async (attempt: number) => {
        if (!mounted.current) return
        if (attempt >= 40) { setStep('failed'); setStatusMsg('Payment timed out. If you were charged, contact support.'); return }
        try {
          const pr = await fetch(pollEndpoint)
          const pd = await pr.json() as { status: string }
          if (!mounted.current) return
          if (pd.status === 'success')   { await handlePaymentSuccess(ref); return }
          if (pd.status === 'failed')    { setStep('failed'); setStatusMsg('Payment declined. Try again.'); return }
          if (pd.status === 'cancelled') { setStep('failed'); setStatusMsg('Payment was cancelled.'); return }
        } catch { /* keep polling */ }
        setPollCount(attempt + 1)
        pollTimer.current = setTimeout(() => poll(attempt + 1), 3000)
      }
      poll(0)

    } catch {
      setShowModal(true)
      setStep('failed')
      setStatusMsg('Something went wrong. Please try again.')
    }
  }

  // ── "I've paid" — verify Paystack / Stripe payment manually ─────────

  const handleVerifyManually = async () => {
    if (!internalRef) return
    setStep('verifying')
    setStatusMsg('')
    try {
      const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(internalRef)}`)
      const data = await res.json() as { status: string; error?: string }
      if (!mounted.current) return
      if (data.status === 'success') {
        await handlePaymentSuccess(internalRef)
      } else {
        setStep('redirect')
        setStatusMsg('Payment not confirmed yet — complete the payment page first, then click here again.')
      }
    } catch {
      if (mounted.current) {
        setStep('redirect')
        setStatusMsg('Could not verify. Please try again in a moment.')
      }
    }
  }

  // ── After gateway confirms — credit wallet ───────────────────────────

  const handlePaymentSuccess = async (ref: string) => {
    try {
      const res = await fetch('/api/account/gateway-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalReference: ref }),
      })
      const data = await res.json() as { success?: boolean; balance?: number; error?: string }
      if (!mounted.current) return

      if (data.success) {
        setBalance(data.balance || balance)
        setStep('success')
        setStatusMsg(`${formatCurrencyWithSymbol(Number(amount), currency)} added to your wallet!`)
      } else {
        // Webhook / callback may have already credited — refresh and show success
        setStep('success')
        setStatusMsg('Payment received! Your balance will update shortly.')
      }
      fetchWallet()
    } catch {
      if (mounted.current) {
        setStep('success')
        setStatusMsg('Payment received! Your balance will update shortly.')
        fetchWallet()
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  const hasMobile = gateways.some(g => g.type === 'mobile')
  const hasCard   = gateways.some(g => g.type === 'card')

  // ── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your credits and view transaction history</p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-[#071209] via-[#0d2e18] to-[#0a1f10] rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium mb-2">
              <Wallet className="w-4 h-4" />
              Available Balance
            </div>
            <p className="text-5xl font-bold tracking-tight">{formatCurrencyWithSymbol(balance, currency)}</p>
            <p className="text-gray-400 text-sm mt-3">Credits are used for subscriptions and services</p>
          </div>
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Sparkles className="w-8 h-8" />
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/10">
          <div>
            <div className="text-gray-400 text-sm">Total Transactions</div>
            <div className="text-xl font-semibold mt-1">{transactions.length}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Last Added</div>
            <div className="text-xl font-semibold mt-1">
              {transactions.find(t => t.type === 'credit')
                ? formatCurrencyWithSymbol(transactions.find(t => t.type === 'credit')!.amount, currency)
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Add Credits */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-md flex items-center justify-center">
            <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Credits</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Choose how you want to pay</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Bank Deposit */}
            <div className="group border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:border-gray-900 dark:hover:border-gray-400 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-green-500 transition-colors">
                  <Banknote className="w-7 h-7 text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Bank Transfer</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Transfer to our account and submit your receipt</p>
                  <Link href="/account/payments?type=wallet"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Banknote className="w-4 h-4" />
                    Submit Receipt
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Online Payment */}
            <div className="border-2 border-green-200 dark:border-green-800 rounded-2xl p-6 bg-green-50/40 dark:bg-green-900/10">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center shrink-0">
                  <CreditCard className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Pay Online</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {hasMobile && hasCard ? 'Mobile money or card — added instantly' :
                     hasMobile ? 'Pay with mobile money — added instantly' :
                     hasCard   ? 'Pay by card — added instantly' :
                     'Instant online payment'}
                  </p>
                  <button onClick={openModal}
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pay Now
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-100 dark:border-green-800">
            <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-300">
              Credits are used automatically when your subscription renews. If your balance is insufficient, you will be prompted to top up.
            </p>
          </div>
        </div>
      </div>

      {/* ══ Payment Modal ══════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => step !== 'waiting' && step !== 'verifying' && closeModal()} />

          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-green-600 to-green-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Add Credits</h3>
                <p className="text-green-100 text-sm mt-0.5">
                  {step === 'waiting'   ? 'Creating payment link…' :
                   step === 'redirect'  ? 'Complete your payment' :
                   step === 'verifying' ? 'Verifying payment…' :
                   step === 'success'   ? 'Payment confirmed!' :
                   step === 'failed'    ? 'Payment failed' :
                                          'Enter amount to continue'}
                </p>
              </div>
              {step !== 'waiting' && step !== 'verifying' && (
                <button onClick={closeModal} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">

              {/* ── INPUT ──────────────────────────────────────────────── */}
              {step === 'input' && (
                <>
                  {gwLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading…</span>
                    </div>
                  ) : gateways.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No online payment methods available.</p>
                      <p className="text-xs text-gray-400 mt-1">Please use Bank Transfer instead.</p>
                    </div>
                  ) : (
                    <>
                      {/* Amount input */}
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-gray-400 select-none">{currency}</span>
                        <input
                          type="number" min="1" step="1"
                          value={amount}
                          onChange={e => { setAmount(e.target.value); setStatusMsg('') }}
                          onKeyDown={e => e.key === 'Enter' && Number(amount) >= 1 && handlePay()}
                          placeholder="0"
                          autoFocus
                          className="w-full h-16 pl-16 pr-4 text-3xl font-bold rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-green-500 transition-colors"
                        />
                      </div>

                      {/* Quick amounts */}
                      <div className="flex gap-2">
                        {QUICK_AMOUNTS.map(q => (
                          <button key={q} onClick={() => { setAmount(String(q)); setStatusMsg('') }}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                              amount === String(q)
                                ? 'border-green-500 bg-green-600 text-white'
                                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-300 hover:text-green-600'
                            }`}
                          >
                            {q >= 1000 ? `${q/1000}k` : q}
                          </button>
                        ))}
                      </div>

                      {/* Mobile number — M-Pesa / PayHero only */}
                      {activeGw?.type === 'mobile' && (
                        <input type="tel" value={phone}
                          onChange={e => { setPhone(e.target.value); setStatusMsg('') }}
                          placeholder="Mobile number e.g. 0712 345 678"
                          className="w-full h-11 px-4 text-sm rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-green-500 transition-colors"
                        />
                      )}

                      {statusMsg && <p className="text-xs text-red-500 text-center">{statusMsg}</p>}

                      <button onClick={handlePay}
                        disabled={!amount || Number(amount) < 1 || (activeGw?.type === 'mobile' && !phone.trim())}
                        className={`w-full py-4 rounded-xl text-white font-bold text-base disabled:opacity-40 transition-all active:scale-[0.98] ${
                          activeGw?.type === 'mobile' ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {activeGw?.type === 'mobile'
                          ? `Send ${amount ? formatCurrencyWithSymbol(Number(amount), currency) : 'Request'}`
                          : `Pay ${amount ? formatCurrencyWithSymbol(Number(amount), currency) : ''}`}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* ── WAITING — creating payment link ──────────────────────── */}
              {step === 'waiting' && activeGw?.type === 'card' && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Creating payment link…</p>
                </div>
              )}

              {/* ── WAITING (M-Pesa / PayHero STK polling) ───────────────── */}
              {step === 'waiting' && activeGw?.type === 'mobile' && (
                <div className="flex items-center gap-4 py-4">
                  <div className="w-12 h-12 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Check your phone</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Enter your PIN to confirm the {formatCurrencyWithSymbol(Number(amount), currency)} payment</p>
                    <p className="text-xs text-gray-400 mt-0.5">Checking ({pollCount + 1}/40)…</p>
                  </div>
                </div>
              )}

              {/* ── REDIRECT — payment link ready ────────────────────────── */}
              {step === 'redirect' && authUrl && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                      {formatCurrencyWithSymbol(Number(amount), currency)} — payment ready
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click &quot;Open Payment Page&quot; to pay securely. After paying, come back and click &quot;I&apos;ve paid&quot;.
                    </p>
                  </div>

                  {statusMsg && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center">{statusMsg}</p>
                  )}

                  {/* Direct link — browser opens it natively, no popup blocker issues */}
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Payment Page
                  </a>

                  <button
                    onClick={handleVerifyManually}
                    className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    I&apos;ve paid — confirm payment
                  </button>

                  <button onClick={closeModal} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                    Cancel
                  </button>
                </div>
              )}

              {/* ── VERIFYING ────────────────────────────────────────────── */}
              {step === 'verifying' && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Verifying payment…</p>
                </div>
              )}

              {/* ── SUCCESS ──────────────────────────────────────────────── */}
              {step === 'success' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-green-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-900 dark:text-white">Payment Successful</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{statusMsg}</p>
                  </div>
                  <div className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">New Balance</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrencyWithSymbol(balance, currency)}</p>
                  </div>
                  <button onClick={closeModal}
                    className="w-full py-3 rounded-xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors"
                  >Done</button>
                </div>
              )}

              {/* ── FAILED ───────────────────────────────────────────────── */}
              {step === 'failed' && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{statusMsg}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={closeModal}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                    >Close</button>
                    <button onClick={() => { setStep('input'); setStatusMsg(''); setAuthUrl('') }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" /> Try Again
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-md flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-300 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No transactions yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add credits to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {transactions.map((tx) => (
              <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tx.type === 'credit' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {tx.type === 'credit'
                      ? <ArrowDownRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                      : <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{tx.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-semibold ${tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{formatCurrencyWithSymbol(Math.abs(tx.amount), currency)}
                  </p>
                  <p className="text-xs text-gray-400">Balance: {formatCurrencyWithSymbol(tx.balanceAfter, currency)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
