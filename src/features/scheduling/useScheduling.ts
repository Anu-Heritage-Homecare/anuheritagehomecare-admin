/**
 * The Scheduling console (board, calendar, unassigned and conflicts tabs),
 * fetched from the back office API. The static board simulation (derived
 * conflicts, credential states, week rollups) is dropped in favour of the
 * server's own views; what the backend does not return is shown as empty rather
 * than invented. The static board-data module is left in place because other
 * features (tasks, messages, monitoring, reports) still read it.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Priority, VisitStatus } from '@/types'

/* --------------------------- backend responses ---------------------------- */

interface SchedulingSummaryDto {
  todaysVisits: number
  upcomingVisits: number
  availableCaregivers: number
  unassignedVisits: number
  scheduleConflicts: number
  completedVisits: number
}

interface SchedulingVisitDto {
  id: string
  date: string
  time: string
  endTime: string
  recipientName: string
  caregiverId: string | null
  caregiverName: string | null
  service: string
  status: string
  priority: string
  assignable: boolean
}

interface SchedulingVisitPageDto {
  total: number
  page: number
  pageSize: number
  rows: SchedulingVisitDto[]
}

interface SchedulingConsoleDto {
  date: string
  summary: SchedulingSummaryDto
  tabCounts: { unassigned: number; conflicts: number }
  visits: SchedulingVisitPageDto
}

interface SchedulingConflictDto {
  caregiverId: string
  caregiverName: string | null
  first: SchedulingVisitDto
  second: SchedulingVisitDto
}

interface SchedulingCalendarDayDto {
  date: string
  visits: SchedulingVisitDto[]
}

/* -------------------------------- UI shapes ------------------------------- */

/** One visit row as the Scheduling screens render it. */
export interface BoardRow {
  id: string
  date: string
  start: string
  end: string
  recipientName: string
  caregiverId: string | null
  caregiverName: string | null
  type: string
  status: VisitStatus
  priority: Priority
  /** Still open to a caregiver change (upcoming, not cancelled/over). */
  assignable: boolean
}

export interface ConsoleView {
  date: string
  summary: SchedulingSummaryDto
  tabCounts: { unassigned: number; conflicts: number }
  total: number
  rows: BoardRow[]
}

export interface ConflictView {
  id: string
  caregiverId: string
  caregiverName: string | null
  detail: string
}

export interface CalendarDay {
  date: string
  visits: BoardRow[]
}

/* -------------------------------- helpers --------------------------------- */

const PRIORITIES: Priority[] = ['critical', 'urgent', 'high', 'medium', 'normal', 'low']

export function toPriority(value: string): Priority {
  const lower = value.toLowerCase()
  return PRIORITIES.find((p) => p === lower) ?? 'normal'
}

/** Backend visit status (plus the unassigned flag) to the UI status union. */
export function toVisitStatus(dto: {
  status: string
  caregiverName: string | null
}): VisitStatus {
  if (dto.caregiverName === null) return 'unassigned'
  switch (dto.status) {
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
      return 'upcoming'
  }
}

function toRow(dto: SchedulingVisitDto): BoardRow {
  return {
    id: dto.id,
    date: dto.date,
    start: dto.time,
    end: dto.endTime,
    recipientName: dto.recipientName,
    caregiverId: dto.caregiverId,
    caregiverName: dto.caregiverName,
    type: dto.service,
    status: toVisitStatus(dto),
    priority: toPriority(dto.priority),
    assignable: dto.assignable,
  }
}

/* --------------------------------- hooks ---------------------------------- */

/** The console for a day: KPIs, tab counts and the day's visit table. */
export function useSchedulingConsole(date: string) {
  return useQuery({
    queryKey: ['admin', 'scheduling', 'console', date],
    queryFn: async (): Promise<ConsoleView> => {
      const dto = await api.get<SchedulingConsoleDto>(
        `/admin/scheduling?date=${date}&pageSize=100`,
      )
      return {
        date: dto.date,
        summary: dto.summary,
        tabCounts: dto.tabCounts,
        total: dto.visits.total,
        rows: dto.visits.rows.map(toRow),
      }
    },
  })
}

/** The Unassigned Visits tab for a day. */
export function useUnassignedVisits(date: string) {
  return useQuery({
    queryKey: ['admin', 'scheduling', 'unassigned', date],
    queryFn: async (): Promise<BoardRow[]> => {
      const dto = await api.get<SchedulingVisitPageDto>(
        `/admin/scheduling/unassigned?date=${date}&pageSize=100`,
      )
      return dto.rows.map(toRow)
    },
  })
}

/** The Conflicts and Alerts tab for a day. */
export function useSchedulingConflicts(date: string) {
  return useQuery({
    queryKey: ['admin', 'scheduling', 'conflicts', date],
    queryFn: async (): Promise<ConflictView[]> => {
      const rows = await api.get<SchedulingConflictDto[]>(
        `/admin/scheduling/conflicts?date=${date}`,
      )
      return rows.map((c) => ({
        id: `${c.first.id}-${c.second.id}`,
        caregiverId: c.caregiverId,
        caregiverName: c.caregiverName,
        detail: `${c.first.recipientName} ${c.first.time}–${c.first.endTime} overlaps ${c.second.recipientName} ${c.second.time}–${c.second.endTime}.`,
      }))
    },
  })
}

/** The Calendar feed over an inclusive day range. */
export function useSchedulingCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'scheduling', 'calendar', from, to],
    queryFn: async (): Promise<CalendarDay[]> => {
      const days = await api.get<SchedulingCalendarDayDto[]>(
        `/admin/scheduling/calendar?from=${from}&to=${to}`,
      )
      return days.map((d) => ({ date: d.date, visits: d.visits.map(toRow) }))
    },
  })
}
