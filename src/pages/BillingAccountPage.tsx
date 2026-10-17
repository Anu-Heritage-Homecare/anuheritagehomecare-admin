import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight, FileText, Search } from 'lucide-react'
import { useState } from 'react'
import { RecordPaymentDrawer } from '@/features/billing/RecordPaymentDrawer'
import { PaymentDetailsDrawer } from '@/features/billing/PaymentDetails'
import { downloadReceipt, paymentStatus } from '@/features/billing/payment-view'
import { useBook } from '@/features/billing/book'
import { InvoicePreviewDrawer } from '@/features/billing/InvoicePreview'
import { printInvoice } from '@/features/billing/invoice-document'
import { getInvoice } from '@/features/billing/ledger'
import { formatDate, formatMoney, planById } from '@/features/billing/data'
import { getAccount } from '@/features/billing/accounts'
import type { BillingAccount } from '@/features/billing/accounts'
import { accountDocuments, formatSize } from '@/features/billing/documents'
import { accountActivity } from '@/features/billing/account-activity'
import type { AccountEventKind, AccountEvent } from '@/features/billing/account-activity'
import type { TransactionStatus } from '@/features/billing/data'
import { recipients as directory } from '@/features/care-recipients/data'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import {
  accountPaymentHistory,
  accountStatement,
  accountStatusLabels,
  accountStatusTones,
  accountTotals,
  preferredMethod,
  statementStatusLabels,
  statementStatusTones,
  summariseAccount,
} from '@/features/billing/ledger'
import type {
  AccountPayment,
  StatementLine,
  StatementStatus,
} from '@/features/billing/ledger'
import { PAYMENT_TERMS_DAYS } from '@/features/billing/ledger'
import { Panel } from '@/components/ui/Panel'
import { DetailRows } from '@/components/ui/DetailList'
import { Avatar } from '@/components/ui/Avatar'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { RecipientStatusBadge } from '@/components/ui/StatusBadge'
import { TODAY } from '@/lib/today'
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

/** An invoice number links to its page; card charges and plans have none. */
function RefLink({ value }: { value: string }) {
  if (!value.startsWith('INV-')) return <>{value}</>
  return (
    <Link to={`/billing/invoices/${value}`} className="text-brand-700 hover:text-brand-800 hover:underline">
      {value}
    </Link>
  )
}

