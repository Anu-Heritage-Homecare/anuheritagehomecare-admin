/**
 * Voiding an invoice. From the day it is cancelled nothing is owed on it:
 * its balance is zero, it drops out of billed, outstanding and aging figures,
 * and its statement line reads Cancelled. It cannot be undone.
 */
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import { bookChanged } from './book'
import { getInvoice, isCancelled } from './ledger'
import type { LedgerInvoice } from './ledger'

export const cancelReasons = [
  'Billing Error',
  'Duplicate Invoice',
  'Service Not Delivered',
  'Client Request',
  'Other',
] as const
export type CancelReason = (typeof cancelReasons)[number]

/** Only an issued invoice that has not been paid or voided. */
export function canCancel(invoice: LedgerInvoice, today = TODAY): boolean {
  return (
    invoice.kind === 'invoice' &&
    invoice.issuedAt <= today &&
    !(invoice.paidAt && invoice.paidAt <= today) &&
    !isCancelled(invoice, today)
  )
}

export function cancelInvoice(number: string, reason: CancelReason, note: string, today = TODAY): boolean {
  const invoice = getInvoice(number)
  if (!invoice || !canCancel(invoice, today)) return false
  invoice.cancelled = { at: today, reason, note: note || undefined, by: SIGNED_IN }
  bookChanged()
  return true
}
