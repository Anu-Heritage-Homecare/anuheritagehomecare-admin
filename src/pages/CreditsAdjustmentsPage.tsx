import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { formatDate, formatMoney } from '@/features/billing/data'
import {
  accountName,
  approve,
  canApprove,
  canReject,
  canReverse,
  kindLabels,
  reject,
  reverse,
  signOf,
  statusLabel,
  statusTones,
  statusesFor,
  useAdjustments,
} from '@/features/billing/adjustments'
import type {
  Adjustment,
  AdjustmentKind,
  AdjustmentStatus,
} from '@/features/billing/adjustments'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { Drawer } from '@/components/ui/Drawer'
import { CreateRefundDialog } from '@/features/billing/CreateRefundDialog'
import { ApplyCreditDialog } from '@/features/billing/ApplyCreditDialog'
import { ReviewAdjustmentDialog } from '@/features/billing/ReviewAdjustmentDialog'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 8

const kinds: AdjustmentKind[] = ['credit', 'refund', 'write-off', 'adjustment']

type AmountBand = 'all' | 'under-1k' | '1k-5k' | 'over-5k'

const amountOptions: { value: AmountBand; label: string }[] = [
  { value: 'all', label: 'Any amount' },
  { value: 'under-1k', label: 'Under ₦1,000' },
  { value: '1k-5k', label: '₦1,000 – ₦5,000' },
  { value: 'over-5k', label: 'Over ₦5,000' },
]

const inAmount: Record<AmountBand, (a: number) => boolean> = {
  all: () => true,
  'under-1k': (a) => a < 1_000,
  '1k-5k': (a) => a >= 1_000 && a <= 5_000,
  'over-5k': (a) => a > 5_000,
}

const allStatuses: AdjustmentStatus[] = ['pending', 'applied', 'processing', 'completed', 'rejected', 'reversed']

const pill =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** The invoice or payment an entry acts on, linked where it has a page. */
function Target({ a }: { a: Adjustment }) {
  if (a.invoice)
    return (
      <Link to={`/billing/invoices/${a.invoice}`} className="text-brand-700 hover:text-brand-800">
        {a.invoice}
      </Link>
    )
  if (a.txId)
    return (
      <Link to={`/billing/accounts/${a.accountId}/payments`} className="text-brand-700 hover:text-brand-800">
        {a.txId}
      </Link>
    )
  return <>—</>
}

/** What the entry does to balances, in words. */
function effectOf(a: Adjustment): string {
  switch (a.status) {
    case 'pending':
      return 'Pending — no effect on any balance until it is approved.'
    case 'rejected':
      return 'Rejected — no effect on any balance.'
    case 'reversed':
      return 'Reversed — its effect on the balance has been undone.'
    case 'processing':
      return 'Approved and being paid out. Balances are unchanged: the refund is money going back, which the payment records only show once the gateway confirms it.'
    case 'completed':
      return 'Paid out.'
    case 'applied':
      if (a.kind === 'credit') return `${formatMoney(a.amount)} taken off ${a.invoice}'s balance and what was billed.`
      if (a.kind === 'write-off') return `${formatMoney(a.amount)} of ${a.invoice} will not be collected; still counted as billed.`
      return `${signOf(a)}${formatMoney(a.amount)} on ${a.invoice}'s amount and balance.`
  }
}

type Action = 'approve' | 'reject' | 'reverse'

const actionLabel: Record<Action, string> = {
  approve: 'Approve',
  reject: 'Reject',
  reverse: 'Reverse',
}

const run: Record<Action, (a: Adjustment) => void> = { approve, reject, reverse }

/**
 * Approve and reject open the review dialog, where the approver can leave a
 * note. Reverse moves money back, so it asks once more on the row itself.
 */
function RowActions({
  a,
  onView,
  onReview,
}: {
  a: Adjustment
  onView?: () => void
  onReview: (a: Adjustment) => void
}) {
  const [confirming, setConfirming] = useState<Action | null>(null)
  if (confirming)
    return (
      <span className="inline-flex items-center gap-3 whitespace-nowrap">
        <button
          type="button"
          onClick={() => {
            run[confirming](a)
            setConfirming(null)
          }}
          className={cn(
            'font-semibold',
            confirming === 'approve' ? 'text-brand-700 hover:text-brand-800' : 'text-red-700 hover:text-red-800',
          )}
        >
          Confirm {actionLabel[confirming].toLowerCase()}
        </button>
        <button type="button" onClick={() => setConfirming(null)} className="text-ink-muted hover:text-ink">
          Cancel
        </button>
      </span>
    )
  const available: Action[] = [
    ...(canApprove(a) ? (['approve'] as const) : []),
    // Reject sits in the details panel: the row carries what the designs draw.
    ...(canReject(a) && !onView ? (['reject'] as const) : []),
    ...(canReverse(a) ? (['reverse'] as const) : []),
  ]
  return (
    <span className="inline-flex items-center gap-4 whitespace-nowrap">
      {onView && (
        <button type="button" onClick={onView} className="text-brand-700 hover:text-brand-800 font-medium">
          View
        </button>
      )}
      {available.map((act) => (
        <button
          key={act}
          type="button"
          onClick={() => (act === 'reverse' ? setConfirming(act) : onReview(a))}
          aria-label={`${actionLabel[act]} ${a.ref}`}
          className={cn(
            'font-medium',
            act === 'approve' ? 'text-brand-700 hover:text-brand-800' : 'text-ink-muted hover:text-ink',
          )}
        >
          {actionLabel[act]}
        </button>
      ))}
    </span>
  )
}

