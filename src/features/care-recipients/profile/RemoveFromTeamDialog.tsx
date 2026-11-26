import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { SelectBox } from '@/components/ui/SelectBox'
import { ApiError } from '@/lib/api'
import { useCareTeamWrites } from '../useCareTeamWrites'

const removalReasons = [
  'Caregiver leaving or on leave',
  'Family request',
  'No longer needed',
  'Schedule conflict',
  'Performance concern',
  'Reassigned elsewhere',
]

/**
 * Removes a caregiver from a recipient's care team without replacing them
 * (`DELETE /admin/care-recipients/:id/caregivers/:assignmentId`). A reason is
 * required because a removal is a real change recorded on the assignment history.
 */
export function RemoveFromTeamDialog({
  recipientId,
  assignmentId,
  caregiverName,
  open,
  onClose,
}: {
  recipientId: string
  assignmentId: string
  caregiverName: string
  open: boolean
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const { remove } = useCareTeamWrites(recipientId)

  const saveError = remove.isError
    ? remove.error instanceof ApiError
      ? remove.error.message
      : 'Could not remove the caregiver. Please try again.'
    : null

  const close = () => {
    setReason('')
    remove.reset()
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Remove from team"
      subtitle={`${caregiverName} will be taken off this care team`}
    >
      <div className="space-y-5 p-4">
        <p className="text-ink-muted text-sm">
          This removes {caregiverName} from the care team. It does not delete their record or past
          visits. Pick a reason to record on the assignment history.
        </p>

        {saveError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </div>
        )}

        <label className="block">
          <span className="text-ink text-sm font-semibold">Reason</span>
          <SelectBox
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-control mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">Select a reason</option>
            {removalReasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectBox>
        </label>

        <div className="border-line flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="border-line bg-surface text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason || remove.isPending}
            onClick={() =>
              remove.mutate({ assignmentId, reason }, { onSuccess: close })
            }
            className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {remove.isPending ? 'Removing…' : 'Remove from team'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}
