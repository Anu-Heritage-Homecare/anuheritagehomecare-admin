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
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import {
  TODAY,
  addDays,
  allUnassigned,
  boardOn,
  conflictLabels,
  conflictTones,
  conflictsOn,
  dayOf,
  dayStats,
  formatFullDay,
  formatTime,
  formatWeekRange,
  isUnlogged,
  unassignedReason,
  weekStart,
} from '@/features/scheduling/board-data'
import type { BoardVisit } from '@/features/scheduling/board-data'
import { weekDates } from '@/features/caregivers/schedule-data'
import { Panel } from '@/components/ui/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** A visit that has not happened yet, and so can still change hands. */
function bookable(visit: BoardVisit): boolean {
  return (
    visit.date >= TODAY &&
    visit.status !== 'completed' &&
    visit.status !== 'cancelled'
  )
}

const views = [
  { slug: 'day', label: "Today's Schedule" },
  { slug: 'week', label: 'Calendar' },
  { slug: 'unassigned', label: 'Unassigned Visits' },
  { slug: 'conflicts', label: 'Conflicts & Alerts' },
] as const

type View = (typeof views)[number]['slug']

export function SchedulingPage() {
  const [params, setParams] = useSearchParams()

  const requested = params.get('date')
  const valid = requested && ISO.test(requested) && addDays(requested, 0) === requested
  const date = valid ? requested : TODAY
  const view = (views.find((v) => v.slug === params.get('view'))?.slug ?? 'day') as View

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const visits = useMemo(() => boardOn(date), [date])
  const conflicts = useMemo(() => conflictsOn(date), [date])
  const stats = useMemo(() => dayStats(date), [date])
  const outstanding = useMemo(() => allUnassigned(), [])

  // Hints follow the selected date. "Finished earlier today" under a heading
  // reading Saturday the 25th was two facts contradicting each other.
  const isToday = date === TODAY
  const assigned = stats.total - stats.unassigned
  const allOverlaps =
    conflicts.length > 0 && conflicts.every((c) => c.kind === 'overlap')

  const tiles = [
    {
      id: 'total',
      label: isToday ? "Today's visits" : 'Visits',
      value: stats.total,
      // Only "Assigned" when every visit has a caregiver; otherwise say how many.
      hint:
        stats.unassigned === 0
          ? isToday
            ? 'Assigned today'
            : 'All assigned'
          : `${assigned} assigned`,
    },
    {
      id: 'upcoming',
      label: 'Upcoming visits',
      value: stats.upcoming,
      hint: 'Pending start',
    },
    {
      id: 'available',
      label: 'Available caregivers',
      value: stats.availableCaregivers,
      hint: 'Ready for dispatch',
    },
    {
      id: 'unassigned',
      label: 'Unassigned visits',
      value: stats.unassigned,
      hint: stats.unassigned > 0 ? 'Immediate action needed' : 'All covered',
      view: 'unassigned' as View,
    },
    {
      id: 'conflicts',
      label: 'Schedule conflicts',
      value: stats.conflicts,
      // Conflicts are not all overlaps, so the Figma hint is used only when true.
      hint:
        stats.conflicts === 0
          ? 'Nothing flagged'
          : allOverlaps
            ? 'Overlap detected'
            : 'Needs attention',
      view: 'conflicts' as View,
    },
    {
      id: 'completed',
      label: 'Completed visits',
      value: stats.completed,
      hint: 'Shift reports finalized',
    },
  ]

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
          {/* Assigning needs a visit to assign to, so this goes to the queue
              of visits that need one rather than nowhere. */}
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

      <section aria-label="Schedule totals">
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {tiles.map((t) => {
            // `span`, not `p`: these render inside a button for the two tiles
            // that link onward, and a button takes phrasing content only.
            const body = (
              <>
                <span className="text-ink-subtle block text-xs font-semibold tracking-wider uppercase">
                  {t.label}
                </span>
                <span className="text-ink mt-2 block text-2xl font-bold tracking-tight tabular-nums">
                  {t.value}
                </span>
                <span className="text-ink-subtle mt-1 block text-xs break-words">
                  {t.hint}
                </span>
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

      <div
        role="group"
        aria-label="Choose a view"
        className="no-scrollbar flex gap-3 overflow-x-auto"
      >
        {views.map((v) => {
          const active = v.slug === view
          const count =
            v.slug === 'unassigned'
              ? // Every date, and the tab says so — the tile beside it counts
                // only the selected day, and the two read differently.
                outstanding.length
              : v.slug === 'conflicts'
                ? conflicts.length
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

      {/* Hoisted out of the day view: the week, unassigned and conflict views
          are all date-scoped too, and none of them could move the date. */}
      {view !== 'unassigned' && (
        <DateNav
          date={date}
          step={view === 'week' ? 7 : 1}
          unit={view === 'week' ? 'week' : 'day'}
          onDate={(next) => setParam('date', next === TODAY ? null : next)}
        />
      )}

      {view === 'day' && <DayBoard key={date} date={date} visits={visits} />}
      {view === 'week' && <WeekBoard date={date} />}
      {view === 'unassigned' && <UnassignedQueue visits={outstanding} date={date} />}
      {view === 'conflicts' && <ConflictList conflicts={conflicts} date={date} />}

      <QuickOperations
        onPickVisit={() => {
          // Rescheduling and cancelling start from a visit, so these open the
          // day's table rather than a form with no visit in it.
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
          className={cn(
            'mt-0.5 block text-[0.8125rem]',
            primary ? 'text-white/85' : 'text-ink-muted',
          )}
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
        {/* Same destination as the header's Schedule Visit. */}
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
  step,
  unit,
  onDate,
}: {
  date: string
  step: number
  unit: string
  onDate: (next: string) => void
}) {
  return (
    <nav
      aria-label={`Change ${unit}`}
      className="flex flex-wrap items-center gap-2"
    >
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
          if (date === TODAY) return
          onDate(TODAY)
        }}
        aria-disabled={date === TODAY}
        className={cn(
          'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium',
          date === TODAY
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

type RowState =
  | 'unassigned'
  | 'unlogged'
  | 'completed'
  | 'in-progress'
  | 'upcoming'
  | 'cancelled'

/** One state per row, so the status column and the filter agree. */
function rowState(visit: BoardVisit): RowState {
  if (visit.status === 'cancelled') return 'cancelled'
  if (visit.status === 'completed') return 'completed'
  if (!visit.caregiverId) return 'unassigned'
  if (isUnlogged(visit)) return 'unlogged'
  if (visit.status === 'in-progress') return 'in-progress'
  return 'upcoming'
}

const rowStateLabels: Record<RowState, string> = {
  unassigned: 'Unassigned',
  unlogged: 'Not written up',
  completed: 'Completed',
  'in-progress': 'In Progress',
  upcoming: 'Upcoming',
  cancelled: 'Cancelled',
}

// Local to this board: the Figma draws Completed in the brand tint here,
// where the rest of the app uses green.
const rowStateStyles: Record<RowState, string> = {
  unassigned: 'bg-red-50 text-red-700',
  unlogged: 'bg-sunken text-ink-muted',
  completed: 'bg-brand-50 text-brand-700',
  'in-progress': 'bg-blue-50 text-blue-700',
  upcoming: 'bg-sunken text-ink-muted',
  cancelled: 'bg-sunken text-ink-muted',
}

function RowStatus({ visit }: { visit: BoardVisit }) {
  const state = rowState(visit)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        rowStateStyles[state],
      )}
    >
      {rowStateLabels[state]}
    </span>
  )
}

const priorityDot: Record<BoardVisit['priority'], { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-600' },
  urgent: { dot: 'bg-red-500', text: 'text-red-600' },
  high: { dot: 'bg-amber-500', text: 'text-amber-700' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-700' },
  normal: { dot: 'bg-ink', text: 'text-ink' },
  low: { dot: 'bg-ink-subtle', text: 'text-ink-muted' },
}

function PriorityDot({ priority }: { priority: BoardVisit['priority'] }) {
  const tone = priorityDot[priority]
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm capitalize', tone.text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
      {priority}
    </span>
  )
}

function RowAction({ visit }: { visit: BoardVisit }) {
  const sr = ` for ${visit.recipientName} at ${formatTime(visit.start)}`
  if (!visit.caregiverId && bookable(visit)) {
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
    // Nobody can be booked onto a visit that is over.
    ...(bookable(visit)
      ? [{ id: 'reassign', label: 'Reassign caregiver', to: `/scheduling/visits/${visit.id}/assign` }]
      : []),
    { id: 'recipient', label: 'Open care recipient', to: `/care-recipients/${visit.recipientId}` },
    ...(visit.caregiverId
      ? [{ id: 'caregiver', label: 'Open caregiver schedule', to: `/caregivers/${visit.caregiverId}/schedule` }]
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
  { value: 'unlogged', label: 'Not written up' },
]

function DayBoard({ date, visits }: { date: string; visits: BoardVisit[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [state, setState] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visits.filter(
      (v) =>
        (state === 'all' || rowState(v) === state) &&
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
  const when = date === TODAY ? 'today' : `on ${day}`

  return (
    <section aria-labelledby="day-board-title" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2
          id="day-board-title"
          className="text-ink flex items-center gap-2.5 text-base font-semibold tracking-tight"
        >
          <CalendarDays className="text-brand-600 size-5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          {/* Weekday and month come from the date; the design's "Julyober 24" does not. */}
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
        <p
          role="status"
          className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
        >
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
                  const open = !visit.caregiverId && rowState(visit) === 'unassigned'
                  return (
                    <tr
                      key={visit.id}
                      // Clicking anywhere on the row opens the visit. The time
                      // stays a real link for keyboard and screen-reader users,
                      // and clicks on the row's own links and buttons pass through.
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        // The "..." menu is portalled; its clicks bubble here
                        // through React but are not inside the row's DOM.
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
                        <Link
                          to={`/care-recipients/${visit.recipientId}`}
                          className="text-ink hover:text-brand-700 font-semibold"
                        >
                          {visit.recipientName}
                        </Link>
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
                        <RowStatus visit={visit} />
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
                  rowState(visit) === 'unassigned' &&
                    'bg-red-50/40 shadow-[inset_3px_0_0_var(--color-amber-500)]',
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
                  <RowStatus visit={visit} />
                </div>
                <p className="text-ink mt-1 text-sm font-semibold break-words">
                  {visit.recipientName}
                </p>
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

function WeekBoard({ date }: { date: string }) {
  const start = weekStart(date)
  const days = weekDates(start)
  // Today and the selected day are different facts; marking only the first
  // left the tiles describing a Wednesday while the grid highlighted Friday.

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
            <DayColumn key={day} date={day} selected={day === date} />
          ))}
        </div>
      </div>

      <ul className="divide-line border-line divide-y border-t xl:hidden">
        {days.map((day) => {
          const visits = boardOn(day)
          return (
            <li
              key={day}
              className={cn(
                'p-4',
                day === TODAY && 'bg-brand-50',
                day === date && day !== TODAY && 'border-brand-500 border-l-4 pl-3',
              )}
            >
              <p className="text-ink text-sm font-semibold">
                {formatFullDay(day)}
                {day === TODAY && (
                  <span className="text-brand-700 ml-2 text-xs">Today</span>
                )}
                {day === date && day !== TODAY && (
                  <span className="text-brand-700 ml-2 text-xs">Selected</span>
                )}
              </p>
              <p className="text-ink-muted mt-1 text-sm">
                {visits.length === 0
                  ? 'Nothing rostered'
                  : `${visits.length} visit${visits.length === 1 ? '' : 's'}${
                      visits.some((v) => !v.caregiverId)
                        ? `, ${visits.filter((v) => !v.caregiverId).length} unassigned`
                        : ''
                    }`}
              </p>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function DayColumn({ date, selected }: { date: string; selected: boolean }) {
  const visits = boardOn(date)
  const unassignedCount = visits.filter((v) => !v.caregiverId).length

  return (
    <section
      aria-label={formatFullDay(date)}
      aria-current={selected ? 'date' : undefined}
      className={cn(
        'min-w-0 p-2',
        date === TODAY && 'bg-brand-50/60',
        selected && date !== TODAY && 'ring-brand-300 ring-2 ring-inset',
      )}
    >
      <p className="text-ink-subtle px-1 text-xs font-semibold tracking-wider uppercase">
        {dayOf(date)}
      </p>
      <p className="text-ink px-1 text-sm font-semibold">
        {new Date(`${date}T00:00:00Z`).getUTCDate()}
        {date === TODAY && (
          <span className="text-brand-700 ml-1.5 text-xs">Today</span>
        )}
        {selected && date !== TODAY && (
          <span className="text-brand-700 ml-1.5 text-xs">Selected</span>
        )}
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
                visit.caregiverId
                  ? 'border-brand-200 bg-brand-50/70'
                  : 'border-red-200 bg-red-50',
              )}
            >
              <Link
                to={`/scheduling/visits/${visit.id}/overview`}
                className="hover:text-brand-700 block"
              >
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
        <p className="mt-2 px-1 text-xs font-medium text-red-700">
          {unassignedCount} unassigned
        </p>
      )}
    </section>
  )
}

/* ----------------------------- unassigned queue ---------------------------- */

function UnassignedQueue({
  visits,
  date,
}: {
  visits: BoardVisit[]
  date: string
}) {
  return (
    <Panel title="Unassigned visits" flush>
      {visits.length === 0 ? (
        <p className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm">
          Every visit on the board has a caregiver.
        </p>
      ) : (
        <ul className="divide-line border-line divide-y border-t">
          {visits.map((visit) => (
            <li key={visit.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-semibold break-words">
                    <Link
                      to={`/care-recipients/${visit.recipientId}`}
                      className="hover:text-brand-700"
                    >
                      {visit.recipientName}
                    </Link>
                  </p>
                  <p className="text-ink-muted mt-0.5 text-sm break-words">
                    <Link
                      to={`/scheduling/visits/${visit.id}/overview`}
                      className="hover:text-brand-700"
                    >
                      {formatFullDay(visit.date)} · {formatTime(visit.start)} –{' '}
                      {formatTime(visit.end)} · {visit.type}
                    </Link>
                  </p>
                  {/* Why it is unassigned, not just that it is — three of these
                      are clients with no caregiver in the directory at all. */}
                  <p className="text-ink-subtle mt-0.5 text-xs break-words">
                    {unassignedReason(visit.id)}
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
                      a caregiver to {visit.recipientName} on{' '}
                      {formatFullDay(visit.date)}
                    </span>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-ink-subtle border-line border-t px-4 py-3 text-xs">
        Every date with an unassigned visit, not just{' '}
        {formatFullDay(date)}.
      </p>
    </Panel>
  )
}

/**
 * An assigned past visit with no record is not the same as one with nobody on
 * it. Both carried status "unassigned", so the board showed a red Unassigned
 * badge next to a caregiver's name.
 */

/* ------------------------------- conflict list ----------------------------- */

function ConflictList({
  conflicts,
  date,
}: {
  conflicts: ReturnType<typeof conflictsOn>
  date: string
}) {
  return (
    <Panel title="Conflicts and alerts" flush>
      {conflicts.length === 0 ? (
        <p className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm">
          Nothing flagged on {formatFullDay(date)}.
        </p>
      ) : (
        <ul className="divide-line border-line divide-y border-t">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="flex gap-3 p-4">
              <TriangleAlert
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  conflictTones[conflict.kind] === 'red'
                    ? 'text-red-600'
                    : 'text-amber-600',
                )}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-ink min-w-0 text-sm font-semibold break-words">
                    {conflict.label}
                  </p>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                      tonePill[conflictTones[conflict.kind]],
                    )}
                  >
                    {conflictLabels[conflict.kind]}
                  </span>
                </div>
                <p className="text-ink-muted mt-1 text-sm break-words">
                  {conflict.detail}
                </p>
                {conflict.caregiverId &&
                  (() => {
                    // Land on the tab that holds the fix. A lapsed credential
                    // is resolved on Documents; sending every conflict to the
                    // rota meant the one link offered was the wrong one.
                    const documents = conflict.kind === 'lapsed-credential'
                    return (
                      <Link
                        to={`/caregivers/${conflict.caregiverId}/${documents ? 'documents' : 'schedule'}`}
                        className="text-brand-700 hover:text-brand-800 mt-1.5 inline-flex min-h-11 items-center text-sm font-medium"
                      >
                        {documents ? 'Open their credentials' : 'Open the rota'}
                        <span className="sr-only"> for {conflict.label}</span>
                      </Link>
                    )
                  })()}
                {conflict.recipientId && (
                  <Link
                    to={`/care-recipients/${conflict.recipientId}`}
                    className="text-brand-700 hover:text-brand-800 mt-1.5 inline-flex min-h-11 items-center text-sm font-medium"
                  >
                    Open the care record
                    <span className="sr-only"> for {conflict.label}</span>
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