export function CreditsAdjustmentsPage() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState<'credit' | 'refund' | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const review = (a: Adjustment) => {
    // One dialog at a time: the details panel gives way to the review.
    setOpen(null)
    setReviewing(a.ref)
  }
  const adjustments = useAdjustments()

  const tab = pick(params.get('tab'), kinds, 'credit')
  const query = params.get('q') ?? ''
  const type = params.get('type') ?? 'all'
  const status = pick(params.get('status'), ['all', ...allStatuses] as const, 'all')
  const amount = pick(params.get('amount'), amountOptions.map((o) => o.value), 'all')
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    // A type and a status belong to one tab; carrying them across would empty the table.
    if (key === 'tab') {
      next.delete('type')
      next.delete('status')
    }
    setParams(next, { replace: key === 'q' })
  }

  // Everything but the tab (and the tab-specific type), so each tab counts
  // what the rest of the filters left.
  const needle = query.trim().toLowerCase()
  const narrowed = adjustments.filter(
    (a) =>
      (!needle ||
        [a.ref, accountName(a), a.reason, a.invoice ?? '', a.txId ?? '', a.type].some((f) =>
          f.toLowerCase().includes(needle),
        )) &&
      (status === 'all' || a.status === status) &&
      inAmount[amount](a.amount),
  )
  const inTab = narrowed.filter((a) => a.kind === tab)
  const typeOptions = [
    { value: 'all', label: 'All types' },
    ...[...new Set(adjustments.filter((a) => a.kind === tab).map((a) => a.type))]
      .sort()
      .map((t) => ({ value: t, label: t })),
  ]
  const filtered = inTab
    .filter((a) => type === 'all' || a.type === type)
    .sort((a, b) => b.at.localeCompare(a.at) || b.ref.localeCompare(a.ref))

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)
  const selected = adjustments.find((a) => a.ref === open)
  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    ...statusesFor[tab].map((st) => ({ value: st, label: statusLabel({ kind: tab, status: st }) })),
  ]
  // The designs draw a Reason column for write-offs and adjustments only.
  const showReason = tab === 'write-off' || tab === 'adjustment'
  const columns = [
    'Reference',
    'Type',
    'Billing Account',
    'Applies to',
    'Amount',
    ...(showReason ? ['Reason'] : []),
    'Date',
    'Status',
    'Actions',
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">Credits &amp; Adjustments</h1>
          <p className="text-ink-muted mt-1 text-sm">Manage financial corrections and adjustments</p>
        </div>
        {/* Credits and refunds have forms; write-offs and adjustments are
            not designed yet, so there the button does nothing. */}
        <button
          type="button"
          onClick={tab === 'credit' || tab === 'refund' ? () => setCreating(tab) : undefined}
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 shrink-0 items-center justify-center self-start rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          {tab === 'credit' ? 'Apply Credit' : tab === 'refund' ? 'Create Refund' : 'Create Adjustment'}
        </button>
      </header>

      <div className="space-y-4">
        <nav aria-label="Adjustment kinds" className="border-line no-scrollbar flex gap-5 overflow-x-auto border-b">
          {kinds.map((k) => {
            const active = k === tab
            return (
              <button
                key={k}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setParam('tab', k)}
                className={cn(
                  '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors',
                  active ? 'border-brand-600 text-brand-700' : 'text-ink-muted hover:text-ink border-transparent',
                )}
              >
                {kindLabels[k].many}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                    active ? 'bg-brand-50 text-brand-700' : 'bg-sunken text-ink-muted',
                  )}
                >
                  {narrowed.filter((a) => a.kind === k).length}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-48">
            <span className="sr-only">Search adjustments</span>
            <Search
              aria-hidden="true"
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search by reference, account, invoice or reason..."
              className="border-control focus:border-brand-500 bg-surface h-11 w-full rounded-lg border pr-3 pl-9 text-sm"
            />
          </label>
          <SelectFilter quiet label="Type" value={type} onChange={(v) => setParam('type', v)} options={typeOptions} className="w-full min-[480px]:w-auto" />
          <SelectFilter quiet label="Status" value={status} onChange={(v) => setParam('status', v)} options={statusOptions} className="w-full min-[480px]:w-auto" />
          <SelectFilter quiet label="Amount" value={amount} onChange={(v) => setParam('amount', v)} options={amountOptions} className="w-full min-[480px]:w-auto" />
        </div>
      </div>

      <section aria-label={kindLabels[tab].many} className="card overflow-hidden">
        <div className="overflow-x-auto px-4 pt-2">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-line text-ink border-b">
                {columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      'py-3 pr-4 font-semibold whitespace-nowrap last:pr-0',
                      c === 'Amount' && 'text-right',
                      c === 'Actions' && 'text-right',
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {rows.map((a) => (
                <tr key={a.ref}>
                  <td className="text-ink py-3.5 pr-4 font-semibold whitespace-nowrap">{a.ref}</td>
                  <td className="text-ink-muted py-3.5 pr-4">{a.type}</td>
                  <td className="text-ink max-w-44 py-3.5 pr-4">
                    <Link
                      to={`/billing/accounts/${a.accountId}`}
                      title={accountName(a)}
                      className="hover:text-brand-700 block truncate"
                    >
                      {accountName(a)}
                    </Link>
                  </td>
                  <td className="py-3.5 pr-4 whitespace-nowrap"><Target a={a} /></td>
                  <td className="text-ink py-3.5 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                    {signOf(a)}
                    {formatMoney(a.amount)}
                  </td>
                  {showReason && (
                    <td className="text-ink-muted max-w-40 py-3.5 pr-4">
                      <span className="block truncate" title={a.reason}>{a.reason}</span>
                    </td>
                  )}
                  <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">{formatDate(a.at)}</td>
                  <td className="py-3.5 pr-4">
                    <span className={cn(pill, tonePill[statusTones[a.status]])}>{statusLabel(a)}</span>
                  </td>
                  <td className="py-3.5 text-right">
                    <RowActions a={a} onView={() => setOpen(a.ref)} onReview={review} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-ink-muted py-10 text-center">
                    No {kindLabels[tab].many.toLowerCase()} match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={(p) => setParam('page', String(p))}
          summary={
            filtered.length === 0
              ? `No ${kindLabels[tab].many.toLowerCase()}`
              : `Showing ${start + 1}-${start + rows.length} of ${filtered.length} ${
                  filtered.length === 1 ? kindLabels[tab].one.toLowerCase() : kindLabels[tab].many.toLowerCase()
                }`
          }
        />
      </section>

      <Drawer open={Boolean(selected)} onClose={() => setOpen(null)} title={selected?.type ?? ''} subtitle={selected?.ref}>
        {selected && (
          <div className="space-y-5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-ink text-2xl font-bold tracking-tight tabular-nums">
                {signOf(selected)}
                {formatMoney(selected.amount)}
              </p>
              <span className={cn(pill, tonePill[statusTones[selected.status]])}>{statusLabel(selected)}</span>
            </div>
            <dl className="divide-line divide-y text-sm">
              {(
                [
                  ['Kind', kindLabels[selected.kind].one],
                  ['Billing account', <Link key="a" to={`/billing/accounts/${selected.accountId}`} className="text-brand-700">{accountName(selected)}</Link>],
                  ['Applies to', <Target key="t" a={selected} />],
                  ...(selected.method ? [['Refund method', selected.method]] : []),
                  ['Raised', formatDate(selected.at)],
                  ['Raised by', selected.raisedBy],
                  ...(selected.decidedBy
                    ? [[`${statusLabel(selected)} by`, `${selected.decidedBy}, ${formatDate(selected.decidedAt ?? '')}`]]
                    : []),
                ] as [string, React.ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-ink text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="text-ink text-sm font-semibold">Reason</h3>
              <p className="text-ink-muted mt-1 text-sm">{selected.reason}</p>
            </div>
            {selected.outcome && (
              <div>
                <h3 className="text-ink text-sm font-semibold">Outcome</h3>
                <p className="text-ink-muted mt-1 text-sm">{selected.outcome}</p>
              </div>
            )}
            <p className="bg-sunken text-ink-muted rounded-lg p-3 text-sm">{effectOf(selected)}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <RowActions a={selected} onReview={review} />
              <Link to={`/billing/accounts/${selected.accountId}`} className="text-brand-700 hover:text-brand-800 text-sm font-medium">
                Open account
              </Link>
            </div>
          </div>
        )}
      </Drawer>
      <CreateRefundDialog
        open={creating === 'refund'}
        onClose={() => setCreating(null)}
        onCreated={(ref) => {
          setCreating(null)
          setOpen(ref)
        }}
      />
      <ReviewAdjustmentDialog
        adjustment={adjustments.find((a) => a.ref === reviewing)}
        onClose={() => setReviewing(null)}
      />
      <ApplyCreditDialog
        open={creating === 'credit'}
        onClose={() => setCreating(null)}
        onCreated={(ref) => {
          setCreating(null)
          setOpen(ref)
        }}
      />
    </div>
  )
}
