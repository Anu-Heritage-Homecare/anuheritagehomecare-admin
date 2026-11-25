import { Link } from 'react-router-dom'
import { quickActions } from './data'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { toneChip } from '@/lib/tone'
import { cn } from '@/lib/cn'

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions">
      <SectionHeading id="quick-actions" title="Quick Actions" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
        {quickActions.map(({ id, label, icon: Icon, tone, to }) => (
          <Link
            key={id}
            to={to}
            className="card hover:border-brand-300 hover:bg-brand-50/40 group flex flex-col gap-3 p-4 text-left transition-colors"
          >
            {/*
              * The chip keeps its own colour on hover. Repainting all six
              * brand-indigo on hover threw away the thing the colour is for —
              * it made the tile you are pointing at the one you can no longer
              * identify by its icon chip.
              */}
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl',
                toneChip[tone],
              )}
            >
              <Icon className="size-4.5" strokeWidth={1.9} />
            </span>
            <span className="text-ink text-sm leading-snug font-semibold">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
