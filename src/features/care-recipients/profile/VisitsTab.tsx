import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarOff } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import {
  VISITS_PAGE_SIZE,
  formatVisitDate,
  getVisitHistory,
  type VisitRecord,
} from '../visits-data'
import { VisitStats } from './VisitStats'
import { VisitFilters } from './VisitFilters'
import { initialFilters } from './visit-filter-state'
import type { VisitFilterState } from './visit-filter-state'
import { VisitTable } from './VisitTable'
import { VisitAnalytics } from './VisitAnalytics'
import { Pagination } from '@/components/ui/Pagination'
import type { VisitStatus } from '@/types'

const statusOptions: { value: VisitStatus; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'late-arrival', label: 'Late Arrival' },
  { value: 'cancelled', label: 'Cancelled' },
]

/**
 * "Today" for the sample data is 2026-07-24 — the same day the Medications tab
 * schedules against. Ranges measure back from there, not the wall clock.
 */
const RANGE_ANCHOR = new Date('2026-07-24T00:00:00Z').getTime()
const DAY_MS = 86_400_000

function withinRange(visit: VisitRecord, range: string): boolean {
  if (range === 'all') return true
  const days = Number(range)
  if (!Number.isFinite(days)) return true
  const visitTime = new Date(`${visit.date}T00:00:00Z`).getTime()
  return RANGE_ANCHOR - visitTime <= days * DAY_MS
}

export function VisitsTab() {
  const profile = useOutletContext<RecipientProfile>()
  const history = getVisitHistory(profile.id)

  const [filters, setFilters] = useState<VisitFilterState>(initialFilters)
  const [page, setPage] = useState(1)

  const visits = useMemo(() => history?.visits ?? [], [history])

  const caregivers = useMemo(
    () => [...new Set(visits.map((v) => v.caregiver))].sort(),
    [visits],
  )
  const types = useMemo(
    () => [...new Set(visits.map((v) => v.type))].sort(),
    [visits],
  )

  const rows = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return visits.filter((v) => {
      if (!withinRange(v, filters.range)) return false
      if (filters.caregiver !== 'all' && v.caregiver !== filters.caregiver)
        return false
      if (filters.type !== 'all' && v.type !== filters.type) return false
      if (filters.status !== 'all' && v.status !== filters.status) return false
      if (!q) return true
      // Includes the date as displayed ("July 24, 2026") — searching the raw
      // ISO value alone would miss a row the user can plainly read.
      return [v.caregiver, v.type, v.notes, formatVisitDate(v)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [visits, filters])

  if (!history) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <CalendarOff className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">
          No visit history
        </h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no recorded visits yet. Completed visits appear
          here once caregivers start checking in.
        </p>
      </div>
    )
  }

  /*
   * Paging is driven by the rows in hand. `totalVisits` (156) only supplies the
   * "of N" framing when nothing is filtered, so the summary can never claim a
   * range the table isn't showing.
   */
  // Compared against the defaults, not against 'all' — the default 30-day
  // window is the view the stat cards describe, so it keeps the 156 framing.
  const filtering =
    filters.range !== initialFilters.range ||
    filters.caregiver !== initialFilters.caregiver ||
    filters.type !== initialFilters.type ||
    filters.status !== initialFilters.status ||
    filters.query.trim() !== ''

  const pageCount = Math.max(1, Math.ceil(rows.length / VISITS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice(
    (safePage - 1) * VISITS_PAGE_SIZE,
    safePage * VISITS_PAGE_SIZE,
  )

  const total = filtering ? rows.length : history.totalVisits
  const from = rows.length === 0 ? 0 : (safePage - 1) * VISITS_PAGE_SIZE + 1
  const to = (safePage - 1) * VISITS_PAGE_SIZE + pageRows.length

  const onFiltersChange = (next: VisitFilterState) => {
    setFilters(next)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <VisitStats stats={history.stats} />

      <VisitFilters
        filters={filters}
        onChange={onFiltersChange}
        caregivers={caregivers}
        types={types}
        statuses={statusOptions}
      />

      <section aria-label="Visit history" className="card overflow-hidden">
        <VisitTable rows={pageRows} recipientId={profile.id} />
        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          summary={
            rows.length === 0
              ? 'No visits to show'
              : `Showing ${from}-${to} of ${total} visits`
          }
        />
      </section>

      <VisitAnalytics history={history} />
    </div>
  )
}
