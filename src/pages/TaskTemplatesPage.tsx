import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CircleCheck,
  Clock,
  FolderOpen,
  ListChecks,
  Plus,
  Search,
  User,
} from 'lucide-react'
import {
  allTemplates,
  deleteTemplate,
  duplicateTemplate,
  importTemplates,
  setTemplateActive,
  useTemplates,
} from '@/features/tasks/templates'
import type { ImportResult, TaskTemplate } from '@/features/tasks/templates'
import {
  allCategories,
  categoryLabel,
  categoryTone,
  tasksFromTemplate,
  useTasks,
} from '@/features/tasks/data'
import { frequencies, frequencyLabel } from '@/features/tasks/templates'
import { TemplateDialog } from '@/features/tasks/TemplateDialog'
import { UseTemplateDialog } from '@/features/tasks/UseTemplateDialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Panel } from '@/components/ui/Panel'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { groupLabel } from '@/features/tasks/groups'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Task templates — reusable checklists, raised by hand.
 *
 * The design's cards report a schedule and a monthly yield: "Daily, 7:00–8:00
 * AM", "280/month", "94% completion". None of those can be true here. Nothing
 * in this app runs while nobody is looking at it, so a template cannot generate
 * anything overnight, and there is no completion history to average — the tasks
 * this session raised are the only ones that exist.
 *
 * So the card reports what is real: how many steps are on the list, the
 * estimate whoever wrote it gave, when it is *usually* done as plain guidance,
 * and how many tasks have actually been raised from it — with links to them.
 * The button that would have been a schedule is the one that matters: use it.
 */
