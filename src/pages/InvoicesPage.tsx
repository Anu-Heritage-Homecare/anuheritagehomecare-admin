import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { accountRecipients, getAccount } from '@/features/billing/accounts'
import { archiveInvoice, restoreInvoice } from '@/features/billing/archive'
import { useBook } from '@/features/billing/book'
import { formatMoney } from '@/features/billing/data'
import { DeleteDraftDialog } from '@/features/billing/DeleteDraftDialog'
import {
  invoiceStatus,
  ledger,
  statementStatusLabels,
  statementStatusTones,
} from '@/features/billing/ledger'
import type { LedgerInvoice, StatementStatus } from '@/features/billing/ledger'
import { TODAY } from '@/lib/today'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 8

type Tab = 'all' | 'draft' | 'due' | 'overdue' | 'paid' | 'archived'

/*
 * No Partially Paid tab: the book settles an invoice whole, so there is
 * nothing to put in it.
 */
const tabs: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All Invoices' },
  { id: 'draft', label: 'Draft' },
  { id: 'due', label: 'Awaiting Payment' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'archived', label: 'Archived' },
]

interface Row {
  invoice: LedgerInvoice
  account: string
  recipient: string
  status: StatementStatus
}

const inTab: Record<Tab, (r: Row) => boolean> = {
  all: (r) => !r.invoice.archivedAt,
  draft: (r) => !r.invoice.archivedAt && r.status === 'draft',
  due: (r) => !r.invoice.archivedAt && r.status === 'due',
  overdue: (r) => !r.invoice.archivedAt && r.status === 'overdue',
  paid: (r) => !r.invoice.archivedAt && r.status === 'paid',
  archived: (r) => Boolean(r.invoice.archivedAt),
}

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

/** Who an invoice is for: the people its lines name, else the account's. */
function recipientOf(invoice: LedgerInvoice): string {
  const named = [...new Set(invoice.breakdown?.lines.flatMap((l) => (l.recipient ? [l.recipient] : [])) ?? [])]
  const account = getAccount(invoice.accountId)
  const people = named.length ? named : account ? accountRecipients(account).map((r) => r.name) : []
  if (people.length === 0) return '—'
  return people.length === 1 ? people[0] : `${people.length} recipients`
}

