/**
 * The operations dashboard, fetched from the backend and mapped into the shapes
 * the dashboard components already render. One request powers the whole screen
 * (`GET /admin/dashboard`); the mapping keeps the presentation untouched.
 *
 * Trend deltas and currency formatting the backend does not yet provide are left
 * off rather than faked: the backend has no previous-period comparison, and
 * revenue is deliberately null until it can be summed honestly per market.
 */
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  House,
  PlayCircle,
  Star,
  UserPlus,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { formatGap } from '@/lib/duration'
import type { Priority, Severity, Tone, VisitStatus } from '@/types'
import type { ActivityEntry, Alert, Metric, Stat, Visit } from './data'

/* --------------------------- backend response ----------------------------- */

interface OperationsSnapshotDto {
  activeHomeVisits: number
  scheduledToday: number
  scheduledCompletionPercent: number
  availableCaregivers: number
  totalCaregivers: number
  visitsStartingSoon: number
  criticalAlerts: number
  careQualityScore: number | null
}

interface ScheduleItemDto {
  visitId: string
  startMinute: number
  endMinute: number
  recipientName: string
  caregiverName: string | null
  visitType: string
  status: string
  priority: string
}

interface AlertDto {
  id: string
  type: string
  severity: string
  title: string
  description: string
  coordinatorName: string | null
  status: string
  relatedVisitId: string | null
  relatedCaregiverId: string | null
  relatedCareRecipientId: string | null
  createdAt: string
}

interface ActivityItemDto {
  type: string
  description: string
  occurredAt: string
}

interface PerformanceSnapshotDto {
  completionRatePercent: number
  averageArrivalDeltaMinutes: number | null
  clientSatisfaction: number | null
  clientSatisfactionCount: number
  openTasks: number
  revenueTodayMinor: number | null
}

interface DashboardDto {
  operations: OperationsSnapshotDto
  todaysSchedule: ScheduleItemDto[]
  criticalAlerts: AlertDto[]
  activityTimeline: ActivityItemDto[]
  performance: PerformanceSnapshotDto
}

/** The dashboard, mapped to the shapes the components render. */
export interface DashboardView {
  stats: Stat[]
  visits: Visit[]
  alerts: Alert[]
  activity: ActivityEntry[]
  metrics: Metric[]
}

/* -------------------------------- helpers --------------------------------- */

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

