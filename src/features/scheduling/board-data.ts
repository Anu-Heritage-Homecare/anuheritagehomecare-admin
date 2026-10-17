import { recipients } from '@/features/care-recipients/data'
import type { Recipient } from '@/features/care-recipients/data'
import {
  complianceFor,
  minutesOfDay,
  staffMembers,
  weeklyHours,
} from '@/features/caregivers/roster-data'
import type { StaffMember } from '@/features/caregivers/roster-data'
import {
  addDays,
  dayOf,
  formatTime,
  formatWeekRange,
  scheduleFor,
  weekStart,
  weekSummary,
} from '@/features/caregivers/schedule-data'
import type { ScheduledVisit } from '@/features/caregivers/schedule-data'
import type { Weekday } from '@/features/caregivers/staff'
import { NOW, TODAY } from '@/lib/today'
import type { Priority, Tone, VisitStatus } from '@/types'

export { NOW, TODAY, addDays, dayOf, formatTime, formatWeekRange, weekStart }

/* ---------------------------------- types --------------------------------- */

export interface BoardVisit extends ScheduledVisit {
  caregiverId: string | null
  caregiverName: string | null
  /** From the recipient's own record, not typed per visit. */
  priority: Priority
  recipientStatus: Recipient['status']
}

export interface UnassignedSlot {
  id: string
  /** ISO. */
  date: string
  start: string
  durationHours: number
  recipientId: string
  type: string
  reason: string
}

/* --------------------------------- unassigned ------------------------------ */

/*
 * Visits nobody is on yet. Two are for recipients with no caregiver in the
 * directory at all, which is why they have never made it onto a rota.
 */
const unassigned: UnassignedSlot[] = [
  {
    id: 'un-1',
    date: TODAY,
    start: '11:00',
    durationHours: 1.5,
    recipientId: 'cr-004',
    type: 'Wound Care',
    reason: 'No caregiver assigned in the directory',
  },
  {
    id: 'un-2',
    date: TODAY,
    start: '15:00',
    durationHours: 1,
    recipientId: 'cr-003',
    type: 'Medication',
    reason: 'Additional visit requested by the family',
  },
  {
    id: 'un-3',
    date: TODAY,
    start: '16:30',
    durationHours: 2,
    recipientId: 'cr-008',
    type: 'Onboarding visit',
    reason: 'Care has not started; no caregiver assigned',
  },
  {
    id: 'un-4',
    date: addDays(TODAY, 1),
    start: '09:00',
    durationHours: 2,
    recipientId: 'cr-004',
    type: 'Morning Care',
    reason: 'No caregiver assigned in the directory',
  },
]

