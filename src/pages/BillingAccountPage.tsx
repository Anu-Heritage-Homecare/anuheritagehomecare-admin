import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight, FileText, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { formatDate, formatMoney } from '@/features/billing/data'
import { formatSize } from '@/features/billing/documents'
import {
  statementStatusLabels,
  statementStatusTones,
} from '@/features/billing/ledger'
import type { StatementStatus } from '@/features/billing/ledger'
import {
  useAccountActivity,
  useAccountDocuments,
  useAccountInvoices,
  useAccountMutations,
  useAccountPayments,
  useAccountRecipients,
  useBillingAccount,
} from '@/features/billing/useBillingAccount'
import type {
  AccountDetailView,
  AccountInvoiceView,
  AccountPaymentView,
} from '@/features/billing/useBillingAccount'
import { Panel } from '@/components/ui/Panel'
import { DetailRows } from '@/components/ui/DetailList'
import { Avatar } from '@/components/ui/Avatar'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { RecipientStatusBadge } from '@/components/ui/StatusBadge'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const tabs = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'recipients', label: 'Care Recipients' },
  { slug: 'invoices', label: 'Invoices' },
  { slug: 'payments', label: 'Payments' },
  { slug: 'documents', label: 'Documents' },
  { slug: 'activity', label: 'Activity' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

const pill =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const outlineButton =
  'border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors'

/** The backend invoice status to the page's statement status union. */
function invoiceStatusOf(status: AccountInvoiceView['status']): StatementStatus {
  switch (status) {
    case 'PAID':
      return 'paid'
    case 'AWAITING_PAYMENT':
      return 'due'
    case 'OVERDUE':
      return 'overdue'
    case 'CANCELLED':
      return 'cancelled'
    case 'WRITTEN_OFF':
      return 'closed'
  }
}

function Loading({ label }: { label: string }) {
  return (
    <div className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      {label}
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-ink text-sm font-medium">Could not load this.</p>
      <p className="text-ink-subtle text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

/** An invoice number links to its page; card charges and plans have none. */
function RefLink({ value, to }: { value: string; to?: string }) {
  if (!to) return <>{value}</>
  return (
    <Link to={to} className="text-brand-700 hover:text-brand-800 hover:underline">
      {value}
    </Link>
  )
}

/** Header row of an in-card table: a rule below only, per the panel rules. */
function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn('text-ink-muted py-2 pr-4 text-xs font-medium whitespace-nowrap last:pr-0', className)}
    >
      {children}
    </th>
  )
}

