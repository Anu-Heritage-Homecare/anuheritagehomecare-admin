/**
 * Invoice Details, rendered live from the backend
 * (`src/features/billing/useInvoiceDetail.ts`). The route param carries the
 * invoice id. Overview powers the header and the first tab; the other tabs fetch
 * on demand when active. Every mutation the screen exposes (send, approve, record
 * payment, add note, cancel, write off, delete draft, send reminder, delete
 * attachment) is wired to its live endpoint and invalidates the invoice queries.
 *
 * What differs from the old mock screen, and why: the off limits billing dialogs
 * (RecordPaymentDrawer, CancelInvoiceDialog, WriteOffDialog, SendReminderDialog,
 * DeleteDraftDialog) are bound to the client side ledger and take no backend
 * path, so they are replaced here by small page owned forms that call the live
 * mutations. Attachment upload needs object storage that is not wired, so the
 * upload button is inert; attachment delete is live. Money is formatted in the
 * invoice's own currency, no symbol hardcoded.
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Info,
  Loader2,
  Plus,
  Upload,
} from 'lucide-react'
import {
  fetchReminderPreview,
  formatCurrency,
  useAddInvoiceNote,
  useApproveInvoice,
  useCancelInvoice,
  useDeleteAttachment,
  useDeleteDraftInvoice,
  useInvoiceAttachments,
  useInvoiceDetail,
  useInvoiceHistory,
  useInvoiceNotes,
  useInvoicePayments,
  useInvoiceServices,
  useRecordInvoicePayment,
  useSendInvoice,
  useSendReminder,
  useWriteOffInvoice,
} from '@/features/billing/useInvoiceDetail'
import type {
  InvoiceAttachmentsDto,
  InvoiceDetailDto,
  InvoiceHistoryDto,
  InvoiceNotesDto,
  InvoicePaymentsDto,
  InvoiceReminderPreviewDto,
  InvoiceServicesDto,
} from '@/features/billing/useInvoiceDetail'
import { Panel } from '@/components/ui/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { formatSize } from '@/features/billing/documents'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types'
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
  'border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50'
const primaryButton =
  'bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors disabled:opacity-50'
const DASH = '—'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  AWAITING_PAYMENT: 'Awaiting payment',
  PARTIALLY_PAID: 'Partially paid',
  OVERDUE: 'Overdue',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  WRITTEN_OFF: 'Written off',
}

const STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'slate',
  AWAITING_PAYMENT: 'blue',
  PARTIALLY_PAID: 'amber',
  OVERDUE: 'red',
  PAID: 'green',
  CANCELLED: 'slate',
  WRITTEN_OFF: 'slate',
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(iso: string | null): string {
  if (!iso) return DASH
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso)
  return Number.isNaN(date.getTime()) ? DASH : dateFormat.format(date)
}

export function InvoiceDetailsPage() {
  const { number: id, tab: tabParam } = useParams()
  const navigate = useNavigate()
  const { data: invoice, isPending, isError, error, refetch } = useInvoiceDetail(id)
  const active: TabSlug = tabs.find((t) => t.slug === tabParam)?.slug ?? 'overview'

  if (isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading invoice…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load this invoice.</p>
        <p className="text-ink-subtle text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  return <InvoiceDetail id={id ?? ''} invoice={invoice} active={active} onDeleted={() => navigate('/billing/invoices', { replace: true })} />
}

function InvoiceDetail({
  id,
  invoice,
  active,
  onDeleted,
}: {
  id: string
  invoice: InvoiceDetailDto
  active: TabSlug
  onDeleted: () => void
}) {
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [writingOff, setWritingOff] = useState(false)
  const [reminding, setReminding] = useState(false)

  const send = useSendInvoice(id)
  const approve = useApproveInvoice(id)
  const deleteDraft = useDeleteDraftInvoice(id)

  const isDraft = invoice.status === 'DRAFT'
  const isClosed = invoice.status === 'CANCELLED' || invoice.status === 'WRITTEN_OFF'
  const base = `/billing/invoices/${id}`
  const money = (minor: number) => formatCurrency(minor, invoice.currency)
  const accountName = invoice.billingAccountName ?? invoice.careRecipientName
  const accountLink = invoice.billingAccountId
    ? `/billing/accounts/${invoice.billingAccountId}`
    : '/billing/accounts'

  const withSummary = active === 'history' || active === 'notes' || active === 'attachments'

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/billing" className="hover:text-ink">Billing</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li>
            <Link to="/billing/invoices" className="hover:text-ink">Invoices</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li className="text-ink font-medium" aria-current="page">{invoice.number}</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-ink text-2xl font-bold tracking-tight">{invoice.number}</h1>
            <span className={cn(pill, tonePill[STATUS_TONES[invoice.status] ?? 'slate'])}>
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
          </div>
          <p className="text-ink-muted mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
            <span>
              Account: <span className="text-ink font-medium">{accountName}</span>
            </span>
            <span aria-hidden="true">•</span>
            <span>
              Due: <span className="text-ink font-medium">{formatDate(invoice.dueDate)}</span>
            </span>
            <span aria-hidden="true">•</span>
            <span>
              Amount:{' '}
              <span className="text-brand-700 font-semibold tabular-nums">{money(invoice.totalAmountMinor)}</span>
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <button type="button" disabled={approve.isPending} onClick={() => approve.mutate(undefined)} className={outlineButton}>
              Approve
            </button>
          )}
          <button type="button" disabled={send.isPending || isClosed} onClick={() => send.mutate(undefined)} className={primaryButton}>
            Send Invoice
          </button>
          {invoice.balanceDueMinor > 0 && !isClosed && (
            <button type="button" onClick={() => setPaying(true)} className={outlineButton}>Record Payment</button>
          )}
          {invoice.status === 'OVERDUE' && (
            <button type="button" onClick={() => setReminding(true)} className={outlineButton}>Send Reminder</button>
          )}
          {!isDraft && !isClosed && (
            <button type="button" onClick={() => setWritingOff(true)} className={outlineButton}>Write Off</button>
          )}
          {isDraft ? (
            <button
              type="button"
              disabled={deleteDraft.isPending}
              onClick={() => deleteDraft.mutate(undefined, { onSuccess: onDeleted })}
              className={cn(outlineButton, 'border-red-200 text-red-700 hover:bg-red-50')}
            >
              Delete Draft
            </button>
          ) : (
            !isClosed && (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className={cn(outlineButton, 'border-red-200 text-red-700 hover:bg-red-50')}
              >
                Cancel Invoice
              </button>
            )
          )}
        </div>
      </header>

      <RecordPaymentForm id={id} invoice={invoice} open={paying} onClose={() => setPaying(false)} />
      <CancelInvoiceForm id={id} open={cancelling} onClose={() => setCancelling(false)} />
      <WriteOffForm id={id} open={writingOff} onClose={() => setWritingOff(false)} />
      <ReminderForm id={id} currency={invoice.currency} open={reminding} onClose={() => setReminding(false)} />

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

      {active === 'overview' && <OverviewTab invoice={invoice} accountLink={accountLink} money={money} />}
      {active === 'services' && <ServicesTab id={id} />}
      {active === 'payments' && <PaymentsTab id={id} currency={invoice.currency} balance={invoice.balanceDueMinor} />}

      {withSummary && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
            {active === 'history' && <HistoryTab id={id} />}
            {active === 'notes' && <NotesTab id={id} />}
            {active === 'attachments' && <AttachmentsTab id={id} />}
          </div>
          <PaymentSummary invoice={invoice} money={money} className="xl:col-span-2" />
        </div>
      )}
    </div>
  )
}

/* --------------------------------- shared ---------------------------------- */

