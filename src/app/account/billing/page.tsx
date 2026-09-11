'use client'

import { useState, useCallback } from 'react'
import { useRealtimeData } from '@/hooks'
import {
  CreditCard, Building2, TrendingDown, Receipt, AlertCircle,
  Sparkles, Download, Calendar, Database, HardDrive, Clock,
  Wallet, CheckCircle, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrencyWithSymbol } from '@/lib/utils/currency'
import { toast } from '@/components/ui/toast'

interface LineItem {
  tenantId: string
  subscriptionId: string
  tenantName: string
  tierName: string
  billingCycle: string
  priceMonthly: number
  renewalAmount: number
  tierCurrency: string
  status: string
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  dbUsed?: number
  dbLimit?: number | null
  fileUsed?: number
  fileLimit?: number | null
}

interface BillingData {
  summary: {
    companyCount: number
    discountPercent: number
    subtotal: number
    discount: number
    total: number
    currency: string
  }
  walletBalance: number
  walletCurrency: string
  lineItems: LineItem[]
  discountTiers: Array<{ minCompanies: number; discount: number }>
  recentInvoices: Array<{
    id: string
    invoiceNumber: string
    periodStart: string
    periodEnd: string
    subtotal: string
    volumeDiscount: string
    total: string
    status: string
    paidAt: string | null
  }>
  userCurrency: string
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function BillingPage() {
  const [billing, setBilling]         = useState<BillingData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [paying, setPaying]           = useState<string | null>(null) // tenantId being paid

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch('/api/account/billing')
      if (res.ok) setBilling(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useRealtimeData(fetchBilling, { entityType: ['account-billing', 'account-subscription', 'account-wallet'] })

  // ── Pay from wallet ──────────────────────────────────────────────────────
  async function handlePayFromWallet(tenantId: string, companyName: string, amount: number, currency: string) {
    if (paying) return
    setPaying(tenantId)
    try {
      const res = await fetch(`/api/account/subscriptions/${tenantId}/pay-from-wallet`, {
        method: 'POST',
      })
      const data = await res.json() as { success?: boolean; error?: string; newPeriodEnd?: string; amountCharged?: number }
      if (res.ok && data.success) {
        toast.success(
          `${companyName} renewed! ${formatCurrencyWithSymbol(data.amountCharged ?? amount, currency)} deducted from wallet.`
        )
        fetchBilling()
      } else {
        toast.error(data.error || 'Failed to process wallet payment')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setPaying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    )
  }

  if (!billing) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Unable to load billing information</p>
      </div>
    )
  }

  const walletCoversTotal = billing.walletBalance >= billing.summary.total

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing &amp; Subscriptions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your subscriptions and billing</p>
        </div>
        <Link
          href="/account/plans"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade Plan
        </Link>
      </div>

      {/* ── Wallet balance banner ────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 border-2 ${
        billing.walletBalance > 0
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            billing.walletBalance > 0 ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-200 dark:bg-gray-700'
          }`}>
            <Wallet className={`w-6 h-6 ${billing.walletBalance > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Wallet Balance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrencyWithSymbol(billing.walletBalance, billing.walletCurrency)}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          {billing.walletBalance > 0 && billing.summary.total > 0 && (
            <p className={`text-sm font-medium ${walletCoversTotal ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {walletCoversTotal
                ? `✓ Covers your ${formatCurrencyWithSymbol(billing.summary.total, billing.summary.currency)} monthly total`
                : `Partially covers ${formatCurrencyWithSymbol(billing.summary.total, billing.summary.currency)} monthly`}
            </p>
          )}
          <Link
            href="/account/wallet"
            className="text-sm text-green-600 dark:text-green-400 hover:underline mt-1 inline-block"
          >
            {billing.walletBalance > 0 ? 'Add more →' : 'Top up wallet →'}
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Subtotal</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrencyWithSymbol(billing.summary.subtotal, billing.summary.currency)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {billing.summary.companyCount} active {billing.summary.companyCount === 1 ? 'company' : 'companies'}
          </p>
        </div>

        <div className={`rounded-2xl border p-6 ${
          billing.summary.discountPercent > 0
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-700'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-md flex items-center justify-center ${billing.summary.discountPercent > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <TrendingDown className={`w-5 h-5 ${billing.summary.discountPercent > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Volume Discount</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {billing.summary.discountPercent > 0 ? `${billing.summary.discountPercent}%` : '0%'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {billing.summary.discountPercent > 0
              ? `Saving ${formatCurrencyWithSymbol(billing.summary.discount, billing.summary.currency)}/month`
              : 'Add more companies to unlock discounts'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#071209] to-[#0d2e18] rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/10 rounded-md flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-300">Monthly Total</span>
          </div>
          <p className="text-3xl font-bold">
            {formatCurrencyWithSymbol(billing.summary.total, billing.summary.currency)}
          </p>
          <p className="text-sm text-gray-400 mt-2">After discounts</p>
        </div>
      </div>

      {/* Volume Discount Tiers */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-md flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Volume Discounts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Save more by managing multiple companies</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-4">
            {billing.discountTiers.map((tier, i) => (
              <div
                key={i}
                className={`flex-1 min-w-[160px] p-5 rounded-md border-2 ${
                  billing.summary.companyCount >= tier.minCompanies
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-300 dark:border-green-700'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{tier.discount}% off</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{tier.minCompanies}+ companies</div>
                {billing.summary.companyCount >= tier.minCompanies && (
                  <div className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-medium mt-2 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    Active
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active Subscriptions with Pay from Wallet ────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center">
            <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Subscriptions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{billing.lineItems.length} total</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {billing.lineItems.map((item) => {
            const dbPercent    = item.dbLimit   ? Math.min((item.dbUsed   || 0) / item.dbLimit   * 100, 100) : 0
            const filePercent  = item.fileLimit ? Math.min((item.fileUsed || 0) / item.fileLimit * 100, 100) : 0
            const daysLeft     = daysUntil(item.currentPeriodEnd)
            const isDue        = daysLeft !== null && daysLeft <= 7 && item.status !== 'trial'
            const isExpired    = daysLeft !== null && daysLeft < 0
            const canPayWallet = item.status !== 'trial' && billing.walletBalance >= item.renewalAmount
            const isBeingPaid  = paying === item.tenantId

            return (
              <div key={item.tenantId} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">{item.tenantName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                        <span>{item.tierName}</span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="capitalize">{item.billingCycle}</span>
                        {item.status === 'trial' && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                            Free
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                            Expired
                          </span>
                        )}
                        {isDue && !isExpired && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                            Due in {daysLeft}d
                          </span>
                        )}
                      </div>
                      {item.currentPeriodEnd && item.status !== 'trial' && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {isExpired ? 'Expired' : 'Renews'} {formatDate(item.currentPeriodEnd)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: price + pay button */}
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {item.status === 'trial'
                        ? 'Free'
                        : formatCurrencyWithSymbol(item.priceMonthly, item.tierCurrency)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">/month</div>

                    {/* Pay from Wallet button — shown when subscription is due or expired */}
                    {item.status !== 'trial' && (isDue || isExpired) && (
                      <div className="mt-2">
                        {canPayWallet ? (
                          <button
                            type="button"
                            disabled={!!paying}
                            onClick={() => handlePayFromWallet(
                              item.tenantId,
                              item.tenantName,
                              item.renewalAmount,
                              item.tierCurrency
                            )}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isBeingPaid ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Paying…</>
                            ) : (
                              <><Wallet className="w-3 h-3" /> Pay {formatCurrencyWithSymbol(item.renewalAmount, item.tierCurrency)} from Wallet</>
                            )}
                          </button>
                        ) : (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>
                              {billing.walletBalance > 0
                                ? `Need ${formatCurrencyWithSymbol(item.renewalAmount - billing.walletBalance, item.tierCurrency)} more`
                                : 'Top up wallet to auto-pay'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Confirmed auto-renewal indicator */}
                    {item.status !== 'trial' && !isDue && !isExpired && canPayWallet && (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1 justify-end">
                        <CheckCircle className="w-3 h-3" />
                        Auto-renews from wallet
                      </div>
                    )}
                  </div>
                </div>

                {/* Storage bars */}
                {(item.dbLimit || item.fileLimit) && (
                  <div className="flex gap-4 ml-14 mt-2">
                    {item.dbLimit && (
                      <div className="flex items-center gap-2 flex-1">
                        <Database className="w-3 h-3 text-purple-400" />
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full flex-1">
                          <div className={`h-full rounded-full ${dbPercent >= 90 ? 'bg-red-500' : dbPercent >= 80 ? 'bg-yellow-500' : 'bg-purple-500'}`} style={{ width: `${dbPercent}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{Math.round(dbPercent)}%</span>
                      </div>
                    )}
                    {item.fileLimit && (
                      <div className="flex items-center gap-2 flex-1">
                        <HardDrive className="w-3 h-3 text-green-400" />
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full flex-1">
                          <div className={`h-full rounded-full ${filePercent >= 90 ? 'bg-red-500' : filePercent >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${filePercent}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{Math.round(filePercent)}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Wallet auto-renewal info box ────────────────────────────────── */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Wallet Auto-Renewal</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Keep your wallet topped up and your subscriptions will renew automatically — no manual payments needed.
              Auto-renewal runs every 6 hours. If your wallet balance is insufficient, you&apos;ll receive a warning
              and have a 3-day grace period before services are suspended.
            </p>
            <Link
              href="/account/wallet"
              className="inline-flex items-center gap-2 mt-3 text-sm text-green-700 dark:text-green-400 font-medium hover:underline"
            >
              <Wallet className="w-4 h-4" />
              Manage wallet balance →
            </Link>
          </div>
        </div>
      </div>

      {/* Next Payment Due */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-green-200 dark:border-blue-700 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Next Payment Due</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {billing.summary.total > 0
                ? `${formatCurrencyWithSymbol(billing.summary.total, billing.summary.currency)} due at your next billing period.${walletCoversTotal ? ' Your wallet balance covers this.' : ' Top up your wallet to enable auto-renewal.'}`
                : 'No active paid subscriptions.'}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-md flex items-center justify-center">
            <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Invoices</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your billing history</p>
          </div>
        </div>
        {billing.recentInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">Invoice</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">Period</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {billing.recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {formatCurrencyWithSymbol(parseFloat(invoice.total), billing.summary.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : invoice.status === 'pending'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
