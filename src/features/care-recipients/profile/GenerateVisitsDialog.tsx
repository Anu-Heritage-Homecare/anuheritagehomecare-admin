import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { ApiError } from '@/lib/api'
import { fieldControl } from '@/lib/field-classes'
import { useGenerateVisits } from '../useGenerateVisits'
import type { GenerateVisitsResult } from '../useGenerateVisits'

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function plusDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Turns the recipient's recurring care schedule into real visits over a date
 * range. The office picks the window; the server fills the primary caregiver and
 * skips days that already have a visit, so the result reports both counts.
 */
export function GenerateVisitsDialog({
  recipientId,
  recipientName,
  open,
  onClose,
}: {
  recipientId: string
  recipientName: string
  open: boolean
  onClose: () => void
}) {
  const today = new Date()
  const [from, setFrom] = useState(iso(today))
  const [to, setTo] = useState(iso(plusDays(today, 28)))
  const [result, setResult] = useState<GenerateVisitsResult | null>(null)
  const generate = useGenerateVisits(recipientId)

  const invalid = from === '' || to === '' || to < from
  const saveError = generate.isError
    ? generate.error instanceof ApiError
      ? generate.error.message
      : 'Could not generate visits. Please try again.'
    : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Generate visits"
      subtitle={`From ${recipientName}'s care schedule`}
    >
      <div className="space-y-5 p-4">
        {result ? (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            Created {result.created} visit{result.created === 1 ? '' : 's'}
            {result.skipped > 0
              ? `, and skipped ${result.skipped} day${result.skipped === 1 ? '' : 's'} that already had one`
              : ''}
            .
          </div>
        ) : (
          <p className="text-ink-muted text-sm">
            Creates one visit per scheduled day between these dates for {recipientName}&rsquo;s
            primary caregiver, skipping any day that already has a visit.
          </p>
        )}

        {saveError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </div>
        )}

        <label className="block">
          <span className="text-ink text-sm font-semibold">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setResult(null)
            }}
            className={fieldControl}
          />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-semibold">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value)
              setResult(null)
            }}
            className={fieldControl}
          />
        </label>
        {invalid && <p className="text-xs text-red-700">The end date must not be before the start date.</p>}

        <div className="border-line flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border-line bg-surface text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={invalid || generate.isPending}
            onClick={() => generate.mutate({ from, to }, { onSuccess: setResult })}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {generate.isPending ? 'Generating…' : 'Generate visits'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