function PaymentSummary({
  invoice,
  money,
  className,
}: {
  invoice: InvoiceDetailDto
  money: (minor: number) => string
  className?: string
}) {
  const overdue = invoice.status === 'OVERDUE'
  return (
    <Panel title="Payment Summary" titleClassName="text-base" className={className}>
      <dl className="divide-line divide-y text-sm">
        <div className="flex items-baseline justify-between gap-4 pb-3">
          <dt className="text-ink-muted">Total amount</dt>
          <dd className="text-ink text-lg font-bold tabular-nums">{money(invoice.totalAmountMinor)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-ink-muted">Amount paid</dt>
          <dd className={cn('font-semibold tabular-nums', invoice.amountPaidMinor > 0 ? 'text-emerald-700' : 'text-ink-muted')}>
            {money(invoice.amountPaidMinor)}
          </dd>
        </div>
        {invoice.insuranceCoveredMinor > 0 && (
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-ink-muted">Insurance covered</dt>
            <dd className="text-ink font-semibold tabular-nums">{money(invoice.insuranceCoveredMinor)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 pt-3">
          <dt className="text-ink font-semibold">Balance due</dt>
          <dd className={cn('text-xl font-bold tabular-nums', overdue ? 'text-red-700' : 'text-brand-700')}>
            {money(invoice.balanceDueMinor)}
          </dd>
        </div>
      </dl>
      <div
        role="progressbar"
        aria-valuenow={invoice.percentPaid}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of invoice paid"
        className="bg-sunken mt-5 h-2 w-full overflow-hidden rounded-full"
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${invoice.percentPaid}%` }} />
      </div>
      <p className="text-ink-muted mt-2 text-xs">{invoice.percentPaid}% of invoice amount paid</p>
    </Panel>
  )
}

/* -------------------------------- overview --------------------------------- */

function OverviewTab({
  invoice,
  accountLink,
  money,
}: {
  invoice: InvoiceDetailDto
  accountLink: string
  money: (minor: number) => string
}) {
  const details: { label: string; value: React.ReactNode }[] = [
    { label: 'Invoice date', value: formatDate(invoice.invoiceDate) },
    { label: 'Due date', value: formatDate(invoice.dueDate) },
    { label: 'Payment terms', value: invoice.paymentTerms ?? DASH },
    {
      label: 'Billing account',
      value: invoice.billingAccountName ? (
        <Link to={accountLink} className="text-brand-700 hover:text-brand-800">
          {invoice.billingAccountName}
        </Link>
      ) : (
        DASH
      ),
    },
    {
      label: 'Care recipient',
      value: (
        <span className="inline-flex items-center gap-2">
          <Avatar name={invoice.careRecipientName} decorative className="size-6 text-[0.625rem]" />
          {invoice.careRecipientName}
        </span>
      ),
    },
    {
      label: 'Service period',
      value: `${formatDate(invoice.servicePeriodStart)} – ${formatDate(invoice.servicePeriodEnd)}`,
    },
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
        <PaymentSummary invoice={invoice} money={money} className="xl:col-span-2" />
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
              {invoice.lineItems.map((l, i) => (
                <tr key={i}>
                  <td className="text-ink py-3 pr-4 font-semibold">{l.serviceName}</td>
                  <td className="text-ink py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                    {l.quantity ?? DASH} {l.unit ?? ''}
                  </td>
                  <td className="text-ink-muted py-3 pr-4 text-right whitespace-nowrap tabular-nums">
                    {l.rateMinor === null ? DASH : money(l.rateMinor)}
                  </td>
                  <td className="text-ink py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                    {money(l.amountMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="border-line ml-auto mt-3 grid w-full max-w-xs grid-cols-[auto_auto] gap-x-6 gap-y-1 border-t pt-3 text-right text-sm">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="text-ink tabular-nums">{money(invoice.subtotalMinor)}</dd>
            {invoice.discountTotalMinor > 0 && (
              <>
                <dt className="text-ink-muted">Discounts</dt>
                <dd className="tabular-nums text-emerald-700">−{money(invoice.discountTotalMinor)}</dd>
              </>
            )}
            <dt className="text-ink-muted">VAT ({invoice.taxRatePercent}%)</dt>
            <dd className="text-ink tabular-nums">{money(invoice.taxMinor)}</dd>
            <dt className="text-ink self-center font-semibold">Total invoice amount</dt>
            <dd className="text-brand-700 text-lg font-bold tabular-nums">{money(invoice.totalAmountMinor)}</dd>
          </dl>
        </div>
      </Panel>
    </>
  )
}

/* -------------------------------- services --------------------------------- */

function TabState({
  isPending,
  isError,
  error,
  refetch,
  children,
}: {
  isPending: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  children: React.ReactNode
}) {
  if (isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-ink text-sm font-medium">Could not load this tab.</p>
        <p className="text-ink-subtle text-sm">{error?.message}</p>
        <button type="button" onClick={refetch} className={primaryButton}>Try again</button>
      </div>
    )
  }
  return <>{children}</>
}

function ServicesTab({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useInvoiceServices(id, true)
  return (
    <TabState isPending={isPending} isError={isError} error={error} refetch={() => void refetch()}>
      {data && <ServicesTable data={data} />}
    </TabState>
  )
}

function ServicesTable({ data }: { data: InvoiceServicesDto }) {
  const money = (minor: number) => formatCurrency(minor, data.currency)
  return (
    <Panel
      title="Detailed Care Services"
      titleClassName="text-base"
      badge={<span className={cn(pill, tonePill.blue)}>{data.distinctCount} listed</span>}
      flush
    >
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-line text-ink-muted border-b text-xs">
              <th scope="col" className="py-2 pr-4 font-semibold">Service</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Units</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Rate</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Amount</th>
              <th scope="col" className="py-2 font-semibold">Assigned caregiver</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {data.services.map((s, i) => (
              <tr key={i}>
                <td className="text-ink py-3.5 pr-4 font-semibold">
                  {s.serviceName}
                  {s.category && <span className="text-ink-muted font-normal"> — {s.category}</span>}
                </td>
                <td className="text-ink py-3.5 pr-4 text-right whitespace-nowrap tabular-nums">
                  {s.hoursUnits ?? DASH} {s.unit ?? ''}
                </td>
                <td className="text-ink-muted py-3.5 pr-4 text-right whitespace-nowrap tabular-nums">
                  {s.rateMinor === null ? DASH : money(s.rateMinor)}
                </td>
                <td className="text-ink py-3.5 pr-4 text-right font-semibold whitespace-nowrap tabular-nums">
                  {money(s.amountMinor)}
                </td>
                <td className="py-3.5">
                  {s.assignedCaregiver ? (
                    <span className="text-ink inline-flex items-center gap-2 font-medium whitespace-nowrap">
                      <Avatar name={s.assignedCaregiver} decorative className="size-7 text-[0.625rem]" />
                      {s.assignedCaregiver}
                    </span>
                  ) : (
                    <span className="text-ink-subtle">{DASH}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/* -------------------------------- payments --------------------------------- */

function PaymentsTab({ id, currency, balance }: { id: string; currency: string; balance: number }) {
  const { data, isPending, isError, error, refetch } = useInvoicePayments(id, true)
  const money = (minor: number) => formatCurrency(minor, currency)
  return (
    <TabState isPending={isPending} isError={isError} error={error} refetch={() => void refetch()}>
      {data && <PaymentsList data={data} money={money} balance={balance} />}
    </TabState>
  )
}

function PaymentsList({
  data,
  money,
  balance,
}: {
  data: InvoicePaymentsDto
  money: (minor: number) => string
  balance: number
}) {
  return (
    <div className="space-y-4">
      {data.payments.length === 0 ? (
        <section className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="bg-brand-50 text-brand-600 grid size-16 place-items-center rounded-full">
            <CreditCard className="size-7" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <h2 className="text-ink mt-5 text-lg font-semibold">No payments recorded</h2>
          <p className="text-ink-muted mt-1 max-w-md text-sm">
            Nothing has been received against this invoice yet.
          </p>
        </section>
      ) : (
        <Panel title="Payments" titleClassName="text-base">
          <ul className="divide-line divide-y">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-ink text-sm font-semibold">{p.reference}</p>
                  <p className="text-ink-muted text-xs">
                    {formatDate(p.receivedAt)}
                    {p.method ? ` · ${p.method}` : ''}
                  </p>
                </div>
                <span className="text-ink text-sm font-semibold tabular-nums">{money(p.amountMinor)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {balance > 0 && (
        <aside className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-blue-700" strokeWidth={1.9} aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900">Outstanding balance</p>
            <p className="mt-0.5 text-blue-900/80">
              {money(balance)} is still owed on this invoice. Record a payment from the header to settle it.
            </p>
          </div>
        </aside>
      )}
    </div>
  )
}

/* --------------------------------- history --------------------------------- */

function HistoryTab({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useInvoiceHistory(id, true)
  return (
    <TabState isPending={isPending} isError={isError} error={error} refetch={() => void refetch()}>
      {data && <HistoryList data={data} />}
    </TabState>
  )
}

function HistoryList({ data }: { data: InvoiceHistoryDto }) {
  return (
    <Panel title="Invoice Lifecycle & History" titleClassName="text-base">
      {data.events.length === 0 ? (
        <p className="text-ink-muted text-sm">No history recorded yet.</p>
      ) : (
        <ol>
          {data.events.map((e, i) => (
            <li key={i} className="grid grid-cols-[6.5rem_1.25rem_1fr] gap-x-3">
              <time className="text-ink pt-0.5 text-right text-sm font-medium whitespace-nowrap">
                {formatDate(e.at)}
              </time>
              <div className="relative flex justify-center">
                <span aria-hidden="true" className="bg-brand-600 relative z-10 mt-1.5 size-2.5 rounded-full" />
                {i < data.events.length - 1 && (
                  <span aria-hidden="true" className="bg-line absolute top-3 bottom-0 w-px" />
                )}
              </div>
              <div className="pb-6">
                <p className="text-ink text-sm font-semibold">{e.title}</p>
                {e.performedBy && (
                  <p className="text-ink-muted text-xs">
                    By <span className="text-ink font-medium">{e.performedBy}</span>
                  </p>
                )}
                {e.detail && <p className="text-ink-subtle mt-0.5 text-sm">{e.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

/* ---------------------------------- notes ---------------------------------- */

const noteCategories = ['FOLLOW_UP', 'DISPUTE', 'GENERAL', 'PAYMENT'] as const
type NoteCategory = (typeof noteCategories)[number]

function categoryLabel(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function NotesTab({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useInvoiceNotes(id, true)
  return (
    <TabState isPending={isPending} isError={isError} error={error} refetch={() => void refetch()}>
      {data && <NotesList id={id} data={data} />}
    </TabState>
  )
}

function NotesList({ id, data }: { id: string; data: InvoiceNotesDto }) {
  const add = useAddInvoiceNote(id)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<NoteCategory>('FOLLOW_UP')
  const [body, setBody] = useState('')

  const save = () => {
    if (!body.trim()) return
    add.mutate(
      { category, body: body.trim() },
      {
        onSuccess: () => {
          setBody('')
          setOpen(false)
        },
      },
    )
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
                <option key={c} value={c}>{categoryLabel(c)}</option>
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
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={cn(outlineButton, 'h-9')}>Cancel</button>
            <button type="submit" disabled={!body.trim() || add.isPending} className={cn(primaryButton, 'h-9')}>
              Save note
            </button>
          </div>
        </form>
      )}

      {data.notes.length === 0 ? (
        <p className="text-ink-muted text-sm">No notes on this invoice.</p>
      ) : (
        <ul className="space-y-3">
          {data.notes.map((n) => (
            <li key={n.id} className="border-line bg-sunken/60 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="flex items-center gap-2.5">
                  <Avatar name={n.authorName} decorative className="size-8" />
                  <div>
                    <p className="text-ink text-sm font-semibold">{n.authorName}</p>
                    <p className="text-ink-subtle text-xs">{categoryLabel(n.authorRole)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(pill, n.category === 'DISPUTE' ? tonePill.red : tonePill.blue)}>
                    {categoryLabel(n.category)}
                  </span>
                  <time className="text-ink-subtle text-xs">{formatDate(n.createdAt)}</time>
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

function AttachmentsTab({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useInvoiceAttachments(id, true)
  return (
    <TabState isPending={isPending} isError={isError} error={error} refetch={() => void refetch()}>
      {data && <AttachmentsList id={id} data={data} />}
    </TabState>
  )
}

function AttachmentsList({ id, data }: { id: string; data: InvoiceAttachmentsDto }) {
  const remove = useDeleteAttachment(id)
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <Panel
      title="Supporting Attachments"
      titleClassName="text-base"
      badge={
        // Upload needs object storage that is not wired yet, so this is inert.
        <button type="button" disabled aria-disabled className={cn(outlineButton, 'h-9')} title="Upload is not available yet">
          <Upload className="size-4" strokeWidth={2} aria-hidden="true" />
          Upload File
        </button>
      }
    >
      {data.attachments.length === 0 ? (
        <p className="text-ink-muted text-sm">No files attached to this invoice.</p>
      ) : (
        <ul className="space-y-3">
          {data.attachments.map((f) => (
            <li key={f.id} className="border-line bg-sunken/60 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-brand-50 text-brand-600 grid size-10 shrink-0 place-items-center rounded-lg">
                    <FileText className="size-5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <p className="text-ink min-w-0 truncate text-sm font-semibold" title={f.fileName}>{f.title}</p>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                  <a href={f.downloadUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
                    <Download className="size-4" strokeWidth={2} aria-hidden="true" />
                    Download
                  </a>
                  {confirming === f.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(f.id, { onSuccess: () => setConfirming(null) })}
                        className="text-red-700 hover:text-red-800"
                      >
                        Confirm delete
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="text-ink-muted">Keep</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirming(f.id)} className="text-red-700 hover:text-red-800">Delete</button>
                  )}
                </div>
              </div>
              <p className="text-ink-subtle mt-2 text-xs">
                {f.fileName} • {formatSize(f.sizeBytes)} • Uploaded {formatDate(f.uploadedAt)}
                {f.uploadedBy ? ` by ${f.uploadedBy}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------- mutations -------------------------------- */

const fieldClass = 'border-control focus:border-brand-500 bg-surface mt-1.5 h-11 w-full rounded-lg border px-3 text-sm'
const labelClass = 'text-ink text-sm font-medium'

function FormActions({ onCancel, disabled, label }: { onCancel: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className={outlineButton}>Cancel</button>
      <button type="submit" disabled={disabled} className={primaryButton}>{label}</button>
    </div>
  )
}

function RecordPaymentForm({
  id,
  invoice,
  open,
  onClose,
}: {
  id: string
  invoice: InvoiceDetailDto
  open: boolean
  onClose: () => void
}) {
  const record = useRecordInvoicePayment(id)
  // The backend takes a free amount; the UI defaults to the full balance (whole
  // units in the invoice currency), converted back to minor on submit.
  const [amount, setAmount] = useState(String(invoice.balanceDueMinor / 100))
  const [method, setMethod] = useState('Bank Transfer')
  const [reference, setReference] = useState('')
  const amountMinor = Math.round(Number(amount) * 100)
  const valid = Number.isFinite(amountMinor) && amountMinor > 0 && amountMinor <= invoice.balanceDueMinor

  return (
    <Drawer open={open} onClose={onClose} title="Record Payment">
      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          record.mutate(
            { amountMinor, methodLabel: method, referenceNumber: reference.trim() || undefined },
            { onSuccess: onClose },
          )
        }}
      >
        <label className="block">
          <span className={labelClass}>Amount ({invoice.currency})</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!valid}
            className={cn(fieldClass, !valid && 'border-red-500', 'tabular-nums')}
          />
          <span className={cn('mt-1 block text-xs', valid ? 'text-ink-subtle' : 'text-red-700')}>
            Up to the balance of {formatCurrency(invoice.balanceDueMinor, invoice.currency)}.
          </span>
        </label>
        <label className="block">
          <span className={labelClass}>Payment Method</span>
          <SelectBox value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
            <option>Bank Transfer</option>
            <option>Card Payment</option>
            <option>Cash</option>
            <option>Mobile Money</option>
          </SelectBox>
        </label>
        <label className="block">
          <span className={labelClass}>Reference Number</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="e.g. TXN-1092309" className={fieldClass} />
        </label>
        <FormActions onCancel={onClose} disabled={!valid || record.isPending} label="Record Payment" />
      </form>
    </Drawer>
  )
}

function CancelInvoiceForm({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const cancel = useCancelInvoice(id)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const valid = reason.trim().length > 0

  return (
    <Drawer open={open} onClose={onClose} title="Cancel invoice" placement="center">
      <form
        className="space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          cancel.mutate({ reason: reason.trim(), notes: notes.trim() || undefined }, { onSuccess: onClose })
        }}
      >
        <label className="block">
          <span className={labelClass}>Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="e.g. Billing error" className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Notes (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={360} className="border-control bg-surface mt-1.5 w-full rounded-lg border p-3 text-sm" />
        </label>
        <FormActions onCancel={onClose} disabled={!valid || cancel.isPending} label="Cancel invoice" />
      </form>
    </Drawer>
  )
}

function WriteOffForm({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const writeOff = useWriteOffInvoice(id)
  const [reason, setReason] = useState('')
  const [justification, setJustification] = useState('')
  const valid = reason.trim().length > 0 && justification.trim().length > 0

  return (
    <Drawer open={open} onClose={onClose} title="Write off invoice" placement="center">
      <form
        className="space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          writeOff.mutate({ reason: reason.trim(), justification: justification.trim() }, { onSuccess: onClose })
        }}
      >
        <label className="block">
          <span className={labelClass}>Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="e.g. Uncollectable debt" className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Justification</span>
          <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} maxLength={360} className="border-control bg-surface mt-1.5 w-full rounded-lg border p-3 text-sm" />
          <span className="text-ink-subtle mt-1 block text-xs">Recorded on the audit ledger.</span>
        </label>
        <FormActions onCancel={onClose} disabled={!valid || writeOff.isPending} label="Write off" />
      </form>
    </Drawer>
  )
}

function ReminderForm({ id, currency, open, onClose }: { id: string; currency: string; open: boolean; onClose: () => void }) {
  const send = useSendReminder(id)
  const [preview, setPreview] = useState<InvoiceReminderPreviewDto | null>(null)
  const [channels, setChannels] = useState<string[]>(['EMAIL'])

  // Fetch the preview the first time the dialog opens.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (open && loadedFor !== id) {
    setLoadedFor(id)
    void fetchReminderPreview(id).then(setPreview).catch(() => setPreview(null))
  }

  const toggle = (channel: string) =>
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]))

  return (
    <Drawer open={open} onClose={onClose} title="Send reminder" placement="center">
      <form
        className="space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (channels.length === 0) return
          send.mutate(channels, { onSuccess: onClose })
        }}
      >
        {preview && (
          <div className="border-line bg-sunken/60 rounded-lg border p-3 text-sm">
            <p className="text-ink font-semibold">{preview.subject}</p>
            <p className="text-ink-muted mt-1 text-xs">
              {formatCurrency(preview.amountDueMinor, currency)} due · {preview.daysOverdue} days overdue
            </p>
            <p className="text-ink-subtle mt-2 whitespace-pre-line">{preview.body}</p>
          </div>
        )}
        <fieldset>
          <legend className={labelClass}>Channels</legend>
          <div className="mt-2 flex gap-4 text-sm">
            {['EMAIL', 'SMS'].map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input type="checkbox" checked={channels.includes(c)} onChange={() => toggle(c)} className="accent-brand-600" />
                {c === 'EMAIL' ? 'Email' : 'SMS'}
              </label>
            ))}
          </div>
        </fieldset>
        <FormActions onCancel={onClose} disabled={channels.length === 0 || send.isPending} label="Send reminder" />
      </form>
    </Drawer>
  )
}
