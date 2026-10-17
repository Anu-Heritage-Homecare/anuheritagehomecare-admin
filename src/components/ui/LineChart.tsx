import { cn } from '@/lib/cn'

export interface LinePoint {
  label: string
  value: number
}

interface LineChartProps {
  points: LinePoint[]
  /** Compact form for axis ticks. */
  formatTick: (value: number) => string
  /** Full precision for the accessible table — a screen reader shouldn't
   *  only get the rounded axis figure. */
  formatValue: (value: number) => string
  caption: string
  columns?: [string, string]
}

/** Rounds up to a readable axis ceiling: 293,950 → 300,000. */
function ceiling(max: number): number {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  return Math.ceil(max / (magnitude / 2)) * (magnitude / 2)
}

const TICKS = [0, 0.25, 0.5, 0.75, 1]
/** Percent of the plot width left empty before the first and after the last point. */
const X_INSET = 7

/**
 * Dependency-free trend line.
 *
 * The SVG draws only strokes, stretched to the plot with
 * `preserveAspectRatio="none"` and non-scaling strokes. Labels and dots are
 * HTML positioned by percentage: text inside a scaled SVG tracks the chart's
 * width, which put 20px axis labels on a desktop panel and 6px ones on a
 * phone, and a stretched circle would draw as an ellipse.
 *
 * The path is decorative; the same figures are exposed as a visually-hidden
 * table so the trend isn't sighted-only.
 */
export function LineChart({
  points,
  formatTick,
  formatValue,
  caption,
  columns = ['Period', 'Value'],
}: LineChartProps) {
  if (points.length < 2) return null

  const max = ceiling(Math.max(...points.map((p) => p.value)))
  const coords = points.map((p, i) => ({
    ...p,
    // Inset from both ends so the first and last labels, centred on their
    // points, clear the y-axis and the panel edge.
    x: X_INSET + (i / (points.length - 1)) * (100 - 2 * X_INSET),
    y: (1 - p.value / max) * 100,
  }))
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ')

  return (
    <>
      <div aria-hidden="true" className="text-ink-subtle flex text-xs">
        {/* y-axis labels */}
        <div className="relative h-44 w-12 shrink-0 sm:h-52">
          {TICKS.map((t) => (
            <span
              key={t}
              className="absolute right-3 -translate-y-1/2 whitespace-nowrap tabular-nums"
              style={{ top: `${(1 - t) * 100}%` }}
            >
              {formatTick(max * t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44 sm:h-52">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              focusable="false"
              className="absolute inset-0 size-full overflow-visible"
            >
              {TICKS.map((t) => (
                <line
                  key={t}
                  x1={0}
                  x2={100}
                  y1={(1 - t) * 100}
                  y2={(1 - t) * 100}
                  className="text-line"
                  stroke="currentColor"
                  strokeWidth={1}
                  strokeDasharray={t === 0 ? undefined : '4 4'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <polyline
                points={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="text-brand-600"
              />
            </svg>

            {coords.map((c) => (
              <span
                key={c.label}
                className="bg-surface border-brand-600 absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              />
            ))}
          </div>

          {/* x-axis labels. Under 640px only every other one is drawn — six
              "Feb 2026"s collide at phone width. The table carries them all. */}
          <div className="relative mt-3 h-4">
            {coords.map((c, i) => (
              <span
                key={c.label}
                className={cn(
                  'absolute -translate-x-1/2 whitespace-nowrap',
                  i % 2 !== 0 && 'max-sm:hidden',
                )}
                style={{ left: `${c.x}%` }}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{columns[0]}</th>
            <th scope="col">{columns[1]}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{formatValue(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
