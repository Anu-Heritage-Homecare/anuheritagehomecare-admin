import { useId, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { recipients } from '@/features/care-recipients/data'
import { SIGNED_IN } from '@/lib/session'
import { TODAY } from '@/lib/today'
import {
  assignableNames,
  defaultAssigneeFor,
  defaultPriority,
  createTask,
  priorityLabel,
  priorityOrder,
  updateTask,
  offeredCategories,
} from './data'
import type { AgencyTask, TaskCategory, TaskPriority } from './data'
import { SelectBox } from '@/components/ui/SelectBox'

interface Draft {
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  assignee: string
  recipientId: string
  due: string
  dueTime: string
  estimate: string
}

/**
 * Computed on open, never a constant: the default priority and the category's
 * default assignee are settings, and a form built once at module load would go
 * on offering last week's.
 */
function blank(): Draft {
  const category = offeredCategories()[0]?.id ?? 'admin'
  return {
    title: '',
    description: '',
    category,
    priority: defaultPriority(),
    assignee: defaultAssigneeFor(category) ?? SIGNED_IN,
    recipientId: '',
    due: TODAY,
    dueTime: '',
    estimate: '',
  }
}

/**
 * Writing a task nothing can work out.
 *
 * Deliberately short. Every field is one a person has to supply — a title, who
 * it falls to, when it is wanted — and there is no "incident" or "new client"
 * among the categories, because a task of either kind is one the app already
 * derives and this form would only produce a duplicate sitting beside it.
 *
 * Mounted only while open, so the form starts from the draft it was given.
 */
export function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  return (
    <TaskDialog
      title="Create task"
      submitLabel="Create task"
      initial={blank()}
      autoAssign
      onSubmit={(draft) => {
        createTask({
          title: draft.title.trim(),
          description: draft.description.trim(),
          category: draft.category,
          priority: draft.priority,
          assignee: draft.assignee,
          recipientId: draft.recipientId === '' ? null : draft.recipientId,
          due: draft.due === '' ? null : draft.due,
          dueTime: draft.due === '' || draft.dueTime === '' ? null : draft.dueTime,
          estimateMinutes: draft.estimate === '' ? null : Number(draft.estimate),
        })
      }}
      onClose={onClose}
      footnote={`Filed by ${SIGNED_IN}. Held for this session only — there is no server to write it to.`}
    />
  )
}

/**
 * The same form over a task that already exists.
 *
 * Only ever a written one: a worked-out row has nothing here to edit, and the
 * details page does not offer the button.
 */
export function EditTaskDialog({
  task,
  onClose,
}: {
  task: AgencyTask
  onClose: () => void
}) {
  return (
    <TaskDialog
      title="Edit task"
      submitLabel="Save changes"
      initial={{
        title: task.title,
        description: task.description ?? '',
        category: task.category,
        priority: task.priority,
        assignee: task.assignee ?? SIGNED_IN,
        recipientId: task.recipientId ?? '',
        due: task.due ?? '',
        dueTime: task.dueTime ?? '',
        estimate: task.estimateMinutes != null ? String(task.estimateMinutes) : '',
      }}
      onSubmit={(draft) => {
        updateTask(task.id, {
          title: draft.title.trim(),
          description: draft.description.trim(),
          category: draft.category,
          priority: draft.priority,
          assignee: draft.assignee,
          recipientId: draft.recipientId === '' ? null : draft.recipientId,
          due: draft.due === '' ? null : draft.due,
          dueTime: draft.due === '' || draft.dueTime === '' ? null : draft.dueTime,
          estimate: draft.estimate === '' ? null : Number(draft.estimate),
        })
      }}
      onClose={onClose}
      footnote="Reassigning it is recorded on the task's history; the other fields change quietly."
    />
  )
}

