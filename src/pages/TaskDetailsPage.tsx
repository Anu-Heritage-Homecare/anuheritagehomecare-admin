import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, MapPin } from 'lucide-react'
import {
  addComment,
  relatedVisit,
  roleOf,
  deleteTask,
  formatDue,
  isDueToday,
  isOverdue,
  relatedTasks,
  priorityLabel,
  slaFor,
  setChecklistItem,
  setTaskDone,
  taskById,
  categoryLabel,
  useTasks,
} from '@/features/tasks/data'
import { EditTaskDialog } from '@/features/tasks/CreateTaskDialog'
import { Avatar } from '@/components/ui/Avatar'
import { VisitStatusBadge } from '@/components/ui/StatusBadge'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import type { TaskEvent } from '@/features/tasks/data'
import { Panel } from '@/components/ui/Panel'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { placeOfRecipient } from '@/features/monitoring/locations-data'
import type { Place } from '@/features/monitoring/locations-data'
import type { BoardVisit } from '@/features/scheduling/board-data'
import { formatTime } from '@/features/monitoring/live-data'
import { TODAY } from '@/lib/today'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StatusCell } from '@/features/tasks/TaskStatus'
import { statusOf } from '@/features/tasks/status'
import { cn } from '@/lib/cn'

/**
 * One task.
 *
 * Two quite different pages behind one route, because there are two quite
 * different kinds of task and pretending otherwise is what would make this
 * screen lie.
 *
 * A **written** task is owned here: it has a description, a checklist, comments
 * and a history, and every one of those is a thing a person did that this app
 * witnessed. It can be edited, ticked off and deleted, because it exists
 * nowhere else.
 *
 * A **worked-out** task owns none of that. It is a sentence about a record kept
 * somewhere else, so the page says which record, why the row exists and what
 * would make it go — and sends you to the place where the work is actually
 * done. No checklist, no comments, no Mark complete: this screen has nothing to
 * mark.
 */
