/**
 * The Operations Report drill down, fetched from the backend and mapped into the
 * shapes the page renders (`GET /admin/reports/operations`). One request powers
 * the whole screen for a reporting period. Figures the backend leaves null read
 * as an em dash, never faked.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PeriodId } from './operations'
import { periodFor } from './operations'
import type { TileTone, Trend } from './operations-report'

/* --------------------------- backend response ----------------------------- */

interface VisitPerformanceDto {
  totalVisits: number
  totalVisitsDeltaPercent: number | null
  completed: number
  completedPercent: number | null
  cancelled: number
  cancelledPercent: number | null
  avgVisitDurationMinutes: number | null
}

interface DailyTrendPointDto {
  date: string
  visits: number
}

interface WeeklyCompletionDto {
  label: string
  completionPercent: number | null
}

interface CancellationReasonDto {
  reason: string
  count: number
  percent: number
}

interface ServiceTypeDto {
  type: string
  count: number
}

interface LocationPerformanceDto {
  location: string
  totalVisits: number
  completionPercent: number | null
  avgVisitDurationMinutes: number | null
  satisfactionAvg: number | null
  trend: 'UP' | 'FLAT' | 'DOWN'
}

interface OperationsReportDto {
  from: string
  to: string
  visitPerformance: VisitPerformanceDto
  dailyTrend: DailyTrendPointDto[]
  weeklyCompletion: WeeklyCompletionDto[]
  cancellationReasons: CancellationReasonDto[]
  topServiceTypes: ServiceTypeDto[]
  locationPerformance: LocationPerformanceDto[]
}

/* ------------------------------- view shapes ------------------------------ */

export interface OpsTile {
  label: string
  value: string
  badge: string
  tone: TileTone
}

export interface OpsDayTick {
  index: number
  label: string
}

export interface OpsWeek {
  label: string
  value: number
}

export interface OpsCancellationSlice {
  label: string
  share: number
  colour: string
}

export interface OpsServiceType {
  label: string
  visits: number
}

export interface OpsLocationRow {
  name: string
  visits: number
  completion: string
  duration: string
  satisfaction: string
  trend: Trend
}

export interface OperationsReportView {
  reportingPeriod: string
  tiles: OpsTile[]
  visitsByDay: number[]
  dayTicks: OpsDayTick[]
  completionTarget: number
  completionByWeek: OpsWeek[]
  cancellations: { total: number; reasons: OpsCancellationSlice[] }
  serviceTypes: OpsServiceType[]
  serviceBarScale: number
  locations: OpsLocationRow[]
}

/* -------------------------------- helpers --------------------------------- */

const COMPLETION_TARGET = 95
/** The cancellation donut colours, assigned in order the reasons arrive. */
const SLICE_COLOURS = ['#4a7dea', '#e8a23a', '#9ca3af', '#e0524d', '#4a64f0', '#6b7280']
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const rangeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const yearFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const hours = (minutes: number | null): string =>
  minutes === null ? '—' : `${Math.round((minutes / 60) * 10) / 10} hrs`

const pct = (n: number | null): string => (n === null ? '—' : `${Math.round(n * 10) / 10}%`)

const trendMap: Record<'UP' | 'FLAT' | 'DOWN', Trend> = { UP: 'up', FLAT: 'flat', DOWN: 'down' }

/** Service type enum (PERSONAL_CARE) to a title (Personal Care). */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function toView(dto: OperationsReportDto): OperationsReportView {
  const vp = dto.visitPerformance
  const tiles: OpsTile[] = [
    {
      label: 'Total Visits',
      value: String(vp.totalVisits),
      badge:
        vp.totalVisitsDeltaPercent === null
          ? 'vs last month'
          : `${vp.totalVisitsDeltaPercent >= 0 ? '+' : '−'}${Math.abs(vp.totalVisitsDeltaPercent)}% vs last month`,
      tone: 'blue',
    },
    {
      label: 'Completed',
      value: vp.completedPercent === null ? String(vp.completed) : `${vp.completed} (${pct(vp.completedPercent)})`,
      badge: 'completed',
      tone: 'green',
    },
    {
      label: 'Cancelled',
      value: vp.cancelledPercent === null ? String(vp.cancelled) : `${vp.cancelled} (${pct(vp.cancelledPercent)})`,
      badge: vp.cancelledPercent === null ? '—' : `${pct(vp.cancelledPercent)} rate`,
      tone: 'red',
    },
    { label: 'Avg Duration', value: hours(vp.avgVisitDurationMinutes), badge: 'clock in to out', tone: 'amber' },
  ]

  const visitsByDay = dto.dailyTrend.map((d) => d.visits)
  const n = dto.dailyTrend.length
  const tickIndexes = n <= 1 ? [0] : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1]
  const dayTicks: OpsDayTick[] = [...new Set(tickIndexes)]
    .filter((i) => i < n)
    .map((i) => ({ index: i, label: dayFmt.format(new Date(dto.dailyTrend[i].date)) }))

  const serviceTypes = dto.topServiceTypes.map((s) => ({ label: titleCase(s.type), visits: s.count }))
  const maxService = Math.max(1, ...serviceTypes.map((s) => s.visits))

  return {
    reportingPeriod: `${rangeFmt.format(new Date(dto.from))} - ${yearFmt.format(new Date(dto.to))}`,
    tiles,
    visitsByDay: visitsByDay.length > 0 ? visitsByDay : [0],
    dayTicks: dayTicks.length > 0 ? dayTicks : [{ index: 0, label: '—' }],
    completionTarget: COMPLETION_TARGET,
    completionByWeek: dto.weeklyCompletion.map((w) => ({ label: w.label, value: w.completionPercent ?? 0 })),
    cancellations: {
      total: vp.cancelled,
      reasons: dto.cancellationReasons.map((r, i) => ({
        label: titleCase(r.reason),
        share: Math.round(r.percent),
        colour: SLICE_COLOURS[i % SLICE_COLOURS.length],
      })),
    },
    serviceTypes,
    // Scale so the largest service bar fills the track.
    serviceBarScale: maxService,
    locations: dto.locationPerformance.map((l) => ({
      name: l.location,
      visits: l.totalVisits,
      completion: pct(l.completionPercent),
      duration: hours(l.avgVisitDurationMinutes),
      satisfaction: l.satisfactionAvg === null ? '—' : `${l.satisfactionAvg}/5`,
      trend: trendMap[l.trend],
    })),
  }
}

export function useOperationsReport(periodId: PeriodId) {
  const period = periodFor(periodId)
  return useQuery({
    queryKey: ['admin', 'reports', 'operations', periodId],
    queryFn: async () =>
      toView(
        await api.get<OperationsReportDto>(
          `/admin/reports/operations?from=${period.from}&to=${period.to}`,
        ),
      ),
  })
}
