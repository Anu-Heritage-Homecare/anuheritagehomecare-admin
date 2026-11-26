/**
 * The caregiver Schedule tab, fetched from the back office API. One request
 * (`GET /admin/caregivers/:id/schedule?weekOf=YYYY-MM-DD`) powers the whole tab:
 * the week totals, the weekly calendar, the Upcoming Visits table and the
 * Availability Settings panel. The backend normalises any instant within a week
 * to its Monday, so the week the caller asks for is the week it returns.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { VisitStatus } from '@/types'

/* --------------------------- backend response ----------------------------- */

interface ScheduleDayVisitDto {
  time: string
  endTime: string
  recipientName: string
  visitType: string
  status: string
}

interface ScheduleDayDto {
  dayLabel: string
  date: string
  offDuty: boolean
  visits: ScheduleDayVisitDto[]
}

interface ScheduleUpcomingVisitDto {
  date: string
  time: string
  recipientName: string
  visitType: string
  durationHours: number
  status: string
}

interface ScheduleAvailabilityDayDto {
  dayLabel: string
  available: boolean
  window: string | null
}

export interface ScheduleResponseDto {
  weekStart: string
  weekEnd: string
  summary: {
    hoursScheduled: number
    targetHours: number | null
    loadPercent: number | null
    visitsScheduled: number
    allConfirmed: boolean
    availabilityDayRange: string | null
    standardWindow: string | null
  }
  days: ScheduleDayDto[]
  upcomingVisits: ScheduleUpcomingVisitDto[]
  availabilitySettings: {
    days: ScheduleAvailabilityDayDto[]
    maxHoursPerWeek: number | null
    preferredShift: string | null
    overtimeEligible: boolean
    overtimeRate: number | null
  }
}

/* -------------------------------- helpers --------------------------------- */

/**
 * The backend labels a visit status for display ("Confirmed", "In progress").
 * The calendar's status badge renders the shared `VisitStatus` union, so the
 * label is mapped back to it; an unknown label reads as upcoming rather than
 * crashing.
 */
export function scheduleVisitStatus(label: string): VisitStatus {
  switch (label.toLowerCase()) {
    case 'completed':
      return 'completed'
    case 'in progress':
      return 'in-progress'
    case 'cancelled':
      return 'cancelled'
    case 'missed':
      return 'late-arrival'
    default:
      return 'upcoming'
  }
}

export type CaregiverSchedule = ScheduleResponseDto

/**
 * The backend sends full ISO timestamps; the calendar's date utilities expect
 * date only strings. Normalising here keeps the week math and the "today"
 * comparison correct without parsing a timestamp in every cell.
 */
function toDateOnly(dto: ScheduleResponseDto): CaregiverSchedule {
  return {
    ...dto,
    weekStart: dto.weekStart.slice(0, 10),
    weekEnd: dto.weekEnd.slice(0, 10),
    days: dto.days.map((d) => ({ ...d, date: d.date.slice(0, 10) })),
    upcomingVisits: dto.upcomingVisits.map((v) => ({ ...v, date: v.date.slice(0, 10) })),
  }
}

/* --------------------------------- hook ----------------------------------- */

/**
 * One caregiver's Schedule tab for the given week. `weekOf` is any ISO date in
 * the week to show; omitted, the backend shows the current week.
 */
export function useCaregiverSchedule(id: string, weekOf: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'caregivers', id, 'schedule', weekOf ?? 'current'] as const,
    queryFn: async (): Promise<CaregiverSchedule> => {
      const query = weekOf ? `?weekOf=${weekOf}` : ''
      return toDateOnly(await api.get<ScheduleResponseDto>(`/admin/caregivers/${id}/schedule${query}`))
    },
  })
}
