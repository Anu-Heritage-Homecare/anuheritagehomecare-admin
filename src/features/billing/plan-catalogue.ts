import {
  ATTENDED_HOURS_PER_DAY,
  RATE_PER_HOUR,
  RESIDENCY_DAYS,
  VISIT_HOURS,
  formatMoney,
  planById,
  planRevenue,
  totalSubscribers,
  unitHours,
  unitNoun,
  unitRate,
} from './data'
import type { BillingModel, Plan, PlanId } from './data'
import { TODAY } from '@/lib/today'

export { TODAY }

/* ---------------------------------- types --------------------------------- */

export interface PricingRow {
  id: string
  label: string
  value: string
  hint?: string
  /** Rendered as the plan's headline rate. */
  emphasis?: boolean
}

export interface ServiceLine {
  id: string
  label: string
  description: string
}

/** Narrowed to the catalogue's actual ids below; see `serviceCatalogue`. */
export type ServiceId =
  | 'medication'
  | 'personal'
  | 'companionship'
  | 'meals'
  | 'mobility'
  | 'clinical'
  | 'overnight'
  | 'transport'

export interface RuleRow {
  id: string
  label: string
  value: string
}

export interface VersionEntry {
  id: string
  version: string
  /** ISO. */
  at: string
  author: string
  summary: string
}

export interface PlanDetail {
  summary: string
  targetAudience: string
  countries: string[]
  /** Included service ids; everything else in `serviceCatalogue` is off. */
  services: ServiceId[]
  eligibility: RuleRow[]
  coverage: string[]
  billingRules: RuleRow[]
  renewalRules: RuleRow[]
  versions: VersionEntry[]
}

/* --------------------------------- pricing -------------------------------- */

/**
 * Surcharges are multipliers on the plan's own unit rate rather than four
 * hand-typed prices, so an hourly plan and a residency plan carry the same
 * premium for the same disruption.
 */
export const EMERGENCY_UPLIFT = 0.45
export const WEEKEND_UPLIFT = 0.25

/**
 * Discounts apply to hours bought *beyond* the monthly allowance. Applying them
 * to the allowance itself would make the list price and the invoice disagree.
 */
export const volumeTiers: { fromHours: number; discount: number }[] = [
  { fromHours: 50, discount: 0.1 },
  { fromHours: 100, discount: 0.15 },
]

export function emergencyRate(plan: Plan): number {
  return Math.round(unitRate[plan.model] * (1 + EMERGENCY_UPLIFT))
}

export function weekendRate(plan: Plan): number {
  return Math.round(unitRate[plan.model] * (1 + WEEKEND_UPLIFT))
}

/** True when rounding moved the printed rate off the exact multiplier. */
export function isRounded(exact: number): boolean {
  return Math.round(exact) !== exact
}

const unitLabel: Record<BillingModel, string> = {
  'per-visit': 'visit',
  'per-hour': 'hour',
  residency: 'day',
}

export function rateRows(plan: Plan): PricingRow[] {
  const per = unitLabel[plan.model]
  return [
    {
      id: 'base',
      label: 'Base rate',
      value: `${formatMoney(unitRate[plan.model], 'NGN')} / ${per}`,
      hint:
        plan.model === 'per-visit'
          ? `One visit is ${VISIT_HOURS} attended hours`
          : plan.model === 'residency'
            ? `${ATTENDED_HOURS_PER_DAY} attended hours a day; the balance is on-call`
            : 'Billed to the quarter hour',
      emphasis: true,
    },
    {
      id: 'emergency',
      label: 'Emergency dispatch',
      value: `${formatMoney(emergencyRate(plan), 'NGN')} / ${per}`,
      hint: `${Math.round(EMERGENCY_UPLIFT * 100)}% above base${
        isRounded(unitRate[plan.model] * (1 + EMERGENCY_UPLIFT))
          ? ', rounded to the naira'
          : ''
      }`,
    },
    {
      id: 'weekend',
      label: 'Weekend premium',
      value: `${formatMoney(weekendRate(plan), 'NGN')} / ${per}`,
      hint: `${Math.round(WEEKEND_UPLIFT * 100)}% above base${
        isRounded(unitRate[plan.model] * (1 + WEEKEND_UPLIFT))
          ? ', rounded to the naira'
          : ''
      }`,
    },
    {
      id: 'minimum',
      label: 'Monthly allowance',
      value: `${plan.unitsPerMonth} ${
        plan.unitsPerMonth === 1
          ? unitNoun[plan.model].one
          : unitNoun[plan.model].many
      }`,
      hint: `${plan.hoursPerMonth} attended hours`,
    },
    {
      id: 'list',
      label: 'Monthly list price',
      value: formatMoney(plan.monthlyPrice, 'NGN'),
      hint: `${plan.unitsPerMonth} × ${formatMoney(unitRate[plan.model], 'NGN')}`,
    },
  ]
}

