import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ElitPOS',
    short_name: 'ElitPOS',
    description: 'AI-Powered Point of Sale & Business Management System',
    start_url: '/account',
    display: 'standalone',
    background_color: '#071209',
    theme_color: '#00FF88',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/iconlogo.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
