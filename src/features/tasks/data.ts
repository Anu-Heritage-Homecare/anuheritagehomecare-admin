/**
 * The agency's open work, in one list.
 *
 * Two kinds of row, kept visibly apart because they behave differently and a
 * coordinator has to know which they are looking at.
 *
 * A **worked-out** task is read off the records the rest of the app already
 * keeps: a visit that closed with no write-up, a credential that has lapsed, an
 * incident nobody has settled, a care request nobody has answered. Nothing
 * creates these and nothing can tick them off — they exist exactly as long as
 * the fact behind them does, and they go when somebody files the write-up,
 * renews the licence, settles the incident or answers the request. A checkbox
 * on one of those would be a lie with a due date attached: the paperwork would
 * still be missing and the list would have stopped saying so.
 *
 * A **written** task is one somebody typed. "Order medical supplies" is not
 * derivable from anything and never will be, so it is stored, and it is ticked
 * off by hand because a person is the only thing that knows it is done.
 *
 * Written tasks live in memory for the session, like the alert actions and the
 * contact log — there is no backend, and the screens that write say so.
 */
import { useSyncExternalStore } from 'react'
import { NOW, TODAY } from '@/lib/today'
import { addDays, boardOn } from '@/features/scheduling/board-data'
import type { BoardVisit } from '@/features/scheduling/board-data'
import { historyVisits } from '@/features/monitoring/history-data'
import { incidentsFiled } from '@/features/monitoring/incidents-data'
import { incidentTypeLabels } from '@/features/care-recipients/notes-data'
import {
  careRequests,
  daysWaiting,
} from '@/features/care-recipients/requests-data'
import { recipients } from '@/features/care-recipients/data'
import {
  credentialStates,
  staffMembers,
} from '@/features/caregivers/roster-data'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { priorityById, priorityOrder as priorityRankOrder } from './settings'
import type { TaskCategory, TaskPriority } from './settings'

export type TaskOrigin = 'worked-out' | 'written'

/*
 * The vocabulary is settings, not data: categories and priority labels are what
 * a coordinator edits on the task settings screen, so they live in one place
 * and every screen reads them from there. Re-exported here so a page importing
 * "the tasks module" gets the labels with the tasks.
 */
export {
  allCategories,
  categoryLabel,
  categoryTone,
  defaultAssigneeFor,
  defaultPriority,
  offeredCategories,
  priorityLabel,
  priorityOrder,
  useTaskSettings,
} from './settings'
export type { TaskCategory, TaskPriority } from './settings'

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface TaskComment {
  id: string
  /** ISO datetime, UTC. */
  at: string
  author: string
  body: string
}

/**
 * Something that happened to this task.
 *
 * Only events the app actually witnessed — created, assigned, ticked, reopened,
 * commented on. The design's "Task auto-assigned" and "Template schedule
 * activated" describe machinery that does not exist here, and a timeline is the
 * one place where an invented line is indistinguishable from a real one.
 */
export interface TaskEvent {
  id: string
  /** ISO datetime, UTC. */
  at: string
  /**
   * A verb phrase, lower case, with `by` in front of it: the timeline reads
   * "Mike Chen ticked off …", the way the design writes a line.
   */
  text: string
  by: string
}

export interface AgencyTask {
  id: string
  origin: TaskOrigin
  title: string
  category: TaskCategory
  priority: TaskPriority
  /** Who it falls to. Null where the record names nobody. */
  assignee: string | null
  recipientId: string | null
  recipientName: string | null
  /** ISO date. Null on a written task with no date on it. */
  due: string | null
  /**
   * "HH:MM", 24-hour, and only where somebody typed one. A worked-out row
   * never has one: the records behind them carry a day, not an hour — a
   * closed visit has no clock-out to owe the paperwork from.
   */
  dueTime?: string
  /**
   * What the row was read off, in words. Only on worked-out tasks — it is the
   * answer to "why am I being told this", and a written task's answer is
   * "because somebody typed it".
   */
  source?: string
  /** Where the work actually gets done. */
  to: string
  done: boolean
  /** The visit this is about, where the row came off one. */
  visitId?: string
  /** Written tasks only, all of them. */
  createdBy?: string
  /** ISO datetime, UTC. */
  createdAt?: string
  fromTemplate?: string
  description?: string
  checklist?: ChecklistItem[]
  comments?: TaskComment[]
  activity?: TaskEvent[]
  /** The creator's own estimate, in minutes. Never computed. */
  estimateMinutes?: number
}

