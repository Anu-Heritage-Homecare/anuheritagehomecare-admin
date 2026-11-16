import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck, Clock, FolderOpen, ListChecks, Plus, Search, User } from 'lucide-react'
import {
  CATEGORY_VALUES,
  PRIORITY_VALUES,
  useCreateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  useInstantiateTemplate,
  useSetTemplateActive,
  useTaskTemplates,
  useUpdateTemplate,
  type BackendCategory,
  type BackendPriority,
  type TaskTemplateCardDto,
  type TemplateInput,
} from '@/features/tasks/useTasks'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Drawer } from '@/components/ui/Drawer'
import { Panel } from '@/components/ui/Panel'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { cn } from '@/lib/cn'

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

/**
 * Task templates, read live from `GET /admin/tasks/templates`: the KPI bar and
 * the filtered template cards. Create, edit, duplicate, activate, deactivate,
 * delete and instantiate each call their endpoint and refresh the screen. The
 * per week yield and average completion the design shows are deferred on the
 * backend, so the cards report only what is stored.
 */
export function TaskTemplatesPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TaskTemplateCardDto | null>(null)
  const [using, setUsing] = useState<TaskTemplateCardDto | null>(null)

  const search = params.get('q') ?? ''
  const rawCategory = (params.get('category') ?? '').toUpperCase()
  const category = CATEGORY_VALUES.includes(rawCategory as BackendCategory)
    ? (rawCategory as BackendCategory)
    : null
  const rawStatus = params.get('status') ?? 'active'
  const status = rawStatus === 'retired' ? 'INACTIVE' : rawStatus === 'all' ? null : 'ACTIVE'

  const query = useTaskTemplates({ category, status, search })

  const duplicate = useDuplicateTemplate()
  const setActive = useSetTemplateActive()
  const del = useDeleteTemplate()

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || (key === 'status' ? value === 'active' : value === 'all')) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: key === 'q' })
  }

  const data = query.data
  const kpis = data?.kpis

  const tiles = [
    {
      id: 'active',
      label: 'Active Templates',
      icon: FolderOpen,
      tone: 'bg-brand-50 text-brand-600',
      value: kpis ? String(kpis.activeTemplates) : '—',
      hint: kpis ? `Across ${kpis.operations} operation${kpis.operations === 1 ? '' : 's'}` : '',
    },
    {
      id: 'week',
      label: 'Generated This Week',
      icon: ListChecks,
      tone: 'bg-brand-50 text-brand-600',
      value: kpis && kpis.tasksGeneratedThisWeek !== null ? String(kpis.tasksGeneratedThisWeek) : '—',
      hint: 'Awaiting a task scheduler',
    },
    {
      id: 'rate',
      label: 'Avg Completion',
      icon: CircleCheck,
      tone: 'bg-emerald-50 text-emerald-600',
      value: kpis && kpis.avgCompletionRatePercent !== null ? `${kpis.avgCompletionRatePercent}%` : '—',
      hint: 'Awaiting a task scheduler',
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
          <h1 className="text-ink text-2xl font-bold tracking-tight">Task Templates</h1>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm">
            Create and manage reusable task checklists for common care operations.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
          >
            <Plus className="size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            Create Template
          </button>
        </div>
      </header>

      {creating && <TemplateDialog onClose={() => setCreating(false)} />}
      {editing && <TemplateDialog template={editing} onClose={() => setEditing(null)} />}
      {using && (
        <UseTemplateDialog
          template={using}
          onClose={() => setUsing(null)}
          onApplied={(id) => navigate(`/tasks/${id}`)}
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
                  <t.icon className="size-4" strokeWidth={2} aria-hidden="true" />
                </span>
              </div>
              <span className="text-ink mt-2 block text-2xl font-bold tracking-tight tabular-nums">
                {t.value}
              </span>
              <span className="text-ink-subtle mt-1 block text-sm break-words">{t.hint}</span>
            </article>
          ))}
        </div>
      </section>

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
          value={rawStatus}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'active', label: 'In use' },
            { value: 'retired', label: 'Retired' },
            { value: 'all', label: 'Both' },
          ]}
        />
      </div>

      {query.isPending ? (
        <Panel title="Templates">
          <p className="text-ink-subtle text-sm" role="status">
            Loading…
          </p>
        </Panel>
      ) : query.isError ? (
        <Panel title="Templates">
          <p className="text-sm text-red-600" role="status">
            Could not load templates.{' '}
            <button type="button" onClick={() => query.refetch()} className="font-semibold underline">
              Try again
            </button>
          </p>
        </Panel>
      ) : (data?.templates.length ?? 0) === 0 ? (
        <Panel title="Templates">
          <p className="text-ink-subtle text-sm" role="status">
            No template matches that.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data?.templates.map((template) => (
            <Card
              key={template.id}
              template={template}
              onUse={() => setUsing(template)}
              onEdit={() => setEditing(template)}
              onDuplicate={() => duplicate.mutate(template.id)}
              onToggle={() => setActive.mutate({ id: template.id, active: !template.active })}
              onDelete={() => del.mutate(template.id)}
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
  onToggle,
  onDelete,
}: {
  template: TaskTemplateCardDto
  onUse: () => void
  onEdit: () => void
  onDuplicate: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const menu: MenuItem[] = []
  if (template.active) menu.push({ id: 'use', label: 'Raise a task from this', onSelect: onUse })
  menu.push({ id: 'delete', label: 'Delete template', destructive: true, onSelect: onDelete })

  return (
    <article className={cn('card flex flex-col p-4', !template.active && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-ink min-w-0 text-base font-semibold break-words">{template.name}</h3>
        <span className="flex shrink-0 items-center gap-1.5">
          {!template.active && (
            <span className="bg-sunken text-ink-muted rounded-full px-2.5 py-0.5 text-xs font-semibold">
              Retired
            </span>
          )}
          <span className="bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
            {template.categoryLabel}
          </span>
        </span>
      </div>

      {template.description && (
        <p className="text-ink-muted mt-1.5 text-sm break-words">{template.description}</p>
      )}

      <dl className="border-line text-ink-muted mt-3 space-y-1.5 border-t pt-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-2">
            <ListChecks className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <dt className="sr-only">Items</dt>
            <dd>
              <span className="text-ink font-medium">{template.itemCount}</span> item
              {template.itemCount === 1 ? '' : 's'}
            </dd>
          </span>
          {template.estimatedMinutes != null && (
            <span className="flex items-center gap-2">
              <Clock className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <dt className="sr-only">Estimate</dt>
              <dd>
                Est. time: <span className="text-ink font-medium">{template.estimatedMinutes} min</span>
              </dd>
            </span>
          )}
        </div>
        {template.assigneeLabel && (
          <div className="flex items-start gap-2">
            <User className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <dt className="sr-only">Usually falls to</dt>
            <dd className="min-w-0 break-words">
              Assigned to: <span className="text-ink font-medium">{template.assigneeLabel}</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="border-line mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
        {template.active && (
          <button
            type="button"
            onClick={onUse}
            className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center text-sm font-medium"
          >
            Use
          </button>
        )}
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
          onClick={onToggle}
          className={cn(
            'inline-flex min-h-11 items-center text-sm font-medium',
            template.active ? 'text-red-600 hover:text-red-700' : 'text-ink hover:text-ink-muted',
          )}
        >
          {template.active ? 'Deactivate' : 'Reactivate'}
        </button>
        <span className="ml-auto">
          <DropdownMenu label={`More for ${template.name}`} items={menu} />
        </span>
      </div>
    </article>
  )
}

/** Create or edit a template. The `template` prop switches it to edit. */
function TemplateDialog({
  template,
  onClose,
}: {
  template?: TaskTemplateCardDto
  onClose: () => void
}) {
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const editing = Boolean(template)

  const [name, setName] = useState(template?.name ?? '')
  const [title, setTitle] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [category, setCategory] = useState<BackendCategory>(
    (template?.category as BackendCategory) ?? 'CARE_ACTIVITY',
  )
  const [priority, setPriority] = useState<BackendPriority>('MEDIUM')
  const [assigneeLabel, setAssigneeLabel] = useState(template?.assigneeLabel ?? '')
  const [items, setItems] = useState('')

  const busy = create.isPending || update.isPending
  const failed = create.isError || update.isError

  const submit = () => {
    if (name.trim() === '' || title.trim() === '') return
    const checklistItems = items
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i !== '')
    const body: TemplateInput = {
      name: name.trim(),
      title: title.trim(),
      category,
      priority,
    }
    if (description.trim() !== '') body.description = description.trim()
    if (assigneeLabel.trim() !== '') body.defaultAssigneeLabel = assigneeLabel.trim()
    if (checklistItems.length > 0) body.checklistItems = checklistItems
    if (editing && template) {
      update.mutate({ id: template.id, ...body }, { onSuccess: onClose })
    } else {
      create.mutate(body, { onSuccess: onClose })
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title={editing ? 'Edit template' : 'Create template'}
      subtitle={template?.name}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <span className="text-ink text-sm font-medium">Template name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-medium">Task title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-ink text-sm font-medium">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BackendCategory)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
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
        </div>
        <label className="block">
          <span className="text-ink text-sm font-medium">Default assignee</span>
          <input
            type="text"
            value={assigneeLabel}
            onChange={(e) => setAssigneeLabel(e.target.value)}
            placeholder="A person or team name"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-medium">Checklist steps</span>
          <span className="text-ink-subtle block text-xs">One per line.</span>
          <textarea
            value={items}
            onChange={(e) => setItems(e.target.value)}
            rows={4}
            placeholder={editing ? 'Leave blank to keep the current steps' : 'Check the chart\nAdminister the dose'}
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>

        {failed && (
          <p className="text-sm text-red-600" role="status">
            Could not save the template.
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
            disabled={name.trim() === '' || title.trim() === '' || busy}
            onClick={submit}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {editing ? 'Save template' : 'Create template'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}

/** Raise a task from a template, with optional due date and assignee override. */
function UseTemplateDialog({
  template,
  onClose,
  onApplied,
}: {
  template: TaskTemplateCardDto
  onClose: () => void
  onApplied: (taskId: string) => void
}) {
  const instantiate = useInstantiateTemplate()
  const [assigneeLabel, setAssigneeLabel] = useState(template.assigneeLabel ?? '')
  const [dueAt, setDueAt] = useState('')

  const submit = () => {
    const input: { id: string; assigneeLabel?: string; dueAt?: string } = { id: template.id }
    if (assigneeLabel.trim() !== '') input.assigneeLabel = assigneeLabel.trim()
    if (dueAt !== '') input.dueAt = new Date(dueAt).toISOString()
    instantiate.mutate(input, { onSuccess: (result) => onApplied(result.id) })
  }

  return (
    <Drawer open onClose={onClose} placement="center" title="Raise a task" subtitle={template.name}>
      <div className="space-y-4 p-4 sm:p-5">
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
        {instantiate.isError && (
          <p className="text-sm text-red-600" role="status">
            Could not raise the task.
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
            disabled={instantiate.isPending}
            onClick={submit}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Raise task
          </button>
        </div>
      </div>
    </Drawer>
  )
}
