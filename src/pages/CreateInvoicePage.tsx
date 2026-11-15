/**
 * Create Invoice wizard, driven live off the backend
 * (`src/features/billing/useCreateInvoice.ts`). The wizard is entered with
 * ?account=:id (a uuid) and keeps its place (account, recipient, period, step,
 * created invoice) in the URL. Every figure is server computed: the billable
 * lines are prefilled from the recipient's rendered services, the totals come
 * from POST /compute-totals, and the invoice is created with POST /invoices.
 *
 * What changed from the old mock wizard, and why: the old step 4 was a client
 * side discount and adjustment builder over fixtures. The backend owns totals, so
 * step 4 here is the authoritative server computed review; discounts and
 * adjustments are a future addition (the compute and create endpoints accept them,
 * but no UI drives them yet). Account search by free text is dropped: the wizard
 * needs the account id in the URL (there is no account picker endpoint that fits
 * the old combobox), so it opens straight on the account preview. Money is shown
 * in the invoice currency, no symbol hardcoded.
 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Loader2, User, X } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Avatar } from '@/components/ui/Avatar'
import {
  formatCurrency,
  useAccountPreview,
  useAccountRecipients,
  useComputeTotals,
  useCreateInvoice,
  useRecipientPreview,
  useRenderedServices,
  useSendCreatedInvoice,
} from '@/features/billing/useCreateInvoice'
import type {
  AccountPreviewDto,
  AccountRecipientDto,
  ComputeLine,
  InvoiceCreatedDto,
  RenderedServiceDto,
} from '@/features/billing/useCreateInvoice'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const steps = [
  'Billing Account',
  'Recipient',
  'Billable Services',
  'Review & Confirm',
  'Send Invoice',
] as const

/** Only a path inside the app is honoured as the way back. */
function safeReturn(from: string | null): string {
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/billing'
}

/** The first and last day of the given YYYY-MM month, as ISO dates. */
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from, to }
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return monthFormat.format(new Date(Date.UTC(y, m - 1, 1)))
}

/** The last twelve months, newest first, as YYYY-MM. */
function recentMonths(): string[] {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

export function CreateInvoicePage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const accountId = params.get('account') ?? ''
  const recipientId = params.get('recipient') ?? ''
  const month = params.get('period') ?? recentMonths()[0]
  const requested = Number(params.get('step') ?? '1')

  const account = useAccountPreview(accountId || undefined)
  const recipients = useAccountRecipients(accountId || undefined)
  const currency = account.data?.currency ?? 'NGN'
  const period = monthRange(month)
  const rendered = useRenderedServices(recipientId || undefined, period, currency)

  // Everything is ticked until it is unticked; the address holds the exceptions.
  const excluded = new Set((params.get('exclude') ?? '').split(',').filter(Boolean))
  const lines = rendered.data?.services ?? []
  const chosen = lines.filter((l) => !excluded.has(l.id))
  const computeLines: ComputeLine[] = chosen.map((l) => ({ serviceId: l.id, quantity: l.suggestedQuantity }))

  const [created, setCreated] = useState<InvoiceCreatedDto | null>(null)

  // Steps past the data they need are clamped back.
  const step = !accountId
    ? 1
    : Math.min(Math.max(1, requested || 1), created ? steps.length : steps.length - 1)
  const back = safeReturn(params.get('from'))

  const patch = (entries: Record<string, string | null>, replace = true) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(entries)) {
      if (v === null || v === '') p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace })
  }

  const go = (next: number) => patch({ step: String(next) }, false)
  const toggle = (id: string) => {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    patch({ exclude: [...next].join(',') })
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
                          current ? 'bg-brand-600 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-sunken text-ink-muted',
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : n}
                      </span>
                      <span className={cn(!current && 'sr-only 2xl:not-sr-only')}>{label}</span>
                      {done && <span className="sr-only"> (done)</span>}
                    </span>
                    {n < steps.length && <ChevronRight className="text-ink-subtle size-4" strokeWidth={2} aria-hidden="true" />}
                  </li>
                )
              })}
            </ol>
          </nav>

          <Link to={back} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800">
            <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Cancel
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:px-8">
        <div className="w-full max-w-3xl">
          {!accountId ? (
            <NoAccount />
          ) : step === 1 ? (
            <AccountStep query={account} />
          ) : step === 2 ? (
            <RecipientStep
              query={recipients}
              selectedId={recipientId}
              onChoose={(id) => patch({ recipient: id, exclude: null })}
            />
          ) : step === 3 ? (
            <ServicesStep
              query={rendered}
              month={month}
              excluded={excluded}
              currency={currency}
              onToggle={toggle}
              onMonth={(next) => patch({ period: next, exclude: null })}
            />
          ) : step === 4 ? (
            <ReviewStep currency={currency} lines={computeLines} chosen={chosen} />
          ) : created ? (
            <DoneStep invoice={created} backTo={back} />
          ) : null}
        </div>
      </main>

      {step < steps.length && accountId && (
        <WizardFooter
          step={step}
          back={back}
          canContinue={
            (step === 1 && Boolean(account.data)) ||
            (step === 2 && Boolean(recipientId)) ||
            (step >= 3 && computeLines.length > 0)
          }
          isLast={step === steps.length - 1}
          currency={currency}
          recipientId={recipientId}
          period={period}
          lines={computeLines}
          onBack={() => (step === 1 ? navigate(back) : go(step - 1))}
          onNext={() => go(step + 1)}
          onCreated={(invoice) => {
            setCreated(invoice)
            patch({ step: String(steps.length), invoice: invoice.id })
          }}
        />
      )}
    </div>
  )
}

