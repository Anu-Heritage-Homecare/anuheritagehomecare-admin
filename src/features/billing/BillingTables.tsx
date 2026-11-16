import { Link } from 'react-router-dom'
import type {
  PlanId,
  Subscription,
  SubscriptionStatus,
  Transaction,
  TransactionStatus,
} from './data'
import {
  formatDate,
  formatMoney,
  planById,
  renewalAmount,
  renewalPayment,
} from './data'
import type { CareRequest } from '@/features/care-recipients/requests-data'
import {
  docsLabels,
  docsStatus,
  docsTones,
  familyNameFor,
  paymentLabels,
  paymentTones,
  pendingRequestCount,
  statusFor,
  statusLabels,
  statusTones,
} from '@/features/care-recipients/requests-data'
import { Panel } from '@/components/ui/Panel'
import { tonePill, toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types'

const chip =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

/**
 * The card fallbacks below each table are not a read-only view — dropping the
 * row action there would leave it unreachable under the table breakpoint.
 */
function RowAction({
  label,
  context,
  to,
  className,
}: {
  label: string
  context: string
  /** Renders a link instead of a button when the action has a destination. */
  to?: string
  className?: string
}) {
  const classes = cn(
    'text-brand-700 hover:text-brand-800 text-sm font-medium',
    className,
  )
  const content = (
    <>
      {label}
      <span className="sr-only"> {context}</span>
    </>
  )
  return to ? (
    <Link to={to} className={classes}>
      {content}
    </Link>
  ) : (
    <button type="button" className={classes}>
      {content}
    </button>
  )
}

/* ------------------------------ care requests ----------------------------- */

/**
 * A read-only window onto the intake queue, which lives under Care Recipients.
 * Everything here is derived by `requests-data`, so this panel and the queue
 * can't disagree about a request's status.
 */
export function CareRequests({ requests }: { requests: CareRequest[] }) {
  const pending = pendingRequestCount()
  // Only the ones still open: the five newest included an approved request
  // under a sentence claiming they were all awaiting verification.
  const latest = requests
    .filter((r) => {
      const status = statusFor(r)
      return status !== 'approved' && status !== 'rejected'
    })
    .slice(0, 5)

  return (
    <Panel
      title="New Care Requests"
      badge={
        <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
          {pending} awaiting action
        </span>
      }
      action={{ label: 'Open the care requests queue', to: '/care-recipients/requests' }}
      flush
    >
      <p className="text-ink-muted px-4 pb-3 text-sm">
        {latest.length} of the {pending + requests.filter((r) => statusFor(r) === 'ready').length}{' '}
        open requests, newest first.
      </p>

      <div
        tabIndex={0}
        role="region"
        aria-label="Recent care requests table"
        className="hidden overflow-x-auto xl:block"
      >
        <table className="w-full min-w-3xl text-left text-sm">
          <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
            <tr>
              {['Reference', 'Family', 'Requested plan', 'Payment', 'Documents', 'Status'].map(
                (col) => (
                  <th key={col} scope="col" className="px-4 py-2.5 font-semibold tracking-wide uppercase">
                    {col}
                  </th>
                ),
              )}
              <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {latest.map((r) => {
              const docs = docsStatus(r)
              const status = statusFor(r)
              return (
                <tr key={r.id} className="hover:bg-canvas transition-colors">
                  <th scope="row" className="px-4 py-3 font-normal whitespace-nowrap">
                    <Link
                      to={`/care-recipients/requests/${r.id}`}
                      className="text-brand-700 hover:text-brand-800 font-medium"
                    >
                      {r.ref}
                    </Link>
                  </th>
                  <td className="text-ink px-4 py-3 whitespace-nowrap">
                    {familyNameFor(r.patient.name)}
                    <span className="text-ink-subtle block text-xs">
                      {r.patient.name}
                    </span>
                  </td>
                  <td className="text-ink-muted px-4 py-3 whitespace-nowrap">
                    {planById[r.planId].name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(chip, tonePill[paymentTones[r.payment]])}>
                      {paymentLabels[r.payment]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(chip, tonePill[docsTones[docs]])}>
                      {docsLabels[docs]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(chip, tonePill[statusTones[status]])}>
                      {statusLabels[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowAction
                      label="Review"
                      context={`${familyNameFor(r.patient.name)} request`}
                      to={`/care-recipients/requests/${r.id}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-line border-line divide-y border-t xl:hidden">
        {latest.map((r) => {
          const status = statusFor(r)
          return (
            <li key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/care-recipients/requests/${r.id}`}
                    className="text-ink hover:text-brand-700 text-sm font-semibold break-words"
                  >
                    {familyNameFor(r.patient.name)}
                  </Link>
                  <p className="text-ink-subtle mt-0.5 text-xs break-words">
                    {r.ref} · {r.patient.name} · {planById[r.planId].name}
                  </p>
                </div>
                <span className={cn(chip, tonePill[statusTones[status]])}>
                  {statusLabels[status]}
                </span>
              </div>
              <p className="text-ink-muted mt-2 text-sm break-words">
                Payment {paymentLabels[r.payment].toLowerCase()} · documents{' '}
                {docsLabels[docsStatus(r)].toLowerCase()} ·{' '}
                {r.coordinator ?? 'Unassigned'}
              </p>
              <RowAction
                label="Review"
                context={`${familyNameFor(r.patient.name)} request`}
                to={`/care-recipients/requests/${r.id}`}
                className="mt-2 inline-flex min-h-11 items-center"
              />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* --------------------------- subscription table --------------------------- */

const subStyles: Record<SubscriptionStatus, { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Paused', tone: 'bg-amber-50 text-amber-700' },
  pending: { label: 'Pending start', tone: 'bg-blue-50 text-blue-700' },
  cancelled: { label: 'Cancelled', tone: 'bg-red-50 text-red-700' },
}

/**
 * Opens the subscription record in the workspace — always a valid destination,
 * unlike the recipient billing tab, which is empty for anyone without invoices.
 * The workspace links back out to the care record from there.
 */
function ClientName({ sub, className }: { sub: Subscription; className: string }) {
  return (
    <Link
      to={`/billing/subscriptions/${sub.id}/overview`}
      className={cn(className, 'hover:text-brand-700')}
    >
      {sub.client}
    </Link>
  )
}

/** Why a row has no renewal date — "Not scheduled" is only one of the reasons. */
function renewsLabel(sub: Subscription): string {
  if (sub.renewsAt) return formatDate(sub.renewsAt)
  if (sub.invoiceBilled) return 'Billed by invoice'
  if (sub.status === 'pending') return 'Awaiting start'
  return 'Not scheduled'
}

export function SubscriptionTable({ rows }: { rows: Subscription[] }) {
  const active = rows.filter((s) => s.status === 'active').length

  return (
    <Panel
      title="Subscription Management"
      badge={
        <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
          {active} active of {rows.length}
        </span>
      }
      flush
    >
      <p className="text-ink-muted px-4 pb-3 text-sm">
        Auto-renewals, cycle statuses and remaining package assets for the
        accounts you follow — not the full subscriber base.
      </p>

      <div
        tabIndex={0}
        role="region"
        aria-label="Subscriptions table"
        className="hidden overflow-x-auto xl:block"
      >
        <table className="w-full min-w-4xl text-left text-sm">
          <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
            <tr>
              {['Client', 'Plan', 'Cycle', 'Status', 'Renews', 'Hours left', 'Auto-renew'].map(
                (col) => (
                  <th key={col} scope="col" className="px-4 py-2.5 font-semibold tracking-wide uppercase">
                    {col}
                  </th>
                ),
              )}
              <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-canvas transition-colors">
                <th scope="row" className="px-4 py-3 font-normal whitespace-nowrap">
                  <ClientName sub={s} className="text-ink font-medium" />
                </th>
                <td className="text-ink-muted px-4 py-3 whitespace-nowrap">
                  {planById[s.planId].name}
                </td>
                <td className="text-ink-muted px-4 py-3">{s.cycle}</td>
                <td className="px-4 py-3">
                  <span className={cn(chip, subStyles[s.status].tone)}>
                    {subStyles[s.status].label}
                  </span>
                </td>
                <td
                  className={cn(
                    'px-4 py-3 whitespace-nowrap',
                    s.renewsAt ? 'text-ink-muted' : 'text-ink-subtle',
                  )}
                >
                  {renewsLabel(s)}
                </td>
                <td className="text-ink-muted px-4 py-3 tabular-nums">
                  {s.remainingHours === undefined ? (
                    <span className="text-ink-subtle">Not applicable</span>
                  ) : (
                    `${s.remainingHours} hrs`
                  )}
                </td>
                <td className="px-4 py-3">
                  {/* Text, not a coloured dot — the state must survive without hue */}
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      s.autoRenew ? 'text-emerald-700' : 'text-ink-subtle',
                    )}
                  >
                    {s.autoRenew ? 'On' : 'Off'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <RowAction
                    label="Manage"
                    context={s.client}
                    to={`/billing/subscriptions/${s.id}/overview`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-line border-line divide-y border-t xl:hidden">
        {rows.map((s) => (
          <li key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <ClientName
                  sub={s}
                  className="text-ink text-sm font-semibold break-words"
                />
                <p className="text-ink-subtle mt-0.5 text-xs">
                  {planById[s.planId].name} · {s.cycle}
                </p>
              </div>
              <span className={cn(chip, subStyles[s.status].tone)}>
                {subStyles[s.status].label}
              </span>
            </div>
            <p className="text-ink-muted mt-2 text-sm">
              {s.renewsAt ? `Renews ${formatDate(s.renewsAt)}` : renewsLabel(s)} ·
              Auto-renew {s.autoRenew ? 'on' : 'off'}
              {s.remainingHours !== undefined && ` · ${s.remainingHours} hrs left`}
            </p>
            <RowAction
              label="Manage"
              context={s.client}
              to={`/billing/subscriptions/${s.id}/overview`}
              className="mt-2 inline-flex min-h-11 items-center"
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ------------------------------ transactions ------------------------------ */

const txStyles: Record<TransactionStatus, { label: string; tone: string }> = {
  succeeded: { label: 'Succeeded', tone: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Pending', tone: 'bg-amber-50 text-amber-700' },
  processing: { label: 'Processing', tone: 'bg-blue-50 text-blue-700' },
  failed: { label: 'Failed', tone: 'bg-red-50 text-red-700' },
}

export function TransactionLog({
  rows,
  counts,
  filter,
  onFilter,
}: {
  rows: Transaction[]
  counts: Record<TransactionStatus, number>
  filter: TransactionStatus | 'all'
  onFilter: (next: TransactionStatus | 'all') => void
}) {
  const statuses = Object.keys(txStyles) as TransactionStatus[]

  return (
    <Panel title="Payment Processing & Transaction Logs" flush>
      <p className="text-ink-muted px-4 pb-3 text-sm">
        Organisation-wide, so clients here need not appear in the table above.
      </p>
      <div
        role="group"
        aria-label="Filter transactions by status"
        className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3"
      >
        {(['all', ...statuses] as const).map((value) => {
          const selected = filter === value
          const count =
            value === 'all'
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : counts[value]
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => onFilter(value)}
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
                selected ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-sunken',
              )}
            >
              {value === 'all' ? 'All' : txStyles[value].label}
              <span className={selected ? 'text-white' : 'text-ink-subtle'}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm">
          No transactions with this status.
        </p>
      ) : (
        <>
          <div
            tabIndex={0}
            role="region"
            aria-label="Transactions table"
            className="hidden overflow-x-auto lg:block"
          >
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
                <tr>
                  {['Transaction', 'Client', 'Amount', 'Method', 'Status', 'Date'].map((col) => (
                    <th key={col} scope="col" className="px-4 py-2.5 font-semibold tracking-wide uppercase">
                      {col}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-canvas transition-colors">
                    <th scope="row" className="px-4 py-3 font-normal">
                      <span className="text-brand-700 font-medium whitespace-nowrap">
                        {t.id}
                      </span>
                      {/* What the amount settles — without it a figure in this
                          log can't be checked against a plan or an invoice. */}
                      <span className="text-ink-subtle mt-0.5 block text-xs">
                        {t.reference}
                      </span>
                    </th>
                    <td className="text-ink-muted px-4 py-3 whitespace-nowrap">{t.client}</td>
                    <td className="text-ink px-4 py-3 font-medium whitespace-nowrap tabular-nums">
                      {formatMoney(t.amount, 'NGN')}
                    </td>
                    <td className="text-ink-muted px-4 py-3 whitespace-nowrap">{t.method}</td>
                    <td className="px-4 py-3">
                      <span className={cn(chip, txStyles[t.status].tone)}>
                        {txStyles[t.status].label}
                      </span>
                    </td>
                    <td className="text-ink-muted px-4 py-3 whitespace-nowrap">
                      <time dateTime={t.at}>{formatDate(t.at)}</time>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <RowAction label="Receipt" context={`for ${t.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-line border-line divide-y border-t lg:hidden">
            {rows.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-brand-700 text-sm font-semibold">{t.id}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs break-words">
                      {t.client} · {t.method}
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs break-words">
                      {t.reference}
                    </p>
                  </div>
                  <span className={cn(chip, txStyles[t.status].tone)}>
                    {txStyles[t.status].label}
                  </span>
                </div>
                <p className="text-ink mt-2 text-sm font-semibold tabular-nums">
                  {formatMoney(t.amount, 'NGN')}
                  <span className="text-ink-subtle ml-2 font-normal">
                    {formatDate(t.at)}
                  </span>
                </p>
                <RowAction
                  label="Receipt"
                  context={`for ${t.id}`}
                  className="mt-1 inline-flex min-h-11 items-center"
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

/* -------------------------------- renewals -------------------------------- */

export function RenewalsTimeline({
  groups,
}: {
  groups: { id: string; label: string; items: Subscription[] }[]
}) {
  return (
    <Panel title="Upcoming Renewals" flush>
      <p className="text-ink-muted px-4 pb-3 text-sm">
        Auto-renewals grouped by window. Counts are cumulative.
      </p>

      <div className="border-line grid grid-cols-1 gap-4 border-t p-4 lg:grid-cols-3">
        {groups.map((group) => (
          <section key={group.id} aria-label={group.label} className="min-w-0">
            <h3 className="text-ink flex items-center gap-2 text-sm font-semibold">
              {group.label}
              <span className="bg-sunken text-ink-muted rounded-full px-2 py-0.5 text-xs">
                {group.items.length}
              </span>
            </h3>

            {group.items.length === 0 ? (
              <p className="text-ink-subtle mt-2 text-sm">Nothing due.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {group.items.map((s) => {
                  // A transfer already in flight for this cycle: charging again
                  // would take the money twice, so the primary action changes.
                  const payment = renewalPayment(s)
                  const inFlight =
                    payment?.status === 'pending' ||
                    payment?.status === 'processing'
                  return (
                    <li key={s.id} className="border-line rounded-lg border p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-ink min-w-0 text-sm font-semibold break-words">
                          {s.client}
                        </p>
                        <p className="text-ink shrink-0 text-sm font-semibold tabular-nums">
                          {formatMoney(renewalAmount(s), 'NGN')}
                        </p>
                      </div>
                      <p className="text-ink-subtle mt-0.5 text-xs break-words">
                        {planById[s.planId].name} · {s.cycle} · renews{' '}
                        {s.renewsAt ? formatDate(s.renewsAt) : '—'}
                      </p>
                      {payment && (
                        <p className="text-ink-muted mt-1 text-xs break-words">
                          {txStyles[payment.status].label} · {payment.method} ·{' '}
                          {payment.id}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          to={`/billing/subscriptions/${s.id}/renewals`}
                          className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 min-w-28 flex-1 items-center justify-center rounded-lg px-3 text-xs font-medium text-white"
                        >
                          {inFlight ? 'View payment' : 'Renew now'}
                          <span className="sr-only">
                            {' '}
                            for {s.client}, {group.label.toLowerCase()}
                          </span>
                        </Link>
                        <button
                          type="button"
                          className="border-control text-ink hover:bg-sunken h-9 min-w-28 flex-1 rounded-lg border px-3 text-xs font-medium"
                        >
                          Remind
                          <span className="sr-only">
                            {' '}
                            {s.client}, {group.label.toLowerCase()}
                          </span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Panel>
  )
}

/* ------------------------------- plan cards ------------------------------- */

export function PlanPerformance({
  items,
}: {
  items: {
    id: PlanId
    name: string
    subscribers: number
    revenue: number
    hours: string
    renewalRate: number
    tone: Tone
  }[]
}) {
  return (
    <section aria-labelledby="plan-performance">
      <h2
        id="plan-performance"
        className="text-ink mb-3 text-base font-semibold tracking-tight"
      >
        Plan Performance Snapshot
      </h2>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {items.map((plan) => (
          <article key={plan.id} className="card p-4">
            {/* A coloured dot keyed to the donut legend, not a status chip:
                every plan is "Active", so the chip carried no information and
                its hue was silently standing in for plan identity. `toneText`
                (not `toneDot`) because `bg-current` inherits the text colour,
                and the legend uses the same pairing. */}
            <h3 className="text-ink flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2.5 shrink-0 rounded-sm bg-current',
                  toneText[plan.tone],
                )}
              />
              <span className="min-w-0 break-words">{plan.name}</span>
            </h3>

            <dl className="mt-3 space-y-2 text-sm">
              {[
                ['Subscribers', plan.subscribers.toLocaleString()],
                ['Monthly revenue', formatMoney(plan.revenue, 'NGN')],
                ['Included hours', plan.hours],
                ['Renewal rate', `${plan.renewalRate}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-x-3">
                  <dt className="text-ink-muted shrink-0">{label}</dt>
                  <dd className="text-ink min-w-0 text-right font-medium tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to={`/billing/plans/${plan.id}/general`}
                className="border-line text-ink hover:bg-sunken inline-flex h-9 min-w-24 flex-1 items-center justify-center rounded-lg border text-sm font-medium"
              >
                Edit plan<span className="sr-only"> {plan.name}</span>
              </Link>
              <Link
                to={`/billing/subscriptions?plan=${plan.id}`}
                className="border-line text-ink hover:bg-sunken inline-flex h-9 min-w-24 flex-1 items-center justify-center rounded-lg border text-sm font-medium"
              >
                {/* The card's count is org-wide; the workspace tracks eight
                    accounts, so the link doesn't promise the larger number. */}
                Tracked<span className="sr-only"> subscribers on {plan.name}</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
