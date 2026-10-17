import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { TODAY } from '@/lib/today'
import { cn } from '@/lib/cn'
import { formatMoney } from './data'
import { balanceOf, getInvoice } from './ledger'
import { payableInvoices, recordPayment } from './record-payment'
import type { PaymentMethodName } from './record-payment'
import { useBillingSettings } from './settings'
import { SelectBox } from '@/components/ui/SelectBox'

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-11 w-full rounded-lg border px-3 text-sm'
const labelClass = 'text-ink text-sm font-medium'

const long = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * The Record Payment side panel. Opened from an account (its open invoices
 * only), an invoice (that one, preselected) or the billing overview (every
 * open invoice).
 */
export function RecordPaymentDrawer({
  open,
  onClose,
  accountId,
  invoice,
}: {
  open: boolean
  onClose: () => void
  accountId?: string
  invoice?: string
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Record Payment">
      {/* Remounted on each open so it starts from the current book. */}
      {open && <PaymentForm accountId={accountId} preset={invoice} onDone={onClose} />}
    </Drawer>
  )
}

function PaymentForm({
  accountId,
  preset,
  onDone,
}: {
  accountId?: string
  preset?: string
  onDone: () => void
}) {
  const { methods } = useBillingSettings()
  const enabled = methods.filter((m) => m.enabled).map((m) => m.label as PaymentMethodName)
  const options = payableInvoices(accountId)
  const [number, setNumber] = useState(preset ?? options[0]?.number ?? '')
  const [method, setMethod] = useState<PaymentMethodName | ''>(enabled[0] ?? '')
  const [at, setAt] = useState(TODAY)
  const [ref, setRef] = useState('')
  const [bank, setBank] = useState('')
  const [note, setNote] = useState('')

  const invoice = getInvoice(number)
  const balance = invoice ? balanceOf(invoice) : 0
  const dateOk = Boolean(invoice) && at !== '' && at <= TODAY && at >= (invoice?.issuedAt ?? '')
  const valid = Boolean(invoice) && balance > 0 && method !== '' && dateOk

  if (options.length === 0) {
    return (
      <div className="p-5">
        <p className="text-ink-muted text-sm">
          {accountId ? 'This account has no invoice awaiting payment.' : 'No invoice is awaiting payment.'}
        </p>
        <button
          type="button"
          onClick={onDone}
          className="border-control text-ink hover:bg-sunken mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg border text-sm font-medium"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        recordPayment({ invoice: number, method, at, externalRef: ref.trim(), bank: bank.trim(), note: note.trim() })
        onDone()
      }}
    >
      <div className="flex-1 space-y-5 p-5">
        <label className="block">
          <span className={labelClass}>Invoice</span>
          <SelectBox value={number} onChange={(e) => setNumber(e.target.value)} className={fieldClass}>
            {options.map((i) => (
              <option key={i.number} value={i.number}>
                {i.number} ({i.account})
              </option>
            ))}
          </SelectBox>
        </label>

        <div>
          <label htmlFor="pay-amount" className={labelClass}>
            Amount (₦)
          </label>
          {/* The book settles an invoice whole, so the amount is its balance. */}
          <input
            id="pay-amount"
            readOnly
            value={balance.toLocaleString('en-NG')}
            aria-describedby="pay-amount-hint"
            className={cn(fieldClass, 'bg-sunken/40 tabular-nums')}
          />
          <p id="pay-amount-hint" className="text-ink-subtle mt-1 text-xs">
            The full balance of {invoice?.number}. Part payments aren’t recorded yet.
          </p>
        </div>

        <label className="block">
          <span className={labelClass}>Payment Method</span>
          <SelectBox
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethodName)}
            className={fieldClass}
          >
            {enabled.length === 0 && <option value="">No method enabled</option>}
            {enabled.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectBox>
        </label>

        <div>
          <label htmlFor="pay-date" className={labelClass}>
            Payment Date
          </label>
          <input
            id="pay-date"
            type="date"
            value={at}
            min={invoice?.issuedAt}
            max={TODAY}
            onChange={(e) => setAt(e.target.value)}
            aria-invalid={!dateOk}
            aria-describedby="pay-date-hint"
            className={cn(fieldClass, !dateOk && 'border-red-500')}
          />
          <p id="pay-date-hint" className={cn('mt-1 text-xs', dateOk ? 'text-ink-subtle' : 'text-red-700')}>
            {dateOk
              ? `${long.format(new Date(`${at}T00:00:00Z`))}${at === TODAY ? ' (Today)' : ''}`
              : `Pick a date from ${invoice ? long.format(new Date(`${invoice.issuedAt}T00:00:00Z`)) : 'the issue date'} to today.`}
          </p>
        </div>

        <label className="block">
          <span className={labelClass}>Reference Number</span>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            maxLength={40}
            placeholder="e.g. TXN-1092309"
            className={fieldClass}
          />
        </label>

        {method === 'Bank Transfer' && (
          <label className="block">
            <span className={labelClass}>Bank Name</span>
            <input
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              maxLength={40}
              placeholder="e.g. First Bank"
              className={fieldClass}
            />
          </label>
        )}

        <label className="block">
          <span className={labelClass}>Notes</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Enter payment notes here..."
            className="border-control focus:border-brand-500 bg-surface mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <div className="border-line bg-surface sticky bottom-0 grid grid-cols-2 gap-3 border-t p-5">
        <button
          type="button"
          onClick={onDone}
          className="border-control text-ink hover:bg-sunken inline-flex h-11 items-center justify-center rounded-lg border text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white"
        >
          Record Payment
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {invoice ? `Balance ${formatMoney(balance)}` : ''}
      </span>
    </form>
  )
}
