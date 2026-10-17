import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PanelProps {
  title: string
  /** One line under the title, where a design gives the panel a subtitle. */
  description?: string
  /** Small badge to the right of the title, e.g. "4 Active". */
  badge?: ReactNode
  /** Footer link rendered centred beneath the body. */
  action?: { label: string; to: string }
  children: ReactNode
  /** Set when the body supplies its own padding (tables, divided lists). */
  flush?: boolean
  className?: string
  /** Overrides the heading's type, where a design gives a panel a larger one. */
  titleClassName?: string
}

export function Panel({
  title,
  description,
  badge,
  action,
  children,
  flush,
  className,
  titleClassName,
}: PanelProps) {
  const headingId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section
      aria-labelledby={headingId}
      className={cn('card flex flex-col overflow-hidden', className)}
    >
      <div
        className={cn(
          'flex justify-between gap-3 px-4 pt-4',
          description ? 'items-start' : 'items-center',
          flush ? 'pb-3' : 'pb-0',
        )}
      >
        <div className="min-w-0">
          <h2
            id={headingId}
            className={cn(
              'text-ink min-w-0 text-sm font-semibold tracking-tight',
              titleClassName,
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="text-ink-muted mt-0.5 text-xs">{description}</p>
          )}
        </div>
        {badge}
      </div>

      <div className={cn('flex-1', flush ? '' : 'px-4 pt-3 pb-4')}>
        {children}
      </div>

      {action && (
        /*
         * No rule above the link. The designs draw the footer as part of the
         * card rather than as a band cut off from it, and where the body is a
         * divided list the extra full-bleed rule read as one more row.
         */
        <div className="p-3 text-center">
          <Link
            to={action.to}
            className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1.5 text-sm font-medium"
          >
            {action.label}
            <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  )
}
