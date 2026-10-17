import {
  NOW,
  TODAY,
  boardOn,
  conflictsOn,
  formatFullDay,
  formatTime,
} from '@/features/scheduling/board-data'
import type { BoardVisit, Conflict } from '@/features/scheduling/board-data'
import {
  credentialStates,
  minutesOfDay,
  staffMembers,
} from '@/features/caregivers/roster-data'
import type { StaffMember } from '@/features/caregivers/roster-data'
import { getMedicationPlan } from '@/features/care-recipients/medications-data'
import { getCareNotes } from '@/features/care-recipients/notes-data'
import {
  getFamilyRecord,
  memberWithRole,
} from '@/features/care-recipients/family-data'
import { formatGap, formatSpan } from '@/lib/duration'
import type { Severity, Tone } from '@/types'

export { NOW, TODAY, formatFullDay, formatTime, minutesOfDay }
export { formatGap, formatSpan }

/* --------------------------------- windows --------------------------------- */

/** How late a check-in can be before it is chased. */
export const CHECK_IN_GRACE_MINUTES = 15

/** How far ahead a visit reads as "due". */
export const DUE_WINDOW_MINUTES = 30

/** How far past the end a visit reads as overrunning rather than finished. */
export const OVERRUN_GRACE_MINUTES = 15

/** Beyond this, a late check-in stops being a nuisance and becomes a problem. */
export const LATE_ARRIVAL_HIGH_MINUTES = 30

/** How long after a dose window before an unrecorded dose is worth chasing. */
export const DOSE_GRACE_MINUTES = 30

/* ---------------------------------- state ---------------------------------- */

export type LiveState =
  | 'unattended'
  | 'overdue'
  | 'awaiting-check-in'
  | 'in-progress'
  | 'overrunning'
  | 'due'
  | 'upcoming'
  | 'completed'
  | 'unrecorded'
  | 'uncovered'
  | 'cancelled'

export const stateLabels: Record<LiveState, string> = {
  unattended: 'Nobody on it',
  overdue: 'Check-in overdue',
  'awaiting-check-in': 'Started, no check-in',
  'in-progress': 'In progress',
  overrunning: 'Overrunning',
  due: 'Due to start',
  upcoming: 'Later today',
  completed: 'Completed',
  unrecorded: 'Not written up',
  uncovered: 'Went uncovered',
  cancelled: 'Cancelled',
}

export const stateTones: Record<LiveState, Tone> = {
  unattended: 'red',
  overdue: 'red',
  'awaiting-check-in': 'amber',
  'in-progress': 'blue',
  overrunning: 'amber',
  due: 'amber',
  upcoming: 'slate',
  completed: 'green',
  unrecorded: 'slate',
  uncovered: 'red',
  cancelled: 'red',
}

export interface LiveVisit extends BoardVisit {
  state: LiveState
  /** Minutes since the visit was due to start. Negative before it is due. */
  sinceStart: number
  /** Minutes past the scheduled end. Negative while still inside the window. */
  pastEnd: number
  /** Whether a visit record exists — the app's only evidence of a check-in. */
  recorded: boolean
}

/**
 * A visit's state at a given minute of the day.
 *
 * Derived from the clock and the visit record rather than stored, so moving the
 * clock moves every row. The only evidence of a check-in this app holds is
 * whether a visit record exists (`logged`); nothing captures a clock-in
 * separately, so an assigned visit that is under way with no record is reported
 * as an overdue check-in rather than assumed to be running.
 */
export function stateOf(visit: BoardVisit, now: string): LiveState {
  const nowMin = minutesOfDay(formatTime(now))
  const start = minutesOfDay(formatTime(visit.start))
  const end = visit.overnight
    ? start + Math.round(visit.durationHours * 60)
    : minutesOfDay(formatTime(visit.end))

  // An overnight block's window wraps past midnight, so a clock reading before
  // the start belongs to the *previous* night's shift, not to a visit 21 hours
  // away. No fixture row is overnight today; the guard keeps the maths honest
  // if one is added.
  const wrapped = visit.overnight && nowMin < start ? nowMin + 24 * 60 : nowMin
  const sinceStart = wrapped - start
  const pastEnd = wrapped - end

  if (visit.caregiverId === null) {
    // Three different things, not one: still to fill, happening now with
    // nobody on it, and a window that closed with nobody ever assigned. The
    // last of those read as "Later today" until this was split.
    if (pastEnd >= 0) return 'uncovered'
    return sinceStart >= 0 ? 'unattended' : 'upcoming'
  }

  // A cancelled visit is cancelled on every screen, not quietly "completed".
  if (visit.status === 'cancelled') return 'cancelled'

  if (visit.logged) {
    if (sinceStart < 0) return 'upcoming'
    // The record's own terminal status wins over the clock. Deriving
    // "overrunning" from the end time invented a fact the app has no evidence
    // for — there is no checkout field — and made a finished, written-up visit
    // read as still running.
    if (visit.status === 'completed') return 'completed'
    if (pastEnd > OVERRUN_GRACE_MINUTES) return 'completed'
    if (pastEnd >= 0) return 'overrunning'
    return 'in-progress'
  }

  // No record. "Due" means not started; once it has started with no record it
  // is awaiting a check-in, then overdue — three different things that all
  // read as "Due to start" before this was split.
  if (sinceStart < -DUE_WINDOW_MINUTES) return 'upcoming'
  if (sinceStart < 0) return 'due'
  if (pastEnd >= 0) return 'unrecorded'
  return sinceStart > CHECK_IN_GRACE_MINUTES ? 'overdue' : 'awaiting-check-in'
}

/** Today's board with a live state on every row. */
export function liveBoard(date = TODAY, now = NOW): LiveVisit[] {
  const nowMin = minutesOfDay(formatTime(now))

  return boardOn(date)
    .map((visit) => {
      const start = minutesOfDay(formatTime(visit.start))
      const end = visit.overnight
        ? start + Math.round(visit.durationHours * 60)
        : minutesOfDay(formatTime(visit.end))
      return {
        ...visit,
        state: stateOf(visit, now),
        sinceStart: nowMin - start,
        pastEnd: nowMin - end,
        recorded: visit.logged,
      }
    })
    .sort((a, b) => severityRank(a) - severityRank(b) || a.start.localeCompare(b.start))
}

/** Whatever needs a coordinator first, first. */
const stateRank: Record<LiveState, number> = {
  unattended: 0,
  overdue: 1,
  'awaiting-check-in': 2,
  uncovered: 3,
  overrunning: 4,
  'in-progress': 5,
  due: 6,
  upcoming: 7,
  unrecorded: 8,
  cancelled: 9,
  completed: 10,
}

function severityRank(visit: LiveVisit): number {
  return stateRank[visit.state]
}

/**
 * Visit states that want a coordinator to do something.
 *
 * This is a filter over *visits*, and it is not the alerts page — the two
 * answer different questions. A visit is here because of the state it is in
 * right now; an alert can be raised by a medication plan, a care note or a
 * lapsed credential with no visit involved at all. One client can also sit
 * behind several alerts while occupying a single row here.
 */
