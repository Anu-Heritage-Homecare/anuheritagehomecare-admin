import { Check, Minus } from 'lucide-react'
import type { Plan } from './data'
import { formatMoney, unitNoun, unitRate } from './data'
import {
  getPlanDetail,
  latestVersion,
  planAnalytics,
  rateRows,
  serviceCatalogue,
  volumeTiers,
} from './plan-catalogue'
import type { RuleRow } from './plan-catalogue'
import { cn } from '@/lib/cn'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(iso: string) {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`))
}

/** Two-column definition rows that collapse to stacked pairs when narrow. */
function Rows({ rows }: { rows: RuleRow[] }) {
  return (
    <dl className="divide-line divide-y">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-ink-muted min-w-0 text-sm">{row.label}</dt>
          <dd className="text-ink min-w-0 text-sm font-medium break-words">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* --------------------------------- general -------------------------------- */

export function GeneralTab({ plan }: { plan: Plan }) {
  const detail = getPlanDetail(plan.id)
  const version = latestVersion(plan.id)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section aria-labelledby="plan-overview" className="min-w-0">
        <h3 id="plan-overview" className="text-ink mb-3 text-sm font-semibold">
          Plan overview
        </h3>
        <Rows
          rows={[
            { id: 'name', label: 'Plan name', value: plan.name },
            { id: 'audience', label: 'Target audience', value: detail.targetAudience },
            { id: 'status', label: 'Status', value: 'Active' },
            { id: 'countries', label: 'Countries enabled', value: detail.countries.join(', ') },
            {
              id: 'currency',
              label: 'Reporting currency',
              // One currency, deliberately: every figure in the app derives
              // from a Naira visit rate, and a second one would need an FX
              // rate that no fixture carries.
              value: 'NGN (₦)',
            },
          ]}
        />
      </section>

      <section aria-labelledby="plan-pricing" className="min-w-0">
        <h3 id="plan-pricing" className="text-ink mb-3 text-sm font-semibold">
          Pricing structure
        </h3>
        <Rows
          rows={rateRows(plan).map((r) => ({
            id: r.id,
            label: r.label,
            value: r.value,
          }))}
        />
      </section>

      <section aria-labelledby="plan-lifecycle" className="min-w-0">
        <h3 id="plan-lifecycle" className="text-ink mb-3 text-sm font-semibold">
          Renewal &amp; billing lifecycle
        </h3>
        <Rows
          rows={[
            ...detail.renewalRules.slice(0, 3),
            {
              id: 'updated',
              label: 'Last updated',
              // Derived from the version log rather than stored twice.
              value: `${formatDate(version.at)} · ${version.version}`,
            },
          ]}
        />
      </section>
    </div>
  )
}

/* --------------------------------- pricing -------------------------------- */

export function PricingTab({ plan }: { plan: Plan }) {
  const rows = rateRows(plan)

  return (
    <div className="space-y-6">
      <section aria-labelledby="rate-card">
        <h3 id="rate-card" className="text-ink mb-3 text-sm font-semibold">
          Rate card
        </h3>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className={cn(
                'rounded-xl border p-4',
                row.emphasis ? 'border-brand-200 bg-brand-50/50' : 'border-line',
              )}
            >
              <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
                {row.label}
              </p>
              <p className="text-ink mt-2 text-xl font-bold tracking-tight break-words tabular-nums">
                {row.value}
              </p>
              {row.hint && (
                <p className="text-ink-subtle mt-1 text-xs break-words">{row.hint}</p>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Hour tiers only mean something where the plan sells hours; a
          residency plan's allowance is measured in days and never has any. */}
      {plan.model === 'per-hour' && (
      <section aria-labelledby="volume">
        <h3 id="volume" className="text-ink mb-1 text-sm font-semibold">
          Volume discounts
        </h3>
        <p className="text-ink-muted mb-3 text-sm">
          Applied to hours bought beyond the monthly allowance. The allowance
          itself is billed at the base rate, so the list price and the invoice
          never disagree.
        </p>
        <ul className="space-y-2">
          {volumeTiers.map((t) => (
            <li
              key={t.fromHours}
              className="border-line flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border p-3"
            >
              <span className="text-ink min-w-0 text-sm">
                {t.fromHours}+ additional hours a month
              </span>
              <span className="text-ink shrink-0 text-sm font-semibold tabular-nums">
                {Math.round(t.discount * 100)}% off
              </span>
            </li>
          ))}
        </ul>
      </section>
      )}
    </div>
  )
}

/* -------------------------------- services -------------------------------- */

export function ServicesTab({ plan }: { plan: Plan }) {
  const included = new Set(getPlanDetail(plan.id).services)

  return (
    <section aria-labelledby="services">
      <h3 id="services" className="text-ink mb-1 text-sm font-semibold">
        Services included in plan
      </h3>
      <p className="text-ink-muted mb-3 text-sm">
        {included.size} of {serviceCatalogue.length} services are included on{' '}
        {plan.name}.
      </p>

      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {serviceCatalogue.map((service) => {
          const on = included.has(service.id)
          return (
            <li
              key={service.id}
              className={cn(
                'rounded-xl border p-4',
                on ? 'border-brand-200 bg-brand-50/40' : 'border-line bg-canvas',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    'min-w-0 text-sm font-semibold break-words',
                    on ? 'text-ink' : 'text-ink-muted',
                  )}
                >
                  {service.label}
                </p>
                {/* An icon and a label, not a coloured switch: whether a service
                    is in the plan has to survive without hue. */}
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    on
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-ink-subtle bg-sunken',
                  )}
                >
                  {on ? (
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <Minus className="size-3" strokeWidth={3} aria-hidden="true" />
                  )}
                  {on ? 'Included' : 'Not included'}
                </span>
              </div>
              <p className="text-ink-subtle mt-1.5 text-xs break-words">
                {service.description}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ------------------------------- simple lists ------------------------------ */

export function EligibilityTab({ plan }: { plan: Plan }) {
  return (
    <section aria-labelledby="eligibility" className="max-w-2xl">
      <h3 id="eligibility" className="text-ink mb-3 text-sm font-semibold">
        Eligibility criteria
      </h3>
      <Rows rows={getPlanDetail(plan.id).eligibility} />
    </section>
  )
}

export function CoverageTab({ plan }: { plan: Plan }) {
  const detail = getPlanDetail(plan.id)
  return (
    <section aria-labelledby="coverage">
      <h3 id="coverage" className="text-ink mb-1 text-sm font-semibold">
        Coverage areas
      </h3>
      <p className="text-ink-muted mb-3 text-sm">
        Available in {detail.countries.join(' and ')} across{' '}
        {detail.coverage.length} operating regions.
      </p>
      <ul className="flex flex-wrap gap-2">
        {detail.coverage.map((area) => (
          <li
            key={area}
            className="border-line text-ink rounded-full border px-3 py-1.5 text-sm"
          >
            {area}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function BillingRulesTab({ plan }: { plan: Plan }) {
  return (
    <section aria-labelledby="billing-rules" className="max-w-2xl">
      <h3 id="billing-rules" className="text-ink mb-3 text-sm font-semibold">
        Billing rules
      </h3>
      <Rows rows={getPlanDetail(plan.id).billingRules} />
    </section>
  )
}

export function RenewalRulesTab({ plan }: { plan: Plan }) {
  return (
    <section aria-labelledby="renewal-rules" className="max-w-2xl">
      <h3 id="renewal-rules" className="text-ink mb-3 text-sm font-semibold">
        Renewal rules
      </h3>
      <Rows rows={getPlanDetail(plan.id).renewalRules} />
    </section>
  )
}

/* -------------------------------- analytics ------------------------------- */

export function AnalyticsTab({ plan }: { plan: Plan }) {
  const a = planAnalytics(plan.id)

  const tiles: { id: string; label: string; value: string; hint: string }[] = [
    {
      id: 'subs',
      label: 'Subscribers',
      value: a.subscribers.toLocaleString(),
      hint: `${a.share}% of the active base`,
    },
    {
      id: 'mrr',
      label: 'Monthly revenue',
      value: formatMoney(a.monthlyRevenue, 'NGN'),
      hint: `${a.subscribers.toLocaleString()} × ${formatMoney(a.arpu, 'NGN')}`,
    },
    {
      id: 'annual',
      label: 'Annualised',
      value: formatMoney(a.annualRevenue, 'NGN'),
      hint: 'Monthly revenue × 12',
    },
    {
      id: 'arpu',
      label: 'Revenue per subscriber',
      value: formatMoney(a.arpu, 'NGN'),
      hint: 'The list price, by construction',
    },
    {
      id: 'renewal',
      label: 'Renewal rate',
      value: `${a.renewalRate}%`,
      hint: 'Cycles renewed without lapse',
    },
    {
      id: 'hours',
      label: 'Attended hours a month',
      value: a.hoursDelivered.toLocaleString(),
      hint: `${plan.hoursPerMonth} per subscriber`,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <article key={t.id} className="border-line rounded-xl border p-4">
            <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
              {t.label}
            </p>
            <p className="text-ink mt-2 text-xl font-bold tracking-tight break-words tabular-nums">
              {t.value}
            </p>
            <p className="text-ink-subtle mt-1 text-xs break-words">{t.hint}</p>
          </article>
        ))}
      </div>

      {/* A plain section, not a Panel: Panel emits an h2, and this sits inside
          the plan-configuration Panel whose other tabs use h3. */}
      <section aria-labelledby="unit-economics" className="card p-4">
        <h3
          id="unit-economics"
          className="text-ink text-base font-semibold tracking-tight"
        >
          Comparable unit economics
        </h3>
        <p className="text-ink-muted mt-1 mb-3 text-sm">
          Plans meter care differently — visits, hours, residency days — so the
          only figure that compares them is cost per attended hour.
        </p>
        <Rows
          rows={[
            {
              id: 'unit',
              label: 'Billing unit',
              value: `1 ${unitNoun[plan.model].one} at ${formatMoney(
                unitRate[plan.model],
                'NGN',
              )}`,
            },
            {
              id: 'hourly',
              label: 'Effective hourly rate',
              value: `${formatMoney(a.effectiveHourlyRate, 'NGN')} / hour`,
            },
            {
              id: 'allowance',
              label: 'Attended hours in the allowance',
              value: `${plan.hoursPerMonth} hours`,
            },
          ]}
        />
      </section>
    </div>
  )
}

/* ----------------------------- version history ---------------------------- */

export function HistoryTab({ plan }: { plan: Plan }) {
  const versions = [...getPlanDetail(plan.id).versions].sort((a, b) =>
    b.at.localeCompare(a.at),
  )

  return (
    <section aria-labelledby="history">
      <h3 id="history" className="text-ink mb-1 text-sm font-semibold">
        Version history
      </h3>
      <p className="text-ink-muted mb-3 text-sm">
        A plan edit is retroactive for every live subscription on it, so each
        change is kept with who made it.
      </p>

      <ol className="space-y-3">
        {versions.map((v, i) => (
          <li key={v.id} className="border-line rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-ink min-w-0 text-sm font-semibold">
                {v.version}
                {i === 0 && (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Current
                  </span>
                )}
              </p>
              <p className="text-ink-subtle shrink-0 text-xs">
                <time dateTime={v.at}>{formatDate(v.at)}</time> · {v.author}
              </p>
            </div>
            <p className="text-ink-muted mt-1 text-sm break-words">{v.summary}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