export function TaskTemplatesPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  useTemplates()
  // Usage counts come off the task store, so a task raised here has to move the
  // card behind it.
  useTasks()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TaskTemplate | null>(null)
  const [using, setUsing] = useState<TaskTemplate | null>(null)
  const [imported, setImported] = useState<ImportResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const templates = allTemplates()

  const search = params.get('q') ?? ''
  const term = search.trim().toLowerCase()

  const categoryOptions = useMemo(() => {
    const present = new Set(templates.map((t) => t.category))
    return allCategories()
      .filter((c) => present.has(c.id))
      .map((c) => ({ value: c.id, label: c.label }))
  }, [templates])

  const rawCategory = params.get('category') ?? 'all'
  const category = categoryOptions.some((o) => o.value === rawCategory)
    ? rawCategory
    : 'all'
  // Only the patterns actually in use: a chip offering "Weekly" when no
  // template is weekly is a filter that can only ever empty the screen.
  const scheduleOptions = useMemo(() => {
    const present = new Set(templates.map((t) => t.frequency))
    return frequencies
      .filter((f) => present.has(f.id))
      .map((f) => ({ value: f.id, label: f.label }))
  }, [templates])

  const rawSchedule = params.get('schedule') ?? 'all'
  const schedule = scheduleOptions.some((o) => o.value === rawSchedule)
    ? rawSchedule
    : 'all'

  const rawStatus = params.get('status') ?? 'active'
  const status = ['active', 'retired', 'all'].includes(rawStatus)
    ? rawStatus
    : 'active'

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (
      value === '' ||
      (key === 'status' ? value === 'active' : value === 'all')
    )
      next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: key === 'q' })
  }

  const shown = templates.filter(
    (t) =>
      (status === 'all' || (status === 'active' ? t.active : !t.active)) &&
      (category === 'all' || t.category === category) &&
      (schedule === 'all' || t.frequency === schedule) &&
      (term === '' ||
        t.name.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.items.some((item) => item.toLowerCase().includes(term))),
  )

  const active = templates.filter((t) => t.active)
  const raised = templates.reduce(
    (total, t) => total + tasksFromTemplate(t.id).length,
    0,
  )

  const operations = new Set(active.map((t) => t.category)).size

  const tiles = [
    {
      id: 'active',
      label: 'Active Templates',
      icon: FolderOpen,
      tone: 'bg-brand-50 text-brand-600',
      value: active.length,
      hint: `Across ${operations} operation${operations === 1 ? '' : 's'}`,
    },
    {
      id: 'steps',
      label: 'Steps Across Them',
      icon: ListChecks,
      tone: 'bg-brand-50 text-brand-600',
      value: active.reduce((total, t) => total + t.items.length, 0),
      // The design's "Tasks generated (this week) / from active schedules".
      // Nothing generates anything here — no server, no clock — so the tile
      // counts what is actually on the lists instead of inventing a yield.
      hint: 'Counted off the lists themselves',
    },
    {
      id: 'raised',
      label: 'Raised This Session',
      icon: CircleCheck,
      tone: 'bg-emerald-50 text-emerald-600',
      value: raised,
      // Said rather than dressed up: the number is small because nothing
      // generates tasks on a clock, and a card claiming otherwise would be the
      // most misleading thing on the screen.
      hint: 'Tasks somebody made from a template',
    },
  ]

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
            Templates
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Task Templates
          </h1>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm">
            Create and manage reusable task checklists for common care
            operations.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Import reads a JSON file the user picks — no server, no
              connection, just the file. It is the one thing the button can
              honestly do here. */}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              file
                .text()
                .then((text) =>
                  setImported(
                    importTemplates(
                      text,
                      allCategories().map((c) => c.id),
                    ),
                  ),
                )
                .catch(() =>
                  setImported({
                    added: 0,
                    skipped: 0,
                    error: 'That file could not be read.',
                  }),
                )
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
          >
            <Plus
              className="size-4 shrink-0"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            Create Template
          </button>
        </div>
      </header>

      {imported && (
        <p
          role="status"
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            imported.error || imported.added === 0
              ? 'bg-red-50 text-red-700'
              : 'bg-emerald-50 text-emerald-700',
          )}
        >
          {imported.error ??
            `${imported.added} template${imported.added === 1 ? '' : 's'} added` +
              (imported.skipped > 0
                ? `, ${imported.skipped} skipped — already here, or with no name or steps on them.`
                : '.')}
        </p>
      )}

      {creating && <TemplateDialog onClose={() => setCreating(false)} />}
      {editing && (
        <TemplateDialog template={editing} onClose={() => setEditing(null)} />
      )}
      {using && (
        <UseTemplateDialog
          template={using}
          onClose={() => setUsing(null)}
          onApplied={(taskId) => navigate(`/tasks/${taskId}`)}
        />
      )}

      <section aria-labelledby="template-totals">
        <h2 id="template-totals" className="sr-only">
          Totals
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
          {tiles.map((t) => (
            <article key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-ink-subtle block text-xs font-semibold tracking-wider uppercase">
                  {t.label}
                </span>
                <span
                  className={cn(
                    'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                    t.tone,
                  )}
                >
                  <t.icon
                    className="size-4"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>
              </div>
              <span className="text-ink mt-2 block text-2xl font-bold tracking-tight tabular-nums">
                {t.value}
              </span>
              <span className="text-ink-subtle mt-1 block text-sm break-words">
                {t.hint}
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* Straight on the page, as the design draws it. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full min-w-0 sm:w-64">
          <span className="sr-only">Search templates</span>
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search templates..."
            className="border-line bg-canvas focus:border-brand-500 focus:bg-surface h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
          />
        </label>
        <SelectFilter
          chip
          quiet
          label="Category"
          value={category}
          defaultValue="all"
          onChange={(v) => set('category', v)}
          options={[{ value: 'all', label: 'All' }, ...categoryOptions]}
        />
        <SelectFilter
          chip
          quiet
          label="Schedule"
          value={schedule}
          defaultValue="all"
          onChange={(v) => set('schedule', v)}
          options={[{ value: 'all', label: 'All' }, ...scheduleOptions]}
        />
        <SelectFilter
          chip
          quiet
          label="Status"
          value={status}
          defaultValue="active"
          onChange={(v) => set('status', v)}
          options={[
            { value: 'active', label: 'In use' },
            { value: 'retired', label: 'Retired' },
            { value: 'all', label: 'Both' },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <Panel title="Templates">
          <p className="text-ink-subtle text-sm" role="status">
            No template matches that.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((template) => (
            <Card
              key={template.id}
              template={template}
              onUse={() => setUsing(template)}
              onEdit={() => setEditing(template)}
              onDuplicate={() => {
                const id = duplicateTemplate(template.id)
                const copy = id
                  ? allTemplates().find((t) => t.id === id)
                  : undefined
                if (copy) setEditing(copy)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Card({
  template,
  onUse,
  onEdit,
  onDuplicate,
}: {
  template: TaskTemplate
  onUse: () => void
  onEdit: () => void
  onDuplicate: () => void
}) {
  const raised = tasksFromTemplate(template.id)
  const latest = raised[0]
  const done = raised.filter((t) => t.done).length
  // Over these tasks and no others. Null rather than 0% where none was raised:
  // nothing has been left undone yet, so there is no rate to show.
  const rate =
    raised.length === 0 ? null : Math.round((done / raised.length) * 100)

  const menu: MenuItem[] = []
  // Raising a task is the one thing the card is for, and the design's row has
  // no way to do it — so it leads the overflow. A retired template raises
  // nothing until it is put back.
  if (template.active)
    menu.push({ id: 'use', label: 'Raise a task from this', onSelect: onUse })
  if (raised.length === 0)
    menu.push({
      id: 'delete',
      label: 'Delete template',
      destructive: true,
      onSelect: () => deleteTemplate(template.id),
    })

  return (
    <article
      className={cn('card flex flex-col p-4', !template.active && 'opacity-70')}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-ink min-w-0 text-base font-semibold break-words">
          {template.name}
        </h3>
        <span className="flex shrink-0 items-center gap-1.5">
          {!template.active && (
            <span className="bg-sunken text-ink-muted rounded-full px-2.5 py-0.5 text-xs font-semibold">
              Retired
            </span>
          )}
          {/* Coloured from the category settings, so recolouring a category on
              the settings screen moves every chip that names it. */}
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
              tonePill[categoryTone(template.category)],
            )}
          >
            {categoryLabel(template.category)}
          </span>
        </span>
      </div>

      <p className="text-ink-muted mt-1.5 text-sm break-words">
        {template.description}
      </p>

      {/* Three lines, in the order somebody reads them: how big it is, when it
          is normally done, who it normally falls to. */}
      <dl className="border-line text-ink-muted mt-3 space-y-1.5 border-t pt-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-2">
            <ListChecks
              className="size-4 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <dt className="sr-only">Items</dt>
            {/* Counted off the list. The design states a number beside a
                checklist it cannot see. */}
            <dd>
              <span className="text-ink font-medium">
                {template.items.length}
              </span>{' '}
              item{template.items.length === 1 ? '' : 's'}
            </dd>
          </span>
          <span aria-hidden="true" className="text-line hidden sm:inline">
            |
          </span>
          <span className="flex items-center gap-2">
            <Clock
              className="size-4 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <dt className="sr-only">Estimate</dt>
            <dd>
              Est. time:{' '}
              <span className="text-ink font-medium">
                {template.estimateMinutes} min
              </span>
            </dd>
          </span>
        </div>

        <div className="flex items-start gap-2">
          <CalendarClock
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          <dt className="sr-only">Usually done</dt>
          {/* Where the design has a schedule. Nothing fires on it, so the line
              is worded as the guidance it is. */}
          <dd className="min-w-0 break-words">
            Schedule:{' '}
            <span className="text-ink font-medium">
              {frequencyLabel(template.frequency)}
              {template.cadence && `, ${template.cadence}`}
            </span>
          </dd>
        </div>

        <div className="flex items-start gap-2">
          <User
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          <dt className="sr-only">Usually falls to</dt>
          <dd className="min-w-0 break-words">
            Assigned to:{' '}
            <span className="text-ink font-medium">
              {groupLabel(template.assignedTo)}
            </span>
          </dd>
        </div>
      </dl>

      {/* The design's two statistics, over the only tasks that exist: the ones
          somebody raised from this template. Not "280/month" — nothing here
          generates a task on a clock, so the count has no per-month rate to
          quote and the number itself is the whole figure. */}
      <dl className="border-line mt-3 flex flex-wrap items-start justify-between gap-4 border-t pt-3">
        <div className="min-w-0">
          <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
            Tasks generated
          </dt>
          <dd className="text-ink mt-0.5 text-base font-bold">
            {latest ? (
              <Link
                to={`/tasks/${latest.id}`}
                className="text-brand-700 hover:text-brand-800"
              >
                {raised.length}
              </Link>
            ) : (
              <span className="text-ink-subtle text-sm font-normal">
                None yet
              </span>
            )}
          </dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
            Completion rate
          </dt>
          <dd className="mt-0.5 text-base font-bold">
            {rate === null ? (
              <span className="text-ink-subtle text-sm font-normal">
                &mdash;
              </span>
            ) : (
              <span
                className={rate >= 90 ? 'text-emerald-600' : 'text-amber-600'}
              >
                {rate}%
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="border-line mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center text-sm font-medium"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="text-ink hover:text-ink-muted inline-flex min-h-11 items-center text-sm font-medium"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => setTemplateActive(template.id, !template.active)}
          className={cn(
            'inline-flex min-h-11 items-center text-sm font-medium',
            template.active
              ? 'text-red-600 hover:text-red-700'
              : 'text-ink hover:text-ink-muted',
          )}
        >
          {template.active ? 'Deactivate' : 'Reactivate'}
        </button>
        {/* The design's overflow. Raising a task lives here: the design's row
            has no way to apply a template, and it is still the one thing the
            card is for. Deleting only where nothing points at it — a task
            raised from a template names it, and deleting the template would
            leave that task pointing at nothing. */}
        {menu.length > 0 && (
          <span className="ml-auto">
            <DropdownMenu label={`More for ${template.name}`} items={menu} />
          </span>
        )}
      </div>
    </article>
  )
}