export const attentionStates: LiveState[] = [
  'unattended',
  'overdue',
  'awaiting-check-in',
  'uncovered',
  'overrunning',
  'unrecorded',
]

export function needsAttention(visit: LiveVisit): boolean {
  return attentionStates.includes(visit.state)
}

/* ---------------------------------- stats ---------------------------------- */

export interface LiveStats {
  onBoard: number
  /** The clock is inside the visit window, whatever the record says. */
  inWindow: number
  recorded: number
  due: number
  overdue: number
  /** Started, inside the grace period, still no record. */
  awaiting: number
  unattended: number
  finished: number
  /** Distinct caregivers with a checked-in visit under way right now. */
  onDuty: number
  /** Distinct caregivers rostered in-window, checked in or not. */
  rostered: number
  /** Active, non-coordinator staff — the pool the others are counted against. */
  roster: number
}

/**
 * Every figure counted from the rows above it. The source design headlined 24
 * active visits and 21 caregivers checked in over a roster of six caregivers,
 * then titled the list beneath it "Active Visit Summary (4)" and showed one.
 */
export function liveStats(rows: LiveVisit[]): LiveStats {
  // A live-in block four hours in is under way whether or not anybody has
  // written anything down; counting only recorded visits reported nobody on
  // duty while a ten-hour placement was running.
  const inWindow = rows.filter((r) => r.sinceStart >= 0 && r.pastEnd < 0)

  return {
    onBoard: rows.length,
    inWindow: inWindow.length,
    // Of visits that have started. A record that exists for a visit at 8pm is
    // not a check-in at 6am, and this tile sat at 1 all night.
    recorded: rows.filter((r) => r.recorded && r.sinceStart >= 0).length,
    due: rows.filter((r) => r.state === 'due').length,
    overdue: rows.filter((r) => r.state === 'overdue').length,
    awaiting: rows.filter((r) => r.state === 'awaiting-check-in').length,
    unattended: rows.filter((r) => r.state === 'unattended').length,
    finished: rows.filter((r) => r.state === 'completed').length,
    // Checked in, not merely rostered — the page's own rule is that a visit
    // record is the only evidence of presence.
    onDuty: new Set(
      inWindow
        .filter((r) => r.state === 'in-progress' || r.state === 'overrunning')
        .map((r) => r.caregiverId)
        .filter(Boolean),
    ).size,
    rostered: new Set(inWindow.map((r) => r.caregiverId).filter(Boolean)).size,
    roster: staffMembers.filter(
      (m) => m.title !== 'Care Coordinator' && m.status === 'active',
    ).length,
  }
}

/* --------------------------------- alerts ---------------------------------- */

export type AlertKind =
  | 'unattended'
  | 'overdue'
  | 'late-arrival'
  | 'overrunning'
  | 'overran'
  | 'unrecorded'
  | 'uncovered'
  | 'missed-dose'
  | 'unrecorded-dose'
  | 'incident'
  | 'lapsed-credential'
  | 'double-booked'
  | 'inactive-client'
  | 'over-contract'
  | 'unfilled'

export const alertKindLabels: Record<AlertKind, string> = {
  unattended: 'Nobody on the visit',
  overdue: 'Check-in overdue',
  'late-arrival': 'Checked in late',
  overrunning: 'Running over',
  overran: 'Clocked out late',
  unrecorded: 'Not written up',
  uncovered: 'Went uncovered',
  'missed-dose': 'Dose recorded as missed',
  'unrecorded-dose': 'Dose not recorded either way',
  incident: 'Incident written up',
  'lapsed-credential': 'Lapsed credential',
  'double-booked': 'Double booked',
  'inactive-client': 'Client not receiving care',
  'over-contract': 'Over contracted hours',
  unfilled: 'No caregiver booked',
}

/**
 * What each alert is *about*, so the table can be grouped by the thing a
 * coordinator is chasing rather than only by how loud it is.
 *
 * The source design's tabs were Active Alerts / Incidents / Emergencies /
 * Resolved. Three of those describe a workflow this app does not have: nothing
 * stores an alert's state, so nothing can be acknowledged, escalated to an
 * emergency, or resolved — every alert here is recomputed from the clock and
 * disappears when the underlying fact stops being true. These four categories
 * describe the subject matter instead, which is a property of the alert itself.
 */
export type AlertCategory = 'attendance' | 'clinical' | 'record' | 'compliance'

export const alertCategoryLabels: Record<AlertCategory, string> = {
  attendance: 'Attendance',
  clinical: 'Clinical',
  record: 'Paperwork',
  compliance: 'Compliance',
}

/**
 * Whether the outcome can still be changed.
 *
 * The source design tabbed "Active Alerts 8" out of "All 19", which implies a
 * stored lifecycle — an alert that is raised, worked and closed. This app has
 * none: every alert is recomputed from the clock. But there *is* a real
 * distinction underneath that tab, and it is the one a coordinator actually
 * cares about at 11am: can I still affect this, or has it already happened and
 * all that is left is follow-up? A visit nobody has arrived at can still be
 * covered. A visit that went uncovered yesterday cannot.
 */
export type AlertTiming = 'changeable' | 'recorded'

export const alertTimings: AlertTiming[] = ['changeable', 'recorded']

export const alertTimingLabels: Record<AlertTiming, string> = {
  changeable: 'Could still change',
  recorded: 'Already on the record',
}

export const alertTimingHints: Record<AlertTiming, string> = {
  changeable:
    'The record could still say something different: somebody can be sent, chased, renewed or written up.',
  recorded:
    'The record already says what happened. Worth following up, but nothing in the next hour changes it.',
}

/*
 * Deliberately NOT a `Record<AlertKind, AlertTiming>`.
 *
 * A first version keyed this on the kind alone, which was wrong for every kind
 * whose state is not already derived from the clock: an overlap between two
 * 09:00 visits read "could still change" at 23:00, and a contract overrun said
 * the same on the Sunday night that ended the week. Each alert now decides for
 * itself, at the minute it is built, so the axis recomputes with the clock like
 * everything else on this page.
 *
 * The test is one question: could the record still come to say something
 * different? Not "is this old" and not "has anybody looked at it" — there is no
 * acknowledgement state here to ask about.
 */

export const alertCategoryOf: Record<AlertKind, AlertCategory> = {
  unattended: 'attendance',
  overdue: 'attendance',
  'late-arrival': 'attendance',
  overrunning: 'attendance',
  overran: 'attendance',
  uncovered: 'attendance',
  unfilled: 'attendance',
  'missed-dose': 'clinical',
  'unrecorded-dose': 'clinical',
  incident: 'clinical',
  unrecorded: 'record',
  'lapsed-credential': 'compliance',
  'double-booked': 'compliance',
  'inactive-client': 'compliance',
  'over-contract': 'compliance',
}

export interface AlertAction {
  label: string
  to: string
}