/** Minutes from midnight to a clock label, e.g. 480 -> "8:00 AM". */
function formatClock(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const period = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

/** An ISO timestamp to "15 min ago" / "just now", measured from the wall clock. */
function formatAgo(iso: string): string {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60_000
  const gap = formatGap(minutes)
  return gap === 'just now' ? gap : `${gap} ago`
}

/** PascalCase an enum like VISIT_STARTED into "Visit Started". */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const nowMinuteOfDay = (): number => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

const PRIORITIES: Priority[] = ['critical', 'urgent', 'high', 'medium', 'normal', 'low']
function toPriority(value: string): Priority {
  const lower = value.toLowerCase()
  return PRIORITIES.find((p) => p === lower) ?? 'normal'
}

function toSeverity(value: string): Severity {
  const lower = value.toLowerCase()
  if (lower === 'critical') return 'critical'
  if (lower === 'high') return 'high'
  return 'medium'
}

/** Backend visit status (plus "soon" timing) to the UI's visit status union. */
function toVisitStatus(item: ScheduleItemDto, nowMinute: number): VisitStatus {
  if (item.caregiverName === null) return 'unassigned'
  switch (item.status) {
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
      // SCHEDULED: within the next hour reads as starting soon.
      return item.startMinute >= nowMinute && item.startMinute - nowMinute <= 60
        ? 'starting-soon'
        : 'upcoming'
  }
}

/** Icon and tone for an activity row, keyed loosely off the event type. */
function activityLook(type: string): { icon: LucideIcon; tone: Tone } {
  const t = type.toUpperCase()
  if (t.includes('COMPLET')) return { icon: CheckCircle2, tone: 'green' }
  if (t.includes('START')) return { icon: PlayCircle, tone: 'green' }
  if (t.includes('ASSIGN')) return { icon: UserPlus, tone: 'blue' }
  if (t.includes('PAYMENT') || t.includes('INVOICE')) return { icon: CreditCard, tone: 'green' }
  if (t.includes('MEDICATION') || t.includes('RECORD')) return { icon: CheckCircle2, tone: 'blue' }
  return { icon: Clock, tone: 'slate' }
}

/** Where an alert's action button takes you, from whatever it relates to. */
function alertTarget(alert: AlertDto): { action: string; to: string } {
  if (alert.relatedVisitId) {
    return { action: 'View visit', to: `/scheduling/visits/${alert.relatedVisitId}` }
  }
  if (alert.relatedCaregiverId) {
    return { action: 'View caregiver', to: `/caregivers/${alert.relatedCaregiverId}` }
  }
  if (alert.relatedCareRecipientId) {
    return { action: 'View recipient', to: `/care-recipients/${alert.relatedCareRecipientId}` }
  }
  return { action: 'Review', to: '/live-monitoring/alerts' }
}

/* -------------------------------- mappers --------------------------------- */

function toStats(ops: OperationsSnapshotDto): Stat[] {
  return [
    {
      id: 'active-visits',
      label: 'Active Home Visits',
      value: String(ops.activeHomeVisits),
      meta: 'active now',
      icon: House,
      tone: 'green',
    },
    {
      id: 'scheduled',
      label: "Today's Scheduled Visits",
      value: String(ops.scheduledToday),
      meta: `${ops.scheduledCompletionPercent}% complete`,
      icon: CalendarPlus,
      tone: 'blue',
    },
    {
      id: 'available',
      label: 'Available Caregivers',
      value: String(ops.availableCaregivers),
      meta: `${ops.availableCaregivers} of ${ops.totalCaregivers}`,
      icon: Users,
      tone: 'purple',
    },
    {
      id: 'starting',
      label: 'Visits Starting Soon',
      value: String(ops.visitsStartingSoon),
      meta: 'next hour',
      icon: Clock,
      tone: 'amber',
    },
    {
      id: 'alerts',
      label: 'Critical Alerts',
      value: String(ops.criticalAlerts),
      meta: 'requires action',
      icon: AlertTriangle,
      tone: 'red',
    },
    {
      id: 'quality',
      label: 'Care Quality Score',
      value: ops.careQualityScore === null ? '—' : `${ops.careQualityScore}%`,
      meta: 'care quality',
      icon: Star,
      tone: 'green',
    },
  ]
}

function toMetrics(perf: PerformanceSnapshotDto): Metric[] {
  const arrival = perf.averageArrivalDeltaMinutes
  const satisfaction = perf.clientSatisfaction
  return [
    {
      id: 'completion',
      label: "Today's Completion Rate",
      value: `${perf.completionRatePercent}%`,
      percent: clamp(perf.completionRatePercent),
      tone: 'green',
    },
    {
      id: 'arrival',
      label: 'Average Arrival Time',
      value:
        arrival === null
          ? '—'
          : arrival < 0
            ? `${Math.abs(arrival)} min early`
            : arrival > 0
              ? `${arrival} min late`
              : 'on time',
      percent: arrival === null ? 0 : arrival <= 0 ? 100 : clamp(100 - arrival * 5),
      tone: arrival !== null && arrival > 5 ? 'amber' : 'green',
      emphasis: true,
    },
    {
      id: 'satisfaction',
      label: 'Client Satisfaction',
      value: satisfaction === null ? '—' : `${satisfaction.toFixed(1)}/5.0`,
      percent: satisfaction === null ? 0 : clamp((satisfaction / 5) * 100),
      tone: 'amber',
    },
    {
      id: 'revenue',
      label: 'Revenue Today',
      value:
        perf.revenueTodayMinor === null
          ? '—'
          : (perf.revenueTodayMinor / 100).toLocaleString(),
      percent: 0,
      tone: 'blue',
    },
    {
      id: 'open-tasks',
      label: 'Open Tasks',
      value: String(perf.openTasks),
      percent: clamp(perf.openTasks),
      tone: 'slate',
    },
  ]
}

function toView(dto: DashboardDto): DashboardView {
  const nowMinute = nowMinuteOfDay()
  return {
    stats: toStats(dto.operations),
    visits: dto.todaysSchedule.map((item) => ({
      id: item.visitId,
      time: formatClock(item.startMinute),
      recipient: item.recipientName,
      caregiver: item.caregiverName,
      type: item.visitType,
      status: toVisitStatus(item, nowMinute),
      priority: toPriority(item.priority),
    })),
    alerts: dto.criticalAlerts.map((alert) => {
      const { action, to } = alertTarget(alert)
      return {
        id: alert.id,
        title: alert.title,
        severity: toSeverity(alert.severity),
        detail: alert.description,
        coordinator: alert.coordinatorName ?? 'Unassigned',
        action,
        destructive: alert.severity.toLowerCase() === 'critical',
        target: { kind: 'path', to },
      }
    }),
    activity: dto.activityTimeline.map((entry, index) => {
      const { icon, tone } = activityLook(entry.type)
      return {
        id: `activity-${index}`,
        title: titleCase(entry.type),
        detail: entry.description,
        ago: formatAgo(entry.occurredAt),
        icon,
        tone,
      }
    }),
    metrics: toMetrics(dto.performance),
  }
}

export function useDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => toView(await api.get<DashboardDto>('/admin/dashboard')),
  })
}
