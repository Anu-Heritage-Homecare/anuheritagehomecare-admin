import type { AgencyTask } from '@/features/tasks/data'
import { isOverdue } from '@/features/tasks/data'

export interface TaskStatus {
  label: string
  tone: string
  pill: boolean
}

/**
 * The status a task is in, worked out rather than stored.
 *
 * Nothing sets a status on a task: it falls out of the date, the tick and how
 * much of the checklist is done. Overdue is the one that is not a pill — it is
 * a warning, and a filled chip reads as a state somebody chose.
 */
export function statusOf(task: AgencyTask): TaskStatus {
  if (task.done)
    return { label: 'Completed', tone: 'bg-emerald-50 text-emerald-700', pill: true }
  if (isOverdue(task)) return { label: 'Overdue', tone: 'text-red-600', pill: false }
  const checklist = task.checklist ?? []
  const ticked = checklist.filter((i) => i.done).length
  if (ticked > 0 && ticked < checklist.length)
    return { label: 'In Progress', tone: 'bg-brand-50 text-brand-700', pill: true }
  return { label: 'Pending', tone: 'bg-sunken text-ink-muted', pill: true }
}
