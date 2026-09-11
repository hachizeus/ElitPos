'use client'

import Link from 'next/link'
import type { NumberCardBlock as NumberCardBlockType, MetricValues } from '@/lib/workspace/types'
import { getIcon } from '../icon-map'

/**
 * Color palette using inline styles (not dynamic Tailwind classes) so
 * Tailwind purging doesn't remove color-specific classes at build time.
 */
const COLOR_PALETTE: Record<string, {
  iconBg: string
  iconColor: string
  borderColor: string
  shadowColor: string
}> = {
  blue:    { iconBg: 'rgba(59,130,246,0.12)',  iconColor: '#3b82f6', borderColor: '#3b82f6', shadowColor: 'rgba(59,130,246,0.15)' },
  green:   { iconBg: 'rgba(0,150,92,0.12)',    iconColor: '#00965c', borderColor: '#00FF88', shadowColor: 'rgba(0,255,136,0.15)'  },
  emerald: { iconBg: 'rgba(0,200,110,0.12)',   iconColor: '#059669', borderColor: '#10b981', shadowColor: 'rgba(16,185,129,0.15)' },
  red:     { iconBg: 'rgba(239,68,68,0.1)',    iconColor: '#dc2626', borderColor: '#ef4444', shadowColor: 'rgba(239,68,68,0.15)'  },
  purple:  { iconBg: 'rgba(0,150,92,0.12)',    iconColor: '#00965c', borderColor: '#00FF88', shadowColor: 'rgba(0,255,136,0.15)'  },
  amber:   { iconBg: 'rgba(245,158,11,0.1)',   iconColor: '#d97706', borderColor: '#f59e0b', shadowColor: 'rgba(245,158,11,0.15)' },
  orange:  { iconBg: 'rgba(249,115,22,0.1)',   iconColor: '#ea580c', borderColor: '#f97316', shadowColor: 'rgba(249,115,22,0.15)' },
  violet:  { iconBg: 'rgba(0,150,92,0.12)',    iconColor: '#00965c', borderColor: '#00FF88', shadowColor: 'rgba(0,255,136,0.15)'  },
  slate:   { iconBg: 'rgba(100,116,139,0.1)',  iconColor: '#475569', borderColor: '#64748b', shadowColor: 'rgba(100,116,139,0.15)' },
  cyan:    { iconBg: 'rgba(6,182,212,0.1)',    iconColor: '#0891b2', borderColor: '#06b6d4', shadowColor: 'rgba(6,182,212,0.15)'  },
}

interface NumberCardBlockProps {
  block: NumberCardBlockType
  metrics: MetricValues
  loading: boolean
}

export function NumberCardBlock({ block, metrics, loading }: NumberCardBlockProps) {
  const { label, metricKey, color, href, icon, prefix } = block.data
  const Icon = getIcon(icon)
  const palette = COLOR_PALETTE[color] || COLOR_PALETTE.emerald
  const rawValue = metrics[metricKey]?.value
  const value = typeof rawValue === 'number' ? rawValue : undefined

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-4 py-4 rounded-xl w-full min-w-0 transition-all duration-150 hover:shadow-lg"
      style={{
        background: 'var(--card-bg, white)',
        border: '1px solid var(--card-border, rgba(0,0,0,0.07))',
        borderLeft: `4px solid ${palette.borderColor}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${palette.shadowColor}`
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      {/* Icon badge */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105"
        style={{ background: palette.iconBg }}
      >
        <Icon style={{ color: palette.iconColor, width: 20, height: 20 }} strokeWidth={1.75} />
      </div>

      {/* Value + label */}
      <div className="min-w-0 flex-1">
        {loading ? (
          <>
            <div className="h-6 w-16 rounded animate-pulse mb-1.5" style={{ background: 'rgba(128,128,128,0.15)' }} />
            <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'rgba(128,128,128,0.1)' }} />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold leading-none truncate" style={{ color: palette.iconColor }}>
              {prefix && (
                <span className="text-base font-semibold mr-0.5 opacity-75">{prefix}</span>
              )}
              {value !== undefined ? value.toLocaleString() : '—'}
            </p>
            <p className="text-xs font-medium mt-1.5 truncate" style={{ color: 'rgba(128,128,128,0.9)' }}>
              {label}
            </p>
          </>
        )}
      </div>

      {/* Arrow hint on hover */}
      <svg
        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all duration-150"
        style={{ color: palette.iconColor }}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
