/**
 * The caregivers directory and one caregiver's profile, fetched from the back
 * office API and mapped into the `StaffMember` shape the whole Caregivers screen
 * already renders. Mapping into the existing fixture shape keeps every row, card,
 * tab and the edit form untouched: only the data source changes.
 *
 * The backend list carries the few columns the roster table shows (reference,
 * name, role, branch, employment, status). The per caregiver Overview endpoint
 * carries the rest of the profile (personal information, pay, certifications,
 * availability, skills). Fields the backend does not return (prior experience
 * years, the per credential kind) are left at a neutral default rather than
 * invented, and the cross recipient derivations (caseload, visit log, office
 * notes) remain the static reads they were, since those live in other contexts.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AvailabilityWindow,
  Credential,
  Employment,
  Shift,
  StaffMember,
  StaffStatus,
  Weekday,
} from './staff'
import { weekdays } from './staff'

/* --------------------------- backend responses ---------------------------- */

interface CaregiverRowDto {
  id: string
  reference: string
  name: string
  title: string | null
  branch: string | null
  employmentType: string | null
  status: string
}

interface CaregiverListDto {
  total: number
  page: number
  pageSize: number
  rows: CaregiverRowDto[]
}

interface OverviewPersonalDto {
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
  dateOfBirth: string | null
  age: number | null
  languages: string[]
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  emergencyContactEmail: string | null
}

interface OverviewCertificationDto {
  id: string
  name: string
  licenseNumber: string | null
  issuedAt: string | null
  expiresAt: string
  valid: boolean
}

interface OverviewAvailabilityDayDto {
  dayLabel: string
  date: string
  available: boolean
  slots: { startMinute: number; endMinute: number; label: string }[]
}

interface OverviewAssignmentDto {
  recipientName: string
  role: string
  since: string
}

interface OverviewTodayVisitDto {
  time: string
  recipientName: string
  visitType: string
  status: string
}

interface OverviewPerformanceDto {
  ratingAverage: number | null
  ratingCount: number
  satisfactionPercent: number | null
  taskCompletionPercent: number | null
  punctualityPercent: number | null
  visitsThisMonth: number
  hoursLogged: number
  missedVisits: number
}

interface OverviewNoteDto {
  body: string
  authorName: string | null
  createdAt: string
}

interface CaregiverOverviewDto {
  id: string
  reference: string
  name: string
  status: string
  title: string | null
  branch: string | null
  employmentType: string | null
  experienceYears: number | null
  joinedAt: string | null
  supervisorName: string | null
  maxHoursPerWeek: number | null
  preferredShift: string | null
  preferencesNote: string | null
  hourlyRateMinor: number | null
  payCurrency: string | null
  personal: OverviewPersonalDto
  assignments: OverviewAssignmentDto[]
  todaySchedule: OverviewTodayVisitDto[]
  performance: OverviewPerformanceDto
  certifications: OverviewCertificationDto[]
  fullyCompliant: boolean
  skills: string[]
  availability: OverviewAvailabilityDayDto[]
  recentNotes: OverviewNoteDto[]
}

/**
 * The parts of the Overview endpoint that the roster fixtures used to derive:
 * the caseload, today's visits, the headline performance, the recent notes and
 * whether the whole credential set is in date. Carried on the profile object so
 * `OverviewTab` reads backend data in place of the fixture helpers.
 */
export interface CaregiverOverviewExtras {
  assignments: OverviewAssignmentDto[]
  todaySchedule: OverviewTodayVisitDto[]
  performance: OverviewPerformanceDto
  recentNotes: OverviewNoteDto[]
  fullyCompliant: boolean
}

/** A caregiver profile plus the Overview tab's own backend data. */
export type CaregiverProfile = StaffMember & { overview: CaregiverOverviewExtras }

/* -------------------------------- mappers --------------------------------- */

/** Back office status enum to the roster's status union. */
export function toStaffStatus(value: string): StaffStatus {
  if (value === 'ON_LEAVE') return 'on-leave'
  if (value === 'INACTIVE') return 'inactive'
  return 'active'
}

/** Back office status union to its enum, for a status mutation. */
export function fromStaffStatus(value: StaffStatus): string {
  if (value === 'on-leave') return 'ON_LEAVE'
  if (value === 'inactive') return 'INACTIVE'
  return 'ACTIVE'
}

const EMPLOYMENTS: Record<string, Employment> = {
  FULL_TIME: 'Full-Time',
  PART_TIME: 'Part-Time',
  // The back office's CONTRACT grade shows as the roster's non permanent "Bank".
  CONTRACT: 'Bank',
}

function toEmployment(value: string | null): Employment {
  return (value && EMPLOYMENTS[value]) || 'Full-Time'
}

const SHIFTS: Shift[] = ['Morning', 'Afternoon', 'Evening', 'Overnight', 'No preference']

function toShift(value: string | null): Shift {
  return SHIFTS.find((s) => s.toLowerCase() === (value ?? '').toLowerCase()) ?? 'No preference'
}

