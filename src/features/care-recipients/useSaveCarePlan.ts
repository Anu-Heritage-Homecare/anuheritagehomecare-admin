/**
 * Saves a recipient's care plan to the backend. The editor edits goals, the daily
 * schedule, and medical/behavioural instructions together; each is a separate
 * replace-and-revise endpoint, so a save writes all three:
 *   PUT /admin/care-recipients/:id/care-plan/goals
 *   PUT /admin/care-recipients/:id/care-plan/schedule
 *   PUT /admin/care-recipients/:id/care-plan/instructions
 * Every write records a revision; on success the care plan read is invalidated.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { GoalStatus, InstructionLevel } from './care-plan-data'

const GOAL_STATUS: Record<GoalStatus, 'ON_TRACK' | 'NEEDS_ATTENTION' | 'AT_RISK'> = {
  'on-track': 'ON_TRACK',
  'needs-attention': 'NEEDS_ATTENTION',
  'at-risk': 'AT_RISK',
}

const SEVERITY: Record<InstructionLevel, 'NORMAL' | 'WARNING' | 'CRITICAL'> = {
  standard: 'NORMAL',
  caution: 'WARNING',
  critical: 'CRITICAL',
}

export interface SaveCarePlanInput {
  revisionNote?: string
  goals: { label: string; progressPercent: number; status: GoalStatus }[]
  blocks: { startMinute: number; title: string; description: string }[]
  medical: { text: string; level: InstructionLevel }[]
  behavioural: { text: string; level: InstructionLevel }[]
}

export function useSaveCarePlan(recipientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveCarePlanInput) => {
      const base = `/admin/care-recipients/${recipientId}/care-plan`
      const revisionNote = input.revisionNote
      await api.put(`${base}/goals`, {
        revisionNote,
        goals: input.goals.map((g) => ({
          label: g.label,
          progressPercent: g.progressPercent,
          status: GOAL_STATUS[g.status],
        })),
      })
      await api.put(`${base}/schedule`, { revisionNote, blocks: input.blocks })
      await api.put(`${base}/instructions`, {
        revisionNote,
        instructions: [
          ...input.medical.map((i) => ({
            category: 'MEDICAL' as const,
            text: i.text,
            severity: SEVERITY[i.level],
          })),
          ...input.behavioural.map((i) => ({
            category: 'BEHAVIORAL' as const,
            text: i.text,
            severity: SEVERITY[i.level],
          })),
        ],
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'care-recipients', recipientId, 'care-plan'],
      })
    },
  })
}
