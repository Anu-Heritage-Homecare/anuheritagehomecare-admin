/**
 * The Financial Report, fetched from the billing module and mapped into the
 * shapes the two financial report pages render
 * (`GET /admin/billing/reports/financial`). Money arrives in minor units and is
 * converted to the major units the formatters expect. The backend provides the
 * KPIs, monthly revenue, collections by method and aging buckets; anything it
 * does not break down (a per care plan split, per invoice outstanding rows) is
 * left empty rather than faked.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend response ----------------------------- */

interface FinancialReportKpisDto {
  totalRevenueMinor: number
  revenueDeltaPercent: number | null
  collectionsMinor: number
  collectionRatePercent: number | null
  outstandingMinor: number
  pendingInvoiceCount: number
  writeOffsMinor: number
  lossRatePercent: number | null
}

interface MonthlyRevenuePointDto {
  monthStart: string
  revenueMinor: number
}

interface CollectionMethodShareDto {
  method: string
  amountMinor: number
  sharePercent: number
}

type AgingBucket = 'CURRENT' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS'

interface AgingBucketDto {
  bucket: AgingBucket
  invoiceCount: number
  totalMinor: number
  percent: number
}

interface FinancialReportDto {
  currency: string
  from: string
  to: string
  branch: string | null
  comparison: 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR'
  kpis: FinancialReportKpisDto
  monthlyRevenue: MonthlyRevenuePointDto[]
  collectionsByMethod: CollectionMethodShareDto[]
  aging: AgingBucketDto[]
}

/* ------------------------------- view shapes ------------------------------ */

export interface FinKpis {
  totalRevenue: number
  revenueDelta: number | null
  collections: number
  collectionRate: number | null
  outstanding: number
  pendingCount: number
  writeOffs: number
  lossRate: number | null
}

export interface FinMonthPoint {
  /** "2026-07". */
  id: string
  label: string
  short: string
  revenue: number
}

export interface FinMethodShare {
  method: string
  amount: number
  share: number
}

export interface FinAgingRow {
  id: string
  label: string
  count: number
  amount: number
  share: number
  tone: 'blue' | 'amber' | 'red' | 'slate'
}

export interface FinancialReportView {
  from: string
  to: string
  kpis: FinKpis
  months: FinMonthPoint[]
  methods: FinMethodShare[]
  aging: FinAgingRow[]
}

/* -------------------------------- helpers --------------------------------- */

const major = (minor: number): number => Math.round(minor / 100)
const monthYearFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthShortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

const AGING_META: Record<AgingBucket, { id: string; label: string; tone: FinAgingRow['tone'] }> = {
  CURRENT: { id: '0-30', label: 'Current (0–30 days)', tone: 'blue' },
  DAYS_31_60: { id: '31-60', label: '31–60 days', tone: 'amber' },
  DAYS_61_90: { id: '61-90', label: '61–90 days', tone: 'red' },
  DAYS_90_PLUS: { id: '90-plus', label: '90+ days', tone: 'slate' },
}

function toView(dto: FinancialReportDto): FinancialReportView {
  return {
    from: dto.from.slice(0, 10),
    to: dto.to.slice(0, 10),
    kpis: {
      totalRevenue: major(dto.kpis.totalRevenueMinor),
      revenueDelta: dto.kpis.revenueDeltaPercent,
      collections: major(dto.kpis.collectionsMinor),
      collectionRate: dto.kpis.collectionRatePercent,
      outstanding: major(dto.kpis.outstandingMinor),
      pendingCount: dto.kpis.pendingInvoiceCount,
      writeOffs: major(dto.kpis.writeOffsMinor),
      lossRate: dto.kpis.lossRatePercent,
    },
    months: dto.monthlyRevenue.map((m) => ({
      id: m.monthStart.slice(0, 7),
      label: monthYearFmt.format(new Date(m.monthStart)),
      short: monthShortFmt.format(new Date(m.monthStart)),
      revenue: major(m.revenueMinor),
    })),
    methods: dto.collectionsByMethod.map((m) => ({
      method: m.method,
      amount: major(m.amountMinor),
      share: Math.round(m.sharePercent),
    })),
    aging: dto.aging.map((a) => ({
      ...AGING_META[a.bucket],
      count: a.invoiceCount,
      amount: major(a.totalMinor),
      share: Math.round(a.percent),
    })),
  }
}

/** The inclusive window a range preset asks for, as ISO dates. */
function windowFor(rangeDays: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - rangeDays)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/** `range` is a day count preset ('7' | '30' | '90' | ...); non numeric falls back to 30. */
export function useFinancialReport(range: string) {
  const days = Number.isFinite(Number(range)) && Number(range) > 0 ? Number(range) : 30
  const { from, to } = windowFor(days)
  return useQuery({
    queryKey: ['admin', 'reports', 'financial', range],
    queryFn: async () =>
      toView(
        await api.get<FinancialReportDto>(
          `/admin/billing/reports/financial?from=${from}&to=${to}`,
        ),
      ),
  })
}
