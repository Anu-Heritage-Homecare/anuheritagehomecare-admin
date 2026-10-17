import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FileText, Phone, TriangleAlert } from 'lucide-react'
import type { IncidentRecord } from '@/features/monitoring/incidents-data'
import type { BoardVisit } from '@/features/scheduling/board-data'
import {
  INCIDENT_FOLLOW_DAYS,
  formatIncidentAge,
  incidentByReference,
  incidentHistory,
  visitForIncident,
} from '@/features/monitoring/incidents-data'
import { telHref } from '@/features/monitoring/live-data'
import { SIGNED_IN } from '@/lib/session'
import {
  formatFullDay,
  formatTime,
  referenceFor,
} from '@/features/scheduling/visit-detail'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import {
  communicationTones,
  formatContactDate,
  getFamilyRecord,
  memberName,
  memberWithRole,
} from '@/features/care-recipients/family-data'
import { formatNoteTime } from '@/features/care-recipients/notes-data'
import { staffMembers } from '@/features/caregivers/roster-data'
import { Avatar } from '@/components/ui/Avatar'
import { Panel } from '@/components/ui/Panel'
import { Toggle } from '@/components/ui/Toggle'
import { fieldControl } from '@/lib/field-classes'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

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

/**
 * One incident, opened from the register.
 *
 * The incident itself is a care note: an author, a time, a body, a flag, some
 * replies. Everything else on this screen is the context around it — the
 * client's own record, the visit whose window contains the note, the caregiver
 * who wrote it — joined at read time rather than stored on an incident row
 * that does not exist.
 *
 * The design's header carries Escalate and Resolve Incident, and a status of
 * "Under Review". None of those exist: an incident here has no state to move
 * and no escalation path to move it along.
 */
