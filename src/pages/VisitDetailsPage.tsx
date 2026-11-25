import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Circle,
  CircleCheck,
  Check,
  FileText,
  LogIn,
  LogOut,
  Pill,
  Plus,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  HISTORY_WEEKS,
  NOW,
  TODAY,
  contextFor,
  describeArrival,
  describeDeparture,
  detailFor,
  formatFullDay,
  formatTime,
  historyFor,
  taskProgress,
  writtenByCaregiver,
} from '@/features/scheduling/visit-detail'
import type {
  TimelineEntry,
  TimelineKind,
  VisitContext,
  VisitTask,
} from '@/features/scheduling/visit-detail'
import {
  countVisitNotes,
  filterVisitNotes,
  visitNoteKindLabels,
  visitNoteKindTones,
  visitNoteKinds,
  visitNoteTime,
  visitNotesFor,
} from '@/features/scheduling/visit-notes'
import type { VisitNote, VisitNoteKind } from '@/features/scheduling/visit-notes'
import type { CareNoteEntry } from '@/features/care-recipients/notes-data'
import type { DoseState } from '@/features/care-recipients/medications-data'
import {
  boardOn,
  cancelVisit,
  editVisit,
  isUnlogged,
  useBoardRevision,
  visitEdit,
} from '@/features/scheduling/board-data'
import type { BoardVisit } from '@/features/scheduling/board-data'
import { formatNoteTime, noteCategoryLabels } from '@/features/care-recipients/notes-data'
import {
  complianceFor,
  credentialStates,
  minutesOfDay,
  performanceFor,
} from '@/features/caregivers/roster-data'
import {
  goalBarFill,
  goalStatusLabels,
} from '@/features/care-recipients/care-plan-data'
import {
  NotCapturedList,
  VisitLocationMap,
} from '@/features/monitoring/VisitLocationMap'
import {
  branchDistanceMiles,
  formatMiles,
  placeOfRecipient,
  travelMiles,
} from '@/features/monitoring/locations-data'
import { addVisitNote } from '@/features/scheduling/visit-notes'
import { serviceTypes } from '@/features/scheduling/settings-data'
import { Drawer } from '@/components/ui/Drawer'
import { SelectBox } from '@/components/ui/SelectBox'
import { fieldControl } from '@/lib/field-classes'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { Panel } from '@/components/ui/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityBadge, VisitStatusBadge } from '@/components/ui/StatusBadge'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const tabs = [
  // The Figma's six, in its order.
  { slug: 'overview', label: 'Overview' },
  { slug: 'recipient', label: 'Recipient' },
  { slug: 'caregiver', label: 'Caregiver' },
  { slug: 'care-plan', label: 'Care Plan' },
  { slug: 'notes', label: 'Notes' },
  // The tab splits runs already made from ones still to come, so "History"
  // does not pass a future occurrence off as a finished one.
  { slug: 'history', label: 'History' },
  // Not in the Figma's tab row, so not shown there. They stay routable: the
  // Overview's task and timeline cards link through to the first two.
  { slug: 'tasks', label: 'Care Tasks', hidden: true },
  { slug: 'timeline', label: 'Timeline', hidden: true },
  { slug: 'location', label: 'Location & Check-in', hidden: true },
] as const

type TabSlug = (typeof tabs)[number]['slug']

function isTab(value: string | undefined): value is TabSlug {
  return tabs.some((t) => t.slug === value)
}

export function VisitDetailsPage() {
  const { visitId, tab } = useParams()
  const [params] = useSearchParams()
  useBoardRevision()
  const [dialog, setDialog] = useState<'edit' | 'cancel' | null>(null)
  const context = contextFor(visitId)

  const search = params.toString()
  const suffix = search ? `?${search}` : ''

  // An id that resolves to nothing is a dead end, not an empty shell.
  if (!context) return <Navigate to="/scheduling" replace />
  if (!isTab(tab))
    return (
      <Navigate
        to={`/scheduling/visits/${encodeURIComponent(visitId ?? '')}/overview${suffix}`}
        replace
      />
    )

  const { visit } = context
  const bookable =
    visit.date >= TODAY &&
    visit.status !== 'completed' &&
    visit.status !== 'cancelled'

  const secondaryBtn =
    'border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent'

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:px-7 sm:py-6">
        <nav aria-label="Breadcrumb">
          <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
            <li>
              <Link to="/scheduling" className="hover:text-ink">
                Scheduling
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="text-ink-muted size-3.5" strokeWidth={2.4} />
            </li>
            <li>
              {/* "Today's Schedule" only when it is; otherwise the day it is on. */}
              <Link to={`/scheduling?date=${visit.date}`} className="hover:text-ink">
                {visit.date === TODAY ? 'Today’s Schedule' : formatFullDay(visit.date)}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="text-ink-muted size-3.5" strokeWidth={2.4} />
            </li>
            <li className="text-brand-700 font-medium" aria-current="page">
              Visit Details
            </li>
          </ol>
        </nav>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-ink text-2xl font-bold tracking-tight">Visit Details</h1>
            <HeaderStatus visit={visit} large />
          </div>

          <div className="flex flex-wrap gap-2">
            {bookable && (
              <button type="button" onClick={() => setDialog('edit')} className={secondaryBtn}>
                Edit Visit
              </button>
            )}
            {/* A visit that is over cannot change hands. */}
            {bookable && (
              <Link to={`/scheduling/visits/${visit.id}/assign`} className={secondaryBtn}>
                {visit.caregiverId ? 'Reassign Caregiver' : 'Assign Caregiver'}
              </Link>
            )}
            {bookable && (
              <button
                type="button"
                onClick={() => setDialog('cancel')}
                className="inline-flex h-10 items-center rounded-lg border border-red-600 px-4 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Cancel Visit
              </button>
            )}
          </div>
        </div>

        {!visit.caregiverId && (
          <p className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span>Nobody is on this visit. {context.unassignedReason}</span>
          </p>
        )}

        {visit.outsideAvailability && visit.caregiverId && (
          <p className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span>
              This shift falls outside the availability {visit.caregiverName} has
              set for {visit.day}.
            </span>
          </p>
        )}

      </div>

      <nav
        aria-label="Visit record"
        className="border-line no-scrollbar flex gap-2 overflow-x-auto border-b"
      >
        {tabs.filter((t) => !('hidden' in t)).map((t) => {
          const selected = t.slug === tab
          return (
            <Link
              key={t.slug}
              to={`/scheduling/visits/${visit.id}/${t.slug}${suffix}`}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium transition-colors',
                selected
                  ? 'border-brand-600 text-brand-700'
                  : 'text-ink-muted hover:text-ink border-transparent',
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      {tab === 'overview' && <Overview context={context} />}
      {tab === 'tasks' && <TasksTab context={context} />}
      {tab === 'timeline' && <TimelineTab context={context} />}
      {tab === 'location' && <LocationTab context={context} />}
      {tab === 'recipient' && <RecipientTab context={context} />}
      {tab === 'caregiver' && <CaregiverTab context={context} />}
      {tab === 'care-plan' && <CarePlanTab context={context} />}
      {tab === 'notes' && <NotesTab context={context} />}
      {tab === 'history' && <HistoryTab context={context} />}

      <Drawer open={dialog === 'edit'} onClose={() => setDialog(null)} title="Edit visit" placement="center">
        <EditVisitForm visit={visit} onDone={() => setDialog(null)} />
      </Drawer>
      <Drawer open={dialog === 'cancel'} onClose={() => setDialog(null)} title="Cancel visit" placement="center">
        <CancelVisitForm visit={visit} onDone={() => setDialog(null)} />
      </Drawer>
    </div>
  )
}

const noteKinds = [
  { value: 'team', label: 'Coordinator / office note' },
  { value: 'caregiver', label: 'Caregiver note' },
  { value: 'family', label: 'Family note' },
] as const

function AddVisitNoteForm({ visit, onDone }: { visit: BoardVisit; onDone: () => void }) {
  const [kind, setKind] = useState<(typeof noteKinds)[number]['value']>('team')
  const [body, setBody] = useState('')
  const valid = body.trim() !== ''
  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        addVisitNote(visit.id, { author: SIGNED_IN, authorRole: SIGNED_IN_ROLE, body: body.trim(), kind })
        onDone()
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">Note type</span>
        <SelectBox value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={cn(fieldControl, 'mt-1.5')}>
          {noteKinds.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </SelectBox>
      </label>
      <label className="block">
        <span className="text-ink text-sm font-medium">Note</span>
        <textarea
          rows={4}
          maxLength={500}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened on this visit"
          className={cn(fieldControl, 'mt-1.5 h-auto py-2')}
        />
      </label>
      <p className="text-ink-subtle text-xs">Filed as {SIGNED_IN}, against this visit.</p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
          Cancel
        </button>
        <button type="submit" disabled={!valid} className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white">
          Add Note
        </button>
      </div>
    </form>
  )
}

function EditVisitForm({ visit, onDone }: { visit: BoardVisit; onDone: () => void }) {
  const current = visitEdit(visit.id)
  const [type, setType] = useState(current?.type ?? visit.type)
  const [start, setStart] = useState(current?.start ?? visit.start)
  const [duration, setDuration] = useState(String(current?.durationHours ?? visit.durationHours))
  const types = useMemo(() => {
    const list = serviceTypes()
    return list.includes(visit.type) ? list : [visit.type, ...list]
  }, [visit.type])
  const hours = Number(duration)
  const valid = /^\d{2}:\d{2}$/.test(start) && Number.isFinite(hours) && hours > 0 && hours <= 24
  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        editVisit(visit.id, { type, start, durationHours: hours })
        onDone()
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">Visit type</span>
        <SelectBox value={type} onChange={(e) => setType(e.target.value)} className={cn(fieldControl, 'mt-1.5')}>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </SelectBox>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-ink text-sm font-medium">Start time</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={cn(fieldControl, 'mt-1.5')} />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-medium">Duration (hours)</span>
          <input inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} className={cn(fieldControl, 'mt-1.5', !valid && duration !== '' && 'border-red-500')} />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
          Cancel
        </button>
        <button type="submit" disabled={!valid} className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white">
          Save Changes
        </button>
      </div>
    </form>
  )
}

function CancelVisitForm({ visit, onDone }: { visit: BoardVisit; onDone: () => void }) {
  const reasons = ['Cancelled by family', 'Cancelled by caregiver', 'Recipient in hospital', 'Rescheduled', 'Other']
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const valid = reason !== '' && (reason !== 'Other' || note.trim() !== '')
  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const full = reason === 'Other' ? note.trim() : note.trim() ? `${reason}: ${note.trim()}` : reason
        cancelVisit(visit.id, full)
        onDone()
      }}
    >
      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        This marks {visit.recipientName}&rsquo;s visit as cancelled on the board and the schedule.
      </p>
      <label className="block">
        <span className="text-ink text-sm font-medium">Reason</span>
        <SelectBox value={reason} onChange={(e) => setReason(e.target.value)} className={cn(fieldControl, 'mt-1.5')}>
          <option value="">Select a reason</option>
          {reasons.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </SelectBox>
      </label>
      <label className="block">
        <span className="text-ink text-sm font-medium">Note {reason !== 'Other' && <span className="text-ink-subtle text-xs font-normal">(optional)</span>}</span>
        <textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={cn(fieldControl, 'mt-1.5 h-auto py-2')} />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
          Keep Visit
        </button>
        <button type="submit" disabled={!valid} className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          Cancel Visit
        </button>
      </div>
    </form>
  )
}

