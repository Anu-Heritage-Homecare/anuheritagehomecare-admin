import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  CircleCheck,
  FileText,
  Flag,
  Loader2,
  Plus,
  TriangleAlert,
} from 'lucide-react'
import {
  useVisitDetail,
  type VisitDetailView,
  type VisitNote,
  type VisitTask,
} from '@/features/scheduling/useVisitDetail'
import { useSchedulingMutations } from '@/features/scheduling/useSchedulingMutations'
import { Panel } from '@/components/ui/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { toPriority } from '@/features/scheduling/useScheduling'

const tabs = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'recipient', label: 'Recipient' },
  { slug: 'caregiver', label: 'Caregiver' },
  { slug: 'care-plan', label: 'Care Plan' },
  { slug: 'notes', label: 'Notes' },
  { slug: 'history', label: 'History' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

function isTab(value: string | undefined): value is TabSlug {
  return tabs.some((t) => t.slug === value)
}

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  ON_BREAK: 'bg-blue-50 text-blue-700',
  SCHEDULED: 'bg-sunken text-ink-muted',
  CANCELLED: 'bg-red-50 text-red-700',
  MISSED: 'bg-amber-50 text-amber-700',
}

function StatusTag({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        STATUS_TONE[status] ?? 'bg-sunken text-ink-muted',
      )}
    >
      {label}
    </span>
  )
}