/** Minutes from midnight to a "HH:MM" clock for an availability window. */
function toClock(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** The three letter weekday a date falls on, matching the roster's `Weekday`. */
function weekdayOf(iso: string): Weekday | null {
  // getUTCDay: 0 is Sunday; the roster's week runs Mon..Sun.
  const index = new Date(`${iso}T00:00:00Z`).getUTCDay()
  const order: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return order[index] ?? null
}

function toCredential(dto: OverviewCertificationDto): Credential {
  return {
    id: dto.id,
    name: dto.name,
    // The list does not carry the credential kind; the one it drives (the icon)
    // treats anything with an expiry as a certification, so that is the default.
    kind: 'certification',
    reference: dto.licenseNumber ?? undefined,
    // The backend sends full ISO timestamps; the card formatters expect a date
    // only string (they append a time), so take the date part as the rest of the
    // profile dates do.
    issuedAt: dto.issuedAt ? dto.issuedAt.slice(0, 10) : undefined,
    expiresAt: dto.expiresAt.slice(0, 10),
  }
}

function toAvailability(days: OverviewAvailabilityDayDto[]): AvailabilityWindow[] {
  const windows: AvailabilityWindow[] = []
  for (const day of days) {
    if (!day.available || day.slots.length === 0) continue
    const weekday = weekdayOf(day.date)
    if (!weekday) continue
    // The roster's grid shows one window per day; the earliest start to the
    // latest finish spans every slot the day holds.
    const start = Math.min(...day.slots.map((s) => s.startMinute))
    const end = Math.max(...day.slots.map((s) => s.endMinute))
    windows.push({ day: weekday, start: toClock(start), end: toClock(end) })
  }
  // Keep the roster's Mon..Sun order so the week reads left to right.
  return windows.sort((a, b) => weekdays.indexOf(a.day) - weekdays.indexOf(b.day))
}

/** One caregiver's Overview, mapped to the profile the screen renders. */
function toStaffMember(dto: CaregiverOverviewDto): CaregiverProfile {
  const p = dto.personal
  return {
    overview: {
      assignments: dto.assignments,
      todaySchedule: dto.todaySchedule,
      performance: dto.performance,
      recentNotes: dto.recentNotes,
      fullyCompliant: dto.fullyCompliant,
    },
    id: dto.id,
    ref: dto.reference,
    name: dto.name,
    title: dto.title ?? '',
    status: toStaffStatus(dto.status),
    employment: toEmployment(dto.employmentType),
    branch: dto.branch ?? '',
    hiredAt: dto.joinedAt ? dto.joinedAt.slice(0, 10) : '',
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
    // The header derives experience from the hire date; the backend has no
    // separate prior service figure, so none is added on top of tenure.
    priorExperienceYears: 0,
    phone: p.phone ?? '',
    email: p.email ?? undefined,
    // Stored in minor units; the form and overview show major units.
    hourlyRate: dto.hourlyRateMinor === null ? 0 : dto.hourlyRateMinor / 100,
    maxHoursPerWeek: dto.maxHoursPerWeek ?? 0,
    preferredShift: toShift(dto.preferredShift),
    supervisor: dto.supervisorName ?? '',
    notes: dto.preferencesNote ?? '',
    address: p.address ?? '',
    emergencyContact: {
      name: p.emergencyContactName ?? '',
      relationship: p.emergencyContactRelationship ?? '',
      phone: p.emergencyContactPhone ?? '',
    },
    languages: p.languages,
    skills: dto.skills,
    credentials: dto.certifications.map(toCredential),
    availability: toAvailability(dto.availability),
  }
}

/* --------------------------------- hooks ---------------------------------- */

/** The directory response, with rows pre mapped into `StaffMember`. */
export interface RosterView {
  total: number
  members: StaffMember[]
}

/**
 * The directory row carries only the columns the table shows; the rest of the
 * `StaffMember` the roster derivations read (skills, availability, credentials)
 * is empty here and populated on the profile from the Overview endpoint.
 */
function rowToStaffMember(row: CaregiverRowDto): StaffMember {
  return {
    id: row.id,
    ref: row.reference,
    name: row.name,
    title: row.title ?? '',
    status: toStaffStatus(row.status),
    employment: toEmployment(row.employmentType),
    branch: row.branch ?? '',
    hiredAt: '',
    dateOfBirth: '',
    priorExperienceYears: 0,
    phone: '',
    hourlyRate: 0,
    maxHoursPerWeek: 0,
    preferredShift: 'No preference',
    supervisor: '',
    notes: '',
    address: '',
    emergencyContact: { name: '', relationship: '', phone: '' },
    languages: [],
    skills: [],
    credentials: [],
    availability: [],
  }
}

/** The caregivers directory. The whole roster is fetched and filtered client side,
 *  matching the existing screen's in memory search and sort over the full list. */
export function useCaregiverRoster() {
  return useQuery({
    queryKey: ['admin', 'caregivers', 'roster'],
    queryFn: async (): Promise<RosterView> => {
      const dto = await api.get<CaregiverListDto>('/admin/caregivers?pageSize=100')
      return { total: dto.total, members: dto.rows.map(rowToStaffMember) }
    },
  })
}

/** One caregiver's profile, mapped to the shape the profile screen renders. */
export function useCaregiverProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'caregivers', 'profile', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<CaregiverProfile> =>
      toStaffMember(await api.get<CaregiverOverviewDto>(`/admin/caregivers/${id}/overview`)),
  })
}