/**
 * Who to ring about this alert, with a number that actually exists.
 *
 * The source design put "Contact Caregiver" and "Contact Family" buttons on
 * every row. Those turn out to be honest — the roster carries a phone number
 * for every caregiver and the family record carries one for every contact — so
 * unlike Escalate, Acknowledge and Resolve, this is a button that can do
 * exactly what it says. It is a `tel:` link, not a messaging feature: the app
 * has no outbound channel of its own.
 */
export interface AlertContact {
  /** "Call Sarah Williams" — named, so the row says who is being rung. */
  label: string
  name: string
  phone: string
  /** "Caregiver on the visit", "Son", "Primary contact". */
  role: string
}

export interface LiveAlert {
  id: string
  kind: AlertKind
  severity: Severity
  /**
   * Which record the alert was read off. Named on the row because these are
   * derived facts, not entries in an alerts table — there is no alerts table.
   */
  source: string
  /**
   * The branch the alert belongs to, where one can be worked out. Null rather
   * than a default: a branch is a property of the *caregiver*, so an unfilled
   * slot with nobody on it genuinely has none, and filing it under whichever
   * branch happened to be first would hide it from the branch that owns it.
   */
  branch: string | null
  /** Whether the record behind this could still come to say something else. */
  timing: AlertTiming
  /**
   * The thing the alert is about — a visit, a caregiver, a client.
   *
   * Two alerts share a thread when they are the same problem wearing a
   * different name: "Nobody on the visit" at 11:00 becomes "Went uncovered" at
   * 12:30, same visit, different `id`. Resolution is worked out per thread, so
   * a problem that merely got worse is never reported as having cleared.
   */
  thread: string
  /**
   * Set only on rows returned by `resolvedAt`: the clock time at which this
   * thread stopped raising anything at all.
   */
  clearedAt?: string
  /** Set alongside `clearedAt`: when the thread first raised anything today. */
  raisedAt?: string
  /** Minutes between the two, already formatted. */
  openFor?: string
  /** Who to ring, where the fixture holds a number. */
  contact: AlertContact | null
  /**
   * The visit the alert came off, where there is one. A lapsed credential and
   * a client's care status are not about any single visit, so both are null
   * rather than borrowed from whichever visit happened to sort first.
   */
  serviceType: string | null
  visitState: LiveState | null
  /**
   * The person the alert is about. A caregiver who has not checked in is the
   * subject of that alert; naming the client put the wrong name in the row
   * header and left the caregiver's name nowhere on their own row.
   */
  subject: string
  /** The other party, where there is one. */
  counterpart: string | null
  /**
   * The two roles named, where the alert came off a visit. Separate from
   * `subject`/`counterpart`, which say who the alert is *about* and vary by
   * kind — a card that prints "Recipient:" and "Caregiver:" has to know which
   * is which, and a credential or client-status alert has neither.
   */
  recipientName: string | null
  caregiverName: string | null
  label: string
  detail: string
  /**
   * How long it has been true, already formatted. Null where the alert is not
   * a stopwatch — a client who is not receiving care has no elapsed time, and
   * putting "No GPS lock" in a column headed "Time overdue" is not a duration.
   */
  elapsed: string | null
  /** True when the fact is about the whole week rather than this minute. */
  weekScoped?: boolean
  /** Where the coordinator goes to deal with it. */
  action: AlertAction
  /** A second place worth going, where there is one. */
  secondary?: AlertAction
}

const severityRankOf: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
}

/**
 * What needs a person, now. Everything here is derived from the same board and
 * the same conflict check the Scheduling screen uses — nothing on this page is
 * an event type the rest of the app has never heard of.
 */
/**
 * Minutes between two clock times on one visit, unwrapping an overnight block
 * so a 00:15 clock-out on a shift ending 23:45 reads as 30 minutes over rather
 * than 23 hours under.
 */
/**
 * The branch an alert belongs to.
 *
 * A branch is a property of the caregiver, not the client — the roster is what
 * carries it. So an unassigned slot has no branch at all, which is why the
 * field is nullable and the filter offers "not branch-specific" rather than
 * quietly dropping those rows.
 */
function branchOfVisit(visit: LiveVisit): string | null {
  if (!visit.caregiverId) return null
  return staffMembers.find((m) => m.id === visit.caregiverId)?.branch ?? null
}

/** Whether any matching visit on the board has yet to finish. */
function stillToFinish(
  rows: LiveVisit[],
  match: (row: LiveVisit) => boolean,
): boolean {
  return rows.some((r) => match(r) && r.pastEnd < 0)
}

/**
 * The branch of whoever is on this client's visits today.
 *
 * A client has no branch of their own; the caregiver does. Preferring a
 * staffed visit means an inactive-client alert lands with the branch that has
 * somebody at the address, rather than with whichever visit happened to sort
 * first.
 */
function branchOfRecipient(rows: LiveVisit[], recipientId: string): string | null {
  for (const row of rows) {
    if (row.recipientId !== recipientId) continue
    const branch = branchOfVisit(row)
    if (branch) return branch
  }
  return null
}

/**
 * Who a coordinator would ring about this.
 *
 * The caregiver where there is one and the problem is theirs to fix; the
 * family where nobody is assigned, because there is no caregiver to ring and
 * somebody has to be told the visit is not happening. Null where the fixture
 * holds no number, rather than a dead button.
 */
function contactFor(
  recipientId: string,
  caregiverId: string | null,
): AlertContact | null {
  const member = caregiverId
    ? staffMembers.find((m) => m.id === caregiverId)
    : undefined
  if (member?.phone) {
    return {
      label: `Call ${member.name.split(' ')[0]}`,
      name: member.name,
      phone: member.phone,
      // Just "Caregiver": this same resolver serves a lapsed-credential alert,
      // which has no visit for them to be on.
      role: 'Caregiver',
    }
  }

  const family = getFamilyRecord(recipientId)?.members ?? []
  const primary =
    memberWithRole(family, 'Primary Contact') ??
    memberWithRole(family, 'Emergency Contact') ??
    family[0]
  if (primary?.phone) {
    return {
      label: `Call ${primary.name.split(' ')[0]}`,
      name: primary.name,
      phone: primary.phone,
      role: primary.relationship,
    }
  }
  return null
}

/** `tel:` needs the digits, not the punctuation a person reads. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function gapFrom(visit: LiveVisit, from: string, to: string): number {
  const start = minutesOfDay(formatTime(visit.start))
  const unwrap = (t: string) => {
    const m = minutesOfDay(formatTime(t))
    return visit.overnight && m < start ? m + 24 * 60 : m
  }
  return unwrap(to) - unwrap(from)
}

/**
 * Whether the clock has reached a time on the visit record.
 *
 * `late-arrival` and `overran` read `clockIn`/`clockOut` directly instead of
 * going through `stateOf`, so without this they announced a 09:45 check-in at
 * midnight — nine hours before it happened — on a page that promises every row
 * recomputes from the clock.
 */
