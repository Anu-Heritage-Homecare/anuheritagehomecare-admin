import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import { formatMoney } from './data'
import type { LedgerInvoice } from './ledger'
import { writeOff, writeOffAmount, writeOffReasons } from './write-off'
import type { WriteOffReason } from './write-off'
import { SelectBox } from '@/components/ui/SelectBox'

export function WriteOffDialog({
  invoice,
  account,
  open,
  onClose,
}: {
  invoice: LedgerInvoice
  account: string
  open: boolean
  onClose: () => void
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Confirm Write-off" placement="center">
      {open && <WriteOffForm invoice={invoice} account={account} onClose={onClose} />}
    </Drawer>
  )
}

function WriteOffForm({ invoice, account, onClose }: { invoice: LedgerInvoice; account: string; onClose: () => void }) {
  const [reason, setReason] = useState<WriteOffReason>('Uncollectable Debt')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [tried, setTried] = useState(false)
  const amount = writeOffAmount(invoice)
  const noteOk = note.trim() !== ''
  const valid = noteOk && confirmed && amount > 0

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (!valid) return
        if (writeOff(invoice, reason, note)) onClose()
      }}
      className="space-y-5 p-5"
    >
      <div role="alert" className="flex gap-3 rounded-xl bg-red-50 p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" strokeWidth={2} aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-red-800">Warning: Write-off Action</p>
          <p className="mt-0.5 text-red-700">
            You are about to write off the following amount. This transaction is permanent and cannot be undone.
          </p>
        </div>
      </div>

      <dl className="border-line bg-sunken/40 space-y-2.5 rounded-xl border px-4 py-3.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Invoice Number</dt>
          <dd className="text-ink font-semibold">{invoice.number}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Billing Account</dt>
          <dd className="text-ink text-right font-semibold">{account}</dd>
        </div>
        <div className="border-line flex justify-between gap-4 border-t pt-2.5">
          <dt className="text-ink-muted">Original Amount</dt>
          <dd className="text-ink font-semibold tabular-nums">{formatMoney(invoice.amount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Write-off Amount</dt>
          <dd className="text-lg font-bold text-red-600 tabular-nums">{formatMoney(amount)}</dd>
        </div>
      </dl>
      {amount < invoice.amount && (
        <p className="text-ink-subtle -mt-3 text-xs">
          Only what is still owed is written off — payments, credits and pending entries already account for the rest.
        </p>
      )}

      <div>
        <label htmlFor="wo-reason" className="text-ink text-sm font-medium">
          Reason for Write-off<span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
        </label>
        <SelectBox
          id="wo-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as WriteOffReason)}
          className="border-control focus:border-brand-500 bg-surface mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
        >
          {writeOffReasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </SelectBox>
      </div>

      <div>
        <label htmlFor="wo-note" className="text-ink text-sm font-medium">
          Approval Notes &amp; Justification<span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
        </label>
        <textarea
          id="wo-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Provide mandatory ledger notes or specific approval references from corporate finance..."
          aria-invalid={tried && !noteOk}
          className={cn(
            'border-control focus:border-brand-500 bg-surface mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm',
            tried && !noteOk && 'border-red-500',
          )}
        />
        {tried && !noteOk && <p className="mt-1 text-xs text-red-700">Notes are required for a write-off.</p>}
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-brand-600 mt-0.5 size-4.5 shrink-0"
        />
        <span className={cn('text-ink-muted', tried && !confirmed && 'text-red-700')}>
          I confirm this write-off has been reviewed and approved by finance management.
        </span>
      </label>

      <div className="flex justify-end gap-3">
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
          className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
        >
          Confirm Write-off
        </button>
      </div>
    </form>
  )
}
