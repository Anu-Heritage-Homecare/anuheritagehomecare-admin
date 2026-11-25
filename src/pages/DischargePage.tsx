import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react'
import type { RecipientProfile } from '@/features/care-recipients/profile-data'
import { useRecipientProfile } from '@/features/care-recipients/useRecipientProfile'
import {
  useProcessArchive,
  useRecipientArchive,
  useSaveArchiveDraft,
  type ArchiveDraft,
} from '@/features/care-recipients/useRecipientArchive'
import type { DischargeReadiness } from '@/features/care-recipients/discharge-data'
import {
  acknowledgements,
  defaultEffectiveDate,
  dischargeReasons,
  holdReasons,
  TODAY,
  type DischargeAction,
} from '@/features/care-recipients/discharge-data'
import { ActionChoice } from '@/features/care-recipients/discharge/ActionChoice'
import { DischargeChecklist } from '@/features/care-recipients/discharge/DischargeChecklist'
import { Avatar } from '@/components/ui/Avatar'
import { ApiError } from '@/lib/api'
import {
  PriorityBadge,
  RecipientStatusBadge,
} from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

export function DischargePage() {
  const { id } = useParams()
  const profileQuery = useRecipientProfile(id)
  const archiveQuery = useRecipientArchive(id)

  if (profileQuery.isPending || archiveQuery.isPending) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <Loader2 className="text-brand-600 size-6 animate-spin" aria-hidden="true" />
        <p className="text-ink-muted mt-3 text-sm">Loading archive readiness…</p>
      </div>
    )
  }

  if (profileQuery.isError || archiveQuery.isError || !profileQuery.data || !archiveQuery.data) {
    const message =
      profileQuery.error instanceof ApiError
        ? profileQuery.error.message
        : archiveQuery.error instanceof ApiError
          ? archiveQuery.error.message
          : 'This care recipient could not be loaded.'
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h1 className="text-ink text-lg font-semibold">Could not load archive</h1>
        <p className="text-ink-muted mt-2 text-sm">{message}</p>
        <button
          type="button"
          onClick={() => {
            void profileQuery.refetch()
            void archiveQuery.refetch()
          }}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <DischargeForm
      key={profileQuery.data.id}
      profile={profileQuery.data}
      readiness={archiveQuery.data.readiness}
      draft={archiveQuery.data.draft}
    />
  )
}

