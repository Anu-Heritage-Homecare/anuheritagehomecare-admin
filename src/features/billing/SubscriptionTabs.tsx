import { Link } from 'react-router-dom'
import { Check, Mail, Phone } from 'lucide-react'
import { formatMoney, planById, unitNoun } from './data'
import type { SubscriptionDetail, TimelineEntry } from './subscription-detail'
import { getPlanDetail } from './plan-catalogue'
import {
  formatShortDate,
  invoiceAmount,
  invoiceStatus,
  patientDue,
} from '@/features/care-recipients/billing-data'
import { formatNoteTime, noteCategoryLabels } from '@/features/care-recipients/notes-data'
import { cn } from '@/lib/cn'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(iso: string) {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`))
}

function Rows({ rows }: { rows: { id: string; label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-line divide-y">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
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

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-line min-w-0 rounded-xl border p-4">
      <h3 className="text-ink-subtle mb-3 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Timeline({ entries, empty }: { entries: TimelineEntry[]; empty: string }) {
  if (entries.length === 0)
    return <p className="text-ink-subtle text-sm">{empty}</p>

  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span
            aria-hidden="true"
            className="bg-brand-500 mt-1.5 size-2 shrink-0 rounded-full"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-ink min-w-0 text-sm font-semibold break-words">
                {e.title}
              </p>
              <p className="text-ink-subtle shrink-0 text-xs">
                <time dateTime={e.at}>{formatDate(e.at)}</time>
              </p>
            </div>
            <p className="text-ink-muted mt-0.5 text-xs break-words">
              {e.detail} · {e.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* -------------------------------- overview -------------------------------- */

export function OverviewPanel({ detail }: { detail: SubscriptionDetail }) {
  const { subscription: sub, profile, primaryContact, recipient } = detail
  const plan = planById[sub.planId]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Primary contact">
          {primaryContact ? (
            <div className="min-w-0">
              <p className="text-ink text-sm font-semibold break-words">
                {primaryContact.name}
              </p>
              <p className="text-ink-subtle mt-0.5 text-xs">
                {primaryContact.relationship}
              </p>
              <p className="text-ink-muted mt-2 flex items-center gap-1.5 text-xs break-all">
                <Phone className="size-3 shrink-0" aria-hidden="true" />
                {primaryContact.phone}
              </p>
              <p className="text-ink-muted mt-1 flex items-center gap-1.5 text-xs break-all">
                <Mail className="size-3 shrink-0" aria-hidden="true" />
                {primaryContact.email}
              </p>
              <p className="text-ink-subtle mt-2 text-xs break-words">
                {profile.personal.address}
              </p>
            </div>
          ) : (
            <p className="text-ink-subtle text-sm">No family contact on file.</p>
          )}
        </Card>

        <Card title="Patient information">
          <p className="text-ink text-sm font-semibold break-words">
            {recipient.name}
          </p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {recipient.age} years old · {profile.sex}
          </p>
          <p className="mt-2 text-xs font-medium break-words text-red-700">
            {profile.summary.primaryDiagnosis}
            {profile.summary.secondaryDiagnosis &&
              `, ${profile.summary.secondaryDiagnosis}`}
          </p>
          <p className="text-ink-muted mt-2 text-xs break-words">
            Emergency: {profile.summary.emergencyContact.name} (
            {profile.summary.emergencyContact.relationship}) ·{' '}
            {profile.summary.emergencyContact.phone}
          </p>
          <Link
            to={`/care-recipients/${recipient.id}`}
            className="text-brand-700 hover:text-brand-800 mt-3 inline-flex min-h-11 items-center text-sm font-medium"
          >
            Open care record
            <span className="sr-only"> for {recipient.name}</span>
          </Link>
        </Card>

        <Card title="Subscription">
          <Rows
            rows={[
              {
                id: 'plan',
                label: 'Active plan',
                value: (
                  <Link
                    to={`/billing/plans/${plan.id}/general`}
                    className="text-brand-700 hover:text-brand-800"
                  >
                    {plan.name}
                  </Link>
                ),
              },
              { id: 'price', label: 'List price', value: formatMoney(plan.monthlyPrice, 'NGN') },
              { id: 'cycle', label: 'Billing cycle', value: sub.cycle },
              {
                id: 'start',
                label: 'Contract start',
                value: profile.summary.startDate,
              },
              {
                id: 'renewal',
                label: 'Next renewal',
                value: sub.renewsAt
                  ? formatDate(sub.renewsAt)
                  : sub.invoiceBilled
                    ? 'Billed by invoice'
                    : 'Not scheduled',
              },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Activity and onboarding">
          <Timeline
            entries={detail.timeline.slice(0, 5)}
            empty="Nothing recorded yet."
          />
        </Card>
        <Card title="Plan inclusions">
          <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {getPlanDetail(plan.id).services.map((id) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                <Check
                  className="size-3.5 shrink-0 text-emerald-600"
                  strokeWidth={3}
                  aria-hidden="true"
                />
                <span className="text-ink-muted min-w-0 break-words capitalize">
                  {id.replace(/-/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------- billing -------------------------------- */

export function BillingPanel({ detail }: { detail: SubscriptionDetail }) {
  const { billing, invoices, recipient } = detail

  if (!billing)
    return (
      <p className="text-ink-subtle text-sm">
        No billing record. This subscription is priced from the plan and has not
        been invoiced yet.
      </p>
    )

  const rate = billing.insurance.coverageRate

  return (
    <div className="space-y-4">
      <p className="text-ink-muted text-sm">
        The same invoices shown on{' '}
        <Link
          to={`/care-recipients/${recipient.id}/billing`}
          className="text-brand-700 hover:text-brand-800 font-medium"
        >
          {recipient.name}&rsquo;s billing tab
        </Link>
        . Insurance covers {Math.round(rate * 100)}% through{' '}
        {billing.insurance.provider}.
      </p>

      <ul className="divide-line border-line divide-y rounded-xl border">
        {invoices.slice(0, 6).map((invoice) => {
          const status = invoiceStatus(invoice)
          return (
            <li key={invoice.id} className="p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-ink min-w-0 text-sm font-semibold">
                  {invoice.number}
                </p>
                <p className="text-ink shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(patientDue(invoice, rate), 'NGN')}
                </p>
              </div>
              <p className="text-ink-subtle mt-0.5 text-xs break-words">
                {invoice.visits} visits · {formatMoney(invoiceAmount(invoice), 'NGN')} billed ·{' '}
                {status === 'paid'
                  ? `paid ${formatShortDate(invoice.paidAt ?? invoice.dueAt)}`
                  : `due ${formatShortDate(invoice.dueAt)}`}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ----------------------------- flexible hours ----------------------------- */

export function HoursPanel({ detail }: { detail: SubscriptionDetail }) {
  const { hours, subscription: sub } = detail
  const plan = planById[sub.planId]

  if (!hours)
    return (
      <p className="text-ink-subtle text-sm">
        Not applicable. {plan.name} bills {plan.unitsPerMonth}{' '}
        {unitNoun[plan.model].many} a month rather than drawing from a prepaid
        balance.
      </p>
    )

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        {[
          ['Purchased', `${hours.purchased}h`],
          ['Used to date', `${hours.used}h`],
          ['Remaining', `${hours.remaining}h`],
        ].map(([label, value]) => (
          <article key={label} className="border-line rounded-xl border p-3">
            <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
              {label}
            </p>
            <p className="text-ink mt-1.5 text-xl font-bold tracking-tight tabular-nums">
              {value}
            </p>
          </article>
        ))}
      </div>

      <div>
        <div className="text-ink-muted flex flex-wrap justify-between gap-x-4 text-xs">
          <span>{hours.consumedPercent}% of the balance used</span>
          <span>Expires {formatDate(hours.expiresAt)}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={hours.consumedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Package hours consumed"
          className="bg-sunken mt-1.5 h-2 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-brand-600 h-full rounded-full"
            style={{ width: `${hours.consumedPercent}%` }}
          />
        </div>
        <p className="text-ink-subtle mt-1.5 text-xs">
          Contract {hours.contract} · minimum {plan.unitsPerMonth} hours a month ·
          balance bought for {formatMoney(hours.value, 'NGN')} ({hours.purchased} ×{' '}
          {formatMoney(hours.value / hours.purchased, 'NGN')})
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['Add hours', 'Adjust balance', 'Extend expiry'].map((label) => (
          <button
            key={label}
            type="button"
            className="border-control text-ink hover:bg-sunken h-10 rounded-lg border px-4 text-sm font-medium"
          >
            {label}
            <span className="sr-only"> on {hours.contract}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- renewals -------------------------------- */

export function RenewalsPanel({ detail }: { detail: SubscriptionDetail }) {
  const { renewal, subscription: sub } = detail
  const plan = planById[sub.planId]
  const rules = getPlanDetail(plan.id).renewalRules

  return (
    <div className="max-w-2xl space-y-4">
      <Rows
        rows={[
          {
            id: 'next',
            label: 'Next renewal',
            value: renewal.at
              ? formatDate(renewal.at)
              : sub.invoiceBilled
                ? 'Billed by invoice, no card renewal'
                : 'Not scheduled',
          },
          { id: 'amount', label: 'Renewal amount', value: formatMoney(renewal.amount, 'NGN') },
          { id: 'cycle', label: 'Cycle', value: sub.cycle },
          { id: 'auto', label: 'Auto-renew', value: sub.autoRenew ? 'On' : 'Off' },
          {
            id: 'payment',
            label: 'Payment raised',
            value: renewal.payment
              ? `${renewal.payment.id} · ${renewal.payment.status}`
              : 'None yet',
          },
        ]}
      />

      {renewal.failed && (
        <p
          role="status"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          The last charge on this plan failed:{' '}
          <strong className="font-semibold">{renewal.failed.id}</strong> for{' '}
          {formatMoney(renewal.failed.amount, 'NGN')} on{' '}
          {formatDate(renewal.failed.at)}. The cycle date above has already
          rolled forward, so the balance is still outstanding.
        </p>
      )}

      <section>
        <h3 className="text-ink-subtle mb-3 text-xs font-semibold tracking-wider uppercase">
          Plan renewal rules
        </h3>
        <Rows rows={rules} />
      </section>
    </div>
  )
}

/* --------------------------- people (two panels) --------------------------- */

export function CoordinatorPanel({ detail }: { detail: SubscriptionDetail }) {
  return (
    <div className="max-w-2xl">
      <Rows
        rows={[
          { id: 'name', label: 'Care coordinator', value: detail.coordinator },
          {
            id: 'level',
            label: 'Care level',
            value: detail.recipient.careLevel,
          },
          { id: 'next', label: 'Next visit', value: detail.profile.summary.nextVisit },
          {
            id: 'started',
            label: 'Coordinating since',
            value: detail.profile.summary.startDate,
          },
        ]}
      />
    </div>
  )
}

export function CaregiverPanel({ detail }: { detail: SubscriptionDetail }) {
  const { caregiver, caregiverRole, recipient } = detail

  if (!caregiver)
    return <p className="text-ink-subtle text-sm">No caregiver assigned yet.</p>

  return (
    <div className="max-w-2xl space-y-3">
      <Rows
        rows={[
          { id: 'name', label: 'Assigned caregiver', value: caregiver.name },
          { id: 'role', label: 'Role', value: caregiverRole ?? caregiver.role },
          { id: 'spec', label: 'Specialisation', value: caregiver.specialization },
          { id: 'schedule', label: 'Schedule', value: caregiver.schedule },
          {
            id: 'hours',
            label: 'Hours this month',
            // Synthesised team records carry 0; that is "unknown", not "none
            // worked", and a 24-hour client showing 0h logged is worse than a
            // blank.
            value: caregiver.hoursThisMonth === '0h'
              ? 'Not recorded'
              : caregiver.hoursThisMonth,
          },
          {
            id: 'rating',
            label: 'Rating',
            value: caregiver.rating > 0 ? `${caregiver.rating} / 5` : 'Not rated',
          },
        ]}
      />
      <Link
        to={`/care-recipients/${recipient.id}/caregivers`}
        className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center text-sm font-medium"
      >
        Open the full care team
        <span className="sr-only"> for {recipient.name}</span>
      </Link>
    </div>
  )
}

/* ----------------------------- payment history ---------------------------- */

export function PaymentsPanel({ detail }: { detail: SubscriptionDetail }) {
  const { paymentHistory, transactions, billing } = detail

  /*
   * A transaction whose reference names an invoice is the same money as the
   * settlement listed below it. Showing both made one ₦960 payment look like
   * two, and the tab totalled to double the amount actually received.
   */
  const settledNumbers = new Set(paymentHistory.map((p) => p.invoiceNumber))
  const cardActivity = transactions.filter(
    (t) => ![...settledNumbers].some((n) => t.reference.includes(n)),
  )

  if (paymentHistory.length === 0 && transactions.length === 0)
    return <p className="text-ink-subtle text-sm">No payments recorded yet.</p>

  return (
    <div className="space-y-4">
      {cardActivity.length > 0 && (
        <section>
          <h3 className="text-ink-subtle mb-2 text-xs font-semibold tracking-wider uppercase">
            Card and transfer activity
          </h3>
          <ul className="divide-line border-line divide-y rounded-xl border">
            {cardActivity.map((t) => (
              <li key={t.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 p-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-semibold">{t.id}</p>
                  <p className="text-ink-subtle mt-0.5 text-xs break-words">
                    {t.reference} · {t.method}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-ink text-sm font-semibold tabular-nums">
                    {formatMoney(t.amount, 'NGN')}
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs capitalize">
                    {t.status} · {formatDate(t.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paymentHistory.length > 0 && billing && (
        <section>
          <h3 className="text-ink-subtle mb-2 text-xs font-semibold tracking-wider uppercase">
            Invoice settlements
          </h3>
          <ul className="divide-line border-line divide-y rounded-xl border">
            {paymentHistory.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 p-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-semibold">{p.invoiceNumber}</p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    {billing.method.brand} •••• {billing.method.last4}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-ink text-sm font-semibold tabular-nums">
                    {formatMoney(p.amount, 'NGN')}
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    {formatShortDate(p.paidAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/* ------------------------- timeline, notes, audit ------------------------- */

export function ActivityPanel({ detail }: { detail: SubscriptionDetail }) {
  return (
    <div className="max-w-2xl">
      <Timeline entries={detail.timeline} empty="Nothing recorded yet." />
    </div>
  )
}

export function AuditPanel({ detail }: { detail: SubscriptionDetail }) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-ink-muted text-sm">
        Money-moving events only. Every line traces to an invoice or a
        transaction in the log.
      </p>
      <Timeline entries={detail.audit} empty="No billable events yet." />
    </div>
  )
}

export function NotesPanel({ detail }: { detail: SubscriptionDetail }) {
  const { notes, recipient } = detail

  if (notes.length === 0)
    return <p className="text-ink-subtle text-sm">No care notes on file.</p>

  return (
    <div className="max-w-3xl space-y-3">
      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="border-line rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-ink min-w-0 text-sm font-semibold break-words">
                {noteCategoryLabels[note.category]}
              </p>
              <p className="text-ink-subtle shrink-0 text-xs">
                {formatNoteTime(note.at)}
              </p>
            </div>
            <p className="text-ink-muted mt-1 text-sm break-words">{note.body}</p>
            <p className="text-ink-subtle mt-1.5 text-xs">
              {note.author} · {note.authorRole}
            </p>
          </li>
        ))}
      </ul>
      <Link
        to={`/care-recipients/${recipient.id}/notes`}
        className={cn(
          'text-brand-700 hover:text-brand-800',
          'inline-flex min-h-11 items-center text-sm font-medium',
        )}
      >
        Open all care notes
        <span className="sr-only"> for {recipient.name}</span>
      </Link>
    </div>
  )
}
