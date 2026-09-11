'use client'

import { useState, useCallback, use, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRealtimeDataMultiple } from '@/hooks'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CreditCard,
  AlertTriangle,
  Loader2,
  Crown,
  Database,
  HardDrive,
  Sparkles,
  X,
  Zap,
  Users,
  ShoppingCart,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Info,
  CheckCircle2,
  Smartphone,
  Globe,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { formatCurrencyWithSymbol } from '@/lib/utils/currency'

interface Tier {
  id: string
  name: string
  displayName: string
  priceMonthly: string | null
  priceYearly: string | null
  maxUsers: number | null
  maxSalesMonthly: number | null
  maxDatabaseBytes: number | null
  maxFileStorageBytes: number | null
  features: Record<string, unknown>
}

interface SubscriptionData {
  subscription: {
    id: string
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    trialEndsAt: string | null
    cancelAtPeriodEnd: boolean
  }
  currentTier: Tier | null
  availableTiers: Tier[]
  canManage: boolean
  usage?: {
    databaseBytes: number
    fileStorageBytes: number
  }
}

interface ProrationPreview {
  currentTier: { id: string; name: string; price: number }
  newTier: { id: string; name: string; price: number }
  proration?: {
    daysRemaining: number
    totalDaysInPeriod: number
    creditAmount: number
    newPlanCost: number
  }
  amountDue: number
  isUpgrade: boolean
  billingCycle: string
  currentBillingCycle?: string
  cycleChanging?: boolean
  walletBalance: number
  noProration?: boolean
}


