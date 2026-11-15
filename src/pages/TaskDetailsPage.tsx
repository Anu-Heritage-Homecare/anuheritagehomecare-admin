import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, MapPin, PlayCircle } from 'lucide-react'
import {
  toUiPriority,
  useAddComment,
  useCompleteTask,
  useDeleteTask,
  useSetChecklistItem,
  useStartTask,
  useTaskDetail,
  useUpdateTask,
  type TaskDetailDto,
} from '@/features/tasks/useTasks'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { Panel } from '@/components/ui/Panel'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { cn } from '@/lib/cn'

/**
 * One task, read live from `GET /admin/tasks/:id`. The backend returns the whole
 * screen already labelled: overview, progress, checklist, comments, activity,
 * the related visit and related tasks. Ticking a checklist item, commenting,
 * starting, completing, editing and deleting each call their endpoint and
 * refresh the read. The comment author comes off the admin token server side.
 */
export function TaskDetailsPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const query = useTaskDetail(taskId)

  const start = useStartTask()
  const complete = useCompleteTask()
  const del = useDeleteTask()
  const tick = useSetChecklistItem()
  const addComment = useAddComment()

  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState('')

  if (query.isPending) {
    return (
      <p className="text-ink-subtle py-10 text-center text-sm" role="status">
        Loading…
      </p>
    )
  }
  if (query.isError) return <NotFoundPage />

  const task = query.data
  const done = task.status === 'DONE'
  const started = task.status === 'IN_PROGRESS'

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
          <h1 className="text-ink text-2xl font-bold tracking-tight break-words">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <PriorityBadge priority={toUiPriority(task.priority)} />
            <span className="bg-sunken text-ink-muted inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
              {task.statusLabel}
            </span>
            <span aria-hidden="true" className="bg-line h-4 w-px shrink-0" />
            <span className="text-ink-subtle">
              Due: <span className="text-ink font-medium">{task.dueDateLabel ?? 'No date'}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              del.mutate(task.id, { onSuccess: () => navigate('/tasks') })
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
          {!done && !started && (
            <button
              type="button"
              onClick={() => start.mutate(task.id)}
              disabled={start.isPending}
              className="border-brand-600 bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"
            >
              <PlayCircle className="size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
              Start
            </button>
          )}
          {!done && (
            <button
              type="button"
              onClick={() => complete.mutate(task.id)}
              disabled={complete.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Check className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              Mark Complete
            </button>
          )}
        </div>
      </header>

      {editing && <EditTaskDialog task={task} onClose={() => setEditing(false)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel titleClassName="text-lg font-bold" title="Task Overview">
            {task.description ? (
              <p className="text-ink-muted text-sm break-words">{task.description}</p>
            ) : (
              <p className="text-ink-subtle text-sm">No description. Edit the task to add one.</p>
            )}

            <div className="mt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-ink text-sm font-semibold">Task Progress</h3>
                <span className="text-brand-700 text-sm font-semibold tabular-nums">
                  {task.progress.total === 0
                    ? 'Nothing on it yet'
                    : `${task.progress.completed}/${task.progress.total} complete (${task.progress.percent}%)`}
                </span>
              </div>
              {task.progress.total > 0 && (
                <div
                  role="progressbar"
                  aria-valuenow={task.progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Checklist progress"
                  className="bg-sunken mt-2 h-2 overflow-hidden rounded-full"
                >
                  <div
                    className="bg-brand-600 h-full rounded-full"
                    style={{ width: `${task.progress.percent}%` }}
                  />
                </div>
              )}
            </div>

            {task.checklist.length > 0 && (
              <div className="border-line mt-5 border-t pt-5">
                <h3 className="text-ink text-sm font-semibold">Checklist Items</h3>
                <ul className="mt-3 space-y-2.5">
                  {task.checklist.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={entry.done}
                        onChange={(e) =>
                          tick.mutate({ taskId: task.id, itemId: entry.id, done: e.target.checked })
                        }
                        className="accent-brand-600 mt-0.5 size-4.5 shrink-0"
                        aria-label={entry.label}
                      />
                      <span
                        className={cn(
                          'min-w-0 flex-1 text-sm break-words',
                          entry.done ? 'text-ink-subtle line-through' : 'text-ink',
                        )}
                      >
                        {entry.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {task.relatedVisit && <RelatedVisitCard visit={task.relatedVisit} />}

          <Panel titleClassName="text-lg font-bold" title="Notes & Comments">
            <ul className="space-y-3">
              {task.comments.length === 0 && (
                <li className="text-ink-subtle text-sm">Nothing written on this one yet.</li>
              )}
              {task.comments.map((entry) => (
                <li key={entry.id} className="bg-canvas rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Avatar name={entry.authorName} decorative className="size-8 text-[0.6875rem]" />
                      <p className="text-ink text-sm font-semibold break-words">{entry.authorName}</p>
                    </div>
                    <time dateTime={entry.at} className="text-ink-subtle shrink-0 text-sm">
                      {stamp(entry.at)}
                    </time>
                  </div>
                  <p className="text-ink mt-2.5 text-sm break-words">{entry.body}</p>
                </li>
              ))}
            </ul>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (comment.trim() === '') return
                addComment.mutate(
                  { taskId: task.id, body: comment.trim() },
                  { onSuccess: () => setComment('') },
                )
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
                disabled={comment.trim() === '' || addComment.isPending}
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
              <Row label="Category" value={task.categoryLabel} />
              <Row
                label="Assigned To"
                value={
                  task.assigneeName ? (
                    <span className="flex items-center justify-end gap-2">
                      <Avatar name={task.assigneeName} decorative className="size-7 text-[0.625rem]" />
                      <span className="min-w-0 break-words">{task.assigneeName}</span>
                    </span>
                  ) : (
                    'Nobody'
                  )
                }
              />
              <Row label="Recipient" value={task.recipientName ?? 'Not about one client'} />
              <Row label="Created By" value={task.createdByLabel} />
              <Row label="Due Date" value={task.dueDateLabel ?? 'No date'} />
              <Row label="Recurrence" value={task.recurrenceLabel ?? 'Does not repeat'} />
              <Row label="Priority" value={<PriorityBadge priority={toUiPriority(task.priority)} />} />
              <Row
                label="Estimated Time"
                value={task.estimatedMinutes != null ? `${task.estimatedMinutes} minutes` : 'Not estimated'}
              />
            </dl>
          </Panel>

          {task.activity.length > 0 && (
            <Panel titleClassName="text-lg font-bold" title="Activity History">
              <ol>
                {task.activity.map((event, index) => {
                  const last = index === task.activity.length - 1
                  return (
                    <li key={`${event.kind}-${index}`} className={cn('relative flex gap-3', !last && 'pb-5')}>
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
                          {event.label}
                        </p>
                        <time dateTime={event.at} className="text-ink-subtle mt-0.5 block text-sm">
                          {stamp(event.at)}
                        </time>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </Panel>
          )}

          <Panel titleClassName="text-lg font-bold" title="Related Tasks">
            {task.relatedTasks.length === 0 ? (
              <p className="text-ink-subtle text-sm">Nothing else open for this client or this person.</p>
            ) : (
              <ul className="space-y-3">
                {task.relatedTasks.map((other) => (
                  <li key={other.id}>
                    <Link
                      to={`/tasks/${other.id}`}
                      className="bg-canvas hover:bg-sunken flex items-center justify-between gap-3 rounded-xl p-4 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="text-ink block text-sm font-semibold break-words">
                          {other.title}
                        </span>
                        <span className="text-ink-subtle mt-0.5 block text-sm">
                          Due: {other.dueDateLabel ?? 'No date'}
                        </span>
                      </span>
                      <span className="bg-sunken text-ink-muted shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">
                        {other.statusLabel}
                      </span>
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

function RelatedVisitCard({ visit }: { visit: NonNullable<TaskDetailDto['relatedVisit']> }) {
  return (
    <Panel titleClassName="text-lg font-bold" title="Related Visit">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">
            {visit.visitLabel} — {visit.dateLabel}
          </p>
          <p className="text-ink-subtle mt-0.5 text-sm tabular-nums">{visit.timeRange}</p>
        </div>
        <span className="bg-sunken text-ink-muted rounded-md px-2 py-0.5 text-xs font-semibold">
          {visit.statusLabel}
        </span>
      </div>
      <div className="border-line mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">Caregiver</p>
          <p className="text-ink mt-1.5 font-medium break-words">
            {visit.caregiverName ?? <span className="text-red-700">Nobody assigned</span>}
          </p>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">Recipient</p>
          <p className="text-ink mt-1.5 font-medium break-words">{visit.recipientName ?? '—'}</p>
        </div>
      </div>
      {visit.location && (
        <div className="border-line mt-4 border-t pt-4">
          <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">Location</p>
          <p className="text-ink mt-1.5 flex items-start gap-1.5 text-sm break-words">
            <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            {visit.location}
          </p>
        </div>
      )}
    </Panel>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <dt className="text-ink-muted min-w-0">{label}</dt>
      <dd className="text-ink min-w-0 text-right font-medium break-words">{value}</dd>
    </div>
  )
}

const stampFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function stamp(iso: string): string {
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? iso : stampFormat.format(at)
}

/** Edit the task's own fields. Assignee is a free text label, as on create. */
function EditTaskDialog({ task, onClose }: { task: TaskDetailDto; onClose: () => void }) {
  const update = useUpdateTask()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [assigneeLabel, setAssigneeLabel] = useState(task.assigneeName ?? '')

  const submit = () => {
    if (title.trim() === '') return
    update.mutate(
      {
        id: task.id,
        title: title.trim(),
        description: description.trim(),
        assigneeLabel: assigneeLabel.trim(),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Drawer open onClose={onClose} placement="center" title="Edit task" subtitle={task.title}>
      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <span className="text-ink text-sm font-medium">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-medium">Assign to</span>
          <input
            type="text"
            value={assigneeLabel}
            onChange={(e) => setAssigneeLabel(e.target.value)}
            placeholder="A person or team name"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        {update.isError && (
          <p className="text-sm text-red-600" role="status">
            Could not save the task.
          </p>
        )}
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
            disabled={title.trim() === '' || update.isPending}
            onClick={submit}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Drawer>
  )
}