export function VisitDetailsPage() {
  const { visitId, tab } = useParams()
  const navigate = useNavigate()
  const detail = useVisitDetail(visitId)
  const { cancel } = useSchedulingMutations()

  if (!isTab(tab)) {
    return <Navigate to={`/scheduling/visits/${encodeURIComponent(visitId ?? '')}/overview`} replace />
  }

  if (detail.isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading visit…
      </div>
    )
  }
  if (detail.isError) {
    return (
      <div className="card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load this visit.</p>
        <p className="text-ink-subtle text-sm">{detail.error.message}</p>
        <button
          type="button"
          onClick={() => void detail.refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  const visit = detail.data
  const { actions } = visit

  const secondaryBtn =
    'border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium disabled:cursor-default disabled:opacity-50'

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
              <Link to={`/scheduling?date=${visit.overview.information.date}`} className="hover:text-ink">
                Schedule
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
            <StatusTag status={visit.status} label={visit.statusLabel} />
            <span className="text-ink-subtle text-sm">{visit.reference}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!actions.canEdit} className={secondaryBtn}>
              Edit Visit
            </button>
            {actions.canReassign && (
              <Link to={`/scheduling/visits/${visit.id}/assign`} className={secondaryBtn}>
                {visit.caregiver ? 'Reassign Caregiver' : 'Assign Caregiver'}
              </Link>
            )}
            {actions.canCancel && (
              <button
                type="button"
                disabled={cancel.isPending}
                onClick={() => {
                  if (!visitId) return
                  cancel.mutate(visitId, { onSuccess: () => navigate('/scheduling') })
                }}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-600 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-default disabled:opacity-50"
              >
                {cancel.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
                Cancel Visit
              </button>
            )}
          </div>
        </div>

        {!visit.caregiver && (
          <p className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span>Nobody is on this visit.</span>
          </p>
        )}
      </div>

      <nav
        aria-label="Visit record"
        className="border-line no-scrollbar flex gap-2 overflow-x-auto border-b"
      >
        {tabs.map((t) => {
          const selected = t.slug === tab
          return (
            <Link
              key={t.slug}
              to={`/scheduling/visits/${visit.id}/${t.slug}`}
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

      {tab === 'overview' && <Overview visit={visit} />}
      {tab === 'recipient' && <RecipientTab visit={visit} />}
      {tab === 'caregiver' && <CaregiverTab visit={visit} />}
      {tab === 'care-plan' && <CarePlanTab visit={visit} />}
      {tab === 'notes' && <NotesTab visit={visit} />}
      {tab === 'history' && <HistoryTab visit={visit} />}
    </div>
  )
}

/* ---------------------------------- shared --------------------------------- */

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

function InfoRows({ rows }: { rows: { id: string; label: string; value: React.ReactNode }[] }) {
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

function Rows({ rows }: { rows: { id: string; label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-line divide-y">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-ink-muted min-w-0 text-sm">{row.label}</dt>
          <dd className="text-ink min-w-0 text-right text-sm font-medium break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* --------------------------------- overview -------------------------------- */

function Overview({ visit }: { visit: VisitDetailView }) {
  const info = visit.overview.information

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-3">
        <Card title="Visit Information">
          <InfoRows
            rows={[
              { id: 'ref', label: 'Visit ID', value: visit.reference },
              { id: 'date', label: 'Date', value: info.date },
              { id: 'time', label: 'Time', value: `${info.time} - ${info.endTime}` },
              {
                id: 'duration',
                label: 'Duration',
                value: `${info.durationHours} hour${info.durationHours === 1 ? '' : 's'}`,
              },
              { id: 'service', label: 'Service Type', value: info.serviceType },
              {
                id: 'priority',
                label: 'Priority',
                value: <PriorityBadge priority={toPriority(info.priority)} square />,
              },
              {
                id: 'status',
                label: 'Status',
                value: <StatusTag status={visit.status} label={visit.statusLabel} />,
              },
              { id: 'location', label: 'Location', value: info.location },
              { id: 'recurring', label: 'Recurring', value: info.recurring },
            ]}
          />
        </Card>

        <OverviewTasks visit={visit} />
        <OverviewNotes visit={visit} />
      </div>

      <div className="space-y-5 xl:col-span-2">
        <RecipientCard visit={visit} />
        <CaregiverCard visit={visit} />
        <RelatedVisits visit={visit} />
      </div>
    </div>
  )
}

function OverviewTasks({ visit }: { visit: VisitDetailView }) {
  const { tasks } = visit.overview
  return (
    <Card
      title="Visit Tasks"
      actions={
        <span className="bg-sunken text-ink-muted rounded-md px-2 py-0.5 text-xs font-medium">
          {tasks.completed} of {tasks.total} completed
        </span>
      }
    >
      {tasks.items.length === 0 ? (
        <p className="text-ink-muted text-sm" role="status">
          No tasks on this visit.
        </p>
      ) : (
        <ul className="divide-line/60 divide-y">
          {tasks.items.map((task, i) => (
            <TaskRow key={`${task.label}-${i}`} task={task} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function TaskRow({ task }: { task: VisitTask }) {
  const done = task.completed
  const inProgress = task.status === 'IN_PROGRESS'
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      {done ? (
        <CircleCheck className="size-5 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden="true" />
      ) : inProgress ? (
        <Circle className="text-brand-600 size-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Circle className="text-line size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
      )}
      <span
        className={cn(
          'min-w-0 flex-1 text-sm break-words',
          done || inProgress ? 'text-ink' : 'text-ink-muted',
          inProgress && 'font-medium',
        )}
      >
        {task.label}
        {task.scheduledTime && <span className="text-ink-subtle"> · {task.scheduledTime}</span>}
      </span>
      <span
        className={cn(
          'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
          done
            ? 'bg-emerald-50 text-emerald-700'
            : inProgress
              ? 'bg-brand-50 text-brand-700'
              : 'bg-sunken text-ink-muted',
        )}
      >
        {done ? 'Completed' : inProgress ? 'In Progress' : 'Pending'}
      </span>
    </li>
  )
}

function OverviewNotes({ visit }: { visit: VisitDetailView }) {
  const shown = visit.overview.notes.slice(0, 3)
  return (
    <Card title="Visit Notes">
      {shown.length === 0 ? (
        <p className="text-ink-muted text-sm" role="status">
          No notes on this visit yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((note) => (
            <NoteBlock key={note.id} note={note} />
          ))}
        </ul>
      )}
      {visit.notes.counts.all > shown.length && (
        <Link
          to={`/scheduling/visits/${visit.id}/notes`}
          className="text-brand-700 hover:text-brand-800 mt-3 inline-flex text-xs font-medium"
        >
          {visit.notes.counts.all - shown.length} more on the Notes tab
        </Link>
      )}
    </Card>
  )
}

function NoteBlock({ note }: { note: VisitNote }) {
  return (
    <li className="bg-line/60 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
          <FileText className="text-ink-muted size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-ink font-semibold">{note.authorName}</span>
          <span className="text-ink-muted text-xs">{note.authorRole}</span>
        </p>
        <time className="text-ink-muted text-xs tabular-nums">{note.at}</time>
      </div>
      <p className="text-ink-muted mt-2 text-sm break-words">{note.text}</p>
      {note.flaggedForCoordinator && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
          <TriangleAlert className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          Flagged for review
        </p>
      )}
    </li>
  )
}

function RelatedVisits({ visit }: { visit: VisitDetailView }) {
  const { previous, next } = visit.relatedVisits
  const items = [previous, next].filter((v): v is NonNullable<typeof v> => v !== null)
  return (
    <Card title="Related Visits">
      {items.length === 0 ? (
        <p className="text-ink-muted text-sm" role="status">
          No other related visits.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((other) => (
            <li
              key={other.id}
              className="bg-sunken flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5"
            >
              <Link
                to={`/scheduling/visits/${other.id}/overview`}
                className="text-ink hover:text-brand-700 text-sm font-semibold break-words"
              >
                {other.label}: {other.date}
              </Link>
              <StatusTag status={other.status} label={other.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ----------------------------------- cards --------------------------------- */

function RecipientCard({ visit }: { visit: VisitDetailView }) {
  const r = visit.recipient
  return (
    <Card
      title="Care Recipient"
      actions={
        <Link
          to={`/care-recipients/${r.id}`}
          className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 font-medium"
        >
          View Full Profile
          <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        </Link>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={r.name} decorative className="size-10 shrink-0 text-sm" />
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">{r.name}</p>
          <p className="text-ink-muted text-xs">
            {r.age === null ? '' : `Age ${r.age}, `}
            {r.gender}
          </p>
        </div>
      </div>
      <InfoRows
        rows={[
          { id: 'condition', label: 'Primary Condition', value: r.primaryCondition ?? '—' },
          { id: 'level', label: 'Care Level', value: r.careLevel ?? '—' },
          { id: 'address', label: 'Address', value: r.address },
          {
            id: 'contact',
            label: 'Emergency Contact',
            value: r.emergencyContact
              ? `${r.emergencyContact.name}${r.emergencyContact.relationship ? ` (${r.emergencyContact.relationship})` : ''} • ${r.emergencyContact.phone}`
              : 'None on file',
          },
        ]}
      />
    </Card>
  )
}

function CaregiverCard({ visit }: { visit: VisitDetailView }) {
  const c = visit.caregiver

  if (!c) {
    return (
      <Card title="Assigned Caregiver">
        <p className="text-ink-muted text-sm" role="status">
          Nobody is assigned.
        </p>
        {visit.actions.canReassign && (
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

  return (
    <Card
      title="Assigned Caregiver"
      actions={
        <Link
          to={`/caregivers/${c.id}/overview`}
          className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 font-medium"
        >
          View Profile
          <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        </Link>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={c.name} decorative className="size-10 shrink-0 text-sm" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-ink text-sm font-semibold break-words">{c.name}</span>
            {c.onVisit && (
              <span className="bg-brand-50 text-brand-700 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
                On Visit
              </span>
            )}
          </p>
          <p className="text-ink-muted text-xs break-words">{c.title ?? '—'}</p>
        </div>
      </div>
      <InfoRows
        rows={[
          { id: 'clock-in', label: 'Clock In', value: c.clockIn ?? 'Not recorded' },
          {
            id: 'performance',
            label: 'Performance',
            value: c.performanceRating === null ? 'No ratings yet' : `${c.performanceRating} / 5.0`,
          },
          { id: 'branch', label: 'Branch', value: c.branch ?? '—' },
        ]}
      />
    </Card>
  )
}

/* ----------------------------------- tabs ---------------------------------- */

function RecipientTab({ visit }: { visit: VisitDetailView }) {
  const r = visit.recipient
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <RecipientCard visit={visit} />
        <Panel title="Health">
          <Rows
            rows={[
              {
                id: 'conditions',
                label: 'Conditions',
                value: r.conditions.length ? r.conditions.join(', ') : '—',
              },
              {
                id: 'allergies',
                label: 'Allergies',
                value: r.allergies.length ? r.allergies.join(', ') : '—',
              },
              {
                id: 'needs',
                label: 'Care needs',
                value: r.careNeeds.length ? r.careNeeds.join(', ') : '—',
              },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Medications">
        {r.medications.length === 0 ? (
          <p className="text-ink-subtle text-sm" role="status">
            No medications on file.
          </p>
        ) : (
          <ul className="divide-line divide-y">
            {r.medications.map((m, i) => (
              <li key={`${m.name}-${i}`} className="py-3 first:pt-0 last:pb-0">
                <p className="text-ink text-sm font-semibold break-words">
                  {m.name}
                  {m.dose && <span className="text-ink-subtle ml-2 text-xs font-normal">{m.dose}</span>}
                </p>
                {m.times.length > 0 && (
                  <p className="text-ink-muted mt-0.5 text-sm break-words">{m.times.join(', ')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function CaregiverTab({ visit }: { visit: VisitDetailView }) {
  return (
    <div className="max-w-2xl">
      <CaregiverCard visit={visit} />
    </div>
  )
}

function CarePlanTab({ visit }: { visit: VisitDetailView }) {
  const p = visit.carePlan
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Care Plan">
        <Rows
          rows={[
            { id: 'service', label: 'Service type', value: p.serviceType },
            { id: 'frequency', label: 'Frequency', value: p.frequency ?? '—' },
            { id: 'days', label: 'Days', value: p.days.length ? p.days.join(', ') : '—' },
            { id: 'start', label: 'Start time', value: p.startTime ?? '—' },
            {
              id: 'duration',
              label: 'Duration',
              value: `${p.durationHours} hour${p.durationHours === 1 ? '' : 's'}`,
            },
            { id: 'expected', label: 'Expected duration', value: p.expectedDuration ?? '—' },
          ]}
        />
      </Panel>

      <div className="space-y-4">
        <Panel title="Services">
          {p.services.length === 0 ? (
            <p className="text-ink-subtle text-sm">None recorded.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {p.services.map((s) => (
                <li key={s} className="bg-sunken text-ink-muted rounded-md px-2 py-0.5 text-xs">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Goals">
          {p.goals.length === 0 ? (
            <p className="text-ink-subtle text-sm">Office set; none recorded yet.</p>
          ) : (
            <ul className="text-ink list-disc space-y-1 pl-5 text-sm">
              {p.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Instructions">
          {p.instructions.length === 0 ? (
            <p className="text-ink-subtle text-sm">Office set; none recorded yet.</p>
          ) : (
            <ul className="text-ink list-disc space-y-1 pl-5 text-sm">
              {p.instructions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

/* ---------------------------------- notes ---------------------------------- */

function NotesTab({ visit }: { visit: VisitDetailView }) {
  const { addNote, acknowledgeNote, flagNote, replyNote } = useSchedulingMutations()
  const [draft, setDraft] = useState('')
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const id = visit.id

  return (
    <div className="space-y-4">
      <Panel title="Add a coordinator note">
        <textarea
          rows={3}
          maxLength={4000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note for the care team…"
          className="border-control focus:border-brand-400 w-full rounded-lg border p-3 text-sm outline-none"
        />
        {addNote.isError && <p className="mt-1 text-xs text-red-700">{addNote.error.message}</p>}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={draft.trim() === '' || addNote.isPending}
            onClick={() => addNote.mutate({ id, text: draft.trim() }, { onSuccess: () => setDraft('') })}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {addNote.isPending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            )}
            Add Note
          </button>
        </div>
      </Panel>

      <Panel
        title="Notes"
        badge={
          <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
            {visit.notes.counts.all} total
          </span>
        }
      >
        {visit.notes.items.length === 0 ? (
          <p className="text-ink-subtle text-sm" role="status">
            No notes on this visit yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {visit.notes.items.map((note) => (
              <li key={note.id} className="border-line rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                    <span className="text-ink font-semibold">{note.authorName}</span>
                    <span className="text-ink-muted text-xs">{note.authorRole}</span>
                    {note.edited && <span className="text-ink-subtle text-xs">(edited)</span>}
                  </p>
                  <time className="text-ink-muted text-xs tabular-nums">{note.at}</time>
                </div>
                <p className="text-ink-muted mt-2 text-sm break-words">{note.text}</p>

                {note.flaggedForCoordinator && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                    <TriangleAlert className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                    Flagged for review
                  </p>
                )}
                {note.acknowledged && (
                  <p className="text-ink-subtle mt-1 inline-flex items-center gap-1 text-xs">
                    <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                    Acknowledged{note.acknowledgedByName ? ` by ${note.acknowledgedByName}` : ''}
                  </p>
                )}

                {note.replies.length > 0 && (
                  <ul className="border-line/60 mt-3 space-y-2 border-l-2 pl-3">
                    {note.replies.map((reply, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-ink font-semibold">{reply.authorName}</span>{' '}
                        <span className="text-ink-subtle text-xs">
                          {reply.authorRole} · {reply.at}
                        </span>
                        <p className="text-ink-muted break-words">{reply.text}</p>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
                  {!note.acknowledged && (
                    <button
                      type="button"
                      disabled={acknowledgeNote.isPending}
                      onClick={() => acknowledgeNote.mutate({ id, noteId: note.id })}
                      className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                      Acknowledge
                    </button>
                  )}
                  {!note.flaggedForCoordinator && (
                    <button
                      type="button"
                      disabled={flagNote.isPending}
                      onClick={() => flagNote.mutate({ id, noteId: note.id })}
                      className="text-ink-muted hover:text-red-700 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Flag className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                      Flag
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReplyFor(replyFor === note.id ? null : note.id)
                      setReplyText('')
                    }}
                    className="text-ink-muted hover:text-ink"
                  >
                    Reply
                  </button>
                </div>

                {replyFor === note.id && (
                  <div className="mt-2">
                    <textarea
                      rows={2}
                      maxLength={4000}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply…"
                      className="border-control focus:border-brand-400 w-full rounded-lg border p-2 text-sm outline-none"
                    />
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={replyText.trim() === '' || replyNote.isPending}
                        onClick={() =>
                          replyNote.mutate(
                            { id, noteId: note.id, text: replyText.trim() },
                            {
                              onSuccess: () => {
                                setReplyFor(null)
                                setReplyText('')
                              },
                            },
                          )
                        }
                        className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Send reply
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

/* --------------------------------- history --------------------------------- */

function HistoryTab({ visit }: { visit: VisitDetailView }) {
  return (
    <Panel title="Timeline" flush>
      {visit.history.length === 0 ? (
        <p className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm" role="status">
          Nothing on this visit carries a time yet.
        </p>
      ) : (
        <ol className="divide-line border-line divide-y border-t">
          {visit.history.map((entry, i) => (
            <li key={i} className="flex gap-3 p-4">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 size-2.5 shrink-0 rounded-full',
                  entry.status === 'DONE' ? 'bg-brand-600' : 'border-ink-subtle border bg-white',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-ink min-w-0 text-sm font-semibold break-words">{entry.label}</p>
                  <p className="text-ink-subtle shrink-0 text-xs tabular-nums">{entry.at}</p>
                </div>
                {entry.detail && (
                  <p className="text-ink-muted mt-0.5 text-xs break-words">{entry.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
