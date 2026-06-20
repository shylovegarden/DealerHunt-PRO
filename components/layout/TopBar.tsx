'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const routeTitles: Record<string, string> = {
  '/find': 'Find',
  '/scan': 'Scan',
  '/move': 'Move',
  '/fleet': 'Fleet',
  '/finance': 'Finance',
  '/parts': 'Parts',
}

export function TopBar() {
  const pathname = usePathname()
  const title = routeTitles[pathname] || 'DealerHunt'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[rgba(255,255,255,.06)] bg-[#07070A]/80 backdrop-blur-md px-4 md:px-6">
      <div className="flex items-center gap-3">
        <div className="md:hidden w-6 h-6 rounded bg-[#F59E0B] flex items-center justify-center">
          <span className="text-[#07070A] font-extrabold text-xs leading-none">D</span>
        </div>
        <span className="text-base font-semibold text-[#FAFAFA]">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden md:inline-flex tag tag-amber">Scout</span>
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,.06)] text-[#9898A8] hover:border-[rgba(255,255,255,.10)] hover:text-[#FAFAFA] transition-colors"
        >
          <span className="sr-only">Settings</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </Link>
      </div>
    </header>
  )
}
