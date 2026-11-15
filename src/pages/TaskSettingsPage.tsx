import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useTaskSettings,
  useUpdateCategorySetting,
  useUpdateNotificationSetting,
  useUpdatePrioritySetting,
  type CategorySettingDto,
  type NotificationSettingDto,
  type PrioritySettingDto,
} from '@/features/tasks/useTasks'
import { cn } from '@/lib/cn'

/**
 * Task settings, read live from `GET /admin/tasks/settings`: the task categories
 * every screen labels itself with, the priority levels and the notification
 * preferences. Each row saves its own overlay through its endpoint
 * (`PUT /settings/categories/:category`, `/priorities/:priority`,
 * `/notifications/:key`) and refreshes the read. The old in browser draft plus
 * apply simulation, the add/delete category flow and the status workflow section
 * are gone: the backend persists these overlays directly and the category set is
 * fixed.
 */
const sections = [
  { id: 'categories', label: 'Categories' },
  { id: 'priorities', label: 'Priority Levels' },
  { id: 'notifications', label: 'Notifications & Reminders' },
] as const

export function TaskSettingsPage() {
  const query = useTaskSettings()
  const data = query.data

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

      <header className="min-w-0">
        <h1 className="text-ink text-2xl font-bold tracking-tight">Task Settings</h1>
        <p className="text-ink-muted mt-1 max-w-2xl text-sm">
          Configure the task categories and priorities every other screen is built out of.
        </p>
      </header>

      {query.isPending ? (
        <p className="text-ink-subtle py-10 text-center text-sm" role="status">
          Loading…
        </p>
      ) : query.isError || !data ? (
        <div className="py-10 text-center">
          <p className="text-sm text-red-600" role="status">
            Could not load settings.
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-brand-700 hover:text-brand-800 mt-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
          <nav aria-label="Settings sections" className="lg:sticky lg:top-4 lg:self-start">
            <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-ink-muted hover:bg-sunken hover:text-ink inline-flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium whitespace-nowrap"
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
              blurb="The categories every screen labels tasks with."
            >
              <div className="card divide-line divide-y">
                {data.categories.map((c) => (
                  <CategoryRow key={c.category} category={c} />
                ))}
              </div>
            </Section>

            <Section
              id="priorities"
              title="Priority Levels"
              blurb="Configure priority labels, their target hours and escalation."
            >
              <div className="card divide-line divide-y">
                {data.priorities.map((p) => (
                  <PriorityRow key={p.priority} priority={p} />
                ))}
              </div>
            </Section>

            <Section
              id="notifications"
              title="Notifications & Reminders"
              blurb="When and how task notifications are sent."
            >
              <ul className="card divide-line divide-y">
                {data.notifications.map((n) => (
                  <NotificationRow key={n.key} notification={n} />
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </div>
  )
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
    <section id={id} className="scroll-mt-6">
      <h2 className="text-ink text-lg font-bold tracking-tight">{title}</h2>
      <p className="text-ink-muted mt-0.5 text-sm">{blurb}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function CategoryRow({ category }: { category: CategorySettingDto }) {
  const update = useUpdateCategorySetting()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-block size-3 shrink-0 rounded-full"
          style={{ backgroundColor: category.color ?? '#94a3b8' }}
        />
        <span className="min-w-0">
          <span className="text-ink block text-sm font-medium break-words">{category.label}</span>
          <span className="text-ink-subtle block text-xs">
            {category.tasksCount} task{category.tasksCount === 1 ? '' : 's'}
            {category.autoAssignLabel ? ` · ${category.autoAssignLabel}` : ''}
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={category.active}
        aria-label={`${category.label} active`}
        disabled={update.isPending}
        onClick={() => update.mutate({ category: category.category, active: !category.active })}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          category.active ? 'bg-brand-600' : 'bg-slate-300',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow transition-transform',
            category.active ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

function PriorityRow({ priority }: { priority: PrioritySettingDto }) {
  const update = useUpdatePrioritySetting()
  const [label, setLabel] = useState(priority.label)
  const [slaHours, setSlaHours] = useState(priority.slaHours ?? 0)

  const dirty = label.trim() !== priority.label || slaHours !== (priority.slaHours ?? 0)

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <span
        aria-hidden="true"
        className="inline-block size-3 shrink-0 rounded-full"
        style={{ backgroundColor: priority.color ?? '#94a3b8' }}
      />
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label={`Label for ${priority.priority}`}
        className="border-line focus:border-brand-500 h-9 w-36 rounded-lg border px-2 text-sm font-medium"
      />
      <span className="text-ink flex items-baseline gap-1 text-sm">
        <input
          type="number"
          min={1}
          step={1}
          value={slaHours}
          onChange={(e) => setSlaHours(Number(e.target.value))}
          aria-label={`Target hours for ${priority.priority}`}
          className="border-line focus:border-brand-500 h-9 w-14 rounded-lg border px-2 text-right text-sm tabular-nums"
        />
        <span>hours</span>
      </span>
      {priority.escalation && <span className="text-ink-subtle text-sm">{priority.escalation}</span>}
      {priority.isDefault && (
        <span className="bg-brand-50 text-brand-700 rounded-md px-2 py-0.5 text-xs font-semibold">
          Default
        </span>
      )}
      <button
        type="button"
        disabled={!dirty || update.isPending || label.trim() === ''}
        onClick={() =>
          update.mutate({
            priority: priority.priority,
            label: label.trim(),
            slaHours: Math.max(1, Math.round(slaHours)),
          })
        }
        className="text-brand-700 hover:text-brand-800 ml-auto inline-flex min-h-9 items-center text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
    </div>
  )
}

function NotificationRow({ notification }: { notification: NotificationSettingDto }) {
  const update = useUpdateNotificationSetting()
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <span className="min-w-0">
        <span className="text-ink block text-sm font-semibold break-words">{notification.title}</span>
        <span className="text-ink-subtle block text-sm">
          {notification.description}
          {notification.channelsLabel ? ` · ${notification.channelsLabel}` : ''}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={notification.enabled}
        aria-label={notification.title}
        disabled={update.isPending}
        onClick={() => update.mutate({ key: notification.key, enabled: !notification.enabled })}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          notification.enabled ? 'bg-brand-600' : 'bg-slate-300',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow transition-transform',
            notification.enabled ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </li>
  )
}
