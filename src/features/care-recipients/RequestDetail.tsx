import { Link } from 'react-router-dom'
import {
  Check,
  FileText,
  Mail,
  MapPin,
  Phone,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { CareRequest } from './requests-data'
import { useCareRequestActions } from '@/features/billing/useCareRequests'
import {
  blockers,
  daysWaiting,
  docKindLabels,
  familyNameFor,
  formatSchedule,
  missingDocuments,
  monthlyHours,
  requiredDocuments,
  planFit,
  serviceGaps,
  priorityLabels,
  priorityTones,
  statusFor,
  statusLabels,
  statusTones,
  weeklyHours,
} from './requests-data'
import { priorityFor } from './requests-data'
import { formatMoney, planById } from '@/features/billing/data'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const chip =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(iso: string) {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`))
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-line border-t px-4 py-4 first:border-t-0">
      <h3 className="text-ink-subtle mb-2 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function RequestDetail({
  request,
  closeTo,
}: {
  request: CareRequest
  /** Where the close control goes; carries the queue's filters. */
  closeTo: string
}) {
  const status = statusFor(request)
  const priority = priorityFor(request)
  const open = blockers(request)
  const fit = planFit(request)
  const gaps = serviceGaps(request)
  const plan = planById[request.planId]
  // The decision is gated on the backend status only. The blockers/documents/
  // plan panels below are the request rail's unbacked mock (no backend source),
  // so they are advisory and must not gate the real approve call.
  const { approve, decline } = useCareRequestActions()
  const decided = request.decision !== 'undecided'
  const busy = approve.isPending || decline.isPending
  const failed = approve.isError || decline.isError

  return (
    <div className="card overflow-hidden">
      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-ink text-base font-semibold tracking-tight break-words">
              {familyNameFor(request.patient.name)}
            </h2>
            <p className="text-ink-subtle mt-0.5 text-xs">
              {request.ref} · submitted {formatDate(request.submittedAt)} ·{' '}
              {daysWaiting(request)} days waiting
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className={cn(chip, tonePill[statusTones[status]])}>
              {statusLabels[status]}
            </span>
            <span className={cn(chip, tonePill[priorityTones[priority]])}>
              {priorityLabels[priority]} priority
            </span>
            {/* Below the two-column breakpoint this panel stacks under a long
                table, so there has to be a way back up. */}
            <Link
              to={closeTo}
              className="text-ink-muted hover:text-ink hover:bg-sunken grid size-8 place-items-center rounded-lg"
            >
              <X className="size-4" strokeWidth={2.2} aria-hidden="true" />
              <span className="sr-only">Close {request.ref}</span>
            </Link>
          </div>
        </div>

        {/*
          The decision buttons sit above everything they act on, and approval is
          gated on the blockers below rather than left to the operator to notice.
          `aria-disabled` rather than `disabled`, so keyboard focus isn't
          stranded on a button that can't be reached again.
        */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            aria-disabled={decided || busy}
            aria-describedby={decided ? 'request-decision-note' : undefined}
            onClick={() => {
              if (!decided && !busy) approve.mutate(request.id)
            }}
            className={cn(
              'inline-flex h-10 min-w-32 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap',
              !decided && !busy
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-sunken text-ink-subtle border-line cursor-not-allowed border',
            )}
          >
            <Check
              className="size-4 shrink-0"
              strokeWidth={2.4}
              aria-hidden="true"
            />
            Approve request
            <span className="sr-only"> {request.ref}</span>
          </button>
          <button
            type="button"
            aria-disabled={decided || busy}
            onClick={() => {
              if (!decided && !busy) decline.mutate({ id: request.id })
            }}
            className={cn(
              'inline-flex h-10 min-w-24 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap',
              decided || busy
                ? 'bg-sunken text-ink-subtle border-line cursor-not-allowed border'
                : 'bg-red-600 text-white hover:bg-red-700',
            )}
          >
            <X
              className="size-4 shrink-0"
              strokeWidth={2.4}
              aria-hidden="true"
            />
            Reject
            <span className="sr-only"> {request.ref}</span>
          </button>
        </div>
        <button
          type="button"
          className="border-control text-ink hover:bg-sunken mt-2 h-10 w-full rounded-lg border px-4 text-sm font-medium"
        >
          Request more information
          <span className="sr-only"> for {request.ref}</span>
        </button>

        {decided && (
          <p
            id="request-decision-note"
            className="text-ink-subtle mt-2 text-xs"
          >
            This request was already {request.decision}; the decision buttons
            are inactive.
          </p>
        )}

        {failed && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-700">
            Could not save the decision. Please try again.
          </p>
        )}
      </div>

      <div className="mt-4">
        {open.length > 0 && (
          <Section title={`Blocking approval (${open.length})`}>
            <ul id="request-blockers" className="space-y-2">
              {open.map((b) => (
                <li
                  key={b.id}
                  className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5"
                >
                  <TriangleAlert
                    className="mt-0.5 size-3.5 shrink-0 text-amber-700"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold break-words text-amber-900">
                      {b.label}
                    </p>
                    <p className="mt-0.5 text-xs break-words text-amber-800">
                      {b.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Patient information">
          <p className="text-ink text-sm font-semibold break-words">
            {request.patient.name}
          </p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {request.patient.age} years old · {request.patient.sex}
          </p>
          <p className="mt-2 text-xs font-medium break-words text-red-700">
            Conditions: {request.patient.conditions.join(', ')}
          </p>
        </Section>

        <Section title="Family primary contact">
          <p className="text-ink text-sm font-semibold break-words">
            {request.contact.name}
          </p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {request.contact.relationship}
          </p>
          <p className="text-ink-muted mt-2 flex items-start gap-1.5 text-xs break-all">
            <Phone className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {request.contact.phone}
          </p>
          <p className="text-ink-muted mt-1 flex items-start gap-1.5 text-xs break-all">
            <Mail className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {request.contact.email}
          </p>
          <p className="text-ink-muted mt-1 flex items-start gap-1.5 text-xs break-words">
            <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {request.contact.address}
          </p>
        </Section>

        <Section title="Requested plan and schedule">
          <p className="text-ink text-sm font-semibold break-words">
            <Link
              to={`/billing/plans/${plan.id}/general`}
              className="hover:text-brand-700"
            >
              {plan.name}
            </Link>{' '}
            <span className="text-ink-muted font-normal">
              ({weeklyHours(request.schedule)} hrs/week)
            </span>
          </p>
          <p className="text-ink-muted mt-1 text-xs break-words">
            {formatSchedule(request.schedule)}
          </p>

          {/* The rota and the plan are both stated on the form; only one of the
              two can be right when they disagree, so the queue says which. */}
          <dl className="border-line mt-2 space-y-1 border-t pt-2 text-xs">
            <div className="flex flex-wrap justify-between gap-x-3">
              <dt className="text-ink-muted">Requested a month</dt>
              <dd className="text-ink font-medium tabular-nums">
                {monthlyHours(request.schedule)} hrs
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3">
              <dt className="text-ink-muted">{plan.name} allowance</dt>
              <dd className="text-ink font-medium tabular-nums">
                {fit.allowanceHours === undefined
                  ? `No cap, ${plan.unitsPerMonth} hr minimum`
                  : `${fit.allowanceHours} hrs`}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3">
              <dt className="text-ink-muted">
                {fit.allowanceHours === undefined
                  ? 'Estimated cost'
                  : 'List price'}
              </dt>
              <dd className="text-ink font-medium tabular-nums">
                {formatMoney(fit.estimatedCost, 'NGN')}
              </dd>
            </div>
          </dl>

          {!fit.fits && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs break-words text-red-800">
              Over the allowance by {fit.overBy} hours a month.{' '}
              {fit.suggested ? (
                <>
                  <Link
                    to={`/billing/plans/${fit.suggested}/general`}
                    className="font-semibold underline"
                  >
                    {planById[fit.suggested].name}
                  </Link>{' '}
                  covers this rota at{' '}
                  {formatMoney(planById[fit.suggested].monthlyPrice, 'NGN')} a month.
                </>
              ) : (
                'No catalogue plan covers this rota; it needs a bespoke quote.'
              )}
            </p>
          )}

          {request.specialNeeds.length > 0 && (
            <div className="mt-3">
              <h4 className="text-ink-subtle text-xs font-semibold">
                Stated needs
              </h4>
              <ul className="mt-1 space-y-1">
                {request.specialNeeds.map((need) => {
                  const uncovered = gaps.includes(need)
                  return (
                    <li
                      key={need.label}
                      className="flex items-start gap-1.5 text-xs break-words"
                    >
                      {uncovered ? (
                        <TriangleAlert
                          className="mt-0.5 size-3 shrink-0 text-red-600"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      ) : (
                        <Check
                          className="mt-0.5 size-3 shrink-0 text-emerald-600"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={
                          uncovered ? 'text-red-800' : 'text-ink-muted'
                        }
                      >
                        {need.label}
                        {uncovered && ' — not included in this plan'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Section>

        <Section title="Uploaded documents">
          <ul className="space-y-1.5">
            {request.documents.map((doc) => (
              <li
                key={doc.id}
                className="border-line flex items-center gap-2 rounded-lg border p-2.5"
              >
                <FileText
                  className="text-ink-subtle size-4 shrink-0"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="text-ink block truncate text-xs font-medium">
                    {doc.name}
                  </span>
                  <span className="text-ink-subtle block text-xs">
                    {docKindLabels[doc.kind]} · {formatDate(doc.uploadedAt)}
                  </span>
                </span>
              </li>
            ))}
            {missingDocuments(request).map((kind) => (
              <li
                key={kind}
                className="flex items-center gap-2 rounded-lg border border-dashed border-red-200 bg-red-50/50 p-2.5"
              >
                <TriangleAlert
                  className="size-4 shrink-0 text-red-600"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-red-800">
                  {docKindLabels[kind]} not uploaded
                </span>
              </li>
            ))}
          </ul>
          <p className="text-ink-subtle mt-2 text-xs">
            {plan.name} requires {requiredDocuments(plan.id).length} documents.
          </p>
        </Section>

        <Section title="Assignment">
          <p className="text-ink text-sm">
            {request.coordinator ?? (
              <span className="text-ink-subtle">No coordinator assigned</span>
            )}
          </p>
          <button
            type="button"
            className="border-control text-ink hover:bg-sunken mt-2 h-10 w-full rounded-lg border px-4 text-sm font-medium"
          >
            {request.coordinator
              ? 'Reassign coordinator'
              : 'Assign coordinator'}
            <span className="sr-only"> for {request.ref}</span>
          </button>
        </Section>
      </div>
    </div>
  )
}
