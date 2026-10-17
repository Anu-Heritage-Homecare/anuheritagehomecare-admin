import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Calendar, Check, ChevronDown, ChevronRight, Plus, Search, Trash2, TriangleAlert, User, X } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { invoiceDates, markSent, raiseInvoice, useRaisedInvoices } from '@/features/billing/create-invoice'
import { getInvoice } from '@/features/billing/ledger'
import type { LedgerInvoice } from '@/features/billing/ledger'
import {
  discountAmount,
  draftTotals,
  earnsLoyalty,
  loyaltyDiscount,
} from '@/features/billing/invoice-draft'
import type { DraftAdjustment, DraftDiscount } from '@/features/billing/invoice-draft'
import { accountRecipients, billingAccounts, getAccount } from '@/features/billing/accounts'
import type { AccountRecipient, BillingAccount } from '@/features/billing/accounts'
import type { RecipientStatus } from '@/types'
import { formatMoney } from '@/features/billing/data'
import {
  billableLines,
  currentPeriod,
  isPeriod,
  periodLabel,
  periodOptions,
  quantityLabel,
  rateLabel,
} from '@/features/billing/billable'
import type { BillableLine, Period } from '@/features/billing/billable'
import { useBillingSettings } from '@/features/billing/settings'
import {
  accountStatement,
  accountStatusLabels,
  accountStatusTones,
  statementStatusLabels,
  summariseAccount,
} from '@/features/billing/ledger'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const steps = [
  'Billing Account',
  'Recipient',
  'Billable Services',
  'Invoice Details',
  'Review & Confirm',
  'Send Invoice',
] as const

/** Only a path inside the app is honoured as the way back. */
function safeReturn(from: string | null): string {
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/billing'
}

