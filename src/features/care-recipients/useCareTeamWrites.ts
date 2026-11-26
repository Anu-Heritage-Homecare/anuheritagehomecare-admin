/**
 * The care team write actions for a recipient: assign a caregiver to a seat,
 * revise an existing assignment, and remove one. All three invalidate the
 * recipient caregivers query on success so the team, coverage grid and history
 * re-read. The calling page owns busy and error state.
 *
 * Backend routes:
 *   assign  POST   /admin/care-recipients/:id/caregivers
 *   revise  PUT    /admin/care-recipients/:id/caregivers/:assignmentId
 *   remove  DELETE /admin/care-recipients/:id/caregivers/:assignmentId  (reason body)
 *
 * The role is the backend `CareTeamRole` enum: PRIMARY, BACKUP or COORDINATOR.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CareTeamRoleToken = 'PRIMARY' | 'BACKUP' | 'COORDINATOR'

export interface AssignCaregiverBody {
  caregiverId: string
  role: CareTeamRoleToken
  specialization?: string
  scheduleLabel?: string
  // Optional for a first assignment; the reassign flow still supplies it.
  reason?: string
}

export interface ReviseAssignmentBody {
  role?: CareTeamRoleToken
  specialization?: string
  scheduleLabel?: string
}

export function useCareTeamWrites(recipientId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['admin', 'care-recipients', recipientId, 'caregivers'],
    })

  const assign = useMutation({
    mutationFn: (body: AssignCaregiverBody) =>
      api.post<{ id: string }>(`/admin/care-recipients/${recipientId}/caregivers`, body),
    onSuccess: invalidate,
  })

  const revise = useMutation({
    mutationFn: ({ assignmentId, body }: { assignmentId: string; body: ReviseAssignmentBody }) =>
      api.put<{ id: string }>(
        `/admin/care-recipients/${recipientId}/caregivers/${assignmentId}`,
        body,
      ),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      api.delete<{ id: string }>(
        `/admin/care-recipients/${recipientId}/caregivers/${assignmentId}`,
        { reason },
      ),
    onSuccess: invalidate,
  })

  return { assign, revise, remove }
}
