/**
 * The care recipient Visits tab, fetched from the backend and mapped into the
 * `VisitHistory` shape the Visits tab components (stats, table, analytics)
 * already render. One request (`GET /admin/care-recipients/:id/visits`) powers
 * the whole tab.
 *
 * The server owns the summary, caregiver roster and analytics; the tab keeps its
 * existing client side filter and sort over the mapped rows (the first page of
 * up to pageSize visits), so the filter UI is unchanged. Fields the backend does
 * not supply (visit notes) come back empty rather than being invented here.
 */
import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarDays, CircleCheck, Users } from 'lucide-react'
import { api } from '@/lib/api'
import type { VisitStatus } from '@/types'
import type { VisitHistory, VisitRecord, VisitStat, WeekBar } from './visits-data'

/* --------------------------- backend response ----------------------------- */

interface VisitItemDto {
  id: string
  date: string
  startMinute: number
  endMinute: number
  caregiverId: string | null
  caregiverName: string | null
  visitType: string
  durationMinutes: number
  clockInAt: string | null
  clockOutAt: string | null
  status: string
  lateArrival: boolean
}

interface VisitsDto {
  summary: {
    totalVisits: number
    thisMonthVisits: number
    avgDurationHours: number
    completionRatePercent: number
    successfulVisits: number
  }
  caregivers: { id: string; name: string | null }[]
  page: {
    items: VisitItemDto[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  analytics: {
    weeklyCounts: number[]
    visitsPerWeekTrendPercent: number | null
    mostCommonVisitType: { visitType: string; percent: number } | null
    primaryCaregiverCoverage: {
      caregiverId: string
      name: string | null
      visitCount: number
      percent: number
    } | null
  }
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

/** Backend visit status plus the lateArrival flag to the UI visit status union. */
function toVisitStatus(value: string, caregiverName: string | null, lateArrival: boolean): VisitStatus {
  if (caregiverName === null) return 'unassigned'
  switch (value) {
    case 'COMPLETED':
      return 'completed'
    case 'IN_PROGRESS':
    case 'ON_BREAK':
      return 'in-progress'
    case 'CANCELLED':
      return 'cancelled'
    case 'MISSED':
      return 'late-arrival'
    default:
      return lateArrival ? 'late-arrival' : 'upcoming'
  }
}

/** "MORNING_CARE" -> "Morning Care". */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** An ISO datetime to the "2026-07-24" date key the client side range filter uses. */
function toDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/** Minutes from midnight to a clock label, e.g. 540 -> "9:00 AM". */
function formatClock(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const period = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

/** An ISO datetime to a clock label, e.g. "08:58 AM". */
function formatTime(iso: string | null): string | null {
  if (iso === null) return null
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/* -------------------------------- mappers --------------------------------- */

function toStats(dto: VisitsDto): VisitStat[] {
  const { summary } = dto
  return [
    {
      id: 'total',
      label: 'Total Visits',
      value: String(summary.totalVisits),
      hint: 'All-time completed',
      icon: Users,
      tone: 'blue',
    },
    {
      id: 'month',
      label: 'This Month',
      value: String(summary.thisMonthVisits),
      hint: 'Visits this month',
      icon: CalendarDays,
      tone: 'purple',
    },
    {
      id: 'duration',
      label: 'Avg Duration',
      value: `${summary.avgDurationHours.toFixed(1)}h`,
      hint: 'Per scheduled visit',
      icon: Activity,
      tone: 'amber',
    },
    {
      id: 'completion',
      label: 'Completion Rate',
      value: `${summary.completionRatePercent.toFixed(1)}%`,
      hint: `${summary.successfulVisits} successful of ${summary.totalVisits}`,
      icon: CircleCheck,
      tone: 'green',
    },
  ]
}

function toRows(dto: VisitsDto): VisitRecord[] {
  return dto.page.items.map((item) => ({
    id: item.id,
    date: toDateKey(item.date),
    time: formatClock(item.startMinute),
    caregiver: item.caregiverName ?? 'Unassigned',
    type: titleCase(item.visitType),
    durationHours: item.durationMinutes / 60,
    clockIn: formatTime(item.clockInAt),
    clockOut: formatTime(item.clockOutAt),
    status: toVisitStatus(item.status, item.caregiverName, item.lateArrival),
    notes: '',
  }))
}

function toWeeklyTrend(dto: VisitsDto): WeekBar[] {
  return dto.analytics.weeklyCounts.map((count, index) => ({
    label: `W${index + 1}`,
    count,
  }))
}

function toHistory(dto: VisitsDto): VisitHistory {
  const { analytics } = dto
  const trend = analytics.visitsPerWeekTrendPercent
  const common = analytics.mostCommonVisitType
  const coverage = analytics.primaryCaregiverCoverage

  return {
    stats: toStats(dto),
    visits: toRows(dto),
    totalVisits: dto.summary.totalVisits,
    weeklyTrend: toWeeklyTrend(dto),
    trendDelta:
      trend === null
        ? { value: DASH, direction: 'up' }
        : {
            value: `${trend > 0 ? '+' : ''}${trend.toFixed(0)}%`,
            direction: trend < 0 ? 'down' : 'up',
          },
    commonType:
      common === null
        ? { name: DASH, share: 'No visits recorded' }
        : { name: titleCase(common.visitType), share: `${common.percent.toFixed(0)}% of total visits` },
    coverage:
      coverage === null
        ? { percent: DASH, detail: 'No caregiver assigned' }
        : {
            percent: `${coverage.percent.toFixed(0)}%`,
            detail: `${coverage.name ?? 'Unassigned'} (${coverage.visitCount} visits)`,
          },
  }
}

export function useRecipientVisits(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'visits'] as const,
    enabled: id !== undefined,
    queryFn: async () => toHistory(await api.get<VisitsDto>(`/admin/care-recipients/${id}/visits`)),
  })
}
