import LandingNav from '@/components/landing/LandingNav'
import LandingFooter from '@/components/landing/LandingFooter'
import CookieConsent from '@/components/landing/CookieConsent'
// Landing-page-specific CSS (animations, orbs, hero meshes, glassmorphism).
// Kept separate from globals.css so the ~1300-line landing stylesheet is
// NOT downloaded on POS, dashboard, or any other ERP page.
import './landing.css'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-root">
      <div className="fixed inset-0 -z-50 bg-[#09090b]" aria-hidden="true" />
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
      <CookieConsent />
    </div>
  )
}
