/**
 * Care Operations settings — the services offered, the visit formats and what
 * they are billed at, the scheduling guardrails and the standard checklists.
 *
 * Fetched live from the back office (`GET /admin/care-operations`) and mapped
 * into the shapes the settings page already renders. The app is Naira only, so a
 * visit format's rate is read from (and written to) its NGN rate line. Checklists
 * are read only here; the backend exposes no create route, so the design's "Add
 * Template" action is dropped in the page.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ServiceOffering {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface VisitFormat {
  id: string
  name: string
  /** Null where the length is not fixed ("Varies"). */
  durationHours: number | null
  /** Naira. */
  rate: number
  hourly: boolean
}

export const matchAlgorithms = ['Proximity + Skills', 'Proximity only', 'Skills only', 'Manual assignment'] as const
export type MatchAlgorithm = (typeof matchAlgorithms)[number]

export interface Guardrails {
  noticeHours: number
  bufferMinutes: number
  maxVisitsPerDay: number
  algorithm: MatchAlgorithm
}

export interface Checklist {
  id: string
  name: string
  /** "5 tasks" — the count and the design's own noun for it. */
  summary: string
}

export interface CareOperations {
  services: ServiceOffering[]
  formats: VisitFormat[]
  guardrails: Guardrails
  checklists: Checklist[]
}

/* --------------------------- backend response ----------------------------- */

type RateUnit = 'PER_VISIT' | 'PER_HOUR'
type AutoAssignAlgorithm =
  | 'PROXIMITY_AND_SKILLS'
  | 'PROXIMITY_ONLY'
  | 'SKILLS_ONLY'
  | 'ROUND_ROBIN'
  | 'MANUAL'
type Currency = 'USD' | 'NGN'

interface RateDto {
  currency: Currency
  baseRateMinor: number
}

interface ServiceOfferingDto {
  id: string
  name: string
  description: string | null
  isEnabled: boolean
  sortOrder: number
}

interface VisitFormatDto {
  id: string
  name: string
  description: string | null
  durationMinutes: number | null
  rateUnit: RateUnit
  isActive: boolean
  sortOrder: number
  rates: RateDto[]
}

interface GuardrailsDto {
  minimumNoticeHours: number
  travelBufferMinutes: number
  maxVisitsPerCaregiverPerDay: number
  autoAssignAlgorithm: AutoAssignAlgorithm
}

interface TaskChecklistDto {
  id: string
  name: string
  taskCount: number
}

interface CareOperationsDto {
  serviceOfferings: ServiceOfferingDto[]
  visitFormats: VisitFormatDto[]
  guardrails: GuardrailsDto
  taskChecklists: TaskChecklistDto[]
}

/* -------------------------------- mappers --------------------------------- */

/** The currency this Naira only app reads and writes rates in. */
const NAIRA: Currency = 'NGN'

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

const ALGORITHM_TO_LABEL: Record<AutoAssignAlgorithm, MatchAlgorithm> = {
  PROXIMITY_AND_SKILLS: 'Proximity + Skills',
  PROXIMITY_ONLY: 'Proximity only',
  SKILLS_ONLY: 'Skills only',
  MANUAL: 'Manual assignment',
  // Round robin has no UI label; it falls back to the default when read.
  ROUND_ROBIN: 'Proximity + Skills',
}

const LABEL_TO_ALGORITHM: Record<MatchAlgorithm, AutoAssignAlgorithm> = {
  'Proximity + Skills': 'PROXIMITY_AND_SKILLS',
  'Proximity only': 'PROXIMITY_ONLY',
  'Skills only': 'SKILLS_ONLY',
  'Manual assignment': 'MANUAL',
}

/** The Naira base rate in major units, or 0 when no NGN rate is set. */
function nairaRate(format: VisitFormatDto): number {
  const rate = format.rates.find((r) => r.currency === NAIRA)
  return rate ? rate.baseRateMinor / 100 : 0
}

