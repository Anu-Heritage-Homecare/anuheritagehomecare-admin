/**
 * The Workforce Report drill down, fetched from the backend and mapped into the
 * shapes the page renders (`GET /admin/reports/workforce`). One request powers
 * the whole screen for a reporting period. Figures the backend leaves null read
 * as an em dash, never faked.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PeriodId } from './operations'
import { periodFor } from './operations'

/* --------------------------- backend response ----------------------------- */

interface WorkforceKpisDto {
  activeCaregivers: number
  staffedPercent: number | null
  utilizationPercent: number | null
  utilizationTargetPercent: number
  attendancePercent: number | null
  avgPerformance: number | null
  trainingCompliancePercent: number | null
}

interface WeeklyUtilizationDto {
  label: string
  utilizationPercent: number | null
}

interface AttendancePointDto {
  date: string
  attendancePercent: number | null
}

type RatingBand = 'OUTSTANDING' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT'

interface RatingDistributionDto {
  band: RatingBand
  caregivers: number
  percent: number
}

interface TopCaregiverDto {
  rank: number
  caregiverId: string
  name: string
  photoKey: string | null
  rating: number | null
  visitsCompleted: number
  onTimeRatePercent: number | null
  attendancePercent: number | null
  csatScore: number | null
}

interface TrainingComplianceDto {
  compliant: number
  overdue: number
  compliantPercent: number | null
}

type CertificationUrgency = 'ACTION_REQUIRED' | 'GRACE_PERIOD' | 'SCHEDULED'

interface ExpiringCertificationDto {
  caregiverId: string
  caregiverName: string
  credentialName: string
  expiresAt: string
  daysUntilExpiry: number
  status: CertificationUrgency
}

interface FlaggedCaregiverDto {
  caregiverId: string
  name: string
  photoKey: string | null
  reason: string
  attendancePercent: number | null
  lateArrivals: number
}

interface WorkforceReportDto {
  from: string
  to: string
  kpis: WorkforceKpisDto
  weeklyUtilization: WeeklyUtilizationDto[]
  attendanceTrend: AttendancePointDto[]
  ratingDistribution: RatingDistributionDto[]
  topCaregivers: TopCaregiverDto[]
  trainingCompliance: TrainingComplianceDto
  expiringCertifications: ExpiringCertificationDto[]
  flaggedForReview: FlaggedCaregiverDto[]
}

/* ------------------------------- view shapes ------------------------------ */

export interface WfKpis {
  active: number
  headcount: number | null
  utilisation: number | null
  attendance: number | null
  avgRating: number | null
  training: number | null
}

export interface WfWeek {
  label: string
  value: number | null
}

export interface WfAttendancePoint {
  date: string
  value: number
}

export type WfBandId = 'outstanding' | 'good' | 'satisfactory' | 'improve'

export interface WfBand {
  id: WfBandId
  label: string
  range: string
  count: number
  share: number
}

export interface WfRanking {
  id: string
  name: string
  rating: number | null
  completed: number
  onTime: number | null
  attendance: number | null
  csat: number | null
}

export type RenewalState = 'action' | 'grace' | 'scheduled'

export interface WfExpiring {
  id: string
  caregiverName: string
  name: string
  expiresAt: string
  days: number
  state: RenewalState
}

export interface WfFlag {
  id: string
  name: string
  severity: 'red' | 'amber'
  reason: string
  attendance: number | null
  late: number
}

export interface WorkforceReportView {
  period: { from: string; to: string }
  kpis: WfKpis
  weeks: WfWeek[]
  attendance: WfAttendancePoint[]
  bands: WfBand[]
  unrated: number
  rankings: WfRanking[]
  compliance: { compliant: number; overdue: number; share: number | null }
  expiring: WfExpiring[]
  flags: WfFlag[]
}

/* -------------------------------- helpers --------------------------------- */

export const renewalLabels: Record<RenewalState, string> = {
  action: 'Action Required',
  grace: 'Grace Period',
  scheduled: 'Scheduled',
}

export const RENEWAL_HORIZON_DAYS = 45

