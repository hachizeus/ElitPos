'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from '@/components/ui/toast'
import { hasPermission } from '@/lib/auth/roles'
import {
  Smartphone, CreditCard, Zap, Globe,
  Eye, EyeOff, Save, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertCircle, ExternalLink
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface GatewaySettings {
  // M-Pesa
  mpesaEnabled: boolean
  mpesaEnvironment: string
  mpesaConsumerKey: string
  mpesaConsumerSecret: string
  mpesaShortcode: string
  mpesaPasskey: string
  mpesaCallbackBaseUrl: string
  mpesaConsumerKeyIsSet: boolean
  mpesaConsumerSecretIsSet: boolean
  mpesaPasskeyIsSet: boolean

  // Stripe
  stripeEnabled: boolean
  stripePublishableKey: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  stripeCurrency: string
  stripeSecretKeyIsSet: boolean
  stripeWebhookSecretIsSet: boolean

  // Paystack
  paystackEnabled: boolean
  paystackPublicKey: string
  paystackSecretKey: string
  paystackWebhookSecret: string
  paystackCurrency: string
  paystackSecretKeyIsSet: boolean
  paystackWebhookSecretIsSet: boolean

  // PayHero
  payheroEnabled: boolean
  payheroApiUsername: string
  payheroApiPassword: string
  payheroChannelId: string
  payheroApiPasswordIsSet: boolean
}

const EMPTY: GatewaySettings = {
  mpesaEnabled: false, mpesaEnvironment: 'sandbox',
  mpesaConsumerKey: '', mpesaConsumerSecret: '', mpesaShortcode: '',
  mpesaPasskey: '', mpesaCallbackBaseUrl: '',
  mpesaConsumerKeyIsSet: false, mpesaConsumerSecretIsSet: false, mpesaPasskeyIsSet: false,
  stripeEnabled: false, stripePublishableKey: '', stripeSecretKey: '',
  stripeWebhookSecret: '', stripeCurrency: 'KES',
  stripeSecretKeyIsSet: false, stripeWebhookSecretIsSet: false,
  paystackEnabled: false, paystackPublicKey: '', paystackSecretKey: '',
  paystackWebhookSecret: '', paystackCurrency: 'KES',
  paystackSecretKeyIsSet: false, paystackWebhookSecretIsSet: false,
  payheroEnabled: false, payheroApiUsername: '', payheroApiPassword: '',
  payheroChannelId: '', payheroApiPasswordIsSet: false,
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SecretInput({ value, isSet, onChange, placeholder, id, disabled }: {
  value: string
  isSet?: boolean
  onChange: (v: string) => void
  placeholder?: string
  id: string
  disabled?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={isSet && !value ? '••••••••  (already set — enter new value to replace)' : placeholder}
        className="w-full h-9 pr-10 pl-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        autoComplete="off"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        aria-label={visible ? 'Hide' : 'Show'}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      {isSet && !value && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2">
          <CheckCircle2 size={14} className="text-green-500" />
        </span>
      )}
    </div>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
    </label>
  )
}

function TextInput({ id, value, onChange, placeholder, disabled, className }: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={`w-full h-9 px-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ''}`}
    />
  )
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
      <CheckCircle2 size={11} /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">
      <XCircle size={11} /> Inactive
    </span>
  )
}

