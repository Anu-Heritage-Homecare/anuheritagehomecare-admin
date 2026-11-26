/**
 * The caregiver Notes tab, fetched from the back office API
 * (`GET /admin/caregivers/:id/notes`), and the office write that adds a note
 * (`POST /admin/caregivers/:id/notes`). The backend owns the headline counts,
 * the type filter, the free text search, the date range and the paging; the tab
 * passes the active filters through and renders the page it returns.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** The note types the feed carries. VISIT notes come from the visits context. */
export type NoteType = 'VISIT' | 'SUPERVISOR' | 'INTERNAL' | 'TRAINING'

/** The kinds the office can write (a VISIT note is composed on a visit, not here). */
export type NoteWriteKind = 'SUPERVISOR' | 'INTERNAL' | 'TRAINING'

export interface NoteFilters {
  type?: NoteType
  search?: string
  page: number
  pageSize: number
}

/* --------------------------- backend response ----------------------------- */

export interface NoteEntryDto {
  id: string
  type: string
  typeLabel: string
  authorName: string
  authorRole: string | null
  bySelf: boolean
  text: string
  date: string
}

export interface NotesResponseDto {
  counts: { total: number; thisMonth: number; internal: number }
  range: { from: string; to: string }
  notes: {
    total: number
    page: number
    pageSize: number
    rows: NoteEntryDto[]
  }
}

export type CaregiverNotes = NotesResponseDto

/* --------------------------------- hooks ---------------------------------- */

function queryString(filters: NoteFilters): string {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  if (filters.search) params.set('search', filters.search)
  params.set('page', String(filters.page))
  params.set('pageSize', String(filters.pageSize))
  return params.toString()
}

export function useCaregiverNotes(id: string, filters: NoteFilters) {
  return useQuery({
    queryKey: ['admin', 'caregivers', id, 'notes', filters] as const,
    queryFn: (): Promise<CaregiverNotes> =>
      api.get<NotesResponseDto>(`/admin/caregivers/${id}/notes?${queryString(filters)}`),
  })
}

export interface AddNoteBody {
  body: string
  kind: NoteWriteKind
}

/** Add an office note, then refresh every Notes query for this caregiver. */
export function useAddCaregiverNote(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (note: AddNoteBody) => api.post<void>(`/admin/caregivers/${id}/notes`, note),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'caregivers', id, 'notes'] }),
  })
}