/* ------------------------------ written tasks ----------------------------- */

interface WrittenTask {
  id: string
  title: string
  category: TaskCategory
  priority: TaskPriority
  assignee: string | null
  recipientId: string | null
  due: string | null
  dueTime?: string
  createdBy: string
  /** ISO datetime, UTC. When it was written down. */
  createdAt: string
  done: boolean
  /** Set when the task was raised from a template, so the template can count. */
  fromTemplate?: string
  description?: string
  /* Optional in the fixtures so a seed without a checklist does not need three
     empty arrays; normalised to [] on the way out. */
  checklist?: ChecklistItem[]
  comments?: TaskComment[]
  activity?: TaskEvent[]
  estimateMinutes?: number
}

/*
 * Seeded so the list is not all machinery on a first look. Every assignee is
 * somebody really on the roster, and the dates sit around today rather than in
 * a month nobody is looking at.
 */
const written: WrittenTask[] = [
  {
    id: 'wt-1',
    dueTime: '10:00',
    title: 'Order incontinence supplies for the Johnson household',
    category: 'operations',
    priority: 'medium',
    assignee: 'Admin Support',
    recipientId: 'cr-001',
    due: TODAY,
    createdBy: 'Mike Chen',
    createdAt: `${addDays(TODAY, -1)}T09:00:00Z`,
    done: false,
    description:
      'The pack size changed with the July delivery. Check what is left in the hall cupboard before ordering, and put the order through the usual supplier account.',
    estimateMinutes: 20,
    checklist: [
      { id: 'c1', label: 'Count what is left in the cupboard', done: true },
      {
        id: 'c2',
        label: 'Confirm the new pack size with the supplier',
        done: true,
      },
      { id: 'c3', label: 'Place the order', done: false },
      { id: 'c4', label: 'Tell the family when it will arrive', done: false },
    ],
    comments: [
      {
        id: 'k1',
        at: `${addDays(TODAY, -1)}T14:20:00Z`,
        author: 'Sarah Williams',
        body: 'Down to about four days of stock on the morning round.',
      },
    ],
    activity: [
      {
        id: 'e1',
        at: `${addDays(TODAY, -1)}T09:00:00Z`,
        text: 'created the task and assigned it to Admin Support',
        by: 'Mike Chen',
      },
      {
        id: 'e2',
        at: `${addDays(TODAY, -1)}T14:20:00Z`,
        text: 'left a comment',
        by: 'Sarah Williams',
      },
      {
        id: 'e3',
        at: `${addDays(TODAY, -1)}T14:22:00Z`,
        text: 'ticked off “Count what is left in the cupboard”',
        by: 'Sarah Williams',
      },
      {
        id: 'e4',
        at: `${TODAY}T08:40:00Z`,
        text: 'ticked off “Confirm the new pack size with the supplier”',
        by: 'Admin Support',
      },
    ],
  },
  {
    id: 'wt-2',
    title: 'Arrange the family meeting about overnight cover',
    checklist: [
      {
        id: 'c1',
        label: 'Ask the family which evenings suit them',
        done: true,
      },
      { id: 'c2', label: 'Check who is free on those nights', done: false },
      { id: 'c3', label: 'Send the invitation with the agenda', done: false },
      { id: 'c4', label: 'Write the outcome onto the care plan', done: false },
    ],
    category: 'planning',
    priority: 'high',
    assignee: 'Mike Chen',
    recipientId: 'cr-006',
    due: addDays(TODAY, 1),
    createdBy: SIGNED_IN,
    createdAt: `${addDays(TODAY, -2)}T11:20:00Z`,
    done: false,
    activity: [
      {
        id: 'e1',
        at: `${addDays(TODAY, -2)}T11:20:00Z`,
        text: 'created the task and assigned it to Mike Chen',
        by: SIGNED_IN,
      },
      {
        id: 'e2',
        at: `${addDays(TODAY, -1)}T09:35:00Z`,
        text: 'ticked off “Ask the family which evenings suit them”',
        by: 'Mike Chen',
      },
    ],
  },
  {
    id: 'wt-3',
    title: 'Chase the hoist service engineer',
    checklist: [
      { id: 'c1', label: 'Find the last service certificate', done: true },
      { id: 'c2', label: 'Ring the engineer for a date', done: true },
      { id: 'c3', label: 'Put the visit on the schedule', done: false },
      {
        id: 'c4',
        label: 'File the new certificate against the equipment',
        done: false,
      },
    ],
    category: 'admin',
    priority: 'high',
    assignee: 'Admin Support',
    recipientId: 'cr-005',
    due: addDays(TODAY, -1),
    createdBy: 'Dr. Jane Foster',
    createdAt: `${addDays(TODAY, -4)}T15:45:00Z`,
    done: false,
    activity: [
      {
        id: 'e1',
        at: `${addDays(TODAY, -4)}T15:45:00Z`,
        text: 'created the task and assigned it to Admin Support',
        by: 'Dr. Jane Foster',
      },
      {
        id: 'e2',
        at: `${addDays(TODAY, -3)}T10:10:00Z`,
        text: 'ticked off “Find the last service certificate”',
        by: 'Admin Support',
      },
      {
        id: 'e3',
        at: `${addDays(TODAY, -2)}T14:05:00Z`,
        text: 'ticked off “Ring the engineer for a date”',
        by: 'Admin Support',
      },
    ],
  },
  {
    id: 'wt-4',
    title: 'Book the quarterly manual handling refresher',
    checklist: [
      { id: 'c1', label: 'List who is due a refresher', done: true },
      { id: 'c2', label: 'Pick a date the branch can cover', done: false },
      { id: 'c3', label: 'Book the trainer', done: false },
      { id: 'c4', label: 'Tell everybody who is on it', done: false },
    ],
    category: 'training',
    priority: 'medium',
    assignee: 'HR Team',
    recipientId: null,
    due: addDays(TODAY, 6),
    createdBy: SIGNED_IN,
    createdAt: `${addDays(TODAY, -3)}T08:30:00Z`,
    done: false,
    activity: [
      {
        id: 'e1',
        at: `${addDays(TODAY, -3)}T08:30:00Z`,
        text: 'created the task and assigned it to HR Team',
        by: SIGNED_IN,
      },
      {
        id: 'e2',
        at: `${addDays(TODAY, -2)}T16:40:00Z`,
        text: 'ticked off “List who is due a refresher”',
        by: 'HR Team',
      },
    ],
  },
  {
    id: 'wt-5',
    title: 'Write up the July rota review for the branch meeting',
    checklist: [
      {
        id: 'c1',
        label: 'Pull the hours worked against contract',
        done: false,
      },
      { id: 'c2', label: 'Note the weeks that went uncovered', done: false },
      { id: 'c3', label: 'Draft the summary', done: false },
    ],
    category: 'admin',
    priority: 'low',
    assignee: 'Amara Nwosu',
    recipientId: null,
    due: addDays(TODAY, 4),
    createdBy: 'Amara Nwosu',
    createdAt: `${addDays(TODAY, -6)}T16:10:00Z`,
    done: false,
    activity: [
      {
        id: 'e1',
        at: `${addDays(TODAY, -6)}T16:10:00Z`,
        text: 'created the task and assigned it to Amara Nwosu',
        by: 'Amara Nwosu',
      },
    ],
  },
  {
    id: 'wt-6',
    title: 'Confirm the new key safe code with the family',
    checklist: [
      { id: 'c1', label: 'Ring the family for the new code', done: true },
      { id: 'c2', label: 'Update the code on the care record', done: true },
      { id: 'c3', label: 'Tell the caregivers on the rota', done: true },
    ],
    category: 'planning',
    priority: 'medium',
    assignee: 'Lisa Thompson',
    recipientId: 'cr-005',
    due: addDays(TODAY, -2),
    createdBy: 'Dr. Jane Foster',
    createdAt: `${addDays(TODAY, -5)}T10:05:00Z`,
    done: true,
    activity: [
      {
        id: 'e1',
        at: `${addDays(TODAY, -5)}T10:05:00Z`,
        text: 'created the task and assigned it to Lisa Thompson',
        by: 'Dr. Jane Foster',
      },
      {
        id: 'e2',
        at: `${addDays(TODAY, -4)}T09:15:00Z`,
        text: 'ticked off “Ring the family for the new code”',
        by: 'Lisa Thompson',
      },
      {
        id: 'e3',
        at: `${addDays(TODAY, -4)}T09:20:00Z`,
        text: 'ticked off “Update the code on the care record”',
        by: 'Lisa Thompson',
      },
      {
        id: 'e4',
        at: `${addDays(TODAY, -3)}T11:50:00Z`,
        text: 'ticked off “Tell the caregivers on the rota”',
        by: 'Lisa Thompson',
      },
      {
        id: 'e5',
        at: `${addDays(TODAY, -3)}T11:52:00Z`,
        text: 'marked it complete',
        by: 'Lisa Thompson',
      },
    ],
  },
]

