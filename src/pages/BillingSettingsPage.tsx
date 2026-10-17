import { useState } from 'react'
import {
  setMethod,
  setNotify,
  termsOptions,
  update,
  useBillingSettings,
  validPrefix,
} from '@/features/billing/settings'
import { Panel } from '@/components/ui/Panel'
import { Toggle } from '@/components/ui/Toggle'
import { Drawer } from '@/components/ui/Drawer'
import type { MethodId, PaymentMethodSetting } from '@/features/billing/settings'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-11 w-full rounded-lg border px-3 text-sm'

/** "7.5%", "7.5" or " 7.5 % " → 7.5; null when not a rate between 0 and 100. */
function parseTax(raw: string): number | null {
  const t = raw.trim().replace(/%$/, '').trim()
  const v = Number(t)
  return t !== '' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="text-ink text-sm font-medium">
      {children}
    </label>
  )
}

export function BillingSettingsPage() {
  const s = useBillingSettings()
  // Typed values are held locally and committed only when valid, so a
  // half-typed prefix never becomes the setting.
  const [prefix, setPrefix] = useState(s.invoicePrefix)
  const [tax, setTax] = useState(`${s.taxRatePercent}%`)
  const [editing, setEditing] = useState<MethodId | null>(null)
  const editingMethod = s.methods.find((m) => m.id === editing)
  const prefixOk = validPrefix(prefix)
  const taxValue = parseTax(tax)
  const taxOk = taxValue !== null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">Billing Settings</h1>
        <p className="text-ink-muted mt-1 text-sm">Configure billing preferences and automation</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Invoice Settings" description="Configure defaults and layout options" titleClassName="text-base">
            <div className="space-y-5">
              <div>
                <Label htmlFor="terms">Default Payment Terms</Label>
                <SelectBox
                  id="terms"
                  value={s.paymentTermsDays}
                  onChange={(e) => update({ paymentTermsDays: Number(e.target.value) })}
                  className={fieldClass}
                >
                  {termsOptions.map((d) => (
                    <option key={d} value={d}>
                      Net {d} Days
                    </option>
                  ))}
                </SelectBox>
              </div>

              <div>
                <Label htmlFor="prefix">Invoice Prefix</Label>
                <input
                  id="prefix"
                  value={prefix}
                  onChange={(e) => {
                    setPrefix(e.target.value)
                    if (validPrefix(e.target.value)) update({ invoicePrefix: e.target.value })
                  }}
                  aria-invalid={!prefixOk}
                  aria-describedby={prefixOk ? undefined : 'prefix-hint'}
                  className={cn(fieldClass, !prefixOk && 'border-red-500')}
                />
                {!prefixOk && (
                  <p id="prefix-hint" className="mt-1 text-xs text-red-700">
                    Use 1–8 letters, digits or dashes.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="currency">Default Currency</Label>
                {/* Naira is the only option: every amount in the book is
                    naira and the app has no currency conversion. */}
                <SelectBox id="currency" defaultValue="NGN" className={fieldClass}>
                  <option value="NGN">NGN (₦)</option>
                </SelectBox>
              </div>

              <div>
                <Label htmlFor="tax">Standard Tax Rate</Label>
                <input
                  id="tax"
                  inputMode="decimal"
                  value={tax}
                  onChange={(e) => {
                    setTax(e.target.value)
                    const v = parseTax(e.target.value)
                    if (v !== null) update({ taxRatePercent: v })
                  }}
                  aria-invalid={!taxOk}
                  aria-describedby={taxOk ? undefined : 'tax-hint'}
                  className={cn(fieldClass, !taxOk && 'border-red-500')}
                />
                {!taxOk && (
                  <p id="tax-hint" className="mt-1 text-xs text-red-700">
                    Enter a rate between 0 and 100.
                  </p>
                )}
              </div>

              <Toggle
                label="Auto-numbering"
                hint="Automatically increment invoice numbers"
                checked={s.autoNumbering}
                onChange={(v) => update({ autoNumbering: v })}
                labelClassName="font-medium"
              />
            </div>
          </Panel>

          <Panel title="Automation Settings" description="Configure reminders and triggers" titleClassName="text-base">
            <div className="space-y-5">
              <Toggle
                label="Auto-send invoices"
                hint="Email invoice immediately upon creation"
                checked={s.autoSendInvoices}
                onChange={(v) => update({ autoSendInvoices: v })}
                labelClassName="font-medium"
              />
              <Toggle
                label="Payment reminders"
                hint="Send automatic reminder 7 days before due date"
                checked={s.paymentReminders}
                onChange={(v) => update({ paymentReminders: v })}
                labelClassName="font-medium"
              />
              <Toggle
                label="Overdue notifications"
                hint="Notify family 1 day after invoice becomes overdue"
                checked={s.overdueNotifications}
                onChange={(v) => update({ overdueNotifications: v })}
                labelClassName="font-medium"
              />
              <Toggle
                label="Auto-receipts"
                hint="Generate and email receipt on payment confirmation"
                checked={s.autoReceipts}
                onChange={(v) => update({ autoReceipts: v })}
                labelClassName="font-medium"
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Payment Methods" description="Manage customer payment avenues" titleClassName="text-base">
            <ul className="divide-line divide-y">
              {s.methods.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">{m.label}</p>
                    <p className="text-ink-subtle text-xs">{m.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={cn('text-sm font-medium', m.enabled ? 'text-emerald-700' : 'text-ink-subtle')}>
                      {m.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditing(m.id)}
                      aria-label={`Edit ${m.label}`}
                      className="border-control text-ink hover:bg-sunken inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Notifications" description="Preferred communication channels" titleClassName="text-base">
            <div className="space-y-5">
              <Toggle
                label="Email notifications"
                hint="Send full billing statements and alerts"
                checked={s.notify.email}
                onChange={(v) => setNotify('email', v)}
                labelClassName="font-medium"
              />
              <Toggle
                label="SMS notifications"
                hint="Send critical overdue alerts via SMS"
                checked={s.notify.sms}
                onChange={(v) => setNotify('sms', v)}
                labelClassName="font-medium"
              />
              <Toggle
                label="In-app notifications"
                hint="Show activity stream flags inside console"
                checked={s.notify.inApp}
                onChange={(v) => setNotify('inApp', v)}
                labelClassName="font-medium"
              />
            </div>
          </Panel>
        </div>
      </div>

      <Drawer
        open={Boolean(editingMethod)}
        onClose={() => setEditing(null)}
        title="Edit payment method"
        subtitle={editingMethod?.label}
        placement="center"
      >
        {editingMethod && (
          <MethodForm key={editingMethod.id} method={editingMethod} onDone={() => setEditing(null)} />
        )}
      </Drawer>
    </div>
  )
}

/** Local draft; nothing changes until Save. */
function MethodForm({ method, onDone }: { method: PaymentMethodSetting; onDone: () => void }) {
  const [enabled, setEnabled] = useState(method.enabled)
  const [detail, setDetail] = useState(method.detail)
  const valid = detail.trim().length > 0

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setMethod(method.id, { enabled, detail: detail.trim() })
        onDone()
      }}
    >
      <Toggle
        label="Accept this method"
        hint={enabled ? 'Accounts can pay this way.' : 'Hidden from accounts; payments already made stay on record.'}
        checked={enabled}
        onChange={setEnabled}
        labelClassName="font-medium"
      />
      <label className="block">
        <span className="text-ink text-sm font-medium">Description</span>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={80}
          aria-invalid={!valid}
          className={cn(fieldClass, !valid && 'border-red-500')}
        />
        <span className={cn('mt-1 block text-xs', valid ? 'text-ink-subtle' : 'text-red-700')}>
          {valid ? 'Shown under the method name.' : 'Enter a short description.'}
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Save
        </button>
      </div>
    </form>
  )
}
