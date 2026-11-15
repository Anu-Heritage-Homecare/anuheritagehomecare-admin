import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { formatMoney } from '@/features/billing/data'
import {
  statementStatusLabels,
  statementStatusTones,
} from '@/features/billing/ledger'
import {
  useDeleteDraftInvoice,
  useInvoices,
} from '@/features/billing/useInvoices'
import type { InvoiceTab } from '@/features/billing/useInvoices'
import { TODAY } from '@/lib/today'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

type Tab = InvoiceTab

/*
 * No Archived tab: the backend has no archive concept. The old Archived tab and
 * its Archive/Restore row actions (a session only simulation with no backend
 * source) are dropped.
 *
 * No Partially Paid tab: it folds into Awaiting Payment, which the designs call
 * the Due tab.
 */
const tabs: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All Invoices' },
  { id: 'draft', label: 'Draft' },
  { id: 'due', label: 'Awaiting Payment' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
]

type Window = 'all' | '7' | '30' | '90'
const windowOptions: { value: Window; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmt = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`))

const pill = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function InvoicesPage() {
  const [params, setParams] = useSearchParams()
  const [deleting, setDeleting] = useState<string | null>(null)
  const deleteDraft = useDeleteDraftInvoice()

  const tab = pick(params.get('tab'), tabs.map((t) => t.id), 'all')
  const query = params.get('q') ?? ''
  const range = pick(params.get('dates'), windowOptions.map((o) => o.value), 'all')
  const accountId = params.get('account') ?? 'all'
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  // The date window filters on due date, the one date the list carries per row.
  const dueFrom = range === 'all' ? undefined : daysBefore(TODAY, Number(range))
  const { data, isPending, isError, error, refetch } = useInvoices({
    tab,
    search: query,
    accountId,
    dueFrom,
    page,
  })

  const rows = data?.rows ?? []
  const counts = data?.counts
  const accountOptions = [
    { value: 'all', label: 'All accounts' },
    ...(data?.accounts ?? []),
  ]
  const columns = ['Invoice Number', 'Billing Account', 'Care Recipient', 'Amount', 'Due Date', 'Status', 'Actions']

  const pageCount = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * (data?.pageSize ?? 0)
  const total = data?.total ?? 0
  const summary =
    total === 0
      ? 'No invoices match these filters'
      : `Showing ${start + 1}-${start + rows.length} of ${total} invoices`

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-ink-muted mt-1 text-sm">Manage and track all invoices</p>
        </div>
        <Link
          to="/billing/invoices/new?from=/billing/invoices"
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 shrink-0 items-center justify-center self-start rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Create Invoice
        </Link>
      </header>

      <div className="space-y-4">
        <nav aria-label="Invoice views" className="border-line no-scrollbar flex gap-4 overflow-x-auto border-b">
          {tabs.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setParam('tab', t.id)}
                className={cn(
                  '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors',
                  active ? 'border-brand-600 text-brand-700' : 'text-ink-muted hover:text-ink border-transparent',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                    active ? 'bg-brand-50 text-brand-700' : 'bg-sunken text-ink-muted',
                  )}
                >
                  {counts ? counts[t.id] : '—'}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-48">
            <span className="sr-only">Search invoices</span>
            <Search
              aria-hidden="true"
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search invoices..."
              className="border-control focus:border-brand-500 bg-surface h-11 w-full rounded-lg border pr-3 pl-9 text-sm"
            />
          </label>
          <SelectFilter
            quiet
            label="Due Range"
            value={range}
            onChange={(v) => setParam('dates', v)}
            options={windowOptions}
            className="w-full min-[480px]:w-auto"
          />
          <SelectFilter
            quiet
            label="Billing Account"
            value={accountId}
            onChange={(v) => setParam('account', v)}
            options={accountOptions}
            className="w-full min-[480px]:w-auto"
          />
        </div>
      </div>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading invoices…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load the invoices.</p>
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
        <section aria-label="Invoices" className="card overflow-hidden">
          <div className="overflow-x-auto px-4 pt-2">
            <table className="w-full min-w-5xl text-left text-sm">
              <thead>
                <tr className="border-line text-ink border-b">
                  {columns.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn(
                        'py-3 pr-4 font-semibold whitespace-nowrap last:pr-0',
                        (c === 'Amount' || c === 'Actions') && 'text-right',
                      )}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-ink py-3.5 pr-4 font-semibold whitespace-nowrap">
                      <Link to={`/billing/invoices/${r.id}`} className="hover:text-brand-700">
                        {r.number}
                      </Link>
                    </td>
                    <td className="text-ink py-3.5 pr-4 whitespace-nowrap">
                      {r.billingAccountId ? (
                        <Link to={`/billing/accounts/${r.billingAccountId}`} className="hover:text-brand-700">
                          {r.account}
                        </Link>
                      ) : (
                        r.account
                      )}
                    </td>
                    <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">{r.recipient}</td>
                    <td className="text-ink py-3.5 pr-4 text-right font-bold whitespace-nowrap tabular-nums">
                      {formatMoney(r.amount)}
                    </td>
                    <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">
                      {r.dueDate ? fmt(r.dueDate) : '—'}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={cn(pill, tonePill[statementStatusTones[r.status]])}>
                        {statementStatusLabels[r.status]}
                      </span>
                    </td>
                    <td className="py-3.5 text-right whitespace-nowrap">
                      {deleting === r.id ? (
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            disabled={deleteDraft.isPending}
                            onClick={() => {
                              deleteDraft.mutate(r.id, { onSettled: () => setDeleting(null) })
                            }}
                            className="text-red-700 hover:text-red-800 font-semibold disabled:opacity-40"
                          >
                            Confirm delete
                          </button>
                          <button type="button" onClick={() => setDeleting(null)} className="text-ink-muted hover:text-ink font-medium">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-4 font-medium">
                          <Link
                            to={`/billing/invoices/${r.id}`}
                            aria-label={`View ${r.number}`}
                            className="text-brand-700 hover:text-brand-800"
                          >
                            View
                          </Link>
                          {/* Only a draft can be deleted; anything sent, paid or
                              adjusted stays on record. */}
                          {r.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => setDeleting(r.id)}
                              aria-label={`Delete ${r.number}`}
                              className="text-red-700 hover:text-red-800"
                            >
                              Delete
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="text-ink-muted py-10 text-center">
                      No invoices match these filters.
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
            summary={summary}
          />
        </section>
      )}
    </div>
  )
}