let filed = 0
let version = 0
const listeners = new Set<() => void>()

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

export interface NewTask {
  title: string
  description?: string
  /** Checklist labels, in order. Used when a task comes off a template. */
  items?: string[]
  /** The template this came from, where one did. */
  fromTemplate?: string
  category: TaskCategory
  priority: TaskPriority
  assignee: string | null
  recipientId: string | null
  due: string | null
  /** "HH:MM", where the person typing wanted an hour as well as a day. */
  dueTime?: string | null
  estimateMinutes?: number | null
}

export function createTask(task: NewTask): string {
  filed += 1
  const id = `wt-new-${filed}`
  const entry: WrittenTask = {
    ...task,
    id,
    description: task.description?.trim() === '' ? undefined : task.description,
    dueTime: task.dueTime ?? undefined,
    estimateMinutes: task.estimateMinutes ?? undefined,
    checklist: (task.items ?? []).map((label, index) => ({
      id: `c${index + 1}`,
      label,
      done: false,
    })),
    createdBy: SIGNED_IN,
    createdAt: nowStamp(),
    done: false,
    activity: [],
  }
  record(
    entry,
    task.assignee
      ? `created the task and assigned it to ${task.assignee}`
      : 'created the task',
  )
  written.unshift(entry)
  emit()
  return id
}

