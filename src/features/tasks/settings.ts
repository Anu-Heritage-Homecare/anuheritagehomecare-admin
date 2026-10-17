/**
 * How tasks are labelled and sorted, and who they land on by default.
 *
 * The vocabulary lives here rather than in `data.ts` because it is the part a
 * coordinator can change: the categories on the settings screen are the same
 * objects the create form offers, the task rows colour themselves from, and the
 * filters are built out of. A settings page that edited a copy would be a
 * settings page that changed nothing.
 *
 * Four categories are marked `derived` and cannot be removed: Administrative,
 * Training, Safety & Incidents and Operations are where the worked-out rows
 * land — visit write-ups, lapsed credentials, incident follow-ups and care
 * requests respectively. Deleting one would leave those rows labelled with an
 * id nobody recognises. Renaming, recolouring and switching one off are all
 * fine: inactive only hides it from the create form, and presentation is the
 * whole point of the screen.
 *
 * Held in memory for the session, like everything else this app writes.
 */
import { useSyncExternalStore } from 'react'
import type { Tone } from '@/types'
import type { CategoryIconId } from './category-icons'
import { membersOfGroup } from './groups'
import type { StaffGroupId } from './groups'

/** Ids are free-form: a coordinator can add one the type never knew about. */
export type TaskCategory = string

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low' | 'normal'

export interface CategorySetting {
  id: TaskCategory
  label: string
  tone: Tone
  icon: CategoryIconId
  /**
   * The group a task in this category falls to, as the design's Auto-Assign
   * column sets one. A group rather than a person: "medication goes to
   * certified staff" survives somebody leaving, and a named default does not.
   */
  autoAssign: StaffGroupId | null
  /** Whether the create and template forms offer it. The design's Status. */
  offered: boolean
  /** True where the app itself produces rows in this category. */
  derived: boolean
}

/**
 * One row of the notifications list.
 *
 * The switch is real and the choice is stored. What is behind it is not: this
 * app has no email, no push and no SMS, and nothing runs while the tab is
 * closed. So the section says as much on screen, and these record a preference
 * for a system that would do the sending rather than pretending to do it.
 */
export interface NotificationSetting {
  id: string
  label: string
  /** How it would go out, in the words the design uses. */
  channel: string
  on: boolean
}

export interface PrioritySetting {
  id: TaskPriority
  label: string
  /**
   * Hours from a task being written to when it should have been dealt with.
   *
   * A real number that a real clock can be held against: written tasks carry
   * the moment they were created, so "past its target" is worked out, not
   * claimed. Nothing chases it — see `escalateAfterHours`.
   */
  slaHours: number
  /**
   * Hours past the target before the task is one for the office to pick up.
   * Zero means as soon as it is written, null means it is never raised.
   *
   * This marks the task; it does not send anything. There is no outbound
   * channel in this app, so "escalate" here means the task says out loud that
   * it is somebody else's problem now.
   */
  escalateAfterHours: number | null
}

export const toneChoices: Tone[] = [
  'blue',
  'green',
  'amber',
  'red',
  'rose',
  'purple',
  'slate',
]

function defaults(): {
  categories: CategorySetting[]
  priorities: PrioritySetting[]
  defaultPriority: TaskPriority
  notifications: NotificationSetting[]
} {
  return {
    categories: [
      // The six the templates are written against, from the design. None is
      // derived: nothing in the app produces a row in them, so a coordinator
      // can rename, recolour or retire any of them.
      {
        id: 'daily-care',
        label: 'Daily Care',
        tone: 'green',
        icon: 'home',
        autoAssign: 'all-caregivers',
        offered: true,
        derived: false,
      },
      {
        id: 'medication',
        label: 'Medication',
        tone: 'amber',
        icon: 'pill',
        autoAssign: 'certified-staff',
        offered: true,
        derived: false,
      },
      {
        id: 'assessment',
        label: 'Assessment',
        tone: 'blue',
        icon: 'clipboard',
        autoAssign: 'senior-caregivers',
        offered: true,
        derived: false,
      },
      {
        id: 'safety',
        label: 'Safety & Incidents',
        tone: 'red',
        icon: 'alert',
        autoAssign: 'all-staff',
        offered: true,
        derived: true,
      },
      {
        id: 'operations',
        label: 'Operations',
        tone: 'blue',
        icon: 'settings',
        autoAssign: 'care-managers',
        offered: true,
        derived: true,
      },
      {
        id: 'planning',
        label: 'Planning',
        tone: 'purple',
        icon: 'calendar',
        autoAssign: 'care-managers',
        offered: true,
        derived: false,
      },
      {
        id: 'admin',
        label: 'Administrative',
        tone: 'slate',
        icon: 'file',
        autoAssign: 'care-managers',
        offered: true,
        derived: true,
      },
      {
        id: 'training',
        label: 'Training',
        tone: 'rose',
        icon: 'training',
        autoAssign: 'care-managers',
        offered: false,
        derived: true,
      },
    ],
    priorities: [
      { id: 'critical', label: 'Critical', slaHours: 2, escalateAfterHours: 0 },
      { id: 'high', label: 'High', slaHours: 4, escalateAfterHours: 2 },
      { id: 'medium', label: 'Medium', slaHours: 8, escalateAfterHours: 4 },
      { id: 'low', label: 'Low', slaHours: 24, escalateAfterHours: 12 },
      { id: 'normal', label: 'Normal', slaHours: 48, escalateAfterHours: null },
    ],
    defaultPriority: 'medium',
    notifications: [
      {
        id: 'assigned',
        label: 'Task assigned to you',
        channel: 'Push + Email',
        on: true,
      },
      {
        id: 'due-soon',
        label: 'Task due in 1 hour',
        channel: 'Push only',
        on: true,
      },
      {
        id: 'overdue',
        label: 'Task overdue',
        channel: 'Push + Email + SMS',
        on: true,
      },
      {
        id: 'completed',
        label: 'Task completed by team member',
        channel: 'In-app notification only',
        on: false,
      },
      {
        id: 'daily',
        label: 'Daily task summary',
        channel: 'Email (8:00 AM)',
        on: true,
      },
      {
        id: 'weekly',
        label: 'Weekly completion report',
        channel: 'Email (Monday 9:00 AM)',
        on: true,
      },
    ],
  }
}