function toView(dto: CareOperationsDto): CareOperations {
  return {
    services: dto.serviceOfferings.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      enabled: s.isEnabled,
    })),
    formats: dto.visitFormats.map((f) => ({
      id: f.id,
      name: f.name,
      durationHours: f.durationMinutes === null ? null : f.durationMinutes / 60,
      rate: nairaRate(f),
      hourly: f.rateUnit === 'PER_HOUR',
    })),
    guardrails: {
      noticeHours: dto.guardrails.minimumNoticeHours,
      bufferMinutes: dto.guardrails.travelBufferMinutes,
      maxVisitsPerDay: dto.guardrails.maxVisitsPerCaregiverPerDay,
      algorithm: ALGORITHM_TO_LABEL[dto.guardrails.autoAssignAlgorithm] ?? 'Proximity + Skills',
    },
    checklists: dto.taskChecklists.map((c) => ({
      id: c.id,
      name: c.name,
      summary: plural(c.taskCount, 'task'),
    })),
  }
}

/* --------------------------------- hooks ---------------------------------- */

const careOperationsKey = ['admin', 'care-operations'] as const

/** The whole screen, mapped to the shapes the settings page renders. */
export function useCareOperations() {
  return useQuery({
    queryKey: careOperationsKey,
    queryFn: async () => toView(await api.get<CareOperationsDto>('/admin/care-operations')),
  })
}

export interface NewService {
  name: string
  description: string
  enabled: boolean
}

export interface NewFormat {
  name: string
  durationHours: number | null
  rate: number
  hourly: boolean
}

/** The write surface: each mutation returns the refreshed screen and invalidates. */
export function useCareOperationsMutations() {
  const queryClient = useQueryClient()
  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: careOperationsKey })
  }

  const setServiceEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/admin/care-operations/services/${id}`, { isEnabled: enabled }),
    onSuccess: invalidate,
  })

  const addService = useMutation({
    mutationFn: (service: NewService) =>
      api.post('/admin/care-operations/services', {
        name: service.name,
        description: service.description,
        isEnabled: service.enabled,
      }),
    onSuccess: invalidate,
  })

  const addFormat = useMutation({
    mutationFn: (format: NewFormat) =>
      api.post('/admin/care-operations/visit-formats', {
        name: format.name,
        durationMinutes: format.durationHours === null ? null : format.durationHours * 60,
        rateUnit: format.hourly ? 'PER_HOUR' : 'PER_VISIT',
        rates: [{ currency: NAIRA, baseRateMinor: Math.round(format.rate * 100) }],
      }),
    onSuccess: invalidate,
  })

  const updateGuardrails = useMutation({
    mutationFn: (patch: Partial<Guardrails>) =>
      api.patch('/admin/care-operations/guardrails', {
        minimumNoticeHours: patch.noticeHours,
        travelBufferMinutes: patch.bufferMinutes,
        maxVisitsPerCaregiverPerDay: patch.maxVisitsPerDay,
        autoAssignAlgorithm: patch.algorithm ? LABEL_TO_ALGORITHM[patch.algorithm] : undefined,
      }),
    onSuccess: invalidate,
  })

  return { setServiceEnabled, addService, addFormat, updateGuardrails }
}

/* -------------------------------- helpers --------------------------------- */

export function formatDuration(hours: number | null): string {
  return hours === null ? 'Varies' : plural(hours, 'hour')
}

export function formatRate(f: Pick<VisitFormat, 'rate' | 'hourly'>): string {
  return `₦${f.rate.toLocaleString('en-NG')}${f.hourly ? '/hr' : ''}`
}

export const guardrailText = {
  noticeHours: (g: Guardrails) => plural(g.noticeHours, 'hour'),
  bufferMinutes: (g: Guardrails) => plural(g.bufferMinutes, 'minute'),
  maxVisitsPerDay: (g: Guardrails) => plural(g.maxVisitsPerDay, 'shift'),
  algorithm: (g: Guardrails) => g.algorithm,
}

/** A whole number within the range, from typed text; null otherwise. */
export function parseWhole(raw: string, min: number, max: number): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const v = Number(t)
  return v >= min && v <= max ? v : null
}
