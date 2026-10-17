import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SelectFilter } from '@/components/ui/SelectFilter'
import {
  allThreads,
  lastMessage,
  searchThreads,
  sortOptions,
  sortThreads,
  threadContext,
  useMessageRevision,
  startCaregiverThread,
} from '@/features/messages/data'
import type { Thread, ThreadSort } from '@/features/messages/data'
import {
  allNotices,
  searchNotices,
  sortNotices,
} from '@/features/messages/notices'
import type { Notice } from '@/features/messages/notices'
import {
  findAnnouncement,
  setAnnouncementStatus,
  statusOf as statusOfAnnouncement,
  useAnnouncements,
} from '@/features/messages/announcements'
import { messageSettings } from '@/features/messages/settings'
import { markRead, useReadState } from '@/features/messages/read-state'
import { ComposeDialog } from '@/features/messages/ComposeDialog'
import { ConversationDetails } from '@/features/messages/ConversationDetails'
import { useThreadFlags } from '@/features/messages/flags'
import {
  folderCounts,
  folderLabels,
  isNoticeFolder,
  noticesIn,
  readFolder,
  threadsIn,
} from '@/features/messages/folders'
import { AnnouncementsBoard } from '@/features/messages/AnnouncementsBoard'
import { FolderRail } from '@/features/messages/FolderRail'
import { NoticeRow, ThreadRow } from '@/features/messages/InboxList'
import { NoticePane } from '@/features/messages/NoticePane'
import { ThreadPane } from '@/features/messages/ThreadPane'

/**
 * Three panes on a wide screen, one on a narrow one.
 *
 * The open conversation is a route rather than component state, so a thread can
 * be linked to and Back leaves it. The folder, the search and the sort are
 * query parameters on that route for the same reason — and because the rail has
 * to survive opening a message and coming back.
 */
