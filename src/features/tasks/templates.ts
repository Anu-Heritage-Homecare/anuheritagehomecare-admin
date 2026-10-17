/**
 * Reusable checklists.
 *
 * A template here is exactly one thing: a named list of steps somebody can
 * raise as a task, with the fields that are usually the same already filled in.
 * Applying one writes an ordinary task — same store, same page, same tick
 * boxes — with the steps copied onto it.
 *
 * What a template is *not*, in this app, is a schedule. The design has these
 * firing on their own ("Daily, 7:00–8:00 AM", "3x Daily", "156 generated this
 * week"), and nothing in this app runs when nobody is looking at it: there is
 * no server, no job, no clock but the one on the screen. A template that said
 * "Daily" and then produced nothing overnight would be worse than no template
 * at all, because a coordinator would stop checking. So the cadence field is
 * plain guidance, labelled as guidance, and the only count on a card is the
 * number of tasks somebody actually raised from it.
 *
 * Templates live in memory for the session, like everything else this app
 * writes.
 */
import { useSyncExternalStore } from 'react'
import { SIGNED_IN } from '@/lib/session'
import { createTask } from './data'
import type { TaskCategory, TaskPriority } from './data'
import type { StaffGroupId } from './groups'
import { groupById } from './groups'

export type TemplateFrequency =
  'daily' | 'per-visit' | 'per-shift' | 'weekly' | 'monthly' | 'as-needed'

export const frequencies: { id: TemplateFrequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'per-visit', label: 'Every visit' },
  { id: 'per-shift', label: 'Every shift' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'as-needed', label: 'As needed' },
]

export function frequencyLabel(id: TemplateFrequency): string {
  return frequencies.find((f) => f.id === id)?.label ?? 'As needed'
}

export interface TaskTemplate {
  id: string
  name: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  /**
   * How often it comes round. The design calls this the schedule, and it is
   * one in the sense a rota is: it says what the pattern is, so a coordinator
   * can find every daily checklist at once. Nothing fires on it — see the note
   * at the top of this file.
   */
  frequency: TemplateFrequency
  /**
   * The rest of the when, in words: "first thing, on the morning visit". Read
   * by a person, by nothing else.
   */
  cadence: string
  /**
   * The group it belongs to, as the design assigns one: a checklist for the
   * morning round is for whoever is on the round, not for one named caregiver.
   * Applying it narrows the assignee list to the people in this group.
   */
  assignedTo: StaffGroupId
  /** The creator's estimate for the whole list, in minutes. */
  estimateMinutes: number
  /** The steps, in order. */
  items: string[]
  active: boolean
  createdBy: string
}

