import { useSyncExternalStore } from 'react'
import type { Tone } from '@/types'

/*
 * The staff fixture and its labels only. Split out of `roster-data` so the
 * per-recipient care teams can read an employee's real status and shift
 * pattern without importing the derivations that read those same teams back —
 * which would be a cycle.
 */

export type StaffStatus = 'active' | 'on-leave' | 'inactive'

export type Employment = 'Full-Time' | 'Part-Time' | 'Bank'

export type Shift = 'Morning' | 'Afternoon' | 'Evening' | 'Overnight' | 'No preference'

export const shifts: Shift[] = [
  'Morning',
  'Afternoon',
  'Evening',
  'Overnight',
  'No preference',
]

export const employmentTypes: Employment[] = ['Full-Time', 'Part-Time', 'Bank']

export const branches = ['North Branch', 'Central Branch', 'South Branch'] as const

export const titles = [
  'Certified Nursing Assistant (CNA)',
  'Registered Nurse (RN)',
  'Live-in Care Assistant',
  'Care Coordinator',
] as const

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export const weekdays: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** A window they can be rostered in, or nothing at all on an off day. */
export interface AvailabilityWindow {
  day: Weekday
  start: string
  end: string
}

export type CredentialKind = 'licence' | 'certification' | 'check'

export interface Credential {
  id: string
  name: string
  kind: CredentialKind
  /** The number printed on the card, where the credential carries one. */
  reference?: string
  /** ISO. When it was granted — always before `expiresAt`. */
  issuedAt?: string
  /** ISO. Undefined for a one-off check with no expiry. */
  expiresAt?: string
  /** ISO, for checks that record when they were cleared. */
  clearedAt?: string
  /** Name of the uploaded supporting document, where one was attached. */
  document?: string
}

export interface StaffMember {
  id: string
  /** Employee number, issued on hire — stored, not derived. */
  ref: string
  name: string
  title: string
  status: StaffStatus
  employment: Employment
  branch: string
  /** ISO. */
  hiredAt: string
  /** ISO. */
  dateOfBirth: string
  /** Years worked elsewhere before joining; tenure is derived from `hiredAt`. */
  priorExperienceYears: number
  phone: string
  /**
   * Overrides the org convention. Left undefined the profile falls back to
   * firstname.lastname@careprofs.com, so the address is editable without the
   * derived form and the stored one contradicting each other.
   */
  email?: string
  /** What the agency pays them. The client charge rate lives in billing. */
  hourlyRate: number
  /** Contracted ceiling. The availability grid must not exceed it. */
  maxHoursPerWeek: number
  preferredShift: Shift
  /** A coordinator on the roster. */
  supervisor: string
  /** Internal, not shown to families. */
  notes: string
  address: string
  emergencyContact: { name: string; relationship: string; phone: string }
  languages: string[]
  skills: string[]
  credentials: Credential[]
  availability: AvailabilityWindow[]
}

/* --------------------------------- labels --------------------------------- */

export const statusLabels: Record<StaffStatus, string> = {
  active: 'Active',
  'on-leave': 'On leave',
  inactive: 'Inactive',
}

export const statusTones: Record<StaffStatus, Tone> = {
  active: 'green',
  'on-leave': 'amber',
  inactive: 'slate',
}

export type ComplianceState = 'compliant' | 'expiring' | 'expired'

export const complianceLabels: Record<ComplianceState, string> = {
  compliant: 'Fully compliant',
  expiring: 'Renewal due',
  expired: 'Not compliant',
}

export const complianceTones: Record<ComplianceState, Tone> = {
  compliant: 'green',
  expiring: 'amber',
  expired: 'red',
}

export const ROSTER_PAGE_SIZE = 8

/** A credential inside this window is flagged before it lapses. */
export const RENEWAL_WINDOW_DAYS = 60

/* ---------------------------------- data ---------------------------------- */

const officeHours: AvailabilityWindow[] = weekdays
  .slice(0, 5)
  .map((day) => ({ day, start: '09:00', end: '18:00' }))

