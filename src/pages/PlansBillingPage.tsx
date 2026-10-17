import { useState } from 'react'
import { RecordPaymentDrawer } from '@/features/billing/RecordPaymentDrawer'
import { useBook } from '@/features/billing/book'
import { Link } from 'react-router-dom'
import {
  BellRing,
  Check,
  CircleX,
  CreditCard,
  Download,
  FilePlus,
  SquareCheck,
  Star,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  formatCompact,
  formatDate,
  formatMoney,
  revenueMonths,
  revenueOverWindow,
} from '@/features/billing/data'
import {
  agingBuckets,
  billingActivity,
  collectionRate,
  collectionRateDelta,
  methodKind,
  openInvoices,
  overdueInvoices,
  paymentsThisMonth,
  relativeDay,
  settledPayments,
  sumBalances,
} from '@/features/billing/ledger'
import type { ActivityKind } from '@/features/billing/ledger'
import { Panel } from '@/components/ui/Panel'
import { LineChart } from '@/components/ui/LineChart'
import { toneChip } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types'

/** The chart and the Total Revenue tile cover the same window. */
const TREND_MONTHS = 6
const RECENT_PAYMENTS = 5

type BadgeTone = 'up' | 'down' | 'neutral' | 'alert'

const badgeClass: Record<BadgeTone, string> = {
  up: 'text-emerald-700',
  down: 'text-red-600',
  neutral: 'text-ink-subtle',
  alert: 'text-red-600',
}

/** "+13.4%" with the direction spoken — the sign and colour are sighted-only. */
function signed(value: number, unit: string) {
  const direction = value >= 0 ? 'up' : 'down'
  return {
    text: `${value >= 0 ? '+' : '−'}${Math.abs(value)}${unit}`,
    sr: direction,
    tone: direction as BadgeTone,
  }
}

/* Bar colours for the aging rows. The oldest bucket is drawn darker than
   `toneFill.slate`, which reads as an empty track at this height. */
const agingBar: Partial<Record<Tone, string>> = {
  blue: 'bg-brand-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  slate: 'bg-slate-600',
}

const activityIcon: Record<ActivityKind, { icon: LucideIcon; tone: Tone }> = {
  payment: { icon: Check, tone: 'green' },
  issued: { icon: FilePlus, tone: 'blue' },
  reminder: { icon: BellRing, tone: 'amber' },
  overdue: { icon: TriangleAlert, tone: 'red' },
  failed: { icon: CircleX, tone: 'red' },
}

const outlineButton =
  'border-control text-ink hover:bg-sunken inline-flex h-10 items-center justify-center rounded-lg border bg-surface px-4 text-sm font-medium transition-colors'

