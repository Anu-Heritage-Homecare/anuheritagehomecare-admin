/**
 * The quick preview drawer for one family member, fetched live from
 * `GET /admin/families/:id`. It surfaces the small edits the drawer owns: the
 * emergency contact verified flag, the account status and the quick notes. The
 * rich mock extras (preferred channel, access level, the communication log,
 * linked plans) have no backend source and are omitted rather than faked.
 */
import { useState } from 'react'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import {
  billingLabels,
  billingTones,
  formatActivity,
  formatMoney,
  statusLabels,
  statusTones,
  useFamilyDetail,
  useSetEmergencyVerified,
  useSetFamilyNotes,
  useSetFamilyStatus,
  type AccountStatus,
} from './useFamilies'
import { Avatar } from '@/components/ui/Avatar'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const chip =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <dt className="text-ink-muted min-w-0 text-sm">{label}</dt>
      <dd className="text-ink min-w-0 text-right text-sm font-medium break-words">
        {children}
      </dd>
    </div>
  )
}

const STATUS_OPTIONS: AccountStatus[] = ['active', 'inactive', 'pending']

export function FamilyDetailPreview({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useFamilyDetail(id)
  const setNotes = useSetFamilyNotes()
  const setStatus = useSetFamilyStatus()
  const setVerified = useSetEmergencyVerified()

  // Local notes draft, seeded from the fetched record and reset during render
  // when the server value changes (the recommended "adjust state in render"
  // pattern rather than an effect that would cascade a re-render).
  const serverNotes = data?.quickNotes ?? ''
  const [notes, setNotesDraft] = useState(serverNotes)
  const [seenNotes, setSeenNotes] = useState(serverNotes)
  if (seenNotes !== serverNotes) {
    setSeenNotes(serverNotes)
    setNotesDraft(serverNotes)
  }

  if (isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-ink text-sm font-medium">Could not load this contact.</p>
        <p className="text-ink-subtle text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  const notesDirty = notes.trim() !== (data.quickNotes ?? '').trim()

  return (
    <div className="p-4">
      <div className="text-center">
        <Avatar name={data.name} decorative className="mx-auto size-16 text-lg" />
        <h3 className="text-ink mt-3 text-lg font-bold tracking-tight break-words">
          {data.name}
        </h3>
        {data.relationship && (
          <p className="text-ink-muted mt-0.5 text-sm break-words">{data.relationship}</p>
        )}
        <p className="text-ink-subtle mt-0.5 text-xs">{data.ref}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <span className={cn(chip, tonePill[statusTones[data.status]])}>
            {statusLabels[data.status]}
          </span>
        </div>
      </div>

      <section aria-labelledby="account-details" className="mt-5">
        <h4
          id="account-details"
          className="text-ink-subtle text-xs font-semibold tracking-wider uppercase"
        >
          Account details
        </h4>
        <dl className="divide-line mt-1 divide-y">
          <Row label="Phone">{data.phone}</Row>
          <Row label="Email">
            <span className="break-all">{data.email}</span>
          </Row>
          <Row label="Account on portal">
            {data.hasAccount ? 'Yes' : <span className="text-ink-subtle">No</span>}
          </Row>
          <Row label="Emergency contact verified">
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={data.emergencyVerified}
                disabled={setVerified.isPending}
                onChange={(e) =>
                  setVerified.mutate({ id, verified: e.target.checked })
                }
                className="accent-brand-600 border-control size-4 shrink-0 cursor-pointer rounded-sm"
                aria-label="Emergency contact verified"
              />
              {data.emergencyVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  Verified
                </span>
              ) : (
                <span className="text-ink-subtle text-xs">Not verified</span>
              )}
            </label>
          </Row>
          <Row label="Unanswered messages">
            {data.unread > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                <TriangleAlert className="size-3" strokeWidth={2.4} aria-hidden="true" />
                {data.unread}
              </span>
            ) : (
              <span className="text-ink-subtle">None</span>
            )}
          </Row>
          <Row label="Billing">
            <span className={cn(chip, tonePill[billingTones[data.billing]])}>
              {billingLabels[data.billing]}
            </span>
          </Row>
          {data.outstandingBalanceMinor > 0 && (
            <Row label="Outstanding balance">
              {formatMoney(data.outstandingBalanceMinor, data.currency)}
            </Row>
          )}
          <Row label="Last activity">{formatActivity(data.lastActivity)}</Row>
        </dl>
      </section>

      <section aria-labelledby="linked-recipients" className="mt-5">
        <h4
          id="linked-recipients"
          className="text-ink-subtle text-xs font-semibold tracking-wider uppercase"
        >
          Linked care recipients ({data.linkedNames.length})
        </h4>
        {data.linkedNames.length === 0 ? (
          <p className="text-ink-subtle mt-2 text-sm">No linked recipients.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.linkedNames.map((name) => (
              <li key={name} className="border-line rounded-lg border p-3">
                <span className="text-ink text-sm font-semibold break-words">
                  {name}
                  {name === data.primaryRecipientName && (
                    <span className="text-ink-subtle ml-2 text-xs font-normal">Primary</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="account-status" className="mt-5">
        <h4
          id="account-status"
          className="text-ink-subtle text-xs font-semibold tracking-wider uppercase"
        >
          Account status
        </h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={setStatus.isPending || option === data.status}
              onClick={() => setStatus.mutate({ id, status: option })}
              className={cn(
                'inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-default',
                option === data.status
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'border-control text-ink hover:bg-sunken',
              )}
            >
              {statusLabels[option]}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="quick-notes" className="mt-5">
        <h4
          id="quick-notes"
          className="text-ink-subtle text-xs font-semibold tracking-wider uppercase"
        >
          Quick notes
        </h4>
        <textarea
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="Internal notes about this contact…"
          className="border-control focus:border-brand-500 mt-2 min-h-24 w-full rounded-lg border p-2.5 text-sm"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={!notesDirty || setNotes.isPending}
            onClick={() =>
              setNotes.mutate({ id, quickNotes: notes.trim() === '' ? null : notes })
            }
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {setNotes.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
            Save notes
          </button>
        </div>
      </section>
    </div>
  )
}
