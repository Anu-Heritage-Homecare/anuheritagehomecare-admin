/**
 * The care plan catalogue cards, fetched from the backend for one market
 * (`GET /admin/plans-billing/plans`). The cards render live: name, description,
 * status, price, subscribers, retention and estimated monthly revenue.
 *
 * Money note. Each card carries its own `currency` beside its minor unit price
 * and estimated revenue, so every money string is formatted with that card's
 * currency through a local Intl.NumberFormat (not the NGN only `formatMoney`).
 *
 * Scope note. Only the catalogue cards are live. The nine configuration tabs
 * below the cards (general, pricing, services, eligibility and the rest) render
 * from the local plan fixtures keyed by slug; the backend plan id is a UUID with
 * no slug, and most of those tabs have no backend field, so the detail panel is
 * left on the fixtures and noted as a drop in the report.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend response ----------------------------- */

interface ManagedPlanCardDto {
  id: string
  coreType: string | null
  isCore: boolean
  wiredToCheckout: boolean
  name: string
  description: string
  status: string
  billingModel: string
  monthlyPriceMinor: number | null
  currency: string
  subscribers: number
  retentionPercent: number | null
  estRevenueMinor: number
}

interface ManagedPlanCatalogueDto {
  currency: string
  plans: ManagedPlanCardDto[]
}

/** One catalogue card, mapped with its money already formatted to its currency. */
export interface CarePlanCard {
  id: string
  name: string
  description: string
  status: string
  /** True when the backend status is active. */
  isActive: boolean
  billingModel: string
  isCore: boolean
  coreType: string | null
  wiredToCheckout: boolean
  subscribers: number
  retentionPercent: number | null
  monthlyPriceLabel: string
  estRevenueLabel: string
}

export interface CarePlansView {
  currency: string
  plans: CarePlanCard[]
}

/* -------------------------------- mapper ---------------------------------- */

const DASH = '—'

function toView(dto: ManagedPlanCatalogueDto): CarePlansView {
  return {
    currency: dto.currency,
    plans: dto.plans.map((card) => {
      const money = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: card.currency,
        maximumFractionDigits: 0,
      })
      return {
        id: card.id,
        name: card.name,
        description: card.description,
        status: card.status,
        isActive: card.status.toUpperCase() === 'ACTIVE',
        billingModel: card.billingModel,
        isCore: card.isCore,
        coreType: card.coreType,
        wiredToCheckout: card.wiredToCheckout,
        subscribers: card.subscribers,
        retentionPercent: card.retentionPercent,
        monthlyPriceLabel:
          card.monthlyPriceMinor === null ? DASH : money.format(card.monthlyPriceMinor / 100),
        estRevenueLabel: money.format(card.estRevenueMinor / 100),
      }
    }),
  }
}

export function useCarePlans(currency: string, includeArchived: boolean) {
  const params = new URLSearchParams({ currency })
  if (includeArchived) params.set('includeArchived', 'true')
  return useQuery({
    queryKey: ['admin', 'plans-billing', 'plans', currency, includeArchived] as const,
    queryFn: async () =>
      toView(await api.get<ManagedPlanCatalogueDto>(`/admin/plans-billing/plans?${params.toString()}`)),
  })
}
