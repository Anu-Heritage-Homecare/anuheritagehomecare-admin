import { useRef, useState } from 'react'
import { RecordPaymentDrawer } from '@/features/billing/RecordPaymentDrawer'
import { useBook } from '@/features/billing/book'
import { markSent } from '@/features/billing/create-invoice'
import { printInvoice } from '@/features/billing/invoice-document'
import { CancelInvoiceDialog } from '@/features/billing/CancelInvoiceDialog'
import { canCancel } from '@/features/billing/cancel-invoice'
import { DeleteDraftDialog } from '@/features/billing/DeleteDraftDialog'
import { deletedDraftAccount } from '@/features/billing/delete-draft'
import { SendReminderDialog } from '@/features/billing/SendReminderDialog'
import { canRemind } from '@/features/billing/reminders'
import { WriteOffDialog } from '@/features/billing/WriteOffDialog'
import { canWriteOff } from '@/features/billing/write-off'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Info,
  Plus,
  Upload,
} from 'lucide-react'
import { formatDate, formatMoney } from '@/features/billing/data'
import { getAccount } from '@/features/billing/accounts'
import type { BillingAccount } from '@/features/billing/accounts'
import {
  termsDays,
  accountPaymentHistory,
  balanceOf,
  billingActivity,
  getInvoice,
  invoiceBreakdown,
  isCancelled,
  isDraft,
  statementStatusLabels,
  statementStatusTones,
} from '@/features/billing/ledger'
import type {
  InvoiceBreakdown,
  LedgerInvoice,
  StatementStatus,
} from '@/features/billing/ledger'
import {
  addInvoiceNote,
  noteCategories,
  useInvoiceNotes,
} from '@/features/billing/invoice-notes'
import type { NoteCategory } from '@/features/billing/invoice-notes'
import {
  addAttachment,
  removeAttachment,
  useInvoiceAttachments,
} from '@/features/billing/invoice-attachments'
import { formatSize } from '@/features/billing/documents'
import { appliedAgainst } from '@/features/billing/adjustments'
import { recipients } from '@/features/care-recipients/data'
import { Panel } from '@/components/ui/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { TODAY } from '@/lib/today'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const tabs = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'services', label: 'Services' },
  { slug: 'payments', label: 'Payments' },
  { slug: 'history', label: 'History' },
  { slug: 'notes', label: 'Notes' },
  { slug: 'attachments', label: 'Attachments' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

const pill =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const outlineButton =
  'border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors'

const primaryButton =
  'bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors disabled:opacity-50'

const periodFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function servicePeriod(start: string, end: string): string {
  return `${periodFormat.format(new Date(`${start}T00:00:00Z`))} – ${formatDate(end)}`
}

interface Standing {
  paid: boolean
  status: StatementStatus
  amountPaid: number
  /** Applied credits and write-offs (adjustments.ts). */
  credited: number
  writtenOff: number
  /** Applied adjustments to the amount, signed. */
  added: number
  balance: number
  /** Share of the amount paid, credited or written off — the part settled. */
  paidPercent: number
}

function standingOf(invoice: LedgerInvoice): Standing {
  const paid = Boolean(invoice.paidAt && invoice.paidAt <= TODAY)
  const amountPaid = paid ? invoice.amount : 0
  const { credited, writtenOff, added } = paid
    ? { credited: 0, writtenOff: 0, added: 0 }
    : appliedAgainst(invoice.number)
  const balance = balanceOf(invoice)
  return {
    paid,
    status: paid
      ? 'paid'
      : isCancelled(invoice)
        ? 'cancelled'
        : isDraft(invoice)
          ? 'draft'
        : balance === 0
          ? 'closed'
          : invoice.dueAt < TODAY
            ? 'overdue'
            : 'due',
    amountPaid,
    credited,
    writtenOff,
    added,
    balance,
    // Voided, not settled: nothing was paid.
    paidPercent:
      isCancelled(invoice) || invoice.amount + added <= 0
        ? 0
        : Math.round(((invoice.amount + added - balance) / (invoice.amount + added)) * 100),
  }
}

export function InvoiceDetailsPage() {
  const { number, tab: tabParam } = useParams()
  useBook()
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [writingOff, setWritingOff] = useState(false)
  const navigate = useNavigate()
  const invoice = getInvoice(number ?? '')
  if (!invoice || invoice.issuedAt > TODAY) {
    const from = deletedDraftAccount(number ?? '')
    return <Navigate to={from ? `/billing/accounts/${from}/invoices` : '/billing/accounts'} replace />
  }

  const tab = tabs.find((t) => t.slug === tabParam)?.slug
  const base = `/billing/invoices/${invoice.number}`
  if (tabParam && !tab) return <Navigate to={base} replace />
  const active: TabSlug = tab ?? 'overview'

  const account = getAccount(invoice.accountId)
  const breakdown = invoiceBreakdown(invoice, account)
  const standing = standingOf(invoice)
  const accountLink = account ? `/billing/accounts/${account.id}` : '/billing/accounts'

  // Tabs that sit beside the summary, as the design draws them.
  const withSummary = active === 'history' || active === 'notes' || active === 'attachments'

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/billing" className="hover:text-ink">Billing</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          {/* There is no invoice list of its own; an invoice lives on its account. */}
          <li>
            <Link to={`${accountLink}/invoices`} className="hover:text-ink">
              {invoice.account}
            </Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li className="text-ink font-medium" aria-current="page">{invoice.number}</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-ink text-2xl font-bold tracking-tight">{invoice.number}</h1>
            <span className={cn(pill, tonePill[statementStatusTones[standing.status]])}>
              {statementStatusLabels[standing.status]}
            </span>
          </div>
          <p className="text-ink-muted mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
            <span>
              Account: <span className="text-ink font-medium">{invoice.account}</span>
            </span>
            <span aria-hidden="true">•</span>
            <span>
              Due: <span className="text-ink font-medium">{formatDate(invoice.dueAt)}</span>
            </span>
            <span aria-hidden="true">•</span>
            <span>
              Amount:{' '}
              <span className="text-brand-700 font-semibold tabular-nums">
                {formatMoney(invoice.amount)}
              </span>
            </span>
            {invoice.remindedAt && (
              <>
                <span aria-hidden="true">•</span>
                <span>
                  Last reminder: <span className="text-ink font-medium">{formatDate(invoice.remindedAt)}</span>
                </span>
              </>
            )}
          </p>
        </div>

        {/* Nothing is emailed: sending records that it went to the contact. */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              Boolean(invoice.sentAt) || Boolean(invoice.cancelled) || !account || account.email === 'Not recorded'
            }
            onClick={() => markSent(invoice.number)}
            className={primaryButton}
          >
            {invoice.sentAt ? 'Invoice Sent' : 'Send Invoice'}
          </button>
          <button type="button" onClick={() => printInvoice(invoice, account)} className={outlineButton}>
            Download PDF
          </button>
          {standing.balance > 0 && (
            <button type="button" onClick={() => setPaying(true)} className={outlineButton}>Record Payment</button>
          )}
          {canRemind(invoice) && (
            <button type="button" onClick={() => setReminding(true)} className={outlineButton}>
              Send Reminder
            </button>
          )}
          {canWriteOff(invoice) && (
            <button type="button" onClick={() => setWritingOff(true)} className={outlineButton}>
              Write Off
            </button>
          )}
          {/* A draft is deleted outright; anything else is cancelled and kept. */}
          {isDraft(invoice) ? (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className={cn(outlineButton, 'border-red-200 text-red-700 hover:bg-red-50')}
            >
              Delete Draft
            </button>
          ) : canCancel(invoice) && (
            <button
              type="button"
              onClick={() => setCancelling(true)}
              className={cn(outlineButton, 'border-red-200 text-red-700 hover:bg-red-50')}
            >
              Cancel Invoice
            </button>
          )}
        </div>
      </header>
      {invoice.cancelled && (
        <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <span className="font-semibold">
            Cancelled on {formatDate(invoice.cancelled.at)} by {invoice.cancelled.by} — {invoice.cancelled.reason}.
          </span>{' '}
          {invoice.cancelled.note ?? ''} Nothing is owed on this invoice.
        </p>
      )}
      <CancelInvoiceDialog invoice={invoice.number} open={cancelling} onClose={() => setCancelling(false)} />
      <WriteOffDialog
        invoice={invoice}
        account={invoice.account}
        open={writingOff}
        onClose={() => setWritingOff(false)}
      />
      <SendReminderDialog
        invoice={invoice}
        account={account}
        open={reminding}
        onClose={() => setReminding(false)}
      />
      <DeleteDraftDialog
        invoice={invoice.number}
        open={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate(`/billing/accounts/${invoice.accountId}/invoices`, { replace: true })}
      />
      <RecordPaymentDrawer open={paying} onClose={() => setPaying(false)} accountId={invoice.accountId} invoice={invoice.number} />

      <nav
        aria-label={`${invoice.number} sections`}
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
        <OverviewTab
          invoice={invoice}
          account={account}
          accountLink={accountLink}
          breakdown={breakdown}
          standing={standing}
        />
      )}

      {active === 'services' && <ServicesTab invoice={invoice} account={account} breakdown={breakdown} />}

      {active === 'payments' && <PaymentsTab invoice={invoice} account={account} standing={standing} />}

      {withSummary && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
            {active === 'history' && <HistoryTab invoice={invoice} />}
            {active === 'notes' && <NotesTab invoice={invoice.number} />}
            {active === 'attachments' && <AttachmentsTab invoice={invoice.number} />}
          </div>
          <PaymentSummary invoice={invoice} standing={standing} className="xl:col-span-2" />
        </div>
      )}
    </div>
  )
}