export function PlansBillingPage() {
  useBook()
  const [paying, setPaying] = useState(false)
  const revenue = revenueOverWindow(TREND_MONTHS)
  const open = openInvoices()
  const overdue = overdueInvoices()
  const monthPayments = paymentsThisMonth()
  const aging = agingBuckets()
  const recent = settledPayments().slice(0, RECENT_PAYMENTS)
  const activity = billingActivity()

  const revenueBadge = signed(revenue.change, '%')
  const collectionBadge = signed(collectionRateDelta(), '%')

  /*
   * Revenue is the plan base, organisation-wide. Outstanding, overdue and the
   * collection rate come from the receivables book (ledger.ts) — invoice-billed
   * accounts only; card renewals are charged, not invoiced. Payments are the
   * settled entries in the transaction log, which covers both.
   */
  const kpis: {
    id: string
    label: string
    value: string
    badge: { text: string; sr?: string; tone: BadgeTone }
    icon: LucideIcon
    tone: Tone
  }[] = [
    {
      id: 'revenue',
      label: 'Total Revenue',
      value: formatMoney(revenue.total),
      badge: { ...revenueBadge, sr: `${revenueBadge.sr} on the previous ${TREND_MONTHS} months` },
      icon: CreditCard,
      tone: 'green',
    },
    {
      id: 'outstanding',
      label: 'Outstanding Balance',
      value: formatMoney(sumBalances(open)),
      badge: { text: `${open.length} invoices`, tone: 'neutral' },
      icon: Download,
      tone: 'amber',
    },
    {
      id: 'overdue',
      label: 'Overdue Amount',
      value: formatMoney(sumBalances(overdue)),
      badge: { text: `${overdue.length} overdue`, tone: overdue.length ? 'alert' : 'neutral' },
      icon: TriangleAlert,
      tone: 'red',
    },
    {
      id: 'payments',
      label: 'Payments This Month',
      value: formatMoney(monthPayments.reduce((sum, t) => sum + t.amount, 0)),
      badge: { text: `${monthPayments.length} payments`, tone: 'neutral' },
      icon: SquareCheck,
      tone: 'blue',
    },
    {
      id: 'collection',
      label: 'Collection Rate',
      value: `${collectionRate()}%`,
      badge: { ...collectionBadge, sr: `${collectionBadge.sr} on 30 days ago, in percentage points` },
      icon: Star,
      tone: 'green',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Billing Dashboard
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Financial overview and billing activity
          </p>
        </div>

        {/* No export exists yet; that one is a button only. */}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={outlineButton}>
            Export Report
          </button>
          <button type="button" onClick={() => setPaying(true)} className={outlineButton}>
            Record Payment
          </button>
          <Link
            to="/billing/invoices/new?from=/billing"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            Create Invoice
          </Link>
        </div>
      </header>
      <RecordPaymentDrawer open={paying} onClose={() => setPaying(false)} />

      <section aria-labelledby="billing-kpis">
        <h2 id="billing-kpis" className="sr-only">
          Key figures
        </h2>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map(({ id, label, value, badge, icon: Icon, tone }) => (
            <article key={id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg',
                    toneChip[tone],
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className={cn('text-right text-xs font-medium', badgeClass[badge.tone])}>
                  {badge.sr && <span className="sr-only">{badge.sr}: </span>}
                  {badge.text}
                </span>
              </div>
              <p className="text-ink mt-3 text-2xl font-bold tracking-tight break-words tabular-nums">
                {value}
              </p>
              <p className="text-ink-muted mt-0.5 text-sm">{label}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          title="Revenue Trend"
          description={`${TREND_MONTHS}-month billing performance history`}
          titleClassName="text-base"
          className="xl:col-span-3"
          badge={
            <span className="text-ink-muted inline-flex shrink-0 items-center gap-1.5 text-xs">
              <span className="bg-brand-600 size-2 rounded-full" aria-hidden="true" />
              Monthly Revenue (₦)
            </span>
          }
        >
          <div className="pt-2">
            <LineChart
              points={revenueMonths(TREND_MONTHS)}
              formatTick={formatCompact}
              formatValue={formatMoney}
              caption="Monthly revenue, oldest first"
              columns={['Month', 'Revenue']}
            />
          </div>
        </Panel>

        <Panel
          title="Outstanding Breakdown"
          description="Aging analysis of unpaid invoices"
          titleClassName="text-base"
          className="xl:col-span-2 xl:self-start"
        >
          {/* Aged from the issue date, so the rows sum to Outstanding Balance. */}
          <dl className="space-y-4">
            {aging.map((bucket) => (
              <div key={bucket.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-ink text-sm font-medium">{bucket.label}</dt>
                  <dd className="text-ink text-sm font-semibold tabular-nums">
                    {formatMoney(bucket.amount)}
                    <span className="sr-only">
                      , {bucket.count} invoices, {bucket.share}% of outstanding
                    </span>
                  </dd>
                </div>
                <div
                  className="bg-sunken mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                  aria-hidden="true"
                >
                  <div
                    className={cn('h-full rounded-full', agingBar[bucket.tone])}
                    style={{ width: `${bucket.share}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          title="Recent Payments"
          titleClassName="text-base"
          className="xl:col-span-3"
          flush
        >
          {/* Padding on the wrapper, not the cells, so the rules are inset. */}
          <div className="overflow-x-auto px-4 pb-2">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-line text-ink-muted border-b text-xs">
                  <th scope="col" className="py-2 pr-4 font-medium">Reference</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Account</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Amount</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Method</th>
                  <th scope="col" className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="text-ink py-3 pr-4 font-semibold whitespace-nowrap">
                      {t.id}
                    </td>
                    <td className="text-ink py-3 pr-4">{t.client}</td>
                    <td className="text-ink py-3 pr-4 font-semibold whitespace-nowrap tabular-nums">
                      {formatMoney(t.amount)}
                    </td>
                    <td className="text-ink-muted py-3 pr-4 whitespace-nowrap">
                      {methodKind(t.method)}
                    </td>
                    <td className="text-ink-muted py-3 whitespace-nowrap">
                      {formatDate(t.at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Recent Billing Activity"
          titleClassName="text-base"
          className="xl:col-span-2"
          flush
        >
          <ul className="space-y-1 px-4 pb-3">
            {activity.map((event) => {
              const { icon: Icon, tone } = activityIcon[event.kind]
              return (
                <li key={event.id} className="flex items-start gap-3 py-1.5">
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full',
                      toneChip[tone],
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-ink min-w-0 text-sm font-semibold">
                        {event.title}
                      </p>
                      <time
                        dateTime={event.at}
                        className="text-ink-subtle shrink-0 text-xs whitespace-nowrap"
                      >
                        {relativeDay(event.at)}
                      </time>
                    </div>
                    <p className="text-ink-muted mt-0.5 text-xs break-words">
                      {event.detail}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
