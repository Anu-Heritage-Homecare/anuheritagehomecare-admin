import { coordinatorFor, recipients } from './data'
import { staffByName, staffMembers } from '@/features/caregivers/staff'
import type { StaffMember } from '@/features/caregivers/staff'
import { SIGNED_IN } from '@/lib/session'
import { TODAY } from '@/lib/today'

/* ---------------------------------- types --------------------------------- */

export type CaregiverStatus = 'active' | 'available' | 'off-duty'

export type CaregiverRole =
  | 'Primary Caregiver'
  | 'Backup Caregiver'
  | 'Clinical Nurse'
  | 'Relief Caregiver'
  | 'Care Coordinator'

export interface TeamMember {
  id: string
  name: string
  role: CaregiverRole
  status: CaregiverStatus
  specialization: string
  schedule: string
  /** Actually logged, not scheduled — the grid shows responsibility. */
  hoursThisMonth: string
  rating: number
  certifications: string[]
  /** The one carrying day-to-day delivery; highlighted in the list. */
  primary?: boolean
}

/** Who holds a shift block. `open` means nobody is assigned. */
export type SlotOwner = 'primary' | 'backup' | 'nurse' | 'relief' | 'open'

export interface ShiftRow {
  id: string
  label: string
  hours: string
  /** One entry per day, Monday-first. */
  days: SlotOwner[]
}

export type HistoryAction = 'assigned' | 'removed'

export interface AssignmentEntry {
  id: string
  /** ISO, for machine use. `date` is the display label. */
  dateIso: string
  date: string
  action: HistoryAction
  caregiver: string
  reason: string
  by: string
}

export interface CaregiverRecord {
  team: TeamMember[]
  weekdays: string[]
  shifts: ShiftRow[]
  history: AssignmentEntry[]
  /** Month-over-month change in logged hours. */
  hoursDelta: string
}

export const slotLabels: Record<SlotOwner, string> = {
  primary: 'Sarah Williams',
  backup: 'David Park',
  nurse: 'Emma Wilson',
  relief: 'Maria Garcia',
  open: 'Open / Unassigned',
}

/* ---------------------------------- data ---------------------------------- */

const records: Record<string, CaregiverRecord> = {
  'cr-001': {
    team: [
      {
        id: 'tm1',
        name: 'Sarah Williams',
        role: 'Primary Caregiver',
        status: 'active',
        specialization: "Alzheimer's Care, Personal Hygiene",
        schedule: 'Mon–Sat mornings, Mon afternoons',
        hoursThisMonth: '26h',
        rating: 4.9,
        certifications: ['CNA', "Alzheimer's Certified", 'CPR'],
        primary: true,
      },
      {
        id: 'tm2',
        name: 'David Park',
        role: 'Backup Caregiver',
        status: 'available',
        specialization: 'Wound Care, Mobility Support',
        schedule: 'Tue–Thu afternoons, Thu & weekend evenings',
        hoursThisMonth: '14h',
        rating: 4.7,
        certifications: ['CNA', 'Wound Care Specialist'],
      },
      {
        id: 'tm3',
        name: 'Emma Wilson',
        role: 'Clinical Nurse',
        status: 'active',
        specialization: 'Clinical Assessment, Wound Care',
        schedule: 'Fri & Sun afternoons',
        hoursThisMonth: '12h',
        rating: 4.8,
        certifications: ['RN', 'Wound Care Specialist'],
      },
      {
        id: 'tm4',
        name: 'Maria Garcia',
        role: 'Relief Caregiver',
        status: 'available',
        specialization: 'Medication Review, Evening Routine',
        schedule: 'Mon–Wed & Fri evenings',
        hoursThisMonth: '6h',
        rating: 4.6,
        certifications: ['CNA', 'CPR', 'Medication Administration'],
      },
      {
        id: 'tm5',
        name: 'Mike Chen',
        role: 'Care Coordinator',
        status: 'active',
        specialization: 'Care Planning, Family Relations',
        schedule: 'Mon–Fri, 9AM–6PM',
        hoursThisMonth: '4h',
        rating: 4.8,
        certifications: ['RN', 'Care Management'],
      },
    ],
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    /*
     * Derived from the visit log rather than invented: every observed visit in
     * visits-data falls into the block its caregiver holds here. Three blocks,
     * not two, because the care plan schedules a daily 8:00 PM dose. The
     * afternoon block runs to 6 so the 5:00 PM Metformin dose sits with Sarah,
     * as the Medications tab states.
     */
    shifts: [
      {
        id: 'morning',
        label: 'Morning',
        hours: '8–12',
        days: [
          'primary',
          'primary',
          'primary',
          'primary',
          'primary',
          'primary',
          'open',
        ],
      },
      {
        id: 'afternoon',
        label: 'Afternoon',
        hours: '12–6',
        days: [
          'primary',
          'backup',
          'backup',
          'backup',
          'nurse',
          'open',
          'nurse',
        ],
      },
      {
        id: 'evening',
        label: 'Evening',
        hours: '6–9',
        days: [
          'relief',
          'relief',
          'relief',
          'backup',
          'relief',
          'backup',
          'backup',
        ],
      },
    ],
    // Reverse-chronological. Every assignment predates that person's earliest
    // visit in visits-data and earliest event in health-data.
    history: [
      {
        id: 'ah1',
        dateIso: '2026-07-01',
        date: 'Jul 1, 2026',
        action: 'assigned',
        caregiver: 'Maria Garcia',
        reason: 'Evening medication cover added for the new Memantine dose',
        by: 'Mike Chen',
      },
      {
        id: 'ah2',
        dateIso: '2026-06-15',
        date: 'Jun 15, 2026',
        action: 'removed',
        caregiver: 'Jennifer Lee',
        reason: 'Relocated out of coverage sector',
        by: 'Admin Support',
      },
      {
        id: 'ah3',
        dateIso: '2026-06-10',
        date: 'Jun 10, 2026',
        action: 'assigned',
        caregiver: 'David Park',
        reason: 'Weekend and evening backup support for mobility assist',
        by: 'Mike Chen',
      },
      {
        id: 'ah4',
        dateIso: '2026-05-10',
        date: 'May 10, 2026',
        action: 'assigned',
        caregiver: 'Emma Wilson',
        reason: 'Clinical nurse cover for post-surgical wound care',
        by: 'Mike Chen',
      },
      {
        id: 'ah5',
        dateIso: '2026-03-20',
        date: 'Mar 20, 2026',
        action: 'assigned',
        caregiver: 'Jennifer Lee',
        reason: 'Weekend rotation cover',
        by: 'Mike Chen',
      },
      {
        id: 'ah6',
        dateIso: '2026-03-15',
        date: 'Mar 15, 2026',
        action: 'assigned',
        caregiver: 'Sarah Williams',
        reason: 'Primary caregiver assignment for full-time care plan',
        by: 'Mike Chen',
      },
      {
        id: 'ah7',
        dateIso: '2026-03-04',
        date: 'Mar 4, 2026',
        action: 'assigned',
        caregiver: 'Mike Chen',
        reason: 'Appointed as the Care Coordinator',
        by: 'Admin Support',
      },
    ],
    hoursDelta: '↑ 4h since last month',
  },
}