function TaskDialog({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
  footnote,
  autoAssign = false,
}: {
  title: string
  submitLabel: string
  initial: Draft
  onSubmit: (draft: Draft) => void
  onClose: () => void
  footnote: string
  /** Move the assignee with the category. Only on a new task — on an edit the
   *  name in that field was put there on purpose. */
  autoAssign?: boolean
}) {
  const [draft, setDraft] = useState(initial)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const titleId = useId()
  const descriptionId = useId()
  const categoryId = useId()
  const priorityId = useId()
  const assigneeId = useId()
  const clientId = useId()
  const dueId = useId()
  const dueTimeId = useId()
  const estimateId = useId()

  const names = assignableNames()
  const ready = draft.title.trim() !== ''

  return (
    <Drawer open onClose={onClose} placement="center" title={title}>
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <label htmlFor={titleId} className="text-ink text-sm font-medium">
            What needs doing
          </label>
          <input
            id={titleId}
            type="text"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Order incontinence supplies for the Johnson household"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </div>

        <div>
          <label htmlFor={descriptionId} className="text-ink text-sm font-medium">
            Detail <span className="text-ink-subtle font-normal">(optional)</span>
          </label>
          <textarea
            id={descriptionId}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Anything the person picking this up would otherwise have to ask about"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={categoryId} className="text-ink text-sm font-medium">
              Category
            </label>
            <SelectBox
              id={categoryId}
              value={draft.category}
              onChange={(e) => {
                const next = e.target.value as TaskCategory
                const auto = defaultAssigneeFor(next)
                setDraft((current) => ({
                  ...current,
                  category: next,
                  assignee: autoAssign && auto ? auto : current.assignee,
                }))
              }}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {offeredCategories().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectBox>
          </div>
          <div>
            <label htmlFor={priorityId} className="text-ink text-sm font-medium">
              Priority
            </label>
            <SelectBox
              id={priorityId}
              value={draft.priority}
              onChange={(e) => set('priority', e.target.value as TaskPriority)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {priorityOrder.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p)}
                </option>
              ))}
            </SelectBox>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={assigneeId} className="text-ink text-sm font-medium">
              Assign to
            </label>
            <SelectBox
              id={assigneeId}
              value={draft.assignee}
              onChange={(e) => set('assignee', e.target.value)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectBox>
            {/* A select, not free text: a task cannot be put on somebody who
                does not work here. */}
            <p className="text-ink-subtle mt-1 text-xs">
              Active staff, plus HR and admin.
            </p>
          </div>
          <div>
            <label htmlFor={dueId} className="text-ink text-sm font-medium">
              Due
            </label>
            <input
              id={dueId}
              type="date"
              value={draft.due}
              onChange={(e) => set('due', e.target.value)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            />
            <p className="text-ink-subtle mt-1 text-xs">
              Clear it for a task with no deadline.
            </p>
          </div>
          <div>
            <label htmlFor={dueTimeId} className="text-ink text-sm font-medium">
              Time <span className="text-ink-subtle font-normal">(optional)</span>
            </label>
            <input
              id={dueTimeId}
              type="time"
              value={draft.dueTime}
              onChange={(e) => set('dueTime', e.target.value)}
              disabled={draft.due === ''}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-55"
            />
            <p className="text-ink-subtle mt-1 text-xs">
              An hour to have it done by, where one matters.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={clientId} className="text-ink text-sm font-medium">
              Client <span className="text-ink-subtle font-normal">(optional)</span>
            </label>
            <SelectBox
              id={clientId}
              value={draft.recipientId}
              onChange={(e) => set('recipientId', e.target.value)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              <option value="">Not about one client</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectBox>
          </div>
          <div>
            <label htmlFor={estimateId} className="text-ink text-sm font-medium">
              Estimate{' '}
              <span className="text-ink-subtle font-normal">(optional)</span>
            </label>
            <input
              id={estimateId}
              type="number"
              min={0}
              step={5}
              value={draft.estimate}
              onChange={(e) => set('estimate', e.target.value)}
              placeholder="Minutes"
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            />
            {/* Somebody's guess, and labelled as one. Nothing measures how long
                a task took, so this is never checked against anything. */}
            <p className="text-ink-subtle mt-1 text-xs">
              Your estimate. Nothing times it.
            </p>
          </div>
        </div>

        <p className="text-ink-subtle text-xs">{footnote}</p>

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
            onClick={() => {
              if (!ready) return
              onSubmit(draft)
              onClose()
            }}
            disabled={!ready}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
