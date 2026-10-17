import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  announcementCounts,
  announcementsWithStatus,
  audienceLabel,
  audienceSize,
  duplicateAnnouncement,
  setAnnouncementStatus,
  statusLabels,
  statusOf,
  statusOrder,
  priorityLabels,
  useAnnouncements,
} from './announcements'
import type {
  Announcement,
  AnnouncementPriority,
  AnnouncementStatus,
} from './announcements'
import { AnnouncementDialog } from './AnnouncementDialog'
import { Formatted } from './Formatted'
import { FileCard, FilePreview } from './files'
import type { StaffGroupId } from '@/features/tasks/groups'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'

/**
 * Announcements — everything broadcast to the agency, in the four states one
 * can be in.
 *
 * It is the Announcements folder of the inbox rather than a screen of its own:
 * the folder holds broadcasts, and a broadcast is worth seeing in every state
 * it passes through, not only once it has gone out. The counts on the tabs are
 * the rows behind them.
 */
export function AnnouncementsBoard() {
  useAnnouncements()
  const [params, setParams] = useSearchParams()
  const [writing, setWriting] = useState(false)
  const [reading, setReading] = useState<Announcement | null>(null)

  const counts = announcementCounts()
  const raw = params.get('status') ?? 'published'
  const status = (
    statusOrder.includes(raw as AnnouncementStatus) ? raw : 'published'
  ) as AnnouncementStatus

  const rows = announcementsWithStatus(status)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Announcements
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Broadcast messages to your organization
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
        >
          <Plus className="size-4.5" strokeWidth={2.2} aria-hidden="true" />
          Create Announcement
        </button>
      </header>

      <div className="border-line border-b">
        <nav
          aria-label="Announcement status"
          className="-mb-px flex flex-wrap items-center gap-1"
        >
          {statusOrder.map((id) => {
            const on = id === status
            return (
              <button
                key={id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  if (id === 'published') next.delete('status')
                  else next.set('status', id)
                  setParams(next)
                }}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold',
                  on
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {statusLabels[id]}
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold',
                    on ? 'bg-brand-600 text-white' : 'bg-sunken text-ink-muted',
                  )}
                >
                  {counts[id]}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-ink-subtle p-6 text-sm">
            Nothing is {statusLabels[status].toLowerCase()}.
          </p>
        ) : (
          <>
            <div
              tabIndex={0}
              role="region"
              aria-label="Announcements table"
              className="hidden overflow-x-auto lg:block"
            >
              <table className="w-full min-w-3xl text-left text-sm">
                <thead className="text-ink-subtle bg-sunken text-xs">
                  <tr>
                    {[
                      'Announcement',
                      'Audience',
                      'Date',
                      'Author',
                      'Status',
                      'Actions',
                    ].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className={cn(
                          'px-3 py-2.5 font-semibold tracking-wide uppercase whitespace-nowrap',
                          col === 'Actions' && 'text-right',
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td className="w-full min-w-48 px-3 py-3.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-ink font-semibold">
                            {a.title}
                          </span>
                          <PriorityChip priority={a.priority} />
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <AudienceChips audiences={a.audiences} />
                      </td>
                      <td className="text-ink-muted px-3 py-3.5 whitespace-nowrap">
                        {dateLine(a)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="flex items-center gap-2">
                          <Avatar
                            name={a.author}
                            decorative
                            className="size-6 text-[0.625rem]"
                          />
                          <span className="text-ink whitespace-nowrap">
                            {a.author}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusChip status={statusOf(a)} />
                      </td>
                      <td className="px-3 py-3.5">
                        <Actions
                          announcement={a}
                          onView={() => setReading(a)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-line divide-y lg:hidden">
              {rows.map((a) => (
                <li key={a.id} className="space-y-2 p-4">
                  <p className="text-ink font-semibold">{a.title}</p>
                  <p className="flex flex-wrap items-center gap-2">
                    <AudienceChips audiences={a.audiences} />
                    <StatusChip status={statusOf(a)} />
                    <PriorityChip priority={a.priority} />
                  </p>
                  <p className="text-ink-muted text-xs">
                    {dateLine(a)} · {a.author}
                  </p>
                  <Actions announcement={a} onView={() => setReading(a)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="text-ink-subtle text-xs">
        A published announcement reaches the inbox — it sits in{' '}
        <Link to="/messages" className="text-brand-700">
          All
        </Link>{' '}
        and in Unread until somebody opens it. A scheduled one goes out when its
        time passes on the app&rsquo;s clock; nothing sends while this is
        closed.
      </p>

      {writing && <AnnouncementDialog onClose={() => setWriting(false)} />}
      {reading && (
        <ReadDialog announcement={reading} onClose={() => setReading(null)} />
      )}
    </div>
  )
}

/** Every group it goes to, with the people they come to between them. */
function AudienceChips({ audiences }: { audiences: StaffGroupId[] }) {
  return (
    <span
      title={`${audienceSize(audiences)} on the roster right now`}
      className="flex flex-wrap items-center gap-1"
    >
      {audiences.map((id) => (
        <span
          key={id}
          className="bg-brand-50 text-brand-700 inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap"
        >
          {audienceLabel(id)}
        </span>
      ))}
    </span>
  )
}

const priorityTints: Record<AnnouncementPriority, string> = {
  normal: '',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
}

/** Marked only when it is above normal — a "Normal" badge says nothing. */
function PriorityChip({ priority }: { priority: AnnouncementPriority }) {
  if (priority === 'normal') return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap',
        priorityTints[priority],
      )}
    >
      {priorityLabels[priority]}
    </span>
  )
}

const statusTints: Record<AnnouncementStatus, string> = {
  draft: 'bg-sunken text-ink-muted',
  scheduled: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-sunken text-ink-muted',
}

function StatusChip({ status }: { status: AnnouncementStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold',
        statusTints[status],
      )}
    >
      {statusLabels[status]}
    </span>
  )
}

function Actions({
  announcement,
  onView,
}: {
  announcement: Announcement
  onView: () => void
}) {
  const status = statusOf(announcement)
  const archived = status === 'archived'

  return (
    <span className="flex items-center justify-end gap-3 text-sm font-medium whitespace-nowrap">
      <button type="button" onClick={onView} className="text-brand-700">
        View
      </button>
      <button
        type="button"
        onClick={() => duplicateAnnouncement(announcement.id)}
        className="text-ink-muted hover:text-ink"
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={() =>
          setAnnouncementStatus(
            announcement.id,
            archived ? 'draft' : 'archived',
          )
        }
        className={archived ? 'text-ink-muted hover:text-ink' : 'text-red-600'}
      >
        {archived ? 'Restore' : 'Archive'}
      </button>
    </span>
  )
}

const dateLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

/** The date says what happened to it, because the column is shared. */
function dateLine(announcement: Announcement): string {
  const day = dateLabel.format(new Date(`${announcement.date}T00:00:00Z`))
  switch (statusOf(announcement)) {
    case 'published':
      return `Published ${day}`
    case 'scheduled':
      return `Scheduled ${day}`
    case 'archived':
      return `Published ${day}`
    default:
      return `Last edited ${day}`
  }
}

function ReadDialog({
  announcement,
  onClose,
}: {
  announcement: Announcement
  onClose: () => void
}) {
  const status = statusOf(announcement)
  const [previewing, setPreviewing] = useState(false)

  return (
    <Drawer
      open
      onClose={onClose}
      title={announcement.title}
      subtitle={`${announcement.audiences.map(audienceLabel).join(', ')} · ${announcement.author}`}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <p className="flex flex-wrap items-center gap-2">
          <AudienceChips audiences={announcement.audiences} />
          <StatusChip status={status} />
          <PriorityChip priority={announcement.priority} />
          <span className="text-ink-subtle text-xs">
            {dateLine(announcement)}
          </span>
        </p>
        <p className="text-ink text-sm whitespace-pre-line">
          <Formatted body={announcement.body} />
        </p>
        {announcement.attachment && (
          <FileCard
            file={announcement.attachment}
            onOpen={() => setPreviewing(true)}
          />
        )}
        {previewing && announcement.attachment && (
          <FilePreview
            file={announcement.attachment}
            context={{
              uploadedBy: announcement.author,
              role: null,
              uploadedAt: dateLine(announcement).replace(/^\w+ /, ''),
              visit: null,
            }}
            onClose={() => setPreviewing(false)}
          />
        )}
        <p className="text-ink-subtle text-xs">
          Goes to {audienceSize(announcement.audiences)} on the roster right now
          — the groups are rules, so the list moves as people join and leave.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {status === 'published' && (
            <Link
              to={`/messages/${announcement.id}`}
              className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
            >
              Open in Messages
            </Link>
          )}
          {(status === 'draft' || status === 'scheduled') && (
            <button
              type="button"
              onClick={() => {
                setAnnouncementStatus(announcement.id, 'published')
                onClose()
              }}
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
            >
              Publish now
            </button>
          )}
        </div>
      </div>
    </Drawer>
  )
}
