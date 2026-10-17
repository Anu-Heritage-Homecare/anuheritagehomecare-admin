import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { profileTabs } from './tabs'
import { cn } from '@/lib/cn'

/**
 * Eleven tabs never fit a phone, so the rail scrolls horizontally. These are
 * real links (the tab lives in the URL), so this is a nav landmark rather than
 * an ARIA tablist.
 */
export function ProfileTabs({ recipientId }: { recipientId: string }) {
  const railRef = useRef<HTMLUListElement>(null)
  const { pathname } = useLocation()

  // Deep-linking to a later tab would otherwise leave the current tab scrolled
  // off-screen, with `.no-scrollbar` hiding any hint that the rail scrolls.
  useEffect(() => {
    const active = railRef.current?.querySelector('[aria-current="page"]')
    active?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])

  return (
    <nav aria-label="Profile sections" className="border-line border-t px-1 sm:px-2 print:hidden">
      <ul
        ref={railRef}
        // py-1 keeps the 2px focus ring from being clipped by overflow-y:auto,
        // which `overflow-x-auto` implies.
        className="no-scrollbar flex gap-1 overflow-x-auto py-1"
      >
        {profileTabs.map(({ slug, label }) => (
          <li key={slug} className="shrink-0">
            <NavLink
              to={`/care-recipients/${recipientId}/${slug}`}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-brand-600 text-brand-700'
                    : 'text-ink-muted hover:text-ink border-transparent',
                )
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