function happened(visit: LiveVisit, at: string, now: string): boolean {
  if (visit.date < TODAY) return true
  if (visit.date > TODAY) return false
  const start = minutesOfDay(formatTime(visit.start))
  const unwrap = (t: string) => {
    const m = minutesOfDay(formatTime(t))
    return visit.overnight && m < start ? m + 24 * 60 : m
  }
  return unwrap(at) <= unwrap(now)
}

export function alertsAt(date = TODAY, now = NOW): LiveAlert[] {
  const rows = liveBoard(date, now)
  const alerts: LiveAlert[] = []

  for (const visit of rows) {
    if (visit.state === 'unattended') {
      alerts.push({
        recipientName: visit.recipientName,
        caregiverName: visit.caregiverName,
        id: `unattended-${visit.id}`,
        kind: 'unattended',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'changeable',
        branch: branchOfVisit(visit),
        severity: 'critical',
        source: 'The rota',
        subject: visit.recipientName,
        counterpart: null,
        label: `${visit.recipientName} has nobody with them`,
        detail:
          visit.sinceStart === 0
            ? `${visit.type} has just started and no caregiver is assigned.`
            : `${visit.type} started ${formatGap(visit.sinceStart)} ago and no caregiver is assigned.`,
        // Measured from the start, and the "went uncovered" alert that
        // succeeds it uses the same origin — the clock must not restart when
        // an unresolved problem merely changes name.
        elapsed: formatGap(visit.sinceStart),
        action: {
          label: 'Assign someone',
          to: `/scheduling/visits/${visit.id}/assign`,
        },
        secondary: {
          label: 'Open the visit',
          to: `/scheduling/visits/${visit.id}/overview`,
        },
      })
    }

    if (visit.state === 'overdue') {
      alerts.push({
        recipientName: visit.recipientName,
        caregiverName: visit.caregiverName,
        id: `overdue-${visit.id}`,
        kind: 'overdue',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'changeable',
        branch: branchOfVisit(visit),
        severity: 'high',
        // The absence of a record is the actual test, and the source line has
        // to name it — "the clock against the rota" omitted the only input
        // that decides the alert.
        source: 'The rota, with no visit record filed',
        subject: visit.caregiverName ?? visit.recipientName,
        counterpart: visit.recipientName,
        label: `${visit.caregiverName} has not checked in`,
        detail: `${visit.recipientName} at ${formatTime(visit.start)} — no visit record.`,
        // Overdue *by*, not elapsed since the start: the check-in only became
        // late once the grace period passed, which is what the tile says too.
        elapsed: formatGap(visit.sinceStart - CHECK_IN_GRACE_MINUTES),
        action: {
          label: 'Open the visit',
          to: `/scheduling/visits/${visit.id}/overview`,
        },
        secondary: visit.caregiverId
          ? {
              label: `Open ${visit.caregiverName}`,
              to: `/caregivers/${visit.caregiverId}/schedule`,
            }
          : undefined,
      })
    }

    /*
     * A clock-in materially past the scheduled start. Distinct from `overdue`,
     * which fires when no check-in has arrived at all — this one is about a
     * check-in that *did* arrive, late, and is therefore only knowable after
     * the fact. The source design called this "Late Check-in Warning" and
     * showed it as a live warning, which it cannot be.
     */
    if (visit.clockIn && visit.state !== 'cancelled' && happened(visit, visit.clockIn, now)) {
      const late = gapFrom(visit, visit.start, visit.clockIn)
      /*
       * The record's own verdict first. `late-arrival` is already a stored
       * `VisitStatus` that the recipient's Visits tab badges and the
       * caregiver's punctuality figure counts, and every stored one in the
       * fixture is 10–12 minutes — under any threshold worth setting. Deriving
       * lateness afresh gave the same word two meanings and made the alert
       * disagree with three other screens. The threshold now only catches a
       * clock-in nobody flagged.
       */
      if (visit.status === 'late-arrival' || late > CHECK_IN_GRACE_MINUTES) {
        alerts.push({
          recipientName: visit.recipientName,
          caregiverName: visit.caregiverName,
          id: `late-${visit.id}`,
          kind: 'late-arrival',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'recorded',
        branch: branchOfVisit(visit),
          severity: late > LATE_ARRIVAL_HIGH_MINUTES ? 'high' : 'medium',
          source:
            visit.status === 'late-arrival'
              ? 'The visit record’s own status'
              : 'The visit record’s clock-in',
          subject: visit.caregiverName ?? visit.recipientName,
          counterpart: visit.recipientName,
          label: `${visit.caregiverName} checked in late to ${visit.recipientName}`,
          detail: `Due at ${formatTime(visit.start)}, clocked in at ${formatTime(visit.clockIn)}.`,
          // How late they were — a fixed fact about the past, not a stopwatch
          // still running.
          elapsed: formatGap(late),
          action: {
            label: 'Open the visit',
            to: `/scheduling/visits/${visit.id}/location`,
          },
          secondary: visit.caregiverId
            ? {
                label: `Open ${visit.caregiverName}`,
                to: `/caregivers/${visit.caregiverId}/schedule`,
              }
            : undefined,
        })
      }
    }

    /*
     * A clock-out past the scheduled finish. The visit is over, so this is not
     * `overrunning` — that one is about a visit still running now. Only became
     * derivable once `clockOut` was carried onto the board; before that, the
     * app genuinely had no checkout and inventing one was refused.
     */
    if (
      visit.clockOut &&
      visit.state !== 'cancelled' &&
      // Not while it is still running: `overrunning` is the alert for that,
      // and the two side by side reported one visit as two problems in
      // contradictory tenses.
      visit.state !== 'overrunning' &&
      visit.state !== 'in-progress' &&
      happened(visit, visit.clockOut, now)
    ) {
      const over = gapFrom(visit, visit.end, visit.clockOut)
      if (over > OVERRUN_GRACE_MINUTES) {
        alerts.push({
          recipientName: visit.recipientName,
          caregiverName: visit.caregiverName,
          id: `overran-${visit.id}`,
          kind: 'overran',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'recorded',
        branch: branchOfVisit(visit),
          severity: 'medium',
          source: 'The visit record’s clock-out',
          subject: visit.caregiverName ?? visit.recipientName,
          counterpart: visit.recipientName,
          label: `${visit.recipientName}’s visit ran past its finish`,
          detail: `Due to finish ${formatTime(visit.end)}, clocked out ${formatTime(visit.clockOut)}.`,
          elapsed: formatGap(over),
          action: {
            label: 'Open the visit',
            to: `/scheduling/visits/${visit.id}/timeline`,
          },
        })
      }
    }

    if (visit.state === 'overrunning') {
      alerts.push({
        recipientName: visit.recipientName,
        caregiverName: visit.caregiverName,
        id: `overrun-${visit.id}`,
        kind: 'overrunning',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'changeable',
        branch: branchOfVisit(visit),
        severity: 'medium',
        source: 'The clock against the rota',
        subject: visit.caregiverName ?? visit.recipientName,
        counterpart: visit.recipientName,
        label: `${visit.recipientName}’s visit is running over`,
        detail: `Due to finish at ${formatTime(visit.end)}.`,
        elapsed: formatGap(visit.pastEnd),
        action: {
          label: 'Open the visit',
          to: `/scheduling/visits/${visit.id}/overview`,
        },
      })
    }

    if (visit.state === 'unrecorded') {
      alerts.push({
        recipientName: visit.recipientName,
        caregiverName: visit.caregiverName,
        id: `unrecorded-${visit.id}`,
        kind: 'unrecorded',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'changeable',
        branch: branchOfVisit(visit),
        severity: 'medium',
        // Fires *because* `logged` is false, so "read off the visit record" was
        // pointing at a record that does not exist.
        source: 'The rota, with no visit record filed',
        subject: visit.caregiverName ?? visit.recipientName,
        counterpart: visit.recipientName,
        label: `${visit.caregiverName} has not written up ${visit.recipientName}`,
        detail: `The ${formatTime(visit.start)} visit closed with no record.`,
        // Same origin as the overdue check-in this succeeds, so the elapsed
        // time keeps climbing instead of resetting to "just now".
        elapsed: formatGap(visit.sinceStart - CHECK_IN_GRACE_MINUTES),
        action: {
          label: 'Open the visit',
          to: `/scheduling/visits/${visit.id}/overview`,
        },
        secondary: visit.caregiverId
          ? {
              label: `Open ${visit.caregiverName}`,
              to: `/caregivers/${visit.caregiverId}/schedule`,
            }
          : undefined,
      })
    }

    if (visit.state === 'upcoming' && visit.caregiverId === null) {
      alerts.push({
        recipientName: visit.recipientName,
        caregiverName: visit.caregiverName,
        id: `unfilled-${visit.id}`,
        kind: 'unfilled',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'changeable',
        branch: branchOfVisit(visit),
        severity: 'medium',
        source: 'The rota',
        subject: visit.recipientName,
        counterpart: null,
        label: `${visit.recipientName} at ${formatTime(visit.start)} has nobody booked`,
        detail: `${visit.type}, starting in ${formatGap(-visit.sinceStart)}.`,
        // Not overdue — it has not started. The column stays empty rather
        // than borrowing a countdown that means the opposite.
        elapsed: null,
        action: {
          label: 'Assign a caregiver',
          to: `/scheduling/visits/${visit.id}/assign`,
        },
      })
    }

    if (visit.state === 'uncovered') {
      alerts.push({
        recipientName: visit.recipientName,
        caregiverName: visit.caregiverName,
        id: `uncovered-${visit.id}`,
        kind: 'uncovered',
        thread: visit.id,
        serviceType: visit.type,
        visitState: visit.state,
        contact: contactFor(visit.recipientId, visit.caregiverId),
        timing: 'recorded',
        branch: branchOfVisit(visit),
        severity: 'high',
        source: 'The rota',
        subject: visit.recipientName,
        counterpart: null,
        label: `${visit.recipientName}’s visit went uncovered`,
        detail: `${visit.type} at ${formatTime(visit.start)} — nobody was ever assigned.`,
        // From the start, continuing the "nobody on it" clock rather than
        // restarting at the end of the window.
        elapsed: formatGap(visit.sinceStart),
        action: {
          label: 'Open the visit',
          to: `/scheduling/visits/${visit.id}/overview`,
        },
        secondary: {
          label: 'Open the care record',
          to: `/care-recipients/${visit.recipientId}`,
        },
      })
    }
  }

  // The board's own conflicts, brought onto the live view rather than restated
  // — a lapsed credential is the same fact here as it is on Scheduling.
  for (const conflict of conflictsOn(date)) {
    const mapped = fromConflict(conflict, rows, date)
    if (mapped) alerts.push(mapped)
  }

  alerts.push(...clinicalAlerts(rows, date, now))

  // Severity, then the name the table actually shows. Deliberately *not* by
  // elapsed time: a credential 115 days out of date would then outrank a
  // caregiver who is missing from a visit right now.
  return alerts.sort(
    (a, b) =>
      severityRankOf[a.severity] - severityRankOf[b.severity] ||
      a.subject.localeCompare(b.subject) ||
      a.label.localeCompare(b.label),
  )
}

