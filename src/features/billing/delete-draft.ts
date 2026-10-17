/**
 * Deleting a draft invoice. A draft (`isDraft`) has not been sent, paid or
 * adjusted, so nothing refers to it and it is removed from the book outright,
 * rather than cancelled and kept.
 */
import { bookChanged } from './book'
import { getInvoice, isDraft, ledger } from './ledger'

/** Deleted this session, number → account, so a page left open on one knows where to go. */
const deleted = new Map<string, string>()

export function deletedDraftAccount(number: string): string | undefined {
  return deleted.get(number)
}

export function deleteDraft(number: string): boolean {
  const invoice = getInvoice(number)
  if (!invoice || !isDraft(invoice)) return false
  deleted.set(number, invoice.accountId)
  ledger.splice(ledger.indexOf(invoice), 1)
  bookChanged()
  return true
}
