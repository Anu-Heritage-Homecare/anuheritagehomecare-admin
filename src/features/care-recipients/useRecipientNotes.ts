/**
 * The Notes tab, fetched from the backend and mapped into the `CareNoteEntry`
 * list the notes panels already render
 * (`GET /admin/care-recipients/:id/notes`), plus the acknowledge and flag
 * mutations the tab exposes.
 *
 * The tab keeps its own client side category, author, search and sort over the
 * first page it is given (simpler than threading each as a server param, and
 * the pill counts already recompute from the mapped rows). `acknowledged` and
 * `flaggedForReview` are read from the DTO as the source of truth rather than a
 * local simulation; the mutations invalidate the notes query so the tab
 * re-reads them.
 *
 * Fields the backend does not carry (the incident detail union, a note's own
 * flag colour beyond `flaggedForReview`) are mapped to the plain note shape;
 * an UPPER_SNAKE backend category with no UI equivalent falls back to `visit`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CareNoteEntry, NoteCategory } from './notes-data'

/* --------------------------- backend response ----------------------------- */

interface NoteItemDto {
  id: string
  category: string
  content: string
  authorName: string
  authorRole: string | null
  postedAt: string
  flaggedForReview: boolean
  acknowledged: boolean
  acknowledgedAt: string | null
  commentCount: number
  attachmentCount: number
}

export interface NotesDto {
  summary: { totalNotes: number; thisMonth: number; flaggedForReview: number }
  all: number
  categories: { category: string; count: number }[]
  authors: string[]
  page: {
    items: NoteItemDto[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

/** A mapped note that also carries what the mutations need. An intersection,
 *  not an interface: `CareNoteEntry` is a discriminated union. */
export type NoteEntry = CareNoteEntry & { acknowledged: boolean }

/* -------------------------------- helpers --------------------------------- */

const CATEGORY: Record<string, NoteCategory> = {
  VISIT: 'visit',
  CLINICAL: 'clinical',
  COORDINATOR: 'coordinator',
  FAMILY: 'family',
  INCIDENT: 'incident',
}

function toCategory(value: string): NoteCategory {
  return CATEGORY[value.toUpperCase()] ?? 'visit'
}

/* -------------------------------- mapper ---------------------------------- */

function toNote(dto: NoteItemDto): NoteEntry {
  const category = toCategory(dto.category)
  const base = {
    id: dto.id,
    author: dto.authorName,
    authorRole: dto.authorRole ?? 'Care team',
    at: dto.postedAt,
    body: dto.content,
    flagged: dto.flaggedForReview || undefined,
    comments: dto.commentCount,
    attachments: dto.attachmentCount,
    acknowledged: dto.acknowledged,
  }
  // The stored note type is a union: an incident always carries its detail, so
  // the backend's plain record maps to a non incident category here. A backend
  // incident with no detail payload is surfaced as a clinical note instead.
  if (category === 'incident') {
    return { ...base, category: 'clinical' }
  }
  return { ...base, category }
}

export function useRecipientNotes(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'notes'] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      (await api.get<NotesDto>(`/admin/care-recipients/${id}/notes`)).page.items.map(
        toNote,
      ),
  })
}

/* -------------------------------- mutations ------------------------------- */

export function useAcknowledgeNote(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) =>
      api.post<void>(`/admin/care-recipients/${id}/notes/${noteId}/acknowledge`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'care-recipients', id, 'notes'],
      }),
  })
}
