/**
 * The Workforce Report — caregivers only (coordinators are not rostered on
 * visits), cut by branch, person and employment type over a period.
 *
 * Same vocabulary as the other reports: a visit is attended when its log entry
 * says completed or late, utilisation is rostered hours against stated
 * availability, and nothing is compared against a target, because nothing in
 * the app sets one.
 */
import { boardOn, dayOf } from '@/features/scheduling/board-data'
import {
  complianceFor,
  credentialStates,
  performanceFor,
  staffMembers,
} from '@/features/caregivers/roster-data'
import type { StaffMember } from '@/features/caregivers/roster-data'
import { employmentTypes } from '@/features/caregivers/staff'
import { trainingFor } from '@/features/caregivers/documents-data'
import { clientReviewsFor } from '@/features/caregivers/performance-data'
import { ALL, TODAY, branches, daysIn } from './operations'
import type { Period } from './operations'

export { employmentTypes }

export interface WorkforceFilters {
  branch: string
  caregiver: string
  employment: string
}

export const caregivers = staffMembers.filter((m) => m.title !== 'Care Coordinator')

export function membersFor(f: WorkforceFilters): StaffMember[] {
  return caregivers.filter(
    (m) =>
      (f.branch === ALL || m.branch === f.branch) &&
      (f.caregiver === ALL || m.id === f.caregiver) &&
      (f.employment === ALL || m.employment === f.employment),
  )
}

export { branches }

function pct(part: number, whole: number, dp = 1): number | null {
  if (whole === 0) return null
  const f = 10 ** dp
  return Math.round((part / whole) * 100 * f) / f
}

const avg = (xs: number[], dp = 1) => {
  if (xs.length === 0) return null
  const f = 10 ** dp
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * f) / f
}

/* --------------------------------- visits ---------------------------------- */

interface Tally {
  /** Visits with a log entry, cancelled included. */
  logged: number
  attended: number
  late: number
  cancelled: number
}

function tally(members: StaffMember[], days: string[]): Tally {
  const ids = new Set(members.map((m) => m.id))
  const t: Tally = { logged: 0, attended: 0, late: 0, cancelled: 0 }
  for (const d of days)
    for (const v of boardOn(d)) {
      if (!v.caregiverId || !ids.has(v.caregiverId) || !v.logged) continue
      t.logged += 1
      if (v.status === 'cancelled') t.cancelled += 1
      else {
        t.attended += 1
        if (v.status === 'late-arrival') t.late += 1
      }
    }
  return t
}

/** Rostered ÷ available hours for these people over these days. */
export function utilisation(members: StaffMember[], days: string[]): number | null {
  let rostered = 0
  let available = 0
  const active = members.filter((m) => m.status === 'active')
  for (const day of days) {
    const weekday = dayOf(day)
    const visits = boardOn(day)
    for (const m of active) {
      const w = m.availability.find((a) => a.day === weekday)
      if (w) {
        const [sh, sm] = w.start.split(':').map(Number)
        const [eh, em] = w.end.split(':').map(Number)
        available += (eh * 60 + em - (sh * 60 + sm)) / 60
      }
      rostered += visits
        .filter((v) => v.caregiverId === m.id && v.status !== 'cancelled')
        .reduce((s, v) => s + v.durationHours, 0)
    }
  }
  return pct(rostered, available, 0)
}

export function weeklyUtilisation(members: StaffMember[], p: Period) {
  const days = daysIn(p)
  const weeks: { label: string; from: string; to: string; value: number | null }[] = []
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7)
    weeks.push({
      label: `Week ${weeks.length + 1}`,
      from: slice[0],
      to: slice[slice.length - 1],
      value: utilisation(members, slice),
    })
  }
  return weeks
}

/** Attended ÷ logged per day, only on days that have a record. */
export function attendanceTrend(members: StaffMember[], p: Period) {
  return daysIn(p).flatMap((date) => {
    const t = tally(members, [date])
    return t.logged === 0 ? [] : [{ date, value: pct(t.attended, t.logged) ?? 0 }]
  })
}

/* --------------------------------- summary --------------------------------- */

export function summary(members: StaffMember[], p: Period, today = TODAY) {
  const t = tally(members, daysIn(p))
  const ratings = members.flatMap((m) => {
    const r = performanceFor(m).rating
    return r === null ? [] : [r]
  })
  const courses = members.flatMap((m) => trainingFor(m))
  const active = members.filter((m) => m.status === 'active' && complianceFor(m, today) !== 'expired')
  return {
    headcount: members.length,
    active: active.length,
    utilisation: utilisation(members, daysIn(p)),
    attendance: pct(t.attended, t.logged),
    attended: t.attended,
    logged: t.logged,
    avgRating: avg(ratings),
    rated: ratings.length,
    training: pct(courses.filter((c) => c.completedAt).length, courses.length, 0),
    coursesDone: courses.filter((c) => c.completedAt).length,
    courses: courses.length,
  }
}

/* ------------------------------ distribution ------------------------------- */

