import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { History, Loader2, Search } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import { useRecipientActivity } from '../useRecipientActivity'
import {
  ACTIVITY_PAGE_SIZE,
  actors,
  activityTypeLabels,
  activityTypeTones,
  activityTypes,
  formatDayHeading,
  formatTime,
  groupByDay,
  orderOptions,
  rangeOptions,
  sortActivity,
  withinRange,
  type ActivityOrder,
  type ActivityType,
} from '../activity-data'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { toneDot, tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

type TypeFilter = ActivityType | 'all'

export function ActivityTab() {
  const profile = useOutletContext<RecipientProfile>()
  const { data, isPending, isError, error, refetch } = useRecipientActivity(profile.id)
  const all = useMemo(() => data ?? [], [data])

  const [type, setType] = useState<TypeFilter>('all')
  // Defaults to the full read window: the range filter measures from the
  // fixture "today", so a 7 day default would hide live dated entries.
  const [range, setRange] = useState('all')
  const [user, setUser] = useState('all')
  const [order, setOrder] = useState<ActivityOrder>('newest')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(ACTIVITY_PAGE_SIZE)

  const userOptions = useMemo(
    () => [
      { value: 'all', label: 'All Users' },
      ...actors(all).map((a) => ({ value: a, label: a })),
    ],
    [all],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const days = range === 'all' ? ('all' as const) : Number(range)
    const filtered = all.filter((e) => {
      if (type !== 'all' && e.type !== type) return false
      if (!withinRange(e, days)) return false
      if (user !== 'all' && e.actor !== user) return false
      if (!q) return true
      return [e.title, e.detail, e.actor].join(' ').toLowerCase().includes(q)
    })
    return sortActivity(filtered, order)
  }, [all, type, range, user, order, query])

  const shown = rows.slice(0, visible)
  const remaining = rows.length - shown.length
  const days = groupByDay(shown)

  /** Any filter change restarts the reveal count. */
  const reset =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      setter(value)
      setVisible(ACTIVITY_PAGE_SIZE)
    }

  if (isPending) {
    return (
      <div className="card text-ink-subtle flex items-center justify-center gap-2 px-6 py-20 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading activity…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h2 className="text-ink text-sm font-semibold">Could not load activity</h2>
        <p className="text-ink-muted mt-1 text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (all.length === 0) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <History className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">No activity yet</h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          Nothing has been recorded for {profile.name}. Visits, medications,
          documents and billing all appear here as they happen.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3">
          <SelectFilter
            label="Type"
            value={type}
            onChange={(v) => reset(setType)(v as TypeFilter)}
            options={[
              { value: 'all', label: 'All Activities' },
              ...activityTypes.map((t) => ({
                value: t.value,
                label: t.label,
              })),
            ]}
          />
          <SelectFilter
            label="Range"
            value={range}
            onChange={reset(setRange)}
            options={rangeOptions}
          />
          <SelectFilter
            label="User"
            value={user}
            onChange={reset(setUser)}
            options={userOptions}
          />
        </div>

        <div className="relative 2xl:w-64">
          <Search
            aria-hidden="true"
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            aria-label="Search timeline events"
            placeholder="Search timeline events..."
            className="border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
          />
        </div>
      </div>

      <section aria-labelledby="audit-trail" className="card overflow-hidden">
        <div className="border-line flex flex-wrap items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h2
              id="audit-trail"
              className="text-ink text-base font-semibold tracking-tight"
            >
              System Audit Trail
            </h2>
            <p className="text-ink-muted mt-1 text-sm">
              Assembled from every other tab — visits, medications, health
              events, documents, billing and care plan changes.
            </p>
          </div>

          <SelectFilter
            label="Order"
            value={order}
            onChange={(v) => reset(setOrder)(v as ActivityOrder)}
            options={orderOptions}
            className="w-48 shrink-0"
          />
        </div>

        {/* Filtering otherwise changes the result set silently */}
        <p
          aria-live="polite"
          className="text-ink-muted border-line border-b px-4 py-2 text-sm"
        >
          {rows.length === 0
            ? 'No activity matches these filters'
            : `Showing ${shown.length} of ${rows.length} events`}
        </p>

        {rows.length === 0 ? (
          <p className="text-ink-subtle px-4 py-16 text-center text-sm">
            No activity matches these filters.
          </p>
        ) : (
          <div className="p-4">
            {days.map((day) => (
              <div key={day.date}>
                <h3 className="text-ink-subtle border-line mt-6 border-b pb-2 text-xs font-semibold tracking-wider uppercase first:mt-0">
                  {formatDayHeading(day.date)}
                </h3>

                <ol className="mt-3">
                  {day.entries.map((e, i) => {
                    const last = i === day.entries.length - 1
                    return (
                      <li key={e.id} className="flex gap-3 sm:gap-4">
                        <span className="text-ink-muted hidden w-20 shrink-0 pt-0.5 text-right text-xs tabular-nums sm:block">
                          {e.time ? (
                            <time dateTime={`${e.date}T${e.time}`}>
                              {formatTime(e.time)}
                            </time>
                          ) : (
                            <span className="text-ink-subtle">All day</span>
                          )}
                        </span>

                        <span
                          aria-hidden="true"
                          className="relative flex w-2 shrink-0 flex-col items-center"
                        >
                          <span
                            className={cn(
                              'mt-1 size-2.5 shrink-0 rounded-full ring-surface ring-4',
                              toneDot[activityTypeTones[e.type]],
                            )}
                          />
                          {!last && <span className="bg-line -mb-4 w-px flex-1" />}
                        </span>

                        <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-5')}>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h4 className="text-ink min-w-0 text-sm font-semibold break-words">
                              {e.title}
                            </h4>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                                tonePill[activityTypeTones[e.type]],
                              )}
                            >
                              {activityTypeLabels[e.type]}
                            </span>
                            {/* Which tab it came from — a fall produces a
                                health event, a note and a document, and
                                without this they read as three incidents. */}
                            <span className="border-line text-ink-subtle inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.65rem]">
                              {e.source}
                            </span>
                            {/* Time repeats inline below sm, where the rail
                                column is hidden */}
                            <span className="text-ink-subtle text-xs sm:hidden">
                              {e.time ? formatTime(e.time) : 'All day'}
                            </span>
                          </div>

                          <p className="text-ink-muted mt-1 text-sm break-words">
                            {e.detail}
                          </p>
                          <p className="text-ink-subtle mt-1 text-xs break-words">
                            Performed by{' '}
                            <span className="text-ink-muted font-medium">
                              {e.actor} ({e.actorRole})
                            </span>
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* aria-disabled, not disabled: a focused button that becomes `disabled`
            is pulled out of the focus order and the browser resets focus to
            <body>, so the final click would strand a keyboard user. */}
        {rows.length > ACTIVITY_PAGE_SIZE && (
          <div className="border-line border-t p-3 text-center">
            <button
              type="button"
              onClick={() =>
                remaining > 0 && setVisible((v) => v + ACTIVITY_PAGE_SIZE)
              }
              aria-disabled={remaining === 0}
              className="border-line text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium transition-colors aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
            >
              {remaining === 0
                ? 'All activity shown'
                : 'Load More Activity History'}
              {remaining > 0 && (
                <span className="text-ink-subtle ml-1.5">({remaining})</span>
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
