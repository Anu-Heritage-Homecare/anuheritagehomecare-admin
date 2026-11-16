/**
 * Writes the care recipient core identity profile
 * (`PUT /admin/care-recipients/:id`). The mutating page owns busy and error
 * state; on success the recipient's profile query is invalidated so the
 * Overview, header and directory re-read the saved record.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface UpdateRecipientProfileBody {
  name: string
  gender: 'MALE' | 'FEMALE'
  dateOfBirth: string
  city: string
  state: string
  fullAddress: string
  relationship: string
  livingSituation: string
  photoKey?: string
  latitude?: number
  longitude?: number
}

export function useUpdateRecipientProfile(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateRecipientProfileBody) =>
      api.put<{ id: string }>(`/admin/care-recipients/${id}`, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'care-recipients', id] }),
  })
}
