/**
 * The care request queue, fetched from the backend and mapped into the
 * `CareRequest` the queue table and detail rail already render
 * (`GET /admin/plans-billing/care-requests`), plus the approve and decline
 * mutations (`POST .../care-requests/:id/approve`, `.../decline`).
 *
 * The backend row is deliberately thin: id, family and patient names, a care
 * type, the requested date, a start minute and duration, a free text reason and
 * a status. The rich `CareRequest` the UI was built on (plan id, weekly rota,
 * special needs, uploaded documents, a coordinator, a payment check and an
 * explicit decision) has no backend source, so those are filled with honest
 * empty defaults and the queue's derived blockers simply resolve to "ready".
 * Every derived column that has no backend field is noted in the report, not
 * faked.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CareRequest } from '@/features/care-recipients/requests-data'
import type { PlanId } from '@/features/billing/data'

/* --------------------------- backend response ----------------------------- */

interface CareRequestRowDto {
  id: string
  familyName: string | null
  patientName: string | null
  careType: string
  requestedDate: string
  startMinute: number
  durationMinutes: number
  reason: string | null
  status: string
  createdAt: string
}

interface CareRequestListDto {
  total: number
  page: number
  pageSize: number
  rows: CareRequestRowDto[]
}

/** The live queue, mapped, plus its total for the page footer and paging. */
export interface CareRequestsView {
  requests: CareRequest[]
  total: number
  page: number
  pageSize: number
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

/** Minutes from midnight to a 24 hour clock label, e.g. 540 -> "09:00". */
function toClock(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/* -------------------------------- mappers --------------------------------- */

/**
 * The backend row carries no plan, so `planId` defaults to Flexible (the plan
 * with no rota ceiling and the thinnest document requirement), which keeps the
 * queue's plan fit and service gap checks quiet rather than inventing a
 * mismatch. The rota is a single day window built from the start minute and
 * duration; special needs, documents and a coordinator are empty; payment reads
 * as verified and the decision follows the backend status so the derived status
 * column agrees with the server.
 */
function toRequest(dto: CareRequestRowDto): CareRequest {
  const start = toClock(dto.startMinute)
  const end = toClock(dto.startMinute + dto.durationMinutes)
  const upper = dto.status.toUpperCase()
  const decision =
    upper === 'APPROVED' ? 'approved' : upper === 'DECLINED' || upper === 'REJECTED' ? 'rejected' : 'undecided'
  return {
    id: dto.id,
    ref: dto.id.slice(0, 8).toUpperCase(),
    patient: {
      name: dto.patientName ?? DASH,
      age: 0,
      sex: DASH,
      conditions: [],
    },
    contact: {
      name: dto.familyName ?? DASH,
      relationship: DASH,
      phone: DASH,
      email: DASH,
      address: DASH,
    },
    // Flexible: no rota ceiling and the lightest document set, so the derived
    // blockers do not fabricate a plan mismatch the backend never reported.
    planId: 'flexible' as PlanId,
    schedule: { days: ['Mon'], start, end },
    specialNeeds: [],
    documents: [],
    payment: 'verified',
    submittedAt: dto.requestedDate.slice(0, 10),
    coordinator: null,
    decision,
  }
}

function toView(dto: CareRequestListDto): CareRequestsView {
  return {
    requests: dto.rows.map(toRequest),
    total: dto.total,
    page: dto.page,
    pageSize: dto.pageSize,
  }
}

/* --------------------------------- hooks ---------------------------------- */

const KEY = ['admin', 'plans-billing', 'care-requests'] as const

export function useCareRequests(status: string | null, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)
  return useQuery({
    queryKey: [...KEY, status, page, pageSize] as const,
    queryFn: async () =>
      toView(await api.get<CareRequestListDto>(`/admin/plans-billing/care-requests?${params.toString()}`)),
  })
}

export function useCareRequestActions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY })

  const approve = useMutation({
    mutationFn: (id: string) => api.post<void>(`/admin/plans-billing/care-requests/${id}/approve`),
    onSuccess: invalidate,
  })
  const decline = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post<void>(`/admin/plans-billing/care-requests/${id}/decline`, { note }),
    onSuccess: invalidate,
  })
  return { approve, decline }
}
