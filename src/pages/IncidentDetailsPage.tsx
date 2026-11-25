/**
 * One incident, opened from the register, rendered from the live backend.
 *
 * Four tabs, four endpoints: Overview (`/incidents/:id`), Timeline, Communication
 * and Resolution. The Overview query gates the page with a spinner and an error
 * card; each other tab renders its own small loading state. The header actions
 * (Start review, Escalate, Resolve, Close) and the Timeline, Communication and
 * Resolution writes all hit the real endpoints.
 *
 * The route carries the incident uuid in its first segment; that value is the
 * API `:id`. Every field the backend pre formats is rendered as is, and a null
 * field shows a placeholder rather than an invented value.
 */
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Loader2, Phone, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { telHref } from '@/features/monitoring/live-data'
import { Avatar } from '@/components/ui/Avatar'
import { Panel } from '@/components/ui/Panel'
import { Toggle } from '@/components/ui/Toggle'
import { SelectBox } from '@/components/ui/SelectBox'
import { fieldControl } from '@/lib/field-classes'
import { tonePill } from '@/lib/tone'
import type { Tone } from '@/types'
import { cn } from '@/lib/cn'
import {
  channelOptions,
  outcomeOptions,
  resolutionStatusOptions,
  timelineKindOptions,
  useAppendTimelineEntry,
  useIncidentCommunications,
  useIncidentDetail,
  useIncidentLifecycle,
  useIncidentResolution,
  useIncidentTimeline,
  useLogCommunication,
  useResolveIncident,
  useSaveResolution,
  type AppendTimelineInput,
  type CommunicationChannel,
  type CommunicationOutcome,
  type ContactBookEntry,
  type IncidentCommunication,
  type IncidentDetail,
  type IncidentResolution,
  type IncidentResolutionStatus,
  type IncidentTimelineEntry,
  type LogCommunicationInput,
} from '@/features/monitoring/useIncidentDetail'

