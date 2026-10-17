import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUp, Calendar, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  COMPLETION_TARGET,
  SERVICE_BAR_SCALE,
  cancellations,
  completionByWeek,
  dayTicks,
  filterOptions,
  locations,
  reportingPeriod,
  serviceTypes,
  tiles,
  visitsByDay,
} from '@/features/reports/operations-report'
import type { TileTone, Trend } from '@/features/reports/operations-report'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Built to the Figma (operations-report), content included: the figures are the
 * design's own, held in features/reports/operations-report.ts. The filters are
 * real controls but do not recompute anything.
 */

const outlineButton =
  'border-line text-ink hover:bg-sunken bg-surface inline-flex h-9 items-center justify-center rounded-lg border px-3.5 text-sm font-medium shadow-xs transition-colors'

const pill: Record<TileTone, string> = {
  blue: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
}

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = `ops-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className={cn('card relative overflow-hidden p-5 sm:p-6', className)}>
      <h2 id={id} className="text-ink text-base font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** The design's compact select: a white field, dark value, chevron at the right. */
function Select({ label, options }: { label: string; options: readonly string[] }) {
  const [value, setValue] = useState(options[0])
  return (
    <label className="block">
      <span className="text-ink mb-1.5 block text-[0.6875rem] font-medium tracking-wide uppercase">{label}</span>
      <span className="relative block">
        <SelectBox
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="border-line bg-surface text-ink focus-visible:outline-brand-600 h-9 w-full appearance-none rounded-lg border pr-9 pl-3 text-sm font-medium shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </SelectBox>
        <ChevronDown
          className="text-ink pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
    </label>
  )
}

/** Daily visits as a line over the design's blue wash; numbers are in the table. */
function VisitsByDay() {
  const max = Math.max(...visitsByDay)
  const min = Math.min(...visitsByDay)
  const coords = visitsByDay.map((v, i) => ({
    v,
    x: (i / (visitsByDay.length - 1)) * 100,
    y: 8 + (1 - (v - min) / (max - min)) * 84,
  }))
  return (
    <>
      <div
        aria-hidden="true"
        className="rounded-lg bg-gradient-to-b from-[#e3ecf8] to-[#f5f7fb] px-5 pt-4 pb-3"
      >
        <div className="relative h-56">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" className="absolute inset-0 size-full overflow-visible">
            <polyline
              points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="text-brand-600"
            />
          </svg>
          {coords.map((c, i) => (
            <span
              key={i}
              className="bg-brand-600 absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
            />
          ))}
        </div>
        <div className="text-ink-subtle relative mt-3 h-4 text-[0.6875rem]">
          {dayTicks.map((t, n) => (
            <span
              key={t.label}
              className={cn(
                'absolute whitespace-nowrap',
                n === 0 ? '' : n === dayTicks.length - 1 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{ left: `${coords[t.index].x}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Visits by day, October 2024</caption>
        <tbody>
          {visitsByDay.map((v, i) => (
            <tr key={i}>
              <th scope="row">Oct {i + 1}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* Bars are drawn on a 60–100% scale, as the design does: at full scale four
   bars between 95% and 97% would be indistinguishable. */
const SCALE_FLOOR = 60
const onScale = (v: number) => ((v - SCALE_FLOOR) / (100 - SCALE_FLOOR)) * 100

function CancellationDonut() {
  const r = 38
  const c = 2 * Math.PI * r
  const total = cancellations.reasons.reduce((s, x) => s + x.share, 0)
  const arcs = cancellations.reasons.reduce<{ label: string; colour: string; dash: number; offset: number }[]>((acc, x) => {
    const before = acc.reduce((s, a) => s + a.dash, 0)
    return [...acc, { label: x.label, colour: x.colour, dash: (x.share / total) * c, offset: -before }]
  }, [])
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative size-28 shrink-0">
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="size-full -rotate-90">
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={a.colour}
              strokeWidth="14"
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={a.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-ink text-lg leading-none font-bold tabular-nums">{cancellations.total}</p>
            <p className="text-ink-subtle mt-1 text-[0.625rem]">Total</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {cancellations.reasons.map((x) => (
          <li key={x.label} className="text-ink-muted flex items-center gap-2 text-xs">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: x.colour }} />
            {x.label} ({x.share}%)
          </li>
        ))}
      </ul>
    </div>
  )
}

const trendIcon: Record<Trend, { Icon: typeof ArrowUp; className: string; label: string }> = {
  up: { Icon: ArrowUp, className: 'text-emerald-500', label: 'Trending up' },
  flat: { Icon: ArrowRight, className: 'text-slate-400', label: 'No change' },
  down: { Icon: ArrowDown, className: 'text-red-500', label: 'Trending down' },
}

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/* ---------------------------------- page ---------------------------------- */

export function OperationsReportPage() {
  /** The figures on screen as a CSV — Excel opens it directly. */
  const exportExcel = () => {
    const rows: string[][] = [
      ['Operations Report', reportingPeriod],
      [],
      ...tiles.map((t) => [t.label, t.value, t.badge]),
      [],
      ['Day', 'Visits'],
      ...visitsByDay.map((v, i) => [`Oct ${i + 1}`, String(v)]),
      [],
      ['Week', 'Completion rate'],
      ...completionByWeek.map((w) => [w.label, `${w.value}%`]),
      [],
      ['Cancellation reason', 'Share'],
      ...cancellations.reasons.map((x) => [x.label, `${x.share}%`]),
      [],
      ['Service type', 'Visits'],
      ...serviceTypes.map((s) => [s.label, String(s.visits)]),
      [],
      ['Location', 'Total Visits', 'Completion Rate', 'Avg Duration', 'Satisfaction', 'Trend'],
      ...locations.map((l) => [l.name, String(l.visits), l.completion, l.duration, l.satisfaction, l.trend]),
    ]
    const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'operations-report-oct-2024.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-ink-subtle mb-4 flex items-center gap-2 text-xs print:hidden">
        <Link to="/reports" className="hover:text-ink">
          Reports
        </Link>
        <span aria-hidden="true">&gt;</span>
        <span aria-current="page" className="text-brand-600 font-medium">
          Operations Report
        </span>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-ink text-[1.625rem] leading-tight font-bold tracking-tight">Operations Report</h1>
          <p className="text-ink-muted mt-1.5 text-sm">Detailed analysis of care delivery performance and service trends.</p>
        </div>
        <div className="flex flex-wrap gap-2.5 print:hidden">
          <button type="button" onClick={() => window.print()} className={outlineButton}>
            Print
          </button>
          <button type="button" onClick={exportExcel} className={outlineButton}>
            Export Excel
          </button>
          {/* The browser's print dialog saves a PDF; no server renders one. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium text-white shadow-xs transition-colors"
          >
            Export PDF
          </button>
        </div>
      </header>

      <div className="card flex h-12 items-center justify-between gap-3 px-4">
        <p className="text-ink flex items-center gap-2.5 text-sm font-semibold">
          <Calendar className="size-4" strokeWidth={2} aria-hidden="true" />
          Reporting Period
        </p>
        <label className="relative">
          <span className="sr-only">Reporting period</span>
          <SelectBox
            defaultValue={reportingPeriod}
            className="text-ink-muted focus-visible:outline-brand-600 h-8 appearance-none rounded-md bg-transparent pr-6 pl-1 text-right text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option>{reportingPeriod}</option>
          </SelectBox>
          <ChevronDown
            className="text-ink-muted pointer-events-none absolute top-1/2 right-1 size-3.5 -translate-y-1/2"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 min-[480px]:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Select label="Branch" options={filterOptions.branch} />
        <Select label="Service Type" options={filterOptions.service} />
        <Select label="Caregiver" options={filterOptions.caregiver} />
        <Select label="Status" options={filterOptions.status} />
      </div>

      <Card title="Visit Performance">
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <article key={t.label} className="border-line rounded-xl border px-4 pt-4 pb-3.5">
              <p className="text-ink text-[0.6875rem] font-medium tracking-wide uppercase">{t.label}</p>
              <p className="text-ink mt-2 text-[1.625rem] leading-tight font-bold tracking-tight whitespace-nowrap tabular-nums">
                {t.value}
              </p>
              <span className={cn('mt-1.5 inline-block rounded px-1.5 py-0.5 text-[0.625rem] leading-tight font-semibold', pill[t.tone])}>
                {t.badge}
              </span>
            </article>
          ))}
        </div>

        <h3 className="text-ink mt-6 mb-3 text-sm font-medium">Visits by Day (Daily trends)</h3>
        <VisitsByDay />
      </Card>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card title="Visit Completion Rate">
          <div aria-hidden="true" className="bg-canvas rounded-xl px-0 pt-6 pb-3">
            <div className="relative h-44">
              <div
                className="absolute inset-x-0 border-t-2 border-dashed border-emerald-500"
                style={{ bottom: `${onScale(COMPLETION_TARGET)}%` }}
              >
                <span className="absolute bottom-1 left-4 text-[0.625rem] font-semibold text-emerald-700">
                  Target: {COMPLETION_TARGET}%
                </span>
              </div>
              <div className="absolute inset-0 flex items-end justify-around px-4">
                {completionByWeek.map((w) => (
                  <div key={w.label} className="w-10 rounded-t-sm bg-[#55b685]" style={{ height: `${onScale(w.value)}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-3 flex justify-around px-4">
              {completionByWeek.map((w) => (
                <span key={w.label} className="text-ink w-10 text-center text-[0.6875rem] font-semibold whitespace-nowrap">
                  <span className="-mx-6 block">
                    {w.label} ({w.value}%)
                  </span>
                </span>
              ))}
            </div>
          </div>
          <table className="sr-only">
            <caption>Visit completion rate by week; target {COMPLETION_TARGET}%</caption>
            <tbody>
              {completionByWeek.map((w) => (
                <tr key={w.label}>
                  <th scope="row">{w.label}</th>
                  <td>{w.value}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Cancellation Reasons">
          <CancellationDonut />
        </Card>
      </div>

      <Card title="Top Service Types">
        <ul className="space-y-4">
          {serviceTypes.map((s) => (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-ink font-medium">{s.label}</span>
                <span className="text-brand-600 font-semibold tabular-nums">{s.visits} visits</span>
              </div>
              <div className="bg-sunken mt-2 h-2 overflow-hidden rounded-full" aria-hidden="true">
                <div className="bg-brand-600 h-full rounded-full" style={{ width: `${(s.visits / SERVICE_BAR_SCALE) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Performance by Location">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead>
              <tr className="bg-canvas text-ink text-xs">
                <th scope="col" className="rounded-l-md px-4 py-3 font-semibold">Location</th>
                <th scope="col" className="px-4 py-3 font-semibold">Total Visits</th>
                <th scope="col" className="px-4 py-3 font-semibold">Completion Rate</th>
                <th scope="col" className="px-4 py-3 font-semibold">Avg Duration</th>
                <th scope="col" className="px-4 py-3 font-semibold">Satisfaction</th>
                <th scope="col" className="rounded-r-md px-4 py-3 text-center font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {locations.map((l) => {
                const { Icon, className, label } = trendIcon[l.trend]
                return (
                  <tr key={l.name}>
                    <th scope="row" className="text-ink px-4 py-3.5 font-semibold whitespace-nowrap">{l.name}</th>
                    <td className="text-ink px-4 py-3.5 tabular-nums">{l.visits}</td>
                    <td className="text-ink px-4 py-3.5 tabular-nums">{l.completion}</td>
                    <td className="text-ink px-4 py-3.5 tabular-nums">{l.duration}</td>
                    <td className="px-4 py-3.5 font-semibold text-amber-600 tabular-nums">{l.satisfaction}</td>
                    <td className="px-4 py-3.5">
                      <Icon role="img" aria-label={label} className={cn('mx-auto size-4', className)} strokeWidth={2} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
