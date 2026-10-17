import { Link } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { BillingAccount } from './accounts'
import { formatMoney } from './data'
import { accountStatement, statementStatusLabels, statementStatusTones } from './ledger'
import type { AccountPayment } from './ledger'
import { downloadReceipt, formatDay, paymentStatus } from './payment-view'

const pill = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

interface HistoryStep {
  title: string
  detail: string
  done: boolean
}

/**
 * What the record can say about how a payment went, newest first. Only facts
 * the log holds: its date, method, who recorded it by hand, and its status.
 */
function historyOf(p: AccountPayment): HistoryStep[] {
  const on = p.method ? `${formatDay(p.at)} via ${p.method}` : formatDay(p.at)
  const initiated = { title: 'Payment Initiated', detail: on, done: false }
  switch (p.status) {
    case 'succeeded':
      return [
        { title: 'Receipt Generated', detail: `${formatDay(p.at)} by System`, done: true },
        {
          title: p.recordedBy ? 'Payment Recorded' : 'Payment Confirmed',
          detail: p.recordedBy ? `${formatDay(p.at)} by ${p.recordedBy}` : formatDay(p.at),
          done: true,
        },
        initiated,
      ]
    case 'failed':
      return [{ title: 'Payment Failed', detail: formatDay(p.at), done: true }, initiated]
    default:
      return [{ title: 'Awaiting Confirmation', detail: 'Still clearing', done: false }, initiated]
  }
}

export function PaymentDetailsDrawer({
  payment,
  account,
  onClose,
}: {
  payment: AccountPayment | undefined
  account: BillingAccount
  onClose: () => void
}) {
  return (
    <Drawer open={Boolean(payment)} onClose={onClose} title="Payment Details">
      {payment && <PaymentDetails payment={payment} account={account} />}
    </Drawer>
  )
}

function PaymentDetails({ payment: p, account }: { payment: AccountPayment; account: BillingAccount }) {
  const st = paymentStatus[p.status]
  const invoice = p.reference.startsWith('INV-')
    ? accountStatement(account).find((l) => l.ref === p.reference)
    : undefined
  const rows: [string, string][] = [
    ['Reference', p.txId ?? 'Before the log began'],
    ...(p.externalRef ? ([['Bank Reference', p.externalRef]] as [string, string][]) : []),
    ['Payment Method', p.method ?? 'Not recorded'],
    ...(p.bank ? ([['Bank', p.bank]] as [string, string][]) : []),
    [p.status === 'succeeded' ? 'Date Paid' : 'Date', formatDay(p.at)],
  ]
  const history = historyOf(p)

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6 p-5">
        <section className="border-line bg-sunken/40 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-ink-subtle text-xs font-medium uppercase">Payment Ref</p>
            <span className={cn(pill, tonePill[st.tone])}>{st.label}</span>
          </div>
          <p className="text-ink mt-2 text-3xl font-bold tracking-tight tabular-nums">{formatMoney(p.amount)}</p>
          <dl className="border-line mt-4 space-y-2.5 border-t pt-4 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="text-ink text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {p.status === 'failed' && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            This charge failed and is counted as owed on the account until a retry succeeds.
          </p>
        )}

        <section>
          <h3 className="text-ink text-sm font-semibold">{invoice ? 'Linked Invoice' : 'Pays For'}</h3>
          {invoice ? (
            <Link
              to={`/billing/invoices/${invoice.ref}`}
              className="border-line hover:bg-sunken/40 mt-2.5 flex items-center gap-3 rounded-xl border px-4 py-3"
            >
              <FileText className="text-brand-600 size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="text-ink block text-sm font-semibold">{invoice.ref}</span>
                <span className="text-ink-muted block text-xs">
                  {account.name} • {formatMoney(invoice.amount)}
                </span>
              </span>
              <span className={cn(pill, tonePill[statementStatusTones[invoice.status]])}>
                {statementStatusLabels[invoice.status]}
              </span>
            </Link>
          ) : (
            <p className="text-ink-muted mt-2 text-sm">{p.reference}</p>
          )}
        </section>

        <section>
          <h3 className="text-ink text-sm font-semibold">Payment History</h3>
          <ol className="mt-3">
            {history.map((h, i) => (
              <li key={h.title} className="relative flex gap-3 pb-4 last:pb-0">
                {i < history.length - 1 && (
                  <span aria-hidden="true" className="bg-line absolute top-3 left-[5px] h-full w-0.5" />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative mt-1 size-3 shrink-0 rounded-full',
                    h.done ? (p.status === 'failed' && i === 0 ? 'bg-red-500' : 'bg-brand-600') : 'bg-ink-subtle',
                  )}
                />
                <span>
                  <span className={cn('block text-sm font-semibold', h.done ? 'text-ink' : 'text-ink-muted')}>
                    {h.title}
                  </span>
                  <span className="text-ink-subtle block text-xs">{h.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="text-ink text-sm font-semibold">Internal Notes</h3>
          <p className={cn('mt-2 text-sm', p.note ? 'text-ink-muted' : 'text-ink-subtle')}>
            {p.note ?? 'No notes recorded for this payment.'}
          </p>
        </section>
      </div>

      {p.status === 'succeeded' && (
        <div className="border-line bg-surface sticky bottom-0 border-t p-5">
          <button
            type="button"
            onClick={() => downloadReceipt(p, account)}
            className="border-brand-500 text-brand-600 hover:bg-brand-50 flex h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold"
          >
            <Download className="size-4" strokeWidth={2} aria-hidden="true" />
            Download Receipt
          </button>
        </div>
      )}
    </div>
  )
}