/* --------------------------------- shared ---------------------------------- */

function PaymentSummary({
  invoice,
  standing,
  className,
}: {
  invoice: LedgerInvoice
  standing: Standing
  className?: string
}) {
  return (
    <Panel title="Payment Summary" titleClassName="text-base" className={className}>
      <dl className="divide-line divide-y text-sm">
        <div className="flex items-baseline justify-between gap-4 pb-3">
          <dt className="text-ink-muted">Total amount</dt>
          <dd className="text-ink text-lg font-bold tabular-nums">{formatMoney(invoice.amount)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-ink-muted">Amount paid</dt>
          <dd className={cn('font-semibold tabular-nums', standing.paid ? 'text-emerald-700' : 'text-ink-muted')}>
            {formatMoney(standing.amountPaid)}
          </dd>
        </div>
        {standing.added !== 0 && (
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-ink-muted">Adjustments</dt>
            <dd className="text-ink font-semibold tabular-nums">
              {standing.added > 0 ? '+' : '−'}
              {formatMoney(Math.abs(standing.added))}
            </dd>
          </div>
        )}
        {standing.credited > 0 && (
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-ink-muted">Credits applied</dt>
            <dd className="font-semibold text-emerald-700 tabular-nums">−{formatMoney(standing.credited)}</dd>
          </div>
        )}
        {standing.writtenOff > 0 && (
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-ink-muted">Written off</dt>
            <dd className="text-ink-muted font-semibold tabular-nums">−{formatMoney(standing.writtenOff)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 pt-3">
          <dt className="text-ink font-semibold">Balance due</dt>
          <dd
            className={cn(
              'text-xl font-bold tabular-nums',
              standing.status === 'overdue' ? 'text-red-700' : 'text-brand-700',
            )}
          >
            {formatMoney(standing.balance)}
          </dd>
        </div>
      </dl>
      <div
        role="progressbar"
        aria-valuenow={standing.paidPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of invoice paid"
        className="bg-sunken mt-5 h-2 w-full overflow-hidden rounded-full"
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${standing.paidPercent}%` }} />
      </div>
      <p className="text-ink-muted mt-2 text-xs">
        {standing.paidPercent}% of invoice amount {standing.credited || standing.writtenOff ? 'settled' : 'paid'}
        {standing.paid && invoice.paidAt ? ` · settled ${formatDate(invoice.paidAt)}` : ''}
      </p>
    </Panel>
  )
}

/** Who the invoice is for: the directory recipient, or the account's members. */
function peopleOn(account: BillingAccount | undefined, invoice: LedgerInvoice) {
  const r = recipients.find((x) => x.id === account?.recipientId)
  if (r) return [{ name: r.name, caregiver: r.caregiver }]
  // An invoice raised in the app names who it is for; the fixtures bill the
  // whole account, and their caregivers are not recorded.
  if (invoice.breakdown) {
    const named = new Set(invoice.breakdown.lines.map((l) => l.recipient))
    return (account?.members ?? [])
      .filter((m) => named.has(m.name))
      .map((m) => ({ name: m.name, caregiver: m.caregiver.replace(/\s*\(.*\)$/, '') as string | null }))
  }
  return (account?.members ?? []).map((m) => ({ name: m.name, caregiver: null as string | null }))
}

/* -------------------------------- overview --------------------------------- */

function OverviewTab({
  invoice,
  account,
  accountLink,
  breakdown,
  standing,
}: {
  invoice: LedgerInvoice
  account: BillingAccount | undefined
  accountLink: string
  breakdown: InvoiceBreakdown
  standing: Standing
}) {
  const people = peopleOn(account, invoice)
  const details: { label: string; value: ReactNode }[] = [
    { label: 'Invoice date', value: formatDate(invoice.issuedAt) },
    { label: 'Due date', value: formatDate(invoice.dueAt) },
    { label: 'Payment terms', value: `Net ${termsDays(invoice)}` },
    {
      label: 'Billing account',
      value: (
        <Link to={accountLink} className="text-brand-700 hover:text-brand-800">
          {invoice.account}
        </Link>
      ),
    },
    {
      label: people.length > 1 ? 'Care recipients' : 'Care recipient',
      value:
        people.length === 0 ? (
          'Not recorded'
        ) : people.length === 1 ? (
          <span className="inline-flex items-center gap-2">
            <Avatar name={people[0].name} decorative className="size-6 text-[0.625rem]" />
            {people[0].name}
          </span>
        ) : (
          <Link to={`${accountLink}/recipients`} className="text-brand-700 hover:text-brand-800">
            {people.length} recipients
          </Link>
        ),
    },
    { label: 'Service period', value: servicePeriod(invoice.periodStart, invoice.periodEnd) },
  ]

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
        <Panel title="Invoice Details" titleClassName="text-base" className="xl:col-span-3">
          <dl className="divide-line divide-y text-sm">
            {details.map((d) => (
              <div
                key={d.label}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-3 first:pt-0 last:pb-0"
              >
                <dt className="text-ink-muted">{d.label}</dt>
                <dd className="text-ink min-w-0 text-right font-medium">{d.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <PaymentSummary invoice={invoice} standing={standing} className="xl:col-span-2" />
      </div>

      <Panel title="Line Items Summary" titleClassName="text-base" flush>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-line text-ink-muted border-b text-xs">
                <th scope="col" className="py-2 pr-4 font-semibold">Service description</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Units</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Rate</th>
                <th scope="col" className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {breakdown.lines.map((l, i) => (
                <tr key={i}>
                  <td className="text-ink py-3 pr-4 font-semibold">
                    {l.description}
                    {l.recipient && breakdown.lines.length > 1 && (
                      <span className="text-ink-muted font-normal"> — {l.recipient}</span>
                    )}
                  </td>
                  <td className="text-ink py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                    {l.units} {l.unitLabel}
                  </td>
                  <td className="text-ink-muted py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                    {formatMoney(l.rate)}
                  </td>
                  <td className="text-ink py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Totals breakdown={breakdown} />
        </div>
      </Panel>
    </>
  )
}

/** Subtotal, any insurer's share, and the total — under a line-item table. */
function Totals({ breakdown, lead }: { breakdown: InvoiceBreakdown; lead?: ReactNode }) {
  return (
    <div className="border-line flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t pt-3 text-sm">
      <div className="text-ink-muted">{lead}</div>
      <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-right">
        {breakdown.adjustments.length > 0 && (
          <>
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="text-ink tabular-nums">{formatMoney(breakdown.subtotal)}</dd>
            {breakdown.adjustments.map((a) =>
              a.amount < 0 ? (
                <FragmentRow key={a.label} label={`Less ${a.label}`} value={`−${formatMoney(Math.abs(a.amount))}`} />
              ) : (
                <FragmentRow key={a.label} label={a.label} value={formatMoney(a.amount)} tone="text-ink" />
              ),
            )}
          </>
        )}
        <dt className="text-ink self-center font-semibold">Total invoice amount</dt>
        <dd className="text-brand-700 text-lg font-bold tabular-nums">{formatMoney(breakdown.total)}</dd>
      </dl>
    </div>
  )
}

function FragmentRow({ label, value, tone = 'text-emerald-700' }: { label: string; value: string; tone?: string }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn(tone, 'tabular-nums')}>{value}</dd>
    </>
  )
}

/* -------------------------------- services --------------------------------- */

function ServicesTab({
  invoice,
  account,
  breakdown,
}: {
  invoice: LedgerInvoice
  account: BillingAccount | undefined
  breakdown: InvoiceBreakdown
}) {
  const people = peopleOn(account, invoice)
  const caregiverFor = (name?: string) =>
    people.find((p) => p.name === name)?.caregiver ?? (people.length === 1 ? people[0].caregiver : null)
  const visits = breakdown.lines.reduce((s, l) => s + l.units, 0)
  const period = servicePeriod(invoice.periodStart, invoice.periodEnd)

  return (
    <Panel
      title="Detailed Care Services"
      titleClassName="text-base"
      description={
        breakdown.lines.length > 1
          ? 'Visits are recorded per invoice; they are shared across recipients by plan allowance.'
          : undefined
      }
      badge={
        <span className={cn(pill, tonePill.blue)}>
          {breakdown.lines.length} {breakdown.lines.length === 1 ? 'line' : 'lines'} listed
        </span>
      }
      flush
    >
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[50rem] text-left text-sm">
          <thead>
            <tr className="border-line text-ink-muted border-b text-xs">
              <th scope="col" className="py-2 pr-4 font-semibold">Service</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Recipient</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Units</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Rate</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Amount</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Period</th>
              <th scope="col" className="py-2 font-semibold">Assigned caregiver</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {breakdown.lines.map((l, i) => {
              const recipient = l.recipient ?? (people.length === 1 ? people[0].name : undefined)
              const caregiver = caregiverFor(recipient)
              return (
                <tr key={i}>
                  <td className="text-ink py-3.5 pr-4 font-semibold">{l.description}</td>
                  <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">{recipient ?? '—'}</td>
                  <td className="text-ink py-3.5 pr-4 text-right whitespace-nowrap tabular-nums">
                    {l.units} {l.unitLabel}
                  </td>
                  <td className="text-ink-muted py-3.5 pr-4 text-right whitespace-nowrap tabular-nums">
                    {formatMoney(l.rate)}
                  </td>
                  <td className="text-ink py-3.5 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(l.amount)}
                  </td>
                  <td className="text-ink-muted py-3.5 pr-4 whitespace-nowrap">{period}</td>
                  <td className="py-3.5">
                    {/* The directory names one caregiver per recipient; the
                        other accounts' rotas are not in the app. */}
                    {caregiver ? (
                      <span className="text-ink inline-flex items-center gap-2 font-medium whitespace-nowrap">
                        <Avatar name={caregiver} decorative className="size-7 text-[0.625rem]" />
                        {caregiver}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">Not recorded</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Totals
          breakdown={breakdown}
          lead={
            <>
              Total listed: <span className="text-ink font-semibold">{visits} visits</span>
            </>
          }
        />
      </div>
    </Panel>
  )
}

/* -------------------------------- payments --------------------------------- */

function PaymentsTab({
  invoice,
  account,
  standing,
}: {
  invoice: LedgerInvoice
  account: BillingAccount | undefined
  standing: Standing
}) {
  const payments = account
    ? accountPaymentHistory(account).filter((p) => p.reference === invoice.number)
    : []

  return (
    <div className="space-y-4">
      {payments.length === 0 ? (
        <section className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="bg-brand-50 text-brand-600 grid size-16 place-items-center rounded-full">
            <CreditCard className="size-7" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <h2 className="text-ink mt-5 text-lg font-semibold">No payments recorded</h2>
          <p className="text-ink-muted mt-1 max-w-md text-sm">
            {standing.status === 'overdue'
              ? `Nothing has been received against this invoice, which fell due on ${formatDate(invoice.dueAt)}.`
              : 'Nothing has been received against this invoice yet.'}{' '}
            A bank transfer received outside the app can be recorded here.
          </p>
          {/* No payment form or online checkout exists yet — buttons only. */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" className={primaryButton}>Record Offline Payment</button>
            <button type="button" className={outlineButton}>Request Online Payment</button>
          </div>
        </section>
      ) : (
        <Panel title="Payments" titleClassName="text-base">
          <ul className="divide-line divide-y">
            {payments.map((p) => (
              <li
                key={p.txId ?? p.at}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-ink text-sm font-semibold">
                    {p.txId ?? 'Settled before the transaction log'}
                  </p>
                  <p className="text-ink-muted text-xs">
                    {formatDate(p.at)}
                    {p.method ? ` · ${p.method}` : ''}
                  </p>
                </div>
                <span className="text-ink text-sm font-semibold tabular-nums">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {standing.balance > 0 && (
        <aside className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-blue-700" strokeWidth={1.9} aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900">Payment terms</p>
            {/* Says only what the book does: net terms, overdue the next day,
                a reminder to the contact. No interest is charged anywhere. */}
            <p className="mt-0.5 text-blue-900/80">
              Due {termsDays(invoice)} days after issue. An unpaid invoice is marked overdue the day after its
              due date, and payment reminders go to the {invoice.account} primary contact.
            </p>
          </div>
        </aside>
      )}
    </div>
  )
}

/* --------------------------------- history --------------------------------- */

function HistoryTab({ invoice }: { invoice: LedgerInvoice }) {
  const events = billingActivity(Infinity, TODAY, invoice.accountId).filter(
    (e) => e.invoice === invoice.number,
  )
  return (
    <Panel title="Invoice Lifecycle & History" titleClassName="text-base">
      <ol>
        {events.map((e, i) => (
          <li key={e.id} className="grid grid-cols-[5.5rem_1.25rem_1fr] gap-x-3">
            <time dateTime={e.at} className="text-ink pt-0.5 text-right text-sm font-medium whitespace-nowrap">
              {formatDate(e.at)}
            </time>
            <div className="relative flex justify-center">
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-10 mt-1.5 size-2.5 rounded-full',
                  e.kind === 'overdue' || e.kind === 'failed'
                    ? 'bg-red-500'
                    : e.kind === 'payment'
                      ? 'bg-emerald-500'
                      : 'bg-brand-600',
                )}
              />
              {i < events.length - 1 && (
                <span aria-hidden="true" className="bg-line absolute top-3 bottom-0 w-px" />
              )}
            </div>
            <div className="pb-6">
              <p className="text-ink text-sm font-semibold">{e.title}</p>
              <p className="text-ink-muted text-xs">
                By <span className="text-ink font-medium">{e.actor}</span>
              </p>
              <p className="text-ink-subtle mt-0.5 text-sm">{e.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/* ---------------------------------- notes ---------------------------------- */

const noteStamp = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})

function NotesTab({ invoice }: { invoice: string }) {
  const notes = useInvoiceNotes(invoice)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<NoteCategory>('Follow-up')
  const [body, setBody] = useState('')

  const save = () => {
    if (!body.trim()) return
    addInvoiceNote(invoice, category, body)
    setBody('')
    setOpen(false)
  }

  return (
    <Panel
      title="Internal Notes & Communications"
      titleClassName="text-base"
      badge={
        !open && (
          <button type="button" onClick={() => setOpen(true)} className={cn(primaryButton, 'h-9')}>
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Add Note
          </button>
        )
      }
    >
      {open && (
        <form
          className="border-line bg-sunken mb-4 space-y-3 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <label className="block text-sm">
            <span className="text-ink-muted text-xs font-medium">Category</span>
            <SelectBox
              value={category}
              onChange={(e) => setCategory(e.target.value as NoteCategory)}
              className="border-control bg-surface mt-1 block h-10 w-full rounded-lg border px-3 text-sm sm:w-56"
            >
              {noteCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectBox>
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted text-xs font-medium">Note</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              autoFocus
              className="border-control bg-surface mt-1 block w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-ink-subtle text-xs">Kept for this session only.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className={cn(outlineButton, 'h-9')}>
                Cancel
              </button>
              <button type="submit" disabled={!body.trim()} className={cn(primaryButton, 'h-9')}>
                Save note
              </button>
            </div>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-ink-muted text-sm">No notes on this invoice.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-line bg-sunken/60 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="flex items-center gap-2.5">
                  <Avatar name={n.author} decorative className="size-8" />
                  <div>
                    <p className="text-ink text-sm font-semibold">{n.author}</p>
                    <p className="text-ink-subtle text-xs">{n.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(pill, n.category === 'Dispute' ? tonePill.red : tonePill.blue)}>
                    {n.category}
                  </span>
                  <time dateTime={n.at} className="text-ink-subtle text-xs">
                    {/* Fixtures are dated, not timed; don't print a fake midnight. */}
                    {n.at.endsWith('T00:00:00Z')
                      ? formatDate(n.at.slice(0, 10))
                      : noteStamp.format(new Date(n.at))}
                  </time>
                </div>
              </div>
              <p className="text-ink mt-3 text-sm whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* ------------------------------- attachments ------------------------------- */

function AttachmentsTab({ invoice }: { invoice: string }) {
  const files = useInvoiceAttachments(invoice)
  const input = useRef<HTMLInputElement>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <Panel
      title="Supporting Attachments"
      titleClassName="text-base"
      badge={
        <>
          <input
            ref={input}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              for (const f of Array.from(e.target.files ?? [])) addAttachment(invoice, f)
              e.target.value = ''
            }}
          />
          <button type="button" onClick={() => input.current?.click()} className={cn(outlineButton, 'h-9')}>
            <Upload className="size-4" strokeWidth={2} aria-hidden="true" />
            Upload File
          </button>
        </>
      }
    >
      {files.length === 0 ? (
        <p className="text-ink-muted text-sm">No files attached to this invoice.</p>
      ) : (
        <ul className="space-y-3">
          {files.map((f) => {
            const Icon = f.kind === 'Spreadsheet' || f.kind === 'Excel' ? FileSpreadsheet : FileText
            return (
              <li key={f.id} className="border-line bg-sunken/60 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="bg-brand-50 text-brand-600 grid size-10 shrink-0 place-items-center rounded-lg">
                      <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <p className="text-ink min-w-0 truncate text-sm font-semibold" title={f.fileName}>
                      {f.fileName}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-medium">
                    {f.url ? (
                      <>
                        <a href={f.url} download={f.fileName} className="text-brand-700 hover:text-brand-800">
                          Download
                        </a>
                        <a href={f.url} target="_blank" rel="noreferrer" className="text-ink hover:text-ink-muted">
                          View
                        </a>
                      </>
                    ) : (
                      // Listed from the fixtures; there is no stored file to open.
                      <span className="text-ink-subtle text-xs font-normal">File not stored in the prototype</span>
                    )}
                    {confirming === f.id ? (
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            removeAttachment(f.id)
                            setConfirming(null)
                          }}
                          className="text-red-700 hover:text-red-800"
                        >
                          Confirm delete
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="text-ink-muted">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirming(f.id)} className="text-red-700 hover:text-red-800">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-ink-subtle mt-2 text-xs">
                  {f.kind} • {formatSize(f.sizeBytes)} • Uploaded {formatDate(f.uploadedAt)} by {f.uploadedBy}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-ink-subtle mt-3 text-xs">Uploads are held in this browser for the session only.</p>
    </Panel>
  )
}
