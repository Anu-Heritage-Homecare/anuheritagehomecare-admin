import type { ActivityEntry } from './data'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { toneChip } from '@/lib/tone'
import { cn } from '@/lib/cn'

export function ActivityTimeline({ activity }: { activity: ActivityEntry[] }) {
  return (
    <section aria-labelledby="recent-activity">
      <SectionHeading id="recent-activity" title="Recent Activity Timeline" />

      <ul className="card divide-line divide-y">
        {activity.map(({ id, title, detail, ago, icon: Icon, tone }) => (
          <li key={id} className="flex items-start gap-3 p-4">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full',
                toneChip[tone],
              )}
            >
              <Icon className="size-4" strokeWidth={2} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 className="text-ink min-w-0 text-sm font-semibold break-words">
                  {title}
                </h3>
                <span className="text-ink-subtle shrink-0 text-xs whitespace-nowrap">
                  {ago}
                </span>
              </div>
              <p className="text-ink-muted mt-0.5 text-sm">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