const BAND_META: Record<RatingBand, { id: WfBandId; label: string; range: string }> = {
  OUTSTANDING: { id: 'outstanding', label: 'Outstanding', range: '4.5 – 5.0 Rating' },
  GOOD: { id: 'good', label: 'Good', range: '4.0 – 4.4 Rating' },
  SATISFACTORY: { id: 'satisfactory', label: 'Satisfactory', range: '3.5 – 3.9 Rating' },
  NEEDS_IMPROVEMENT: { id: 'improve', label: 'Needs Improvement', range: 'Under 3.5 Rating' },
}

const URGENCY_MAP: Record<CertificationUrgency, RenewalState> = {
  ACTION_REQUIRED: 'action',
  GRACE_PERIOD: 'grace',
  SCHEDULED: 'scheduled',
}

function toView(dto: WorkforceReportDto): WorkforceReportView {
  const totalRated = dto.ratingDistribution.reduce((sum, b) => sum + b.caregivers, 0)
  return {
    period: { from: dto.from.slice(0, 10), to: dto.to.slice(0, 10) },
    kpis: {
      active: dto.kpis.activeCaregivers,
      headcount:
        dto.kpis.staffedPercent === null || dto.kpis.staffedPercent === 0
          ? null
          : Math.round(dto.kpis.activeCaregivers / (dto.kpis.staffedPercent / 100)),
      utilisation: dto.kpis.utilizationPercent,
      attendance: dto.kpis.attendancePercent,
      avgRating: dto.kpis.avgPerformance,
      training: dto.kpis.trainingCompliancePercent,
    },
    weeks: dto.weeklyUtilization.map((w) => ({ label: w.label, value: w.utilizationPercent })),
    attendance: dto.attendanceTrend
      .filter((a) => a.attendancePercent !== null)
      .map((a) => ({ date: a.date.slice(0, 10), value: a.attendancePercent ?? 0 })),
    bands: dto.ratingDistribution.map((b) => ({
      ...BAND_META[b.band],
      count: b.caregivers,
      share: Math.round(b.percent),
    })),
    unrated: Math.max(0, dto.kpis.activeCaregivers - totalRated),
    rankings: dto.topCaregivers.map((c) => ({
      id: c.caregiverId,
      name: c.name,
      rating: c.rating,
      completed: c.visitsCompleted,
      onTime: c.onTimeRatePercent,
      attendance: c.attendancePercent,
      csat: c.csatScore,
    })),
    compliance: {
      compliant: dto.trainingCompliance.compliant,
      overdue: dto.trainingCompliance.overdue,
      share: dto.trainingCompliance.compliantPercent,
    },
    expiring: dto.expiringCertifications.map((e) => ({
      id: `${e.caregiverId}-${e.credentialName}`,
      caregiverName: e.caregiverName,
      name: e.credentialName,
      expiresAt: e.expiresAt.slice(0, 10),
      days: e.daysUntilExpiry,
      state: URGENCY_MAP[e.status],
    })),
    flags: dto.flaggedForReview.map((f) => ({
      id: f.caregiverId,
      name: f.name,
      severity: f.attendancePercent !== null && f.attendancePercent < 95 ? 'red' : 'amber',
      reason: f.reason,
      attendance: f.attendancePercent,
      late: f.lateArrivals,
    })),
  }
}

/** "Jun 23 - Jul 22, 2026". */
const rangeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const yearFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatWorkforcePeriod(period: { from: string; to: string }): string {
  return `${rangeFmt.format(new Date(`${period.from}T00:00:00Z`))} - ${yearFmt.format(new Date(`${period.to}T00:00:00Z`))}`
}

export function useWorkforceReport(periodId: PeriodId) {
  const period = periodFor(periodId)
  return useQuery({
    queryKey: ['admin', 'reports', 'workforce', periodId],
    queryFn: async () =>
      toView(
        await api.get<WorkforceReportDto>(
          `/admin/reports/workforce?from=${period.from}&to=${period.to}`,
        ),
      ),
  })
}
