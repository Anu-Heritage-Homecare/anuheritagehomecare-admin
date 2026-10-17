import { createElement, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import {
  applyTaskSettings,
  defaultTaskSettings,
  isDefault,
  isSaved,
  nextCategoryId,
  snapshotTaskSettings,
  toneChoices,
  useTaskSettings,
} from '@/features/tasks/settings'
import type {
  CategorySetting,
  TaskSettingsDraft,
} from '@/features/tasks/settings'
import { categoryIcon, categoryIcons } from '@/features/tasks/category-icons'
import type { CategoryIconId } from '@/features/tasks/category-icons'
import {
  groupLabel,
  membersOfGroup,
  staffGroups,
} from '@/features/tasks/groups'
import type { StaffGroupId } from '@/features/tasks/groups'
import { allTasks, recategoriseTasks, useTasks } from '@/features/tasks/data'
import {
  allTemplates,
  recategoriseTemplates,
  useTemplates,
} from '@/features/tasks/templates'
import { Drawer } from '@/components/ui/Drawer'
import type { Tone } from '@/types'
import { toneDot, tonePill, toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/**
 * Task settings.
 *
 * Six sections, as the design has them, reached from the rail on the left.
 * Two of them configure something — the categories every screen labels itself
 * with, and the priority words. The other four describe work happening while
 * nobody is looking at the screen: notifications, reminders, escalation, a
 * status workflow. This app has no server and no scheduler, so those sections
 * say what is missing rather than offering switches with nothing behind them.
 *
 * Nothing leaves this page until Save Changes: the form edits a copy, because
 * renaming a category a keystroke at a time would rename it across every task
 * list in the app while somebody was still typing.
 */
const sections = [
  { id: 'categories', label: 'Categories' },
  { id: 'priorities', label: 'Priority Levels' },
  { id: 'statuses', label: 'Status Configuration' },
  { id: 'auto-assign', label: 'Auto-Assignment' },
  { id: 'notifications', label: 'Notifications & Reminders' },
] as const

type SectionId = (typeof sections)[number]['id']

/**
 * Which section the reader is in, for the rail.
 *
 * Everything is on one page, so the rail navigates rather than switches. The
 * observer lights the topmost heading that is on screen; clicking a rail item
 * is an ordinary anchor jump, which keeps deep links and the back button
 * working without any of this having to know about them.
 */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>('categories')

  useEffect(() => {
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          seen.set(entry.target.id, entry.isIntersecting)
        const first = sections.find((s) => seen.get(s.id))
        if (first) setActive(first.id)
      },
      // A band across the top: a heading counts as "here" once it reaches the
      // upper third, not when it first peeks in at the bottom.
      { rootMargin: '-80px 0px -66% 0px' },
    )
    for (const section of sections) {
      const node = document.getElementById(section.id)
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [])

  return active
}

export function TaskSettingsPage() {
  useTaskSettings()
  useTasks()
  useTemplates()

  const active = useActiveSection()

  const [draft, setDraft] = useState<TaskSettingsDraft>(snapshotTaskSettings)
  const [editing, setEditing] = useState<CategorySetting | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<CategorySetting | null>(null)
  // Where the tasks under a deleted category go, held until Save with the rest
  // of the draft so the two land together.
  const [moves, setMoves] = useState<{ from: string; to: string }[]>([])
  const [saved, setSaved] = useState(false)

  const tasks = allTasks()
  const templates = allTemplates()
  const clean = isSaved(draft)

  const countFor = (id: string) =>
    tasks.filter((t) => t.category === id).length +
    templates.filter((t) => t.category === id).length

  const touch = () => setSaved(false)

  const editCategory = (id: string, edit: Partial<CategorySetting>) => {
    touch()
    setDraft((d) => ({
      ...d,
      categories: d.categories.map((c) =>
        c.id === id ? { ...c, ...edit } : c,
      ),
    }))
  }

  const editPriority = (
    id: string,
    edit: Partial<{
      label: string
      slaHours: number
      escalateAfterHours: number | null
    }>,
  ) => {
    touch()
    setDraft((d) => ({
      ...d,
      priorities: d.priorities.map((p) =>
        p.id === id ? { ...p, ...edit } : p,
      ),
    }))
  }

  const save = () => {
    // The moves first: relabelling a task to a category that the commit is
    // about to remove would leave it pointing at nothing.
    for (const move of moves) {
      recategoriseTasks(move.from, move.to)
      recategoriseTemplates(move.from, move.to)
    }
    setMoves([])
    applyTaskSettings(draft)
    // Re-read rather than trust the draft: the store trims labels, and the
    // form has to show what was actually kept.
    setDraft(snapshotTaskSettings())
    setSaved(true)
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/tasks" className="hover:text-ink">
              Tasks
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-brand-700 font-medium" aria-current="page">
            Settings
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Task Settings
          </h1>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm">
            Configure the task categories and priorities every other screen is
            built out of.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Puts the shipped settings back into the form. It saves too, so the
              button does what its name says rather than leaving the screen
              looking reset and the app still renamed. */}
          <button
            type="button"
            disabled={isDefault(draft) && clean}
            onClick={() => {
              applyTaskSettings(defaultTaskSettings())
              setDraft(snapshotTaskSettings())
              setMoves([])
              setSaved(true)
              setAdding(false)
              setEditing(null)
              setRemoving(null)
            }}
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw
              className="size-4 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            Reset to Defaults
          </button>
          <button
            type="button"
            disabled={clean}
            onClick={save}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </header>

      {/* Nothing here reaches the rest of the app until Save, so the screen has
          to say which of the two states it is in. */}
      {(!clean || saved) && (
        <p
          role="status"
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            clean
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-800',
          )}
        >
          {clean
            ? 'Saved. Every task screen reads these now.'
            : 'Unsaved changes — the task screens are still using the old words.'}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav
          aria-label="Settings sections"
          className="lg:sticky lg:top-4 lg:self-start"
        >
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? 'true' : undefined}
                  className={cn(
                    'inline-flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm whitespace-nowrap transition-colors',
                    active === s.id
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-ink-muted hover:bg-sunken hover:text-ink font-medium',
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-10">
          <Section
            id="categories"
            title="Task Categories"
            blurb="Define categories to organize and classify tasks."
          >
            <div className="card overflow-hidden">
              <div
                tabIndex={0}
                role="region"
                aria-label="Task categories table"
                className="overflow-x-auto"
              >
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead className="text-ink-subtle bg-canvas text-xs">
                    <tr className="border-line border-b">
                      {[
                        'Category name',
                        'Color',
                        'Icon',
                        'Tasks count',
                        'Auto-assign',
                        'Status',
                        'Actions',
                      ].map((col, i) => (
                        <th
                          key={col}
                          scope="col"
                          className={cn(
                            'px-4 py-3 font-semibold tracking-wider whitespace-nowrap uppercase',
                            i === 6 && 'text-right',
                          )}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {draft.categories.map((category) => (
                      <Row
                        key={category.id}
                        category={category}
                        used={countFor(category.id)}
                        onEdit={() => setEditing(category)}
                        onRemove={() => setRemoving(category)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-brand-700 hover:text-brand-800 mt-2 inline-flex min-h-11 items-center text-sm font-semibold"
            >
              Add Category
            </button>
          </Section>

          <Section
            id="priorities"
            title="Priority Levels"
            blurb="Configure priority levels and their visual indicators."
          >
            <div className="card overflow-hidden">
              <div
                tabIndex={0}
                role="region"
                aria-label="Priority levels table"
                className="overflow-x-auto"
              >
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead className="text-ink-subtle bg-canvas text-xs">
                    <tr className="border-line border-b">
                      {[
                        'Level',
                        'Color',
                        'Label',
                        'SLA (hours)',
                        'Escalation',
                        'Default',
                      ].map((col, i) => (
                        <th
                          key={col}
                          scope="col"
                          className={cn(
                            'px-4 py-3 font-semibold tracking-wider whitespace-nowrap uppercase',
                            i === 5 && 'text-right',
                          )}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {draft.priorities.map((priority, index) => (
                      <tr key={priority.id} className="hover:bg-canvas">
                        <th
                          scope="row"
                          className="text-ink px-4 py-3 text-left text-sm font-semibold whitespace-nowrap"
                        >
                          {index + 1}
                          {index === 0 && ' (highest)'}
                          {index === draft.priorities.length - 1 && ' (lowest)'}
                        </th>
                        <td className="px-4 py-3">
                          <Dot tone={priorityTone[priority.id]} />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={priority.label}
                            onChange={(e) =>
                              editPriority(priority.id, {
                                label: e.target.value,
                              })
                            }
                            aria-label={`Label for level ${index + 1}`}
                            className={cn(
                              'hover:border-line focus:border-brand-500 h-9 w-36 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium',
                              toneText[priorityTone[priority.id]],
                            )}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {/* A real number, held against a real clock: a
                                written task carries the moment it was written,
                                so the task screen can say when one is past
                                this. */}
                          <span className="text-ink flex items-baseline gap-1 text-sm">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={priority.slaHours}
                              onChange={(e) =>
                                editPriority(priority.id, {
                                  slaHours: Number(e.target.value),
                                })
                              }
                              aria-label={`Target hours for level ${index + 1}`}
                              className="hover:border-line focus:border-brand-500 h-9 w-11 rounded-lg border border-transparent bg-transparent px-1 text-right text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span>hours</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <SelectBox
                            value={
                              priority.escalateAfterHours === null
                                ? 'none'
                                : String(priority.escalateAfterHours)
                            }
                            onChange={(e) =>
                              editPriority(priority.id, {
                                escalateAfterHours:
                                  e.target.value === 'none'
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                            aria-label={`Escalation for level ${index + 1}`}
                            className="text-ink hover:border-line focus:border-brand-500 h-9 w-52 appearance-none rounded-lg border border-transparent bg-transparent px-2 text-sm"
                          >
                            <option value="0">Immediate to Manager</option>
                            {[1, 2, 4, 8, 12, 24].map((h) => (
                              <option key={h} value={h}>
                                After {h} hour{h === 1 ? '' : 's'}
                              </option>
                            ))}
                            <option value="none">None</option>
                          </SelectBox>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="radio"
                            name="default-priority"
                            checked={draft.defaultPriority === priority.id}
                            onChange={() => {
                              touch()
                              setDraft((d) => ({
                                ...d,
                                defaultPriority: priority.id,
                              }))
                            }}
                            aria-label={`Default for a new task: level ${index + 1}`}
                            className="accent-brand-600 size-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          <Section
            id="statuses"
            title="Status Configuration"
            blurb="The four a task can be in. Worked out, not set by hand."
          >
            <ul className="card divide-line divide-y">
              <Status
                label="Pending"
                tone="bg-sunken text-ink-muted"
                rule="Nothing on its checklist is ticked and its date has not passed."
              />
              <Status
                label="In Progress"
                tone="bg-brand-50 text-brand-700"
                rule="Some of its checklist is ticked, but not all of it."
              />
              <Status
                label="Overdue"
                tone="bg-red-50 text-red-700"
                rule="Its date has passed and it is not complete."
              />
              <Status
                label="Completed"
                tone="bg-emerald-50 text-emerald-700"
                rule="Somebody marked it complete."
              />
            </ul>
          </Section>

          <Section
            id="auto-assign"
            title="Auto-Assignment"
            blurb="The group a task falls to, by the category it is written under."
          >
            <ul className="card divide-line divide-y">
              {draft.categories.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Dot tone={category.tone} />
                    <span className="text-ink min-w-0 text-sm font-medium break-words">
                      {category.label}
                    </span>
                  </span>
                  <GroupSelect
                    value={category.autoAssign}
                    label={`Auto-assign for ${category.label}`}
                    onChange={(autoAssign) =>
                      editCategory(category.id, { autoAssign })
                    }
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="notifications"
            title="Notifications &amp; Reminders"
            blurb="Configure when and how task notifications are sent."
          >
            {/* The switches work and the choices are saved. What is behind
                  them does not exist: no email, no push, no SMS, and nothing
                  running while the tab is closed. Said once, here, rather than
                  left for somebody to find out by waiting for an 8am summary
                  that never comes. */}
            <ul className="card divide-line divide-y">
              {draft.notifications.map((notification) => (
                <li
                  key={notification.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <span className="min-w-0">
                    <span className="text-ink block text-sm font-semibold break-words">
                      {notification.label}
                    </span>
                    <span className="text-ink-subtle block text-sm">
                      {notification.channel}
                    </span>
                  </span>
                  <Toggle
                    on={notification.on}
                    label={notification.label}
                    onChange={(on) => {
                      touch()
                      setDraft((d) => ({
                        ...d,
                        notifications: d.notifications.map((n) =>
                          n.id === notification.id ? { ...n, on } : n,
                        ),
                      }))
                    }}
                  />
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {editing && (
        <CategoryDialog
          category={editing}
          onClose={() => setEditing(null)}
          onSave={(edit) => {
            editCategory(editing.id, edit)
            setEditing(null)
          }}
        />
      )}
      {removing && (
        <DeleteCategoryDialog
          category={removing}
          used={countFor(removing.id)}
          others={draft.categories.filter((c) => c.id !== removing.id)}
          onClose={() => setRemoving(null)}
          onConfirm={(to) => {
            touch()
            if (to) setMoves((m) => [...m, { from: removing.id, to }])
            setDraft((d) => ({
              ...d,
              categories: d.categories.filter((c) => c.id !== removing.id),
            }))
            setRemoving(null)
          }}
        />
      )}
      {adding && (
        <CategoryDialog
          onClose={() => setAdding(false)}
          onSave={(edit) => {
            touch()
            setDraft((d) => ({
              ...d,
              categories: [
                ...d.categories,
                { ...edit, id: nextCategoryId(d), derived: false },
              ],
            }))
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * The colour each level wears, everywhere in the app. Fixed on purpose: red
 * for critical is a meaning, not a preference, and the table shows it rather
 * than offering to change it.
 */
const priorityTone: Record<string, Tone> = {
  critical: 'red',
  high: 'amber',
  medium: 'amber',
  low: 'blue',
  normal: 'slate',
}

function Section({
  id,
  title,
  blurb,
  children,
}: {
  id: string
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    // scroll-mt keeps the heading clear of the top when the rail jumps to it.
    <section id={id} className="scroll-mt-6">
      <h2 className="text-ink text-lg font-bold tracking-tight">{title}</h2>
      <p className="text-ink-muted mt-0.5 text-sm">{blurb}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Status({
  label,
  tone,
  rule,
}: {
  label: string
  tone: string
  rule: string
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <span
        className={cn(
          'inline-flex w-28 shrink-0 items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold',
          tone,
        )}
      >
        {label}
      </span>
      <span className="text-ink-muted min-w-0 text-sm break-words">{rule}</span>
    </li>
  )
}

/**
 * The category's icon. Built with createElement rather than `<Icon />`: the
 * component comes out of a lookup, and JSX on a looked-up value reads to the
 * linter as a component defined during render.
 */
function CategoryGlyph({ icon }: { icon: CategoryIconId }) {
  return createElement(categoryIcon(icon), {
    className: 'size-4.5',
    strokeWidth: 1.9,
    'aria-hidden': true,
  })
}

/** The design's switch. A checkbox underneath, so it is still a checkbox. */
function Toggle({
  on,
  label,
  onChange,
}: {
  on: boolean
  label: string
  onChange: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-brand-600' : 'bg-slate-300',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-5.5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-3 shrink-0 rounded-full', toneDot[tone])}
    />
  )
}

function GroupSelect({
  value,
  label,
  onChange,
}: {
  value: StaffGroupId | null
  label: string
  onChange: (value: StaffGroupId | null) => void
}) {
  return (
    <SelectBox
      value={value ?? ''}
      aria-label={label}
      onChange={(e) =>
        onChange(
          e.target.value === '' ? null : (e.target.value as StaffGroupId),
        )
      }
      className="border-line focus:border-brand-500 text-ink h-10 w-full max-w-56 rounded-lg border px-2 text-sm"
    >
      <option value="">Nobody in particular</option>
      {staffGroups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.label} ({membersOfGroup(g.id).length})
        </option>
      ))}
    </SelectBox>
  )
}

function Row({
  category,
  used,
  onEdit,
  onRemove,
}: {
  category: CategorySetting
  used: number
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <tr className="hover:bg-canvas transition-colors">
      <th scope="row" className="px-4 py-3 text-left">
        <span className="text-ink text-sm font-semibold break-words">
          {category.label}
        </span>
        {category.derived && (
          <span className="text-ink-subtle mt-0.5 block text-xs font-normal">
            Built in
          </span>
        )}
      </th>
      <td className="px-4 py-3">
        <Dot tone={category.tone} />
      </td>
      <td className="text-ink-muted px-4 py-3">
        <CategoryGlyph icon={category.icon} />
      </td>
      <td className="text-ink px-4 py-3 text-sm tabular-nums">
        {/* Counted, not stored. The design has a per-category count with nothing
            under it; this one moves when a task does. */}
        {used}
      </td>
      <td className="text-ink-muted px-4 py-3 text-sm whitespace-nowrap">
        {category.autoAssign ? groupLabel(category.autoAssign) : 'Nobody'}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
            category.offered
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-sunken text-ink-muted',
          )}
        >
          {category.offered ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={onEdit}
          className="text-brand-700 hover:text-brand-800 text-sm font-medium"
        >
          Edit
        </button>
        {/* Delete only where nothing carries it — a category with tasks behind
            it would leave them labelled with an id nobody recognises. */}
        {/* Always shown, as the design has it. Disabled on a built-in: the app
            files worked-out rows into it, and which category they land in is
            written in code rather than set here, so deleting one would leave
            those rows labelled with an id nobody recognises. */}
        <button
          type="button"
          onClick={onRemove}
          disabled={category.derived}
          title={
            category.derived
              ? 'Built in — the app files rows it works out into this category'
              : undefined
          }
          className="ml-4 text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-red-300 disabled:hover:text-red-300"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

/**
 * Deleting a category, and saying where its tasks go.
 *
 * A category with tasks behind it cannot simply disappear: the tasks store an
 * id, and the screens that label them would fall back to printing that id. So
 * the dialog names the count and makes the move explicit. Nothing happens
 * until Save, along with the rest of the draft.
 */
function DeleteCategoryDialog({
  category,
  used,
  others,
  onClose,
  onConfirm,
}: {
  category: CategorySetting
  used: number
  others: CategorySetting[]
  onClose: () => void
  onConfirm: (moveTo: string | null) => void
}) {
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '')

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title="Delete category"
      subtitle={category.label}
    >
      <div className="space-y-4 p-4 sm:p-5">
        {used === 0 ? (
          <p className="text-ink-muted text-sm">
            Nothing is filed under {category.label}, so it can go without
            anything moving.
          </p>
        ) : (
          <>
            <p className="text-ink-muted text-sm">
              {used} task{used === 1 ? '' : 's'} or template
              {used === 1 ? ' is' : 's are'} filed under {category.label}.
              {used === 1 ? ' It has' : ' They have'} to land somewhere, or
              every screen that labels {used === 1 ? 'it' : 'them'} would print
              the raw id instead.
            </p>
            <label className="block">
              <span className="text-ink text-sm font-medium">Move them to</span>
              <SelectBox
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
              >
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </SelectBox>
            </label>
          </>
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
            disabled={used > 0 && moveTo === ''}
            onClick={() => onConfirm(used > 0 ? moveTo : null)}
            className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete category
          </button>
        </div>
      </div>
    </Drawer>
  )
}

function CategoryDialog({
  category,
  onClose,
  onSave,
}: {
  category?: CategorySetting
  onClose: () => void
  onSave: (edit: {
    label: string
    tone: Tone
    icon: CategoryIconId
    autoAssign: StaffGroupId | null
    offered: boolean
  }) => void
}) {
  const [label, setLabel] = useState(category?.label ?? '')
  const [tone, setTone] = useState<Tone>(category?.tone ?? 'blue')
  const [icon, setIcon] = useState<CategoryIconId>(category?.icon ?? 'file')
  const [autoAssign, setAutoAssign] = useState<StaffGroupId | null>(
    category?.autoAssign ?? null,
  )
  const [offered, setOffered] = useState(category?.offered ?? true)

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title={category ? 'Edit category' : 'Add category'}
      subtitle={category?.label}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <span className="text-ink text-sm font-medium">Category name</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Equipment"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>

        <div>
          <span className="text-ink text-sm font-medium">Colour</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {toneChoices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setTone(choice)}
                aria-label={choice}
                aria-pressed={tone === choice}
                className={cn(
                  'size-8 rounded-full border-2 transition-colors',
                  tonePill[choice],
                  tone === choice ? 'border-ink' : 'border-transparent',
                )}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="text-ink text-sm font-medium">Icon</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {categoryIcons.map(({ id, label: name, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setIcon(id)}
                aria-label={name}
                aria-pressed={icon === id}
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-lg border transition-colors',
                  icon === id
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-line text-ink-muted hover:bg-sunken',
                )}
              >
                <Icon
                  className="size-4.5"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-ink text-sm font-medium">Auto-assign to</span>
            <span className="mt-1.5 block">
              <GroupSelect
                value={autoAssign}
                label="Auto-assign to"
                onChange={setAutoAssign}
              />
            </span>
          </label>
          <div>
            <span className="text-ink text-sm font-medium">Status</span>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={offered}
                onChange={(e) => setOffered(e.target.checked)}
                className="accent-brand-600 size-4"
              />
              <span className="text-ink-muted">
                Active — offered on the create form
              </span>
            </label>
          </div>
        </div>

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
            disabled={label.trim() === ''}
            onClick={() =>
              onSave({
                label: label.trim(),
                tone,
                icon,
                autoAssign,
                offered,
              })
            }
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {category ? 'Save category' : 'Add category'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