/**
 * Recipients without an authored record still have a named caregiver in the
 * directory, so build a minimal team rather than claiming nobody is assigned —
 * the Overview tab would contradict it.
 */
/*
 * Everything a synthesised team asserts about a person now comes from their
 * staff record: the source used to hard-code "active" and a Mon–Fri pattern,
 * so a coordinator on leave with no availability appeared on two care teams as
 * actively rostered, and claimed certifications her own documents did not list.
 */
function teamMember(
  id: string,
  name: string,
  role: CaregiverRole,
  primary: boolean,
): TeamMember {
  const record = staffByName(name)
  const shifts = record?.availability ?? []
  return {
    id,
    name,
    role,
    status: record?.status === 'active' ? 'active' : 'off-duty',
    specialization: record ? record.skills.slice(0, 2).join(', ') : 'Not recorded',
    schedule:
      shifts.length === 0
        ? 'No availability set'
        : `${shifts.map((w) => w.day).join(', ')} · ${shifts[0].start}–${shifts[0].end}`,
    hoursThisMonth: 'Not recorded',
    rating: 0,
    certifications: record ? record.credentials.map((c) => c.name) : [],
    ...(primary ? { primary: true } : {}),
  }
}

function synthesise(recipientId: string): CaregiverRecord | undefined {
  const base = recipients.find((r) => r.id === recipientId)
  if (!base) return undefined

  // A recipient with no caregiver still has a coordinator — the profile
  // summary names one, and denying the team existed contradicted it.
  const team: TeamMember[] = []
  if (base.caregiver) {
    team.push(teamMember('tm1', base.caregiver, 'Primary Caregiver', true))
  }
  team.push(teamMember('tm2', coordinatorFor(base.id), 'Care Coordinator', false))

  return {
    team,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    shifts: [],
    history: [],
    hoursDelta: 'No change recorded',
  }
}

export function getCaregiverRecord(
  recipientId: string,
): CaregiverRecord | undefined {
  return records[recipientId] ?? synthesise(recipientId)
}

/* -------------------------------- reassign -------------------------------- */

/**
 * Who can take over a team member's place: active staff not already on this
 * recipient's team, coordinators for the coordinator seat and caregivers for
 * every other one.
 */
export function replacementsFor(recipientId: string, member: Pick<TeamMember, 'role'>): StaffMember[] {
  const onTeam = new Set(getCaregiverRecord(recipientId)?.team.map((m) => m.name) ?? [])
  const wantCoordinator = member.role === 'Care Coordinator'
  return staffMembers.filter(
    (s) =>
      s.status === 'active' &&
      !onTeam.has(s.name) &&
      /coordinator/i.test(s.title) === wantCoordinator,
  )
}

