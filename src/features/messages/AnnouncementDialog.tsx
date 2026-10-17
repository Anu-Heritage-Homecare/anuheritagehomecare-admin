import { useRef, useState } from 'react'
import {
  AtSign,
  Bold,
  Italic,
  Paperclip,
  Smile,
  Underline,
  X,
} from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { staffGroups } from '@/features/tasks/groups'
import type { StaffGroupId } from '@/features/tasks/groups'
import { staffMembers } from '@/features/caregivers/staff'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { TODAY } from '@/lib/today'
import { cn } from '@/lib/cn'
import { richToPlain } from './rich-text'
import type { Mark } from './rich-text'
import { RichTextArea } from './RichTextArea'
import type { RichTextHandle } from './RichTextArea'
import { createAnnouncement, priorityLabels } from './announcements'
import type { AnnouncementPriority } from './announcements'
import type { Attachment } from './data'
import { SelectBox } from '@/components/ui/SelectBox'

const quickEmoji = ['\u{1F44D}', '\u{1F642}', '\u{1F64F}', '✅', '⚠️', '❤️']

/**
 * Writing a broadcast.
 *
 * Every control the design draws does what it says. The formatting buttons put
 * marks in the message that every screen showing an announcement renders back;
 * the paperclip attaches a real file; the audience is one or more of the
 * roster groups, and the line under it counts the people they actually come to
 * — deduplicated, because every caregiver is also all staff.
 */
