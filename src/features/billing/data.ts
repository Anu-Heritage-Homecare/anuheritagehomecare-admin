import { TODAY } from '@/lib/today'
import {
  ACTIVE_RECIPIENTS,
  recipients,
} from '@/features/care-recipients/data'
import {
  RATE_PER_VISIT,
  getBillingRecord,
} from '@/features/care-recipients/billing-data'
import type { CareLevel, RecipientStatus, Tone } from '@/types'

export { TODAY }

/* ---------------------------------- types --------------------------------- */

export type PlanId = 'flexible' | 'standard' | 'premium' | 'live-in'

/**
 * How a plan meters care. The catalogue's own mockup priced Flexible at a flat
 * monthly rate *and* described it as pay-per-hour, which cannot both be true;
 * the unit is now explicit and the price falls out of it.
 */
export type BillingModel = 'per-visit' | 'per-hour' | 'residency'

export interface Plan {
  id: PlanId
  name: string
  /** Derived from `ACTIVE_RECIPIENTS`; see `planSpecs`. */
  subscribers: number
  model: BillingModel
  /** Visits, hours or residency days per month, according to `model`. */
  unitsPerMonth: number
  /** Monthly list price: `unitsPerMonth × unitRate(model)`. */
  monthlyPrice: number
  /** Attended hours a month, whatever the metering unit. */
  hoursPerMonth: number
  renewalRate: number
  tone: Tone
}

export type SubscriptionStatus = 'active' | 'paused' | 'pending' | 'cancelled'
export type BillingCycle = 'Monthly' | 'Annual'

export interface Subscription {
  id: string
  /** Links to the care recipient directory. */
  recipientId: string
  client: string
  planId: PlanId
  cycle: BillingCycle
  status: SubscriptionStatus
  /** ISO. Only active subscriptions renew. */
  renewsAt?: string
  /** Flexible plans only — hours left in the current package. */
  remainingHours?: number
  autoRenew: boolean
  /**
   * Billed through per-visit invoices rather than a card renewal. Also the
   * flag that decides whether the row links to a billing tab worth opening.
   */
  invoiceBilled: boolean
}

export type TransactionStatus = 'succeeded' | 'pending' | 'processing' | 'failed'

export interface Transaction {
  id: string
  client: string
  amount: number
  method: string
  status: TransactionStatus
  at: string
  /** What the payment settles, so an amount can be traced. */
  reference: string
  /** Recorded by hand: the paying bank, and any note. */
  bank?: string
  note?: string
  /** Who entered it, for a payment recorded by hand. */
  recordedBy?: string
}

export interface HoursPackage {
  contract: string
  client: string
  purchased: number
  used: number
  expiresAt: string
}

/*
 * The visit rate is owned by the recipient billing module and re-exported here
 * rather than redeclared — two copies would eventually disagree.
 *
 * Everything else is a ladder off a single hourly rate, so a plan priced in
 * visits, one priced in hours and one priced in residency days all describe the
 * same underlying cost of care:
 *
 *   hour   ₦150   the base
 *   visit  ₦300   two attended hours
 *   day  ₦1,500   ten attended hours, the live-in convention
 */
export { RATE_PER_VISIT }

/** Attended hours in one scheduled visit. */
export const VISIT_HOURS = 2
/** Attended hours a live-in carer bills in a day; the rest is on-call. */
export const ATTENDED_HOURS_PER_DAY = 10
/** Days in a billed residency month. */
export const RESIDENCY_DAYS = 30

export const RATE_PER_HOUR = RATE_PER_VISIT / VISIT_HOURS
export const RATE_PER_DAY = RATE_PER_HOUR * ATTENDED_HOURS_PER_DAY

/** What one billable unit costs under each metering model. */
export const unitRate: Record<BillingModel, number> = {
  'per-visit': RATE_PER_VISIT,
  'per-hour': RATE_PER_HOUR,
  residency: RATE_PER_DAY,
}

