import type { Metadata } from 'next'
import ResetPasswordClient from './ResetPasswordClient'

export const metadata: Metadata = {
  title: 'Reset Password - ElitPOS',
  description: 'Set a new password for your ElitPOS account.',
  openGraph: {
    title: 'Reset Password | ElitPOS',
    description: 'Set a new password for your account.',
    images: [{ url: '/og/home', width: 1200, height: 630 }],
  },
}

export default function ResetPasswordPage() {
  return <ResetPasswordClient />
}