/**
 * Alerts that come off the client's clinical records rather than the board.
 *
 * Both are things somebody wrote down. Neither is a detection: the app has no
 * pill dispenser telling it a dose was skipped and no fall sensor — a missed
 * dose is a dose a caregiver marked missed, and an incident is an incident a
 * caregiver typed up. That is why the row names the record it came from.
 */
function clinicalAlerts(
  rows: LiveVisit[],
  date: string,
  now: string,
): LiveAlert[] {
  const out: LiveAlert[] = []
  const nowMin = minutesOfDay(formatTime(now))
  // One client can have several visits in a day; the alert is about the client,
  // so it must not be raised once per visit.
  const seen = new Set<string>()

  for (const visit of rows) {
    if (seen.has(visit.recipientId)) continue
    seen.add(visit.recipientId)

    const plan = getMedicationPlan(visit.recipientId)
    if (plan && plan.scheduleDateIso === date) {
      for (const dose of plan.doses) {
        const at = minutesOfDay(dose.time)
        const passed = !Number.isFinite(at) || date < TODAY || at <= nowMin

        if (dose.state === 'missed') {
          // A dose the clock has not reached cannot yet have been missed.
          if (!passed) continue
          out.push({
            id: `dose-${visit.recipientId}-${dose.id}`,
            kind: 'missed-dose',
            recipientName: visit.recipientName,
            caregiverName: null,
            thread: `dose:${visit.recipientId}:${dose.id}`,
            serviceType: visit.type,
            visitState: visit.state,
            contact: contactFor(visit.recipientId, visit.caregiverId),
            timing: 'recorded',
            branch: branchOfVisit(visit),
            severity: 'critical',
            source: `${visit.recipientName}’s medication plan`,
            subject: visit.recipientName,
            counterpart: dose.administeredBy,
            label: `${dose.title} recorded as missed for ${visit.recipientName}`,
            detail: `${dose.medications} — due ${dose.time}, assigned to ${dose.administeredBy}.`,
            // Not a stopwatch: the record says it was missed, and how long ago
            // that was does not change what a coordinator has to do.
            elapsed: null,
            action: {
              label: 'Open the medications',
              to: `/care-recipients/${visit.recipientId}/medications`,
            },
            secondary: {
              label: 'Open the care record',
              to: `/care-recipients/${visit.recipientId}`,
            },
          })
          continue
        }

        /*
         * A dose whose window has passed and which is still only "scheduled" —
         * nobody marked it given and nobody marked it missed. This is the
         * honest reading of the source design's "Medication Discrepancy": the
         * plan and the record disagree. It is high rather than critical
         * because the likeliest cause is paperwork lag, not a skipped dose —
         * a dose recorded as *missed* is the confirmed-bad one above.
         */
        if (
          dose.state === 'scheduled' &&
          passed &&
          (!Number.isFinite(at) || date < TODAY || nowMin - at > DOSE_GRACE_MINUTES)
        ) {
          out.push({
            id: `dose-open-${visit.recipientId}-${dose.id}`,
            kind: 'unrecorded-dose',
            recipientName: visit.recipientName,
            caregiverName: null,
            thread: `dose:${visit.recipientId}:${dose.id}`,
            serviceType: visit.type,
            visitState: visit.state,
            contact: contactFor(visit.recipientId, visit.caregiverId),
            timing: 'changeable',
            branch: branchOfVisit(visit),
            severity: 'high',
            source: `${visit.recipientName}’s medication plan`,
            subject: visit.recipientName,
            counterpart: dose.administeredBy,
            label: `${dose.title} for ${visit.recipientName} is still unrecorded`,
            detail: `${dose.medications} — due ${dose.time}, assigned to ${dose.administeredBy}. Not marked given and not marked missed.`,
            elapsed: Number.isFinite(at) ? formatGap(nowMin - at) : null,
            action: {
              label: 'Open the medications',
              to: `/care-recipients/${visit.recipientId}/medications`,
            },
          })
        }
      }
    }

    for (const note of getCareNotes(visit.recipientId)) {
      // Flagged incidents only. An unflagged incident note is a write-up the
      // caregiver did not escalate, and promoting it here would override their
      // judgement.
      if (note.category !== 'incident' || !note.flagged) continue
      if (note.at.slice(0, 10) !== date) continue
      if (date === TODAY && minutesOfDay(formatTime(note.at.slice(11, 16))) > nowMin)
        continue
      out.push({
        id: `incident-${note.id}`,
        kind: 'incident',
        recipientName: visit.recipientName,
        caregiverName: null,
            thread: `note:${note.id}`,
            serviceType: visit.type,
            visitState: visit.state,
            contact: contactFor(visit.recipientId, visit.caregiverId),
            timing: 'recorded',
            branch: branchOfVisit(visit),
        severity: 'high',
        source: `${visit.recipientName}’s care notes`,
        subject: visit.recipientName,
        counterpart: note.author,
        label: `${note.author} wrote up an incident for ${visit.recipientName}`,
        // Trimmed: every other alert's detail is a one-line derived sentence,
        // and a 200-character note body in the Issue cell of a six-column
        // table is a paragraph. The full text is one click away.
        detail: truncate(note.body, 140),
        elapsed: null,
        action: {
          label: 'Open the notes',
          to: `/care-recipients/${visit.recipientId}/notes`,
        },
        secondary: {
          label: 'Open the care record',
          to: `/care-recipients/${visit.recipientId}`,
        },
      })
    }
  }

  return out
}

