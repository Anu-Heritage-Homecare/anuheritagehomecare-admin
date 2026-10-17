/**
 * Payment reminders sent by hand. Nothing is emailed or texted from the
 * prototype: sending records when, how and by whom, which the invoice's
 * activity then shows.
 */
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import type { BillingAccount } from './accounts'
import { formatMoney } from './data'
import { bookChanged } from './book'
import { balanceOf, getInvoice, isCancelled, isDraft } from './ledger'
import type { LedgerInvoice } from './ledger'

export type Channel = 'Email' | 'SMS'

/** An issued invoice with something still owed. A draft is sent, not reminded. */
export function canRemind(invoice: LedgerInvoice, today = TODAY): boolean {
  return (
    invoice.kind === 'invoice' &&
    !isDraft(invoice) &&
    !isCancelled(invoice, today) &&
    balanceOf(invoice, today) > 0
  )
}

/** Days past the due date; negative while it is not yet due. */
export function daysOverdue(invoice: LedgerInvoice, today = TODAY): number {
  const ms = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${invoice.dueAt}T00:00:00Z`).getTime()
  return Math.round(ms / 86_400_000)
}

/** Where each channel would go, or undefined when the account has none. */
export function channelTargets(account: BillingAccount | undefined): Record<Channel, string | undefined> {
  const known = (v?: string) => (v && v !== 'Not recorded' ? v : undefined)
  return { Email: known(account?.email), SMS: known(account?.phone) }
}

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function reminderMessage(invoice: LedgerInvoice, account: BillingAccount | undefined, today = TODAY) {
  const amount = formatMoney(balanceOf(invoice, today))
  const late = daysOverdue(invoice, today)
  const when =
    late > 0
      ? `was due ${late} ${late === 1 ? 'day' : 'days'} ago`
      : late === 0
        ? 'is due today'
        : `is due on ${day.format(new Date(`${invoice.dueAt}T00:00:00Z`))}`
  return {
    subject: `Payment Reminder: Invoice ${invoice.number}`,
    body: `Dear ${account?.contact && account.contact !== 'Not recorded' ? account.contact : 'Customer'}, This is a friendly reminder that invoice ${invoice.number} for ${amount} ${when}. Please process the payment as soon as possible. Thank you for your continued support.`,
  }
}

export function sendReminder(number: string, via: Channel[], today = TODAY): boolean {
  const invoice = getInvoice(number)
  if (!invoice || via.length === 0 || !canRemind(invoice, today)) return false
  invoice.remindedAt = today
  invoice.remindedBy = SIGNED_IN
  invoice.remindedVia = via
  bookChanged()
  return true
}
