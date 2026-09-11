/**
 * ElitPOS Logo Component — Elitjohns Digital Agency
 *
 * Usage:
 *   <Logo />                        — Icon only, default 32px
 *   <Logo variant="full" />         — Icon + "ElitPOS" text
 *   <Logo size={48} />              — Custom size
 *   <Logo onDark />                 — White text for dark backgrounds
 *   <Logo variant="full" subtitle="Point of Sale System" />
 */

interface LogoProps {
  /** "icon" = mark only, "full" = mark + wordmark */
  variant?: 'icon' | 'full'
  /** Icon size in pixels (text scales proportionally) */
  size?: number
  /** Use white text (for dark/image backgrounds) */
  onDark?: boolean
  /** Optional subtitle below the name */
  subtitle?: string
  className?: string
}

/** The SVG icon mark — uses the ElitPOS icon logo */
function LogoMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/iconlogo.svg"
      alt="ElitPOS"
      width={size}
      height={size}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        // Invert + tint to neon green when on a dark background so the icon is always visible
        filter: onDark ? 'brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(90deg)' : undefined,
      }}
    />
  )
}

export function Logo({
  variant = 'icon',
  size = 32,
  onDark = false,
  subtitle,
  className = '',
}: LogoProps) {
  if (variant === 'icon') {
    return (
      <span className={className}>
        <LogoMark size={size} onDark={onDark} />
      </span>
    )
  }

  // Full variant — icon + wordmark (namelogo.svg contains the full name mark)
  const subSize = size >= 40 ? 'text-sm' : 'text-xs'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Main logo — includes icon + name in one image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/mainlogo.png"
        alt="ElitPOS"
        height={size}
        style={{ display: 'inline-block', height: size, width: 'auto' }}
      />
      {subtitle && (
        <span className={`${subSize} ${onDark ? 'text-white/60' : 'text-slate-500 dark:text-slate-400'}`}>
          {subtitle}
        </span>
      )}
    </span>
  )
}

export default Logo
