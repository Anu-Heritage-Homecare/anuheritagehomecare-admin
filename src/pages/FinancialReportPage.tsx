import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Clock, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCompact, formatMoney } from '@/features/billing/data'
import { branches } from '@/features/billing/accounts'
import {
  ALL,
  BOOK_START,
  averages,
  billed,
  byPlan,
  change,
  collectionRate,
  linesFor,
  months,
  openLines,
  outstanding,
  payStatusLabels,
  planOptions,
  previousWindow,
  rangeLabels,
  windowFor,
} from '@/features/reports/financial'
import type { FinFilters, PayStatus, RangeId } from '@/features/reports/financial'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { LineChart } from '@/components/ui/LineChart'
import { Donut } from '@/components/ui/Donut'
import { cn } from '@/lib/cn'

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

const outlineButton =
  'border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors'

const pctText = (n: number | null) => (n === null ? '—' : `${n}%`)
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const day = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`))

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

const planColour: Record<string, string> = {
  premium: 'text-brand-600',
  'live-in': 'text-emerald-500',
  standard: 'text-sky-400',
  flexible: 'text-amber-500',
}

const statusPill: Record<PayStatus, string> = {
  overdue: pill.red,
  due: pill.amber,
  clearing: pill.blue,
  paid: pill.green,
}

const rangeIds = Object.keys(rangeLabels) as RangeId[]

/* ---------------------------------- page ---------------------------------- */

export function FinancialReportPage() {
  const [params, setParams] = useSearchParams()
  const range = pick(params.get('range'), rangeIds, '30')
  const filters: FinFilters = {
    plan: pick(params.get('plan'), [ALL, ...planOptions.map((p) => p.value)], ALL),
    status: pick(params.get('status'), [ALL, ...(Object.keys(payStatusLabels) as PayStatus[])], ALL),
    branch: pick(params.get('branch'), [ALL, ...branches], ALL),
  }

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const lines = linesFor(filters)
  const w = windowFor(range)
  const prev = previousWindow(w)
  const total = billed(lines, w)
  // An earlier window that starts before the book would compare with nothing.
  const totalChange = prev.from >= BOOK_START ? change(total, billed(lines, prev)) : null
  const book = months(lines)
  const recent = book.slice(-6)
  // The latest *complete* month; the current one is still being billed.
  const closed = book.filter((m) => m.id < w.to.slice(0, 7))
  const lastMonth = closed[closed.length - 1]
  const coll = collectionRate(lines, w)
  const open = outstanding(lines)
  const avg = averages(lines, w)
  const plans = byPlan(lines, w)
  const planTotal = plans.reduce((s, p) => s + p.value, 0)
  const openRows = openLines(lines)

  const tiles: { label: string; value: string; badge: string; tone: keyof typeof pill }[] = [
    {
      label: 'Total Revenue',
      value: formatMoney(total),
      badge:
        totalChange === null
          ? 'No earlier period on record'
          : `${totalChange >= 0 ? '+' : '−'}${Math.abs(totalChange)}% vs previous period`,
      tone: totalChange !== null && totalChange < 0 ? 'red' : 'green',
    },
    {
      label: 'Monthly Revenue',
      value: lastMonth ? formatMoney(lastMonth.invoiced) : '—',
      badge: lastMonth
        ? `${lastMonth.label.split(' ')[0]}${lastMonth.growth === null ? '' : ` · ${lastMonth.growth >= 0 ? '+' : '−'}${Math.abs(lastMonth.growth)}% MoM`}`
        : 'No complete month',
      tone: 'green',
    },
    { label: 'Collection Rate', value: pctText(coll.rate), badge: `${coll.paid} of ${coll.due} due paid`, tone: 'green' },
    { label: 'Outstanding Balance', value: formatMoney(open.amount), badge: `${open.count} open`, tone: 'amber' },
    {
      label: 'Avg Invoice Value',
      value: avg.invoice === null ? '—' : formatMoney(avg.invoice),
      badge: avg.daysToPay === null ? 'No invoices paid' : `Avg ${avg.daysToPay} days to pay`,
      tone: 'green',
    },
  ]

  const exportCsv = () => {
    const rows: string[][] = [
      ['Financial report', `${w.from} to ${w.to}`],
      ['Care plan', filters.plan, 'Payment status', filters.status, 'Branch', filters.branch],
      [],
      ['Measure', 'Value'],
      ...tiles.map((t) => [t.label, t.value]),
      [],
      ['Care plan', 'Billed (NGN)'],
      ...plans.map((p) => [p.label, String(p.value)]),
      [],
      ['Month', 'Invoiced (NGN)', 'Collected (NGN)', 'Outstanding (NGN)', 'Collection rate (%)', 'Growth (%)'],
      ...book.map((m) => [m.label, String(m.invoiced), String(m.collected), String(m.outstanding), String(m.rate ?? ''), String(m.growth ?? '')]),
      [],
      ['Reference', 'Account', 'Balance (NGN)', 'Due', 'Days overdue', 'Status'],
      ...openRows.map((r) => [r.ref, r.account, String(r.balance), r.dueAt, String(r.daysOverdue ?? ''), payStatusLabels[r.status]]),
    ]
    const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-report-${w.from}-to-${w.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filterControls: { key: string; label: string; value: string; fallback: string; options: { value: string; label: string }[] }[] = [
    { key: 'range', label: 'Date Range', value: range, fallback: '30', options: rangeIds.map((id) => ({ value: id, label: rangeLabels[id] })) },
    { key: 'plan', label: 'Care Plan', value: filters.plan, fallback: ALL, options: [{ value: ALL, label: 'All Plans' }, ...planOptions] },
    {
      key: 'status',
      label: 'Payment Status',
      value: filters.status,
      fallback: ALL,
      options: [{ value: ALL, label: 'All Statuses' }, ...Object.entries(payStatusLabels).map(([value, label]) => ({ value, label }))],
    },
    { key: 'branch', label: 'Branch', value: filters.branch, fallback: ALL, options: [{ value: ALL, label: 'All Branches' }, ...branches.map((b) => ({ value: b, label: b }))] },
  ]

  const since = book[0] ? book[0].label.replace(/^(\w{3})\w*/, '$1') : ''

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

      <div className="card grid grid-cols-1 gap-4 p-4 min-[480px]:grid-cols-2 lg:grid-cols-4 print:hidden">
        {filterControls.map((c) => (
          <div key={c.key}>
            <p className="text-ink-subtle mb-1 text-[0.6875rem] font-semibold tracking-wide uppercase" aria-hidden="true">
              {c.label}
            </p>
            <SelectFilter
              label={c.label}
              valueOnly
              value={c.value}
              onChange={(v) => setParam(c.key, v, c.fallback)}
              options={c.options}
              className="w-full"
            />
          </div>
        ))}
      </div>

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
        description={`Cash collected each month since the book begins (${since}); the current month is to date.`}
        aside={
          <span className="text-ink-muted flex items-center gap-2 text-xs">
            <span aria-hidden="true" className="bg-brand-600 h-0.5 w-4 rounded" />
            Monthly Inflow
          </span>
        }
      >
        {book.length < 2 ? (
          <p className="text-ink-muted py-10 text-center text-sm">Not enough months on the book to draw a trend.</p>
        ) : (
          <LineChart
            points={book.map((m) => ({ label: m.short, value: m.collected }))}
            formatTick={formatCompact}
            formatValue={formatMoney}
            caption="Cash collected by month"
            columns={['Month', 'Collected']}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card title="Revenue by Care Plan" description={`Billed in the ${rangeLabels[range].toLowerCase()}, by the plan each recipient is on.`}>
          {plans.length === 0 ? (
            <p className="text-ink-muted py-8 text-center text-sm">Nothing billed in this period.</p>
          ) : (
            <Donut
              segments={plans.map((p) => ({ id: p.id, label: p.label, value: p.value, colourClass: planColour[p.id] ?? 'text-slate-400' }))}
              centreLabel="Total"
              centreValue={formatCompact(planTotal)}
              caption="Revenue by care plan"
              columns={['Plan', 'Billed', 'Share']}
              formatValue={formatCompact}
            />
          )}
        </Card>

        <Card title="Payment Collection Rate" description="Of each month's billing that has fallen due, the share paid.">
          <div aria-hidden="true" className="flex h-48 items-stretch justify-around gap-3">
            {book.map((m) => (
              <div key={m.id} className="flex min-w-0 flex-1 flex-col items-center">
                <span className="mb-1 text-xs font-semibold text-emerald-700 tabular-nums">{pctText(m.rate === null ? null : Math.round(m.rate))}</span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div className="w-full max-w-10 rounded-t-md bg-emerald-500" style={{ height: `${m.rate ?? 0}%` }} />
                </div>
                <span className="text-ink-subtle mt-2 text-xs">{m.short}</span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Collection rate by month</caption>
            <tbody>
              {book.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.label}</th>
                  <td>{pctText(m.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-line mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-ink-muted">Average Collection Time</span>
            <span className="text-ink flex items-center gap-1.5 font-semibold">
              <Clock className="size-4 text-emerald-600" strokeWidth={2} aria-hidden="true" />
              {avg.daysToPay === null ? '—' : `${avg.daysToPay} days`}
            </span>
          </div>
        </Card>
      </div>

      <Card
        title="Outstanding Invoices"
        aside={
          <p className="text-ink-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              Total Outstanding: <span className="text-ink font-semibold tabular-nums">{formatMoney(open.amount)}</span>
            </span>
            <span>
              Total Overdue: <span className="font-semibold text-red-600 tabular-nums">{formatMoney(open.overdue)}</span>
            </span>
          </p>
        }
      >
        {openRows.length === 0 ? (
          <p className="text-ink-muted py-6 text-center text-sm">Nothing outstanding for these filters.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="bg-sunken border-line text-ink-muted border-b text-[0.6875rem] tracking-wide uppercase">
                  <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold sm:pl-6">Invoice #</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Family</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Due Date</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Days Overdue</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-semibold sm:pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {openRows.map((r) => (
                  <tr key={r.ref}>
                    <th scope="row" className="py-3 pr-3 pl-5 font-semibold whitespace-nowrap sm:pl-6">
                      {r.ref.startsWith('INV-') ? (
                        <Link to={`/billing/invoices/${r.ref}`} className="text-ink hover:text-brand-700">
                          {r.ref}
                        </Link>
                      ) : (
                        <span className="text-ink">{r.ref}</span>
                      )}
                    </th>
                    <td className="text-ink px-3 py-3 whitespace-nowrap">
                      {r.accountId ? (
                        <Link to={`/billing/accounts/${r.accountId}`} className="hover:text-brand-700">
                          {r.account}
                        </Link>
                      ) : (
                        r.account
                      )}
                    </td>
                    <td className="text-ink px-3 py-3 font-semibold tabular-nums">{formatMoney(r.balance)}</td>
                    <td className="text-ink-muted px-3 py-3 whitespace-nowrap">{day(r.dueAt)}</td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                      {r.daysOverdue === null ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        <span className="text-red-600">
                          {r.daysOverdue} {r.daysOverdue === 1 ? 'day' : 'days'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('rounded px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap', statusPill[r.status])}>
                        {r.kind === 'charge' && r.status === 'overdue' ? 'Failed charge' : payStatusLabels[r.status]}
                      </span>
                    </td>
                    <td className="py-3 pr-5 pl-3 text-right sm:pr-6">
                      {r.status !== 'overdue' ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        /*
                         * A reminder already on the book means one has been
                         * tried, so the next step is to escalate. Neither sends
                         * anything yet — there is no outbound channel.
                         */
                        <button
                          type="button"
                          title={r.remindedAt ? `Reminder sent ${day(r.remindedAt)}` : undefined}
                          className="bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors print:hidden"
                        >
                          {r.remindedAt ? 'Escalate' : 'Send Reminder'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Revenue by Month (${recent.length === 6 ? 'Last 6 Months' : `Since ${recent[0]?.label ?? ''}`})`}>
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="bg-sunken border-line text-ink-muted border-b text-[0.6875rem] tracking-wide uppercase">
                <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold sm:pl-6">Month</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Invoiced</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Collected</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Outstanding</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Collection Rate</th>
                <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-semibold sm:pr-6">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {[...recent].reverse().map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="text-ink py-3 pr-3 pl-5 font-semibold whitespace-nowrap sm:pl-6">
                    {m.label}
                    {m.id === w.to.slice(0, 7) && <span className="text-ink-subtle ml-1.5 text-xs font-normal">to date</span>}
                  </th>
                  <td className="text-ink-muted px-3 py-3 tabular-nums">{formatMoney(m.invoiced)}</td>
                  <td className="text-ink-muted px-3 py-3 tabular-nums">{formatMoney(m.collected)}</td>
                  <td className="text-ink-subtle px-3 py-3 tabular-nums">{formatMoney(m.outstanding)}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2">
                      <span className="text-ink w-12 font-semibold tabular-nums">{m.rate === null ? '—' : `${m.rate.toFixed(1)}%`}</span>
                      <span className="bg-sunken h-1.5 w-16 overflow-hidden rounded-full" aria-hidden="true">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${m.rate ?? 0}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-5 pl-3 text-right sm:pr-6">
                    {m.growth === null ? (
                      <span className="text-ink-subtle">—</span>
                    ) : (
                      <span className={cn('rounded px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums', m.growth >= 0 ? pill.green : pill.red)}>
                        {m.growth >= 0 ? '+' : '−'}
                        {Math.abs(m.growth)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
