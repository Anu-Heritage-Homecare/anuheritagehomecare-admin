import { Info, Loader2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useCompletedVisits,
  usePastAlerts,
  usePastIncidents,
} from '@/features/monitoring/useMonitoringHistory'
import type {
  CompletedStatus,
  HistoryDays,
  IncidentOutcomeFilter,
} from '@/features/monitoring/useMonitoringHistory'
import { Pagination } from '@/components/ui/Pagination'
import { Panel } from '@/components/ui/Panel'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { PriorityBadge, SeverityBadge } from '@/components/ui/StatusBadge'
import type { Severity } from '@/types'
import { cn } from '@/lib/cn'

const tabs = [
  { slug: 'visits', label: 'Completed Visits' },
  { slug: 'alerts', label: 'Past Alerts' },
  { slug: 'incidents', label: 'Past Incidents' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

const PAGE_SIZE = 20

const ranges: { value: string; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

const severityFilterOptions = [
  { value: 'ALL', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
]

const completedStatusOptions: { value: CompletedStatus; label: string }[] = [
  { value: 'ALL', label: 'All outcomes' },
  { value: 'COMPLETED', label: 'On time' },
  { value: 'COMPLETED_LATE', label: 'Completed late' },
]

const incidentOutcomeOptions: { value: IncidentOutcomeFilter; label: string }[] = [
  { value: 'ALL', label: 'All outcomes' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

/**
 * Monitoring history — days that have finished, read live from the backend.
 *
 * The third screen under Live Monitoring, beside the board (right now) and
 * Alerts & incidents (today). Three paginated read-only endpoints back the three
 * tabs: completed visits, past alerts and past incidents. The backend
 * pre-formats the row labels, so the page renders them directly; the server also
 * clamps the page and owns the filter domains, so the dropdowns here only offer
 * the fixed small choices (date range, status/severity) that every row shares.
 */
export function MonitoringHistoryPage() {
  const [params, setParams] = useSearchParams()

  const rawTab = params.get('tab') ?? 'visits'
  const tab = (tabs.find((t) => t.slug === rawTab)?.slug ?? 'visits') as TabSlug
  const rawRange = params.get('range') ?? '30'
  const days = (ranges.some((r) => r.value === rawRange) ? Number(rawRange) : 30) as HistoryDays
  const rangeLabel = (ranges.find((r) => r.value === String(days))?.label ?? 'Last 30 days')
    .toLowerCase()
    .replace('last ', '')

  const severityParam = params.get('severity') ?? 'ALL'
  const severity = severityFilterOptions.some((o) => o.value === severityParam)
    ? (severityParam as Severity | 'ALL')
    : 'ALL'
  const visitStatusParam = params.get('status') ?? 'ALL'
  const visitStatus = completedStatusOptions.some((o) => o.value === visitStatusParam)
    ? (visitStatusParam as CompletedStatus)
    : 'ALL'
  const outcomeParam = params.get('outcome') ?? 'ALL'
  const outcome = incidentOutcomeOptions.some((o) => o.value === outcomeParam)
    ? (outcomeParam as IncidentOutcomeFilter)
    : 'ALL'

  const requestedPage = Number(params.get('page'))
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'ALL') next.delete(key)
    else next.set(key, value)
    // A filter or tab change invalidates the page number: staying on page 3 of a
    // one-page result showed nothing.
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const visitsQuery = useCompletedVisits({
    days,
    page,
    pageSize: PAGE_SIZE,
    status: visitStatus,
  })
  const alertsQuery = usePastAlerts({ days, page, pageSize: PAGE_SIZE, severity })
  const incidentsQuery = usePastIncidents({
    days,
    page,
    pageSize: PAGE_SIZE,
    severity,
    outcome,
  })

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
            Monitoring history
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">
          Monitoring history
        </h1>
        <p className="text-ink-muted mt-1 max-w-2xl text-sm">
          Visits whose window has closed, alerts that have been resolved, and
          incidents on file, read from the record. Today's live board is on{' '}
          <Link to="/live-monitoring" className="text-brand-700">
            the board
          </Link>
          .
        </p>
      </header>

      <div
        role="group"
        aria-label="Choose a history"
        className="border-line no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((t) => {
          const active = t.slug === tab
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => set('tab', t.slug)}
              aria-pressed={active}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-brand-600 text-brand-700'
                  : 'text-ink-muted hover:text-ink border-transparent',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SelectFilter
            chip
            label="Date Range"
            value={String(days)}
            onChange={(v) => set('range', v)}
            options={ranges}
          />
          {tab === 'visits' && (
            <SelectFilter
              chip
              label="Status"
              value={visitStatus}
              onChange={(v) => set('status', v)}
              options={completedStatusOptions}
            />
          )}
          {(tab === 'alerts' || tab === 'incidents') && (
            <SelectFilter
              chip
              label="Priority"
              value={severity}
              onChange={(v) => set('severity', v)}
              options={severityFilterOptions}
            />
          )}
          {tab === 'incidents' && (
            <SelectFilter
              chip
              label="Outcome"
              value={outcome}
              onChange={(v) => set('outcome', v)}
              options={incidentOutcomeOptions}
            />
          )}
        </div>
      </div>

      {tab === 'visits' && (
        <Panel title={`Visits closed in the ${rangeLabel}`} flush>
          <QueryState
            query={visitsQuery}
            empty="No completed visit in this range matches those filters."
            noun="visits"
            page={page}
            onPageChange={(p) => set('page', String(p))}
            pageCount={visitsQuery.data?.pageCount ?? 1}
            total={visitsQuery.data?.total ?? 0}
          >
            {(data) => (
              <>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Completed visits table"
                  className="border-line hidden overflow-x-auto border-t xl:block"
                >
                  <table className="w-full min-w-4xl text-left text-sm">
                    <Head
                      cols={['Visit ID', 'Care Recipient', 'Caregiver', 'Date', 'Duration', 'Status']}
                    />
                    <tbody className="divide-line divide-y">
                      {data.rows.map((visit) => (
                        <tr key={visit.id} className="hover:bg-canvas transition-colors">
                          <th scope="row" className="px-4 py-3.5 whitespace-nowrap">
                            <Link
                              to={`/scheduling/visits/${visit.id}/overview`}
                              className="text-brand-700 hover:text-brand-800 font-medium"
                            >
                              {visit.reference}
                            </Link>
                          </th>
                          <td className="text-ink px-4 py-3.5 font-medium whitespace-nowrap">
                            {visit.recipientName}
                          </td>
                          <td className="text-ink px-4 py-3.5 whitespace-nowrap">
                            {visit.caregiverName}
                          </td>
                          <td className="text-ink-muted px-4 py-3.5 whitespace-nowrap">
                            {visit.dateLabel}
                          </td>
                          <td className="text-ink-muted px-4 py-3.5 whitespace-nowrap">
                            {visit.durationLabel}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700">
                              {visit.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="border-line divide-line divide-y border-t xl:hidden">
                  {data.rows.map((visit) => (
                    <li key={visit.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <Link
                          to={`/scheduling/visits/${visit.id}/overview`}
                          className="text-ink hover:text-brand-700 min-w-0 text-sm font-semibold break-words"
                        >
                          {visit.recipientName}
                        </Link>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700">
                          {visit.statusLabel}
                        </span>
                      </div>
                      <p className="text-ink-muted mt-1 text-sm break-words">
                        {visit.dateLabel} · {visit.durationLabel}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs break-words">
                        {visit.caregiverName} · {visit.reference}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </QueryState>
        </Panel>
      )}

      {tab === 'alerts' && (
        <Panel title={`Alerts resolved in the ${rangeLabel}`} flush>
          <QueryState
            query={alertsQuery}
            empty="No alert in this range matches those filters."
            noun="alerts"
            page={page}
            onPageChange={(p) => set('page', String(p))}
            pageCount={alertsQuery.data?.pageCount ?? 1}
            total={alertsQuery.data?.total ?? 0}
          >
            {(data) => (
              <>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Past alerts table"
                  className="border-line hidden overflow-x-auto border-t xl:block"
                >
                  <table className="w-full min-w-4xl text-left text-sm">
                    <Head
                      cols={['Alert Type', 'Description', 'Source', 'Date', 'Priority', 'Resolution']}
                    />
                    <tbody className="divide-line divide-y">
                      {data.rows.map((alert) => (
                        <tr key={alert.id} className="hover:bg-canvas transition-colors">
                          <th scope="row" className="text-ink px-4 py-3.5 text-left font-medium break-words">
                            {alert.typeLabel}
                          </th>
                          <td className="text-ink-muted max-w-sm px-4 py-3.5 break-words">
                            {alert.description}
                          </td>
                          <td className="text-ink px-4 py-3.5">
                            {alert.source}
                            <span className="text-ink-subtle block text-xs">
                              {alert.branch}
                            </span>
                          </td>
                          <td className="text-ink-muted px-4 py-3.5 whitespace-nowrap">
                            {alert.dateLabel}
                          </td>
                          <td className="px-4 py-3.5">
                            <SeverityBadge severity={alert.severity} />
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700">
                              {alert.statusLabel}
                            </span>
                            <span className="text-ink-subtle mt-0.5 block text-xs break-words">
                              {alert.resolution}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="border-line divide-line divide-y border-t xl:hidden">
                  {data.rows.map((alert) => (
                    <li key={alert.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="text-ink min-w-0 text-sm font-semibold break-words">
                          {alert.typeLabel}
                        </p>
                        <SeverityBadge severity={alert.severity} />
                      </div>
                      <p className="text-ink-muted mt-1 text-sm break-words">
                        {alert.description}
                      </p>
                      <p className="text-ink-subtle mt-1 text-xs break-words">
                        {alert.dateLabel} · {alert.source} · {alert.branch} ·{' '}
                        {alert.statusLabel}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </QueryState>
        </Panel>
      )}

      {tab === 'incidents' && (
        <Panel title={`Incidents filed in the ${rangeLabel}`} flush>
          <QueryState
            query={incidentsQuery}
            empty="No incident has been written up in this range."
            noun="incidents"
            page={page}
            onPageChange={(p) => set('page', String(p))}
            pageCount={incidentsQuery.data?.pageCount ?? 1}
            total={incidentsQuery.data?.total ?? 0}
          >
            {(data) => (
              <>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Past incidents table"
                  className="border-line hidden overflow-x-auto border-t xl:block"
                >
                  <table className="w-full min-w-4xl text-left text-sm">
                    <Head
                      cols={['Incident ID', 'Description', 'Reported By', 'Date', 'Severity', 'Outcome']}
                    />
                    <tbody className="divide-line divide-y">
                      {data.rows.map((incident) => (
                        <tr key={incident.id} className="hover:bg-canvas transition-colors">
                          <th scope="row" className="px-4 py-3.5 text-left whitespace-nowrap">
                            <Link
                              to={`/live-monitoring/alerts/${incident.id}/overview`}
                              className="text-brand-700 hover:text-brand-800 font-medium"
                            >
                              {incident.reference}
                            </Link>
                          </th>
                          <td className="text-ink max-w-sm px-4 py-3.5 font-medium break-words">
                            {incident.categoryLabel}
                          </td>
                          <td className="text-ink px-4 py-3.5 break-words">
                            {incident.reporter}
                          </td>
                          <td className="text-ink-muted px-4 py-3.5 whitespace-nowrap">
                            {incident.dateLabel}
                          </td>
                          <td className="px-4 py-3.5">
                            <PriorityBadge priority={incident.severity} />
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700">
                              {incident.outcomeLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="border-line divide-line divide-y border-t xl:hidden">
                  {data.rows.map((incident) => (
                    <li key={incident.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <Link
                          to={`/live-monitoring/alerts/${incident.id}/overview`}
                          className="text-brand-700 hover:text-brand-800 text-sm font-semibold"
                        >
                          {incident.reference}
                        </Link>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <PriorityBadge priority={incident.severity} />
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700">
                            {incident.outcomeLabel}
                          </span>
                        </span>
                      </div>
                      <p className="text-ink mt-1 text-sm font-medium break-words">
                        {incident.categoryLabel}
                      </p>
                      <p className="text-ink-subtle mt-1 text-xs break-words">
                        {incident.reporter} · {incident.dateLabel}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </QueryState>
        </Panel>
      )}

      <p className="text-ink-subtle flex gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>
          History is read from the record, so today's live board is not included
          here — it is on the Live monitoring screen.
        </span>
      </p>
    </div>
  )
}

/* ------------------------------ tab plumbing ------------------------------ */

interface PageData {
  rows: { id: string }[]
}

/**
 * The loading / error / empty / loaded states for one tab's query, mirroring the
 * dashboard's spinner-then-error-card UX but scoped to the tab area, with the
 * shared Pagination wired to the server's page count. `children` renders only
 * once rows are present.
 */
function QueryState<Data extends PageData>({
  query,
  children,
  empty,
  noun,
  page,
  pageCount,
  total,
  onPageChange,
}: {
  query: { isPending: boolean; isError: boolean; error: Error | null; data: Data | undefined; refetch: () => void }
  children: (data: Data) => React.ReactNode
  empty: string
  noun: string
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (query.isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 border-t border-line py-16 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading…
      </div>
    )
  }

  if (query.isError || query.data === undefined) {
    return (
      <div className="border-line flex flex-col items-center gap-3 border-t p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load this history.</p>
        <p className="text-ink-subtle text-sm">{query.error?.message ?? 'Unknown error'}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (query.data.rows.length === 0) return <Empty>{empty}</Empty>

  return (
    <>
      {children(query.data)}
      {pageCount > 1 && (
        <div className="border-line border-t p-4">
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={onPageChange}
            summary={`Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} ${noun}`}
          />
        </div>
      )}
    </>
  )
}

function Head({ cols }: { cols: string[] }) {
  return (
    <thead className="text-ink bg-sunken text-[13px]">
      <tr className="border-line border-b">
        {cols.map((col) => (
          <th key={col} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
      role="status"
    >
      {children}
    </p>
  )
}
