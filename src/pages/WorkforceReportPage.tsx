import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Loader2, Plus, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { periodOptions } from '@/features/reports/operations'
import type { PeriodId } from '@/features/reports/operations'
import {
  RENEWAL_HORIZON_DAYS,
  formatWorkforcePeriod,
  renewalLabels,
  useWorkforceReport,
} from '@/features/reports/useWorkforceReport'
import type { RenewalState, WorkforceReportView } from '@/features/reports/useWorkforceReport'
import { TrendLine } from '@/features/reports/TrendLine'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

const outlineButton =
  'border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors'

const pctText = (n: number | null) => (n === null ? '—' : `${n}%`)
const rateText = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)}%`)
const scoreText = (n: number | null) => (n === null ? '—' : n.toFixed(1))

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })

/**
 * The design's reporting-period field: a white control as wide as the words on
 * it, dark value, chevron at the right. The real SelectBox lies over it at zero
 * opacity, so the shared picker and keyboard handling are kept.
 */
function FilterField({
  label,
  shown,
  value,
  onChange,
  options,
}: {
  label: string
  shown: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <span className="border-line bg-surface hover:bg-sunken has-[:focus-visible]:outline-brand-600 relative flex h-11 items-center gap-2 rounded-lg border pr-3 pl-3.5 shadow-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 sm:h-9 lg:inline-flex">
      <span aria-hidden="true" className="text-ink grow text-sm font-medium whitespace-nowrap tabular-nums">
        {shown}
      </span>
      <ChevronDown className="text-ink size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      <SelectBox
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectBox>
    </span>
  )
}

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function Card({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string
  description?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = `wf-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className={cn('card relative overflow-hidden p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-ink text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-ink-subtle mt-1 text-sm">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const pill = {
  blue: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-sunken text-ink-muted',
}

const bandColour: Record<string, { bar: string; text: string }> = {
  outstanding: { bar: 'bg-emerald-500', text: 'text-emerald-700' },
  good: { bar: 'bg-brand-600', text: 'text-brand-700' },
  satisfactory: { bar: 'bg-amber-500', text: 'text-amber-700' },
  improve: { bar: 'bg-red-500', text: 'text-red-600' },
}

const renewalTone: Record<RenewalState, { pill: string; text: string }> = {
  action: { pill: 'bg-red-100 text-red-700', text: 'text-red-600' },
  grace: { pill: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
  scheduled: { pill: pill.blue, text: 'text-brand-700' },
}

function daysText(days: number): string {
  if (days < 0) return `Expired ${-days} ${days === -1 ? 'day' : 'days'} ago`
  if (days === 0) return 'Expires today'
  return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`
}

/* ------------------------------- the report ------------------------------- */

function Report({ view, periodId, onPeriod }: { view: WorkforceReportView; periodId: PeriodId; onPeriod: (id: PeriodId) => void }) {
  const { period, kpis: s, weeks, attendance, bands, unrated, rankings: ranks, compliance: split, expiring, flags } = view

  const tiles: { label: string; value: string; badge: string; tone: keyof typeof pill }[] = [
    { label: 'Active Caregivers', value: String(s.active), badge: s.headcount === null ? `${s.active} active` : `${s.active} of ${s.headcount} rostrable`, tone: 'green' },
    { label: 'Utilization Rate', value: pctText(s.utilisation), badge: 'Rostered ÷ available', tone: 'blue' },
    { label: 'Attendance Rate', value: rateText(s.attendance), badge: 'logged visits', tone: 'green' },
    {
      label: 'Avg Performance',
      value: s.avgRating === null ? '—' : `${s.avgRating} / 5.0`,
      badge: 'care team ratings',
      tone: 'amber',
    },
    { label: 'Training Compliance', value: pctText(s.training), badge: `${split.compliant} of ${split.compliant + split.overdue} compliant`, tone: 'blue' },
  ]

  const exportCsv = () => {
    const rows: string[][] = [
      ['Workforce report', formatWorkforcePeriod(period)],
      [],
      ['Measure', 'Value'],
      ...tiles.map((t) => [t.label, t.value]),
      [],
      ['Week', 'Utilization (%)'],
      ...weeks.map((w) => [w.label, String(w.value ?? '')]),
      [],
      ['Date', 'Attendance (%)'],
      ...attendance.map((a) => [a.date, String(a.value)]),
      [],
      ['Rank', 'Caregiver', 'Rating', 'Visits completed', 'On-time (%)', 'Attendance (%)', 'CSAT'],
      ...ranks.map((r, i) => [String(i + 1), r.name, String(r.rating ?? ''), String(r.completed), String(r.onTime ?? ''), String(r.attendance ?? ''), String(r.csat ?? '')]),
      [],
      ['Caregiver', 'Credential', 'Expires', 'Status'],
      ...expiring.map((e) => [e.caregiverName, e.name, e.expiresAt, renewalLabels[e.state]]),
      [],
      ['Flagged', 'Reason'],
      ...flags.map((f) => [f.name, f.reason]),
    ]
    const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `workforce-report-${period.from}-to-${period.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const attendanceValues = attendance.map((a) => a.value)
  const attendanceRange =
    attendanceValues.length === 0
      ? ''
      : ` (Range ${Math.min(...attendanceValues)}% – ${Math.max(...attendanceValues)}%)`

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight sm:text-3xl">Workforce Report</h1>
          <p className="text-ink-muted mt-1 text-sm">Analyze caregiver performance, attendance, and compliance metrics.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={exportCsv} className={outlineButton}>
            Export CSV
          </button>
          {/* The browser's print dialog saves a PDF; no server renders one. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Export PDF
          </button>
        </div>
      </header>

      <div className="card flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-end">
        {/* One field, as drawn: it reads the dates, and picks among the presets. */}
        <FilterField
          label="Reporting period"
          shown={formatWorkforcePeriod(period)}
          value={periodId}
          onChange={(v) => onPeriod(v as PeriodId)}
          options={periodOptions}
        />
      </div>

      <section aria-labelledby="wf-kpis">
        <h2 id="wf-kpis" className="sr-only">Key figures</h2>
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map((t) => (
            <article key={t.label} className="card p-4">
              <p className="text-ink text-[0.6875rem] font-semibold tracking-wide uppercase">{t.label}</p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums">{t.value}</p>
              <span className={cn('mt-2 inline-block rounded px-1.5 py-0.5 text-[0.6875rem] font-medium', pill[t.tone])}>
                {t.badge}
              </span>
            </article>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Caregiver Utilization by Week" description="Rostered hours against stated availability, week by week over the period.">
          <div aria-hidden="true" className="bg-canvas flex h-56 items-stretch justify-around gap-3 rounded-xl px-4 pt-4 pb-2">
            {weeks.map((w) => (
              <div key={w.label} className="flex min-w-0 flex-1 flex-col items-center">
                <span className="text-brand-700 mb-1 text-xs font-semibold tabular-nums">{pctText(w.value)}</span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div className="bg-brand-600 w-full max-w-9 rounded-t-md" style={{ height: `${Math.min(100, w.value ?? 0)}%` }} />
                </div>
                <span className="text-ink mt-2 text-xs font-medium whitespace-nowrap">{w.label}</span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Caregiver utilization by week</caption>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.label}>
                  <th scope="row">{w.label}</th>
                  <td>{pctText(w.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card
          title="Attendance Trend"
          description={`Attended ÷ logged visits, on days with a visit record${attendanceRange}.`}
        >
          {attendance.length < 2 ? (
            <p className="text-ink-muted py-16 text-center text-sm">Too few logged visits in this period to draw a trend.</p>
          ) : (
            <TrendLine points={attendance} caption="Attendance by day" formatValue={(v) => `${v}%`} />
          )}
        </Card>
      </div>

      <Card title="Performance Rating Distribution" description="Classification of caregivers by the ratings recorded on their care teams.">
        <ul className="space-y-5">
          {bands.map((b) => (
            <li key={b.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-x-4 gap-y-2 sm:grid-cols-[10rem_1fr_11rem]">
              <div>
                <p className="text-ink text-sm font-medium">{b.label}</p>
                <p className="text-ink-subtle text-xs">{b.range}</p>
              </div>
              <div className="bg-sunken h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                <div className={cn('h-full rounded-full', bandColour[b.id].bar)} style={{ width: `${b.share}%` }} />
              </div>
              <p className="col-span-2 text-right text-sm sm:col-span-1">
                <span className="text-ink font-semibold">
                  {b.count} {b.count === 1 ? 'caregiver' : 'caregivers'}
                </span>{' '}
                <span className={cn('font-medium', bandColour[b.id].text)}>{b.share}%</span>
              </p>
            </li>
          ))}
        </ul>
        {unrated > 0 && (
          <p className="text-ink-subtle mt-4 text-xs">
            {unrated} {unrated === 1 ? 'caregiver has' : 'caregivers have'} no rating recorded yet.
          </p>
        )}
      </Card>

      <Card
        title="Top Caregivers"
        description="Ranked by care-team rating, then client CSAT, then visits completed."
        aside={
          <Link to="/caregivers" className={cn(outlineButton, 'h-9 text-xs print:hidden')}>
            View All Rankings
          </Link>
        }
      >
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="bg-sunken border-line text-ink-muted border-b text-[0.6875rem] tracking-wide uppercase">
                <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold sm:pl-6">Rank</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Caregiver</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Rating</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Visits Completed</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">On-Time Rate</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Attendance</th>
                <th scope="col" className="py-2.5 pr-5 pl-3 font-semibold sm:pr-6">CSAT Score</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {ranks.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-ink-muted py-3 pr-3 pl-5 tabular-nums sm:pl-6">{i + 1}</td>
                  <th scope="row" className="px-3 py-3 font-semibold">
                    <Link to={`/caregivers/${r.id}/performance`} className="text-ink hover:text-brand-700 flex items-center gap-2.5 whitespace-nowrap">
                      <Avatar name={r.name} decorative className="size-8" />
                      {r.name}
                    </Link>
                  </th>
                  <td className="text-ink px-3 py-3 font-semibold whitespace-nowrap tabular-nums">
                    {r.rating === null ? (
                      <span className="text-ink-subtle font-normal">Not rated</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3.5 text-amber-500" strokeWidth={2} aria-hidden="true" />
                        {scoreText(r.rating)}
                      </span>
                    )}
                  </td>
                  <td className="text-ink-muted px-3 py-3 tabular-nums">{r.completed}</td>
                  <td className="text-ink-muted px-3 py-3 tabular-nums">{rateText(r.onTime)}</td>
                  <td className="text-ink-muted px-3 py-3 tabular-nums">{rateText(r.attendance)}</td>
                  <td className="py-3 pr-5 pl-3 font-medium whitespace-nowrap tabular-nums sm:pr-6">
                    {r.csat === null ? (
                      <span className="text-ink-subtle font-normal">No reviews</span>
                    ) : (
                      <span className="text-emerald-700">{r.csat.toFixed(1)} / 5.0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card title="Training & Compliance Status" description="Caregivers whose required credentials are all in date.">
          {split.compliant + split.overdue === 0 ? (
            <p className="text-ink-muted py-8 text-center text-sm">No caregivers in this period.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative size-32 shrink-0">
                <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className="size-full -rotate-90">
                  <circle cx="60" cy="60" r="48" fill="none" strokeWidth="14" stroke="currentColor" className="text-red-500" />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    strokeWidth="14"
                    stroke="currentColor"
                    className="text-brand-600"
                    strokeDasharray={`${((split.share ?? 0) / 100) * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-ink text-xl font-bold tabular-nums">{pctText(split.share)}</p>
                    <p className="text-ink-subtle text-[0.625rem]">Compliant</p>
                  </div>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="text-ink flex items-center gap-2">
                  <span aria-hidden="true" className="bg-brand-600 size-2.5 rounded-sm" />
                  Active &amp; Certified ({split.compliant} Compliant)
                </li>
                <li className="text-ink flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-sm bg-red-500" />
                  Lapsed Credentials ({split.overdue} Overdue)
                </li>
              </ul>
            </div>
          )}
        </Card>

        <Card title="Expiring Certifications" description={`State credentials and licenses requiring renewal within ${RENEWAL_HORIZON_DAYS} days.`}>
          {expiring.length === 0 ? (
            <p className="text-ink-muted py-8 text-center text-sm">Nothing due within {RENEWAL_HORIZON_DAYS} days.</p>
          ) : (
            <ul className="divide-line divide-y">
              {expiring.map((e) => (
                <li key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_9rem_auto]">
                  <div className="min-w-0">
                    <p className="text-ink truncate text-sm font-semibold">{e.caregiverName}</p>
                    <p className="text-ink-subtle truncate text-xs">{e.name}</p>
                  </div>
                  <div className="text-xs max-sm:order-3 max-sm:col-span-2">
                    <p className="text-ink tabular-nums">{dateFmt.format(new Date(`${e.expiresAt}T00:00:00Z`))}</p>
                    <p className={renewalTone[e.state].text}>{daysText(e.days)}</p>
                  </div>
                  <span className={cn('w-28 rounded-md px-2 py-1 text-center text-[0.6875rem] font-semibold whitespace-nowrap', renewalTone[e.state].pill)}>
                    {renewalLabels[e.state]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Flagged for Operational Review"
        description="Staff members triggered by exception rules (e.g. late check-ins, lapsed credentials, low scorecard ratings)."
      >
        {flags.length === 0 ? (
          <p className="text-ink-muted py-6 text-center text-sm">Nobody is flagged in this period.</p>
        ) : (
          <ul className="space-y-3">
            {flags.map((f) => (
              <li
                key={f.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-l-4 py-4 pr-5 pl-4',
                  f.severity === 'red' ? 'border-red-400' : 'border-amber-400',
                )}
              >
                <Avatar name={f.name} decorative className="size-11" />
                <div className="min-w-0 flex-1">
                  <Link to={`/caregivers/${f.id}/performance`} className="text-ink hover:text-brand-700 text-[0.9375rem] leading-snug font-semibold">
                    {f.name}
                  </Link>
                  <p className={cn('mt-0.5 text-sm font-medium', f.severity === 'red' ? 'text-red-600' : 'text-amber-600')}>{f.reason}</p>
                  <p className="text-ink-subtle mt-1 text-xs">
                    Attendance: <span className="text-ink font-medium tabular-nums">{rateText(f.attendance)}</span>
                    <span aria-hidden="true" className="mx-3">•</span>
                    Late Arrivals: <span className="text-ink font-medium tabular-nums">{f.late} {f.late === 1 ? 'time' : 'times'}</span>
                  </p>
                </div>
                {/* No review scheduler exists yet; a button only. */}
                <button
                  type="button"
                  className="bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex h-9 items-center rounded-lg px-3.5 text-[0.8125rem] font-semibold transition-colors print:hidden"
                >
                  Schedule Review
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

/* ---------------------------------- page ---------------------------------- */

export function WorkforceReportPage() {
  const [params, setParams] = useSearchParams()
  const periodId = pick(params.get('period'), periodOptions.map((o) => o.value), '30') as PeriodId
  const { data, isPending, isError, error, refetch } = useWorkforceReport(periodId)

  const onPeriod = (id: PeriodId) => {
    const next = new URLSearchParams(params)
    if (id === '30') next.delete('period')
    else next.set('period', id)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-ink-subtle flex items-center gap-1.5 text-xs print:hidden">
        <Link to="/reports" className="hover:text-ink">
          Reports
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page" className="text-brand-700 font-medium">
          Workforce Report
        </span>
      </nav>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading workforce report…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load the workforce report.</p>
          <p className="text-ink-subtle text-sm">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <Report view={data} periodId={periodId} onPeriod={onPeriod} />
      )}
    </div>
  )
}
