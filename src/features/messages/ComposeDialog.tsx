import { useMemo, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Avatar } from '@/components/ui/Avatar'
import {
  allThreads,
  messageableCaregivers,
  sendMessage,
  startCaregiverThread,
} from './data'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/**
 * Writing to somebody.
 *
 * Two kinds of recipient, because the app holds two: anybody on the roster —
 * whether or not a conversation with them exists yet — and the family contacts
 * a conversation already exists with. A family contact with no thread is not
 * listed: their record is the communication log on the care record, and the
 * Family tab is where a first contact is written.
 */
export function ComposeDialog({
  onClose,
  onSent,
  initialTo = '',
}: {
  onClose: () => void
  onSent: (threadId: string) => void
  /** A recipient value ("caregiver:cg-002") to start addressed to. */
  initialTo?: string
}) {
  const [to, setTo] = useState(initialTo)
  const [body, setBody] = useState('')

  const options = useMemo(() => {
    const threads = allThreads()
    const families = threads
      .filter((t) => t.kind === 'family')
      .map((t) => ({ value: `thread:${t.id}`, name: t.name, role: t.role }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const staff = messageableCaregivers().map((m) => ({
      value: `caregiver:${m.id}`,
      name: m.name,
      role: m.role,
    }))
    return { staff, families }
  }, [])

  const chosen = [...options.staff, ...options.families].find(
    (o) => o.value === to,
  )

  const send = () => {
    if (!chosen || body.trim() === '') return

    if (to.startsWith('caregiver:')) {
      const id = startCaregiverThread(to.slice('caregiver:'.length))
      if (!id) return
      const thread = allThreads().find((t) => t.id === id)
      if (!thread) return
      sendMessage(thread, body)
      onSent(id)
      return
    }

    const id = to.slice('thread:'.length)
    const thread = allThreads().find((t) => t.id === id)
    if (!thread) return
    sendMessage(thread, body)
    onSent(id)
  }

  return (
    <Drawer open onClose={onClose} placement="center" title="New message">
      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <span className="text-ink text-sm font-medium">To</span>
          <SelectBox
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">Pick somebody</option>
            <optgroup label="Caregivers">
              {options.staff.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.name} — {o.role}
                </option>
              ))}
            </optgroup>
            {options.families.length > 0 && (
              <optgroup label="Family contacts">
                {options.families.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.name} — {o.role}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectBox>
        </label>

        {chosen && (
          <p className="bg-canvas flex items-center gap-2.5 rounded-lg p-3">
            <Avatar
              name={chosen.name}
              decorative
              className="size-8 text-[0.6875rem]"
            />
            <span className="min-w-0">
              <span className="text-ink block text-sm font-semibold break-words">
                {chosen.name}
              </span>
              <span className="text-ink-subtle block text-sm break-words">
                {chosen.role}
              </span>
            </span>
          </p>
        )}

        <label className="block">
          <span className="text-ink text-sm font-medium">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write the message"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!chosen || body.trim() === ''}
            onClick={send}
            className={cn(
              'bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Send
          </button>
        </div>
      </div>
    </Drawer>
  )
}