const staff: StaffMember[] = [
  {
    id: 'cg-001',
    ref: '#CG-001',
    name: 'Sarah Williams',
    title: 'Certified Nursing Assistant (CNA)',
    status: 'active',
    employment: 'Full-Time',
    branch: 'North Branch',
    hiredAt: '2019-03-04',
    dateOfBirth: '1988-06-15',
    priorExperienceYears: 3,
    phone: '(555) 234-5678',
    hourlyRate: 95,
    maxHoursPerWeek: 45,
    preferredShift: 'Morning',
    supervisor: 'Mike Chen',
    notes: 'Excellent with Alzheimer\u2019s patients. Prefers morning shifts. Available for weekend emergency cover with advance notice.',
    // Not 234 Maple Drive — that is Margaret Johnson's address, and the source
    // design had given the caregiver her client's home.
    address: '18 Cedar Lane, Springfield, IL 62702',
    emergencyContact: {
      name: 'Mark Williams',
      relationship: 'Husband',
      phone: '(555) 234-5679',
    },
    languages: ['English', 'Spanish'],
    skills: [
      "Alzheimer's care",
      'Personal hygiene',
      'Medication administration',
      'Physical therapy assist',
      'Mobility support',
      'Vital signs',
    ],
    /*
     * Two of these have lapsed against a clock of 2026-07-24. They are kept
     * that way on purpose: the source design printed "Fully Compliant" beside
     * a CPR card that expired in March, and the badge is now computed.
     */
    credentials: [
      { id: 'c1', name: 'CNA licence', kind: 'licence', issuedAt: '2024-12-31', reference: 'CNA-IL-52445', expiresAt: '2026-12-31' },
      {
        id: 'c2',
        name: "Alzheimer's care certification",
        kind: 'certification',
        issuedAt: '2024-06-30',
        reference: 'ALC-69294',
        expiresAt: '2026-06-30',
      },
      { id: 'c3', name: 'CPR / First aid', kind: 'certification', issuedAt: '2024-03-31', reference: 'CPR-29772', expiresAt: '2026-03-31' },
      { id: 'c4', name: 'Background check', kind: 'check', clearedAt: '2026-07-01' },
      { id: 'c5', name: 'TB test', kind: 'check', clearedAt: '2026-02-10', issuedAt: '2025-02-10', reference: 'REF-61750', expiresAt: '2027-02-10' },
    ],
    availability: [
      ...weekdays.slice(0, 5).map((day) => ({ day, start: '07:00', end: '18:00' })),
      { day: 'Sat' as Weekday, start: '08:00', end: '14:00' },
    ],
  },
  {
    id: 'cg-002',
    ref: '#CG-002',
    name: 'David Park',
    title: 'Certified Nursing Assistant (CNA)',
    status: 'active',
    employment: 'Full-Time',
    branch: 'North Branch',
    hiredAt: '2021-08-16',
    dateOfBirth: '1992-11-02',
    priorExperienceYears: 1,
    phone: '(555) 318-7742',
    hourlyRate: 95,
    maxHoursPerWeek: 40,
    preferredShift: 'Evening',
    supervisor: 'Mike Chen',
    notes: 'Strong on wound care. Prefers later starts; not available before noon.',
    address: '7 Birchwood Court, Springfield, IL 62703',
    emergencyContact: { name: 'Hana Park', relationship: 'Sister', phone: '(555) 318-7743' },
    languages: ['English', 'Korean'],
    skills: ['Wound care', 'Mobility support', 'Personal hygiene', 'Vital signs'],
    credentials: [
      { id: 'c1', name: 'CNA licence', kind: 'licence', issuedAt: '2025-08-31', reference: 'CNA-IL-95319', expiresAt: '2027-08-31' },
      {
        id: 'c2',
        name: 'Wound care specialist',
        kind: 'certification',
        issuedAt: '2025-03-15',
        reference: 'WCS-83370',
        expiresAt: '2027-03-15',
      },
      { id: 'c3', name: 'Background check', kind: 'check', clearedAt: '2025-08-16' },
      { id: 'c4', name: 'TB test', kind: 'check', clearedAt: '2026-01-20', issuedAt: '2025-01-20', reference: 'REF-16328', expiresAt: '2027-01-20' },
    ],
    availability: [
      ...weekdays.slice(1, 4).map((day) => ({ day, start: '12:00', end: '21:00' })),
      { day: 'Sat' as Weekday, start: '12:00', end: '21:00' },
      { day: 'Sun' as Weekday, start: '12:00', end: '21:00' },
    ],
  },
  {
    id: 'cg-003',
    ref: '#CG-003',
    name: 'Emma Wilson',
    title: 'Registered Nurse (RN)',
    status: 'active',
    employment: 'Part-Time',
    branch: 'Central Branch',
    hiredAt: '2020-01-13',
    dateOfBirth: '1985-04-27',
    priorExperienceYears: 6,
    phone: '(555) 442-9910',
    hourlyRate: 120,
    maxHoursPerWeek: 24,
    preferredShift: 'Afternoon',
    supervisor: 'Dr. Jane Foster',
    notes: 'Clinical cover only. Two fixed days a week, no on-call.',
    address: '52 Windermere Road, Springfield, IL 62704',
    emergencyContact: { name: 'Joel Wilson', relationship: 'Husband', phone: '(555) 442-9911' },
    languages: ['English'],
    skills: ['Clinical assessment', 'Wound care', 'Vital signs', 'Medication administration'],
    credentials: [
      { id: 'c1', name: 'RN licence', kind: 'licence', issuedAt: '2026-01-31', reference: 'RN-IL-19494', expiresAt: '2028-01-31' },
      {
        id: 'c2',
        name: 'Wound care specialist',
        kind: 'certification',
        issuedAt: '2025-02-28',
        reference: 'WCS-71033',
        expiresAt: '2027-02-28',
      },
      { id: 'c3', name: 'Background check', kind: 'check', clearedAt: '2026-01-13' },
      { id: 'c4', name: 'TB test', kind: 'check', clearedAt: '2026-03-02', issuedAt: '2025-03-02', reference: 'REF-80239', expiresAt: '2027-03-02' },
    ],
    availability: [
      { day: 'Fri', start: '12:00', end: '18:00' },
      { day: 'Sun', start: '12:00', end: '18:00' },
    ],
  },
  {
    id: 'cg-004',
    ref: '#CG-004',
    name: 'Maria Garcia',
    title: 'Certified Nursing Assistant (CNA)',
    status: 'active',
    employment: 'Part-Time',
    branch: 'South Branch',
    hiredAt: '2023-05-02',
    dateOfBirth: '1996-09-08',
    priorExperienceYears: 0,
    phone: '(555) 620-1188',
    hourlyRate: 95,
    maxHoursPerWeek: 24,
    preferredShift: 'Evening',
    supervisor: 'Amara Nwosu',
    notes: 'Newly qualified. Shadowed for the first three months; now independent on evening rounds.',
    address: '11 Larkspur Avenue, Springfield, IL 62705',
    emergencyContact: { name: 'Luis Garcia', relationship: 'Father', phone: '(555) 620-1189' },
    languages: ['English', 'Spanish'],
    skills: ['Medication review', 'Evening routine', 'Companionship'],
    credentials: [
      { id: 'c1', name: 'CNA licence', kind: 'licence', issuedAt: '2025-05-31', reference: 'CNA-IL-22337', expiresAt: '2027-05-31' },
      {
        id: 'c2',
        name: 'Medication administration',
        kind: 'certification',
        issuedAt: '2024-08-14',
        reference: 'MED-69222',
        expiresAt: '2026-08-14',
      },
      { id: 'c3', name: 'CPR / First aid', kind: 'certification', issuedAt: '2025-04-30', reference: 'CPR-57931', expiresAt: '2027-04-30' },
      { id: 'c4', name: 'Background check', kind: 'check', clearedAt: '2026-05-02' },
    ],
    availability: [
      ...weekdays.slice(0, 3).map((day) => ({ day, start: '16:00', end: '22:00' })),
      { day: 'Fri' as Weekday, start: '16:00', end: '22:00' },
    ],
  },
  {
    id: 'cg-005',
    ref: '#CG-005',
    name: 'Lisa Thompson',
    title: 'Certified Nursing Assistant (CNA)',
    status: 'active',
    employment: 'Full-Time',
    branch: 'South Branch',
    hiredAt: '2022-02-21',
    dateOfBirth: '1990-01-30',
    priorExperienceYears: 4,
    phone: '(555) 733-4402',
    hourlyRate: 95,
    maxHoursPerWeek: 40,
    preferredShift: 'Morning',
    supervisor: 'Amara Nwosu',
    notes: 'Reliable on the standard weekday round. Has asked not to be rostered on weekends.',
    address: '96 Alder Street, Springfield, IL 62706',
    emergencyContact: { name: 'Grace Thompson', relationship: 'Mother', phone: '(555) 733-4403' },
    languages: ['English'],
    skills: ['Personal hygiene', 'Meal preparation', 'Mobility support'],
    credentials: [
      { id: 'c1', name: 'CNA licence', kind: 'licence', issuedAt: '2025-02-28', reference: 'CNA-IL-86387', expiresAt: '2027-02-28' },
      { id: 'c2', name: 'CPR / First aid', kind: 'certification', issuedAt: '2025-06-30', reference: 'CPR-17602', expiresAt: '2027-06-30' },
      { id: 'c3', name: 'Background check', kind: 'check', clearedAt: '2026-02-21' },
      { id: 'c4', name: 'TB test', kind: 'check', clearedAt: '2026-04-11', issuedAt: '2025-04-11', reference: 'REF-76510', expiresAt: '2027-04-11' },
    ],
    availability: weekdays.slice(0, 5).map((day) => ({ day, start: '08:00', end: '17:00' })),
  },
  {
    id: 'cg-006',
    ref: '#CG-006',
    name: 'John Adams',
    title: 'Live-in Care Assistant',
    status: 'active',
    employment: 'Full-Time',
    branch: 'Central Branch',
    hiredAt: '2024-06-10',
    dateOfBirth: '1994-07-19',
    priorExperienceYears: 2,
    phone: '(555) 811-6650',
    hourlyRate: 85,
    maxHoursPerWeek: 48,
    preferredShift: 'Overnight',
    supervisor: 'Dr. Jane Foster',
    notes: 'Live-in placements only. Needs a week between placements.',
    address: '3 Ridgeway Close, Springfield, IL 62707',
    emergencyContact: { name: 'Beth Adams', relationship: 'Wife', phone: '(555) 811-6651' },
    languages: ['English'],
    skills: ['Overnight cover', 'Personal hygiene', 'Meal preparation', 'Companionship'],
    credentials: [
      { id: 'c1', name: 'Care certificate', kind: 'licence', issuedAt: '2025-06-30', reference: 'CC-IL-38140', expiresAt: '2027-06-30' },
      { id: 'c2', name: 'CPR / First aid', kind: 'certification', issuedAt: '2025-05-31', reference: 'CPR-14914', expiresAt: '2027-05-31' },
      { id: 'c3', name: 'Background check', kind: 'check', clearedAt: '2024-06-10' },
    ],
    availability: weekdays.map((day) => ({ day, start: '07:00', end: '19:00' })),
  },
  {
    id: 'cg-007',
    ref: '#CG-007',
    name: 'Mike Chen',
    title: 'Care Coordinator',
    status: 'active',
    employment: 'Full-Time',
    branch: 'North Branch',
    hiredAt: '2018-09-03',
    dateOfBirth: '1983-12-05',
    priorExperienceYears: 5,
    phone: '(555) 205-3311',
    hourlyRate: 130,
    maxHoursPerWeek: 40,
    preferredShift: 'No preference',
    supervisor: 'Dr. Jane Foster',
    notes: 'Coordinates the North Branch caseload.',
    address: '40 Prospect Hill, Springfield, IL 62708',
    emergencyContact: { name: 'Anna Chen', relationship: 'Wife', phone: '(555) 205-3312' },
    languages: ['English', 'Mandarin'],
    skills: ['Care planning', 'Family relations', 'Clinical assessment'],
    credentials: [
      { id: 'c1', name: 'RN licence', kind: 'licence', issuedAt: '2025-09-30', reference: 'RN-IL-21265', expiresAt: '2027-09-30' },
      { id: 'c2', name: 'Care management', kind: 'certification', issuedAt: '2025-01-31', reference: 'CM-66838', expiresAt: '2027-01-31' },
      { id: 'c3', name: 'Background check', kind: 'check', clearedAt: '2025-09-03' },
    ],
    availability: officeHours,
  },
  {
    id: 'cg-008',
    ref: '#CG-008',
    name: 'Dr. Jane Foster',
    title: 'Care Coordinator',
    status: 'active',
    employment: 'Full-Time',
    branch: 'Central Branch',
    hiredAt: '2017-04-17',
    dateOfBirth: '1979-02-22',
    priorExperienceYears: 9,
    phone: '(555) 190-7788',
    hourlyRate: 140,
    maxHoursPerWeek: 40,
    preferredShift: 'No preference',
    supervisor: 'Dr. Jane Foster',
    notes: 'Clinical governance lead. Supervises the other coordinators.',
    address: '14 Chancery Gate, Springfield, IL 62709',
    emergencyContact: { name: 'Peter Foster', relationship: 'Husband', phone: '(555) 190-7789' },
    languages: ['English', 'French'],
    skills: ['Clinical governance', 'Care planning', 'Family relations'],
    credentials: [
      { id: 'c1', name: 'Medical licence', kind: 'licence', issuedAt: '2026-04-30', reference: 'MD-IL-64810', expiresAt: '2028-04-30' },
      { id: 'c2', name: 'Care management', kind: 'certification', issuedAt: '2025-03-31', reference: 'CM-19156', expiresAt: '2027-03-31' },
      { id: 'c3', name: 'Background check', kind: 'check', clearedAt: '2025-04-17' },
    ],
    availability: officeHours,
  },
  {
    id: 'cg-009',
    ref: '#CG-009',
    name: 'Amara Nwosu',
    title: 'Care Coordinator',
    status: 'on-leave',
    employment: 'Full-Time',
    branch: 'South Branch',
    hiredAt: '2021-11-08',
    dateOfBirth: '1991-05-14',
    priorExperienceYears: 3,
    phone: '(555) 276-9044',
    hourlyRate: 130,
    maxHoursPerWeek: 40,
    preferredShift: 'No preference',
    supervisor: 'Dr. Jane Foster',
    notes: 'On parental leave; returning in the new year.',
    address: '61 Foxglove Way, Springfield, IL 62710',
    emergencyContact: { name: 'Chika Nwosu', relationship: 'Brother', phone: '(555) 276-9045' },
    languages: ['English', 'Igbo'],
    skills: ['Care planning', 'Family relations'],
    credentials: [
      { id: 'c1', name: 'RN licence', kind: 'licence', issuedAt: '2025-11-30', reference: 'RN-IL-41544', expiresAt: '2027-11-30' },
      { id: 'c2', name: 'Care management', kind: 'certification', issuedAt: '2024-11-08', reference: 'CM-21889', expiresAt: '2026-11-08' },
      { id: 'c3', name: 'Background check', kind: 'check', clearedAt: '2025-11-08' },
    ],
    availability: [],
  },
]

