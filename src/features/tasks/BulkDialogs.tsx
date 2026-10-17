import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { assignableNames, reassignTask, setTaskDone } from './data'
import type { AgencyTask } from './data'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * The two bulk operations the design puts under Quick Operations.
 *
 * Both act on the rows the screen is currently showing — the tab, the filters
 * and the search — and on the written ones only. A worked-out row has no
 * assignee of its own (it comes off the record) and cannot be ticked (what
 * settles it is the record changing), so neither dialog touches one. Each says
 * how many it will act on before it does anything: "all" over a list somebody
 * has not read is how a page of work gets ticked by accident.
 */

function Summary({ count, kind }: { count: number; kind: string }) {
  return (
    <p className="text-ink-muted text-sm">
      {count === 0
        ? `Nothing showing can be ${kind} — the rows in view are all worked out from records, or already done.`
        : `This acts on the ${count} written task${count === 1 ? '' : 's'} showing. Worked-out rows are left alone.`}
    </p>
  )
}

export function BulkAssignDialog({
  tasks,
  onClose,
}: {
  tasks: AgencyTask[]
  onClose: () => void
}) {
  const [assignee, setAssignee] = useState(assignableNames()[0] ?? '')

  return (
    <Drawer open onClose={onClose} placement="center" title="Bulk assign">
      <div className="space-y-4 p-4 sm:p-5">
        <Summary count={tasks.length} kind="reassigned" />

        <label className="block">
          <span className="text-ink text-sm font-medium">Hand them to</span>
          <SelectBox
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="border-control focus:border-brand-400 mt-1 h-11 w-full rounded-lg border px-3 text-sm"
          >
            {assignableNames().map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectBox>
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            aria-disabled={tasks.length === 0}
            onClick={() => {
              if (tasks.length === 0) return
              for (const task of tasks) reassignTask(task.id, assignee)
              onClose()
            }}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white aria-disabled:cursor-default aria-disabled:opacity-55"
          >
            Assign {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}

export function MarkAllCompleteDialog({
  tasks,
  onClose,
}: {
  tasks: AgencyTask[]
  onClose: () => void
}) {
  return (
    <Drawer open onClose={onClose} placement="center" title="Mark all complete">
      <div className="space-y-4 p-4 sm:p-5">
        <Summary count={tasks.length} kind="ticked off" />
        {tasks.length > 0 && (
          <ul className="border-line divide-line max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="text-ink px-3 py-2 break-words">
                {task.title}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            aria-disabled={tasks.length === 0}
            onClick={() => {
              if (tasks.length === 0) return
              for (const task of tasks) setTaskDone(task.id, true)
              onClose()
            }}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white aria-disabled:cursor-default aria-disabled:opacity-55"
          >
            Mark {tasks.length} complete
          </button>
        </div>
      </div>
    </Drawer>
  )
}
