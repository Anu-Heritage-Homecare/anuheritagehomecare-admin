import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { formatDate, formatMoney } from '@/features/billing/data'
import {
  accountStatusLabels,
  accountStatusTones,
} from '@/features/billing/ledger'
import type { AccountStatus } from '@/features/billing/ledger'
import { useBillingAccounts } from '@/features/billing/useBillingAccounts'
import type { AccountTab } from '@/features/billing/useBillingAccounts'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

type Tab = AccountTab

const tabs: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All Accounts' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'inactive', label: 'Inactive' },
]

type Balance = 'all' | 'none' | 'under-10k' | '10k-50k' | 'over-50k'

const balanceOptions: { value: Balance; label: string }[] = [
  { value: 'all', label: 'Any balance' },
  { value: 'none', label: 'No balance' },
  { value: 'under-10k', label: 'Under ₦10,000' },
  { value: '10k-50k', label: '₦10,000 – ₦50,000' },
  { value: 'over-50k', label: 'Over ₦50,000' },
]

/** The whole unit bands, as minor units for the backend balance filter. */
const balanceRange: Record<Balance, { min?: number; max?: number }> = {
  all: {},
  none: { min: 0, max: 0 },
  'under-10k': { min: 1, max: 999_999 },
  '10k-50k': { min: 1_000_000, max: 5_000_000 },
  'over-50k': { min: 5_000_001 },
}

const statusOptions: { value: AccountStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...(Object.keys(accountStatusLabels) as AccountStatus[]).map((s) => ({
    value: s,
    label: accountStatusLabels[s],
  })),
]

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

const pill =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const columns: { label: string; className?: string }[] = [
  { label: 'Account Name' },
  { label: 'Primary Contact' },
  { label: 'Phone' },
  { label: 'Recipients', className: 'text-center' },
  { label: 'Outstanding', className: 'text-right' },
  { label: 'Last Payment' },
  { label: 'Status' },
  { label: 'Actions', className: 'text-right' },
]

export function BillingAccountsPage() {
  const [params, setParams] = useSearchParams()

  const query = params.get('q') ?? ''
  const tab = pick(params.get('tab'), tabs.map((t) => t.id), 'all')
  const branch = params.get('branch') ?? 'all'
  const status = pick(params.get('status'), statusOptions.map((o) => o.value), 'all')
  const balance = pick(params.get('balance'), balanceOptions.map((o) => o.value), 'all')
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    // Only keystrokes replace; a tab or a filter is a decision Back can undo.
    setParams(next, { replace: key === 'q' })
  }

  const { data, isPending, isError, error, refetch } = useBillingAccounts({
    tab,
    search: query,
    branch,
    minBalanceMinor: balanceRange[balance].min,
    maxBalanceMinor: balanceRange[balance].max,
    page,
  })

  const counts = data?.counts
  // The backend status filter is a different enum (family member status), so the
  // page's active/overdue/inactive status is filtered over the fetched page.
  const rows = (data?.rows ?? []).filter((r) => status === 'all' || r.status === status)

  const branchOptions = [
    { value: 'all', label: 'All branches' },
    ...(data?.branches ?? []).map((b) => ({ value: b, label: b })),
  ]

  const pageCount = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * (data?.pageSize ?? 0)
  const total = data?.total ?? 0
  const summary =
    total === 0
      ? 'No accounts match these filters'
      : `Showing ${start + 1}-${start + rows.length} of ${total} accounts`

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">Billing Accounts</h1>
          <p className="text-ink-muted mt-1 text-sm">Manage billing accounts and balances</p>
        </div>
        {/* No account form exists yet; a button, not a link that half-works. */}
        <button
          type="button"
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 shrink-0 items-center justify-center self-start rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Create Account
        </button>
      </header>

      <div className="space-y-4">
        <nav
          aria-label="Account views"
          className="border-line no-scrollbar flex gap-4 overflow-x-auto border-b"
        >
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
                  active
                    ? 'border-brand-600 text-brand-700'
                    : 'text-ink-muted hover:text-ink border-transparent',
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
            <span className="sr-only">Search accounts</span>
            <Search
              aria-hidden="true"
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search accounts..."
              className="border-control focus:border-brand-500 bg-surface h-11 w-full rounded-lg border pr-3 pl-9 text-sm"
            />
          </label>
          <SelectFilter
            quiet
            label="Branch"
            value={branch}
            onChange={(v) => setParam('branch', v)}
            options={branchOptions}
            className="w-full min-[480px]:w-auto"
          />
          <SelectFilter
            quiet
            label="Status"
            value={status}
            onChange={(v) => setParam('status', v)}
            options={statusOptions}
            className="w-full min-[480px]:w-auto"
          />
          <SelectFilter
            quiet
            label="Balance Range"
            value={balance}
            onChange={(v) => setParam('balance', v)}
            options={balanceOptions}
            className="w-full min-[480px]:w-auto"
          />
        </div>
      </div>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading accounts…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load the billing accounts.</p>
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
        <section aria-label="Billing accounts" className="card overflow-hidden">
          {/* Padding on the wrapper, not the cells, so the rules are inset. */}
          <div className="overflow-x-auto px-4 pt-2">
            <table className="w-full min-w-5xl text-left text-sm">
              <thead>
                <tr className="border-line text-ink border-b">
                  {columns.map((c) => (
                    <th
                      key={c.label}
                      scope="col"
                      className={cn('py-3 pr-4 font-semibold whitespace-nowrap last:pr-0', c.className)}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {rows.map((a) => {
                  const open = `/billing/accounts/${a.id}`
                  return (
                    <tr key={a.id}>
                      <td className="text-ink max-w-56 py-3.5 pr-4 font-semibold">
                        <Link to={open} className="hover:text-brand-700 block truncate">
                          {a.name}
                        </Link>
                      </td>
                      <td className="text-ink py-3.5 pr-4 whitespace-nowrap">{a.contact}</td>
                      <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap tabular-nums">
                        {a.phone}
                      </td>
                      <td className="py-3.5 pr-4 text-center">
                        <span className="bg-sunken text-ink inline-grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                          {a.recipients}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'py-3.5 pr-4 text-right whitespace-nowrap tabular-nums',
                          a.outstanding > 0 ? 'text-ink font-semibold' : 'text-ink-muted',
                        )}
                      >
                        {formatMoney(a.outstanding)}
                      </td>
                      <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">
                        {a.lastPaymentAt ? formatDate(a.lastPaymentAt.slice(0, 10)) : '—'}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className={cn(pill, tonePill[accountStatusTones[a.status]])}>
                          {accountStatusLabels[a.status]}
                        </span>
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <Link
                          to={open}
                          aria-label={`View ${a.name}`}
                          className="text-brand-700 hover:text-brand-800 text-sm font-medium"
                        >
                          View
                        </Link>
                        <Link
                          to={`/billing/invoices/new?account=${a.id}&from=/billing/accounts`}
                          aria-label={`Create an invoice for ${a.name}`}
                          className="text-brand-700 hover:text-brand-800 ml-4 text-sm font-medium"
                        >
                          Invoice
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="text-ink-muted py-10 text-center">
                      No accounts match these filters.
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
