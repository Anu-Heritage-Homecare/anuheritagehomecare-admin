/**
 * The care recipient Caregivers tab, fetched from the backend and mapped into the
 * `CaregiverRecord` shape the tab components (team cards, schedule coverage,
 * assignment history) already render. One request
 * (`GET /admin/care-recipients/:id/caregivers`) powers the whole tab.
 *
 * The server owns the team, the coverage grid and the assignment history. The
 * coverage grid comes back as flat weekday plus slot blocks; it is pivoted here
 * into the `ShiftRow[]` plus `weekdays[]` shape the ScheduleCoverage table wants,
 * keyed Monday first. Fields the backend does not supply ("not recorded", a zero
 * rating) render as such rather than being invented.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AssignmentEntry,
  CaregiverRecord,
  CaregiverRole,
  CaregiverStatus,
  HistoryAction,
  ShiftRow,
  SlotOwner,
  TeamMember,
} from './caregivers-data'

/* --------------------------- backend response ----------------------------- */

interface TeamMemberDto {
  assignmentId: string
  caregiverId: string
  name: string | null
  photoKey: string | null
  role: string
  status: string
  specialization: string | null
  scheduleLabel: string | null
  hoursThisMonth: number
  rating: number | null
  certifications: string[]
}

interface CoverageBlockDto {
  weekday: string
  slot: string
  caregiverId: string | null
  caregiverName: string | null
}

interface HistoryEntryDto {
  at: string
  action: string
  caregiverId: string
  caregiverName: string | null
  reason: string
  byName: string | null
}

export interface CaregiversResponseDto {
  summary: {
    assignedCaregivers: number
    totalCareHoursThisMonth: number
    careHoursTrend: number
    coverageRatePercent: number
  }
  team: TeamMemberDto[]
  coverage: CoverageBlockDto[]
  history: HistoryEntryDto[]
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

const ROLE: Record<string, CaregiverRole> = {
  PRIMARY: 'Primary Caregiver',
  BACKUP: 'Backup Caregiver',
  NURSE: 'Clinical Nurse',
  RELIEF: 'Relief Caregiver',
  COORDINATOR: 'Care Coordinator',
}
function toRole(value: string): CaregiverRole {
  return ROLE[value] ?? 'Backup Caregiver'
}

function toStatus(value: string): CaregiverStatus {
  switch (value) {
    case 'ACTIVE':
      return 'active'
    case 'AVAILABLE':
      return 'available'
    default:
      return 'off-duty'
  }
}

/** The grid only paints the four delivery buckets; a coordinator falls back to backup. */
const ROLE_SLOT: Record<CaregiverRole, SlotOwner> = {
  'Primary Caregiver': 'primary',
  'Backup Caregiver': 'backup',
  'Clinical Nurse': 'nurse',
  'Relief Caregiver': 'relief',
  'Care Coordinator': 'backup',
}

function toHistoryAction(value: string): HistoryAction {
  return value === 'REMOVED' ? 'removed' : 'assigned'
}

/** The weekday grid is Monday first; the backend sends UPPER day names. */
const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'MONDAY', label: 'Mon' },
  { key: 'TUESDAY', label: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wed' },
  { key: 'THURSDAY', label: 'Thu' },
  { key: 'FRIDAY', label: 'Fri' },
  { key: 'SATURDAY', label: 'Sat' },
  { key: 'SUNDAY', label: 'Sun' },
]

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/* -------------------------------- mappers --------------------------------- */

function toTeam(dto: CaregiversResponseDto): TeamMember[] {
  return dto.team.map((m) => {
    const role = toRole(m.role)
    return {
      id: m.assignmentId,
      name: m.name ?? DASH,
      role,
      status: toStatus(m.status),
      specialization: m.specialization ?? 'Not recorded',
      schedule: m.scheduleLabel ?? 'No schedule set',
      hoursThisMonth: `${m.hoursThisMonth}h`,
      rating: m.rating ?? 0,
      certifications: m.certifications,
      ...(role === 'Primary Caregiver' ? { primary: true } : {}),
    }
  })
}

/**
 * Pivots the flat coverage blocks into the shift rows the grid renders. Only the
 * weekdays and slots the backend actually returns become columns and rows; a
 * block without a caregiver (or a day a slot does not cover) reads as open.
 */
function toShifts(
  dto: CaregiversResponseDto,
  weekdays: { key: string; label: string }[],
): ShiftRow[] {
  const roleByCaregiver = new Map<string, CaregiverRole>(
    dto.team.map((m) => [m.caregiverId, toRole(m.role)]),
  )
  const slots = [...new Set(dto.coverage.map((b) => b.slot))]
  const owner = new Map<string, SlotOwner>()
  for (const b of dto.coverage) {
    if (b.caregiverId === null) continue
    const role = roleByCaregiver.get(b.caregiverId)
    owner.set(`${b.slot}|${b.weekday}`, role ? ROLE_SLOT[role] : 'backup')
  }
  return slots.map((slot) => ({
    id: slot,
    label: slot,
    hours: '',
    days: weekdays.map((d) => owner.get(`${slot}|${d.key}`) ?? 'open'),
  }))
}

function toHistory(dto: CaregiversResponseDto): AssignmentEntry[] {
  return dto.history.map((h, index) => ({
    id: `ah-${index}`,
    dateIso: h.at,
    date: formatHistoryDate(h.at),
    action: toHistoryAction(h.action),
    caregiver: h.caregiverName ?? DASH,
    reason: h.reason,
    by: h.byName ?? 'System',
  }))
}

function toRecord(dto: CaregiversResponseDto): CaregiverRecord {
  const present = new Set(dto.coverage.map((b) => b.weekday))
  const weekdays = WEEKDAYS.filter((d) => present.has(d.key))
  const trend = dto.summary.careHoursTrend
  return {
    team: toTeam(dto),
    weekdays: weekdays.map((d) => d.label),
    shifts: toShifts(dto, weekdays),
    history: toHistory(dto),
    hoursDelta:
      trend === 0
        ? 'No change recorded'
        : `${trend > 0 ? '↑' : '↓'} ${Math.abs(trend)}h since last month`,
  }
}

export function useRecipientCaregivers(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'caregivers'] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      toRecord(await api.get<CaregiversResponseDto>(`/admin/care-recipients/${id}/caregivers`)),
  })
}
