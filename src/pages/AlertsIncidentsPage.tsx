/**
 * Alerts and incidents, driven by the back office. The screen reads the live
 * overview (`GET /admin/alerts/overview`) for the KPIs, the tab counts and the
 * alert feed, and the incident register (`GET /admin/alerts/incidents`) for the
 * Incidents tab. A coordinator acknowledges, resolves or dismisses an alert from
 * its row; each action is attributed server side from the admin token and
 * refreshes the whole screen.
 *
 * Laid out to the design: a tab row, a row of filter dropdowns, then a table of
 * alert type / description / source / time / priority / status with the actions.
 */
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  CircleAlert,
  CircleCheck,
  Loader2,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  useAlertActions,
  useAlertIncidents,
  useAlertsOverview,
} from '@/features/monitoring/useAlertsOverview'
import type { AlertRow, AlertTab, IncidentRow } from '@/features/monitoring/useAlertsOverview'
import { Panel } from '@/components/ui/Panel'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { PriorityBadge, SeverityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

/** The tabs, in the order the design lists them. Counts come from the backend. */
const TABS: { value: AlertTab; label: string; countKey: CountKey }[] = [
  { value: 'all', label: 'All', countKey: 'all' },
  { value: 'active', label: 'Active alerts', countKey: 'activeAlerts' },
  { value: 'emergencies', label: 'Emergencies', countKey: 'emergencies' },
  { value: 'incidents', label: 'Incidents', countKey: 'incidents' },
  { value: 'resolved', label: 'Resolved', countKey: 'resolved' },
]

type CountKey = 'all' | 'activeAlerts' | 'emergencies' | 'incidents' | 'resolved'

/**
 * Service types the backend accepts as a filter. Enumerated from the API's
 * VisitType; branch has no catalogue to read here, so that select carries only
 * "All" rather than inventing names.
 */
const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'All services' },
  { value: 'PERSONAL_CARE', label: 'Personal care' },
  { value: 'MORNING_CARE', label: 'Morning care' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'PHYSICAL_THERAPY', label: 'Physical therapy' },
  { value: 'WOUND_CARE', label: 'Wound care' },
  { value: 'COMPANIONSHIP', label: 'Companionship' },
]