function StatusPill({ line }: { line: StatementLine }) {
  return (
    <span className={cn(pill, tonePill[statementStatusTones[line.status]])}>
      {statementStatusLabels[line.status]}
    </span>
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

/** Red for what went wrong, grey for the account's own history, brand for billing. */
const dotTone: Record<AccountEventKind, string> = {
  overdue: 'bg-red-500',
  failed: 'bg-red-500',
  payment: 'bg-brand-600',
  reminder: 'bg-amber-500',
  issued: 'bg-brand-600',
  document: 'bg-slate-400',
  recipient: 'bg-slate-400',
  opened: 'bg-slate-400',
}

function Timeline({ events }: { events: AccountEvent[] }) {
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
            className={cn('absolute top-1.5 left-0 size-[7px] rounded-full', dotTone[e.kind])}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-ink text-sm font-semibold">{e.title}</p>
            <time dateTime={e.at} className="text-ink-subtle text-xs whitespace-nowrap">
              {formatDate(e.at)}
            </time>
          </div>
          <p className="text-ink-muted mt-0.5 text-sm break-words">{e.detail}</p>
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
  useBook()
  const [paying, setPaying] = useState(false)
  const account = getAccount(accountId ?? '')
  if (!account) return <Navigate to="/billing/accounts" replace />

  const tab = tabs.find((t) => t.slug === tabParam)?.slug
  if (tabParam && !tab) return <Navigate to={`/billing/accounts/${account.id}`} replace />
  const active: TabSlug = tab ?? 'overview'

  const summary = summariseAccount(account)
  const statement = accountStatement(account)
  const totals = accountTotals(statement)
  const payments = accountPaymentHistory(account)
  const cardBilled = Boolean(account.subscription && !account.subscription.invoiceBilled)
  const lineNoun = cardBilled ? 'Charges' : 'Invoices'
  const base = `/billing/accounts/${account.id}`

  const details = [
    { label: 'Account ID', value: account.ref },
    ...(account.openedAt ? [{ label: 'Opened', value: formatDate(account.openedAt) }] : []),
    { label: 'Branch', value: account.branch },
    { label: 'Recipients', value: String(account.recipients) },
    {
      label: 'Payment terms',
      value: cardBilled
        ? `${account.subscription?.cycle} card renewal`
        : `Net ${PAYMENT_TERMS_DAYS}`,
    },
    { label: 'Preferred method', value: preferredMethod(payments) ?? 'Not recorded' },
  ]

  const tiles: { id: string; label: string; value: string; hint?: string; alert?: boolean }[] = [
    {
      id: 'outstanding',
      label: 'Outstanding balance',
      value: formatMoney(totals.outstanding),
      alert: totals.outstanding > 0,
    },
    {
      id: 'billed',
      label: 'Total billed',
      value: formatMoney(totals.billed),
      hint:
        [
          totals.clearing > 0 && `${formatMoney(totals.clearing)} still clearing`,
          totals.credited > 0 && `${formatMoney(totals.credited)} credited`,
          totals.writtenOff > 0 && `${formatMoney(totals.writtenOff)} written off`,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
    },
    { id: 'paid', label: 'Total paid', value: formatMoney(totals.paid) },
    {
      id: 'last',
      label: 'Last payment',
      value: summary.lastPaymentAt ? formatDate(summary.lastPaymentAt) : 'None',
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
            <span className={cn(pill, tonePill[accountStatusTones[summary.status]])}>
              {accountStatusLabels[summary.status]}
            </span>
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

        {/* No account form exists yet — Edit Account is a button only. */}
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/billing/invoices/new?account=${account.id}&from=${encodeURIComponent(base)}`}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            Create Invoice
          </Link>
          <button type="button" onClick={() => setPaying(true)} className={outlineButton}>Record Payment</button>
          <button type="button" className={outlineButton}>Edit Account</button>
        </div>
      </header>
      <RecordPaymentDrawer open={paying} onClose={() => setPaying(false)} accountId={account.id} />

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
              title={`Recent ${lineNoun}`}
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
              <StatementTable lines={statement.slice(0, 4)} compact />
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
                    {t.hint && <p className="text-ink-muted mt-0.5 text-xs">{t.hint}</p>}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Activity Timeline" titleClassName="text-base">
              <Timeline events={accountActivity(account, 5)} />
            </Panel>
          </div>
        </div>
      )}

      {active === 'recipients' && <RecipientsTab account={account} />}

      {active === 'invoices' && <InvoicesTab account={account} lines={statement} noun={lineNoun} />}

      {active === 'payments' && <PaymentsTab account={account} payments={payments} />}

      {active === 'documents' && <DocumentsTab accountId={account.id} />}

      {active === 'activity' && (
        <Panel title="Account Billing & Care Activity" titleClassName="text-base">
          <Timeline events={accountActivity(account)} />
        </Panel>
      )}
    </div>
  )
}

function StatementTable({ lines, compact }: { lines: StatementLine[]; compact?: boolean }) {
  if (lines.length === 0)
    return <p className="text-ink-muted px-4 pb-4 text-sm">Nothing billed yet.</p>
  return (
    <div className="overflow-x-auto px-4 pb-2">
      <table className={cn('w-full text-left text-sm', compact ? 'min-w-[26rem]' : 'min-w-[36rem]')}>
        <thead>
          <tr className="border-line border-b">
            <Th>Reference</Th>
            {!compact && <Th>Issued</Th>}
            <Th className="text-right">Amount</Th>
            <Th>Due date</Th>
            {!compact && <Th>Paid on</Th>}
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {lines.map((l) => (
            <tr key={l.ref}>
              <td className="text-ink py-3 pr-4 font-semibold whitespace-nowrap">
                <RefLink value={l.ref} />
                {l.kind === 'charge' && (
                  <span className="text-ink-subtle ml-1.5 text-xs font-normal">card</span>
                )}
              </td>
              {!compact && (
                <td className="text-ink-muted py-3 pr-4 whitespace-nowrap">
                  {formatDate(l.issuedAt)}
                </td>
              )}
              <td className="text-ink py-3 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                {formatMoney(l.amount)}
              </td>
              <td className="text-ink-muted py-3 pr-4 whitespace-nowrap">{formatDate(l.dueAt)}</td>
              {!compact && (
                <td className="text-ink-muted py-3 pr-4 whitespace-nowrap">
                  {l.paidAt ? formatDate(l.paidAt) : '—'}
                </td>
              )}
              <td className="py-3">
                <StatusPill line={l} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------ care recipients ----------------------------- */

/*
 * The payer's relationship turned round to read from the recipient's side,
 * which is how the column is drawn ("Father", "Self"). Only the unambiguous
 * ones; anything else says what the record says.
 */
function recipientSide(payerRelationship?: string): string {
  const word = payerRelationship?.split(/[\s/]/)[0].toLowerCase()
  switch (word) {
    case 'son':
    case 'daughter':
      return 'Parent'
    case 'daughter-in-law':
    case 'son-in-law':
      return 'Parent-in-law'
    case 'granddaughter':
    case 'grandson':
      return 'Grandparent'
    case 'spouse':
      return 'Spouse'
    default:
      return payerRelationship ? `Payer is ${payerRelationship.toLowerCase()}` : '—'
  }
}

interface RecipientRow {
  key: string
  name: string
  relationship: string
  plan: string
  monthly: number
  startedAt?: string
  status: ReactNode
  recipientId?: string
  subscriptionId?: string
}

function recipientRows(account: BillingAccount): RecipientRow[] {
  if (account.members) {
    return account.members.map((m) => ({
      key: m.name,
      name: m.name,
      relationship: m.relationship,
      plan: planById[m.planId].name,
      monthly: planById[m.planId].monthlyPrice,
      startedAt: m.startedAt,
      // Members carry no status of their own; they are billed while the
      // account is.
      status: <span className={cn(pill, tonePill.green)}>Active</span>,
    }))
  }
  const r = directory.find((d) => d.id === account.recipientId)
  const sub = account.subscription
  if (!r || !sub) return []
  const plan = planById[sub.planId]
  return [
    {
      key: r.id,
      name: r.name,
      relationship: recipientSide(account.contactRelationship),
      plan: plan.name,
      monthly: plan.monthlyPrice,
      startedAt: getRecipientProfile(r.id)?.summary.startDateIso || undefined,
      status: <RecipientStatusBadge status={r.status} />,
      recipientId: r.id,
      subscriptionId: sub.id,
    },
  ]
}

function RecipientsTab({ account }: { account: BillingAccount }) {
  const rows = recipientRows(account)
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
              <tr key={row.key}>
                <td className="py-3.5 pr-4">
                  <span className="flex items-center gap-3">
                    <Avatar name={row.name} decorative className="size-9" />
                    <span className="text-ink font-semibold">{row.name}</span>
                  </span>
                </td>
                <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">{row.relationship}</td>
                <td className="text-ink py-3.5 pr-4 font-medium whitespace-nowrap">{row.plan}</td>
                <td className="text-ink py-3.5 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                  {formatMoney(row.monthly)}/mo
                </td>
                <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">
                  {row.startedAt ? formatDate(row.startedAt) : 'Not recorded'}
                </td>
                <td className="py-3.5 pr-4">{row.status}</td>
                <td className="py-3.5 text-right whitespace-nowrap">
                  {/* Only directory recipients have a subscription and a
                      profile to open; the others have nowhere to go yet. */}
                  {row.subscriptionId && (
                    <Link
                      to={`/billing/subscriptions/${row.subscriptionId}`}
                      className="text-brand-700 hover:text-brand-800 font-medium"
                    >
                      Edit Plan
                    </Link>
                  )}
                  {row.recipientId && (
                    <Link
                      to={`/care-recipients/${row.recipientId}`}
                      className="text-brand-700 hover:text-brand-800 ml-4 font-medium"
                    >
                      Profile
                    </Link>
                  )}
                  {!row.recipientId && (
                    <span className="text-ink-subtle text-xs">Not in directory</span>
                  )}
                </td>
              </tr>
            ))}
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

function InvoicesTab({
  account,
  lines,
  noun,
}: {
  account: BillingAccount
  lines: StatementLine[]
  noun: string
}) {
  const [status, setStatus] = useState<StatementStatus | 'all'>('all')
  const [previewing, setPreviewing] = useState<string | null>(null)
  const shown = status === 'all' ? lines : lines.filter((l) => l.status === status)

  return (
    <section aria-labelledby="invoices-heading" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 id="invoices-heading" className="text-ink text-base font-semibold tracking-tight">
          {noun}
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
              <tr key={l.ref}>
                <td className="text-brand-700 px-3 py-3.5 font-semibold whitespace-nowrap">
                  <RefLink value={l.ref} />
                  {l.kind === 'charge' && (
                    <span className="text-ink-subtle ml-1.5 text-xs font-normal">card</span>
                  )}
                </td>
                <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">
                  {formatServicePeriod(l.periodStart, l.periodEnd)}
                </td>
                <td className="text-ink px-3 py-3.5 font-semibold whitespace-nowrap tabular-nums">
                  {formatMoney(l.amount)}
                </td>
                <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">{formatDate(l.dueAt)}</td>
                <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap tabular-nums">
                  {/* No part-payments in the book: settled in full or not yet. */}
                  {formatMoney(l.status === 'paid' ? l.amount : 0)}
                </td>
                <td className="px-3 py-3.5">
                  <StatusPill line={l} />
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap">
                  {/* A card renewal has no invoice document. */}
                  {l.kind === 'invoice' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewing(l.ref)}
                        aria-label={`Preview ${l.ref}`}
                        className="text-brand-700 hover:text-brand-800 font-medium"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const inv = getInvoice(l.ref)
                          if (inv) printInvoice(inv, account)
                        }}
                        aria-label={`Download ${l.ref} as PDF`}
                        className="text-ink hover:text-ink-muted ml-4 font-medium"
                      >
                        Download
                      </button>
                    </>
                  ) : (
                    <span className="text-ink-subtle text-xs">Card renewal</span>
                  )}
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
      <InvoicePreviewDrawer
        invoice={previewing ? getInvoice(previewing) : undefined}
        account={account}
        onClose={() => setPreviewing(null)}
      />
    </section>
  )
}

/* --------------------------------- payments -------------------------------- */


/** RFC 4180: quote a field when it holds a comma, quote or newline. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Builds the file in the browser from the rows on screen — nothing is fetched. */
function exportCsv(account: BillingAccount, rows: AccountPayment[]) {
  const header = ['Payment ref', 'Pays for', 'Amount (NGN)', 'Method', 'Date', 'Status']
  const lines = rows.map((p) =>
    [
      p.txId ?? '',
      p.reference,
      String(p.amount),
      p.method ?? '',
      p.at,
      paymentStatus[p.status].label,
    ].map(csvField),
  )
  const csv = [header, ...lines].map((l) => l.join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${account.ref}-payments.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type PayStatusFilter = 'all' | TransactionStatus
type DateWindow = 'all' | '7' | '30' | '90'
type AmountBand = 'all' | 'under-5k' | '5k-20k' | 'over-20k'

const dateOptions: { value: DateWindow; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

const amountOptions: { value: AmountBand; label: string }[] = [
  { value: 'all', label: 'Any amount' },
  { value: 'under-5k', label: 'Under ₦5,000' },
  { value: '5k-20k', label: '₦5,000 – ₦20,000' },
  { value: 'over-20k', label: 'Over ₦20,000' },
]

const inAmount: Record<AmountBand, (a: number) => boolean> = {
  all: () => true,
  'under-5k': (a) => a < 5_000,
  '5k-20k': (a) => a >= 5_000 && a <= 20_000,
  'over-20k': (a) => a > 20_000,
}

/** Payments made before the log began carry no method. */
const NO_METHOD = 'Not recorded'

/** Days from `iso` to the sample clock's today. */
function daysAgo(iso: string): number {
  return Math.round(
    (new Date(`${TODAY}T00:00:00Z`).getTime() - new Date(`${iso}T00:00:00Z`).getTime()) / 86_400_000,
  )
}

/* Tabs in the design's order. Refunded is not drawn: nothing in the log can be
   refunded, so it would be a permanent zero. */
const statusTabs: { id: PayStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'succeeded', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
]

function paymentKey(p: AccountPayment): string {
  return p.txId ?? `book-${p.reference}`
}

function PaymentsTab({
  account,
  payments,
}: {
  account: BillingAccount
  payments: AccountPayment[]
}) {
  const [status, setStatus] = useState<PayStatusFilter>('all')
  const [query, setQuery] = useState('')
  const [dates, setDates] = useState<DateWindow>('all')
  const [method, setMethod] = useState('all')
  const [amount, setAmount] = useState<AmountBand>('all')
  const [open, setOpen] = useState<string | null>(null)

  const methodOptions = [
    { value: 'all', label: 'All methods' },
    ...[...new Set(payments.map((p) => p.method ?? NO_METHOD))]
      .sort()
      .map((m) => ({ value: m, label: m })),
  ]

  // Everything but the status tab, so each tab counts what the rest left.
  const needle = query.trim().toLowerCase()
  const narrowed = payments.filter(
    (p) =>
      (!needle ||
        (p.txId ?? '').toLowerCase().includes(needle) ||
        p.reference.toLowerCase().includes(needle)) &&
      (dates === 'all' || daysAgo(p.at) <= Number(dates)) &&
      (method === 'all' || (p.method ?? NO_METHOD) === method) &&
      inAmount[amount](p.amount),
  )
  const count = (id: PayStatusFilter) =>
    id === 'all' ? narrowed.length : narrowed.filter((p) => p.status === id).length
  const shown = status === 'all' ? narrowed : narrowed.filter((p) => p.status === status)
  const filtering = status !== 'all' || needle || dates !== 'all' || method !== 'all' || amount !== 'all'
  const selected = payments.find((p) => paymentKey(p) === open)

  return (
    <div className="space-y-4">
      <nav aria-label="Payment status" className="border-line no-scrollbar flex gap-5 overflow-x-auto border-b">
        {statusTabs.map((t) => {
          const active = t.id === status
          return (
            <button
              key={t.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setStatus(t.id)}
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
                {count(t.id)}
              </span>
            </button>
          )
        })}
      </nav>

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
        <SelectFilter quiet label="Date Range" value={dates} onChange={(v) => setDates(v as DateWindow)} options={dateOptions} className="w-full min-[480px]:w-auto" />
        <SelectFilter quiet label="Method" value={method} onChange={setMethod} options={methodOptions} className="w-full min-[480px]:w-auto" />
        <SelectFilter quiet label="Amount Range" value={amount} onChange={(v) => setAmount(v as AmountBand)} options={amountOptions} className="w-full min-[480px]:w-auto" />
      </div>

      <section aria-labelledby="payments-heading" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
          <h2 id="payments-heading" className="text-ink text-base font-semibold tracking-tight">
            Payment History
          </h2>
          <button
            type="button"
            onClick={() => exportCsv(account, shown)}
            disabled={shown.length === 0}
            title={filtering ? 'Exports the rows currently shown' : undefined}
            className="border-control text-ink hover:bg-sunken inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-40"
          >
            {filtering ? 'Export filtered CSV' : 'Export CSV'}
          </button>
        </div>
        <div className="overflow-x-auto px-4 pb-2">
          {shown.length === 0 ? (
            <p className="text-ink-muted pb-4 text-sm">
              {payments.length === 0 ? 'No payments recorded.' : 'No payments match these filters.'}
            </p>
          ) : (
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="bg-sunken border-line text-ink-muted border-b text-xs">
                <tr>
                  {['Payment ref', 'Pays for', 'Amount', 'Method', 'Date', 'Status', 'Actions'].map((c) => (
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
                  ))}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {shown.map((p) => {
                  const st = paymentStatus[p.status]
                  return (
                    <tr key={paymentKey(p)}>
                      <td className="text-ink px-3 py-3.5 font-semibold whitespace-nowrap">
                        {p.txId ?? (
                          <span className="text-ink-subtle font-normal" title="Settled before the transaction log begins">
                            Before log
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-3.5 whitespace-nowrap',
                          p.reference.startsWith('INV-') ? 'text-brand-700 font-medium' : 'text-ink-muted',
                        )}
                      >
                        <RefLink value={p.reference} />
                      </td>
                      <td className="text-ink px-3 py-3.5 font-semibold whitespace-nowrap tabular-nums">
                        {formatMoney(p.amount)}
                      </td>
                      <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">{p.method ?? '—'}</td>
                      <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">{formatDate(p.at)}</td>
                      <td className="px-3 py-3.5">
                        <span className={cn(pill, tonePill[st.tone])}>{st.label}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setOpen(paymentKey(p))}
                          aria-label={`View ${p.txId ?? `payment for ${p.reference}`}`}
                          className="text-brand-700 hover:text-brand-800 font-medium"
                        >
                          View
                        </button>
                        {/* Only a settled payment has a receipt. */}
                        {p.status === 'succeeded' && (
                          <button
                            type="button"
                            onClick={() => downloadReceipt(p, account)}
                            className="text-brand-700 hover:text-brand-800 ml-4 font-medium"
                          >
                            Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {shown.length > 0 && (
          <p className="border-line text-ink-muted mx-4 border-t py-3 text-sm">
            Showing {shown.length} of {payments.length} payments
          </p>
        )}
      </section>

      <PaymentDetailsDrawer payment={selected} account={account} onClose={() => setOpen(null)} />
    </div>
  )
}

/* -------------------------------- documents -------------------------------- */

function DocumentsTab({ accountId }: { accountId: string }) {
  const docs = accountDocuments(accountId)
  if (docs.length === 0)
    return (
      <section className="card text-ink-muted p-6 text-center text-sm">
        No documents on file for this account.
      </section>
    )
  return (
    <ul aria-label="Documents" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {docs.map((d) => (
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
            {/* Metadata only — no file store behind the prototype. */}
            <button type="button" className="text-brand-700 hover:text-brand-800 font-medium">
              View
            </button>
            <button type="button" className="text-ink hover:text-ink-muted font-medium">
              Download
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