/** Only ever a written task: see the note at the top of this file. */
export function setTaskDone(id: string, done: boolean): void {
  const task = find(id)
  if (!task || task.done === done) return
  task.done = done
  record(task, done ? 'marked it complete' : 'reopened it')
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTasks(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  )
}

/** Stamped on everything written during the session, off the same clock. */
function nowStamp(): string {
  return `${TODAY}T${NOW}:00Z`
}

let sequence = 0
function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

function record(task: WrittenTask, text: string): void {
  task.activity = [
    ...(task.activity ?? []),
    { id: nextId('e'), at: nowStamp(), text, by: SIGNED_IN },
  ]
}

function find(id: string): WrittenTask | undefined {
  return written.find((t) => t.id === id)
}

/** Everything a person can change about a written task. */
export interface TaskEdit {
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  assignee: string | null
  recipientId: string | null
  due: string | null
  dueTime: string | null
  estimate: number | null
}

export function updateTask(id: string, edit: TaskEdit): void {
  const task = find(id)
  if (!task) return
  const moved = task.assignee !== edit.assignee
  Object.assign(task, {
    title: edit.title,
    description: edit.description === '' ? undefined : edit.description,
    category: edit.category,
    priority: edit.priority,
    assignee: edit.assignee,
    recipientId: edit.recipientId,
    due: edit.due,
    dueTime: edit.dueTime ?? undefined,
    estimateMinutes: edit.estimate ?? undefined,
  })
  // Reassignment is the edit worth its own line: everything else is a detail,
  // but somebody else's name appearing on a task is a handover.
  record(
    task,
    moved ? `reassigned it to ${edit.assignee ?? 'nobody'}` : 'edited the task',
  )
  emit()
}

