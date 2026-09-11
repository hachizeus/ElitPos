import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { ErrorCaptureProvider } from "@/components/providers/ErrorCaptureProvider"
import ServiceWorkerRegistration from "@/components/providers/ServiceWorkerRegistration"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL('https://elitpos.elitjohnsdigital.co.ke'),
  title: {
    default: 'ElitPOS - AI-Powered POS & Business Management',
    template: '%s | ElitPOS',
  },
  description: 'AI-powered cloud POS and ERP for retail, restaurants, supermarkets, and auto service. Unlimited users, unlimited transactions. Free to start.',
  keywords: ['POS system', 'point of sale', 'ERP software', 'retail management', 'restaurant POS', 'supermarket POS', 'auto service management', 'inventory management', 'AI business', 'cloud POS', 'ElitPOS'],
  authors: [{ name: 'Elitjohns Digital Agency' }],
  creator: 'Elitjohns Digital Agency',
  publisher: 'Elitjohns Digital Agency',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://elitpos.elitjohnsdigital.co.ke',
    siteName: 'ElitPOS',
    title: 'ElitPOS - AI-Powered POS & Business Management',
    description: 'AI-powered cloud POS and ERP. Unlimited users, unlimited transactions. All features on every plan. Free to start.',
    images: [{ url: '/og/home', width: 1200, height: 630, alt: 'ElitPOS - AI-Powered POS & Business Management' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ElitPOS - AI-Powered POS & Business Management',
    description: 'AI-powered cloud POS and ERP. Unlimited users, unlimited transactions.',
    images: ['/og/home'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' as const, 'max-snippet': -1 } },
  category: 'technology',
  verification: {
    google: '', // TODO: Add Google Search Console verification code
  },
  other: {
    'application-name': 'ElitPOS',
    'subject': 'Business Management Software, Point of Sale, ERP',
    'classification': 'Business',
    'coverage': 'Worldwide',
    'distribution': 'Global',
  },
  icons: {
    icon: '/icons/iconlogo.svg',
    apple: '/icons/icon-512.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  viewportFit: 'cover',
  userScalable: true,
}

// Script to prevent flash of wrong theme (FOUC)
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme') || 'system';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.add(isDark ? 'dark' : 'light');
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
            `}} />
          </>
        )}
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ErrorCaptureProvider>
            <ServiceWorkerRegistration />
            {children}
          </ErrorCaptureProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
