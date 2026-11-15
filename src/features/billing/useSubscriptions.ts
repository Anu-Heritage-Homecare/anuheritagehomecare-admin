/**
 * The Active Subscriptions table and its KPI tiles, fetched live for one market
 * (`GET /admin/plans-billing/subscriptions/enriched` and `.../subscriptions/kpis`),
 * plus the lifecycle, plan change and cancel mutations the record footer exposes.
 *
 * Money note. Each enriched row carries its own `currency` beside its
 * `monthlyPriceMinor`, formatted here through a local Intl.NumberFormat so a USD
 * market reads dollars; the row's `monthlyPriceLabel` is a currency correct
 * string.
 *
 * Scope note. The per record detail drawer renders from `SubscriptionTabs`,
 * which consumes the rich local `SubscriptionDetail` fixture (recipient profile,
 * invoices, timeline, audit) that the thinner backend detail does not carry, and
 * that component is off limits to edit. The table and tiles are live; the drawer
 * stays on the fixtures and is noted as a drop in the report.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend response ----------------------------- */

interface FlexibleHoursDto {
  allocatedHours: number
  usedHours: number
  remainingHours: number
  percentUsed: number
}

interface EnrichedSubscriptionRowDto {
  id: string
  clientName: string | null
  patientAge: number | null
  accountHolderName: string | null
  planType: string
  planName: string
  status: string
  autoRenew: boolean
  billingCycle: string
  renewalDate: string | null
  monthlyPriceMinor: number
  currency: string
  coordinatorName: string | null
  caregiverName: string | null
  flexibleHours: FlexibleHoursDto | null
}

interface EnrichedSubscriptionListDto {
  currency: string
  total: number
  page: number
  pageSize: number
  rows: EnrichedSubscriptionRowDto[]
}

interface SubscriptionKpisDto {
  currency: string
  totalActive: number
  paused: number
  pendingActivation: number
  cancelled: number
  renewingSoon: number
  expiring: number
  capped: boolean
}

/* ------------------------------- view model ------------------------------- */

export interface SubscriptionRow {
  id: string
  familyName: string
  patient: string
  age: number | null
  planName: string
  status: string
  autoRenew: boolean
  billingCycle: string
  renewalDate: string | null
  monthlyPriceLabel: string
  coordinator: string
  caregiver: string
  flexibleHours: FlexibleHoursDto | null
}

export interface SubscriptionsView {
  rows: SubscriptionRow[]
  total: number
  page: number
  pageSize: number
}

export interface SubscriptionKpisView {
  totalActive: number
  paused: number
  pendingActivation: number
  cancelled: number
  renewingSoon: number
  expiring: number
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'
const UNASSIGNED = 'Unassigned'

function familyNameFor(name: string | null): string {
  if (!name) return DASH
  const surname = name.trim().split(/\s+/).at(-1) ?? name
  return `${surname} Family`
}

/* -------------------------------- mappers --------------------------------- */

function toListView(dto: EnrichedSubscriptionListDto): SubscriptionsView {
  return {
    rows: dto.rows.map((row) => {
      const money = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: row.currency,
        maximumFractionDigits: 0,
      })
      return {
        id: row.id,
        familyName: familyNameFor(row.accountHolderName ?? row.clientName),
        patient: row.clientName ?? DASH,
        age: row.patientAge,
        planName: row.planName,
        status: row.status,
        autoRenew: row.autoRenew,
        billingCycle: row.billingCycle,
        renewalDate: row.renewalDate,
        monthlyPriceLabel: money.format(row.monthlyPriceMinor / 100),
        coordinator: row.coordinatorName ?? UNASSIGNED,
        caregiver: row.caregiverName ?? UNASSIGNED,
        flexibleHours: row.flexibleHours,
      }
    }),
    total: dto.total,
    page: dto.page,
    pageSize: dto.pageSize,
  }
}

function toKpisView(dto: SubscriptionKpisDto): SubscriptionKpisView {
  return {
    totalActive: dto.totalActive,
    paused: dto.paused,
    pendingActivation: dto.pendingActivation,
    cancelled: dto.cancelled,
    renewingSoon: dto.renewingSoon,
    expiring: dto.expiring,
  }
}

/* --------------------------------- hooks ---------------------------------- */

const LIST_KEY = ['admin', 'plans-billing', 'subscriptions'] as const

export function useSubscriptions(
  currency: string,
  status: string | null,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams({ currency, page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)
  return useQuery({
    queryKey: [...LIST_KEY, 'enriched', currency, status, page, pageSize] as const,
    queryFn: async () =>
      toListView(
        await api.get<EnrichedSubscriptionListDto>(
          `/admin/plans-billing/subscriptions/enriched?${params.toString()}`,
        ),
      ),
  })
}

export function useSubscriptionKpis(currency: string) {
  return useQuery({
    queryKey: [...LIST_KEY, 'kpis', currency] as const,
    queryFn: async () =>
      toKpisView(
        await api.get<SubscriptionKpisDto>(
          `/admin/plans-billing/subscriptions/kpis?currency=${currency}`,
        ),
      ),
  })
}

export type LifecycleAction =
  | 'PAUSE'
  | 'RESUME'
  | 'ENABLE_AUTO_RENEW'
  | 'DISABLE_AUTO_RENEW'
  | 'FORCE_RENEW'

export function useSubscriptionActions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: LIST_KEY })

  const lifecycle = useMutation({
    mutationFn: ({ id, action }: { id: string; action: LifecycleAction }) =>
      api.post<void>(`/admin/plans-billing/subscriptions/${id}/lifecycle`, { action }),
    onSuccess: invalidate,
  })
  const changePlan = useMutation({
    mutationFn: ({ id, planType }: { id: string; planType: string }) =>
      api.post<void>(`/admin/plans-billing/subscriptions/${id}/plan`, { planType }),
    onSuccess: invalidate,
  })
  const cancel = useMutation({
    mutationFn: (id: string) => api.post<void>(`/admin/plans-billing/subscriptions/${id}/cancel`),
    onSuccess: invalidate,
  })
  return { lifecycle, changePlan, cancel }
}
