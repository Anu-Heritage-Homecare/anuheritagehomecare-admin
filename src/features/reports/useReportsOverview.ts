/**
 * The Reports Overview screen, fetched from the backend and mapped into the
 * shapes the page already renders (`GET /admin/reports/overview`). One request
 * powers the whole screen. Money arrives in minor units; it is converted to the
 * major units the formatters expect. Figures the backend leaves null stay null
 * and read as an em dash, never faked.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ReportRange } from './data'

/* --------------------------- backend response ----------------------------- */

interface ReportsKpisDto {
  totalVisits: number
  caregiverUtilizationPercent: number | null
  revenueMinor: number
  clientSatisfactionAvg: number | null
  visitCompletionPercent: number | null
  outstandingMinor: number
}

interface MonthlyPerformanceDto {
  monthStart: string
  completionPercent: number | null
  utilizationPercent: number | null
}

interface MonthlyRevenueDto {
  monthStart: string
  revenueMinor: number
}

interface RevenueOverviewDto {
  ytdRevenueMinor: number
  monthly: MonthlyRevenueDto[]
}

interface OperationalPerformanceDto {
  visitsThisMonth: number
  avgVisitDurationMinutes: number | null
  onTimeRatePercent: number | null
  cancellationRatePercent: number | null
}

interface WorkforceSummaryDto {
  activeCaregivers: number
  avgRating: number | null
  trainingCompliancePercent: number | null
  attendanceRatePercent: number | null
}

interface FinancialSummaryDto {
  monthlyRevenueMinor: number
  collectionRatePercent: number | null
  avgInvoiceMinor: number | null
  outstandingMinor: number
}

interface SatisfactionBreakdownDto {
  score: number
  count: number
  percent: number
}

interface ReportActivityDto {
  id: string
  type: string
  title: string
  format: string
  generatedAt: string
  generatedByLabel: string | null
}

interface ReportsOverviewDto {
  currency: string
  from: string
  to: string
  kpis: ReportsKpisDto
  monthlyPerformance: MonthlyPerformanceDto[]
  revenueOverview: RevenueOverviewDto
  operationalPerformance: OperationalPerformanceDto
  workforceSummary: WorkforceSummaryDto
  financialSummary: FinancialSummaryDto
  satisfactionBreakdown: SatisfactionBreakdownDto[]
  recentReports: ReportActivityDto[]
}

/* ------------------------------- view shapes ------------------------------ */

export interface OverviewKpis {
  totalVisits: number
  utilisation: number | null
  revenueMajor: number
  satisfactionAvg: number | null
  satisfactionCount: number
  completion: number | null
  outstandingMajor: number
}

export interface OverviewMonthPoint {
  /** "2026-07". */
  id: string
  label: string
  completion: number | null
  utilisation: number | null
}

export interface OverviewRevenueMonth {
  label: string
  value: number
}

export interface OverviewOperational {
  visitsThisMonth: number
  avgHours: number | null
  onTime: number | null
  cancellation: number | null
}

export interface OverviewWorkforce {
  active: number
  avgRating: number | null
  training: number | null
  attendance: number | null
}

export interface OverviewFinancial {
  monthlyRevenue: number
  collectionRate: number | null
  avgInvoice: number | null
  outstanding: number
}

export interface OverviewSatisfactionRow {
  stars: 1 | 2 | 3 | 4 | 5
  label: string
  count: number
  share: number
}

export interface OverviewReportRecord {
  id: string
  name: string
  generatedAt: string
  by: string
  /** The report's screen, where one is built. */
  to?: string
}

export interface ReportsOverviewView {
  currency: string
  kpis: OverviewKpis
  trend: OverviewMonthPoint[]
  revenue: { months: OverviewRevenueMonth[]; ytd: number }
  operational: OverviewOperational
  workforce: OverviewWorkforce
  financial: OverviewFinancial
  satisfaction: { count: number; breakdown: OverviewSatisfactionRow[] }
  activity: OverviewReportRecord[]
}

/* -------------------------------- helpers --------------------------------- */

const major = (minor: number): number => Math.round(minor / 100)
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const monthYearFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const starLabels = {
  5: 'Excellent (5 stars)',
  4: 'Good (4 stars)',
  3: 'Average (3 stars)',
  2: 'Below Average (2 stars)',
  1: 'Poor (1 star)',
} as const

/** Which screen a recorded report opens, from its report type. */
function activityTarget(type: string): string | undefined {
  const t = type.toUpperCase()
  if (t.includes('OPERATION')) return '/reports/operations'
  if (t.includes('WORKFORCE') || t.includes('CAREGIVER')) return '/reports/workforce'
  if (t.includes('FINANC')) return '/reports/financial'
  return undefined
}

