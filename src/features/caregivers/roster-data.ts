import { recipients } from '@/features/care-recipients/data'
import type { CareLevel } from '@/types'
import { getCaregiverRecord } from '@/features/care-recipients/caregivers-data'
import type { TeamMember } from '@/features/care-recipients/caregivers-data'
import { getVisitHistory } from '@/features/care-recipients/visits-data'
import type { VisitRecord } from '@/features/care-recipients/visits-data'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import { TODAY } from '@/lib/today'

export * from './staff'
import {
  RENEWAL_WINDOW_DAYS,
  staffMembers,
  weekdays,
} from './staff'
import type {
  AvailabilityWindow,
  ComplianceState,
  Credential,
  StaffMember,
} from './staff'

export { TODAY }

/* --------------------------------- derived -------------------------------- */

const DAY_MS = 86_400_000

function yearsBetween(iso: string, today = TODAY): number {
  const from = new Date(`${iso}T00:00:00Z`)
  const now = new Date(`${today}T00:00:00Z`)
  let years = now.getUTCFullYear() - from.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - from.getUTCMonth()
  // Borrow a year when the anniversary hasn't come round yet.
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < from.getUTCDate())) {
    years -= 1
  }
  return Math.max(0, years)
}

/** From the date of birth, not stored beside it — the two used to disagree. */
export function age(member: StaffMember, today = TODAY): number {
  return yearsBetween(member.dateOfBirth, today)
}

export function tenureYears(member: StaffMember, today = TODAY): number {
  return yearsBetween(member.hiredAt, today)
}

/** Everything they have done, here and before. */
export function experienceYears(member: StaffMember, today = TODAY): number {
  return tenureYears(member, today) + member.priorExperienceYears
}

/**
 * The address on the record if one is set, otherwise the org convention. The
 * edit form offers to override it, so reading only the convention would have
 * thrown away anything typed there.
 */
export function emailFor(member: StaffMember): string {
  if (member.email?.trim()) return member.email.trim()
  const slug = member.name
    .toLowerCase()
    .replace(/^dr\.?\s+/, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
  return `${slug}@careprofs.com`
}

/* ------------------------------- assignments ------------------------------ */

export interface Assignment {
  recipientId: string
  recipientName: string
  careLevel: CareLevel
  /** The shift pattern recorded on the care team. */
  schedule: string
  /** ISO care start date, or null when the profile has none. */
  sinceIso: string | null
  since: string
  role: string
  primary: boolean
  status: (typeof recipients)[number]['status']
}

const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * Care teams are stored per recipient, so a caregiver has no record of their
 * own caseload. This reads the teams back the other way.
 */
function linksFor(member: StaffMember, coordinating: boolean): Assignment[] {
  const list: Assignment[] = []

  for (const recipient of recipients) {
    const team: TeamMember[] = getCaregiverRecord(recipient.id)?.team ?? []
    const entry = team.find((t) => t.name === member.name)
    if (!entry) continue
    // Coordinating a case is not the same as delivering care on it; counting
    // both as "caseload" gave every coordinator two clients they never visit.
    if ((entry.role === 'Care Coordinator') !== coordinating) continue

    const startedAt = getRecipientProfile(recipient.id)?.summary.startDateIso || null
    list.push({
      recipientId: recipient.id,
      recipientName: recipient.name,
      careLevel: recipient.careLevel,
      schedule: entry.schedule,
      sinceIso: startedAt,
      // The assignment cannot predate the care itself, so it is the care start
      // that is shown — the source design had one beginning in September, two
      // months after the clock this app runs on.
      since: startedAt
        ? monthFormat.format(new Date(`${startedAt}T00:00:00Z`))
        : 'Not recorded',
      role: entry.role,
      primary: Boolean(entry.primary),
      status: recipient.status,
    })
  }

  return list.sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      (a.sinceIso ?? '').localeCompare(b.sinceIso ?? ''),
  )
}

