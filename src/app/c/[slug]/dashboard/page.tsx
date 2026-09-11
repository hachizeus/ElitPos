import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Redirect /c/[slug]/dashboard → /c/[slug]/sales
 * 
 * Many breadcrumb links historically pointed to /dashboard,
 * but there is no actual dashboard page. Sales is the default workspace view.
 */
export default async function DashboardRedirect({ params }: Props) {
  const { slug } = await params
  redirect(`/c/${slug}/sales`)
}