/** Attended hours in one billable unit. */
export const unitHours: Record<BillingModel, number> = {
  'per-visit': VISIT_HOURS,
  'per-hour': 1,
  residency: ATTENDED_HOURS_PER_DAY,
}

export const unitNoun: Record<BillingModel, { one: string; many: string }> = {
  'per-visit': { one: 'visit', many: 'visits' },
  'per-hour': { one: 'hour', many: 'hours' },
  residency: { one: 'day', many: 'days' },
}

/* ---------------------------------- data ---------------------------------- */

/*
 * `share` rather than a subscriber count: the directory owns the org-wide
 * population, and four hand-written counts would sum to something else the
 * moment either side moved. Shares are ordered so the last entry absorbs the
 * rounding remainder, exactly as `revenueByRegion` does.
 *
 * Allocated over `ACTIVE_RECIPIENTS`, not the 342 total — the 31 on-hold and
 * 13 discharged accounts are paused and cancelled subscriptions, and billing
 * them would overstate MRR by roughly 13%.
 */
const planSpecs: (Omit<
  Plan,
  'monthlyPrice' | 'subscribers' | 'hoursPerMonth'
> & {
  share: number
})[] = [
  {
    id: 'standard',
    name: 'Standard Plan',
    share: 0.35,
    model: 'per-visit',
    unitsPerMonth: 22,
    renewalRate: 96,
    tone: 'blue',
  },
  {
    id: 'flexible',
    name: 'Flexible Plan',
    share: 0.28,
    // Ten hours is the contractual monthly minimum, so it is also the floor
    // price — the plan bills by the hour above it.
    model: 'per-hour',
    unitsPerMonth: 10,
    renewalRate: 94,
    tone: 'purple',
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    share: 0.25,
    // Margaret Johnson's invoice stream runs 30–32 visits in a full month
    // (billing-data.ts); 40 would have priced a service nobody receives.
    model: 'per-visit',
    unitsPerMonth: 31,
    renewalRate: 91,
    tone: 'green',
  },
  {
    id: 'live-in',
    name: 'Live-in Plan',
    share: 0.12,
    model: 'residency',
    unitsPerMonth: RESIDENCY_DAYS,
    renewalRate: 88,
    tone: 'amber',
  },
]

export const plans: Plan[] = (() => {
  let allocated = 0
  return planSpecs.map(({ share, ...spec }, i) => {
    const last = i === planSpecs.length - 1
    const subscribers = last
      ? ACTIVE_RECIPIENTS - allocated
      : Math.round(ACTIVE_RECIPIENTS * share)
    allocated += subscribers
    return {
      ...spec,
      subscribers,
      monthlyPrice: spec.unitsPerMonth * unitRate[spec.model],
      hoursPerMonth: spec.unitsPerMonth * unitHours[spec.model],
    }
  })
})()

export const planById = Object.fromEntries(plans.map((p) => [p.id, p])) as Record<
  PlanId,
  Plan
>

/** Care level determines the plan, so the directory and this page agree. */
const planForCareLevel: Record<CareLevel, PlanId> = {
  'Full-Time': 'premium',
  'Part-Time': 'standard',
  Hourly: 'flexible',
  '24-Hour': 'live-in',
}

/** Exhaustive, so a new RecipientStatus is a compile error rather than "active". */
const statusForRecipient: Record<RecipientStatus, SubscriptionStatus> = {
  active: 'active',
  'on-hold': 'paused',
  new: 'pending',
  discharged: 'cancelled',
}

const DAY_MS = 86_400_000

