'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function CompanyIndexPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  useEffect(() => {
    // Redirect to sales as the default workspace page
    router.replace(`/c/${slug}/sales`)
  }, [router, slug])

  return null
}