/**
 * Puts someone else in a team member's seat — same role, same primary flag —
 * and records both halves in the assignment history. Moving the primary seat
 * also moves the caregiver named on the directory row. Held in memory.
 */
export function reassignTeamMember(
  recipientId: string,
  memberId: string,
  replacementName: string,
  reason: string,
): void {
  const record = getCaregiverRecord(recipientId)
  const old = record?.team.find((m) => m.id === memberId)
  if (!record || !old) return
  const stamp = Date.now().toString(36)
  const replacement = teamMember(`${memberId}-${stamp}`, replacementName, old.role, Boolean(old.primary))
  const date = new Date(`${TODAY}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  records[recipientId] = {
    ...record,
    team: record.team.map((m) => (m.id === memberId ? replacement : m)),
    history: [
      { id: `ah-${stamp}-in`, dateIso: TODAY, date, action: 'assigned', caregiver: replacementName, reason: `Replaces ${old.name} as ${old.role}. ${reason}`, by: SIGNED_IN },
      { id: `ah-${stamp}-out`, dateIso: TODAY, date, action: 'removed', caregiver: old.name, reason, by: SIGNED_IN },
      ...record.history,
    ],
  }
  if (old.primary) {
    const row = recipients.find((r) => r.id === recipientId)
    if (row) row.caregiver = replacementName
  }
}

/**
 * Seats Assign Caregiver can fill. Primary and Care Coordinator are single
 * seats, offered only while empty; the supporting roles can be held by
 * several people.
 */
export function openRoles(recipientId: string): CaregiverRole[] {
  const team = getCaregiverRecord(recipientId)?.team ?? []
  const has = (role: CaregiverRole) => team.some((m) => m.role === role)
  const roles: CaregiverRole[] = []
  if (!has('Primary Caregiver')) roles.push('Primary Caregiver')
  roles.push('Backup Caregiver', 'Clinical Nurse', 'Relief Caregiver')
  if (!has('Care Coordinator')) roles.push('Care Coordinator')
  return roles
}

/** Adds someone to the team in a new seat and records it in the history. */
export function addTeamMember(recipientId: string, name: string, role: CaregiverRole, reason: string): void {
  const record = getCaregiverRecord(recipientId)
  if (!record) return
  const stamp = Date.now().toString(36)
  const primary = role === 'Primary Caregiver'
  const date = new Date(`${TODAY}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  records[recipientId] = {
    ...record,
    team: [...record.team, teamMember(`tm-${stamp}`, name, role, primary)],
    history: [
      { id: `ah-${stamp}`, dateIso: TODAY, date, action: 'assigned', caregiver: name, reason: `Added as ${role}. ${reason}`, by: SIGNED_IN },
      ...record.history,
    ],
  }
  if (primary) {
    const row = recipients.find((r) => r.id === recipientId)
    if (row) row.caregiver = name
  }
}

/** Non-staff who appear as authors elsewhere in the record. */
const externalRoles: Record<string, string> = {
  'David Johnson': 'Family',
  'Dr. Sarah Kim': 'Geriatrician',
  'Dr. James Park': 'Physician',
  'Dr. Osei': 'Neurologist',
  'HR Team': 'Human Resources',
  // Whoever is signed in files write-ups from the monitoring screens, and
  // without this they were credited as a "Contributor" on their own record.
  'Sarah Jenkins': 'Operations Manager',
  'Admin Support': 'Administrator',
}

/**
 * Single source for how a person is titled. Notes, health events and documents
 * all name the same people, and were describing them three different ways —
 * Sarah Williams was "CNA", "Caregiver" and "Primary Caregiver" at once.
 */
export function roleFor(recipientId: string, name: string): string {
  const member = getCaregiverRecord(recipientId)?.team.find(
    (m) => m.name === name,
  )
  return member?.role ?? externalRoles[name] ?? 'Contributor'
}

/* -------------------------------- derived --------------------------------- */

export interface Coverage {
  covered: number
  total: number
  percent: number
  /** Day names holding at least one unassigned block. */
  openDays: string[]
}

/**
 * Derived rather than stated. A hardcoded "100%" sat directly above two
 * visibly open Sunday blocks in the original design.
 */
export function calculateCoverage(
  shifts: ShiftRow[],
  weekdays: string[],
): Coverage {
  const slots = shifts.flatMap((s) => s.days)
  const covered = slots.filter((s) => s !== 'open').length

  const openDays = [
    ...new Set(
      shifts.flatMap((s) =>
        s.days.flatMap((owner, i) =>
          owner === 'open' ? [weekdays[i] ?? ''] : [],
        ),
      ),
    ),
  ].filter(Boolean)

  return {
    covered,
    total: slots.length,
    percent: slots.length === 0 ? 0 : Math.round((covered / slots.length) * 100),
    openDays,
  }
}

/** Sums the leading number of each member's logged-hours string. */
export function totalHours(team: TeamMember[]): number {
  return team.reduce((sum, m) => sum + (parseFloat(m.hoursThisMonth) || 0), 0)
}