function daysFromToday(days: number, today = TODAY): string {
  return new Date(new Date(`${today}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

/*
 * Keyed by recipient. A single module-level package meant a second flexible
 * subscriber would have inherited this one's contract number, expiry and
 * consumption — the figures looked right only because there is exactly one.
 */
const hoursPackages: Record<string, HoursPackage> = {
  'cr-005': {
    contract: 'CP-FLX-2026',
    client: 'Patricia Brown',
    purchased: 240,
    used: 156,
    expiresAt: '2026-11-30',
  },
}

export function hoursPackageFor(recipientId: string): HoursPackage | undefined {
  return hoursPackages[recipientId]
}

/** The only open package; the dashboard's asset tracker follows this one. */
export const hoursPackage: HoursPackage = hoursPackages['cr-005']

export function hoursRemaining(pkg = hoursPackage): number {
  return pkg.purchased - pkg.used
}

export function hoursConsumedPercent(pkg = hoursPackage): number {
  return Math.round((pkg.used / pkg.purchased) * 100)
}

/*
 * Keyed by recipient id, not array position — sorting or extending the
 * directory would otherwise reshuffle every cycle, renewal date and balance.
 * Renewal dates are offsets from TODAY so the fixtures don't go stale.
 */
const seed: Record<
  string,
  { cycle: BillingCycle; renewsInDays?: number; remainingHours?: number }
> = {
  /*
   * Renewal dates are reconciled with the transaction log: where a payment
   * exists, the next date is one cycle on from it. Margaret has no entry —
   * she is invoice-billed, so no card renewal is ever raised for her.
   */
  'cr-001': { cycle: 'Monthly' },
  // Annual renewal falls today; TX-2026-905 is that transfer still clearing.
  'cr-002': { cycle: 'Annual', renewsInDays: 0 },
  // Eleanor's renewal failed on 07-20, so her cycle date is the 20th.
  'cr-003': { cycle: 'Monthly', renewsInDays: 27 },
  'cr-004': { cycle: 'Monthly' },
  'cr-005': { cycle: 'Monthly', renewsInDays: 3, remainingHours: hoursRemaining() },
  // William's live-in payment failed on 07-17, so his cycle date is the 17th.
  'cr-006': { cycle: 'Monthly', renewsInDays: 24 },
  // TX-2026-908 settled today, so Dorothy's next date is a cycle out.
  'cr-007': { cycle: 'Monthly', renewsInDays: 31 },
  'cr-008': { cycle: 'Monthly' },
}

/*
 * The subscription sample is the eight people in the care recipient directory,
 * so a client here is a client there. Org-wide counts come from `plans`.
 */
export const subscriptions: Subscription[] = recipients.map((r) => {
  const config = seed[r.id] ?? { cycle: 'Monthly' as BillingCycle }
  const status = statusForRecipient[r.status]
  const active = status === 'active'
  // A recipient with a billing record is invoiced per visit; charging the plan
  // price to a card as well would bill the same month twice.
  const invoiceBilled = Boolean(getBillingRecord(r.id))
  return {
    id: `sub-${r.id}`,
    recipientId: r.id,
    client: r.name,
    planId: planForCareLevel[r.careLevel],
    cycle: config.cycle,
    status,
    invoiceBilled,
    // Only an active, card-billed subscription has a next renewal.
    renewsAt:
      active && !invoiceBilled && config.renewsInDays !== undefined
        ? daysFromToday(config.renewsInDays)
        : undefined,
    remainingHours: config.remainingHours,
    autoRenew: active && !invoiceBilled,
  }
})

/*
 * Every amount is a real plan renewal or a real invoice settlement — the source
 * design listed figures no plan or invoice could produce.
 *
 * Margaret Johnson appears only as an invoice settlement, never as a card
 * renewal. Her Premium plan is ₦9,300/mo (31 visits × ₦300) and her billing tab
 * invoices 30–32 visits in a full month, split 80/20 with MedCare Plus — the
 * allowance is the average of delivery, so a card charge on top of the invoices
 * would bill her twice for the same month.
 *
 * The log is org-wide, so it is not limited to the eight tracked recipients.
 */
export const transactions: Transaction[] = [
  {
    id: 'TX-2026-908',
    client: 'Dorothy Martinez',
    amount: 6600,
    method: 'Visa •••• 4242',
    status: 'succeeded',
    at: '2026-07-24',
    reference: 'Standard Plan · monthly renewal',
  },
  {
    id: 'TX-2026-907',
    client: 'Grace Okafor',
    amount: 9300,
    method: 'Visa •••• 7734',
    status: 'succeeded',
    at: '2026-07-24',
    reference: 'Premium Plan · monthly renewal',
  },
  {
    id: 'TX-2026-906',
    client: 'Margaret Johnson',
    amount: 960,
    method: 'Visa •••• 4521',
    status: 'succeeded',
    at: '2026-07-15',
    reference: 'INV-2026-088 · patient share',
  },
  {
    id: 'TX-2026-905',
    client: 'Robert Chen',
    amount: 111_600,
    method: 'Bank transfer',
    status: 'pending',
    at: '2026-07-19',
    reference: 'Premium Plan · annual renewal',
  },
  {
    id: 'TX-2026-904',
    client: 'Eleanor Davis',
    amount: 6600,
    method: 'Mastercard •••• 8812',
    status: 'failed',
    at: '2026-07-20',
    reference: 'Standard Plan · monthly renewal',
  },
  {
    id: 'TX-2026-903',
    client: 'Patricia Brown',
    amount: 1500,
    method: 'Visa •••• 3310',
    status: 'processing',
    at: '2026-07-23',
    reference: 'Flexible Plan · monthly renewal',
  },
  {
    id: 'TX-2026-902',
    client: 'William Taylor',
    amount: 45_000,
    method: 'Bank transfer',
    status: 'failed',
    at: '2026-07-17',
    reference: 'Live-in Plan · monthly renewal',
  },
  /*
   * Settlements of invoice-billed accounts in the receivables book
   * (ledger.ts). Amount and date must match the invoice — `ledgerMismatches()`
   * reports any that drift.
   */
  {
    id: 'TX-2026-910',
    client: 'Okafor Household',
    amount: 4200,
    method: 'Mastercard •••• 6620',
    status: 'succeeded',
    at: '2026-07-23',
    reference: 'INV-2026-158 · invoice settlement',
  },
  {
    id: 'TX-2026-909',
    client: 'Adeyemi Family',
    amount: 7800,
    method: 'Bank transfer',
    status: 'succeeded',
    at: '2026-07-22',
    reference: 'INV-2026-163 · invoice settlement',
  },
  {
    id: 'TX-2026-901',
    client: 'Musa Family',
    amount: 5400,
    method: 'Bank transfer',
    status: 'succeeded',
    at: '2026-07-18',
    reference: 'INV-2026-161 · invoice settlement',
  },
  {
    id: 'TX-2026-899',
    client: 'Babalola Senior Living',
    amount: 27_900,
    method: 'Bank transfer',
    status: 'succeeded',
    at: '2026-07-14',
    reference: 'INV-2026-156 · invoice settlement',
  },
  {
    id: 'TX-2026-897',
    client: 'Adeyemi Family',
    amount: 8100,
    method: 'Bank transfer',
    status: 'succeeded',
    at: '2026-07-10',
    reference: 'INV-2026-157 · invoice settlement',
  },
  {
    id: 'TX-2026-895',
    client: 'Okafor Household',
    amount: 4200,
    method: 'Mastercard •••• 6620',
    status: 'succeeded',
    at: '2026-07-02',
    reference: 'INV-2026-152 · invoice settlement',
  },
]

/** Monthly revenue that isn't subscription MRR — hours top-ups and one-offs. */
export const oneOffRevenue = 271_600

export const retentionMonths = 12

/** Share of monthly revenue by market. The last entry takes the remainder. */
export const regionShares: { id: string; label: string; share: number }[] = [
  { id: 'ng', label: 'Nigeria', share: 0.75 },
  { id: 'us', label: 'United States', share: 0.25 },
]

/**
 * Twelve months, oldest first, as a fraction of the current month. The latest
 * point is 1, so the chart cannot drift from the revenue headline.
 */
export const revenueTrend: { month: string; factor: number }[] = [
  { month: 'Aug', factor: 0.787 },
  { month: 'Sep', factor: 0.813 },
  { month: 'Oct', factor: 0.83 },
  { month: 'Nov', factor: 0.822 },
  { month: 'Dec', factor: 0.858 },
  { month: 'Jan', factor: 0.881 },
  { month: 'Feb', factor: 0.888 },
  { month: 'Mar', factor: 0.913 },
  { month: 'Apr', factor: 0.935 },
  { month: 'May', factor: 0.949 },
  { month: 'Jun', factor: 0.975 },
  { month: 'Jul', factor: 1 },
]

/* -------------------------------- formatting ------------------------------- */

const money = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

export function formatMoney(amount: number): string {
  return money.format(amount)
}

/** ₦13.9M / ₦294K — for axis ticks and dense cards. */
export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1000) return `₦${Math.round(amount / 1000)}K`
  return `₦${Math.round(amount)}`
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`))
}