export function MessagesPage() {
  const { entryId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [composing, setComposing] = useState(false)

  /*
   * `?with=caregiver:<id>` arrives from elsewhere — a care team card's Message,
   * the dashboard's Contact — and opens that person's conversation straight
   * away, an empty one if there is none yet, with the cursor in the box.
   */
  const withParam = params.get('with')
  useEffect(() => {
    if (!withParam?.startsWith('caregiver:')) return
    const threadId = startCaregiverThread(withParam.slice('caregiver:'.length))
    navigate(threadId ? `/messages/${threadId}` : '/messages', {
      replace: true,
      state: { focusComposer: true },
    })
  }, [withParam, navigate])

  // Rebuilds when anything is sent, on either store.
  const revision = useMessageRevision()
  // And when something is opened: the Unread folder counts off this.
  const reads = useReadState()
  // Archiving or muting moves what the folders hold.
  const flags = useThreadFlags()
  // Publishing or archiving an announcement moves what the feed holds.
  const broadcasts = useAnnouncements()

  const folder = readFolder(params.get('folder'))
  const query = params.get('q') ?? ''
  const sort = (sortOptions.find((o) => o.value === params.get('sort'))
    ?.value ?? 'recent') as ThreadSort

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Only keystrokes replace. Picking a folder or a sort is a decision, so
    // Back undoes it.
    setParams(next, { replace: key === 'q' })
  }

  /*
   * `revision` is the dependency: `allThreads()` reads two module-level stores
   * rather than props, and the revision is what says they have moved. ESLint
   * cannot see that from the call.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const threads = useMemo(() => allThreads(), [revision])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notices = useMemo(() => allNotices(), [broadcasts])

  /*
   * Searched before the folder is applied, so the rail counts what the search
   * left rather than advertising thirteen above a list showing one.
   */
  const searchedThreads = useMemo(
    () => searchThreads(threads, query),
    [threads, query],
  )
  const searchedNotices = useMemo(
    () => searchNotices(notices, query),
    [notices, query],
  )
  /*
   * `reads` is the dependency ESLint cannot see: folderCounts calls isRead on
   * a module-level store rather than reading anything passed in, and the
   * revision is what says that store has moved.
   */
  const counts = useMemo(
    () => folderCounts(searchedThreads, searchedNotices),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchedThreads, searchedNotices, reads, flags],
  )

  const showingNotices = isNoticeFolder(folder)
  const threadRows = useMemo(
    () => sortThreads(threadsIn(folder, searchedThreads), sort),
    [folder, searchedThreads, sort],
  )
  const noticeRows = useMemo(
    () => sortNotices(noticesIn(folder, searchedNotices)),
    [folder, searchedNotices],
  )
  // All and Unread hold both kinds, so the list is one run sorted by when
  // something last happened on it rather than two stacked lists.
  const mixed = folder === 'all' || folder === 'unread'
  const rows = useMemo(() => {
    const items: {
      id: string
      at: string
      thread?: Thread
      notice?: Notice
    }[] = [
      ...threadRows.map((thread) => ({
        id: thread.id,
        at: lastMessage(thread)?.at ?? '',
        thread,
      })),
      ...noticeRows.map((notice) => ({ id: notice.id, at: notice.at, notice })),
    ]
    return mixed ? items.sort((a, b) => b.at.localeCompare(a.at)) : items
  }, [threadRows, noticeRows, mixed])
  const rowCount = rows.length

  // Opening it is what marks it read, so the rail moves as you work down the
  // list rather than when a message is answered.
  useEffect(() => {
    if (!entryId) return
    markRead(entryId)
    /*
     * The Message Settings rule: a broadcast that has been read moves to the
     * archive by itself, which takes it out of the folders and leaves it on
     * the Announcements screen under Archived. Only published announcements —
     * a visit notice is assembled from a record and has nothing to archive.
     */
    if (
      messageSettings().autoArchiveReadAnnouncements &&
      findAnnouncement(entryId) &&
      statusOfAnnouncement(findAnnouncement(entryId)!) === 'published'
    )
      setAnnouncementStatus(entryId, 'archived')
  }, [entryId])

  const openThread = threads.find((t) => t.id === entryId)
  const openNotice = notices.find((n) => n.id === entryId)
  const open = Boolean(openThread || openNotice)

  const search = new URLSearchParams({
    ...(folder !== 'all' ? { folder } : {}),
    ...(query ? { q: query } : {}),
    ...(sort !== 'recent' ? { sort } : {}),
  }).toString()
  const suffix = search ? `?${search}` : ''
  const linkTo = (id: string) => `/messages/${id}${suffix}`

  // The open item can sit in another folder or outside the search. Saying so
  // beats a highlighted row the reader cannot find.
  const hidden = open && !rows.some((r) => r.id === entryId)

  /*
   * An open conversation takes the whole screen, as the design draws it: two
   * flush panes under the topbar, divided by one rule, each scrolling inside
   * itself. It has to break out of the page's own padding to do that — hence
   * the negative margins — because the layout wraps every route in the same
   * gutter and a conversation is the one screen that is not a document.
   */
  if (open) {
    return (
      <div className="-mx-4 -my-6 sm:-mx-6 xl:-mx-8">
        <div className="grid min-h-0 lg:h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="border-line flex min-h-0 min-w-0 flex-col border-b lg:border-r lg:border-b-0">
            {openThread ? (
              <ThreadPane thread={openThread} backTo={`/messages${suffix}`} />
            ) : openNotice ? (
              <NoticePane notice={openNotice} backTo={`/messages${suffix}`} />
            ) : null}
          </div>
          {openThread && (
            <div className="min-h-0 min-w-0">
              <ConversationDetails
                thread={openThread}
                context={
                  openThread.about
                    ? threadContext(openThread.about.id)
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/*
       * Two layouts on one route. With nothing open it is the inbox: the
       * folder rail and the list. Open a conversation and the conversation
       * takes the page, with its own details panel beside it — the list is a
       * back arrow away, and reading a thread in a third of the width was the
       * worst of both.
       */}
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 lg:sticky lg:top-6">
          <FolderRail
            folder={folder}
            counts={counts}
            onSelect={(next) =>
              setParam('folder', next === 'all' ? null : next)
            }
            onCompose={() => setComposing(true)}
          />
        </div>

        {folder === 'announcements' ? (
          /*
           * The one folder that is not a list of things to read: broadcasts
           * are worth seeing in every state they pass through, so the folder
           * opens the board that holds the drafts and the schedule too.
           */
          <div className="min-w-0">
            <AnnouncementsBoard />
          </div>
        ) : (
          <section
            aria-label={folderLabels[folder]}
            className="card flex min-h-0 min-w-0 flex-col lg:h-[calc(100dvh-10rem)] lg:min-h-[32rem]"
          >
            <div className="space-y-2.5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-ink text-lg font-bold tracking-tight">
                  {folder === 'all' ? 'Inbox' : folderLabels[folder]}
                </h2>
                {!showingNotices && (
                  <SelectFilter
                    chip
                    valueOnly
                    value={sort}
                    onChange={(v) =>
                      setParam('sort', v === 'recent' ? null : v)
                    }
                    options={sortOptions}
                    label="Sort"
                  />
                )}
              </div>
              {/* The design has no search in this header — the rail's box
                searches the folders. Commented rather than deleted: the `q`
                parameter, `searchThreads` and `searchNotices` all still work,
                so a saved link that carries one keeps filtering the list, and
                putting the box back is uncommenting it.

            <label className="block">
              <span className="sr-only">Search messages</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search people, clients or message text"
                className="border-line focus:border-brand-500 h-10 w-full rounded-lg border px-3 text-sm"
              />
            </label>
            */}
            </div>

            {hidden && (
              <p className="border-brand-200 bg-brand-50 text-brand-800 m-3 rounded-lg border px-3 py-2 text-xs">
                What you have open is not in this folder.{' '}
                <Link
                  to={`/messages/${entryId}`}
                  className="font-semibold underline"
                >
                  Clear the filters
                </Link>{' '}
                to see its row.
              </p>
            )}

            {rowCount === 0 ? (
              <p
                role="status"
                className="text-ink-subtle px-4 py-12 text-center text-sm"
              >
                Nothing here matches.
              </p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                {rows.map((row) =>
                  row.thread ? (
                    <ThreadRow
                      key={row.id}
                      thread={row.thread}
                      to={linkTo(row.id)}
                      selected={row.id === entryId}
                    />
                  ) : (
                    <NoticeRow
                      key={row.id}
                      notice={row.notice!}
                      to={linkTo(row.id)}
                      selected={row.id === entryId}
                    />
                  ),
                )}
              </ul>
            )}
          </section>
        )}
      </div>

      {composing && (
        <ComposeDialog
          onClose={() => setComposing(false)}
          onSent={(threadId) => {
            setComposing(false)
            navigate(`/messages/${threadId}`)
          }}
        />
      )}
    </div>
  )
}
