import { useId } from 'react'
import { cn } from '@/lib/cn'

interface ToggleProps {
  /** Usually a string; nodes for a label that carries a chip beside its words. */
  label: React.ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  /** Rendered under the label and wired up with aria-describedby. */
  hint?: React.ReactNode
  /** Extra element ids to describe the switch with, e.g. a warning below it. */
  describedBy?: string
  className?: string
  /** Switch before the label rather than after it. */
  leading?: boolean
  /** Ink track when on, for settings lists that are not brand-coloured. */
  tone?: 'brand' | 'ink'
  /** A solid grey track when off, instead of the pale sunken one. */
  solidOff?: boolean
  /** Label styling override, e.g. weight or a muted colour. */
  labelClassName?: string
  /** A switch that is fixed on (or off) and says so, rather than one that lies. */
  disabled?: boolean
}

/**
 * A real checkbox with `role="switch"`, not a div listening for clicks: the
 * label, keyboard behaviour and the on/off announcement all come free, and a
 * switch that only responds to a mouse is not a control.
 *
 * The track carries a border as well as a fill, so on/off does not rest on
 * colour alone.
 */
export function Toggle({
  label,
  checked,
  onChange,
  hint,
  describedBy,
  className,
  leading = false,
  tone = 'brand',
  solidOff = false,
  labelClassName,
  disabled = false,
}: ToggleProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const described =
    [hint ? hintId : null, describedBy || null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div
      className={cn(
        'flex gap-4',
        leading ? 'items-center gap-3' : 'items-start justify-between',
        className,
      )}
    >
      <div className={cn('min-w-0', leading && 'order-2')}>
        <label
          htmlFor={id}
          className={cn(
            'text-ink block cursor-pointer text-sm break-words',
            labelClassName,
          )}
        >
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-ink-subtle mt-0.5 text-xs break-words">
            {hint}
          </p>
        )}
      </div>

      <span
        className={cn(
          'relative inline-flex shrink-0',
          leading ? 'order-1' : 'pt-0.5',
        )}
      >
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={described}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          aria-hidden="true"
          className={cn(
            'block h-6 w-11 rounded-full border transition-colors',
            disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600',
            checked
              ? tone === 'ink'
                ? 'bg-ink border-ink'
                : 'bg-brand-600 border-brand-600'
              : tone === 'ink' || solidOff
                ? 'bg-ink-subtle/50 border-transparent'
                : 'bg-sunken border-line',
          )}
        >
          {/* Track is 44×24 with a 1px border, so the 20px knob sits 1.5px
              from each edge at rest and 20px along when on — symmetric. */}
          <span
            className={cn(
              'mt-[1.5px] block size-5 rounded-full bg-white shadow-sm transition-transform',
              checked ? 'translate-x-[20px]' : 'translate-x-[1.5px]',
            )}
          />
        </label>
      </span>
    </div>
  )
}