/** The visit's state as one tag, with "Not written up" where that is the truth. */
function HeaderStatus({ visit, large = false }: { visit: BoardVisit; large?: boolean }) {
  if (isUnlogged(visit)) return <NotWrittenUp />
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <VisitStatusBadge status={visit.status} square={!large} large={large} />
      {visit.status === 'completed' && !visit.logged && <NotWrittenUp />}
    </span>
  )
}

/* ---------------------------------- shared --------------------------------- */

/** One rule for how a visit's state reads on a row, used everywhere. */
function RowStatus({ visit }: { visit: BoardVisit }) {
  if (isUnlogged(visit)) return <NotWrittenUp />
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
      <VisitStatusBadge status={visit.status} square />
      {visit.status === 'completed' && !visit.logged && <NotWrittenUp />}
    </span>
  )
}

function NotWrittenUp() {
  return (
    <span className="text-ink-muted bg-sunken inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
      Not written up
    </span>
  )
}

function Rows({
  rows,
}: {
  rows: { id: string; label: string; value: React.ReactNode }[]
}) {
  return (
    <dl className="divide-line divide-y">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-ink-muted min-w-0 text-sm">{row.label}</dt>
          <dd className="text-ink min-w-0 text-right text-sm font-medium break-words">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* --------------------------------- overview -------------------------------- */

/** The Overview's card: a larger title than `Panel`, with links on the right. */
function Card({
  title,
  actions,
  children,
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const id = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="text-ink text-base font-semibold tracking-tight">
          {title}
        </h2>
        {actions && <div className="flex items-center gap-3 text-sm">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

function CardLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 font-medium"
    >
      {children}
    </Link>
  )
}

/** Label and value side by side, both left-aligned, with inset rules. */
function InfoRows({
  rows,
}: {
  rows: { id: string; label: string; value: React.ReactNode }[]
}) {
  return (
    <dl className="divide-line/60 divide-y">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-4 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-ink-muted text-sm">{row.label}</dt>
          <dd className="text-ink text-sm break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar name={name} decorative className={cn('size-10 shrink-0 text-sm', className)} />
  )
}

const relatedDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

function Overview({ context }: { context: VisitContext }) {
  const { visit, related, recurrence, profile } = context

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-3">
        <Card title="Visit Information">
          <InfoRows
            rows={[
              { id: 'ref', label: 'Visit ID', value: context.reference },
              { id: 'date', label: 'Date', value: formatFullDay(visit.date) },
              {
                id: 'time',
                label: 'Time',
                value: `${formatTime(visit.start)} - ${formatTime(visit.end)}`,
              },
              {
                id: 'duration',
                label: 'Duration',
                value: `${visit.durationHours} hour${visit.durationHours === 1 ? '' : 's'}`,
              },
              { id: 'service', label: 'Service Type', value: visit.type },
              {
                id: 'priority',
                label: 'Priority',
                value: <PriorityBadge priority={visit.priority} square />,
              },
              { id: 'status', label: 'Status', value: <HeaderStatus visit={visit} /> },
              { id: 'location', label: 'Location', value: profile.personal.address },
              {
                // Read off the rota, so the pattern and Related Visits cannot
                // describe different weeks.
                id: 'recurring',
                label: 'Recurring',
                value: recurrence ? `Yes — ${recurrence.replace(/^Every /, '')}` : 'No',
              },
            ]}
          />
        </Card>

        <OverviewTasks context={context} />
        <OverviewNotes context={context} />
      </div>

      <div className="space-y-5 xl:col-span-2">
        <RecipientCard context={context} />
        <CaregiverCard context={context} />
        <OverviewTimeline context={context} />

        <Card title="Related Visits">
          {related.length === 0 ? (
            <p className="text-ink-muted text-sm" role="status">
              {recurrence
                ? 'No other occurrence of this slot within three weeks.'
                : 'This visit does not recur.'}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {related.map(({ visit: other, when }) => (
                <li
                  key={other.id}
                  className="bg-sunken flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/scheduling/visits/${other.id}/overview`}
                      className="text-ink hover:text-brand-700 text-sm font-semibold break-words"
                    >
                      {when === 'previous' ? 'Previous' : 'Next'}:{' '}
                      {relatedDay.format(new Date(`${other.date}T00:00:00Z`))}
                    </Link>
                    <p className="text-ink-muted mt-0.5 text-xs break-words">
                      {formatTime(other.start)} · {other.type} ·{' '}
                      {other.caregiverName ?? 'Unassigned'}
                    </p>
                  </div>
                  <RowStatus visit={other} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function OverviewTasks({ context }: { context: VisitContext }) {
  const { tasks, visit } = context
  const progress = taskProgress(tasks)
  // Only said when the list alone would mislead.
  const caveat =
    visit.status === 'cancelled'
      ? 'The visit was cancelled, so none of these ran.'
      : isUnlogged(visit)
        ? 'The window closed with no visit record, so none of these is known to have happened.'
        : null

  return (
    <Card
      title="Visit Tasks"
      actions={
        <span className="bg-sunken text-ink-muted rounded-md px-2 py-0.5 text-xs font-medium">
          {progress.done} of {progress.total} completed
        </span>
      }
    >
      <ul className="divide-line/60 divide-y">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
      {caveat && <p className="text-ink-muted mt-3 text-xs">{caveat}</p>}
    </Card>
  )
}

function TaskRow({ task }: { task: VisitTask }) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      {/* Shape and words, never colour alone. */}
      {task.state === 'done' ? (
        <CircleCheck className="size-5 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden="true" />
      ) : task.state === 'current' ? (
        <Circle className="text-brand-600 size-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Circle className="text-line size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
      )}
      <span
        className={cn(
          'min-w-0 flex-1 text-sm break-words',
          task.state === 'pending' ? 'text-ink-muted' : 'text-ink',
          task.state === 'current' && 'font-medium',
        )}
      >
        {task.label}
      </span>
      <span
        className={cn(
          'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
          task.state === 'done'
            ? 'bg-emerald-50 text-emerald-700'
            : task.state === 'current'
              ? 'bg-brand-50 text-brand-700'
              : 'bg-sunken text-ink-muted',
        )}
      >
        {task.state === 'done' ? 'Completed' : task.state === 'current' ? 'In Progress' : 'Pending'}
      </span>
    </li>
  )
}

function OverviewNotes({ context }: { context: VisitContext }) {
  const { visit, notes } = context
  const [adding, setAdding] = useState(false)
  const [rev, setRev] = useState(0)
  // `rev` bumps after a note is added, to recompute the list.
  const all = useMemo(() => (void rev, visitNotesFor(visit, notes)), [visit, notes, rev])
  const shown = all.slice(0, OVERVIEW_NOTES)

  return (
    <Card
      title="Visit Notes"
      actions={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 font-medium"
        >
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Add Note
        </button>
      }
    >
      <Drawer open={adding} onClose={() => setAdding(false)} title="Add visit note" placement="center">
        <AddVisitNoteForm
          visit={visit}
          onDone={() => {
            setAdding(false)
            setRev((n) => n + 1)
          }}
        />
      </Drawer>
      {shown.length === 0 ? (
        <p className="text-ink-muted text-sm" role="status">
          Nothing was filed inside this visit&rsquo;s window.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((note) => (
            <li key={note.id} className="bg-line/60 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                  {note.authored ? (
                    <span aria-hidden="true" className="text-brand-600 text-[11px] font-semibold">
                      {note.author
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  ) : (
                    <FileText className="text-ink-muted size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                  )}
                  <span className="text-ink font-semibold">{note.author}</span>
                  <span className="text-ink-muted text-xs">{note.authorRole}</span>
                  {!note.authored && (
                    <span className="sr-only"> — generated from the visit record</span>
                  )}
                </p>
                <time
                  dateTime={note.isInstant ? note.at : `${visit.date}T${note.at}:00Z`}
                  className="text-ink-muted text-xs tabular-nums"
                >
                  {formatTime(visitNoteTime(note))}
                </time>
              </div>
              <p className="text-ink-muted mt-2 text-sm break-words">
                {note.authored ? `“${note.body}”` : note.body}
              </p>
              {note.flagged && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                  <TriangleAlert className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                  Flagged for review
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {all.length > shown.length && (
        <Link
          to={`/scheduling/visits/${visit.id}/notes`}
          className="text-brand-700 hover:text-brand-800 mt-3 inline-flex text-xs font-medium"
        >
          {all.length - shown.length} more on the Notes tab
        </Link>
      )}
    </Card>
  )
}

function OverviewTimeline({ context }: { context: VisitContext }) {
  const { timeline, visit } = context

  return (
    <Card title="Visit Timeline">
      {timeline.length === 0 ? (
        <p className="text-ink-muted text-sm" role="status">
          {visit.status === 'cancelled'
            ? 'The visit was cancelled, so no times were recorded against it.'
            : 'Nothing on this visit carries a time yet.'}
        </p>
      ) : (
        <ol className="space-y-4">
          {timeline.map((entry) => {
            const recorded = entry.source === 'record'
            return (
              <li key={entry.id} className="flex gap-3">
                {/* Filled for a recorded time, hollow for a rota time. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 size-2.5 shrink-0 rounded-full',
                    entry.next
                      ? 'border-brand-600 border-2 bg-white'
                      : recorded
                        ? 'bg-ink-subtle'
                        : 'border-ink-subtle border bg-white',
                  )}
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-semibold break-words',
                      entry.next ? 'text-brand-700' : 'text-ink',
                    )}
                  >
                    <span className="sr-only">{recorded ? 'Recorded: ' : 'Scheduled: '}</span>
                    {entry.label}
                    {entry.next && ' (next)'}
                  </p>
                  <p
                    className={cn(
                      'text-xs tabular-nums',
                      entry.next ? 'text-brand-700' : 'text-ink-muted',
                    )}
                  >
                    {formatTime(entry.at)}
                    {!recorded && ' · scheduled'}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

/* ----------------------------------- cards --------------------------------- */

function RecipientCard({ context }: { context: VisitContext }) {
  const { recipient, profile, primaryContact, family } = context
  const emergency =
    family.find((m) => m.roles.includes('Emergency Contact')) ?? primaryContact

  return (
    <Card
      title="Care Recipient"
      actions={
        <CardLink to={`/care-recipients/${recipient.id}`}>
          View Full Profile
          <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        </CardLink>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Initials name={recipient.name} />
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">{recipient.name}</p>
          <p className="text-ink-muted text-xs">
            Age {recipient.age}, {profile.sex}
          </p>
        </div>
      </div>
      <InfoRows
        rows={[
          { id: 'condition', label: 'Primary Condition', value: recipient.condition },
          { id: 'level', label: 'Care Level', value: recipient.careLevel },
          { id: 'address', label: 'Address', value: profile.personal.address },
          {
            id: 'contact',
            label: 'Emergency Contact',
            value: emergency
              ? `${emergency.name} (${emergency.relationship}) • ${emergency.phone}`
              : 'None on file',
          },
        ]}
      />
    </Card>
  )
}

function CaregiverCard({ context }: { context: VisitContext }) {
  const { caregiver, visit, progress } = context

  if (!caregiver) {
    return (
      <Card title="Assigned Caregiver">
        <p className="text-ink-muted text-sm" role="status">
          Nobody is assigned. {context.unassignedReason}
        </p>
        {visit.date >= TODAY && visit.status !== 'cancelled' && (
          <Link
            to={`/scheduling/visits/${visit.id}/assign`}
            className="bg-brand-600 hover:bg-brand-700 mt-3 inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-white"
          >
            Assign Caregiver
          </Link>
        )}
      </Card>
    )
  }

  const performance = performanceFor(caregiver)
  // "On Visit" only on a recorded clock-in inside the window — not on the
  // rota saying they should be there.
  const onVisit = progress.underway && progress.clockIn !== null

  return (
    <Card
      title="Assigned Caregiver"
      actions={
        <>
          <CardLink to={`/caregivers/${caregiver.id}/overview`}>
            View Profile
            <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          </CardLink>
          <span aria-hidden="true" className="bg-line h-4 w-px" />
          <Link
            to={`/messages?with=caregiver:${caregiver.id}`}
            className="text-brand-700 hover:text-brand-800 font-medium"
          >
            Message<span className="sr-only"> {caregiver.name}</span>
          </Link>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Initials name={caregiver.name} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-ink text-sm font-semibold break-words">{caregiver.name}</span>
            {onVisit && (
              <span className="bg-brand-50 text-brand-700 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
                On Visit
              </span>
            )}
          </p>
          <p className="text-ink-muted text-xs break-words">{caregiver.title}</p>
        </div>
      </div>
      <InfoRows
        rows={[
          {
            id: 'clock-in',
            label: 'Clock In',
            value: progress.clockIn ? formatTime(progress.clockIn) : 'Not recorded',
          },
          {
            id: 'performance',
            label: 'Performance',
            value:
              performance.rating === null ? 'No ratings yet' : `${performance.rating} / 5.0`,
          },
          { id: 'branch', label: 'Branch', value: caregiver.branch },
        ]}
      />
    </Card>
  )
}

/* --------------------------------- tasks tab ------------------------------- */

/**
 * The only tasks panel. Overview renders it plain; the Care tasks tab renders
 * it with the evidence attached. One component, so the two can never tell
 * different stories about a cancelled or unrecorded visit — which is exactly
 * what happened when there were two.
 */
function VisitTasksPanel({
  context,
  detailed = false,
}: {
  context: VisitContext
  detailed?: boolean
}) {
  const { tasks, visit, notes } = context
  const progress = taskProgress(tasks)
  const own = writtenByCaregiver(notes, visit)

  // The heading follows the visit, not the raw task state: an all-pending list
  // on a cancelled visit is not "still to do".
  const heading =
    visit.status === 'cancelled'
      ? 'Care tasks — visit cancelled'
      : isUnlogged(visit)
        ? 'Care tasks — never recorded'
        : 'Care tasks'

  const note =
    visit.status === 'cancelled'
      ? 'The visit was cancelled, so none of these ran.'
      : isUnlogged(visit)
        ? // Only the caregiver's own notes. A coordinator's phone note filed
          // during the window is not evidence anybody attended, and offering it
          // as such contradicted the timeline on the same screen.
          own.length > 0
          ? `No visit record was filed; ${own.length === 1 ? 'the caregiver’s note' : `${own.length} notes from the caregiver`} on the timeline ${own.length === 1 ? 'is' : 'are'} the only evidence.`
          : 'The window closed with no visit record, so nothing is known to have happened.'
        : progress.done === 0 && visit.date >= TODAY
          ? 'Nothing is ticked until somebody checks in.'
          : progress.done === 0
            ? 'Nothing was recorded against this visit.'
            : `The checklist for a ${visit.type.toLowerCase()} visit.`

  return (
    <Panel
      title={heading}
      badge={
        <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
          {progress.done} of {progress.total} done
        </span>
      }
      flush={detailed}
    >
      {detailed ? (
        <ul className="divide-line border-line divide-y border-t">
          {tasks.map((task) => (
            <TaskDetailRow key={task.id} task={task} visit={visit} notes={notes} />
          ))}
        </ul>
      ) : (
        <ul className="divide-line divide-y">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
      <p
        className={cn(
          'text-ink-subtle text-xs',
          detailed ? 'border-line border-t px-4 py-3' : 'mt-3',
        )}
      >
        {note} Progress is read off the clock — nothing records a task being
        ticked, so none of these carries a completion time or a sign-off.
      </p>
    </Panel>
  )
}

function TasksTab({ context }: { context: VisitContext }) {
  const { recipient, profile } = context

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <VisitTasksPanel context={context} detailed />
      </div>

      <Panel
        title="Care recipient"
        action={{ label: 'Open the care record', to: `/care-recipients/${recipient.id}` }}
      >
        <Rows
          rows={[
            {
              id: 'name',
              label: 'Name and age',
              value: `${recipient.name}, ${recipient.age}`,
            },
            { id: 'condition', label: 'Primary condition', value: recipient.condition },
            { id: 'level', label: 'Care level', value: recipient.careLevel },
            {
              id: 'secondary',
              label: 'Secondary diagnosis',
              value: profile.summary.secondaryDiagnosis,
            },
            {
              id: 'coordinator',
              label: 'Coordinator',
              value: profile.summary.coordinator,
            },
          ]}
        />
      </Panel>
    </div>
  )
}

/** Typed by DoseState, so a new state is a compile error, not a blank class. */
const doseTone: Record<DoseState, string> = {
  administered: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-sunken text-ink-muted',
  missed: 'bg-red-50 text-red-700',
}

function TaskDetailRow({
  task,
  visit,
  notes,
}: {
  task: VisitTask
  visit: BoardVisit
  notes: CareNoteEntry[]
}) {
  const detail = detailFor(task, visit, notes)

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium break-words">{task.label}</p>
          <p className="mt-1">
            <span className="bg-sunken text-ink-muted inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium">
              {task.category}
            </span>
          </p>
        </div>
        <span className="shrink-0">
          <TaskStateChip state={task.state} />
        </span>
      </div>

      {detail?.kind === 'medication' && (
        <div className="mt-2 space-y-2">
          {detail.doses.map((dose) => (
            <div key={dose.id} className="border-line rounded-lg border p-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-ink text-xs font-semibold">
                  {dose.title} · {dose.time}
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                    doseTone[dose.state],
                  )}
                >
                  {dose.state === 'administered'
                    ? `Given by ${dose.administeredBy}`
                    : dose.state === 'missed'
                      ? 'Missed'
                      : `Scheduled — ${dose.administeredBy}`}
                </span>
              </div>
              <p className="text-ink-muted mt-1 text-xs break-words">{dose.medications}</p>
            </div>
          ))}
          <p className="text-ink-subtle text-xs">
            {/* Not the day's plan — the part of it this visit covers. The
                client's own Medications tab lists all of them. */}
            The {detail.doses.length} of {detail.dosesThatDay} dose window
            {detail.dosesThatDay === 1 ? '' : 's'} on {formatFullDay(visit.date)} that
            this visit&rsquo;s {formatTime(visit.start)}–{formatTime(visit.end)} slot
            covers.
          </p>
        </div>
      )}

      {detail?.kind === 'vitals' && (
        <div className="mt-2">
          <ul className="flex flex-wrap gap-1.5">
            {detail.readings.map((v) => (
              <li key={v.id} className="border-line rounded-md border px-2 py-1 text-xs">
                <span className="text-ink-muted">{v.label} </span>
                <span className="text-ink font-semibold">
                  {v.value} {v.unit}
                </span>
                {/* The word, not just a colour. */}
                {v.status !== 'neutral' && (
                  <span
                    className={cn(
                      'ml-1',
                      v.status === 'watch' ? 'text-amber-700' : 'text-emerald-700',
                    )}
                  >
                    · {v.status === 'watch' ? 'watch' : 'normal'}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-ink-subtle mt-1.5 text-xs">
            The latest readings on {visit.recipientName}&rsquo;s health record — not
            captured on this visit.
          </p>
        </div>
      )}

      {detail?.kind === 'note' && (
        <div className="mt-2 space-y-2">
          {detail.notes.map((note) => (
            <div key={note.id} className="border-line rounded-lg border p-2.5">
              <p className="text-ink-subtle text-xs">
                {note.author} · {note.authorRole} · {formatNoteTime(note.at)} ·{' '}
                {noteCategoryLabels[note.category]}
              </p>
              <p className="text-ink-muted mt-1 text-xs break-words">{note.body}</p>
            </div>
          ))}
          <p className="text-ink-subtle text-xs">
            {/* The app does not link a note to a task; this is the write-up
                that falls inside the visit's window. */}
            From {visit.recipientName}&rsquo;s care notes, written inside this
            visit&rsquo;s window. Nothing links a note to a task.
          </p>
        </div>
      )}

      {detail === null && task.evidence !== 'none' && task.state !== 'pending' && (
        <p className="text-ink-subtle mt-2 text-xs">
          {task.evidence === 'note'
            ? `${visit.caregiverName ?? 'Nobody'} wrote nothing up inside this visit's window.`
            : task.evidence === 'medication'
              ? 'No dose window on the plan falls inside this visit.'
              : `Nothing on ${visit.recipientName}'s health record.`}
        </p>
      )}
    </li>
  )
}

function TaskStateChip({ state }: { state: VisitTask['state'] }) {
  const label = state === 'done' ? 'Done' : state === 'current' ? 'In progress' : 'Pending'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        state === 'done'
          ? 'bg-emerald-50 text-emerald-700'
          : state === 'current'
            ? 'bg-brand-50 text-brand-700'
            : 'bg-sunken text-ink-muted',
      )}
    >
      {state === 'done' && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
      {label}
    </span>
  )
}

/* -------------------------------- timeline tab ----------------------------- */

/** One timeline panel, rendered by the Overview and by the Timeline tab. */
function VisitTimelinePanel({
  context,
  detailed = false,
}: {
  context: VisitContext
  detailed?: boolean
}) {
  const { timeline, visit, notes } = context
  const recorded = timeline.filter((e) => e.source === 'record').length

  if (timeline.length === 0)
    return (
      <Panel title="Timeline">
        {/* Branch on the visit, not on an empty array — the array being empty
            was being *read* as "cancelled". And a cancelled visit can still
            have a note timestamped inside its window, which the Notes panel
            beside this one renders: saying "nothing to show" contradicted it
            on the same screen. */}
        <p className="text-ink-subtle text-sm" role="status">
          {visit.status === 'cancelled'
            ? notes.length > 0
              ? `The visit was cancelled, so no times were recorded against it. ${notes.length === 1 ? 'A note' : `${notes.length} notes`} filed in its window ${notes.length === 1 ? 'is' : 'are'} under Notes.`
              : 'The visit was cancelled, so no times were recorded against it.'
            : 'Nothing on this visit carries a time.'}
        </p>
      </Panel>
    )

  return (
    <Panel
      title="Timeline"
      badge={
        // Not "N recorded of M": a coordinator's note filed during the window
        // is a record, but not a record *of this visit*, and the shorter
        // wording invited that reading.
        <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
          {recorded} timestamped · {timeline.length - recorded} from the rota
        </span>
      }
      flush
    >
      <ol className="divide-line border-line divide-y border-t">
        {timeline.map((entry) => (
          <TimelineRow key={entry.id} entry={entry} detailed={detailed} />
        ))}
      </ol>
      <p className="text-ink-subtle border-line border-t px-4 py-3 text-xs">
        {/* The distinction the source design erased by calling the whole list
            "verified via GPS and manual logging". */}
        Solid markers are records with their own timestamp — a clock-in or
        clock-out, a medication round, a note. Hollow markers are times nobody
        recorded: the rota&rsquo;s start and finish, and any dose still only
        planned. Both clock times were typed onto a record; nothing behind them
        confirms an arrival or a departure, and no location is captured at
        either.
        {visit.date === TODAY && ` As at ${formatTime(NOW)}.`}
      </p>
    </Panel>
  )
}

const timelineIcons: Record<TimelineKind, LucideIcon> = {
  'scheduled-start': CalendarClock,
  'clock-in': LogIn,
  dose: Pill,
  note: FileText,
  'clock-out': LogOut,
  'scheduled-end': CalendarClock,
}

function TimelineRow({ entry, detailed }: { entry: TimelineEntry; detailed: boolean }) {
  const Icon = timelineIcons[entry.kind]
  const isRecord = entry.source === 'record'

  return (
    <li className="flex gap-3 p-4">
      <span className="flex shrink-0 flex-col items-center">
        {/* Filled for a record, hollow for a scheduled time — shape, not just
            colour. The fill is decorative, so the word goes in the
            accessibility tree. */}
        <span
          className={cn(
            'grid size-7 place-items-center rounded-full border',
            isRecord
              ? 'bg-brand-600 border-brand-600 text-white'
              : 'border-line text-ink-subtle bg-white',
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          <span className="sr-only">{isRecord ? 'Recorded: ' : 'Scheduled: '}</span>
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p
            className={cn(
              'min-w-0 text-sm break-words',
              entry.next ? 'text-brand-700 font-semibold' : 'text-ink',
            )}
          >
            {entry.label}
            {/* The detailed view carries a visible "Next due" below, so the
                sr-only copy would be read twice. */}
            {entry.next && !detailed && <span className="sr-only"> — next due</span>}
          </p>
          <p className="text-ink-subtle shrink-0 text-xs tabular-nums">
            {formatTime(entry.at)}
          </p>
        </div>
        {entry.detail && (
          <p className="text-ink-muted mt-0.5 text-xs break-words">{entry.detail}</p>
        )}
        {detailed && (
          <p className="text-ink-subtle mt-1 text-xs">
            <span
              className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold',
                isRecord ? 'bg-emerald-50 text-emerald-700' : 'bg-sunken text-ink-muted',
              )}
            >
              {isRecord ? 'Recorded' : 'Scheduled'}
            </span>
            {entry.next && (
              <span className="text-brand-700 ml-2 font-medium">Next due</span>
            )}
          </p>
        )}
      </div>
    </li>
  )
}

function TimelineTab({ context }: { context: VisitContext }) {
  const { visit, recipient, profile, primaryContact, caregiver } = context

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <VisitTimelinePanel context={context} detailed />
      </div>

      <div className="space-y-4">
        {/* A handover brief built from the care record, not an "ops manager on
            duty" and an "emergency dispatcher" the app has never heard of. */}
        <Panel
          title="Handover brief"
          action={{ label: 'Open the care record', to: `/care-recipients/${recipient.id}` }}
        >
          <Rows
            rows={[
              {
                id: 'diagnosis',
                label: 'Primary diagnosis',
                value: profile.summary.primaryDiagnosis,
              },
              {
                id: 'secondary',
                label: 'Secondary diagnosis',
                value: profile.summary.secondaryDiagnosis,
              },
              {
                id: 'coordinator',
                label: 'Coordinator',
                value: profile.summary.coordinator,
              },
              {
                id: 'caregiver',
                label: 'On this visit',
                value: caregiver
                  ? `${caregiver.name} · ${caregiver.branch}`
                  : 'Nobody assigned',
              },
              {
                id: 'emergency',
                label: 'Emergency contact',
                value: primaryContact
                  ? `${primaryContact.name} (${primaryContact.relationship}) · ${primaryContact.phone}`
                  : 'None on file',
              },
            ]}
          />
        </Panel>

        <Panel title="How this visit closes">
          <p className="text-ink-muted text-sm break-words">
            The rota has it finishing at {formatTime(visit.end)}.{' '}
            {context.progress.clockOut
              ? `A clock-out of ${formatTime(context.progress.clockOut)} was entered on the visit record — a typed time, with no location confirmation and no sign-off behind it.`
              : visit.logged
                ? 'No clock-out was entered on the visit record.'
                : 'No visit record was filed, so nothing closes it at all.'}{' '}
            Whether a record exists is the other half of the closing evidence,
            and it is what the &ldquo;Not written up&rdquo; badge tracks.
          </p>
        </Panel>
      </div>
    </div>
  )
}

/* -------------------------------- location tab ----------------------------- */

function LocationTab({ context }: { context: VisitContext }) {
  const { visit, caregiver } = context
  const place = placeOfRecipient(visit.recipientId)
  const travel = travelMiles(visit.caregiverId, visit.recipientId)
  const branch = caregiver?.branch ?? null
  const fromBranch = branchDistanceMiles(branch, visit.recipientId)

  // Three states, not two: "Window open" on a visit three weeks out read as
  // "in progress, not yet checked out". The end is unwrapped for an overnight
  // block, the way every other computation on this page does it.
  const startMin = minutesOfDay(formatTime(visit.start))
  // An overnight block's finish runs past 24:00; `nowMin` is always a
  // time-of-day on `visit.date`, so it is never the side that needs unwrapping
  // — a guard that added 24 hours to it called a 22:00 visit closed at noon.
  const endMin = startMin + Math.round(visit.durationHours * 60)
  const nowMin = minutesOfDay(formatTime(NOW))
  const windowState: 'closed' | 'open' | 'not-open' =
    visit.date < TODAY
      ? 'closed'
      : visit.date > TODAY
        ? 'not-open'
        : nowMin >= endMin
          ? 'closed'
          : nowMin >= startMin
            ? 'open'
            : 'not-open'
  const windowLabels = {
    closed: 'Window closed',
    open: 'Window open',
    'not-open': 'Not started yet',
  } as const
  const notYet = windowState === 'not-open'

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        {/* A cancelled visit was never due to be attended, and an unassigned
            one has no "they" to talk about. Every sibling tab branches on
            these; this one used to talk about a caregiver either way. */}
        {visit.status === 'cancelled' ? (
          <Panel title="Check-in and check-out">
            <p className="text-ink-muted text-sm break-words" role="status">
              The visit was cancelled, so no check-in was ever due and nothing
              closes it. The address and distances are still the client&rsquo;s.
            </p>
          </Panel>
        ) : visit.caregiverId === null ? (
          <Panel title="Check-in and check-out">
            <p className="text-ink-muted text-sm break-words" role="status">
              Nobody is on this visit, so there is no check-in to record.{' '}
              {context.unassignedReason}
            </p>
          </Panel>
        ) : (
          <>
            <Panel
              title="Check-in"
              badge={
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                    context.progress.clockIn
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-sunken text-ink-muted',
                  )}
                >
                  {/* Not "Verified" — a recorded time is not a verified one.
                      And the same three states as the Check-out badge below:
                      "No time recorded" on a visit next week read as a data
                      defect rather than as a visit that has not happened. */}
                  {context.progress.clockIn
                    ? 'Time recorded'
                    : notYet
                      ? 'Not started yet'
                      : 'No time recorded'}
                </span>
              }
            >
              <Rows
                rows={[
                  {
                    id: 'scheduled',
                    label: 'Scheduled start',
                    value: formatTime(visit.start),
                  },
                  {
                    id: 'clockin',
                    label: 'Clock-in on the visit record',
                    value: context.progress.clockIn
                      ? formatTime(context.progress.clockIn)
                      : notYet
                        ? 'Not due yet'
                        : 'Not recorded',
                  },
                  {
                    id: 'variance',
                    label: 'Difference',
                    value: context.progress.clockIn
                      ? describeArrival(visit.start, context.progress.clockIn)
                      : 'Nothing to compare',
                  },
                  {
                    // The row the mockup filled with "45m (Within Range)".
                    id: 'where',
                    label: 'Where they checked in from',
                    value: 'Not captured',
                  },
                ]}
              />
              <p className="text-ink-subtle mt-3 text-xs">
                A clock-in is a time somebody entered on the visit record.
                Nothing confirms where it was entered from, or that anyone
                arrived.
              </p>
            </Panel>

            <Panel
              title="Check-out"
              badge={
                <span className="bg-sunken text-ink-muted inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
                  {windowLabels[windowState]}
                </span>
              }
            >
              <Rows
                rows={[
                  { id: 'end', label: 'Scheduled finish', value: formatTime(visit.end) },
                  {
                    // The record does carry this. Dropping it while showing the
                    // clock-in let this panel claim the app captures no
                    // checkout at all, while the client's own Visits tab
                    // printed one.
                    id: 'clockout',
                    label: 'Clock-out on the visit record',
                    value: context.progress.clockOut
                      ? formatTime(context.progress.clockOut)
                      : notYet
                        ? 'Not due yet'
                        : 'Not recorded',
                  },
                  {
                    id: 'variance',
                    label: 'Difference',
                    value: context.progress.clockOut
                      ? describeDeparture(visit.end, context.progress.clockOut)
                      : 'Nothing to compare',
                  },
                  {
                    id: 'record',
                    label: 'Visit record',
                    value: visit.logged ? 'On file' : 'None filed',
                  },
                  {
                    id: 'confirm',
                    label: 'Departure confirmation',
                    value: 'Not captured',
                  },
                ]}
              />
              <p className="text-ink-subtle mt-3 text-xs">
                A clock-out is a typed time, the same as the clock-in — no tap,
                no photo, no signature stands behind it. That and whether a
                record was filed are the only closing evidence, and the record is
                what the &ldquo;Not written up&rdquo; badge tracks.
              </p>
            </Panel>
          </>
        )}

        <Panel title="What this app does not capture">
          {/* Named rather than quietly omitted: the mockup showed all four of
              these as live, verified facts. */}
          <NotCapturedList />
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="The address and its boundary">
          <VisitLocationMap visit={visit} />
        </Panel>

        <Panel title="Distances">
          <Rows
            rows={[
              { id: 'address', label: 'Address', value: place?.address ?? 'Not on file' },
              {
                id: 'travel',
                label: 'Caregiver’s home to here, straight line',
                value:
                  travel !== null
                    ? formatMiles(travel)
                    : visit.caregiverId === null
                      ? 'No caregiver assigned'
                      : 'No coordinates on file',
              },
              {
                id: 'branch',
                label: 'Branch to here, straight line',
                value:
                  fromBranch !== null
                    ? `${formatMiles(fromBranch)} from ${branch}`
                    : branch === null
                      ? 'No caregiver, so no branch'
                      : 'No coordinates on file',
              },
            ]}
          />
          <p className="text-ink-subtle mt-3 text-xs">
            Between two addresses, not road distance and not a journey time.{' '}
            <Link to="/live-monitoring?view=map" className="text-brand-700">
              See every visit on the map
            </Link>
            .
          </p>
        </Panel>
      </div>
    </div>
  )
}

/* ----------------------------------- tabs ---------------------------------- */

function RecipientTab({ context }: { context: VisitContext }) {
  const { recipient, profile, family } = context

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <RecipientCard context={context} />
        <Panel title="At the address">
          {/* No care status row here — the card above already carries it, and
              two of them a few hundred pixels apart is a contradiction waiting
              to happen. */}
          <Rows
            rows={[
              { id: 'address', label: 'Address', value: profile.personal.address },
              { id: 'phone', label: 'Phone', value: profile.personal.phone },
              { id: 'email', label: 'Email', value: profile.personal.email },
            ]}
          />
        </Panel>
      </div>

      <Panel
        title="Who to call"
        badge={
          <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
            {family.length} contact{family.length === 1 ? '' : 's'}
          </span>
        }
        action={{
          label: 'Open the family record',
          to: `/care-recipients/${recipient.id}/family`,
        }}
      >
        {family.length === 0 ? (
          <p className="text-ink-subtle text-sm" role="status">
            No family contact is on file for {recipient.name}.
          </p>
        ) : (
          <ul className="divide-line divide-y">
            {family.map((member) => (
              <li key={member.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-ink text-sm font-semibold break-words">
                  {member.name}
                  <span className="text-ink-subtle ml-2 text-xs font-normal">
                    {member.relationship}
                  </span>
                </p>
                <p className="text-ink-muted mt-0.5 text-sm break-words">
                  {member.phone} · prefers {member.preferred.toLowerCase()}
                </p>
                <p className="text-ink-subtle mt-0.5 text-xs break-words">
                  {member.roles.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function CaregiverTab({ context }: { context: VisitContext }) {
  const { caregiver, visit } = context

  if (!caregiver)
    return (
      <div className="max-w-2xl">
        <CaregiverCard context={context} />
      </div>
    )

  const asAt = visit.date > TODAY ? visit.date : TODAY
  const compliance = complianceFor(caregiver, asAt)
  const credentials = credentialStates(caregiver, asAt)
  // The rest of their day, so a coordinator can see what reassigning costs.
  const sameDay = boardOn(visit.date).filter(
    (v) => v.caregiverId === caregiver.id && v.id !== visit.id,
  )

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <CaregiverCard context={context} />
      </div>

      <div className="space-y-4">
        <Panel
          title="Credentials"
          badge={
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                tonePill[
                  compliance === 'expired'
                    ? 'red'
                    : compliance === 'expiring'
                      ? 'amber'
                      : 'green'
                ],
              )}
            >
              {compliance === 'expired'
                ? 'Lapsed'
                : compliance === 'expiring'
                  ? 'Renewal due'
                  : 'In date'}
            </span>
          }
          action={{
            label: 'Open their documents',
            to: `/caregivers/${caregiver.id}/documents`,
          }}
        >
          <ul className="divide-line divide-y">
            {credentials.map((c) => (
              <li
                key={c.credential.id}
                className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-ink min-w-0 text-sm break-words">
                  {c.credential.name}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold',
                    c.state === 'expired'
                      ? 'text-red-700'
                      : c.state === 'expiring'
                        ? 'text-amber-700'
                        : 'text-emerald-700',
                  )}
                >
                  {c.state === 'expired'
                    ? 'Lapsed'
                    : c.state === 'expiring'
                      ? 'Renewal due'
                      : 'In date'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={`Rest of their ${visit.day}`}>
          {sameDay.length === 0 ? (
            <p className="text-ink-subtle text-sm" role="status">
              This is {caregiver.name}&rsquo;s only visit on {formatFullDay(visit.date)}.
            </p>
          ) : (
            <ul className="divide-line divide-y">
              {sameDay.map((other) => (
                <li key={other.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    to={`/scheduling/visits/${other.id}/overview`}
                    className="text-ink hover:text-brand-700 text-sm font-medium break-words"
                  >
                    {formatTime(other.start)} – {formatTime(other.end)} ·{' '}
                    {other.recipientName}
                  </Link>
                  <p className="text-ink-subtle mt-0.5 text-xs break-words">
                    {other.type}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function CarePlanTab({ context }: { context: VisitContext }) {
  const { carePlan, recipient, visit } = context

  if (!carePlan) {
    return (
      <p className="text-ink-subtle max-w-2xl text-sm" role="status">
        No care plan is recorded for {recipient.name}.{' '}
        <Link
          to={`/care-recipients/${recipient.id}/care-plan`}
          className="text-brand-700 font-medium"
        >
          Open the care plan tab
        </Link>
        .
      </p>
    )
  }

  const critical = [...carePlan.medicalNeeds, ...carePlan.behavioural].filter(
    (i) => i.level !== 'standard',
  )

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel
        title="Goals"
        action={{
          label: 'Open the full plan',
          to: `/care-recipients/${recipient.id}/care-plan`,
        }}
      >
        <ul className="divide-line divide-y">
          {carePlan.goals.map((goal) => (
            <li key={goal.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-ink min-w-0 text-sm font-medium break-words">
                  {goal.title}
                </p>
                {/* The status in words as well as colour — a 92% amber bar and
                    a 92% green bar are the same bar without colour vision. */}
                <p className="text-ink-muted shrink-0 text-xs">
                  <span className="tabular-nums">{goal.percent}%</span> ·{' '}
                  {goalStatusLabels[goal.status]}
                </p>
              </div>
              {/* Same role, same colours and same words as the care record's
                  own goal bars — both read the shared maps. */}
              <div
                role="progressbar"
                aria-valuenow={goal.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${goal.title}: ${goalStatusLabels[goal.status]}`}
                className="bg-sunken mt-1.5 h-1.5 overflow-hidden rounded-full"
              >
                <div
                  className={cn('h-full rounded-full', goalBarFill[goal.status])}
                  style={{ width: `${goal.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-4">
        <Panel title="Daily routine">
          <ul className="divide-line divide-y">
            {carePlan.schedule.map((entry) => (
              <li key={entry.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-ink-muted w-20 shrink-0 text-xs tabular-nums">
                  {entry.time}
                </span>
                <span className="min-w-0">
                  <span className="text-ink block text-sm break-words">{entry.title}</span>
                  <span className="text-ink-subtle block text-xs break-words">
                    {entry.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {critical.length > 0 && (
          <Panel title="Standing instructions">
            {/* Only the caution and critical lines — the routine ones are on
                the care record, and a visit screen that repeats all of them
                buries the two that matter. */}
            <ul className="space-y-2">
              {critical.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-lg border p-3 text-sm break-words',
                    item.level === 'critical'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900',
                  )}
                >
                  <span className="mr-1.5 text-xs font-semibold uppercase">
                    {item.level}
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <p className="text-ink-subtle text-xs">
          The plan is owned by the care record; this is the part that bears on a{' '}
          {visit.type.toLowerCase()} visit.
        </p>
      </div>
    </div>
  )
}

function isNoteKind(value: string): value is VisitNoteKind {
  return visitNoteKinds.some((k) => k.value === value)
}

/** How many rows the Overview shows before deferring to the tab. */
const OVERVIEW_NOTES = 3

/**
 * The list, shared by the Overview panel and the Notes tab. The Overview
 * passes a limit and gets no chips; the tab gets the filter row and the
 * footnote.
 */
function VisitNotesPanel({
  context,
  limit,
}: {
  context: VisitContext
  limit?: number
}) {
  const { notes, recipient, visit } = context
  const [params, setParams] = useSearchParams()
  const filterable = limit === undefined

  const all = useMemo(() => visitNotesFor(visit, notes), [visit, notes])
  const raw = params.get('notes') ?? 'all'
  const kind: VisitNoteKind | 'all' =
    filterable && isNoteKind(raw) ? raw : 'all'
  const counts = useMemo(() => countVisitNotes(all), [all])
  const matching = useMemo(() => filterVisitNotes(all, kind), [all, kind])
  const shown = limit === undefined ? matching : matching.slice(0, limit)

  const setKind = (next: VisitNoteKind | 'all') => {
    const nextParams = new URLSearchParams(params)
    if (next === 'all') nextParams.delete('notes')
    else nextParams.set('notes', next)
    setParams(nextParams, { replace: true })
  }

  const authored = counts.all - counts.record

  const empty = (
    <p className="text-ink-subtle text-sm" role="status">
      {visit.status === 'cancelled'
        ? 'The visit was cancelled, so nothing was filed against its window. '
        : visit.caregiverName
          ? `Nothing was filed for ${recipient.name} inside this visit's window — no note, no clock time, no medication round. `
          : `No caregiver is on this visit, and nothing was filed for ${recipient.name} inside its window. `}
      <Link
        to={`/care-recipients/${recipient.id}/notes`}
        className="text-brand-700 font-medium"
      >
        See every note on the care record
      </Link>
      .
    </p>
  )

  const body = (
    <>
      {/* A cancelled visit's notes are still notes, but "On this visit" on a
          row belonging to a visit nobody attended reads as attendance. */}
      {visit.status === 'cancelled' && all.length > 0 && (
        <p className="border-line text-ink-muted mb-3 rounded-lg border p-3 text-sm">
          The visit was cancelled and nobody attended. These were filed against
          its window.
        </p>
      )}

      {filterable && (
        /*
          Chips, not a "+ Add Coordinator Note" button. Nothing in this app
          writes a note, so an enabled compose button would be the one control
          on the screen promising an action it cannot perform.
        */
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterChip
            label="Everything"
            count={counts.all}
            selected={kind === 'all'}
            onSelect={() => setKind('all')}
          />
          {visitNoteKinds
            // A chip that would empty the list is not offered.
            .filter((k) => counts[k.value] > 0)
            .map((k) => (
              <FilterChip
                key={k.value}
                label={k.label}
                count={counts[k.value]}
                selected={kind === k.value}
                onSelect={() => setKind(k.value)}
              />
            ))}
        </div>
      )}

      {/* Reachable by URL even though no chip offers it: `?notes=record` on a
          visit with no record entries used to render an empty list and no
          explanation. */}
      {shown.length === 0 ? (
        <p className="text-ink-subtle text-sm" role="status">
          Nothing here is {visitNoteKindLabels[kind as VisitNoteKind]?.toLowerCase()}.{' '}
          <button
            type="button"
            onClick={() => setKind('all')}
            className="text-brand-700 font-medium underline-offset-2 hover:underline"
          >
            Show all {counts.all}
          </button>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((note) => (
            <VisitNoteRow key={note.id} note={note} date={visit.date} />
          ))}
        </ul>
      )}

      {limit !== undefined && matching.length > limit && (
        <p className="text-ink-subtle mt-3 text-xs">
          {matching.length - limit} more on the Notes tab.
        </p>
      )}

      {filterable && (
        <p className="text-ink-subtle mt-4 text-xs">
          {authored > 0 && (
            <>
              Notes filed between {formatTime(visit.start)} and{' '}
              {formatTime(visit.end)}, give or take an hour
              {counts.record > 0 ? ', plus the times the visit record carries' : ''}
              . Nothing attaches a note to a visit in this app — these are
              records that fall in the window, which is why each row says who
              wrote it and where it came from.{' '}
            </>
          )}
          {authored === 0 && (
            <>
              Nobody wrote a note inside this visit&rsquo;s window. Every row
              here is generated from the visit record, not typed by a person.{' '}
            </>
          )}
          <Link
            to={`/care-recipients/${recipient.id}/notes`}
            className="text-brand-700 font-medium"
          >
            Every note on the care record
          </Link>
          .
        </p>
      )}
    </>
  )

  // The tab is the list on its own; the Overview wraps it in a panel with a
  // way through to the tab.
  if (filterable) return <div className="max-w-3xl">{all.length === 0 ? empty : body}</div>

  return (
    <Panel
      title="Filed in this window"
      badge={
        all.length > 0 ? (
          <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
            {authored} written · {counts.record} from the record
          </span>
        ) : undefined
      }
      action={{
        label: 'Open the Notes tab',
        to: `/scheduling/visits/${visit.id}/notes`,
      }}
    >
      {all.length === 0 ? empty : body}
    </Panel>
  )
}

function NotesTab({ context }: { context: VisitContext }) {
  return <VisitNotesPanel context={context} />
}

function FilterChip({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string
  count: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-control text-ink-muted hover:bg-sunken',
      )}
    >
      {label}
      {/* Full-strength white: at 14px the 80% tint fell under AA on
          brand-600, and it is the only part of the chip carrying a number. */}
      <span className={cn('tabular-nums', selected ? 'text-white' : 'text-ink-subtle')}>
        {count}
      </span>
    </button>
  )
}

function VisitNoteRow({ note, date }: { note: VisitNote; date: string }) {
  return (
    <li
      className={cn(
        'card p-4',
        // Shape, not colour alone: a flagged note keeps its left rule.
        note.flagged && 'border-l-4 border-l-red-500',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* No avatar on a generated entry — the source design gave the
              system check-in a photograph and a job title. */}
          {note.authored ? (
            <Avatar name={note.author} decorative className="size-9 shrink-0" />
          ) : (
            <span
              aria-hidden="true"
              className="border-line text-ink-subtle grid size-9 shrink-0 place-items-center rounded-full border"
            >
              <FileText className="size-4" strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-ink text-sm font-semibold break-words">
              {note.author}
              {!note.authored && (
                <span className="sr-only"> — generated, not written by a person</span>
              )}
            </p>
            <p className="text-ink-subtle text-xs break-words">{note.authorRole}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
              tonePill[visitNoteKindTones[note.kind]],
            )}
          >
            {visitNoteKindLabels[note.kind]}
          </span>
          <time
            dateTime={note.isInstant ? note.at : `${date}T${note.at}:00Z`}
            className="text-ink-subtle text-xs tabular-nums"
          >
            {formatTime(visitNoteTime(note))}
          </time>
        </div>
      </div>

      <p className="text-ink-muted mt-2.5 text-sm break-words">{note.body}</p>

      <div className="border-line text-ink-subtle mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-xs">
        {note.categoryLabel && <span>{note.categoryLabel}</span>}
        {note.flagged && (
          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
            <TriangleAlert className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
            {/* Same words as the care record's own card and the caregiver's
                Notes tab — one flag should not have three names. */}
            Flagged for review
          </span>
        )}
        {note.outside && <span>Filed outside the scheduled window</span>}
        {/* Where the row came from, in place of Acknowledge / Reply / Flag —
            none of which the app can store. */}
        <span className="ml-auto">{note.source}</span>
      </div>
    </li>
  )
}

function HistoryTab({ context }: { context: VisitContext }) {
  const others = historyFor(context.visit)

  if (others.length === 0)
    return (
      <p className="text-ink-subtle max-w-2xl text-sm" role="status">
        {context.recurrence
          ? `No other occurrence of this slot in the ${HISTORY_WEEKS} weeks before this visit.`
          : 'This visit does not recur, so it has no earlier occurrences.'}
      </p>
    )

  /*
   * The window is the four weeks before *this visit*, which for a visit in the
   * future contains dates that have not happened yet. Listing those beside
   * completed ones under one "History" heading made an upcoming visit read as
   * a finished one, so they are separated rather than clamped away — clamping
   * emptied the tab for any visit more than four weeks out.
   */
  const run = others.filter((v) => v.date < TODAY)
  const toCome = others.filter((v) => v.date >= TODAY)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {run.length > 0 && (
        <OccurrenceList
          title="Already run"
          visits={run}
          note={`${run.length} occurrence${run.length === 1 ? '' : 's'} of this slot in the ${HISTORY_WEEKS} weeks before ${formatFullDay(context.visit.date)}.`}
        />
      )}
      {toCome.length > 0 && (
        <OccurrenceList
          title="Still to come"
          visits={toCome}
          note={`${toCome.length} occurrence${toCome.length === 1 ? '' : 's'} between today and this visit.`}
        />
      )}
    </div>
  )
}

function OccurrenceList({
  title,
  visits,
  note,
}: {
  title: string
  visits: BoardVisit[]
  note: string
}) {
  return (
    <Panel title={title} flush>
      <ul className="divide-line border-line divide-y border-t">
        {visits.map((other) => (
          <li key={other.id} className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Link
                to={`/scheduling/visits/${other.id}/overview`}
                className="text-ink hover:text-brand-700 min-w-0 text-sm font-semibold break-words"
              >
                {formatFullDay(other.date)}
              </Link>
              <RowStatus visit={other} />
            </div>
            <p className="text-ink-muted mt-1 text-sm break-words">
              {formatTime(other.start)} – {formatTime(other.end)} · {other.type} ·{' '}
              {other.durationHours}h
            </p>
          </li>
        ))}
      </ul>
      <p className="text-ink-subtle border-line border-t px-4 py-3 text-xs">
        {note} Counted from the rota.
      </p>
    </Panel>
  )
}
