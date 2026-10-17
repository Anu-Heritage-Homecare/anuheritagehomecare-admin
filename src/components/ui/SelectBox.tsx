import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/*
 * The app's dropdown. A native <select> opens a list the operating system
 * draws (dark on macOS) and no CSS reaches it, so every dropdown looked like
 * a different product. This one draws its own white list and is a drop-in
 * replacement: same `value` / `defaultValue` / `onChange(e => e.target.value)`
 * and the same <option> / <optgroup> children, so a call site changes only the
 * tag name.
 *
 * Behaviour follows the ARIA combobox-with-listbox pattern: focus stays on the
 * button, the highlighted option is announced through aria-activedescendant,
 * and the keyboard does what a native select does — arrows, Home/End, Enter
 * or Space to choose, Escape to close, and typing a letter jumps to a match.
 */

interface Option {
  value: string
  label: ReactNode
  /** Plain text, for type-ahead. */
  text: string
  disabled: boolean
  group?: string
}

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean }
type GroupProps = { label?: string; children?: ReactNode }

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function collect(children: ReactNode, group?: string, out: Option[] = []): Option[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) {
      collect((child.props as { children?: ReactNode }).children, group, out)
    } else if (child.type === 'optgroup') {
      const props = child.props as GroupProps
      collect(props.children, props.label, out)
    } else if (child.type === 'option') {
      const props = child.props as OptionProps
      const text = textOf(props.children)
      out.push({
        value: props.value !== undefined ? String(props.value) : text,
        label: props.children,
        text,
        disabled: Boolean(props.disabled),
        group,
      })
    }
  })
  return out
}

export interface SelectBoxProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'defaultValue' | 'onChange' | 'children' | 'type'> {
  value?: string | number
  defaultValue?: string | number
  onChange?: (event: { target: { value: string }; currentTarget: { value: string } }) => void
  children?: ReactNode
}

const MARGIN = 8
const MAX_HEIGHT = 288

export function SelectBox({
  value,
  defaultValue,
  onChange,
  children,
  className,
  disabled,
  onKeyDown,
  onBlur,
  ...buttonProps
}: SelectBoxProps) {
  const options = useMemo(() => collect(children), [children])
  const [inner, setInner] = useState(() =>
    defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ''),
  )
  const current = value !== undefined ? String(value) : inner
  const selectedIndex = options.findIndex((o) => o.value === current)
  const selected = options[selectedIndex]

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [position, setPosition] = useState({ top: 0, left: 0, minWidth: 0, maxHeight: MAX_HEIGHT })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const listId = useId()

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    if (value === undefined) setInner(option.value)
    if (option.value !== current) {
      onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } })
    }
  }

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i
    }
    return from
  }
  const first = () => step(-1, 1)
  const last = () => step(options.length, -1)

  const openList = () => {
    if (disabled || options.length === 0) return
    setActive(selectedIndex >= 0 ? selectedIndex : first())
    setOpen(true)
  }

  const place = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const minWidth = Math.max(rect.width, 160)
    const height = Math.min(panelRef.current?.scrollHeight ?? MAX_HEIGHT, MAX_HEIGHT)
    const below = window.innerHeight - rect.bottom - MARGIN
    const above = rect.top - MARGIN
    const flip = below < height && above > below
    const maxHeight = Math.min(MAX_HEIGHT, Math.max(120, (flip ? above : below) - 4))
    setPosition({
      top: flip ? Math.max(MARGIN, rect.top - Math.min(height, maxHeight) - 4) : rect.bottom + 4,
      left: Math.min(Math.max(MARGIN, rect.left), window.innerWidth - minWidth - MARGIN),
      minWidth,
      maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place, options.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  // Keep the highlighted option in view as the arrows move it.
  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  /** Jump to the next option starting with what has been typed in the last second. */
  const typeAhead = (key: string): number => {
    const now = Date.now()
    typed.current = {
      text: now - typed.current.at < 1000 ? typed.current.text + key.toLowerCase() : key.toLowerCase(),
      at: now,
    }
    const from = open ? active : selectedIndex
    const query = typed.current.text
    // Typing more of the same word keeps the current match.
    if (query.length > 1 && from >= 0 && options[from].text.toLowerCase().startsWith(query)) return from
    for (let k = 1; k <= options.length; k += 1) {
      const i = (from + k + options.length) % options.length
      if (!options[i].disabled && options[i].text.toLowerCase().startsWith(query)) return i
    }
    return -1
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented || disabled) return

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const i = typeAhead(e.key)
        if (i >= 0) choose(i)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => step(a, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => step(a, -1))
        break
      case 'Home':
        e.preventDefault()
        setActive(first())
        break
      case 'End':
        e.preventDefault()
        setActive(last())
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        setOpen(false)
        break
      case 'Escape':
        // Closes the list only — not the drawer or dialog it sits in.
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const i = typeAhead(e.key)
          if (i >= 0) setActive(i)
        }
    }
  }

  const classes = className ?? ''
  // A call site that hid the native arrow (appearance-none) draws its own, and
  // an invisible overlay select (opacity-0) sits on top of a styled label.
  const ownChevron = /\bappearance-none\b|\bopacity-0\b/.test(classes)
  const hasDisplay = /(^|\s)(block|flex|inline-flex|grid|hidden|inline-block)(\s|$)/.test(classes)
  const hasBackground = /(^|\s)bg-/.test(classes)

  return (
    <>
      <button
        {...buttonProps}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          onBlur?.(e)
          setOpen(false)
        }}
        className={cn(
          !hasDisplay && 'inline-flex',
          'cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed',
          !hasBackground && !ownChevron && 'bg-surface',
          classes,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : ''}</span>
        {!ownChevron && (
          <ChevronDown
            aria-hidden="true"
            strokeWidth={2}
            className={cn('text-ink-subtle size-4 shrink-0 transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            // Pressing on the list must not take focus from the button, or
            // the button's blur would close the list before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            style={{ top: position.top, left: position.left, minWidth: position.minWidth, maxHeight: position.maxHeight }}
            className="border-line bg-surface fixed z-[60] max-w-[min(28rem,calc(100vw-1rem))] overflow-y-auto rounded-lg border py-1 text-sm shadow-lg"
          >
            {options.map((o, i) => {
              const heading = o.group && o.group !== options[i - 1]?.group ? o.group : null
              const isSelected = i === selectedIndex
              return (
                <Fragment key={`${o.value}-${i}`}>
                  {heading && (
                    <div
                      role="presentation"
                      className="text-ink-subtle px-3 pt-2.5 pb-1 text-[0.6875rem] font-semibold tracking-wide uppercase"
                    >
                      {heading}
                    </div>
                  )}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => {
                      if (o.disabled) return
                      choose(i)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2',
                      o.disabled ? 'text-ink-subtle cursor-not-allowed' : 'cursor-pointer',
                      i === active && !o.disabled && 'bg-sunken',
                      isSelected ? 'text-brand-700 font-medium' : 'text-ink',
                    )}
                  >
                    <span className="min-w-0 break-words">{o.label}</span>
                    {isSelected && <Check className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />}
                  </div>
                </Fragment>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
