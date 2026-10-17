/**
 * Raising a refund against a payment that was received.
 *
 * A refund starts pending and goes through the same approval as the refunds
 * already on the Credits & Adjustments screen; approving sends it to
 * processing. It never changes a balance here — see `AdjustmentStatus`.
 */
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import { addAdjustment, allAdjustments, nextRef } from './adjustments'
import type { Adjustment } from './adjustments'
import type { Transaction } from './data'
import { accountOfTransaction, settledPayments } from './ledger'

export const refundReasons = [
  'Overpayment',
  'Duplicate payment',
  'Service not delivered',
  'Service cancelled',
  'Other',
] as const
export type RefundReason = (typeof refundReasons)[number]

export const refundMethods = ['Bank Transfer', 'Card Reversal', 'Cash', 'Mobile Money'] as const
export type RefundMethod = (typeof refundMethods)[number]

/** Already promised back on a payment: every refund not rejected. */
export function refundedOn(txId: string): number {
  return allAdjustments()
    .filter((a) => a.kind === 'refund' && a.txId === txId && a.status !== 'rejected')
    .reduce((sum, a) => sum + a.amount, 0)
}

export interface RefundablePayment {
  tx: Transaction
  accountId: string
  account: string
  /** What is left to refund. */
  available: number
}

/** Settled payments with something left to refund, newest first. */
export function refundablePayments(): RefundablePayment[] {
  return settledPayments().flatMap((tx) => {
    const account = accountOfTransaction(tx)
    const available = tx.amount - refundedOn(tx.id)
    return account && available > 0
      ? [{ tx, accountId: account.id, account: account.name, available }]
      : []
  })
}

export function createRefund(input: {
  payment: RefundablePayment
  amount: number
  method: RefundMethod
  reason: RefundReason
  note: string
}): Adjustment | undefined {
  const { payment, amount } = input
  if (!(amount > 0) || amount > payment.available) return undefined
  const refund: Adjustment = {
    ref: nextRef('REF'),
    kind: 'refund',
    type: input.reason === 'Other' ? 'Refund' : `${input.reason} refund`,
    accountId: payment.accountId,
    txId: payment.tx.id,
    amount,
    method: input.method,
    at: TODAY,
    status: 'pending',
    reason: input.note || input.reason,
    raisedBy: SIGNED_IN,
  }
  addAdjustment(refund)
  return refund
}
