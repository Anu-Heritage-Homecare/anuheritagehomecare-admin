import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  CircleCheck,
  Clock,
  FolderOpen,
  Plus,
  Search,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react'
import {
  CATEGORY_VALUES,
  PRIORITY_VALUES,
  toUiPriority,
  useBulkComplete,
  useCreateTask,
  useTasksScreen,
  type BackendCategory,
  type BackendPriority,
  type BackendStatus,
  type CreateTaskInput,
  type TaskTab,
} from '@/features/tasks/useTasks'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

/*
 * The backend's four tabs, each mapped to the query's `tab`. A count rides on
 * Today and Overdue, read off the screen's tab counts.
 */
const tabs = [
  { slug: 'all', label: 'All Tasks', tab: 'ALL' as TaskTab },
  { slug: 'today', label: "Today's Tasks", tab: 'TODAY' as TaskTab, badge: true },
  { slug: 'overdue', label: 'Overdue', tab: 'OVERDUE' as TaskTab, badge: true, urgent: true },
  { slug: 'done', label: 'Completed', tab: 'COMPLETED' as TaskTab },
] as const

type TabSlug = (typeof tabs)[number]['slug']

const PAGE_SIZE = 10

const CATEGORY_LABELS: Record<BackendCategory, string> = {
  CARE_ACTIVITY: 'Care Activity',
  MEDICATION: 'Medication',
  DOCUMENTATION: 'Documentation',
  SCHEDULING: 'Scheduling',
  COMPLIANCE: 'Compliance',
  ADMINISTRATIVE: 'Administrative',
  OTHER: 'Other',
}

const PRIORITY_LABELS: Record<BackendPriority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

const STATUS_DOT: Record<string, string> = {
  OPEN: 'bg-sunken text-ink-muted',
  IN_PROGRESS: 'bg-brand-50 text-brand-700',
  DONE: 'bg-emerald-50 text-emerald-700',
}

/**
 * Tasks, read live from the back office. One request powers the screen: the KPI
 * tiles, the tab counts and the filtered, paginated list all come off
 * `GET /admin/tasks`, which returns stored tasks with their labels already
 * worked out. The old client side simulation (derived rows, a Source filter and
 * SLA timers) is gone, since none of it had a backend source.
 */
