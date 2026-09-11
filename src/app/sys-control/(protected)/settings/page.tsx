'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Save, CreditCard, Bell, Settings, Zap, Lock, Percent,
  Phone, Sparkles, Plus, Trash2, Tag, Copy, ToggleLeft, X, Check
} from 'lucide-react'

// ==================== TYPES ====================

interface BankDetails {
  bankName: string
  accountNumber: string
  accountName: string
  branchName: string
  swiftCode?: string
  notes?: string
}

interface SystemAnnouncement {
  enabled: boolean
  message: string
  type: 'info' | 'warning' | 'error'
}

interface BillingConfig {
  lockoutGraceDays: number
  autoDeletionDays: number
  storageWarningPercent: number
  storageCriticalPercent: number
}

interface VolumeTier {
  min: number
  max: number | null
  percent: number
}

interface ContactInfo {
  email: string
  phone: string
  whatsapp: string
  address: string
  companyName: string
  businessHours: string
}

interface SeasonalOffer {
  enabled: boolean
  title: string
  description: string
  discountPercent: number
  validUntil: string
  badgeText: string
  applicableTiers: string[]
  showOnLanding: boolean
  showOnPricing: boolean
}

interface Coupon {
  id: string
  code: string
  description: string | null
  discountType: string
  discountValue: string
  applicableTiers: string[] | null
  minBillingCycle: string | null
  maxUses: number | null
  usedCount: number
  maxUsesPerAccount: number
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CouponFormData {
  code: string
  description: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: string
  maxUses: string
  maxUsesPerAccount: string
  validFrom: string
  validUntil: string
  applicableTiers: string[]
  minBillingCycle: string
}

type TabId = 'general' | 'billing' | 'discounts' | 'contact' | 'promotions'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
  { id: 'billing', label: 'Billing', icon: <Lock className="w-4 h-4" /> },
  { id: 'discounts', label: 'Discounts', icon: <Percent className="w-4 h-4" /> },
  { id: 'contact', label: 'Contact & Branding', icon: <Phone className="w-4 h-4" /> },
  { id: 'promotions', label: 'Promotions', icon: <Sparkles className="w-4 h-4" /> },
]

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
const CARD_CLASS = 'bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700'