function toView(dto: ReportsOverviewDto): ReportsOverviewView {
  const sat = dto.satisfactionBreakdown
  const satCount = sat.reduce((sum, row) => sum + row.count, 0)
  return {
    currency: dto.currency,
    kpis: {
      totalVisits: dto.kpis.totalVisits,
      utilisation: dto.kpis.caregiverUtilizationPercent,
      revenueMajor: major(dto.kpis.revenueMinor),
      satisfactionAvg: dto.kpis.clientSatisfactionAvg,
      satisfactionCount: satCount,
      completion: dto.kpis.visitCompletionPercent,
      outstandingMajor: major(dto.kpis.outstandingMinor),
    },
    trend: dto.monthlyPerformance.map((m) => ({
      id: m.monthStart.slice(0, 7),
      label: monthFmt.format(new Date(m.monthStart)),
      completion: m.completionPercent,
      utilisation: m.utilizationPercent,
    })),
    revenue: {
      months: dto.revenueOverview.monthly.map((m) => ({
        label: monthYearFmt.format(new Date(m.monthStart)),
        value: major(m.revenueMinor),
      })),
      ytd: major(dto.revenueOverview.ytdRevenueMinor),
    },
    operational: {
      visitsThisMonth: dto.operationalPerformance.visitsThisMonth,
      avgHours:
        dto.operationalPerformance.avgVisitDurationMinutes === null
          ? null
          : Math.round((dto.operationalPerformance.avgVisitDurationMinutes / 60) * 10) / 10,
      onTime: dto.operationalPerformance.onTimeRatePercent,
      cancellation: dto.operationalPerformance.cancellationRatePercent,
    },
    workforce: {
      active: dto.workforceSummary.activeCaregivers,
      avgRating: dto.workforceSummary.avgRating,
      training: dto.workforceSummary.trainingCompliancePercent,
      attendance: dto.workforceSummary.attendanceRatePercent,
    },
    financial: {
      monthlyRevenue: major(dto.financialSummary.monthlyRevenueMinor),
      collectionRate: dto.financialSummary.collectionRatePercent,
      avgInvoice:
        dto.financialSummary.avgInvoiceMinor === null
          ? null
          : major(dto.financialSummary.avgInvoiceMinor),
      outstanding: major(dto.financialSummary.outstandingMinor),
    },
    satisfaction: {
      count: satCount,
      breakdown: ([5, 4, 3, 2, 1] as const).map((stars) => {
        const row = sat.find((s) => s.score === stars)
        return {
          stars,
          label: starLabels[stars],
          count: row?.count ?? 0,
          share: row === undefined ? 0 : Math.round(row.percent),
        }
      }),
    },
    activity: dto.recentReports.map((r) => ({
      id: r.id,
      name: r.title,
      generatedAt: r.generatedAt,
      by: r.generatedByLabel ?? '—',
      to: activityTarget(r.type),
    })),
  }
}

/** The inclusive window a range preset asks for, as ISO dates. */
function windowFor(range: ReportRange): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - Number(range))
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** The overview figures as a CSV string — the Export CSV action. */
export function buildOverviewCsv(view: ReportsOverviewView): string {
  const { kpis, trend, revenue, operational: mtd, workforce: staff, financial: fin, satisfaction: sat } = view
  const rows: string[][] = [
    ['Reports'],
    [],
    ['Measure', 'Value'],
    ['Total Visits', String(kpis.totalVisits)],
    ['Caregiver Utilization (%)', String(kpis.utilisation ?? '')],
    ['Revenue (NGN)', String(kpis.revenueMajor)],
    ['Client Satisfaction', String(kpis.satisfactionAvg ?? '')],
    ['Visit Completion (%)', String(kpis.completion ?? '')],
    ['Outstanding (NGN)', String(kpis.outstandingMajor)],
    [],
    ['Month', 'Completion (%)', 'Utilization (%)'],
    ...trend.map((m) => [m.id, String(m.completion ?? ''), String(m.utilisation ?? '')]),
    [],
    ['Month', 'Plan revenue (NGN)'],
    ...revenue.months.map((m) => [m.label, String(m.value)]),
    [],
    ['Operational (month to date)', ''],
    ['Visits this month', String(mtd.visitsThisMonth)],
    ['Avg duration (hrs)', String(mtd.avgHours ?? '')],
    ['On-time rate (%)', String(mtd.onTime ?? '')],
    ['Cancellation rate (%)', String(mtd.cancellation ?? '')],
    [],
    ['Workforce', ''],
    ['Active caregivers', String(staff.active)],
    ['Avg rating', String(staff.avgRating ?? '')],
    ['Training compliance (%)', String(staff.training ?? '')],
    ['Attendance rate (%)', String(staff.attendance ?? '')],
    [],
    ['Financial', ''],
    ['Monthly revenue (NGN)', String(fin.monthlyRevenue)],
    ['Collection rate (%)', String(fin.collectionRate ?? '')],
    ['Avg invoice (NGN)', String(fin.avgInvoice ?? '')],
    ['Outstanding (NGN)', String(fin.outstanding)],
    [],
    ['Rating', 'Reviews', 'Share (%)'],
    ...sat.breakdown.map((b) => [b.label, String(b.count), String(b.share)]),
  ]
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n')
}

export function useReportsOverview(range: ReportRange) {
  const { from, to } = windowFor(range)
  return useQuery({
    queryKey: ['admin', 'reports', 'overview', range],
    queryFn: async () =>
      toView(
        await api.get<ReportsOverviewDto>(
          `/admin/reports/overview?from=${from}&to=${to}`,
        ),
      ),
  })
}
