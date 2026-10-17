import { formatDay } from './operations'
import { cn } from '@/lib/cn'

/** A daily series as a line; decorative, with the numbers in a table. */
export function TrendLine({
  points,
  caption,
  formatValue,
}: {
  points: { date: string; value: number }[]
  caption: string
  formatValue: (v: number) => string
}) {
  if (points.length < 2) return null
  // Scaled between the period's own low and high, so a day-to-day swing is
  // visible; the table carries the absolute figures.
  const max = Math.max(...points.map((p) => p.value))
  const min = Math.min(...points.map((p) => p.value))
  const span = max - min || 1
  const coords = points.map((p, i) => ({
    ...p,
    x: (i / (points.length - 1)) * 100,
    // Top 10% left clear so the peak's dot is not clipped.
    y: max === min ? 50 : 10 + (1 - (p.value - min) / span) * 80,
  }))
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const ticks = [0, Math.round((points.length - 1) / 3), Math.round((2 * (points.length - 1)) / 3), points.length - 1]
  return (
    <>
      <div aria-hidden="true" className="from-brand-50 rounded-xl bg-gradient-to-b to-transparent px-3 pt-3 pb-2">
        <div className="relative h-36 sm:h-40">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" className="absolute inset-0 size-full overflow-visible">
            <polyline
              points={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="text-brand-600"
            />
          </svg>
          {points.length <= 45 &&
            coords.map((c) => (
              <span
                key={c.date}
                className="bg-brand-600 absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              />
            ))}
        </div>
        <div className="text-ink-subtle relative mt-2 h-4 text-xs">
          {ticks.map((i, n) => (
            <span
              key={i}
              className={cn('absolute whitespace-nowrap', n === 0 ? '' : n === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2')}
              style={{ left: `${coords[i].x}%` }}
            >
              {formatDay(coords[i].date)}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{formatDay(p.date)}</th>
              <td>{formatValue(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

