import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface MenuItem {
  id: string
  label: string
  /** Renders as a router Link when present, a button otherwise. */
  to?: string
  onSelect?: () => void
  destructive?: boolean
}

interface DropdownMenuProps {
  /** Accessible name for the trigger, e.g. "Actions for Margaret Johnson". */
  label: string
  items: MenuItem[]
  /**
   * Outlines the trigger, for a menu that sits in a row of outlined buttons
   * rather than at the end of a table row.
   */
  bordered?: boolean
  /** A different glyph on the trigger, where the menu is not an overflow. */
  icon?: LucideIcon
  /** Replaces the trigger's own classes, for a menu that has to match a row of buttons. */
  triggerClassName?: string
  /** Which edge the panel lines up with. Right by default, where overflow menus sit. */
  align?: 'start' | 'end'
}

const WIDTH = 224
const MARGIN = 8

/**
 * Small overflow menu. Deliberately not an ARIA menu widget — the contents are
 * links and buttons, so a labelled disclosure keeps native Tab behaviour rather
 * than half-implementing roving tabindex.
 *
 * The panel is portalled to the body because its callers sit inside
 * `overflow-x-auto` scroll regions and `overflow-hidden` cards, both of which
 * clip an absolutely positioned child — the last row's menu simply vanished.
 */
export function DropdownMenu({
  label,
  items,
  bordered = false,
  icon: Icon = MoreHorizontal,
  triggerClassName,
  align = 'end',
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const height = panelRef.current?.offsetHeight ?? items.length * 36 + 8
    // Flip above the trigger when there isn't room below.
    const below = rect.bottom + MARGIN + height <= window.innerHeight
    setPosition({
      top: below ? rect.bottom + 4 : Math.max(MARGIN, rect.top - height - 4),
      left: Math.min(
        Math.max(MARGIN, align === 'start' ? rect.left : rect.right - WIDTH),
        window.innerWidth - WIDTH - MARGIN,
      ),
    })
  }, [align, items.length])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return

    const contains = (target: Node | null) =>
      triggerRef.current?.contains(target) || panelRef.current?.contains(target)

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!contains(e.target as Node)) setOpen(false)
    }
    // Closes when focus leaves entirely, so Tab doesn't strand an open menu.
    const onFocusIn = (e: FocusEvent) => {
      if (!contains(e.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    // Capture phase so scrolling any ancestor region repositions the panel.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  const itemClass = (destructive?: boolean) =>
    cn(
      'block w-full px-3 py-2 text-left text-sm transition-colors',
      destructive
        ? 'text-red-700 hover:bg-red-50'
        : 'text-ink-muted hover:bg-sunken hover:text-ink',
    )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          cn(
            'text-ink-subtle hover:bg-sunken hover:text-ink grid size-9 shrink-0 place-items-center rounded-lg',
            bordered && 'border-line border',
          )
        }
      >
        <Icon className="size-4.5" strokeWidth={1.9} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            style={{ top: position.top, left: position.left, width: WIDTH }}
            className="border-line bg-surface fixed z-50 overflow-hidden rounded-lg border py-1 shadow-lg"
          >
            <ul aria-label={label}>
              {items.map((item) => (
                <li key={item.id}>
                  {item.to ? (
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={itemClass(item.destructive)}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        item.onSelect?.()
                      }}
                      className={itemClass(item.destructive)}
                    >
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
