import { useState } from 'react'
import { ClipboardList, Mail, Phone } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Avatar } from '@/components/ui/Avatar'
import { SIGNED_IN } from '@/lib/session'
import { TODAY } from '@/lib/today'
import {
  contactOutcomeLabels,
  formatContactDate,
  getFamilyRecord,
  lastContact,
  logContact,
  memberName,
  nextContactId,
  recentLog,
  useContactLog,
} from '../family-data'
import type {
  CommunicationEntry,
  CommunicationType,
  ContactOutcome,
  FamilyMember,
} from '../family-data'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/** Digits only — a `tel:` with spaces and a plus sign in it does not dial. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/**
 * The channels a coordinator can honestly say they used from this screen. An
 * app message and a video call happen somewhere else, so they can still be
 * *recorded* — but the panel offers no button claiming to start one.
 */
const channels: CommunicationType[] = [
  'Phone Call',
  'Email',
  'App Message',
  'In-Person',
  'Video Call',
]

interface ContactFamilyDrawerProps {
  recipientId: string
  recipientName: string
  members: FamilyMember[]
  open: boolean
  onClose: () => void
}

/**
 * Reaching a client's family, and writing down that you tried.
 *
 * Two of the three things the design asks for are real here: the roster holds a
 * phone number and an email address for every contact, so Call and Email are
 * links that do exactly what they say. The third — an in-app message — is not,
 * and there is no button for it. What the panel adds instead is the part that
 * actually needs an app: recording the attempt, including the ones that went
 * nowhere. "Rang the daughter twice, no answer" is the fact a shift handover
 * turns on, and it is the one thing no derivation can work out.
 */
