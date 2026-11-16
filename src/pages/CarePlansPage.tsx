import { Link, Navigate, useParams } from 'react-router-dom'
import { Archive, Loader2, Plus } from 'lucide-react'
import {
  planById,
  plans,
} from '@/features/billing/data'
import {
  archivedPlanCount,
  isPlanId,
} from '@/features/billing/plan-catalogue'
import {
  AnalyticsTab,
  BillingRulesTab,
  CoverageTab,
  EligibilityTab,
  GeneralTab,
  HistoryTab,
  PricingTab,
  RenewalRulesTab,
  ServicesTab,
} from '@/features/billing/PlanTabs'
import { useCarePlans } from '@/features/billing/useCarePlans'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/lib/cn'

const tabs = [
  { slug: 'general', label: 'General' },
  { slug: 'pricing', label: 'Pricing' },
  { slug: 'services', label: 'Services included' },
  { slug: 'eligibility', label: 'Eligibility' },
  { slug: 'coverage', label: 'Coverage areas' },
  { slug: 'billing-rules', label: 'Billing rules' },
  { slug: 'renewal-rules', label: 'Renewal rules' },
  { slug: 'analytics', label: 'Analytics' },
  { slug: 'history', label: 'Version history' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

function isTab(value: string | undefined): value is TabSlug {
  return tabs.some((t) => t.slug === value)
}

export function CarePlansPage() {
  const { planId, tab } = useParams()

  // The catalogue cards render live for one market (USD, the backend default).
  const { data, isPending, isError, error, refetch } = useCarePlans('USD', false)

  /*
   * The catalogue always has a plan open — the nine detail tabs below the cards
   * have nothing to render otherwise — so a missing or unknown slug resolves to
   * the first plan rather than bouncing back to a path that would match here
   * again and render nothing at all. The detail panel is keyed by the local
   * plan slug; see the scope note on the hook.
   */
  if (!isPlanId(planId))
    return <Navigate to={`/billing/plans/${plans[0].id}/general`} replace />
  if (!isTab(tab)) return <Navigate to={`/billing/plans/${planId}/general`} replace />

  const plan = planById[planId]
  const livePlans = data?.plans ?? []
  const liveSubscribers = livePlans.reduce((sum, p) => sum + p.subscribers, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">Care Plans</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Create, configure and manage the agency&rsquo;s care plan catalogue.
            Editing a plan changes what every subscription on it is billed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            <Archive className="size-4" strokeWidth={1.9} aria-hidden="true" />
            Archived plans
            <span className="text-ink-subtle tabular-nums">{archivedPlanCount}</span>
          </button>
          <button
            type="button"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Create new plan
          </button>
        </div>
      </header>

      <section aria-labelledby="catalogue">
        <h2
          id="catalogue"
          className="text-ink mb-3 text-base font-semibold tracking-tight"
        >
          Active care plan catalogue
        </h2>

        {isPending ? (
          <div className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            Loading the care plan catalogue…
          </div>
        ) : isError ? (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-ink text-sm font-medium">Could not load the catalogue.</p>
            <p className="text-ink-subtle text-sm">{error.message}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
              {livePlans.map((p) => (
                <li key={p.id} className="card h-full p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-ink min-w-0 text-sm font-semibold">
                      <span className="min-w-0 break-words">{p.name}</span>
                    </h3>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                        p.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {p.isActive ? 'Active' : 'Archived'}
                    </span>
                  </div>

                  <p className="text-ink-subtle mt-2 line-clamp-3 text-xs break-words">
                    {p.description}
                  </p>

                  <dl className="mt-3 space-y-1.5 text-sm">
                    {[
                      ['Monthly price', p.monthlyPriceLabel],
                      ['Subscribers', p.subscribers.toLocaleString()],
                      ['Retention', p.retentionPercent === null ? '—' : `${p.retentionPercent}%`],
                      ['Est. monthly revenue', p.estRevenueLabel],
                    ].map(([label, value]) => (
                      <div key={label} className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-ink-muted shrink-0">{label}</dt>
                        <dd className="text-ink min-w-0 text-right font-medium tabular-nums">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>

            <p className="text-ink-subtle mt-3 text-xs">
              {liveSubscribers.toLocaleString()} subscriptions across {livePlans.length} plans in
              this market.
            </p>
          </>
        )}
      </section>

      <Panel title={plan.name} flush>
        {/* Navigation, not an ARIA tablist: each one is a URL. `role="tab"`
            would hide that they are links and advertise arrow-key movement
            that anchors don't have. */}
        <nav
          aria-label={`${plan.name} configuration`}
          className="border-line no-scrollbar flex gap-1 overflow-x-auto border-y px-2"
        >
          {tabs.map((t) => {
            const selected = t.slug === tab
            return (
              <Link
                key={t.slug}
                to={`/billing/plans/${planId}/${t.slug}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                  selected
                    ? 'border-brand-600 text-brand-700'
                    : 'text-ink-muted hover:text-ink border-transparent',
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4">
          {tab === 'general' && <GeneralTab plan={plan} />}
          {tab === 'pricing' && <PricingTab plan={plan} />}
          {tab === 'services' && <ServicesTab plan={plan} />}
          {tab === 'eligibility' && <EligibilityTab plan={plan} />}
          {tab === 'coverage' && <CoverageTab plan={plan} />}
          {tab === 'billing-rules' && <BillingRulesTab plan={plan} />}
          {tab === 'renewal-rules' && <RenewalRulesTab plan={plan} />}
          {tab === 'analytics' && <AnalyticsTab plan={plan} />}
          {tab === 'history' && <HistoryTab plan={plan} />}
        </div>
      </Panel>
    </div>
  )
}