/* -------------------------------- services -------------------------------- */

export const serviceCatalogue = [
  {
    id: 'medication',
    label: 'Medication support',
    description: 'Timely administration and prescription management.',
  },
  {
    id: 'personal',
    label: 'Personal care',
    description: 'Assistance with bathing, grooming and dressing.',
  },
  {
    id: 'companionship',
    label: 'Companionship',
    description: 'Social engagement, activities and emotional support.',
  },
  {
    id: 'meals',
    label: 'Meal preparation',
    description: 'Nutritional planning and cooking assistance.',
  },
  {
    id: 'mobility',
    label: 'Mobility assistance',
    description: 'Transfers, walking support and fall prevention.',
  },
  {
    id: 'clinical',
    label: 'Clinical oversight',
    description: 'Registered-nurse review of vitals and care response.',
  },
  {
    id: 'overnight',
    label: 'Overnight cover',
    description: 'Waking or sleeping night attendance.',
  },
  {
    id: 'transport',
    label: 'Transport and errands',
    description: 'Appointments, shopping and community outings.',
  },
  // `as const satisfies` rather than a `ServiceLine[]` annotation: the
  // annotation widened `id` to `string`, so a mistyped service id compiled
  // fine and produced a plan-exclusion warning on every plan, forever.
] as const satisfies readonly (ServiceLine & { id: ServiceId })[]

/* ------------------------------ plan details ------------------------------ */

