import { FileText, Loader2, Plus, Shield, TriangleAlert } from 'lucide-react'
import type { StaffMember } from './staff'
import {
  useCaregiverDocuments,
  type DocumentsCredentialDto,
  type DocumentsEmploymentDto,
  type DocumentsTrainingDto,
} from './useCaregiverDocuments'
import { cn } from '@/lib/cn'

/* Backend statuses map onto the three visual tones the tables already use. */
const statusTone: Record<string, string> = {
  VALID: 'bg-brand-50 text-brand-700',
  CURRENT: 'bg-brand-50 text-brand-700',
  EXPIRING: 'bg-[#fcf3cc] text-[#8a4a1c]',
  RENEWAL_DUE: 'bg-[#fcf3cc] text-[#8a4a1c]',
  EXPIRED: 'bg-red-50 text-red-700',
}
function toneFor(status: string): string {
  return statusTone[status] ?? 'bg-brand-50 text-brand-700'
}
/** A backend status enum to its chip wording. */
function statusWord(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
}

const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : longDate.format(date)
}
function formatMonth(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : monthYear.format(date)
}

export function DocumentsTab({ member }: { member: StaffMember }) {
  const { data, isPending, isError, error, refetch } = useCaregiverDocuments(member.id)

  if (isPending) {
    return (
      <p className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading documents…
      </p>
    )
  }
  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load documents.</p>
        <p className="text-ink-subtle text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  const { summary, certifications, employmentDocuments, trainingRecords, uploadHistory } = data
  const compliant = summary.overallStatus === 'COMPLIANT' || summary.overallStatus === 'VALID'
  const expired = summary.overallStatus === 'EXPIRED' || summary.overallStatus === 'ACTION_REQUIRED'

  return (
    <div className="space-y-4">
      <h2 className="sr-only">Documents and compliance</h2>

      <section
        aria-label="Compliance summary"
        className="card grid grid-cols-1 gap-y-4 px-5 py-5 sm:grid-cols-3 sm:gap-y-0"
      >
        <div className="flex items-center gap-4 sm:pr-6">
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl',
              compliant
                ? 'bg-brand-50 text-brand-600'
                : expired
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700',
            )}
          >
            {compliant ? (
              <Shield className="size-5" strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <TriangleAlert className="size-5" strokeWidth={1.9} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
              Overall Status
            </p>
            <p
              className={cn(
                'mt-0.5 text-lg font-bold tracking-tight break-words',
                compliant ? 'text-brand-700' : expired ? 'text-red-700' : 'text-amber-700',
              )}
            >
              {statusWord(summary.overallStatus)}
            </p>
            <p className="text-ink-subtle mt-0.5 text-xs break-words">{summary.message}</p>
          </div>
        </div>

        <div className="border-line/70 min-w-0 sm:border-l sm:px-7">
          <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
            Next Impending Expiry
          </p>
          {summary.nextImpendingExpiry ? (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-ink text-base font-semibold break-words">
                  {summary.nextImpendingExpiry.name}
                </span>
                <span className="rounded-md bg-[#fcf3cc] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#8a4a1c]">
                  Expires {formatMonth(summary.nextImpendingExpiry.expiresAt)}
                </span>
              </p>
              <p className="text-ink-subtle/70 mt-1 text-xs break-words">
                {summary.nextImpendingExpiry.daysRemaining} day
                {summary.nextImpendingExpiry.daysRemaining === 1 ? '' : 's'} remaining.
              </p>
            </>
          ) : (
            <p className="text-ink-subtle mt-1 text-sm">
              Nothing else on record carries an expiry date.
            </p>
          )}
        </div>

        <div className="border-line/70 min-w-0 sm:border-l sm:pl-7">
          <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
            Stats Summary
          </p>
          <p className="text-ink mt-1 text-lg font-bold tracking-tight">
            {summary.documentsOnFile} Document{summary.documentsOnFile === 1 ? '' : 's'} on File
          </p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {summary.lastUpdated ? `Last updated ${formatDate(summary.lastUpdated)}` : 'Nothing uploaded yet'}
          </p>
        </div>
      </section>

      <DocCard title="Certifications & Licenses" add="Add Certification" member={member}>
        {certifications.length === 0 ? (
          <p className="text-ink-muted px-4 py-8 text-center text-sm">No certifications on file.</p>
        ) : (
          <table className="w-full min-w-3xl text-left text-sm">
            <TableHead
              columns={['Certification', 'License #', 'Issued', 'Expires', 'Status', 'Document', 'Actions']}
            />
            <tbody className="divide-line/70 divide-y">
              {certifications.map((c) => (
                <CertificationRow key={c.id} credential={c} />
              ))}
            </tbody>
          </table>
        )}
      </DocCard>

      <DocCard title="Employment Documents" add="Add Document" member={member}>
        {employmentDocuments.length === 0 ? (
          <p className="text-ink-muted px-4 py-8 text-center text-sm">No employment documents.</p>
        ) : (
          <table className="w-full min-w-2xl text-left text-sm">
            <TableHead columns={['Document', 'Category', 'Date', 'Status', 'Actions']} />
            <tbody className="divide-line/70 divide-y">
              {employmentDocuments.map((doc) => (
                <EmploymentRow key={doc.id} doc={doc} />
              ))}
            </tbody>
          </table>
        )}
      </DocCard>

      <DocCard title="Training Records" add="Record Training" member={member}>
        {trainingRecords.length === 0 ? (
          <p className="text-ink-muted px-4 py-8 text-center text-sm">No training recorded.</p>
        ) : (
          <table className="w-full min-w-2xl text-left text-sm">
            <TableHead columns={['Training', 'Completed', 'Certificate', 'Hours', 'Actions']} />
            <tbody className="divide-line/70 divide-y">
              {trainingRecords.map((record) => (
                <TrainingRow key={record.id} record={record} />
              ))}
            </tbody>
          </table>
        )}
      </DocCard>

      <section aria-labelledby="upload-history" className="card p-5 sm:p-6">
        <h3 id="upload-history" className="text-ink text-base font-semibold tracking-tight">
          Document Upload History
        </h3>
        {uploadHistory.length === 0 ? (
          <p className="text-ink-muted mt-4 text-sm">Nothing uploaded yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {uploadHistory.map((entry, i) => (
              <li
                key={`${entry.date}-${i}`}
                className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4"
              >
                <p className="text-ink-muted shrink-0 text-sm sm:w-28">{formatDate(entry.date)}</p>
                <div className="bg-sunken flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-semibold break-words">{entry.title}</p>
                    {entry.fileName && (
                      <p className="text-ink-subtle mt-0.5 text-xs break-all">File: {entry.fileName}</p>
                    )}
                  </div>
                  <span className="bg-brand-50 text-brand-700 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium">
                    {entry.uploadedBy ? `Uploaded by ${entry.uploadedBy}` : 'Uploaded'}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

/* ---------------------------------- parts --------------------------------- */

const cell = 'text-ink-muted px-4 py-3.5 whitespace-nowrap'
const cellName = 'text-ink px-4 py-3.5 font-semibold whitespace-nowrap'
const linkBtn = 'text-brand-700 hover:text-brand-800 text-sm font-medium'
const plainBtn = 'text-ink hover:text-brand-700 text-sm font-medium'

function CertificationRow({ credential: c }: { credential: DocumentsCredentialDto }) {
  return (
    <tr>
      <th scope="row" className={cellName}>
        {c.name}
      </th>
      <td className={cell}>{c.licenseNumber ?? '—'}</td>
      <td className={cell}>{formatMonth(c.issued)}</td>
      <td className={cell}>{formatMonth(c.expires)}</td>
      <td className={cell}>
        <StatusTag tone={toneFor(c.status)}>{statusWord(c.status)}</StatusTag>
      </td>
      <td className={cell}>
        {c.hasDocument ? (
          <button type="button" className={cn(linkBtn, 'inline-flex items-center gap-1.5')}>
            <FileText className="size-4" strokeWidth={1.9} aria-hidden="true" />
            View PDF
            {c.fileName && <span className="sr-only"> {c.fileName}</span>}
          </button>
        ) : (
          <span className="text-ink-subtle">No file</span>
        )}
      </td>
      <td className={cn(cell, 'text-right')}>
        <span className="inline-flex items-center gap-4">
          <button type="button" className={linkBtn}>
            Renew<span className="sr-only"> {c.name}</span>
          </button>
          {c.hasDocument && (
            <button type="button" className={plainBtn}>
              Download<span className="sr-only"> {c.name}</span>
            </button>
          )}
        </span>
      </td>
    </tr>
  )
}

function EmploymentRow({ doc }: { doc: DocumentsEmploymentDto }) {
  return (
    <tr>
      <th scope="row" className={cellName}>
        {doc.name}
      </th>
      <td className={cell}>{statusWord(doc.category)}</td>
      <td className={cell}>{formatMonth(doc.date)}</td>
      <td className={cell}>
        <StatusTag tone={toneFor(doc.status)}>{statusWord(doc.status)}</StatusTag>
      </td>
      <td className={cn(cell, 'text-right')}>
        <span className="inline-flex items-center gap-4">
          <button type="button" className={linkBtn}>
            View<span className="sr-only"> {doc.name}</span>
          </button>
          {doc.hasDocument && (
            <button type="button" className={plainBtn}>
              Download<span className="sr-only"> {doc.name}</span>
            </button>
          )}
        </span>
      </td>
    </tr>
  )
}

function TrainingRow({ record }: { record: DocumentsTrainingDto }) {
  const done = record.status === 'COMPLETE' || record.certificate
  return (
    <tr>
      <th scope="row" className={cellName}>
        {record.name}
        {record.status === 'IN_PROGRESS' && ' (In Progress)'}
        {record.status === 'NOT_STARTED' && ' (Not Started)'}
      </th>
      <td className={cell}>{formatMonth(record.completed)}</td>
      <td className={cell}>{record.certificate ? 'Yes' : '—'}</td>
      <td className={cn(cell, 'tabular-nums')}>{record.hoursLabel}</td>
      <td className={cn(cell, 'text-right')}>
        <button type="button" className={linkBtn}>
          {done ? 'View Certificate' : record.status === 'IN_PROGRESS' ? 'Resume' : 'Start'}
          <span className="sr-only"> {record.name}</span>
        </button>
      </td>
    </tr>
  )
}

function DocCard({
  title,
  add,
  member,
  children,
}: {
  title: string
  add: string
  member: StaffMember
  children: React.ReactNode
}) {
  const id = `docs-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={id} className="text-ink text-base font-semibold tracking-tight">
          {title}
        </h3>
        <button
          type="button"
          className="border-control text-ink hover:bg-sunken inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium"
        >
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          {add}
          <span className="sr-only"> for {member.name}</span>
        </button>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label={`${title} table`}
        className="border-line mt-4 overflow-x-auto rounded-lg border"
      >
        {children}
      </div>
    </section>
  )
}

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="border-line bg-sunken text-ink-muted border-b text-xs">
      <tr>
        {columns.map((col) => (
          <th
            key={col}
            scope="col"
            className={cn('px-4 py-2.5 font-medium', col === 'Actions' && 'text-right')}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function StatusTag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-semibold', tone)}>
      {children}
    </span>
  )
}