function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function SubscriptionPage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = use(params)
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [walletCurrency, setWalletCurrency] = useState<string>('KES')

  // Proration modal state
  const [showProrationModal, setShowProrationModal] = useState(false)
  const [prorationPreview, setProrationPreview] = useState<ProrationPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)

  // Gateway payment modal state
  const [showGatewayModal, setShowGatewayModal] = useState(false)
  const [pendingPaymentData, setPendingPaymentData] = useState<{
    subscriptionId: string
    tierId: string
    billingCycle: string
    newTierId?: string
    walletCredit?: number
    amount: number
  } | null>(null)
  const [selectedGateway, setSelectedGateway] = useState<'mpesa' | 'stripe' | 'paystack' | 'payhero' | null>(null)
  const [gatewayStatus, setGatewayStatus] = useState<'idle' | 'sending' | 'polling' | 'failed'>('idle')
  const [gatewayMessage, setGatewayMessage] = useState('')
  const [gatewayPhone, setGatewayPhone] = useState('')
  const [gatewayEmail, setGatewayEmail] = useState('')
  const [gatewayInternalRef, setGatewayInternalRef] = useState('')
  const [gatewayRedirectUrl, setGatewayRedirectUrl] = useState('')
  const [gatewayPollAttempts, setGatewayPollAttempts] = useState(0)
  const gatewayPollRef = useState<ReturnType<typeof setTimeout> | null>(null)
  const [enabledGateways, setEnabledGateways] = useState<{
    mpesa: { enabled: boolean }
    stripe: { enabled: boolean }
    paystack: { enabled: boolean }
    payhero: { enabled: boolean }
  } | null>(null)

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch(`/api/account/subscriptions/${tenantId}`)
      if (res.ok) {
        const subData = await res.json()
        setData(subData)
      } else {
        setError('Unable to load subscription')
      }
    } catch {
      setError('Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  const fetchWalletBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/account/wallet')
      if (res.ok) {
        const walletData = await res.json()
        setWalletBalance(Number(walletData.balance || 0))
        setWalletCurrency(walletData.currency || 'KES')
      }
    } catch {
      // Non-critical, don't block UI
    }
  }, [])

  // Real-time updates via WebSocket
  useRealtimeDataMultiple([fetchSubscription, fetchWalletBalance], {
    entityType: ['account-subscription', 'account-wallet'],
  })

  // ── Handle return from Paystack redirect ────────────────────────────────
  // /api/paystack/callback sends subscription payments to:
  //   /account/subscription/:id?paystack_ref=...&paystack_status=success/failed
  const searchParams = useSearchParams()
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
      setSuccess('Payment confirmed! Your plan has been upgraded.')
      fetchSubscription()
      fetchWalletBalance()
    } else {
      setError('Payment was not completed. Please try again.')
    }
  // fetchSubscription and fetchWalletBalance are stable useCallback refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preview proration when user clicks on a tier
  const handlePreviewChange = async (tierId: string) => {
    if (!data?.canManage) return

    setSelectedTierId(tierId)
    setPreviewLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/account/subscriptions/${tenantId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTierId: tierId,
          billingCycle,
          action: 'preview',
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to preview plan change')
        setPreviewLoading(false)
        return
      }

      const preview = await res.json()
      setProrationPreview(preview)
      setShowProrationModal(true)
    } catch {
      setError('Failed to preview plan change')
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Trigger gateway payment immediately — takes payment data directly to avoid React state race ──
  const triggerGatewayPayment = async (
    gateway: 'mpesa' | 'stripe' | 'paystack' | 'payhero',
    gwConfig: Record<string, { enabled: boolean; publicKey?: string; currency?: string }> | null,
    paymentInfo: {
      amount: number
      subscriptionId?: string
      billingCycle?: string
      newTierId?: string
    }
  ) => {
    const { amount: payAmount, subscriptionId, billingCycle, newTierId } = paymentInfo
    if (!payAmount) return

    setGatewayStatus('sending')
    setGatewayMessage('')

    try {
      if (gateway === 'paystack') {
        // Server-initialize the transaction — route fetches real email from DB automatically
        const initRes = await fetch('/api/paystack/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: payAmount,
            context: 'subscription',
            ...(subscriptionId ? { subscriptionId } : {}),
            ...(billingCycle ? { billingCycle } : {}),
            ...(newTierId ? { newTierId } : {}),
          }),
        })
        const initData = await initRes.json() as {
          authorizationUrl?: string
          reference?: string
          error?: string
        }

        if (!initRes.ok || !initData.authorizationUrl) {
          setGatewayStatus('failed')
          setGatewayMessage(initData.error || 'Could not create payment link. Please try again.')
          return
        }

        // Store ref + URL then switch to 'polling' so the existing
        // "Open Checkout" / "I've completed the payment" modal UI takes over
        setGatewayInternalRef(initData.reference || '')
        setGatewayRedirectUrl(initData.authorizationUrl)
        setGatewayStatus('polling')
        setGatewayMessage('Click "Open Payment Page" to pay securely. Return here after paying.')
        return
      }

      // Other gateways fall through to normal modal flow
      setGatewayStatus('idle')
    } catch {
      setGatewayStatus('failed')
      setGatewayMessage('Failed to start payment. Please try again.')
    }
  }

  // Execute the upgrade/downgrade
  const handleExecuteChange = async () => {
    if (!selectedTierId || !prorationPreview) return

    setUpdating(true)
    setError('')

    try {
      const res = await fetch(`/api/account/subscriptions/${tenantId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTierId: selectedTierId,
          billingCycle,
          action: 'execute',
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Failed to change plan')
        return
      }

      // Handle different responses
      if (result.requiresPayment) {
        // Fetch enabled gateways
        let gwConfig: Record<string, { enabled: boolean; publicKey?: string; currency?: string }> | null = null
        try {
          const gwRes = await fetch('/api/account/gateway-config')
          if (gwRes.ok) gwConfig = await gwRes.json()
        } catch { /* silent */ }

        setEnabledGateways(gwConfig)

        // Pre-select the first enabled gateway — fire immediately if only one
        const gatewayIds = ['mpesa', 'stripe', 'paystack', 'payhero'] as const
        const activeIds = gwConfig ? gatewayIds.filter(id => gwConfig![id]?.enabled) : []
        const preSelected = activeIds.length >= 1 ? activeIds[0] : null

        setPendingPaymentData({
          subscriptionId: result.subscriptionId,
          tierId: selectedTierId!,
          billingCycle: result.billingCycle,
          newTierId: result.newTierId,
          walletCredit: result.walletCredit || 0,
          amount: result.amount,
        })
        setSelectedGateway(preSelected)
        setGatewayStatus('idle')
        setGatewayMessage('')
        setGatewayPhone('')
        setGatewayEmail('')
        setGatewayInternalRef('')
        setGatewayRedirectUrl('')
        setShowProrationModal(false)
        setShowGatewayModal(true)
        setUpdating(false)

        // If there's exactly one gateway, trigger it automatically after modal opens
        if (preSelected && activeIds.length === 1) {
          // Pass payment data directly — avoids React state async race condition
          const paymentInfo = {
            amount: result.amount,
            subscriptionId: result.subscriptionId,
            billingCycle: result.billingCycle,
            newTierId: result.newTierId,
          }
          setTimeout(() => triggerGatewayPayment(preSelected, gwConfig, paymentInfo), 150)
        }
        return
      }

      // Success - plan changed
      setShowProrationModal(false)
      setProrationPreview(null)
      setSelectedTierId(null)

      if (result.paidFromWallet) {
        setSuccess(`Plan upgraded successfully! ${formatCurrencyWithSymbol(result.amountCharged, walletCurrency)} charged from wallet.`)
        setWalletBalance(Number(result.newWalletBalance))
      } else if (result.creditApplied) {
        setSuccess(`Plan changed successfully! ${formatCurrencyWithSymbol(result.creditApplied, walletCurrency)} credited to your wallet.`)
        setWalletBalance(Number(result.newWalletBalance))
      } else {
        setSuccess('Plan changed successfully!')
      }

      await fetchSubscription()
      await fetchWalletBalance()
    } catch {
      setError('Failed to change plan')
    } finally {
      setUpdating(false)
    }
  }

  const handleToggleCancellation = async () => {
    if (!data?.canManage) return

    setUpdating(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/account/subscriptions/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancelAtPeriodEnd: !data.subscription.cancelAtPeriodEnd,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Failed to update subscription')
        return
      }

      await fetchSubscription()
    } catch {
      setError('Failed to update subscription')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400">{error || 'Subscription not found'}</p>
        <Link
          href="/account"
          className="mt-4 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium"
        >
          Back to Account
        </Link>
      </div>
    )
  }

  const { subscription, currentTier, availableTiers, canManage } = data
  const dbUsed = data.usage?.databaseBytes || 0
  const fileUsed = data.usage?.fileStorageBytes || 0
  const dbLimit = currentTier?.maxDatabaseBytes
  const fileLimit = currentTier?.maxFileStorageBytes
  const dbPercent = dbLimit ? Math.min((dbUsed / dbLimit) * 100, 100) : 0
  const filePercent = fileLimit ? Math.min((fileUsed / fileLimit) * 100, 100) : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/account"
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Hero Section */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-500 rounded-2xl mb-4">
          <CreditCard className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Subscription</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">View and manage your subscription plan</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-md flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-md flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Wallet Balance Card */}
      {canManage && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-md flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">Wallet Balance</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrencyWithSymbol(walletBalance, walletCurrency)}</p>
              </div>
            </div>
            <Link
              href="/account/wallet"
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              View Wallet
            </Link>
          </div>
        </div>
      )}

      {/* Current Plan Card with Storage Usage */}
      <div className="bg-gradient-to-br from-[#071209] to-[#0d2e18] rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />

        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                <Crown className="w-7 h-7 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Current Plan</p>
                <h2 className="text-2xl font-bold">{currentTier?.displayName || 'No plan'}</h2>
              </div>
            </div>
            <span
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                subscription.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : subscription.status === 'trial'
                  ? 'bg-green-500/20 text-green-400'
                  : subscription.status === 'past_due'
                  ? 'bg-red-500/20 text-red-400'
                  : subscription.status === 'locked'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {subscription.status === 'trial' ? 'Free Plan' : subscription.status === 'locked' ? 'Locked' : subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </span>
          </div>

          {currentTier && (
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold">{formatCurrencyWithSymbol(Number(currentTier.priceMonthly), 'KES')}</span>
              <span className="text-gray-400">/month</span>
            </div>
          )}

          {/* Storage Usage Bars */}
          <div className="grid gap-3 md:grid-cols-2 mt-6">
            <div className="bg-white/10 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300">Database</span>
                </div>
                <span className="text-sm text-gray-400">
                  {formatBytes(dbUsed)}{dbLimit ? ` / ${formatBytes(dbLimit)}` : ''}
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${dbPercent >= 90 ? 'bg-red-500' : dbPercent >= 80 ? 'bg-yellow-500' : 'bg-purple-500'}`}
                  style={{ width: dbLimit ? `${dbPercent}%` : '0%' }}
                />
              </div>
            </div>
            <div className="bg-white/10 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">Files</span>
                </div>
                <span className="text-sm text-gray-400">
                  {formatBytes(fileUsed)}{fileLimit ? ` / ${formatBytes(fileLimit)}` : ''}
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${filePercent >= 90 ? 'bg-red-500' : filePercent >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: fileLimit ? `${filePercent}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 rounded-md mt-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-300 text-sm">Subscription will cancel at period end</p>
            </div>
          )}

          {subscription.currentPeriodEnd && (
            <p className="text-gray-400 text-sm mt-4">
              Current period ends: {formatDate(subscription.currentPeriodEnd)}
            </p>
          )}
        </div>
      </div>

      {/* Free Plan Notice */}
      {subscription.status === 'trial' && subscription.trialEndsAt && (
        <div className="bg-gradient-to-r from-green-50 to-green-50 dark:from-green-900/30 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-md flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Free Plan Active</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Your free plan is active with full access to all features.
                Upgrade to a paid plan for additional storage and capabilities.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unlimited Badge */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full">
          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Unlimited Users</span>
          <span className="text-emerald-300 dark:text-emerald-600 mx-1">|</span>
          <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Unlimited Transactions</span>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
          Monthly
        </span>
        <button
          onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            billingCycle === 'yearly' ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <div
            className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
          Yearly
        </span>
        {billingCycle === 'yearly' && (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
            Save ~17%
          </span>
        )}
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {availableTiers.filter(t => t.name !== 'trial').map((tier) => {
            const isCurrent = currentTier?.id === tier.id
            const isPopular = tier.name === 'professional'
            const isCustomTier = tier.priceMonthly == null && tier.priceYearly == null
            const displayPrice = isCustomTier ? null : (billingCycle === 'yearly' ? tier.priceYearly : tier.priceMonthly)
            const monthlyEquiv = !isCustomTier && billingCycle === 'yearly' && tier.priceYearly
              ? (parseFloat(tier.priceYearly) / 12).toFixed(0)
              : null
            const storageGainDb = tier.maxDatabaseBytes && currentTier?.maxDatabaseBytes
              ? tier.maxDatabaseBytes - currentTier.maxDatabaseBytes
              : 0
            const storageGainFile = tier.maxFileStorageBytes && currentTier?.maxFileStorageBytes
              ? tier.maxFileStorageBytes - currentTier.maxFileStorageBytes
              : 0
            const isUpgrade = !isCustomTier && parseFloat(tier.priceMonthly || '0') > parseFloat(currentTier?.priceMonthly || '0')
            const isPreviewingThis = previewLoading && selectedTierId === tier.id

            return (
              <div
                key={tier.id}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 p-6 transition-all hover:shadow-xl ${
                  isCurrent
                    ? 'border-green-400 ring-4 ring-green-100 dark:ring-green-900/50'
                    : isPopular
                    ? 'border-green-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {isPopular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-600 to-green-400 text-white text-xs font-semibold rounded-full">
                      <Zap className="w-3 h-3" />
                      Popular
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-400 text-white text-xs font-semibold rounded-full">
                      <Check className="w-3 h-3" />
                      Current
                    </span>
                  </div>
                )}

                <div className="mb-4 pt-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tier.displayName}</h3>
                </div>

                <div className="mb-4">
                  {isCustomTier ? (
                    <span className="text-xl font-bold text-gray-900 dark:text-white">Custom Pricing</span>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrencyWithSymbol(Number(displayPrice), 'KES')}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                      </div>
                      {monthlyEquiv && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">~{formatCurrencyWithSymbol(Number(monthlyEquiv), 'KES')}/mo</p>
                      )}
                    </>
                  )}
                </div>

                {/* Storage Info */}
                <div className="space-y-2 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="flex items-center gap-2 text-sm dark:text-gray-300">
                    <Database className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">{tier.maxDatabaseBytes ? formatBytes(tier.maxDatabaseBytes) : 'Custom'} DB</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm dark:text-gray-300">
                    <HardDrive className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{tier.maxFileStorageBytes ? formatBytes(tier.maxFileStorageBytes) : 'Custom'} Files</span>
                  </div>
                </div>

                {/* Storage gain indicator */}
                {!isCurrent && (storageGainDb > 0 || storageGainFile > 0) && (
                  <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded p-2 mb-4">
                    {storageGainDb > 0 && <span>+{formatBytes(storageGainDb)} DB </span>}
                    {storageGainFile > 0 && <span>+{formatBytes(storageGainFile)} Files</span>}
                  </div>
                )}

                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2 text-sm dark:text-gray-300">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <span>All features included</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm dark:text-gray-300">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <span>Unlimited users & sales</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm dark:text-gray-300">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <span>All business types</span>
                  </li>
                </ul>

                {canManage && !isCurrent && isCustomTier && (
                  <Link
                    href="/contact"
                    className="block w-full py-2.5 px-4 rounded-md font-medium text-center text-sm bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Contact Us
                  </Link>
                )}

                {canManage && !isCurrent && !isCustomTier && (
                  <button
                    onClick={() => handlePreviewChange(tier.id)}
                    disabled={previewLoading || updating}
                    className={`w-full py-2.5 px-4 rounded-md font-medium transition-all disabled:opacity-50 text-sm ${
                      isUpgrade
                        ? 'bg-green-400 text-white hover:bg-green-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {isPreviewingThis ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </span>
                    ) : isUpgrade ? (
                      'Upgrade'
                    ) : (
                      'Downgrade'
                    )}
                  </button>
                )}

                {isCurrent && (
                  <div className="w-full py-2.5 px-4 rounded-md font-medium bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-center text-sm">
                    Current Plan
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cancel Subscription */}
      {canManage && subscription.status === 'active' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-red-200 dark:border-red-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-md flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-300">Cancel Subscription</h3>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {subscription.cancelAtPeriodEnd
                    ? 'Your subscription will be cancelled at the end of the current period.'
                    : 'Cancel your subscription. You can still use the service until the end of your billing period.'}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <button
              onClick={handleToggleCancellation}
              disabled={updating}
              className={`px-6 py-3 rounded-md font-medium transition-all disabled:opacity-50 ${
                subscription.cancelAtPeriodEnd
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              {updating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </span>
              ) : subscription.cancelAtPeriodEnd ? (
                'Resume Subscription'
              ) : (
                'Cancel Subscription'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Proration Preview Modal */}
      {showProrationModal && prorationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowProrationModal(false)
              setProrationPreview(null)
              setSelectedTierId(null)
            }}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center ${
                    prorationPreview.isUpgrade
                      ? 'bg-green-100 dark:bg-green-900/50'
                      : 'bg-amber-100 dark:bg-amber-900/50'
                  }`}>
                    {prorationPreview.isUpgrade ? (
                      <ArrowUpRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {prorationPreview.isUpgrade ? 'Upgrade' : 'Downgrade'} Plan
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowProrationModal(false)
                    setProrationPreview(null)
                    setSelectedTierId(null)
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Plan Change Summary */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-md mb-4">
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{prorationPreview.currentTier.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrencyWithSymbol(prorationPreview.currentTier.price, 'KES')}</p>
                </div>
                <div className="text-gray-300 dark:text-gray-600">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">New</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{prorationPreview.newTier.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatCurrencyWithSymbol(prorationPreview.newTier.price, 'KES')}/{billingCycle === 'yearly' ? 'yr' : 'mo'}
                  </p>
                </div>
              </div>
            </div>

            {/* Proration Breakdown */}
            <div className="px-6 pb-4">
              {prorationPreview.noProration ? (
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/30 rounded-md mb-4">
                  <Info className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-300">Full payment required</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      As you&apos;re on the free plan, the full plan price will be charged to start your subscription.
                    </p>
                  </div>
                </div>
              ) : prorationPreview.proration ? (
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Proration Details
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Days remaining in period</span>
                      <span className="font-medium dark:text-gray-200">{prorationPreview.proration.daysRemaining} / {prorationPreview.proration.totalDaysInPeriod}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Credit from current plan</span>
                      <span className="font-medium text-green-600 dark:text-green-400">-{formatCurrencyWithSymbol(prorationPreview.proration.creditAmount, walletCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">New plan cost (remaining days)</span>
                      <span className="font-medium dark:text-gray-200">+{formatCurrencyWithSymbol(prorationPreview.proration.newPlanCost, walletCurrency)}</span>
                    </div>
                    {prorationPreview.cycleChanging && (
                      <div className="flex items-start gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <Info className="w-4 h-4 text-green-500 dark:text-green-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Billing cycle changing from {prorationPreview.currentBillingCycle} to {prorationPreview.billingCycle}.
                          The new cycle will start at your next renewal.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Amount Due */}
              <div className={`p-4 rounded-md mb-4 ${
                prorationPreview.amountDue > 0
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                  : prorationPreview.amountDue < 0
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {prorationPreview.amountDue > 0 ? 'Amount Due' : prorationPreview.amountDue < 0 ? 'Credit to Wallet' : 'No charge'}
                  </span>
                  <span className={`text-xl font-bold ${
                    prorationPreview.amountDue > 0 ? 'text-green-700 dark:text-green-400' : prorationPreview.amountDue < 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {prorationPreview.amountDue === 0
                      ? formatCurrencyWithSymbol(0, walletCurrency)
                      : formatCurrencyWithSymbol(Math.abs(prorationPreview.amountDue), walletCurrency)
                    }
                  </span>
                </div>

                {/* Payment source info */}
                {prorationPreview.amountDue > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 space-y-1">
                    {prorationPreview.walletBalance >= prorationPreview.amountDue ? (
                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                        <Wallet className="w-4 h-4" />
                        <span>Will be paid from wallet (balance: {formatCurrencyWithSymbol(prorationPreview.walletBalance, walletCurrency)})</span>
                      </div>
                    ) : prorationPreview.walletBalance > 0 ? (
                      <>
                        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                          <Wallet className="w-4 h-4" />
                          <span>{formatCurrencyWithSymbol(prorationPreview.walletBalance, walletCurrency)} from wallet</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                          <CreditCard className="w-4 h-4" />
                          <span>{formatCurrencyWithSymbol(prorationPreview.amountDue - prorationPreview.walletBalance, walletCurrency)} via payment gateway</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                        <CreditCard className="w-4 h-4" />
                        <span>Will be charged via payment gateway</span>
                      </div>
                    )}
                  </div>
                )}

                {prorationPreview.amountDue < 0 && (
                  <p className="text-sm text-green-700 dark:text-green-400 mt-2">
                    The prorated credit will be added to your wallet balance.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowProrationModal(false)
                    setProrationPreview(null)
                    setSelectedTierId(null)
                  }}
                  disabled={updating}
                  className="flex-1 py-3 px-4 rounded-md font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteChange}
                  disabled={updating}
                  className={`flex-1 py-3 px-4 rounded-md font-medium transition-all disabled:opacity-50 ${
                    prorationPreview.isUpgrade
                      ? 'bg-green-400 text-white hover:bg-green-500'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  {updating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : prorationPreview.amountDue > 0 && prorationPreview.walletBalance < prorationPreview.amountDue ? (
                    `Pay ${formatCurrencyWithSymbol(prorationPreview.amountDue > prorationPreview.walletBalance ? prorationPreview.amountDue - prorationPreview.walletBalance : prorationPreview.amountDue, walletCurrency)}`
                  ) : (
                    `Confirm ${prorationPreview.isUpgrade ? 'Upgrade' : 'Downgrade'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Gateway Payment Modal */}
      {showGatewayModal && pendingPaymentData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (gatewayStatus !== 'polling' && gatewayStatus !== 'sending') { setShowGatewayModal(false); setGatewayStatus('idle') } }} />
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold">Complete Payment</h3>
                {gatewayStatus !== 'polling' && gatewayStatus !== 'sending' && (
                  <button onClick={() => { setShowGatewayModal(false); setGatewayStatus('idle') }} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-gray-300 text-sm">
                {formatCurrencyWithSymbol(pendingPaymentData.amount, walletCurrency)} due
                {pendingPaymentData.walletCredit && pendingPaymentData.walletCredit > 0
                  ? ` (${formatCurrencyWithSymbol(pendingPaymentData.walletCredit, walletCurrency)} covered by wallet)`
                  : ''}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Gateway selection — show only admin-enabled ones with generic labels */}
              {gatewayStatus === 'idle' && !selectedGateway && (
                <>
                  {enabledGateways && Object.values(enabledGateways).every(g => !g.enabled) ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No payment methods configured.</p>
                      <p className="text-xs text-gray-400 mt-1">Contact your administrator or use bank deposit.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">How would you like to pay?</p>
                      <div className="grid grid-cols-1 gap-3">
                        {([
                          { id: 'mpesa',    Icon: Smartphone, isMobile: true  },
                          { id: 'stripe',   Icon: CreditCard,  isMobile: false },
                          { id: 'paystack', Icon: CreditCard,  isMobile: false },
                          { id: 'payhero',  Icon: Smartphone, isMobile: true  },
                        ] as const)
                        .filter(g => !enabledGateways || enabledGateways[g.id]?.enabled)
                        .map(({ id, Icon, isMobile }) => {
                          const label = isMobile ? 'Mobile Money' : 'Card Payment'
                          const desc  = isMobile ? 'Pay via mobile money — get a prompt on your phone' : 'Pay with your credit or debit card securely'
                          const borderCls = isMobile ? 'border-green-200 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20' : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                          const iconCls = isMobile ? 'text-green-600' : 'text-indigo-600'
                          const iconBg  = isMobile ? 'bg-green-100 dark:bg-green-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'
                          return (
                            <button key={id}
                              onClick={() => setSelectedGateway(id)}
                              className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${borderCls}`}
                            >
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                                <Icon className={`w-5 h-5 ${iconCls}`} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Gateway input + submit */}
              {gatewayStatus === 'idle' && selectedGateway && (
                <>
                  {enabledGateways && Object.values(enabledGateways).filter(g => g.enabled).length > 1 && (
                    <button onClick={() => setSelectedGateway(null)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      ← Back
                    </button>
                  )}

                  {(selectedGateway === 'mpesa' || selectedGateway === 'payhero') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Your mobile number</label>
                      <input type="tel" value={gatewayPhone} onChange={e => setGatewayPhone(e.target.value)}
                        placeholder="07XX XXX XXX" autoFocus
                        className="w-full h-10 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <p className="text-xs text-gray-400 mt-1">You will receive a payment prompt on this number</p>
                    </div>
                  )}
                  {(selectedGateway === 'stripe' || selectedGateway === 'paystack') && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
                      {selectedGateway === 'paystack'
                        ? 'A secure card payment window will open'
                        : 'A secure checkout page will be opened for you'}
                    </p>
                  )}

                  {gatewayMessage && <p className="text-xs text-red-500">{gatewayMessage}</p>}

                  <button
                    onClick={async () => {
                      if (!selectedGateway || !pendingPaymentData) return
                      if ((selectedGateway === 'mpesa' || selectedGateway === 'payhero') && !gatewayPhone.trim()) {
                        setGatewayMessage('Please enter your mobile number')
                        return
                      }
                      setGatewayStatus('sending')
                      setGatewayMessage('')
                      try {
                        // Paystack: initialize server-side → show hosted checkout link
                        if (selectedGateway === 'paystack') {
                          await triggerGatewayPayment('paystack', enabledGateways as Record<string, { enabled: boolean; publicKey?: string; currency?: string }>, {
                            amount: pendingPaymentData.amount,
                            subscriptionId: pendingPaymentData.subscriptionId,
                            billingCycle: pendingPaymentData.billingCycle,
                            newTierId: pendingPaymentData.newTierId,
                          })
                          return
                        }

                        let endpoint = ''
                        let body: Record<string, unknown> = {
                          amount: pendingPaymentData.amount,
                          context: 'subscription',
                          subscriptionId: pendingPaymentData.subscriptionId,
                        }
                        if (selectedGateway === 'mpesa') {
                          endpoint = '/api/mpesa/stkpush'
                          body = { ...body, phone: gatewayPhone }
                        } else if (selectedGateway === 'payhero') {
                          endpoint = '/api/payhero/checkout'
                          body = { ...body, phone: gatewayPhone }
                        } else if (selectedGateway === 'stripe') {
                          endpoint = '/api/stripe/checkout'
                          body = { ...body, description: 'Subscription payment' }
                        }

                        const res = await fetch(endpoint, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(body),
                        })
                        const data = await res.json() as Record<string, unknown>

                        if (!res.ok) {
                          setGatewayStatus('failed')
                          setGatewayMessage((data.error as string) || 'Failed to initiate payment')
                          return
                        }

                        // Hosted redirect gateways (Stripe / Paystack)
                        if (selectedGateway === 'stripe' && data.checkoutUrl) {
                          setGatewayInternalRef((data.internalReference as string) || '')
                          setGatewayRedirectUrl(data.checkoutUrl as string)
                          setGatewayStatus('polling')
                          setGatewayMessage('Stripe checkout ready — click the button below.')
                          return
                        }
                        if (selectedGateway === 'paystack' && data.authorizationUrl) {
                          setGatewayInternalRef((data.reference as string) || '')
                          setGatewayRedirectUrl(data.authorizationUrl as string)
                          setGatewayStatus('polling')
                          setGatewayMessage('Paystack checkout ready — click the button below.')
                          return
                        }

                        // Push-based gateways (M-Pesa / PayHero)
                        const ref = (data.checkoutRequestId || data.internalReference || data.merchantReference) as string
                        setGatewayInternalRef((data.internalReference as string) || ref)
                        setGatewayStatus('polling')
                        setGatewayMessage('Payment request sent. Waiting for confirmation on your phone…')
                        setGatewayPollAttempts(0)

                        // Start polling
                        const pollEndpoint = selectedGateway === 'mpesa'
                          ? `/api/mpesa/status?checkoutRequestId=${encodeURIComponent(ref)}`
                          : `/api/payhero/status?ref=${encodeURIComponent((data.internalReference as string) || ref)}`

                        const poll = async (attempt: number) => {
                          if (attempt >= 40) { setGatewayStatus('failed'); setGatewayMessage('Payment timed out. Please try again.'); return }
                          try {
                            const pr = await fetch(pollEndpoint)
                            const pd = await pr.json() as { status: string }
                            if (pd.status === 'success') {
                              setGatewayStatus('success')
                              setGatewayMessage('Payment confirmed!')
                              setTimeout(() => { setShowGatewayModal(false); setSuccess('Payment successful! Your plan has been upgraded.'); fetchSubscription(); fetchWalletBalance() }, 1800)
                              return
                            }
                            if (pd.status === 'failed') { setGatewayStatus('failed'); setGatewayMessage('Payment declined.'); return }
                            if (pd.status === 'cancelled') { setGatewayStatus('failed'); setGatewayMessage('Payment was cancelled.'); return }
                          } catch { /* keep polling */ }
                          setGatewayPollAttempts(attempt + 1)
                          gatewayPollRef[0] = setTimeout(() => poll(attempt + 1), 3000)
                        }
                        poll(0)
                      } catch {
                        setGatewayStatus('failed')
                        setGatewayMessage('Network error. Please try again.')
                      }
                    }}
                    disabled={
                      (selectedGateway === 'mpesa' || selectedGateway === 'payhero') ? !gatewayPhone.trim() : false
                    }
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    {selectedGateway === 'paystack' ? 'Pay by Card' :
                     selectedGateway === 'stripe' ? 'Open Checkout' :
                     'Send Payment Request'}
                  </button>
                </>
              )}

              {/* Sending */}
              {gatewayStatus === 'sending' && (
                <div className="flex items-center justify-center gap-3 py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Sending request…</span>
                </div>
              )}

              {/* Polling — push payment (M-Pesa / PayHero) */}
              {gatewayStatus === 'polling' && !gatewayRedirectUrl && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{gatewayMessage}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Check {gatewayPollAttempts + 1}/40</p>
                    </div>
                  </div>
                  <button onClick={() => { if (gatewayPollRef[0]) clearTimeout(gatewayPollRef[0]); setGatewayStatus('idle'); setSelectedGateway(null) }}
                    className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Polling — hosted checkout (Stripe / Paystack) */}
              {gatewayStatus === 'polling' && gatewayRedirectUrl && (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{gatewayMessage}</p>
                  <a href={gatewayRedirectUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold bg-gray-900 hover:bg-gray-800 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Checkout
                  </a>
                  <p className="text-xs text-gray-400 text-center">Complete payment in the opened tab, then click below.</p>
                  <button
                    onClick={async () => {
                      if (selectedGateway === 'paystack' && gatewayInternalRef) {
                        setGatewayStatus('sending')
                        const r = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(gatewayInternalRef)}`)
                        const d = await r.json() as { status: string }
                        if (d.status === 'success') {
                          setGatewayStatus('success')
                          setGatewayMessage('Payment confirmed!')
                          setTimeout(() => { setShowGatewayModal(false); setSuccess('Payment successful! Your plan has been upgraded.'); fetchSubscription(); fetchWalletBalance() }, 1800)
                        } else {
                          setGatewayStatus('polling')
                          setGatewayMessage('Payment not yet confirmed. Please wait a moment and try again.')
                        }
                      } else {
                        // Stripe — trust webhook; close and show success
                        setShowGatewayModal(false)
                        setSuccess('Payment initiated. Your plan will be upgraded once payment is confirmed.')
                        fetchSubscription()
                      }
                    }}
                    className="w-full py-2 rounded-xl border border-gray-200 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {gatewayStatus === 'sending' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'I\'ve completed the payment'}
                  </button>
                  <button onClick={() => { setShowGatewayModal(false); setGatewayStatus('idle') }}
                    className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Success */}
              {gatewayStatus === 'success' && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">{gatewayMessage}</p>
                </div>
              )}

              {/* Failed */}
              {gatewayStatus === 'failed' && (
                <div className="space-y-3 py-2">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{gatewayMessage}</p>
                  </div>
                  <button onClick={() => { setGatewayStatus('idle'); setSelectedGateway(null); setGatewayMessage('') }}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-gray-200 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <RefreshCw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