export function AlertsIncidentsPage() {
  const [params, setParams] = useSearchParams()

  const rawTab = params.get('tab') ?? 'all'
  const tab: AlertTab = TABS.some((t) => t.value === rawTab) ? (rawTab as AlertTab) : 'all'
  const branch = params.get('team') ?? 'all'
  const rawService = params.get('service') ?? 'all'
  const serviceType = SERVICE_TYPES.some((s) => s.value === rawService) ? rawService : 'all'

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  const { data, isPending, isError, error, refetch } = useAlertsOverview({
    tab,
    branch,
    serviceType,
  })
  const incidents = useAlertIncidents(tab === 'incidents')
  const actions = useAlertActions()

  const anyFilter = branch !== 'all' || serviceType !== 'all'

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/live-monitoring" className="hover:text-ink">
              Live monitoring
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-brand-700 font-medium" aria-current="page">
            Alerts &amp; incidents
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Alerts &amp; incidents
          </h1>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm">
            Operational alerts and incidents across today&rsquo;s board.{' '}
            <Link to="/live-monitoring?view=attention" className="text-brand-700">
              Attention Required
            </Link>{' '}
            is the same day as a work queue, and{' '}
            <Link to="/live-monitoring/history" className="text-brand-700">
              Monitoring history
            </Link>{' '}
            covers the days before this one.
          </p>
        </div>
      </header>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading alerts…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load the alerts.</p>
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
          {/* Five tiles, following the design: tinted icon, figure, label. */}
          <section aria-labelledby="alert-totals">
            <h2 id="alert-totals" className="sr-only">
              Totals
            </h2>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile icon={Activity} tint="brand" label="Active alerts" value={data.kpis.activeAlerts} />
              <Tile icon={CircleAlert} tint="amber" label="High priority" value={data.kpis.highPriority} />
              <Tile icon={ShieldAlert} tint="red" label="Critical" value={data.kpis.critical} />
              <Tile icon={TriangleAlert} tint="orange" label="Open incidents" value={data.kpis.openIncidents} />
              <Tile icon={CircleCheck} tint="green" label="Resolved today" value={data.kpis.resolvedToday} />
            </ul>
          </section>

          <section aria-labelledby="alerts-list" className="space-y-4">
            <h2 id="alerts-list" className="sr-only">
              Alerts
            </h2>

            <div
              role="group"
              aria-label="Filter by what the alert is about"
              className="border-line no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
            >
              {TABS.map((t) => {
                const active = t.value === tab
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('tab', t.value)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-brand-600 text-brand-700'
                        : 'text-ink-muted hover:text-ink border-transparent',
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                        active ? 'bg-brand-50 text-brand-700' : 'bg-sunken text-ink-subtle',
                      )}
                    >
                      {data.counts[t.countKey]}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* The register has no branch or service type of its own, so the
                filters are hidden rather than left inert on that tab. */}
            {tab !== 'incidents' && (
              <div className="flex flex-wrap items-center gap-2">
                <SelectFilter
                  label="Branch"
                  value={branch}
                  onChange={(v) => set('team', v)}
                  options={[{ value: 'all', label: 'All branches' }]}
                />
                <SelectFilter
                  label="Service type"
                  value={serviceType}
                  onChange={(v) => set('service', v)}
                  options={SERVICE_TYPES}
                />
                {anyFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(params)
                      for (const key of ['team', 'service']) next.delete(key)
                      setParams(next)
                    }}
                    className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center px-1 text-sm font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {tab === 'incidents' ? (
              <IncidentRegister
                incidents={incidents.data ?? []}
                isPending={incidents.isPending}
                isError={incidents.isError}
              />
            ) : (
              <Panel
                title="Alerts"
                badge={
                  <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
                    {data.items.length}
                  </span>
                }
                flush
              >
                {data.items.length === 0 ? (
                  <p
                    className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
                    role="status"
                  >
                    Nothing on the board matches these filters.
                  </p>
                ) : (
                  <>
                    <div
                      tabIndex={0}
                      role="region"
                      aria-label="Alerts table"
                      className="border-line hidden overflow-x-auto border-t xl:block"
                    >
                      <table className="w-full min-w-4xl text-left text-sm">
                        <thead className="text-ink-subtle bg-sunken text-xs">
                          <tr>
                            {['Alert type', 'Description', 'Source', 'Time', 'Priority', 'Status', 'Actions'].map(
                              (col) => (
                                <th
                                  key={col}
                                  scope="col"
                                  className="px-4 py-2.5 font-semibold tracking-wide uppercase"
                                >
                                  {col}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-line divide-y">
                          {data.items.map((alert) => (
                            <AlertTableRow
                              key={alert.id}
                              alert={alert}
                              onAction={(action) => actions.mutate({ id: alert.id, action })}
                              busy={actions.isPending}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <ul className="border-line divide-line divide-y border-t xl:hidden">
                      {data.items.map((alert) => (
                        <AlertCard
                          key={alert.id}
                          alert={alert}
                          onAction={(action) => actions.mutate({ id: alert.id, action })}
                          busy={actions.isPending}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </Panel>
            )}
          </section>
        </>
      )}
    </div>
  )
}

const tileTints = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-emerald-50 text-emerald-600',
} as const

function Tile({
  icon: Icon,
  tint,
  label,
  value,
}: {
  icon: LucideIcon
  tint: keyof typeof tileTints
  label: string
  value: number
}) {
  return (
    <li className="card p-4">
      <span
        aria-hidden="true"
        className={cn('grid size-9 place-items-center rounded-xl', tileTints[tint])}
      >
        <Icon className="size-4.5" strokeWidth={2.2} />
      </span>
      <span className="text-ink mt-3 block text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-ink-muted mt-0.5 block text-sm">{label}</span>
    </li>
  )
}

type ActionKind = 'acknowledge' | 'resolve' | 'dismiss'

function AlertActions({
  onAction,
  busy,
}: {
  onAction: (action: ActionKind) => void
  busy: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction('acknowledge')}
        className="border-line text-ink hover:bg-sunken inline-flex min-h-8 items-center rounded-lg border px-2.5 text-xs font-medium disabled:opacity-50"
      >
        Acknowledge
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction('resolve')}
        className="inline-flex min-h-8 items-center rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Resolve
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction('dismiss')}
        className="text-ink-muted hover:text-ink inline-flex min-h-8 items-center px-1.5 text-xs font-medium disabled:opacity-50"
      >
        Dismiss
      </button>
    </div>
  )
}

function AlertTableRow({
  alert,
  onAction,
  busy,
}: {
  alert: AlertRow
  onAction: (action: ActionKind) => void
  busy: boolean
}) {
  return (
    <tr
      className={cn(
        'transition-colors',
        alert.severity === 'critical' ? 'bg-red-50/60' : 'hover:bg-canvas',
      )}
    >
      <th scope="row" className="text-ink px-4 py-3.5 font-semibold break-words">
        {alert.type}
      </th>
      <td className="text-ink-muted max-w-xs px-4 py-3.5" title={alert.description}>
        <span className="block truncate">{alert.description}</span>
      </td>
      <td className="text-ink px-4 py-3.5 whitespace-nowrap">{alert.source}</td>
      <td className="text-ink-muted px-4 py-3.5 whitespace-nowrap">{alert.timeLabel}</td>
      <td className="px-4 py-3.5">
        <PriorityBadge priority={alert.priority} />
      </td>
      <td className="px-4 py-3.5">
        <span className="bg-sunken text-ink-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
          {alert.statusLabel}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <AlertActions onAction={onAction} busy={busy} />
      </td>
    </tr>
  )
}

function AlertCard({
  alert,
  onAction,
  busy,
}: {
  alert: AlertRow
  onAction: (action: ActionKind) => void
  busy: boolean
}) {
  return (
    <li className={cn('p-4', alert.severity === 'critical' && 'bg-red-50/60')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span className="text-ink min-w-0 text-sm font-semibold break-words">{alert.type}</span>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <SeverityBadge severity={alert.severity} />
          <span className="bg-sunken text-ink-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
            {alert.statusLabel}
          </span>
        </span>
      </div>
      <p className="text-ink-muted mt-1 text-sm break-words">{alert.description}</p>
      <p className="text-ink-subtle mt-0.5 text-xs break-words">
        {alert.source} · {alert.timeLabel}
      </p>
      <div className="mt-2.5">
        <AlertActions onAction={onAction} busy={busy} />
      </div>
    </li>
  )
}

/** The Incidents tab: a different table over a different entity. */
function IncidentRegister({
  incidents,
  isPending,
  isError,
}: {
  incidents: IncidentRow[]
  isPending: boolean
  isError: boolean
}) {
  return (
    <Panel
      title="Incident register"
      badge={
        <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
          {incidents.length}
        </span>
      }
      flush
    >
      {isPending ? (
        <p
          className="text-ink-subtle border-line flex items-center justify-center gap-2 border-t px-4 py-10 text-sm"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading incidents…
        </p>
      ) : isError ? (
        <p
          className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
          role="status"
        >
          Could not load the incident register.
        </p>
      ) : incidents.length === 0 ? (
        <p
          className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
          role="status"
        >
          No incident has been filed.
        </p>
      ) : (
        <>
          <div
            tabIndex={0}
            role="region"
            aria-label="Incident register table"
            className="border-line hidden overflow-x-auto border-t xl:block"
          >
            <table className="w-full min-w-4xl text-left text-sm">
              <thead className="text-ink-subtle bg-sunken text-xs">
                <tr>
                  {['Incident ID', 'Description', 'Reporter', 'Time', 'Priority', 'Status'].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-2.5 font-semibold tracking-wide uppercase"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-canvas transition-colors">
                    <th scope="row" className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        to={`/live-monitoring/alerts/${incident.id}/overview`}
                        className="text-brand-700 hover:text-brand-800 font-medium"
                      >
                        {incident.reference}
                      </Link>
                    </th>
                    <td className="text-ink max-w-md px-4 py-3.5" title={incident.detail || undefined}>
                      <span className="block truncate">{incident.description}</span>
                    </td>
                    <td className="text-ink px-4 py-3.5 whitespace-nowrap">{incident.reporter}</td>
                    <td className="text-ink-muted px-4 py-3.5 whitespace-nowrap">{incident.timeLabel}</td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={incident.priority} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="bg-sunken text-ink-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
                        {incident.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="border-line divide-line divide-y border-t xl:hidden">
            {incidents.map((incident) => (
              <li key={incident.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <Link
                    to={`/live-monitoring/alerts/${incident.id}/overview`}
                    className="text-brand-700 hover:text-brand-800 text-sm font-semibold"
                  >
                    {incident.reference}
                  </Link>
                  <PriorityBadge priority={incident.priority} />
                </div>
                <p className="text-ink mt-1 text-sm break-words">{incident.description}</p>
                <p className="text-ink-subtle mt-1.5 text-xs break-words">
                  {incident.reporter} · {incident.timeLabel} · {incident.statusLabel}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
