import type { NextConfig } from "next";
import packageJson from './package.json';

// ── Runtime mode detection ──────────────────────────────────────────────────
// NEXT_PUBLIC_RUNTIME_MODE: 'web-cloud' | 'electron' | 'capacitor'
const RUNTIME_MODE = process.env.NEXT_PUBLIC_RUNTIME_MODE ?? 'web-cloud'
const IS_ELECTRON = RUNTIME_MODE === 'electron'
const IS_CAPACITOR = RUNTIME_MODE === 'capacitor'

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: packageJson.version,
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_RUNTIME_MODE: RUNTIME_MODE,
  },

  // ── Static export for Capacitor (mobile) ────────────────────────────────
  // When building for Android/iOS, Next.js outputs static HTML/JS/CSS.
  // API routes don't run in the mobile app — all data goes through the
  // offline SQLite layer or a remote server URL.
  ...(IS_CAPACITOR ? { output: 'export', trailingSlash: true } : {}),

  // Bundle size: tree-shake large icon/animation/date libraries
  // Prevents the full icon set, all framer-motion exports, and every
  // date-fns locale from being bundled — only used exports are included.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'date-fns',
      '@react-three/drei',
      'exceljs',
    ],
  },

  // Optimize production builds
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundles

  // ── Webpack: split heavy vendor chunks so the main bundle stays small ──
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization = config.optimization ?? {}
      config.optimization.splitChunks = {
        ...(config.optimization.splitChunks as object ?? {}),
        cacheGroups: {
          // three.js + react-three are only used on specific pages
          three: {
            test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
            name: 'vendor-three',
            chunks: 'all',
            priority: 30,
          },
          // exceljs / xlsx / papaparse — only needed on import/export pages
          spreadsheet: {
            test: /[\\/]node_modules[\\/](exceljs|xlsx|papaparse|mammoth)[\\/]/,
            name: 'vendor-spreadsheet',
            chunks: 'all',
            priority: 25,
          },
          // framer-motion — split so pages that don't animate don't pay the cost
          framer: {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'vendor-framer',
            chunks: 'all',
            priority: 20,
          },
        },
      }
    }
    return config
  },

  // Restrict image optimization to known domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.elitjohnsdigital.co.ke',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600, // cache optimised images for 1 hour
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Security headers + Cache-Control for stable reference-data API routes
  async headers() {
    return [
      // ── Reference-data routes: safe to cache for 60s in the browser ──
      // These change rarely (categories, warehouses, tax templates, tenant info,
      // payment methods, vehicle makes/models) — short TTL eliminates most repeat
      // DB hits without risking stale data.
      {
        source: '/api/categories',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/warehouses',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/tenant',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/accounting/tax-templates',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/accounting/settings',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/payment-methods',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/vehicle-makes',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=300, stale-while-revalidate=600' }],
      },
      {
        source: '/api/vehicle-models',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=300, stale-while-revalidate=600' }],
      },
      {
        source: '/api/pos-profiles',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/restaurant-tables',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=30, stale-while-revalidate=60' }],
      },
      {
        source: '/api/loyalty-programs',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' }],
      },
      // ── Reports: safe to cache for 2 minutes (data changes slowly) ──
      {
        source: '/api/reports/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=120, stale-while-revalidate=300' }],
      },
      // ── Search: short cache to deduplicate rapid repeated searches ──
      {
        source: '/api/search',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=10, stale-while-revalidate=30' }],
      },
      // ── Security headers (all routes) ──
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.payhere.lk https://sandbox.payhere.lk https://js.stripe.com https://js.paystack.co https://static.cloudflareinsights.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://cdn.elitjohnsdigital.co.ke https://lh3.googleusercontent.com https://images.unsplash.com https://ik.imagekit.io https://www.google-analytics.com https://www.googletagmanager.com",
              "media-src 'self' blob: https://cdn.elitjohnsdigital.co.ke https://*.r2.cloudflarestorage.com https://ik.imagekit.io",
              "connect-src 'self' https://*.elitjohnsdigital.co.ke wss://*.elitjohnsdigital.co.ke ws://localhost:* https://api.resend.com https://upload.imagekit.io https://api.imagekit.io https://www.payhere.lk https://sandbox.payhere.lk https://sandbox.safaricom.co.ke https://api.safaricom.co.ke https://api.stripe.com https://api.paystack.co https://checkout.paystack.com https://backend.payhero.co.ke https://generativelanguage.googleapis.com https://api.deepseek.com https://*.cloudflareinsights.com https://www.google-analytics.com https://www.googletagmanager.com https://analytics.google.com https://*.google-analytics.com https://stats.g.doubleclick.net",
              "frame-src 'self' blob: https://cdn.elitjohnsdigital.co.ke https://*.r2.cloudflarestorage.com https://www.payhere.lk https://sandbox.payhere.lk https://js.stripe.com https://hooks.stripe.com https://checkout.paystack.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self' https://www.payhere.lk https://sandbox.payhere.lk https://checkout.paystack.com https://standard.paystack.co",
            ].join('; ')
          }
        ]
      }
    ]
  }
};

export default nextConfig;