const templates: TaskTemplate[] = [
  {
    id: 'tpl-morning',
    name: 'Morning care routine',
    description:
      'The standard morning round: personal care, medication and breakfast, in the order the care plans assume.',
    category: 'daily-care',
    priority: 'medium',
    frequency: 'daily',
    cadence: 'first thing, on the morning visit',
    assignedTo: 'all-caregivers',
    estimateMinutes: 45,
    items: [
      'Check the care plan for anything changed since the last visit',
      'Personal care and dressing',
      'Morning medication against the chart',
      'Breakfast and fluids',
      'Note anything unusual about mood or mobility',
      'Write the visit up before leaving',
    ],
    active: true,
    createdBy: 'Mike Chen',
  },
  {
    id: 'tpl-medication',
    name: 'Medication round',
    description:
      'Administering and documenting a scheduled round, including what to do about a refusal.',
    category: 'medication',
    priority: 'high',
    frequency: 'per-visit',
    cadence: 'at each scheduled round',
    assignedTo: 'certified-staff',
    estimateMinutes: 20,
    items: [
      'Check the chart against the pack',
      'Confirm the client is able to take it now',
      'Administer and watch it taken',
      'Record the time and the dose',
      'If refused, record the reason and tell the coordinator',
    ],
    active: true,
    createdBy: 'Dr. Jane Foster',
  },
  {
    id: 'tpl-assessment',
    name: 'Weekly health check',
    description:
      'Vitals, mobility and orientation, written up against the client record.',
    category: 'assessment',
    priority: 'medium',
    frequency: 'weekly',
    cadence: 'with the senior caregiver',
    assignedTo: 'senior-caregivers',
    estimateMinutes: 30,
    items: [
      'Blood pressure, pulse and temperature',
      'Weight, where the plan asks for it',
      'Skin integrity check',
      'Mobility and transfers',
      'Orientation to time, place and person',
      'Record against the health timeline',
    ],
    active: true,
    createdBy: 'Emma Wilson',
  },
  {
    id: 'tpl-incident',
    name: 'Incident follow-up',
    description:
      'What happens after a write-up is filed: telling the family, checking the environment, and deciding the outcome.',
    category: 'safety',
    priority: 'high',
    frequency: 'as-needed',
    cadence: 'the same day the incident is written up',
    assignedTo: 'all-staff',
    estimateMinutes: 25,
    items: [
      'Read the write-up and the visit it came from',
      'Speak to the caregiver who filed it',
      'Tell the family and record that you did',
      'Check whether anything in the home needs changing',
      'Set the incident outcome',
    ],
    active: true,
    createdBy: SIGNED_IN,
  },
  {
    id: 'tpl-handover',
    name: 'Shift handover',
    description: 'What the next caregiver needs to know before they arrive.',
    category: 'operations',
    priority: 'medium',
    frequency: 'per-shift',
    cadence: 'at the end of a shift',
    assignedTo: 'all-caregivers',
    estimateMinutes: 10,
    items: [
      'Anything not done, and why',
      'Changes in mood, appetite or mobility',
      'Medication given or refused',
      'Anything the family asked for',
      'Supplies running low',
    ],
    active: true,
    createdBy: 'Amara Nwosu',
  },
  {
    id: 'tpl-review',
    name: 'Monthly care plan review',
    description:
      'Going back over the plan with the family: what is working, what has changed, what the hours should be.',
    category: 'planning',
    priority: 'medium',
    frequency: 'monthly',
    cadence: '',
    assignedTo: 'care-managers',
    estimateMinutes: 60,
    items: [
      'Read the last month of visit notes',
      'Check the goals against what actually happened',
      'Look at hours used against the package',
      'Speak to the family',
      'Update the plan and record what changed',
    ],
    active: false,
    createdBy: 'Mike Chen',
  },
]

let made = 0
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

export function useTemplates(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  )
}

export function allTemplates(): TaskTemplate[] {
  return [...templates].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  )
}

/** The same move, for the templates written under a category being deleted. */
export function recategoriseTemplates(
  from: TaskCategory,
  to: TaskCategory,
): void {
  let moved = false
  for (const template of templates) {
    if (template.category !== from) continue
    template.category = to
    moved = true
  }
  if (moved) emit()
}

export function templateById(id: string | undefined): TaskTemplate | undefined {
  return id ? templates.find((t) => t.id === id) : undefined
}

export type TemplateDraft = Omit<TaskTemplate, 'id' | 'active' | 'createdBy'>

export function createTemplate(draft: TemplateDraft): string {
  made += 1
  const id = `tpl-new-${made}`
  templates.unshift({ ...draft, id, active: true, createdBy: SIGNED_IN })
  emit()
  return id
}

/**
 * What a template looks like on its way in from a file. Everything optional
 * except the two things a checklist cannot do without: a name and its steps.
 */
interface ImportedTemplate {
  name?: unknown
  description?: unknown
  category?: unknown
  priority?: unknown
  frequency?: unknown
  cadence?: unknown
  assignedTo?: unknown
  estimateMinutes?: unknown
  items?: unknown
}

export interface ImportResult {
  added: number
  /** Entries that were not a usable checklist, or were already here by name. */
  skipped: number
  /** Set where the file itself could not be read as a list of templates. */
  error?: string
}

const PRIORITIES: TaskPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
  'normal',
]

/**
 * Read templates out of a JSON file the user picked.
 *
 * The file is whatever they hand over, so nothing in it is trusted: every field
 * is checked and anything unusable is dropped rather than guessed at. A name
 * already on the board is skipped, so importing the same file twice does not
 * quietly double every checklist.
 *
 * Accepts either a bare array or `{ "templates": [...] }`, which is what this
 * screen's own export writes.
 */
