/**
 * Integrations and API keys, read from and written to the back office.
 *
 * Integrations come from `GET /admin/security/integrations`; connect/disconnect,
 * configure and test each hit their own endpoint. API keys come from the
 * organization context (`GET /admin/organization/api-keys`); create, regenerate
 * and revoke POST there. The list only returns a masked key value — the full
 * plaintext secret exists only in the create and regenerate responses, shown once.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const syncDirections = ['Two-way Sync', 'CareProfs to Google only', 'Google to CareProfs only'] as const
export const targetCalendars = ['CareProfs Primary Calendar', 'Care Team Shifts', 'Staff Calendar'] as const
export const syncEventOptions = ['Visits & Care Shifts', 'Staff Meetings', 'Task Reminders'] as const
export const syncIntervals = [5, 15, 30, 60] as const

export interface IntegrationConfig {
  direction: string
  calendar: string
  events: string[]
  intervalMinutes: number
}

export interface Integration {
  id: string
  name: string
  description: string
  connected: boolean
  /** "Jul 1, 2026"; null while disconnected. */
  connectedSince: string | null
  /** The last sync timestamp, formatted; null if it never synced. */
  lastSync: string | null
  config: IntegrationConfig
}

export interface ApiKey {
  id: string
  name: string
  status: 'Active' | 'Revoked'
  created: string
  createdBy: string
  lastUsed: string
  /** The full secret, only ever the masked value from the list — or the raw
   *  plaintext right after create/regenerate. */
  secret: string
  scopes: string[]
  rateLimitPerHour: number
  usage: { today: number; week: number }
}

/** The masked key as the backend already formatted it ("sk-cp-****3f7a"). */
export function maskedKey(key: ApiKey): string {
  return key.secret
}

/** The copyable value: the raw secret after create/regenerate, else the mask. */
export function fullKey(key: ApiKey): string {
  return key.secret
}

export function formatInterval(minutes: number): string {
  return minutes === 60 ? 'Every hour' : `Every ${minutes} minutes`
}

/* --------------------------- backend response ----------------------------- */

type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED'

interface IntegrationDto {
  id: string
  key: string
  name: string
  category: string
  status: IntegrationStatus
  description: string | null
  config: Record<string, unknown> | null
  connectedAt: string | null
  lastSyncAt: string | null
}

type ApiKeyStatus = 'ACTIVE' | 'REVOKED'

interface ApiKeyDto {
  id: string
  name: string
  status: ApiKeyStatus
  keyPrefix: string
  last4: string
  maskedValue: string
  scopes: string[]
  rateLimitPerHour: number
  createdById: string | null
  createdByName: string | null
  createdAt: string
  lastUsedAt: string | null
  usage: { today: number; thisWeek: number }
}

interface ApiKeyCreatedDto {
  key: ApiKeyDto
  secret: string
}

/* -------------------------------- enum maps -------------------------------- */

const DIRECTION_FROM_ENUM: Record<string, string> = {
  TWO_WAY: 'Two-way Sync',
  INBOUND: 'Google to CareProfs only',
  OUTBOUND: 'CareProfs to Google only',
}
const DIRECTION_TO_ENUM: Record<string, string> = {
  'Two-way Sync': 'TWO_WAY',
  'Google to CareProfs only': 'INBOUND',
  'CareProfs to Google only': 'OUTBOUND',
}

const EVENT_FROM_ENUM: Record<string, string> = {
  VISITS_AND_CARE_SHIFTS: 'Visits & Care Shifts',
  STAFF_MEETINGS: 'Staff Meetings',
  TASK_REMINDERS: 'Task Reminders',
}
const EVENT_TO_ENUM: Record<string, string> = {
  'Visits & Care Shifts': 'VISITS_AND_CARE_SHIFTS',
  'Staff Meetings': 'STAFF_MEETINGS',
  'Task Reminders': 'TASK_REMINDERS',
}

/* -------------------------------- helpers --------------------------------- */

/** An ISO date to "Jul 1, 2026"; null passes through. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * The stored config is the Google Calendar request shape (enum values), or null
 * if never configured. Map what exists onto the UI labels; anything missing
 * falls back to the first option rather than being fabricated.
 */
