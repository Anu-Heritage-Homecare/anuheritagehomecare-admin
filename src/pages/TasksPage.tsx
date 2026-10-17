import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronRight,
  CircleCheck,
  Clock,
  Copy,
  Download,
  FolderOpen,
  LayoutTemplate,
  Plus,
  Search,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react'
import {
  allTasks,
  formatDue,
  isDueToday,
  isOverdue,
  setTaskDone,
  allCategories,
  categoryLabel,
  priorityLabel,
  priorityOrder,
  useTasks,
} from '@/features/tasks/data'
import type { AgencyTask } from '@/features/tasks/data'
import { relatedVisit } from '@/features/tasks/data'
import type { TaskPriority } from '@/features/tasks/data'
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog'
import { TemplateDialog } from '@/features/tasks/TemplateDialog'
import {
  BulkAssignDialog,
  MarkAllCompleteDialog,
} from '@/features/tasks/BulkDialogs'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { formatTime } from '@/features/monitoring/live-data'
import { TODAY } from '@/lib/today'
import { StatusCell } from '@/features/tasks/TaskStatus'
import { statusOf } from '@/features/tasks/status'
import { cn } from '@/lib/cn'

/*
 * The design's four, and its badges: a count rides on the two that are a
 * number somebody acts on. "All Tasks" means all of them — open and ticked off
 * — which is what makes the Status filter beside it worth having.
 */
