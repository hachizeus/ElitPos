'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Store, User, Lock, Building2, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ElitPOS'

interface TenantAssignment {
  tenantId: string
  tenantName: string
  tenantSlug: string
  businessType: string
  role: string
}

interface InviteData {
  email: string
  invitedBy: string
  expiresAt: string
  tenantAssignments: TenantAssignment[]
  hasExistingAccount: boolean
}

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [acceptedCompanies, setAcceptedCompanies] = useState<TenantAssignment[]>([])

  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/invites/${token}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Invalid invite')
          return
        }
        setInvite(data)
      } catch {
        setError('Failed to load invite')
      } finally {
        setLoading(false)
      }
    }
    fetchInvite()
  }, [token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!invite?.hasExistingAccount) {
      if (!formData.fullName.trim()) {
        setError('Please enter your name')
        return
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }

    setAccepting(true)

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          invite?.hasExistingAccount
            ? {}
            : {
                fullName: formData.fullName.trim(),
                password: formData.password,
              }
        ),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to accept invite')
        setAccepting(false)
        return
      }

      // Store accepted companies for the success screen redirect
      setAcceptedCompanies(invite?.tenantAssignments ?? [])
    } catch {
      setError('Failed to accept invite')
      setAccepting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span className="text-gray-600 dark:text-gray-400">Loading invite...</span>
        </div>
      </div>
    )
  }

  // ── Invalid / expired ────────────────────────────────────────────────────────

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid Invite</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <Link href="/login">
              <Button>Go to Login</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (acceptedCompanies.length > 0) {
    // Determine where to redirect:
    // If there is exactly one company, send directly to its login page.
    // If multiple, go to the account dashboard login.
    const firstCompany = acceptedCompanies[0]
    const loginHref = firstCompany?.tenantSlug
      ? `/c/${firstCompany.tenantSlug}/login`
      : '/login'

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invite Accepted!</h2>

            {acceptedCompanies.length === 1 ? (
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                You now have access to{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {firstCompany.tenantName}
                </span>{' '}
                as a{' '}
                <span className="capitalize font-semibold">{firstCompany.role.replace('_', ' ')}</span>.
              </p>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                You now have access to {acceptedCompanies.length} companies.
              </p>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Sign in to get started.
            </p>

            <Link href={loginHref}>
              <Button className="w-full">
                Sign In{firstCompany?.tenantName ? ` to ${firstCompany.tenantName}` : ''}
              </Button>
            </Link>

            {acceptedCompanies.length > 1 && (
              <Link href="/login" className="block mt-3 text-sm text-blue-600 hover:underline">
                Choose a different company
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Accept form ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-lg w-full">

        {/* Header — uses env var, not hardcoded "Smart POS" */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-green-600 rounded-md flex items-center justify-center text-white">
            <Store size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{APP_NAME}</h1>
            <p className="text-gray-500 text-sm">Business Management System</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              You&apos;ve Been Invited
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {invite?.invitedBy}
              </span>{' '}
              has invited you to join
            </p>
          </div>

          {/* Companies */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              You&apos;ll have access to:
            </p>
            <div className="space-y-2">
              {invite?.tenantAssignments.map((t) => (
                <div
                  key={t.tenantId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-green-700 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {t.tenantName}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {t.businessType.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full capitalize font-medium">
                    {t.role.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {invite?.hasExistingAccount ? (
            // ── Existing account path ────────────────────────────────────────
            <div>
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-800 dark:text-blue-300 text-sm">
                  Accepting as{' '}
                  <span className="font-semibold">{invite.email}</span>
                </p>
              </div>
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full"
              >
                {accepting ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invite'
                )}
              </Button>
            </div>
          ) : (
            // ── New account path ─────────────────────────────────────────────
            <form onSubmit={handleAccept} className="space-y-4">
              {/* Email — read-only, shown for context */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Invitation email</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{invite?.email}</p>
              </div>

              <div>
                <Label htmlFor="fullName">Your Full Name</Label>
                <div className="relative mt-1">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                    }
                    placeholder="John Doe"
                    className="pl-10"
                    required
                    autoFocus
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Create a Password</Label>
                <div className="relative mt-1">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="At least 8 characters"
                    className="pl-10"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum 8 characters
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative mt-1">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    placeholder="Re-enter your password"
                    className="pl-10"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button type="submit" disabled={accepting} className="w-full mt-2">
                {accepting ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Creating your account...
                  </>
                ) : (
                  'Accept &amp; Create Account'
                )}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
