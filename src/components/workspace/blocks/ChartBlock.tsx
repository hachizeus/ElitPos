'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import type { ChartBlock as ChartBlockType, ChartData } from '@/lib/workspace/types'
import BarChart from '../charts/BarChart'
import LineChart from '../charts/LineChart'
import PieChart from '../charts/PieChart'
import DoughnutChart from '../charts/DoughnutChart'

interface ChartBlockProps {
  block: ChartBlockType
  refreshKey?: number
}

export function ChartBlock({ block, refreshKey }: ChartBlockProps) {
  const { title, chartKey, chartType, color, height } = block.data
  const [data, setData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspace/chart-data?key=${chartKey}`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      } else {
        console.error(`Failed to fetch chart data '${chartKey}' (${res.status})`)
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error)
    } finally {
      setLoading(false)
    }
  }, [chartKey])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const chartProps = data ? {
    labels: data.labels,
    datasets: data.datasets,
    height: height || 300,
    color: color,
  } : null

  const ChartComponent = {
    bar: BarChart,
    line: LineChart,
    pie: PieChart,
    doughnut: DoughnutChart,
  }[chartType]

  return (
    <div
      className="rounded-xl overflow-hidden w-full flex flex-col"
      style={{
        background: 'var(--card-bg, white)',
        border: '1px solid var(--card-border, rgba(0,0,0,0.07))',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--card-border, rgba(0,0,0,0.06))' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(128,128,128,0.8)' }}>
          {title}
        </h3>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: height || 300 }}>
            <Loader2 className="w-6 h-6 animate-spin text-gray-300 dark:text-gray-600" />
          </div>
        ) : chartProps ? (
          <ChartComponent {...chartProps} />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 gap-2" style={{ height: height || 300 }}>
            <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-sm">No data available</span>
          </div>
        )}
      </div>
    </div>
  )
}
