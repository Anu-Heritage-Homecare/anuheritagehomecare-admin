/**
 * Writing off what is left on an invoice. Confirmed by finance in the same
 * step, so it is applied at once — unlike the write-offs raised for approval
 * on the Credits & Adjustments screen — and, being final, it cannot be
 * reversed there.
 */
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import { addAdjustment, nextRef } from './adjustments'
import type { Adjustment } from './adjustments'
import { creditable } from './credits'
import { isCancelled, isDraft } from './ledger'
import type { LedgerInvoice } from './ledger'

export const writeOffReasons = [
  'Uncollectable Debt',
  'Bankruptcy / Insolvency',
  'Estate Settled',
  'Small Balance',
  'Other',
] as const
export type WriteOffReason = (typeof writeOffReasons)[number]

const writeOffType: Record<WriteOffReason, string> = {
  'Uncollectable Debt': 'Bad debt',
  'Bankruptcy / Insolvency': 'Insolvency',
  'Estate Settled': 'Estate settlement',
  'Small Balance': 'Small balance',
  Other: 'Write-off',
}

/** What would be written off: the balance less anything already awaiting approval. */
export function writeOffAmount(invoice: LedgerInvoice, today = TODAY): number {
  return creditable(invoice, today)
}

/** An issued, unvoided invoice with something left to write off. */
export function canWriteOff(invoice: LedgerInvoice, today = TODAY): boolean {
  return (
    invoice.kind === 'invoice' &&
    !isDraft(invoice) &&
    !isCancelled(invoice, today) &&
    writeOffAmount(invoice, today) > 0
  )
}

export function writeOff(
  invoice: LedgerInvoice,
  reason: WriteOffReason,
  note: string,
  today = TODAY,
): Adjustment | undefined {
  const amount = writeOffAmount(invoice, today)
  if (!canWriteOff(invoice, today) || !note.trim()) return undefined
  const entry: Adjustment = {
    ref: nextRef('WO'),
    kind: 'write-off',
    type: writeOffType[reason],
    accountId: invoice.accountId,
    invoice: invoice.number,
    amount,
    at: today,
    status: 'applied',
    reason: `${reason}. ${note.trim()}`,
    raisedBy: SIGNED_IN,
    decidedBy: SIGNED_IN,
    decidedAt: today,
    final: true,
  }
  addAdjustment(entry)
  return entry
}
