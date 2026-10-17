import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, RefreshCw, TriangleAlert } from 'lucide-react'
import {
  CHECK_IN_GRACE_MINUTES,
  NOW,
  TODAY,
  activityAt,
  alertKindLabels,
  alertsAt,
  telHref,
  countBySeverity,
  filterAlerts,
  formatGap,
  formatTime,
  liveBoard,
  liveStats,
  minutesOfDay,
  minutesToClock,
  stateLabels,
  stateTones,
} from '@/features/monitoring/live-data'
import type {
  LiveAlert,
  LiveState,
  LiveVisit,
} from '@/features/monitoring/live-data'
import { branchesOnRoster } from '@/features/scheduling/assign-data'
import { referenceFor } from '@/features/scheduling/visit-detail'
import { VisitTileMap } from '@/features/monitoring/VisitTileMap'
import { AcknowledgeAlertDialog } from '@/features/monitoring/AcknowledgeAlertDialog'
import { EscalateAlertDialog } from '@/features/monitoring/EscalateAlertDialog'
import { ResolveAlertDialog } from '@/features/monitoring/ResolveAlertDialog'
import { ReportIncidentDialog } from '@/features/monitoring/ReportIncidentDialog'
import { useFiledNotes } from '@/features/care-recipients/notes-data'
import {
  canResolve,
  escalationReasonLabels,
  escalationTiers,
  resolutionCategoryLabels,
  useAlertActions,
  withdrawAcknowledgement,
  withdrawEscalation,
  withdrawResolution,
} from '@/features/monitoring/alert-actions'
import {
  branchDistanceMiles,
  formatMiles,
  placeOfRecipient,
  travelMiles,
} from '@/features/monitoring/locations-data'
import { Avatar } from '@/components/ui/Avatar'
import { ClockCard } from '@/features/monitoring/ClockCard'
import { Drawer } from '@/components/ui/Drawer'
import { Pagination } from '@/components/ui/Pagination'
import { Panel } from '@/components/ui/Panel'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { SeverityBadge } from '@/components/ui/StatusBadge'
import { staffMembers } from '@/features/caregivers/roster-data'
import { toneFill, tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

/*
 * Four lists of *visits*, and nothing else.
 *
 * Three of them are lists of *visits*. "Attention Required" is the exception
 * and is a work queue: one row per thing a coordinator can still act on, with
 * the button to act on it. It is deliberately not the Alerts & incidents page
 * — that page is the whole record, filterable by source and provenance and
 * including everything already settled. This tab is only what is still open,
 * and it leads with the client's name and the action rather than with where
 * the fact came from.
 */
const views = [
  { slug: 'now', label: 'Live Overview' },
  { slug: 'visits', label: 'Active Visits' },
  { slug: 'attention', label: 'Attention Required' },
  { slug: 'map', label: 'Map View' },
] as const

type View = (typeof views)[number]['slug']

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * What the page filters by: any `LiveState`, plus three sets derived from the
 * clock and the alerts rather than read off a row. "Active" is the design's
 * word for a visit between its start and its end, which is several states at
 * once — comparing it to a row's state matches nothing.
 */
const derivedStatuses = ['active', 'checked-in', 'attention']

function matchesStatus(
  visit: LiveVisit,
  status: string,
  attentionIds: Set<string>,
): boolean {
  switch (status) {
    case 'all':
      return true
    case 'active':
      return visit.sinceStart >= 0 && visit.pastEnd < 0
    // A visit record is the only evidence of a check-in, and a record that
    // exists for an 8pm visit is not a check-in at 6am — hence the second half.
    case 'checked-in':
      return visit.clockIn !== null && visit.sinceStart >= 0
    case 'attention':
      return attentionIds.has(visit.id)
    default:
      return visit.state === status
  }
}

const derivedStatusLabels: Record<string, string> = {
  active: 'Active',
  'checked-in': 'Checked in',
  attention: 'Needs attention',
}

/** What a status reads as in the Visit Status list. */
function statusLabel(status: string): string {
  return derivedStatusLabels[status] ?? stateLabels[status as LiveState]
}

/**
 * The rail under the tabs — the design's labels over the nearest thing this
 * app can evidence. Each chip writes the same `state` the Visit Status select
 * does, so the two are one control in two shapes.
 *
 * The design's sixth chip is "Overdue", which over this data is the same set
 * as its "Running Late": a visit with no check-in past the grace. Overrunning
 * takes that slot instead, being the one live state the rail could not
 * otherwise reach.
 */
const statusChips: { value: string; label: string; hint: string }[] = [
  {
    value: 'active',
    label: 'All Active',
    hint: 'Between its start and its end at the time shown.',
  },
  {
    value: 'checked-in',
    label: 'Checked In',
    hint: 'A visit record with a check-in time on it.',
  },
  {
    value: 'in-progress',
    label: 'In Progress',
    hint: 'Checked in and inside its window.',
  },
  {
    value: 'overdue',
    label: 'Running Late',
    hint: `No check-in more than ${CHECK_IN_GRACE_MINUTES} minutes after the visit was due to start.`,
  },
  {
    value: 'overrunning',
    label: 'Overrunning',
    hint: 'Past its scheduled end with no clock-out.',
  },
  {
    value: 'attention',
    label: 'Attention Required',
    hint: 'Has an alert a coordinator can still act on.',
  },
]

/** Every state `stateOf` can return, so a visible badge is always selectable. */
const selectableStates: LiveState[] = [
  'unattended',
  'overdue',
  'awaiting-check-in',
  'in-progress',
  'overrunning',
  'due',
  'upcoming',
  'unrecorded',
  'uncovered',
  'cancelled',
  'completed',
]

const PAGE_SIZE = 8

/**
 * Chip order follows the row order the board sorts by, so the chip for a state
 * near the top of the table is near the start of the rail.
 */
const orderedStates: LiveState[] = [
  'unattended',
  'overdue',
  'awaiting-check-in',
  'uncovered',
  'overrunning',
  'in-progress',
  'due',
  'upcoming',
  'unrecorded',
  'cancelled',
  'completed',
]

/** The clock-in the log captured, formatted — or null when there is none. */
function checkInOf(visit: LiveVisit): string | null {
  // Not shown before the visit is due: a record that exists for a 9am slot is
  // not a check-in at 6am, which is the same rule the "Written up" tile uses.
  if (!visit.clockIn || visit.sinceStart < 0) return null
  return formatTime(visit.clockIn)
}

export function LiveMonitoringPage() {
  const [params, setParams] = useSearchParams()

  const requested = params.get('at')
  // A hand-edited clock falls back rather than throwing; everything on this
  // page is a function of it.
  // Snapped to the slider's own step, so the thumb and the label agree.
  const now =
    requested && CLOCK.test(requested)
      ? minutesToClock(Math.round(minutesOfDay(formatTime(requested)) / 15) * 15)
      : NOW
  const requestedView = params.get('view')
  const view = (views.find((v) => v.slug === requestedView)?.slug ?? 'now') as View
  // Validated against the options: an unrecognised value left the select
  // reading "Any state" over an empty list.
  const rawState = params.get('state') ?? 'all'
  const state =
    derivedStatuses.includes(rawState) ||
    (selectableStates as string[]).includes(rawState)
      ? rawState
      : 'all'
  const rawBranch = params.get('branch') ?? 'all'
  const branch =
    rawBranch === 'none' || branchesOnRoster.includes(rawBranch) ? rawBranch : 'all'

  /** The whole board at this minute, before the header's filters. */
  const board = useMemo(() => liveBoard(TODAY, now), [now])

  const branchOf = useMemo(() => {
    const map = new Map(staffMembers.map((m) => [m.id, m.branch]))
    return (visit: LiveVisit) =>
      visit.caregiverId ? (map.get(visit.caregiverId) ?? null) : null
  }, [])

  /**
   * Service types actually booked today, not the full catalogue — a filter
   * must never offer a value with nothing behind it.
   */
  const serviceTypes = useMemo(
    () => [...new Set(board.map((r) => r.type))].sort((a, b) => a.localeCompare(b)),
    [board],
  )
  const rawService = params.get('service') ?? 'all'
  const service = serviceTypes.includes(rawService) ? rawService : 'all'

  /*
   * Everything today has raised, cut by branch and service but not by status —
   * the status filter is partly *about* these, since the "Attention Required"
   * chip means the visits with an open alert.
   *
   * `notesVersion` bumps when somebody files a write-up on this page:
   * `alertsAt` reads the care notes, so an incident filed here raises its own
   * alert, but only if the memo is told the notes moved.
   */
  const notesVersion = useFiledNotes()
  const scopedAlerts = useMemo(() => {
    void notesVersion
    return filterAlerts(alertsAt(TODAY, now), {
      tab: 'all',
      branch,
      visitState: 'all',
      serviceType: service,
    })
  }, [now, notesVersion, branch, service])

  /** Visits carrying an alert somebody can still act on. */
  const attentionIds = useMemo(
    () =>
      new Set(
        scopedAlerts
          .filter((a) => a.timing === 'changeable' && a.visitState !== null)
          .map((a) => a.thread),
      ),
    [scopedAlerts],
  )

  /*
   * The header's filters and the chip rail scope the whole page rather than
   * one tab: the tiles, the overview lists, the board table, the map and the
   * alerts all read what these leave. A filter that bit on one tab only was
   * live in the URL and invisible everywhere else.
   */
  const rows = useMemo(
    () =>
      board.filter(
        (r) =>
          (branch === 'all' ||
            (branch === 'none' ? branchOf(r) === null : branchOf(r) === branch)) &&
          (service === 'all' || r.type === service) &&
          matchesStatus(r, state, attentionIds),
      ),
    [board, branch, service, state, branchOf, attentionIds],
  )
  const stats = useMemo(() => liveStats(rows), [rows])

  /*
   * With a status chosen, the alerts are the alerts of the visits still on the
   * board — matched by visit rather than by comparing an alert's state to the
   * filter's word. Comparing is what emptied every list the moment "Active"
   * was picked: no row holds a state called "active".
   */
  const alerts = useMemo(() => {
    if (state === 'all') return scopedAlerts
    const visible = new Set(rows.map((r) => r.id))
    return scopedAlerts.filter((a) => visible.has(a.thread))
  }, [scopedAlerts, rows, state])
  /*
   * What the Attention Required tab lists: the alerts a coordinator can still
   * do something about. Not the same set as the Alerts & incidents page, which
   * is the whole log including what is already on the record — this tab is the
   * work queue, that page is the record.
   */
  const attention = useMemo(
    () => alerts.filter((a) => a.timing === 'changeable'),
    [alerts],
  )
  /* An entry is a thing that happened to a visit, so it is in scope exactly
     when its visit is. */
  const activity = useMemo(() => {
    const scoped = new Set(rows.map((r) => r.id))
    return activityAt(TODAY, now).filter((e) => scoped.has(e.visitId))
  }, [now, rows])
  /** The design shows a handful; the rest of the day is below the fold anyway. */
  const recentActivity = useMemo(() => activity.slice(0, 6), [activity])
  const allSeverities = useMemo(() => countBySeverity(alerts), [alerts])

  /*
   * Each filter's options are counted from what the *other two* leave, so an
   * option is never a non-zero number over a list it would empty.
   */
  const beforeBranch = useMemo(
    () =>
      board.filter(
        (r) =>
          (service === 'all' || r.type === service) &&
          matchesStatus(r, state, attentionIds),
      ),
    [board, service, state, attentionIds],
  )
  const beforeService = useMemo(
    () =>
      board.filter(
        (r) =>
          (branch === 'all' ||
            (branch === 'none' ? branchOf(r) === null : branchOf(r) === branch)) &&
          matchesStatus(r, state, attentionIds),
      ),
    [board, branch, state, branchOf, attentionIds],
  )
  const beforeState = useMemo(
    () =>
      board.filter(
        (r) =>
          (branch === 'all' ||
            (branch === 'none' ? branchOf(r) === null : branchOf(r) === branch)) &&
          (service === 'all' || r.type === service),
      ),
    [board, branch, service, branchOf],
  )

  /**
   * What each chip would leave, counted from the rows the *other two* filters
   * leave — so a chip is never a non-zero number over a list it would empty.
   */
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const chip of statusChips)
      counts.set(
        chip.value,
        beforeState.filter((r) => matchesStatus(r, chip.value, attentionIds)).length,
      )
    return counts
  }, [beforeState, attentionIds])

  const branchCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of beforeBranch) {
      const key = branchOf(r) ?? 'none'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [beforeBranch, branchOf])

  const serviceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of beforeService) counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    return counts
  }, [beforeService])

  /**
   * States present in what the other two filters leave, plus whichever state
   * is selected even when nothing matches it — otherwise moving the clock
   * dropped the selected option and left a filter applied with no sign of it.
   */
  const presentStates = useMemo(() => {
    const counts = new Map<LiveState, number>()
    for (const r of beforeState) counts.set(r.state, (counts.get(r.state) ?? 0) + 1)
    return orderedStates
      .filter((s) => counts.has(s) || s === state)
      .map((s) => [s, counts.get(s) ?? 0] as const)
  }, [beforeState, state])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const requestedPage = Number(params.get('page'))
  // Clamped, like every other paginated screen: a stale ?page= lands on the
  // last page rather than silently jumping to the first.
  const pageNumber =
    Number.isInteger(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, pageCount)
      : 1
  const page = rows.slice(
    (pageNumber - 1) * PAGE_SIZE,
    pageNumber * PAGE_SIZE,
  )
  const summary =
    rows.length === 0
      ? 'No visits'
      : `Showing ${(pageNumber - 1) * PAGE_SIZE + 1}\u2013${(pageNumber - 1) * PAGE_SIZE + page.length} of ${rows.length}${rows.length === board.length ? '' : ` matching, from ${board.length}`} visits on the board`

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    // A filter change invalidates the page number; staying on page 3 of a
    // one-page result showed nothing.
    if (key !== 'page') next.delete('page')
    if (key === 'view') {
      // The map plots what the header's filters leave, like every other view,
      // so the filters survive the switch. Only the pin is view-local.
      if (value !== 'map') next.delete('pin')
    }
    setParams(next, { replace: key === 'at' })
  }

  // Validated like every other param: a junk ?pin= left a dead value in the
  // URL over the placeholder.
  const pinned = rows.find((r) => r.id === params.get('pin')) ?? null
  /** The number the roster holds for whoever is on the pinned visit. */
  const caregiverPhone = pinned?.caregiverId
    ? (staffMembers.find((m) => m.id === pinned.caregiverId)?.phone ?? null)
    : null

  // Not in the URL: a panel is a way of looking at the page, not a place. A
  // shared link should open the board somebody meant to share, not their
  // sidebar.
  const [showingAlerts, setShowingAlerts] = useState(false)

  /** Whether the board is derived at the current minute. */
  const atNow = now === NOW
  /** Drop the clock override, so the board is back on the current minute. */
  const backToNow = () => {
    const next = new URLSearchParams(params)
    next.delete('at')
    setParams(next, { replace: true })
  }

  /**
   * The alerts page, carrying the clock and the header's filters — it names
   * the branch param `team`. Without this, a tile counted under one filter
   * opened a list counted under none.
   */
  const alertsHref = (extra?: Record<string, string>) => {
    const q = new URLSearchParams()
    if (now !== NOW) q.set('at', now)
    if (branch !== 'all') q.set('team', branch)
    if (state !== 'all') q.set('state', state)
    if (service !== 'all') q.set('service', service)
    for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v)
    const query = q.toString()
    return `/live-monitoring/alerts${query ? `?${query}` : ''}`
  }

  const live = rows.filter((r) => r.sinceStart >= 0 && r.pastEnd < 0)
  /**
   * The summary shows the top visit only — the board's own order puts the most
   * pressing one first — and the header link carries the rest.
   */
  const summaryVisits = live.slice(0, 1)
  /** The cards the design shows under Attention Required; the tab has the rest. */
  const queuePreview = attention.slice(0, 3)
  const attentionSearch = (() => {
    const q = new URLSearchParams(params)
    q.set('view', 'attention')
    q.delete('page')
    q.delete('pin')
    return `?${q.toString()}`
  })()
  /** The board below, filtered to exactly the visits the summary counts. */
  const activeVisitsSearch = (() => {
    const q = new URLSearchParams(params)
    q.set('view', 'visits')
    q.set('state', 'active')
    q.delete('page')
    q.delete('pin')
    return `?${q.toString()}`
  })()

  /*
   * The design's six tiles, in its order and with its labels. Each one sits
   * over the nearest thing this app can evidence; `note` is the tooltip that
   * says which, because the design gives a tile no sub-line to say it in.
   */
  const tiles = [
    {
      id: 'active',
      // The design's word for a visit between its start and its end. Nothing
      // here can assert somebody is in the house — only that the visit is
      // inside its window — so that is what is counted, and the note says so.
      label: 'Active Visits',
      value: stats.inWindow,
      note: `Visits inside their scheduled window at ${formatTime(now)}. A booking, not a confirmed attendance — ${stats.onDuty} of ${stats.rostered} rostered caregivers have checked in.`,
    },
    {
      id: 'checked-in',
      label: 'Caregivers Checked In',
      value: stats.onDuty,
      note: 'Distinct caregivers with a check-in recorded against a visit running now. A visit record is the only evidence of presence this app has.',
    },
    {
      id: 'due',
      label: 'Check-in Due',
      value: stats.awaiting,
      note: `Started, nothing recorded yet, still inside the ${CHECK_IN_GRACE_MINUTES}-minute grace.`,
      // A count of *visits* in a state, so it filters the board rather than
      // jumping to a list of alerts that counts differently.
      state: 'awaiting-check-in' as LiveState,
    },
    {
      id: 'late',
      label: 'Running Late',
      value: stats.overdue,
      note: `No check-in more than ${CHECK_IN_GRACE_MINUTES} minutes after the visit was due to start.`,
      state: 'overdue' as LiveState,
    },
    {
      id: 'attention',
      label: 'Attention Required',
      value: attention.length,
      note: 'Alerts a coordinator can still act on — the queue behind the tab of the same name.',
      view: 'attention' as View,
    },
    {
      id: 'critical',
      label: 'Critical Alerts',
      value: allSeverities.critical,
      note: 'Critical means somebody is without the care they are booked for. Opens the Emergencies tab of Alerts & incidents.',
      to: alertsHref({ tab: 'emergencies' }),
    },
  ]

  /*
   * Alerts were a fourth view of this board for the whole prior life of the
   * app, so every bookmark and shared link still says `?view=alerts`. Falling
   * back to "Happening now" was silent and left the dead param in the URL to
   * be re-shared; this sends them to the page that now owns that list.
   */
  if (requestedView === 'alerts') {
    const carried = new URLSearchParams()
    if (now !== NOW) carried.set('at', now)
    const query = carried.toString()
    return <Navigate to={`/live-monitoring/alerts${query ? `?${query}` : ''}`} replace />
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-ink text-2xl font-bold tracking-tight">
                Live Monitoring
              </h1>
              {/*
                The design reads "Live · Updated 30s ago", which asserts two
                things this page cannot: that something was fetched, and that
                it was fetched recently. What is true is the minute the board
                is derived at, and whether that minute is the current one — so
                that is what the indicator says, in the design's place and
                shape.
              */}
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold',
                  atNow ? 'text-emerald-700' : 'text-amber-700',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    atNow ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                {atNow ? 'Live' : 'Clock moved'} &middot; Board as at{' '}
                {formatTime(now)}
              </span>
            </div>
            <p className="text-ink-muted mt-1 max-w-2xl text-sm">
              Monitor active care visits, caregiver activity and operational
              alerts as they stand at the time shown.{' '}
              <Link to="/live-monitoring/history" className="text-brand-700">
                Monitoring history
              </Link>{' '}
              has the days that have finished.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/*
              The design's "Refresh". Nothing on this page is fetched, so the
              only honest job for it is putting the board back on the current
              minute — which is what it does, and it says so rather than
              pretending to reload when it is already there.
            */}
            <button
              type="button"
              onClick={() => {
                if (atNow) return
                backToNow()
              }}
              aria-disabled={atNow}
              title={
                atNow
                  ? 'Already at the current minute — nothing on this page is fetched.'
                  : `Put the board back to ${formatTime(NOW)}`
              }
              className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium aria-disabled:cursor-default aria-disabled:opacity-55 aria-disabled:hover:bg-transparent"
            >
              <RefreshCw
                className="size-4 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowingAlerts(true)}
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
            >
              <TriangleAlert
                className="size-4 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              View Alerts
              {/* Not in the design, kept for the same reason the tab counts
                  are: it is derived from the list the button opens. */}
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                {alerts.length}
              </span>
            </button>
          </div>
        </div>

        {/*
          One filter bar for the page, in the design's position. Counts ride in
          the option labels because the state chips they replace carried them,
          and each list is counted from what the other two filters leave.
        */}
        <div
          role="group"
          aria-label="Filter the board"
          className="flex flex-wrap items-center gap-2"
        >
          <SelectFilter
            chip
            label="Branch"
            value={branch}
            onChange={(v) => set('branch', v)}
            options={[
              { value: 'all', label: `All Branches (${beforeBranch.length})` },
              ...branchesOnRoster.map((b) => ({
                value: b,
                label: `${b} (${branchCounts.get(b) ?? 0})`,
              })),
              // A branch belongs to the caregiver, so an unassigned slot has
              // none. Without this option those visits were reachable from no
              // branch value at all and the counts did not add up to the board.
              ...((branchCounts.get('none') ?? 0) > 0 || branch === 'none'
                ? [
                    {
                      value: 'none',
                      label: `Not tied to a branch (${branchCounts.get('none') ?? 0})`,
                    },
                  ]
                : []),
            ]}
          />
          <SelectFilter
            chip
            label="Visit Status"
            value={state}
            onChange={(v) => set('state', v)}
            options={[
              // The design defaults this to "Active". Opening a monitoring
              // board on a filtered subset hides visits nobody asked to hide,
              // so the default stays All and "In progress" is one option down.
              { value: 'all', label: `All (${beforeState.length})` },
              // The derived sets, so everything the chip rail can select is
              // also reachable here — the two controls write the same param.
              ...derivedStatuses.map((value) => ({
                value,
                label: `${statusLabel(value)} (${
                  beforeState.filter((r) => matchesStatus(r, value, attentionIds))
                    .length
                })`,
              })),
              ...presentStates.map(([value, count]) => ({
                value,
                label: `${stateLabels[value]} (${count})`,
              })),
            ]}
          />
          <SelectFilter
            chip
            label="Service Type"
            value={service}
            onChange={(v) => set('service', v)}
            options={[
              { value: 'all', label: `All (${beforeService.length})` },
              ...serviceTypes.map((t) => ({
                value: t,
                label: `${t} (${serviceCounts.get(t) ?? 0})`,
              })),
            ]}
          />
          {(branch !== 'all' || state !== 'all' || service !== 'all') && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const key of ['state', 'branch', 'service', 'page'])
                  next.delete(key)
                setParams(next)
              }}
              className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center px-1 text-sm font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </header>

      <LiveAlertsPanel
        alerts={alerts}
        now={now}
        open={showingAlerts}
        onClose={() => setShowingAlerts(false)}
        allHref={alertsHref()}
      />

      <ClockCard
        now={now}
        onChange={(next) => set('at', next)}
        // Whatever the current view actually recomputes. Announcing the alert
        // count on the map view described a list that is not on screen — and
        // is no longer on this page at all.
        summary={
          view === 'visits'
            ? `${formatTime(now)} — ${rows.length} visit${rows.length === 1 ? '' : 's'} listed.`
            : view === 'map'
              ? `${formatTime(now)} — ${rows.length} visit${rows.length === 1 ? '' : 's'} plotted.`
              : `${formatTime(now)} — ${stats.inWindow} visit${stats.inWindow === 1 ? '' : 's'} in window, ${alerts.length} alert${alerts.length === 1 ? '' : 's'}.`
        }
      />

      {/* --------------------------------- tiles -------------------------------- */}

      <section aria-labelledby="live-totals">
        <h2 id="live-totals" className="sr-only">
          Totals
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => {
            const body = (
              <>
                <span className="text-ink block text-2xl font-bold tracking-tight tabular-nums">
                  {t.value}
                </span>
                {/* Smaller than text-sm and tighter than the design's own
                    figure: six tiles across a 1080px content column give each
                    label ~140px, and "Caregivers Checked In" wrapped at 14px
                    and at 13px. */}
                <span className="text-ink-muted mt-1 block text-xs tracking-tight break-words">
                  {t.label}
                </span>
              </>
            )
            const shell =
              'card hover:border-brand-300 block px-3.5 py-3.5 text-left transition-colors'
            // A tile that leaves the section is a link; one that moves the page
            // under it is a button. Always the same element whatever the count
            // — swapping type as a count crossed zero dropped focus mid-drag.
            if (t.to)
              return (
                <Link key={t.id} to={t.to} title={t.note} className={shell}>
                  {body}
                </Link>
              )
            return t.state || t.view ? (
              <button
                key={t.id}
                type="button"
                title={t.note}
                aria-disabled={t.value === 0}
                onClick={() => {
                  if (t.value === 0) return
                  const next = new URLSearchParams(params)
                  next.set('view', t.view ?? 'visits')
                  if (t.state) next.set('state', t.state)
                  next.delete('page')
                  // The tiles count what the header's filters leave, so the
                  // branch and service they were counted under travel with the
                  // click. Dropping them here would land on a bigger board than
                  // the number that was clicked.
                  next.delete('pin')
                  setParams(next)
                }}
                className={cn(
                  shell,
                  'aria-disabled:cursor-default aria-disabled:hover:border-line',
                )}
              >
                {body}
              </button>
            ) : (
              <article key={t.id} title={t.note} className={shell}>
                {body}
              </article>
            )
          })}
        </div>
      </section>

      {/* --------------------------------- views -------------------------------- */}

      {/*
        An underline bar, the same shape the visit-details tabs already use.
        `role="tablist"` is deliberately NOT used: these swap the whole section
        below via the URL rather than toggling panels in place, so a tab widget
        would promise arrow-key panel switching that does not happen. They are
        buttons in a labelled group.
      */}
      <div
        role="group"
        aria-label="Choose a view"
        className="border-line no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
      >
        {views.map((v) => {
          const active = v.slug === view
          return (
            <button
              key={v.slug}
              type="button"
              onClick={() => set('view', v.slug)}
              aria-pressed={active}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-brand-600 text-brand-700'
                  : 'text-ink-muted hover:text-ink border-transparent',
              )}
            >
              {/* No count badge: the design has none, and the same four
                  numbers are on the tiles directly above. */}
              {v.label}
            </button>
          )
        })}
      </div>

      {/*
        The design's chip rail, directly under the tabs. Same `state` param as
        the Visit Status select above, so picking here moves that, and a second
        click on a selected chip clears it.
      */}
      <div
        role="group"
        aria-label="Filter by status"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        {statusChips.map((chip) => {
          const on = state === chip.value
          const count = statusCounts.get(chip.value) ?? 0
          return (
            <button
              key={chip.value}
              type="button"
              title={chip.hint}
              aria-pressed={on}
              onClick={() => set('state', on ? 'all' : chip.value)}
              className={cn(
                // Rounded-lg, not a pill: the design draws these as rounded
                // rectangles, the same corner as the filter selects above.
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors sm:min-h-9.5',
                on
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-line bg-surface text-ink-muted hover:bg-sunken',
              )}
            >
              {chip.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                  on ? 'bg-brand-600 text-white' : 'bg-sunken text-ink-subtle',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {view === 'now' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            {/*
              The design shows a handful of cards under a count and sends you
              to the full list for the rest, so the summary is capped and the
              header link carries the total. "All active visits" is a real
              filter on the board below — see `matchesStatus`.
            */}
            <Panel
              // The design gives this panel a heavier heading than the app's
              // other cards, and tints the panel itself so the white visit
              // cards read as objects sitting on it.
              titleClassName="text-base font-bold"
              // No outline of its own: the panel is the page it sits on, and
              // the white visit cards are the only edges in this block.
              className="bg-canvas border-transparent"
              // The count is every active visit, not the one card below it,
              // so it agrees with the link beside it and with the tile above.
              title={`Active Visit Summary (${live.length})`}
              badge={
                live.length > 0 ? (
                  // Shown whether or not the summary is capped: the board it
                  // opens carries the reference, the times and the write-up
                  // state, which these cards deliberately do not.
                  <Link
                    to={{ search: activeVisitsSearch }}
                    className="text-brand-700 hover:text-brand-800 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
                  >
                    View all {live.length} active visit
                    {live.length === 1 ? '' : 's'}
                    <ArrowRight
                      className="size-3.5"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </Link>
                ) : null
              }
            >
              {live.length === 0 ? (
                <p className="text-ink-subtle py-6 text-center text-sm" role="status">
                  No visit is inside its window at {formatTime(now)}.
                </p>
              ) : (
                <ul className="space-y-3">
                  {summaryVisits.map((visit) => (
                    <ActiveVisitRow key={visit.id} visit={visit} now={now} />
                  ))}
                </ul>
              )}
            </Panel>

            {/*
              The design's Attention Required block: one card per thing a
              coordinator can still act on, each carrying its own button. It is
              the queue behind the tab of the same name — not the whole alerts
              log, which includes everything already on the record.
            */}
            <Panel
              titleClassName="text-base font-bold"
              className="bg-canvas border-transparent"
              title={`Attention Required (${attention.length})`}
              badge={
                attention.length > queuePreview.length ? (
                  <Link
                    to={{ search: attentionSearch }}
                    className="text-brand-700 hover:text-brand-800 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
                  >
                    View all {attention.length}
                    <ArrowRight
                      className="size-3.5"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </Link>
                ) : null
              }
            >
              {attention.length === 0 ? (
                <p className="text-ink-subtle py-6 text-center text-sm" role="status">
                  Nothing on the board needs a coordinator at {formatTime(now)}.
                </p>
              ) : (
                <ul className="space-y-3">
                  {queuePreview.map((alert) => (
                    <AttentionCard key={alert.id} alert={alert} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/*
            The design's Recent Live Activity: what the clock has already gone
            past, newest first, with the time in its own column and a rail
            joining one entry to the next.
          */}
          <Panel title="Recent Live Activity" titleClassName="text-base font-bold">
            {activity.length === 0 ? (
              <p className="text-ink-subtle py-8 text-center text-sm" role="status">
                Nothing has happened yet at {formatTime(now)}.
              </p>
            ) : (
              <ol>
                {recentActivity.map((entry, index) => {
                  const last = index === recentActivity.length - 1
                  return (
                    <li key={entry.id} className="flex gap-3">
                      <span className="text-ink-subtle w-18 shrink-0 pt-0.5 text-xs whitespace-nowrap tabular-nums">
                        {formatTime(entry.at)}
                      </span>
                      {/* The dot keeps the app's tone — blue for a check-in,
                          red for a start with no record behind it. The design
                          draws every dot the same colour, which would throw
                          away the one thing this feed is sorted against. */}
                      <span
                        aria-hidden="true"
                        className="relative flex w-2 shrink-0 justify-center"
                      >
                        <span
                          className={cn(
                            'mt-1.5 size-2 shrink-0 rounded-full',
                            toneFill[entry.tone],
                          )}
                        />
                        {!last && (
                          <span className="bg-line absolute top-4 bottom-0 left-1/2 w-px -translate-x-1/2" />
                        )}
                      </span>
                      <div className={cn('min-w-0', !last && 'pb-5')}>
                        <p className="text-ink text-sm font-semibold break-words">
                          {entry.to ? (
                            <Link to={entry.to} className="hover:text-brand-700">
                              {entry.label}
                            </Link>
                          ) : (
                            entry.label
                          )}
                        </p>
                        <p className="text-ink-subtle mt-1 text-[0.8125rem] break-words">
                          {entry.detail}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            <p className="text-ink-subtle mt-4 text-xs">
              {activity.length > recentActivity.length &&
                `The ${recentActivity.length} most recent of ${activity.length}. `}
              Visit starts and finishes the clock has passed. Nothing is dated
              later than {formatTime(now)}.
            </p>
          </Panel>
        </div>
      )}

      {view === 'attention' && (
        <AttentionTable
          alerts={attention}
          total={alerts.length}
          now={now}
          logHref={alertsHref()}
        />
      )}

      {view === 'visits' && (
        <section aria-labelledby="board-table" className="space-y-4">
          <h2 id="board-table" className="sr-only">
            Today&rsquo;s visits
          </h2>


          {/*
            The design's table, and its card: no heading bar above the header
            row, six columns, zebra rows, the footer carrying the count and the
            pager. The scheduled window and the write-up action that used to
            ride here are on the visit itself and on the cards below 1280px.
          */}
          <div className="card overflow-hidden">
            {rows.length === 0 ? (
              <p
                className="text-ink-subtle px-4 py-10 text-center text-sm"
                role="status"
              >
                No visit matches those filters
                {state !== 'all' &&
                  ` — no visit is “${statusLabel(state)}” at ${formatTime(now)}`}
                .
              </p>
            ) : (
              <>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Today’s visits table"
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
                      {page.map((visit) => (
                        <tr
                          key={visit.id}
                          className={cn(
                            'transition-colors even:bg-canvas',
                            visit.state === 'unattended' &&
                              'bg-red-50/50 even:bg-red-50/50',
                          )}
                        >
                          <th scope="row" className="px-5 py-3.5 font-normal">
                            {/* Derived from the date and the rota slot, never
                                stored — and never a country code the rest of
                                the app has never heard of. */}
                            <Link
                              to={`/scheduling/visits/${visit.id}/overview`}
                              className="text-brand-700 hover:text-brand-800 font-medium whitespace-nowrap"
                            >
                              {referenceFor(visit)}
                            </Link>
                          </th>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <Link
                              to={`/care-recipients/${visit.recipientId}`}
                              className="text-ink hover:text-brand-700 font-semibold"
                            >
                              {visit.recipientName}
                            </Link>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {visit.caregiverId ? (
                              <Link
                                to={`/caregivers/${visit.caregiverId}/schedule`}
                                className="text-ink-muted hover:text-brand-700"
                              >
                                {visit.caregiverName}
                              </Link>
                            ) : (
                              <span className="font-medium text-red-700">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="text-ink-muted px-5 py-3.5">{visit.type}</td>
                          <td className="text-ink-muted px-5 py-3.5 whitespace-nowrap tabular-nums">
                            {/* The clock-in the visit log actually captured —
                                08:58 for a 09:00 slot — not the scheduled time
                                relabelled. The design prints a dash where there
                                is none; "Not recorded" says the same thing
                                without reading as missing data. */}
                            {checkInOf(visit) ?? (
                              <span className="text-ink-subtle">Not recorded</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <StateBadge state={visit.state} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Below 1280px the table becomes cards carrying the same
                    facts, rather than a table that scrolls sideways. */}
                <ul className="divide-line divide-y xl:hidden">
                  {page.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} now={now} />
                  ))}
                </ul>
              </>
            )}

            {/* Only when there is a second page: a permanently disabled bar
                over an eight-row board is chrome that never does anything. */}
            {pageCount > 1 && (
              <Pagination
                page={pageNumber}
                pageCount={pageCount}
                onPageChange={(n) => set('page', n === 1 ? '' : String(n))}
                summary={summary}
              />
            )}
          </div>
        </section>
      )}

      {view === 'map' && (
        <section aria-labelledby="map-heading" className="space-y-4">
          <h2 id="map-heading" className="sr-only">
            Where today&rsquo;s visits are
          </h2>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {/* A real street map, with the legend over it as the design has
                  it. The pins are the clients' addresses — see the note in
                  VisitTileMap about what this does not plot. */}
              <VisitTileMap
                visits={rows}
                alerts={alerts}
                selectedId={pinned?.id ?? null}
                onSelect={(id) => set('pin', id === pinned?.id ? '' : id)}
              />
            </div>

            <div className="space-y-4">
              {pinned ? (
                <Panel
                  titleClassName="text-base font-bold"
                  title="Selected Active Visit"
                  badge={<StateBadge state={pinned.state} />}
                >
                  <div className="divide-line divide-y">
                    <div className="pb-4">
                      <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
                        Visit code
                      </p>
                      <Link
                        to={`/scheduling/visits/${pinned.id}/overview`}
                        className="text-brand-700 hover:text-brand-800 mt-1 block text-base font-semibold"
                      >
                        {referenceFor(pinned)}
                      </Link>
                    </div>

                    <div className="space-y-4 py-4">
                      <div>
                        <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
                          Care recipient
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <Avatar
                            name={pinned.recipientName}
                            decorative
                            className="size-9"
                          />
                          <div className="min-w-0">
                            <Link
                              to={`/care-recipients/${pinned.recipientId}`}
                              className="text-ink hover:text-brand-700 block text-sm font-semibold break-words"
                            >
                              {pinned.recipientName}
                            </Link>
                            <p className="text-ink-subtle text-xs break-words">
                              {placeOfRecipient(pinned.recipientId)?.address ??
                                'No address on file'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
                          Assigned caregiver
                        </p>
                        {pinned.caregiverId ? (
                          <div className="mt-2 flex items-center gap-3">
                            <Avatar
                              name={pinned.caregiverName!}
                              decorative
                              className="size-9"
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/caregivers/${pinned.caregiverId}/schedule`}
                                className="text-ink hover:text-brand-700 block text-sm font-semibold break-words"
                              >
                                {pinned.caregiverName}
                              </Link>
                              <p className="text-ink-subtle text-xs break-words">
                                {staffMembers.find((m) => m.id === pinned.caregiverId)
                                  ?.title ?? 'Caregiver'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm font-medium text-red-700">
                            Nobody assigned
                          </p>
                        )}
                      </div>
                    </div>

                    <dl className="space-y-2.5 py-4 text-sm">
                      <MapFact label="Service scheduled" value={pinned.type} />
                      <MapFact
                        label="Scheduled"
                        value={`${formatTime(pinned.start)} – ${formatTime(pinned.end)}`}
                      />
                      <MapFact
                        label="Check-in time"
                        value={checkInOf(pinned) ?? 'Not recorded'}
                      />
                      {/*
                        The design's third row is "Last Update Ping", a live
                        device heartbeat. Nothing in this app receives one, so
                        the row that takes its place is the distance the
                        coordinates can actually support — home to home, never
                        a live position.
                      */}
                      <MapFact
                        label="Caregiver’s home to here"
                        value={
                          travelMiles(pinned.caregiverId, pinned.recipientId) === null
                            ? 'No caregiver assigned'
                            : formatMiles(
                                travelMiles(pinned.caregiverId, pinned.recipientId)!,
                              )
                        }
                      />
                      <MapFact
                        label="Branch to here"
                        value={
                          branchDistanceMiles(branchOf(pinned), pinned.recipientId) ===
                          null
                            ? 'No caregiver, so no branch'
                            : `${formatMiles(branchDistanceMiles(branchOf(pinned), pinned.recipientId)!)} from ${branchOf(pinned)}`
                        }
                      />
                    </dl>
                  </div>

                  {/* Stacked and full width, as the design has them. */}
                  <div className="space-y-2 pt-4">
                    <Link
                      to={`/scheduling/visits/${pinned.id}/overview`}
                      className="bg-brand-600 hover:bg-brand-700 flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
                    >
                      View Visit Details
                    </Link>
                    {caregiverPhone ? (
                      <a
                        href={telHref(caregiverPhone)}
                        className="border-line text-ink hover:bg-sunken flex min-h-11 w-full items-center justify-center rounded-lg border px-4 text-sm font-medium"
                      >
                        Contact Caregiver
                        <span className="sr-only">
                          {' '}
                          — {pinned.caregiverName}, {caregiverPhone}
                        </span>
                      </a>
                    ) : (
                      // Nobody is on the visit, so there is nobody to ring. The
                      // button keeps its place and its word and says why it
                      // does nothing, rather than dialling something else.
                      <span
                        aria-disabled="true"
                        title="Nobody is assigned to this visit yet."
                        className="border-line text-ink-subtle flex min-h-11 w-full cursor-default items-center justify-center rounded-lg border px-4 text-sm font-medium"
                      >
                        Contact Caregiver
                      </span>
                    )}
                  </div>
                </Panel>
              ) : (
                <Panel titleClassName="text-base font-bold" title="Selected Active Visit">
                  <p className="text-ink-subtle text-sm" role="status">
                    Choose a pin to see the visit, its address and how far it is
                    from the caregiver&rsquo;s home.
                  </p>
                </Panel>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

/* --------------------------------- pieces ---------------------------------- */

function VisitRow({ visit, now }: { visit: LiveVisit; now: string }) {
  const inWindow = visit.sinceStart >= 0 && visit.pastEnd < 0

  return (
    <li className={cn('p-4', visit.state === 'unattended' && 'bg-red-50/50')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {visit.caregiverId ? (
            <Avatar name={visit.caregiverName!} decorative className="size-8" />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-red-100 text-red-700"
            >
              <TriangleAlert className="size-4" strokeWidth={2.4} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-ink text-sm font-semibold break-words">
              {/* Same destination as the table's recipient cell — the same
                  words led to two different places by viewport. */}
              <Link
                to={`/care-recipients/${visit.recipientId}`}
                className="hover:text-brand-700"
              >
                {visit.recipientName}
              </Link>
            </p>
            <p className="text-ink-subtle text-xs break-words">
              {visit.type} ·{' '}
              {visit.caregiverId ? (
                <Link
                  to={`/caregivers/${visit.caregiverId}/schedule`}
                  className="hover:text-ink"
                >
                  {visit.caregiverName}
                </Link>
              ) : (
                <span className="font-medium text-red-700">Unassigned</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
              tonePill[stateTones[visit.state]],
            )}
          >
            {stateLabels[visit.state]}
          </span>
          <span className="text-ink-subtle text-xs whitespace-nowrap tabular-nums">
            {formatTime(visit.start)} – {formatTime(visit.end)}
          </span>
        </div>
      </div>

      {/* Carried down from the table rather than dropped: below 1280px these
          two columns are the ones a narrower layout would lose. */}
      <p className="text-ink-subtle mt-2 flex flex-wrap items-center gap-x-2 text-xs">
        <Link
          to={`/scheduling/visits/${visit.id}/overview`}
          className="text-brand-700 hover:text-brand-800 font-medium"
        >
          {referenceFor(visit)}
        </Link>
        <span aria-hidden="true">·</span>
        <span>
          Check-in {checkInOf(visit) ?? 'not recorded'}
        </span>
      </p>

      {/* How far through, measured from the clock rather than stated. */}
      <p className="text-ink-muted mt-1 text-xs break-words">
        {inWindow
          ? `${formatGap(visit.sinceStart)} in, ${formatGap(-visit.pastEnd)} left of ${visit.durationHours}h.`
          : visit.pastEnd >= 0
            ? `Window closed ${formatGap(visit.pastEnd)} ago.`
            : `Starts in ${formatGap(-visit.sinceStart)}.`}
      </p>

      {inWindow && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(
            (visit.sinceStart / Math.max(1, visit.sinceStart - visit.pastEnd)) * 100,
          )}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${visit.recipientName}’s visit, elapsed`}
          className="bg-sunken mt-1.5 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className={cn('h-full rounded-full', toneFill[stateTones[visit.state]])}
            style={{
              width: `${Math.min(100, Math.max(0, (visit.sinceStart / Math.max(1, visit.sinceStart - visit.pastEnd)) * 100))}%`,
            }}
          />
        </div>
      )}

      <div className="mt-2">
        <ReportIncidentButton visit={visit} now={now} />
      </div>
    </li>
  )
}

/**
 * One card in the Active Visit Summary: name, caregiver, status, service, and
 * how far through the window it is. Everything but the status is read off the
 * clock.
 */
function ActiveVisitRow({ visit, now }: { visit: LiveVisit; now: string }) {
  const span = Math.max(1, visit.sinceStart - visit.pastEnd)
  const through = Math.min(100, Math.max(0, (visit.sinceStart / span) * 100))
  /*
   * "Elapsed" is only true of a visit somebody has checked into, and it runs
   * from the check-in the record captured rather than from the rota time.
   * Where there is no check-in, what has elapsed is the window — saying a
   * caregiver has been there half an hour is the one claim this app never
   * makes without a record behind it.
   */
  const sinceCheckIn = visit.clockIn
    ? minutesOfDay(formatTime(now)) - minutesOfDay(formatTime(visit.clockIn))
    : null
  const elapsed =
    sinceCheckIn !== null
      ? sinceCheckIn < 1
        ? 'Just checked in'
        : `${formatGap(sinceCheckIn)} elapsed`
      : visit.sinceStart < 1
        ? 'Window just opened'
        : `${formatGap(visit.sinceStart)} into the window`

  return (
    <li
      className={cn(
        'border-line bg-surface rounded-xl border px-5 pt-4 pb-2.5',
        visit.state === 'unattended' && 'border-red-200 bg-red-50/60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-ink text-[0.9375rem] font-semibold break-words">
            <Link
              to={`/care-recipients/${visit.recipientId}`}
              className="hover:text-brand-700"
            >
              {visit.recipientName}
            </Link>
          </p>
          <p className="text-ink-subtle mt-0.5 text-[0.8125rem] break-words">
            {visit.caregiverId ? (
              <>
                with{' '}
                <Link
                  to={`/caregivers/${visit.caregiverId}/schedule`}
                  className="hover:text-ink"
                >
                  {visit.caregiverName}
                </Link>
              </>
            ) : (
              <span className="font-medium text-red-700">Nobody assigned</span>
            )}
          </p>
        </div>
        <StateBadge state={visit.state} />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[0.8125rem]">
        <span className="text-ink-subtle min-w-0 break-words">{visit.type}</span>
        <span className="text-ink shrink-0 font-medium tabular-nums">
          {elapsed}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(through)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${visit.recipientName}’s visit, how far through its window`}
        className="bg-sunken mt-2 h-1.5 overflow-hidden rounded-full"
      >
        <div
          className={cn('h-full rounded-full', toneFill[stateTones[visit.state]])}
          style={{ width: `${through}%` }}
        />
      </div>
    </li>
  )
}

/**
 * The rule down the left of an attention card. Severity, not state: the card
 * is about how loud the thing is, and the state is already in the sentence.
 */
const severityBar: Record<LiveAlert['severity'], string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-amber-400',
}

/**
 * One card in Attention Required: what it is, how loud, what it says, who it
 * concerns, and the one place to go and deal with it. The alert's second
 * destination and its provenance stay on Alerts & incidents — this is the
 * queue, that page is the record.
 */
function AttentionCard({ alert }: { alert: LiveAlert }) {
  const parties =
    [
      alert.recipientName && `Recipient: ${alert.recipientName}`,
      alert.caregiverName && `Caregiver: ${alert.caregiverName}`,
    ]
      .filter(Boolean)
      .join(' • ') ||
    // Neither role applies to every alert — a lapsed credential belongs to a
    // caregiver alone. Where the pair is empty, the row names the record the
    // alert was read off instead of printing an empty label.
    `Source: ${alert.source}`

  return (
    <li className="border-line bg-surface flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border px-5 py-4">
      <div className="flex min-w-0 gap-3.5">
        <span
          aria-hidden="true"
          className={cn(
            'w-1 shrink-0 self-stretch rounded-full',
            severityBar[alert.severity],
          )}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-ink text-[0.9375rem] font-semibold break-words">
              {alertKindLabels[alert.kind]}
            </span>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p className="text-ink-muted mt-1 text-sm break-words">{alert.detail}</p>
          <p className="text-ink-subtle mt-1 text-[0.8125rem] break-words">
            {parties}
          </p>
        </div>
      </div>

      <Link
        to={alert.action.to}
        className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold text-white"
      >
        {alert.action.label}
      </Link>
    </li>
  )
}

function StateBadge({ state }: { state: LiveState }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tonePill[stateTones[state]],
      )}
    >
      {stateLabels[state]}
    </span>
  )
}

function MapFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt className="text-ink-muted min-w-0">{label}:</dt>
      <dd className="text-ink min-w-0 text-right font-semibold break-words">
        {value}
      </dd>
    </div>
  )
}

/**
 * The Attention Required tab: a work queue, not a log.
 *
 * Five columns, following the design — who it is about, what the issue is, how
 * long it has been true, how loud, and the thing to do about it. The Alerts &
 * incidents page answers a different question and carries the provenance
 * columns (source, branch, timing) that belong to a record rather than to a
 * queue.
 *
 * Two actions a row, as the design has it: see `AlertActions` for which two
 * and why. Escalating a non-critical row, or ringing when the first slot went
 * elsewhere, is on Alerts & incidents — the record, where every action an
 * alert can carry is available at once.
 */
function AttentionTable({
  alerts,
  total,
  now,
  logHref,
}: {
  alerts: LiveAlert[]
  /** Every alert, so the tab can say what it is leaving out. */
  total: number
  now: string
  logHref: string
}) {
  const settled = total - alerts.length

  return (
    <section aria-labelledby="attention-table" className="space-y-4">
      <h2 id="attention-table" className="sr-only">
        Needing a coordinator
      </h2>

      {alerts.length === 0 ? (
        <div className="card p-4">
          <p className="text-ink-subtle text-sm" role="status">
            {/* Good news said as good news. Reporting it as an empty filter
                result buried the only thing a coordinator wanted to know. */}
            Nothing on today&rsquo;s board needs acting on at {formatTime(now)}.
            {settled > 0 && (
              <>
                {' '}
                {settled} thing{settled === 1 ? '' : 's'} already on the record{' '}
                <Link to={logHref} className="text-brand-700">
                  are under Alerts &amp; incidents
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div
            tabIndex={0}
            role="region"
            aria-label="Attention required table"
            className="hidden overflow-x-auto xl:block"
          >
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="text-ink-subtle border-line border-b text-xs">
                <tr>
                  {/* The design's headers. "Care Recipient" is one of them, and
                      a lapsed credential or a contract overrun is about the
                      *caregiver* — so where there is no recipient the cell
                      names the caregiver and says which it is, rather than
                      filing a caregiver silently under the wrong word. */}
                  {[
                    'Care Recipient',
                    'Issue Type',
                    'Time Overdue',
                    'Priority',
                    'Action',
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
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    // The detail rides as the row's title rather than a second
                    // line under the issue: the design's rows are one line, and
                    // the sentence is on the card in Live Overview.
                    title={alert.detail}
                    className={cn(
                      'transition-colors even:bg-canvas',
                      alert.severity === 'critical' &&
                        'bg-red-50/60 even:bg-red-50/60',
                    )}
                  >
                    <th scope="row" className="px-5 py-3.5 font-medium break-words">
                      <span className="text-ink block">
                        {alert.recipientName ?? alert.caregiverName ?? alert.subject}
                      </span>
                      <span className="text-ink-subtle block text-xs font-normal">
                        {alert.recipientName
                          ? alert.caregiverName && `with ${alert.caregiverName}`
                          : alert.caregiverName
                            ? 'Caregiver'
                            : alert.source}
                      </span>
                    </th>
                    <td className="text-ink px-5 py-3.5 font-semibold break-words">
                      {alertKindLabels[alert.kind]}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3.5 whitespace-nowrap',
                        // The design prints the critical rows' time in red.
                        alert.severity === 'critical'
                          ? 'font-medium text-red-600'
                          : 'text-ink-muted',
                      )}
                    >
                      {/* The design headed this "TIME OVERDUE" and then filled
                          it with "2 min ago", "No GPS Lock" and "Late 15m" —
                          three different measurements under one heading. Blank
                          where there is no stopwatch. */}
                      {alert.elapsed ?? (
                        <span className="text-ink-subtle">
                          {alert.weekScoped ? 'This week' : 'Not timed'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="px-5 py-3.5">
                      <AlertActions alert={alert} now={now} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-line divide-y xl:hidden">
            {alerts.map((alert) => (
              <li key={alert.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="text-ink min-w-0 text-sm font-semibold break-words">
                    {alert.subject}
                  </p>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <p className="text-ink mt-1 text-sm font-medium break-words">
                  {alertKindLabels[alert.kind]}
                </p>
                <p className="text-ink-muted mt-0.5 text-sm break-words">
                  {alert.detail}
                </p>
                <p className="text-ink-subtle mt-1 text-xs break-words">
                  {alert.counterpart && <>With {alert.counterpart} · </>}
                  {alert.elapsed
                    ? `For ${alert.elapsed}`
                    : alert.weekScoped
                      ? 'This week'
                      : 'Not timed'}
                </p>
                <div className="mt-2">
                  <AlertActions alert={alert} now={now} />
                </div>
              </li>
            ))}
          </ul>

          <p className="text-ink-subtle border-line border-t px-4 py-3 text-xs">
            Only what can still be acted on.{' '}
            {settled > 0 ? (
              <>
                {settled} more {settled === 1 ? 'is' : 'are'} already on the
                record —{' '}
              </>
            ) : (
              <>Everything, with where each fact came from, is </>
            )}
            <Link to={logHref} className="text-brand-700">
              under Alerts &amp; incidents
            </Link>
            . Nothing here is stored as an alert, so there is nothing to
            acknowledge or resolve: a row leaves when the fact behind it stops
            being true.
          </p>
        </div>
      )}
    </section>
  )
}

/**
 * Every alert on the board right now, in a panel beside the work.
 *
 * The same list the Attention Required tab and the alerts page are built from —
 * `alertsAt` at the minute on the clock — laid out to be read down rather than
 * across. It exists because a coordinator working through visits should not
 * have to leave the board to see what is shouting, and it carries the real
 * actions rather than a summary of them: every row here can be acknowledged,
 * escalated, signed off where the record allows it, and rung.
 *
 * No count of its own and no refresh. It re-renders with the clock like
 * everything else, and a number computed a second time is a number that can
 * disagree with the first.
 */
function LiveAlertsPanel({
  alerts,
  now,
  open,
  onClose,
  allHref,
}: {
  alerts: LiveAlert[]
  now: string
  open: boolean
  onClose: () => void
  allHref: string
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Live alerts"
      subtitle={`${alerts.length} at ${formatTime(now)}`}
    >
      <div className="space-y-3 p-4">
        {alerts.length === 0 ? (
          <p className="text-ink-muted text-sm" role="status">
            Nothing on the board needs a coordinator at {formatTime(now)}.
          </p>
        ) : (
          alerts.map((alert) => (
            <article
              key={alert.id}
              className={cn(
                'card border-l-4 p-3.5',
                alert.severity === 'critical'
                  ? 'border-l-red-500'
                  : alert.severity === 'high'
                    ? 'border-l-amber-500'
                    : 'border-l-slate-300',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-ink min-w-0 text-sm font-semibold break-words">
                  {alertKindLabels[alert.kind]}
                </p>
                <SeverityBadge severity={alert.severity} />
              </div>
              <p className="text-ink-muted mt-1 text-sm break-words">
                {alert.detail}
              </p>
              {/* Who it is about, in the alert's own words. "Recipient" and
                  "Caregiver" would be wrong on half these rows: a lapsed
                  credential is about a caregiver and no client at all. */}
              <p className="text-ink-subtle mt-1.5 text-xs break-words">
                {alert.subject}
                {alert.counterpart && ` · with ${alert.counterpart}`}
                {' · '}
                {alert.elapsed ?? (alert.weekScoped ? 'this week' : 'not timed')}
              </p>
              <div className="mt-2.5">
                <AlertActions alert={alert} now={now} />
              </div>
            </article>
          ))
        )}
      </div>

      <div className="border-line bg-surface sticky bottom-0 border-t p-4">
        <Link
          to={allHref}
          onClick={onClose}
          className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center text-sm font-semibold"
        >
          Open Alerts &amp; incidents
          <span className="sr-only">
            {' '}
            — the whole record, including what is already settled
          </span>
        </Link>
      </div>
    </Drawer>
  )
}

/**
 * Writing an incident up against the visit it happened on.
 *
 * On the visit rather than on an alert: an incident is about what happened at
 * somebody's house, and the visit is the only row that knows whose house, which
 * caregiver and which slot. Offered on visits that have started — there is
 * nothing to write up about a visit that has not begun.
 */
function ReportIncidentButton({ visit, now }: { visit: LiveVisit; now: string }) {
  const [reporting, setReporting] = useState(false)

  if (visit.sinceStart < 0) {
    return <span className="text-ink-subtle text-xs">Not started</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setReporting(true)}
        className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap"
      >
        Report incident
        <span className="sr-only"> — {visit.recipientName}</span>
      </button>
      {reporting && (
        <ReportIncidentDialog
          visit={visit}
          now={now}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  )
}

function AlertActions({ alert, now }: { alert: LiveAlert; now: string }) {
  const [acknowledging, setAcknowledging] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const { acknowledgementFor, escalationFor, resolutionFor } = useAlertActions()
  const ack = acknowledgementFor(TODAY, alert.thread)
  const escalation = escalationFor(TODAY, alert.thread)
  const resolution = resolutionFor(TODAY, alert.thread)

  /*
   * Once it is signed off, the chasing buttons go: acknowledging or handing on
   * something already settled is two coordinators doing the same work twice.
   * The row itself stays exactly where it was, with the state the board
   * derived — resolving records who dealt with it, it does not delete it.
   */
  if (resolution) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Link
          to={alert.action.to}
          className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap"
        >
          {alert.action.label}
          <span className="sr-only"> — {alert.subject}</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
          <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          <span className="whitespace-nowrap">
            Resolved {formatTime(resolution.at)} —{' '}
            {resolutionCategoryLabels[resolution.category].toLowerCase()}
            <span className="sr-only">
              {' '}
              by {resolution.by}, {resolution.byRole}. {resolution.note}
            </span>
          </span>
          <button
            type="button"
            onClick={() => withdrawResolution(TODAY, alert.thread)}
            className="text-emerald-900 underline underline-offset-2 hover:no-underline"
          >
            Undo
            <span className="sr-only"> resolving {alert.subject}</span>
          </button>
        </span>
      </span>
    )
  }

  /*
   * Two actions, the way the design draws them: the most pressing thing to do,
   * then the acknowledgement — or, on a critical row, the way into the record.
   * Everything else an alert can have done to it (escalating a non-critical
   * one, ringing when the first slot went elsewhere) is on Alerts & incidents,
   * which is the record rather than the queue.
   *
   * A chip takes the slot of the action it records, so a row that has been
   * acknowledged shows the acknowledgement and not a second Acknowledge.
   */
  const escalatable = escalationTiers.length > 0 && !escalation
  const filled =
    'inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold whitespace-nowrap text-white'
  const outline =
    'border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap'

  const openLink = (prominent: boolean) => (
    <Link
      to={alert.action.to}
      className={
        prominent ? cn(filled, 'bg-brand-600 hover:bg-brand-700') : outline
      }
    >
      {alert.action.label}
      <span className="sr-only"> — {alert.subject}</span>
    </Link>
  )

  const first = escalation ? (
    /* Escalate, like Acknowledge, records what a person did. Neither of them
       claims the problem has gone — that is the derivation's to say. */
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
      <span className="whitespace-nowrap">
        Escalated to {escalation.toName}
        <span className="sr-only">
          {' '}
          at {formatTime(escalation.at)} by {escalation.by} —{' '}
          {escalationReasonLabels[escalation.reason]}. {escalation.note}
        </span>
      </span>
      <a
        href={telHref(escalation.toPhone)}
        className="text-amber-900 underline underline-offset-2 hover:no-underline"
      >
        {escalation.toPhone}
      </a>
      <button
        type="button"
        onClick={() => withdrawEscalation(TODAY, alert.thread)}
        className="text-amber-900 underline underline-offset-2 hover:no-underline"
      >
        Undo
        <span className="sr-only"> escalating {alert.subject}</span>
      </button>
    </span>
  ) : alert.severity === 'critical' && escalatable ? (
    // The design's critical row leads with Escalate, in its own red.
    <button
      type="button"
      onClick={() => setEscalating(true)}
      className={cn(filled, 'bg-red-600 hover:bg-red-700')}
    >
      Escalate
      <span className="sr-only"> — {alert.subject}</span>
    </button>
  ) : canResolve(alert) ? (
    // Only where the record is already written and no clock will unsay it.
    <button
      type="button"
      onClick={() => setResolving(true)}
      className={cn(filled, 'bg-emerald-600 hover:bg-emerald-700')}
    >
      Resolve
      <span className="sr-only"> — {alert.subject}</span>
    </button>
  ) : alert.contact ? (
    /* A real telephone link to a number the fixture holds. The role is named
       because "Call Sarah" alone does not say whether Sarah is the caregiver
       or the client's daughter. */
    <a
      href={telHref(alert.contact.phone)}
      className={cn(filled, 'bg-brand-600 hover:bg-brand-700')}
    >
      {alert.contact.label}
      <span className="sr-only">
        {' '}
        — {alert.contact.name}, {alert.contact.role}, on {alert.contact.phone}
      </span>
    </a>
  ) : (
    openLink(true)
  )

  const second = ack ? (
    /* Acknowledge — "I have seen this and I am on it". The one action that
       fits an alert whose fact could still change in the next minute. */
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
      <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      <span className="whitespace-nowrap">
        Picked up {formatTime(ack.at)}
        <span className="sr-only">
          {' '}
          by {ack.by}, {ack.byRole}
          {ack.note && `. Note: ${ack.note}`}
        </span>
      </span>
      <button
        type="button"
        onClick={() => withdrawAcknowledgement(TODAY, alert.thread)}
        className="text-emerald-900 underline underline-offset-2 hover:no-underline"
      >
        Undo
        <span className="sr-only"> acknowledging {alert.subject}</span>
      </button>
    </span>
  ) : alert.severity === 'critical' ? (
    // A critical row leads with Escalate, so its second slot is the way in —
    // exactly the pair the design draws.
    openLink(false)
  ) : (
    <button type="button" onClick={() => setAcknowledging(true)} className={outline}>
      Acknowledge
      <span className="sr-only"> — {alert.subject}</span>
    </button>
  )

  return (
    <span className="flex flex-wrap items-center gap-2">
      {first}
      {second}

      {resolving && (
        <ResolveAlertDialog
          alert={alert}
          date={TODAY}
          now={now}
          onClose={() => setResolving(false)}
        />
      )}
      {acknowledging && (
        <AcknowledgeAlertDialog
          alert={alert}
          date={TODAY}
          now={now}
          onClose={() => setAcknowledging(false)}
        />
      )}
      {escalating && (
        <EscalateAlertDialog
          alert={alert}
          date={TODAY}
          now={now}
          onClose={() => setEscalating(false)}
        />
      )}
    </span>
  )
}
