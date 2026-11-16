/**
 * The Medications tab, fetched from the backend and mapped into the
 * `MedicationPlan` shape the medications panels already render
 * (`GET /admin/care-recipients/:id/medications`).
 *
 * Fields the backend does not carry (brand, interaction kind, the "missed"
 * dose signal, per prescription note) come back absent and render as "—" or
 * are simply omitted rather than being invented here.
 */
import { useQuery } from '@tanstack/react-query'
import { Activity, Clock, Link2, TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api'
import type {
  AuditEntry,
  ClinicalWarning,
  DoseState,
  DoseWindow,
  MedicationPlan,
  MedicationStat,
  Prescription,
  PrescriptionStatus,
} from './medications-data'

/* --------------------------- backend response ----------------------------- */

interface NextDoseDto {
  at: string
  minute: number
  label: string
}

interface LastAdministeredDto {
  at: string
  caregiverName: string | null
}

interface MedicationsDto {
  summary: {
    activeMedications: number
    adherenceRatePercent: number | null
    adherenceTrendPoints: number | null
    nextDose: NextDoseDto | null
    activeAlerts: number
    alertSummary: string | null
  }
  prescriptions: {
    id: string
    name: string
    dose: string | null
    purpose: string | null
    status: string
    scheduleLabel: string
    prescribedBy: string | null
    startDate: string | null
    adherencePercent: number | null
    lastAdministered: LastAdministeredDto | null
    alert: string | null
  }[]
  todaysSchedule: {
    minute: number
    timeLabel: string
    periodLabel: string
    medications: { name: string; dose: string | null }[]
    administered: boolean
    caregiverName: string | null
  }[]
  warnings: { title: string; detail: string }[]
  audits: { at: string; title: string; detail: string; authorName: string | null }[]
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

function toPrescriptionStatus(value: string): PrescriptionStatus {
  switch (value) {
    case 'PAUSED':
      return 'paused'
    case 'DISCONTINUED':
      return 'discontinued'
    default:
      return 'active'
  }
}

function formatDay(iso: string | null): string {
  if (iso === null) return DASH
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDayAndTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function lastAdministeredLabel(entry: LastAdministeredDto | null): string {
  if (entry === null) return 'Not yet administered'
  const when = formatDayAndTime(entry.at)
  return entry.caregiverName ? `${when} by ${entry.caregiverName}` : when
}

function medicationSummary(meds: { name: string; dose: string | null }[]): string {
  return meds.map((m) => (m.dose ? `${m.name} (${m.dose})` : m.name)).join(', ')
}

/* -------------------------------- mappers --------------------------------- */

function toStats(summary: MedicationsDto['summary']): MedicationStat[] {
  const adherence =
    summary.adherenceRatePercent === null ? DASH : `${summary.adherenceRatePercent}%`
  const trend = summary.adherenceTrendPoints
  const adherenceHint =
    trend === null
      ? 'No doses recorded yet'
      : trend >= 0
        ? `↑ ${trend}% vs last month`
        : `↓ ${Math.abs(trend)}% vs last month`

  return [
    {
      id: 'active',
      label: 'Active Medications',
      value: String(summary.activeMedications),
      hint: 'All current prescriptions',
      hintTone: 'slate',
      icon: Link2,
      tone: 'blue',
    },
    {
      id: 'adherence',
      label: 'Adherence Rate',
      value: adherence,
      hint: adherenceHint,
      hintTone: trend === null ? 'slate' : trend >= 0 ? 'green' : 'amber',
      icon: Activity,
      tone: 'green',
    },
    {
      id: 'next-dose',
      label: 'Next Dose Due',
      value: summary.nextDose?.label ?? DASH,
      hint: summary.nextDose
        ? formatDayAndTime(summary.nextDose.at)
        : 'No dosing schedule yet',
      hintTone: 'blue',
      icon: Clock,
      tone: 'blue',
    },
    {
      id: 'alerts',
      label: 'Active Alerts',
      value: summary.activeAlerts > 0 ? `${summary.activeAlerts} Alert` : 'None',
      hint: summary.alertSummary ?? 'No interaction warnings',
      hintTone: summary.activeAlerts > 0 ? 'amber' : 'slate',
      icon: TriangleAlert,
      tone: 'amber',
    },
  ]
}

function toPrescription(dto: MedicationsDto['prescriptions'][number]): Prescription {
  return {
    id: dto.id,
    name: dto.name,
    // No brand field on the backend; the card simply shows the name.
    strength: dto.dose ?? DASH,
    purpose: dto.purpose ?? DASH,
    schedule: dto.scheduleLabel,
    prescribedBy: dto.prescribedBy ?? DASH,
    startDate: dto.startDate ?? '',
    startDateLabel: formatDay(dto.startDate),
    adherence: dto.adherencePercent,
    status: toPrescriptionStatus(dto.status),
    lastAdministered: lastAdministeredLabel(dto.lastAdministered),
    flag: dto.alert ?? undefined,
  }
}

function toDose(
  dto: MedicationsDto['todaysSchedule'][number],
  index: number,
): DoseWindow {
  // No "missed" signal from the backend; a dose is either given or still scheduled.
  const state: DoseState = dto.administered ? 'administered' : 'scheduled'
  const assignedTo = dto.caregiverName
  const note = dto.administered
    ? assignedTo
      ? `Administered by ${assignedTo}`
      : 'Administered'
    : assignedTo
      ? `Scheduled (${assignedTo} assigned)`
      : 'Scheduled'

  return {
    id: `dose-${index}`,
    time: dto.timeLabel,
    title: dto.periodLabel,
    medications: medicationSummary(dto.medications),
    state,
    administeredBy: assignedTo ?? '',
    note,
  }
}

function toPlan(dto: MedicationsDto): MedicationPlan {
  const today = new Date()
  return {
    stats: toStats(dto.summary),
    prescriptions: dto.prescriptions.map(toPrescription),
    scheduleDateIso: today.toISOString().slice(0, 10),
    scheduleDate: today.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    doses: dto.todaysSchedule.map(toDose),
    // The backend does not flag interaction versus instruction; all are shown.
    warnings: dto.warnings.map(
      (w, i): ClinicalWarning => ({
        id: `warn-${i}`,
        title: w.title,
        detail: w.detail,
        kind: 'instruction',
      }),
    ),
    audits: dto.audits.map(
      (a, i): AuditEntry => ({
        id: `audit-${i}`,
        dateIso: a.at,
        date: formatDay(a.at),
        title: a.title,
        detail: a.authorName ? `${a.detail} — ${a.authorName}` : a.detail,
      }),
    ),
  }
}

export function useRecipientMedications(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'medications'] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      toPlan(await api.get<MedicationsDto>(`/admin/care-recipients/${id}/medications`)),
  })
}
