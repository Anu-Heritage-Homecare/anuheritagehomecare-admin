/**
 * The Plans and Billing overview, fetched from the backend
 * (`GET /admin/plans-billing`) for one market, mapped into the figures the
 * billing dashboard renders.
 *
 * Money note. The overview carries money as integer minor units under a single
 * top level `currency`. Figures that the page formats through the NGN only
 * `formatMoney` from data.ts are passed as whole units (minor / 100), so a USD
 * market reads the right number with a naira symbol; the currency correct
 * string (`revenueLabel`) is exposed alongside for callers that render a string.
 *
 * What is live and what is not. The backend overview provides the revenue
 * headline and the monthly revenue trend, which this hook maps. The dashboard's
 * other panels (outstanding and overdue balances, the aging breakdown, the
 * collection rate, recent payments and the billing activity feed) are the
 * organisation receivables book, which has no backend source yet; they stay on
 * the local ledger fixtures and are noted as a drop in the report.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend response ----------------------------- */

interface PlansBillingKpisDto {
  billedTodayMinor: number
  monthlyRevenueMinor: number
  monthlyGrowthPercent: number | null
  activeSubscriptions: number
  pendingCareRequests: number
  newSubscriptionsThisMonth: number
  pastDueSubscriptions: number
}

interface RevenuePointDto {
  label: string
  monthStart: string
  totalMinor: number
}

interface PlansBillingOverviewDto {
  currency: string
  generatedAt: string
  kpis: PlansBillingKpisDto
  revenueSeries: RevenuePointDto[]
}

/** The overview, mapped to the dashboard's live figures. */
export interface PlansBillingView {
  currency: string
  /** Whole units for the NGN only `formatMoney`; see the money note. */
  monthlyRevenue: number
  /** Currency correct string for the same figure. */
  revenueLabel: string
  monthlyGrowthPercent: number | null
  billedToday: number
  billedTodayLabel: string
  activeSubscriptions: number
  pendingCareRequests: number
  newSubscriptionsThisMonth: number
  pastDueSubscriptions: number
  /** Monthly revenue trend, oldest first, in whole units. */
  revenuePoints: { label: string; value: number }[]
}

/* -------------------------------- mapper ---------------------------------- */

function toView(dto: PlansBillingOverviewDto): PlansBillingView {
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: dto.currency,
    maximumFractionDigits: 0,
  })
  return {
    currency: dto.currency,
    monthlyRevenue: dto.kpis.monthlyRevenueMinor / 100,
    revenueLabel: money.format(dto.kpis.monthlyRevenueMinor / 100),
    monthlyGrowthPercent: dto.kpis.monthlyGrowthPercent,
    billedToday: dto.kpis.billedTodayMinor / 100,
    billedTodayLabel: money.format(dto.kpis.billedTodayMinor / 100),
    activeSubscriptions: dto.kpis.activeSubscriptions,
    pendingCareRequests: dto.kpis.pendingCareRequests,
    newSubscriptionsThisMonth: dto.kpis.newSubscriptionsThisMonth,
    pastDueSubscriptions: dto.kpis.pastDueSubscriptions,
    revenuePoints: dto.revenueSeries.map((point) => ({
      label: point.label,
      value: point.totalMinor / 100,
    })),
  }
}

export function usePlansBilling(currency: string) {
  return useQuery({
    queryKey: ['admin', 'plans-billing', 'overview', currency] as const,
    queryFn: async () =>
      toView(await api.get<PlansBillingOverviewDto>(`/admin/plans-billing?currency=${currency}`)),
  })
}
