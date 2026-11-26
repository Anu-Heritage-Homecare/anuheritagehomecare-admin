/**
 * The care recipient profile (Overview), fetched from the backend and mapped into
 * the `RecipientProfile` shape the profile header and Overview panels render. One
 * request (`GET /admin/care-recipients/:id`) powers the shell and the Overview tab.
 *
 * Fields the recipient record does not yet carry (phone, email, languages, the
 * coordinator role) come back null or empty from the backend and render as "—"
 * rather than being invented here.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CareLevel, Priority, RecipientStatus, VisitStatus } from '@/types'
import type {
  CareNote,
  Medication,
  PastVisit,
  RecipientProfile,
  TeamMember,
  UpcomingVisit,
} from './profile-data'

/* --------------------------- backend response ----------------------------- */

interface ContactDto {
  name: string
  relationship: string | null
  phone: string | null
}

interface ProfileDto {
  header: {
    id: string
    code: string
    name: string
    photoKey: string | null
    age: number
    gender: string
    status: string
    priority: string
    primaryDiagnosis: string | null
    careLevel: string | null
    hasCareSchedule: boolean
  }
  personalInformation: {
    phone: string | null
    email: string | null
    address: string
    dateOfBirth: string | null
    age: number
    familyMember: ContactDto | null
    languages: string[]
  }
  careSummary: {
    careLevel: string | null
    startDate: string | null
    primaryDiagnosis: string | null
    secondaryDiagnoses: string[]
    primaryCaregiverName: string | null
    coordinatorName: string | null
    nextScheduledVisitAt: string | null
    emergencyContact: ContactDto | null
  }
  quickStats: {
    totalVisitsThisMonth: number
    careHoursThisMonth: number
    avgSatisfaction: number | null
    missedOrLateThisMonth: number
    activeCareAlerts: number
  }
  medications: { name: string; dose: string | null; scheduleMinute: number | null }[]
  careTeam: { caregiverId: string; name: string; role: string; active: boolean }[]
  recentVisits: {
    id: string
    date: string | null
    startMinute: number
    caregiverName: string | null
    type: string
    durationMinutes: number | null
    status: string
  }[]
  upcomingVisits: {
    id: string
    date: string | null
    startMinute: number
    description: string
    caregiverName: string | null
  }[]
  latestNotes: { authorName: string | null; audience: string; at: string | null; text: string }[]
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

const PRIORITIES: Priority[] = ['critical', 'urgent', 'high', 'medium', 'normal', 'low']
function toPriority(value: string): Priority {
  const lower = value.toLowerCase()
  return PRIORITIES.find((p) => p === lower) ?? 'normal'
}

function toStatus(value: string): RecipientStatus {
  switch (value) {
    case 'ACTIVE':
      return 'active'
    case 'ON_HOLD':
      return 'on-hold'
    case 'DISCHARGED':
      return 'discharged'
    default:
      return 'new'
  }
}

const CARE_LEVELS: CareLevel[] = ['Full-Time', 'Part-Time', 'Hourly', '24-Hour']
function toCareLevel(value: string | null): CareLevel {
  return CARE_LEVELS.find((level) => level === value) ?? 'Hourly'
}

/** Backend visit status to the UI visit status union. */
function toVisitStatus(value: string, caregiverName: string | null): VisitStatus {
  if (caregiverName === null) return 'unassigned'
  switch (value) {
    case 'COMPLETED':
      return 'completed'
    case 'IN_PROGRESS':
    case 'ON_BREAK':
      return 'in-progress'
    case 'CANCELLED':
      return 'cancelled'
    case 'MISSED':
      return 'late-arrival'
    default:
      return 'upcoming'
  }
}

/** Minutes from midnight to a clock label, e.g. 480 -> "9:00 AM". */
function formatClock(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const period = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

function formatDay(iso: string | null): string {
  if (iso === null) return 'Not recorded'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDayAndTime(iso: string | null): string {
  if (iso === null) return 'Not scheduled'
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatNoteTime(iso: string | null): string {
  if (iso === null) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/* -------------------------------- mapper ---------------------------------- */

function toProfile(dto: ProfileDto): RecipientProfile {
  const { header, personalInformation: pi, careSummary: cs, quickStats: qs } = dto

  const medications: Medication[] = dto.medications.map((m, index) => ({
    id: `rx-${index}`,
    name: m.dose ? `${m.name} ${m.dose}` : m.name,
    schedule: m.scheduleMinute === null ? 'As scheduled' : formatClock(m.scheduleMinute),
  }))

  const team: TeamMember[] = dto.careTeam.map((member) => ({
    id: member.caregiverId,
    name: member.name,
    role: member.active ? `${member.role} (Active)` : member.role,
  }))

  const recentVisits: PastVisit[] = dto.recentVisits.map((v) => ({
    id: v.id,
    date: formatDay(v.date),
    caregiver: v.caregiverName ?? 'Unassigned',
    type: v.type,
    duration: v.durationMinutes === null ? DASH : `${(v.durationMinutes / 60).toFixed(1)} hrs`,
    status: toVisitStatus(v.status, v.caregiverName),
  }))

  const upcoming: UpcomingVisit[] = dto.upcomingVisits.map((v) => ({
    id: v.id,
    when: formatDayAndTime(v.date === null ? null : v.date),
    title: v.description,
    caregiver: v.caregiverName ?? 'Unassigned',
  }))

  const notes: CareNote[] = dto.latestNotes.map((n, index) => ({
    id: `note-${index}`,
    author: n.authorName ?? 'Care team',
    role: n.audience,
    at: formatNoteTime(n.at),
    body: n.text,
  }))

  const satisfaction =
    qs.avgSatisfaction === null ? DASH : `${qs.avgSatisfaction.toFixed(1)} / 5.0`

  return {
    id: header.id,
    ref: `#${header.code}`,
    name: header.name,
    age: header.age,
    condition: header.primaryDiagnosis ?? DASH,
    careLevel: toCareLevel(header.careLevel),
    caregiver: cs.primaryCaregiverName,
    status: toStatus(header.status),
    priority: toPriority(header.priority),
    lastVisit: recentVisits[0]?.date ?? null,
    hasCareSchedule: header.hasCareSchedule,
    sex: header.gender || 'Not recorded',
    personal: {
      phone: pi.phone ?? DASH,
      email: pi.email ?? DASH,
      address: pi.address,
      dateOfBirth: formatDay(pi.dateOfBirth),
      familyMember: {
        name: pi.familyMember?.name ?? DASH,
        relationship: pi.familyMember?.relationship ?? DASH,
        phone: pi.familyMember?.phone ?? DASH,
      },
      languages: pi.languages.length > 0 ? pi.languages.join(', ') : DASH,
    },
    summary: {
      startDateIso: cs.startDate ?? '',
      startDate: formatDay(cs.startDate),
      primaryDiagnosis: cs.primaryDiagnosis ?? DASH,
      secondaryDiagnosis:
        cs.secondaryDiagnoses.length > 0 ? cs.secondaryDiagnoses.join(', ') : 'None recorded',
      coordinator: cs.coordinatorName ?? DASH,
      nextVisit: formatDayAndTime(cs.nextScheduledVisitAt),
      emergencyContact: {
        name: cs.emergencyContact?.name ?? DASH,
        relationship: cs.emergencyContact?.relationship ?? DASH,
        phone: cs.emergencyContact?.phone ?? DASH,
      },
    },
    quickStats: [
      { label: 'Total Visits', value: `${qs.totalVisitsThisMonth} visits` },
      { label: 'Care Hours Logged', value: `${qs.careHoursThisMonth} hours` },
      {
        label: 'Avg Satisfaction',
        value: satisfaction,
        tone: qs.avgSatisfaction === null ? undefined : 'green',
      },
      {
        label: 'Missed / Late Visits',
        value: String(qs.missedOrLateThisMonth),
        tone: qs.missedOrLateThisMonth > 0 ? 'amber' : 'green',
      },
      {
        label: 'Active Care Alerts',
        value: qs.activeCareAlerts > 0 ? `${qs.activeCareAlerts} urgent` : '0',
        tone: qs.activeCareAlerts > 0 ? 'red' : undefined,
      },
    ],
    medications,
    team,
    recentVisits,
    upcoming,
    notes,
  }
}

export function useRecipientProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'profile'] as const,
    enabled: id !== undefined,
    queryFn: async () => toProfile(await api.get<ProfileDto>(`/admin/care-recipients/${id}`)),
  })
}