/** Clients this person delivers care to. */
export function assignmentsFor(member: StaffMember): Assignment[] {
  return linksFor(member, false)
}

/** Clients this person coordinates without being on the rota for them. */
export function coordinatingFor(member: StaffMember): Assignment[] {
  return linksFor(member, true)
}

/* --------------------------------- visits --------------------------------- */

export interface StaffVisit extends VisitRecord {
  recipientId: string
  recipientName: string
}

/** Every logged visit this person ran, across all of their recipients. */
export function visitsFor(member: StaffMember): StaffVisit[] {
  return recipients
    .flatMap((recipient) => {
      const history = getVisitHistory(recipient.id)
      if (!history) return []
      return history.visits
        .filter((v) => v.caregiver === member.name)
        .map((v) => ({
          ...v,
          recipientId: recipient.id,
          recipientName: recipient.name,
        }))
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function todaysVisits(member: StaffMember, today = TODAY): StaffVisit[] {
  return visitsFor(member)
    .filter((v) => v.date === today)
    .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))
}

/** "9:00 AM" → minutes past midnight, so a day sorts correctly. */
export function minutesOfDay(time: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  // Sorts to the end rather than silently to 00:00, where it would look like
  // the first appointment of the day.
  if (!match) return Number.POSITIVE_INFINITY
  const [, h, m, meridiem] = match
  const hours = Number(h) % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0)
  return hours * 60 + Number(m)
}

/* ------------------------------- performance ------------------------------ */

export interface Performance {
  /** Visits with a logged outcome; the denominator for every rate below. */
  logged: number
  completed: number
  late: number
  missed: number
  hours: number
  punctuality: number | null
  completionRate: number | null
  rating: number | null
  /** Average of the ratings recorded on the care teams they sit on. */
  ratedOn: number
}

/**
 * Computed from the visit log, not asserted. The source design stated 98%
 * punctuality, 0 missed visits and 42 visits a month with no record behind any
 * of them — and 168 logged hours, which no number of two-hour visits produces.
 */
export function performanceFor(member: StaffMember): Performance {
  const visits = visitsFor(member)
  const logged = visits.length
  const completed = visits.filter((v) => v.status === 'completed').length
  const late = visits.filter((v) => v.status === 'late-arrival').length
  // A cancelled visit is the only non-attended outcome the log records.
  const missed = visits.filter((v) => v.status === 'cancelled').length
  const attended = completed + late

  const ratings = recipients.flatMap((r) => {
    const entry = getCaregiverRecord(r.id)?.team.find((t) => t.name === member.name)
    return entry && entry.rating > 0 ? [entry.rating] : []
  })

  return {
    logged,
    completed,
    late,
    missed,
    // Only attended visits contribute hours; a cancelled one is not time worked.
    hours:
      Math.round(
        visits
          .filter((v) => v.status === 'completed' || v.status === 'late-arrival')
          .reduce((sum, v) => sum + v.durationHours, 0) * 10,
      ) / 10,
    punctuality: attended === 0 ? null : Math.round((completed / attended) * 100),
    completionRate: logged === 0 ? null : Math.round((attended / logged) * 100),
    rating:
      ratings.length === 0
        ? null
        : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
    ratedOn: ratings.length,
  }
}

/* ------------------------------- compliance ------------------------------- */

export interface CredentialState {
  credential: Credential
  state: ComplianceState
  daysRemaining: number | null
}

export function credentialState(
  credential: Credential,
  today = TODAY,
): CredentialState {
  if (!credential.expiresAt) {
    return { credential, state: 'compliant', daysRemaining: null }
  }
  const due = new Date(`${credential.expiresAt}T00:00:00Z`).getTime()
  const now = new Date(`${today}T00:00:00Z`).getTime()
  const days = Math.round((due - now) / DAY_MS)
  return {
    credential,
    state: days < 0 ? 'expired' : days <= RENEWAL_WINDOW_DAYS ? 'expiring' : 'compliant',
    daysRemaining: days,
  }
}

