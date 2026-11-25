import { ArrowUp, ArrowDown } from 'lucide-react'
import type { Stat } from './data'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { toneChip } from '@/lib/tone'
import { cn } from '@/lib/cn'

export function OperationsSnapshot({ stats }: { stats: Stat[] }) {
  return (
    <section aria-labelledby="operations-snapshot">
      <SectionHeading id="operations-snapshot" title="Operations Snapshot">
        <span className="text-ink-subtle text-sm">Real-time overview</span>
      </SectionHeading>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map(({ id, label, value, meta, trend, icon: Icon, tone }) => (
          <article key={id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg',
                  toneChip[tone],
                )}
              >
                <Icon className="size-4.5" strokeWidth={1.9} />
              </span>

              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-right text-xs font-medium',
                  trend === 'up' && 'text-emerald-600',
                  trend === 'down' && 'text-red-600',
                  !trend && 'text-ink-subtle',
                )}
              >
                {trend === 'up' && <ArrowUp className="size-3" strokeWidth={2.5} />}
                {trend === 'down' && <ArrowDown className="size-3" strokeWidth={2.5} />}
                {meta}
              </span>
            </div>

            <p className="text-ink mt-3 text-3xl font-bold tracking-tight tabular-nums">
              {value}
            </p>
            <p className="text-ink-muted mt-0.5 text-sm">{label}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