/* --------------------------------- footer ---------------------------------- */

function WizardFooter({
  step,
  back,
  canContinue,
  isLast,
  currency,
  recipientId,
  period,
  lines,
  onBack,
  onNext,
  onCreated,
}: {
  step: number
  back: string
  canContinue: boolean
  isLast: boolean
  currency: string
  recipientId: string
  period: { from: string; to: string }
  lines: ComputeLine[]
  onBack: () => void
  onNext: () => void
  onCreated: (invoice: InvoiceCreatedDto) => void
}) {
  const create = useCreateInvoice()

  const submit = () => {
    create.mutate(
      { careRecipientId: recipientId, periodStart: period.from, periodEnd: period.to, currency, lines },
      { onSuccess: onCreated },
    )
  }

  return (
    <footer className="border-line bg-surface border-t">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <button type="button" onClick={onBack} className="text-ink-muted hover:text-ink text-sm font-semibold">
          {step === 1 ? 'Cancel Wizard' : 'Back'}
        </button>
        {create.isError && (
          <p role="alert" className="text-sm text-red-700">{create.error.message}</p>
        )}
        <button
          type="button"
          disabled={!canContinue || create.isPending}
          onClick={() => (isLast ? submit() : onNext())}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition-colors"
        >
          {create.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
          {isLast ? 'Create Invoice' : `Continue to ${steps[step]}`}
        </button>
      </div>
      <span className="sr-only">{back}</span>
    </footer>
  )
}

/* ------------------------------ query states ------------------------------- */

function Loading() {
  return (
    <div className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      Loading…
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-ink text-sm font-medium">Could not load this step.</p>
      <p className="text-ink-subtle text-sm">{message}</p>
      <button type="button" onClick={onRetry} className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white">
        Try again
      </button>
    </div>
  )
}

function NoAccount() {
  return (
    <section className="card p-6 text-center sm:p-8">
      <h2 className="text-ink text-xl font-bold tracking-tight">No billing account selected</h2>
      <p className="text-ink-muted mt-1 text-sm">
        Open the Create Invoice wizard from a billing account to begin.
      </p>
      <Link to="/billing/accounts" className="bg-brand-600 hover:bg-brand-700 mt-6 inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-white">
        Go to billing accounts
      </Link>
    </section>
  )
}

/* --------------------------------- step 1 ---------------------------------- */

function AccountStep({ query }: { query: ReturnType<typeof useAccountPreview> }) {
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorCard message={query.error.message} onRetry={() => void query.refetch()} />
  return <AccountPreview account={query.data} />
}

function AccountPreview({ account }: { account: AccountPreviewDto }) {
  const currency = account.currency ?? 'NGN'
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Primary contact', value: account.primaryContactName },
    {
      label: 'Outstanding balance',
      value: (
        <span className={account.outstandingBalanceMinor > 0 ? 'text-red-700' : undefined}>
          {formatCurrency(account.outstandingBalanceMinor, currency)}
        </span>
      ),
    },
    { label: 'Last invoice', value: account.lastInvoiceNumber ? `${account.lastInvoiceNumber} (${account.lastInvoiceStatus ?? '—'})` : 'None on record' },
    { label: 'Contact email', value: account.contactEmail ?? '—' },
    { label: 'Contact phone', value: account.contactPhone ?? '—' },
    { label: 'Billing address', value: account.billingAddress ?? '—' },
  ]

  return (
    <section className="card p-6 sm:p-8">
      <h2 className="text-ink text-xl font-bold tracking-tight">Billing Account</h2>
      <p className="text-ink-muted mt-1 text-sm">The account responsible for payment.</p>

      <div className="border-brand-200 bg-brand-50/40 mt-6 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={account.name} decorative className="bg-brand-600 size-12 text-base text-white" />
            <div>
              <p className="text-ink text-lg font-semibold">{account.name}</p>
              <p className="text-ink-muted text-xs">ID: {account.accountNumber}</p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {account.status}
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
    </section>
  )
}