export function credentialStates(
  member: StaffMember,
  today = TODAY,
): CredentialState[] {
  return member.credentials
    .map((c) => credentialState(c, today))
    // MAX_SAFE_INTEGER, not Infinity: two credentials without an expiry would
    // subtract to NaN and leave the order undefined.
    .sort(
      (a, b) =>
        (a.daysRemaining ?? Number.MAX_SAFE_INTEGER) -
        (b.daysRemaining ?? Number.MAX_SAFE_INTEGER),
    )
}

/** The worst state across everything they hold. */
export function complianceFor(
  member: StaffMember,
  today = TODAY,
): ComplianceState {
  const states = credentialStates(member, today).map((c) => c.state)
  if (states.includes('expired')) return 'expired'
  if (states.includes('expiring')) return 'expiring'
  return 'compliant'
}

export function expiredCount(member: StaffMember, today = TODAY): number {
  return credentialStates(member, today).filter((c) => c.state === 'expired').length
}

/* ------------------------------- availability ------------------------------ */

export function availabilityFor(member: StaffMember): (AvailabilityWindow | null)[] {
  return weekdays.map((day) => member.availability.find((w) => w.day === day) ?? null)
}

export function weeklyHours(member: StaffMember): number {
  return member.availability.reduce((sum, w) => {
    const [sh, sm] = w.start.split(':').map(Number)
    const [eh, em] = w.end.split(':').map(Number)
    return sum + (eh * 60 + em - (sh * 60 + sm)) / 60
  }, 0)
}

/* -------------------------------- summaries -------------------------------- */

export interface RosterSummary {
  total: number
  /** Employed, not on leave, and legally rostrable today. */
  active: number
  onLeave: number
  caregivers: number
  complianceIssues: number
  coordinators: number
}

export function rosterSummary(today = TODAY): RosterSummary {
  return {
    total: staffMembers.length,
    // Employed and legally rostrable. Someone whose licence lapsed is active
    // on paper but must not be given a visit, and the profile says so.
    active: staffMembers.filter(
      (s) => s.status === 'active' && complianceFor(s, today) !== 'expired',
    ).length,
    onLeave: staffMembers.filter((s) => s.status === 'on-leave').length,
    caregivers: staffMembers.filter((s) => s.title !== 'Care Coordinator').length,
    complianceIssues: staffMembers.filter((s) => complianceFor(s, today) !== 'compliant')
      .length,
    coordinators: staffMembers.filter((s) => s.title === 'Care Coordinator').length,
  }
}

/* ---------------------------------- sort ---------------------------------- */

export type StaffSort = 'name' | 'caseload' | 'compliance'

export const sortOptions: { value: StaffSort; label: string }[] = [
  { value: 'name', label: 'Name, A to Z' },
  { value: 'caseload', label: 'Largest caseload' },
  { value: 'compliance', label: 'Compliance risk first' },
]

const complianceRank: Record<ComplianceState, number> = {
  expired: 0,
  expiring: 1,
  compliant: 2,
}

export function sortStaff(list: StaffMember[], order: StaffSort): StaffMember[] {
  const sorted = [...list]
  if (order === 'caseload')
    return sorted.sort(
      (a, b) =>
        assignmentsFor(b).length - assignmentsFor(a).length ||
        a.name.localeCompare(b.name),
    )
  if (order === 'compliance')
    return sorted.sort(
      (a, b) =>
        complianceRank[complianceFor(a)] - complianceRank[complianceFor(b)] ||
        a.name.localeCompare(b.name),
    )
  return sorted.sort((a, b) => a.name.localeCompare(b.name))
}

/* -------------------------------- formatting ------------------------------- */

const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? '—' : longDate.format(date)
}

export function formatMonth(iso: string): string {
  if (!iso) return '—'
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? '—' : monthFormat.format(date)
}

/** "07:00" → "7:00 AM", so stored windows and visit times read alike. */
export function formatTime(value: string): string {
  const [h, m] = value.split(':').map(Number)
  const meridiem = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${meridiem}`
}
