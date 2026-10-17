import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  /** Names the dialog for assistive tech — "Quick preview" alone says whose. */
  subtitle?: string
  /**
   * Where it sits. A side panel for reading something alongside the screen it
   * came from; centred for a short form that has to be finished or abandoned
   * before anything else happens. The behaviour — portal, focus trap, escape,
   * scroll lock, focus restored to the trigger — is the same either way, which
   * is the whole reason a centred dialog is a placement here rather than a
   * second component with its own half-right copy of all that.
   */
  placement?: 'side' | 'center'
  /**
   * Drop the title bar, for a confirmation that draws its own heading. The
   * title still names the dialog for assistive tech, and Escape still closes.
   */
  bare?: boolean
  children: React.ReactNode
}

/**
 * A modal panel. Portalled to the body because every caller so far sits inside
 * a `overflow-x-auto` table wrapper, which would clip a fixed child.
 *
 * Unlike the sidebar drawer this is never permanent chrome — it is always
 * modal, so it always traps focus and always restores it on close.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  placement = 'side',
  bare = false,
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const headingId = useId()

  /*
   * Held in a ref so the effect depends only on `open`. Callers pass an inline
   * arrow, so a plain dependency re-ran teardown and setup on every render —
   * which yanked focus back onto the dialog from wherever the user had tabbed.
   */
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    const trigger = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
      /*
       * Back to whatever opened it — but only if it is still in the document.
       * On a cold deep link the drawer opens with `body` focused, and the
       * trigger row can unmount while the drawer is open, so refocusing a
       * detached node would silently drop focus to the top of the page.
       */
      if (trigger?.isConnected && trigger !== document.body) trigger.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={cn(
          'bg-surface border-line fixed z-50 flex flex-col shadow-xl focus:outline-hidden',
          placement === 'side'
            ? 'inset-y-0 right-0 w-full max-w-md border-l'
            : // Pinned rather than translated: a centred panel that grows past
              // the viewport has to be able to scroll to its own buttons.
              'rounded-card inset-x-4 top-1/2 mx-auto max-h-[calc(100dvh-2rem)] w-auto max-w-lg -translate-y-1/2 border sm:inset-x-0',
        )}
      >
        {bare && (
          <h2 id={headingId} className="sr-only">
            {title}
          </h2>
        )}
        <div
          className={cn(
            'border-line flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3',
            bare && 'hidden',
          )}
        >
          <h2
            id={bare ? undefined : headingId}
            className="text-ink min-w-0 text-base font-semibold tracking-tight"
          >
            {title}
            {subtitle && (
              <span className="text-ink-subtle block truncate text-xs font-normal">
                {subtitle}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:bg-sunken hover:text-ink grid size-9 shrink-0 place-items-center rounded-lg"
          >
            <X className="size-4.5" strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Close {title.toLowerCase()}</span>
          </button>
        </div>

        {/* The panel holds focus but is not the scroller, so the body needs
            its own keyboard entry point. */}
        <div
          tabIndex={0}
          role="region"
          aria-label={subtitle ? `${title}, ${subtitle}` : title}
          className="min-h-0 flex-1 overflow-y-auto focus:outline-hidden"
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