const emptyCouponForm: CouponFormData = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  maxUses: '',
  maxUsesPerAccount: '1',
  validFrom: '',
  validUntil: '',
  applicableTiers: [],
  minBillingCycle: '',
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Auto-dismiss toast after 3s
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  // Bank details
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bankName: '',
    accountNumber: '',
    accountName: '',
    branchName: '',
    swiftCode: '',
    notes: '',
  })

  // System announcement
  const [announcement, setAnnouncement] = useState<SystemAnnouncement>({
    enabled: false,
    message: '',
    type: 'info',
  })

  // Billing config
  const [billingConfig, setBillingConfig] = useState<BillingConfig>({
    lockoutGraceDays: 3,
    autoDeletionDays: 7,
    storageWarningPercent: 80,
    storageCriticalPercent: 95,
  })

  // Platform payment gateway credentials (for receiving subscription payments)
  const [platformGateways, setPlatformGateways] = useState({
    mpesaEnabled: false,
    mpesaEnvironment: 'sandbox' as 'sandbox' | 'production',
    mpesaConsumerKey: '',
    mpesaConsumerSecret: '',
    mpesaShortcode: '',
    mpesaPasskey: '',
    mpesaConsumerKeyIsSet: false,
    mpesaConsumerSecretIsSet: false,
    mpesaPasskeyIsSet: false,

    stripeEnabled: false,
    stripePublishableKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    stripeCurrency: 'KES',
    stripeSecretKeyIsSet: false,
    stripeWebhookSecretIsSet: false,

    paystackEnabled: false,
    paystackPublicKey: '',
    paystackSecretKey: '',
    paystackWebhookSecret: '',
    paystackCurrency: 'KES',
    paystackSecretKeyIsSet: false,
    paystackWebhookSecretIsSet: false,

    payheroEnabled: false,
    payheroApiUsername: '',
    payheroApiPassword: '',
    payheroChannelId: '',
    payheroApiPasswordIsSet: false,
  })
  const [pgwVisible, setPgwVisible] = useState<Record<string, boolean>>({})

  // Gateway status counts (how many tenants have each gateway enabled)
  const [gatewayStatus, setGatewayStatus] = useState([
    { name: 'mpesa',    label: 'M-Pesa',   count: 0 },
    { name: 'stripe',   label: 'Stripe',   count: 0 },
    { name: 'paystack', label: 'Paystack', count: 0 },
    { name: 'payhero',  label: 'PayHero',  count: 0 },
  ])

  // Volume discounts
  const [volumeTiers, setVolumeTiers] = useState<VolumeTier[]>([
    { min: 2, max: 5, percent: 15 },
    { min: 6, max: 10, percent: 25 },
    { min: 11, max: null, percent: 30 },
  ])

  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [couponForm, setCouponForm] = useState<CouponFormData>(emptyCouponForm)
  const [couponSaving, setCouponSaving] = useState(false)
  const [deletingCouponId, setDeletingCouponId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [pricingTiers, setPricingTiers] = useState<{ id: string; name: string }[]>([])

  // Contact info
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    companyName: '',
    businessHours: '',
  })

  // Seasonal offer
  const [seasonalOffer, setSeasonalOffer] = useState<SeasonalOffer>({
    enabled: false,
    title: '',
    description: '',
    discountPercent: 0,
    validUntil: '',
    badgeText: '',
    applicableTiers: [],
    showOnLanding: false,
    showOnPricing: false,
  })

  // SMS credentials for sending notifications
  const [smsCredentials, setSmsCredentials] = useState({
    provider: 'africas_talking' as 'africas_talking' | 'twilio',
    apiKey: '',
    username: '', // Africa's Talking
    senderId: '',
    accountSid: '', // Twilio
    authToken: '', // Twilio
    apiKeyIsSet: false,
    usernameIsSet: false,
    authTokenIsSet: false,
  })

  const fetchSettings = useCallback(async () => {
    try {
      // Fetch bank details
      const bankRes = await fetch('/api/sys-control/settings?key=bank_details')
      if (bankRes.ok) {
        const data = await bankRes.json()
        if (data.value) setBankDetails(prev => ({ ...prev, ...data.value }))
      }

      // Fetch announcement
      const annRes = await fetch('/api/sys-control/settings?key=system_announcement')
      if (annRes.ok) {
        const data = await annRes.json()
        if (data.value) {
          setAnnouncement(prev => ({ ...prev, ...data.value }))
        }
      }

      // Fetch billing config
      const billingRes = await fetch('/api/sys-control/settings?key=billing_config')
      if (billingRes.ok) {
        const data = await billingRes.json()
        if (data.value) setBillingConfig(prev => ({ ...prev, ...data.value }))
      }

      // Fetch platform gateway credentials
      const pgwRes = await fetch('/api/sys-control/settings?key=platform_gateways')
      if (pgwRes.ok) {
        const data = await pgwRes.json()
        if (data.value) setPlatformGateways(prev => ({ ...prev, ...data.value }))
      }

      // Fetch gateway status counts
      const gwRes = await fetch('/api/sys-control/settings?key=gateway_status')
      if (gwRes.ok) {
        const data = await gwRes.json()
        if (data.value) {
          setGatewayStatus([
            { name: 'mpesa',    label: 'M-Pesa',   count: data.value.mpesa    || 0 },
            { name: 'stripe',   label: 'Stripe',   count: data.value.stripe   || 0 },
            { name: 'paystack', label: 'Paystack', count: data.value.paystack || 0 },
            { name: 'payhero',  label: 'PayHero',  count: data.value.payhero  || 0 },
          ])
        }
      }

      // Fetch volume discounts
      const volRes = await fetch('/api/sys-control/settings?key=volume_discounts')
      if (volRes.ok) {
        const data = await volRes.json()
        if (data.value?.tiers) setVolumeTiers(data.value.tiers)
      }

      // Fetch contact info
      const contactRes = await fetch('/api/sys-control/settings?key=contact_info')
      if (contactRes.ok) {
        const data = await contactRes.json()
        if (data.value) setContactInfo(prev => ({ ...prev, ...data.value }))
      }

      // Fetch SMS credentials
      const smsRes = await fetch('/api/sys-control/settings?key=sms_credentials')
      if (smsRes.ok) {
        const data = await smsRes.json()
        if (data.value) {
          setSmsCredentials(prev => ({
            ...prev,
            ...data.value,
            apiKeyIsSet: !!data.value.apiKey,
            usernameIsSet: !!data.value.username,
            authTokenIsSet: !!data.value.authToken,
            // Clear actual values for security (only show if newly set)
            apiKey: '',
            username: data.value.provider === 'africas_talking' ? (data.value.username || '') : '',
            authToken: '',
          }))
        }
      }

      // Fetch seasonal offer
      const seasonRes = await fetch('/api/sys-control/settings?key=seasonal_offer')
      if (seasonRes.ok) {
        const data = await seasonRes.json()
        if (data.value) setSeasonalOffer(prev => ({ ...prev, ...data.value }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCoupons = useCallback(async () => {
    setCouponsLoading(true)
    try {
      const res = await fetch('/api/sys-control/coupons')
      if (res.ok) {
        const data = await res.json()
        setCoupons(data)
      }
    } catch (error) {
      console.error('Failed to fetch coupons:', error)
    } finally {
      setCouponsLoading(false)
    }
  }, [])

  const fetchPricingTiers = useCallback(async () => {
    try {
      const res = await fetch('/api/sys-control/pricing-tiers')
      if (res.ok) {
        const data = await res.json()
        setPricingTiers(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))
      }
    } catch (error) {
      console.error('Failed to fetch pricing tiers:', error)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Fetch coupons & tiers when Discounts tab is active
  useEffect(() => {
    if (activeTab === 'discounts') {
      fetchCoupons()
      fetchPricingTiers()
    }
  }, [activeTab, fetchCoupons, fetchPricingTiers])

  const saveSetting = async (key: string, value: unknown, description: string) => {
    setSaving(key)
    try {
      const res = await fetch('/api/sys-control/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, description }),
      })

      if (!res.ok) {
        throw new Error('Failed to save')
      }

      setToast({ type: 'success', message: 'Settings saved successfully!' })
    } catch (error) {
      console.error('Failed to save setting:', error)
      setToast({ type: 'error', message: 'Failed to save settings' })
    } finally {
      setSaving(null)
    }
  }

  // ==================== COUPON HANDLERS ====================

  const handleCreateCoupon = async () => {
    if (!couponForm.code.trim()) {
      setToast({ type: 'error', message: 'Coupon code is required' })
      return
    }
    if (!couponForm.discountValue || Number(couponForm.discountValue) <= 0) {
      setToast({ type: 'error', message: 'Discount value must be greater than 0' })
      return
    }

    setCouponSaving(true)
    try {
      const res = await fetch('/api/sys-control/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponForm.code,
          description: couponForm.description || null,
          discountType: couponForm.discountType,
          discountValue: couponForm.discountValue,
          maxUses: couponForm.maxUses ? parseInt(couponForm.maxUses) : null,
          maxUsesPerAccount: couponForm.maxUsesPerAccount ? parseInt(couponForm.maxUsesPerAccount) : 1,
          validFrom: couponForm.validFrom || null,
          validUntil: couponForm.validUntil || null,
          applicableTiers: couponForm.applicableTiers.length > 0 ? couponForm.applicableTiers : null,
          minBillingCycle: couponForm.minBillingCycle || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create coupon')
      }

      setToast({ type: 'success', message: 'Coupon created successfully!' })
      setCouponForm(emptyCouponForm)
      setShowCouponForm(false)
      fetchCoupons()
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to create coupon' })
    } finally {
      setCouponSaving(false)
    }
  }

  const handleToggleCoupon = async (coupon: Coupon) => {
    try {
      const res = await fetch(`/api/sys-control/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      })

      if (!res.ok) throw new Error('Failed to update coupon')

      setToast({ type: 'success', message: `Coupon ${coupon.isActive ? 'deactivated' : 'activated'}` })
      fetchCoupons()
    } catch (error) {
      console.error('Failed to toggle coupon:', error)
      setToast({ type: 'error', message: 'Failed to update coupon' })
    }
  }

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon? This cannot be undone.')) return

    setDeletingCouponId(id)
    try {
      const res = await fetch(`/api/sys-control/coupons/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete coupon')

      setToast({ type: 'success', message: 'Coupon deleted' })
      fetchCoupons()
    } catch (error) {
      console.error('Failed to delete coupon:', error)
      setToast({ type: 'error', message: 'Failed to delete coupon' })
    } finally {
      setDeletingCouponId(null)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleTierCheckbox = (tierId: string, checked: boolean) => {
    setCouponForm(prev => ({
      ...prev,
      applicableTiers: checked
        ? [...prev.applicableTiers, tierId]
        : prev.applicableTiers.filter(id => id !== tierId),
    }))
  }

  // ==================== LOADING STATE ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded shadow-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6" />
          System Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure global system settings</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1: GENERAL ==================== */}
      {activeTab === 'general' && (
        <div className="space-y-8">
          {/* System Announcement */}
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5" />
                System Announcement
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Display a banner message to all users
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="announcement-enabled"
                  checked={announcement.enabled}
                  onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <label htmlFor="announcement-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable announcement
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Announcement Type
                </label>
                <select
                  value={announcement.type}
                  onChange={(e) => setAnnouncement({ ...announcement, type: e.target.value as 'info' | 'warning' | 'error' })}
                  className={INPUT_CLASS}
                >
                  <option value="info">Info (Blue)</option>
                  <option value="warning">Warning (Yellow)</option>
                  <option value="error">Critical (Red)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  value={announcement.message}
                  onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                  rows={3}
                  placeholder="Enter the announcement message..."
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Bank Details for Payments
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                These details will be shown to users when they submit bank deposits
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankDetails.bankName}
                    onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                    placeholder="e.g., Commercial Bank of Ceylon"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                    placeholder="e.g., 8012345678"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={bankDetails.accountName}
                    onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                    placeholder="e.g., Smart POS Solutions (Pvt) Ltd"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={bankDetails.branchName}
                    onChange={(e) => setBankDetails({ ...bankDetails, branchName: e.target.value })}
                    placeholder="e.g., Colombo Main Branch"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SWIFT Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={bankDetails.swiftCode || ''}
                    onChange={(e) => setBankDetails({ ...bankDetails, swiftCode: e.target.value })}
                    placeholder="e.g., CABORLX"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={bankDetails.notes || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g., Please include your company name as reference"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Payment Gateway Status */}
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Gateways
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Each company configures their own payment gateways in Settings → Payment Gateways.
                Status below reflects the number of active tenants per gateway.
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {gatewayStatus.map((gw) => (
                  <div key={gw.name} className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${gw.count > 0 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-500'}`} />
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{gw.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{gw.count}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {gw.count === 1 ? 'tenant active' : 'tenants active'}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                To configure gateways for a specific company, go to that company&apos;s tenant dashboard → Settings → Payment Gateways.
              </p>
            </div>
          </div>

          {/* Save button for General tab */}
          <div className="flex gap-3">
            <button
              onClick={() => saveSetting('system_announcement', announcement, 'System-wide announcement banner')}
              disabled={saving === 'system_announcement'}
              className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
            >
              {saving === 'system_announcement' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Announcement
            </button>
            <button
              onClick={() => saveSetting('bank_details', bankDetails, 'Bank details for payment deposits')}
              disabled={saving === 'bank_details'}
              className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
            >
              {saving === 'bank_details' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Bank Details
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: BILLING ==================== */}
      {activeTab === 'billing' && (
        <div className="space-y-8">
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Billing & Lockout Configuration
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Control lockout grace periods and storage thresholds
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lockout Grace Period (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="14"
                    value={billingConfig.lockoutGraceDays}
                    onChange={(e) => setBillingConfig({ ...billingConfig, lockoutGraceDays: parseInt(e.target.value) || 3 })}
                    className={INPUT_CLASS}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Days after subscription expires before locking</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Auto-Deletion (days after lock)
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={billingConfig.autoDeletionDays}
                    onChange={(e) => setBillingConfig({ ...billingConfig, autoDeletionDays: parseInt(e.target.value) || 7 })}
                    className={INPUT_CLASS}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Days after lockout before data is permanently deleted</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Storage Warning Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="99"
                    value={billingConfig.storageWarningPercent}
                    onChange={(e) => setBillingConfig({ ...billingConfig, storageWarningPercent: parseInt(e.target.value) || 80 })}
                    className={INPUT_CLASS}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Send warning when storage usage reaches this %</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Storage Critical Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="80"
                    max="100"
                    value={billingConfig.storageCriticalPercent}
                    onChange={(e) => setBillingConfig({ ...billingConfig, storageCriticalPercent: parseInt(e.target.value) || 95 })}
                    className={INPUT_CLASS}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Send critical alert when storage reaches this %</p>
                </div>
              </div>
              <div className="pt-4">
                <button
                  onClick={() => saveSetting('billing_config', billingConfig, 'Billing and lockout configuration')}
                  disabled={saving === 'billing_config'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
                >
                  {saving === 'billing_config' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Billing Config
                </button>
              </div>
            </div>
          </div>

          {/* Platform Payment Gateways — credentials the platform owner uses to receive subscription payments */}
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Platform Payment Gateways
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Your credentials for receiving subscription payments from clients.
                Secret keys are stored encrypted and never exposed in the browser.
              </p>
            </div>
            <div className="p-6 space-y-6">

              {/* ── M-Pesa ── */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">M</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">M-Pesa Daraja (Safaricom)</span>
                    {platformGateways.mpesaEnabled && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Active</span>}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={platformGateways.mpesaEnabled} onChange={e => setPlatformGateways(p => ({ ...p, mpesaEnabled: e.target.checked }))} className="sr-only" />
                    <div className={`w-10 h-6 rounded-full transition-colors ${platformGateways.mpesaEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${platformGateways.mpesaEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="mpesaEnv" checked={platformGateways.mpesaEnvironment === 'sandbox'} onChange={() => setPlatformGateways(p => ({ ...p, mpesaEnvironment: 'sandbox' }))} className="accent-green-600" /><span className="text-gray-700 dark:text-gray-300">Sandbox</span></label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="mpesaEnv" checked={platformGateways.mpesaEnvironment === 'production'} onChange={() => setPlatformGateways(p => ({ ...p, mpesaEnvironment: 'production' }))} className="accent-orange-600" /><span className="text-gray-700 dark:text-gray-300">Production</span></label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Business Shortcode</label><input type="text" value={platformGateways.mpesaShortcode} onChange={e => setPlatformGateways(p => ({ ...p, mpesaShortcode: e.target.value }))} placeholder="e.g. 174379" className={INPUT_CLASS} /></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Consumer Key {platformGateways.mpesaConsumerKeyIsSet && !platformGateways.mpesaConsumerKey && <span className="text-green-500 ml-1">✓ set</span>}</label><input type={pgwVisible['mpesaConsumerKey'] ? 'text' : 'password'} value={platformGateways.mpesaConsumerKey} onChange={e => setPlatformGateways(p => ({ ...p, mpesaConsumerKey: e.target.value }))} placeholder={platformGateways.mpesaConsumerKeyIsSet ? '(already set — enter to replace)' : 'Consumer Key'} className={INPUT_CLASS} autoComplete="off" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Consumer Secret {platformGateways.mpesaConsumerSecretIsSet && !platformGateways.mpesaConsumerSecret && <span className="text-green-500 ml-1">✓ set</span>}</label><input type={pgwVisible['mpesaConsumerSecret'] ? 'text' : 'password'} value={platformGateways.mpesaConsumerSecret} onChange={e => setPlatformGateways(p => ({ ...p, mpesaConsumerSecret: e.target.value }))} placeholder={platformGateways.mpesaConsumerSecretIsSet ? '(already set)' : 'Consumer Secret'} className={INPUT_CLASS} autoComplete="off" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">STK Passkey {platformGateways.mpesaPasskeyIsSet && !platformGateways.mpesaPasskey && <span className="text-green-500 ml-1">✓ set</span>}</label><input type={pgwVisible['mpesaPasskey'] ? 'text' : 'password'} value={platformGateways.mpesaPasskey} onChange={e => setPlatformGateways(p => ({ ...p, mpesaPasskey: e.target.value }))} placeholder={platformGateways.mpesaPasskeyIsSet ? '(already set)' : 'Passkey'} className={INPUT_CLASS} autoComplete="off" /></div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">M-Pesa callback: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/api/mpesa/callback</code></p>
                </div>
              </div>

              {/* ── Stripe ── */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">S</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">Stripe</span>
                    {platformGateways.stripeEnabled && <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">Active</span>}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={platformGateways.stripeEnabled} onChange={e => setPlatformGateways(p => ({ ...p, stripeEnabled: e.target.checked }))} className="sr-only" />
                    <div className={`w-10 h-6 rounded-full transition-colors ${platformGateways.stripeEnabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${platformGateways.stripeEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Publishable Key</label><input type="text" value={platformGateways.stripePublishableKey} onChange={e => setPlatformGateways(p => ({ ...p, stripePublishableKey: e.target.value }))} placeholder="pk_live_… or pk_test_…" className={INPUT_CLASS} /></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label><select value={platformGateways.stripeCurrency} onChange={e => setPlatformGateways(p => ({ ...p, stripeCurrency: e.target.value }))} className={INPUT_CLASS}>{['KES','USD','EUR','GBP','NGN','ZAR','GHS','UGX'].map(c => <option key={c}>{c}</option>)}</select></div>
                    <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Secret Key {platformGateways.stripeSecretKeyIsSet && !platformGateways.stripeSecretKey && <span className="text-green-500 ml-1">✓ set</span>}</label><input type="password" value={platformGateways.stripeSecretKey} onChange={e => setPlatformGateways(p => ({ ...p, stripeSecretKey: e.target.value }))} placeholder={platformGateways.stripeSecretKeyIsSet ? '(already set)' : 'sk_live_… or sk_test_…'} className={INPUT_CLASS} autoComplete="off" /></div>
                    <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Webhook Secret {platformGateways.stripeWebhookSecretIsSet && !platformGateways.stripeWebhookSecret && <span className="text-green-500 ml-1">✓ set</span>}</label><input type="password" value={platformGateways.stripeWebhookSecret} onChange={e => setPlatformGateways(p => ({ ...p, stripeWebhookSecret: e.target.value }))} placeholder={platformGateways.stripeWebhookSecretIsSet ? '(already set)' : 'whsec_…'} className={INPUT_CLASS} autoComplete="off" /></div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Webhook endpoint: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/api/stripe/webhook</code></p>
                </div>
              </div>

              {/* ── Paystack ── */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">P</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">Paystack</span>
                    {platformGateways.paystackEnabled && <span className="text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-0.5 rounded-full font-medium">Active</span>}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={platformGateways.paystackEnabled} onChange={e => setPlatformGateways(p => ({ ...p, paystackEnabled: e.target.checked }))} className="sr-only" />
                    <div className={`w-10 h-6 rounded-full transition-colors ${platformGateways.paystackEnabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${platformGateways.paystackEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Public Key</label><input type="text" value={platformGateways.paystackPublicKey} onChange={e => setPlatformGateways(p => ({ ...p, paystackPublicKey: e.target.value }))} placeholder="pk_live_… or pk_test_…" className={INPUT_CLASS} /></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label><select value={platformGateways.paystackCurrency} onChange={e => setPlatformGateways(p => ({ ...p, paystackCurrency: e.target.value }))} className={INPUT_CLASS}>{['KES','NGN','GHS','ZAR','USD','EGP'].map(c => <option key={c}>{c}</option>)}</select></div>
                    <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Secret Key {platformGateways.paystackSecretKeyIsSet && !platformGateways.paystackSecretKey && <span className="text-green-500 ml-1">✓ set</span>}</label><input type="password" value={platformGateways.paystackSecretKey} onChange={e => setPlatformGateways(p => ({ ...p, paystackSecretKey: e.target.value }))} placeholder={platformGateways.paystackSecretKeyIsSet ? '(already set)' : 'sk_live_…'} className={INPUT_CLASS} autoComplete="off" /></div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Webhook: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/api/paystack/webhook</code> · Callback: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/api/paystack/callback</code></p>
                </div>
              </div>

              {/* ── PayHero ── */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">H</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">PayHero</span>
                    {platformGateways.payheroEnabled && <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">Active</span>}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={platformGateways.payheroEnabled} onChange={e => setPlatformGateways(p => ({ ...p, payheroEnabled: e.target.checked }))} className="sr-only" />
                    <div className={`w-10 h-6 rounded-full transition-colors ${platformGateways.payheroEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${platformGateways.payheroEnabled ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">API Username</label><input type="text" value={platformGateways.payheroApiUsername} onChange={e => setPlatformGateways(p => ({ ...p, payheroApiUsername: e.target.value }))} placeholder="PayHero API username" className={INPUT_CLASS} /></div>
                    <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Channel ID</label><input type="text" value={platformGateways.payheroChannelId} onChange={e => setPlatformGateways(p => ({ ...p, payheroChannelId: e.target.value }))} placeholder="From PayHero dashboard" className={INPUT_CLASS} /></div>
                    <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">API Password {platformGateways.payheroApiPasswordIsSet && !platformGateways.payheroApiPassword && <span className="text-green-500 ml-1">✓ set</span>}</label><input type="password" value={platformGateways.payheroApiPassword} onChange={e => setPlatformGateways(p => ({ ...p, payheroApiPassword: e.target.value }))} placeholder={platformGateways.payheroApiPasswordIsSet ? '(already set)' : 'API password'} className={INPUT_CLASS} autoComplete="off" /></div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Callback URL: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/api/payhero/notify</code></p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={async () => {
                    // Strip masked placeholder values before saving
                    const toSave: Record<string, unknown> = {}
                    for (const [k, v] of Object.entries(platformGateways)) {
                      if (typeof v === 'string' && (v === '(already set)' || v === '(already set — enter to replace)')) continue
                      if (k.endsWith('IsSet')) continue
                      toSave[k] = v
                    }
                    await saveSetting('platform_gateways', toSave, 'Platform payment gateway credentials')
                  }}
                  disabled={saving === 'platform_gateways'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
                >
                  {saving === 'platform_gateways' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Gateway Credentials
                </button>
              </div>
            </div>
          </div>

          {/* SMS Notification Credentials */}
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Phone className="w-5 h-5" />
                SMS Notification Credentials
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure SMS provider for sending notification messages to users
              </p>
            </div>
            <div className="p-6 space-y-6">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  SMS Provider
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={smsCredentials.provider === 'africas_talking'}
                      onChange={() => setSmsCredentials(p => ({ ...p, provider: 'africas_talking' }))}
                      className="accent-green-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Africa's Talking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={smsCredentials.provider === 'twilio'}
                      onChange={() => setSmsCredentials(p => ({ ...p, provider: 'twilio' }))}
                      className="accent-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Twilio</span>
                  </label>
                </div>
              </div>

              {/* Africa's Talking Credentials */}
              {smsCredentials.provider === 'africas_talking' && (
                <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Username {smsCredentials.usernameIsSet && !smsCredentials.username && <span className="text-green-500 ml-1">✓ set</span>}
                      </label>
                      <input
                        type="text"
                        value={smsCredentials.username}
                        onChange={e => setSmsCredentials(p => ({ ...p, username: e.target.value }))}
                        placeholder="sandbox or your username"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        API Key {smsCredentials.apiKeyIsSet && !smsCredentials.apiKey && <span className="text-green-500 ml-1">✓ set</span>}
                      </label>
                      <input
                        type="password"
                        value={smsCredentials.apiKey}
                        onChange={e => setSmsCredentials(p => ({ ...p, apiKey: e.target.value }))}
                        placeholder="Enter API key"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Sender ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={smsCredentials.senderId}
                        onChange={e => setSmsCredentials(p => ({ ...p, senderId: e.target.value }))}
                        placeholder="e.g. ELITPOS"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Get your API credentials from <a href="https://account.africastalking.com/" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Africa's Talking Dashboard</a>
                  </p>
                </div>
              )}

              {/* Twilio Credentials */}
              {smsCredentials.provider === 'twilio' && (
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Account SID
                      </label>
                      <input
                        type="text"
                        value={smsCredentials.accountSid}
                        onChange={e => setSmsCredentials(p => ({ ...p, accountSid: e.target.value }))}
                        placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Auth Token {smsCredentials.authTokenIsSet && !smsCredentials.authToken && <span className="text-green-500 ml-1">✓ set</span>}
                      </label>
                      <input
                        type="password"
                        value={smsCredentials.authToken}
                        onChange={e => setSmsCredentials(p => ({ ...p, authToken: e.target.value }))}
                        placeholder="Enter auth token"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Phone Number / Sender ID
                      </label>
                      <input
                        type="text"
                        value={smsCredentials.senderId}
                        onChange={e => setSmsCredentials(p => ({ ...p, senderId: e.target.value }))}
                        placeholder="+1234567890"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Get your API credentials from <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Twilio Console</a>
                  </p>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={async () => {
                    const toSave: Record<string, unknown> = {}
                    for (const [k, v] of Object.entries(smsCredentials)) {
                      if (k.endsWith('IsSet')) continue
                      toSave[k] = v
                    }
                    await saveSetting('sms_credentials', toSave, 'SMS notification credentials')
                  }}
                  disabled={saving === 'sms_credentials'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
                >
                  {saving === 'sms_credentials' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save SMS Credentials
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: DISCOUNTS ==================== */}
      {activeTab === 'discounts' && (
        <div className="space-y-8">
          {/* Volume Discount Tiers */}
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Percent className="w-5 h-5" />
                Volume Discount Tiers
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Discounts applied when an account has multiple active companies
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                {volumeTiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        min="1"
                        value={tier.min}
                        onChange={(e) => {
                          const updated = [...volumeTiers]
                          updated[index] = { ...tier, min: parseInt(e.target.value) || 1 }
                          setVolumeTiers(updated)
                        }}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-center"
                      />
                      <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
                      <input
                        type="number"
                        min="1"
                        value={tier.max ?? ''}
                        onChange={(e) => {
                          const updated = [...volumeTiers]
                          updated[index] = { ...tier, max: e.target.value ? parseInt(e.target.value) : null }
                          setVolumeTiers(updated)
                        }}
                        placeholder="No limit"
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-center"
                      />
                      <span className="text-gray-500 dark:text-gray-400 text-sm">companies</span>
                      <span className="text-gray-500 dark:text-gray-400 mx-1">=</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tier.percent}
                        onChange={(e) => {
                          const updated = [...volumeTiers]
                          updated[index] = { ...tier, percent: parseInt(e.target.value) || 0 }
                          setVolumeTiers(updated)
                        }}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-center"
                      />
                      <span className="text-gray-500 dark:text-gray-400 text-sm">% off</span>
                    </div>
                    <button
                      onClick={() => setVolumeTiers(volumeTiers.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setVolumeTiers([...volumeTiers, { min: 1, max: null, percent: 0 }])}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="w-4 h-4" />
                Add tier
              </button>
              <div className="pt-4">
                <button
                  onClick={() => saveSetting('volume_discounts', { tiers: volumeTiers }, 'Volume discount tiers')}
                  disabled={saving === 'volume_discounts'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
                >
                  {saving === 'volume_discounts' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Volume Discounts
                </button>
              </div>
            </div>
          </div>

          {/* Coupon Codes */}
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Coupon Codes
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage discount coupon codes for subscriptions
                </p>
              </div>
              <button
                onClick={() => {
                  setCouponForm(emptyCouponForm)
                  setShowCouponForm(!showCouponForm)
                }}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                {showCouponForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showCouponForm ? 'Cancel' : 'Create Coupon'}
              </button>
            </div>

            {/* Create coupon form */}
            {showCouponForm && (
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">New Coupon</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Code *
                    </label>
                    <input
                      type="text"
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., WELCOME20"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={couponForm.description}
                      onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                      placeholder="e.g., Welcome discount for new users"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discount Type
                    </label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as 'percentage' | 'fixed_amount' })}
                      className={INPUT_CLASS}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed_amount">Fixed Amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Discount Value *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                      placeholder={couponForm.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Uses (total)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={couponForm.maxUses}
                      onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                      placeholder="Unlimited"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Uses Per Account
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={couponForm.maxUsesPerAccount}
                      onChange={(e) => setCouponForm({ ...couponForm, maxUsesPerAccount: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      value={couponForm.validFrom}
                      onChange={(e) => setCouponForm({ ...couponForm, validFrom: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valid Until
                    </label>
                    <input
                      type="date"
                      value={couponForm.validUntil}
                      onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Billing Cycle
                    </label>
                    <select
                      value={couponForm.minBillingCycle}
                      onChange={(e) => setCouponForm({ ...couponForm, minBillingCycle: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="">Any</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                </div>

                {/* Applicable Tiers checkboxes */}
                {pricingTiers.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Applicable Tiers (leave empty for all)
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {pricingTiers.map(tier => (
                        <label key={tier.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={couponForm.applicableTiers.includes(tier.id)}
                            onChange={(e) => handleTierCheckbox(tier.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                          />
                          {tier.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleCreateCoupon}
                    disabled={couponSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    {couponSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Coupon
                  </button>
                  <button
                    onClick={() => setShowCouponForm(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Coupons table */}
            <div className="p-6">
              {couponsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No coupon codes yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Code</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Type</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Value</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Max Uses</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Used</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Valid Until</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Active</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.map(coupon => (
                        <tr key={coupon.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-3 px-2">
                            <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100">
                              {coupon.code}
                            </code>
                          </td>
                          <td className="py-3 px-2 text-gray-700 dark:text-gray-300 capitalize">
                            {coupon.discountType === 'fixed_amount' ? 'Fixed' : 'Percentage'}
                          </td>
                          <td className="py-3 px-2 text-gray-900 dark:text-white font-medium">
                            {coupon.discountType === 'percentage'
                              ? `${coupon.discountValue}%`
                              : `KSh ${coupon.discountValue}`
                            }
                          </td>
                          <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                            {coupon.maxUses ?? 'Unlimited'}
                          </td>
                          <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                            {coupon.usedCount}
                          </td>
                          <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                            {coupon.validUntil
                              ? new Date(coupon.validUntil).toLocaleDateString()
                              : 'No expiry'
                            }
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              coupon.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {coupon.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleCopyCode(coupon.code)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                title="Copy code"
                              >
                                {copiedCode === coupon.code ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleToggleCoupon(coupon)}
                                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                  coupon.isActive
                                    ? 'text-green-500 hover:text-orange-500'
                                    : 'text-gray-400 hover:text-green-500'
                                }`}
                                title={coupon.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <ToggleLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(coupon.id)}
                                disabled={deletingCouponId === coupon.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingCouponId === coupon.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: CONTACT & BRANDING ==================== */}
      {activeTab === 'contact' && (
        <div className="space-y-8">
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contact Information
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Shown on landing page, support page, and footer
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={contactInfo.companyName}
                    onChange={(e) => setContactInfo({ ...contactInfo, companyName: e.target.value })}
                    placeholder="ElitPOS"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                    placeholder="info@elitjohnsdigital.co.ke"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={contactInfo.phone}
                    onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                    placeholder="+94 11 234 5678"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={contactInfo.whatsapp}
                    onChange={(e) => setContactInfo({ ...contactInfo, whatsapp: e.target.value })}
                    placeholder="+94 77 123 4567"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <input
                    type="text"
                    value={contactInfo.address}
                    onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
                    placeholder="Colombo, Sri Lanka"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Hours</label>
                  <input
                    type="text"
                    value={contactInfo.businessHours}
                    onChange={(e) => setContactInfo({ ...contactInfo, businessHours: e.target.value })}
                    placeholder="Mon-Fri 9:00 AM - 6:00 PM (IST)"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="pt-4">
                <button
                  onClick={() => saveSetting('contact_info', contactInfo, 'Public contact information')}
                  disabled={saving === 'contact_info'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
                >
                  {saving === 'contact_info' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Contact Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: PROMOTIONS ==================== */}
      {activeTab === 'promotions' && (
        <div className="space-y-8">
          <div className={CARD_CLASS}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Seasonal Offer / Promotion
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Display a promotional banner on landing and pricing pages
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="seasonal-enabled"
                  checked={seasonalOffer.enabled}
                  onChange={(e) => setSeasonalOffer({ ...seasonalOffer, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                />
                <label htmlFor="seasonal-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable seasonal offer
                </label>
              </div>
              {seasonalOffer.enabled && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                      <input
                        type="text"
                        value={seasonalOffer.title}
                        onChange={(e) => setSeasonalOffer({ ...seasonalOffer, title: e.target.value })}
                        placeholder="New Year Special!"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Badge Text</label>
                      <input
                        type="text"
                        value={seasonalOffer.badgeText}
                        onChange={(e) => setSeasonalOffer({ ...seasonalOffer, badgeText: e.target.value })}
                        placeholder="LIMITED TIME"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={seasonalOffer.discountPercent}
                        onChange={(e) => setSeasonalOffer({ ...seasonalOffer, discountPercent: parseInt(e.target.value) || 0 })}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valid Until</label>
                      <input
                        type="date"
                        value={seasonalOffer.validUntil}
                        onChange={(e) => setSeasonalOffer({ ...seasonalOffer, validUntil: e.target.value })}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea
                      value={seasonalOffer.description}
                      onChange={(e) => setSeasonalOffer({ ...seasonalOffer, description: e.target.value })}
                      rows={2}
                      placeholder="Get started with our special pricing..."
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={seasonalOffer.showOnLanding}
                        onChange={(e) => setSeasonalOffer({ ...seasonalOffer, showOnLanding: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                      />
                      Show on landing page
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={seasonalOffer.showOnPricing}
                        onChange={(e) => setSeasonalOffer({ ...seasonalOffer, showOnPricing: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                      />
                      Show on pricing page
                    </label>
                  </div>
                </>
              )}
              <div className="pt-4">
                <button
                  onClick={() => saveSetting('seasonal_offer', seasonalOffer, 'Seasonal promotional offer')}
                  disabled={saving === 'seasonal_offer'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00FF88] text-black rounded hover:bg-[#00e67a] transition-colors disabled:opacity-50"
                >
                  {saving === 'seasonal_offer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Seasonal Offer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