const details: Record<PlanId, PlanDetail> = {
  standard: {
    summary:
      'Comprehensive routine care providing daily support and basic health tracking on a fixed schedule.',
    targetAudience: 'Families needing predictable weekday cover',
    countries: ['Nigeria', 'United States'],
    services: ['medication', 'personal', 'companionship', 'meals', 'mobility'],
    eligibility: [
      { id: 'age', label: 'Minimum age', value: '60 years' },
      { id: 'level', label: 'Care levels', value: 'Part-Time' },
      { id: 'assessment', label: 'Assessment', value: 'In-home, within 5 days' },
      { id: 'clinical', label: 'Clinical exclusions', value: 'Ventilator dependence' },
    ],
    coverage: ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan'],
    billingRules: [
      { id: 'cycle', label: 'Billing cycle', value: 'Monthly, in arrears' },
      { id: 'invoice', label: 'Invoice cadence', value: 'Semi-monthly' },
      { id: 'late', label: 'Late fee', value: '2% after 14 days' },
      { id: 'insurance', label: 'Insurance', value: 'Direct billing supported' },
    ],
    renewalRules: [
      { id: 'auto', label: 'Auto-renewal', value: 'Enabled by default' },
      { id: 'grace', label: 'Grace period', value: '7 days' },
      { id: 'notice', label: 'Cancellation notice', value: '30 days' },
      { id: 'change', label: 'Mid-cycle tier change', value: 'Prorated from the next visit' },
    ],
    versions: [
      {
        id: 'std-v4',
        version: 'v4.0',
        at: '2026-06-18',
        author: 'Sarah Jenkins',
        summary: 'Added mobility assistance to the included services.',
      },
      {
        id: 'std-v3',
        version: 'v3.2',
        at: '2026-03-02',
        author: 'Mike Chen',
        summary: 'Extended coverage to Ibadan.',
      },
      {
        id: 'std-v2',
        version: 'v3.0',
        at: '2025-11-14',
        author: 'Sarah Jenkins',
        summary: 'Moved from weekly to semi-monthly invoicing.',
      },
    ],
  },
  flexible: {
    summary:
      'Pay-per-hour care for families who need occasional or variable support, drawn from a prepaid balance.',
    targetAudience: 'Families with intermittent care needs',
    countries: ['Nigeria', 'United States'],
    services: ['personal', 'companionship', 'meals'],
    eligibility: [
      { id: 'age', label: 'Minimum age', value: '60 years' },
      { id: 'level', label: 'Care levels', value: 'Hourly' },
      { id: 'assessment', label: 'Assessment', value: 'Remote, same day' },
      { id: 'clinical', label: 'Clinical exclusions', value: 'Any requiring nurse oversight' },
    ],
    coverage: ['Lagos', 'Abuja'],
    billingRules: [
      { id: 'cycle', label: 'Billing cycle', value: 'Monthly, drawn from balance' },
      { id: 'invoice', label: 'Invoice cadence', value: 'On top-up' },
      { id: 'minimum', label: 'Minimum draw', value: '2 hours per booking' },
      {
        id: 'expiry',
        label: 'Balance expiry',
        value: '12 months from purchase',
      },
    ],
    renewalRules: [
      { id: 'auto', label: 'Auto-renewal', value: 'Enabled by default' },
      { id: 'grace', label: 'Grace period', value: '7 days' },
      { id: 'notice', label: 'Cancellation notice', value: '14 days' },
      {
        id: 'unused',
        label: 'Unused hours',
        // Rollover is bounded by the same 12-month expiry the billing rules
        // state; "while the contract is live" contradicted it two tabs away.
        value: 'Roll over until the balance expires',
      },
    ],
    versions: [
      {
        id: 'flx-v3',
        version: 'v3.1',
        at: '2026-07-02',
        author: 'Sarah Jenkins',
        summary: 'Raised the monthly minimum from 8 to 10 hours.',
      },
      {
        id: 'flx-v2',
        version: 'v3.0',
        at: '2026-04-11',
        author: 'Mike Chen',
        summary: 'Introduced rollover for unused balance.',
      },
    ],
  },
  premium: {
    summary:
      'High-touch daily care including medical oversight and clinical coordination with the care team.',
    targetAudience: 'Clients with active clinical needs',
    countries: ['Nigeria', 'United States'],
    services: [
      'medication',
      'personal',
      'companionship',
      'meals',
      'mobility',
      'clinical',
      'transport',
    ],
    eligibility: [
      { id: 'age', label: 'Minimum age', value: '60 years' },
      { id: 'level', label: 'Care levels', value: 'Full-Time' },
      { id: 'assessment', label: 'Assessment', value: 'Clinical, within 48 hours' },
      { id: 'clinical', label: 'Clinical exclusions', value: 'None' },
    ],
    coverage: ['Lagos', 'Abuja', 'Port Harcourt'],
    billingRules: [
      { id: 'cycle', label: 'Billing cycle', value: 'Monthly, in arrears' },
      { id: 'invoice', label: 'Invoice cadence', value: 'Semi-monthly' },
      { id: 'late', label: 'Late fee', value: '2% after 14 days' },
      { id: 'insurance', label: 'Insurance', value: 'Direct billing, 80% typical cover' },
    ],
    renewalRules: [
      { id: 'auto', label: 'Auto-renewal', value: 'Enabled by default' },
      { id: 'grace', label: 'Grace period', value: '7 days' },
      { id: 'notice', label: 'Cancellation notice', value: '30 days' },
      { id: 'review', label: 'Care review', value: 'Required every 90 days' },
    ],
    versions: [
      {
        id: 'prm-v5',
        version: 'v5.0',
        at: '2026-07-09',
        author: 'Dr. Jane Foster',
        summary: 'Allowance corrected from 40 to 31 visits to match delivery.',
      },
      {
        id: 'prm-v4',
        version: 'v4.1',
        at: '2026-05-20',
        author: 'Sarah Jenkins',
        summary: 'Added transport and errands.',
      },
      {
        id: 'prm-v3',
        version: 'v4.0',
        at: '2026-01-08',
        author: 'Dr. Jane Foster',
        summary: 'Made the 90-day care review mandatory.',
      },
    ],
  },
  'live-in': {
    summary:
      'Full-time physical and medical residency support with continuous cover and shift handover.',
    targetAudience: 'Clients needing round-the-clock presence',
    countries: ['Nigeria'],
    services: [
      'medication',
      'personal',
      'companionship',
      'meals',
      'mobility',
      'clinical',
      'overnight',
      'transport',
    ],
    eligibility: [
      { id: 'age', label: 'Minimum age', value: '60 years' },
      { id: 'level', label: 'Care levels', value: '24-Hour' },
      { id: 'assessment', label: 'Assessment', value: 'Clinical plus home survey' },
      { id: 'housing', label: 'Housing', value: 'Private room for the carer required' },
    ],
    coverage: ['Lagos', 'Abuja'],
    billingRules: [
      { id: 'cycle', label: 'Billing cycle', value: `Monthly, ${RESIDENCY_DAYS}-day` },
      { id: 'invoice', label: 'Invoice cadence', value: 'Monthly, in advance' },
      { id: 'attended', label: 'Attended hours', value: `${ATTENDED_HOURS_PER_DAY} a day` },
      { id: 'relief', label: 'Relief cover', value: 'Included, 1 day a week' },
    ],
    renewalRules: [
      { id: 'auto', label: 'Auto-renewal', value: 'Enabled by default' },
      { id: 'grace', label: 'Grace period', value: '7 days' },
      { id: 'notice', label: 'Cancellation notice', value: '60 days' },
      { id: 'change', label: 'Mid-cycle tier change', value: 'From the next residency month' },
    ],
    versions: [
      {
        id: 'liv-v2',
        version: 'v2.2',
        at: '2026-06-30',
        author: 'Sarah Jenkins',
        summary: 'Weekly relief cover brought inside the plan price.',
      },
      {
        id: 'liv-v1',
        version: 'v2.0',
        at: '2025-12-05',
        author: 'Mike Chen',
        summary: 'Residency month standardised at 30 days.',
      },
    ],
  },
}

