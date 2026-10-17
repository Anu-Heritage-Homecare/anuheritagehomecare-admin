import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { navItems } from './nav'
import type { NavChild } from './nav'
import { Logo } from './Logo'
import { Avatar } from '@/components/ui/Avatar'
import { LG_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/cn'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

/**
 * A section's sub-navigation, shown only while that section is open.
 *
 * It used to render for every section at once, so that "Care Plans" was one
 * click from anywhere. That is genuinely quicker, and it is not what the design
 * asks for: it turned an eleven-row rail into a twenty-four-row one, and the
 * eleven top-level destinations stopped reading as the shape of the product.
 * Scoping it to the open section keeps every child reachable — which is the
 * part that matters, since several of them have no other entry point — and
 * costs one click from outside the section.
 */
function SubNav({
  items,
  label,
  onNavigate,
}: {
  items: NavChild[]
  label: string
  onNavigate: () => void
}) {
  return (
    <ul aria-label={`${label} sections`} className="mt-0.5 space-y-0.5 pl-4">
      {items.map((child) => (
        <li key={child.to}>
          <NavLink
            to={child.to}
            end={child.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                // The rail gives the group a visible spine, so a nested item
                // doesn't read as another top-level destination.
                'border-line flex min-h-9 items-center border-l pl-4 text-sm transition-colors',
                isActive
                  ? 'border-brand-500 text-brand-700 font-semibold'
                  : 'text-ink-muted hover:text-ink hover:border-ink-subtle',
              )
            }
          >
            <span className="truncate">{child.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const panelRef = useRef<HTMLElement>(null)
  const isDesktop = useMediaQuery(LG_QUERY)

  /** Below lg the panel is a modal drawer; at lg+ it's permanent chrome. */
  const isDrawer = !isDesktop
  const drawerHidden = isDrawer && !open

  useEffect(() => {
    if (!isDrawer || !open) return

    const trigger = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      // Keep focus inside the drawer while it's modal.
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [isDrawer, open, onClose])

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        ref={panelRef}
        id="app-sidebar"
        tabIndex={-1}
        // A closed drawer stays in the DOM for the slide animation, so it has
        // to be removed from the tab order and the a11y tree explicitly.
        inert={drawerHidden || undefined}
        {...(isDrawer && open
          ? { role: 'dialog' as const, 'aria-modal': true, 'aria-label': 'Navigation' }
          : {})}
        className={cn(
          'border-line bg-surface fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r print:hidden',
          'transition-transform duration-200 ease-out focus:outline-hidden lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="text-ink-muted hover:bg-sunken grid size-11 place-items-center rounded-lg lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4"
        >
          {navItems.map(({ label, to, icon: Icon, children }) => {
            /*
             * A section parent is highlighted while any of its children is
             * open, but `end` keeps NavLink from also claiming
             * aria-current="page" for a URL that isn't the current one — the
             * child owns that, and two of them at once is a lie.
             */
            const inSection =
              pathname === to || pathname.startsWith(`${to}/`)

            return (
              <div key={to}>
                <NavLink
                  to={to}
                  end={Boolean(children)}
                  onClick={onClose}
                  // A section parent is a heading that happens to be clickable;
                  // its "Overview" child owns aria-current. NavLink only leaves
                  // the prop alone when it is passed explicitly.
                  aria-current={children ? 'false' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    inSection
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-muted hover:bg-sunken hover:text-ink',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4.5 shrink-0',
                      inSection ? 'text-brand-600' : 'text-ink-subtle',
                    )}
                    strokeWidth={1.8}
                  />
                  <span className="truncate">{label}</span>
                </NavLink>

                {children && inSection && (
                  <SubNav items={children} label={label} onNavigate={onClose} />
                )}
              </div>
            )
          })}
        </nav>

        <div className="shrink-0 p-3">
          <button
            type="button"
            className="border-control hover:bg-sunken flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
          >
            <Avatar name="Sarah Jenkins" decorative className="size-9" />
            <span className="min-w-0">
              <span className="text-ink block truncate text-sm font-semibold">
                Sarah Jenkins
              </span>
              <span className="text-ink-subtle block truncate text-xs">
                Operations Manager
              </span>
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}
