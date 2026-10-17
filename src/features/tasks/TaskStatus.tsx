import type { TaskStatus } from '@/features/tasks/status'
import { cn } from '@/lib/cn'

/** The worked-out status, drawn: a filled chip, or plain red where it is late. */
export function StatusCell({ status }: { status: TaskStatus }) {
  return status.pill ? (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        status.tone,
      )}
    >
      {status.label}
    </span>
  ) : (
    <span className={cn('text-xs font-semibold whitespace-nowrap', status.tone)}>
      {status.label}
    </span>
  )
}
