import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import { formatMoney } from './data'
import { getInvoice } from './ledger'
import { createCredit, creditReasons, creditable, creditableAccounts, creditableInvoices } from './credits'
import type { CreditReason } from './credits'
import { SelectBox } from '@/components/ui/SelectBox'

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-11 w-full rounded-lg border px-3 text-sm'

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-ink text-sm font-medium">
      {children}
      <span aria-hidden="true" className="ml-0.5 text-red-600">
        *
      </span>
    </label>
  )
}

export function ApplyCreditDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (ref: string) => void
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Apply Credit" placement="center">
      {open && <CreditForm onClose={onClose} onCreated={onCreated} />}
    </Drawer>
  )
}

function CreditForm({ onClose, onCreated }: { onClose: () => void; onCreated: (ref: string) => void }) {
  const accounts = creditableAccounts()
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const invoices = creditableInvoices(accountId)
  const [number, setNumber] = useState(invoices[0]?.number ?? '')
  const invoice = getInvoice(number)
  const max = invoice ? creditable(invoice) : 0
  const [raw, setRaw] = useState('')
  const [reason, setReason] = useState<CreditReason>('Service Resolution / Goodwill')
  const [note, setNote] = useState('')

  const amount = Number(raw.replace(/,/g, ''))
  const touched = raw.trim() !== ''
  const amountOk = touched && Number.isFinite(amount) && amount > 0 && amount <= max
  const noteOk = reason !== 'Other' || note.trim() !== ''
  const valid = Boolean(invoice) && amountOk && noteOk

  if (accounts.length === 0) {
    return <p className="text-ink-muted p-5 text-sm">No invoice has a balance left to credit.</p>
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || !invoice) return
        const credit = createCredit({ invoice, amount: Math.round(amount), reason, note: note.trim() })
        if (credit) onCreated(credit.ref)
      }}
    >
      <div className="space-y-5 p-5">
        <div>
          <Label htmlFor="cr-amount">Credit Amount</Label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="text-ink-muted pointer-events-none absolute top-1/2 left-3 mt-0.75 -translate-y-1/2 text-sm"
            >
              ₦
            </span>
            <input
              id="cr-amount"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="0"
              aria-invalid={touched && !amountOk}
              aria-describedby="cr-amount-hint"
              className={cn(fieldClass, 'pl-7 tabular-nums', touched && !amountOk && 'border-red-500')}
            />
          </div>
          <p
            id="cr-amount-hint"
            className={cn('mt-1 text-xs', touched && !amountOk ? 'text-red-700' : 'text-ink-subtle')}
          >
            {invoice ? `Up to ${formatMoney(max)} on ${invoice.number}.` : 'Choose an invoice first.'}
          </p>
        </div>

        <div>
          <Label htmlFor="cr-account">Billing Account</Label>
          <SelectBox
            id="cr-account"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              setNumber(creditableInvoices(e.target.value)[0]?.number ?? '')
            }}
            className={fieldClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} Account
              </option>
            ))}
          </SelectBox>
        </div>

        <div>
          <Label htmlFor="cr-invoice">Apply To Invoice</Label>
          <SelectBox id="cr-invoice" value={number} onChange={(e) => setNumber(e.target.value)} className={fieldClass}>
            {invoices.map((i) => (
              <option key={i.number} value={i.number}>
                {i.number} (Outstanding: {formatMoney(creditable(i))})
              </option>
            ))}
          </SelectBox>
        </div>

        <div>
          <Label htmlFor="cr-reason">Reason</Label>
          <SelectBox
            id="cr-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as CreditReason)}
            className={fieldClass}
          >
            {creditReasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectBox>
        </div>

        <div>
          <label htmlFor="cr-note" className="text-ink text-sm font-medium">
            Notes{reason === 'Other' && <span className="ml-0.5 text-red-600">*</span>}
          </label>
          <textarea
            id="cr-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Describe the reason for applying internal platform credit..."
            aria-invalid={!noteOk}
            className={cn(
              'border-control focus:border-brand-500 bg-surface mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm',
              !noteOk && 'border-red-500',
            )}
          />
          {!noteOk && <p className="mt-1 text-xs text-red-700">Say why, when the reason is Other.</p>}
        </div>
      </div>

      <div className="border-line bg-sunken/40 flex justify-end gap-3 border-t px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Apply Credit
        </button>
      </div>
    </form>
  )
}
