/**
 * The Assign Caregiver screen: the visit header and the ranked caregiver
 * candidates for an unassigned (or to be reassigned) visit, from
 * GET /admin/scheduling/visits/:id/candidates. The backend does the scoring,
 * eligibility and availability; the client side simulation that used to compute
 * all of this from fixtures is dropped.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CandidateSort = 'BEST_MATCH' | 'DISTANCE' | 'RATING'

interface AssignVisitHeaderDto {
  id: string
  recipientName: string
  serviceType: string
  priority: string
  date: string
  time: string
  endTime: string
  durationHours: number
  location: string
}

interface AvailabilityDto {
  status: 'AVAILABLE' | 'AVAILABLE_LATER' | 'BUSY' | 'OFF_DUTY'
  label: string
}

interface EligibilityDto {
  status: 'OK' | 'WARN' | 'BLOCKED_CONFLICT' | 'INELIGIBLE'
  assignable: boolean
  reason: string | null
}

interface CertificationDto {
  name: string
  valid: boolean
}

interface LoadDto {
  completed: number
  total: number
  label: string
}

export interface AssignCandidate {
  caregiverId: string
  name: string
  title: string | null
  branch: string | null
  bestMatch: boolean
  matchScore: number
  availability: AvailabilityDto
  distanceMiles: number | null
  load: LoadDto
  rating: number | null
  certifications: CertificationDto[]
  skills: string[]
  eligibility: EligibilityDto
}

export interface AssignCandidatesView {
  visit: AssignVisitHeaderDto
  requiredCertification: string | null
  total: number
  candidates: AssignCandidate[]
}

export interface CandidateFilters {
  search?: string
  branch?: string
  availableNow?: boolean
  sort?: CandidateSort
}

/** The ranked candidates for a visit, with filters driving the backend query. */
export function useAssignCandidates(visitId: string | undefined, filters: CandidateFilters) {
  const query = new URLSearchParams()
  if (filters.search) query.set('search', filters.search)
  if (filters.branch) query.set('branch', filters.branch)
  if (filters.availableNow) query.set('availableNow', 'true')
  if (filters.sort) query.set('sort', filters.sort)
  const suffix = query.toString() ? `?${query.toString()}` : ''

  return useQuery({
    queryKey: ['admin', 'scheduling', 'candidates', visitId, suffix],
    enabled: Boolean(visitId),
    queryFn: () =>
      api.get<AssignCandidatesView>(`/admin/scheduling/visits/${visitId}/candidates${suffix}`),
  })
}
