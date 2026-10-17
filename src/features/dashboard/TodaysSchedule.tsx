import { useMemo, useState } from 'react'
import { MoreHorizontal, Search } from 'lucide-react'
import { visits } from './data'
import type { VisitStatus } from '@/types'
import {
  PriorityLabel,
  VisitStatusBadge,
} from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

type Filter = 'all' | 'in-progress' | 'upcoming' | 'completed'

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
]

/** 'Starting Soon' and 'Unassigned' are still upcoming work. */
const matchesFilter: Record<Filter, (s: VisitStatus) => boolean> = {
  all: () => true,
  'in-progress': (s) => s === 'in-progress',
  upcoming: (s) => s === 'upcoming' || s === 'starting-soon' || s === 'unassigned',
  completed: (s) => s === 'completed',
}

export function TodaysSchedule() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visits.filter((v) => {
      if (!matchesFilter[filter](v.status)) return false
      if (!q) return true
      return [v.recipient, v.caregiver ?? '', v.type, v.time]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [filter, query])

  return (
    <section aria-labelledby="todays-schedule">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2
          id="todays-schedule"
          className="text-ink text-base font-semibold tracking-tight"
        >
          Today's Schedule
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Pills scroll horizontally rather than wrapping on narrow screens */}
          <div
            role="group"
            aria-label="Filter visits by status"
            className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
          >
            {filters.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  // Every pill is outlined, as the design draws them: white
                  // when idle, tinted when chosen.
                  'border-line min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors lg:min-h-9',
                  filter === id
                    ? 'bg-brand-50 text-brand-700'
                    : 'bg-surface text-ink-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-56">
            <Search
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search visits"
              placeholder="Search visits..."
              className="border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 h-11 w-full rounded-lg border pr-3 pl-9 text-sm lg:h-9"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* Desktop: real table. Scrolls rather than clipping when 7 columns
            don't fit the content well — the card keeps the rounded corners. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-line bg-sunken text-ink-muted border-b text-xs">
              <tr>
                <th scope="col" className="px-3 py-3 font-medium lg:px-4">Time</th>
                <th scope="col" className="px-3 py-3 font-medium lg:px-4">Care Recipient</th>
                <th scope="col" className="px-3 py-3 font-medium lg:px-4">Assigned Caregiver</th>
                <th scope="col" className="px-3 py-3 font-medium lg:px-4">Visit Type</th>
                <th scope="col" className="px-3 py-3 font-medium lg:px-4">Status</th>
                <th scope="col" className="px-3 py-3 font-medium lg:px-4">Priority</th>
                <th scope="col" className="px-3 py-3 text-right font-medium lg:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {rows.map((v) => (
                <tr key={v.id} className="hover:bg-canvas transition-colors">
                  <td className="text-ink-muted px-3 py-3.5 lg:px-4 whitespace-nowrap">
                    {v.time}
                  </td>
                  <td className="text-ink px-3 py-3.5 lg:px-4 font-semibold">
                    {v.recipient}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3.5 lg:px-4',
                      v.caregiver ? 'text-ink-muted' : 'text-ink-subtle',
                    )}
                  >
                    {v.caregiver ?? '—'}
                  </td>
                  <td className="text-ink-muted px-3 py-3.5 lg:px-4">{v.type}</td>
                  <td className="px-3 py-3.5 lg:px-4">
                    <VisitStatusBadge status={v.status} />
                  </td>
                  <td className="px-3 py-3.5 lg:px-4">
                    <PriorityLabel priority={v.priority} />
                  </td>
                  <td className="px-3 py-3.5 lg:px-4 text-right">
                    <button
                      type="button"
                      aria-label={`Actions for ${v.recipient}`}
                      className="text-ink-subtle hover:bg-sunken hover:text-ink grid size-9 place-items-center rounded-lg"
                    >
                      <MoreHorizontal className="size-4.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards — a 7-column table is unusable under 768px */}
        <ul className="divide-line divide-y md:hidden">
          {rows.map((v) => (
            <li key={v.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink truncate font-semibold">{v.recipient}</p>
                  <p className="text-ink-subtle mt-0.5 text-sm">
                    {v.time} · {v.type}
                  </p>
                </div>
                <VisitStatusBadge status={v.status} />
              </div>

              <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <dt className="text-ink-subtle">Caregiver:</dt>
                  <dd
                    className={cn(
                      v.caregiver ? 'text-ink-muted' : 'text-ink-subtle',
                    )}
                  >
                    {v.caregiver ?? 'Unassigned'}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-ink-subtle">Priority:</dt>
                  <dd>
                    <PriorityLabel priority={v.priority} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        {rows.length === 0 && (
          <p className="text-ink-subtle px-4 py-12 text-center text-sm">
            No visits match this filter.
          </p>
        )}
      </div>
    </section>
  )
}
