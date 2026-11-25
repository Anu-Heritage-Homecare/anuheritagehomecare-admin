import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Download, Layers, Loader2, TriangleAlert } from 'lucide-react'
import {
  docsLabels,
  docsStatus,
  docsTones,
  familyNameFor,
  paymentLabels,
  paymentTones,
  planFit,
  priorityFor,
  serviceGaps,
  priorityLabels,
  priorityTones,
  REQUESTS_PAGE_SIZE,
  sortOptions,
  sortRequests,
  statusFor,
  statusLabels,
  statusTones,
} from '@/features/care-recipients/requests-data'
import type {
  CareRequest,
  Priority,
  RequestSort,
  RequestStatus,
} from '@/features/care-recipients/requests-data'
import { RequestDetail } from '@/features/care-recipients/RequestDetail'
import { planById, plans } from '@/features/billing/data'
import { useCareRequests } from '@/features/billing/useCareRequests'
import { Panel } from '@/components/ui/Panel'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

/** Queue status tally over the live rows, for the summary tiles. */
function tallyStatuses(list: CareRequest[]): Record<RequestStatus, number> {
  const counts: Record<RequestStatus, number> = {
    approved: 0,
    rejected: 0,
    ready: 0,
    'pending-review': 0,
    'needs-changes': 0,
  }
  for (const r of list) counts[statusFor(r)] += 1
  return counts
}

const chip =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const statusOptions: RequestStatus[] = [
  'pending-review',
  'needs-changes',
  'ready',
  'approved',
  'rejected',
]

const priorityOptions: Priority[] = ['high', 'medium', 'low']

function isOneOf<T extends string>(
  value: string | null,
  list: readonly T[],
): T | 'all' {
  return value && (list as readonly string[]).includes(value)
    ? (value as T)
    : 'all'
}

