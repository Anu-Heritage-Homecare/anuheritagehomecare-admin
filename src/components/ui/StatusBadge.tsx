import { cn } from '@/lib/cn'
import { tonePill } from '@/lib/tone'
import { recipientStatusLabels } from '@/lib/status-labels'
import type {
  CareLevel,
  Priority,
  RecipientStatus,
  Severity,
  Tone,
  VisitStatus,
} from '@/types'

const base =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

/** A page heading's status: the same pill, one size up. */
const largeBase =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap'

/** The record screens draw status as a squared tag rather than a pill. */
const squareBase =
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap'

/* --------------------------------- visits --------------------------------- */

const visitStatusTone: Record<VisitStatus, Tone> = {
  completed: 'green',
  'in-progress': 'blue',
  'starting-soon': 'amber',
  unassigned: 'red',
  upcoming: 'slate',
  'late-arrival': 'amber',
  cancelled: 'red',
}

const visitStatusLabels: Record<VisitStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  'starting-soon': 'Starting Soon',
  unassigned: 'Unassigned',
  upcoming: 'Upcoming',
  'late-arrival': 'Late Arrival',
  cancelled: 'Cancelled',
}

export function VisitStatusBadge({
  status,
  square = false,
  large = false,
}: {
  status: VisitStatus
  square?: boolean
  large?: boolean
}) {
  return (
    <span
      className={cn(
        large ? largeBase : square ? squareBase : base,
        tonePill[visitStatusTone[status]],
      )}
    >
      {visitStatusLabels[status]}
    </span>
  )
}

/* -------------------------------- recipients ------------------------------- */

const recipientStatusTone: Record<RecipientStatus, Tone> = {
  active: 'green',
  'on-hold': 'amber',
  new: 'blue',
  discharged: 'slate',
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return (
    <span className={cn(base, tonePill[recipientStatusTone[status]])}>
      {recipientStatusLabels[status]}
    </span>
  )
}

/* -------------------------------- severity -------------------------------- */

/*
 * Red, orange, amber — the design's three, and three steps a reader can tell
 * apart at a glance. High used to be a second red, which made a high alert and
 * a critical one the same colour of urgent at the size these pills are drawn.
 * Each pair clears 4.5:1 on its own fill.
 */
const severityStyles: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-50 text-amber-700',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={cn(base, 'capitalize', severityStyles[severity])}>
      {severity}
    </span>
  )
}

/* -------------------------------- priority -------------------------------- */

/*
 * Priority's own ramp rather than the shared tones: red, amber, yellow, grey,
 * blue reads as a ladder, where the old rose-for-high sat so close to red that
 * High and Critical were the same shout at pill size. Each pair clears 4.5:1
 * on its own fill.
 */
const priorityStyles: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-amber-50 text-amber-700',
  normal: 'bg-slate-100 text-slate-600',
  low: 'bg-blue-50 text-blue-700',
}

/** Pill form — used in dense directory tables. */
export function PriorityBadge({
  priority,
  square = false,
}: {
  priority: Priority
  square?: boolean
}) {
  return (
    <span
      className={cn(square ? squareBase : base, 'capitalize', priorityStyles[priority])}
    >
      {priority}
    </span>
  )
}

const priorityTextStyles: Record<Priority, string> = {
  critical: 'text-red-700 font-semibold',
  urgent: 'text-red-600 font-medium',
  high: 'text-rose-600 font-medium',
  medium: 'text-amber-700 font-medium',
  normal: 'text-ink-muted',
  low: 'text-ink-subtle',
}

/** Plain-text form — used where a pill would add too much colour. */
export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className={cn('text-sm capitalize', priorityTextStyles[priority])}>
      {priority}
    </span>
  )
}

/* ------------------------------- care level ------------------------------- */

export function CareLevelTag({ level }: { level: CareLevel }) {
  return (
    <span className="bg-sunken text-ink-muted inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      {level}
    </span>
  )
}
