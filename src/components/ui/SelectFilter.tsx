import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

export interface SelectOption {
  value: string
  label: string
}

interface SelectFilterProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  /**
   * Compact chip form: a shorter control on pointer-sized screens. Opt-in, so
   * the dozen screens using the default height are left alone. Still 44px tall
   * below `sm`, where a finger is the pointer.
   */
  chip?: boolean
  /** Leading glyph, where the screen's other controls carry one. */
  icon?: LucideIcon
  /**
   * The design's resting form: the chip reads just the dimension — "Priority",
   * "Due Date" — until something is chosen, and then reads "Priority: High".
   *
   * The select itself is still a real SelectBox, laid over the text at zero
   * opacity: it keeps the native picker, the keyboard handling and the
   * accessible name, while the chip's width follows the words on it rather
   * than the longest option. `defaultValue` is what counts as "nothing
   * chosen"; it falls back to the first option.
   */
  quiet?: boolean
  defaultValue?: string
  /**
   * Shows the chosen option and nothing else — "Most Recent" rather than
   * "Sort: Most Recent" — for a control whose heading already says what it
   * sorts. `label` is still required and becomes the select's accessible name,
   * so the dimension is announced even though it is not drawn.
   */
  valueOnly?: boolean
}

/**
 * Built on the shared SelectBox, so the list it opens matches every other
 * dropdown in the app.
 */
export function SelectFilter({
  label,
  value,
  onChange,
  options,
  className,
  chip = false,
  icon: Icon,
  quiet = false,
  defaultValue,
  valueOnly = false,
}: SelectFilterProps) {
  const resting = value === (defaultValue ?? options[0]?.value)
  const chosen = options.find((o) => o.value === value)?.label ?? ''

  return (
    <div className={cn('relative', className)}>
      <label
        className={cn(
          `border-control hover:bg-sunken focus-within:border-brand-400 flex min-h-11 items-center gap-1.5 border pl-3
            has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600`,
          'rounded-lg',
          // Value-only sits beside a heading rather than in a filter row, so it
          // reads a step smaller and sits a step shorter.
          valueOnly ? 'text-xs' : 'text-sm',
          chip && (valueOnly ? 'sm:min-h-8' : 'sm:min-h-9.5'),
          (quiet || valueOnly) && 'relative',
        )}
      >
        {Icon && (
          <Icon
            className="text-ink-subtle size-4 shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        )}
        {valueOnly ? (
          <>
            <span
              aria-hidden="true"
              className="text-ink-muted pr-7 font-medium whitespace-nowrap"
            >
              {chosen}
            </span>
            <SelectBox
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={label}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectBox>
          </>
        ) : quiet ? (
          <>
            <span aria-hidden="true" className="pr-8 whitespace-nowrap">
              <span className={resting ? 'text-ink-muted' : 'text-ink-muted'}>
                {label}
                {resting ? '' : ': '}
              </span>
              {!resting && (
                <span className="text-ink font-medium">{chosen}</span>
              )}
            </span>
            <SelectBox
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={label}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectBox>
          </>
        ) : (
          <>
            <span className="text-ink-muted shrink-0">{label}:</span>
            {/* grow + pr-8 puts the select's own hit area under the chevron —
            clicking a label only focuses a select, it doesn't open it. */}
            <SelectBox
              value={value}
              onChange={(e) => onChange(e.target.value)}
              /*
               * `field-sizing: content` makes the control as wide as the option
               * showing rather than as wide as its longest option — "Status: All"
               * stops reserving room for "Late Arrival". Chromium-only for now;
               * everywhere else it falls back to the old behaviour, which is wider
               * but never broken.
               */
              className={cn(
                'text-ink h-full min-w-0 grow appearance-none bg-transparent pr-8 font-medium [field-sizing:content]',
              )}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectBox>
          </>
        )}
      </label>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          'text-ink-subtle pointer-events-none absolute top-1/2 -translate-y-1/2',
          valueOnly ? 'right-2.5 size-3.5' : 'right-3 size-4',
        )}
      />
    </div>
  )
}
