import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import type { BillingAccount } from './accounts'
import { formatMoney } from './data'
import { balanceOf } from './ledger'
import type { LedgerInvoice } from './ledger'
import { channelTargets, daysOverdue, reminderMessage, sendReminder } from './reminders'
import type { Channel } from './reminders'

export function SendReminderDialog({
  invoice,
  account,
  open,
  onClose,
}: {
  invoice: LedgerInvoice
  account: BillingAccount | undefined
  open: boolean
  onClose: () => void
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Send Payment Reminder" placement="center">
      {open && <ReminderForm invoice={invoice} account={account} onClose={onClose} />}
    </Drawer>
  )
}

function ReminderForm({
  invoice,
  account,
  onClose,
}: {
  invoice: LedgerInvoice
  account: BillingAccount | undefined
  onClose: () => void
}) {
  const targets = channelTargets(account)
  const channels = (['Email', 'SMS'] as Channel[]).filter((c) => targets[c])
  const [via, setVia] = useState<Channel[]>(channels)
  const late = daysOverdue(invoice)
  const message = reminderMessage(invoice, account)

  return (
    <div>
      <div className="space-y-5 p-5">
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-ink-muted text-xs">Invoice</dt>
            <dd className="text-ink mt-1 font-bold">{invoice.number}</dd>
          </div>
          <div>
            <dt className="text-ink-muted text-xs">Amount Due</dt>
            <dd className="text-ink mt-1 font-bold tabular-nums">{formatMoney(balanceOf(invoice))}</dd>
          </div>
          <div>
            <dt className="text-ink-muted text-xs">{late > 0 ? 'Days Overdue' : 'Due In'}</dt>
            <dd className={cn('mt-1 font-bold', late > 0 ? 'text-red-600' : 'text-ink')}>
              {late > 0 ? `${late} ${late === 1 ? 'day' : 'days'}` : late === 0 ? 'Today' : `${-late} days`}
            </dd>
          </div>
        </dl>

        <fieldset>
          <legend className="text-ink-muted text-sm font-medium">Send via</legend>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {(['Email', 'SMS'] as Channel[]).map((c) => (
              <label
                key={c}
                title={targets[c] ?? `No ${c === 'Email' ? 'email address' : 'phone number'} on record`}
                className={cn('flex items-center gap-2 text-sm', targets[c] ? 'text-ink' : 'text-ink-subtle')}
              >
                <input
                  type="checkbox"
                  disabled={!targets[c]}
                  checked={via.includes(c)}
                  onChange={(e) => setVia(e.target.checked ? [...via, c] : via.filter((v) => v !== c))}
                  className="accent-brand-600 size-4.5"
                />
                {c}
              </label>
            ))}
          </div>
          {via.length > 0 && (
            <p className="text-ink-subtle mt-1.5 text-xs">To {via.map((c) => targets[c]).join(' and ')}</p>
          )}
        </fieldset>

        <div>
          <h3 className="text-ink-muted text-sm font-medium">Preview of Reminder Message</h3>
          <div className="border-line bg-sunken/40 mt-2 rounded-xl border px-4 py-3.5">
            <p className="text-ink text-sm font-semibold">Subject: {message.subject}</p>
            <p className="text-ink-muted mt-1.5 text-xs leading-relaxed">{message.body}</p>
          </div>
        </div>
      </div>

      <div className="border-line bg-sunken/40 flex justify-end gap-3 border-t px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={via.length === 0}
          onClick={() => {
            if (sendReminder(invoice.number, via)) onClose()
          }}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Send Reminder
        </button>
      </div>
    </div>
  )
}