/**
 * One field, on purpose.
 *
 * The Tasks screen's bulk assign hands several tasks to one person; it has no
 * business rewriting anything else about them, which `updateTask` would since
 * it takes the whole form. Worked-out rows never reach here — their assignee
 * comes off the record they were read from.
 */
export function reassignTask(id: string, assignee: string | null): void {
  const task = find(id)
  if (!task || task.assignee === assignee) return
  task.assignee = assignee
  record(task, `reassigned it to ${assignee ?? 'nobody'}`)
  emit()
}

export function deleteTask(id: string): void {
  const at = written.findIndex((t) => t.id === id)
  if (at === -1) return
  written.splice(at, 1)
  emit()
}

/**
 * Notes left on a worked-out row, kept beside the derivation.
 *
 * A worked-out task is rebuilt from the records every time the list is drawn,
 * so there is nothing on it to write to. Its id is stable, though — it is made
 * of the visit, the credential or the request behind it — so a note keyed by
 * that id survives every redraw, and goes when the row itself goes.
 */
const notesOnDerived = new Map<string, TaskComment[]>()

export function addComment(id: string, body: string): void {
  if (body.trim() === '') return
  const entry: TaskComment = {
    id: nextId('k'),
    at: nowStamp(),
    author: SIGNED_IN,
    body: body.trim(),
  }
  const task = find(id)
  if (task) {
    task.comments = [...(task.comments ?? []), entry]
    record(task, 'left a comment')
  } else {
    notesOnDerived.set(id, [...(notesOnDerived.get(id) ?? []), entry])
  }
  emit()
}

export function addChecklistItem(id: string, label: string): void {
  const task = find(id)
  if (!task || label.trim() === '') return
  task.checklist = [
    ...(task.checklist ?? []),
    { id: nextId('c'), label: label.trim(), done: false },
  ]
  emit()
}

export function setChecklistItem(
  id: string,
  itemId: string,
  done: boolean,
): void {
  const task = find(id)
  if (!task) return
  const item = (task.checklist ?? []).find((c) => c.id === itemId)
  if (!item || item.done === done) return
  task.checklist = (task.checklist ?? []).map((c) =>
    c.id === itemId ? { ...c, done } : c,
  )
  record(task, `${done ? 'ticked off' : 'unticked'} “${item.label}”`)
  emit()
}

export function removeChecklistItem(id: string, itemId: string): void {
  const task = find(id)
  if (!task) return
  task.checklist = (task.checklist ?? []).filter((item) => item.id !== itemId)
  emit()
}

/* ----------------------------- worked-out tasks ---------------------------- */

/** How long a visit's paperwork can be outstanding before it is urgent. */
const WRITE_UP_GRACE_DAYS = 2

/** A credential inside this window is somebody's job this week. */
const RENEWAL_WINDOW_DAYS = 45

/** A request left unanswered this long is late, not merely waiting. */
const REQUEST_GRACE_DAYS = 3

const recipientNames = new Map(recipients.map((r) => [r.id, r.name]))

function recipientNameOf(id: string | null): string | null {
  return id ? (recipientNames.get(id) ?? null) : null
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  )
}

