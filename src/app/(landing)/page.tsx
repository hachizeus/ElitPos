import { Metadata } from 'next'
import { generateBreadcrumbJsonLd } from '@/lib/seo/breadcrumbs'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: 'ElitPOS - AI-Powered POS & Business Management for Everyone',
  description: 'All-in-one cloud POS and ERP with AI features for retail, restaurants, supermarkets, and auto service. Unlimited users. All features on every plan. Free forever.',
  keywords: ['POS system', 'point of sale', 'ERP software', 'AI business management', 'retail POS', 'restaurant management', 'inventory management', 'free POS system', 'cloud ERP', 'unlimited users', 'supermarket POS', 'auto service software'],
  openGraph: {
    title: 'ElitPOS - AI-Powered POS & Business Management',
    description: 'Unlimited users. AI-assisted insights. All features on every plan. Free to start.',
    url: 'https://www.elitpos.elitjohnsdigital.co.ke/',
    images: [{ url: '/og/home', width: 1200, height: 630, alt: 'ElitPOS - AI-Powered POS & Business Management' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ElitPOS - AI-Powered POS & Business Management',
    description: 'Unlimited users. AI-assisted insights. All features on every plan.',
    images: ['/og/home'],
  },
  alternates: {
    canonical: 'https://www.elitpos.elitjohnsdigital.co.ke/',
  },
}

export default function HomePage() {
  const breadcrumb = generateBreadcrumbJsonLd([
    { name: 'Home' },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumb,
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "ElitPOS",
              "url": "https://www.elitpos.elitjohnsdigital.co.ke",
              "description": "All-in-one AI-powered cloud POS and ERP for retail, restaurants, supermarkets, and auto service.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.elitpos.elitjohnsdigital.co.ke/features?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            },
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "ElitPOS",
              "url": "https://www.elitpos.elitjohnsdigital.co.ke",
              "logo": "https://www.elitpos.elitjohnsdigital.co.ke/icons/icon-512.png",
              "description": "Cloud POS and business management platform with AI features for retail, restaurants, supermarkets, and auto service centers. Unlimited users on every plan.",
              "sameAs": [
                "https://www.elitpos.elitjohnsdigital.co.ke"
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "ElitPOS",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "url": "https://www.elitpos.elitjohnsdigital.co.ke",
              "downloadUrl": "https://www.elitpos.elitjohnsdigital.co.ke/register",
              "screenshot": "https://www.elitpos.elitjohnsdigital.co.ke/og/home",
              "softwareVersion": "1.0",
              "description": "All-in-one cloud POS and ERP with AI features for retail, restaurants, supermarkets, and auto service. Unlimited users. All features on every plan.",
              "featureList": [
                "Point of Sale",
                "Inventory Management",
                "Double-Entry Accounting",
                "HR & Payroll",
                "Kitchen Display System",
                "Work Order Management",
                "AI Analytics",
                "Multi-Currency",
                "Real-Time Sync",
                "Unlimited Users"
              ],
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "name": "Free Forever",
                "description": "All features, unlimited users, 80 MB database, 100 MB file storage"
              }
            }
          ])
        }}
      />
      <HomeClient />
    </>
  )
}
