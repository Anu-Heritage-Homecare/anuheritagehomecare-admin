import { useId, useState } from 'react'
import { Phone, TriangleAlert } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { SeverityBadge } from '@/components/ui/StatusBadge'
import { getCaregiverRecord } from '@/features/care-recipients/caregivers-data'
import { contextFor } from '@/features/scheduling/visit-detail'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { alertKindLabels, formatTime, telHref } from './live-data'
import type { LiveAlert } from './live-data'
import {
  escalate,
  escalationReasonLabels,
  escalationTiers,
} from './alert-actions'
import type { EscalationReason } from './alert-actions'
import { SelectBox } from '@/components/ui/SelectBox'

interface EscalateAlertDialogProps {
  alert: LiveAlert
  /** The day the alert is being read on. */
  date: string
  /** The clock the screen is running at, 24-hour. Signed onto the record. */
  now: string
  onClose: () => void
}

/**
 * Handing an alert to somebody else.
 *
 * What this does *not* do is send anything: the app has no outbound channel,
 * and a "Confirm escalation" that quietly notified nobody would be the worst
 * button on the screen. So it records who it went to and why, and puts their
 * phone number in front of the person escalating — the one part of handing a
 * problem over that this app can actually carry out.
 *
 * Mounted only while it is open, so the form starts empty every time.
 */
export function EscalateAlertDialog({
  alert,
  date,
  now,
  onClose,
}: EscalateAlertDialogProps) {
  const context = contextFor(alert.thread)

  // The client's own coordinator, where the alert is about a client at all —
  // the person who would be handed this in a real agency, so the form opens on
  // them rather than on whoever sorts first.
  const ownCoordinator = context
    ? getCaregiverRecord(context.recipient.id)?.team.find((m) =>
        m.role.includes('Coordinator'),
      )?.name
    : undefined
  const openingTier =
    escalationTiers.find((t) => t.people.some((p) => p.name === ownCoordinator)) ??
    escalationTiers[0]

  const [tierTitle, setTierTitle] = useState<string>(openingTier?.title ?? '')
  const tier = escalationTiers.find((t) => t.title === tierTitle) ?? openingTier
  const [assigneeId, setAssigneeId] = useState(
    tier?.people.find((p) => p.name === ownCoordinator)?.id ??
      tier?.people[0]?.id ??
      '',
  )
  const assignee = tier?.people.find((p) => p.id === assigneeId) ?? tier?.people[0]

  // No default: the reason is the escalating coordinator's assertion, and a
  // preselected one is the app putting words in their mouth.
  const [reason, setReason] = useState<EscalationReason | ''>('')
  const [note, setNote] = useState('')

  const levelId = useId()
  const assignId = useId()
  const reasonId = useId()
  const noteId = useId()

  const ready = Boolean(assignee) && reason !== '' && note.trim() !== ''

  const submit = () => {
    if (!assignee || reason === '') return
    escalate({
      thread: alert.thread,
      date,
      at: now,
      by: SIGNED_IN,
      byRole: SIGNED_IN_ROLE,
      toId: assignee.id,
      toName: assignee.name,
      toTitle: assignee.title,
      toPhone: assignee.phone,
      reason,
      note: note.trim(),
    })
    onClose()
  }

  const changeTier = (title: string) => {
    setTierTitle(title)
    // The old assignee is not on the new level, so the field cannot keep them:
    // a form that reads "Registered nurse / Mike Chen" is stating something
    // untrue about the roster.
    const next = escalationTiers.find((t) => t.title === title)
    setAssigneeId(next?.people[0]?.id ?? '')
  }

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title="Escalate issue"
      subtitle={alertKindLabels[alert.kind]}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <TriangleAlert
                className="size-4 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              {alertKindLabels[alert.kind]}
            </p>
            <span className="flex items-center gap-2">
              {alert.elapsed && (
                <span className="text-xs font-semibold whitespace-nowrap text-amber-900">
                  {alert.elapsed}
                </span>
              )}
              <SeverityBadge severity={alert.severity} />
            </span>
          </div>
          <p className="mt-1 text-sm break-words text-amber-900">{alert.detail}</p>
          {/* No reference number: nothing issues one. What the row can say is
              which record it was read off, which is the thing you would go and
              check. */}
          <p className="mt-1.5 text-xs break-words text-amber-800">
            {context
              ? `${context.recipient.name} · ${context.caregiver?.name ?? 'nobody assigned'} · `
              : ''}
            read off {alert.source}
          </p>
        </div>

        {escalationTiers.length === 0 || !tier || !assignee ? (
          <p className="text-ink-muted text-sm" role="status">
            There is nobody on the roster to escalate to — every coordinator,
            nurse and manager on file is either you or not active.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor={levelId} className="text-ink text-sm font-medium">
                Escalation level
              </label>
              <SelectBox
                id={levelId}
                value={tier.title}
                onChange={(e) => changeTier(e.target.value)}
                className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
              >
                {escalationTiers.map((t) => (
                  <option key={t.title} value={t.title}>
                    {t.label}
                  </option>
                ))}
              </SelectBox>
            </div>

            <div>
              <label htmlFor={assignId} className="text-ink text-sm font-medium">
                Assign to
              </label>
              <SelectBox
                id={assignId}
                value={assignee.id}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
              >
                {tier.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} — {person.branch}
                  </option>
                ))}
              </SelectBox>
              <p className="text-ink-subtle mt-1 text-xs">
                {assignee.name} is on {assignee.phone}.{' '}
                {ownCoordinator === assignee.name &&
                  "This client's own coordinator."}
              </p>
            </div>

            <div>
              <label htmlFor={reasonId} className="text-ink text-sm font-medium">
                Reason
              </label>
              <SelectBox
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value as EscalationReason)}
                className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
              >
                <option value="">Choose a reason</option>
                {(
                  Object.keys(escalationReasonLabels) as EscalationReason[]
                ).map((value) => (
                  <option key={value} value={value}>
                    {escalationReasonLabels[value]}
                  </option>
                ))}
              </SelectBox>
            </div>

            <div>
              <label htmlFor={noteId} className="text-ink text-sm font-medium">
                Notes
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="What you have already tried, and what you need them to do"
                className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
              />
              {/* Required, unlike the note on an acknowledgement. Handing a
                  problem to somebody else without saying what you already did
                  is how the same call gets made twice. */}
              <p className="text-ink-subtle mt-1 text-xs">
                Required — the person picking this up has none of your context.
              </p>
            </div>

            <p className="text-ink-subtle text-xs">
              Signed as {SIGNED_IN} ({SIGNED_IN_ROLE.toLowerCase()}) at{' '}
              {formatTime(now)}. Nothing is sent: this app has no way to notify
              anybody, so this records the handover and gives you the number to
              ring. Held for this session only.
            </p>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          {assignee && (
            <a
              href={telHref(assignee.phone)}
              className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
            >
              <Phone className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              Call {assignee.name.split(' ')[0]}
            </a>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="inline-flex min-h-11 items-center rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm escalation
          </button>
        </div>
      </div>
    </Drawer>
  )
}