/** Plans withdrawn from sale. Nothing links to them; the count is the point. */
export const archivedPlanCount = 3

export function getPlanDetail(id: PlanId): PlanDetail {
  return details[id]
}

/** Latest version entry — the "last updated" line derives from it, not vice versa. */
export function latestVersion(id: PlanId): VersionEntry {
  return [...details[id].versions].sort((a, b) => b.at.localeCompare(a.at))[0]
}

export function isPlanId(value: string | undefined): value is PlanId {
  // `hasOwn`, not `in`: `in` walks the prototype chain, so "constructor" and
  // "toString" passed the guard and then blew up on `planById[value].name`.
  return value !== undefined && Object.hasOwn(details, value)
}

/* -------------------------------- analytics ------------------------------- */

export interface PlanAnalytics {
  subscribers: number
  share: number
  monthlyRevenue: number
  annualRevenue: number
  /** Revenue per subscriber a month — the list price, by construction. */
  arpu: number
  renewalRate: number
  hoursDelivered: number
  effectiveHourlyRate: number
}

export function planAnalytics(id: PlanId): PlanAnalytics {
  const plan = planById[id]
  const monthlyRevenue = planRevenue(plan)
  return {
    subscribers: plan.subscribers,
    share: Math.round((plan.subscribers / totalSubscribers()) * 100),
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
    arpu: plan.monthlyPrice,
    renewalRate: plan.renewalRate,
    hoursDelivered: plan.hoursPerMonth * plan.subscribers,
    // Always the base rate; shown because it is the one number that lets two
    // plans on different metering models be compared at all.
    effectiveHourlyRate: plan.monthlyPrice / plan.hoursPerMonth,
  }
}

export { RATE_PER_HOUR, unitHours, unitNoun, unitRate }
