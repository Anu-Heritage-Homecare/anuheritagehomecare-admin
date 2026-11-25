/**
 * Creates a care recipient (`POST /admin/care-recipients`). The drawer owns busy
 * and error state; on success the directory list is invalidated so the new row
 * appears.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AddRecipientBody {
  ownerId: string
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
  priority?: string
}

export function useAddRecipient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AddRecipientBody) =>
      api.post<{ id: string }>('/admin/care-recipients', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'care-recipients', 'list'] }),
  })
}
