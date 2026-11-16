import type { Metric } from './data'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { toneFill, toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'

export function PerformanceSnapshot({ metrics }: { metrics: Metric[] }) {
  return (
    <section aria-labelledby="performance-snapshot">
      <SectionHeading id="performance-snapshot" title="Performance Snapshot" />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map(({ id, label, value, percent, tone, emphasis }) => (
          <article key={id} className="card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id={`metric-${id}`} className="text-ink min-w-0 text-sm font-semibold">
                {label}
              </h3>
              {!emphasis && (
                <span className="text-ink text-sm font-semibold tabular-nums">
                  {value}
                </span>
              )}
            </div>

            {emphasis && (
              <p className={cn('mt-0.5 text-sm font-semibold', toneText[tone])}>
                {value}
              </p>
            )}

            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              // The visible value isn't always a percentage (₦12,450, 4.8/5.0),
              // so give AT the real text rather than the bar's fill.
              aria-valuetext={value}
              aria-labelledby={`metric-${id}`}
              className="bg-sunken mt-3 h-1.5 w-full overflow-hidden rounded-full"
            >
              <div
                className={cn('h-full rounded-full', toneFill[tone])}
                style={{ width: `${percent}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
