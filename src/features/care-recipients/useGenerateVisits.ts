/**
 * Generates visits from a care recipient's recurring care schedule
 * (`POST /admin/scheduling/recipients/:id/generate-visits`). The office picks a
 * date range; the server creates one visit per scheduled weekday for the primary
 * caregiver (or leaves them unassigned when there is none) and skips any day that
 * already has a visit, so it is safe to re-run. On success the recipient's visit
 * and care team reads are invalidated so the new visits appear.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface GenerateVisitsBody {
  from: string
  to: string
  caregiverId?: string
}

export interface GenerateVisitsResult {
  created: number
  skipped: number
  caregiverId: string | null
}

export function useGenerateVisits(recipientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: GenerateVisitsBody) =>
      api.post<GenerateVisitsResult>(
        `/admin/scheduling/recipients/${recipientId}/generate-visits`,
        body,
      ),
    onSuccess: () => {
      for (const key of ['visits', 'caregivers'] as const) {
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'care-recipients', recipientId, key],
        })
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'care-recipients', recipientId] })
    },
  })
}
