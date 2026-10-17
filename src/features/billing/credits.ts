/**
 * Raising a credit against an open invoice.
 *
 * A credit starts pending and goes through the same approval as the credits
 * already on the Credits & Adjustments screen; approving applies it, and only
 * then does it come off the invoice's balance (`appliedAgainst`).
 */
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import { addAdjustment, allAdjustments, nextRef } from './adjustments'
import type { Adjustment } from './adjustments'
import { getAccount } from './accounts'
import { balanceOf, ledger } from './ledger'
import type { LedgerInvoice } from './ledger'

export const creditReasons = [
  'Service Resolution / Goodwill',
  'Missed or Shortened Visit',
  'Billing Error',
  'Other',
] as const
export type CreditReason = (typeof creditReasons)[number]

const creditType: Record<CreditReason, string> = {
  'Service Resolution / Goodwill': 'Goodwill credit',
  'Missed or Shortened Visit': 'Service credit',
  'Billing Error': 'Billing correction',
  Other: 'Credit',
}

/**
 * What can still be credited on an invoice: its balance less credits and
 * write-offs already waiting for approval, so approving them all never takes
 * it below zero.
 */
export function creditable(invoice: LedgerInvoice, today = TODAY): number {
  const pending = allAdjustments()
    .filter(
      (a) =>
        a.invoice === invoice.number &&
        a.status === 'pending' &&
        (a.kind === 'credit' || a.kind === 'write-off'),
    )
    .reduce((sum, a) => sum + a.amount, 0)
  return Math.max(0, balanceOf(invoice, today) - pending)
}

/** Invoices with something left to credit, oldest first. */
export function creditableInvoices(accountId?: string, today = TODAY): LedgerInvoice[] {
  return ledger
    .filter(
      (i) =>
        i.kind === 'invoice' &&
        i.issuedAt <= today &&
        (!accountId || i.accountId === accountId) &&
        creditable(i, today) > 0,
    )
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.number.localeCompare(b.number))
}

/** Accounts with at least one invoice left to credit, by name. */
export function creditableAccounts(today = TODAY) {
  const ids = [...new Set(creditableInvoices(undefined, today).map((i) => i.accountId))]
  return ids
    .flatMap((id) => {
      const a = getAccount(id)
      return a ? [a] : []
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function createCredit(input: {
  invoice: LedgerInvoice
  amount: number
  reason: CreditReason
  note: string
}): Adjustment | undefined {
  const { invoice, amount } = input
  if (!(amount > 0) || amount > creditable(invoice)) return undefined
  const credit: Adjustment = {
    ref: nextRef('CRD'),
    kind: 'credit',
    type: creditType[input.reason],
    accountId: invoice.accountId,
    invoice: invoice.number,
    amount,
    at: TODAY,
    status: 'pending',
    reason: input.note || input.reason,
    raisedBy: SIGNED_IN,
  }
  addAdjustment(credit)
  return credit
}