/* --------------------------------- derived -------------------------------- */

/**
 * Every headline is computed. In the source design the plan cards summed to
 * ₦293,500 beside a stated monthly revenue of ₦284,500, the failed-payment KPI
 * said 4 while the transaction filter said 2, and one client held two different
 * plans in two different tables.
 */

export function planRevenue(plan: Plan): number {
  return plan.subscribers * plan.monthlyPrice
}

export function totalSubscribers(): number {
  return plans.reduce((sum, p) => sum + p.subscribers, 0)
}

/** Recurring revenue: the subscription base only. */
export function mrr(): number {
  return plans.reduce((sum, p) => sum + planRevenue(p), 0)
}

export function monthlyRevenue(): number {
  return mrr() + oneOffRevenue
}

/** Settled payments dated today. */
export function todaysRevenue(today = TODAY): number {
  return transactions
    .filter((t) => t.at === today && t.status === 'succeeded')
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Total monthly revenue, oldest first. Anchored on `monthlyRevenue()` — not on
 * MRR — so the final point is the headline KPI and the growth badge below is
 * measured against the same series the chart draws.
 */
export function revenueSeries(): { label: string; value: number }[] {
  const current = monthlyRevenue()
  return revenueTrend.map((t) => ({
    label: t.month,
    value: Math.round(current * t.factor),
  }))
}

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * The last `count` months of `revenueSeries`, labelled with their year
 * ("Feb 2026"). Months are counted back from TODAY's, so the labels cannot
 * drift from the series.
 */
export function revenueMonths(count: number, today = TODAY) {
  const series = revenueSeries()
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  return series.slice(-count).map((point, i, window) => {
    const at = new Date(d)
    at.setUTCMonth(d.getUTCMonth() - (window.length - 1 - i))
    return { label: monthYear.format(at), value: point.value }
  })
}

/**
 * Revenue over the last `count` months, and its change against the `count`
 * months before. Needs `2 × count` months of trend.
 */
export function revenueOverWindow(count: number): { total: number; change: number } {
  const series = revenueSeries()
  const sum = (xs: { value: number }[]) => xs.reduce((s, p) => s + p.value, 0)
  const total = sum(series.slice(-count))
  const previous = sum(series.slice(-2 * count, -count))
  return {
    total,
    change: Math.round(((total - previous) / previous) * 1000) / 10,
  }
}

/**
 * Month-on-month growth of the last two points of the trend. Derived rather
 * than stated: the source design showed a +12.5% badge that matched nothing.
 */
export function revenueGrowth(): number {
  const series = revenueSeries()
  const [prev, current] = series.slice(-2)
  return Math.round(((current.value - prev.value) / prev.value) * 1000) / 10
}

export function averageMonthlySpend(): number {
  return Math.round(monthlyRevenue() / totalSubscribers())
}

export function customerLifetimeValue(): number {
  return averageMonthlySpend() * retentionMonths
}

/** Premium and Live-in as a share of the subscriber base. */
export function premiumExpansionRatio(): number {
  const upper = plans
    .filter((p) => p.id === 'premium' || p.id === 'live-in')
    .reduce((sum, p) => sum + p.subscribers, 0)
  return Math.round((upper / totalSubscribers()) * 100)
}

/** Region amounts, with the final entry absorbing rounding so they sum exactly. */
export function revenueByRegion(): {
  id: string
  label: string
  amount: number
  share: number
}[] {
  const total = monthlyRevenue()
  let allocated = 0
  return regionShares.map((region, i) => {
    const last = i === regionShares.length - 1
    const amount = last ? total - allocated : Math.round(total * region.share)
    allocated += amount
    return { ...region, amount, share: Math.round((amount / total) * 100) }
  })
}

export function transactionCounts(): Record<TransactionStatus, number> {
  const counts: Record<TransactionStatus, number> = {
    succeeded: 0,
    pending: 0,
    processing: 0,
    failed: 0,
  }
  for (const t of transactions) counts[t.status] += 1
  return counts
}

/**
 * The payment already raised against a subscription's next renewal, if any.
 * Matched on client, plan and a one-week window, so last cycle's failed charge
 * isn't mistaken for this one.
 */
export function renewalPayment(sub: Subscription): Transaction | undefined {
  if (!sub.renewsAt) return undefined
  const plan = planById[sub.planId]
  const due = new Date(`${sub.renewsAt}T00:00:00Z`).getTime()
  return transactions.find((t) => {
    if (t.client !== sub.client || !t.reference.startsWith(plan.name)) return false
    const at = new Date(`${t.at}T00:00:00Z`).getTime()
    return Math.abs(at - due) <= 7 * DAY_MS
  })
}

/**
 * Active subscriptions renewing within `days`, inclusive of today. A renewal
 * whose payment has already settled is not due — listing it beside a "Renew
 * now" button would ask the operator to charge the same cycle twice.
 */
export function renewalsDue(days: number, today = TODAY): Subscription[] {
  const now = new Date(`${today}T00:00:00Z`).getTime()
  return subscriptions.filter((s) => {
    if (!s.renewsAt || s.status !== 'active') return false
    if (renewalPayment(s)?.status === 'succeeded') return false
    const at = new Date(`${s.renewsAt}T00:00:00Z`).getTime()
    return at >= now && at - now <= days * DAY_MS
  })
}

/**
 * The most recent failed charge against a subscription. The renewal date rolls
 * forward a cycle after a failure, so without this the workspace would show a
 * client as Active with auto-renew on and no sign the last charge bounced —
 * while the overview counted them under "Failed payments".
 */
export function failedPayment(sub: Subscription): Transaction | undefined {
  const plan = planById[sub.planId]
  const onPlan = transactions
    .filter((t) => t.client === sub.client && t.reference.startsWith(plan.name))
    .sort((a, b) => b.at.localeCompare(a.at))
  // Only if it is genuinely the latest: a failure followed by a successful
  // retry must not keep asserting that the last charge bounced.
  return onPlan[0]?.status === 'failed' ? onPlan[0] : undefined
}

/** The naira value of a prepaid hours package, at the base hourly rate. */
export function packageValue(pkg = hoursPackage): number {
  return pkg.purchased * RATE_PER_HOUR
}

/** The renewal amount for a subscription, from its plan and cycle. */
export function renewalAmount(sub: Subscription): number {
  const plan = planById[sub.planId]
  return sub.cycle === 'Annual' ? plan.monthlyPrice * 12 : plan.monthlyPrice
}
