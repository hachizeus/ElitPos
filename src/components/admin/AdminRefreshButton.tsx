'use client'

import { usePageRefresh } from '@/hooks/usePageRefresh'
import { RefreshCw } from 'lucide-react'

export function AdminRefreshButton() {
  const { refreshing, refresh } = usePageRefresh()

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      title="Refresh page data"
      className="w-7 h-7 flex items-center justify-center rounded-lg
        text-gray-400 hover:text-[#00FF88] hover:bg-white/5
        disabled:opacity-40 transition-colors"
    >
      <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
    </button>
  )
}