export function ContactFamilyDrawer({
  recipientId,
  recipientName,
  members,
  open,
  onClose,
}: ContactFamilyDrawerProps) {
  // Subscribed rather than read once: recording an attempt has to move the
  // "last contacted" line and the history below it without closing the panel.
  useContactLog()
  // Read at render rather than taken as a prop, so an attempt recorded inside
  // the panel moves the history below it without the panel closing.
  const log = getFamilyRecord(recipientId)?.log ?? []
  const recent = recentLog(log)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Contact family"
      subtitle={`${recipientName}’s contacts`}
    >
      <div className="space-y-3 p-4">
        {members.length === 0 ? (
          <p className="text-ink-muted text-sm" role="status">
            No contacts are registered for {recipientName}.
          </p>
        ) : (
          members.map((member) => (
            <ContactCard
              key={member.id}
              member={member}
              recipientId={recipientId}
              log={log}
            />
          ))
        )}

        {/* Where the design has a physician card. Every doctor this app knows
            about is a name on a health record — Dr. James Park, Dr. Osei — with
            no number attached, and a "Call physician" button that dials nothing
            is worse than not offering one. */}
        <p className="text-ink-subtle border-line border-t pt-3 text-xs">
          No physician is listed here: the health record names the doctors
          involved in {recipientName}&rsquo;s care but holds no number for any of
          them, so there is nothing for a call button to ring.
        </p>

        <div className="border-line border-t pt-3">
          <h3 className="text-ink text-sm font-semibold">Recent contact</h3>
          {recent.length === 0 ? (
            <p className="text-ink-subtle mt-1 text-xs">
              Nothing logged in the last 30 days.
            </p>
          ) : (
            <ul className="divide-line mt-1 divide-y">
              {recent.map((entry) => (
                <li key={entry.id} className="py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-ink min-w-0 text-sm font-medium break-words">
                      {entry.type} {entry.direction === 'inbound' ? 'from' : 'to'}{' '}
                      {memberName(members, entry.memberId)}
                    </p>
                    {entry.outcome && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                          entry.outcome === 'reached'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-sunken text-ink-muted',
                        )}
                      >
                        {contactOutcomeLabels[entry.outcome]}
                      </span>
                    )}
                  </div>
                  <p className="text-ink-muted mt-0.5 text-xs break-words">
                    {entry.subject}
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    <time dateTime={entry.at}>{formatContactDate(entry.at)}</time>{' '}
                    · {entry.staff}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  )
}

function ContactCard({
  member,
  recipientId,
  log,
}: {
  member: FamilyMember
  recipientId: string
  log: CommunicationEntry[]
}) {
  const [recording, setRecording] = useState(false)
  const latest = lastContact(log, member.id)
  const primary = member.roles.includes('Primary Contact')

  return (
    <div
      className={cn(
        'card p-3.5',
        primary && 'ring-brand-500 ring-1',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={member.name} decorative className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-ink min-w-0 text-sm font-semibold break-words">
              {member.name}
            </p>
            {/* Their stated preference, not a guess from the log. */}
            <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
              Prefers {member.preferred.toLowerCase()}
            </span>
          </div>
          <p className="text-ink-subtle mt-0.5 text-xs break-words">
            {member.relationship}
            {member.roles.length > 0 && ` · ${member.roles.join(' · ')}`}
          </p>
          <p className="text-ink-subtle mt-1 text-xs">
            {latest ? (
              <>
                Last contact{' '}
                <time dateTime={latest.at}>{formatContactDate(latest.at)}</time> —{' '}
                {latest.type.toLowerCase()}
              </>
            ) : (
              'No contact on the log'
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={telHref(member.phone)}
          className="border-control text-ink hover:bg-sunken inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium"
        >
          <Phone className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          {member.phone}
        </a>
        <a
          href={`mailto:${member.email}`}
          className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium"
        >
          <Mail className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          Email
          <span className="sr-only"> {member.name} at {member.email}</span>
        </a>
      </div>

      {recording ? (
        <RecordAttempt
          member={member}
          recipientId={recipientId}
          onDone={() => setRecording(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setRecording(true)}
          className="border-line text-ink hover:bg-sunken mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium"
        >
          <ClipboardList
            className="size-4 shrink-0"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          Record an attempt
          <span className="sr-only"> to contact {member.name}</span>
        </button>
      )}
    </div>
  )
}

/**
 * The write. Inline rather than a second modal on top of this one: the panel is
 * already a dialog, and stacking two of them traps focus in the wrong place.
 */
function RecordAttempt({
  member,
  recipientId,
  onDone,
}: {
  member: FamilyMember
  recipientId: string
  onDone: () => void
}) {
  const [type, setType] = useState<CommunicationType>('Phone Call')
  const [outcome, setOutcome] = useState<ContactOutcome>('reached')
  const [subject, setSubject] = useState('')

  const submit = () => {
    if (subject.trim() === '') return
    logContact(recipientId, {
      id: nextContactId(),
      at: TODAY,
      memberId: member.id,
      type,
      subject: subject.trim(),
      staff: SIGNED_IN,
      // Recorded here means the agency reached out. An inbound call is logged
      // from the family's side of the record, not from a button labelled
      // "record an attempt".
      direction: 'outbound',
      outcome,
    })
    onDone()
  }

  return (
    <div className="border-line mt-3 space-y-2 border-t pt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-ink-muted text-xs">
          Channel
          <SelectBox
            value={type}
            onChange={(e) => setType(e.target.value as CommunicationType)}
            className="border-line focus:border-brand-500 text-ink mt-1 h-10 w-full rounded-lg border px-2 text-sm"
          >
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectBox>
        </label>
        <label className="text-ink-muted text-xs">
          Outcome
          <SelectBox
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ContactOutcome)}
            className="border-line focus:border-brand-500 text-ink mt-1 h-10 w-full rounded-lg border px-2 text-sm"
          >
            {(Object.keys(contactOutcomeLabels) as ContactOutcome[]).map((o) => (
              <option key={o} value={o}>
                {contactOutcomeLabels[o]}
              </option>
            ))}
          </SelectBox>
        </label>
      </div>
      <label className="text-ink-muted block text-xs">
        What it was about
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Told her about the medication refusal"
          className="border-line focus:border-brand-500 text-ink mt-1 h-10 w-full rounded-lg border px-3 text-sm"
        />
      </label>
      <p className="text-ink-subtle text-xs">
        Logged against {member.name} as {SIGNED_IN}, dated today. Held for this
        session only — there is no server behind this.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="border-control text-ink hover:bg-sunken inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={subject.trim() === ''}
          className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save to log
        </button>
      </div>
    </div>
  )
}