export function CareRequestsPage() {
  const { requestId } = useParams()
  const [params, setParams] = useSearchParams()

  /*
   * The backend queue defaults to its own PENDING status, but the page filters
   * on statuses it derives client side (ready, needs changes, under review), so
   * the whole queue is fetched once and the derived filtering below runs over
   * it. A single generous page covers the intake volume; the server also
   * paginates if that assumption ever breaks.
   */
  const { data, isPending, isError, error, refetch } = useCareRequests(null, 1, 200)
  const liveRequests = useMemo(() => data?.requests ?? [], [data])

  // Filters, the open request and the page all live in the URL, so a queue
  // someone is working through can be handed to a colleague as a link.
  const query = params.get('q') ?? ''
  const status = isOneOf(params.get('status'), statusOptions)
  const priority = isOneOf(params.get('priority'), priorityOptions)
  const plan = isOneOf(
    params.get('plan'),
    plans.map((p) => p.id),
  )
  const sort = (sortOptions.find((o) => o.value === params.get('sort'))
    ?.value ?? 'priority') as RequestSort
  // Floored: "?page=2.5" otherwise survived the clamp and produced a page
  // number no pagination control could match.
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Any filter change invalidates the page cursor.
    if (key !== 'page') next.delete('page')
    // Typing in the filter box shouldn't stack history entries; paging should,
    // or Back never returns to the previous page of results.
    setParams(next, { replace: key !== 'page' })
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = liveRequests.filter((r) => {
      if (status !== 'all' && statusFor(r) !== status) return false
      if (priority !== 'all' && priorityFor(r) !== priority) return false
      if (plan !== 'all' && r.planId !== plan) return false
      if (!needle) return true
      return (
        r.ref.toLowerCase().includes(needle) ||
        r.patient.name.toLowerCase().includes(needle) ||
        familyNameFor(r.patient.name).toLowerCase().includes(needle) ||
        planById[r.planId].name.toLowerCase().includes(needle) ||
        (r.coordinator ?? '').toLowerCase().includes(needle)
      )
    })
    return sortRequests(matched, sort)
  }, [liveRequests, query, status, priority, plan, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / REQUESTS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * REQUESTS_PAGE_SIZE
  const rows = filtered.slice(start, start + REQUESTS_PAGE_SIZE)

  const selected = liveRequests.find((r) => r.id === requestId)
  const counts = tallyStatuses(liveRequests)

  const search = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(priority !== 'all' ? { priority } : {}),
    ...(plan !== 'all' ? { plan } : {}),
    ...(sort !== 'priority' ? { sort } : {}),
    ...(safePage > 1 ? { page: String(safePage) } : {}),
  }).toString()
  const suffix = search ? `?${search}` : ''

  // An unknown reference is a dead end, not an empty aside. Only once the queue
  // has loaded, so a deep link isn't bounced while the rows are still in flight.
  if (!isPending && !isError && requestId && !selected)
    return <Navigate to={`/care-recipients/requests${suffix}`} replace />

  /*
   * "Open" and "Blocked" were the same set by construction — every undecided
   * request with a blocker is exactly what `statusFor` calls pending or
   * needing changes. Split by who has to act instead.
   */
  const withFamily = counts['needs-changes']
  const withUs = counts['pending-review']
  // A plan the family picked that can't deliver what they asked for, whether
  // by hours or by the services it includes.
  const mismatched = liveRequests.filter(
    (r) => !planFit(r).fits || serviceGaps(r).length > 0,
  ).length

  const tiles = [
    {
      id: 'ready',
      label: 'Ready to approve',
      value: counts.ready,
      hint: 'Nothing outstanding',
    },
    {
      id: 'ours',
      label: 'Waiting on us',
      value: withUs,
      hint: 'Assignment or a clearing deposit',
    },
    {
      id: 'family',
      label: 'Waiting on the family',
      value: withFamily,
      hint: 'Documents, payment or plan',
    },
    {
      id: 'mismatch',
      label: 'Plan mismatches',
      value: mismatched,
      hint: 'Rota or services not covered',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Care Requests
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Evaluate and process family-selected care plans awaiting
            verification and clinical assignment. An approved request becomes a
            care recipient.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            <Layers className="size-4" strokeWidth={1.9} aria-hidden="true" />
            Bulk actions
          </button>
          <button
            type="button"
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            <Download className="size-4" strokeWidth={1.9} aria-hidden="true" />
            Export
          </button>
        </div>
      </header>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading care requests…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load care requests.</p>
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
      <section aria-labelledby="queue-counts">
        <h2 id="queue-counts" className="sr-only">
          Queue counts
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <article key={t.id} className="card p-4">
              <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
                {t.label}
              </p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-tight tabular-nums">
                {t.value}
              </p>
              <p className="text-ink-subtle mt-1 text-xs break-words">
                {t.hint} · of {liveRequests.length} in the queue
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* The queue is the page; the record is the follow-up. Side by side where
          there is room, stacked below it where there isn't.
          The old 1730px threshold put the split one pixel out of reach of a
          16-inch laptop (1728px), so an opened request always landed below the
          fold. It now splits at 1600px with a narrower rail, which the table's
          min-content width — 1020px once the secondary lines in Family and
          Requested plan are allowed to wrap — leaves room for. */}
      <div className="grid grid-cols-1 items-start gap-4 min-[1600px]:grid-cols-[minmax(0,1fr)_22rem] min-[1850px]:grid-cols-[minmax(0,1fr)_26rem]">
        <Panel title="Request queue" flush>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Filter requests</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Filter by reference, family, patient or plan"
                className="border-line focus:border-brand-500 h-10 w-full min-w-40 rounded-lg border px-3 text-sm"
              />
            </label>
            <SelectFilter
              label="Status"
              value={status}
              onChange={(v) => setParam('status', v === 'all' ? null : v)}
              options={[
                { value: 'all', label: 'All statuses' },
                ...statusOptions.map((s) => ({
                  value: s,
                  label: statusLabels[s],
                })),
              ]}
            />
            <SelectFilter
              label="Priority"
              value={priority}
              onChange={(v) => setParam('priority', v === 'all' ? null : v)}
              options={[
                { value: 'all', label: 'All priorities' },
                ...priorityOptions.map((p) => ({
                  value: p,
                  label: priorityLabels[p],
                })),
              ]}
            />
            <SelectFilter
              label="Sort"
              value={sort}
              onChange={(v) => setParam('sort', v === 'priority' ? null : v)}
              options={sortOptions}
            />
            <SelectFilter
              label="Plan"
              value={plan}
              onChange={(v) => setParam('plan', v === 'all' ? null : v)}
              options={[
                { value: 'all', label: 'All plans' },
                ...plans.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          {rows.length === 0 ? (
            <p
              role="status"
              className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
            >
              No requests match these filters.
            </p>
          ) : (
            <>
              <div
                tabIndex={0}
                role="region"
                aria-label="Care requests table"
                className="hidden overflow-x-auto xl:block"
              >
                {/* px-3 rather than the px-4 the app's other tables use: this
                    is the widest table here at eight columns, and the 64px it
                    saves is what lets it sit beside the detail rail on a
                    16-inch laptop instead of scrolling. */}
                <table className="w-full min-w-4xl text-left text-sm">
                  <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
                    <tr>
                      {[
                        'Reference',
                        'Family',
                        'Requested plan',
                        'Priority',
                        'Payment',
                        'Documents',
                        'Coordinator',
                        'Status',
                      ].map((col) => (
                        <th
                          key={col}
                          scope="col"
                          className="px-3 py-2.5 font-semibold tracking-wide uppercase"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {rows.map((r) => (
                      <QueueRow
                        key={r.id}
                        request={r}
                        selected={r.id === requestId}
                        to={`/care-recipients/requests/${r.id}${suffix}`}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-line border-line divide-y border-t xl:hidden">
                {rows.map((r) => (
                  <QueueCard
                    key={r.id}
                    request={r}
                    selected={r.id === requestId}
                    to={`/care-recipients/requests/${r.id}${suffix}`}
                  />
                ))}
              </ul>

              <Pagination
                page={safePage}
                pageCount={pageCount}
                onPageChange={(next) =>
                  setParam('page', next === 1 ? null : String(next))
                }
                summary={`Showing ${start + 1}–${start + rows.length} of ${filtered.length} requests`}
              />
            </>
          )}
        </Panel>

        {/* Sticky beside the queue so paging through the table never scrolls
            the open record out of view; it scrolls itself when it is taller
            than the window. Below the split it is a plain block again. */}
        <div className="min-[1600px]:sticky min-[1600px]:top-6 min-[1600px]:max-h-[calc(100vh-3rem)] min-[1600px]:overflow-y-auto">
          {selected ? (
            <RequestDetail
              request={selected}
              closeTo={`/care-recipients/requests${suffix}`}
            />
          ) : (
            <div className="card text-ink-subtle p-6 text-sm">
              <p className="font-medium">No request open.</p>
              <p className="mt-1">
                Pick a reference from the queue to see the patient, the family
                contact, the requested rota and what is blocking approval.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-ink-subtle text-xs">
        <TriangleAlert className="mr-1 inline size-3" aria-hidden="true" />
        Requests are prospective clients. Anyone already in the{' '}
        <Link to="/care-recipients" className="text-brand-700">
          care recipient directory
        </Link>{' '}
        has been onboarded and does not appear here.
      </p>
      </>
      )}
    </div>
  )
}

/* ---------------------------------- rows ---------------------------------- */

function QueueRow({
  request,
  selected,
  to,
}: {
  request: CareRequest
  selected: boolean
  to: string
}) {
  const status = statusFor(request)
  const priority = priorityFor(request)
  const docs = docsStatus(request)
  const fit = planFit(request)
  const gaps = serviceGaps(request)

  return (
    <tr
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'transition-colors',
        selected ? 'bg-brand-50' : 'hover:bg-canvas',
      )}
    >
      <th scope="row" className="px-3 py-3 font-normal whitespace-nowrap">
        <Link
          to={to}
          className="text-brand-700 hover:text-brand-800 font-medium"
        >
          {request.ref}
        </Link>
      </th>
      {/* nowrap on the name, not the cell: the secondary line is the long one,
          and letting it wrap is what keeps the table beside the detail rail. */}
      <td className="px-3 py-3">
        <span className="text-ink whitespace-nowrap">
          {familyNameFor(request.patient.name)}
        </span>
        <span className="text-ink-subtle block text-xs">
          {request.patient.name} ({request.patient.age})
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="text-ink-muted whitespace-nowrap">
          {planById[request.planId].name}
        </span>
        {!fit.fits && (
          <span className="block text-xs font-semibold text-red-700">
            {fit.requestedHours}h a month requested, {fit.allowanceHours}h
            allowed
          </span>
        )}
        {gaps.length > 0 && (
          <span className="block text-xs font-semibold text-red-700">
            Excludes {gaps.map((g) => g.label.toLowerCase()).join(', ')}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={cn(chip, tonePill[priorityTones[priority]])}>
          {priorityLabels[priority]}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={cn(chip, tonePill[paymentTones[request.payment]])}>
          {paymentLabels[request.payment]}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={cn(chip, tonePill[docsTones[docs]])}>
          {docsLabels[docs]}
        </span>
      </td>
      <td
        className={cn(
          'px-3 py-3',
          request.coordinator ? 'text-ink-muted' : 'text-ink-subtle',
        )}
      >
        {request.coordinator ?? 'Unassigned'}
      </td>
      <td className="px-3 py-3">
        <span className={cn(chip, tonePill[statusTones[status]])}>
          {statusLabels[status]}
        </span>
      </td>
    </tr>
  )
}

function QueueCard({
  request,
  selected,
  to,
}: {
  request: CareRequest
  selected: boolean
  to: string
}) {
  const status = statusFor(request)
  const priority = priorityFor(request)
  const fit = planFit(request)
  const gaps = serviceGaps(request)

  return (
    <li
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'p-4',
        // A left rule and a word, not just a tint: the open row has to survive
        // without colour and be announced.
        selected && 'border-brand-500 bg-brand-50 border-l-4 pl-3',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={to}
            className="text-ink hover:text-brand-700 text-sm font-semibold break-words"
          >
            {familyNameFor(request.patient.name)}
          </Link>
          {selected && (
            <span className="text-brand-700 ml-2 text-xs font-semibold">
              Open
            </span>
          )}
          <p className="text-ink-subtle mt-0.5 text-xs break-words">
            {request.ref} · {request.patient.name} ({request.patient.age})
          </p>
        </div>
        <span className={cn(chip, tonePill[statusTones[status]])}>
          {statusLabels[status]}
        </span>
      </div>
      <p className="text-ink-muted mt-2 text-sm break-words">
        {planById[request.planId].name} · {priorityLabels[priority]} priority ·
        payment {paymentLabels[request.payment].toLowerCase()} ·{' '}
        {docsLabels[docsStatus(request)].toLowerCase()} documents
      </p>
      <p className="text-ink-subtle mt-0.5 text-xs">
        {request.coordinator ?? 'Unassigned'}
      </p>
      {!fit.fits && (
        <p className="mt-1 text-xs font-semibold text-red-700">
          Rota needs {fit.requestedHours}h a month; the plan allows{' '}
          {fit.allowanceHours}h
        </p>
      )}
      {gaps.length > 0 && (
        <p className="mt-1 text-xs font-semibold text-red-700">
          Plan excludes {gaps.map((g) => g.label.toLowerCase()).join(', ')}
        </p>
      )}
    </li>
  )
}