export const ratingBands = [
  { id: 'outstanding', label: 'Outstanding', range: '4.5 – 5.0 Rating', min: 4.5, max: 5.01 },
  { id: 'good', label: 'Good', range: '4.0 – 4.4 Rating', min: 4.0, max: 4.5 },
  { id: 'satisfactory', label: 'Satisfactory', range: '3.5 – 3.9 Rating', min: 3.5, max: 4.0 },
  { id: 'improve', label: 'Needs Improvement', range: 'Under 3.5 Rating', min: 0, max: 3.5 },
] as const

export function ratingDistribution(members: StaffMember[]) {
  const rated = members.flatMap((m) => {
    const r = performanceFor(m).rating
    return r === null ? [] : [r]
  })
  return {
    bands: ratingBands.map((b) => {
      const count = rated.filter((r) => r >= b.min && r < b.max).length
      return { ...b, count, share: pct(count, members.length, 0) ?? 0 }
    }),
    unrated: members.length - rated.length,
  }
}

/* -------------------------------- rankings --------------------------------- */

export interface RankingRow {
  member: StaffMember
  rating: number | null
  completed: number
  onTime: number | null
  attendance: number | null
  csat: number | null
  late: number
}

export function rankings(members: StaffMember[], p: Period): RankingRow[] {
  const days = daysIn(p)
  return members
    .map((member) => {
      const t = tally([member], days)
      const reviews = clientReviewsFor(member).filter((r) => r.at >= p.from && r.at <= p.to)
      return {
        member,
        rating: performanceFor(member).rating,
        completed: t.attended,
        onTime: pct(t.attended - t.late, t.attended),
        attendance: pct(t.attended, t.logged),
        csat: avg(reviews.map((r) => r.rating)),
        late: t.late,
      }
    })
    .sort(
      (a, b) =>
        (b.rating ?? -1) - (a.rating ?? -1) ||
        (b.csat ?? -1) - (a.csat ?? -1) ||
        b.completed - a.completed ||
        a.member.name.localeCompare(b.member.name),
    )
}

/* -------------------------------- compliance ------------------------------- */

export function complianceSplit(members: StaffMember[], today = TODAY) {
  const overdue = members.filter((m) => complianceFor(m, today) === 'expired').length
  return {
    compliant: members.length - overdue,
    overdue,
    share: pct(members.length - overdue, members.length, 0),
  }
}

/* The design's three states, by how close the expiry is. */
export type RenewalState = 'action' | 'grace' | 'scheduled'

export const renewalLabels: Record<RenewalState, string> = {
  action: 'Action Required',
  grace: 'Grace Period',
  scheduled: 'Scheduled',
}

const ACTION_WITHIN_DAYS = 14
const GRACE_WITHIN_DAYS = 30

export const RENEWAL_HORIZON_DAYS = 45

/**
 * Credentials lapsed or lapsing within the horizon, soonest first: Action
 * Required up to 14 days out (and once lapsed), Grace Period up to 30,
 * Scheduled beyond that.
 */
export function expiringCredentials(members: StaffMember[], today = TODAY) {
  return members
    .flatMap((m) => {
      return credentialStates(m, today)
        .filter((c) => c.daysRemaining !== null && c.daysRemaining <= RENEWAL_HORIZON_DAYS)
        .map((c) => {
          const days = c.daysRemaining!
          const state: RenewalState =
            days <= ACTION_WITHIN_DAYS ? 'action' : days <= GRACE_WITHIN_DAYS ? 'grace' : 'scheduled'
          return { member: m, name: c.credential.name, expiresAt: c.credential.expiresAt!, days, state }
        })
    })
    .sort((a, b) => a.days - b.days)
}

/* --------------------------------- flags ----------------------------------- */

export interface Flag {
  member: StaffMember
  severity: 'red' | 'amber'
  reason: string
  attendance: number | null
  late: number
}

export const ATTENDANCE_FLOOR = 95
export const RATING_FLOOR = 4.0

/**
 * The exception rules, one line per person — the most serious that applies:
 * a lapsed credential, attendance under 95%, a rating under 4.0, then any late
 * arrival in the period.
 */
export function flagged(members: StaffMember[], p: Period, today = TODAY): Flag[] {
  return rankings(members, p).flatMap<Flag>((r) => {
    const expired = credentialStates(r.member, today).filter((c) => c.state === 'expired')
    const base = { member: r.member, attendance: r.attendance, late: r.late }
    if (expired.length > 0)
      return [{ ...base, severity: 'red' as const, reason: `${expired.map((c) => c.credential.name).join(' and ')} ${expired.length === 1 ? 'has' : 'have'} lapsed — not rostrable for that work` }]
    if (r.attendance !== null && r.attendance < ATTENDANCE_FLOOR)
      return [{ ...base, severity: 'red' as const, reason: `Attendance rate dropped to ${r.attendance}% this period` }]
    const low = r.csat ?? r.rating
    if (low !== null && low < RATING_FLOOR)
      return [{ ...base, severity: 'red' as const, reason: `Care-recipient feedback rating of ${low}` }]
    if (r.late > 0)
      return [{ ...base, severity: 'amber' as const, reason: `${r.late === 1 ? 'A late arrival' : `${r.late} late arrivals`} on the visit log this period` }]
    return []
  })
}
