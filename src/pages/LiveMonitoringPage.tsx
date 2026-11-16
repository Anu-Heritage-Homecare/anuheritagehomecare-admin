import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, RefreshCw, Siren, TriangleAlert } from 'lucide-react'
import {
  useActiveVisits,
  useAttention,
  useLiveMap,
  useLiveOverview,
  useDispatchSos,
  titleCase,
  type ActiveVisitsQuery,
  type LiveAttention,
  type LiveFilters,
  type LiveOverviewView,
} from '@/features/monitoring/useLiveMonitoring'
import {
  LiveAcknowledgeDialog,
  LiveEscalateDialog,
  LiveResolveDialog,
} from '@/features/monitoring/LiveAlertDialogs'
import { LiveVisitMap } from '@/features/monitoring/LiveVisitMap'
import { Avatar } from '@/components/ui/Avatar'
import { Pagination } from '@/components/ui/Pagination'
import { Panel } from '@/components/ui/Panel'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { SeverityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

/** The four views, swapped through the URL like the old page. */
const views = [
  { slug: 'now', label: 'Live Overview' },
  { slug: 'visits', label: 'Active Visits' },
  { slug: 'attention', label: 'Attention Required' },
  { slug: 'map', label: 'Map View' },
] as const

type View = (typeof views)[number]['slug']

/** The server's VisitType enum, a stable contract — the only honest service list. */
const SERVICE_TYPES = [
  { value: 'PERSONAL_CARE', label: 'Personal Care' },
  { value: 'MORNING_CARE', label: 'Morning Care' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'PHYSICAL_THERAPY', label: 'Physical Therapy' },
  { value: 'WOUND_CARE', label: 'Wound Care' },
  { value: 'COMPANIONSHIP', label: 'Companionship' },
]

/** The Active Visits tab status pills, matching the backend filter contract. */
const ACTIVE_STATUSES = [
  { value: 'all', label: 'All active' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RUNNING_LATE', label: 'Running late' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'ATTENTION', label: 'Attention' },
]

const PAGE_SIZE = 20

function Spinner({ label }: { label: string }) {
  return (
    <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      {label}
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-ink text-sm font-medium">Could not load live monitoring.</p>
      <p className="text-ink-subtle text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

export function LiveMonitoringPage() {
  const [params, setParams] = useSearchParams()

  const requestedView = params.get('view')
  const view = (views.find((v) => v.slug === requestedView)?.slug ?? 'now') as View
  const branch = params.get('branch') ?? 'all'
  const service = params.get('service') ?? 'all'
  const filters: LiveFilters = { branch, serviceType: service }

  const overview = useLiveOverview(filters)
  const dispatchSos = useDispatchSos()

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-ink text-2xl font-bold tracking-tight">Live Monitoring</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                Live
                {overview.data && ` · Updated ${overview.data.updatedAt.slice(11, 16)}`}
              </span>
            </div>
            <p className="text-ink-muted mt-1 max-w-2xl text-sm">
              Monitor active care visits, caregiver activity and operational alerts as they stand
              right now.{' '}
              <Link to="/live-monitoring/history" className="text-brand-700">
                Monitoring history
              </Link>{' '}
              has the days that have finished.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void overview.refetch()}
              className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
            >
              <RefreshCw
                className={cn('size-4 shrink-0', overview.isFetching && 'animate-spin')}
                strokeWidth={2}
                aria-hidden="true"
              />
              Refresh
            </button>
            <Link
              to="/live-monitoring/alerts"
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
            >
              <TriangleAlert className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              View Alerts
            </Link>
          </div>
        </div>

        <div role="group" aria-label="Filter the board" className="flex flex-wrap items-center gap-2">
          <SelectFilter
            chip
            label="Service Type"
            value={service}
            onChange={(v) => set('service', v)}
            options={[{ value: 'all', label: 'All services' }, ...SERVICE_TYPES]}
          />
          {(branch !== 'all' || service !== 'all') && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const key of ['branch', 'service', 'page']) next.delete(key)
                setParams(next)
              }}
              className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center px-1 text-sm font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </header>

      {overview.isPending ? (
        <Spinner label="Loading live monitoring…" />
      ) : overview.isError ? (
        <ErrorCard message={overview.error.message} onRetry={() => void overview.refetch()} />
      ) : (
        <>
          <KpiTiles data={overview.data} />

          <div
            role="group"
            aria-label="Choose a view"
            className="border-line no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
          >
            {views.map((v) => {
              const active = v.slug === view
              const count =
                v.slug === 'visits'
                  ? overview.data.tabCounts.activeVisits
                  : v.slug === 'attention'
                    ? overview.data.tabCounts.attention
                    : null
              return (
                <button
                  key={v.slug}
                  type="button"
                  onClick={() => set('view', v.slug)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-brand-600 text-brand-700'
                      : 'text-ink-muted hover:text-ink border-transparent',
                  )}
                >
                  {v.label}
                  {count !== null && (
                    <span className="bg-sunken text-ink-subtle rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {view === 'now' && (
            <LiveOverviewPanel
              data={overview.data}
              onDispatch={(id) => dispatchSos.mutate(id)}
              dispatching={dispatchSos.isPending}
            />
          )}
          {view === 'visits' && (
            <ActiveVisitsPanel filters={filters} params={params} setParams={setParams} />
          )}
          {view === 'attention' && <AttentionPanel />}
          {view === 'map' && <MapPanel filters={filters} params={params} setParams={setParams} />}
        </>
      )}
    </div>
  )
}

/* --------------------------------- tiles ---------------------------------- */

function KpiTiles({ data }: { data: LiveOverviewView }) {
  const s = data.summary
  const tiles = [
    { id: 'active', label: 'Active Visits', value: s.activeVisits },
    { id: 'checked-in', label: 'Caregivers Checked In', value: s.caregiversCheckedIn },
    { id: 'due', label: 'Check-in Due', value: s.checkInDue },
    { id: 'late', label: 'Running Late', value: s.runningLate },
    { id: 'attention', label: 'Attention Required', value: s.attentionRequired },
    { id: 'critical', label: 'Critical Alerts', value: s.criticalAlerts },
  ]
  return (
    <section aria-labelledby="live-totals">
      <h2 id="live-totals" className="sr-only">
        Totals
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <article key={t.id} className="card px-3.5 py-3.5">
            <span className="text-ink block text-2xl font-bold tracking-tight tabular-nums">
              {t.value}
            </span>
            <span className="text-ink-muted mt-1 block text-xs tracking-tight break-words">
              {t.label}
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------- overview --------------------------------- */

function LiveOverviewPanel({
  data,
  onDispatch,
  dispatching,
}: {
  data: LiveOverviewView
  onDispatch: (id: string) => void
  dispatching: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Panel
          titleClassName="text-base font-bold"
          className="bg-canvas border-transparent"
          title={`Active Visit Summary (${data.activeVisits.length})`}
        >
          {data.activeVisits.length === 0 ? (
            <p className="text-ink-subtle py-6 text-center text-sm" role="status">
              No visit is active right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.activeVisits.map((visit) => (
                <li
                  key={visit.visitId}
                  className="border-line bg-surface rounded-xl border px-5 pt-4 pb-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <div className="min-w-0">
                      <p className="text-ink text-[0.9375rem] font-semibold break-words">
                        {visit.recipientName}
                      </p>
                      <p className="text-ink-subtle text-xs break-words">
                        {visit.service} ·{' '}
                        {visit.caregiverName ?? (
                          <span className="font-medium text-red-700">Unassigned</span>
                        )}
                      </p>
                    </div>
                    <span className="bg-sunken text-ink-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
                      {titleCase(visit.status)}
                    </span>
                  </div>
                  <p className="text-ink-muted mt-2 text-xs">{visit.elapsedLabel}</p>
                  <div className="bg-sunken mt-1.5 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-brand-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, visit.progressPercent))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          titleClassName="text-base font-bold"
          className="bg-canvas border-transparent"
          title={`Attention Required (${data.attentionRequired.length})`}
        >
          {data.attentionRequired.length === 0 ? (
            <p className="text-ink-subtle py-6 text-center text-sm" role="status">
              Nothing on the board needs a coordinator right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.attentionRequired.slice(0, 4).map((alert) => (
                <AttentionCard
                  key={alert.id}
                  alert={alert}
                  onDispatch={onDispatch}
                  dispatching={dispatching}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent Live Activity" titleClassName="text-base font-bold">
        {data.recentActivity.length === 0 ? (
          <p className="text-ink-subtle py-8 text-center text-sm" role="status">
            Nothing has happened yet.
          </p>
        ) : (
          <ol>
            {data.recentActivity.map((entry, index) => {
              const last = index === data.recentActivity.length - 1
              return (
                <li key={entry.id} className="flex gap-3">
                  <span className="text-ink-subtle w-14 shrink-0 pt-0.5 text-xs whitespace-nowrap tabular-nums">
                    {entry.timeLabel}
                  </span>
                  <span aria-hidden="true" className="relative flex w-2 shrink-0 justify-center">
                    <span className="bg-brand-500 mt-1.5 size-2 shrink-0 rounded-full" />
                    {!last && (
                      <span className="bg-line absolute top-4 bottom-0 left-1/2 w-px -translate-x-1/2" />
                    )}
                  </span>
                  <div className={cn('min-w-0', !last && 'pb-5')}>
                    <p className="text-ink text-sm font-semibold break-words">{entry.title}</p>
                    <p className="text-ink-subtle mt-1 text-[0.8125rem] break-words">
                      {entry.description}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------- attention -------------------------------- */

function AttentionCard({
  alert,
  onDispatch,
  dispatching,
}: {
  alert: LiveAttention
  onDispatch?: (id: string) => void
  dispatching?: boolean
}) {
  const [dialog, setDialog] = useState<'ack' | 'resolve' | 'escalate' | null>(null)
  /** An SOS source gets the dispatch action; everything else the alert actions. */
  const isSos =
    alert.source.toUpperCase().includes('SOS') || alert.issueType.toUpperCase().includes('SOS')

  return (
    <li className="border-line bg-surface rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">{alert.issueType}</p>
          <p className="text-ink-subtle text-xs break-words">
            {alert.recipientName ?? alert.caregiverName ?? alert.source}
          </p>
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>
      <p className="text-ink-muted mt-1.5 text-sm break-words">{alert.description}</p>
      <p className="text-ink-subtle mt-1 text-xs break-words">
        {alert.source}
        {alert.timeLabel && ` · ${alert.timeLabel}`}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {isSos && onDispatch ? (
          <button
            type="button"
            onClick={() => onDispatch(alert.id)}
            disabled={dispatching}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Siren className="size-4" strokeWidth={2} aria-hidden="true" />
            Dispatch
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setDialog('ack')}
              className="border-control text-ink hover:bg-sunken inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium"
            >
              Acknowledge
            </button>
            <button
              type="button"
              onClick={() => setDialog('escalate')}
              className="border-control text-ink hover:bg-sunken inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium"
            >
              Escalate
            </button>
            <button
              type="button"
              onClick={() => setDialog('resolve')}
              className="inline-flex min-h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Resolve
            </button>
          </>
        )}
      </div>

      {dialog === 'ack' && <LiveAcknowledgeDialog alert={alert} onClose={() => setDialog(null)} />}
      {dialog === 'resolve' && <LiveResolveDialog alert={alert} onClose={() => setDialog(null)} />}
      {dialog === 'escalate' && <LiveEscalateDialog alert={alert} onClose={() => setDialog(null)} />}
    </li>
  )
}

function AttentionPanel() {
  const query = useAttention()
  if (query.isPending) return <Spinner label="Loading attention queue…" />
  if (query.isError)
    return <ErrorCard message={query.error.message} onRetry={() => void query.refetch()} />
  if (query.data.length === 0)
    return (
      <Panel title="Attention Required" titleClassName="text-base font-bold">
        <p className="text-ink-subtle py-8 text-center text-sm" role="status">
          Nothing on the board needs a coordinator right now.
        </p>
      </Panel>
    )
  return (
    <Panel
      title={`Attention Required (${query.data.length})`}
      titleClassName="text-base font-bold"
      className="bg-canvas border-transparent"
    >
      <ul className="space-y-3">
        {query.data.map((alert) => (
          <AttentionCard key={alert.id} alert={alert} />
        ))}
      </ul>
    </Panel>
  )
}

/* ----------------------------- active visits ------------------------------ */

function ActiveVisitsPanel({
  filters,
  params,
  setParams,
}: {
  filters: LiveFilters
  params: URLSearchParams
  setParams: (next: URLSearchParams) => void
}) {
  const status = params.get('status') ?? 'all'
  const requestedPage = Number(params.get('page'))
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1

  const query: ActiveVisitsQuery = { ...filters, status, page, pageSize: PAGE_SIZE }
  const result = useActiveVisits(query)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <section aria-labelledby="board-table" className="space-y-4">
      <h2 id="board-table" className="sr-only">
        Active visits
      </h2>

      <div
        role="group"
        aria-label="Filter by status"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        {ACTIVE_STATUSES.map((chip) => {
          const on = status === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={on}
              onClick={() => setParam('status', on ? 'all' : chip.value)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3.5 text-sm font-medium transition-colors sm:min-h-9.5',
                on
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-line bg-surface text-ink-muted hover:bg-sunken',
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        {result.isPending ? (
          <Spinner label="Loading visits…" />
        ) : result.isError ? (
          <ErrorCard message={result.error.message} onRetry={() => void result.refetch()} />
        ) : result.data.rows.length === 0 ? (
          <p className="text-ink-subtle px-4 py-10 text-center text-sm" role="status">
            No visit matches those filters.
          </p>
        ) : (
          <>
            <div
              tabIndex={0}
              role="region"
              aria-label="Active visits table"
              className="hidden overflow-x-auto xl:block"
            >
              <table className="w-full min-w-3xl text-left text-sm">
                <thead className="text-ink-subtle border-line border-b text-xs">
                  <tr>
                    {[
                      'Visit ID',
                      'Care Recipient',
                      'Caregiver',
                      'Service',
                      'Check-in Time',
                      'Status',
                    ].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-5 py-3.5 font-semibold tracking-wide uppercase"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {result.data.rows.map((visit) => (
                    <tr key={visit.visitId} className="even:bg-canvas transition-colors">
                      <th scope="row" className="px-5 py-3.5 font-normal">
                        <Link
                          to={`/scheduling/visits/${visit.visitId}/overview`}
                          className="text-brand-700 hover:text-brand-800 font-medium whitespace-nowrap"
                        >
                          {visit.reference}
                        </Link>
                      </th>
                      <td className="text-ink px-5 py-3.5 font-semibold whitespace-nowrap">
                        {visit.recipientName}
                      </td>
                      <td className="text-ink-muted px-5 py-3.5 whitespace-nowrap">
                        {visit.caregiverName ?? (
                          <span className="font-medium text-red-700">Unassigned</span>
                        )}
                      </td>
                      <td className="text-ink-muted px-5 py-3.5">{visit.service}</td>
                      <td className="text-ink-muted px-5 py-3.5 whitespace-nowrap tabular-nums">
                        {visit.checkInTimeLabel ?? (
                          <span className="text-ink-subtle">Not recorded</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="bg-sunken text-ink-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
                          {titleCase(visit.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-line divide-y xl:hidden">
              {result.data.rows.map((visit) => (
                <li key={visit.visitId} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        name={visit.caregiverName ?? visit.recipientName}
                        decorative
                        className="size-8"
                      />
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold break-words">
                          {visit.recipientName}
                        </p>
                        <p className="text-ink-subtle text-xs break-words">
                          {visit.service} ·{' '}
                          {visit.caregiverName ?? (
                            <span className="font-medium text-red-700">Unassigned</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="bg-sunken text-ink-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
                      {titleCase(visit.status)}
                    </span>
                  </div>
                  <p className="text-ink-subtle mt-2 flex flex-wrap items-center gap-x-2 text-xs">
                    <Link
                      to={`/scheduling/visits/${visit.visitId}/overview`}
                      className="text-brand-700 hover:text-brand-800 font-medium"
                    >
                      {visit.reference}
                    </Link>
                    <span aria-hidden="true">·</span>
                    <span>Check-in {visit.checkInTimeLabel ?? 'not recorded'}</span>
                  </p>
                </li>
              ))}
            </ul>

            {result.data.total > PAGE_SIZE && (
              <Pagination
                page={result.data.page}
                pageCount={Math.max(1, Math.ceil(result.data.total / PAGE_SIZE))}
                onPageChange={(n) => setParam('page', n === 1 ? '' : String(n))}
                summary={`${result.data.total} visit${result.data.total === 1 ? '' : 's'}`}
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}

/* ---------------------------------- map ----------------------------------- */

function MapPanel({
  filters,
  params,
  setParams,
}: {
  filters: LiveFilters
  params: URLSearchParams
  setParams: (next: URLSearchParams) => void
}) {
  const result = useLiveMap(filters)
  const pin = params.get('pin')

  const select = (id: string) => {
    const next = new URLSearchParams(params)
    if (id === pin) next.delete('pin')
    else next.set('pin', id)
    setParams(next)
  }

  if (result.isPending) return <Spinner label="Loading map…" />
  if (result.isError)
    return <ErrorCard message={result.error.message} onRetry={() => void result.refetch()} />

  const pinned = result.data.visits.find((v) => v.visitId === pin) ?? null

  return (
    <section aria-labelledby="map-heading" className="space-y-4">
      <h2 id="map-heading" className="sr-only">
        Where today&rsquo;s visits are
      </h2>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LiveVisitMap
            visits={result.data.visits}
            sos={result.data.sos}
            selectedId={pinned?.visitId ?? null}
            onSelect={select}
          />
        </div>
        <div className="space-y-4">
          {pinned ? (
            <Panel titleClassName="text-base font-bold" title="Selected Active Visit">
              <div className="divide-line divide-y">
                <div className="pb-4">
                  <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
                    Visit code
                  </p>
                  <Link
                    to={`/scheduling/visits/${pinned.visitId}/overview`}
                    className="text-brand-700 hover:text-brand-800 mt-1 block text-base font-semibold"
                  >
                    {pinned.reference}
                  </Link>
                </div>
                <div className="space-y-4 py-4">
                  <div>
                    <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
                      Care recipient
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <Avatar name={pinned.recipientName} decorative className="size-9" />
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold break-words">
                          {pinned.recipientName}
                        </p>
                        <p className="text-ink-subtle text-xs break-words">
                          {pinned.recipientAddress ?? 'No address on file'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
                      Assigned caregiver
                    </p>
                    {pinned.caregiverName ? (
                      <div className="mt-2 flex items-center gap-3">
                        <Avatar name={pinned.caregiverName} decorative className="size-9" />
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-semibold break-words">
                            {pinned.caregiverName}
                          </p>
                          <p className="text-ink-subtle text-xs break-words">
                            {pinned.caregiverTitle ?? 'Caregiver'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-red-700">Nobody assigned</p>
                    )}
                  </div>
                </div>
                <dl className="space-y-2.5 py-4 text-sm">
                  <MapFact label="Service scheduled" value={pinned.serviceScheduled} />
                  <MapFact label="Status" value={titleCase(pinned.status)} />
                  <MapFact label="Check-in time" value={pinned.checkInTimeLabel ?? 'Not recorded'} />
                </dl>
              </div>
              <div className="pt-4">
                <Link
                  to={`/scheduling/visits/${pinned.visitId}/overview`}
                  className="bg-brand-600 hover:bg-brand-700 flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
                >
                  View Visit Details
                </Link>
              </div>
            </Panel>
          ) : (
            <Panel titleClassName="text-base font-bold" title="Selected Active Visit">
              <p className="text-ink-subtle text-sm" role="status">
                Choose a pin to see the visit and its address.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </section>
  )
}

function MapFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink font-medium break-words">{value}</dd>
    </div>
  )
}
