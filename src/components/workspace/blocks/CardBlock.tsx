'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { CardBlock as CardBlockType } from '@/lib/workspace/types'

interface CardBlockProps {
  block: CardBlockType
}

export function CardBlock({ block }: CardBlockProps) {
  const { title, links } = block.data

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden w-full shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors group"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {link.label}
                </span>
                {link.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{link.description}</p>
                )}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-[#00965c] dark:group-hover:text-[#00FF88] transition-colors flex-shrink-0 ml-2" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