export function CreateInvoicePage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const account = getAccount(params.get('account') ?? '')
  const requested = Number(params.get('step') ?? '1')
  useRaisedInvoices()
  const raised = getInvoice(params.get('invoice') ?? '')
  // A later step can't be opened without the choices before it, and the last
  // one only once the invoice exists.
  const step = !account
    ? 1
    : Math.min(Math.max(1, requested || 1), raised ? steps.length : steps.length - 1)
  const settings = useBillingSettings()
  const back = safeReturn(params.get('from'))
  const people = account ? accountRecipients(account) : []
  // The first person is chosen until another is picked.
  const recipient = people.find((r) => r.key === params.get('recipient')) ?? people[0]
  const period = isPeriod(params.get('period')) ? (params.get('period') as Period) : currentPeriod
  const lines = recipient ? billableLines(recipient.billable) : []
  // Everything is ticked until it is unticked; the address holds the exceptions.
  const excluded = new Set((params.get('exclude') ?? '').split(',').filter(Boolean))
  const chosenLines = lines.filter((l) => !excluded.has(l.id))
  const subtotal = chosenLines.reduce((sum, l) => sum + l.total, 0)

  // Discounts and adjustments belong to one account and recipient; picking
  // another starts them afresh. Held here because every step is this page.
  const owner = `${account?.id}/${recipient?.key}`
  const [draft, setDraft] = useState<Extras>({ owner: '', noLoyalty: false, discounts: [], adjustments: [] })
  const extras = draft.owner === owner ? draft : { owner, noLoyalty: false, discounts: [], adjustments: [] }
  const setExtras = (patchExtras: Partial<Extras>) => setDraft({ ...extras, ...patchExtras })
  const loyal = earnsLoyalty(recipient?.startedAt) && !extras.noLoyalty
  const discounts = loyal ? [loyaltyDiscount, ...extras.discounts] : extras.discounts

  const patch = (entries: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(entries)) {
      if (v === null || v === '') p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  const go = (next: number) => {
    const p = new URLSearchParams(params)
    p.set('step', String(next))
    // Keep the default choice in the address too, so later steps read it.
    if (recipient) p.set('recipient', recipient.key)
    setParams(p)
  }
  const choose = (id: string) => {
    const p = new URLSearchParams(params)
    p.set('account', id)
    // A recipient belongs to one account, and the ticked services to one recipient.
    p.delete('recipient')
    p.delete('exclude')
    setParams(p, { replace: true })
  }
  const chooseRecipient = (key: string) => patch({ recipient: key, exclude: null })

  const create = () => {
    if (!account || !recipient || chosenLines.length === 0) return
    const invoice = raiseInvoice(
      { account, recipient, period, lines: chosenLines, discounts, adjustments: extras.adjustments },
      settings,
    )
    // Replace, so Back from the confirmation cannot raise it twice.
    const p = new URLSearchParams(params)
    p.set('step', String(steps.length))
    p.set('invoice', invoice.number)
    setParams(p, { replace: true })
  }

  return (
    <div className="bg-canvas flex min-h-dvh flex-col">
      <header className="border-line bg-surface border-b">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <Logo />
            <span aria-hidden="true" className="bg-line hidden h-6 w-px sm:block" />
            <h1 className="text-ink text-lg font-bold tracking-tight">Create Invoice</h1>
          </div>

          <nav aria-label="Invoice steps" className="relative order-3 w-full overflow-x-auto xl:order-none xl:w-auto xl:flex-1">
            {/* w-max + mx-auto centres when it fits and scrolls from the start
                when it doesn't — justify-center would clip the first step. */}
            <ol className="mx-auto flex w-max items-center gap-2 whitespace-nowrap">
              {steps.map((label, i) => {
                const n = i + 1
                const done = n < step
                const current = n === step
                return (
                  <li key={label} className="flex items-center gap-2">
                    <span
                      aria-current={current ? 'step' : undefined}
                      className={cn(
                        'inline-flex items-center gap-2 text-sm font-medium',
                        current ? 'text-brand-700' : done ? 'text-ink' : 'text-ink-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 place-items-center rounded-full text-xs font-semibold',
                          current
                            ? 'bg-brand-600 text-white'
                            : done
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-sunken text-ink-muted',
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : n}
                      </span>
                      {/* Every label at 2xl; below that only the current one, so
                          six steps fit beside the logo. */}
                      <span className={cn(!current && 'sr-only 2xl:not-sr-only')}>{label}</span>
                      {done && <span className="sr-only"> (done)</span>}
                    </span>
                    {n < steps.length && (
                      <ChevronRight className="text-ink-subtle size-4" strokeWidth={2} aria-hidden="true" />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>

          <Link
            to={back}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800"
          >
            <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Cancel
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:px-8">
        <div className="w-full max-w-3xl">
          {step === 1 && <AccountStep account={account} onChoose={choose} />}
          {step === 2 && account && (
            <RecipientStep account={account} people={people} selected={recipient} onChoose={chooseRecipient} />
          )}
          {step === 3 && account && recipient && (
            <ServicesStep
              account={account}
              recipientName={recipient.name}
              lines={lines}
              excluded={excluded}
              period={period}
              onExclude={(ids) => patch({ exclude: [...ids].join(',') })}
              onPeriod={(next) => patch({ period: next === currentPeriod ? null : next })}
            />
          )}
          {step === 4 && account && recipient && (
            <AdjustmentsStep
              subtotal={subtotal}
              discounts={discounts}
              adjustments={extras.adjustments}
              onRemoveDiscount={(id) =>
                id === loyaltyDiscount.id
                  ? setExtras({ noLoyalty: true })
                  : setExtras({ discounts: extras.discounts.filter((d) => d.id !== id) })
              }
              onAddDiscount={(d) => setExtras({ discounts: [...extras.discounts, d] })}
              onAddAdjustment={(a) => setExtras({ adjustments: [...extras.adjustments, a] })}
              onRemoveAdjustment={(id) => setExtras({ adjustments: extras.adjustments.filter((a) => a.id !== id) })}
            />
          )}
          {step === 5 && account && recipient && (
            <ReviewStep
              account={account}
              recipient={recipient}
              period={period}
              lines={chosenLines}
              discounts={discounts}
              adjustments={extras.adjustments}
              onEdit={go}
            />
          )}
          {step === 6 && account && raised && (
            <DoneStep
              account={account}
              invoice={raised}
              onAnother={() => {
                setDraft({ owner: '', noLoyalty: false, discounts: [], adjustments: [] })
                setParams(params.get('from') ? { from: params.get('from') as string } : {})
              }}
            />
          )}
        </div>
      </main>

      {step < steps.length && (
      <footer className="border-line bg-surface border-t">
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
          {step === 1 ? (
            <button
              type="button"
              onClick={() => navigate(back)}
              className="text-ink-muted hover:text-ink text-sm font-semibold"
            >
              Cancel Wizard
            </button>
          ) : (
            <button type="button" onClick={() => go(step - 1)} className="text-ink-muted hover:text-ink text-sm font-semibold">
              Back
            </button>
          )}
          {step < steps.length && (
            <button
              type="button"
              disabled={!account || (step === 2 && !recipient) || (step >= 3 && chosenLines.length === 0)}
              onClick={() => (step === steps.length - 1 ? create() : go(step + 1))}
              className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-white transition-colors"
            >
              {step === steps.length - 1 ? 'Create Invoice' : `Continue to ${steps[step]}`}
            </button>
          )}
        </div>
      </footer>
      )}
    </div>
  )
}

/* --------------------------------- step 6 ---------------------------------- */

function DoneStep({
  account,
  invoice,
  onAnother,
}: {
  account: BillingAccount
  invoice: LedgerInvoice
  onAnother: () => void
}) {
  const canSend = account.email !== 'Not recorded'
  const due = new Date(`${invoice.dueAt}T00:00:00Z`)
  return (
    <section aria-labelledby="step-done" className="card mx-auto max-w-lg p-6 text-center sm:p-10">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50">
        <Check className="size-7 text-emerald-600" strokeWidth={2} aria-hidden="true" />
      </span>
      <h2 id="step-done" className="text-ink mt-5 text-2xl font-bold tracking-tight">
        Invoice Created Successfully
      </h2>
      <p className="text-ink-muted mt-1.5 text-sm">
        Invoice #{invoice.number} has been generated and logged.
      </p>

      <dl className="bg-sunken/60 mt-6 space-y-2.5 rounded-xl px-5 py-4 text-left text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Recipient Profile</dt>
          <dd className="text-ink text-right font-semibold">{account.name} Account</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Due Date</dt>
          <dd className="text-ink font-semibold">{shortDate.format(due)}</dd>
        </div>
        <div className="border-line flex items-center justify-between gap-4 border-t pt-3">
          <dt className="text-ink font-semibold">Total Amount Due</dt>
          <dd className="text-brand-600 text-lg font-bold tabular-nums">{formatMoney(invoice.amount)}</dd>
        </div>
      </dl>

      <div className="mt-6 space-y-3">
        <Link
          to={`/billing/invoices/${invoice.number}`}
          className="bg-brand-600 hover:bg-brand-700 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white"
        >
          View Invoice
        </Link>
        {invoice.sentAt ? (
          <p
            role="status"
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300 text-sm font-semibold text-emerald-700"
          >
            <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Sent to {account.email}
          </p>
        ) : (
          <button
            type="button"
            disabled={!canSend}
            onClick={() => markSent(invoice.number)}
            className="border-brand-500 text-brand-600 hover:bg-brand-50 disabled:border-line disabled:text-ink-subtle flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold"
          >
            Send to Client
          </button>
        )}
        {!canSend && <p className="text-ink-subtle text-xs">No email address is recorded for this account.</p>}
      </div>

      <div className="border-line mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t pt-5 text-sm font-semibold">
        <button type="button" onClick={onAnother} className="text-brand-600 hover:text-brand-700">
          Create Another Invoice
        </button>
        <Link to={`/billing/accounts/${account.id}/invoices`} className="text-ink-muted hover:text-ink">
          Back to Invoices
        </Link>
      </div>
    </section>
  )
}

/* --------------------------------- step 5 ---------------------------------- */

const longDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })

function ReviewStep({
  account,
  recipient,
  period,
  lines,
  discounts,
  adjustments,
  onEdit,
}: {
  account: BillingAccount
  recipient: AccountRecipient
  period: Period
  lines: BillableLine[]
  discounts: DraftDiscount[]
  adjustments: DraftAdjustment[]
  onEdit: (step: number) => void
}) {
  const { taxRatePercent, paymentTermsDays } = useBillingSettings()
  const dates = invoiceDates(paymentTermsDays)
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0)
  const t = draftTotals(subtotal, discounts, adjustments, taxRatePercent)
  const [y, m] = period.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0))
  // Issued today, when it is raised; due on the default terms.
  const issued = new Date(`${dates.issuedAt}T00:00:00Z`)
  const due = new Date(`${dates.dueAt}T00:00:00Z`)

  return (
    <section aria-labelledby="step-review" className="card p-6 sm:p-8">
      <h2 id="step-review" className="text-ink text-xl font-bold tracking-tight">
        Review Invoice Details
      </h2>
      <p className="text-ink-muted mt-1 text-sm">
        Please thoroughly verify all details, items, rates, and adjustments prior to issuing the official document.
      </p>

      <ReviewHeading title="Core Accounts & Recipients" onEdit={() => onEdit(1)} />
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-sunken/60 rounded-xl px-4 py-3.5">
          <p className="text-ink-subtle text-xs font-medium uppercase">Billing Account</p>
          <p className="text-ink mt-1 font-semibold">{account.name} Account</p>
          <p className="text-ink-muted mt-1 text-xs">ID: {account.ref}</p>
        </div>
        <div className="bg-sunken/60 rounded-xl px-4 py-3.5">
          <p className="text-ink-subtle text-xs font-medium uppercase">Care Recipient</p>
          <p className="text-ink mt-1 font-semibold">{recipient.name}</p>
          <p className="text-ink-muted mt-1 text-xs">{recipient.carePlan}</p>
        </div>
      </div>

      <ReviewHeading title="Service Period & Payment Terms" onEdit={() => onEdit(3)} />
      <dl className="border-line divide-line mt-3 divide-y rounded-xl border px-4">
        <div className="flex justify-between gap-4 py-3.5">
          <div>
            <dt className="text-ink-subtle text-xs font-medium uppercase">Service Period</dt>
            <dd className="text-ink mt-1 text-sm font-semibold">
              {longDate.format(start)} - {longDate.format(end)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-ink-subtle text-xs font-medium uppercase">Payment Terms</dt>
            <dd className="text-ink mt-1 text-sm font-semibold">Net {paymentTermsDays}</dd>
          </div>
        </div>
        <div className="flex justify-between gap-4 py-3.5">
          <div>
            <dt className="text-ink-subtle text-xs font-medium uppercase">Issue Date</dt>
            <dd className="text-ink mt-1 text-sm">{longDate.format(issued)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-ink-subtle text-xs font-medium uppercase">Due Date</dt>
            <dd className="text-brand-600 mt-1 text-sm font-bold">{shortDate.format(due)}</dd>
          </div>
        </div>
      </dl>

      <ReviewHeading title="Billable Services & Line Items" onEdit={() => onEdit(3)} />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="bg-sunken/60 text-ink-muted text-xs uppercase">
              <th scope="col" className="rounded-l-lg py-3 pl-4 font-semibold">Service Description</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">Rate</th>
              <th scope="col" className="py-3 pr-4 text-center font-semibold whitespace-nowrap">Qty / Hours</th>
              <th scope="col" className="rounded-r-lg py-3 pr-4 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-4 pl-4">
                  <span className="text-ink block font-semibold">{l.label}</span>
                  <span className="text-ink-muted block text-xs">{l.detail}</span>
                </td>
                <td className="text-ink py-4 pr-4 text-right whitespace-nowrap tabular-nums">
                  {rateLabel(l, formatMoney).replace('/', ' / ')}
                </td>
                <td className="text-ink py-4 pr-4 text-center whitespace-nowrap">{quantityLabel(l)}</td>
                <td className="text-ink py-4 pr-4 text-right font-bold whitespace-nowrap tabular-nums">
                  {formatMoney(l.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="border-line bg-sunken/30 mt-5 space-y-2.5 rounded-xl border px-5 py-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="text-ink font-semibold tabular-nums">{formatMoney(t.subtotal)}</dd>
        </div>
        {discounts.map((d) => (
          <div key={d.id} className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              {d.label}
              {d.kind === 'percent' && ` (-${d.value}%)`}
            </dt>
            <dd className="font-semibold text-red-600 tabular-nums">{minus(discountAmount(d, subtotal))}</dd>
          </div>
        ))}
        {adjustments.map((a) => (
          <div key={a.id} className="flex justify-between gap-4">
            <dt className="text-ink-muted">{a.label}</dt>
            <dd className={cn('font-semibold tabular-nums', a.amount < 0 ? 'text-red-600' : 'text-ink')}>
              {signed(a.amount)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">VAT ({taxRatePercent}%)</dt>
          <dd className="text-ink font-semibold tabular-nums">{formatMoney(t.vat)}</dd>
        </div>
        <div className="border-line flex items-center justify-between gap-4 border-t pt-3.5">
          <dt className="text-ink font-bold">Total Invoice Amount</dt>
          <dd className="text-brand-600 text-xl font-bold tabular-nums sm:text-2xl">{formatMoney(t.due)}</dd>
        </div>
      </dl>
    </section>
  )
}

function ReviewHeading({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3">
      <h3 className="text-brand-600 text-sm font-bold tracking-wide uppercase">{title}</h3>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title.toLowerCase()}`}
        className="text-brand-600 hover:text-brand-700 text-sm font-semibold"
      >
        Edit
      </button>
    </div>
  )
}

/* --------------------------------- step 4 ---------------------------------- */

interface Extras {
  owner: string
  /** The loyalty discount was removed by hand. */
  noLoyalty: boolean
  discounts: DraftDiscount[]
  adjustments: DraftAdjustment[]
}

/** ₦-72,500, as the design writes a reduction. */
function minus(amount: number): string {
  return formatMoney(amount).replace('₦', '₦-')
}

function signed(amount: number): string {
  return amount < 0 ? minus(-amount) : `+${formatMoney(amount)}`
}

const outlineButton =
  'border-brand-500 text-brand-600 hover:bg-brand-50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold whitespace-nowrap'

function AdjustmentsStep({
  subtotal,
  discounts,
  adjustments,
  onRemoveDiscount,
  onAddDiscount,
  onAddAdjustment,
  onRemoveAdjustment,
}: {
  subtotal: number
  discounts: DraftDiscount[]
  adjustments: DraftAdjustment[]
  onRemoveDiscount: (id: string) => void
  onAddDiscount: (d: DraftDiscount) => void
  onAddAdjustment: (a: DraftAdjustment) => void
  onRemoveAdjustment: (id: string) => void
}) {
  const { taxRatePercent } = useBillingSettings()
  const [adding, setAdding] = useState<'discount' | 'adjustment' | null>(null)
  const t = draftTotals(subtotal, discounts, adjustments, taxRatePercent)
  // What is left before the invoice would reach zero.
  const headroom = subtotal - t.discounts + t.adjustments

  return (
    <section aria-labelledby="step-adjustments" className="card p-6 sm:p-8">
      <h2 id="step-adjustments" className="text-ink text-xl font-bold tracking-tight">
        Discounts &amp; Adjustments
      </h2>
      <p className="text-ink-muted mt-1 text-sm">
        Add promotional discounts, loyalty rates, or manual adjustments to finalise the invoice totals.
      </p>

      <div className="bg-sunken/60 mt-6 flex items-center justify-between gap-4 rounded-xl px-5 py-4">
        <span className="text-ink font-semibold">Subtotal</span>
        <span className="text-ink text-lg font-bold tabular-nums">{formatMoney(subtotal)}</span>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="text-ink text-sm font-semibold">Applied Discounts</h3>
        <button type="button" onClick={() => setAdding('discount')} className={outlineButton}>
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Add Discount
        </button>
      </div>
      {discounts.length === 0 ? (
        <Empty>No discounts applied to this invoice yet.</Empty>
      ) : (
        <ul className="mt-3 space-y-2">
          {discounts.map((d) => (
            <li key={d.id} className="border-line flex items-center gap-3 rounded-xl border px-4 py-3.5 sm:gap-4">
              <span className="bg-brand-50 text-brand-600 shrink-0 rounded-md px-2 py-1 text-xs font-semibold">
                {d.kind === 'percent' ? `-${d.value}%` : 'Fixed'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-ink block text-sm font-semibold">{d.label}</span>
                <span className="text-ink-muted block text-xs">{d.detail}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-red-600 tabular-nums">
                {minus(discountAmount(d, subtotal))}
              </span>
              <button
                type="button"
                onClick={() => onRemoveDiscount(d.id)}
                aria-label={`Remove ${d.label}`}
                className="text-ink-subtle hover:text-red-600 shrink-0 rounded p-1"
              >
                <Trash2 className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="text-ink text-sm font-semibold">Manual Adjustments</h3>
        <button type="button" onClick={() => setAdding('adjustment')} className={outlineButton}>
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Add Adjustment
        </button>
      </div>
      {adjustments.length === 0 ? (
        <Empty>No manual adjustments applied to this invoice yet.</Empty>
      ) : (
        <ul className="mt-3 space-y-2">
          {adjustments.map((a) => (
            <li key={a.id} className="border-line flex items-center gap-3 rounded-xl border px-4 py-3.5 sm:gap-4">
              <span className="text-ink min-w-0 flex-1 text-sm font-semibold">{a.label}</span>
              <span
                className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  a.amount < 0 ? 'text-red-600' : 'text-ink',
                )}
              >
                {signed(a.amount)}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAdjustment(a.id)}
                aria-label={`Remove ${a.label}`}
                className="text-ink-subtle hover:text-red-600 shrink-0 rounded p-1"
              >
                <Trash2 className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dl className="border-line mt-6 space-y-2 border-t pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Course &amp; Care Services Subtotal</dt>
          <dd className="text-ink font-semibold tabular-nums">{formatMoney(t.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Discounts Applied</dt>
          <dd className={cn('font-semibold tabular-nums', t.discounts > 0 ? 'text-red-600' : 'text-ink')}>
            {t.discounts > 0 ? minus(t.discounts) : formatMoney(0)}
          </dd>
        </div>
        {t.adjustments !== 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Manual Adjustments</dt>
            <dd className={cn('font-semibold tabular-nums', t.adjustments < 0 ? 'text-red-600' : 'text-ink')}>
              {signed(t.adjustments)}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">VAT ({taxRatePercent}%)</dt>
          <dd className="text-ink font-semibold tabular-nums">{formatMoney(t.vat)}</dd>
        </div>
        <div className="border-line mt-3 flex items-center justify-between gap-4 border-t pt-4">
          <dt className="text-ink text-base font-bold">Total Amount Due</dt>
          <dd className="text-brand-600 text-2xl font-bold tabular-nums" aria-live="polite">
            {formatMoney(t.due)}
          </dd>
        </div>
      </dl>

      <Drawer
        open={adding !== null}
        onClose={() => setAdding(null)}
        title={adding === 'discount' ? 'Add discount' : 'Add adjustment'}
        placement="center"
      >
        {adding === 'discount' && (
          <DiscountForm
            subtotal={subtotal}
            headroom={headroom}
            onDone={(d) => {
              if (d) onAddDiscount(d)
              setAdding(null)
            }}
          />
        )}
        {adding === 'adjustment' && (
          <AdjustmentForm
            headroom={headroom}
            onDone={(a) => {
              if (a) onAddAdjustment(a)
              setAdding(null)
            }}
          />
        )}
      </Drawer>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-line text-ink-subtle mt-3 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
      {children}
    </p>
  )
}

const inputClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-11 w-full rounded-lg border px-3 text-sm'

function FormButtons({ valid, onCancel, submit }: { valid: boolean; onCancel: () => void; submit: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!valid}
        className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
      >
        {submit}
      </button>
    </div>
  )
}

function DiscountForm({
  subtotal,
  headroom,
  onDone,
}: {
  subtotal: number
  headroom: number
  onDone: (d?: DraftDiscount) => void
}) {
  const [label, setLabel] = useState('')
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState<DraftDiscount['kind']>('percent')
  const [raw, setRaw] = useState('')
  const value = Number(raw)
  const amount = kind === 'percent' ? Math.round((subtotal * value) / 100) : value
  const numberOk = raw.trim() !== '' && Number.isFinite(value) && value > 0 && (kind === 'amount' || value <= 100)
  const fits = amount <= headroom
  const valid = label.trim() !== '' && numberOk && fits

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onDone({
          id: `d-${Date.now()}`,
          label: label.trim(),
          detail: reason.trim() || 'Manual discount',
          kind,
          value: kind === 'amount' ? Math.round(value) : value,
        })
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">Discount name</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="e.g. Promotional Discount" className={inputClass} />
      </label>
      <fieldset>
        <legend className="text-ink text-sm font-medium">Type</legend>
        <div className="mt-1.5 flex gap-4 text-sm">
          {(['percent', 'amount'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name="discount-kind" checked={kind === k} onChange={() => setKind(k)} className="accent-brand-600" />
              {k === 'percent' ? 'Percentage' : 'Fixed amount'}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-ink text-sm font-medium">{kind === 'percent' ? 'Percentage (%)' : 'Amount (₦)'}</span>
        <input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-invalid={raw !== '' && (!numberOk || !fits)}
          className={cn(inputClass, raw !== '' && (!numberOk || !fits) && 'border-red-500')}
        />
        {raw !== '' && (
          <span className={cn('mt-1 block text-xs', numberOk && fits ? 'text-ink-subtle' : 'text-red-700')}>
            {!numberOk
              ? kind === 'percent'
                ? 'Enter a percentage between 0 and 100.'
                : 'Enter an amount above zero.'
              : !fits
                ? `That would take the invoice below zero — at most ${formatMoney(headroom)}.`
                : `Takes ${formatMoney(amount)} off the subtotal.`}
          </span>
        )}
      </label>
      <label className="block">
        <span className="text-ink text-sm font-medium">Reason (optional)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={80} className={inputClass} />
      </label>
      <FormButtons valid={valid} onCancel={() => onDone()} submit="Add discount" />
    </form>
  )
}

function AdjustmentForm({ headroom, onDone }: { headroom: number; onDone: (a?: DraftAdjustment) => void }) {
  const [label, setLabel] = useState('')
  const [direction, setDirection] = useState<'add' | 'reduce'>('add')
  const [raw, setRaw] = useState('')
  const value = Number(raw)
  const numberOk = raw.trim() !== '' && Number.isFinite(value) && value > 0
  const fits = direction === 'add' || value <= headroom
  const valid = label.trim() !== '' && numberOk && fits

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const amount = Math.round(value)
        onDone({ id: `a-${Date.now()}`, label: label.trim(), amount: direction === 'add' ? amount : -amount })
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">Description</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Extra weekend visit" className={inputClass} />
      </label>
      <fieldset>
        <legend className="text-ink text-sm font-medium">Direction</legend>
        <div className="mt-1.5 flex gap-4 text-sm">
          {(['add', 'reduce'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name="adjust-direction" checked={direction === k} onChange={() => setDirection(k)} className="accent-brand-600" />
              {k === 'add' ? 'Add a charge' : 'Reduce the total'}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-ink text-sm font-medium">Amount (₦)</span>
        <input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-invalid={raw !== '' && (!numberOk || !fits)}
          className={cn(inputClass, raw !== '' && (!numberOk || !fits) && 'border-red-500')}
        />
        {raw !== '' && (!numberOk || !fits) && (
          <span className="mt-1 block text-xs text-red-700">
            {!numberOk ? 'Enter an amount above zero.' : `That would take the invoice below zero — at most ${formatMoney(headroom)}.`}
          </span>
        )}
      </label>
      <FormButtons valid={valid} onCancel={() => onDone()} submit="Add adjustment" />
    </form>
  )
}

/* --------------------------------- step 3 ---------------------------------- */

function ServicesStep({
  account,
  recipientName,
  lines,
  excluded,
  period,
  onExclude,
  onPeriod,
}: {
  account: BillingAccount
  recipientName: string
  lines: BillableLine[]
  excluded: Set<string>
  period: Period
  onExclude: (ids: Set<string>) => void
  onPeriod: (period: Period) => void
}) {
  const { taxRatePercent } = useBillingSettings()
  const [changing, setChanging] = useState(false)
  const allRef = useRef<HTMLInputElement>(null)
  const chosen = lines.filter((l) => !excluded.has(l.id))
  const subtotal = chosen.reduce((sum, l) => sum + l.total, 0)
  const tax = Math.round((subtotal * taxRatePercent) / 100)
  const all = chosen.length === lines.length
  const none = chosen.length === 0

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = !all && !none
  }, [all, none])

  const toggle = (id: string) => {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onExclude(next)
  }

  return (
    <section aria-labelledby="step-services" className="card p-6 sm:p-8">
      <p className="text-brand-600 text-xs font-semibold tracking-wide uppercase">
        {account.name} <span aria-hidden="true">&gt;</span>
        <span className="sr-only">,</span> {recipientName}
      </p>
      <h2 id="step-services" className="text-ink mt-1 text-xl font-bold tracking-tight">
        Select Billable Services
      </h2>
      <p className="text-ink-muted mt-1 text-sm">
        Review care logs and tick the rendered services to include in this invoice billing cycle.
      </p>

      <div className="border-line bg-sunken/40 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Calendar className="text-brand-600 size-4.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-ink-muted">Billing Period Cycle:</span>
          <span className="text-ink font-semibold whitespace-nowrap">{periodLabel(period)}</span>
        </p>
        {changing ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Billing period</span>
            <SelectBox
              autoFocus
              value={period}
              onChange={(e) => {
                onPeriod(e.target.value)
                setChanging(false)
              }}
              onBlur={() => setChanging(false)}
              className="border-control bg-surface h-9 rounded-lg border px-2 text-sm"
            >
              {periodOptions().map((p) => (
                <option key={p} value={p}>
                  {periodLabel(p)}
                </option>
              ))}
            </SelectBox>
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="text-brand-600 hover:text-brand-700 text-sm font-semibold"
          >
            Change Period
          </button>
        )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="bg-sunken/60 text-ink-muted">
              <th scope="col" className="w-12 rounded-l-lg py-3 pl-3.5">
                <input
                  ref={allRef}
                  type="checkbox"
                  checked={all}
                  onChange={() => onExclude(all ? new Set(lines.map((l) => l.id)) : new Set())}
                  aria-label="Select all services"
                  className="accent-brand-600 size-4.5 align-middle"
                />
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">Service Rendered</th>
              <th scope="col" className="py-3 pr-4 text-center font-semibold whitespace-nowrap">Rate / Price</th>
              <th scope="col" className="py-3 pr-4 text-center font-semibold whitespace-nowrap">Hours/Qty</th>
              <th scope="col" className="rounded-r-lg py-3 pr-3.5 text-right font-semibold whitespace-nowrap">
                Total (₦)
              </th>
            </tr>
          </thead>
          <tbody className="divide-line border-line divide-y border-b">
            {lines.map((l) => {
              const on = !excluded.has(l.id)
              return (
                <tr key={l.id} className={cn(!on && 'opacity-60')}>
                  <td className="py-3.5 pl-3.5">
                    <input
                      id={`svc-${l.id}`}
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(l.id)}
                      className="accent-brand-600 size-4.5 align-middle"
                    />
                  </td>
                  <td className="py-3.5 pr-4">
                    <label htmlFor={`svc-${l.id}`} className="cursor-pointer">
                      <span className="text-ink block font-semibold">{l.label}</span>
                      <span className="text-ink-subtle block text-xs">{l.detail}</span>
                    </label>
                  </td>
                  <td className="text-ink py-3.5 pr-4 text-center whitespace-nowrap tabular-nums">
                    {rateLabel(l, formatMoney)}
                  </td>
                  <td className="text-ink py-3.5 pr-4 text-center whitespace-nowrap">{quantityLabel(l)}</td>
                  <td className="text-ink py-3.5 pr-3.5 text-right font-bold whitespace-nowrap tabular-nums">
                    {formatMoney(l.total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dl className="bg-brand-50 mt-6 rounded-xl px-5 py-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Selected Items Subtotal</dt>
          <dd className="text-ink font-semibold tabular-nums">{formatMoney(subtotal)}</dd>
        </div>
        <div className="border-line mt-2 flex justify-between gap-4 border-b pb-3">
          <dt className="text-ink-muted">VAT / Tax ({taxRatePercent}%)</dt>
          <dd className="text-ink font-semibold tabular-nums">{formatMoney(tax)}</dd>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <dt className="text-brand-600 text-base font-bold">Running Total Amount</dt>
          <dd className="text-brand-600 text-xl font-bold tabular-nums" aria-live="polite">
            {formatMoney(subtotal + tax)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/* --------------------------------- step 2 ---------------------------------- */

const recipientStatusText: Record<RecipientStatus, string> = {
  active: 'Active Recipient',
  'on-hold': 'On Hold',
  new: 'New Recipient',
  discharged: 'Discharged',
}

function RecipientStep({
  account,
  people,
  selected,
  onChoose,
}: {
  account: BillingAccount
  people: AccountRecipient[]
  selected: AccountRecipient | undefined
  onChoose: (key: string) => void
}) {
  const name = useId()
  return (
    <section aria-labelledby="step-recipient" className="card p-6 sm:p-8">
      <p className="text-brand-600 text-xs font-semibold tracking-wide uppercase">
        Billing Account: {account.name} Account
      </p>
      <h2 id="step-recipient" className="text-ink mt-1 text-xl font-bold tracking-tight">
        Select Care Recipient
      </h2>
      <p className="text-ink-muted mt-1 text-sm">
        Choose the recipient connected to this account profile to gather their billable sessions.
      </p>

      {people.length === 0 ? (
        <p className="text-ink-muted mt-6 text-sm">No care recipient is linked to this account.</p>
      ) : (
        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">Care recipient</legend>
          {people.map((r) => {
            const on = r.key === selected?.key
            return (
              <label
                key={r.key}
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-xl border px-5 py-4 transition-colors',
                  'has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-2',
                  on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface hover:bg-sunken/50',
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={r.key}
                  checked={on}
                  onChange={() => onChoose(r.key)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border-2',
                    on ? 'border-brand-600' : 'border-ink-subtle',
                  )}
                >
                  {on && <span className="bg-brand-600 size-2.5 rounded-full" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block font-semibold', on ? 'text-ink' : 'text-ink-muted')}>{r.name}</span>
                  <span className={cn('mt-0.5 block text-sm', on ? 'text-ink-muted' : 'text-ink-subtle')}>
                    {r.service}
                    <span aria-hidden="true" className="mx-2">•</span>
                    <span className={cn(on && r.status === 'active' && 'font-medium text-emerald-600')}>
                      {recipientStatusText[r.status]}
                    </span>
                  </span>
                </span>
                <User
                  aria-hidden="true"
                  className={cn('size-5 shrink-0', on ? 'text-brand-600' : 'text-ink-subtle')}
                  strokeWidth={1.9}
                />
              </label>
            )
          })}
        </fieldset>
      )}

      {selected && (
        <div className="mt-6">
          <h3 className="text-ink-muted text-sm font-semibold">Service Details Preview</h3>
          <dl className="border-line bg-sunken/40 mt-3 rounded-xl border px-5">
            {[
              ['Care Plan Model', selected.carePlan],
              ['Assigned Caregiver', selected.caregiver],
              ['Key Billable Targets', selected.billable.join(', ')],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-line grid grid-cols-1 gap-1 border-b py-3.5 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-4"
              >
                <dt className="text-ink-muted text-sm font-semibold">{label}</dt>
                <dd className="text-ink text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}

/* --------------------------------- step 1 ---------------------------------- */

function AccountStep({
  account,
  onChoose,
}: {
  account: BillingAccount | undefined
  onChoose: (id: string) => void
}) {
  return (
    <section aria-labelledby="step-account" className="card p-6 sm:p-8">
      <h2 id="step-account" className="text-ink text-xl font-bold tracking-tight">
        Select Billing Account
      </h2>
      <p className="text-ink-muted mt-1 text-sm">
        Search and select the billing profile responsible for payment.
      </p>

      <div className="mt-6">
        <AccountCombobox selected={account} onChoose={onChoose} />
      </div>

      {account && <AccountPreview account={account} />}
    </section>
  )
}

/**
 * An ARIA 1.2 combobox: type to filter, arrows to move, Enter to choose,
 * Escape to close. A native select can't search 14 accounts by contact name.
 */
function AccountCombobox({
  selected,
  onChoose,
}: {
  selected: BillingAccount | undefined
  onChoose: (id: string) => void
}) {
  const id = useId()
  const listId = `${id}-list`
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)

  // Close on a click anywhere else.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    // Showing the chosen name is not a search for it.
    if (!needle || needle === selected?.name.toLowerCase()) return billingAccounts
    return billingAccounts.filter((a) =>
      [a.name, a.contact, a.ref, a.phone].some((f) => f.toLowerCase().includes(needle)),
    )
  }, [query, selected])

  const pick = (a: BillingAccount) => {
    onChoose(a.id)
    setQuery(a.name)
    setOpen(false)
  }

  return (
    <div ref={wrap} className="relative">
      <label htmlFor={id} className="text-ink text-sm font-semibold">
        Search account profile
      </label>
      <div className="relative mt-1.5">
        <Search
          aria-hidden="true"
          className="text-brand-600 pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2"
          strokeWidth={2}
        />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${matches[active].id}` : undefined}
          autoComplete="off"
          placeholder="Account name, contact, ID or phone"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((i) => Math.min(i + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && open && matches[active]) {
              e.preventDefault()
              pick(matches[active])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          className="border-brand-500 bg-surface h-12 w-full rounded-lg border-2 pr-10 pl-10 text-sm focus:outline-none"
        />
        <ChevronDown
          aria-hidden="true"
          className="text-ink-muted pointer-events-none absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2"
        />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Billing accounts"
          className="card absolute z-20 mt-1 max-h-72 w-full overflow-y-auto py-1 shadow-lg"
        >
          {matches.length === 0 && (
            <li className="text-ink-muted px-4 py-3 text-sm">No account matches “{query}”.</li>
          )}
          {matches.map((a, i) => (
            <li
              key={a.id}
              id={`${id}-${a.id}`}
              role="option"
              aria-selected={a.id === selected?.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(a)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm',
                i === active && 'bg-sunken',
              )}
            >
              <span className="min-w-0">
                <span className="text-ink block truncate font-medium">{a.name}</span>
                <span className="text-ink-subtle block truncate text-xs">
                  {a.ref} · {a.contact}
                </span>
              </span>
              {a.id === selected?.id && <Check className="text-brand-600 size-4 shrink-0" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AccountPreview({ account }: { account: BillingAccount }) {
  const summary = summariseAccount(account)
  const lastInvoice = accountStatement(account).find((l) => l.kind === 'invoice')
  const cardBilled = Boolean(account.subscription && !account.subscription.invoiceBilled)
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Primary contact', value: account.contact },
    {
      label: 'Outstanding balance',
      value: (
        <span className={summary.outstanding > 0 ? 'text-red-700' : undefined}>
          {formatMoney(summary.outstanding)}
        </span>
      ),
    },
    {
      label: 'Last invoice',
      value: lastInvoice ? (
        <Link to={`/billing/invoices/${lastInvoice.ref}`} className="text-brand-700 hover:text-brand-800">
          {lastInvoice.ref} ({statementStatusLabels[lastInvoice.status]})
        </Link>
      ) : (
        'None on record'
      ),
    },
    {
      label: 'Contact email',
      value: (
        <span className="block truncate" title={account.email}>
          {account.email}
        </span>
      ),
    },
    { label: 'Contact phone', value: account.phone },
    { label: 'Branch', value: account.branch },
  ]

  return (
    <div className="mt-6">
      <h3 className="text-ink text-sm font-semibold">Account details</h3>
      <div className="border-brand-200 bg-brand-50/40 mt-2 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={account.name} decorative className="bg-brand-600 size-12 text-base text-white" />
            <div>
              <p className="text-ink text-lg font-semibold">{account.name}</p>
              <p className="text-ink-muted text-xs">ID: {account.ref}</p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
              tonePill[accountStatusTones[summary.status]],
            )}
          >
            {accountStatusLabels[summary.status]} account
          </span>
        </div>

        <dl className="border-line mt-4 grid grid-cols-1 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-ink-subtle text-xs font-medium tracking-wider uppercase">{f.label}</dt>
              <dd className="text-ink mt-1 text-sm font-medium break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Invoicing either of these is allowed, but it is rarely what is meant. */}
      {cardBilled && (
        <Warning>
          This account pays by {account.subscription?.cycle.toLowerCase()} card renewal. An invoice would be
          billed on top of the renewal.
        </Warning>
      )}
      {summary.status === 'inactive' && (
        <Warning>This account is inactive — its subscription is paused or cancelled.</Warning>
      )}
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
