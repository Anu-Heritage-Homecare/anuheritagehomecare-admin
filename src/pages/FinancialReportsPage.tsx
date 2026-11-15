import { useSearchParams } from 'react-router-dom'
import { CreditCard, Download, Loader2, Star, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCompact, formatDate, formatMoney } from '@/features/billing/data'
import { branches } from '@/features/billing/accounts'
import { rangeLabels } from '@/features/billing/reports'
import type { RangeId } from '@/features/billing/reports'
import { useFinancialReport } from '@/features/reports/useFinancialReport'
import type { FinancialReportView } from '@/features/reports/useFinancialReport'
import { Panel } from '@/components/ui/Panel'
import { Donut } from '@/components/ui/Donut'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { toneChip, toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types'

const rangeIds = Object.keys(rangeLabels) as RangeId[]
const rangeOptions = rangeIds.map((id) => ({ value: id, label: rangeLabels[id] }))
const branchOptions = [
  { value: 'all', label: 'All branches' },
  ...branches.map((b) => ({ value: b, label: b })),
]
const comparisonOptions = [
  { value: 'previous', label: 'Previous period' },
  { value: 'none', label: 'None' },
]

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** Same aging bar colours as the dashboard's Outstanding Breakdown. */
const agingBar: Partial<Record<Tone, string>> = {
  blue: 'bg-brand-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  slate: 'bg-slate-600',
}

const methodTone: Record<string, string> = {
  'Bank transfer': 'text-brand-600',
  'Card payment': 'text-violet-500',
  'Not recorded': 'text-slate-400',
}

const outlineButton =
  'border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors'

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/* ------------------------------- the report ------------------------------- */

function Report({ view, filters }: { view: FinancialReportView; filters: ReactNode }) {
  const { kpis, months, methods, aging } = view
  const agingTotal = aging.reduce((s, b) => s + b.amount, 0)
  const maxMonth = Math.max(1, ...months.map((m) => m.revenue))

  const kpiCards: {
    id: string
    label: string
    value: string
    badge: string
    badgeTone: 'good' | 'bad' | 'neutral' | 'warn'
    icon: LucideIcon
    tone: Tone
  }[] = [
    {
      id: 'billed',
      label: 'Total Billed',
      value: formatMoney(kpis.totalRevenue),
      badge:
        kpis.revenueDelta === null
          ? 'No earlier period on record'
          : `${kpis.revenueDelta >= 0 ? '+' : '−'}${Math.abs(kpis.revenueDelta)}% vs previous period`,
      badgeTone: kpis.revenueDelta === null ? 'neutral' : kpis.revenueDelta >= 0 ? 'good' : 'bad',
      icon: CreditCard,
      tone: 'green',
    },
    {
      id: 'collected',
      label: 'Collections',
      value: formatMoney(kpis.collections),
      badge: kpis.collectionRate === null ? '—' : `${kpis.collectionRate}% collection rate`,
      badgeTone: 'neutral',
      icon: Star,
      tone: 'green',
    },
    {
      id: 'outstanding',
      label: 'Outstanding Balance',
      value: formatMoney(kpis.outstanding),
      badge: `${kpis.pendingCount} open · as of today`,
      badgeTone: 'warn',
      icon: Download,
      tone: 'amber',
    },
    {
      id: 'writeoffs',
      label: 'Write-offs',
      value: formatMoney(kpis.writeOffs),
      badge: kpis.lossRate === null ? '—' : `${kpis.lossRate}% of billed`,
      badgeTone: kpis.writeOffs > 0 ? 'bad' : 'neutral',
      icon: TriangleAlert,
      tone: 'red',
    },
  ]

  const badgeClass = {
    good: 'text-emerald-700',
    bad: 'text-red-600',
    warn: 'text-amber-700',
    neutral: 'text-ink-subtle',
  }

  const methodSegments = methods.map((m) => ({
    id: m.method,
    label: m.method,
    value: m.amount,
    colourClass: methodTone[m.method] ?? toneText.slate,
  }))

  /** The figures on screen as a CSV — Excel opens it directly. */
  const exportCsv = () => {
    const rows: string[][] = [
      ['Financial report', `${formatDate(view.from)} – ${formatDate(view.to)}`],
      [],
      ['Measure', 'Amount (NGN)'],
      ['Total billed', String(kpis.totalRevenue)],
      ['Collections', String(kpis.collections)],
      ['Outstanding (as of today)', String(kpis.outstanding)],
      ['Write-offs', String(kpis.writeOffs)],
      [],
      ['Collections by method', 'Amount (NGN)'],
      ...methods.map((m) => [m.method, String(m.amount)]),
      [],
      ['Aging period', 'Invoices', 'Amount (NGN)', 'Share (%)'],
      ...aging.map((b) => [b.label, String(b.count), String(b.amount), String(b.share)]),
    ]
    const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-report-${view.from}-to-${view.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Billing and collections for {formatDate(view.from)} – {formatDate(view.to)}
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
        </div>
      </header>

      {filters}

      <section aria-labelledby="report-kpis">
        <h2 id="report-kpis" className="sr-only">Key figures</h2>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map(({ id, label, value, badge, badgeTone, icon: Icon, tone }) => (
            <article key={id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', toneChip[tone])}>
                  <Icon className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className={cn('text-right text-xs font-medium', badgeClass[badgeTone])}>{badge}</span>
              </div>
              <p className="text-ink mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
              <p className="text-ink-muted mt-0.5 text-sm">{label}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          title="Revenue by Month"
          description={
            months.length > 0
              ? `Plan revenue, ${months[0].label} – ${months[months.length - 1].label} · organisation-wide, not split by branch`
              : 'Plan revenue · organisation-wide, not split by branch'
          }
          titleClassName="text-base"
          className="xl:col-span-3"
        >
          {months.length === 0 ? (
            <p className="text-ink-muted py-10 text-center text-sm">No revenue in this period.</p>
          ) : (
            <>
              {/* HTML bars: labels stay legible at any width. */}
              <div aria-hidden="true" className="flex h-56 items-end gap-3 pt-6 sm:gap-6">
                {months.map((m) => (
                  <div key={m.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                    <span className="text-ink mb-1.5 text-[0.6875rem] font-semibold tabular-nums whitespace-nowrap">
                      {formatCompact(m.revenue)}
                    </span>
                    <div
                      className="bg-brand-600 w-full max-w-11 rounded-t-md"
                      style={{ height: `${(m.revenue / maxMonth) * 80}%` }}
                    />
                    <span className="text-ink-subtle mt-2 text-xs whitespace-nowrap">{m.short}</span>
                  </div>
                ))}
              </div>
              <table className="sr-only">
                <caption>Plan revenue by month</caption>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.id}>
                      <th scope="row">{m.label}</th>
                      <td>{formatMoney(m.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Panel>

        <Panel
          title="Collections by Method"
          description="Share of payments settled in the period"
          titleClassName="text-base"
          className="xl:col-span-2"
        >
          {methodSegments.length === 0 ? (
            <p className="text-ink-muted py-8 text-center text-sm">No payments settled in this period.</p>
          ) : (
            <Donut
              segments={methodSegments}
              centreLabel="Collected"
              centreValue={formatCompact(kpis.collections)}
              caption="Collections by method"
              columns={['Method', 'Amount', 'Share']}
              formatValue={formatMoney}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Aging Report"
        description="Unpaid balances as of today by age since issue"
        titleClassName="text-base"
        flush
      >
        <div className="overflow-x-auto px-4 pb-2">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-line text-ink-muted border-b text-xs">
                <th scope="col" className="py-2 pr-4 font-semibold">Aging period</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Invoices</th>
                <th scope="col" className="w-1/3 py-2 pr-4 font-semibold">Breakdown</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Total amount</th>
                <th scope="col" className="py-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {aging.map((b) => (
                <tr key={b.id}>
                  <td className="text-ink py-3.5 pr-4 font-semibold whitespace-nowrap">{b.label}</td>
                  <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">
                    {b.count} {b.count === 1 ? 'item' : 'items'}
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="bg-sunken h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
                      <div className={cn('h-full rounded-full', agingBar[b.tone])} style={{ width: `${b.share}%` }} />
                    </div>
                  </td>
                  <td className="text-ink py-3.5 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(b.amount)}
                  </td>
                  <td className="text-ink py-3.5 text-right tabular-nums">{b.share}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-line border-t">
                <td className="text-ink py-3 pr-4 font-semibold">Total</td>
                <td className="text-ink-muted py-3 pr-4">{aging.reduce((s, b) => s + b.count, 0)} items</td>
                <td />
                <td className="text-ink py-3 pr-4 text-right font-bold tabular-nums">{formatMoney(agingTotal)}</td>
                <td className="text-ink py-3 text-right tabular-nums">{agingTotal ? '100%' : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  )
}

/* ---------------------------------- page ---------------------------------- */

export function FinancialReportsPage() {
  const [params, setParams] = useSearchParams()
  const range = pick(params.get('range'), rangeIds, '30')
  const branch = pick(params.get('branch'), ['all', ...branches] as const, 'all')
  const comparison = pick(params.get('compare'), ['previous', 'none'] as const, 'previous')

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  // 'ytd' maps to a year window; the backend scopes to one market, so the
  // branch and comparison dropdowns stay for parity but do not refetch.
  const { data, isPending, isError, error, refetch } = useFinancialReport(range === 'ytd' ? '365' : range)

  const filters = (
    <div className="flex flex-wrap gap-2.5 print:hidden">
      <SelectFilter label="Date Range" value={range} onChange={(v) => setParam('range', v, '30')} options={rangeOptions} className="w-full min-[480px]:w-auto" />
      <SelectFilter label="Branch" value={branch} onChange={(v) => setParam('branch', v, 'all')} options={branchOptions} className="w-full min-[480px]:w-auto" />
      <SelectFilter label="Comparison" value={comparison} onChange={(v) => setParam('compare', v, 'previous')} options={comparisonOptions} className="w-full min-[480px]:w-auto" />
    </div>
  )

  return (
    <div className="space-y-6">
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