const tabs = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'timeline', label: 'Timeline' },
  { slug: 'communication', label: 'Communication' },
  { slug: 'resolution', label: 'Resolution' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

function isTab(value: string | undefined): value is TabSlug {
  return tabs.some((t) => t.slug === value)
}

/** A priority label to a badge tone. Falls back to slate for the unknown. */
function priorityTone(label: string): Tone {
  const lower = label.toLowerCase()
  if (lower.includes('critical')) return 'red'
  if (lower.includes('urgent') || lower.includes('high')) return 'amber'
  if (lower.includes('medium')) return 'blue'
  return 'slate'
}

export function IncidentDetailsPage() {
  // The route's first segment is the incident uuid (the backend `:id`); the
  // param is named `reference` for historical reasons.
  const { reference: id, tab } = useParams()

  if (!id) return <Navigate to="/live-monitoring/alerts?tab=incidents" replace />
  if (!isTab(tab))
    return (
      <Navigate to={`/live-monitoring/alerts/${encodeURIComponent(id)}/overview`} replace />
    )

  return <IncidentDetails id={id} tab={tab} />
}

function IncidentDetails({ id, tab }: { id: string; tab: TabSlug }) {
  const { data, isPending, isError, error, refetch } = useIncidentDetail(id)
  const lifecycle = useIncidentLifecycle(id)

  if (isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading incident…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load this incident.</p>
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

  const incident = data

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/live-monitoring" className="hover:text-ink">
              Live monitoring
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/live-monitoring/alerts?tab=incidents" className="hover:text-ink">
              Alerts &amp; incidents
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink font-medium" aria-current="page">
            {incident.reference}
          </li>
        </ol>
      </nav>

      <header className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-ink text-2xl font-bold tracking-tight">
                {incident.reference}
              </h1>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                  tonePill[priorityTone(incident.priorityLabel)],
                )}
              >
                {incident.priorityLabel}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                  incident.active
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700',
                )}
              >
                {incident.statusLabel}
              </span>
            </div>
            <p className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>{incident.incidentType}</span>
              {incident.recipient && (
                <>
                  <span aria-hidden="true" className="text-ink-subtle">
                    |
                  </span>
                  <span>
                    Recipient:{' '}
                    <span className="text-ink font-medium">{incident.recipient.name}</span>
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-ink-subtle">
                |
              </span>
              <span>
                Reported by <span className="text-ink font-medium">{incident.reportedBy}</span>,{' '}
                {incident.reportedTime}
              </span>
            </p>
          </div>

          {/* Lifecycle actions, all real endpoints. Only shown while the incident
              is still active; a closed incident has nowhere left to move. */}
          {incident.active && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate('review')}
                className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
              >
                Start review
              </button>
              <button
                type="button"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate('escalate')}
                className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
              >
                Escalate
              </button>
              <button
                type="button"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate('resolve')}
                className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Resolve incident
              </button>
            </div>
          )}
        </div>

        {lifecycle.isError && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            {lifecycle.error.message}
          </p>
        )}

        <nav
          aria-label="Incident record"
          className="border-line no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto border-b px-2 sm:-mx-6 sm:px-4"
        >
          {tabs.map((t) => {
            const selected = t.slug === tab
            return (
              <Link
                key={t.slug}
                to={`/live-monitoring/alerts/${encodeURIComponent(id)}/${t.slug}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                  selected
                    ? 'border-brand-600 text-brand-700'
                    : 'text-ink-muted hover:text-ink border-transparent',
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </header>

      {tab === 'overview' && <OverviewTab incident={incident} />}
      {tab === 'timeline' && <TimelineTab id={id} />}
      {tab === 'communication' && <CommunicationTab id={id} />}

      {/* Rendered only on its own tab: unlike the old mock form it writes to the
          backend, so there is no in tab draft to keep alive across tab switches. */}
      {tab === 'resolution' && <ResolutionTab id={id} active={incident.active} />}
    </div>
  )
}

/* -------------------------------- overview -------------------------------- */

function OverviewTab({ incident }: { incident: IncidentDetail }) {
  const { recipient, caregiver, relatedVisit } = incident
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Panel title="Incident information">
          <Rows
            rows={[
              { id: 'type', label: 'Category', value: incident.incidentType },
              { id: 'priority', label: 'Priority', value: incident.priorityLabel },
              { id: 'status', label: 'Status', value: incident.statusLabel },
              { id: 'by', label: 'Reported by', value: incident.reportedBy },
              { id: 'at', label: 'Reported', value: incident.reportedTime },
              {
                id: 'coordinator',
                label: 'Assigned coordinator',
                value: incident.assignedCoordinator ?? 'Unassigned',
              },
            ]}
          />
          {incident.description && (
            <>
              <h3 className="text-ink-subtle mt-4 text-xs font-semibold tracking-wider uppercase">
                Description
              </h3>
              <p className="text-ink mt-1.5 text-sm break-words">{incident.description}</p>
            </>
          )}
        </Panel>

        {recipient ? (
          <Panel title="Care recipient">
            <div className="flex items-center gap-3">
              <Avatar name={recipient.name} decorative className="size-10 shrink-0" />
              <div className="min-w-0">
                <p className="text-ink text-sm font-semibold break-words">{recipient.name}</p>
                <p className="text-ink-subtle text-xs">{recipient.age} years old</p>
              </div>
            </div>
            <Rows
              rows={[
                {
                  id: 'lang',
                  label: 'Primary language',
                  value: recipient.primaryLanguage ?? '—',
                },
                {
                  id: 'conditions',
                  label: 'Diagnosed conditions',
                  value:
                    recipient.diagnosedConditions.length > 0
                      ? recipient.diagnosedConditions.join(', ')
                      : '—',
                },
                {
                  id: 'emergency',
                  label: 'Emergency contact',
                  value: recipient.emergencyContact ?? '—',
                },
              ]}
            />
          </Panel>
        ) : (
          <Panel title="Care recipient">
            <p className="text-ink-subtle text-sm" role="status">
              No care recipient is linked to this incident.
            </p>
          </Panel>
        )}
      </div>

      <div className="space-y-4">
        {caregiver ? (
          <Panel title="Caregiver">
            <div className="flex items-center gap-3">
              <Avatar name={caregiver.name} decorative className="size-10 shrink-0" />
              <div className="min-w-0">
                <p className="text-ink text-sm font-semibold break-words">{caregiver.name}</p>
                <p className="text-ink-subtle text-xs break-words">
                  {caregiver.designation ?? '—'}
                </p>
              </div>
            </div>
            {caregiver.phone && (
              <Rows
                rows={[
                  {
                    id: 'phone',
                    label: 'Contact',
                    value: (
                      <a
                        href={telHref(caregiver.phone)}
                        className="text-brand-700 hover:text-brand-800"
                      >
                        {caregiver.phone}
                      </a>
                    ),
                  },
                ]}
              />
            )}
          </Panel>
        ) : (
          <Panel title="Caregiver">
            <p className="text-ink-subtle text-sm" role="status">
              No caregiver is linked to this incident.
            </p>
          </Panel>
        )}

        {relatedVisit ? (
          <Panel title="Related visit">
            <Rows
              rows={[
                { id: 'ref', label: 'Reference', value: relatedVisit.reference },
                { id: 'when', label: 'Schedule', value: relatedVisit.scheduleLabel },
                { id: 'type', label: 'Service', value: relatedVisit.serviceType },
                { id: 'status', label: 'Status', value: relatedVisit.statusLabel },
              ]}
            />
          </Panel>
        ) : (
          <Panel title="Related visit">
            <p className="text-ink-subtle text-sm" role="status">
              No visit is linked to this incident.
            </p>
          </Panel>
        )}
      </div>
    </div>
  )
}

/* -------------------------------- timeline -------------------------------- */

function TimelineTab({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useIncidentTimeline(id, true)
  const append = useAppendTimelineEntry(id)
  const { admin } = useAuth()

  const [form, setForm] = useState<{
    kind: AppendTimelineInput['kind']
    title: string
    description: string
    actorRole: string
  }>({ kind: 'NOTE', title: '', description: '', actorRole: '' })

  const canSubmit = form.title.trim() !== '' && form.description.trim() !== ''

  const submit = () => {
    if (!canSubmit) return
    append.mutate(
      {
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim(),
        actorName: admin?.fullName,
        actorRole: form.actorRole.trim() || undefined,
      },
      {
        onSuccess: () =>
          setForm({ kind: 'NOTE', title: '', description: '', actorRole: '' }),
      },
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <Panel title="Timeline" flush>
          {isPending ? (
            <TabLoading label="Loading timeline…" />
          ) : isError ? (
            <TabError message={error.message} onRetry={() => void refetch()} />
          ) : data.entries.length === 0 ? (
            <p className="text-ink-subtle border-line border-t px-4 py-4 text-sm" role="status">
              Nothing has been recorded on this incident yet.
            </p>
          ) : (
            <ol className="divide-line border-line divide-y border-t">
              {data.entries.map((entry, index) => (
                <TimelineRow key={`${entry.at}-${index}`} entry={entry} />
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Add a timeline entry">
          <div className="space-y-4">
            <Field label="Kind" htmlFor="tl-kind">
              <SelectBox
                id="tl-kind"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as AppendTimelineInput['kind'],
                  }))
                }
                className={fieldControl}
              >
                {timelineKindOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectBox>
            </Field>
            <Field label="Title" htmlFor="tl-title">
              <input
                id="tl-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={fieldControl}
              />
            </Field>
            <Field label="Description" htmlFor="tl-desc">
              <textarea
                id="tl-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="border-line focus:border-brand-500 w-full rounded-lg border p-3 text-sm"
              />
            </Field>
            <Field
              label="Actor role"
              htmlFor="tl-role"
              hint={`Recorded as ${admin?.fullName ?? 'you'}. The role is optional.`}
            >
              <input
                id="tl-role"
                value={form.actorRole}
                onChange={(e) => setForm((f) => ({ ...f, actorRole: e.target.value }))}
                className={fieldControl}
              />
            </Field>
            {append.isError && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {append.error.message}
              </p>
            )}
            <button
              type="button"
              disabled={!canSubmit || append.isPending}
              onClick={submit}
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Add entry
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function TimelineRow({ entry }: { entry: IncidentTimelineEntry }) {
  return (
    <li className="flex gap-3 p-4">
      <span className="w-20 shrink-0 text-right">
        <span className="text-ink block text-xs font-semibold tabular-nums">
          {entry.timeLabel}
        </span>
        <span className="text-ink-subtle block text-xs">{entry.dayLabel}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-ink min-w-0 text-sm font-medium break-words">{entry.title}</p>
          {entry.actor && (
            <p className="text-ink-subtle shrink-0 text-xs break-words">{entry.actor}</p>
          )}
        </div>
        {entry.description && (
          <p className="text-ink-muted bg-sunken/60 mt-1.5 rounded-lg p-2.5 text-sm break-words">
            {entry.description}
          </p>
        )}
      </div>
    </li>
  )
}

/* ----------------------------- communication ------------------------------ */

function CommunicationTab({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useIncidentCommunications(id, true)
  const log = useLogCommunication(id)

  const [form, setForm] = useState<{
    channel: CommunicationChannel
    outcome: CommunicationOutcome
    contactName: string
    contactRole: string
    notes: string
  }>({
    channel: 'PHONE_CALL',
    outcome: 'REACHED',
    contactName: '',
    contactRole: '',
    notes: '',
  })

  const canSubmit = form.contactName.trim() !== ''

  const submit = () => {
    if (!canSubmit) return
    const input: LogCommunicationInput = {
      channel: form.channel,
      outcome: form.outcome,
      contactName: form.contactName.trim(),
      contactRole: form.contactRole.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }
    log.mutate(input, {
      onSuccess: () =>
        setForm((f) => ({ ...f, contactName: '', contactRole: '', notes: '' })),
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Panel
          title="Communication log"
          badge={
            !isPending && !isError ? (
              <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
                {data.communications.length} logged
              </span>
            ) : undefined
          }
          flush={!isPending && !isError && data.communications.length > 0}
        >
          {isPending ? (
            <TabLoading label="Loading communications…" />
          ) : isError ? (
            <TabError message={error.message} onRetry={() => void refetch()} />
          ) : data.communications.length === 0 ? (
            <p className="text-ink-subtle text-sm" role="status">
              No communications have been logged on this incident yet.
            </p>
          ) : (
            <ul className="divide-line border-line divide-y border-t">
              {data.communications.map((entry) => (
                <CommunicationRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Record a communication">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Channel" htmlFor="cm-channel">
                <SelectBox
                  id="cm-channel"
                  value={form.channel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, channel: e.target.value as CommunicationChannel }))
                  }
                  className={fieldControl}
                >
                  {channelOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectBox>
              </Field>
              <Field label="Outcome" htmlFor="cm-outcome">
                <SelectBox
                  id="cm-outcome"
                  value={form.outcome}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, outcome: e.target.value as CommunicationOutcome }))
                  }
                  className={fieldControl}
                >
                  {outcomeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectBox>
              </Field>
            </div>
            <Field label="Contact name" htmlFor="cm-name">
              <input
                id="cm-name"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                className={fieldControl}
              />
            </Field>
            <Field label="Contact role" htmlFor="cm-role">
              <input
                id="cm-role"
                value={form.contactRole}
                onChange={(e) => setForm((f) => ({ ...f, contactRole: e.target.value }))}
                className={fieldControl}
              />
            </Field>
            <Field label="Notes" htmlFor="cm-notes">
              <textarea
                id="cm-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="border-line focus:border-brand-500 w-full rounded-lg border p-3 text-sm"
              />
            </Field>
            {log.isError && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {log.error.message}
              </p>
            )}
            <button
              type="button"
              disabled={!canSubmit || log.isPending}
              onClick={submit}
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Log communication
            </button>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Contact book">
          {isPending ? (
            <TabLoading label="Loading contacts…" />
          ) : isError ? (
            <TabError message={error.message} onRetry={() => void refetch()} />
          ) : (
            <ul className="divide-line divide-y">
              <ContactRow label="Family emergency contact" entry={data.contactBook.familyEmergencyContact} />
              <ContactRow label="Assigned caregiver" entry={data.contactBook.assignedCaregiver} />
              <ContactRow label="Escalation supervisor" entry={data.contactBook.escalationSupervisor} />
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function CommunicationRow({ entry }: { entry: IncidentCommunication }) {
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={entry.contactName} decorative className="size-9 shrink-0" />
          <div className="min-w-0">
            <p className="text-ink text-sm font-semibold break-words">{entry.contactName}</p>
            <p className="text-ink-subtle text-xs break-words">
              {entry.contactRole ?? 'Contact'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="border-line text-ink-muted inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
            {entry.channelLabel}
          </span>
          <span className="text-ink-subtle text-xs">{entry.outcomeLabel}</span>
          <span className="text-ink-subtle text-xs whitespace-nowrap">
            {entry.timestampLabel}
          </span>
        </div>
      </div>
      {entry.notes && (
        <p className="text-ink mt-2.5 text-sm break-words">{entry.notes}</p>
      )}
    </li>
  )
}

function ContactRow({ label, entry }: { label: string; entry: ContactBookEntry | null }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">{label}</p>
      {entry ? (
        <>
          <div className="mt-1.5 flex items-center gap-2.5">
            <Avatar name={entry.name} decorative className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="text-ink text-sm font-semibold break-words">{entry.name}</p>
              <p className="text-ink-subtle text-xs break-words">{entry.subtitle ?? '—'}</p>
            </div>
          </div>
          {entry.phone ? (
            <a
              href={telHref(entry.phone)}
              className="text-brand-700 hover:text-brand-800 mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
            >
              <Phone className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
              {entry.phone}
              <span className="sr-only"> — call {entry.name}</span>
            </a>
          ) : (
            <p className="text-ink-subtle mt-1.5 text-sm">No number on file.</p>
          )}
        </>
      ) : (
        <p className="text-ink-subtle mt-1.5 text-sm">None on file.</p>
      )}
    </li>
  )
}

/* ------------------------------- resolution ------------------------------- */

interface ResolutionDraft {
  status: IncidentResolutionStatus
  summary: string
  actionsTaken: string
  followUpRequired: boolean
  followUpDate: string
  followUpNotes: string
}

function toDraft(resolution: IncidentResolution): ResolutionDraft {
  return {
    status: resolution.status,
    summary: resolution.summary ?? '',
    actionsTaken: resolution.actionsTaken ?? '',
    followUpRequired: resolution.followUpRequired,
    followUpDate: resolution.followUpDate ?? '',
    followUpNotes: resolution.followUpNotes ?? '',
  }
}

/** Only the fields the user may have set; empty strings are dropped so a blank
 *  field is not sent as an empty value the backend would store. */
function toInput(draft: ResolutionDraft) {
  return {
    status: draft.status,
    summary: draft.summary.trim() || undefined,
    actionsTaken: draft.actionsTaken.trim() || undefined,
    followUpRequired: draft.followUpRequired,
    followUpDate: draft.followUpRequired ? draft.followUpDate || undefined : undefined,
    followUpNotes: draft.followUpNotes.trim() || undefined,
  }
}

function ResolutionTab({ id, active }: { id: string; active: boolean }) {
  const { data, isPending, isError, error, refetch } = useIncidentResolution(id, true)

  if (isPending) {
    return (
      <Panel title="Resolution">
        <TabLoading label="Loading resolution…" />
      </Panel>
    )
  }
  if (isError) {
    return (
      <Panel title="Resolution">
        <TabError message={error.message} onRetry={() => void refetch()} />
      </Panel>
    )
  }

  // Keyed on the server timestamp so a refetch (after a save or a lifecycle
  // action) remounts the form with fresh state seeded from what was stored,
  // rather than reseeding through an effect.
  return (
    <ResolutionForm key={data.generatedAt} id={id} resolution={data} active={active} />
  )
}

function ResolutionForm({
  id,
  resolution,
  active,
}: {
  id: string
  resolution: IncidentResolution
  active: boolean
}) {
  const save = useSaveResolution(id)
  const resolve = useResolveIncident(id)
  const [draft, setDraft] = useState<ResolutionDraft>(() => toDraft(resolution))

  const set = <K extends keyof ResolutionDraft>(key: K, value: ResolutionDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const pending = save.isPending || resolve.isPending
  const mutationError = save.error ?? resolve.error

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Panel
          title="Resolution"
          badge={
            resolution.resolved ? (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                {resolution.statusLabel}
              </span>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <Field label="Resolution status" htmlFor="res-status">
              <SelectBox
                id="res-status"
                value={draft.status}
                onChange={(e) =>
                  set('status', e.target.value as IncidentResolutionStatus)
                }
                className={fieldControl}
              >
                {resolutionStatusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectBox>
            </Field>

            <Field label="Resolution summary" htmlFor="res-summary">
              <textarea
                id="res-summary"
                rows={3}
                value={draft.summary}
                onChange={(e) => set('summary', e.target.value)}
                className="border-line focus:border-brand-500 w-full rounded-lg border p-3 text-sm"
              />
            </Field>

            <Field label="Actions taken" htmlFor="res-actions">
              <textarea
                id="res-actions"
                rows={3}
                value={draft.actionsTaken}
                onChange={(e) => set('actionsTaken', e.target.value)}
                className="border-line focus:border-brand-500 w-full rounded-lg border p-3 text-sm"
              />
            </Field>

            <div className="border-line border-t pt-4">
              <Toggle
                label="Follow-up required"
                checked={draft.followUpRequired}
                onChange={(next) => set('followUpRequired', next)}
                hint="Somebody has to check back before this is done with."
              />
            </div>

            {draft.followUpRequired && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Follow-up date" htmlFor="res-date">
                  <input
                    id="res-date"
                    type="date"
                    value={draft.followUpDate}
                    onChange={(e) => set('followUpDate', e.target.value)}
                    className={fieldControl}
                  />
                </Field>
                <Field label="Follow-up notes" htmlFor="res-notes">
                  <textarea
                    id="res-notes"
                    rows={2}
                    value={draft.followUpNotes}
                    onChange={(e) => set('followUpNotes', e.target.value)}
                    className="border-line focus:border-brand-500 w-full rounded-lg border p-3 text-sm"
                  />
                </Field>
              </div>
            )}

            <div className="border-line grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
              <Field label="Resolved by" htmlFor="res-by">
                <input
                  id="res-by"
                  readOnly
                  value={resolution.resolvedBy ?? 'Not resolved yet'}
                  className={cn(fieldControl, 'bg-sunken text-ink-muted')}
                />
              </Field>
              <Field label="Resolution time" htmlFor="res-time">
                <input
                  id="res-time"
                  readOnly
                  value={resolution.resolutionTimeLabel ?? 'Not resolved yet'}
                  className={cn(fieldControl, 'bg-sunken text-ink-muted')}
                />
              </Field>
            </div>
          </div>

          {mutationError && (
            <p role="alert" className="mt-4 text-sm font-medium text-red-700">
              {mutationError.message}
            </p>
          )}

          <div className="border-line mt-5 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => save.mutate(toInput(draft))}
              className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={pending || !active || resolution.resolved}
              onClick={() => resolve.mutate(toInput(draft))}
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Mark resolved
            </button>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Current disposition">
          <Rows
            rows={[
              { id: 'status', label: 'Status', value: resolution.statusLabel },
              {
                id: 'followUp',
                label: 'Follow-up required',
                value: resolution.followUpRequired ? 'Yes' : 'No',
              },
              {
                id: 'followUpDate',
                label: 'Follow-up date',
                value: resolution.followUpDateLabel ?? '—',
              },
              {
                id: 'resolvedBy',
                label: 'Resolved by',
                value: resolution.resolvedBy ?? '—',
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  )
}

/* -------------------------------- shared ---------------------------------- */

function Rows({
  rows,
}: {
  rows: { id: string; label: string; value: React.ReactNode }[]
}) {
  return (
    <dl className="divide-line mt-3 divide-y border-t">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5"
        >
          <dt className="text-ink-muted min-w-0 text-sm">{row.label}</dt>
          <dd className="text-ink min-w-0 text-right text-sm font-medium break-words">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-ink block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-ink-subtle mt-0.5 text-xs">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function TabLoading({ label }: { label: string }) {
  return (
    <div className="text-ink-subtle flex items-center justify-center gap-2 py-10 text-sm">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      {label}
    </div>
  )
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-ink-subtle text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="border-line text-ink hover:bg-sunken h-9 rounded-lg border px-4 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  )
}