function endOf(start: string, hours: number): string {
  const total = minutesOfDay(formatTime(start)) + Math.round(hours * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function unassignedOn(date: string): BoardVisit[] {
  return unassigned
    .filter((slot) => slot.date === date)
    .map((slot) => {
      const recipient = recipients.find((r) => r.id === slot.recipientId)!
      return {
        id: slot.id,
        date: slot.date,
        day: dayOf(slot.date),
        start: slot.start,
        end: endOf(slot.start, slot.durationHours),
        durationHours: slot.durationHours,
        recipientId: slot.recipientId,
        recipientName: recipient.name,
        type: slot.type,
        status: 'unassigned' as VisitStatus,
        outsideAvailability: false,
        logged: false,
        clockIn: null,
        clockOut: null,
        overnight: false,
        caregiverId: null,
        caregiverName: null,
        priority: recipient.priority,
        recipientStatus: recipient.status,
      }
    })
}

let newVisitSeq = 0

/**
 * A visit scheduled from the Schedule Visit page. It joins the unassigned
 * pool, so the existing Assign Caregiver flow — with its eligibility checks —
 * is how it gets a caregiver. Held in memory for the session.
 */
export function addUnassignedVisit(slot: Omit<UnassignedSlot, 'id'>): string {
  newVisitSeq += 1
  const id = `un-new-${newVisitSeq}`
  unassigned.push({ ...slot, id })
  // That day's board was memoised without it.
  boardCache.delete(slot.date)
  return id
}

export function unassignedReason(id: string): string {
  return unassigned.find((s) => s.id === id)?.reason ?? ''
}

/** Every date that currently carries an unassigned slot. */
export function unassignedDates(): string[] {
  return [...new Set(unassigned.map((s) => s.date))].sort()
}

export function allUnassigned(): BoardVisit[] {
  return unassignedDates().flatMap((date) => unassignedOn(date))
}

/* ----------------------------------- board --------------------------------- */

/**
 * Every caregiver's rota for one day, in one list. The per-person Schedule tab
 * and this board read the same projection, so a visit cannot appear on one and
 * not the other.
 */
const boardCache = new Map<string, BoardVisit[]>()

/** Memoised: the fixture is static, and the week view asks fourteen times. */
export function boardOn(date: string): BoardVisit[] {
  const cached = boardCache.get(date)
  if (cached) return cached
  const built = buildBoard(date)
  boardCache.set(date, built)
  return built
}

function buildBoard(date: string): BoardVisit[] {
  const start = weekStart(date)

  const assigned = staffMembers.flatMap((member) =>
    scheduleFor(member, start)
      .filter((visit) => visit.date === date)
      .flatMap((visit) => {
        const recipient = recipients.find((r) => r.id === visit.recipientId)
        if (!recipient) return []
        return [
          {
            ...visit,
            // Namespaced: every rota restarts its slot ids at "r1", so five
            // caregivers produced five rows sharing one React key — and two
            // conflicts sharing one id, of which only the last survived.
            id: `${member.id}-${visit.id}`,
            caregiverId: member.id,
            caregiverName: member.name,
            priority: recipient.priority,
            recipientStatus: recipient.status,
          },
        ]
      }),
  )

  return [...assigned, ...unassignedOn(date)].sort(
    (a, b) => a.start.localeCompare(b.start) || a.recipientName.localeCompare(b.recipientName),
  )
}

/* --------------------------------- conflicts ------------------------------- */

export type ConflictKind =
  | 'overlap'
  | 'outside-availability'
  | 'inactive-recipient'
  | 'lapsed-credential'
  | 'over-contract'

export interface Conflict {
  id: string
  kind: ConflictKind
  label: string
  detail: string
  caregiverId?: string
  recipientId?: string
  /** True when the fact is about the whole week, not this day. */
  weekScoped?: boolean
}

export const conflictLabels: Record<ConflictKind, string> = {
  overlap: 'Double booking',
  'outside-availability': 'Outside availability',
  'inactive-recipient': 'Client not active',
  'lapsed-credential': 'Lapsed credential',
  'over-contract': 'Over contracted hours',
}

export const conflictTones: Record<ConflictKind, Tone> = {
  overlap: 'red',
  'outside-availability': 'amber',
  'inactive-recipient': 'amber',
  'lapsed-credential': 'red',
  'over-contract': 'amber',
}

function overlaps(a: BoardVisit, b: BoardVisit): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * The whole point of an org-wide board: every one of these is a fact two other
 * screens each hold half of. A caregiver's own tab knows a shift sits outside
 * their availability; the Documents tab knows a credential has lapsed. Only
 * here do they meet the day's rota.
 */
export function conflictsOn(date: string, today = TODAY): Conflict[] {
  const visits = boardOn(date)
  const list: Conflict[] = []
  // A credential lapses on a date, so a future roster has to be judged on that
  // date — measuring at today said a certificate expiring in August was fine
  // for a visit in September.
  const asAt = date > today ? date : today

  for (const member of staffMembers) {
    const mine = visits
      .filter((v) => v.caregiverId === member.id)
      .sort((a, b) => a.start.localeCompare(b.start))
    if (mine.length === 0) continue

    /*
     * Every pair, not just adjacent ones. A ten-hour live-in block with two
     * short visits inside it reported the first clash and missed the second,
     * so the conflict count was systematically low.
     */
    for (let i = 0; i < mine.length - 1; i += 1) {
      for (let j = i + 1; j < mine.length && mine[j].start < mine[i].end; j += 1) {
        if (!overlaps(mine[i], mine[j])) continue
        list.push({
          id: `overlap-${mine[i].id}-${mine[j].id}`,
          kind: 'overlap',
          label: `${member.name} is booked twice`,
          detail: `${mine[i].recipientName} ${formatTime(mine[i].start)}–${formatTime(mine[i].end)} overlaps ${mine[j].recipientName} ${formatTime(mine[j].start)}–${formatTime(mine[j].end)}.`,
          caregiverId: member.id,
        })
      }
    }

    for (const visit of mine.filter((v) => v.outsideAvailability)) {
      list.push({
        id: `availability-${visit.id}`,
        kind: 'outside-availability',
        label: `${member.name} is rostered outside their availability`,
        detail: `${visit.recipientName} at ${formatTime(visit.start)} falls outside the ${visit.day} window on their profile.`,
        caregiverId: member.id,
      })
    }

    if (complianceFor(member, asAt) === 'expired') {
      list.push({
        id: `credential-${member.id}-${date}`,
        kind: 'lapsed-credential',
        label: `${member.name} has a lapsed credential`,
        detail: `Rostered for ${mine.length} visit${mine.length === 1 ? '' : 's'} while a credential is out of date.`,
        caregiverId: member.id,
      })
    }

    const week = weekSummary(member, scheduleFor(member, weekStart(date)))
    if (week.hours > member.maxHoursPerWeek) {
      list.push({
        id: `hours-${member.id}-${weekStart(date)}`,
        kind: 'over-contract',
        label: `${member.name} is over their contracted week`,
        // Named as a week fact: it is flagged on every day of that week, and
        // without the range it read as a problem with this one day.
        detail: `${week.hours}h rostered in the week of ${formatWeekRange(weekStart(date))} against a ${member.maxHoursPerWeek}h contract.`,
        caregiverId: member.id,
        weekScoped: true,
      })
    }
  }

  const statusPhrase: Record<Recipient['status'], string> = {
    active: 'receiving care',
    'on-hold': 'on hold',
    new: 'not started care yet',
    discharged: 'been discharged',
  }

  for (const visit of visits) {
    if (visit.recipientStatus === 'active') continue
    list.push({
      id: `inactive-${visit.id}`,
      kind: 'inactive-recipient',
      label: `${visit.recipientName} has ${statusPhrase[visit.recipientStatus]}`,
      detail: `${visit.type} is on the board at ${formatTime(visit.start)} for a client who is not receiving care.`,
      recipientId: visit.recipientId,
    })
  }

  return list
}

/* ----------------------------------- stats --------------------------------- */

export interface DayStats {
  total: number
  completed: number
  inProgress: number
  upcoming: number
  /** No caregiver on the visit at all. */
  unassigned: number
  /** Assigned, in the past, and never written up. */
  unlogged: number
  conflicts: number
  availableCaregivers: number
  onDuty: number
}

/**
 * A visit with a caregiver whose window has closed and which the visit log
 * never recorded.
 *
 * Judged on the clock, not on the derived status. `statusFor` only yields
 * "unassigned" for dates before today, so keying off it made this structurally
 * false for *today* — the board's own "Not written up" tile sat at 0 while Live
 * Monitoring raised an alert about the very same visit.
 */
export function isUnlogged(visit: BoardVisit, today = TODAY, now = NOW): boolean {
  if (visit.caregiverId === null || visit.logged) return false
  if (visit.date !== today) return visit.date < today
  // An overnight block has not closed just because the clock reads earlier
  // than its end.
  return !visit.overnight && visit.end <= now
}

/** Active, compliant, and with a window on this weekday. */
export function availableCaregivers(date: string, today = TODAY): StaffMember[] {
  const day: Weekday = dayOf(date)
  const asAt = date > today ? date : today
  return staffMembers.filter(
    (member) =>
      // Coordinators hold cases but are never on the rota; counting them made
      // this disagree with the roster's own caregiver total.
      member.title !== 'Care Coordinator' &&
      member.status === 'active' &&
      complianceFor(member, asAt) !== 'expired' &&
      member.availability.some((w) => w.day === day),
  )
}

export function dayStats(date: string, today = TODAY): DayStats {
  const visits = boardOn(date)
  return {
    total: visits.length,
    completed: visits.filter((v) => v.status === 'completed').length,
    inProgress: visits.filter((v) => v.status === 'in-progress').length,
    upcoming: visits.filter(
      (v) => v.status === 'upcoming' || v.status === 'starting-soon',
    ).length,
    unassigned: visits.filter((v) => v.caregiverId === null).length,
    unlogged: visits.filter((v) => isUnlogged(v, today)).length,
    conflicts: conflictsOn(date, today).length,
    availableCaregivers: availableCaregivers(date, today).length,
    onDuty: new Set(
      visits.filter((v) => v.caregiverId).map((v) => v.caregiverId),
    ).size,
  }
}

/* -------------------------------- formatting ------------------------------- */

const dayLabel = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Weekday and month come from the date, so neither can be typed wrong. */
export function formatFullDay(iso: string): string {
  return dayLabel.format(new Date(`${iso}T00:00:00Z`))
}

export { staffMembers, weeklyHours }
