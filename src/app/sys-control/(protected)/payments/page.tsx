'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Check, X, Eye, Loader2, Clock, CheckCircle, XCircle,
  FileText, Building2, CreditCard, Smartphone, Zap, Globe,
} from 'lucide-react'
import { formatCurrencyWithSymbol } from '@/lib/utils/currency'

// ── Types ──────────────────────────────────────────────────────────────────

interface Payment {
  id: string
  accountId: string
  amount: string
  currency: string
  bankReference: string | null
  depositDate: string
  receiptUrl: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  periodMonths: number
  reviewNotes: string | null
  createdAt: string
  account: { id: string; email: string; fullName: string } | null
  subscription: {
    id: string
    tenantId: string
    status: string
    tier?: { priceMonthly: string; displayName: string }
    tenant?: { name: string; slug: string }
  } | null
}

interface GatewayTransaction {
  id: string
  gateway: 'mpesa' | 'stripe' | 'paystack' | 'payhero'
  internalReference: string
  gatewayReference: string | null
  amount: string
  currency: string
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'expired' | 'refunded'
  context: 'subscription' | 'pos_sale'
  customerPhone: string | null
  customerEmail: string | null
  customerName: string | null
  metadata: Record<string, unknown> | null
  initiatedAt: string
  completedAt: string | null
  createdAt: string
  tenant: { id: string; name: string; slug: string } | null
  account: { id: string; email: string; fullName: string } | null
  sale: { id: string; invoiceNo: string; total: string } | null
  subscription: {
    id: string
    status: string
    tier: { displayName: string } | null
  } | null
}

type Tab = 'bank_deposits' | 'gateway'
type GwStatusFilter = 'all' | 'pending' | 'success' | 'failed' | 'cancelled'
type GwGatewayFilter = 'all' | 'mpesa' | 'stripe' | 'paystack' | 'payhero'

// ── Gateway meta ───────────────────────────────────────────────────────────

