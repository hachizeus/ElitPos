import { Metadata } from 'next'
import { generateBreadcrumbJsonLd } from '@/lib/seo/breadcrumbs'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
  title: 'About ElitPOS - Our Mission & Technology',
  description: 'Learn about ElitPOS: democratizing AI-powered business tools for every entrepreneur. Built with modern, advanced technology.',
  keywords: ['about ElitPOS', 'business software company', 'ERP company', 'AI business platform', 'POS company'],
  openGraph: {
    title: 'About ElitPOS - Building the Future of Business Management',
    description: 'Our mission: AI-powered business tools for every entrepreneur. Unlimited users, unlimited potential.',
    url: 'https://www.elitpos.elitjohnsdigital.co.ke/about',
    images: [{ url: '/og/about', width: 1200, height: 630, alt: 'About ElitPOS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About ElitPOS',
    description: 'Our mission: AI-powered business tools for every entrepreneur.',
    images: ['/og/about'],
  },
  alternates: {
    canonical: 'https://www.elitpos.elitjohnsdigital.co.ke/about',
  },
}

export default function AboutPage() {
  const breadcrumb = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/' },
    { name: 'About', url: '/about' },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumb)
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "ElitPOS",
            "url": "https://www.elitpos.elitjohnsdigital.co.ke",
            "logo": "https://www.elitpos.elitjohnsdigital.co.ke/icons/icon-512.png",
            "description": "Democratizing AI-powered business tools for every entrepreneur. All-in-one cloud POS and ERP for retail, restaurants, supermarkets, and auto service centers.",
            "foundingDate": "2024",
            "sameAs": [
              "https://www.elitpos.elitjohnsdigital.co.ke"
            ]
          })
        }}
      />
      <AboutClient />
    </>
  )
}