export function importTemplates(
  text: string,
  knownCategories: TaskCategory[],
): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { added: 0, skipped: 0, error: 'That file is not JSON.' }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { templates?: unknown }).templates)
      ? (parsed as { templates: unknown[] }).templates
      : null

  if (!list)
    return {
      added: 0,
      skipped: 0,
      error: 'No templates in that file — it needs a list of them.',
    }

  const taken = new Set(templates.map((t) => t.name.trim().toLowerCase()))
  let added = 0
  let skipped = 0

  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) {
      skipped += 1
      continue
    }
    const entry = raw as ImportedTemplate
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    const items = Array.isArray(entry.items)
      ? entry.items
          .filter((i): i is string => typeof i === 'string' && i.trim() !== '')
          .map((i) => i.trim())
      : []

    if (name === '' || items.length === 0 || taken.has(name.toLowerCase())) {
      skipped += 1
      continue
    }

    const category =
      typeof entry.category === 'string' &&
      knownCategories.includes(entry.category)
        ? entry.category
        : // Nothing invented: a category this agency does not keep becomes the
          // one every uncategorised task already falls under.
          knownCategories[0]
    const priority =
      typeof entry.priority === 'string' &&
      PRIORITIES.includes(entry.priority as TaskPriority)
        ? (entry.priority as TaskPriority)
        : 'medium'
    const estimate =
      typeof entry.estimateMinutes === 'number' &&
      Number.isFinite(entry.estimateMinutes) &&
      entry.estimateMinutes > 0
        ? Math.round(entry.estimateMinutes)
        : items.length * 5

    createTemplate({
      name,
      description:
        typeof entry.description === 'string' ? entry.description.trim() : '',
      category,
      priority,
      frequency:
        typeof entry.frequency === 'string' &&
        frequencies.some((f) => f.id === entry.frequency)
          ? (entry.frequency as TemplateFrequency)
          : 'as-needed',
      cadence: typeof entry.cadence === 'string' ? entry.cadence.trim() : '',
      assignedTo:
        typeof entry.assignedTo === 'string' &&
        groupById(entry.assignedTo as StaffGroupId).id === entry.assignedTo
          ? (entry.assignedTo as StaffGroupId)
          : 'all-staff',
      estimateMinutes: estimate,
      items,
    })
    taken.add(name.toLowerCase())
    added += 1
  }

  return { added, skipped }
}

export function updateTemplate(id: string, draft: TemplateDraft): void {
  const template = templateById(id)
  if (!template) return
  Object.assign(template, draft)
  emit()
}

/** A copy, clearly named as one, so the original is never edited by accident. */
export function duplicateTemplate(id: string): string | undefined {
  const template = templateById(id)
  if (!template) return undefined
  made += 1
  const copy: TaskTemplate = {
    ...template,
    id: `tpl-new-${made}`,
    name: `${template.name} (copy)`,
    items: [...template.items],
    createdBy: SIGNED_IN,
    active: true,
  }
  templates.unshift(copy)
  emit()
  return copy.id
}

/**
 * Retired rather than deleted, by default.
 *
 * A template somebody has raised tasks from is a piece of history: the tasks
 * name it, and deleting it would leave them pointing at nothing.
 */
export function setTemplateActive(id: string, active: boolean): void {
  const template = templateById(id)
  if (!template || template.active === active) return
  template.active = active
  emit()
}

export function deleteTemplate(id: string): void {
  const at = templates.findIndex((t) => t.id === id)
  if (at === -1) return
  templates.splice(at, 1)
  emit()
}

export interface ApplyOptions {
  assignee: string | null
  recipientId: string | null
  due: string | null
}

/**
 * Raise a task from a template.
 *
 * The one thing a template does in this app, and it does it when a person asks
 * — never on a clock. What comes out is an ordinary written task with the steps
 * copied onto it as an unticked checklist.
 */
export function applyTemplate(
  id: string,
  options: ApplyOptions,
): string | undefined {
  const template = templateById(id)
  if (!template) return undefined
  return createTask({
    title: template.name,
    description: template.description,
    category: template.category,
    priority: template.priority,
    assignee: options.assignee,
    recipientId: options.recipientId,
    due: options.due,
    estimateMinutes: template.estimateMinutes,
    items: template.items,
    fromTemplate: template.id,
  })
}