const tabs = [
  { slug: 'all', label: 'All Tasks' },
  { slug: 'today', label: "Today's Tasks", badge: true },
  { slug: 'overdue', label: 'Overdue', badge: true, urgent: true },
  { slug: 'done', label: 'Completed' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

const PAGE_SIZE = 10

function matches(term: string, ...fields: (string | null | undefined)[]): boolean {
  return (
    term === '' ||
    fields.some((f) => f != null && f.toLowerCase().includes(term))
  )
}

/**
 * The list as a spreadsheet, built in the browser from the rows on screen.
 *
 * The design's Export sat on several screens as a button with no handler. This
 * one writes what is actually in front of you — the current tab, filters and
 * search included — so the file and the table can never disagree. Nothing is
 * sent anywhere: the CSV is assembled here and handed to the download.
 */
function exportTasks(rows: AgencyTask[], scope: string): void {
  const cell = (value: string | null | undefined): string => {
    const text = value ?? ''
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = [
    'Task',
    'Kind',
    'Category',
    'Priority',
    'Assignee',
    'Care recipient',
    'Due',
    'Status',
    'Why it is on the list',
  ]
  const lines = [
    header.join(','),
    ...rows.map((t) =>
      [
        cell(t.title),
        t.origin === 'written' ? 'Written' : 'Worked out',
        cell(categoryLabel(t.category)),
        cell(priorityLabel(t.priority)),
        cell(t.assignee ?? 'Unassigned'),
        cell(t.recipientName),
        cell(t.due),
        t.done ? 'Ticked off' : 'Open',
        cell(t.source ?? (t.origin === 'written' ? 'Written down by hand' : '')),
      ].join(','),
    ),
  ]
  // The BOM is what makes Excel read the accented names as UTF-8.
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `tasks-${scope}-${TODAY}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Tasks — everything the agency owes, worked out and written down together.
 *
 * The list is two things at once and says which is which on every row. Most of
 * it is derived: paperwork missing off a visit, a licence about to lapse, an
 * incident nobody has settled, a request nobody has answered. Those cannot be
 * ticked off here, because ticking one would not file the write-up — the row
 * goes when the record changes, and that is the only honest way for it to go.
 * The rest is typed by a coordinator and ticked off by one.
 *
 * What is deliberately not here: bulk assign, and a "mark all complete" that
 * would tick a page of rows nobody looked at.
 */
export function TasksPage() {
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [templating, setTemplating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [completing, setCompleting] = useState(false)

  // Written tasks are stored, so the list has to be told when one is added or
  // ticked; the worked-out half recomputes with it.
  const version = useTasks()
  const tasks = useMemo(() => {
    void version
    return allTasks()
  }, [version])

  const rawTab = params.get('tab') ?? 'all'
  const tab = (tabs.find((t) => t.slug === rawTab)?.slug ?? 'all') as TabSlug
  const search = params.get('q') ?? ''
  const term = search.trim().toLowerCase()

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>()
    for (const t of tasks) if (t.assignee) names.add(t.assignee)
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [tasks])

  const categoryOptions = useMemo(() => {
    const present = new Set(tasks.map((t) => t.category))
    return allCategories()
      .filter((c) => present.has(c.id))
      .map((c) => ({ value: c.id, label: c.label }))
  }, [tasks])

  const priorityOptions = useMemo(() => {
    const present = new Set(tasks.map((t) => t.priority))
    return priorityOrder
      .filter((p) => present.has(p))
      .map((p) => ({ value: p as string, label: priorityLabel(p) }))
  }, [tasks])

  const rawAssignee = params.get('who') ?? 'all'
  const assignee = assigneeOptions.includes(rawAssignee) ? rawAssignee : 'all'
  const rawCategory = params.get('category') ?? 'all'
  const category = categoryOptions.some((o) => o.value === rawCategory)
    ? rawCategory
    : 'all'
  const rawPriority = params.get('priority') ?? 'all'
  const priority = priorityOptions.some((o) => o.value === rawPriority)
    ? rawPriority
    : 'all'
  const rawSource = params.get('source') ?? 'all'
  const source = ['worked-out', 'written'].includes(rawSource) ? rawSource : 'all'
  const rawStatus = params.get('status') ?? 'all'
  const status = ['open', 'done'].includes(rawStatus) ? rawStatus : 'all'
  const rawDue = params.get('due') ?? 'all'
  const due = ['overdue', 'today', 'later', 'none'].includes(rawDue) ? rawDue : 'all'

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const shown = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (tab === 'done'
            ? t.done
            : tab === 'today'
              ? isDueToday(t)
              : tab === 'overdue'
                ? isOverdue(t)
                : true) &&
          (status === 'all' || (status === 'done' ? t.done : !t.done)) &&
          (due === 'all' ||
            (due === 'overdue'
              ? isOverdue(t)
              : due === 'today'
                ? isDueToday(t)
                : due === 'none'
                  ? t.due === null
                  : t.due !== null && t.due > TODAY)) &&
          (assignee === 'all' || t.assignee === assignee) &&
          (category === 'all' || t.category === category) &&
          (priority === 'all' || t.priority === priority) &&
          (source === 'all' || t.origin === source) &&
          matches(term, t.title, t.assignee, t.recipientName, t.source),
      ),
    [tasks, tab, status, due, assignee, category, priority, source, term],
  )

  const counts = {
    // What each tab holds, so "n of m shown" under the filters is m for the
    // tab you are on. "All Tasks" is now everything, ticked off included.
    all: tasks.length,
    today: tasks.filter((t) => isDueToday(t)).length,
    overdue: tasks.filter((t) => isOverdue(t)).length,
    done: tasks.filter((t) => t.done).length,
  }

  const open = tasks.filter((t) => !t.done)
  const written = tasks.filter((t) => t.origin === 'written')
  /*
   * Ticked off today, read off the task's own history rather than assumed: a
   * written task records "Marked complete" with the minute it happened. A
   * worked-out row cannot be ticked at all, so it can never appear here.
   */
  const doneToday = tasks.filter((t) =>
    (t.activity ?? []).some(
      (e) => e.text === 'Marked complete' && e.at.slice(0, 10) === TODAY,
    ),
  ).length
  /*
   * A rate over the tasks that can actually be ticked. Counting the worked-out
   * rows in the denominator would peg it near zero for ever — those clear when
   * their record changes, which is not somebody completing anything.
   */
  const writtenDone = written.filter((t) => t.done).length
  const completionRate =
    written.length === 0 ? null : Math.round((writtenDone / written.length) * 100)

  const tiles = [
    {
      id: 'open',
      label: 'Open Tasks',
      icon: FolderOpen,
      tone: 'text-brand-600',
      // Open, not the All tab's total: a ticked-off task is not outstanding.
      value: open.length,
      hint: `${open.filter((t) => t.origin === 'worked-out').length} worked out, ${open.filter((t) => t.origin === 'written').length} written`,
    },
    {
      id: 'done-today',
      label: 'Completed Today',
      icon: CircleCheck,
      tone: 'text-emerald-600',
      value: doneToday,
      hint: 'Ticked off today',
    },
    {
      id: 'overdue',
      label: 'Overdue Tasks',
      icon: TriangleAlert,
      tone: 'text-red-600',
      value: counts.overdue,
      hint: 'Past their date',
      urgent: counts.overdue > 0,
    },
    {
      id: 'urgent',
      label: 'High Priority',
      icon: ShieldAlert,
      tone: 'text-amber-600',
      value: open.filter((t) => t.priority === 'critical' || t.priority === 'high')
        .length,
      hint: 'Critical or high, still open',
    },
    {
      id: 'today',
      label: 'Tasks Due Today',
      icon: Clock,
      tone: 'text-sky-600',
      value: counts.today,
      hint: 'Dated today and not yet done',
    },
    {
      id: 'rate',
      label: 'Completion Rate',
      icon: TrendingUp,
      tone: 'text-emerald-600',
      value: completionRate === null ? '—' : `${completionRate}%`,
      hint: `${writtenDone} of ${written.length} written tasks ticked off`,
    },
  ]

  /*
   * What the two bulk operations act on: the written rows the screen is
   * showing and has not ticked. Never the whole list, and never a worked-out
   * row — one has no assignee of its own and the other cannot be ticked.
   */
  const bulkable = shown.filter((t) => t.origin === 'written' && !t.done)

  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const requestedPage = Number(params.get('page'))
  const pageNumber =
    Number.isInteger(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, pageCount)
      : 1
  const page = shown.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE)

  const filtered =
    assignee !== 'all' ||
    category !== 'all' ||
    priority !== 'all' ||
    source !== 'all' ||
    status !== 'all' ||
    due !== 'all' ||
    term !== ''

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm">
            Manage operational tasks, care activities and internal assignments.
          </p>
        </div>

        {/* The design's three. Each one does the thing it names: the file is
            written from the rows on screen, the template dialog is the one the
            Task Templates screen uses, and Create Task is the form that was
            already here. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportTasks(shown, tab)}
            aria-disabled={shown.length === 0}
            title={
              shown.length === 0
                ? 'Nothing on screen to export.'
                : `Download the ${shown.length} row${shown.length === 1 ? '' : 's'} showing, as a CSV`
            }
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium aria-disabled:cursor-default aria-disabled:opacity-55 aria-disabled:hover:bg-transparent"
          >
            <Download className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setTemplating(true)}
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            <LayoutTemplate
              className="size-4 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            Create Template
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
          >
            <Plus className="size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            Create Task
          </button>
        </div>
      </header>

      {creating && <CreateTaskDialog onClose={() => setCreating(false)} />}
      {templating && <TemplateDialog onClose={() => setTemplating(false)} />}
      {assigning && (
        <BulkAssignDialog tasks={bulkable} onClose={() => setAssigning(false)} />
      )}
      {completing && (
        <MarkAllCompleteDialog
          tasks={bulkable}
          onClose={() => setCompleting(false)}
        />
      )}

      <section aria-labelledby="task-totals">
        <h2 id="task-totals" className="sr-only">
          Totals
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <article key={t.id} className="card px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-ink-subtle block text-xs font-semibold tracking-wide uppercase">
                  {t.label}
                </span>
                <t.icon
                  className={cn('size-4 shrink-0', t.tone)}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              <span
                className={cn(
                  'mt-2 block text-2xl font-bold tracking-tight tabular-nums',
                  t.urgent ? 'text-red-600' : 'text-ink',
                )}
              >
                {t.value}
              </span>
              <span className="text-ink-subtle mt-1 block text-xs break-words">
                {t.hint}
              </span>
            </article>
          ))}
        </div>
      </section>

      <div
        role="group"
        aria-label="Choose a list"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((t) => {
          const active = t.slug === tab
          const badge = 'badge' in t && t.badge ? counts[t.slug] : null
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => set('tab', t.slug)}
              aria-pressed={active}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors sm:min-h-9.5',
                active
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'border-line bg-surface text-ink-muted hover:bg-sunken',
              )}
            >
              {t.label}
              {badge !== null && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                    active
                      ? 'bg-white/20 text-white'
                      : 'urgent' in t && t.urgent && badge > 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-sunken text-ink-subtle',
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {/* One row: the search box and the filter chips side by side, straight
            on the page rather than in a card. It wraps on a narrow screen. */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full min-w-0 sm:w-64">
            <span className="sr-only">Search tasks</span>
            <Search
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search tasks..."
              className="border-line bg-canvas focus:border-brand-500 focus:bg-surface h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
            />
          </label>
          <SelectFilter
            chip
            quiet
            label="Assigned To"
            value={assignee}
            onChange={(v) => set('who', v)}
            options={[
              { value: 'all', label: 'Anyone' },
              ...assigneeOptions.map((n) => ({ value: n, label: n })),
            ]}
          />
          <SelectFilter
            chip
            quiet
            label="Priority"
            value={priority}
            onChange={(v) => set('priority', v)}
            options={[{ value: 'all', label: 'All' }, ...priorityOptions]}
          />
          <SelectFilter
            chip
            quiet
            label="Category"
            value={category}
            onChange={(v) => set('category', v)}
            options={[{ value: 'all', label: 'All' }, ...categoryOptions]}
          />
          <SelectFilter
            chip
            quiet
            label="Status"
            value={status}
            onChange={(v) => set('status', v)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'done', label: 'Ticked off' },
            ]}
          />
          <SelectFilter
            chip
            quiet
            label="Due Date"
            value={due}
            onChange={(v) => set('due', v)}
            options={[
              { value: 'all', label: 'Any' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'today', label: 'Today' },
              { value: 'later', label: 'Later' },
              // A written task can be typed with no date on it; a worked-out
              // one always carries the date its own record holds.
              { value: 'none', label: 'No date' },
            ]}
          />
          {/* The filter the design has no equivalent of, and the one this list
              most needs: the two halves behave differently. */}
          <SelectFilter
            chip
            quiet
            label="Source"
            value={source}
            onChange={(v) => set('source', v)}
            options={[
              { value: 'all', label: 'Both kinds' },
              { value: 'worked-out', label: 'Worked out' },
              { value: 'written', label: 'Written down' },
            ]}
          />
          {filtered && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const key of [
                  'who',
                  'priority',
                  'category',
                  'source',
                  'status',
                  'due',
                  'q',
                  'page',
                ])
                  next.delete(key)
                setParams(next)
              }}
              className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center px-1 text-sm font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
        {/* Only while something is narrowing the list: "49 of 49" at rest is a
            line that never tells anybody anything. */}
        {filtered && (
          <p className="text-ink-subtle text-xs" aria-live="polite">
            {shown.length} of {counts[tab]} shown.
          </p>
        )}
      </div>

      {/* No card and no heading above it: the design starts this block at the
          table's own header row, and the tab chips already name the list. The
          block still closes properly — sides, bottom rule and a rounded bottom
          edge under the pager, as the design draws it. */}
      <div className="bg-surface border-line overflow-hidden rounded-b-xl border-x border-b">
        {shown.length === 0 ? (
          <p className="text-ink-subtle px-4 py-10 text-center text-sm" role="status">
            Nothing here matches those filters.
          </p>
        ) : (
          <>
            <div
              tabIndex={0}
              role="region"
              aria-label={`${tabs.find((t) => t.slug === tab)!.label} table`}
              className="hidden overflow-x-auto xl:block"
            >
              <table className="w-full min-w-4xl text-left text-sm">
                <thead className="text-ink-subtle bg-sunken text-xs">
                  <tr className="border-line border-b">
                    {[
                      'Task Name',
                      'Related Visit',
                      'Assigned To',
                      'Recipient',
                      'Due Date',
                      'Priority',
                      'Status',
                      'Actions',
                    ].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-4 py-3.5 font-semibold tracking-wide uppercase whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {page.map((task) => {
                    const status = statusOf(task)
                    // Only the visit a row actually came off. `relatedVisit`
                    // will also offer the visit a written task merely falls
                    // alongside, which is a good guess on the details page and
                    // a fact stated in a table cell here.
                    const visit = task.visitId ? relatedVisit(task) : undefined
                    return (
                      <tr
                        key={task.id}
                        className={cn(
                          'transition-colors',
                          isOverdue(task) ? 'bg-red-50/50' : 'hover:bg-canvas',
                          task.done && 'text-ink-muted',
                        )}
                      >
                        <th
                          scope="row"
                          className="max-w-xs px-4 py-3.5 text-left"
                          // The sentence that used to sit under the name — why
                          // this row exists — is a line and a half of prose in
                          // a table cell. It stays on the row as its tooltip
                          // and in full on the task itself; the cell keeps the
                          // name and the category, which is what a scan needs.
                          title={task.source ? `${task.title} — ${task.source}` : task.title}
                        >
                          <Link
                            to={`/tasks/${task.id}`}
                            className={cn(
                              'block truncate font-semibold',
                              task.done
                                ? 'text-ink-muted line-through'
                                : 'text-ink hover:text-brand-700',
                            )}
                          >
                            {task.title}
                          </Link>
                          <span className="text-ink-subtle block truncate text-xs font-normal">
                            {categoryLabel(task.category)}
                          </span>
                        </th>
                        <td className="text-ink-muted px-4 py-3.5">
                          {visit ? (
                            <Link
                              to={`/scheduling/visits/${visit.id}/overview`}
                              className="hover:text-brand-700 break-words"
                            >
                              {visit.type}
                            </Link>
                          ) : (
                            <span className="text-ink-subtle" aria-hidden="true">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {task.assignee ? (
                            <span className="flex items-center gap-2">
                              <Avatar
                                name={task.assignee}
                                decorative
                                className="size-6 text-[0.625rem]"
                              />
                              {task.assignee}
                            </span>
                          ) : (
                            <span className="font-medium text-red-700">Nobody</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {task.recipientId ? (
                            <Link
                              to={`/care-recipients/${task.recipientId}`}
                              className="text-ink hover:text-brand-700"
                            >
                              {task.recipientName}
                            </Link>
                          ) : (
                            <span className="text-ink-subtle" aria-hidden="true">
                              —
                            </span>
                          )}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3.5 whitespace-nowrap',
                            isOverdue(task)
                              ? 'font-semibold text-red-600'
                              : 'text-ink-muted',
                          )}
                        >
                          {formatDue(task.due)}
                          {task.dueTime && `, ${formatTime(task.dueTime)}`}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {/* A dot and a word, as the design has it — the pill
                              form of this is still on the details page. */}
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={cn(
                                'size-2 shrink-0 rounded-full',
                                priorityDot[task.priority],
                              )}
                            />
                            <span
                              className={cn(
                                isOverdue(task) ? 'text-red-600' : 'text-ink',
                              )}
                            >
                              {priorityLabel(task.priority)}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <StatusCell status={status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <DropdownMenu
                            label={`Actions for ${task.title}`}
                            items={menuFor(task)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-line border-line divide-y border-t xl:hidden">
              {page.map((task) => (
                <li key={task.id} className="p-4">
                  <div className="flex items-start gap-2.5">
                    {task.origin === 'written' && (
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={(e) => setTaskDone(task.id, e.target.checked)}
                        aria-label={`Mark "${task.title}" ${task.done ? 'not done' : 'done'}`}
                        className="accent-brand-600 mt-1 size-4 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <Link
                          to={`/tasks/${task.id}`}
                          className={cn(
                            'min-w-0 text-sm font-semibold break-words',
                            task.done
                              ? 'text-ink-muted line-through'
                              : 'text-ink hover:text-brand-700',
                          )}
                        >
                          {task.title}
                        </Link>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <p className="text-ink-muted mt-1 text-xs break-words">
                        {categoryLabel(task.category)}
                        {task.source && ` · ${task.source}`}
                      </p>
                      <p className="text-ink-subtle mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span>{task.assignee ?? 'Nobody'}</span>
                        {task.recipientName && <span>· {task.recipientName}</span>}
                        <span
                          className={cn(
                            isOverdue(task) && 'font-semibold text-red-700',
                          )}
                        >
                          · {formatDue(task.due)}
                        </span>
                        <SourceChip task={task} />
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

          </>
        )}
        {/* No wrapper rule: `Pagination` draws its own top border, and the two
            together read as a double line under the last row. */}
        {pageCount > 1 && (
          <Pagination
            page={pageNumber}
            pageCount={pageCount}
            onPageChange={(p) => set('page', String(p))}
            summary={`Showing ${(pageNumber - 1) * PAGE_SIZE + 1}–${Math.min(pageNumber * PAGE_SIZE, shown.length)} of ${shown.length} tasks`}
          />
        )}
      </div>

      {/*
        The design's Quick Operations. Two of these four act on rows rather
        than opening a form, and both are scoped to what the screen is showing
        and to the written rows in it — "all" over a list nobody has read is
        how a page of work gets ticked by accident. Each card says its scope
        rather than promising a batch job there is nothing behind.
      */}
      <section aria-labelledby="quick-operations" className="space-y-3">
        <h2 id="quick-operations" className="text-ink text-sm font-semibold">
          Quick Operations
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickOperation
            primary
            icon={Plus}
            title="Create Task"
            detail="Write a task down by hand"
            onSelect={() => setCreating(true)}
          />
          <QuickOperation
            icon={Users}
            iconTone="bg-brand-50 text-brand-700"
            title="Bulk Assign"
            detail={
              bulkable.length === 0
                ? 'Nothing written is showing'
                : `Hand the ${bulkable.length} written task${bulkable.length === 1 ? '' : 's'} showing to one person`
            }
            disabled={bulkable.length === 0}
            onSelect={() => setAssigning(true)}
          />
          <QuickOperation
            icon={CircleCheck}
            iconTone="bg-emerald-50 text-emerald-600"
            title="Mark All Complete"
            detail={
              bulkable.length === 0
                ? 'Nothing showing can be ticked'
                : `Tick off the ${bulkable.length} written task${bulkable.length === 1 ? '' : 's'} showing`
            }
            disabled={bulkable.length === 0}
            onSelect={() => setCompleting(true)}
          />
          <QuickOperation
            icon={Copy}
            title="View Templates"
            detail="Reusable checklists to raise a task from"
            to="/tasks/templates"
          />
        </div>
      </section>

    </div>
  )
}

/**
 * One Quick Operations card: an icon tile, what it does, and the row it acts
 * on. A card that opens a page is a link; one that opens a dialog is a button.
 */
function QuickOperation({
  icon: Icon,
  iconTone = 'bg-sunken text-ink-muted',
  title,
  detail,
  to,
  onSelect,
  primary = false,
  disabled = false,
}: {
  icon: LucideIcon
  iconTone?: string
  title: string
  detail: string
  to?: string
  onSelect?: () => void
  primary?: boolean
  disabled?: boolean
}) {
  const body = (
    <>
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg',
          primary ? 'bg-white/20 text-white' : iconTone,
        )}
      >
        <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-semibold',
            primary ? 'text-white' : 'text-ink',
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            'mt-0.5 block text-xs break-words',
            primary ? 'text-white/80' : 'text-ink-subtle',
          )}
        >
          {detail}
        </span>
      </span>
      <ChevronRight
        className={cn(
          'size-4 shrink-0',
          primary ? 'text-white/80' : 'text-ink-subtle',
        )}
        strokeWidth={2}
        aria-hidden="true"
      />
    </>
  )

  const shell = cn(
    'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
    primary
      ? 'bg-brand-600 border-brand-600 hover:bg-brand-700'
      : 'border-line bg-surface hover:bg-sunken',
    disabled && 'cursor-default opacity-55 hover:bg-surface',
  )

  if (to)
    return (
      <Link to={to} className={shell}>
        {body}
      </Link>
    )

  return (
    <button
      type="button"
      aria-disabled={disabled}
      onClick={() => {
        if (disabled) return
        onSelect?.()
      }}
      className={shell}
    >
      {body}
    </button>
  )
}

/**
 * The design's four statuses, over what this app can actually see.
 *
 * "Completed" is the tick. "Overdue" is the date against the clock. "In
 * progress" is only claimed where a written task's own checklist has been
 * started and not finished — nothing else here observes work happening, and a
 * row that merely exists is Pending.
 */
/** Full class strings — Tailwind cannot see a name built at runtime. */
const priorityDot: Record<TaskPriority, string> = {
  critical: 'bg-red-600',
  high: 'bg-amber-500',
  medium: 'bg-amber-400',
  low: 'bg-sky-500',
  normal: 'bg-slate-400',
}

/**
 * The row menu. A written task can be ticked from here — the checkbox that
 * used to sit in the first cell moved into this list when the design gave the
 * table an Actions column. A worked-out row cannot: what settles it is the
 * record changing, so its menu offers the record instead.
 */
function menuFor(task: AgencyTask): MenuItem[] {
  const items: MenuItem[] = [{ id: 'open', label: 'Open task', to: `/tasks/${task.id}` }]
  if (task.origin === 'written') {
    items.push({
      id: 'done',
      label: task.done ? 'Reopen' : 'Mark complete',
      onSelect: () => setTaskDone(task.id, !task.done),
    })
  } else {
    items.push({ id: 'record', label: 'Open the record', to: task.to })
  }
  if (task.recipientId) {
    items.push({
      id: 'recipient',
      label: `Open ${task.recipientName}`,
      to: `/care-recipients/${task.recipientId}`,
    })
  }
  return items
}

function SourceChip({ task }: { task: AgencyTask }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        task.origin === 'worked-out'
          ? 'bg-brand-50 text-brand-700'
          : 'bg-sunken text-ink-muted',
      )}
    >
      {task.origin === 'worked-out' ? 'Worked out' : `By ${task.createdBy}`}
    </span>
  )
}
