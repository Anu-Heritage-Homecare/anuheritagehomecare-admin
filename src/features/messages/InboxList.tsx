import { Link } from 'react-router-dom'
import { ClipboardCheck, Megaphone } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { tonePill } from '@/lib/tone'
import { awaitingReply, lastMessage, relativeStamp } from './data'
import type { Thread } from './data'
import type { Notice } from './notices'
import { isRead } from './read-state'

const chip =
  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap'

/** Each row is its own card, as the design draws it, with the open one lit. */
const row = 'block rounded-xl border p-3 transition-colors'
const resting = 'border-line hover:bg-canvas'
const open = 'border-brand-200 bg-brand-50 border-l-4 border-l-brand-600'

export function ThreadRow({
  thread,
  to,
  selected,
}: {
  thread: Thread
  to: string
  selected: boolean
}) {
  const last = lastMessage(thread)
  const waiting = awaitingReply(thread)

  return (
    <li>
      <Link
        to={to}
        aria-current={selected ? 'true' : undefined}
        className={cn(row, selected ? open : resting)}
      >
        <span className="flex gap-3">
          <Avatar name={thread.name} decorative className="size-10 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-ink truncate text-sm font-bold">
                {thread.name}
              </span>
              <span
                className={cn(
                  chip,
                  thread.kind === 'caregiver' ? tonePill.green : tonePill.blue,
                  'shrink-0',
                )}
              >
                {thread.kind === 'caregiver' ? 'Caregiver' : 'Family'}
              </span>
              <span className="text-ink-subtle ml-auto shrink-0 text-[0.6875rem] whitespace-nowrap">
                {last ? relativeStamp(last.at, last.time) : ''}
              </span>
              {/* Inbound messages with nothing after them — what is actually
                  owed a reply, counted rather than stored. */}
              {waiting > 0 && (
                <span
                  className="bg-brand-600 grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold text-white tabular-nums"
                  title={`${waiting} message${waiting === 1 ? '' : 's'} waiting on a reply`}
                >
                  {waiting}
                </span>
              )}
            </span>
            <span
              className={cn(
                'mt-1 block truncate text-xs',
                isRead(thread.id) ? 'text-ink-subtle' : 'text-ink-muted',
              )}
            >
              {last
                ? `${last.direction === 'outbound' ? 'You: ' : ''}${
                    last.body.trim() === '' && last.attachment
                      ? last.attachment.name
                      : last.body
                  }`
                : 'No messages yet'}
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}

export function NoticeRow({
  notice,
  to,
  selected,
}: {
  notice: Notice
  to: string
  selected: boolean
}) {
  const visit = notice.kind === 'visit'
  const Icon = visit ? ClipboardCheck : Megaphone

  return (
    <li>
      <Link
        to={to}
        aria-current={selected ? 'true' : undefined}
        className={cn(row, selected ? open : resting)}
      >
        <span className="flex gap-3">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full',
              visit
                ? 'bg-blue-50 text-blue-600'
                : 'bg-violet-50 text-violet-600',
            )}
          >
            <Icon className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-ink truncate text-sm font-bold">
                {notice.reference ?? notice.title}
              </span>
              <span
                className={cn(
                  chip,
                  visit ? tonePill.amber : tonePill.purple,
                  'shrink-0',
                )}
              >
                {visit ? 'Visit' : 'Announcement'}
              </span>
              <span className="text-ink-subtle ml-auto shrink-0 text-[0.6875rem] whitespace-nowrap">
                {relativeStamp(notice.at, notice.time)}
              </span>
            </span>
            <span className="text-ink-subtle mt-1 block truncate text-xs">
              {notice.reference ? notice.title : notice.body}
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}