export function IncidentDetailsPage() {
  const { reference, tab } = useParams()
  const incident = incidentByReference(reference)

  if (!incident) return <Navigate to="/live-monitoring/alerts?tab=incidents" replace />
  if (!isTab(tab))
    return (
      <Navigate
        to={`/live-monitoring/alerts/${encodeURIComponent(reference!)}/overview`}
        replace
      />
    )

  const visit = visitForIncident(incident)
  const profile = getRecipientProfile(incident.recipientId)
  const family = getFamilyRecord(incident.recipientId)
  const emergency =
    memberWithRole(family?.members ?? [], 'Emergency Contact') ??
    memberWithRole(family?.members ?? [], 'Primary Contact')
  const reporter = staffMembers.find((m) => m.name === incident.reporter)
  const history = incidentHistory(incident)
  const visitCaregiver = staffMembers.find((m) => m.id === visit?.caregiverId)
  // The reporter's own supervisor, off the roster — not an "Internal
  // Coordinator Hub" nobody staffs.
  const supervisor = staffMembers.find((m) => m.name === reporter?.supervisor)
  /*
   * Contact logged in the same window the timeline uses. Scoped rather than
   * linked: nothing in this app ties a call to an incident, so the closest
   * honest thing to "regarding this incident" is "near it in time".
   */
  const nearbyContact = (family?.log ?? []).filter((entry) => {
    const day = Date.parse(`${incident.at.slice(0, 10)}T00:00:00Z`)
    const at = Date.parse(`${entry.at}T00:00:00Z`)
    return at >= day && at < day + (INCIDENT_FOLLOW_DAYS + 1) * 86_400_000
  })

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
                  incident.flagged
                    ? 'bg-red-50 text-red-700'
                    : 'bg-sunken text-ink-muted',
                )}
              >
                {/* The one priority signal a note holds. No High/Medium scale:
                    nobody graded this. */}
                {incident.flagged ? 'Flagged for review' : 'Filed'}
              </span>
            </div>
            <p className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>
                Recipient:{' '}
                <Link
                  to={`/care-recipients/${incident.recipientId}`}
                  className="text-ink font-medium hover:text-brand-700"
                >
                  {incident.recipientName}
                </Link>
              </span>
              <span aria-hidden="true" className="text-ink-subtle">
                |
              </span>
              <span>
                Written up by <span className="text-ink font-medium">{incident.reporter}</span>
              </span>
              {visit && (
                <>
                  <span aria-hidden="true" className="text-ink-subtle">
                    |
                  </span>
                  <span>
                    Visit:{' '}
                    <Link
                      to={`/scheduling/visits/${visit.id}/overview`}
                      className="text-brand-700 font-medium"
                    >
                      {referenceFor(visit)}
                    </Link>
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Two buttons, both real. The design adds Escalate and Resolve
              Incident; neither has anywhere to go — there is no escalation
              path and no status to set. */}
          <div className="flex flex-wrap gap-2">
            {reporter?.phone && (
              <a
                href={telHref(reporter.phone)}
                className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
              >
                <Phone className="size-4" strokeWidth={1.9} aria-hidden="true" />
                Call {incident.reporter.split(' ')[0]}
                <span className="sr-only"> — who wrote this up, on {reporter.phone}</span>
              </a>
            )}
            {emergency && (
              <a
                href={telHref(emergency.phone)}
                className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
              >
                <Phone className="size-4" strokeWidth={1.9} aria-hidden="true" />
                Call {emergency.name.split(' ')[0]}
                <span className="sr-only">
                  {' '}
                  — {emergency.relationship}, on {emergency.phone}
                </span>
              </a>
            )}
          </div>
        </div>

        <nav
          aria-label="Incident record"
          className="border-line no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto border-b px-2 sm:-mx-6 sm:px-4"
        >
          {tabs.map((t) => {
            const selected = t.slug === tab
            return (
              <Link
                key={t.slug}
                to={`/live-monitoring/alerts/${incident.reference}/${t.slug}`}
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

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Panel title="Incident information">
              <Rows
                rows={[
                  {
                    id: 'category',
                    label: 'Category',
                    // The note's own category and nothing more. The design has
                    // "Medication Concern" / "Recipient Fall" / "Behavioural",
                    // a taxonomy this app does not keep.
                    value: 'Incident report',
                  },
                  {
                    id: 'raised',
                    label: 'Raised',
                    value: incident.flagged
                      ? 'Flagged for supervisor review'
                      : 'Filed, not flagged',
                  },
                  {
                    id: 'by',
                    label: 'Written up by',
                    value: `${incident.reporter} (${incident.reporterRole})`,
                  },
                  {
                    id: 'at',
                    label: 'Written up',
                    value: `${formatNoteTime(incident.at)} · ${formatIncidentAge(incident.at)}`,
                  },
                ]}
              />
              <h3 className="text-ink-subtle mt-4 text-xs font-semibold tracking-wider uppercase">
                What was written
              </h3>
              <p className="text-ink mt-1.5 text-sm break-words">{incident.body}</p>
              <p className="text-ink-subtle mt-3 text-xs">
                Taken verbatim from {incident.recipientName}&rsquo;s care notes.{' '}
                <Link
                  to={`/care-recipients/${incident.recipientId}/notes`}
                  className="text-brand-700"
                >
                  See it in context
                </Link>
                .
              </p>
            </Panel>

            {profile && (
              <Panel
                title="Care recipient"
                action={{
                  label: 'View profile',
                  to: `/care-recipients/${incident.recipientId}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={incident.recipientName}
                    decorative
                    className="size-10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-semibold break-words">
                      {incident.recipientName}
                    </p>
                    <p className="text-ink-subtle text-xs">
                      {profile.age} years old · {profile.sex}
                    </p>
                  </div>
                </div>
                <Rows
                  rows={[
                    {
                      id: 'lang',
                      label: 'Languages',
                      value: profile.personal.languages,
                    },
                    {
                      id: 'primary',
                      label: 'Primary diagnosis',
                      value: profile.summary.primaryDiagnosis,
                    },
                    {
                      id: 'secondary',
                      label: 'Secondary diagnosis',
                      value: profile.summary.secondaryDiagnosis,
                    },
                    {
                      id: 'emergency',
                      label: 'Emergency contact',
                      value: emergency ? (
                        <a
                          href={telHref(emergency.phone)}
                          className="text-brand-700 hover:text-brand-800"
                        >
                          {emergency.name} ({emergency.relationship}) ·{' '}
                          {emergency.phone}
                        </a>
                      ) : (
                        'None on file'
                      ),
                    },
                  ]}
                />
              </Panel>
            )}
          </div>

          <div className="space-y-4">
            <Panel title="Follow-up">
              {/* Where the design has "Operational Assignment / Under Review".
                  Nothing assigns an incident or reviews it here; what the note
                  keeps is who coordinates the client and whether anybody has
                  replied. */}
              <Rows
                rows={[
                  {
                    id: 'coordinator',
                    label: 'Client’s coordinator',
                    value: profile?.summary.coordinator ?? 'Not on file',
                  },
                  {
                    id: 'replies',
                    label: 'Replies on the note',
                    value:
                      incident.replies === 0
                        ? 'None yet'
                        : `${incident.replies} ${incident.replies === 1 ? 'reply' : 'replies'}`,
                  },
                  {
                    id: 'attachments',
                    label: 'Attachments',
                    value:
                      incident.attachments === 0
                        ? 'None'
                        : `${incident.attachments}`,
                  },
                ]}
              />
              <p className="text-ink-subtle mt-3 text-xs">
                An incident has no status in this app — nothing to acknowledge,
                escalate or close. The reply count is the only sign anybody has
                picked it up.
              </p>
            </Panel>

            {visit ? (
              <Panel
                title="Visit it was written during"
                action={{
                  label: 'Open the visit',
                  to: `/scheduling/visits/${visit.id}/overview`,
                }}
              >
                <Rows
                  rows={[
                    { id: 'ref', label: 'Reference', value: referenceFor(visit) },
                    {
                      id: 'when',
                      label: 'Schedule',
                      value: `${formatFullDay(visit.date)}, ${formatTime(visit.start)}–${formatTime(visit.end)}`,
                    },
                    { id: 'type', label: 'Service', value: visit.type },
                    {
                      id: 'cg',
                      label: 'Caregiver',
                      value: visit.caregiverName ?? 'Nobody assigned',
                    },
                  ]}
                />
                <p className="text-ink-subtle mt-3 text-xs">
                  Nothing links a note to a visit; this is the visit whose
                  window contains it.
                </p>
              </Panel>
            ) : (
              <Panel title="Visit it was written during">
                <p className="text-ink-subtle text-sm" role="status">
                  No visit on {formatFullDay(incident.at.slice(0, 10))} has a
                  window containing this note.
                </p>
              </Panel>
            )}

            {reporter && (
              <Panel
                title="Who wrote it up"
                action={{
                  label: 'Profile',
                  to: `/caregivers/${reporter.id}/overview`,
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={reporter.name} decorative className="size-10 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-semibold break-words">
                      {reporter.name}
                    </p>
                    <p className="text-ink-subtle text-xs break-words">
                      {reporter.title}
                    </p>
                  </div>
                </div>
                <Rows
                  rows={[
                    {
                      id: 'phone',
                      label: 'Contact',
                      value: (
                        <a
                          href={telHref(reporter.phone)}
                          className="text-brand-700 hover:text-brand-800"
                        >
                          {reporter.phone}
                        </a>
                      ),
                    },
                    { id: 'branch', label: 'Branch', value: reporter.branch },
                    {
                      id: 'role',
                      label: 'Role on this client',
                      value: incident.reporterRole,
                    },
                  ]}
                />
              </Panel>
            )}
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel title="What the record shows" flush>
              <p className="border-line text-ink-muted border-t px-4 py-3 text-sm">
                {/* The design calls this a "Live audit of operational response,
                    caregiver feedback, and family notification". It is not an
                    audit: nothing here logs a notification being sent, a
                    review being started, or an incident being assigned. */}
                The incident, then what else was written for{' '}
                {incident.recipientName} in the {INCIDENT_FOLLOW_DAYS} days
                after it. Nothing links these to the incident — this app records
                no response to one — so they are what the record holds, not a
                reply to what happened.
              </p>
              <ol className="divide-line border-line divide-y border-t">
                {history.map((event) => (
                  <li key={event.id} className="flex gap-3 p-4">
                    <span className="w-20 shrink-0 text-right">
                      <span
                        className={cn(
                          'block text-xs tabular-nums',
                          event.anchor ? 'text-ink font-semibold' : 'text-ink-subtle',
                        )}
                      >
                        {event.timed ? formatTime(event.at.slice(11, 16)) : '—'}
                      </span>
                      <span className="text-ink-subtle block text-xs">
                        {formatIncidentAge(event.at)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1 grid size-7 shrink-0 place-items-center rounded-full',
                        event.anchor
                          ? 'bg-red-50 text-red-600'
                          : event.kind === 'contact'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-sunken text-ink-subtle',
                      )}
                    >
                      {event.kind === 'contact' ? (
                        <Phone className="size-3.5" strokeWidth={2.2} />
                      ) : event.anchor ? (
                        <TriangleAlert className="size-3.5" strokeWidth={2.2} />
                      ) : (
                        <FileText className="size-3.5" strokeWidth={2.2} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p
                          className={cn(
                            'min-w-0 text-sm break-words',
                            event.anchor ? 'text-ink font-semibold' : 'text-ink font-medium',
                          )}
                        >
                          {event.title}
                          {event.anchor && (
                            <span className="sr-only"> — this incident</span>
                          )}
                        </p>
                        <p className="text-ink-subtle shrink-0 text-xs break-words">
                          {event.who}{' '}
                          <span className="text-ink-subtle">({event.whoRole})</span>
                        </p>
                      </div>
                      {event.detail && (
                        <p className="text-ink-muted bg-sunken/60 mt-1.5 rounded-lg p-2.5 text-sm break-words">
                          {event.detail}
                        </p>
                      )}
                      {!event.timed && (
                        <p className="text-ink-subtle mt-1 text-xs">
                          {/* Said, not hidden: the family log keeps a date and
                              no clock time, so this cannot be placed against
                              the others to the minute. */}
                          The family log records the day, not the time.
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-ink-subtle border-line border-t px-4 py-3 text-xs">
                Not shown, because nothing records them: who was notified and
                when, whether a supervisor reviewed it, whether it was assigned
                to anybody.{' '}
                {incident.replies > 0 &&
                  `${incident.replies} ${incident.replies === 1 ? 'reply sits' : 'replies sit'} on the note itself, without timestamps.`}
              </p>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Follow-up">
              <Rows
                rows={[
                  {
                    id: 'coordinator',
                    label: 'Client’s coordinator',
                    value: profile?.summary.coordinator ?? 'Not on file',
                  },
                  {
                    id: 'replies',
                    label: 'Replies on the note',
                    value:
                      incident.replies === 0
                        ? 'None yet'
                        : `${incident.replies} ${incident.replies === 1 ? 'reply' : 'replies'}`,
                  },
                  {
                    id: 'since',
                    label: 'Written up',
                    value: formatIncidentAge(incident.at),
                  },
                ]}
              />
            </Panel>

            {visit && (
              <Panel
                title="Visit it was written during"
                action={{
                  label: 'Open the visit',
                  to: `/scheduling/visits/${visit.id}/overview`,
                }}
              >
                <Rows
                  rows={[
                    { id: 'ref', label: 'Reference', value: referenceFor(visit) },
                    {
                      id: 'when',
                      label: 'Schedule',
                      value: `${formatFullDay(visit.date)}, ${formatTime(visit.start)}–${formatTime(visit.end)}`,
                    },
                    { id: 'type', label: 'Service', value: visit.type },
                    {
                      id: 'cg',
                      label: 'Caregiver',
                      value: visit.caregiverName ?? 'Nobody assigned',
                    },
                  ]}
                />
              </Panel>
            )}
          </div>
        </div>
      )}

      {tab === 'communication' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel
              title="Contact around this incident"
              badge={
                <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
                  {nearbyContact.length} in {INCIDENT_FOLLOW_DAYS + 1} days
                </span>
              }
              flush={nearbyContact.length > 0}
            >
              {/* The design says "3 documented communications regarding this
                  incident" and offers a Record Communication button. Neither
                  works here: nothing links a call to an incident, and the app
                  sends nothing itself — the log is a record of contact made
                  elsewhere, with no way to add to it from this screen. */}
              {nearbyContact.length === 0 ? (
                <p className="text-ink-subtle text-sm" role="status">
                  Nothing is logged with {incident.recipientName}&rsquo;s family
                  between the day of the incident and{' '}
                  {INCIDENT_FOLLOW_DAYS} days after.
                  {family && family.log.length > 0 && (
                    <>
                      {' '}
                      The family record holds {family.log.length} logged contact
                      {family.log.length === 1 ? '' : 's'} outside that window.
                    </>
                  )}
                </p>
              ) : (
                <>
                  <ul className="divide-line border-line divide-y border-t">
                    {nearbyContact.map((entry) => {
                      const who = memberName(family?.members ?? [], entry.memberId)
                      return (
                        <li key={entry.id} className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar name={who} decorative className="size-9 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-ink text-sm font-semibold break-words">
                                  {who}
                                </p>
                                <p className="text-ink-subtle text-xs break-words">
                                  {family?.members.find((m) => m.id === entry.memberId)
                                    ?.relationship ?? 'Family contact'}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                                  tonePill[communicationTones[entry.type]],
                                )}
                              >
                                {entry.type}
                              </span>
                              {/* Direction, which the log does keep — not the
                                  design's "Reached" / "Acknowledged", which
                                  are outcomes nothing records. */}
                              <span className="text-ink-subtle text-xs">
                                {entry.direction === 'inbound'
                                  ? 'From the family'
                                  : 'To the family'}
                              </span>
                              <span className="text-ink-subtle text-xs whitespace-nowrap">
                                {formatContactDate(entry.at)}
                              </span>
                            </div>
                          </div>
                          <p className="text-ink mt-2.5 text-sm break-words">
                            {entry.subject}
                          </p>
                          <p className="text-ink-subtle mt-1 text-xs break-words">
                            Logged by {entry.staff} · the log records the day, not
                            the time, and no notes beyond this line
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="text-ink-subtle border-line border-t px-4 py-3 text-xs">
                    Contact logged with the family in the {INCIDENT_FOLLOW_DAYS + 1}{' '}
                    days from the incident. Nothing ties a call to an incident in
                    this app, so these are near it in time rather than about it.{' '}
                    <Link
                      to={`/care-recipients/${incident.recipientId}/family`}
                      className="text-brand-700"
                    >
                      The whole log
                    </Link>{' '}
                    is on the family record.
                  </p>
                </>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            {/* The design's Quick Contact Book. Three real people, three real
                numbers — the escalation supervisor comes off the reporter's own
                roster entry rather than being a hub nobody staffs. */}
            <Panel title="Who to call">
              <ul className="divide-line divide-y">
                {emergency && (
                  <ContactRow
                    label="Family emergency contact"
                    name={emergency.name}
                    detail={emergency.relationship}
                    phone={emergency.phone}
                  />
                )}
                {reporter && (
                  <ContactRow
                    label="Wrote up the incident"
                    name={reporter.name}
                    detail={reporter.title}
                    phone={reporter.phone}
                  />
                )}
                {visitCaregiver && visitCaregiver.id !== reporter?.id && (
                  <ContactRow
                    label="Caregiver on the visit"
                    name={visitCaregiver.name}
                    detail={visitCaregiver.title}
                    phone={visitCaregiver.phone}
                  />
                )}
                {supervisor && (
                  <ContactRow
                    label="Escalation supervisor"
                    name={supervisor.name}
                    detail={supervisor.title}
                    phone={supervisor.phone}
                  />
                )}
              </ul>
              <p className="text-ink-subtle mt-3 text-xs">
                Numbers come off the roster and the family record. The app makes
                no calls itself — these open your phone.
              </p>
            </Panel>

            {visit && (
              <Panel
                title="Visit it was written during"
                action={{
                  label: 'Open the visit',
                  to: `/scheduling/visits/${visit.id}/overview`,
                }}
              >
                <Rows
                  rows={[
                    { id: 'ref', label: 'Reference', value: referenceFor(visit) },
                    {
                      id: 'when',
                      label: 'Schedule',
                      value: `${formatFullDay(visit.date)}, ${formatTime(visit.start)}–${formatTime(visit.end)}`,
                    },
                    { id: 'type', label: 'Service', value: visit.type },
                  ]}
                />
              </Panel>
            )}
          </div>
        </div>
      )}

      {/*
        Rendered on every tab and hidden with `hidden` rather than mounted only
        on its own. The tabs are links, so the branch that used to guard this
        unmounted the component on every click and took the draft with it —
        which made the banner's promise ("what you type stays in this tab")
        plainly false. `hidden` keeps the state alive and still removes the
        fields from the tab order and the accessibility tree.
      */}
      <div hidden={tab !== 'resolution'}>
        <ResolutionForm incident={incident} visit={visit} profile={profile} />
      </div>
    </div>
  )
}

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

function ContactRow({
  label,
  name,
  detail,
  phone,
}: {
  label: string
  name: string
  detail: string
  phone: string
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <Avatar name={name} decorative className="size-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">{name}</p>
          <p className="text-ink-subtle text-xs break-words">{detail}</p>
        </div>
      </div>
      <a
        href={telHref(phone)}
        className="text-brand-700 hover:text-brand-800 mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
      >
        <Phone className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        {phone}
        <span className="sr-only"> — call {name}</span>
      </a>
    </li>
  )
}

/* ------------------------------- resolution -------------------------------- */

const resolutionStatuses = [
  { value: 'pending', label: 'Pending resolution' },
  { value: 'reviewing', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'no-action', label: 'No action needed' },
] as const

type ResolutionStatus = (typeof resolutionStatuses)[number]['value']

interface ResolutionDraft {
  status: ResolutionStatus
  summary: string
  actions: string
  followUp: boolean
  followUpDate: string
  followUpNotes: string
}

const emptyDraft: ResolutionDraft = {
  status: 'pending',
  summary: '',
  actions: '',
  followUp: false,
  followUpDate: '',
  followUpNotes: '',
}



/**
 * The resolution form.
 *
 * This is the one screen in the set that *writes*, and it is worth being blunt
 * about what that means. There is no incident record to write to — an incident
 * here is a care note, and a note has no status, no owner and no resolution.
 * So this keeps its state for the session and says so, plainly, above the
 * fields rather than in a footnote somebody scrolls past. A coordinator typing
 * "family notified, no health risk identified" into a care system and pressing
 * Save has every right to assume it is filed; the banner is there so that
 * assumption is never made.
 *
 * The alternative — showing the form disabled, or not at all — was worse. The
 * shape of what an agency needs to capture is a real design question, and the
 * validation below is where most of the thinking is: a resolution with no
 * summary, or a follow-up with no date, is the sort of half-filled record that
 * makes an incident log useless.
 */
function ResolutionForm({
  incident,
  visit,
  profile,
}: {
  incident: IncidentRecord
  visit: BoardVisit | undefined
  profile: ReturnType<typeof getRecipientProfile>
}) {
  const [saved, setSaved] = useState<ResolutionDraft>(emptyDraft)
  const [draft, setDraft] = useState<ResolutionDraft>(emptyDraft)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [resolvedAtTime, setResolvedAtTime] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const set = <K extends keyof ResolutionDraft>(
    key: K,
    value: ResolutionDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }))

  const incidentDay = incident.at.slice(0, 10)
  const errors: Record<string, string> = {}
  const closing = draft.status === 'resolved' || draft.status === 'no-action'
  if (closing && !draft.summary.trim())
    errors.summary = 'A resolution needs a summary of what was concluded.'
  if (draft.status === 'resolved' && !draft.actions.trim())
    errors.actions = 'Say what was actually done before marking this resolved.'
  if (draft.followUp && !draft.followUpDate)
    errors.followUpDate = 'A follow-up needs a date.'
  // Only while the field is rendered. Turning the toggle off used to leave an
  // error about an input that was no longer on screen, with no way to reach it.
  if (draft.followUp && draft.followUpDate && draft.followUpDate < incidentDay)
    errors.followUpDate = `A follow-up cannot be dated before the incident (${incidentDay}).`
  const invalid = Object.keys(errors).length > 0
  const alreadyResolved = saved.status === 'resolved' && !dirty
  const show = (key: string) => (submitted ? errors[key] : undefined)

  useEffect(() => {
    if (submitted && invalid) summaryRef.current?.focus()
    // `attempt` is the dependency that matters: the errors may be identical
    // between two submits, and the summary still has to take focus again.
  }, [attempt, submitted, invalid])

  const save = (markResolved: boolean) => {
    const next = markResolved ? { ...draft, status: 'resolved' as const } : draft
    setSubmitted(true)
    // Bumped on every attempt so a repeat submit with the same errors still
    // re-announces: `role="alert"` fires on change, not on render.
    setAttempt((n) => n + 1)
    // Validate the value actually being saved, so Mark Resolved cannot slip
    // past the checks that only apply once the status is `resolved`.
    const closingNext = next.status === 'resolved' || next.status === 'no-action'
    const bad =
      (closingNext && !next.summary.trim()) ||
      (next.status === 'resolved' && !next.actions.trim()) ||
      (next.followUp && !next.followUpDate) ||
      (next.followUp && next.followUpDate !== '' && next.followUpDate < incidentDay)
    // A rejected action changes nothing. Writing `next` back here flipped the
    // status dropdown to Resolved and invented unsaved changes out of a click
    // that was refused.
    if (bad) return
    setDraft(next)
    setSaved(next)
    setSavedAt(formatTime(nowClock()))
    setResolvedAtTime(next.status === 'resolved' ? formatTime(nowClock()) : null)
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        {/*
          Above the fields, not below them. Somebody typing a clinical
          conclusion into a care system is entitled to assume it is filed.
        */}
        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={2.2}
            aria-hidden="true"
          />
          <span>
            <strong className="font-semibold">Nothing here is filed.</strong> An
            incident in this app is a care note, and a note has no status, owner
            or resolution to write to. What you type stays in this browser tab
            and is gone when it closes — it does not reach{' '}
            {incident.recipientName}&rsquo;s record and no colleague will see
            it.
          </span>
        </p>

        <Panel
          title="Resolution"
          badge={
            savedAt && !dirty ? (
              <span
                role="status"
                className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
              >
                Held since {savedAt}
              </span>
            ) : dirty ? (
              <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
                Unsaved
              </span>
            ) : undefined
          }
        >
          {submitted && invalid && (
            <div
              // Re-keyed per attempt so a repeat submit re-announces, and
              // focusable so the problem list is where the user lands rather
              // than off-screen above the button they just pressed.
              key={attempt}
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <p className="font-semibold">
                {Object.keys(errors).length} field
                {Object.keys(errors).length === 1 ? '' : 's'} need attention.
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {Object.values(errors).map((message) => (
                  <li key={message} className="break-words">
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <Field
              label="Resolution status"
              htmlFor="res-status"
              hint="Proposed vocabulary. This app stores no status on an incident — the rest of this screen says so, and this dropdown does not change it."
            >
              <SelectBox
                id="res-status"
                value={draft.status}
                onChange={(e) => set('status', e.target.value as ResolutionStatus)}
                className={fieldControl}
              >
                {resolutionStatuses.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectBox>
            </Field>

            <Field
              label="Resolution summary"
              htmlFor="res-summary"
              error={show('summary')}
              hint="What was concluded. Required before this can be closed."
            >
              <textarea
                id="res-summary"
                rows={3}
                value={draft.summary}
                onChange={(e) => set('summary', e.target.value)}
                aria-invalid={show('summary') ? true : undefined}
                className="border-line focus:border-brand-500 w-full rounded-lg border p-3 text-sm aria-[invalid]:border-red-400"
              />
            </Field>

            <Field
              label="Actions taken"
              htmlFor="res-actions"
              error={show('actions')}
              hint="What was actually done, and by whom."
            >
              <textarea
                id="res-actions"
                rows={3}
                value={draft.actions}
                onChange={(e) => set('actions', e.target.value)}
                aria-invalid={show('actions') ? true : undefined}
                className="border-line focus:border-brand-500 w-full rounded-lg border p-3 text-sm aria-[invalid]:border-red-400"
              />
            </Field>

            <div className="border-line border-t pt-4">
              <Toggle
                label="Follow-up required"
                checked={draft.followUp}
                onChange={(next) => set('followUp', next)}
                hint="Somebody has to check back before this is done with."
              />
            </div>

            {draft.followUp && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Follow-up date"
                  htmlFor="res-date"
                  error={show('followUpDate')}
                >
                  <input
                    id="res-date"
                    type="date"
                    // Cannot be dated before the thing it follows up on.
                    min={incidentDay}
                    // A year out is already generous for a follow-up; without
                    // a bound a typo saves a date in 2099 without comment.
                    max={`${Number(incidentDay.slice(0, 4)) + 1}${incidentDay.slice(4)}`}
                    value={draft.followUpDate}
                    onChange={(e) => set('followUpDate', e.target.value)}
                    aria-invalid={show('followUpDate') ? true : undefined}
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
              {/* Filled from the session rather than left as a placeholder that
                  never fills. Both are read-only: neither is something to
                  type. */}
              <Field label="Resolved by" htmlFor="res-by">
                <input
                  id="res-by"
                  readOnly
                  value={
                    saved.status === 'resolved' ? SIGNED_IN : 'Not resolved yet'
                  }
                  className={cn(fieldControl, 'bg-sunken text-ink-muted')}
                />
              </Field>
              <Field label="Resolution time" htmlFor="res-time">
                <input
                  id="res-time"
                  readOnly
                  value={resolvedAtTime ?? 'Not resolved yet'}
                  className={cn(fieldControl, 'bg-sunken text-ink-muted')}
                />
              </Field>
            </div>
          </div>

          <div className="border-line mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            {/* Restated at the point of commitment, not only at the top of a
                long form the banner has scrolled off. Doubles as the reason
                both buttons are described by. */}
            <p id="res-save-note" className="text-ink-subtle min-w-0 text-xs">
              Held for this browser tab only — nothing reaches{' '}
              {incident.recipientName}&rsquo;s record.
              {!dirty && savedAt && ' Nothing has changed since the last save.'}
              {alreadyResolved && ' Already marked resolved.'}
            </p>
            <span className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                aria-disabled={!dirty}
                aria-describedby="res-save-note"
                onClick={() => dirty && save(false)}
                className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
              >
                Save
              </button>
              <button
                type="button"
                aria-disabled={alreadyResolved}
                aria-describedby="res-save-note"
                onClick={() => !alreadyResolved && save(true)}
                className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-5 text-sm font-semibold text-white aria-disabled:cursor-default aria-disabled:opacity-50"
              >
                Mark resolved
              </button>
            </span>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="What the record actually holds">
          {/* The design's "Operational Assignment / Under Review / Assigned
              Coordinator". None of that is stored; this is what is. */}
          <Rows
            rows={[
              {
                id: 'coordinator',
                label: 'Client’s coordinator',
                value: profile?.summary.coordinator ?? 'Not on file',
              },
              {
                id: 'flag',
                label: 'Flagged for review',
                value: incident.flagged ? 'Yes' : 'No',
              },
              {
                id: 'replies',
                label: 'Replies on the note',
                value:
                  incident.replies === 0
                    ? 'None'
                    : `${incident.replies} ${incident.replies === 1 ? 'reply' : 'replies'}`,
              },
              {
                id: 'attachments',
                label: 'Attachments',
                value: incident.attachments === 0 ? 'None' : `${incident.attachments}`,
              },
            ]}
          />
          <p className="text-ink-subtle mt-3 text-xs">
            The reply count is the only sign in the record that anybody picked
            this up. There is no owner and no status behind it.
          </p>
        </Panel>

        {visit && (
          <Panel
            title="Visit it was written during"
            action={{
              label: 'Open the visit',
              to: `/scheduling/visits/${visit.id}/overview`,
            }}
          >
            <Rows
              rows={[
                { id: 'ref', label: 'Reference', value: referenceFor(visit) },
                {
                  id: 'when',
                  label: 'Schedule',
                  value: `${formatFullDay(visit.date)}, ${formatTime(visit.start)}–${formatTime(visit.end)}`,
                },
                { id: 'type', label: 'Service', value: visit.type },
                {
                  id: 'cg',
                  label: 'Caregiver',
                  value: visit.caregiverName ?? 'Nobody assigned',
                },
              ]}
            />
          </Panel>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-ink block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-ink-subtle mt-0.5 text-xs">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1 text-xs font-medium text-red-700">{error}</p>
      )}
    </div>
  )
}

/**
 * The wall clock, like `ScheduleSettingsPage`'s own.
 *
 * Deliberately NOT the fixture's fixed `NOW`. That constant is right for
 * derived data — an age, a "starting soon" badge — because the sample would
 * otherwise rot. This is a timestamp on something the user just did, and
 * freezing it meant two saves a minute apart produced identical text, so the
 * live region announced the first and stayed silent for every one after.
 */
function nowClock(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
