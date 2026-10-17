import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import { formatMoney } from './data'
import { accountName, approve, canApprove, kindLabels, reject } from './adjustments'
import type { Adjustment } from './adjustments'

/**
 * How the entry moves money, signed as the designs write it: a credit,
 * write-off, refund or decrease is money off (red, "₦-85,000"); an increase
 * is added ("+₦600").
 */
function signedAmount(a: Adjustment): { text: string; off: boolean } {
  const off = a.kind !== 'adjustment' || a.direction === 'decrease'
  return {
    text: off ? formatMoney(a.amount).replace('₦', '₦-') : `+${formatMoney(a.amount)}`,
    off,
  }
}

/** The approve-or-reject decision on a pending entry. */
export function ReviewAdjustmentDialog({
  adjustment,
  onClose,
}: {
  adjustment: Adjustment | undefined
  onClose: () => void
}) {
  const title = adjustment ? `Approve ${kindLabels[adjustment.kind].one}` : ''
  return (
    <Drawer open={Boolean(adjustment)} onClose={onClose} title={title} placement="center">
      {adjustment && <Review key={adjustment.ref} a={adjustment} title={title} onClose={onClose} />}
    </Drawer>
  )
}

function Review({ a, title, onClose }: { a: Adjustment; title: string; onClose: () => void }) {
  const [note, setNote] = useState('')
  const amount = signedAmount(a)
  const rows: [string, React.ReactNode][] = [
    ['Reference', a.ref],
    ['Type', a.type],
    ['Account', `${accountName(a)} Account`],
    ...(a.invoice || a.txId ? ([['Applies to', a.invoice ?? a.txId]] as [string, string][]) : []),
    ['Amount', <span className={amount.off ? 'text-red-600' : undefined}>{amount.text}</span>],
  ]
  const decide = (fn: typeof approve) => {
    fn(a, note.trim() || undefined)
    onClose()
  }

  if (!canApprove(a)) {
    return <p className="text-ink-muted p-5 text-sm">{a.ref} has already been decided.</p>
  }

  return (
    <div>
      <div className="space-y-5 p-5">
        <section className="border-line bg-sunken/40 rounded-xl border px-4 py-3.5">
          <dl className="space-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="text-ink text-right font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="border-line mt-3 border-t pt-3">
            <p className="text-ink-subtle text-xs font-medium uppercase">Reason</p>
            <p className="text-ink mt-1 text-sm">{a.reason}</p>
          </div>
        </section>

        <div>
          <label htmlFor="rv-note" className="text-ink-muted text-sm font-medium">
            Approver Notes
          </label>
          <textarea
            id="rv-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Add optional feedback or reason for decisions..."
            className="border-control focus:border-brand-500 bg-surface mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="border-line bg-sunken/40 flex justify-end gap-3 border-t px-5 py-4">
        <button
          type="button"
          onClick={() => decide(reject)}
          className={cn(
            'bg-surface inline-flex h-10 items-center rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-600 hover:bg-red-50',
          )}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => decide(approve)}
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          {title}
        </button>
      </div>
    </div>
  )
}
