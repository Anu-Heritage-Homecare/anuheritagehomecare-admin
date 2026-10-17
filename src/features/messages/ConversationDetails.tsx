import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Download,
  LogOut,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { cn } from '@/lib/cn'
import { formatClock, formatThreadDay, onVisitNow, threadStatus } from './data'
import type { Attachment, Message, Thread, ThreadContext } from './data'
import { FilePreview, FileTile } from './files'
import { fileContextFor, fileSize } from './file-data'
import {
  hasLeft,
  isArchived,
  isMuted,
  setArchived,
  setLeft,
  setMuted,
  useThreadFlags,
} from './flags'

/** How many files the panel shows before "See All". */
const FILE_PREVIEW = 3

/**
 * The conversation's own panel: who is on it, what it is about, what has been
 * sent through it, and what a coordinator can do to it.
 *
 * Everything above Quick actions is read off the thread and the care record —
 * there is no per-conversation store behind it beyond the three flags.
 */
export function ConversationDetails({
  thread,
  context,
}: {
  thread: Thread
  context: ThreadContext | undefined
}) {
  useThreadFlags()
  const navigate = useNavigate()
  const archived = isArchived(thread.id)
  const muted = isMuted(thread.id)
  const left = hasLeft(thread.id)
  const [leaving, setLeaving] = useState(false)
  const [openFile, setOpenFile] = useState<Message | null>(null)
  const [allFiles, setAllFiles] = useState(false)

  const files = thread.messages.filter((m) => m.attachment)
  const shown = allFiles ? files : files.slice(0, FILE_PREVIEW)
  const status = threadStatus(thread)

  return (
    <aside
      aria-label="Conversation details"
      className="bg-surface flex min-h-0 flex-col overflow-y-auto lg:h-full"
    >
      <h2 className="text-ink px-4 pt-4 pb-3 text-base font-bold tracking-tight">
        Conversation Details
      </h2>

      <div className="px-4 pb-4">
        <Section title="Participants">
          <ul className="space-y-1">
            <Participant
              name={thread.name}
              role={
                status
                  ? `Caregiver (${
                      status === 'active'
                        ? onVisitNow(thread)
                          ? 'Active, on a visit now'
                          : 'Active'
                        : status === 'on-leave'
                          ? 'On leave'
                          : 'Not active'
                    })`
                  : thread.role
              }
              /* The design's green dot. Nothing here knows who is signed in,
                 so it shows the standing the roster keeps. */
              dot={
                status === 'active'
                  ? 'bg-emerald-500'
                  : status === 'on-leave'
                    ? 'bg-amber-500'
                    : null
              }
              to={thread.to}
            />
            <Participant name={SIGNED_IN} role={`${SIGNED_IN_ROLE} (You)`} />
          </ul>
        </Section>

        {context && (
          <Section title="Linked record" ruled>
            <div className="border-line bg-canvas rounded-xl border p-3">
              <p className="flex items-center gap-2.5">
                <Avatar
                  name={context.recipient.name}
                  decorative
                  className="size-8 text-[0.6875rem]"
                />
                <span className="text-ink min-w-0 text-sm font-bold break-words">
                  {context.recipient.name}
                </span>
              </p>
              <p className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink-muted text-sm">Care Recipient</span>
                <Link
                  to={`/care-recipients/${context.recipient.id}/overview`}
                  className="text-brand-700 text-sm font-semibold hover:underline"
                >
                  View Profile
                </Link>
              </p>
            </div>
          </Section>
        )}

        {context?.next && (
          <Section title="Linked visit" ruled>
            <div className="border-line bg-canvas rounded-xl border p-3">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={`/scheduling/visits/${context.next.id}`}
                  className="text-ink hover:text-brand-700 text-sm font-bold"
                >
                  {context.next.reference}
                </Link>
                <span className="bg-brand-50 text-brand-700 rounded-md px-2 py-0.5 text-xs font-semibold">
                  {context.next.type}
                </span>
              </p>
              <p className="text-ink-muted mt-1.5 text-sm">
                {formatThreadDay(context.next.date)},{' '}
                {formatClock(context.next.start)} -{' '}
                {formatClock(context.next.end)}
              </p>
            </div>
          </Section>
        )}

        <Section
          title="Shared files"
          ruled
          aside={
            files.length > FILE_PREVIEW && !allFiles ? (
              <button
                type="button"
                onClick={() => setAllFiles(true)}
                className="text-brand-700 text-sm font-semibold hover:underline"
              >
                See All
              </button>
            ) : null
          }
        >
          {files.length === 0 ? (
            <p className="text-ink-subtle text-xs">
              Nothing has been attached to this conversation.
            </p>
          ) : (
            <ul className="space-y-1">
              {shown.map((message) => (
                <FileRow
                  key={message.id}
                  file={message.attachment!}
                  author={message.author}
                  onOpen={() => setOpenFile(message)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Quick actions" ruled>
          <div className="grid grid-cols-2 gap-2">
            <Action
              icon={archived ? ArchiveRestore : Archive}
              label={archived ? 'Restore' : 'Archive'}
              onClick={() => setArchived(thread.id, !archived)}
            />
            <Action
              icon={BellOff}
              label={muted ? 'Unmute' : 'Mute'}
              active={muted}
              onClick={() => setMuted(thread.id, !muted)}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              left ? setLeft(thread.id, false) : setLeaving(true)
            }
            className={cn(
              'mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-semibold',
              left
                ? 'border-control text-ink hover:bg-sunken border'
                : 'bg-red-50 text-red-700 hover:bg-red-100',
            )}
          >
            <LogOut
              className="size-4 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            {left ? 'Rejoin Conversation' : 'Leave Conversation'}
          </button>
        </Section>
      </div>

      {openFile?.attachment && (
        <FilePreview
          file={openFile.attachment}
          context={fileContextFor(thread, openFile)}
          onClose={() => setOpenFile(null)}
        />
      )}

      {leaving && (
        <Drawer
          open
          onClose={() => setLeaving(false)}
          placement="center"
          title="Leave this conversation?"
          subtitle={thread.name}
        >
          <div className="space-y-4 p-4 sm:p-5">
            <p className="text-ink-muted text-sm">
              It comes out of your folders and you stop being on it — no
              composer, and nothing new from {thread.name} reaches your inbox.
              Nothing is deleted and nobody is told; the conversation stays on
              its own link, and you can rejoin it from there.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaving(false)}
                className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeft(thread.id, true)
                  setLeaving(false)
                  navigate('/messages')
                }}
                className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
              >
                Leave conversation
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </aside>
  )
}

function Section({
  title,
  aside,
  ruled = false,
  children,
}: {
  title: string
  aside?: React.ReactNode
  /** A rule above, separating it from the section before. */
  ruled?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={cn(ruled && 'border-line mt-5 border-t pt-5')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-ink-subtle text-[0.6875rem] font-semibold tracking-wider uppercase">
          {title}
        </h3>
        {aside}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

function Participant({
  name,
  role,
  dot,
  to,
}: {
  name: string
  role: string
  dot?: string | null
  to?: string
}) {
  const body = (
    <>
      <span className="relative shrink-0">
        <Avatar name={name} decorative className="size-9 text-xs" />
        {dot && (
          <span
            className={cn(
              'border-surface absolute right-0 bottom-0 size-2.5 rounded-full border-2',
              dot,
            )}
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="text-ink block truncate text-sm font-bold">
          {name}
        </span>
        <span className="text-ink-muted block truncate text-xs">{role}</span>
      </span>
    </>
  )

  return (
    <li>
      {to ? (
        <Link
          to={to}
          className="hover:bg-canvas flex items-center gap-2.5 rounded-lg p-1"
        >
          {body}
        </Link>
      ) : (
        <span className="flex items-center gap-2.5 p-1">{body}</span>
      )}
    </li>
  )
}

/** One attached file: the row opens the preview, the icon downloads it. */
function FileRow({
  file,
  author,
  onOpen,
}: {
  file: Attachment
  author: string
  onOpen: () => void
}) {
  return (
    <li className="hover:bg-canvas flex items-center gap-2.5 rounded-lg p-1.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <FileTile name={file.name} />
        <span className="min-w-0 flex-1">
          <span className="text-ink block truncate text-sm font-medium">
            {file.name}
          </span>
          <span className="text-ink-subtle block text-xs">
            {fileSize(file.size)} · {author}
          </span>
        </span>
      </button>
      <a
        href={file.url}
        download={file.name}
        title={`Download ${file.name}`}
        className="text-ink-subtle hover:text-ink shrink-0"
      >
        <Download className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
        <span className="sr-only">Download {file.name}</span>
      </a>
    </li>
  )
}

function Action({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof Archive
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium',
        active
          ? 'bg-brand-50 text-brand-700'
          : 'bg-sunken text-ink hover:bg-line',
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
      {label}
    </button>
  )
}
