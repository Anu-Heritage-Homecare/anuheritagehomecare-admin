import { useState } from 'react'
import { Plus, SquarePen } from 'lucide-react'
import {
  addMethod,
  addTax,
  addTerm,
  parseRate,
  parseWhole,
  termExists,
  updateInvoice,
  useBillingPayments,
  validNumber,
  validPrefix,
} from '@/features/settings/billing-payments'
import type { InvoiceSettings } from '@/features/settings/billing-payments'
import { Drawer } from '@/components/ui/Drawer'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'

type Dialog = 'invoice' | 'tax' | 'method' | 'term' | null

function Card({
  title,
  action,
  children,
}: {
  title: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  const id = `billing-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="text-ink min-w-0 text-base font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** This screen draws its card actions filled, unlike the other sections. */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white transition-colors"
    >
      <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
      {label}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
      <dt className="text-ink-muted text-sm font-medium">{label}</dt>
      <dd className="text-ink text-sm">{children}</dd>
    </div>
  )
}

const itemClass = 'border-line flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5'

function ItemText({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="min-w-0">
      <p className="text-ink truncate text-sm font-semibold">{name}</p>
      <p className="text-ink-muted mt-0.5 truncate text-xs" title={detail}>
        {detail}
      </p>
    </div>
  )
}

export function BillingPaymentsSettingsPage() {
  const s = useBillingPayments()
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">Billing &amp; Payments</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Manage agency billing parameters, tax configuration, and payout setup.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Card
          title="Invoice Settings"
          action={
            <button
              type="button"
              onClick={() => setDialog('invoice')}
              className="border-control text-ink hover:bg-sunken inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
            >
              <SquarePen className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Edit Settings
            </button>
          }
        >
          <dl className="divide-line divide-y">
            <Row label="Invoice Prefix">
              <span className="font-bold">{s.invoice.prefix}</span>
            </Row>
            <Row label="Next Number">{s.invoice.nextNumber}</Row>
            <Row label="Due Period">
              {s.invoice.dueDays} {s.invoice.dueDays === 1 ? 'day' : 'days'}
            </Row>
            <div className="py-2.5">
              <Toggle
                label="Auto-generate Invoices"
                hint="Create billing automatically each month"
                checked={s.invoice.autoGenerate}
                onChange={(v) => updateInvoice({ autoGenerate: v })}
                className="items-center"
                labelClassName="text-ink-muted font-medium"
              />
            </div>
            <Row label="Include VAT in Pricing">
              <span className={cn('font-semibold', s.invoice.vatIncluded ? 'text-emerald-600' : 'text-ink-muted')}>
                {s.invoice.vatIncluded ? 'Yes' : 'No'}
              </span>
            </Row>
          </dl>
          <p
            role="status"
            className={cn(
              'mt-2 rounded-lg px-3 py-2.5 text-xs font-medium',
              s.invoice.autoGenerate ? 'bg-brand-50 text-brand-700' : 'bg-sunken text-ink-muted',
            )}
          >
            {s.invoice.autoGenerate
              ? 'Invoices will auto-generate on the 1st of each month'
              : 'Auto-generation is off; invoices are raised by hand'}
          </p>
        </Card>

        <Card title="Tax Configuration" action={<AddButton label="Add Tax" onClick={() => setDialog('tax')} />}>
          <ul className="space-y-3">
            {s.taxes.map((t) => (
              <li key={t.id} className={cn(itemClass, 'items-start')}>
                <ItemText name={`${t.name} ${t.ratePercent}%`} detail={t.description} />
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700">
                  Active
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Payment Methods" action={<AddButton label="Add Method" onClick={() => setDialog('method')} />}>
          <ul className="space-y-3">
            {s.methods.map((m) => (
              <li key={m.id} className={cn(itemClass, 'bg-canvas')}>
                <ItemText name={m.name} detail={m.detail} />
                <span className="text-brand-700 shrink-0 text-xs font-semibold">{m.status}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Payment Terms" action={<AddButton label="Add Term" onClick={() => setDialog('term')} />}>
          <ul className="space-y-3">
            {s.terms.map((t) => (
              <li key={t.id} className={itemClass}>
                <ItemText name={t.name} detail={t.detail} />
                {t.status === 'Default' ? (
                  <span className="bg-brand-50 text-brand-700 shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold">
                    Default
                  </span>
                ) : (
                  <span className="text-ink-muted shrink-0 text-xs">{t.status}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Drawer open={dialog === 'invoice'} onClose={close} title="Edit invoice settings" placement="center">
        <InvoiceForm invoice={s.invoice} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'tax'} onClose={close} title="Add tax" placement="center">
        <TaxForm onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'method'} onClose={close} title="Add payment method" placement="center">
        <MethodForm onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'term'} onClose={close} title="Add payment term" placement="center">
        <TermForm onDone={close} />
      </Drawer>
    </div>
  )
}

/* ---------------------------------- forms ---------------------------------- */
/* Each holds a local draft; nothing changes until it is submitted. */

function Text({
  label,
  value,
  onChange,
  error,
  suffix,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | false
  suffix?: string
  inputMode?: 'numeric' | 'decimal'
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(fieldClass, error && 'border-red-500')}
        />
        {suffix && <span className="text-ink-muted mt-1.5 shrink-0 text-sm">{suffix}</span>}
      </span>
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

function Actions({ onCancel, disabled, label }: { onCancel: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
      >
        {label}
      </button>
    </div>
  )
}

function InvoiceForm({ invoice, onDone }: { invoice: InvoiceSettings; onDone: () => void }) {
  const [prefix, setPrefix] = useState(invoice.prefix)
  const [nextNumber, setNextNumber] = useState(invoice.nextNumber)
  const [due, setDue] = useState(String(invoice.dueDays))
  const [vatIncluded, setVatIncluded] = useState(invoice.vatIncluded)
  const dueValue = parseWhole(due, 1, 365)
  const prefixOk = validPrefix(prefix)
  const numberOk = validNumber(nextNumber)
  const valid = prefixOk && numberOk && dueValue !== null

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || dueValue === null) return
        updateInvoice({ prefix, nextNumber, dueDays: dueValue, vatIncluded })
        onDone()
      }}
    >
      <Text label="Invoice prefix" value={prefix} onChange={setPrefix} error={!prefixOk && 'Use 1–8 letters, digits or dashes.'} />
      <Text label="Next number" value={nextNumber} onChange={setNextNumber} error={!numberOk && 'Use digits and dashes, e.g. 2026-0458.'} />
      <Text
        label="Due period"
        value={due}
        onChange={setDue}
        inputMode="numeric"
        suffix="days"
        error={dueValue === null && 'Enter a number of days from 1 to 365.'}
      />
      <Toggle
        label="Include VAT in pricing"
        hint={vatIncluded ? 'Prices are shown with VAT included.' : 'VAT is added on top of prices.'}
        checked={vatIncluded}
        onChange={setVatIncluded}
        labelClassName="font-medium"
      />
      <Actions onCancel={onDone} disabled={!valid} label="Save" />
    </form>
  )
}

function TaxForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [description, setDescription] = useState('')
  const rateValue = parseRate(rate)
  const valid = Boolean(name.trim() && description.trim()) && rateValue !== null

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || rateValue === null) return
        addTax({ name: name.trim(), ratePercent: rateValue, description: description.trim() })
        onDone()
      }}
    >
      <Text label="Tax name" value={name} onChange={setName} />
      <Text
        label="Rate"
        value={rate}
        onChange={setRate}
        inputMode="decimal"
        suffix="%"
        error={rate !== '' && rateValue === null && 'Enter a rate above 0 and up to 100.'}
      />
      <Text label="Applies to" value={description} onChange={setDescription} />
      <Actions onCancel={onDone} disabled={!valid} label="Add Tax" />
    </form>
  )
}

function MethodForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const valid = Boolean(name.trim() && detail.trim())

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        addMethod({ name: name.trim(), detail: detail.trim() })
        onDone()
      }}
    >
      <Text label="Method name" value={name} onChange={setName} />
      <Text label="Details" value={detail} onChange={setDetail} />
      <Actions onCancel={onDone} disabled={!valid} label="Add Method" />
    </form>
  )
}

function TermForm({ onDone }: { onDone: () => void }) {
  const [days, setDays] = useState('')
  const value = parseWhole(days, 1, 365)
  const taken = value !== null && termExists(value)
  const valid = value !== null && !taken

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || value === null) return
        addTerm(value)
        onDone()
      }}
    >
      <Text
        label="Days from issue date"
        value={days}
        onChange={setDays}
        inputMode="numeric"
        suffix="days"
        error={
          days === ''
            ? false
            : value === null
              ? 'Enter a number of days from 1 to 365.'
              : taken && `Net ${value} is already listed.`
        }
      />
      <p className="text-ink-muted text-xs">Listed as {value !== null ? `Net ${value}` : 'Net N'}.</p>
      <Actions onCancel={onDone} disabled={!valid} label="Add Term" />
    </form>
  )
}