export function TasksPage() {
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)

  const rawTab = params.get('tab') ?? 'all'
  const tabDef = tabs.find((t) => t.slug === rawTab) ?? tabs[0]
  const tab = tabDef.slug as TabSlug
  const search = params.get('q') ?? ''

  const rawPriority = (params.get('priority') ?? '').toUpperCase()
  const priority = PRIORITY_VALUES.includes(rawPriority as BackendPriority)
    ? (rawPriority as BackendPriority)
    : null
  const rawCategory = (params.get('category') ?? '').toUpperCase()
  const category = CATEGORY_VALUES.includes(rawCategory as BackendCategory)
    ? (rawCategory as BackendCategory)
    : null
  const rawStatus = (params.get('status') ?? '').toUpperCase()
  const status = (['OPEN', 'IN_PROGRESS', 'DONE'] as const).includes(
    rawStatus as BackendStatus,
  )
    ? (rawStatus as BackendStatus)
    : null

  const requestedPage = Number(params.get('page'))
  const pageNumber = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1

  const query = useTasksScreen({
    tab: tabDef.tab,
    search,
    priority,
    category,
    status,
    page: pageNumber,
    pageSize: PAGE_SIZE,
  })

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const bulkComplete = useBulkComplete()
  const data = query.data

  const bulkableIds = useMemo(
    () => (data?.rows ?? []).filter((r) => r.status !== 'DONE').map((r) => r.id),
    [data],
  )

  const kpis = data?.kpis
  const tiles: { id: string; label: string; icon: LucideIcon; tone: string; value: string }[] = [
    {
      id: 'open',
      label: 'Open Tasks',
      icon: FolderOpen,
      tone: 'text-brand-600',
      value: kpis ? String(kpis.openTasks) : '—',
    },
    {
      id: 'done-today',
      label: 'Completed Today',
      icon: CircleCheck,
      tone: 'text-emerald-600',
      value: kpis ? String(kpis.completedToday) : '—',
    },
    {
      id: 'overdue',
      label: 'Overdue Tasks',
      icon: TriangleAlert,
      tone: 'text-red-600',
      value: kpis ? String(kpis.overdue) : '—',
    },
    {
      id: 'urgent',
      label: 'High Priority',
      icon: ShieldAlert,
      tone: 'text-amber-600',
      value: kpis ? String(kpis.highPriority) : '—',
    },
    {
      id: 'today',
      label: 'Tasks Due Today',
      icon: Clock,
      tone: 'text-sky-600',
      value: kpis ? String(kpis.dueToday) : '—',
    },
    {
      id: 'rate',
      label: 'Completion Rate',
      icon: TrendingUp,
      tone: 'text-emerald-600',
      value: kpis ? `${kpis.completionRatePercent}%` : '—',
    },
  ]

  const filtered =
    priority !== null ||
    category !== null ||
    status !== null ||
    search.trim() !== ''

  const pageCount = Math.max(1, data?.totalPages ?? 1)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm">
            Manage operational tasks, care activities and internal assignments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/tasks/templates"
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            Templates
          </Link>
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
                <t.icon className={cn('size-4 shrink-0', t.tone)} strokeWidth={2} aria-hidden="true" />
              </div>
              <span className="text-ink mt-2 block text-2xl font-bold tracking-tight tabular-nums">
                {t.value}
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
          const counts = data?.tabCounts
          const badge =
            'badge' in t && t.badge && counts
              ? t.slug === 'today'
                ? counts.today
                : counts.overdue
              : null
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
          label="Priority"
          value={priority ?? 'all'}
          onChange={(v) => set('priority', v)}
          options={[
            { value: 'all', label: 'All' },
            ...PRIORITY_VALUES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
          ]}
        />
        <SelectFilter
          chip
          quiet
          label="Category"
          value={category ?? 'all'}
          onChange={(v) => set('category', v)}
          options={[
            { value: 'all', label: 'All' },
            ...CATEGORY_VALUES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
          ]}
        />
        <SelectFilter
          chip
          quiet
          label="Status"
          value={status ?? 'all'}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'OPEN', label: 'Open' },
            { value: 'IN_PROGRESS', label: 'In progress' },
            { value: 'DONE', label: 'Completed' },
          ]}
        />
        {filtered && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params)
              for (const key of ['priority', 'category', 'status', 'q', 'page']) next.delete(key)
              setParams(next)
            }}
            className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center px-1 text-sm font-medium"
          >
            Clear filters
          </button>
        )}
        {bulkableIds.length > 0 && (
          <button
            type="button"
            onClick={() => bulkComplete.mutate(bulkableIds)}
            disabled={bulkComplete.isPending}
            className="border-control text-ink hover:bg-sunken ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
          >
            <Users className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            Complete the {bulkableIds.length} showing
          </button>
        )}
      </div>

      <div className="bg-surface border-line overflow-hidden rounded-xl border">
        {query.isPending ? (
          <p className="text-ink-subtle px-4 py-10 text-center text-sm" role="status">
            Loading tasks…
          </p>
        ) : query.isError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-red-600" role="status">
              Could not load tasks.
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="text-brand-700 hover:text-brand-800 mt-2 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <p className="text-ink-subtle px-4 py-10 text-center text-sm" role="status">
            Nothing here matches those filters.
          </p>
        ) : (
          <>
            <div
              tabIndex={0}
              role="region"
              aria-label={`${tabDef.label} table`}
              className="hidden overflow-x-auto xl:block"
            >
              <table className="w-full min-w-4xl text-left text-sm">
                <thead className="text-ink-subtle bg-sunken text-xs">
                  <tr className="border-line border-b">
                    {['Task Name', 'Related Visit', 'Assigned To', 'Recipient', 'Due Date', 'Priority', 'Status', 'Actions'].map(
                      (col) => (
                        <th
                          key={col}
                          scope="col"
                          className="px-4 py-3.5 font-semibold tracking-wide uppercase whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {data?.rows.map((task) => (
                    <tr key={task.id} className="hover:bg-canvas transition-colors">
                      <th scope="row" className="max-w-xs px-4 py-3.5 text-left">
                        <Link
                          to={`/tasks/${task.id}`}
                          className={cn(
                            'block truncate font-semibold',
                            task.status === 'DONE'
                              ? 'text-ink-muted line-through'
                              : 'text-ink hover:text-brand-700',
                          )}
                        >
                          {task.title}
                        </Link>
                        <span className="text-ink-subtle block truncate text-xs font-normal">
                          {task.categoryLabel}
                        </span>
                      </th>
                      <td className="text-ink-muted px-4 py-3.5">
                        {task.relatedVisitLabel ?? (
                          <span className="text-ink-subtle" aria-hidden="true">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <Avatar name={task.assignee} decorative className="size-6 text-[0.625rem]" />
                          {task.assignee}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {task.recipientName ?? (
                          <span className="text-ink-subtle" aria-hidden="true">
                            —
                          </span>
                        )}
                      </td>
                      <td className="text-ink-muted px-4 py-3.5 whitespace-nowrap">
                        {task.dueDateLabel ?? 'No date'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <PriorityBadge priority={toUiPriority(task.priority)} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                            STATUS_DOT[task.status] ?? 'bg-sunken text-ink-muted',
                          )}
                        >
                          {task.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <DropdownMenu label={`Actions for ${task.title}`} items={rowMenu(task.id, task.recipientName)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-line divide-y xl:hidden">
              {data?.rows.map((task) => (
                <li key={task.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <Link
                      to={`/tasks/${task.id}`}
                      className={cn(
                        'min-w-0 text-sm font-semibold break-words',
                        task.status === 'DONE'
                          ? 'text-ink-muted line-through'
                          : 'text-ink hover:text-brand-700',
                      )}
                    >
                      {task.title}
                    </Link>
                    <PriorityBadge priority={toUiPriority(task.priority)} />
                  </div>
                  <p className="text-ink-muted mt-1 text-xs break-words">{task.categoryLabel}</p>
                  <p className="text-ink-subtle mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span>{task.assignee}</span>
                    {task.recipientName && <span>· {task.recipientName}</span>}
                    <span>· {task.dueDateLabel ?? 'No date'}</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        {pageCount > 1 && (
          <Pagination
            page={pageNumber}
            pageCount={pageCount}
            onPageChange={(p) => set('page', String(p))}
            summary={`Page ${pageNumber} of ${pageCount}${data ? `, ${data.total} tasks` : ''}`}
          />
        )}
      </div>
    </div>
  )
}

function rowMenu(id: string, recipientName: string | null): MenuItem[] {
  const items: MenuItem[] = [{ id: 'open', label: 'Open task', to: `/tasks/${id}` }]
  if (recipientName) items.push({ id: 'recipient', label: `About ${recipientName}`, to: `/tasks/${id}` })
  return items
}

/**
 * Create a task. The backend needs either an admin uuid or a free text label to
 * assign to; there is no admin directory endpoint yet, so the form sends a free
 * text assignee label (which the API accepts) rather than fabricating an id.
 */
function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateTask()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeLabel, setAssigneeLabel] = useState('')
  const [priority, setPriority] = useState<BackendPriority>('MEDIUM')
  const [categoryValue, setCategoryValue] = useState<BackendCategory>('CARE_ACTIVITY')
  const [dueAt, setDueAt] = useState('')

  const submit = () => {
    if (title.trim() === '') return
    const body: CreateTaskInput = {
      title: title.trim(),
      priority,
      category: categoryValue,
    }
    if (description.trim() !== '') body.description = description.trim()
    if (assigneeLabel.trim() !== '') body.assigneeLabel = assigneeLabel.trim()
    if (dueAt !== '') body.dueAt = new Date(dueAt).toISOString()
    create.mutate(body, { onSuccess: onClose })
  }

  return (
    <Drawer open onClose={onClose} placement="center" title="Create task">
      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <span className="text-ink text-sm font-medium">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Order incontinence supplies"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-ink text-sm font-medium">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as BackendPriority)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {PRIORITY_VALUES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-ink text-sm font-medium">Category</span>
            <select
              value={categoryValue}
              onChange={(e) => setCategoryValue(e.target.value as BackendCategory)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <label className="block">
            <span className="text-ink text-sm font-medium">Due</span>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            />
          </label>
        </div>

        {create.isError && (
          <p className="text-sm text-red-600" role="status">
            Could not create the task.
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
            disabled={title.trim() === '' || create.isPending}
            onClick={submit}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create task
          </button>
        </div>
      </div>
    </Drawer>
  )
}
