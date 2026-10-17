/**
 * The discounts and adjustments on an invoice being drafted, and the totals
 * they produce. Discounts come off the services subtotal; manual adjustments
 * move it either way; VAT is charged on what is left.
 */
import { TODAY } from '@/lib/today'

export interface DraftDiscount {
  id: string
  label: string
  detail: string
  kind: 'percent' | 'amount'
  /** Percent (0–100] or naira, according to `kind`. */
  value: number
}

export interface DraftAdjustment {
  id: string
  label: string
  /** Naira; negative reduces the invoice. */
  amount: number
}

/** Care this long earns the loyalty discount. */
export const LOYALTY_MONTHS = 12
export const LOYALTY_PERCENT = 5

export const loyaltyDiscount: DraftDiscount = {
  id: 'loyalty',
  label: 'Loyalty Discount',
  detail: 'Applied automatically to long-term care plans',
  kind: 'percent',
  value: LOYALTY_PERCENT,
}

/** True when care started at least `LOYALTY_MONTHS` before today. */
export function earnsLoyalty(startedAt: string | undefined, today = TODAY): boolean {
  if (!startedAt) return false
  const [y, m, d] = startedAt.split('-').map(Number)
  const threshold = new Date(Date.UTC(y, m - 1 + LOYALTY_MONTHS, d))
  return threshold.toISOString().slice(0, 10) <= today
}

export function discountAmount(d: DraftDiscount, subtotal: number): number {
  return d.kind === 'percent' ? Math.round((subtotal * d.value) / 100) : d.value
}

export interface DraftTotals {
  subtotal: number
  discounts: number
  adjustments: number
  taxable: number
  vat: number
  due: number
}

export function draftTotals(
  subtotal: number,
  discounts: DraftDiscount[],
  adjustments: DraftAdjustment[],
  taxRatePercent: number,
): DraftTotals {
  const off = discounts.reduce((sum, d) => sum + discountAmount(d, subtotal), 0)
  const moved = adjustments.reduce((sum, a) => sum + a.amount, 0)
  // An invoice never goes below zero; the form stops most ways of trying.
  const taxable = Math.max(0, subtotal - off + moved)
  const vat = Math.round((taxable * taxRatePercent) / 100)
  return { subtotal, discounts: off, adjustments: moved, taxable, vat, due: taxable + vat }
}
