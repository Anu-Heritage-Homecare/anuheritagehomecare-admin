/**
 * The Operations Report — one period of the rota, cut by branch, service type,
 * caregiver and outcome.
 *
 * Same rules as the Reports overview and Monitoring History: a visit is
 * *completed* only when it was written up, durations come from clock-in and
 * clock-out only, and a period never includes today, which is still live.
 */
import { TODAY } from '@/lib/today'
import { addDays, boardOn, formatTime } from '@/features/scheduling/board-data'
import type { BoardVisit } from '@/features/scheduling/board-data'
import { minutesOfDay, staffMembers } from '@/features/caregivers/roster-data'
import { branches } from '@/features/caregivers/staff'
import { clientReviewsFor } from '@/features/caregivers/performance-data'
import { getVisitHistory } from '@/features/care-recipients/visits-data'
import { outcomeLabels } from '@/features/monitoring/history-data'
import type { VisitOutcome } from '@/features/monitoring/history-data'

export { TODAY, branches, outcomeLabels }
export type { VisitOutcome }

/* --------------------------------- period ---------------------------------- */

export type PeriodId = '7' | '30' | '90' | 'this-month' | 'last-month'

export const periodOptions: { value: PeriodId; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
]

export interface Period {
  from: string
  to: string
}

export function periodFor(id: PeriodId, today = TODAY): Period {
  const yesterday = addDays(today, -1)
  if (id === 'this-month') return { from: `${today.slice(0, 7)}-01`, to: yesterday }
  if (id === 'last-month') {
    const firstOfThis = `${today.slice(0, 7)}-01`
    const last = addDays(firstOfThis, -1)
    return { from: `${last.slice(0, 7)}-01`, to: last }
  }
  return { from: addDays(today, -Number(id)), to: yesterday }
}

/** The same number of days immediately before. */
export function previousPeriod(p: Period): Period {
  const n = daysIn(p).length
  return { from: addDays(p.from, -n), to: addDays(p.from, -1) }
}

export function daysIn(p: Period): string[] {
  const out: string[] = []
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) out.push(d)
  return out
}

const rangeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const yearFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const at = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** "Jun 23 - Jul 22, 2026". */
export function formatPeriod(p: Period): string {
  return `${rangeFmt.format(at(p.from))} - ${yearFmt.format(at(p.to))}`
}

export function formatDay(iso: string): string {
  return rangeFmt.format(at(iso))
}

/* --------------------------------- visits ---------------------------------- */

export interface OpsVisit {
  id: string
  date: string
  recipientId: string
  type: string
  caregiverId: string | null
  branch: string | null
  outcome: VisitOutcome
  /** Clock-in to clock-out, minutes; null when either is missing. */
  measured: number | null
  cancelled: boolean
}

function outcomeOf(v: BoardVisit): VisitOutcome {
  if (v.status === 'cancelled') return 'cancelled'
  if (v.caregiverId === null) return 'uncovered'
  if (!v.logged) return 'unrecorded'
  return v.status === 'late-arrival' ? 'late' : 'written-up'
}

const branchOf = new Map(staffMembers.map((m) => [m.id, m.branch]))

function toOps(v: BoardVisit): OpsVisit {
  let measured: number | null = null
  if (v.clockIn && v.clockOut) {
    const m = minutesOfDay(formatTime(v.clockOut)) - minutesOfDay(formatTime(v.clockIn))
    measured = m > 0 ? m : null
  }
  const outcome = outcomeOf(v)
  return {
    id: v.id,
    date: v.date,
    recipientId: v.recipientId,
    type: v.type,
    caregiverId: v.caregiverId,
    branch: v.caregiverId ? (branchOf.get(v.caregiverId) ?? null) : null,
    outcome,
    measured,
    cancelled: outcome === 'cancelled',
  }
}

export interface OpsFilters {
  branch: string
  type: string
  caregiver: string
  status: string
}

export const ALL = 'all'

export function visitsIn(p: Period, f: OpsFilters): OpsVisit[] {
  return daysIn(p)
    .flatMap((d) => boardOn(d).map(toOps))
    .filter(
      (v) =>
        (f.branch === ALL || v.branch === f.branch) &&
        (f.type === ALL || v.type === f.type) &&
        (f.caregiver === ALL || v.caregiverId === f.caregiver) &&
        (f.status === ALL || v.outcome === f.status),
    )
}