/**
 * Every worked-out task, at the day given.
 *
 * Each block below names the record it reads and the question it answers. None
 * of them invent a due date: the date on the row is the date the record itself
 * carries — the day the visit closed, the day the licence runs out, the day the
 * request came in.
 */
function derivedTasks(today = TODAY): AgencyTask[] {
  const tasks: AgencyTask[] = []

  // 1. Visits that closed with nothing filed. The paperwork is owed by whoever
  //    was on the visit, and it is owed from the day the visit ended.
  for (const visit of historyVisits('7', today)) {
    if (visit.outcome !== 'unrecorded') continue
    const age = daysBetween(visit.date, today)
    tasks.push({
      id: `wo-writeup-${visit.id}`,
      origin: 'worked-out',
      title: `Write up the ${visit.type.toLowerCase()} visit`,
      category: 'admin',
      priority: age > WRITE_UP_GRACE_DAYS ? 'high' : 'medium',
      assignee: visit.caregiverName,
      recipientId: visit.recipientId,
      recipientName: visit.recipientName,
      due: visit.date,
      source: 'The visit closed with no record filed against it.',
      to: `/scheduling/visits/${visit.id}/overview`,
      visitId: visit.id,
      done: false,
    })
  }

  // 2. Credentials. Expired is somebody rostered on a lapsed licence, which is
  //    the same fact the compliance alert raises; expiring is the renewal
  //    nobody has booked yet.
  for (const member of staffMembers) {
    if (member.status !== 'active') continue
    for (const { credential, state, daysRemaining } of credentialStates(
      member,
      today,
    )) {
      if (!credential.expiresAt) continue
      const expired = state === 'expired'
      if (
        !expired &&
        (daysRemaining === null || daysRemaining > RENEWAL_WINDOW_DAYS)
      )
        continue
      tasks.push({
        id: `wo-cred-${member.id}-${credential.id}`,
        origin: 'worked-out',
        // The credential's own name, as it is written on the record: lower-casing
        // it turned "CPR / First Aid" into "cpr / first aid".
        title: `${expired ? 'Renew the lapsed' : 'Renew'} ${credential.name} for ${member.name}`,
        category: 'training',
        priority: expired
          ? 'critical'
          : daysRemaining! <= 14
            ? 'high'
            : 'medium',
        // Not the caregiver: chasing a renewal is the office's job, and putting
        // it on the person whose licence lapsed is how it stays lapsed.
        assignee: 'HR Team',
        recipientId: null,
        recipientName: null,
        due: credential.expiresAt,
        source: expired
          ? `${credential.name} expired ${Math.abs(daysRemaining ?? 0)} days ago and they are still on the rota.`
          : `${credential.name} runs out in ${daysRemaining} days.`,
        to: `/caregivers/${member.id}/documents`,
        done: false,
      })
    }
  }

  // 3. Incidents nobody has settled. The write-up exists; what is outstanding
  //    is somebody deciding what happens next.
  for (const incident of incidentsFiled(today, 60)) {
    if (incident.outcome !== 'open') continue
    tasks.push({
      id: `wo-incident-${incident.id}`,
      origin: 'worked-out',
      title: `Follow up the ${incidentTypeLabels[incident.type].toLowerCase()} written up for ${incident.recipientName}`,
      category: 'safety',
      priority:
        incident.severity === 'critical' || incident.severity === 'high'
          ? 'high'
          : 'medium',
      assignee: incident.reporter,
      recipientId: incident.recipientId,
      recipientName: incident.recipientName,
      due: incident.at.slice(0, 10),
      source: `Incident ${incident.reference} is still open.`,
      to: `/live-monitoring/alerts/${incident.reference}/overview`,
      done: false,
    })
  }

  // 4. Care requests waiting on a decision. The clock started when the family
  //    sent it, not when somebody got round to it.
  for (const request of careRequests) {
    if (request.decision !== 'undecided') continue
    const waiting = daysWaiting(request, today)
    tasks.push({
      id: `wo-request-${request.id}`,
      origin: 'worked-out',
      title: `Decide on ${request.patient.name}'s care request`,
      category: 'operations',
      priority: waiting > REQUEST_GRACE_DAYS ? 'high' : 'medium',
      // The coordinator is a name on the request, not a record — the field
      // holds the string the family's request was routed to.
      assignee: request.coordinator ?? null,
      recipientId: null,
      recipientName: request.patient.name,
      due: addDays(request.submittedAt.slice(0, 10), REQUEST_GRACE_DAYS),
      source: `${request.ref} has been waiting ${waiting} day${waiting === 1 ? '' : 's'}.`,
      to: `/care-recipients/requests/${request.id}`,
      done: false,
    })
  }

  return tasks
}

