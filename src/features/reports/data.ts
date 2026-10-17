/**
 * The organisation-wide Reports screen. Nothing here is stored: every figure
 * is recomputed from the rota, the visit write-ups, the roster, family reviews
 * and the receivables ledger — the same records the screens that own them
 * read — so a number on this page can always be traced back to one of those.
 *
 * Two words are used narrowly on purpose, matching Monitoring History:
 * - a visit is *completed* only when it was written up. Most rota slots on a
 *   past day have no record, and counting those would assert attendance the
 *   app cannot evidence;
 * - *utilisation* is rostered hours against the hours caregivers said they are
 *   available, not hours clocked.
 */
import { TODAY } from '@/lib/today'
import { addDays, boardOn, dayOf, formatTime } from '@/features/scheduling/board-data'
import type { BoardVisit } from '@/features/scheduling/board-data'
import {
  complianceFor,
  minutesOfDay,
  performanceFor,
  staffMembers,
} from '@/features/caregivers/roster-data'
import type { StaffMember } from '@/features/caregivers/roster-data'
import { trainingFor } from '@/features/caregivers/documents-data'
import { clientReviewsFor } from '@/features/caregivers/performance-data'
import { monthlyRevenue, revenueMonths } from '@/features/billing/data'
import { collectionRate, isCancelled, isDraft, ledger } from '@/features/billing/ledger'
import { billedIn, outstandingFor } from '@/features/billing/reports'

export { TODAY }

/* ---------------------------------- range ---------------------------------- */

export type ReportRange = '7' | '30' | '90'

export const reportRanges: { value: ReportRange; label: string }[] = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
]

export type ReportTab = 'overview' | 'operations' | 'workforce' | 'financial'

export const reportTabs: { value: ReportTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'operations', label: 'Operations' },
  { value: 'workforce', label: 'Workforce' },
  { value: 'financial', label: 'Financial' },
]

/**
 * Finished days only, oldest first: `days` days ending yesterday. Today is
 * still live and belongs to the monitoring board.
 */
