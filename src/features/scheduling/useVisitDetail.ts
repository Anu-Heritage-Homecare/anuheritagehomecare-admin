/**
 * The full Visit Details, from GET /admin/scheduling/visits/:id. The backend
 * composes every tab (overview, recipient, caregiver, care plan, notes, history,
 * check-in and location), so the client side simulation that used to assemble
 * this from six fixture modules is dropped. The DTO shapes are mirrored here as
 * the view the page renders.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface VisitInformation {
  date: string
  time: string
  endTime: string
  durationHours: number
  serviceType: string
  priority: string
  status: string
  location: string
  recurring: string
}

export interface VisitTaskVitals {
  summary: string
  recordedAt: string
}

export interface VisitTaskMedication {
  name: string
  dose: string | null
  outcome: string
}

export interface VisitTask {
  label: string
  category: string
  completed: boolean
  status: string
  scheduledTime: string | null
  startedAt: string | null
  completedAt: string | null
  durationMinutes: number | null
  note: string | null
  vitals: VisitTaskVitals[]
  medications: VisitTaskMedication[]
}

export interface VisitTasks {
  summary: string
  completed: number
  total: number
  items: VisitTask[]
}

export interface VisitNoteReply {
  authorName: string
  authorRole: string
  text: string
  at: string
}

export interface VisitNote {
  id: string
  source: string
  authorName: string
  authorRole: string
  audience: string
  text: string
  at: string
  acknowledged: boolean
  acknowledgedByName: string | null
  flaggedForCoordinator: boolean
  edited: boolean
  canEdit: boolean
  replies: VisitNoteReply[]
}

export interface VisitNotes {
  counts: { all: number; caregiver: number; coordinator: number; system: number }
  items: VisitNote[]
}

export interface VisitOverview {
  information: VisitInformation
  tasks: VisitTasks
  notes: VisitNote[]
}

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string | null
}

export interface VisitRecipient {
  id: string
  name: string
  age: number | null
  gender: string
  primaryCondition: string | null
  careLevel: string | null
  address: string
  emergencyContact: EmergencyContact | null
  conditions: string[]
  allergies: string[]
  careNeeds: string[]
  medications: { name: string; dose: string | null; times: string[] }[]
}

export interface VisitCaregiver {
  id: string
  name: string
  title: string | null
  branch: string | null
  onVisit: boolean
  clockIn: string | null
  performanceRating: number | null
}

export interface VisitCarePlan {
  serviceType: string
  frequency: string | null
  days: string[]
  startTime: string | null
  durationHours: number
  expectedDuration: string | null
  services: string[]
  instructions: string[]
  goals: string[]
}

export interface VisitTimelineEvent {
  type: string
  label: string
  detail: string | null
  at: string
  status: string
}

export interface RelatedVisit {
  id: string
  date: string
  label: string
  status: string
}

export interface VisitCheckIn {
  verified: boolean
  clockInAt: string | null
  clockOutAt: string | null
  arrivalLatitude: number | null
  arrivalLongitude: number | null
  scheduledStart: string
  scheduledEnd: string
}

export interface VisitLocation {
  address: string
  geofenceRadiusMeters: number
  checkInVarianceMeters: number | null
  checkInWithinRange: boolean | null
  recipientLatitude: number | null
  recipientLongitude: number | null
  currentLatitude: number | null
  currentLongitude: number | null
  currentOffsetMeters: number | null
  lastPingAt: string | null
  verificationPlan: string
  logs: { type: string; label: string; method: string; at: string; status: string }[]
}

export interface VisitDetailView {
  id: string
  reference: string
  status: string
  statusLabel: string
  serviceType: string
  priority: string
  checkIn: VisitCheckIn
  location: VisitLocation
  actions: { canEdit: boolean; canReassign: boolean; canCancel: boolean }
  overview: VisitOverview
  recipient: VisitRecipient
  caregiver: VisitCaregiver | null
  carePlan: VisitCarePlan
  notes: VisitNotes
  history: VisitTimelineEvent[]
  relatedVisits: { previous: RelatedVisit | null; next: RelatedVisit | null }
}

/** The full Visit Details for one visit. */
export function useVisitDetail(visitId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'scheduling', 'visit', visitId],
    enabled: Boolean(visitId),
    queryFn: () => api.get<VisitDetailView>(`/admin/scheduling/visits/${visitId}`),
  })
}
