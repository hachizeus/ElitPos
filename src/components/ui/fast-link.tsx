/**
 * Optimized Link component with aggressive prefetching
 * Pre-loads routes on hover for instant navigation
 */

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ComponentProps, useCallback } from 'react'

interface FastLinkProps extends Omit<ComponentProps<typeof Link>, 'prefetch'> {
  /**
   * Prefetch strategy
   * - 'hover': Prefetch on hover (default)
   * - 'visible': Prefetch when link becomes visible
   * - 'eager': Prefetch immediately
   * - false: No prefetching
   */
  prefetch?: 'hover' | 'visible' | 'eager' | false
}

export function FastLink({
  href,
  prefetch = 'hover',
  onMouseEnter,
  children,
  ...props
}: FastLinkProps) {
  const router = useRouter()

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Call original onMouseEnter if provided
      onMouseEnter?.(e)

      // Prefetch on hover
      if (prefetch === 'hover' && typeof href === 'string') {
        router.prefetch(href)
      }
    },
    [href, onMouseEnter, prefetch, router]
  )

  // For 'eager' and 'visible' prefetch, use Next.js built-in prefetch
  const nextPrefetch = prefetch === 'eager' || prefetch === 'visible'

  return (
    <Link
      href={href}
      prefetch={nextPrefetch}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </Link>
  )
}
