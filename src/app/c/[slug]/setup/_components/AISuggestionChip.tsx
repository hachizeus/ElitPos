'use client'

import { motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'

// --- Single-value suggestion chip ---

interface AISuggestionChipProps {
  label: string
  reason?: string
  loading?: boolean
  onApply: () => void
  onDismiss?: () => void
  alreadyApplied?: boolean
}

export function AISuggestionChip({
  label,
  reason,
  loading,
  onApply,
  onDismiss,
  alreadyApplied,
}: AISuggestionChipProps) {
  if (loading) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1">
        <Sparkles size={12} className="animate-pulse text-green-400" />
        Loading suggestions...
      </p>
    )
  }

  if (alreadyApplied || !label) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mt-1.5"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full border border-green-200 dark:border-green-800">
          <Sparkles size={10} className="animate-sparkle" />
          AI suggests: {label}
        </span>
        <motion.button
          type="button"
          onClick={onApply}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-xs text-[#00cc6e] dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 font-medium underline underline-offset-2 transition-colors"
        >
          Apply
        </motion.button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {reason && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-xs text-gray-500 dark:text-gray-400 mt-1"
        >
          {reason}
        </motion.p>
      )}
    </motion.div>
  )
}

// --- List suggestion banner ---

interface AISuggestionBannerProps {
  items: string[]
  reason?: string
  loading?: boolean
  onApplyAll: () => void
  onDismiss?: () => void
  itemLabel?: string
}

export function AISuggestionBanner({
  items,
  reason,
  loading,
  onApplyAll,
  onDismiss,
  itemLabel = 'items',
}: AISuggestionBannerProps) {
  if (loading) {
    return (
      <div className="mb-4 p-3 rounded border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/20">
        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
          <Sparkles size={12} className="animate-pulse text-green-400" />
          Loading AI suggestions...
        </p>
      </div>
    )
  }

  if (!items || items.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 p-3 rounded border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} className="animate-sparkle" />
            AI suggests {items.length} {itemLabel}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {items.join(', ')}
          </p>
          {reason && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{reason}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <motion.button
            type="button"
            onClick={onApplyAll}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800/50 hover:bg-green-200 dark:hover:bg-[#00b35e] rounded-md transition-colors"
          >
            Apply All
          </motion.button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// --- Info tip banner ---

interface AISuggestionTipProps {
  tip: string
  loading?: boolean
}

export function AISuggestionTip({ tip, loading }: AISuggestionTipProps) {
  if (loading) {
    return (
      <div className="mb-4 p-3 rounded border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/20">
        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
          <Sparkles size={12} className="animate-pulse text-green-400" />
          Loading tips...
        </p>
      </div>
    )
  }

  if (!tip) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 p-3 rounded border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/20"
    >
      <p className="text-xs text-green-700 dark:text-green-300 flex items-start gap-1.5">
        <Sparkles size={12} className="shrink-0 mt-0.5 animate-sparkle" />
        <span>{tip}</span>
      </p>
    </motion.div>
  )
}