function DischargeForm({
  profile,
  readiness,
  draft,
}: {
  profile: RecipientProfile
  readiness: DischargeReadiness
  draft: ArchiveDraft | null
}) {
  const navigate = useNavigate()
  const saveDraft = useSaveArchiveDraft(profile.id)
  const processArchive = useProcessArchive(profile.id)

  // Seed the form from a saved draft on first mount; the key on the parent
  // remounts this when the recipient changes.
  const [action, setAction] = useState<DischargeAction>(draft?.action ?? 'discharge')
  const [reason, setReason] = useState(draft?.reason ?? '')
  const [effectiveDate, setEffectiveDate] = useState(draft?.effectiveDate ?? defaultEffectiveDate())
  const [summaryNote, setSummaryNote] = useState(draft?.clinicalSummary ?? '')
  const [acked, setAcked] = useState<Set<string>>(new Set(draft?.acknowledgements ?? []))

  const reasons = action === 'discharge' ? dischargeReasons : holdReasons
  const allAcked = acknowledgements.every((a) => acked.has(a))
  const dateValid = effectiveDate !== '' && effectiveDate >= TODAY
  const formComplete = reason !== '' && dateValid && summaryNote.trim().length > 0

  /*
   * Two independent gates: the checklist (facts the system can verify) and the
   * form (what the coordinator must attest). Both must pass.
   */
  const canSubmit = readiness.canProcess && formComplete && allAcked
  const blockers = readiness.checklist.filter((c) => c.state === 'blocked')
  const pending = saveDraft.isPending || processArchive.isPending
  const mutationError =
    processArchive.error instanceof ApiError
      ? processArchive.error.message
      : saveDraft.error instanceof ApiError
        ? saveDraft.error.message
        : null

  const submission = () => ({
    action,
    reason,
    effectiveDate,
    clinicalSummary: summaryNote.trim(),
    acknowledgements: [...acked],
  })

  const onSaveDraft = () => {
    saveDraft.reset()
    saveDraft.mutate(submission())
  }

  const onProcess = () => {
    if (!canSubmit) return
    processArchive.reset()
    processArchive.mutate(submission(), {
      onSuccess: () => navigate(`/care-recipients/${profile.id}`),
    })
  }

  const toggleAck = (item: string) =>
    setAcked((current) => {
      const next = new Set(current)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })

  const verb = action === 'discharge' ? 'Discharge' : 'Hold'

  return (
    <div className="space-y-4">
      <Link
        to={`/care-recipients/${profile.id}`}
        className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to {profile.name}
      </Link>

      <div className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <Avatar name={profile.name} decorative className="size-14 text-lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-ink text-xl font-bold tracking-tight break-words">
              {profile.name}
            </p>
            <RecipientStatusBadge status={profile.status} />
            <PriorityBadge priority={profile.priority} />
          </div>
          <p className="text-ink-muted mt-1 text-sm break-words">
            {profile.ref} · Age {profile.age} · {profile.condition} ·{' '}
            {profile.careLevel} care
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-ink text-2xl font-bold tracking-tight">
          Archive / Discharge Care Recipient
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          Complete the following to formally end or pause care services for{' '}
          {profile.name}.
        </p>
      </div>

      <section aria-labelledby="service-summary" className="card p-4">
        <h2
          id="service-summary"
          className="text-ink-subtle text-xs font-semibold tracking-wider uppercase"
        >
          Current service summary
        </h2>
        {/* Every figure is read from the module that owns it. */}
        <dl className="mt-3 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {readiness.summary.map((s) => (
            <div key={s.id} className="min-w-0">
              <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
                {s.label}
              </dt>
              <dd
                className={cn(
                  'mt-1 text-sm font-semibold break-words',
                  s.emphasis === 'good' && 'text-emerald-700',
                  s.emphasis === 'bad' && 'text-red-700',
                  !s.emphasis && 'text-ink',
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <ActionChoice
        value={action}
        onChange={(next) => {
          setAction(next)
          // The two reason lists are disjoint; a stale value would leave the
          // select blank while still counting as complete.
          setReason('')
        }}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section
          aria-labelledby="protocols"
          className="card p-4 xl:col-span-2"
        >
          <h2
            id="protocols"
            className="text-ink-subtle text-xs font-semibold tracking-wider uppercase"
          >
            2. Required {action === 'discharge' ? 'discharge' : 'hold'} protocols
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reason"
                className="text-ink block text-sm font-medium"
              >
                {verb} reason <span className="text-red-600">*</span>
              </label>
              <SelectBox
                id="reason"
                aria-required="true"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="border-line bg-surface text-ink focus:border-brand-400 mt-1.5 h-10 w-full rounded-lg border px-3 text-sm"
              >
                <option value="">Select a reason…</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectBox>
            </div>

            <div>
              <label
                htmlFor="effective"
                className="text-ink block text-sm font-medium"
              >
                Effective date <span className="text-red-600">*</span>
              </label>
              <input
                id="effective"
                type="date"
                required
                min={TODAY}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="border-line bg-surface text-ink focus:border-brand-400 mt-1.5 h-10 w-full rounded-lg border px-3 text-sm"
              />
              <p className="text-ink-subtle mt-1 text-xs">
                Cannot be earlier than today.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="clinical-summary"
              className="text-ink block text-sm font-medium"
            >
              {verb} clinical summary <span className="text-red-600">*</span>
            </label>
            <textarea
              id="clinical-summary"
              required
              rows={5}
              value={summaryNote}
              onChange={(e) => setSummaryNote(e.target.value)}
              placeholder={`Summarise the care episode, current condition and handover arrangements for ${profile.name}.`}
              className="border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 mt-1.5 w-full rounded-lg border p-3 text-sm leading-relaxed"
            />
          </div>

          <fieldset className="mt-5">
            <legend className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
              Compliance acknowledgements
            </legend>
            <ul className="mt-2 space-y-2">
              {acknowledgements.map((item) => (
                <li key={item}>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={acked.has(item)}
                      onChange={() => toggleAck(item)}
                      className="accent-brand-600 mt-0.5 size-4 shrink-0"
                    />
                    <span className="text-ink-muted min-w-0 text-sm break-words">
                      {item}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </section>

        <DischargeChecklist items={readiness.checklist} action={action} />
      </div>

      {blockers.length > 0 ? (
        <div
          role="status"
          className="rounded-card flex gap-3 border border-red-300 bg-red-50/50 p-4"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-red-800">
              {blockers.length} item{blockers.length === 1 ? '' : 's'} must be
              resolved before discharge
            </p>
            <ul className="mt-1 space-y-0.5 text-red-700">
              {blockers.map((b) => (
                <li key={b.id} className="break-words">
                  {b.label} — {b.detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="rounded-card flex gap-3 border border-amber-300 bg-amber-50/50 p-4">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <p className="text-ink-muted min-w-0 text-sm break-words">
            <span className="font-semibold text-amber-800">
              Pre-archiving notice:
            </span>{' '}
            this will {action === 'discharge' ? 'formalise discharge, cancel outstanding recurring shifts, detach caregivers and archive clinical records' : 'pause active services while preserving the care plan and clinical history'}
            . Files remain accessible in audit and compliance modes.
          </p>
        </div>
      )}

      {saveDraft.isSuccess && !pending && (
        <div
          role="status"
          className="rounded-card flex gap-3 border border-emerald-300 bg-emerald-50/50 p-4"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <p className="text-ink-muted min-w-0 text-sm break-words">
            <span className="font-semibold text-emerald-800">Draft saved.</span> You can return
            to finish this later.
          </p>
        </div>
      )}

      {mutationError && (
        <div
          role="alert"
          className="rounded-card flex gap-3 border border-red-300 bg-red-50/50 p-4"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="min-w-0 text-sm font-medium text-red-800 break-words">{mutationError}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          to={`/care-recipients/${profile.id}`}
          className="border-line text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={pending}
          className="border-brand-300 text-brand-700 hover:bg-brand-50 inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium disabled:cursor-default disabled:opacity-50"
        >
          {saveDraft.isPending ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={onProcess}
          aria-disabled={!canSubmit || pending}
          aria-describedby={canSubmit ? undefined : 'submit-block-reason'}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors',
            action === 'discharge'
              ? 'bg-red-600 hover:bg-red-700 aria-disabled:hover:bg-red-600'
              : 'bg-brand-600 hover:bg-brand-700 aria-disabled:hover:bg-brand-600',
            'aria-disabled:cursor-default aria-disabled:opacity-50',
          )}
        >
          {processArchive.isPending && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {action === 'discharge' ? 'Process discharge' : 'Place on hold'}
        </button>
      </div>

      {!canSubmit && (
        <p
          id="submit-block-reason"
          className="text-ink-subtle text-right text-xs"
        >
          {!readiness.canProcess
            ? 'Blocked by the checklist above.'
            : !dateValid
              ? 'The effective date cannot be earlier than today.'
              : !formComplete
                ? 'Complete the reason, effective date and clinical summary.'
              : 'Confirm all compliance acknowledgements.'}
        </p>
      )}
    </div>
  )
}
