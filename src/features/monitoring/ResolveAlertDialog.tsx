import { useId, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { SeverityBadge } from '@/components/ui/StatusBadge'
import { contextFor } from '@/features/scheduling/visit-detail'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { alertKindLabels, alertTimingHints, formatTime } from './live-data'
import type { LiveAlert } from './live-data'
import { resolve, resolutionCategoryLabels } from './alert-actions'
import type { ResolutionCategory } from './alert-actions'
import { SelectBox } from '@/components/ui/SelectBox'

interface ResolveAlertDialogProps {
  alert: LiveAlert
  /** The day the alert was raised on. */
  date: string
  /** The clock the screen is running at, 24-hour. Signed onto the record. */
  now: string
  onClose: () => void
}

/**
 * Signing off an alert whose record is already written.
 *
 * Offered only where nothing in the next hour can change what the record says —
 * `canResolve` in the store holds that line and explains it. What is left on
 * those rows is a fact that is finished and permanently true: the visit *was*
 * late, the shift *did* go uncovered. The alert will never clear itself, so
 * without this it asks for attention for ever.
 *
 * So the wording is careful. Resolving does not say the thing did not happen
 * and it does not remove the row: the derived state stays exactly where it was,
 * and what gets added is an account of who dealt with it and how.
 *
 * Mounted only while it is open, so the form starts empty every time.
 */
export function ResolveAlertDialog({
  alert,
  date,
  now,
  onClose,
}: ResolveAlertDialogProps) {
  const context = contextFor(alert.thread)

  // No default: the category is the coordinator's account of what they did, and
  // a preselected one is the app writing it for them.
  const [category, setCategory] = useState<ResolutionCategory | ''>('')
  const [action, setAction] = useState('')
  const [internal, setInternal] = useState('')

  const categoryId = useId()
  const actionId = useId()
  const internalId = useId()

  const ready = category !== '' && action.trim() !== ''

  const submit = () => {
    if (category === '') return
    resolve({
      thread: alert.thread,
      date,
      at: now,
      by: SIGNED_IN,
      byRole: SIGNED_IN_ROLE,
      category,
      note: action.trim(),
      internal: internal.trim(),
    })
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title="Resolve alert"
      subtitle={alertKindLabels[alert.kind]}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="border-line bg-sunken rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-ink flex items-center gap-2 text-sm font-semibold">
              <CircleCheck
                className="size-4 shrink-0 text-emerald-600"
                strokeWidth={2}
                aria-hidden="true"
              />
              {alertKindLabels[alert.kind]}
            </p>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p className="text-ink-muted mt-1 text-sm break-words">{alert.detail}</p>
          {context && (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div>
                <dt className="text-ink-subtle text-xs">Care recipient</dt>
                <dd className="text-ink font-medium break-words">
                  {context.recipient.name}
                </dd>
              </div>
              <div>
                <dt className="text-ink-subtle text-xs">Assigned caregiver</dt>
                <dd className="text-ink font-medium break-words">
                  {context.caregiver?.name ?? 'Nobody assigned'}
                </dd>
              </div>
            </dl>
          )}
          {/* Why this one can be signed off at all, in the app's own words.
              Without it "Resolve" looks available on some rows and missing on
              others for no reason a coordinator can see. */}
          <p className="text-ink-subtle mt-2 text-xs break-words">
            {alertTimingHints.recorded}
          </p>
        </div>

        <div>
          <label htmlFor={categoryId} className="text-ink text-sm font-medium">
            Resolution category
          </label>
          <SelectBox
            id={categoryId}
            value={category}
            onChange={(e) => setCategory(e.target.value as ResolutionCategory)}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">Choose what was done</option>
            {(Object.keys(resolutionCategoryLabels) as ResolutionCategory[]).map(
              (value) => (
                <option key={value} value={value}>
                  {resolutionCategoryLabels[value]}
                </option>
              ),
            )}
          </SelectBox>
        </div>

        <div>
          <label htmlFor={actionId} className="text-ink text-sm font-medium">
            Action taken
          </label>
          <textarea
            id={actionId}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            rows={3}
            placeholder="What happened and what you did about it"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
          <p className="text-ink-subtle mt-1 text-xs">
            Required — this is the only account of how the row was settled.
          </p>
        </div>

        <div>
          <label htmlFor={internalId} className="text-ink text-sm font-medium">
            Internal notes{' '}
            <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <textarea
            id={internalId}
            value={internal}
            onChange={(e) => setInternal(e.target.value)}
            rows={2}
            placeholder="Administrative notes or billing adjustments"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
          {/* Named but not wired: this app has no way to change an invoice from
              here, and a note about billing is not a billing adjustment. */}
          <p className="text-ink-subtle mt-1 text-xs">
            A note only. Nothing here changes an invoice —{' '}
            <span className="whitespace-nowrap">billing is its own screen.</span>
          </p>
        </div>

        <p className="text-ink-subtle text-xs">
          Signed as {SIGNED_IN} ({SIGNED_IN_ROLE.toLowerCase()}) at{' '}
          {formatTime(now)}. The row keeps its place and its state — resolving
          records who settled it, it does not say the thing did not happen. Held
          for this session only.
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark resolved
          </button>
        </div>
      </div>
    </Drawer>
  )
}
