import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Clock, Loader2, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCompact, formatMoney } from '@/features/billing/data'
import { rangeLabels } from '@/features/billing/reports'
import type { RangeId } from '@/features/billing/reports'
import { useFinancialReport } from '@/features/reports/useFinancialReport'
import type { FinancialReportView } from '@/features/reports/useFinancialReport'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { LineChart } from '@/components/ui/LineChart'
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
  const id = `fin-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
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

const rangeIds = Object.keys(rangeLabels) as RangeId[]

/* ------------------------------- the report ------------------------------- */

function Report({ view, filters }: { view: FinancialReportView; filters: ReactNode }) {
  const { currency, kpis, months } = view
  const latest = months.length > 0 ? months[months.length - 1] : null

  const tiles: { label: string; value: string; badge: string; tone: keyof typeof pill }[] = [
    {
      label: 'Total Revenue',
      value: formatMoney(kpis.totalRevenue, currency),
      badge:
        kpis.revenueDelta === null
          ? 'No earlier period on record'
          : `${kpis.revenueDelta >= 0 ? '+' : '−'}${Math.abs(kpis.revenueDelta)}% vs previous period`,
      tone: kpis.revenueDelta !== null && kpis.revenueDelta < 0 ? 'red' : 'green',
    },
    {
      label: 'Monthly Revenue',
      value: latest ? formatMoney(latest.revenue, currency) : '—',
      badge: latest ? latest.label.split(' ')[0] : 'No complete month',
      tone: 'green',
    },
    { label: 'Collection Rate', value: pctText(kpis.collectionRate), badge: `${kpis.pendingCount} pending`, tone: 'green' },
    { label: 'Outstanding Balance', value: formatMoney(kpis.outstanding, currency), badge: `${kpis.pendingCount} open`, tone: 'amber' },
    {
      label: 'Avg Invoice Value',
      value: '—',
      badge: 'Not available',
      tone: 'green',
    },
  ]

  const exportCsv = () => {
    const rows: string[][] = [
      ['Financial report', `${view.from} to ${view.to}`],
      [],
      ['Measure', 'Value'],
      ...tiles.map((t) => [t.label, t.value]),
      [],
      ['Month', 'Revenue (NGN)'],
      ...months.map((m) => [m.label, String(m.revenue)]),
    ]
    const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-report-${view.from}-to-${view.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const since = months[0] ? months[0].label.replace(/^(\w{3})\w*/, '$1') : ''

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight sm:text-3xl">Financial Report</h1>
          <p className="text-ink-muted mt-1 text-sm">Analyze revenue, invoicing, and payment collection performance.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={exportCsv} className={outlineButton}>
            Export CSV
          </button>
          {/* The browser's print dialog saves a PDF; no server renders one. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors"
          >
            Export PDF
          </button>
          {/* No report builder exists yet; a button only. */}
          <button
            type="button"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            <Sparkles className="size-4" strokeWidth={2} aria-hidden="true" />
            Generate Report
          </button>
        </div>
      </header>

      {filters}

      <section aria-labelledby="fin-kpis">
        <h2 id="fin-kpis" className="sr-only">Key figures</h2>
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map((t) => (
            <article key={t.label} className="card p-4">
              <p className="text-ink text-[0.6875rem] font-semibold tracking-wide uppercase">{t.label}</p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums xl:text-xl 2xl:text-2xl">
                {t.value}
              </p>
              <span className={cn('mt-2 inline-block rounded px-1.5 py-0.5 text-[0.6875rem] font-medium', pill[t.tone])}>
                {t.badge}
              </span>
            </article>
          ))}
        </div>
      </section>

      <Card
        title="Monthly Revenue Trend"
        description={`Revenue each month over the reporting window${since ? ` (since ${since})` : ''}.`}
        aside={
          <span className="text-ink-muted flex items-center gap-2 text-xs">
            <span aria-hidden="true" className="bg-brand-600 h-0.5 w-4 rounded" />
            Monthly Revenue
          </span>
        }
      >
        {months.length < 2 ? (
          <p className="text-ink-muted py-10 text-center text-sm">Not enough months in the window to draw a trend.</p>
        ) : (
          <LineChart
            points={months.map((m) => ({ label: m.short, value: m.revenue }))}
            formatTick={(v) => formatCompact(v, currency)}
            formatValue={(v) => formatMoney(v, currency)}
            caption="Revenue by month"
            columns={['Month', 'Revenue']}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card title="Revenue by Care Plan" description="Billed in the window, by the plan each recipient is on.">
          <p className="text-ink-muted py-8 text-center text-sm">A per care plan breakdown is not available yet.</p>
        </Card>

        <Card title="Payment Collection Rate" description="Of the window's billing that has fallen due, the share paid.">
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <p className="text-ink text-4xl font-bold tabular-nums">{pctText(kpis.collectionRate)}</p>
            <p className="text-ink-subtle mt-2 text-sm">Collected of billed in the window</p>
          </div>
          <div className="border-line mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-ink-muted">Average Collection Time</span>
            <span className="text-ink flex items-center gap-1.5 font-semibold">
              <Clock className="size-4 text-emerald-600" strokeWidth={2} aria-hidden="true" />
              —
            </span>
          </div>
        </Card>
      </div>

      <Card
        title="Outstanding Invoices"
        aside={
          <p className="text-ink-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              Total Outstanding: <span className="text-ink font-semibold tabular-nums">{formatMoney(kpis.outstanding, currency)}</span>
            </span>
          </p>
        }
      >
        <p className="text-ink-muted py-6 text-center text-sm">
          A per invoice outstanding list is not available on this screen.{' '}
          <Link to="/billing/invoices" className="text-brand-700 hover:underline">
            View invoices
          </Link>
        </p>
      </Card>

      <Card title="Revenue by Month">
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="bg-sunken border-line text-ink-muted border-b text-[0.6875rem] tracking-wide uppercase">
                <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold sm:pl-6">Month</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Revenue</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Collected</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Outstanding</th>
                <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-semibold sm:pr-6">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {[...months].reverse().map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="text-ink py-3 pr-3 pl-5 font-semibold whitespace-nowrap sm:pl-6">
                    {m.label}
                  </th>
                  <td className="text-ink-muted px-3 py-3 tabular-nums">{formatMoney(m.revenue, currency)}</td>
                  <td className="text-ink-subtle px-3 py-3 tabular-nums">—</td>
                  <td className="text-ink-subtle px-3 py-3 tabular-nums">—</td>
                  <td className="py-3 pr-5 pl-3 text-right sm:pr-6">
                    <span className="text-ink-subtle">—</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ---------------------------------- page ---------------------------------- */

export function FinancialReportPage() {
  const [params, setParams] = useSearchParams()
  const range = pick(params.get('range'), rangeIds, '30')

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const { data, isPending, isError, error, refetch } = useFinancialReport(range === 'ytd' ? '365' : range)

  const filters = (
    <div className="card grid grid-cols-1 gap-4 p-4 min-[480px]:grid-cols-2 lg:grid-cols-4 print:hidden">
      <div>
        <p className="text-ink-subtle mb-1 text-[0.6875rem] font-semibold tracking-wide uppercase" aria-hidden="true">
          Date Range
        </p>
        <SelectFilter
          label="Date Range"
          valueOnly
          value={range}
          onChange={(v) => setParam('range', v, '30')}
          options={rangeIds.map((id) => ({ value: id, label: rangeLabels[id] }))}
          className="w-full"
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-ink-subtle flex items-center gap-1.5 text-xs print:hidden">
        <Link to="/reports" className="hover:text-ink">
          Reports
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page" className="text-brand-700 font-medium">
          Financial Report
        </span>
      </nav>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading financial report…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load the financial report.</p>
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
        <Report view={data} filters={filters} />
      )}
    </div>
  )
}