function closedDays(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

function rangeDays(range: ReportRange, today = TODAY): string[] {
  return closedDays(addDays(today, -Number(range)), addDays(today, -1))
}

/* ---------------------------------- visits --------------------------------- */

const isCaregiver = (m: StaffMember) => m.title !== 'Care Coordinator'
const caregivers = staffMembers.filter(isCaregiver)

function visitsOn(days: string[]): BoardVisit[] {
  return days.flatMap((d) => boardOn(d))
}

const writtenUp = (v: BoardVisit) =>
  v.status !== 'cancelled' && v.caregiverId !== null && v.logged

/** Minutes between clock-in and clock-out, where the record has both. */
function measuredMinutes(v: BoardVisit): number | null {
  if (!v.clockIn || !v.clockOut) return null
  const m = minutesOfDay(formatTime(v.clockOut)) - minutesOfDay(formatTime(v.clockIn))
  return m > 0 ? m : null
}

function pct(part: number, whole: number, dp = 0): number | null {
  if (whole === 0) return null
  const f = 10 ** dp
  return Math.round((part / whole) * 100 * f) / f
}

export interface VisitFigures {
  /** Rota slots in the window that were not cancelled. */
  scheduled: number
  cancelled: number
  writtenUp: number
  late: number
  /** Written up ÷ scheduled. */
  completion: number | null
  /** Of written-up visits, the share that did not arrive late. */
  onTime: number | null
  /** Cancelled ÷ everything on the rota, cancelled included. */
  cancellation: number | null
  /** Hours, from clock-in/out only; null when nothing was measured. */
  avgHours: number | null
  measured: number
}

export function visitFigures(days: string[]): VisitFigures {
  const all = visitsOn(days)
  const cancelled = all.filter((v) => v.status === 'cancelled').length
  const live = all.filter((v) => v.status !== 'cancelled')
  const done = live.filter(writtenUp)
  const late = done.filter((v) => v.status === 'late-arrival').length
  const minutes = done.map(measuredMinutes).filter((m): m is number => m !== null)
  return {
    scheduled: live.length,
    cancelled,
    writtenUp: done.length,
    late,
    completion: pct(done.length, live.length, 1),
    onTime: pct(done.length - late, done.length),
    cancellation: pct(cancelled, all.length, 1),
    avgHours:
      minutes.length === 0
        ? null
        : Math.round((minutes.reduce((a, b) => a + b, 0) / minutes.length / 60) * 10) / 10,
    measured: minutes.length,
  }
}

/**
 * Rostered caregiver hours ÷ the hours those caregivers are available, over
 * the days given. Coordinators are left out — they are not rostered on visits
 * — and so is anyone on leave, who has no availability to fill.
 */
export function utilisation(days: string[]): number | null {
  let rostered = 0
  let available = 0
  for (const day of days) {
    const weekday = dayOf(day)
    const visits = boardOn(day)
    for (const m of caregivers) {
      if (m.status !== 'active') continue
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
  return pct(rostered, available)
}

/* ---------------------------------- months --------------------------------- */

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

export interface MonthPoint {
  /** "2026-07". */
  id: string
  label: string
  /** True for the month TODAY falls in, which is counted to yesterday. */
  partial: boolean
  completion: number | null
  utilisation: number | null
  visits: number
}

/** The last `count` calendar months, oldest first, closed days only. */
export function monthlyTrend(count = 6, today = TODAY): MonthPoint[] {
  const first = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(first)
    start.setUTCMonth(first.getUTCMonth() - (count - 1 - i))
    const end = new Date(start)
    end.setUTCMonth(start.getUTCMonth() + 1)
    end.setUTCDate(0)
    const from = start.toISOString().slice(0, 10)
    const last = end.toISOString().slice(0, 10)
    const yesterday = addDays(today, -1)
    const days = closedDays(from, last < yesterday ? last : yesterday)
    const f = visitFigures(days)
    return {
      id: from.slice(0, 7),
      label: monthShort.format(start),
      partial: last >= today,
      completion: f.completion,
      utilisation: utilisation(days),
      visits: f.scheduled,
    }
  })
}

/** Closed days of the current month: the 1st to yesterday. */
export function monthToDate(today = TODAY): string[] {
  const from = `${today.slice(0, 7)}-01`
  const yesterday = addDays(today, -1)
  return yesterday < from ? [] : closedDays(from, yesterday)
}

/** Scheduled visits per closed day of the month, for the header sparkline. */
export function dailyVisits(days: string[]): number[] {
  return days.map((d) => boardOn(d).filter((v) => v.status !== 'cancelled').length)
}

/* ------------------------------- satisfaction ------------------------------ */

/** Family reviews only; a colleague's review is not client satisfaction. */
function familyReviews() {
  const seen = new Set<string>()
  return staffMembers
    .flatMap((m) => clientReviewsFor(m))
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}

export interface Satisfaction {
  count: number
  average: number | null
  /** 5 → 1 stars. */
  breakdown: { stars: 1 | 2 | 3 | 4 | 5; label: string; count: number; share: number }[]
}

const starLabels = {
  5: 'Excellent (5 stars)',
  4: 'Good (4 stars)',
  3: 'Average (3 stars)',
  2: 'Below Average (2 stars)',
  1: 'Poor (1 star)',
} as const

export function satisfaction(range: ReportRange, today = TODAY): Satisfaction {
  const from = addDays(today, -Number(range))
  const reviews = familyReviews().filter((r) => r.at >= from && r.at <= today)
  const total = reviews.reduce((s, r) => s + r.rating, 0)
  return {
    count: reviews.length,
    average: reviews.length === 0 ? null : Math.round((total / reviews.length) * 10) / 10,
    breakdown: ([5, 4, 3, 2, 1] as const).map((stars) => {
      const count = reviews.filter((r) => r.rating === stars).length
      return {
        stars,
        label: starLabels[stars],
        count,
        share: pct(count, reviews.length) ?? 0,
      }
    }),
  }
}

/* --------------------------------- workforce ------------------------------- */

export interface Workforce {
  /** Employed, not on leave, and with no lapsed credential. */
  active: number
  total: number
  avgRating: number | null
  /** Courses finished ÷ courses assigned. */
  training: number | null
  /** Attended ÷ logged, across every caregiver's visit log. */
  attendance: number | null
}

export function workforce(today = TODAY): Workforce {
  const perf = caregivers.map(performanceFor)
  const ratings = perf.flatMap((p) => (p.rating === null ? [] : [p.rating]))
  const courses = caregivers.flatMap((m) => trainingFor(m))
  const logged = perf.reduce((s, p) => s + p.logged, 0)
  const attended = perf.reduce((s, p) => s + p.completed + p.late, 0)
  return {
    active: caregivers.filter(
      (m) => m.status === 'active' && complianceFor(m, today) !== 'expired',
    ).length,
    total: caregivers.length,
    avgRating:
      ratings.length === 0
        ? null
        : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
    training: pct(courses.filter((c) => c.completedAt).length, courses.length),
    attendance: pct(attended, logged),
  }
}

/* --------------------------------- financial ------------------------------- */

export function revenueIn(range: ReportRange, today = TODAY): number {
  return billedIn({ from: addDays(today, -(Number(range) - 1)), to: today }, 'all')
}

export function revenueOverview(today = TODAY) {
  const months = revenueMonths(6, today)
  const year = today.slice(0, 4)
  const ytd = revenueMonths(12, today)
    .filter((m) => m.label.endsWith(year))
    .reduce((s, m) => s + m.value, 0)
  return { months, ytd }
}

export function financialSummary(today = TODAY) {
  const invoices = ledger.filter(
    (i) => i.kind === 'invoice' && !isDraft(i) && !isCancelled(i, today) && i.issuedAt <= today,
  )
  return {
    monthlyRevenue: monthlyRevenue(),
    collectionRate: collectionRate(today),
    avgInvoice:
      invoices.length === 0
        ? null
        : Math.round(invoices.reduce((s, i) => s + i.amount, 0) / invoices.length),
    outstanding: outstandingFor('all', today).amount,
  }
}

/* ------------------------------ report activity ---------------------------- */

export interface ReportRecord {
  id: string
  name: string
  /** Which tab it belongs to, so a filtered tab lists only its own. */
  category: Exclude<ReportTab, 'overview'>
  /** ISO. */
  generatedAt: string
  by: string
  /** The report's screen, where one is built. */
  to?: string
}

/*
 * Metadata only — no file is stored. A row opens only where its report has a
 * screen (the Operations, Workforce and Financial Reports). Dated before
 * the sample clock and named for periods that had closed by then.
 */
export const reportActivity: ReportRecord[] = [
  { id: 'rp-5', name: 'Monthly Operations Report', category: 'operations', generatedAt: '2026-07-15', by: 'Admin', to: '/reports/operations' },
  { id: 'rp-4', name: 'Caregiver Performance Q2', category: 'workforce', generatedAt: '2026-07-10', by: 'HR Manager', to: '/reports/workforce' },
  { id: 'rp-3', name: 'Financial Summary Jun 2026', category: 'financial', generatedAt: '2026-07-02', by: 'Finance', to: '/reports/financial' },
  { id: 'rp-2', name: 'Client Satisfaction Survey', category: 'operations', generatedAt: '2026-06-28', by: 'Quality Team' },
  { id: 'rp-1', name: 'Workforce Compliance Audit', category: 'workforce', generatedAt: '2026-06-25', by: 'Admin', to: '/reports/workforce' },
]

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(`${iso}T00:00:00Z`))
}

export { rangeDays }