/* --------------------------------- step 2 ---------------------------------- */

function RecipientStep({
  query,
  selectedId,
  onChoose,
}: {
  query: ReturnType<typeof useAccountRecipients>
  selectedId: string
  onChoose: (id: string) => void
}) {
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorCard message={query.error.message} onRetry={() => void query.refetch()} />
  const people = query.data
  const selected = people.find((r) => r.id === selectedId)

  return (
    <section className="card p-6 sm:p-8">
      <h2 className="text-ink text-xl font-bold tracking-tight">Select Care Recipient</h2>
      <p className="text-ink-muted mt-1 text-sm">
        Choose the recipient connected to this account to gather their billable sessions.
      </p>

      {people.length === 0 ? (
        <p className="text-ink-muted mt-6 text-sm">No care recipient is linked to this account.</p>
      ) : (
        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">Care recipient</legend>
          {people.map((r) => {
            const on = r.id === selectedId
            return (
              <label
                key={r.id}
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-xl border px-5 py-4 transition-colors',
                  'has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-2',
                  on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface hover:bg-sunken/50',
                )}
              >
                <input type="radio" name="recipient" value={r.id} checked={on} onChange={() => onChoose(r.id)} className="sr-only" />
                <span
                  aria-hidden="true"
                  className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2', on ? 'border-brand-600' : 'border-ink-subtle')}
                >
                  {on && <span className="bg-brand-600 size-2.5 rounded-full" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block font-semibold', on ? 'text-ink' : 'text-ink-muted')}>{r.name}</span>
                  <span className={cn('mt-0.5 block text-sm', on ? 'text-ink-muted' : 'text-ink-subtle')}>
                    {r.servicePlan ?? r.relationship}
                    <span aria-hidden="true" className="mx-2">•</span>
                    <span>{r.status}</span>
                  </span>
                </span>
                <User aria-hidden="true" className={cn('size-5 shrink-0', on ? 'text-brand-600' : 'text-ink-subtle')} strokeWidth={1.9} />
              </label>
            )
          })}
        </fieldset>
      )}

      {selected && <RecipientPreview recipient={selected} />}
    </section>
  )
}