export function TaskDetailsPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const version = useTasks()
  void version

  const task = taskById(taskId)
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState('')

  if (!task) return <NotFoundPage />

  const written = task.origin === 'written'
  const checklist = task.checklist ?? []
  const ticked = checklist.filter((c) => c.done).length
  const percent =
    checklist.length === 0 ? 0 : Math.round((ticked / checklist.length) * 100)
  const related = relatedTasks(task)
  const sla = slaFor(task)
  const visit = relatedVisit(task)
  const place = task.recipientId
    ? placeOfRecipient(task.recipientId)
    : undefined
  /*
   * "In progress" is read off the checklist rather than set by a button. A task
   * with three of five steps ticked is under way whatever anybody pressed, and
   * a status somebody has to remember to change is a status that goes stale.
   */
  const started = !task.done && ticked > 0

  /** Everywhere else this task is written down; the overflow menu, or nothing. */
  const elsewhere: MenuItem[] = [
    ...(task.recipientId
      ? [
          {
            id: 'recipient',
            label: `Open ${task.recipientName}`,
            to: `/care-recipients/${task.recipientId}`,
          },
        ]
      : []),
    ...(visit
      ? [
          {
            id: 'visit',
            label: `Open the ${visit.type.toLowerCase()} visit`,
            to: `/scheduling/visits/${visit.id}/overview`,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/tasks" className="hover:text-ink">
              Tasks
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </li>
          <li className="text-ink min-w-0 font-medium" aria-current="page">
            {task.title}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight break-words">
            {task.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <PriorityBadge priority={task.priority} />
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                task.done
                  ? 'bg-emerald-50 text-emerald-700'
                  : isOverdue(task)
                    ? 'bg-red-50 text-red-700'
                    : started
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-sunken text-ink-muted',
              )}
            >
              {task.done
                ? 'Completed'
                : isOverdue(task)
                  ? 'Overdue'
                  : started
                    ? 'In Progress'
                    : 'Pending'}
            </span>

            {/* The design's divided facts. "Created" is only on a written
                task — a worked-out row was never created by anybody, it was
                read off a record — so the rule goes with it. */}
            {task.createdAt && (
              <>
                <span
                  aria-hidden="true"
                  className="bg-line h-4 w-px shrink-0"
                />
                <span className="text-ink-subtle">
                  Created: {dayOf(task.createdAt)}
                </span>
              </>
            )}
            <span aria-hidden="true" className="bg-line h-4 w-px shrink-0" />
            <span className="text-ink-subtle">
              Due:{' '}
              <span
                className={cn(
                  'font-medium',
                  isOverdue(task) || isDueToday(task)
                    ? 'text-red-600'
                    : 'text-ink',
                )}
              >
                {/* The hour only where somebody typed one — a worked-out row's
                    record carries a day, not a time. */}
                {formatDue(task.due)}
                {task.dueTime && `, ${formatTime(task.dueTime)}`}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {written ? (
            <>
              <button
                type="button"
                onClick={() => {
                  deleteTask(task.id)
                  navigate('/tasks')
                }}
                className="border-line inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="border-line text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium"
              >
                Edit Task
              </button>
              {/* Outlined in its own green, as the design draws it — a filled
                  button beside two outlined ones read as the page's primary
                  action, which deleting and editing are not. */}
              <button
                type="button"
                onClick={() => setTaskDone(task.id, !task.done)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                {!task.done && (
                  <Check
                    className="size-4 shrink-0"
                    strokeWidth={2.4}
                    aria-hidden="true"
                  />
                )}
                {task.done ? 'Reopen' : 'Mark Complete'}
              </button>
              {/* The design's overflow. Only ever the places this task also
                  lives — nothing is invented to fill it, and it is left out
                  where there is nowhere else to go. */}
              {elsewhere.length > 0 && (
                <DropdownMenu
                  bordered
                  label={`More for ${task.title}`}
                  items={elsewhere}
                />
              )}
            </>
          ) : (
            // The only button that makes sense on a worked-out task: the work
            // is done in the record, not here.
            <Link
              to={task.to}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-3.5 text-sm font-semibold text-white"
            >
              Open the record
            </Link>
          )}
        </div>
      </header>

      {/* What the priority's target in Task Settings actually does: a written
          task carries the moment it was written, so this is measured, not
          claimed. Nothing was sent — there is no outbound channel — so the
          line is the escalation. */}
      {sla?.pastTarget && (
        <p
          role="status"
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            sla.escalated
              ? 'bg-red-50 text-red-700'
              : 'bg-amber-50 text-amber-800',
          )}
        >
          {`${Math.floor(sla.hoursSince)} hours old, against a ${sla.targetHours}-hour target for ${priorityLabel(task.priority)} tasks.`}
          {sla.escalated && ' One for the office to pick up.'}
        </p>
      )}

      {editing && (
        <EditTaskDialog task={task} onClose={() => setEditing(false)} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {written ? (
            <>
              <Panel titleClassName="text-lg font-bold" title="Task Overview">
                {task.description ? (
                  <p className="text-ink-muted text-sm break-words">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-ink-subtle text-sm">
                    No description. Edit the task to add one.
                  </p>
                )}

                <div className="mt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-ink text-sm font-semibold">
                      Task Progress
                    </h3>
                    {/* Counted off the list, never stated: a progress bar and a
                        checklist that disagree is the oldest bug in this app's
                        source design. */}
                    <span className="text-brand-700 text-sm font-semibold tabular-nums">
                      {checklist.length === 0
                        ? 'Nothing on it yet'
                        : `${ticked}/${checklist.length} complete (${percent}%)`}
                    </span>
                  </div>

                  {checklist.length > 0 && (
                    <div
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Checklist progress"
                      className="bg-sunken mt-2 h-2 overflow-hidden rounded-full"
                    >
                      <div
                        className="bg-brand-600 h-full rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="border-line mt-5 border-t pt-5">
                  <h3 className="text-ink text-sm font-semibold">
                    Checklist Items
                  </h3>

                  <ul className="mt-3 space-y-2.5">
                    {checklist.map((entry) => (
                      <li key={entry.id} className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={entry.done}
                          onChange={(e) =>
                            setChecklistItem(
                              task.id,
                              entry.id,
                              e.target.checked,
                            )
                          }
                          className="accent-brand-600 mt-0.5 size-4.5 shrink-0"
                          aria-label={entry.label}
                        />
                        <span
                          className={cn(
                            'min-w-0 flex-1 text-sm break-words',
                            entry.done
                              ? 'text-ink-subtle line-through'
                              : 'text-ink',
                          )}
                        >
                          {entry.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            </>
          ) : (
            // A worked-out row has no description and no checklist of its
            // own, so its overview is the one line that says what the record
            // is owing, and the way through to that record.
            <Panel titleClassName="text-lg font-bold" title="Task Overview">
              <p className="text-ink-muted text-sm break-words">
                {task.source}
              </p>
              <Link
                to={task.to}
                className="text-brand-700 hover:text-brand-800 mt-3 inline-flex min-h-11 items-center text-sm font-semibold"
              >
                Open the record and deal with it
              </Link>
            </Panel>
          )}

          {visit && <RelatedVisitCard visit={visit} place={place} />}

          <Panel titleClassName="text-lg font-bold" title="Notes & Comments">
            <ul className="space-y-3">
              {(task.comments ?? []).length === 0 && (
                <li className="text-ink-subtle text-sm">
                  Nothing written on this one yet.
                </li>
              )}
              {(task.comments ?? []).map((entry) => (
                <li key={entry.id} className="bg-canvas rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Avatar
                        name={entry.author}
                        decorative
                        className="size-8 text-[0.6875rem]"
                      />
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold break-words">
                          {entry.author}
                        </p>
                        {roleOf(entry.author) && (
                          <p className="text-ink-subtle text-sm break-words">
                            {roleOf(entry.author)}
                          </p>
                        )}
                      </div>
                    </div>
                    <time
                      dateTime={entry.at}
                      className="text-ink-subtle shrink-0 text-sm"
                    >
                      {commentStamp(entry.at)}
                    </time>
                  </div>
                  <p className="text-ink mt-2.5 text-sm break-words">
                    {entry.body}
                  </p>
                </li>
              ))}
            </ul>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                addComment(task.id, comment)
                setComment('')
              }}
              className="mt-4 flex flex-wrap gap-3"
            >
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment or operational note..."
                aria-label="Add a comment or operational note"
                className="border-line focus:border-brand-500 h-11 min-w-0 flex-1 rounded-lg border px-3.5 text-sm"
              />
              <button
                type="submit"
                disabled={comment.trim() === ''}
                className="bg-brand-600 hover:bg-brand-700 inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Comment
              </button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel titleClassName="text-lg font-bold" title="Task Details">
            <dl className="divide-line divide-y text-sm">
              <Row label="Category" value={categoryLabel(task.category)} />
              <Row
                label="Assigned To"
                value={
                  task.assignee ? (
                    <span className="flex items-center justify-end gap-2">
                      <Avatar
                        name={task.assignee}
                        decorative
                        className="size-7 text-[0.625rem]"
                      />
                      <span className="min-w-0">
                        <span className="block break-words">
                          {task.assignee}
                        </span>
                        {roleOf(task.assignee) && (
                          <span className="text-ink-subtle block text-xs font-normal">
                            {roleOf(task.assignee)}
                          </span>
                        )}
                      </span>
                    </span>
                  ) : (
                    'Nobody'
                  )
                }
              />
              <Row
                label="Recipient"
                value={
                  task.recipientName ? (
                    <span className="flex items-center justify-end gap-2">
                      <Avatar
                        name={task.recipientName}
                        decorative
                        className="size-7 text-[0.625rem]"
                      />
                      {task.recipientId ? (
                        <Link
                          to={`/care-recipients/${task.recipientId}`}
                          className="text-brand-700 hover:text-brand-800 min-w-0 break-words"
                        >
                          {task.recipientName}
                        </Link>
                      ) : (
                        <span className="min-w-0 break-words">
                          {task.recipientName}
                        </span>
                      )}
                    </span>
                  ) : (
                    'Not about one client'
                  )
                }
              />
              {/* The design says "System (Auto-generated)" for a row nobody
                  typed. Nothing generates these — they are read off records the
                  app already keeps — so the row says which it is. */}
              <Row
                label="Created By"
                value={written ? task.createdBy : 'Worked out from a record'}
              />
              {task.createdAt && (
                <Row label="Created" value={momentOf(task.createdAt)} />
              )}
              <Row
                label="Due Date"
                value={
                  <span
                    className={cn(
                      isOverdue(task) && 'font-semibold text-red-600',
                    )}
                  >
                    {task.due
                      ? `${dayOf(task.due)}${task.dueTime ? `, ${formatTime(task.dueTime)}` : ''}`
                      : 'No date'}
                  </span>
                }
              />
              {/* The design's "Daily (weekdays)". Nothing here schedules
                  anything, so the row stays and tells the truth rather than
                  promising a task that will never come back. */}
              <Row label="Recurrence" value="Does not repeat" />
              <Row
                label="Priority"
                value={<PriorityBadge priority={task.priority} />}
              />
              <Row
                label="Estimated Time"
                value={
                  task.estimateMinutes != null
                    ? `${task.estimateMinutes} minutes`
                    : 'Not estimated'
                }
              />
            </dl>
          </Panel>

          {written && <ActivityHistory events={task.activity ?? []} />}

          <Panel titleClassName="text-lg font-bold" title="Related Tasks">
            {related.length === 0 ? (
              <p className="text-ink-subtle text-sm">
                Nothing else open for this client or this person.
              </p>
            ) : (
              <ul className="space-y-3">
                {related.map((other) => (
                  <li key={other.id}>
                    <Link
                      to={
                        other.origin === 'written'
                          ? `/tasks/${other.id}`
                          : other.to
                      }
                      className="bg-canvas hover:bg-sunken flex items-center justify-between gap-3 rounded-xl p-4 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="text-ink block text-sm font-semibold break-words">
                          {other.title}
                        </span>
                        <span className="text-ink-subtle mt-0.5 block text-sm">
                          Due: {formatDue(other.due)}
                          {other.dueTime && `, ${formatTime(other.dueTime)}`}
                        </span>
                      </span>
                      <StatusCell status={statusOf(other)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

/** "late-arrival" → "Late arrival". The board's own word, just readable. */
/**
 * The visit this task sits against, drawn the way the design draws it: what it
 * is and when, its status, the two people either side, and where it happens.
 */
function RelatedVisitCard({
  visit,
  place,
}: {
  visit: BoardVisit
  place: Place | undefined
}) {
  return (
    <Panel titleClassName="text-lg font-bold" title="Related Visit">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">
            <Link
              to={`/scheduling/visits/${visit.id}/overview`}
              className="hover:text-brand-700"
            >
              {visit.type} visit — {dayOf(visit.date)}
            </Link>
          </p>
          <p className="text-ink-subtle mt-0.5 text-sm tabular-nums">
            {formatTime(visit.start)} – {formatTime(visit.end)}
          </p>
        </div>
        <VisitStatusBadge status={visit.status} />
      </div>

      <div className="border-line mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
            Caregiver
          </p>
          <p className="text-ink mt-1.5 flex items-center gap-2 font-medium break-words">
            {visit.caregiverId ? (
              <>
                <Avatar
                  name={visit.caregiverName!}
                  decorative
                  className="size-7 text-[0.625rem]"
                />
                <Link
                  to={`/caregivers/${visit.caregiverId}/schedule`}
                  className="min-w-0 hover:text-brand-700"
                >
                  {visit.caregiverName}
                </Link>
              </>
            ) : (
              <span className="text-red-700">Nobody assigned</span>
            )}
          </p>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
            Recipient
          </p>
          <p className="text-ink mt-1.5 flex items-center gap-2 font-medium break-words sm:justify-end">
            <Avatar
              name={visit.recipientName}
              decorative
              className="size-7 text-[0.625rem]"
            />
            <Link
              to={`/care-recipients/${visit.recipientId}`}
              className="min-w-0 hover:text-brand-700"
            >
              {visit.recipientName}
            </Link>
          </p>
        </div>
      </div>

      {place && (
        <div className="border-line mt-4 border-t pt-4">
          <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
            Location
          </p>
          <p className="text-ink mt-1.5 flex items-start gap-1.5 text-sm break-words">
            <MapPin
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            {place.address}
          </p>
        </div>
      )}
    </Panel>
  )
}

/**
 * The task's timeline, newest first: a rail of dots with the live one lit, each
 * line reading "<who> <what>" over the moment it happened.
 *
 * Every entry is something the app watched happen — a task written, an item
 * ticked, a comment left. Nothing here is generated on a schedule, so the
 * design's "Template schedule activated" has no counterpart and none is faked.
 */
function ActivityHistory({ events }: { events: TaskEvent[] }) {
  const newestFirst = [...events].reverse()
  if (newestFirst.length === 0) return null

  return (
    <Panel titleClassName="text-lg font-bold" title="Activity History">
      <ol>
        {newestFirst.map((event, index) => {
          const last = index === newestFirst.length - 1
          return (
            <li
              key={event.id}
              className={cn('relative flex gap-3', !last && 'pb-5')}
            >
              {!last && (
                <span
                  aria-hidden="true"
                  className="bg-line absolute top-4 bottom-0.5 left-[3.5px] w-px"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full',
                  index === 0 ? 'bg-brand-600' : 'bg-slate-300',
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm break-words',
                    index === 0 ? 'text-ink font-semibold' : 'text-ink-muted',
                  )}
                >
                  {event.by} {event.text}
                </p>
                <time
                  dateTime={event.at}
                  className="text-ink-subtle mt-0.5 block text-sm"
                >
                  {eventStamp(event.at)}
                </time>
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <dt className="text-ink-muted min-w-0">{label}</dt>
      <dd className="text-ink min-w-0 text-right font-medium break-words">
        {value}
      </dd>
    </div>
  )
}

/** "18 July 2026" — the design shows the day a task was written, not the hour. */
const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function dayOf(iso: string): string {
  return dayFormat.format(new Date(iso))
}

/** "18 July 2026, 7:00 AM" — a day and the hour on it, for a stored stamp. */
function momentOf(iso: string): string {
  return `${dayOf(iso)}, ${formatTime(iso.slice(11, 16))}`
}

/**
 * "9:15 AM" on something written today, "July 23, 2:20 PM" on anything older.
 *
 * The design only ever shows an hour, because every comment in it was written
 * the same morning. A note from last week needs its day or the hour is a lie.
 */
function commentStamp(iso: string): string {
  return iso.slice(0, 10) === TODAY
    ? formatTime(iso.slice(11, 16))
    : eventStamp(iso)
}

/** "July 20, 9:15 AM" — the timeline's stamp, exactly as the design writes it. */
const eventDayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

function eventStamp(iso: string): string {
  return `${eventDayFormat.format(new Date(iso))}, ${formatTime(iso.slice(11, 16))}`
}
