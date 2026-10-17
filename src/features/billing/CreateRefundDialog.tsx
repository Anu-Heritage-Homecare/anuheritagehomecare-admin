import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import { formatMoney } from './data'
import { createRefund, refundMethods, refundReasons, refundablePayments } from './refunds'
import type { RefundMethod, RefundReason } from './refunds'
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

export function CreateRefundDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (ref: string) => void
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Create Refund" placement="center">
      {open && <RefundForm onClose={onClose} onCreated={onCreated} />}
    </Drawer>
  )
}

function RefundForm({ onClose, onCreated }: { onClose: () => void; onCreated: (ref: string) => void }) {
  const payments = refundablePayments()
  const [txId, setTxId] = useState(payments[0]?.tx.id ?? '')
  const payment = payments.find((p) => p.tx.id === txId)
  const [raw, setRaw] = useState(payment ? payment.available.toLocaleString('en-NG') : '')
  const [method, setMethod] = useState<RefundMethod>('Bank Transfer')
  const [reason, setReason] = useState<RefundReason>('Overpayment')
  const [note, setNote] = useState('')

  const amount = Number(raw.replace(/,/g, ''))
  const amountOk = raw.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount <= (payment?.available ?? 0)
  const noteOk = reason !== 'Other' || note.trim() !== ''
  const valid = Boolean(payment) && amountOk && noteOk

  if (payments.length === 0) {
    return <p className="text-ink-muted p-5 text-sm">No settled payment is left to refund.</p>
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || !payment) return
        const refund = createRefund({ payment, amount: Math.round(amount), method, reason, note: note.trim() })
        if (refund) onCreated(refund.ref)
      }}
    >
      <div className="space-y-5 p-5">
        <div>
          <Label htmlFor="rf-payment">Original Payment</Label>
          <SelectBox
            id="rf-payment"
            value={txId}
            onChange={(e) => {
              setTxId(e.target.value)
              const next = payments.find((p) => p.tx.id === e.target.value)
              setRaw(next ? next.available.toLocaleString('en-NG') : '')
            }}
            className={fieldClass}
          >
            {payments.map((p) => (
              <option key={p.tx.id} value={p.tx.id}>
                {p.tx.id} ({formatMoney(p.tx.amount)} - {p.account})
              </option>
            ))}
          </SelectBox>
        </div>

        <div>
          <Label htmlFor="rf-amount">Refund Amount</Label>
          <div className="relative">
            <span aria-hidden="true" className="text-ink-muted pointer-events-none absolute top-1/2 left-3 mt-0.75 -translate-y-1/2 text-sm">
              ₦
            </span>
            <input
              id="rf-amount"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              aria-invalid={!amountOk}
              aria-describedby="rf-amount-hint"
              className={cn(fieldClass, 'pl-7 tabular-nums', !amountOk && 'border-red-500')}
            />
          </div>
          <p id="rf-amount-hint" className={cn('mt-1 text-xs', amountOk ? 'text-ink-subtle' : 'text-red-700')}>
            {payment && payment.available < payment.tx.amount
              ? `${formatMoney(payment.tx.amount - payment.available)} of this payment is already being refunded. `
              : ''}
            {amountOk ? `Up to ${formatMoney(payment?.available ?? 0)}.` : `Enter an amount up to ${formatMoney(payment?.available ?? 0)}.`}
          </p>
        </div>

        <div>
          <Label htmlFor="rf-method">Refund Method</Label>
          <SelectBox id="rf-method" value={method} onChange={(e) => setMethod(e.target.value as RefundMethod)} className={fieldClass}>
            {refundMethods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </SelectBox>
        </div>

        <div>
          <Label htmlFor="rf-reason">Reason</Label>
          <SelectBox id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value as RefundReason)} className={fieldClass}>
            {refundReasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectBox>
        </div>

        <div>
          <label htmlFor="rf-note" className="text-ink text-sm font-medium">
            Notes{reason === 'Other' && <span className="ml-0.5 text-red-600">*</span>}
          </label>
          <textarea
            id="rf-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Enter notes or special explanations for auditing..."
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
          Process Refund
        </button>
      </div>
    </form>
  )
}