export function InvoicesPage() {
  useBook()
  const [params, setParams] = useSearchParams()
  const [deleting, setDeleting] = useState<string | null>(null)

  const tab = pick(params.get('tab'), tabs.map((t) => t.id), 'all')
  const query = params.get('q') ?? ''
  const range = pick(params.get('dates'), windowOptions.map((o) => o.value), 'all')
  const accountId = params.get('account') ?? 'all'
  const status = params.get('status') ?? 'all'
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)
  const archived = tab === 'archived'

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const rows: Row[] = ledger
    .filter((i) => i.kind === 'invoice' && i.issuedAt <= TODAY)
    .map((i) => ({
      invoice: i,
      account: getAccount(i.accountId)?.name ?? i.account,
      recipient: recipientOf(i),
      status: invoiceStatus(i),
    }))

  // Everything but the tab, so each tab counts what the other filters left.
  // The date is the archive date on the Archived tab, the issue date elsewhere.
  const needle = query.trim().toLowerCase()
  const since = range === 'all' ? '' : daysBefore(TODAY, Number(range))
  const narrowed = rows.filter((r) => {
    const date = archived ? r.invoice.archivedAt : r.invoice.issuedAt
    return (
      (!needle || [r.invoice.number, r.account, r.recipient].some((f) => f.toLowerCase().includes(needle))) &&
      (!since || (date !== undefined && date >= since)) &&
      (accountId === 'all' || r.invoice.accountId === accountId) &&
      (status === 'all' || r.status === status)
    )
  })
  const counts = Object.fromEntries(tabs.map((t) => [t.id, narrowed.filter(inTab[t.id]).length])) as Record<
    Tab,
    number
  >
  const filtered = narrowed
    .filter(inTab[tab])
    .sort((a, b) =>
      archived
        ? (b.invoice.archivedAt ?? '').localeCompare(a.invoice.archivedAt ?? '') ||
          b.invoice.number.localeCompare(a.invoice.number)
        : b.invoice.issuedAt.localeCompare(a.invoice.issuedAt) || b.invoice.number.localeCompare(a.invoice.number),
    )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * PAGE_SIZE
  const shown = filtered.slice(start, start + PAGE_SIZE)
  const noun = archived ? 'archived invoices' : 'invoices'
  const summary =
    filtered.length === 0
      ? `No ${noun} match these filters`
      : `Showing ${start + 1}-${start + shown.length} of ${filtered.length} ${noun}`

  const accountOptions = [
    { value: 'all', label: 'All accounts' },
    ...[...new Map(rows.map((r) => [r.invoice.accountId, r.account])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label })),
  ]
  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    ...[...new Set(rows.map((r) => r.status))].map((s) => ({ value: s, label: statementStatusLabels[s] })),
  ]
  const columns = [
    'Invoice Number',
    'Billing Account',
    'Care Recipient',
    'Amount',
    archived ? 'Archived Date' : 'Due Date',
    archived ? 'Original Status' : 'Status',
    'Actions',
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-ink-muted mt-1 text-sm">
            {archived ? 'Manage and track all archived invoices' : 'Manage and track all invoices'}
          </p>
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
                  {counts[t.id]}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-48">
            <span className="sr-only">Search {noun}</span>
            <Search
              aria-hidden="true"
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder={`Search ${noun}...`}
              className="border-control focus:border-brand-500 bg-surface h-11 w-full rounded-lg border pr-3 pl-9 text-sm"
            />
          </label>
          <SelectFilter
            quiet
            label="Date Range"
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
          <SelectFilter
            quiet
            label={archived ? 'Original Status' : 'Status'}
            value={status}
            onChange={(v) => setParam('status', v)}
            options={statusOptions}
            className="w-full min-[480px]:w-auto"
          />
        </div>
      </div>

      <section aria-label={archived ? 'Archived invoices' : 'Invoices'} className="card overflow-hidden">
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
              {shown.map((r) => {
                const i = r.invoice
                return (
                  <tr key={i.number}>
                    <td className="text-ink py-3.5 pr-4 font-semibold whitespace-nowrap">
                      <Link to={`/billing/invoices/${i.number}`} className="hover:text-brand-700">
                        {i.number}
                      </Link>
                    </td>
                    <td className="text-ink py-3.5 pr-4 whitespace-nowrap">
                      <Link to={`/billing/accounts/${i.accountId}`} className="hover:text-brand-700">
                        {r.account}
                      </Link>
                    </td>
                    <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">{r.recipient}</td>
                    <td className="text-ink py-3.5 pr-4 text-right font-bold whitespace-nowrap tabular-nums">
                      {formatMoney(i.amount)}
                    </td>
                    <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">
                      {fmt(archived ? (i.archivedAt ?? i.issuedAt) : i.dueAt)}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="inline-flex items-center gap-1.5">
                        {archived && <span className={cn(pill, tonePill.slate)}>Archived</span>}
                        <span className={cn(pill, tonePill[statementStatusTones[r.status]])}>
                          {statementStatusLabels[r.status]}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-4 font-medium">
                        <Link
                          to={`/billing/invoices/${i.number}`}
                          aria-label={`View ${i.number}`}
                          className="text-brand-700 hover:text-brand-800"
                        >
                          View
                        </Link>
                        {archived ? (
                          <button
                            type="button"
                            onClick={() => restoreInvoice(i.number)}
                            aria-label={`Restore ${i.number}`}
                            className="text-brand-700 hover:text-brand-800"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => archiveInvoice(i.number)}
                            aria-label={`Archive ${i.number}`}
                            className="text-ink-muted hover:text-ink"
                          >
                            Archive
                          </button>
                        )}
                        {/* Only a draft can be deleted; anything sent, paid or
                            adjusted stays on record. */}
                        {r.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setDeleting(i.number)}
                            aria-label={`Delete ${i.number}`}
                            className="text-red-700 hover:text-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-ink-muted py-10 text-center">
                    {archived ? 'No archived invoices match these filters.' : 'No invoices match these filters.'}
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

      <DeleteDraftDialog
        invoice={deleting ?? ''}
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onDeleted={() => setDeleting(null)}
      />
    </div>
  )
}
