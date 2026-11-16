import { useId, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { SelectBox } from '@/components/ui/SelectBox'
import { SeverityBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/lib/auth-context'
import {
  useAcknowledgeAlert,
  useEscalateAlert,
  useResolveAlert,
  type LiveAttention,
} from './useLiveMonitoring'

/**
 * The three Live Monitoring alert actions, each writing through the backend
 * (acknowledge, resolve, escalate). Mounted only while open, so every field
 * starts empty. Attribution is server side from the admin token; the signed in
 * name is shown for the person acting, never sent as data.
 */

interface DialogProps {
  alert: LiveAttention
  onClose: () => void
}

function AlertHeader({ alert }: { alert: LiveAttention }) {
  return (
    <div className="border-line bg-sunken rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-ink text-sm font-semibold">{alert.issueType}</p>
        <SeverityBadge severity={alert.severity} />
      </div>
      <p className="text-ink-muted mt-1 text-sm break-words">{alert.description}</p>
      <p className="text-ink-subtle mt-1.5 text-xs break-words">
        {alert.source}
        {alert.timeLabel && ` · ${alert.timeLabel}`}
      </p>
    </div>
  )
}

function ActionBar({
  label,
  onCancel,
  onSubmit,
  disabled,
  pending,
  tone = 'brand',
}: {
  label: string
  onCancel: () => void
  onSubmit: () => void
  disabled?: boolean
  pending?: boolean
  tone?: 'brand' | 'emerald'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-brand-600 hover:bg-brand-700'
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || pending}
        className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
      >
        {pending ? 'Working…' : label}
      </button>
    </div>
  )
}

export function LiveAcknowledgeDialog({ alert, onClose }: DialogProps) {
  const { admin } = useAuth()
  const [note, setNote] = useState('')
  const noteId = useId()
  const mutation = useAcknowledgeAlert()

  const submit = () => {
    mutation.mutate(
      { id: alert.id, note: note.trim() || undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <Drawer open onClose={onClose} placement="center" title="Acknowledge alert" subtitle={alert.issueType}>
      <div className="space-y-4 p-4 sm:p-5">
        <AlertHeader alert={alert} />
        <div>
          <label htmlFor={noteId} className="text-ink text-sm font-medium">
            Notes <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What you are doing about it"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        {admin && (
          <p className="text-ink-subtle text-xs">Acknowledging as {admin.fullName}.</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-red-700">{mutation.error.message}</p>
        )}
        <ActionBar
          label="Acknowledge alert"
          onCancel={onClose}
          onSubmit={submit}
          pending={mutation.isPending}
        />
      </div>
    </Drawer>
  )
}

const RESOLUTION_CATEGORIES = [
  'Explained, nothing further needed',
  'Record corrected',
  'Cover arranged',
  'Raised with the caregiver',
  'Written up as an incident',
  'Something else',
]

export function LiveResolveDialog({ alert, onClose }: DialogProps) {
  const { admin } = useAuth()
  const [category, setCategory] = useState('')
  const [action, setAction] = useState('')
  const [internal, setInternal] = useState('')
  const categoryId = useId()
  const actionId = useId()
  const internalId = useId()
  const mutation = useResolveAlert()

  const ready = category !== '' && action.trim() !== ''

  const submit = () => {
    if (!ready) return
    mutation.mutate(
      {
        id: alert.id,
        category,
        actionTaken: action.trim(),
        internalNote: internal.trim() || undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Drawer open onClose={onClose} placement="center" title="Resolve alert" subtitle={alert.issueType}>
      <div className="space-y-4 p-4 sm:p-5">
        <AlertHeader alert={alert} />
        <div>
          <label htmlFor={categoryId} className="text-ink text-sm font-medium">
            Resolution category
          </label>
          <SelectBox
            id={categoryId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">Choose what was done</option>
            {RESOLUTION_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
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
        </div>
        <div>
          <label htmlFor={internalId} className="text-ink text-sm font-medium">
            Internal notes <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <textarea
            id={internalId}
            value={internal}
            onChange={(e) => setInternal(e.target.value)}
            rows={2}
            placeholder="Administrative notes or billing adjustments"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        {admin && <p className="text-ink-subtle text-xs">Resolving as {admin.fullName}.</p>}
        {mutation.isError && <p className="text-sm text-red-700">{mutation.error.message}</p>}
        <ActionBar
          label="Mark resolved"
          tone="emerald"
          onCancel={onClose}
          onSubmit={submit}
          disabled={!ready}
          pending={mutation.isPending}
        />
      </div>
    </Drawer>
  )
}

const ESCALATION_LEVELS = ['Care Coordinator', 'Registered Nurse', 'Operations Manager']

export function LiveEscalateDialog({ alert, onClose }: DialogProps) {
  const { admin } = useAuth()
  const [level, setLevel] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const levelId = useId()
  const assignId = useId()
  const reasonId = useId()
  const notesId = useId()
  const mutation = useEscalateAlert()

  const submit = () => {
    if (level === '') return
    mutation.mutate(
      {
        id: alert.id,
        level,
        assignTo: assignTo.trim() || undefined,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Drawer open onClose={onClose} placement="center" title="Escalate alert" subtitle={alert.issueType}>
      <div className="space-y-4 p-4 sm:p-5">
        <AlertHeader alert={alert} />
        <div>
          <label htmlFor={levelId} className="text-ink text-sm font-medium">
            Escalation level
          </label>
          <SelectBox
            id={levelId}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">Choose a level</option>
            {ESCALATION_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectBox>
        </div>
        <div>
          <label htmlFor={assignId} className="text-ink text-sm font-medium">
            Assign to <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <input
            id={assignId}
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            placeholder="Who is picking it up"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor={reasonId} className="text-ink text-sm font-medium">
            Reason <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <input
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why it is being passed on"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor={notesId} className="text-ink text-sm font-medium">
            Notes <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <textarea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the next person needs"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        {admin && <p className="text-ink-subtle text-xs">Escalating as {admin.fullName}.</p>}
        {mutation.isError && <p className="text-sm text-red-700">{mutation.error.message}</p>}
        <ActionBar
          label="Escalate alert"
          onCancel={onClose}
          onSubmit={submit}
          disabled={level === ''}
          pending={mutation.isPending}
        />
      </div>
    </Drawer>
  )
}
