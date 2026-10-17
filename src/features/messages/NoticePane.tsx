import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNoticeDate } from './notices'
import type { Notice } from './notices'
import { Formatted } from './Formatted'
import { FileCard, FilePreview } from './files'

/**
 * A notice opened.
 *
 * There is no composer, and that is the point of keeping these out of the
 * conversation folders: a visit record has nobody on the other end of it, and
 * an announcement went to everyone at once with no thread to answer in.
 */
export function NoticePane({
  notice,
  backTo,
}: {
  notice: Notice
  backTo: string
}) {
  const visit = notice.kind === 'visit'
  const Icon = visit ? ClipboardCheck : Bell
  const [previewing, setPreviewing] = useState(false)

  return (
    <section
      aria-label={notice.title}
      className="bg-surface flex min-h-0 flex-col lg:h-full"
    >
      <header className="border-line flex flex-wrap items-start gap-3 border-b p-4">
        <Link
          to={backTo}
          className="text-ink-muted hover:text-ink -ml-1 inline-flex size-9 items-center justify-center rounded-lg lg:hidden"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">Back to the inbox</span>
        </Link>
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full',
            visit ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600',
          )}
        >
          <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
            <span className="text-ink">{notice.title}</span>
            {notice.priority && (
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                  notice.priority === 'urgent'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700',
                )}
              >
                {notice.priority === 'urgent' ? 'Urgent' : 'High'}
              </span>
            )}
          </h2>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {notice.reference && <>{notice.reference} · </>}
            {notice.author
              ? `Written by ${notice.author}`
              : 'From the visit record'}
            {' · '}
            {formatNoticeDate(notice)}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="text-ink text-sm whitespace-pre-line">
          <Formatted body={notice.html ?? notice.body} />
        </p>

        {notice.attachment && (
          <div className="mt-3">
            <FileCard
              file={notice.attachment}
              onOpen={() => setPreviewing(true)}
            />
          </div>
        )}

        {previewing && notice.attachment && (
          <FilePreview
            file={notice.attachment}
            context={{
              uploadedBy: notice.author ?? 'The agency',
              role: null,
              uploadedAt: formatNoticeDate(notice),
              visit: null,
            }}
            onClose={() => setPreviewing(false)}
          />
        )}

        {notice.to && (
          <Link
            to={notice.to}
            className="text-brand-700 hover:text-brand-800 mt-4 inline-flex items-center gap-1.5 text-sm font-medium"
          >
            {visit ? 'Open the visit record' : 'Open the related screen'}
            <ArrowRight
              className="size-3.5"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </Link>
        )}
      </div>

      <p className="border-line text-ink-subtle border-t p-4 text-xs">
        {visit
          ? 'Assembled from the visit record, not sent by anyone — there is nobody to reply to. Anything on this visit that needs a decision is an alert, and lives on Alerts & Incidents.'
          : 'Written to everyone at once. This app has no group conversation for a reply to land in, so there is no reply box here.'}
      </p>
    </section>
  )
}
