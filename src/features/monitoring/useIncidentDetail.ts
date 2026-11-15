/**
 * The live incident detail, one hook per tab (Overview, Timeline, Communication,
 * Resolution) plus the action mutations, all hitting `/admin/alerts/incidents`.
 *
 * Every field the backend pre formats (priorityLabel, statusLabel, timeLabel,
 * channelLabel, …) is rendered as is; only the few raw enum strings a badge
 * needs a tone for are mapped. Null fields are surfaced as null and the page
 * renders a placeholder, never a fabricated value.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* ------------------------------ enum unions ------------------------------- */

/** Mirrors the backend IncidentTimelineEventKind enum. */
export type IncidentTimelineEventKind =
  | 'COORDINATOR_NOTIFIED'
  | 'CAREGIVER_CONTACT'
  | 'FAMILY_NOTIFICATION'
  | 'REVIEW_STARTED'
  | 'NOTE'
  | 'OTHER'

/** Mirrors the backend CommunicationChannel enum. */
export type CommunicationChannel = 'PHONE_CALL' | 'INTERNAL_MESSAGE' | 'EMAIL' | 'SMS'

/** Mirrors the backend CommunicationOutcome enum. */
export type CommunicationOutcome = 'REACHED' | 'NO_ANSWER' | 'LEFT_MESSAGE' | 'ACKNOWLEDGED'

/** Mirrors the backend IncidentResolutionStatus enum. */
export type IncidentResolutionStatus = 'PENDING_RESOLUTION' | 'RESOLVED' | 'ESCALATED'

export const timelineKindOptions: { value: IncidentTimelineEventKind; label: string }[] = [
  { value: 'COORDINATOR_NOTIFIED', label: 'Coordinator notified' },
  { value: 'CAREGIVER_CONTACT', label: 'Caregiver contact' },
  { value: 'FAMILY_NOTIFICATION', label: 'Family notification' },
  { value: 'REVIEW_STARTED', label: 'Review started' },
  { value: 'NOTE', label: 'Note' },
  { value: 'OTHER', label: 'Other' },
]

