import { Link } from 'react-router-dom'
import { recentlyViewed, recipients } from './data'
import type { Trigger } from './data'
import { Avatar } from '@/components/ui/Avatar'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

export function FooterPanels({ triggers }: { triggers: Trigger[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section aria-labelledby="recently-viewed" className="card p-4">
        <h2
          id="recently-viewed"
          className="text-ink text-sm font-semibold tracking-tight"
        >
          Recently Viewed
        </h2>

        <ul className="mt-3 flex flex-wrap gap-2">
          {recentlyViewed.map((name) => {
            const match = recipients.find((r) => r.name === name)
            return (
              <li key={name}>
                <Link
                  to={
                    match ? `/care-recipients/${match.id}` : '/care-recipients'
                  }
                  // Filled, not outlined — the same idiom as the filter chips
                  // above it. A hairline border on a pill this small read as a
                  // smudge rather than an edge.
                  className="bg-sunken hover:bg-line inline-flex min-h-9 items-center gap-2 rounded-full py-1 pr-3 pl-1 transition-colors"
                >
                  <Avatar name={name} decorative className="size-7" />
                  <span className="text-ink text-sm">{name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="action-triggers" className="card p-4">
        <h2
          id="action-triggers"
          className="text-ink text-sm font-semibold tracking-tight"
        >
          Action Triggers
        </h2>

        <ul className="mt-3 flex flex-wrap gap-2">
          {triggers.map(({ id, label, count, tone }) => (
            <li key={id}>
              <button
                type="button"
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-opacity hover:opacity-80',
                  tonePill[tone],
                )}
              >
                {label}
                <span className="bg-surface/70 rounded-full px-1.5 text-xs tabular-nums">
                  {count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