function GatewaySection({
  title, icon: Icon, iconBg, enabled, onToggle, canEdit, docsUrl, children, defaultOpen = false,
}: {
  title: string
  icon: React.ElementType
  iconBg: string
  enabled: boolean
  onToggle: (v: boolean) => void
  canEdit: boolean
  docsUrl?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`rounded-xl border-2 transition-colors ${enabled ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
              <StatusBadge enabled={enabled} />
            </div>
            {docsUrl && (
              <a href={docsUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5">
                Documentation <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch checked={enabled} onChange={onToggle} disabled={!canEdit} />
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-5 pt-1 border-t border-gray-100 dark:border-gray-800">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PaymentGatewaysPage() {
  const { data: session } = useSession()
  const canEdit = hasPermission(session, 'manageSettings')

  const [settings, setSettings] = useState<GatewaySettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Load
  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/payment-gateways')
      if (res.ok) {
        const data = await res.json()
        setSettings(s => ({ ...s, ...data }))
        setDirty(false)
      }
    } catch {
      toast.error('Failed to load gateway settings')
    } finally {
      setLoading(false)
    }
  }

  function update<K extends keyof GatewaySettings>(key: K, value: GatewaySettings[K]) {
    setSettings(s => ({ ...s, [key]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/payment-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast.success('Payment gateway settings saved')
        setDirty(false)
        await load() // refresh to get isSet states
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={22} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payment Gateways</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Connect payment providers your customers can use at checkout.
            Credentials are stored securely and never exposed in the browser.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
          <AlertCircle size={16} />
          You need manager or owner permissions to edit payment gateway settings.
        </div>
      )}

      {/* ── M-Pesa Daraja ─────────────────────────────────────────────── */}
      <GatewaySection
        title="M-Pesa Daraja (Safaricom)"
        icon={Smartphone}
        iconBg="bg-green-600"
        enabled={settings.mpesaEnabled}
        onToggle={v => update('mpesaEnabled', v)}
        canEdit={canEdit}
        docsUrl="https://developer.safaricom.co.ke/Documentation"
        defaultOpen={settings.mpesaEnabled}
      >
        <div className="mt-4 space-y-4">
          {/* Environment */}
          <div>
            <FieldLabel htmlFor="mpesaEnv">Environment</FieldLabel>
            <div className="flex gap-3">
              {(['sandbox', 'production'] as const).map(env => (
                <label key={env} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mpesaEnvironment"
                    value={env}
                    checked={settings.mpesaEnvironment === env}
                    onChange={() => update('mpesaEnvironment', env)}
                    disabled={!canEdit}
                    className="accent-blue-600"
                  />
                  <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                    {env}
                    {env === 'sandbox' && <span className="ml-1 text-xs text-gray-400">(testing)</span>}
                    {env === 'production' && <span className="ml-1 text-xs text-orange-500">(live)</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="mpesaShortcode">Business Shortcode</FieldLabel>
              <TextInput
                id="mpesaShortcode"
                value={settings.mpesaShortcode}
                onChange={v => update('mpesaShortcode', v)}
                placeholder="e.g. 174379"
                disabled={!canEdit}
              />
            </div>
            <div>
              <FieldLabel htmlFor="mpesaCallbackUrl">Callback Base URL</FieldLabel>
              <TextInput
                id="mpesaCallbackUrl"
                value={settings.mpesaCallbackBaseUrl}
                onChange={v => update('mpesaCallbackBaseUrl', v)}
                placeholder="https://yourapp.example.com"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-400 mt-1">Your public server URL. Safaricom will POST to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/api/mpesa/callback</code></p>
            </div>
            <div>
              <FieldLabel htmlFor="mpesaConsumerKey">Consumer Key</FieldLabel>
              <SecretInput
                id="mpesaConsumerKey"
                value={settings.mpesaConsumerKey}
                isSet={settings.mpesaConsumerKeyIsSet}
                onChange={v => update('mpesaConsumerKey', v)}
                placeholder="From Safaricom Developer Portal"
                disabled={!canEdit}
              />
            </div>
            <div>
              <FieldLabel htmlFor="mpesaConsumerSecret">Consumer Secret</FieldLabel>
              <SecretInput
                id="mpesaConsumerSecret"
                value={settings.mpesaConsumerSecret}
                isSet={settings.mpesaConsumerSecretIsSet}
                onChange={v => update('mpesaConsumerSecret', v)}
                placeholder="From Safaricom Developer Portal"
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="mpesaPasskey">STK Passkey</FieldLabel>
              <SecretInput
                id="mpesaPasskey"
                value={settings.mpesaPasskey}
                isSet={settings.mpesaPasskeyIsSet}
                onChange={v => update('mpesaPasskey', v)}
                placeholder="Lipa Na M-Pesa Online Passkey"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-300">Webhook URL to register in Safaricom portal:</p>
            <code className="block font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs break-all">
              {settings.mpesaCallbackBaseUrl || 'https://your-domain.com'}/api/mpesa/callback
            </code>
          </div>
        </div>
      </GatewaySection>

      {/* ── Stripe ────────────────────────────────────────────────────── */}
      <GatewaySection
        title="Stripe"
        icon={CreditCard}
        iconBg="bg-indigo-600"
        enabled={settings.stripeEnabled}
        onToggle={v => update('stripeEnabled', v)}
        canEdit={canEdit}
        docsUrl="https://stripe.com/docs/keys"
        defaultOpen={settings.stripeEnabled}
      >
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="stripePublishableKey">Publishable Key</FieldLabel>
              <TextInput
                id="stripePublishableKey"
                value={settings.stripePublishableKey}
                onChange={v => update('stripePublishableKey', v)}
                placeholder="pk_test_… or pk_live_…"
                disabled={!canEdit}
              />
            </div>
            <div>
              <FieldLabel htmlFor="stripeCurrency">Default Currency</FieldLabel>
              <select
                id="stripeCurrency"
                value={settings.stripeCurrency}
                onChange={e => update('stripeCurrency', e.target.value)}
                disabled={!canEdit}
                className="w-full h-9 px-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {['KES', 'USD', 'EUR', 'GBP', 'NGN', 'ZAR', 'GHS', 'UGX', 'TZS'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="stripeSecretKey">Secret Key</FieldLabel>
              <SecretInput
                id="stripeSecretKey"
                value={settings.stripeSecretKey}
                isSet={settings.stripeSecretKeyIsSet}
                onChange={v => update('stripeSecretKey', v)}
                placeholder="sk_test_… or sk_live_…"
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="stripeWebhookSecret">Webhook Signing Secret</FieldLabel>
              <SecretInput
                id="stripeWebhookSecret"
                value={settings.stripeWebhookSecret}
                isSet={settings.stripeWebhookSecretIsSet}
                onChange={v => update('stripeWebhookSecret', v)}
                placeholder="whsec_…"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-300">Webhook endpoint to add in Stripe Dashboard:</p>
            <code className="block font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs break-all">
              https://your-domain.com/api/stripe/webhook
            </code>
            <p>Listen for: <code className="bg-white dark:bg-gray-900 px-1 rounded">checkout.session.completed</code> and <code className="bg-white dark:bg-gray-900 px-1 rounded">checkout.session.expired</code></p>
          </div>
        </div>
      </GatewaySection>

      {/* ── Paystack ──────────────────────────────────────────────────── */}
      <GatewaySection
        title="Paystack"
        icon={Zap}
        iconBg="bg-teal-600"
        enabled={settings.paystackEnabled}
        onToggle={v => update('paystackEnabled', v)}
        canEdit={canEdit}
        docsUrl="https://paystack.com/docs/api/#authentication"
        defaultOpen={settings.paystackEnabled}
      >
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="paystackPublicKey">Public Key</FieldLabel>
              <TextInput
                id="paystackPublicKey"
                value={settings.paystackPublicKey}
                onChange={v => update('paystackPublicKey', v)}
                placeholder="pk_test_… or pk_live_…"
                disabled={!canEdit}
              />
            </div>
            <div>
              <FieldLabel htmlFor="paystackCurrency">Default Currency</FieldLabel>
              <select
                id="paystackCurrency"
                value={settings.paystackCurrency}
                onChange={e => update('paystackCurrency', e.target.value)}
                disabled={!canEdit}
                className="w-full h-9 px-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {['NGN', 'KES', 'GHS', 'ZAR', 'USD', 'EGP'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="paystackSecretKey">Secret Key</FieldLabel>
              <SecretInput
                id="paystackSecretKey"
                value={settings.paystackSecretKey}
                isSet={settings.paystackSecretKeyIsSet}
                onChange={v => update('paystackSecretKey', v)}
                placeholder="sk_test_… or sk_live_…"
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="paystackWebhookSecret">Webhook Secret (optional — used to verify webhook signatures)</FieldLabel>
              <SecretInput
                id="paystackWebhookSecret"
                value={settings.paystackWebhookSecret}
                isSet={settings.paystackWebhookSecretIsSet}
                onChange={v => update('paystackWebhookSecret', v)}
                placeholder="Your Paystack secret key (reused for HMAC signature)"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-300">Webhook URL for Paystack Dashboard:</p>
            <code className="block font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs break-all">
              https://your-domain.com/api/paystack/webhook
            </code>
            <p>Callback URL (redirect after payment): <code className="bg-white dark:bg-gray-900 px-1 rounded">/api/paystack/callback</code></p>
          </div>
        </div>
      </GatewaySection>

      {/* ── PayHero ───────────────────────────────────────────────────── */}
      <GatewaySection
        title="PayHero"
        icon={Globe}
        iconBg="bg-orange-500"
        enabled={settings.payheroEnabled}
        onToggle={v => update('payheroEnabled', v)}
        canEdit={canEdit}
        docsUrl="https://payhero.co.ke/developers"
        defaultOpen={settings.payheroEnabled}
      >
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="payheroApiUsername">API Username</FieldLabel>
              <TextInput
                id="payheroApiUsername"
                value={settings.payheroApiUsername}
                onChange={v => update('payheroApiUsername', v)}
                placeholder="Your PayHero API username"
                disabled={!canEdit}
              />
            </div>
            <div>
              <FieldLabel htmlFor="payheroChannelId">Channel ID</FieldLabel>
              <TextInput
                id="payheroChannelId"
                value={settings.payheroChannelId}
                onChange={v => update('payheroChannelId', v)}
                placeholder="From PayHero dashboard"
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="payheroApiPassword">API Password</FieldLabel>
              <SecretInput
                id="payheroApiPassword"
                value={settings.payheroApiPassword}
                isSet={settings.payheroApiPasswordIsSet}
                onChange={v => update('payheroApiPassword', v)}
                placeholder="Your PayHero API password"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-300">Callback URL to configure in PayHero dashboard:</p>
            <code className="block font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs break-all">
              https://your-domain.com/api/payhero/notify
            </code>
            <p>PayHero supports M-Pesa, Airtel Money, and T-Kash through a single API.</p>
          </div>
        </div>
      </GatewaySection>

      {/* Sticky save bar when dirty */}
      {canEdit && dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">You have unsaved changes</span>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { void load() }}
            disabled={saving}
            className="text-sm text-gray-300 dark:text-gray-500 hover:text-white dark:hover:text-gray-900"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  )
}
