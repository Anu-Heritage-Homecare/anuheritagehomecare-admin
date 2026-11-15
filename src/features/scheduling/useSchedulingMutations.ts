/**
 * The write surface of the Scheduling screens: create a visit, assign or
 * reassign a caregiver, reschedule, edit, cancel, and the coordinator note
 * actions. Each mutation invalidates the scheduling queries so the board, the
 * visit detail and the candidate list re-fetch.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ScheduleVisitInput {
  careRecipientId: string
  caregiverId?: string
  scheduledDate: string
  startMinute: number
  endMinute?: number
  visitType: string
  priority?: string
  specialInstructions?: string[]
}

export interface RescheduleInput {
  scheduledDate: string
  startMinute: number
  endMinute: number
}

/** Mutations for the whole Scheduling area; pass the visit id to refresh its detail. */
export function useSchedulingMutations(visitId?: string) {
  const queryClient = useQueryClient()
  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'scheduling'] })
  }

  const create = useMutation({
    mutationFn: (input: ScheduleVisitInput) =>
      api.post<{ id: string }>('/admin/scheduling/visits', input),
    onSuccess: invalidate,
  })

  const assign = useMutation({
    mutationFn: ({ id, caregiverId }: { id: string; caregiverId: string }) =>
      api.post<void>(`/admin/scheduling/visits/${id}/assign`, { caregiverId }),
    onSuccess: invalidate,
  })

  const reschedule = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & RescheduleInput) =>
      api.post<void>(`/admin/scheduling/visits/${id}/reschedule`, body),
    onSuccess: invalidate,
  })

  const cancel = useMutation({
    mutationFn: (id: string) => api.post<void>(`/admin/scheduling/visits/${id}/cancel`),
    onSuccess: invalidate,
  })

  const addNote = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.post<{ id: string }>(`/admin/scheduling/visits/${id}/notes`, { text }),
    onSuccess: invalidate,
  })

  const acknowledgeNote = useMutation({
    mutationFn: ({ id, noteId }: { id: string; noteId: string }) =>
      api.post<void>(`/admin/scheduling/visits/${id}/notes/${noteId}/acknowledge`),
    onSuccess: invalidate,
  })

  const flagNote = useMutation({
    mutationFn: ({ id, noteId }: { id: string; noteId: string }) =>
      api.post<void>(`/admin/scheduling/visits/${id}/notes/${noteId}/flag`),
    onSuccess: invalidate,
  })

  const editNote = useMutation({
    mutationFn: ({ id, noteId, text }: { id: string; noteId: string; text: string }) =>
      api.put<void>(`/admin/scheduling/visits/${id}/notes/${noteId}`, { text }),
    onSuccess: invalidate,
  })

  const replyNote = useMutation({
    mutationFn: ({ id, noteId, text }: { id: string; noteId: string; text: string }) =>
      api.post<{ id: string }>(`/admin/scheduling/visits/${id}/notes/${noteId}/replies`, {
        text,
      }),
    onSuccess: invalidate,
  })

  void visitId // detail refresh falls under the ['admin','scheduling'] invalidation

  return {
    create,
    assign,
    reschedule,
    cancel,
    addNote,
    acknowledgeNote,
    flagNote,
    editNote,
    replyNote,
  }
}
