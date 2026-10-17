import { useId, useState } from 'react'
import { Paperclip, TriangleAlert, Upload, X } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import {
  fileNote,
  incidentTypeLabels,
  nextFiledNoteId,
} from '@/features/care-recipients/notes-data'
import type {
  IncidentSeverity,
  IncidentType,
} from '@/features/care-recipients/notes-data'
import { referenceFor } from '@/features/scheduling/visit-detail'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { formatTime, stateLabels } from './live-data'
import type { LiveVisit } from './live-data'
import { SelectBox } from '@/components/ui/SelectBox'

const severities: { value: IncidentSeverity; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

/** What the drop zone will take, and what it says it will take. */
const ACCEPTED = '.pdf,.png,.jpg,.jpeg'
const MAX_BYTES = 10 * 1024 * 1024

interface ReportIncidentDialogProps {
  /** The visit the write-up is about. Everything in the header comes off it. */
  visit: LiveVisit
  /** The clock the screen is running at, 24-hour. Stamped onto the note. */
  now: string
  onClose: () => void
}

/**
 * Writing up an incident against a live visit.
 *
 * The one screen here that creates a record rather than reading one, and it can
 * afford to: an incident is a filed document, not a fact derived from the
 * clock. What it writes is an ordinary care note in the `incident` category —
 * the same shape as every incident already on file — so it turns up in the
 * client's Notes tab, the incident register, Monitoring history and the
 * "Incident written up" alert without any of them being told about it.
 *
 * Mounted only while it is open, so the form starts empty every time.
 */
export function ReportIncidentDialog({
  visit,
  now,
  onClose,
}: ReportIncidentDialogProps) {
  const [type, setType] = useState<IncidentType | ''>('')
  const [severity, setSeverity] = useState<IncidentSeverity | ''>('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [certified, setCertified] = useState(false)

  const typeId = useId()
  const severityId = useId()
  const bodyId = useId()
  const fileId = useId()
  const certifyId = useId()

  const ready = type !== '' && severity !== '' && body.trim() !== ''

  const take = (incoming: FileList | null) => {
    if (!incoming) return
    const list = [...incoming]
    // Enforced rather than decorative: the zone says 10MB, so it has to mean it.
    setFiles((current) => [...current, ...list.filter((f) => f.size <= MAX_BYTES)])
    setRejected(list.filter((f) => f.size > MAX_BYTES).map((f) => f.name))
  }

  const submit = () => {
    if (type === '' || severity === '') return
    fileNote(visit.recipientId, {
      id: nextFiledNoteId(),
      author: SIGNED_IN,
      at: `${visit.date}T${now}:00Z`,
      category: 'incident',
      incident: {
        type,
        severity,
        // Just filed, so nobody has settled it yet. Filling this in at the
        // moment of writing would be the form answering its own question.
        outcome: 'open',
        certifiedBy: certified ? SIGNED_IN : undefined,
      },
      body: body.trim(),
      // Anything critical is flagged without asking: a write-up at that level
      // that nobody senior reads is the failure this field exists to prevent.
      flagged: severity === 'critical' || severity === 'high',
      comments: 0,
      attachments: files.length,
    })
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title="Report incident"
      subtitle={`${visit.recipientName} · ${visit.type}`}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="border-brand-200 bg-brand-50/60 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-brand-800 text-xs font-semibold tracking-wide uppercase">
              From the visit
            </p>
            <span className="border-line text-ink-muted bg-surface rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
              {stateLabels[visit.state]} · {formatTime(visit.start)}–
              {formatTime(visit.end)}
            </span>
          </div>
          <dl className="mt-2 grid gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-ink-subtle text-xs">Care recipient</dt>
              <dd className="text-ink font-medium break-words">
                {visit.recipientName}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-ink-subtle text-xs">Caregiver</dt>
              <dd className="text-ink font-medium break-words">
                {visit.caregiverName ?? 'Nobody assigned'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-ink-subtle text-xs">Related visit</dt>
              {/* The app's own reference, derived from the date and the rota
                  slot — not a stored ticket number, because nothing issues
                  one. */}
              <dd className="text-ink font-medium break-words">
                {referenceFor(visit)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={typeId} className="text-ink text-sm font-medium">
              Incident type
            </label>
            <SelectBox
              id={typeId}
              value={type}
              onChange={(e) => setType(e.target.value as IncidentType)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              <option value="">Choose a type</option>
              {(Object.keys(incidentTypeLabels) as IncidentType[]).map((value) => (
                <option key={value} value={value}>
                  {incidentTypeLabels[value]}
                </option>
              ))}
            </SelectBox>
          </div>
          <div>
            {/* "Severity", not the design's "Priority": it is the same axis the
                incident register sorts and filters on, and one word for one
                thing. */}
            <label htmlFor={severityId} className="text-ink text-sm font-medium">
              Severity
            </label>
            <SelectBox
              id={severityId}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
            >
              <option value="">Choose a severity</option>
              {severities.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </SelectBox>
          </div>
        </div>

        <div>
          <label htmlFor={bodyId} className="text-ink text-sm font-medium">
            Description of incident{' '}
            <span aria-hidden="true" className="text-red-600">
              *
            </span>
          </label>
          <textarea
            id={bodyId}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="What happened, when, and what was done about it"
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
          <p className="text-ink-subtle mt-1 text-xs">
            This becomes the write-up itself, word for word, wherever the
            incident is read.
          </p>
        </div>

        <div>
          <p className="text-ink text-sm font-medium">
            Attachments{' '}
            <span className="text-ink-subtle font-normal">(optional)</span>
          </p>
          <label
            htmlFor={fileId}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              take(e.dataTransfer.files)
            }}
            className="border-line hover:border-brand-400 hover:bg-sunken mt-1.5 flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center"
          >
            <Upload
              className="text-ink-subtle size-5"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <span className="text-ink text-sm font-medium">
              Choose a file or drag one here
            </span>
            <span className="text-ink-subtle text-xs">PDF, PNG or JPG, up to 10MB</span>
            <input
              id={fileId}
              type="file"
              multiple
              accept={ACCEPTED}
              onChange={(e) => take(e.target.files)}
              className="sr-only"
            />
          </label>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="text-ink-muted flex items-center gap-2 text-xs"
                >
                  <Paperclip
                    className="size-3.5 shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-all">{file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) => current.filter((_, i) => i !== index))
                    }
                    className="text-ink-subtle hover:text-ink shrink-0"
                  >
                    <X className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                    <span className="sr-only">Remove {file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rejected.length > 0 && (
            <p className="mt-2 text-xs text-red-700" role="status">
              Too large, not attached: {rejected.join(', ')}. The limit is 10MB.
            </p>
          )}
          {/* Said plainly, because the record will show a count and somebody
              will go looking for the file. This app has nowhere to put it. */}
          <p className="text-ink-subtle mt-2 text-xs">
            The write-up records how many files you attached. The files
            themselves are not uploaded anywhere — there is no document store
            behind this app.
          </p>
        </div>

        <div className="border-line rounded-lg border p-3">
          <label htmlFor={certifyId} className="flex items-start gap-2.5 text-sm">
            <input
              id={certifyId}
              type="checkbox"
              checked={certified}
              onChange={(e) => setCertified(e.target.checked)}
              className="accent-brand-600 mt-0.5 size-4 shrink-0"
            />
            <span className="text-ink">
              I certify that safety precautions were followed and the family has
              been notified.
            </span>
          </label>
          {/* Never pre-ticked, and never required. A certification the form made
              on your behalf is not a certification, and an incident often has to
              be written up before anybody can reach the family. */}
          <p className="text-ink-subtle mt-1.5 ml-6.5 text-xs">
            Optional. Left unticked the write-up simply does not claim it — file
            first and certify later rather than tick it to get past this screen.
          </p>
        </div>

        <p className="text-ink-subtle flex gap-2 text-xs">
          <TriangleAlert
            className="mt-0.5 size-3.5 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>
            Filed as {SIGNED_IN} ({SIGNED_IN_ROLE.toLowerCase()}) at{' '}
            {formatTime(now)}, against {visit.recipientName}&rsquo;s record. It
            will appear on their Notes tab, in the incident register and in
            Monitoring history. Held for this session only — there is no server
            to write it to.
          </span>
        </p>

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
            onClick={submit}
            disabled={!ready}
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit incident
          </button>
        </div>
      </div>
    </Drawer>
  )
}