/* ----------------------------------- SLA ---------------------------------- */

export interface SlaState {
  /** The target for this task's priority, in hours. */
  targetHours: number
  /** Hours since it was written, off the same clock as everything else. */
  hoursSince: number
  pastTarget: boolean
  /** Past the target by enough that the office is meant to pick it up. */
  escalated: boolean
}

/**
 * How a task stands against its priority's target.
 *
 * Only a written task has one: it carries the moment somebody wrote it, and
 * the target runs from there. A worked-out row was never written — it is read
 * off a record every time the list is drawn — so there is no moment to measure
 * from and this returns null rather than inventing one. Done tasks are past
 * caring.
 */
export function slaFor(task: AgencyTask): SlaState | null {
  if (task.done || !task.createdAt) return null
  const level = priorityById(task.priority)
  if (!level) return null

  const written = new Date(task.createdAt).getTime()
  const now = new Date(`${TODAY}T${NOW}:00Z`).getTime()
  const hoursSince = Math.max(0, (now - written) / 3_600_000)
  const pastTarget = hoursSince > level.slaHours
  const escalated =
    level.escalateAfterHours !== null &&
    hoursSince > level.slaHours + level.escalateAfterHours

  return { targetHours: level.slaHours, hoursSince, pastTarget, escalated }
}

/* --------------------------------- reading -------------------------------- */

/** Built off the one ordering, so a rank can never disagree with a filter. */
const priorityRank = Object.fromEntries(
  priorityRankOrder.map((p, index) => [p, index]),
) as Record<TaskPriority, number>

/**
 * Everything open, worst first: overdue before due, then by priority, then by
 * date. Done tasks sort last — they are kept so a coordinator can see what was
 * cleared today, not to pad the top of the list.
 */
export function allTasks(today = TODAY): AgencyTask[] {
  const rows: AgencyTask[] = [
    ...derivedTasks(today).map((task) => ({
      ...task,
      comments: notesOnDerived.get(task.id) ?? [],
    })),
    ...written.map((task) => ({
      ...task,
      origin: 'written' as const,
      recipientName: recipientNameOf(task.recipientId),
      checklist: task.checklist ?? [],
      comments: task.comments ?? [],
      activity: task.activity ?? [],
      // Its own page: a written task is the only kind this app owns, so it is
      // the only kind with somewhere of its own to be.
      to: `/tasks/${task.id}`,
    })),
  ]

  return rows.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const aLate = isOverdue(a, today)
    const bLate = isOverdue(b, today)
    if (aLate !== bLate) return aLate ? -1 : 1
    return (
      priorityRank[a.priority] - priorityRank[b.priority] ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999')
    )
  })
}

export function isOverdue(task: AgencyTask, today = TODAY): boolean {
  return !task.done && task.due !== null && task.due < today
}

export function isDueToday(task: AgencyTask, today = TODAY): boolean {
  return !task.done && task.due === today
}