export const staffMembers: StaffMember[] = staff

/* --------------------------------- mutations ------------------------------- */

/*
 * Caregivers added this session. They are pushed onto the very array every
 * screen reads, so the roster, the board and the care teams all see them at
 * once; the revision below re-renders anything subscribed. Held in memory,
 * like every store in this prototype.
 */
let staffRevision = 0
const staffListeners = new Set<() => void>()

/** Re-render a screen after a caregiver is added. */
export function useStaffRevision(): number {
  return useSyncExternalStore(
    (l) => {
      staffListeners.add(l)
      return () => staffListeners.delete(l)
    },
    () => staffRevision,
    () => staffRevision,
  )
}

/** Append a caregiver and notify subscribers. */
export function addStaffMember(member: StaffMember): void {
  staff.push(member)
  staffRevision += 1
  for (const l of staffListeners) l()
}

/** The next free `cg-0NN` id, from the ids already in use. */
export function nextStaffId(): string {
  let max = 0
  for (const m of staff) {
    const n = Number(/^cg-(\d+)$/.exec(m.id)?.[1])
    if (Number.isFinite(n) && n > max) max = n
  }
  return `cg-${String(max + 1).padStart(3, '0')}`
}


export function getStaffMember(id: string | undefined): StaffMember | undefined {
  return staffMembers.find((s) => s.id === id)
}

export function staffByName(name: string): StaffMember | undefined {
  return staffMembers.find((s) => s.name === name)
}