const GATEWAY_META: Record<string, { label: string; Icon: React.ElementType; colour: string }> = {
  mpesa:    { label: 'M-Pesa',   Icon: Smartphone, colour: 'text-green-600'  },
  stripe:   { label: 'Stripe',   Icon: CreditCard, colour: 'text-indigo-600' },
  paystack: { label: 'Paystack', Icon: Zap,         colour: 'text-teal-600'   },
  payhero:  { label: 'PayHero',  Icon: Globe,       colour: 'text-orange-500' },
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('bank_deposits')

  // Bank deposits state
  const [payments, setPayments] = useState<Payment[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  // Gateway transactions state
  const [gwTransactions, setGwTransactions] = useState<GatewayTransaction[]>([])
  const [gwStatusFilter, setGwStatusFilter] = useState<GwStatusFilter>('all')
  const [gwGatewayFilter, setGwGatewayFilter] = useState<GwGatewayFilter>('all')

  const [loading, setLoading] = useState(true)

  // ── Fetches ──────────────────────────────────────────────────────────────

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sys-control/payments?status=${filter}`)
      if (res.ok) setPayments(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [filter])

  const fetchGatewayTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (gwStatusFilter !== 'all')  params.set('status',  gwStatusFilter)
      if (gwGatewayFilter !== 'all') params.set('gateway', gwGatewayFilter)
      const res = await fetch(`/api/sys-control/gateway-transactions?${params}`)
      if (res.ok) setGwTransactions(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [gwStatusFilter, gwGatewayFilter])

  useEffect(() => {
    if (activeTab === 'bank_deposits') fetchPayments()
    else fetchGatewayTransactions()
  }, [activeTab, fetchPayments, fetchGatewayTransactions])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAction = async (paymentId: string, action: 'approve' | 'reject') => {
    setProcessing(paymentId)
    try {
      const res = await fetch(`/api/sys-control/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected', reviewNotes }),
      })
      if (res.ok) {
        fetchPayments()
        setReviewNotes('')
        setViewingPayment(null)
      } else {
        const d = await res.json()
        alert(d.error || 'Failed to update payment')
      }
    } catch { alert('Failed to update payment') }
    finally { setProcessing(null) }
  }

  // ── Status badges ─────────────────────────────────────────────────────────

  const depositStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; Icon: React.ElementType; label: string }> = {
      pending:  { cls: 'bg-yellow-100 text-yellow-700', Icon: Clock,       label: 'Pending'  },
      approved: { cls: 'bg-green-100 text-green-700',   Icon: CheckCircle, label: 'Approved' },
      rejected: { cls: 'bg-red-100 text-red-700',       Icon: XCircle,     label: 'Rejected' },
    }
    const m = map[status]
    if (!m) return null
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium ${m.cls} rounded-full`}>
        <m.Icon className="w-3 h-3" />{m.label}
      </span>
    )
  }

  const gwStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending:    { cls: 'bg-yellow-100 text-yellow-700',                           label: 'Pending'    },
      processing: { cls: 'bg-blue-100 text-blue-700',                               label: 'Processing' },
      success:    { cls: 'bg-green-100 text-green-700',                             label: 'Success'    },
      failed:     { cls: 'bg-red-100 text-red-700',                                 label: 'Failed'     },
      cancelled:  { cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600',              label: 'Cancelled'  },
      expired:    { cls: 'bg-gray-100 dark:bg-gray-700 text-gray-500',              label: 'Expired'    },
      refunded:   { cls: 'bg-blue-50 text-blue-600',                                label: 'Refunded'   },
    }
    const m = map[status]
    if (!m) return <span className="text-xs text-gray-400">{status}</span>
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium ${m.cls} rounded-full`}>
        {m.label}
      </span>
    )
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const pendingCount = payments.filter(p => p.status === 'pending').length
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Review bank deposit submissions and gateway payment transactions
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded p-1 w-fit">
        <button
          onClick={() => setActiveTab('bank_deposits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'bank_deposits'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Bank Deposits
        </button>
        <button
          onClick={() => setActiveTab('gateway')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'gateway'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Gateway Transactions
        </button>
      </div>

      {/* ══ BANK DEPOSITS TAB ══════════════════════════════════════════════ */}
      {activeTab === 'bank_deposits' && (
        <>
          {filter === 'pending' && pendingCount > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md px-6 py-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-900 dark:text-orange-300">
                {pendingCount} pending payment{pendingCount !== 1 ? 's' : ''} totaling{' '}
                <strong>{formatCurrencyWithSymbol(pendingTotal, 'KES')}</strong>
              </span>
            </div>
          )}

          <div className="flex gap-2">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
              <button key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filter === s
                    ? 'bg-[#00FF88] text-black'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">No {filter !== 'all' ? filter : ''} deposits found</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {['User', 'Company', 'Amount', 'Expected', 'Period', 'Reference', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {payments.map((payment) => {
                    const account = Array.isArray(payment.account) ? payment.account[0] : payment.account
                    const sub = Array.isArray(payment.subscription) ? payment.subscription[0] : payment.subscription
                    const tenant = sub?.tenant ? (Array.isArray(sub.tenant) ? sub.tenant[0] : sub.tenant) : null
                    const tier = sub?.tier ? (Array.isArray(sub.tier) ? sub.tier[0] : sub.tier) : null
                    const expectedAmount = tier?.priceMonthly ? Number(tier.priceMonthly) * payment.periodMonths : null
                    const amountMatches = expectedAmount !== null && Math.abs(Number(payment.amount) - expectedAmount) < 1

                    return (
                      <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900 dark:text-white">{account?.fullName || '-'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{account?.email || ''}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-900 dark:text-white">{tenant?.name || 'Wallet credit'}</p>
                          {tier && <p className="text-sm text-gray-500 dark:text-gray-400">{tier.displayName}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-semibold ${!amountMatches && expectedAmount !== null ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                            {formatCurrencyWithSymbol(Number(payment.amount), payment.currency)}
                          </p>
                          {!amountMatches && expectedAmount !== null && (
                            <p className="text-xs text-red-500 mt-0.5">Amount mismatch</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                          {expectedAmount !== null ? formatCurrencyWithSymbol(expectedAmount, payment.currency) : '—'}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                          {payment.periodMonths} month{payment.periodMonths !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-mono text-sm text-gray-600 dark:text-gray-400">{payment.bankReference || '—'}</p>
                          <p className="text-xs text-gray-400">{new Date(payment.depositDate).toLocaleDateString()}</p>
                        </td>
                        <td className="px-6 py-4">{depositStatusBadge(payment.status)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setViewingPayment(payment); setReviewNotes('') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" /> Review
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Review Modal */}
          {viewingPayment && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Payment Review
                  </h3>
                  <button onClick={() => setViewingPayment(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  {(() => {
                    const account = Array.isArray(viewingPayment.account) ? viewingPayment.account[0] : viewingPayment.account
                    const sub = Array.isArray(viewingPayment.subscription) ? viewingPayment.subscription[0] : viewingPayment.subscription
                    const tenant = sub?.tenant ? (Array.isArray(sub.tenant) ? sub.tenant[0] : sub.tenant) : null
                    const tier = sub?.tier ? (Array.isArray(sub.tier) ? sub.tier[0] : sub.tier) : null
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><p className="text-gray-500 dark:text-gray-400">User</p><p className="font-medium text-gray-900 dark:text-white">{account?.fullName}</p><p className="text-gray-500 dark:text-gray-400">{account?.email}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Company</p><p className="font-medium text-gray-900 dark:text-white">{tenant?.name || '—'}</p>{tier && <p className="text-gray-500 dark:text-gray-400">{tier.displayName}</p>}</div>
                          <div><p className="text-gray-500 dark:text-gray-400">Amount</p><p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrencyWithSymbol(Number(viewingPayment.amount), viewingPayment.currency)}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Period</p><p className="font-medium text-gray-900 dark:text-white">{viewingPayment.periodMonths} month{viewingPayment.periodMonths !== 1 ? 's' : ''}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Bank Reference</p><p className="font-mono text-gray-900 dark:text-white">{viewingPayment.bankReference || '—'}</p></div>
                          <div><p className="text-gray-500 dark:text-gray-400">Deposit Date</p><p className="font-medium text-gray-900 dark:text-white">{new Date(viewingPayment.depositDate).toLocaleDateString()}</p></div>
                        </div>
                        {viewingPayment.notes && (
                          <div><p className="text-sm text-gray-500 dark:text-gray-400">Customer Notes</p><p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 rounded p-3 text-sm">{viewingPayment.notes}</p></div>
                        )}
                        {viewingPayment.receiptUrl && (
                          <div><p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Receipt</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={viewingPayment.receiptUrl} alt="Receipt" className="max-w-full rounded border" />
                          </div>
                        )}
                        {viewingPayment.reviewNotes && (
                          <div><p className="text-sm text-gray-500 dark:text-gray-400">Review Notes</p><p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 rounded p-3 text-sm">{viewingPayment.reviewNotes}</p></div>
                        )}
                        {viewingPayment.status === 'pending' && (
                          <>
                            <hr className="dark:border-gray-700" />
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review Notes (optional)</label>
                              <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add notes..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white" rows={3} />
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => handleAction(viewingPayment.id, 'approve')} disabled={processing === viewingPayment.id} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium">
                                {processing === viewingPayment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                              </button>
                              <button onClick={() => handleAction(viewingPayment.id, 'reject')} disabled={processing === viewingPayment.id} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium">
                                <X className="w-4 h-4" /> Reject
                              </button>
                            </div>
                          </>
                        )}
                        {viewingPayment.status !== 'pending' && (
                          <div className="flex justify-center pt-2">{depositStatusBadge(viewingPayment.status)}</div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ GATEWAY TRANSACTIONS TAB ═══════════════════════════════════════ */}
      {activeTab === 'gateway' && (
        <>
          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Gateway filter */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded p-1">
              {(['all', 'mpesa', 'stripe', 'paystack', 'payhero'] as const).map((g) => {
                const meta = g !== 'all' ? GATEWAY_META[g] : null
                return (
                  <button key={g}
                    onClick={() => setGwGatewayFilter(g)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      gwGatewayFilter === g
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    {meta && <meta.Icon className={`w-3.5 h-3.5 ${meta.colour}`} />}
                    {g === 'all' ? 'All Gateways' : meta!.label}
                  </button>
                )
              })}
            </div>

            {/* Status filter */}
            <div className="flex gap-1.5">
              {(['all', 'pending', 'success', 'failed', 'cancelled'] as const).map((s) => (
                <button key={s}
                  onClick={() => setGwStatusFilter(s)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    gwStatusFilter === s
                      ? 'bg-[#00FF88] text-black'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Summary counts */}
          {!loading && gwTransactions.length > 0 && (() => {
            const counts = { mpesa: 0, stripe: 0, paystack: 0, payhero: 0 }
            const totals = { mpesa: 0, stripe: 0, paystack: 0, payhero: 0 }
            gwTransactions.forEach(tx => {
              counts[tx.gateway]++
              if (tx.status === 'success') totals[tx.gateway] += Number(tx.amount)
            })
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['mpesa', 'stripe', 'paystack', 'payhero'] as const).map((gw) => {
                  const meta = GATEWAY_META[gw]
                  return (
                    <div key={gw} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <meta.Icon className={`w-4 h-4 ${meta.colour}`} />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{meta.label}</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{counts[gw]}</p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                        {formatCurrencyWithSymbol(totals[gw], 'KES')} successful
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : gwTransactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">No transactions found</div>
            ) : (
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {['Gateway', 'Reference', 'Customer', 'Company / Sale', 'Amount', 'Context', 'Status', 'Date'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {gwTransactions.map((tx) => {
                    const meta = GATEWAY_META[tx.gateway]
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <meta.Icon className={`w-4 h-4 ${meta.colour}`} />
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{meta.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all max-w-[120px]">{tx.internalReference}</p>
                          {tx.gatewayReference && (
                            <p className="font-mono text-xs text-gray-400 mt-0.5 break-all max-w-[120px]">{tx.gatewayReference}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {tx.account ? (
                            <>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.account.fullName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{tx.account.email}</p>
                            </>
                          ) : (
                            <>
                              {tx.customerName && <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.customerName}</p>}
                              {tx.customerPhone && <p className="text-xs text-gray-500 dark:text-gray-400">{tx.customerPhone}</p>}
                              {tx.customerEmail && <p className="text-xs text-gray-500 dark:text-gray-400">{tx.customerEmail}</p>}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {tx.tenant && (
                            <p className="text-sm text-gray-800 dark:text-gray-200">{tx.tenant.name}</p>
                          )}
                          {tx.subscription?.tier && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{tx.subscription.tier.displayName}</p>
                          )}
                          {tx.sale && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Invoice #{tx.sale.invoiceNo}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrencyWithSymbol(Number(tx.amount), tx.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            tx.context === 'subscription'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {tx.context === 'subscription' ? 'Subscription' : 'POS Sale'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{gwStatusBadge(tx.status)}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {tx.completedAt
                              ? new Date(tx.completedAt).toLocaleDateString()
                              : new Date(tx.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {tx.completedAt
                              ? new Date(tx.completedAt).toLocaleTimeString()
                              : new Date(tx.createdAt).toLocaleTimeString()}
                          </p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
