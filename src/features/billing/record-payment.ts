/**
 * Recording a payment received against an invoice.
 *
 * The book settles an invoice whole — it records when it was paid, not how
 * much has come in so far — so a payment here is for the full balance. It
 * becomes a succeeded transaction referencing the invoice, exactly like the
 * settlements already in the log, and the invoice is marked paid that day.
 */
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import { transactions } from './data'
import type { Transaction } from './data'
import { balanceOf, getInvoice, ledger, payerName } from './ledger'
import type { LedgerInvoice } from './ledger'
import { bookChanged } from './book'

export type PaymentMethodName = 'Bank Transfer' | 'Card Payment' | 'Cash Payment' | 'Mobile Money'

/** Invoices with something still to pay, oldest first. */
export function payableInvoices(accountId?: string, today = TODAY): LedgerInvoice[] {
  return ledger
    .filter(
      (i) =>
        i.kind === 'invoice' &&
        i.issuedAt <= today &&
        (!accountId || i.accountId === accountId) &&
        balanceOf(i, today) > 0,
    )
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.number.localeCompare(b.number))
}

function nextTransactionId(today = TODAY): string {
  const year = today.slice(0, 4)
  const used = transactions
    .map((t) => t.id)
    .filter((id) => id.startsWith(`TX-${year}-`))
    .map((id) => Number(id.split('-')[2]))
    .filter(Number.isFinite)
  return `TX-${year}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`
}

export interface PaymentInput {
  invoice: string
  method: PaymentMethodName
  /** ISO. On or after the issue date, not after today. */
  at: string
  externalRef?: string
  bank?: string
  note?: string
}

export function recordPayment(input: PaymentInput, today = TODAY): Transaction | undefined {
  const invoice = getInvoice(input.invoice)
  if (!invoice || input.at > today || input.at < invoice.issuedAt) return undefined
  const amount = balanceOf(invoice, today)
  if (amount <= 0) return undefined

  const tx: Transaction = {
    id: nextTransactionId(today),
    client: payerName(invoice.accountId) ?? invoice.account,
    amount,
    // "Bank transfer" is how the log already writes it, and what the method
    // columns key on.
    method: input.method === 'Bank Transfer' ? 'Bank transfer' : input.method,
    status: 'succeeded',
    at: input.at,
    reference: input.externalRef ? `${invoice.number} · ${input.externalRef}` : invoice.number,
    bank: input.bank || undefined,
    note: input.note || undefined,
    recordedBy: SIGNED_IN,
  }
  transactions.unshift(tx)
  invoice.paidAt = input.at
  bookChanged()
  return tx
}
