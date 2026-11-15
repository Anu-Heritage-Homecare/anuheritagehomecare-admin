import type { Summary } from './data'
import { toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'

export function SummaryCards({ summaries }: { summaries: Summary[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
      {summaries.map(({ id, label, value, meta, metaTone, hint }) => (
        <article key={id} className="card p-4">
          <h2 className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
            {label}
          </h2>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-ink text-3xl font-bold tracking-tight tabular-nums">
              {value}
            </p>
            <p className={cn('text-sm font-medium', toneText[metaTone])}>
              {meta}
            </p>
          </div>

          <p className="text-ink-subtle mt-1.5 text-xs">{hint}</p>
        </article>
      ))}
    </div>
  )
}