/** Every service type on the rota, most frequent first. */
export function serviceTypes(): string[] {
  const counts = new Map<string, number>()
  for (const v of daysIn(periodFor('90')).flatMap((d) => boardOn(d)))
    counts.set(v.type, (counts.get(v.type) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}

export const caregiverOptions = staffMembers
  .filter((m) => m.title !== 'Care Coordinator')
  .map((m) => ({ value: m.id, label: m.name }))

/* --------------------------------- figures --------------------------------- */

const isDone = (v: OpsVisit) => v.outcome === 'written-up' || v.outcome === 'late'

function pct(part: number, whole: number, dp = 1): number | null {
  if (whole === 0) return null
  const f = 10 ** dp
  return Math.round((part / whole) * 100 * f) / f
}

export interface Summary {
  total: number
  completed: number
  cancelled: number
  completion: number | null
  cancellation: number | null
  avgHours: number | null
  measured: number
}

export function summarise(visits: OpsVisit[]): Summary {
  const completed = visits.filter(isDone).length
  const cancelled = visits.filter((v) => v.cancelled).length
  const mins = visits.flatMap((v) => (v.measured === null ? [] : [v.measured]))
  return {
    total: visits.length,
    completed,
    cancelled,
    completion: pct(completed, visits.length),
    cancellation: pct(cancelled, visits.length),
    avgHours:
      mins.length === 0 ? null : Math.round((mins.reduce((a, b) => a + b, 0) / mins.length / 60) * 10) / 10,
    measured: mins.length,
  }
}

export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function daily(p: Period, visits: OpsVisit[]): { date: string; count: number }[] {
  return daysIn(p).map((date) => ({ date, count: visits.filter((v) => v.date === date).length }))
}

/**
 * Seven-day blocks from the start of the period; the last may be shorter.
 * Completion over the visits in each.
 */
export function weekly(p: Period, visits: OpsVisit[]) {
  const days = daysIn(p)
  const weeks: { label: string; from: string; to: string; total: number; completion: number | null }[] = []
  for (let i = 0; i < days.length; i += 7) {
    const from = days[i]
    const to = days[Math.min(i + 6, days.length - 1)]
    const inWeek = visits.filter((v) => v.date >= from && v.date <= to)
    weeks.push({
      label: `W${weeks.length + 1}`,
      from,
      to,
      total: inWeek.length,
      completion: pct(inWeek.filter(isDone).length, inWeek.length, 0),
    })
  }
  return weeks
}

export function topServiceTypes(visits: OpsVisit[], limit = 6) {
  const counts = new Map<string, number>()
  for (const v of visits) counts.set(v.type, (counts.get(v.type) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type, count]) => ({ type, count }))
}

/* ------------------------------ cancellations ------------------------------ */

export const reasonLabels = {
  client: 'Client Request',
  caregiver: 'Caregiver Unavail.',
  weather: 'Weather',
  emergency: 'Emergency',
  other: 'Other',
} as const

export type Reason = keyof typeof reasonLabels

/**
 * Nothing records a reason as a field; the visit log's note is the only place
 * one is written. Read from its wording, and "Other" when it says nothing
 * recognisable — never guessed from anything else.
 */
function reasonOf(note: string): Reason {
  const n = note.toLowerCase()
  if (/family|client|recipient|patient/.test(n)) return 'client'
  if (/caregiver|staff|sick|unavailab/.test(n)) return 'caregiver'
  if (/weather|rain|flood|storm/.test(n)) return 'weather'
  if (/emergency|hospital|ambulance/.test(n)) return 'emergency'
  return 'other'
}

export function cancellationReasons(visits: OpsVisit[]): Record<Reason, number> {
  const out: Record<Reason, number> = { client: 0, caregiver: 0, weather: 0, emergency: 0, other: 0 }
  for (const v of visits) {
    if (!v.cancelled) continue
    const note =
      getVisitHistory(v.recipientId)?.visits.find(
        (r) => r.date === v.date && r.status === 'cancelled' && r.type === v.type,
      )?.notes ?? ''
    out[reasonOf(note)] += 1
  }
  return out
}

/* -------------------------------- locations -------------------------------- */

export interface LocationRow {
  branch: string
  total: number
  completion: number | null
  avgHours: number | null
  satisfaction: number | null
  reviews: number
  /** Completion against the previous period, in points; null with nothing to compare. */
  trend: number | null
}

export function byLocation(p: Period, f: OpsFilters): LocationRow[] {
  const prev = previousPeriod(p)
  const now = visitsIn(p, f)
  const before = visitsIn(prev, f)
  return branches
    .filter((b) => f.branch === ALL || f.branch === b)
    .map((branch) => {
      const s = summarise(now.filter((v) => v.branch === branch))
      const was = summarise(before.filter((v) => v.branch === branch))
      const reviews = staffMembers
        .filter((m) => m.branch === branch && (f.caregiver === ALL || m.id === f.caregiver))
        .flatMap((m) => clientReviewsFor(m))
        .filter((r) => r.at >= p.from && r.at <= p.to)
      return {
        branch,
        total: s.total,
        completion: s.completion,
        avgHours: s.avgHours,
        satisfaction:
          reviews.length === 0
            ? null
            : Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10,
        reviews: reviews.length,
        trend:
          s.completion === null || was.completion === null
            ? null
            : Math.round((s.completion - was.completion) * 10) / 10,
      }
    })
    .sort((a, b) => b.total - a.total)
}
