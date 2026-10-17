import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import {
  INVOICES_PAGE_SIZE,
  billedDelta,
  billedThisMonth,
  formatLongDate,
  formatMoney,
  getBillingRecord,
  invoiceStatus,
  nextDueDate,
  outstandingBalance,
  payments,
  sortInvoices,
} from '../billing-data'
import { BillingInfo } from './BillingInfo'
import { InvoiceTable } from './InvoiceTable'
import { PaymentHistory, ServiceBreakdown } from './BillingAside'
import { Pagination } from '@/components/ui/Pagination'
import { toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types'

export function BillingTab() {
  const profile = useOutletContext<RecipientProfile>()
  const record = getBillingRecord(profile.id)
  const [page, setPage] = useState(1)

  const rate = record?.insurance.coverageRate ?? 0
  const invoices = useMemo(
    () => sortInvoices(record?.invoices ?? []),
    [record],
  )
  const history = useMemo(() => payments(invoices, rate), [invoices, rate])

  if (!record) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <Receipt className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">
          No billing record
        </h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no invoices or payment details on file. Billing
          appears here once an account is set up.
        </p>
        <Link
          to={`/billing/invoices/new?account=acc-${profile.id}&from=${encodeURIComponent(`/care-recipients/${profile.id}/billing`)}`}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Create Invoice
        </Link>
      </div>
    )
  }

  // Every figure below is computed from the invoice list and coverage rate.
  const billed = billedThisMonth(invoices)
  const delta = billedDelta(invoices)
  const outstanding = outstandingBalance(invoices, rate)
  const nextDue = nextDueDate(invoices)
  const lastPayment = history[0]
  const overdueCount = invoices.filter(
    (i) => invoiceStatus(i) === 'overdue',
  ).length

  const stats: {
    id: string
    label: string
    value: string
    meta?: string
    metaTone?: Tone
    hint: string
  }[] = [
    {
      id: 'billed',
      label: 'Total Billed (This Month)',
      value: formatMoney(billed),
      meta: delta
        ? `${delta.direction === 'up' ? '↑' : '↓'} ${delta.value}`
        : undefined,
      metaTone: delta?.direction === 'up' ? 'green' : 'red',
      hint: delta ? 'Compared to last month' : 'No prior month to compare',
    },
    {
      id: 'outstanding',
      label: 'Outstanding Balance',
      value: formatMoney(outstanding),
      meta: outstanding > 0 ? (overdueCount > 0 ? 'Overdue' : 'Pending') : undefined,
      metaTone: overdueCount > 0 ? 'red' : 'amber',
      hint: nextDue ? `Due by ${formatLongDate(nextDue)}` : 'Nothing outstanding',
    },
    {
      id: 'last-payment',
      label: 'Last Payment',
      value: lastPayment ? formatMoney(lastPayment.amount) : '—',
      hint: lastPayment
        ? `Processed on ${formatLongDate(lastPayment.paidAt)}`
        : 'No payments recorded',
    },
    {
      id: 'status',
      label: 'Payment Status',
      value: overdueCount > 0 ? 'Overdue' : 'Current',
      meta: overdueCount > 0 ? 'Action needed' : 'Good',
      metaTone: overdueCount > 0 ? 'red' : 'green',
      hint:
        overdueCount > 0
          ? `${overdueCount} invoice${overdueCount === 1 ? '' : 's'} past due`
          : 'No overdue payments',
    },
  ]

  const pageCount = Math.max(1, Math.ceil(invoices.length / INVOICES_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = invoices.slice(
    (safePage - 1) * INVOICES_PAGE_SIZE,
    safePage * INVOICES_PAGE_SIZE,
  )
  const from = invoices.length === 0 ? 0 : (safePage - 1) * INVOICES_PAGE_SIZE + 1
  const to = (safePage - 1) * INVOICES_PAGE_SIZE + pageRows.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ id, label, value, meta, metaTone, hint }) => (
          <article key={id} className="card p-4">
            <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
              {label}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-ink text-2xl font-bold tracking-tight tabular-nums">
                {value}
              </p>
              {meta && (
                <p
                  className={cn(
                    'text-sm font-medium',
                    toneText[metaTone ?? 'slate'],
                  )}
                >
                  {meta}
                </p>
              )}
            </div>
            <p className="text-ink-subtle mt-1.5 text-xs">{hint}</p>
          </article>
        ))}
      </div>

      <BillingInfo record={record} />

      <section aria-labelledby="recent-invoices" className="card overflow-hidden">
        <h2
          id="recent-invoices"
          className="text-ink border-line border-b px-4 py-3 text-base font-semibold tracking-tight"
        >
          Recent Invoices
        </h2>

        <InvoiceTable rows={pageRows} rate={rate} />

        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          summary={
            invoices.length === 0
              ? 'No invoices to show'
              : `Showing ${from}-${to} of ${invoices.length} invoices`
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ServiceBreakdown record={record} />
        <PaymentHistory history={history.slice(0, 4)} method={record.method} />
      </div>
    </div>
  )
}
