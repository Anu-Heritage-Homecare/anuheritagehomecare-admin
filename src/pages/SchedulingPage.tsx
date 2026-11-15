import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Funnel,
  Loader2,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import {
  addDays,
  dayOf,
  formatFullDay,
  formatTime,
  formatWeekRange,
  todayIso,
  weekDates,
  weekStart,
} from '@/features/scheduling/date-util'
import {
  useSchedulingCalendar,
  useSchedulingConflicts,
  useSchedulingConsole,
  useUnassignedVisits,
} from '@/features/scheduling/useScheduling'
import type { BoardRow, ConflictView } from '@/features/scheduling/useScheduling'
import { Panel } from '@/components/ui/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

const ISO = /^\d{4}-\d{2}-\d{2}$/

const views = [
  { slug: 'day', label: "Today's Schedule" },
  { slug: 'week', label: 'Calendar' },
  { slug: 'unassigned', label: 'Unassigned Visits' },
  { slug: 'conflicts', label: 'Conflicts & Alerts' },
] as const

type View = (typeof views)[number]['slug']

function Spinner({ label }: { label: string }) {
  return (
    <div className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      {label}
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-ink text-sm font-medium">Could not load scheduling.</p>
      <p className="text-ink-subtle text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  )
}

export function SchedulingPage() {
  const [params, setParams] = useSearchParams()
  const today = todayIso()

  const requested = params.get('date')
  const valid = requested && ISO.test(requested)
  const date = valid ? requested : today
  const view = (views.find((v) => v.slug === params.get('view'))?.slug ?? 'day') as View

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const console = useSchedulingConsole(date)
  const isToday = date === today
  const summary = console.data?.summary
  const assigned = summary ? summary.todaysVisits - summary.unassignedVisits : 0

  const tiles = summary
    ? [
        {
          id: 'total',
          label: isToday ? "Today's visits" : 'Visits',
          value: summary.todaysVisits,
          hint:
            summary.unassignedVisits === 0
              ? isToday
                ? 'Assigned today'
                : 'All assigned'
              : `${assigned} assigned`,
        },
        {
          id: 'upcoming',
          label: 'Upcoming visits',
          value: summary.upcomingVisits,
          hint: 'Pending start',
        },
        {
          id: 'available',
          label: 'Available caregivers',
          value: summary.availableCaregivers,
          hint: 'Ready for dispatch',
        },
        {
          id: 'unassigned',
          label: 'Unassigned visits',
          value: summary.unassignedVisits,
          hint: summary.unassignedVisits > 0 ? 'Immediate action needed' : 'All covered',
          view: 'unassigned' as View,
        },
        {
          id: 'conflicts',
          label: 'Schedule conflicts',
          value: summary.scheduleConflicts,
          hint: summary.scheduleConflicts === 0 ? 'Nothing flagged' : 'Needs attention',
          view: 'conflicts' as View,
        },
        {
          id: 'completed',
          label: 'Completed visits',
          value: summary.completedVisits,
          hint: 'Shift reports finalized',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">Scheduling</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Plan, assign and monitor caregiver visits across the organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            Export Schedule
          </button>
          <Link
            to="/scheduling?view=unassigned"
            className="border-line text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            Assign Caregiver
          </Link>
          <Link
            to="/scheduling/visits/new"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Schedule Visit
          </Link>
        </div>
      </header>

      {tiles.length > 0 && (
        <section aria-label="Schedule totals">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {tiles.map((t) => {
              const body = (
                <>
                  <span className="text-ink-subtle block text-xs font-semibold tracking-wider uppercase">
                    {t.label}
                  </span>
                  <span className="text-ink mt-2 block text-2xl font-bold tracking-tight tabular-nums">
                    {t.value}
                  </span>
                  <span className="text-ink-subtle mt-1 block text-xs break-words">{t.hint}</span>
                </>
              )
              return t.view && t.value > 0 ? (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setParam('view', t.view!)}
                  className="card hover:border-brand-300 p-4 text-left transition-colors"
                >
                  {body}
                </button>
              ) : (
                <article key={t.id} className="card p-4">
                  {body}
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div
        role="group"
        aria-label="Choose a view"
        className="no-scrollbar flex gap-3 overflow-x-auto"
      >
        {views.map((v) => {
          const active = v.slug === view
          const count =
            v.slug === 'unassigned'
              ? (console.data?.tabCounts.unassigned ?? null)
              : v.slug === 'conflicts'
                ? (console.data?.tabCounts.conflicts ?? null)
                : null
          return (
            <button
              key={v.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setParam('view', v.slug === 'day' ? null : v.slug)}
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors',
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-control text-ink hover:bg-sunken',
              )}
            >
              {v.slug === 'day' && !isToday ? 'Day Schedule' : v.label}
              {count !== null && (
                <span
                  className={cn(
                    'rounded px-1.5 text-xs tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-sunken text-ink-muted',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {view !== 'unassigned' && (
        <DateNav
          date={date}
          today={today}
          step={view === 'week' ? 7 : 1}
          unit={view === 'week' ? 'week' : 'day'}
          onDate={(next) => setParam('date', next === today ? null : next)}
        />
      )}

      {view === 'day' &&
        (console.isPending ? (
          <Spinner label="Loading schedule…" />
        ) : console.isError ? (
          <ErrorCard message={console.error.message} onRetry={() => void console.refetch()} />
        ) : (
          <DayBoard key={date} date={date} today={today} visits={console.data.rows} />
        ))}
      {view === 'week' && <WeekBoard date={date} today={today} />}
      {view === 'unassigned' && <UnassignedQueue date={date} today={today} />}
      {view === 'conflicts' && <ConflictList date={date} />}

      <QuickOperations
        onPickVisit={() => {
          setParam('view', null)
          requestAnimationFrame(() =>
            document
              .getElementById('day-board-title')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          )
        }}
      />
    </div>
  )
}

/* ----------------------------- quick operations ---------------------------- */

const opCard =
  'group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors'

function OpBody({
  icon: Icon,
  iconClass,
  title,
  hint,
  primary,
}: {
  icon: LucideIcon
  iconClass: string
  title: string
  hint: string
  primary?: boolean
}) {
  return (
    <>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', iconClass)}>
        <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 grow">
        <span
          className={cn(
            'block text-base leading-tight font-semibold tracking-tight',
            primary ? 'text-white' : 'text-ink',
          )}
        >
          {title}
        </span>
        <span
          className={cn('mt-0.5 block text-[0.8125rem]', primary ? 'text-white/85' : 'text-ink-muted')}
        >
          {hint}
        </span>
      </span>
      <ChevronRight
        className={cn(
          'size-5 shrink-0 transition-transform group-hover:translate-x-0.5',
          primary ? 'text-white' : 'text-ink-subtle',
        )}
        strokeWidth={2}
        aria-hidden="true"
      />
    </>
  )
}

function QuickOperations({ onPickVisit }: { onPickVisit: () => void }) {
  const secondary = cn(opCard, 'card hover:border-brand-300')
  return (
    <section aria-labelledby="quick-ops" className="space-y-3">
      <h2 id="quick-ops" className="text-ink text-base font-semibold tracking-tight">
        Quick Operations
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <Link
          to="/scheduling/visits/new"
          className={cn(opCard, 'bg-brand-600 hover:bg-brand-700 border-transparent')}
        >
          <OpBody
            primary
            icon={Calendar}
            iconClass="bg-white/15 text-white"
            title="Schedule Visit"
            hint="Create a new client shift"
          />
        </Link>
        <Link to="/scheduling?view=unassigned" className={secondary}>
          <OpBody
            icon={UserRound}
            iconClass="bg-blue-50 text-blue-600"
            title="Assign Caregiver"
            hint="Match a caregiver to a visit"
          />
        </Link>
        <button type="button" onClick={onPickVisit} className={secondary}>
          <OpBody
            icon={Clock}
            iconClass="bg-amber-100 text-amber-600"
            title="Reschedule Visit"
            hint="Change times or dates"
          />
        </button>
        <button type="button" onClick={onPickVisit} className={secondary}>
          <OpBody
            icon={Trash2}
            iconClass="bg-sunken text-ink-muted"
            title="Cancel Visit"
            hint="Revoke scheduled session"
          />
        </button>
      </div>
    </section>
  )
}

/* --------------------------------- day view -------------------------------- */

function DateNav({
  date,
  today,
  step,
  unit,
  onDate,
}: {
  date: string
  today: string
  step: number
  unit: string
  onDate: (next: string) => void
}) {
  return (
    <nav aria-label={`Change ${unit}`} className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onDate(addDays(date, -step))}
        className="border-line text-ink hover:bg-sunken inline-flex h-9 items-center gap-1 rounded-lg border pr-3 pl-2 text-sm font-medium"
      >
        <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        Previous
        <span className="sr-only"> {unit}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (date === today) return
          onDate(today)
        }}
        aria-disabled={date === today}
        className={cn(
          'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium',
          date === today
            ? 'border-line bg-sunken text-ink-subtle cursor-not-allowed'
            : 'border-line text-ink hover:bg-sunken',
        )}
      >
        Today
      </button>
      <button
        type="button"
        onClick={() => onDate(addDays(date, step))}
        className="border-line text-ink hover:bg-sunken inline-flex h-9 items-center gap-1 rounded-lg border pr-2 pl-3 text-sm font-medium"
      >
        Next
        <span className="sr-only"> {unit}</span>
        <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
      <p className="text-ink-subtle text-sm">
        {unit === 'week' ? formatWeekRange(weekStart(date)) : formatFullDay(date)}
      </p>
    </nav>
  )
}

const rowStateLabels: Record<BoardRow['status'], string> = {
  unassigned: 'Unassigned',
  completed: 'Completed',
  'in-progress': 'In Progress',
  'starting-soon': 'Starting Soon',
  upcoming: 'Upcoming',
  'late-arrival': 'Late Arrival',
  cancelled: 'Cancelled',
}

const rowStateStyles: Record<BoardRow['status'], string> = {
  unassigned: 'bg-red-50 text-red-700',
  completed: 'bg-brand-50 text-brand-700',
  'in-progress': 'bg-blue-50 text-blue-700',
  'starting-soon': 'bg-amber-50 text-amber-700',
  upcoming: 'bg-sunken text-ink-muted',
  'late-arrival': 'bg-amber-50 text-amber-700',
  cancelled: 'bg-sunken text-ink-muted',
}

function RowStatus({ status }: { status: BoardRow['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        rowStateStyles[status],
      )}
    >
      {rowStateLabels[status]}
    </span>
  )
}

const priorityDot: Record<BoardRow['priority'], { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-600' },
  urgent: { dot: 'bg-red-500', text: 'text-red-600' },
  high: { dot: 'bg-amber-500', text: 'text-amber-700' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-700' },
  normal: { dot: 'bg-ink', text: 'text-ink' },
  low: { dot: 'bg-ink-subtle', text: 'text-ink-muted' },
}

function PriorityDot({ priority }: { priority: BoardRow['priority'] }) {
  const tone = priorityDot[priority]
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm capitalize', tone.text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
      {priority}
    </span>
  )
}

function RowAction({ visit }: { visit: BoardRow }) {
  const sr = ` for ${visit.recipientName} at ${formatTime(visit.start)}`
  if (!visit.caregiverId && visit.assignable) {
    return (
      <Link
        to={`/scheduling/visits/${visit.id}/assign`}
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-7 items-center rounded-md px-3 text-xs font-semibold text-white"
      >
        Assign
        <span className="sr-only"> a caregiver{sr}</span>
      </Link>
    )
  }
  const items: MenuItem[] = [
    { id: 'view', label: 'View visit', to: `/scheduling/visits/${visit.id}/overview` },
    ...(visit.assignable
      ? [{ id: 'reassign', label: 'Reassign caregiver', to: `/scheduling/visits/${visit.id}/assign` }]
      : []),
    ...(visit.caregiverId
      ? [
          {
            id: 'caregiver',
            label: 'Open caregiver schedule',
            to: `/caregivers/${visit.caregiverId}/schedule`,
          },
        ]
      : []),
  ]
  return <DropdownMenu label={`Actions${sr}`} items={items} />
}

const PAGE_SIZE = 10

const stateFilters = [
  { value: 'all', label: 'All statuses' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function DayBoard({
  date,
  today,
  visits,
}: {
  date: string
  today: string
  visits: BoardRow[]
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [state, setState] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visits.filter(
      (v) =>
        (state === 'all' || v.status === state) &&
        (!q ||
          v.recipientName.toLowerCase().includes(q) ||
          (v.caregiverName ?? '').toLowerCase().includes(q) ||
          v.type.toLowerCase().includes(q)),
    )
  }, [visits, query, state])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)
  const day = formatFullDay(date)
  const when = date === today ? 'today' : `on ${day}`

  return (
    <section aria-labelledby="day-board-title" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2
          id="day-board-title"
          className="text-ink flex items-center gap-2.5 text-base font-semibold tracking-tight"
        >
          <CalendarDays className="text-brand-600 size-5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          {day}
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="border-control focus-within:border-brand-400 flex h-10 w-full items-center gap-2 rounded-lg border px-3 sm:w-72">
            <Search className="text-ink-subtle size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span className="sr-only">Search visits</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Search visit or patient..."
              className="text-ink placeholder:text-ink-subtle min-w-0 grow bg-transparent text-sm outline-none"
            />
          </label>
          <SelectFilter
            chip
            icon={Funnel}
            label="Filters"
            value={state}
            onChange={(next) => {
              setState(next)
              setPage(1)
            }}
            options={stateFilters}
          />
        </div>
      </div>

      {visits.length === 0 || rows.length === 0 ? (
        <p role="status" className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm">
          {visits.length === 0
            ? `Nothing on the board for ${day}.`
            : 'No visits match your search or filter.'}
        </p>
      ) : (
        <>
          <div
            tabIndex={0}
            role="region"
            aria-label={`Visits on ${day}`}
            className="hidden overflow-x-auto xl:block"
          >
            <table className="w-full min-w-4xl text-left text-sm">
              <thead className="border-line bg-sunken text-ink-muted border-b text-xs">
                <tr>
                  {['Time', 'Care recipient', 'Assigned caregiver', 'Service', 'Status', 'Priority', 'Actions'].map(
                    (col) => (
                      <th
                        key={col}
                        scope="col"
                        className={cn(
                          'px-5 py-3 font-semibold tracking-wide whitespace-nowrap uppercase',
                          col === 'Actions' && 'text-center',
                        )}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {rows.map((visit) => {
                  const open = !visit.caregiverId
                  return (
                    <tr
                      key={visit.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (!e.currentTarget.contains(target)) return
                        if (target.closest('a, button')) return
                        navigate(`/scheduling/visits/${visit.id}/overview`)
                      }}
                      className={cn(
                        'cursor-pointer transition-colors',
                        open ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-canvas',
                      )}
                    >
                      <th
                        scope="row"
                        className={cn(
                          'px-5 py-4 font-normal whitespace-nowrap tabular-nums',
                          open && 'shadow-[inset_3px_0_0_var(--color-amber-500)]',
                        )}
                      >
                        <Link
                          to={`/scheduling/visits/${visit.id}/overview`}
                          className="text-ink hover:text-brand-700"
                        >
                          {formatTime(visit.start)}
                          <span className="sr-only">
                            {' '}
                            to {formatTime(visit.end)}, visit for {visit.recipientName}
                          </span>
                        </Link>
                      </th>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-ink font-semibold">{visit.recipientName}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {visit.caregiverId ? (
                          <span className="flex items-center gap-2.5">
                            <Avatar
                              name={visit.caregiverName!}
                              decorative
                              className="size-7 shrink-0 text-xs"
                            />
                            <Link
                              to={`/caregivers/${visit.caregiverId}/schedule`}
                              className="text-ink hover:text-brand-700"
                            >
                              {visit.caregiverName}
                            </Link>
                          </span>
                        ) : (
                          <span className="text-ink-subtle">Unassigned</span>
                        )}
                      </td>
                      <td className="text-ink-muted px-5 py-4 whitespace-nowrap">{visit.type}</td>
                      <td className="px-5 py-4">
                        <RowStatus status={visit.status} />
                      </td>
                      <td className="px-5 py-4">
                        <PriorityDot priority={visit.priority} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <RowAction visit={visit} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-line border-line divide-y border-t xl:hidden">
            {rows.map((visit) => (
              <li
                key={visit.id}
                className={cn(
                  'p-4',
                  !visit.caregiverId && 'bg-red-50/40 shadow-[inset_3px_0_0_var(--color-amber-500)]',
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Link
                    to={`/scheduling/visits/${visit.id}/overview`}
                    className="text-ink hover:text-brand-700 text-sm font-semibold tabular-nums"
                  >
                    {formatTime(visit.start)} – {formatTime(visit.end)}
                    <span className="sr-only"> visit for {visit.recipientName}</span>
                  </Link>
                  <RowStatus status={visit.status} />
                </div>
                <p className="text-ink mt-1 text-sm font-semibold break-words">{visit.recipientName}</p>
                <p className="text-ink-muted mt-0.5 text-sm break-words">
                  {visit.type} · {visit.caregiverName ?? 'Unassigned'}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <PriorityDot priority={visit.priority} />
                  <RowAction visit={visit} />
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`Showing ${start + 1}–${start + rows.length} of ${filtered.length} visits ${when}`}
          />
        </>
      )}
    </section>
  )
}

/* -------------------------------- week view -------------------------------- */

function WeekBoard({ date, today }: { date: string; today: string }) {
  const start = weekStart(date)
  const days = weekDates(start)
  const calendar = useSchedulingCalendar(days[0], days[6])

  const byDay = useMemo(() => {
    const map = new Map<string, BoardRow[]>()
    for (const d of calendar.data ?? []) map.set(d.date, d.visits)
    return map
  }, [calendar.data])

  if (calendar.isPending) return <Spinner label="Loading the week…" />
  if (calendar.isError)
    return <ErrorCard message={calendar.error.message} onRetry={() => void calendar.refetch()} />

  return (
    <Panel title="Week at a glance" flush>
      <div
        tabIndex={0}
        role="region"
        aria-label="Visits by day this week"
        className="border-line hidden overflow-x-auto border-t xl:block"
      >
        <div className="grid min-w-4xl grid-cols-7 divide-x divide-[var(--color-line)]">
          {days.map((day) => (
            <DayColumn
              key={day}
              date={day}
              today={today}
              selected={day === date}
              visits={byDay.get(day) ?? []}
            />
          ))}
        </div>
      </div>

      <ul className="divide-line border-line divide-y border-t xl:hidden">
        {days.map((day) => {
          const visits = byDay.get(day) ?? []
          const unassigned = visits.filter((v) => !v.caregiverId).length
          return (
            <li
              key={day}
              className={cn(
                'p-4',
                day === today && 'bg-brand-50',
                day === date && day !== today && 'border-brand-500 border-l-4 pl-3',
              )}
            >
              <p className="text-ink text-sm font-semibold">
                {formatFullDay(day)}
                {day === today && <span className="text-brand-700 ml-2 text-xs">Today</span>}
                {day === date && day !== today && (
                  <span className="text-brand-700 ml-2 text-xs">Selected</span>
                )}
              </p>
              <p className="text-ink-muted mt-1 text-sm">
                {visits.length === 0
                  ? 'Nothing rostered'
                  : `${visits.length} visit${visits.length === 1 ? '' : 's'}${
                      unassigned > 0 ? `, ${unassigned} unassigned` : ''
                    }`}
              </p>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function DayColumn({
  date,
  today,
  selected,
  visits,
}: {
  date: string
  today: string
  selected: boolean
  visits: BoardRow[]
}) {
  const unassignedCount = visits.filter((v) => !v.caregiverId).length

  return (
    <section
      aria-label={formatFullDay(date)}
      aria-current={selected ? 'date' : undefined}
      className={cn(
        'min-w-0 p-2',
        date === today && 'bg-brand-50/60',
        selected && date !== today && 'ring-brand-300 ring-2 ring-inset',
      )}
    >
      <p className="text-ink-subtle px-1 text-xs font-semibold tracking-wider uppercase">
        {dayOf(date)}
      </p>
      <p className="text-ink px-1 text-sm font-semibold">
        {new Date(`${date}T00:00:00Z`).getUTCDate()}
        {date === today && <span className="text-brand-700 ml-1.5 text-xs">Today</span>}
        {selected && date !== today && <span className="text-brand-700 ml-1.5 text-xs">Selected</span>}
      </p>

      {visits.length === 0 ? (
        <p className="text-ink-subtle bg-sunken mt-2 rounded-lg px-2 py-3 text-center text-xs">
          Nothing on
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {visits.map((visit) => (
            <li
              key={visit.id}
              className={cn(
                'rounded-lg border p-2',
                visit.caregiverId ? 'border-brand-200 bg-brand-50/70' : 'border-red-200 bg-red-50',
              )}
            >
              <Link to={`/scheduling/visits/${visit.id}/overview`} className="hover:text-brand-700 block">
                <span className="text-ink block text-xs font-semibold tabular-nums">
                  {formatTime(visit.start)}
                </span>
                <span className="text-ink mt-0.5 block text-xs font-medium break-words">
                  {visit.recipientName}
                </span>
              </Link>
              <p className="text-ink-muted text-xs break-words">
                {visit.caregiverName ?? 'Unassigned'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {unassignedCount > 0 && (
        <p className="mt-2 px-1 text-xs font-medium text-red-700">{unassignedCount} unassigned</p>
      )}
    </section>
  )
}

/* ----------------------------- unassigned queue ---------------------------- */

function UnassignedQueue({ date, today }: { date: string; today: string }) {
  const unassigned = useUnassignedVisits(date)

  if (unassigned.isPending) return <Spinner label="Loading unassigned visits…" />
  if (unassigned.isError)
    return <ErrorCard message={unassigned.error.message} onRetry={() => void unassigned.refetch()} />

  const visits = unassigned.data

  return (
    <Panel title="Unassigned visits" flush>
      {visits.length === 0 ? (
        <p className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm">
          Every visit on {date === today ? 'today' : formatFullDay(date)} has a caregiver.
        </p>
      ) : (
        <ul className="divide-line border-line divide-y border-t">
          {visits.map((visit) => (
            <li key={visit.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-semibold break-words">{visit.recipientName}</p>
                  <p className="text-ink-muted mt-0.5 text-sm break-words">
                    <Link
                      to={`/scheduling/visits/${visit.id}/overview`}
                      className="hover:text-brand-700"
                    >
                      {formatFullDay(visit.date)} · {formatTime(visit.start)} – {formatTime(visit.end)} ·{' '}
                      {visit.type}
                    </Link>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <PriorityBadge priority={visit.priority} />
                  <Link
                    to={`/scheduling/visits/${visit.id}/assign`}
                    className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-white"
                  >
                    Assign
                    <span className="sr-only">
                      {' '}
                      a caregiver to {visit.recipientName} on {formatFullDay(visit.date)}
                    </span>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* ------------------------------- conflict list ----------------------------- */

function ConflictList({ date }: { date: string }) {
  const conflicts = useSchedulingConflicts(date)

  if (conflicts.isPending) return <Spinner label="Loading conflicts…" />
  if (conflicts.isError)
    return <ErrorCard message={conflicts.error.message} onRetry={() => void conflicts.refetch()} />

  const rows: ConflictView[] = conflicts.data

  return (
    <Panel title="Conflicts and alerts" flush>
      {rows.length === 0 ? (
        <p className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm">
          Nothing flagged on {formatFullDay(date)}.
        </p>
      ) : (
        <ul className="divide-line border-line divide-y border-t">
          {rows.map((conflict) => (
            <li key={conflict.id} className="flex gap-3 p-4">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-red-600"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-ink min-w-0 text-sm font-semibold break-words">
                    {conflict.caregiverName ?? 'A caregiver'} is booked twice
                  </p>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-red-700">
                    Double booking
                  </span>
                </div>
                <p className="text-ink-muted mt-1 text-sm break-words">{conflict.detail}</p>
                {conflict.caregiverId && (
                  <Link
                    to={`/caregivers/${conflict.caregiverId}/schedule`}
                    className="text-brand-700 hover:text-brand-800 mt-1.5 inline-flex min-h-11 items-center text-sm font-medium"
                  >
                    Open the rota
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