/** "Today", "Yesterday", "in 3 days", "12 Aug" — a due date reads as a distance. */
export function formatDue(due: string | null, today = TODAY): string {
  if (due === null) return 'No date'
  const days = daysBetween(today, due)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${Math.abs(days)} days ago`
  if (days <= 7) return `In ${days} days`
  return dayStamp.format(new Date(`${due}T00:00:00Z`))
}

const dayStamp = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/**
 * What to call the person a task falls to.
 *
 * Read off the roster where they are on it. The two desks that are not — HR and
 * admin — are named rather than left blank, and anyone else falls back to their
 * own name rather than to an invented title.
 */
export function roleOf(name: string | null): string | null {
  if (!name) return null
  const member = staffMembers.find((m) => m.name === name)
  if (member) return member.title
  if (name === 'HR Team') return 'Human resources'
  if (name === 'Admin Support') return 'Administration'
  if (name === SIGNED_IN) return SIGNED_IN_ROLE
  return null
}

/** Everyone a task can be put on: the roster, plus the desks that are not on it. */
export function assignableNames(): string[] {
  const names = new Set<string>(['HR Team', 'Admin Support', SIGNED_IN])
  for (const member of staffMembers) {
    if (member.status === 'active') names.add(member.name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** One task by id, worked-out or written. Undefined once a written one is deleted. */
export function taskById(
  id: string | undefined,
  today = TODAY,
): AgencyTask | undefined {
  if (!id) return undefined
  return allTasks(today).find((t) => t.id === id)
}

/**
 * What else is open around this one — the same client first, then the same
 * person's other work. Nothing here is a stated "related task" field: a list
 * somebody has to maintain by hand goes stale the day after it is written.
 */
export function relatedTasks(task: AgencyTask, today = TODAY): AgencyTask[] {
  const open = allTasks(today)
    .filter(
      (other) =>
        other.id !== task.id &&
        !other.done &&
        ((task.recipientId !== null &&
          other.recipientId === task.recipientId) ||
          (task.assignee !== null && other.assignee === task.assignee)),
    )
    // Oldest date first: what is late matters more than what is coming, and a
    // task with no date on it has nothing to be urgent about.
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))

  // One per title. A client seen twice a day owes a write-up per visit, so the
  // same line comes back four times and crowds out everything else that is
  // open; the oldest of each kind stands for the rest.
  const seen = new Set<string>()
  const spread: AgencyTask[] = []
  for (const other of open) {
    if (seen.has(other.title)) continue
    seen.add(other.title)
    spread.push(other)
    if (spread.length === 4) break
  }
  return spread
}

/**
 * Tasks raised from a given template, this session.
 *
 * The only usage figure this app can produce. A template's card would rather
 * say "280 generated a month", but nothing generates anything here — see the
 * note at the top of `templates.ts`.
 */
/**
 * Relabel every written task under one category with another.
 *
 * Deleting a category on the settings screen has to say where its tasks go —
 * leaving them pointing at an id nobody recognises would label them with the
 * id itself. Worked-out rows are not touched, and cannot be: they are read off
 * records, and the categories they land in are the ones marked built in, which
 * the settings screen will not delete.
 */
export function recategoriseTasks(from: TaskCategory, to: TaskCategory): void {
  let moved = false
  for (const task of written) {
    if (task.category !== from) continue
    task.category = to
    moved = true
  }
  if (moved) emit()
}

export function tasksFromTemplate(
  templateId: string,
  today = TODAY,
): AgencyTask[] {
  return allTasks(today).filter((t) => t.fromTemplate === templateId)
}

/**
 * The visit a task is about.
 *
 * Two quite different questions with one answer. A worked-out paperwork row
 * *came off* a visit, so it names it outright. A written task does not come off
 * anything — but one about a client, due on a day that client is seen, is
 * almost always about that visit, so the page offers it as the visit it falls
 * alongside rather than as the visit it belongs to. Where neither holds, there
 * is no card: a task about ordering supplies is not about a visit, and pointing
 * it at the nearest one would be a guess with an address on it.
 */
export function relatedVisit(task: AgencyTask): BoardVisit | undefined {
  if (task.visitId) {
    return boardOn(task.due ?? TODAY).find((v) => v.id === task.visitId)
  }
  if (!task.recipientId || !task.due) return undefined
  return boardOn(task.due).find((v) => v.recipientId === task.recipientId)
}
