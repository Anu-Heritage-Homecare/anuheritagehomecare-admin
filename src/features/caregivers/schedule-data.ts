import { recipients } from '@/features/care-recipients/data'
import { getVisitHistory } from '@/features/care-recipients/visits-data'
import { assignmentsFor, minutesOfDay, visitsFor } from './roster-data'
import { staffMembers, weekdays } from './staff'
import type { AvailabilityWindow, StaffMember, Weekday } from './staff'
import { NOW, TODAY } from '@/lib/today'
import type { VisitStatus } from '@/types'
import { visitMove, visitMoves } from '@/features/scheduling/visit-writes'

export { NOW, TODAY, weekdays }

/* ---------------------------------- types --------------------------------- */

/** A recurring slot on someone's rota, before it is placed on a date. */
export interface RotaSlot {
  id: string
  recipientId: string
  days: Weekday[]
  /** 24-hour, "08:00". */
  start: string
  durationHours: number
  type: string
}

export interface ScheduledVisit {
  id: string
  /** ISO date. */
  date: string
  day: Weekday
  start: string
  end: string
  durationHours: number
  recipientId: string
  recipientName: string
  type: string
  status: VisitStatus
  /** True when the slot falls outside the availability set on the profile. */
  outsideAvailability: boolean
  /** Whether the visit log actually has an entry for this slot. */
  logged: boolean
  /**
   * 24-hour clock-in from the visit log, where one was captured. Distinct from
   * `start`, which is the *scheduled* time — a caregiver who arrived at 08:58
   * for a 09:00 slot has both, and showing the slot time as a check-in was
   * reporting the rota back as if it were evidence of attendance.
   */
  clockIn: string | null
  /**
   * 24-hour clock-out from the visit log. Like `clockIn`, a time somebody
   * entered on a record — not a confirmed departure. Dropping it while keeping
   * `clockIn` let the visit screen claim the app captures no checkout at all,
   * while the recipient's own Visits tab printed one.
   */
  clockOut: string | null
  /** Set when the visit is in the log but not on any recurring slot. */
  offRota?: boolean
  /**
   * The id this visit takes on the org board. A reassigned visit keeps its
   * original board id here so the board and Visit Details still find it after
   * it changes hands; a normal visit leaves it unset and is namespaced there.
   */
  boardId?: string
  /** True when the shift runs past midnight; clock times then wrap. */
  overnight: boolean
}

/* ---------------------------------- rota ---------------------------------- */

/*
 * A structured rota, not the prose "Mon–Sat mornings" string on the care team.
 * The calendar, the hours total, the visit count and the upcoming list are all
 * read off this one array, so they cannot disagree — the source design stated
 * 38 hours and 22 visits above a grid containing 32 hours and 16.
 */
const rotas: Record<string, RotaSlot[]> = {
  'cg-001': [
    {
      id: 'r1',
      recipientId: 'cr-001',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      start: '08:00',
      durationHours: 2,
      type: 'Morning Care',
    },
    {
      id: 'r2',
      recipientId: 'cr-001',
      // Monday only: the care team records "Mon–Sat mornings, Mon afternoons",
      // and the shift grid gives Wednesday and Friday afternoons to David Park
      // and Emma Wilson.
      days: ['Mon'],
      start: '14:00',
      durationHours: 3,
      type: 'Afternoon Care',
    },
  ],
  'cg-002': [
    {
      id: 'r1',
      recipientId: 'cr-002',
      days: ['Tue', 'Wed', 'Thu'],
      start: '13:00',
      durationHours: 2.5,
      type: 'Medication',
    },
    {
      id: 'r2',
      recipientId: 'cr-001',
      // "Thu & weekend evenings" on the care team record.
      days: ['Thu', 'Sat', 'Sun'],
      start: '16:00',
      durationHours: 2,
      type: 'Evening Care',
    },
  ],
  'cg-003': [
    {
      id: 'r1',
      recipientId: 'cr-007',
      days: ['Fri', 'Sun'],
      start: '13:00',
      durationHours: 2,
      type: 'Clinical Assessment',
    },
  ],
  'cg-004': [
    {
      id: 'r1',
      recipientId: 'cr-003',
      days: ['Mon', 'Tue', 'Wed', 'Fri'],
      start: '17:00',
      durationHours: 1.5,
      type: 'Evening Routine',
    },
  ],
  'cg-005': [
    {
      id: 'r1',
      recipientId: 'cr-005',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      start: '09:00',
      durationHours: 2,
      type: 'Morning Care',
    },
  ],
  'cg-006': [
    {
      id: 'r1',
      recipientId: 'cr-006',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      start: '08:00',
      durationHours: 10,
      type: 'Live-in Care',
    },
  ],
}

