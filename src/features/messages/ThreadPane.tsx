import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  AtSign,
  LayoutTemplate,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Video,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Drawer } from '@/components/ui/Drawer'
import { SIGNED_IN } from '@/lib/session'
import { cn } from '@/lib/cn'
import { tonePill } from '@/lib/tone'
import { telHref } from '@/features/monitoring/live-data'
import { hasLeft, setLeft, useThreadFlags } from './flags'
import { messageSettings, useMessageSettings } from './settings'
import {
  formatClock,
  formatThreadDay,
  logCall,
  onVisitNow,
  sendMessage,
  threadContext,
  threadStatus,
} from './data'
import type { Attachment, ContactMark, Message, Thread } from './data'
import { FileCard, FilePreview } from './files'
import { fileContextFor, fileSize } from './file-data'

/* --------------------------------- rows ----------------------------------- */

type Row =
  | { kind: 'day'; key: string; at: string }
  | { kind: 'message'; key: string; message: Message }
  | { kind: 'mark'; key: string; mark: ContactMark }

/**
 * Messages and logged contacts in one column, cut into days.
 *
 * A contact with no clock sorts to the head of its day rather than being given
 * a time to sort by — the log records which day somebody rang, and nothing
 * more.
 */
function rowsFor(thread: Thread): Row[] {
  const entries: { at: string; time: string; row: Row }[] = [
    ...thread.messages.map((message) => ({
      at: message.at,
      time: message.time ?? '00:00',
      row: { kind: 'message', key: message.id, message } as Row,
    })),
    ...thread.marks.map((mark) => ({
      at: mark.at,
      time: '00:00',
      row: { kind: 'mark', key: mark.id, mark } as Row,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.time.localeCompare(b.time))

  const rows: Row[] = []
  let day: string | null = null
  for (const entry of entries) {
    if (entry.at !== day) {
      day = entry.at
      rows.push({ kind: 'day', key: `day-${entry.at}`, at: entry.at })
    }
    rows.push(entry.row)
  }
  return rows
}

/* -------------------------------- the pane -------------------------------- */

export function ThreadPane({
  thread,
  backTo,
}: {
  thread: Thread
  /** Returns to the list on the narrow layout, where the two share the column. */
  backTo: string
}) {
  const onVisit = onVisitNow(thread)
  const status = threadStatus(thread)
  const [finding, setFinding] = useState(false)
  const [needle, setNeedle] = useState('')
  const [calling, setCalling] = useState(false)
  const [openFile, setOpenFile] = useState<Message | null>(null)
  const log = useRef<HTMLDivElement>(null)
  useThreadFlags()
  const left = hasLeft(thread.id)

  /*
   * Open on the latest message, not the oldest. Keyed on the thread and the
   * message count, so switching conversation and sending both land at the
   * bottom — a thread that opened at the top of a year-old exchange read as
   * having nothing recent in it.
   */
  useEffect(() => {
    const panel = log.current
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [thread.id, thread.messages.length])

  /*
   * Filtered on the message, then the days re-cut around what is left — a day
   * separator over nothing is how a filtered thread looks like a broken one.
   */
  const term = needle.trim().toLowerCase()
  const shown =
    term === ''
      ? thread
      : {
          ...thread,
          messages: thread.messages.filter((m) =>
            m.body.toLowerCase().includes(term),
          ),
          marks: thread.marks.filter((m) =>
            m.subject.toLowerCase().includes(term),
          ),
        }
  const rows = rowsFor(shown)
  const matches = shown.messages.length + shown.marks.length

  return (
    <section
      aria-label={`Conversation with ${thread.name}`}
      className="bg-surface flex min-h-0 flex-col lg:h-full"
    >
      <header className="border-line flex flex-wrap items-center gap-3 border-b p-4">
        <Link
          to={backTo}
          className="text-ink-muted hover:text-ink -ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">Back to the inbox</span>
        </Link>
        <span className="relative shrink-0">
          <Avatar name={thread.name} decorative className="size-11 text-sm" />
          {/* The design's green dot. "Online" is not something this app
              records — nothing here knows who is signed in — so the dot shows
              the standing the roster keeps, and says when the board also has
              them out on a visit. */}
          {status && (
            <span
              className={cn(
                'border-surface absolute right-0 bottom-0 size-3 rounded-full border-2',
                status === 'active'
                  ? 'bg-emerald-500'
                  : status === 'on-leave'
                    ? 'bg-amber-400'
                    : 'bg-slate-300',
              )}
              title={
                status === 'active'
                  ? onVisit
                    ? `${thread.name} is active, and on a visit now`
                    : `${thread.name} is active on the roster`
                  : status === 'on-leave'
                    ? `${thread.name} is on leave`
                    : `${thread.name} is not active`
              }
            >
              <span className="sr-only">
                {status === 'active'
                  ? onVisit
                    ? 'Active, on a visit now'
                    : 'Active'
                  : status === 'on-leave'
                    ? 'On leave'
                    : 'Not active'}
              </span>
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <h2 className="text-ink truncate text-base font-bold tracking-tight">
              {thread.name}
            </h2>
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap',
                thread.kind === 'caregiver' ? tonePill.green : tonePill.blue,
              )}
            >
              {thread.kind === 'caregiver' ? 'Caregiver' : 'Family'}
            </span>
          </span>
          <p className="text-ink-subtle mt-0.5 text-xs break-words">
            {thread.about ? (
              <>
                {'Linked: '}
                <Link
                  to={`/care-recipients/${thread.about.id}/overview`}
                  className="text-brand-700 hover:underline"
                >
                  {thread.about.name}
                </Link>
                {' (Care Recipient)'}
              </>
            ) : (
              thread.role
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/*
           * Square buttons, as the design draws them. The phone dials, because
           * a number is the one contact detail every one of these people
           * carries. Nothing here places a video call — there is no service
           * behind it — so that button records one instead, which is a thing
           * this app genuinely keeps.
           */}
          {/* Searches this conversation, not the inbox: the rows below are
              filtered to the messages that carry the words. */}
          <button
            type="button"
            onClick={() => {
              setFinding((open) => !open)
              if (finding) setNeedle('')
            }}
            aria-expanded={finding}
            title={`Search this conversation`}
            className={cn(
              'grid size-10 place-items-center rounded-lg',
              finding
                ? 'bg-brand-50 text-brand-700'
                : 'bg-sunken text-ink-muted hover:text-ink',
            )}
          >
            <Search className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
            <span className="sr-only">Search this conversation</span>
          </button>
          <a
            href={telHref(thread.phone)}
            title={`Call ${thread.name} on ${thread.phone}`}
            className="bg-sunken text-ink-muted hover:text-ink grid size-10 place-items-center rounded-lg"
          >
            <Phone className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
            <span className="sr-only">Call {thread.name}</span>
          </a>
          <button
            type="button"
            onClick={() => setCalling(true)}
            title={`Record a video call with ${thread.name}`}
            className="bg-sunken text-ink-muted hover:text-ink grid size-10 place-items-center rounded-lg"
          >
            <Video className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
            <span className="sr-only">
              Record a video call with {thread.name}
            </span>
          </button>
          <DropdownMenu
            triggerClassName="bg-sunken text-ink-muted hover:text-ink grid size-10 shrink-0 place-items-center rounded-lg"
            label={`More for ${thread.name}`}
            items={[
              {
                id: 'record',
                label:
                  thread.kind === 'caregiver'
                    ? 'Open caregiver record'
                    : 'Open family record',
                to: thread.to,
              },
              ...(thread.about
                ? [
                    {
                      id: 'client',
                      label: `Open ${thread.about.name}'s record`,
                      to: `/care-recipients/${thread.about.id}/overview`,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </header>

      {thread.kind === 'family' && thread.about && (
        <p className="border-line bg-sunken text-ink-muted border-b px-4 py-2.5 text-xs">
          This thread is the communication log on{' '}
          <Link
            to={`/care-recipients/${thread.about.id}/family`}
            className="text-brand-700 font-medium hover:underline"
          >
            {thread.about.name}&rsquo;s record
          </Link>
          . The log keeps a subject line and the day it happened, so these carry
          no time of day.
        </p>
      )}

      {finding && (
        <div className="border-line border-b p-3">
          <label className="block">
            <span className="sr-only">Search this conversation</span>
            <input
              type="search"
              autoFocus
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder={`Search this conversation`}
              className="border-line focus:border-brand-500 h-10 w-full rounded-lg border px-3 text-sm"
            />
          </label>
          {needle.trim() !== '' && (
            <p role="status" className="text-ink-subtle mt-1.5 text-xs">
              {matches} message{matches === 1 ? '' : 's'} match.
            </p>
          )}
        </div>
      )}

      <div ref={log} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {rows.map((row) => {
          if (row.kind === 'day')
            return <DaySeparator key={row.key} at={row.at} />
          if (row.kind === 'mark') return <Mark key={row.key} mark={row.mark} />
          return (
            <Bubble
              key={row.key}
              message={row.message}
              counterpart={thread.name}
              onOpenFile={setOpenFile}
            />
          )
        })}
      </div>

      {left ? (
        <div className="border-line flex flex-wrap items-center justify-between gap-2 border-t p-4">
          <p className="text-ink-muted text-sm">
            You left this conversation. It is out of your folders.
          </p>
          <button
            type="button"
            onClick={() => setLeft(thread.id, false)}
            className="border-control text-ink hover:bg-sunken inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium"
          >
            Rejoin
          </button>
        </div>
      ) : (
        <Composer thread={thread} />
      )}

      {calling && (
        <LogCallDialog thread={thread} onClose={() => setCalling(false)} />
      )}

      {openFile?.attachment && (
        <FilePreview
          file={openFile.attachment}
          context={fileContextFor(thread, openFile)}
          onClose={() => setOpenFile(null)}
        />
      )}
    </section>
  )
}

/* --------------------------------- pieces --------------------------------- */

const fullDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function DaySeparator({ at }: { at: string }) {
  const label = formatThreadDay(at)
  const date = fullDay.format(new Date(`${at}T00:00:00Z`))

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="bg-line h-px flex-1" />
      <span className="text-ink-subtle text-xs">
        {label === date ? date : `${label}, ${date}`}
      </span>
      <span aria-hidden="true" className="bg-line h-px flex-1" />
    </div>
  )
}

/**
 * One message, the way the design draws it: the other side's avatar beside the
 * bubble, the clock underneath it, and nothing else — the name belongs in the
 * header, not repeated down the column.
 *
 * The exceptions are written rather than dropped. A message from somebody who
 * is neither the person in the header nor the person signed in keeps its
 * author, because a family log carries entries from several coordinators and
 * an unattributed one reads as the wrong person's. A message that came off the
 * log rather than out of a composer keeps saying so.
 */
function Bubble({
  message,
  counterpart,
  onOpenFile,
}: {
  message: Message
  counterpart: string
  onOpenFile: (message: Message) => void
}) {
  const outbound = message.direction === 'outbound'
  const expected = outbound ? SIGNED_IN : counterpart
  const attribution = message.author === expected ? null : message.author
  const meta = [
    message.time ? formatClock(message.time) : null,
    attribution,
    message.channel === 'App Message' ? null : message.channel,
  ].filter(Boolean)

  return (
    <div className={cn('flex items-end gap-2', outbound && 'flex-row-reverse')}>
      {!outbound && (
        <Avatar
          name={message.author}
          decorative
          className="mb-5 size-7 shrink-0 text-[0.625rem]"
        />
      )}
      <div
        className={cn(
          'flex min-w-0 max-w-[85%] flex-col sm:max-w-[38rem]',
          outbound ? 'items-end' : 'items-start',
        )}
      >
        {message.body.trim() !== '' && (
          <p
            className={cn(
              'rounded-2xl px-4 py-3 text-sm break-words',
              outbound ? 'bg-brand-600 text-white' : 'bg-canvas text-ink',
              // A subject line off the log is a record of a message, not the
              // message. Rendering it as if it were the words somebody typed is
              // the one thing this thread must not do.
              message.fromLog && 'italic',
            )}
          >
            {message.body}
          </p>
        )}

        {message.attachment && (
          <FileCard
            file={message.attachment}
            onOpen={() => onOpenFile(message)}
            className={message.body.trim() !== '' ? 'mt-1.5' : undefined}
          />
        )}

        {meta.length > 0 && (
          <p className="text-ink-subtle mt-1.5 text-xs">{meta.join(' · ')}</p>
        )}
      </div>
    </div>
  )
}

function Mark({ mark }: { mark: ContactMark }) {
  return (
    <p className="text-ink-subtle text-center text-xs">
      {mark.type} logged — &ldquo;{mark.subject}&rdquo;, {mark.staff}
    </p>
  )
}

/**
 * Recording a call that has happened.
 *
 * The button it sits behind is where the design puts "start a video call".
 * Nothing in this app can place one, so this writes the contact down: on a
 * family thread it joins the communication log on the care record, and on a
 * caregiver thread it joins the conversation.
 */
function LogCallDialog({
  thread,
  onClose,
}: {
  thread: Thread
  onClose: () => void
}) {
  const [note, setNote] = useState('')

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title="Record a video call"
      subtitle={thread.name}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-ink-muted text-sm">
          There is no video service behind this button. Writing the call down is
          what the app can do with it —{' '}
          {thread.kind === 'family'
            ? 'it joins the communication log on the care record.'
            : 'it joins this conversation as a logged contact.'}
        </p>
        <label className="block">
          <span className="text-ink text-sm font-medium">
            What it was about{' '}
            <span className="text-ink-subtle font-normal">(optional)</span>
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Video call with ${thread.name}`}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
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
            onClick={() => {
              logCall(thread, 'Video Call', note)
              onClose()
            }}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
          >
            Record the call
          </button>
        </div>
      </div>
    </Drawer>
  )
}

/**
 * Six glyphs, named so the list reads as words rather than a grid of pictures.
 * They go into the message text, which is all an emoji is anywhere.
 */
const quickEmoji = [
  { id: 'thumbs-up', emoji: '\u{1F44D}', label: 'Thumbs up' },
  { id: 'smile', emoji: '\u{1F642}', label: 'Smile' },
  { id: 'thanks', emoji: '\u{1F64F}', label: 'Thanks' },
  { id: 'done', emoji: '\u2705', label: 'Done' },
  { id: 'heads-up', emoji: '\u26A0\uFE0F', label: 'Heads up' },
  { id: 'heart', emoji: '\u2764\uFE0F', label: 'Heart' },
]

const toolButton =
  'bg-sunken text-ink-muted hover:text-ink grid size-9 shrink-0 place-items-center rounded-lg transition-colors'

function Composer({ thread }: { thread: Thread }) {
  useMessageSettings()
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState<Attachment | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const empty = draft.trim() === '' && !file

  // Focus belongs to the box, not to whatever menu item was clicked, so the
  // next keystroke lands in the message. Counted rather than called inline:
  // the insert handlers are built during render and must not touch a ref.
  const [focusTick, setFocusTick] = useState(0)
  useEffect(() => {
    if (focusTick > 0) box.current?.focus()
  }, [focusTick])

  // Opened from a "Message" button elsewhere: start typing straight away.
  const arrivedToWrite = Boolean((useLocation().state as { focusComposer?: boolean } | null)?.focusComposer)
  useEffect(() => {
    if (arrivedToWrite) box.current?.focus()
  }, [arrivedToWrite, thread.id])

  /** Adds to the end of the draft, spaced so it never runs into the last word. */
  const insert = (text: string) => {
    setDraft((current) =>
      current === '' || current.endsWith(' ')
        ? current + text
        : `${current} ${text}`,
    )
    setFocusTick((tick) => tick + 1)
  }

  const about = thread.about
  const context = about ? threadContext(about.id) : undefined
  const next = context?.next ?? null

  /*
   * Details worth typing out, pulled from the board rather than composed: the
   * visit that is genuinely next for this recipient, and the record the
   * conversation is filed against. Nothing is offered that isn't there — a
   * thread about nobody gets no button.
   */
  const settings = messageSettings()
  const details: MenuItem[] = [
    ...(next
      ? [
          {
            id: 'visit',
            label: `Next visit \u2014 ${next.reference}`,
            onSelect: () =>
              insert(
                `${next.reference} (${next.type}), ${formatThreadDay(next.date)} ${formatClock(next.start)}`,
              ),
          },
        ]
      : []),
    ...(about
      ? [
          {
            id: 'record',
            label: `Care recipient \u2014 ${about.name}`,
            onSelect: () => insert(about.name),
          },
        ]
      : []),
    // Written on the Message Settings screen, offered where they are used.
    ...settings.quickReplies.map((reply) => ({
      id: reply.id,
      label: reply.text,
      onSelect: () => insert(reply.text),
    })),
    ...settings.templates.map((template) => ({
      id: template.id,
      label: template.name,
      onSelect: () => insert(template.body),
    })),
  ]

  /*
   * The people this conversation is already about. A mention puts the name in
   * the message — there is no notification service here for it to ring, and
   * pretending otherwise would be the one thing a mention must not do.
   */
  const named = [
    thread.name,
    ...(about ? [about.name] : []),
    ...(next?.caregiverName ? [next.caregiverName] : []),
  ]
  const mentions: MenuItem[] = [...new Set(named)].map((name) => ({
    id: name,
    label: `@${name}`,
    onSelect: () => insert(`@${name}`),
  }))

  return (
    <form
      className="p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (empty) return
        sendMessage(thread, draft, file ?? undefined)
        setDraft('')
        setFile(null)
      }}
    >
      <div className="border-line focus-within:border-brand-500 rounded-xl border p-3">
        <label className="block">
          <span className="sr-only">Message {thread.name}</span>
          <textarea
            ref={box}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the shape everyone
              // already has in their fingers from every other messenger.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            rows={1}
            placeholder="Type a message..."
            className="text-ink placeholder:text-ink-subtle w-full resize-none border-0 bg-transparent px-1 py-1.5 text-sm focus:outline-none"
          />
        </label>

        {file && (
          <p className="border-line mt-1 mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
            <Paperclip
              className="text-ink-subtle size-3.5 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <span className="text-ink min-w-0 truncate font-medium">
              {file.name}
            </span>
            <span className="text-ink-subtle shrink-0">
              {fileSize(file.size)}
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

        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <DropdownMenu
              label="Insert an emoji"
              icon={Smile}
              align="start"
              triggerClassName={toolButton}
              items={quickEmoji.map((e) => ({
                id: e.id,
                label: `${e.emoji}  ${e.label}`,
                onSelect: () => insert(e.emoji),
              }))}
            />

            {/*
             * A real file, kept where it was picked. There is no server to put
             * it on, so the browser holds the bytes behind an object URL: it
             * opens and downloads for as long as this tab is open, and goes
             * when the page does — the same bargain as every message typed here.
             */}
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
            <button
              type="button"
              onClick={() => picker.current?.click()}
              title="Attach a file"
              className={toolButton}
            >
              <Paperclip
                className="size-4.5"
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <span className="sr-only">Attach a file</span>
            </button>

            {details.length > 0 && (
              <DropdownMenu
                label="Insert a reply, a template or visit details"
                icon={LayoutTemplate}
                align="start"
                triggerClassName={toolButton}
                items={details}
              />
            )}

            <DropdownMenu
              label="Mention somebody"
              icon={AtSign}
              align="start"
              triggerClassName={toolButton}
              items={mentions}
            />
          </div>

          <button
            type="submit"
            disabled={empty}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white"
          >
            Send
            <Send className="size-4" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  )
}
