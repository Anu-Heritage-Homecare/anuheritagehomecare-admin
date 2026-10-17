import { useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { PhoneOutgoing, UsersRound } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import {
  getFamilyRecord,
  memberWithRole,
  recentLog,
  type FamilyRole,
} from '../family-data'
import { ContactFamilyDrawer } from './ContactFamilyDrawer'
import { FamilyContacts } from './FamilyContacts'
import { CommunicationLog, PermissionsMatrix } from './FamilyPanels'
import { Panel } from '@/components/ui/Panel'
import { toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'

/** Roles surfaced in the summary strip, in the order they appear. */
const summaryRoles: { role: FamilyRole; label: string; urgent?: boolean }[] = [
  { role: 'Primary Contact', label: 'Primary Contact' },
  { role: 'Emergency Contact', label: 'Emergency Contact', urgent: true },
  { role: 'Power of Attorney', label: 'Power of Attorney' },
]

export function FamilyTab() {
  const profile = useOutletContext<RecipientProfile>()
  const record = getFamilyRecord(profile.id)
  // `?contact=1` arrives from the Caregivers tab's Contact Family button and
  // opens the drawer straight away.
  const [params, setParams] = useSearchParams()
  const [contacting, setContacting] = useState(() => params.get('contact') === '1')
  const stopContacting = () => {
    setContacting(false)
    if (params.has('contact')) {
      const next = new URLSearchParams(params)
      next.delete('contact')
      setParams(next, { replace: true })
    }
  }

  if (!record) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <UsersRound className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">
          No family contacts
        </h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no registered family contacts. Designated roles,
          portal access and the communication log appear here once added.
        </p>
        <button
          type="button"
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Add Family Member
        </button>
      </div>
    )
  }

  const { members, log } = record
  const entries = recentLog(log)

  // Each summary card names whoever actually holds the role.
  const cards = [
    ...summaryRoles.map(({ role, label, urgent }) => {
      const holder = memberWithRole(members, role)
      return {
        id: role,
        label,
        value: holder ? holder.name : 'Not designated',
        detail: holder ? holder.relationship : 'No contact assigned',
        urgent: urgent && Boolean(holder),
      }
    }),
    {
      id: 'total',
      label: 'Total Family Members',
      value: String(members.length),
      detail: `${members.filter((m) => m.portalEnabled).length} with portal access`,
      urgent: false,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted text-sm">
          {/* Counted, not stated: the panel opens on whoever is actually on the
              record. */}
          {members.length} contact{members.length === 1 ? '' : 's'} on file for{' '}
          {profile.name}.
        </p>
        <button
          type="button"
          onClick={() => setContacting(true)}
          className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
        >
          <PhoneOutgoing
            className="size-4 shrink-0"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          Contact family
        </button>
      </div>

      <ContactFamilyDrawer
        recipientId={profile.id}
        recipientName={profile.name}
        members={members}
        open={contacting}
        onClose={stopContacting}
      />

      <Panel title="Family Contacts Summary">
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ id, label, value, detail, urgent }) => (
            <div key={id} className="border-line min-w-0 rounded-lg border p-3">
              <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
                {label}
              </dt>
              <dd
                className={cn(
                  'mt-1 text-sm font-semibold break-words',
                  urgent ? toneText.red : 'text-ink',
                )}
              >
                {value}
                <span className="text-ink-subtle block text-xs font-normal">
                  {detail}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <FamilyContacts members={members} log={log} />
      <CommunicationLog entries={entries} members={members} />
      <PermissionsMatrix members={members} />
    </div>
  )
}