export function rotaFor(member: StaffMember): RotaSlot[] {
  return rotas[member.id] ?? []
}

/* --------------------------------- calendar -------------------------------- */

const DAY_MS = 86_400_000

/**
 * Monday of the week containing `iso`. The grid is Monday-first.
 *
 * A well-formed but impossible date — "2026-02-31" — used to produce an Invalid
 * Date and throw out of `toISOString`, taking the whole tab to the error
 * boundary.
 */
export function weekStart(iso = TODAY): string {
  const parsed = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed)) return weekStart(TODAY)
  const date = new Date(parsed)
  // getUTCDay is Sunday-first; shift so Monday is 0.
  const offset = (date.getUTCDay() + 6) % 7
  return new Date(date.getTime() - offset * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  // "2026-13-01" matches the ISO shape and parses to Invalid Date, and
  // `toISOString` throws on it — which took the whole page to the error
  // boundary rather than falling back.
  const parsed = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed)) return TODAY
  return new Date(parsed + days * DAY_MS).toISOString().slice(0, 10)
}

export function weekDates(start: string): string[] {
  return weekdays.map((_, i) => addDays(start, i))
}

export function dayOf(iso: string): Weekday {
  return weekdays[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]
}

/** Returns the clock time and whether it ran past midnight. */
function addHours(start: string, hours: number): { end: string; overnight: boolean } {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + Math.round(hours * 60)
  return {
    end: `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
    overnight: total >= 24 * 60,
  }
}

/** "9:00 AM" → "09:00", so a logged visit and a rota slot share a clock. */
function to24Hour(time: string): string {
  const minutes = minutesOfDay(time)
  if (!Number.isFinite(minutes)) return '00:00'
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Whether a slot sits inside a window the caregiver is actually available in. */
function withinAvailability(
  availability: AvailabilityWindow[],
  day: Weekday,
  start: string,
  end: string,
  overnight: boolean,
): boolean {
  const window = availability.find((w) => w.day === day)
  if (!window) return false
  // A shift that runs past midnight cannot fit inside a same-day window, and
  // comparing the wrapped end time as a string silently said it did.
  if (overnight) return false
  return start >= window.start && end <= window.end
}

/**
 * Only the future is a claim the rota is entitled to make. A past slot with no
 * entry in the visit log is *not* completed — it is unrecorded, and saying
 * otherwise invented five completed visits a week that the recipient's own
 * Visits tab had never heard of.
 */

/**
 * How far ahead a visit reads as "Starting soon" on every board. Exported so
 * the reminder lead time on Schedule Settings can be checked against it — two
 * different windows would mean the badge and the reminder disagreed.
 */
export const STARTING_SOON_MINUTES = 60

function statusFor(
  date: string,
  today: string,
  start: string,
  end: string,
  now = NOW,
  overnight = false,
): VisitStatus {
  if (date > today) return 'upcoming'
  if (date < today) return 'unassigned'
  // Today, so the time of day decides. Everything on the day used to read
  // "starting soon", including a live-in block that runs until six.
  // A shift past midnight cannot have finished today, whatever the clock says.
  if (!overnight && end <= now) return 'completed'
  if (start <= now) return 'in-progress'
  return start <= addMinutes(now, STARTING_SOON_MINUTES) ? 'starting-soon' : 'upcoming'
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function scheduleFor(
  member: StaffMember,
  start: string,
  today = TODAY,
): ScheduledVisit[] {
  const rota = rotaFor(member)
  const logged = visitsFor(member)
  const visits: ScheduledVisit[] = []

  for (const date of weekDates(start)) {
    const day = dayOf(date)

    /*
     * Date-major, and each logged visit is consumed at most once. Matching on
     * date and recipient alone paired both of a day's two slots with the same
     * log entry, so an afternoon shift inherited the morning visit's type.
     */
    const pool = logged
      .filter((v) => v.date === date)
      .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))
    const used = new Set<string>()

    const slots = rota
      .filter((slot) => slot.days.includes(day))
      .sort((a, b) => a.start.localeCompare(b.start))

    for (const slot of slots) {
      const recipient = recipients.find((r) => r.id === slot.recipientId)
      if (!recipient) continue

      /*
       * Nearest start time, not first-unused: a logged afternoon visit on a day
       * whose morning slot went unrecorded used to be attached to the morning.
       */
      const slotStart = minutesOfDay(formatTime(slot.start))
      const actual = pool
        .filter((v) => v.recipientId === slot.recipientId && !used.has(v.id))
        .sort(
          (a, b) =>
            Math.abs(minutesOfDay(a.time) - slotStart) -
            Math.abs(minutesOfDay(b.time) - slotStart),
        )[0]
      if (actual) used.add(actual.id)

      // Where the log has the visit, the log owns the clock as well as the
      // duration — taking one from each made the calendar's spans disagree
      // with the hours total above them.
      const begin = actual ? to24Hour(actual.time) : slot.start
      const hours = actual?.durationHours ?? slot.durationHours
      const { end, overnight } = addHours(begin, hours)
      const clockIn = actual?.clockIn ? to24Hour(actual.clockIn) : null
      const clockOut = actual?.clockOut ? to24Hour(actual.clockOut) : null

      visits.push({
        id: `${slot.id}-${date}`,
        date,
        day,
        start: begin,
        end,
        durationHours: hours,
        recipientId: slot.recipientId,
        recipientName: recipient.name,
        type: actual?.type ?? slot.type,
        status: actual?.status ?? statusFor(date, today, begin, end, NOW, overnight),
        logged: Boolean(actual),
        clockIn,
        clockOut,
        overnight,
        outsideAvailability: !withinAvailability(
          member.availability,
          day,
          begin,
          end,
          overnight,
        ),
      })
    }

    // Anything left in the log ran without a recurring slot behind it. Dropping
    // it hid real visits that the recipient's own Visits tab still showed.
    for (const extra of pool) {
      if (used.has(extra.id)) continue
      const begin = to24Hour(extra.time)
      const { end, overnight } = addHours(begin, extra.durationHours)
      visits.push({
        // Date-suffixed like the rota slots. Without it a board id carried no
        // date, and the Visit Details lookup — which reads the date out of the
        // id — could not find these at all.
        id: `off-${extra.id}-${date}`,
        date,
        day,
        start: begin,
        end,
        durationHours: extra.durationHours,
        recipientId: extra.recipientId,
        recipientName: extra.recipientName,
        type: extra.type,
        status: extra.status,
        logged: true,
        clockIn: extra.clockIn ? to24Hour(extra.clockIn) : null,
        clockOut: extra.clockOut ? to24Hour(extra.clockOut) : null,
        offRota: true,
        overnight,
        outsideAvailability: !withinAvailability(
          member.availability,
          day,
          begin,
          end,
          overnight,
        ),
      })
    }
  }

  // A reassignment shows on both sides at once: the losing caregiver drops the
  // visit, the gaining one picks it up from the move's snapshot.
  const mine = visits.filter((v) => !visitMove(`${member.id}-${v.id}`))

  for (const { visitId, move } of visitMoves()) {
    if (move.toCaregiverId !== member.id) continue
    if (!weekDates(start).includes(move.date)) continue
    const { end, overnight } = addHours(move.start, move.durationHours)
    const day = dayOf(move.date)
    mine.push({
      id: `moved-${visitId}`,
      boardId: visitId,
      date: move.date,
      day,
      start: move.start,
      end,
      durationHours: move.durationHours,
      recipientId: move.recipientId,
      recipientName: move.recipientName,
      type: move.type,
      status: statusFor(move.date, today, move.start, end, NOW, overnight),
      logged: false,
      clockIn: null,
      clockOut: null,
      overnight,
      outsideAvailability: !withinAvailability(
        member.availability,
        day,
        move.start,
        end,
        overnight,
      ),
    })
  }

  return mine.sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  )
}

export function visitsOn(visits: ScheduledVisit[], date: string): ScheduledVisit[] {
  return visits.filter((v) => v.date === date)
}

/* ---------------------------------- totals --------------------------------- */

export interface WeekSummary {
  hours: number
  visits: number
  target: number
  /** Share of the contracted maximum. Can exceed 100. */
  loadPercent: number
  clients: number
  outsideAvailability: number
  /** Logged visits with no recurring slot behind them. */
  offRota: number
  /** Past slots the visit log has no entry for. */
  unlogged: number
}

export function weekSummary(
  member: StaffMember,
  visits: ScheduledVisit[],
): WeekSummary {
  const hours =
    Math.round(visits.reduce((sum, v) => sum + v.durationHours, 0) * 10) / 10
  const target = member.maxHoursPerWeek

  return {
    hours,
    visits: visits.length,
    target,
    loadPercent: target > 0 ? Math.round((hours / target) * 100) : 0,
    clients: new Set(visits.map((v) => v.recipientId)).size,
    outsideAvailability: visits.filter((v) => v.outsideAvailability).length,
    offRota: visits.filter((v) => v.offRota).length,
    unlogged: visits.filter(
      (v) => !v.logged && v.status === 'unassigned' && v.date < TODAY,
    ).length,
  }
}

/** The next rostered visits after today, across as many weeks as needed. */
export function upcomingVisits(
  member: StaffMember,
  count = 5,
  today = TODAY,
): ScheduledVisit[] {
  const found: ScheduledVisit[] = []
  let start = weekStart(today)

  // Eight weeks: a one-slot-a-week rota needs more than four to fill five.
  for (let week = 0; week < 8 && found.length < count; week += 1) {
    found.push(
      ...scheduleFor(member, start, today).filter(
        // With a clock, "upcoming" includes the rest of today — the board
        // showed a 1 PM visit that this list called nothing at all.
        (v) => v.date > today || (v.date === today && v.start > NOW),
      ),
    )
    start = addDays(start, 7)
  }

  return found.slice(0, count)
}

/* ------------------------------- availability ------------------------------ */

/**
 * "Mon–Fri, 7:00 AM – 6:00 PM" only when every one of those days really shares
 * that window. The source design summarised Mon–Sat as one window when
 * Saturday was six hours shorter.
 */
export function availabilitySummary(member: StaffMember): {
  label: string
  detail: string
} {
  const set = member.availability
  if (set.length === 0) {
    return { label: 'None set', detail: 'Cannot be rostered' }
  }

  const groups = new Map<string, Weekday[]>()
  for (const day of weekdays) {
    const window = set.find((w) => w.day === day)
    if (!window) continue
    const key = `${window.start}-${window.end}`
    groups.set(key, [...(groups.get(key) ?? []), day])
  }

  const parts = [...groups.entries()].map(([key, days]) => {
    const [start, end] = key.split('-')
    return { days, start, end }
  })

  const span = (days: Weekday[]) =>
    days.length > 2 &&
    weekdays.indexOf(days.at(-1)!) - weekdays.indexOf(days[0]) === days.length - 1
      ? `${days[0]}–${days.at(-1)}`
      : days.join(', ')

  return {
    label: parts.map((p) => span(p.days)).join(' · '),
    detail: parts
      .map((p) => `${span(p.days)} ${formatTime(p.start)}–${formatTime(p.end)}`)
      .join(' · '),
  }
}

export function formatTime(value: string): string {
  const [h, m] = value.split(':').map(Number)
  const meridiem = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${meridiem}`
}

const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const rangeLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDay(iso: string): string {
  return dayLabel.format(new Date(`${iso}T00:00:00Z`))
}

export function formatWeekRange(start: string): string {
  const end = addDays(start, 6)
  return `${rangeLabel.format(new Date(`${start}T00:00:00Z`))} – ${rangeLabel.format(
    new Date(`${end}T00:00:00Z`),
  )}`
}

/* -------------------------------- coverage -------------------------------- */

/** Assignments with no rota slot: someone is on the team but never rostered. */
export function unrosteredAssignments(member: StaffMember): string[] {
  const rostered = new Set(rotaFor(member).map((s) => s.recipientId))
  return assignmentsFor(member)
    .filter((a) => !rostered.has(a.recipientId))
    .map((a) => a.recipientName)
}

/** Caregivers with a caseload but nothing on the rota at all. */
export function unrosteredStaff(): StaffMember[] {
  return staffMembers.filter(
    (s) => assignmentsFor(s).length > 0 && rotaFor(s).length === 0,
  )
}

export { getVisitHistory }