export const channelOptions: { value: CommunicationChannel; label: string }[] = [
  { value: 'PHONE_CALL', label: 'Phone Call' },
  { value: 'INTERNAL_MESSAGE', label: 'Internal Message' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
]

export const outcomeOptions: { value: CommunicationOutcome; label: string }[] = [
  { value: 'REACHED', label: 'Reached' },
  { value: 'NO_ANSWER', label: 'No Answer' },
  { value: 'LEFT_MESSAGE', label: 'Left Message' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
]

export const resolutionStatusOptions: { value: IncidentResolutionStatus; label: string }[] = [
  { value: 'PENDING_RESOLUTION', label: 'Pending Resolution' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ESCALATED', label: 'Escalated' },
]

/* ----------------------------- query keys --------------------------------- */

const detailKey = (id: string) => ['admin', 'alerts', 'incident', id] as const
const timelineKey = (id: string) => ['admin', 'alerts', 'incident', id, 'timeline'] as const
const communicationsKey = (id: string) =>
  ['admin', 'alerts', 'incident', id, 'communications'] as const
const resolutionKey = (id: string) => ['admin', 'alerts', 'incident', id, 'resolution'] as const

/* --------------------------- overview (detail) ---------------------------- */

export interface IncidentRecipientCard {
  name: string
  age: number
  primaryLanguage: string | null
  emergencyContact: string | null
  diagnosedConditions: string[]
}

export interface IncidentCaregiverCard {
  name: string
  designation: string | null
  phone: string | null
}

export interface IncidentRelatedVisit {
  reference: string
  scheduleLabel: string
  serviceType: string
  statusLabel: string
}

export interface IncidentDetail {
  id: string
  reference: string
  incidentType: string
  priorityLabel: string
  statusLabel: string
  active: boolean
  reportedBy: string
  reportedTime: string
  reportedAt: string
  description: string | null
  assignedCoordinator: string | null
  recipient: IncidentRecipientCard | null
  caregiver: IncidentCaregiverCard | null
  relatedVisit: IncidentRelatedVisit | null
  generatedAt: string
}

export function useIncidentDetail(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => api.get<IncidentDetail>(`/admin/alerts/incidents/${id}`),
  })
}

/* -------------------------------- timeline -------------------------------- */

export interface IncidentTimelineEntry {
  at: string
  timeLabel: string
  dayLabel: string
  title: string
  description: string
  actor: string | null
  kind: IncidentTimelineEventKind
}

interface IncidentTimeline {
  id: string
  reference: string
  entries: IncidentTimelineEntry[]
  generatedAt: string
}

export function useIncidentTimeline(id: string, enabled: boolean) {
  return useQuery({
    queryKey: timelineKey(id),
    queryFn: () => api.get<IncidentTimeline>(`/admin/alerts/incidents/${id}/timeline`),
    enabled,
  })
}

/* ----------------------------- communications ----------------------------- */

export interface IncidentCommunication {
  id: string
  at: string
  timeLabel: string
  dayLabel: string
  timestampLabel: string
  contactName: string
  contactRole: string | null
  channel: CommunicationChannel
  channelLabel: string
  outcome: CommunicationOutcome
  outcomeLabel: string
  notes: string | null
}

export interface ContactBookEntry {
  name: string
  subtitle: string | null
  phone: string | null
}

export interface IncidentContactBook {
  familyEmergencyContact: ContactBookEntry | null
  assignedCaregiver: ContactBookEntry | null
  escalationSupervisor: ContactBookEntry | null
}

interface IncidentCommunications {
  id: string
  reference: string
  communications: IncidentCommunication[]
  contactBook: IncidentContactBook
  generatedAt: string
}

export function useIncidentCommunications(id: string, enabled: boolean) {
  return useQuery({
    queryKey: communicationsKey(id),
    queryFn: () =>
      api.get<IncidentCommunications>(`/admin/alerts/incidents/${id}/communications`),
    enabled,
  })
}

/* ------------------------------- resolution ------------------------------- */

export interface IncidentResolution {
  id: string
  reference: string
  status: IncidentResolutionStatus
  statusLabel: string
  summary: string | null
  actionsTaken: string | null
  followUpRequired: boolean
  followUpDate: string | null
  followUpDateLabel: string | null
  followUpNotes: string | null
  resolvedBy: string | null
  resolutionTimeLabel: string | null
  resolved: boolean
  generatedAt: string
}

export function useIncidentResolution(id: string, enabled: boolean) {
  return useQuery({
    queryKey: resolutionKey(id),
    queryFn: () => api.get<IncidentResolution>(`/admin/alerts/incidents/${id}/resolution`),
    enabled,
  })
}

/* ------------------------------- mutations -------------------------------- */

/** The five tabs feed off four keys; a lifecycle action can move any of them, so
 *  invalidate all four after the header actions. */
async function invalidateAll(queryClient: QueryClient, id: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: detailKey(id) }),
    queryClient.invalidateQueries({ queryKey: timelineKey(id) }),
    queryClient.invalidateQueries({ queryKey: communicationsKey(id) }),
    queryClient.invalidateQueries({ queryKey: resolutionKey(id) }),
  ])
}

/** Start review, escalate, resolve or close the incident (no body). */
export function useIncidentLifecycle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'review' | 'escalate' | 'resolve' | 'close') =>
      api.post<unknown>(`/admin/alerts/incidents/${id}/${action}`),
    onSuccess: () => invalidateAll(queryClient, id),
  })
}

export interface AppendTimelineInput {
  kind: IncidentTimelineEventKind
  title: string
  description: string
  actorName?: string
  actorRole?: string
}

export function useAppendTimelineEntry(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AppendTimelineInput) =>
      api.post<unknown>(`/admin/alerts/incidents/${id}/timeline`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: timelineKey(id) }),
  })
}

export interface LogCommunicationInput {
  channel: CommunicationChannel
  outcome: CommunicationOutcome
  contactName: string
  contactRole?: string
  notes?: string
}

export function useLogCommunication(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LogCommunicationInput) =>
      api.post<unknown>(`/admin/alerts/incidents/${id}/communications`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: communicationsKey(id) }),
  })
}

export interface SaveResolutionInput {
  status?: IncidentResolutionStatus
  summary?: string
  actionsTaken?: string
  followUpRequired?: boolean
  followUpDate?: string
  followUpNotes?: string
}

/** Save the resolution form (PUT, does not resolve). */
export function useSaveResolution(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveResolutionInput) =>
      api.put<unknown>(`/admin/alerts/incidents/${id}/resolution`, input),
    onSuccess: () => invalidateAll(queryClient, id),
  })
}

/** Mark the incident resolved (POST, same body shape as save). */
export function useResolveIncident(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveResolutionInput) =>
      api.post<unknown>(`/admin/alerts/incidents/${id}/resolution/resolve`, input),
    onSuccess: () => invalidateAll(queryClient, id),
  })
}