let state = defaults()
let version = 0
const listeners = new Set<() => void>()

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTaskSettings(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  )
}

/* ------------------------------- categories ------------------------------- */

export function allCategories(): CategorySetting[] {
  return state.categories
}

export function categoryById(id: TaskCategory): CategorySetting | undefined {
  return state.categories.find((c) => c.id === id)
}

/**
 * The label to print. Falls back to the id rather than to an empty cell: a task
 * written under a category somebody later deleted still has to say something.
 */
export function categoryLabel(id: TaskCategory): string {
  return categoryById(id)?.label ?? id
}

export function categoryTone(id: TaskCategory): Tone {
  return categoryById(id)?.tone ?? 'slate'
}

/** What the create and template forms offer, in the order set here. */
export function offeredCategories(): CategorySetting[] {
  return state.categories.filter((c) => c.offered)
}

export function autoAssignFor(id: TaskCategory): StaffGroupId | null {
  return categoryById(id)?.autoAssign ?? null
}

/**
 * A name to pre-select on a new task in this category.
 *
 * The category names a group; a task has to land on one person, so the first
 * of them is offered and the form lets it be changed. Null where the category
 * auto-assigns to nobody, or where the group has nobody in it today.
 */
export function defaultAssigneeFor(id: TaskCategory): string | null {
  const group = autoAssignFor(id)
  return group ? (membersOfGroup(group)[0]?.name ?? null) : null
}

export interface CategoryEdit {
  label: string
  tone: Tone
  icon: CategoryIconId
  autoAssign: StaffGroupId | null
  offered: boolean
}

/* ------------------------------- priorities ------------------------------- */

export function allPriorities(): PrioritySetting[] {
  return state.priorities
}

export function allNotifications(): NotificationSetting[] {
  return state.notifications
}

export const priorityOrder: TaskPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
  'normal',
]

export function priorityById(id: TaskPriority): PrioritySetting | undefined {
  return state.priorities.find((p) => p.id === id)
}

export function priorityLabel(id: TaskPriority): string {
  return state.priorities.find((p) => p.id === id)?.label ?? id
}

export function defaultPriority(): TaskPriority {
  return state.defaultPriority
}

/* ------------------------------ draft + save ------------------------------ */

export interface TaskSettingsDraft {
  categories: CategorySetting[]
  priorities: PrioritySetting[]
  defaultPriority: TaskPriority
  notifications: NotificationSetting[]
}

/**
 * A copy of the live settings for a form to work on.
 *
 * Deep, deliberately. The settings screen edits a label a keystroke at a time,
 * and handing it the live objects would rename a category across every task
 * list in the app while somebody was still halfway through typing the new name.
 */
export function snapshotTaskSettings(): TaskSettingsDraft {
  return structuredClone({
    categories: state.categories,
    priorities: state.priorities,
    defaultPriority: state.defaultPriority,
    notifications: state.notifications,
  })
}

/** The shipped settings, for the form to reset to. */
export function defaultTaskSettings(): TaskSettingsDraft {
  return defaults()
}

/** What the next added category would be called. */
export function nextCategoryId(draft: TaskSettingsDraft): string {
  let n = draft.categories.length
  let id = `custom-${n}`
  while (draft.categories.some((c) => c.id === id)) id = `custom-${++n}`
  return id
}

/**
 * Commit a draft. This is the moment every other screen's vocabulary changes.
 *
 * Inactive only hides a category from the create and template forms. It does
 * not stop the app filing worked-out rows into a built-in one — those rows are
 * read off records, not written by anybody — which is why a built-in category
 * can be switched off but never removed.
 */
export function applyTaskSettings(draft: TaskSettingsDraft): void {
  const next = structuredClone(draft)
  for (const category of next.categories) {
    category.label =
      category.label.trim() === '' ? category.id : category.label.trim()
  }
  for (const priority of next.priorities) {
    if (priority.label.trim() === '') priority.label = priority.id
    priority.label = priority.label.trim()
    // A target of nothing is not a target, and hours cannot run backwards.
    priority.slaHours = Math.max(1, Math.round(priority.slaHours || 1))
    if (priority.escalateAfterHours !== null)
      priority.escalateAfterHours = Math.max(
        0,
        Math.round(priority.escalateAfterHours),
      )
  }
  state = next
  emit()
}

/**
 * Whether a draft differs from the shipped defaults.
 *
 * Compared rather than tracked with a dirty flag: a coordinator who changes a
 * label and changes it back has not changed anything, and a Reset button that
 * stayed lit would be telling them otherwise.
 */
export function isDefault(
  draft: TaskSettingsDraft = snapshotTaskSettings(),
): boolean {
  return JSON.stringify(draft) === JSON.stringify(defaults())
}

/** Whether a draft still matches what is live — what Save Changes reads. */
export function isSaved(draft: TaskSettingsDraft): boolean {
  return JSON.stringify(draft) === JSON.stringify(snapshotTaskSettings())
}
