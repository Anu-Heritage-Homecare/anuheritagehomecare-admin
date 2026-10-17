import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ChartNoAxesColumn, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCompact, formatMoney } from '@/features/billing/data'
import {
  dailyVisits,
  financialSummary,
  formatShortDate,
  monthToDate,
  monthlyTrend,
  rangeDays,
  reportActivity,
  reportRanges,
  reportTabs,
  revenueOverview,
  satisfaction,
  utilisation,
  visitFigures,
  workforce,
} from '@/features/reports/data'
import type { ReportRange, ReportTab } from '@/features/reports/data'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { Sparkline } from '@/components/ui/Sparkline'
import { cn } from '@/lib/cn'

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

const outlineButton =
  'border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors'

const pctText = (n: number | null) => (n === null ? '—' : `${n}%`)

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/* --------------------------------- pieces --------------------------------- */

function Card({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = `report-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className={cn('card relative flex flex-col overflow-hidden p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={id} className="text-ink text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-ink-subtle mt-1 text-sm">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  )
}

/** Label/value rows with inset rules — the Figma's summary cards. */
function Readout({
  rows,
}: {
  rows: { label: string; value: string; tone?: string }[]
}) {
  return (
    <dl className="divide-line divide-y">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <dt className="text-ink-muted text-sm">{r.label}</dt>
          <dd className={cn('text-sm font-semibold tabular-nums', r.tone ?? 'text-ink')}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A ring showing a share; decorative — the figure beside it is the reading. */
function Ring({ value }: { value: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" focusable="false" className="size-14 shrink-0 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" stroke="currentColor" className="text-brand-100" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="6"
        stroke="currentColor"
        strokeLinecap="round"
        className="text-brand-600"
        strokeDasharray={`${(value / 100) * c} ${c}`}
      />
    </svg>
  )
}

/** Five rising bars, scaled to the revenue months; decorative. */
function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  return (
    <div aria-hidden="true" className="flex h-9 shrink-0 items-end gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          className="bg-brand-600 w-1.5 rounded-sm"
          style={{ height: `${40 + (max === min ? 60 : ((v - min) / (max - min)) * 60)}%` }}
        />
      ))}
    </div>
  )
}

const starBar: Record<number, string> = {
  5: 'bg-brand-600',
  4: 'bg-brand-500',
  3: 'bg-emerald-500',
  2: 'bg-amber-500',
  1: 'bg-red-500',
}

/* ---------------------------------- page ---------------------------------- */

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  /* Operations, Workforce and Financial are pages of their own (/reports/…),
     not filtered views of this one; an old ?tab= link is sent on to its page. */
  const asked = pick(params.get('tab'), reportTabs.map((t) => t.value), 'overview')
  const tab: ReportTab = 'overview'
  const range = pick(params.get('range'), reportRanges.map((r) => r.value), '30')

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const rangeLabel = reportRanges.find((r) => r.value === range)!.label.toLowerCase()
  const days = rangeDays(range)
  const visits = visitFigures(days)
  const util = utilisation(days)
  const sat = satisfaction(range)
  const trend = monthlyTrend(6)
  const mtdDays = monthToDate()
  const mtd = visitFigures(mtdDays)
  const staff = workforce()
  const fin = financialSummary()
  const revenue = revenueOverview()
  const currentMonth = revenue.months[revenue.months.length - 1].label
  const maxMonth = Math.max(...revenue.months.map((m) => m.value))

  if (asked !== 'overview') return <Navigate to={`/reports/${asked}`} replace />

  const show = (...tabs: ReportTab[]) => tab === 'overview' || tabs.includes(tab)
  const activity = reportActivity.filter((r) => tab === 'overview' || r.category === tab)

  const range_ = (key: 'completion' | 'utilisation') => {
    const vals = trend.map((m) => m[key]).filter((v): v is number => v !== null)
    if (vals.length === 0) return '—'
    const lo = Math.floor(Math.min(...vals))
    const hi = Math.round(Math.max(...vals))
    return lo === hi ? `${lo}%` : `${lo}-${hi}%`
  }

  const kpis: { label: string; value: string; note: string }[] = [
    { label: 'Total Visits', value: visits.scheduled.toLocaleString('en-US'), note: reportRanges.find((r) => r.value === range)!.label },
    { label: 'Caregiver Utilization', value: pctText(util), note: 'Rostered ÷ available hours' },
    { label: 'Revenue', value: formatMoney(fin.monthlyRevenue), note: `Plan revenue · ${currentMonth}` },
    {
      label: 'Client Satisfaction',
      value: sat.average === null ? '—' : `${sat.average}/5.0`,
      note: `${sat.count} family ${sat.count === 1 ? 'review' : 'reviews'}`,
    },
    {
      label: 'Visit Completion',
      value: pctText(visits.completion),
      note: `${visits.writtenUp} of ${visits.scheduled} written up`,
    },
    { label: 'Outstanding Invoices', value: formatMoney(fin.outstanding), note: 'As of today' },
  ]

  /** The figures on screen as a CSV — Excel opens it directly. */
  const exportCsv = () => {
    const rows: string[][] = [
      ['Reports', `${days[0]} to ${days[days.length - 1]}`],
      [],
      ['Measure', 'Value', 'Basis'],
      ...kpis.map((k) => [k.label, k.value, k.note]),
      [],
      ['Month', 'Scheduled visits', 'Completion (%)', 'Utilization (%)'],
      ...trend.map((m) => [m.id, String(m.visits), String(m.completion ?? ''), String(m.utilisation ?? '')]),
      [],
      ['Month', 'Plan revenue (NGN)'],
      ...revenue.months.map((m) => [m.label, String(m.value)]),
      [],
      ['Operational (month to date)', ''],
      ['Visits this month', String(mtd.scheduled)],
      ['Avg duration (hrs)', String(mtd.avgHours ?? '')],
      ['On-time rate (%)', String(mtd.onTime ?? '')],
      ['Cancellation rate (%)', String(mtd.cancellation ?? '')],
      [],
      ['Workforce', ''],
      ['Active caregivers', String(staff.active)],
      ['Avg rating', String(staff.avgRating ?? '')],
      ['Training compliance (%)', String(staff.training ?? '')],
      ['Attendance rate (%)', String(staff.attendance ?? '')],
      [],
      ['Financial', ''],
      ['Monthly revenue (NGN)', String(fin.monthlyRevenue)],
      ['Collection rate (%)', String(fin.collectionRate)],
      ['Avg invoice (NGN)', String(fin.avgInvoice ?? '')],
      ['Outstanding (NGN)', String(fin.outstanding)],
      [],
      ['Rating', 'Reviews', 'Share (%)'],
      ...sat.breakdown.map((b) => [b.label, String(b.count), String(b.share)]),
    ]
    const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `reports-${days[0]}-to-${days[days.length - 1]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const trendCard = show('operations', 'workforce') && (
    <Card
      title="Monthly Performance Trends"
      description="Aggregated metrics for service delivery over the last 6 months."
      aside={
        <ul className="text-ink-muted hidden shrink-0 gap-5 pt-1 text-sm md:flex">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-700" />
            Completion ({range_('completion')})
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-white ring-2 ring-brand-700" />
            Utilization ({range_('utilisation')})
          </li>
        </ul>
      }
      className={show('financial') ? 'lg:col-span-3' : 'lg:col-span-5'}
    >
      <ul className="text-ink-muted mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm md:hidden" aria-hidden="true">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-700" />
          Completion ({range_('completion')})
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-white ring-2 ring-brand-700" />
          Utilization ({range_('utilisation')})
        </li>
      </ul>
      {/* Each capsule is a 0–100% scale; the two dots sit at their month's value. */}
      <div aria-hidden="true" className="bg-canvas flex h-48 items-stretch justify-between gap-3 rounded-xl px-4 pt-4 pb-2 sm:gap-6">
        {trend.map((m) => (
          <div key={m.id} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="bg-brand-700 relative w-full max-w-16 flex-1 rounded-full">
              {m.utilisation !== null && (
                <span
                  className="absolute left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-brand-700"
                  style={{ bottom: `calc(12px + ${m.utilisation}% * 0.8)` }}
                />
              )}
              {m.completion !== null && (
                <span
                  className="absolute left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-emerald-400"
                  style={{ bottom: `calc(12px + ${m.completion}% * 0.8)` }}
                />
              )}
            </div>
            <span className="text-ink mt-2 text-sm font-medium">{m.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Visit completion and caregiver utilization by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Completion</th>
            <th scope="col">Utilization</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((m) => (
            <tr key={m.id}>
              <th scope="row">{m.label}{m.partial ? ' (to date)' : ''}</th>
              <td>{pctText(m.completion)}</td>
              <td>{pctText(m.utilisation)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )

  const revenueCard = show('financial') && (
    <Card
      title="Revenue Overview"
      description={
        <>
          YTD Revenue:{' '}
          <span className="font-semibold text-emerald-700 tabular-nums">{formatMoney(revenue.ytd)}</span>
        </>
      }
      className={show('operations') ? 'lg:col-span-2' : 'lg:col-span-5'}
    >
      <div aria-hidden="true" className="bg-canvas flex h-48 items-end justify-between gap-3 rounded-xl px-4 pt-4 pb-2 sm:gap-4">
        {revenue.months.map((m) => (
          <div key={m.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={formatCompact(m.value)}>
            <div
              className="bg-brand-600 w-full max-w-10 rounded-t-md"
              style={{ height: `${(m.value / maxMonth) * 100}%` }}
            />
            <span className="text-ink mt-2 text-sm font-medium">{m.label.split(' ')[0]}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Plan revenue by month</caption>
        <tbody>
          {revenue.months.map((m) => (
            <tr key={m.label}>
              <th scope="row">{m.label}</th>
              <td>{formatMoney(m.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )

  const summaries = [
    show('operations') && (
      <Card
        key="ops"
        title="Operational Performance"
        aside={
          <span className="text-brand-600">
            <Sparkline series={dailyVisits(mtdDays)} unit="visits" label="Visits per day this month" className="h-8 w-24" />
          </span>
        }
      >
        <Readout
          rows={[
            { label: 'Visits This Month', value: String(mtd.scheduled) },
            { label: 'Avg Duration', value: mtd.avgHours === null ? '—' : `${mtd.avgHours} hrs` },
            { label: 'On-Time Rate', value: pctText(mtd.onTime), tone: 'text-emerald-700' },
            { label: 'Cancellation Rate', value: pctText(mtd.cancellation), tone: 'text-red-600' },
          ]}
        />
      </Card>
    ),
    show('workforce') && (
      <Card
        key="staff"
        title="Workforce Summary"
        aside={<Ring value={staff.total === 0 ? 0 : (staff.active / staff.total) * 100} />}
      >
        <Readout
          rows={[
            { label: 'Active Caregivers', value: String(staff.active) },
            { label: 'Avg Rating', value: staff.avgRating === null ? '—' : `${staff.avgRating}/5.0`, tone: 'text-amber-700' },
            { label: 'Training Compliance', value: pctText(staff.training), tone: 'text-emerald-700' },
            { label: 'Attendance Rate', value: pctText(staff.attendance), tone: 'text-brand-600' },
          ]}
        />
      </Card>
    ),
    show('financial') && (
      <Card key="fin" title="Financial Summary" aside={<MiniBars values={revenue.months.slice(-5).map((m) => m.value)} />}>
        <Readout
          rows={[
            { label: 'Monthly Revenue', value: formatMoney(fin.monthlyRevenue) },
            { label: 'Collection Rate', value: `${fin.collectionRate}%`, tone: 'text-emerald-700' },
            { label: 'Avg Invoice', value: fin.avgInvoice === null ? '—' : formatMoney(fin.avgInvoice) },
            { label: 'Outstanding', value: formatMoney(fin.outstanding), tone: 'text-red-600' },
          ]}
        />
      </Card>
    ),
  ].filter(Boolean)

  const satisfactionCard = show('operations') && (
    <Card
      title="Client Satisfaction Breakdown"
      description={sat.count === 0 ? `No family reviews in the ${rangeLabel}.` : undefined}
    >
      <ul className="space-y-4">
        {sat.breakdown.map((b) => (
          <li key={b.stars} className="grid grid-cols-[minmax(0,10rem)_1fr_2.75rem] items-center gap-4 text-sm sm:grid-cols-[12rem_1fr_3rem]">
            <span className="text-ink-muted truncate">{b.label}</span>
            <span className="bg-sunken h-1.5 overflow-hidden rounded-full" aria-hidden="true">
              <span className={cn('block h-full rounded-full', starBar[b.stars])} style={{ width: `${b.share}%` }} />
            </span>
            <span className="text-ink text-right font-semibold tabular-nums">
              {b.share}%<span className="sr-only"> ({b.count} {b.count === 1 ? 'review' : 'reviews'})</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )

  const activityCard = (
    <Card title="Recent Report Activity">
      {activity.length === 0 ? (
        <p className="text-ink-muted py-6 text-center text-sm">No reports generated yet.</p>
      ) : (
        <ul className="divide-line divide-y">
          {activity.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-ink truncate text-sm font-semibold">{r.name}</p>
                <p className="text-ink-subtle mt-0.5 text-xs">
                  Generated {formatShortDate(r.generatedAt)} • By {r.by}
                </p>
              </div>
              {r.to ? (
                <Link
                  to={r.to}
                  aria-label={`Open ${r.name}`}
                  className="bg-brand-50 text-brand-600 hover:bg-brand-100 grid size-9 shrink-0 place-items-center rounded-lg transition-colors"
                >
                  <ChartNoAxesColumn className="size-4.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              ) : (
                // No file is stored in the prototype, so there is nothing to open.
                <button
                  type="button"
                  aria-label={`Open ${r.name}`}
                  className="bg-brand-50 text-brand-600 hover:bg-brand-100 grid size-9 shrink-0 place-items-center rounded-lg transition-colors"
                >
                  <ChartNoAxesColumn className="size-4.5" strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
          <p className="text-ink-muted mt-1 text-sm sm:text-base">
            Analyze operational, workforce and financial performance across your organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {/* The browser's print dialog saves a PDF; no server renders one. */}
          <button type="button" onClick={() => window.print()} className={outlineButton}>
            Export PDF
          </button>
          <button type="button" onClick={exportCsv} className={outlineButton}>
            Export CSV
          </button>
          {/* No report builder exists yet; a button only. */}
          <button
            type="button"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Generate Report
          </button>
        </div>
      </header>

      <section aria-labelledby="report-kpis">
        <h2 id="report-kpis" className="sr-only">Key figures</h2>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <article key={k.label} className="card p-4">
              <p className="text-ink text-[0.6875rem] font-semibold tracking-wide uppercase">{k.label}</p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums xl:text-xl 2xl:text-[1.75rem]">{k.value}</p>
              <p className="text-ink-subtle mt-1 text-xs">{k.note}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav aria-label="Report views" className="flex flex-wrap gap-2">
          {reportTabs.map((t) => {
            const active = t.value === tab
            return (
              <Link
                key={t.value}
                to={t.value === 'overview' ? '/reports' : `/reports/${t.value}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'border-control bg-surface text-ink hover:bg-sunken border',
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
        <SelectFilter
          label="Date range"
          valueOnly
          value={range}
          onChange={(v) => setParam('range', v as ReportRange, '30')}
          options={reportRanges}
          className="w-full min-[480px]:w-auto"
        />
      </div>

      {(trendCard || revenueCard) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {trendCard}
          {revenueCard}
        </div>
      )}

      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          summaries.length === 3 && 'md:grid-cols-2 xl:grid-cols-3',
          summaries.length === 2 && 'md:grid-cols-2',
        )}
      >
        {summaries}
      </div>

      <div className={cn('grid grid-cols-1 items-start gap-6', satisfactionCard && 'lg:grid-cols-2')}>
        {satisfactionCard}
        {activityCard}
      </div>
    </div>
  )
}