function toConfig(raw: Record<string, unknown> | null): IntegrationConfig {
  const direction = str(raw?.syncDirection)
  const interval = raw?.autoSyncIntervalMinutes
  const events = Array.isArray(raw?.syncEvents) ? raw.syncEvents : []
  return {
    direction: (direction && DIRECTION_FROM_ENUM[direction]) || syncDirections[0],
    calendar: str(raw?.targetCalendar) ?? targetCalendars[0],
    events: events.map((e) => EVENT_FROM_ENUM[String(e)]).filter((e): e is string => Boolean(e)),
    intervalMinutes: typeof interval === 'number' ? interval : syncIntervals[1],
  }
}

function toIntegration(dto: IntegrationDto): Integration {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    connected: dto.status === 'CONNECTED',
    connectedSince: formatDate(dto.connectedAt),
    lastSync: formatDate(dto.lastSyncAt),
    config: toConfig(dto.config),
  }
}

function toApiKey(dto: ApiKeyDto): ApiKey {
  return {
    id: dto.id,
    name: dto.name,
    status: dto.status === 'ACTIVE' ? 'Active' : 'Revoked',
    created: formatDate(dto.createdAt) ?? '—',
    createdBy: dto.createdByName ?? '—',
    lastUsed: formatDate(dto.lastUsedAt) ?? 'Not used yet',
    secret: dto.maskedValue,
    scopes: dto.scopes,
    rateLimitPerHour: dto.rateLimitPerHour,
    usage: { today: dto.usage.today, week: dto.usage.thisWeek },
  }
}

/* ------------------------------ integrations ------------------------------ */

const INTEGRATIONS_KEY = ['admin', 'integrations'] as const

export function useIntegrations() {
  return useQuery({
    queryKey: INTEGRATIONS_KEY,
    queryFn: async () =>
      (await api.get<IntegrationDto[]>('/admin/security/integrations')).map(toIntegration),
  })
}

export interface TestResult {
  ok: boolean
  message: string
}

export function useIntegrationMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: INTEGRATIONS_KEY })

  const saveConfig = useMutation({
    mutationFn: ({ id, config }: { id: string; config: IntegrationConfig }) =>
      api.patch(`/admin/security/integrations/${id}/config`, {
        syncDirection: DIRECTION_TO_ENUM[config.direction],
        targetCalendar: config.calendar,
        syncEvents: config.events.map((e) => EVENT_TO_ENUM[e]).filter(Boolean),
        autoSyncIntervalMinutes: config.intervalMinutes,
      }),
    onSuccess: invalidate,
  })

  const setConnected = useMutation({
    mutationFn: ({ id, connected }: { id: string; connected: boolean }) =>
      api.patch(`/admin/security/integrations/${id}/status`, {
        status: connected ? 'CONNECTED' : 'DISCONNECTED',
      }),
    onSuccess: invalidate,
  })

  const testConnection = useMutation({
    mutationFn: (id: string) => api.post<TestResult>(`/admin/security/integrations/${id}/test`),
    onSuccess: invalidate,
  })

  return { saveConfig, setConnected, testConnection }
}

/* -------------------------------- api keys -------------------------------- */

const API_KEYS_KEY = ['admin', 'api-keys'] as const

export function useApiKeys() {
  return useQuery({
    queryKey: API_KEYS_KEY,
    queryFn: async () =>
      (await api.get<ApiKeyDto[]>('/admin/organization/api-keys')).map(toApiKey),
  })
}

export interface CreateApiKeyInput {
  name: string
  scopes: string[]
  rateLimitPerHour?: number
}

export function useApiKeyMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: API_KEYS_KEY })

  /** Both create and regenerate return the one-time plaintext secret. */
  const create = useMutation({
    mutationFn: (input: CreateApiKeyInput) =>
      api.post<ApiKeyCreatedDto>('/admin/organization/api-keys', input),
    onSuccess: invalidate,
  })

  const regenerate = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiKeyCreatedDto>(`/admin/organization/api-keys/${id}/regenerate`),
    onSuccess: invalidate,
  })

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api.post<ApiKeyDto>(`/admin/organization/api-keys/${id}/revoke`),
    onSuccess: invalidate,
  })

  return { create, regenerate, revoke }
}
