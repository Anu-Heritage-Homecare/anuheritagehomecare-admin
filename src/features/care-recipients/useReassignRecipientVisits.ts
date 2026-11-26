/**
 * Moves or releases a recipient's upcoming visits when a caregiver leaves or is
 * swapped on the care team
 * (`POST /admin/scheduling/recipients/:id/reassign-visits`). Only scheduled
 * visits from today onward are affected; omit `toCaregiverId` to unassign them.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ReassignVisitsBody {
  fromCaregiverId: string
  toCaregiverId?: string
}

export interface ReassignVisitsResult {
  updated: number
}

export function useReassignRecipientVisits(recipientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ReassignVisitsBody) =>
      api.post<ReassignVisitsResult>(
        `/admin/scheduling/recipients/${recipientId}/reassign-visits`,
        body,
      ),
    onSuccess: () => {
      for (const key of ['visits', 'caregivers'] as const) {
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'care-recipients', recipientId, key],
        })
      }
    },
  })
}
