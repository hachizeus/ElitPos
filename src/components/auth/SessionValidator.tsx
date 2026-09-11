'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useRef } from 'react'
import { useAuthSync } from '@/hooks'
import { broadcastAuthEvent, type AuthScope } from '@/lib/auth/events'

interface SessionValidatorProps {
  children: React.ReactNode
  /** Endpoint URL for session validation (default: /api/auth/validate) */
  validateUrl?: string
  /** Auth scope for cross-tab sync (default: 'company') */
  scope?: AuthScope
  /** Tenant slug for company-scoped logout redirect */
  tenantSlug?: string
}

/**
 * Client-side session validator that redirects to login if session is invalid.
 * Makes an API call to verify the session is still valid in the database.
 * Also handles cross-tab logout detection via useAuthSync.
 */
export function SessionValidator({
  children,
  validateUrl = '/api/auth/validate',
  scope = 'company',
  tenantSlug,
}: SessionValidatorProps) {
  const { data: session, status } = useSession()
  const [isValidating, setIsValidating] = useState(true)
  const [isValid, setIsValid] = useState(true)
  // Track whether we have already completed a successful validation so that
  // subsequent re-renders (e.g. during HMR or realtime session updates) that
  // briefly return status='loading' do NOT re-block the already-rendered UI.
  const hasValidatedRef = useRef(false)

  // Cross-tab auth sync - redirect to /login if logged out from another tab
  useAuthSync({
    pageType: 'protected',
    scope,
    sessionUrl: scope === 'account' ? '/api/account-auth/session' : '/api/auth/session',
  })

  useEffect(() => {
    async function validateSession() {
      // While status is loading, keep waiting — but only block the UI on the
      // very first validation. If we have already validated once (hasValidatedRef
      // is true), a transient 'loading' state (e.g. session refresh, HMR) should
      // not re-block the children by resetting isValidating back to true.
      if (status === 'loading') {
        if (!hasValidatedRef.current) {
          // Still on initial load — keep isValidating=true (its initial value)
          // and wait for the next effect run with a resolved status.
        }
        return
      }

      if (status === 'unauthenticated') {
        // No session at all — unblock immediately (layout will redirect, but
        // we should not hang the UI indefinitely while that happens).
        setIsValidating(false)
        return
      }

      // Determine the correct login URL based on scope
      const loginUrl = scope === 'company' && tenantSlug
        ? `/c/${tenantSlug}/login`
        : '/login'

      // If session loaded but user ID is empty, the JWT was invalidated
      // server-side (token.invalid=true zeroes out user fields).
      if (status === 'authenticated' && session?.user && !session.user.id) {
        setIsValid(false)
        setIsValidating(false)
        broadcastAuthEvent('logout', scope)
        signOut({ callbackUrl: loginUrl, redirect: true })
        return
      }

      // Make API call to verify session is still valid in the database.
      // Skip if we have already validated this session object (same reference)
      // to avoid redundant requests on re-renders that don't change the session.
      try {
        const res = await fetch(validateUrl, {
          method: 'GET',
          credentials: 'include',
        })

        if (res.status === 401) {
          setIsValid(false)
          broadcastAuthEvent('logout', scope)
          signOut({ callbackUrl: loginUrl, redirect: true })
          return
        }

        hasValidatedRef.current = true
        setIsValid(true)
      } catch {
        // Network error — assume valid so the user isn't locked out
        hasValidatedRef.current = true
        setIsValid(true)
      } finally {
        setIsValidating(false)
      }
    }

    validateSession()
  }, [session, status, validateUrl, scope, tenantSlug])

  // Show nothing while validating on first load. After the first successful
  // validation, never re-block — transient loading states (HMR, token refresh)
  // should not cause a flash of empty content.
  if (!hasValidatedRef.current && (isValidating || !isValid)) {
    return null
  }
  if (!isValid) {
    return null
  }

  return <>{children}</>
}
