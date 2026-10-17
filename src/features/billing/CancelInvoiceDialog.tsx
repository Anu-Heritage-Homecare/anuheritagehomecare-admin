import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import { cancelInvoice, cancelReasons } from './cancel-invoice'
import type { CancelReason } from './cancel-invoice'
import { SelectBox } from '@/components/ui/SelectBox'

export function CancelInvoiceDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: string
  open: boolean
  onClose: () => void
}) {
  return (
    <Drawer open={open} onClose={onClose} title={`Cancel invoice ${invoice}`} placement="center" bare>
      {open && <CancelForm invoice={invoice} onClose={onClose} />}
    </Drawer>
  )
}

function CancelForm({ invoice, onClose }: { invoice: string; onClose: () => void }) {
  const [reason, setReason] = useState<CancelReason>('Billing Error')
  const [note, setNote] = useState('')
  const noteOk = reason !== 'Other' || note.trim() !== ''

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!noteOk) return
        cancelInvoice(invoice, reason, note.trim())
        onClose()
      }}
    >
      <div className="p-5 sm:px-6">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100">
            <TriangleAlert className="size-5.5 text-amber-600" strokeWidth={2} aria-hidden="true" />
          </span>
          <p aria-hidden="true" className="text-ink mt-4 text-lg font-bold tracking-tight">
            Cancel Invoice
          </p>
          <p className="text-ink-muted mt-1.5 text-sm">
            Are you sure you want to cancel invoice <strong className="text-ink font-semibold">{invoice}</strong>?
            This action cannot be undone and will void the outstanding receivables.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="cx-reason" className="text-ink text-sm font-medium">
              Reason for Cancellation
              <span aria-hidden="true" className="ml-0.5 text-red-600">
                *
              </span>
            </label>
            <SelectBox
              id="cx-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as CancelReason)}
              className="border-control focus:border-brand-500 bg-surface mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {cancelReasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </SelectBox>
          </div>
          <div>
            <label htmlFor="cx-note" className="text-ink text-sm font-medium">
              Internal Notes{reason === 'Other' && <span className="ml-0.5 text-red-600">*</span>}
            </label>
            <textarea
              id="cx-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Specify any correction details here..."
              aria-invalid={!noteOk}
              className={cn(
                'border-control focus:border-brand-500 bg-surface mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm',
                !noteOk && 'border-red-500',
              )}
            />
            {!noteOk && <p className="mt-1 text-xs text-red-700">Say why, when the reason is Other.</p>}
          </div>
        </div>
      </div>

      <div className="border-line bg-sunken/40 grid grid-cols-2 gap-3 border-t px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium"
        >
          Keep Invoice
        </button>
        <button
          type="submit"
          disabled={!noteOk}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
        >
          Cancel Invoice
        </button>
      </div>
    </form>
  )
}