export function AnnouncementDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audiences, setAudiences] = useState<StaffGroupId[]>(['all-staff'])
  const [priority, setPriority] = useState<AnnouncementPriority>('normal')
  const [file, setFile] = useState<Attachment | null>(null)
  const [later, setLater] = useState(false)
  const [date, setDate] = useState(TODAY)
  const [time, setTime] = useState('09:00')

  const editor = useRef<RichTextHandle>(null)
  const picker = useRef<HTMLInputElement>(null)

  const ready =
    title.trim() !== '' &&
    richToPlain(body).trim() !== '' &&
    audiences.length > 0
  const unchosen = staffGroups.filter((g) => !audiences.includes(g.id))

  const mark = (which: Mark) => editor.current?.toggle(which)
  const insert = (text: string) => editor.current?.insert(text)

  const mentions: MenuItem[] = staffMembers
    .filter((m) => m.status === 'active')
    .slice(0, 8)
    .map((m) => ({
      id: m.id,
      label: `@${m.name}`,
      onSelect: () => insert(`@${m.name}`),
    }))

  const save = (publish: boolean) => {
    createAnnouncement({
      title,
      body,
      audiences,
      priority,
      attachment: file ?? undefined,
      when: publish
        ? later
          ? { kind: 'schedule', date, time }
          : { kind: 'now' }
        : { kind: 'draft' },
    })
    onClose()
  }

  return (
    <Drawer open onClose={onClose} title="Create Announcement">
      <form
        className="flex min-h-full flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) save(true)
        }}
      >
        <div className="flex-1 space-y-4 p-4">
          <label className="block">
            <span className="text-ink text-sm font-semibold">
              Announcement Title <Required />
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Policy Update or Safety Guidelines"
              className="border-line focus:border-brand-500 placeholder:text-ink-subtle mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            />
          </label>

          <div>
            <span className="text-ink text-sm font-semibold">
              Target Audience <Required />
            </span>
            <div className="border-line focus-within:border-brand-500 mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border p-2">
              {audiences.map((id) => (
                <span
                  key={id}
                  className="bg-brand-50 text-brand-700 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold"
                >
                  {staffGroups.find((g) => g.id === id)?.label}
                  <button
                    type="button"
                    onClick={() =>
                      setAudiences((list) => list.filter((g) => g !== id))
                    }
                    className="text-brand-700/70 hover:text-brand-700"
                  >
                    <X
                      className="size-3.5"
                      strokeWidth={2.4}
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      Remove {staffGroups.find((g) => g.id === id)?.label}
                    </span>
                  </button>
                </span>
              ))}
              {unchosen.length > 0 && (
                <SelectBox
                  value=""
                  onChange={(e) => {
                    const picked = e.target.value as StaffGroupId
                    if (picked) setAudiences((list) => [...list, picked])
                  }}
                  aria-label="Add a group"
                  className="text-ink-subtle min-h-8 min-w-28 rounded-md bg-transparent text-xs focus:outline-none"
                >
                  <option value="">Add a group…</option>
                  {unchosen.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </SelectBox>
              )}
            </div>
          </div>

          <label className="block">
            <span className="text-ink text-sm font-semibold">Priority</span>
            <SelectBox
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as AnnouncementPriority)
              }
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              {(Object.keys(priorityLabels) as AnnouncementPriority[]).map(
                (id) => (
                  <option key={id} value={id}>
                    {priorityLabels[id]}
                  </option>
                ),
              )}
            </SelectBox>
          </label>

          <div>
            <span className="text-ink text-sm font-semibold">
              Message <Required />
            </span>
            <div className="border-line focus-within:border-brand-500 mt-1.5 overflow-hidden rounded-lg border">
              <div className="border-line bg-sunken flex items-center gap-1 border-b px-2 py-1.5">
                <Tool icon={Bold} label="Bold" onClick={() => mark('bold')} />
                <Tool
                  icon={Italic}
                  label="Italic"
                  onClick={() => mark('italic')}
                />
                <Tool
                  icon={Underline}
                  label="Underline"
                  onClick={() => mark('underline')}
                />
                <span aria-hidden="true" className="bg-line mx-1 h-5 w-px" />
                <DropdownMenu
                  label="Insert an emoji"
                  icon={Smile}
                  align="start"
                  triggerClassName="text-ink-muted hover:bg-surface hover:text-ink grid size-8 shrink-0 place-items-center rounded-md"
                  items={quickEmoji.map((emoji) => ({
                    id: emoji,
                    label: emoji,
                    onSelect: () => insert(emoji),
                  }))}
                />
                <input
                  ref={picker}
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0]
                    e.target.value = ''
                    if (!picked) return
                    if (file) URL.revokeObjectURL(file.url)
                    setFile({
                      name: picked.name,
                      size: picked.size,
                      url: URL.createObjectURL(picked),
                    })
                  }}
                />
                <Tool
                  icon={Paperclip}
                  label="Attach a file"
                  onClick={() => picker.current?.click()}
                />
                <DropdownMenu
                  label="Mention somebody"
                  icon={AtSign}
                  align="start"
                  triggerClassName="text-ink-muted hover:bg-surface hover:text-ink grid size-8 shrink-0 place-items-center rounded-md"
                  items={mentions}
                />
              </div>
              <RichTextArea
                handle={editor}
                value={body}
                onChange={setBody}
                label="Message"
                placeholder="Write your announcement content here..."
                className="min-h-56"
              />
            </div>
            {file && (
              <p className="border-line mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
                <Paperclip
                  className="text-ink-subtle size-3.5 shrink-0"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <span className="text-ink min-w-0 truncate font-medium">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(file.url)
                    setFile(null)
                  }}
                  className="text-ink-subtle hover:text-ink shrink-0"
                >
                  <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  <span className="sr-only">Remove {file.name}</span>
                </button>
              </p>
            )}
          </div>

          <fieldset>
            <legend className="text-ink text-sm font-semibold">
              Publish Schedule
            </legend>
            <div className="mt-1.5 space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule"
                  checked={!later}
                  onChange={() => setLater(false)}
                />
                Publish immediately
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule"
                  checked={later}
                  onChange={() => setLater(true)}
                />
                Schedule for later
              </label>
            </div>
            {later && (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Date"
                    className="border-line focus:border-brand-500 h-11 rounded-lg border px-3 text-sm"
                  />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    aria-label="Time"
                    className="border-line focus:border-brand-500 h-11 rounded-lg border px-3 text-sm"
                  />
                </div>
                <span className="text-ink-subtle block text-xs">
                  It goes out when that moment passes on the app&rsquo;s clock —
                  there is no server holding it until then.
                </span>
              </div>
            )}
          </fieldset>
        </div>

        <div className="border-line bg-surface sticky bottom-0 flex flex-wrap justify-end gap-2 border-t p-4">
          <button
            type="button"
            disabled={title.trim() === ''}
            onClick={() => save(false)}
            className="border-control text-ink hover:bg-sunken disabled:text-ink-subtle inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={!ready}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
          >
            {later ? 'Schedule' : 'Publish'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}

function Required() {
  return (
    <span className="text-red-600" aria-hidden="true">
      *
    </span>
  )
}

function Tool({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'text-ink-muted hover:bg-surface hover:text-ink grid size-8 shrink-0 place-items-center rounded-md',
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  )
}