interface TimelineEvent {
  id: string
  title: string
  detail: string
  at: string
  actor?: string
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0)
    return <p className="text-ink-muted text-sm">No activity recorded.</p>
  return (
    <ol className="space-y-6">
      {events.map((e, i) => (
        <li key={e.id} className="relative pl-7">
          {/* Rail between dots; stops at the last one. */}
          {i < events.length - 1 && (
            <span
              aria-hidden="true"
              className="bg-line absolute top-4 bottom-[-1.5rem] left-[3px] w-px"
            />
          )}
          <span
            aria-hidden="true"
            className="bg-brand-600 absolute top-1.5 left-0 size-[7px] rounded-full"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-ink text-sm font-semibold">{e.title}</p>
            <time dateTime={e.at} className="text-ink-subtle text-xs whitespace-nowrap">
              {formatDate(e.at)}
            </time>
          </div>
          {e.detail && <p className="text-ink-muted mt-0.5 text-sm break-words">{e.detail}</p>}
          {e.actor && (
            <p className="text-ink-subtle mt-0.5 text-xs">
              Performed by: <span className="text-ink font-medium">{e.actor}</span>
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

export function BillingAccountPage() {
  const { accountId, tab: tabParam } = useParams()
  const { data: account, isPending, isError, error, refetch } = useBillingAccount(accountId)
  const { sendReminder } = useAccountMutations(accountId)

  const tab = tabs.find((t) => t.slug === tabParam)?.slug
  if (tabParam && !tab) return <Navigate to={`/billing/accounts/${accountId}`} replace />
  const active: TabSlug = tab ?? 'overview'

  if (isPending) {
    return (
      <div className="space-y-6">
        <Loading label="Loading account…" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="space-y-6">
        <ErrorCard message={error.message} onRetry={() => void refetch()} />
      </div>
    )
  }

  const base = `/billing/accounts/${account.id}`

  const details = [
    { label: 'Account ID', value: account.summary.reference },
    { label: 'Opened', value: formatDate(account.summary.createdDate) },
    { label: 'Branch', value: account.summary.branch },
    { label: 'Payment terms', value: account.summary.paymentTerms },
    { label: 'Preferred method', value: account.summary.preferredMethod },
  ]

  const tiles: { id: string; label: string; value: string; alert?: boolean }[] = [
    {
      id: 'outstanding',
      label: 'Outstanding balance',
      value: formatMoney(account.financial.outstanding, account.financial.currency),
      alert: account.financial.outstanding > 0,
    },
    { id: 'billed', label: 'Total billed', value: formatMoney(account.financial.totalBilled, account.financial.currency) },
    { id: 'paid', label: 'Total paid', value: formatMoney(account.financial.totalPaid, account.financial.currency) },
    {
      id: 'last',
      label: 'Last payment',
      value: account.financial.lastPaymentAt ? formatDate(account.financial.lastPaymentAt) : 'None',
    },
  ]

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/billing" className="hover:text-ink">Billing</Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </li>
          <li>
            <Link to="/billing/accounts" className="hover:text-ink">Accounts</Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </li>
          <li className="text-brand-700 min-w-0 font-medium" aria-current="page">
            {account.name}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-ink text-2xl font-bold tracking-tight break-words">
              {account.name}
            </h1>
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span>
              <span className="text-ink-muted">Primary contact: </span>
              <span className="text-ink font-medium">{account.contact}</span>
            </span>
            <span aria-hidden="true" className="text-line">|</span>
            <span>
              <span className="text-ink-muted">Phone: </span>
              <span className="text-ink font-medium tabular-nums">{account.phone}</span>
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/billing/invoices/new?account=${account.id}&from=${encodeURIComponent(base)}`}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            Create Invoice
          </Link>
          <button
            type="button"
            onClick={() => sendReminder.mutate()}
            disabled={sendReminder.isPending}
            className={cn(outlineButton, 'disabled:opacity-40')}
          >
            Send Reminder
          </button>
        </div>
      </header>

      <nav
        aria-label={`${account.name} sections`}
        className="border-line no-scrollbar flex gap-5 overflow-x-auto border-b"
      >
        {tabs.map((t) => (
          <Link
            key={t.slug}
            to={t.slug === 'overview' ? base : `${base}/${t.slug}`}
            aria-current={t.slug === active ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 text-sm font-medium transition-colors',
              t.slug === active
                ? 'border-brand-600 text-brand-700'
                : 'text-ink-muted hover:text-ink border-transparent',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active === 'overview' && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Panel title="Account Summary" titleClassName="text-base">
              <DetailRows items={details} />
            </Panel>

            <Panel
              title="Recent Invoices"
              titleClassName="text-base"
              flush
              badge={
                <Link
                  to={`${base}/invoices`}
                  className="text-brand-700 hover:text-brand-800 text-sm font-medium"
                >
                  View all
                </Link>
              }
            >
              <RecentInvoices invoices={account.recentInvoices} currency={account.financial.currency} />
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Financial Summary" titleClassName="text-base">
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                {tiles.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      'rounded-lg border p-4',
                      t.alert ? 'border-red-200 bg-red-50' : 'border-line bg-sunken',
                    )}
                  >
                    <p
                      className={cn(
                        'text-xs font-medium tracking-wider uppercase',
                        t.alert ? 'text-red-700' : 'text-ink-muted',
                      )}
                    >
                      {t.label}
                    </p>
                    <p
                      className={cn(
                        'mt-1.5 text-xl font-bold tracking-tight tabular-nums',
                        t.alert ? 'text-red-700' : 'text-ink',
                      )}
                    >
                      {t.value}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Activity Timeline" titleClassName="text-base">
              <Timeline events={account.timeline.slice(0, 5)} />
            </Panel>
          </div>
        </div>
      )}

      {active === 'recipients' && <RecipientsTab accountId={account.id} />}

      {active === 'invoices' && <InvoicesTab accountId={account.id} />}

      {active === 'payments' && <PaymentsTab account={account} />}

      {active === 'documents' && <DocumentsTab accountId={account.id} />}

      {active === 'activity' && <ActivityTab accountId={account.id} />}
    </div>
  )
}

function RecentInvoices({
  invoices,
  currency,
}: {
  invoices: AccountDetailView['recentInvoices']
  currency: string
}) {
  if (invoices.length === 0)
    return <p className="text-ink-muted px-4 pb-4 text-sm">Nothing billed yet.</p>
  return (
    <div className="overflow-x-auto px-4 pb-2">
      <table className="w-full min-w-[26rem] text-left text-sm">
        <thead>
          <tr className="border-line border-b">
            <Th>Reference</Th>
            <Th className="text-right">Amount</Th>
            <Th>Due date</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {invoices.map((l) => (
            <tr key={l.number}>
              <td className="text-ink py-3 pr-4 font-semibold whitespace-nowrap">{l.number}</td>
              <td className="text-ink py-3 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                {formatMoney(l.amount, currency)}
              </td>
              <td className="text-ink-muted py-3 pr-4 whitespace-nowrap">
                {l.dueDate ? formatDate(l.dueDate) : '—'}
              </td>
              <td className="text-ink-muted py-3 whitespace-nowrap">{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------ care recipients ----------------------------- */

function RecipientsTab({ accountId }: { accountId: string }) {
  const { data, isPending, isError, error, refetch } = useAccountRecipients(accountId)
  if (isPending) return <Loading label="Loading recipients…" />
  if (isError) return <ErrorCard message={error.message} onRetry={() => void refetch()} />
  const rows = data
  return (
    <section aria-label="Care recipients" className="card overflow-hidden">
      <div className="overflow-x-auto px-4 pt-2">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-line text-ink border-b">
              {['Name', 'Relationship', 'Service Plan', 'Monthly Cost', 'Start Date', 'Status', 'Actions'].map(
                (c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      'py-3 pr-4 font-semibold whitespace-nowrap last:pr-0',
                      c === 'Monthly Cost' && 'text-right',
                      c === 'Actions' && 'text-right',
                    )}
                  >
                    {c}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="py-3.5 pr-4">
                  <span className="flex items-center gap-3">
                    <Avatar name={row.name} decorative className="size-9" />
                    <span className="text-ink font-semibold">{row.name}</span>
                  </span>
                </td>
                <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">{row.relationship}</td>
                <td className="text-ink py-3.5 pr-4 font-medium whitespace-nowrap">{row.plan}</td>
                <td className="text-ink py-3.5 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                  {row.monthly === undefined ? '—' : `${formatMoney(row.monthly, row.currency)}/mo`}
                </td>
                <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">
                  {row.startedAt ? formatDate(row.startedAt) : 'Not recorded'}
                </td>
                <td className="py-3.5 pr-4">
                  <RecipientStatusBadge status={row.status} />
                </td>
                <td className="py-3.5 text-right whitespace-nowrap">
                  <Link
                    to={`/care-recipients/${row.id}`}
                    className="text-brand-700 hover:text-brand-800 font-medium"
                  >
                    Profile
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-ink-muted py-10 text-center">
                  No recipients billed to this account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-line text-ink-muted mx-4 border-t py-4 text-sm">
        Showing {rows.length} {rows.length === 1 ? 'recipient' : 'recipients'} billed to this account.
      </p>
    </section>
  )
}

/* --------------------------------- invoices -------------------------------- */

const periodFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** "Jul 1 – Jul 15, 2026"; the year on both ends when it changes. */
function formatServicePeriod(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T00:00:00Z`)
  return s.getUTCFullYear() === e.getUTCFullYear()
    ? `${periodFormat.format(s)} – ${formatDate(end)}`
    : `${formatDate(start)} – ${formatDate(end)}`
}

const statusFilterOptions: { value: StatementStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(statementStatusLabels) as StatementStatus[]).map((s) => ({
    value: s,
    label: statementStatusLabels[s],
  })),
]

function InvoicesTab({ accountId }: { accountId: string }) {
  const { data, isPending, isError, error, refetch } = useAccountInvoices(accountId)
  const [status, setStatus] = useState<StatementStatus | 'all'>('all')
  if (isPending) return <Loading label="Loading invoices…" />
  if (isError) return <ErrorCard message={error.message} onRetry={() => void refetch()} />

  const lines = data.map((l) => ({ ...l, display: invoiceStatusOf(l.status) }))
  const shown = status === 'all' ? lines : lines.filter((l) => l.display === status)

  return (
    <section aria-labelledby="invoices-heading" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 id="invoices-heading" className="text-ink text-base font-semibold tracking-tight">
          Invoices
        </h2>
        <SelectFilter
          quiet
          chip
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatementStatus | 'all')}
          options={statusFilterOptions}
        />
      </div>
      <div className="overflow-x-auto px-4 pb-2">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-sunken border-line text-ink-muted border-b text-xs">
            <tr>
              {['Reference', 'Service period', 'Amount', 'Due date', 'Paid amount', 'Status', 'Actions'].map(
                (c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      'px-3 py-2.5 font-semibold tracking-wide whitespace-nowrap uppercase',
                      c === 'Actions' && 'text-right',
                    )}
                  >
                    {c}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {shown.map((l) => (
              <tr key={l.id}>
                <td className="text-brand-700 px-3 py-3.5 font-semibold whitespace-nowrap">
                  <RefLink value={l.number} to={`/billing/invoices/${l.id}`} />
                </td>
                <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">
                  {formatServicePeriod(l.periodStart, l.periodEnd)}
                </td>
                <td className="text-ink px-3 py-3.5 font-semibold whitespace-nowrap tabular-nums">
                  {formatMoney(l.amount, l.currency)}
                </td>
                <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">
                  {l.dueDate ? formatDate(l.dueDate) : '—'}
                </td>
                <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap tabular-nums">
                  {formatMoney(l.paidAmount, l.currency)}
                </td>
                <td className="px-3 py-3.5">
                  <span className={cn(pill, tonePill[statementStatusTones[l.display]])}>
                    {statementStatusLabels[l.display]}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap">
                  <Link
                    to={`/billing/invoices/${l.id}`}
                    aria-label={`View ${l.number}`}
                    className="text-brand-700 hover:text-brand-800 font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="text-ink-muted px-3 py-10 text-center">
                  Nothing with this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* --------------------------------- payments -------------------------------- */

function PaymentsTab({ account }: { account: AccountDetailView }) {
  const { data, isPending, isError, error, refetch } = useAccountPayments(account.id)
  const [query, setQuery] = useState('')
  if (isPending) return <Loading label="Loading payments…" />
  if (isError) return <ErrorCard message={error.message} onRetry={() => void refetch()} />

  const needle = query.trim().toLowerCase()
  const shown: AccountPaymentView[] = needle
    ? data.filter(
        (p) =>
          p.reference.toLowerCase().includes(needle) ||
          (p.invoiceNumber ?? '').toLowerCase().includes(needle),
      )
    : data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-48">
          <span className="sr-only">Search payments</span>
          <Search
            aria-hidden="true"
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search payment ref or invoice..."
            className="border-control focus:border-brand-500 bg-surface h-11 w-full rounded-lg border pr-3 pl-9 text-sm"
          />
        </label>
      </div>

      <section aria-labelledby="payments-heading" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
          <h2 id="payments-heading" className="text-ink text-base font-semibold tracking-tight">
            Payment History
          </h2>
        </div>
        <div className="overflow-x-auto px-4 pb-2">
          {shown.length === 0 ? (
            <p className="text-ink-muted pb-4 text-sm">
              {data.length === 0 ? 'No payments recorded.' : 'No payments match this search.'}
            </p>
          ) : (
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-sunken border-line text-ink-muted border-b text-xs">
                <tr>
                  {['Payment ref', 'Pays for', 'Amount', 'Method', 'Date', 'Status'].map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-3 py-2.5 font-semibold tracking-wide whitespace-nowrap uppercase"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td className="text-ink px-3 py-3.5 font-semibold whitespace-nowrap">{p.reference}</td>
                    <td
                      className={cn(
                        'px-3 py-3.5 whitespace-nowrap',
                        p.invoiceNumber ? 'text-brand-700 font-medium' : 'text-ink-muted',
                      )}
                    >
                      {p.invoiceNumber ?? '—'}
                    </td>
                    <td className="text-ink px-3 py-3.5 font-semibold whitespace-nowrap tabular-nums">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                    <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">{p.method ?? '—'}</td>
                    <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">{formatDate(p.receivedAt)}</td>
                    <td className="px-3 py-3.5">
                      <span className={cn(pill, tonePill.green)}>Completed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {shown.length > 0 && (
          <p className="border-line text-ink-muted mx-4 border-t py-3 text-sm">
            Showing {shown.length} of {data.length} payments
          </p>
        )}
      </section>
    </div>
  )
}

/* --------------------------------- activity -------------------------------- */

function ActivityTab({ accountId }: { accountId: string }) {
  const { data, isPending, isError, error, refetch } = useAccountActivity(accountId)
  if (isPending) return <Loading label="Loading activity…" />
  if (isError) return <ErrorCard message={error.message} onRetry={() => void refetch()} />
  return (
    <Panel title="Account Billing & Care Activity" titleClassName="text-base">
      <Timeline events={data} />
    </Panel>
  )
}

/* -------------------------------- documents -------------------------------- */

function DocumentsTab({ accountId }: { accountId: string }) {
  const { data, isPending, isError, error, refetch } = useAccountDocuments(accountId)
  const { deleteDocument } = useAccountMutations(accountId)
  if (isPending) return <Loading label="Loading documents…" />
  if (isError) return <ErrorCard message={error.message} onRetry={() => void refetch()} />
  if (data.length === 0)
    return (
      <section className="card text-ink-muted p-6 text-center text-sm">
        No documents on file for this account.
      </section>
    )
  return (
    <ul aria-label="Documents" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {data.map((d) => (
        <li key={d.id} className="card p-4">
          <div className="flex items-start gap-3">
            <span className="bg-brand-50 text-brand-600 grid size-10 shrink-0 place-items-center rounded-lg">
              <FileText className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-ink font-semibold break-words">{d.title}</p>
              <p className="text-ink-subtle truncate text-xs" title={d.fileName}>
                {d.fileName}
              </p>
            </div>
          </div>
          <dl className="mt-4 flex justify-between gap-4 text-sm">
            <div>
              <dt className="text-ink-subtle text-xs">Uploaded</dt>
              <dd className="text-ink">{formatDate(d.uploadedAt)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-ink-subtle text-xs">Size</dt>
              <dd className="text-ink tabular-nums">{formatSize(d.sizeBytes)}</dd>
            </div>
          </dl>
          <div className="border-line mt-3 flex justify-end gap-4 border-t pt-3 text-sm">
            {d.downloadUrl ? (
              <a
                href={d.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 hover:text-brand-800 font-medium"
              >
                View
              </a>
            ) : (
              <span className="text-ink-subtle">View</span>
            )}
            <button
              type="button"
              onClick={() => deleteDocument.mutate(d.id)}
              disabled={deleteDocument.isPending}
              className="text-red-700 hover:text-red-800 font-medium disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