/** How long a caregiver's soonest-expired credential has been out of date. */
function lapsedFor(
  member: StaffMember | undefined,
  date: string,
): { elapsed: string | null } {
  if (!member) return { elapsed: null }
  const expired = credentialStates(member, date)
    .filter((c) => c.state === 'expired' && c.credential.expiresAt)
    .map((c) => c.credential.expiresAt!)
    .sort()
  if (expired.length === 0) return { elapsed: null }

  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${expired[0]}T00:00:00Z`)) /
      86_400_000,
  )
  if (days < 0) return { elapsed: null }
  return { elapsed: `${days} day${days === 1 ? '' : 's'}` }
}

function fromConflict(
  conflict: Conflict,
  rows: LiveVisit[],
  date: string,
): LiveAlert | null {
  const member = staffMembers.find((m) => m.id === conflict.caregiverId)
  const recipient = rows.find((r) => r.recipientId === conflict.recipientId)
  const subject = member?.name ?? recipient?.recipientName ?? 'The board'

  const onDutyNow =
    conflict.caregiverId !== undefined &&
    rows.some(
      (r) =>
        r.caregiverId === conflict.caregiverId &&
        (r.state === 'in-progress' || r.state === 'overrunning'),
    )

  if (conflict.kind === 'lapsed-credential') {
    return {
      id: conflict.id,
      kind: 'lapsed-credential',
      recipientName: null,
      caregiverName: member?.name ?? null,
      thread: conflict.id,
      // Not about one visit, so neither field is borrowed from one.
      serviceType: null,
      visitState: null,
      contact: conflict.caregiverId
        ? contactFor(recipient?.recipientId ?? '', conflict.caregiverId)
        : null,
      timing: 'changeable',
      branch: member?.branch ?? null,
      // Only critical while they are actually with a client.
      severity: onDutyNow ? 'critical' : 'high',
      source: 'The Scheduling board’s conflicts',
      subject,
      counterpart: null,
      label: conflict.label,
      detail: onDutyNow
        ? `${conflict.detail} They are with a client right now.`
        : conflict.detail,
      // Days since the card expired, from the credential's own date.
      ...lapsedFor(member, date > TODAY ? date : TODAY),
      action: {
        label: 'Open their credentials',
        to: `/caregivers/${conflict.caregiverId}/documents`,
      },
    }
  }

  if (conflict.kind === 'overlap') {
    return {
      id: conflict.id,
      kind: 'double-booked',
      recipientName: null,
      caregiverName: member?.name ?? null,
      thread: conflict.id,
      // Not about one visit, so neither field is borrowed from one.
      serviceType: null,
      visitState: null,
      contact: conflict.caregiverId
        ? contactFor(recipient?.recipientId ?? '', conflict.caregiverId)
        : null,
      branch: member?.branch ?? null,
      // An overlap between two 09:00 visits cannot be undone at 23:00. Keyed
      // on whether either of the caregiver's visits has yet to finish.
      timing: stillToFinish(rows, (r) => r.caregiverId === conflict.caregiverId)
        ? 'changeable'
        : 'recorded',
      source: 'The Scheduling board’s conflicts',
      severity: onDutyNow ? 'critical' : 'high',
      subject,
      counterpart: null,
      label: conflict.label,
      detail: conflict.detail,
      elapsed: null,
      action: {
        label: 'Open their rota',
        to: `/caregivers/${conflict.caregiverId}/schedule`,
      },
    }
  }

  if (conflict.kind === 'inactive-recipient') {
    return {
      id: conflict.id,
      kind: 'inactive-client',
      recipientName: recipient?.recipientName ?? null,
      caregiverName: null,
      thread: conflict.id,
      // Not about one visit, so neither field is borrowed from one.
      serviceType: null,
      visitState: null,
      contact: conflict.recipientId
        ? contactFor(conflict.recipientId, null)
        : null,
      // The conflict carries no caregiverId, so `member` is always undefined
      // here — falling back to it filed every one of these under "not tied to
      // a branch" even when somebody was standing in the client's house. The
      // branch comes from whoever is actually on the visit.
      branch: conflict.recipientId
        ? branchOfRecipient(rows, conflict.recipientId)
        : null,
      // The client's status can be corrected at any time, but only while a
      // visit is still on the board to be stood down.
      timing: stillToFinish(rows, (r) => r.recipientId === conflict.recipientId)
        ? 'changeable'
        : 'recorded',
      source: 'The Scheduling board’s conflicts',
      severity: 'medium',
      subject,
      counterpart: null,
      label: conflict.label,
      detail: conflict.detail,
      // Not a stopwatch: a client's care status has no elapsed time.
      elapsed: null,
      action: {
        label: 'Open the care record',
        to: `/care-recipients/${conflict.recipientId}`,
      },
    }
  }

  if (conflict.kind === 'over-contract') {
    return {
      id: conflict.id,
      kind: 'over-contract',
      recipientName: null,
      caregiverName: member?.name ?? null,
      thread: conflict.id,
      // Not about one visit, so neither field is borrowed from one.
      serviceType: null,
      visitState: null,
      contact: conflict.caregiverId
        ? contactFor(recipient?.recipientId ?? '', conflict.caregiverId)
        : null,
      branch: member?.branch ?? null,
      // A week's overage stops being fixable once the week is worked. Sunday
      // is day 0, so `6 - day` is the days left after today.
      timing: 6 - new Date(`${date}T00:00:00Z`).getUTCDay() > 0
        ? 'changeable'
        : 'recorded',
      source: 'The Scheduling board’s conflicts',
      severity: 'medium',
      subject,
      counterpart: null,
      label: conflict.label,
      detail: conflict.detail,
      elapsed: null,
      // Carried through: this is a fact about the week, on a page whose other
      // rows are measured in minutes.
      weekScoped: conflict.weekScoped,
      action: {
        label: 'Open their rota',
        to: `/caregivers/${conflict.caregiverId}/schedule`,
      },
    }
  }

  // `outside-availability` is a rostering fact, not a live one; it belongs on
  // Scheduling and would be noise here.
  return null
}

export function countBySeverity(alerts: LiveAlert[]): Record<Severity, number> {
  return {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
  }
}

export function countByCategory(
  alerts: LiveAlert[],
): Record<AlertCategory, number> {
  const counts: Record<AlertCategory, number> = {
    attendance: 0,
    clinical: 0,
    record: 0,
    compliance: 0,
  }
  for (const alert of alerts) counts[alertCategoryOf[alert.kind]] += 1
  return counts
}

export const alertCategories: AlertCategory[] = [
  'attendance',
  'clinical',
  'record',
  'compliance',
]

/**
 * The tab row.
 *
 * Follows the design's five tabs, with two renamed for what the data can
 * actually say. "Active Alerts" is every alert whose record could still change;
 * "Emergencies" became Critical, because an emergency implies a response
 * protocol this app has no trace of; and "Resolved" — which needs a stored
 * lifecycle nothing here keeps — became the honest opposite of Active.
 *
 * These deliberately overlap: a critical alert is usually also active. That is
 * normal for a tab row and the counts are each computed independently, so
 * nothing claims they add up to All — which is what the source design's
 * 8 + 4 + 1 + 6 = 19 did claim.
 */
export type AlertTab =
  | 'all'
  | 'active'
  | 'incidents'
  | 'emergencies'
  | 'resolved'

export const alertTabs: { value: AlertTab; label: string; hint: string }[] = [
  { value: 'all', label: 'All', hint: 'Everything raised and everything cleared today.' },
  {
    value: 'active',
    label: 'Active Alerts',
    hint: 'Still true, and the record behind it could still change.',
  },
  {
    value: 'incidents',
    label: 'Incidents',
    // Its own register, not a slice of the alerts. An incident is a document
    // somebody filed; it stays on file whatever the clock does, so this tab
    // spans the last month while everything else on the page is today.
    hint: 'Incidents written up in the last 30 days. Filed records, not derived from the clock.',
  },
  {
    value: 'emergencies',
    label: 'Emergencies',
    hint: 'Critical: somebody is without the care they are booked for.',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    hint: 'Raised earlier today and no longer raised. Nothing records who fixed it.',
  },
]

export function matchesTab(alert: LiveAlert, tab: AlertTab): boolean {
  switch (tab) {
    case 'all':
      return true
    case 'active':
      // Not merely "exists": an alert already on the record is not active, it
      // is history somebody still has to follow up.
      return !alert.clearedAt && alert.timing === 'changeable'
    // An incident is something that happened to the client: a dose recorded as
    // missed, a dose nobody recorded either way, an incident written up.
    case 'incidents':
      return alertCategoryOf[alert.kind] === 'clinical'
    // The design's word. It means critical severity, which in this app means
    // somebody is without the care they are booked for — no protocol is being
    // promised beyond that.
    case 'emergencies':
      return alert.severity === 'critical'
    case 'resolved':
      return Boolean(alert.clearedAt)
  }
}

export interface AlertQuery {
  tab: AlertTab
  /** A branch name, `'none'` for alerts no branch owns, or `'all'`. */
  branch: string
  /** A `LiveState`, `'none'` for alerts with no visit behind them, or `'all'`. */
  visitState: string
  /** A service type, `'none'`, or `'all'`. */
  serviceType: string
}

export function filterAlerts(
  alerts: LiveAlert[],
  query: AlertQuery,
): LiveAlert[] {
  return alerts.filter(
    (a) =>
      matchesTab(a, query.tab) &&
      (query.branch === 'all' ||
        (query.branch === 'none' ? a.branch === null : a.branch === query.branch)) &&
      (query.visitState === 'all' ||
        (query.visitState === 'none'
          ? a.visitState === null
          : a.visitState === query.visitState)) &&
      (query.serviceType === 'all' ||
        (query.serviceType === 'none'
          ? a.serviceType === null
          : a.serviceType === query.serviceType)),
  )
}

/** How often the day is sampled when working out what has cleared. */
const RESOLUTION_STEP_MINUTES = 15

/**
 * Alerts that were raised earlier today and are raised no longer.
 *
 * The design has a "Resolved" tab, and nothing in this app stores an alert to
 * mark resolved — but that does not mean the idea is unavailable. An alert is
 * a fact about the board at a minute; a fact that was true at 09:00 and is
 * false now has, definitionally, gone away. Walking the day and diffing is how
 * that gets computed.
 *
 * The trap this is built around: a problem that gets *worse* also makes its
 * old alert disappear. "Nobody on the visit" at 11:00 becomes "Went uncovered"
 * at 12:30 — a different `id`, so a naive diff would report the first as
 * resolved at the exact moment it became unfixable. Hence `thread`: a row only
 * counts as cleared when its thread is raising nothing at all.
 *
 * What this still cannot tell you is *why* it cleared — whether a coordinator
 * rang someone or the caregiver simply checked in. The row says when it went,
 * not who fixed it.
 */
export function resolvedAt(date = TODAY, now = NOW): LiveAlert[] {
  const nowMin = minutesOfDay(formatTime(now))
  const live = new Set(alertsAt(date, now).map((a) => a.thread))

  // The last version of each thread seen before it went, and when it went.
  const gone = new Map<string, { alert: LiveAlert; clearedAt: string }>()
  // When each thread first raised anything, so the row can say how long it ran.
  const firstSeen = new Map<string, string>()
  let previous: LiveAlert[] = []

  for (let m = 0; m <= nowMin; m += RESOLUTION_STEP_MINUTES) {
    const at = minutesToClock(m)
    const current = alertsAt(date, at)
    const threadsNow = new Set(current.map((a) => a.thread))

    for (const alert of current) {
      if (!firstSeen.has(alert.thread)) firstSeen.set(alert.thread, at)
    }
    for (const alert of previous) {
      if (threadsNow.has(alert.thread)) continue
      // Gone at this step. Recorded even if it comes back later — the map is
      // overwritten on a second disappearance, and anything still raised at
      // `now` is filtered out below.
      gone.set(alert.thread, { alert, clearedAt: at })
    }
    previous = current
  }

  return [...gone.values()]
    .filter(({ alert }) => !live.has(alert.thread))
    .map(({ alert, clearedAt }) => {
      const raisedAt = firstSeen.get(alert.thread)
      const openFor = raisedAt
        ? formatGap(
            minutesOfDay(formatTime(clearedAt)) - minutesOfDay(formatTime(raisedAt)),
          )
        : undefined
      return { ...alert, clearedAt, raisedAt, openFor }
    })
    .sort(
      (a, b) =>
        minutesOfDay(formatTime(b.clearedAt!)) -
          minutesOfDay(formatTime(a.clearedAt!)) ||
        a.subject.localeCompare(b.subject),
    )
}

/**
 * What changed to make the alert stop being true.
 *
 * The design's column is "Resolved by" and fills it with a name — "Sarah
 * Jenkins", "System Auto". Nothing in this app records an actor: an alert is
 * recomputed from the records every render, so all that can be known is which
 * record moved, never who moved it. The column says that instead of guessing.
 */
export const clearedBecause: Record<AlertKind, string> = {
  unattended: 'A caregiver was assigned',
  unfilled: 'A caregiver was assigned',
  uncovered: 'A caregiver was assigned',
  overdue: 'A visit record appeared',
  unrecorded: 'The visit was written up',
  'late-arrival': 'The clock-in on the record changed',
  overrunning: 'The visit closed',
  overran: 'The clock-out on the record changed',
  'missed-dose': 'The dose stopped being marked missed',
  'unrecorded-dose': 'The dose was recorded',
  incident: 'The incident note was unflagged or removed',
  'lapsed-credential': 'The credential was renewed',
  'double-booked': 'The overlap was taken off the rota',
  'inactive-client': 'The client’s care status changed',
  'over-contract': 'The week’s hours came back under contract',
}

export function countByTab(alerts: LiveAlert[]): Record<AlertTab, number> {
  return {
    all: alerts.length,
    active: alerts.filter((a) => matchesTab(a, 'active')).length,
    incidents: alerts.filter((a) => matchesTab(a, 'incidents')).length,
    emergencies: alerts.filter((a) => matchesTab(a, 'emergencies')).length,
    resolved: alerts.filter((a) => matchesTab(a, 'resolved')).length,
  }
}

export function countByTiming(
  alerts: LiveAlert[],
): Record<AlertTiming, number> {
  const counts: Record<AlertTiming, number> = { changeable: 0, recorded: 0 }
  for (const alert of alerts) counts[alert.timing] += 1
  return counts
}

/* -------------------------------- activity --------------------------------- */

export interface ActivityEntry {
  id: string
  /** The visit this happened to, so the page's filters can cut the feed. */
  visitId: string
  /** "HH:MM", 24-hour. */
  at: string
  label: string
  detail: string
  tone: Tone
  to?: string
}

/**
 * What has already happened today, newest first. Every entry is a visit start
 * or finish that the clock has passed — no event type is invented, and nothing
 * is dated later than the clock the page is showing.
 */
export function activityAt(date = TODAY, now = NOW): ActivityEntry[] {
  const nowMin = minutesOfDay(formatTime(now))
  const out: ActivityEntry[] = []

  for (const visit of liveBoard(date, now)) {
    const to = `/scheduling/visits/${visit.id}/overview`
    const start = minutesOfDay(formatTime(visit.start))
    const end = minutesOfDay(formatTime(visit.end))

    if (start <= nowMin && visit.caregiverId !== null && visit.recorded) {
      // The clock-in the record captured, not the rota time — the visit's own
      // Timeline tab reads 08:58 where this said 09:00.
      const at = visit.clockIn ?? visit.start
      out.push({
        id: `${visit.id}-in`,
        visitId: visit.id,
        at,
        label: visit.clockIn
          ? `${visit.caregiverName} checked in for ${visit.recipientName}`
          : `${visit.recipientName}’s visit was due to start`,
        detail: visit.clockIn
          ? `${visit.type}, ${visit.durationHours}h`
          : `${visit.caregiverName} — a record exists but no clock-in`,
        tone: 'blue',
        to,
      })
    }

    if (start <= nowMin && visit.caregiverId !== null && !visit.recorded) {
      out.push({
        id: `${visit.id}-nocheck`,
        visitId: visit.id,
        at: visit.start,
        label: `${visit.recipientName}’s visit was due to start`,
        detail: `${visit.caregiverName} — no visit record yet`,
        tone: 'red',
        to,
      })
    }

    if (start <= nowMin && visit.caregiverId === null) {
      out.push({
        id: `${visit.id}-unfilled`,
        visitId: visit.id,
        at: visit.start,
        label: `${visit.recipientName}’s visit was due to start`,
        detail: 'Nobody assigned',
        tone: 'red',
        to,
      })
    }

    if (end <= nowMin && !visit.overnight && visit.recorded) {
      // Not "finished": a clock-out is a typed time with nothing behind it, so
      // the honest event is the window closing with a record on file.
      out.push({
        id: `${visit.id}-out`,
        visitId: visit.id,
        at: visit.end,
        label: `${visit.recipientName}’s visit window closed`,
        detail: `${visit.caregiverName} — written up${visit.clockOut ? `, clocked out ${formatTime(visit.clockOut)}` : ', no clock-out entered'}. Nothing confirms the departure.`,
        tone: 'green',
        to,
      })
    }

    if (end <= nowMin && !visit.overnight && visit.caregiverId !== null && !visit.recorded) {
      out.push({
        id: `${visit.id}-lapsed`,
        visitId: visit.id,
        at: visit.end,
        label: `${visit.recipientName}’s visit window closed`,
        detail: `${visit.caregiverName} — nothing written up`,
        tone: 'amber',
        to,
      })
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
}

/* -------------------------------- formatting ------------------------------- */



/** Every quarter hour of the day, for the clock control. */
export function clockSteps(): string[] {
  const out: string[] = []
  for (let m = 0; m < 24 * 60; m += 15) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    )
  }
  return out
}

export function minutesToClock(minutes: number): string {
  const total = Math.min(24 * 60 - 1, Math.max(0, Math.round(minutes)))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export { staffMembers }