function RecipientPreview({ recipient }: { recipient: AccountRecipientDto }) {
  const preview = useRecipientPreview(recipient.id)
  return (
    <div className="mt-6">
      <h3 className="text-ink-muted text-sm font-semibold">Service Details Preview</h3>
      <dl className="border-line bg-sunken/40 mt-3 rounded-xl border px-5">
        {[
          ['Care Plan Model', preview.data?.carePlanModel ?? recipient.servicePlan ?? '—'],
          [
            'Assigned Caregiver',
            preview.data?.assignedCaregiverName
              ? `${preview.data.assignedCaregiverName}${preview.data.assignedCaregiverTitle ? ` (${preview.data.assignedCaregiverTitle})` : ''}`
              : '—',
          ],
          ['Key Billable Targets', preview.data?.keyBillableTargets.join(', ') || '—'],
        ].map(([label, value]) => (
          <div key={label} className="border-line grid grid-cols-1 gap-1 border-b py-3.5 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-ink-muted text-sm font-semibold">{label}</dt>
            <dd className="text-ink text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* --------------------------------- step 3 ---------------------------------- */

function ServicesStep({
  query,
  month,
  excluded,
  currency,
  onToggle,
  onMonth,
}: {
  query: ReturnType<typeof useRenderedServices>
  month: string
  excluded: Set<string>
  currency: string
  onToggle: (id: string) => void
  onMonth: (month: string) => void
}) {
  const money = (minor: number) => formatCurrency(minor, currency)

  return (
    <section className="card p-6 sm:p-8">
      <h2 className="text-ink text-xl font-bold tracking-tight">Select Billable Services</h2>
      <p className="text-ink-muted mt-1 text-sm">
        Rendered services are prefilled from the recipient's completed visits over the period. Tick the ones to bill.
      </p>

      <div className="border-line bg-sunken/40 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Billing period:</span>
          <SelectBox value={month} onChange={(e) => onMonth(e.target.value)} className="border-control bg-surface h-9 rounded-lg border px-2 text-sm">
            {recentMonths().map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </SelectBox>
        </label>
      </div>

      {query.isPending ? (
        <div className="mt-6"><Loading /></div>
      ) : query.isError ? (
        <div className="mt-6"><ErrorCard message={query.error.message} onRetry={() => void query.refetch()} /></div>
      ) : query.data.services.length === 0 ? (
        <p className="text-ink-muted mt-6 text-sm">No billable services were rendered in {monthLabel(month)}.</p>
      ) : (
        <ServicesTable services={query.data.services} excluded={excluded} money={money} onToggle={onToggle} />
      )}
    </section>
  )
}

function ServicesTable({
  services,
  excluded,
  money,
  onToggle,
}: {
  services: RenderedServiceDto[]
  excluded: Set<string>
  money: (minor: number) => string
  onToggle: (id: string) => void
}) {
  const chosen = services.filter((l) => !excluded.has(l.id))
  const subtotal = chosen.reduce((sum, l) => sum + l.amountMinor, 0)

  return (
    <>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="bg-sunken/60 text-ink-muted">
              <th scope="col" className="w-12 rounded-l-lg py-3 pl-3.5" />
              <th scope="col" className="py-3 pr-4 font-semibold">Service Rendered</th>
              <th scope="col" className="py-3 pr-4 text-center font-semibold whitespace-nowrap">Rate</th>
              <th scope="col" className="py-3 pr-4 text-center font-semibold whitespace-nowrap">Qty</th>
              <th scope="col" className="rounded-r-lg py-3 pr-3.5 text-right font-semibold whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody className="divide-line border-line divide-y border-b">
            {services.map((l) => {
              const on = !excluded.has(l.id)
              return (
                <tr key={l.id} className={cn(!on && 'opacity-60')}>
                  <td className="py-3.5 pl-3.5">
                    <input id={`svc-${l.id}`} type="checkbox" checked={on} onChange={() => onToggle(l.id)} className="accent-brand-600 size-4.5 align-middle" />
                  </td>
                  <td className="py-3.5 pr-4">
                    <label htmlFor={`svc-${l.id}`} className="cursor-pointer">
                      <span className="text-ink block font-semibold">{l.name}</span>
                      <span className="text-ink-subtle block text-xs">
                        {l.description}
                        {l.sourceVisitCount > 0 && ` · ${l.sourceVisitCount} visit${l.sourceVisitCount === 1 ? '' : 's'}`}
                      </span>
                    </label>
                  </td>
                  <td className="text-ink py-3.5 pr-4 text-center whitespace-nowrap tabular-nums">
                    {l.rateMinor === null ? '—' : money(l.rateMinor)}
                  </td>
                  <td className="text-ink py-3.5 pr-4 text-center whitespace-nowrap tabular-nums">{l.suggestedQuantity}</td>
                  <td className="text-ink py-3.5 pr-3.5 text-right font-bold whitespace-nowrap tabular-nums">{money(l.amountMinor)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dl className="bg-brand-50 mt-6 rounded-xl px-5 py-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-brand-600 text-base font-bold">Selected Items Subtotal</dt>
          <dd className="text-brand-600 text-xl font-bold tabular-nums">{money(subtotal)}</dd>
        </div>
        <p className="text-ink-muted mt-1 text-xs">Tax and the final total are computed on the next step.</p>
      </dl>
    </>
  )
}

/* --------------------------------- step 4 ---------------------------------- */

function ReviewStep({
  currency,
  lines,
  chosen,
}: {
  currency: string
  lines: ComputeLine[]
  chosen: RenderedServiceDto[]
}) {
  const totals = useComputeTotals(currency, lines)
  const money = (minor: number) => formatCurrency(minor, currency)

  return (
    <section className="card p-6 sm:p-8">
      <h2 className="text-ink text-xl font-bold tracking-tight">Review Invoice Details</h2>
      <p className="text-ink-muted mt-1 text-sm">
        Verify the lines and the server computed totals before creating the invoice.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="bg-sunken/60 text-ink-muted text-xs uppercase">
              <th scope="col" className="rounded-l-lg py-3 pl-4 font-semibold">Service</th>
              <th scope="col" className="py-3 pr-4 text-center font-semibold">Qty</th>
              <th scope="col" className="rounded-r-lg py-3 pr-4 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {chosen.map((l) => (
              <tr key={l.id}>
                <td className="py-4 pl-4">
                  <span className="text-ink block font-semibold">{l.name}</span>
                  <span className="text-ink-muted block text-xs">{l.description}</span>
                </td>
                <td className="text-ink py-4 pr-4 text-center whitespace-nowrap">{l.suggestedQuantity}</td>
                <td className="text-ink py-4 pr-4 text-right font-bold whitespace-nowrap tabular-nums">{money(l.amountMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totals.isPending ? (
        <div className="mt-5"><Loading /></div>
      ) : totals.isError ? (
        <div className="mt-5"><ErrorCard message={totals.error.message} onRetry={() => void totals.refetch()} /></div>
      ) : (
        <dl className="border-line bg-sunken/30 mt-5 space-y-2.5 rounded-xl border px-5 py-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="text-ink font-semibold tabular-nums">{money(totals.data.subtotalMinor)}</dd>
          </div>
          {totals.data.discounts.map((d, i) => (
            <div key={i} className="flex justify-between gap-4">
              <dt className="text-ink-muted">{d.label}</dt>
              <dd className="font-semibold text-red-600 tabular-nums">−{money(d.amountMinor)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">VAT ({totals.data.taxRatePercent}%)</dt>
            <dd className="text-ink font-semibold tabular-nums">{money(totals.data.vatMinor)}</dd>
          </div>
          <div className="border-line flex items-center justify-between gap-4 border-t pt-3.5">
            <dt className="text-ink font-bold">Total Invoice Amount</dt>
            <dd className="text-brand-600 text-xl font-bold tabular-nums sm:text-2xl">{money(totals.data.totalMinor)}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}

/* --------------------------------- step 5 ---------------------------------- */

function DoneStep({ invoice, backTo }: { invoice: InvoiceCreatedDto; backTo: string }) {
  const send = useSendCreatedInvoice()
  const money = (minor: number) => formatCurrency(minor, invoice.currency)
  const due = new Date(`${invoice.dueDate}T00:00:00Z`)
  const dueLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(due)

  return (
    <section className="card mx-auto max-w-lg p-6 text-center sm:p-10">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50">
        <Check className="size-7 text-emerald-600" strokeWidth={2} aria-hidden="true" />
      </span>
      <h2 className="text-ink mt-5 text-2xl font-bold tracking-tight">Invoice Created Successfully</h2>
      <p className="text-ink-muted mt-1.5 text-sm">Invoice {invoice.invoiceNumber} has been generated and logged.</p>

      <dl className="bg-sunken/60 mt-6 space-y-2.5 rounded-xl px-5 py-4 text-left text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Due Date</dt>
          <dd className="text-ink font-semibold">{dueLabel}</dd>
        </div>
        <div className="border-line flex items-center justify-between gap-4 border-t pt-3">
          <dt className="text-ink font-semibold">Total Amount Due</dt>
          <dd className="text-brand-600 text-lg font-bold tabular-nums">{money(invoice.totalMinor)}</dd>
        </div>
      </dl>

      <div className="mt-6 space-y-3">
        <Link
          to={`/billing/invoices/${invoice.id}`}
          className="bg-brand-600 hover:bg-brand-700 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white"
        >
          View Invoice
        </Link>
        {send.isSuccess ? (
          <p role="status" className="flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300 text-sm font-semibold text-emerald-700">
            <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Invoice sent
          </p>
        ) : (
          <button
            type="button"
            disabled={send.isPending}
            onClick={() => send.mutate(invoice.id)}
            className="border-brand-500 text-brand-600 hover:bg-brand-50 disabled:border-line disabled:text-ink-subtle flex h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold"
          >
            {send.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
            Send to Client
          </button>
        )}
        {send.isError && <p className="text-xs text-red-700">{send.error.message}</p>}
      </div>

      <div className="border-line mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t pt-5 text-sm font-semibold">
        <Link to={backTo} className="text-ink-muted hover:text-ink">Back to Billing</Link>
      </div>
    </section>
  )
}
