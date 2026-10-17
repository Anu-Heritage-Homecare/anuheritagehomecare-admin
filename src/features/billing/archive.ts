/**
 * Archiving files an invoice away from the working Invoices list. It changes
 * nothing else: the invoice keeps its status, balance and place on its
 * account's statement, and restoring puts it back on the list.
 */
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import { bookChanged } from './book'
import { getInvoice } from './ledger'

export function archiveInvoice(number: string, today = TODAY): boolean {
  const invoice = getInvoice(number)
  if (!invoice || invoice.archivedAt) return false
  invoice.archivedAt = today
  invoice.archivedBy = SIGNED_IN
  bookChanged()
  return true
}

export function restoreInvoice(number: string): boolean {
  const invoice = getInvoice(number)
  if (!invoice?.archivedAt) return false
  invoice.archivedAt = undefined
  invoice.archivedBy = undefined
  bookChanged()
  return true
}
