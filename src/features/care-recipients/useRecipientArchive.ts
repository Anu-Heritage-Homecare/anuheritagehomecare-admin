/**
 * The Archive / Discharge screen, wired to the backend archive endpoints. One
 * read (`GET /admin/care-recipients/:id/archive`) powers the service summary and
 * the readiness checklist, mapped into the `DischargeReadiness` shapes the
 * existing `DischargeChecklist` renders unchanged. Two writes: a draft save
 * (`PUT .../archive/draft`) and the final process (`POST .../archive/process`).
 *
 * The frontend action/reason/acknowledgement values are display lowercase or
 * label text; the backend speaks UPPER_SNAKE enum tokens. The maps below are the
 * single place that translation lives, so the page sends tokens and never leaks
 * backend enums into the UI.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CheckState,
  DischargeAction,
  DischargeReadiness,
  SummaryItem,
} from './discharge-data'

/* --------------------------- backend response ----------------------------- */

interface MoneyDto {
  amountMinor: number
  currency: string
}

interface ArchiveDto {
  summary: {
    status: string
    careDurationMonths: number
    careDurationLabel: string
    totalVisitsCompleted: number
    activePlan: boolean
    planLevel: string | null
    outstandingBalance: MoneyDto | null
    assignedCaregivers: number
  }
  checklist: { key: string; label: string; detail: string; status: string }[]
  draft: {
    action: string
    reason: string | null
    effectiveDate: string | null
    clinicalSummary: string | null
    acknowledgements: string[]
    status: string
    processedAt: string | null
  } | null
}

export interface ProcessResultDto {
  id: string
  dischargeRecordId: string
  status: string
  cancelledVisits: number
  removedAssignments: number
}

/* ----------------------------- token mapping ------------------------------ */

/** Frontend action union to the backend `DischargeAction` token. */
export function toActionToken(action: DischargeAction): 'DISCHARGE' | 'HOLD' {
  return action === 'discharge' ? 'DISCHARGE' : 'HOLD'
}

function toAction(token: string): DischargeAction {
  return token === 'HOLD' ? 'hold' : 'discharge'
}

/**
 * The reason and acknowledgement selects carry their display labels (the
 * `dischargeReasons`/`holdReasons`/`acknowledgements` consts). The backend
 * enum tokens are not published to the frontend, so they are derived by
 * upper-snake-casing the label. RISK: if the backend tokens are not exactly the
 * upper-snake form of these labels, the write is rejected and the ApiError
 * message surfaces; adjust this single function when the real tokens are known.
 */
export function toEnumToken(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase()
}

/* -------------------------------- mapper ---------------------------------- */

const CHECK_STATE: Record<string, CheckState> = {
  CLEAR: 'clear',
  ATTENTION: 'attention',
  BLOCKED: 'blocked',
  NOT_STARTED: 'not-started',
}

function toCheckState(value: string): CheckState {
  return CHECK_STATE[value.toUpperCase()] ?? 'not-started'
}

function formatBalance(balance: MoneyDto | null): string {
  if (!balance) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: balance.currency,
    maximumFractionDigits: 0,
  }).format(balance.amountMinor / 100)
}

function toReadiness(dto: ArchiveDto): DischargeReadiness {
  const s = dto.summary
  const summary: SummaryItem[] = [
    { id: 'status', label: 'Status', value: s.status },
    { id: 'duration', label: 'Care duration', value: s.careDurationLabel },
    { id: 'visits', label: 'Total visits', value: `${s.totalVisitsCompleted} completed` },
    {
      id: 'plan',
      label: 'Active plan',
      value: s.activePlan ? `Yes${s.planLevel ? ` (${s.planLevel})` : ''}` : 'None on file',
    },
    {
      id: 'balance',
      label: 'Outstanding balance',
      value: formatBalance(s.outstandingBalance),
      emphasis: s.outstandingBalance && s.outstandingBalance.amountMinor > 0 ? 'bad' : 'good',
    },
    {
      id: 'team',
      label: 'Assigned caregivers',
      value: `${s.assignedCaregivers} ${s.assignedCaregivers === 1 ? 'professional' : 'professionals'}`,
    },
  ]

  const checklist = dto.checklist.map((c) => ({
    id: c.key,
    label: c.label,
    detail: c.detail,
    state: toCheckState(c.status),
  }))

  return {
    summary,
    checklist,
    canProcess: !checklist.some((c) => c.state === 'blocked'),
  }
}

/** The form seed derived from a saved draft, mapped to the page's value shapes. */
export interface ArchiveDraft {
  action: DischargeAction
  reason: string | null
  effectiveDate: string | null
  clinicalSummary: string | null
  acknowledgements: string[]
}

export interface ArchiveView {
  readiness: DischargeReadiness
  draft: ArchiveDraft | null
}

function toView(dto: ArchiveDto): ArchiveView {
  return {
    readiness: toReadiness(dto),
    draft: dto.draft
      ? {
          action: toAction(dto.draft.action),
          reason: dto.draft.reason,
          effectiveDate: dto.draft.effectiveDate,
          clinicalSummary: dto.draft.clinicalSummary,
          acknowledgements: dto.draft.acknowledgements,
        }
      : null,
  }
}

/* --------------------------------- query ---------------------------------- */

export function useRecipientArchive(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'archive'] as const,
    enabled: id !== undefined,
    queryFn: async () => toView(await api.get<ArchiveDto>(`/admin/care-recipients/${id}/archive`)),
  })
}

/* -------------------------------- mutations ------------------------------- */

/** The request body shared by the draft save and the process action. */
export interface ArchiveSubmission {
  action: DischargeAction
  reason?: string
  effectiveDate?: string
  clinicalSummary?: string
  acknowledgements?: string[]
}

function toBody(input: ArchiveSubmission) {
  return {
    action: toActionToken(input.action),
    reason: input.reason ? toEnumToken(input.reason) : undefined,
    effectiveDate: input.effectiveDate,
    clinicalSummary: input.clinicalSummary,
    acknowledgements: input.acknowledgements?.map(toEnumToken),
  }
}

export function useSaveArchiveDraft(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ArchiveSubmission) =>
      api.put<void>(`/admin/care-recipients/${id}/archive/draft`, toBody(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'care-recipients', id] }),
  })
}

export function useProcessArchive(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ArchiveSubmission) =>
      api.post<ProcessResultDto>(`/admin/care-recipients/${id}/archive/process`, toBody(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'care-recipients', id] }),
  })
}
