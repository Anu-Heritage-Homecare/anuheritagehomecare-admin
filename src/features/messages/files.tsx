import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Image as ImageIcon, Trash2 } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import { allThreads, removeAttachment, sendMessage } from './data'
import type { Attachment } from './data'
import { fileSize, isImage, isPdf } from './file-data'
import type { FileContext } from './file-data'
import { SelectBox } from '@/components/ui/SelectBox'

/** The coloured square: blue for a picture, red for a document. */
export function FileTile({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const image = isImage(name)
  const Icon = image ? ImageIcon : FileText

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-lg',
        image ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-600',
        className ?? 'size-9',
      )}
    >
      <Icon className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
    </span>
  )
}

/** A file in the message column. Opens the preview; the design's own card. */
export function FileCard({
  file,
  onOpen,
  className,
}: {
  file: Attachment
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'border-line bg-surface hover:bg-canvas flex max-w-full items-center gap-2.5 rounded-xl border p-2.5 text-left',
        className,
      )}
    >
      <FileTile name={file.name} />
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-sm font-semibold">
          {file.name}
        </span>
        <span className="text-ink-subtle block text-xs">
          {fileSize(file.size)}
        </span>
      </span>
      <Download
        className="text-ink-subtle size-4.5 shrink-0"
        strokeWidth={1.9}
        aria-hidden="true"
      />
    </button>
  )
}

/**
 * The file, opened.
 *
 * The preview is the browser's own: a picture is drawn, a PDF is handed to the
 * viewer already built into the browser, and anything else says plainly that
 * it cannot be shown rather than drawing a fake page. The file lives behind an
 * object URL for the life of this tab, which is the same bargain as every
 * message typed here.
 */
export function FilePreview({
  file,
  context,
  onClose,
}: {
  file: Attachment
  context: FileContext
  onClose: () => void
}) {
  const [sharing, setSharing] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const threads = allThreads()

  return (
    <Drawer open onClose={onClose} title="File Preview">
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-4 p-4">
          <div className="bg-canvas grid min-h-64 place-items-center overflow-hidden rounded-xl p-4">
            {isImage(file.name) ? (
              <img
                src={file.url}
                alt={file.name}
                className="max-h-96 max-w-full rounded-lg object-contain"
              />
            ) : isPdf(file.name) ? (
              <object
                data={file.url}
                type="application/pdf"
                aria-label={file.name}
                className="h-96 w-full rounded-lg"
              >
                <p className="text-ink-subtle p-4 text-center text-xs">
                  This browser will not draw the PDF here. Download opens it in
                  whatever reads PDFs on this machine.
                </p>
              </object>
            ) : (
              <p className="text-ink-subtle flex flex-col items-center gap-2 text-center text-xs">
                <FileTile name={file.name} className="size-12" />
                No preview for this kind of file.
              </p>
            )}
          </div>

          <div className="border-line rounded-xl border">
            <p className="flex items-center gap-2.5 p-3">
              <FileTile name={file.name} />
              <span className="min-w-0">
                <span className="text-ink block truncate text-sm font-bold">
                  {file.name}
                </span>
                <span className="text-ink-subtle block text-xs">
                  {fileSize(file.size)}
                </span>
              </span>
            </p>
            <dl className="border-line space-y-2 border-t p-3 text-sm">
              <Row label="Uploaded By">
                {context.uploadedBy}
                {context.role ? ` (${context.role})` : ''}
              </Row>
              <Row label="Upload Date">{context.uploadedAt}</Row>
              {context.visit && (
                <Row label="Linked Visit">
                  <Link
                    to={`/scheduling/visits/${context.visit.id}`}
                    className="text-brand-700 font-semibold hover:underline"
                  >
                    {context.visit.reference}
                  </Link>
                </Row>
              )}
            </dl>
          </div>

          {sharing && (
            <div className="border-line space-y-2 rounded-xl border p-3">
              <p className="text-ink-muted text-xs">
                Nothing here can send a file out of the app. What it can do is
                put it in another conversation — pick one and it goes as a
                message from you.
              </p>
              <div className="flex flex-wrap gap-2">
                <SelectBox
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-label="Conversation to send it to"
                  className="border-line focus:border-brand-500 h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm"
                >
                  <option value="">Pick a conversation…</option>
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectBox>
                <button
                  type="button"
                  disabled={target === ''}
                  onClick={() => {
                    const thread = threads.find((t) => t.id === target)
                    if (!thread) return
                    sendMessage(thread, '', file)
                    setSentTo(thread.name)
                    setSharing(false)
                  }}
                  className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {sentTo && (
            <p role="status" className="text-ink-muted text-xs">
              Sent to {sentTo}.
            </p>
          )}
        </div>

        <div className="border-line bg-surface sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t p-4">
          {context.messageId ? (
            <button
              type="button"
              onClick={() => {
                if (removeAttachment(context.messageId!)) onClose()
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="size-4" strokeWidth={1.9} aria-hidden="true" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSharing((v) => !v)}
              className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
            >
              Share
            </button>
            <a
              href={file.url}
              download={file.name}
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
            >
              <Download className="size-4" strokeWidth={2} aria-hidden="true" />
              Download
            </a>
          </span>
        </div>
      </div>
    </Drawer>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink font-semibold">{children}</dd>
    </div>
  )
}
