/**
 * The Care Plan tab, fetched from the backend and mapped into the `CarePlan`
 * shape the care plan panels already render
 * (`GET /admin/care-recipients/:id/care-plan`).
 *
 * The office set fields a goal carries in the UI (clinical intent, target,
 * reviewer) have no backend source, so they come through empty or "—" rather
 * than being invented here. The DTO carries no ids, so stable index based ids
 * are generated.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CareGoal,
  CarePlan,
  GoalStatus,
  Instruction,
  InstructionLevel,
  Revision,
  ScheduleEntry,
} from './care-plan-data'

/* --------------------------- backend response ----------------------------- */

interface CarePlanDto {
  goals: { label: string; progressPercent: number; status: string }[]
  schedule: { startMinute: number; title: string; description: string }[]
  instructions: {
    medical: { text: string; severity: string }[]
    behavioral: { text: string; severity: string }[]
  }
  revisions: { at: string; description: string; authorName: string | null }[]
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

function toGoalStatus(value: string): GoalStatus {
  switch (value) {
    case 'NEEDS_ATTENTION':
      return 'needs-attention'
    case 'AT_RISK':
      return 'at-risk'
    default:
      return 'on-track'
  }
}

function toInstructionLevel(value: string): InstructionLevel {
  switch (value) {
    case 'CAUTION':
      return 'caution'
    case 'CRITICAL':
      return 'critical'
    default:
      return 'standard'
  }
}

/** Minutes from midnight to a clock label, e.g. 540 -> "9:00 AM". */
function formatClock(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const period = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/* -------------------------------- mapper ---------------------------------- */

function toInstructions(
  items: { text: string; severity: string }[],
  prefix: string,
): Instruction[] {
  return items.map((i, index) => ({
    id: `${prefix}-${index}`,
    text: i.text,
    level: toInstructionLevel(i.severity),
  }))
}

function toPlan(dto: CarePlanDto): CarePlan {
  return {
    goals: dto.goals.map(
      (g, i): CareGoal => ({
        id: `goal-${i}`,
        title: g.label,
        intent: '',
        percent: g.progressPercent,
        status: toGoalStatus(g.status),
        target: DASH,
        reviewedBy: DASH,
      }),
    ),
    schedule: dto.schedule.map(
      (s, i): ScheduleEntry => ({
        id: `sched-${i}`,
        time: formatClock(s.startMinute),
        title: s.title,
        detail: s.description,
      }),
    ),
    medicalNeeds: toInstructions(dto.instructions.medical, 'med'),
    behavioural: toInstructions(dto.instructions.behavioral, 'beh'),
    revisions: dto.revisions.map(
      (r, i): Revision => ({
        id: `rev-${i}`,
        dateIso: r.at,
        date: formatDay(r.at),
        summary: r.description,
        author: r.authorName ?? DASH,
      }),
    ),
  }
}

export function useRecipientCarePlan(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'care-plan'] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      toPlan(await api.get<CarePlanDto>(`/admin/care-recipients/${id}/care-plan`)),
  })
}
