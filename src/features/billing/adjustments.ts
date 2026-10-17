import { useSyncExternalStore } from 'react'
import { TODAY } from '@/lib/today'
import { SIGNED_IN } from '@/lib/session'
import { getAccount } from './accounts'
import type { Tone } from '@/types'

/* ---------------------------------- types --------------------------------- */

export type AdjustmentKind = 'credit' | 'refund' | 'write-off' | 'adjustment'
/**
 * `applied` moves a balance (credit, write-off, adjustment). A refund never
 * does here: approving one sends it to `processing`, and only the gateway
 * confirming it would make it `completed` — nothing in the prototype does.
 */
export type AdjustmentStatus =
  | 'pending'
  | 'applied'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'reversed'

export interface Adjustment {
  /** CRD- / REF- / WO- / ADJ-, one series per kind. */
  ref: string
  kind: AdjustmentKind
  /** The finer label the table shows, e.g. "Service credit". */
  type: string
  accountId: string
  /** The invoice it corrects, for credits, write-offs and adjustments. */
  invoice?: string
  /** The payment it returns, for refunds. */
  txId?: string
  /** Refunds raised in the app: how the money is to go back. */
  method?: string
  /** Confirmed by finance when raised; cannot be reversed. */
  final?: boolean
  /** Always positive; `kind` and `direction` say which way it moves the balance. */
  amount: number
  /**
   * Adjustments only: `increase` adds to the invoice (a missed charge),
   * `decrease` takes off it (a discount). Credits and write-offs always decrease.
   */
  direction?: 'increase' | 'decrease'
  /** ISO. When it was raised. */
  at: string
  status: AdjustmentStatus
  reason: string
  raisedBy: string
  /** Why it was turned down, when it was. */
  outcome?: string
  /** Who approved, rejected or reversed it this session, and when. */
  decidedBy?: string
  decidedAt?: string
}

export const kindLabels: Record<AdjustmentKind, { one: string; many: string }> = {
  credit: { one: 'Credit', many: 'Credits' },
  refund: { one: 'Refund', many: 'Refunds' },
  'write-off': { one: 'Write-off', many: 'Write-offs' },
  adjustment: { one: 'Adjustment', many: 'Adjustments' },
}

/** Pending and applied read differently per kind, as the designs label them. */
export function statusLabel(a: Pick<Adjustment, 'kind' | 'status'>): string {
  switch (a.status) {
    case 'pending':
      return a.kind === 'refund' || a.kind === 'write-off' ? 'Pending approval' : 'Pending'
    case 'applied':
      return a.kind === 'write-off' ? 'Approved' : 'Applied'
    case 'processing':
      return 'Processing'
    case 'completed':
      return 'Completed'
    case 'rejected':
      return 'Rejected'
    case 'reversed':
      return 'Reversed'
  }
}

export const statusTones: Record<AdjustmentStatus, Tone> = {
  pending: 'amber',
  applied: 'green',
  processing: 'blue',
  completed: 'green',
  rejected: 'slate',
  reversed: 'slate',
}

/** The statuses a kind can be in — the Status filter offers only these. */
export const statusesFor: Record<AdjustmentKind, AdjustmentStatus[]> = {
  credit: ['pending', 'applied', 'rejected', 'reversed'],
  refund: ['pending', 'processing', 'completed', 'rejected'],
  'write-off': ['pending', 'applied', 'rejected', 'reversed'],
  adjustment: ['pending', 'applied', 'rejected', 'reversed'],
}

/* ---------------------------------- data ---------------------------------- */

/*
 * Every entry points at a real invoice or payment in the book or the log, and
 * each reason agrees with what else is on file (the Musa dispute, the Bello
 * payment plan, the Eze reminder).
 *
 * Only an *applied credit or write-off* moves a balance — see `appliedAgainst`.
 * Refunds and rate adjustments here are all pending or rejected; applying one
 * would need the ledger to model money going back out, or an invoice amount
 * changing, and it models neither yet.
 */
const fixtures: Adjustment[] = [
  {
    ref: 'CRD-2026-001',
    kind: 'credit',
    type: 'Service credit',
    accountId: 'acc-musa',
    invoice: 'INV-2026-143',
    amount: 600,
    at: '2026-06-10',
    status: 'applied',
    reason: 'Visit log checked: 2 of the 18 visits billed for 1–15 May did not take place. Credited against the invoice.',
    raisedBy: 'Sarah Jenkins',
  },
  {
    ref: 'CRD-2026-002',
    kind: 'credit',
    type: 'Service credit',
    accountId: 'acc-eze',
    invoice: 'INV-2026-160',
    amount: 300,
    at: '2026-07-23',
    status: 'pending',
    reason: 'One visit on 9 Jul was cut short. Mrs. Eze raised it when reminded of the invoice.',
    raisedBy: 'Sarah Jenkins',
  },
  {
    ref: 'CRD-2026-003',
    kind: 'credit',
    type: 'Goodwill credit',
    accountId: 'acc-cr-001',
    invoice: 'INV-2026-089',
    amount: 240,
    at: '2026-07-18',
    status: 'rejected',
    reason: 'Requested for a late arrival on 3 Jul.',
    raisedBy: 'Sarah Jenkins',
    outcome: 'Visit started within the 15-minute window; no credit due.',
  },
  {
    ref: 'REF-2026-001',
    kind: 'refund',
    type: 'Renewal refund',
    accountId: 'acc-cr-007',
    txId: 'TX-2026-908',
    amount: 6600,
    at: '2026-07-24',
    status: 'pending',
    reason: 'Family asks whether the renewal can be refunded while they consider moving to invoice billing.',
    raisedBy: 'Sarah Jenkins',
  },
  {
    ref: 'REF-2026-002',
    kind: 'refund',
    type: 'Overpayment refund',
    accountId: 'acc-adeyemi',
    txId: 'TX-2026-897',
    amount: 300,
    at: '2026-07-12',
    status: 'rejected',
    reason: 'Account holder believed the transfer was one visit over.',
    raisedBy: 'Sarah Jenkins',
    outcome: 'Transfer matched INV-2026-157 exactly; nothing overpaid.',
  },
  {
    ref: 'WO-2026-001',
    kind: 'write-off',
    type: 'Bad debt',
    accountId: 'acc-bello',
    invoice: 'INV-2026-140',
    amount: 9000,
    at: '2026-07-21',
    status: 'pending',
    reason: 'Unpaid for over 90 days. Proposed alongside the payment plan letter sent the same day.',
    raisedBy: 'Sarah Jenkins',
  },
  {
    ref: 'ADJ-2026-001',
    kind: 'adjustment',
    type: 'Visit count correction',
    accountId: 'acc-babalola',
    invoice: 'INV-2026-162',
    amount: 600,
    direction: 'increase',
    at: '2026-07-22',
    status: 'pending',
    reason: 'Resident register shows 94 visits for 1–15 Jul against 92 invoiced; +₦600 to be added.',
    raisedBy: 'Sarah Jenkins',
  },
  {
    ref: 'ADJ-2026-002',
    kind: 'adjustment',
    type: 'Discount',
    accountId: 'acc-adeyemi',
    invoice: 'INV-2026-163',
    amount: 390,
    direction: 'decrease',
    at: '2026-07-17',
    status: 'rejected',
    reason: 'Asked for 5% off for two recipients on one account.',
    raisedBy: 'Sarah Jenkins',
    outcome: 'No multi-recipient discount in the price list; invoice paid in full on 22 Jul.',
  },
]

/* ---------------------------------- store --------------------------------- */

/*
 * Decisions taken this session, over the fixtures. In memory only — there is
 * no backend. The ledger reads `allAdjustments()` on every call, so a balance
 * follows an approval the next time a screen renders.
 */
const decisions = new Map<string, Pick<Adjustment, 'status' | 'decidedBy' | 'decidedAt' | 'outcome'>>()
let version = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Raised this session, newest last. */
const raised: Adjustment[] = []

function changed() {
  version += 1
  listeners.forEach((l) => l())
}

/** Adds a new entry. It starts pending, like everything that needs approval. */
export function addAdjustment(a: Adjustment): void {
  raised.push(a)
  changed()
}

/** The next reference in a series, e.g. REF-2026-003. */
export function nextRef(prefix: string, today = TODAY): string {
  const year = today.slice(0, 4)
  const used = allAdjustments()
    .map((a) => a.ref)
    .filter((r) => r.startsWith(`${prefix}-${year}-`))
    .map((r) => Number(r.split('-')[2]))
    .filter(Number.isFinite)
  return `${prefix}-${year}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`
}

export function allAdjustments(): Adjustment[] {
  return [...fixtures, ...raised].map((a) => {
    const d = decisions.get(a.ref)
    return d ? { ...a, ...d } : a
  })
}

/** Re-renders the caller whenever a decision is taken. */
export function useAdjustments(): Adjustment[] {
  useSyncExternalStore(subscribe, () => version, () => version)
  return allAdjustments()
}

/** What approving does to each kind — see `AdjustmentStatus`. */
const approvedStatus: Record<AdjustmentKind, AdjustmentStatus> = {
  credit: 'applied',
  'write-off': 'applied',
  adjustment: 'applied',
  refund: 'processing',
}

/** `note` is the approver's, kept as the entry's outcome. */
function decide(ref: string, status: AdjustmentStatus, note?: string) {
  decisions.set(ref, {
    status,
    decidedBy: SIGNED_IN,
    decidedAt: TODAY,
    ...(note ? { outcome: note } : {}),
  })
  changed()
}

export const canApprove = (a: Adjustment) => a.status === 'pending'
export const canReject = (a: Adjustment) => a.status === 'pending'
/** Only something that moved a balance can be reversed. */
export const canReverse = (a: Adjustment) => a.status === 'applied' && !a.final

export function approve(a: Adjustment, note?: string) {
  if (canApprove(a)) decide(a.ref, approvedStatus[a.kind], note)
}
export function reject(a: Adjustment, note?: string) {
  if (canReject(a)) decide(a.ref, 'rejected', note)
}
export function reverse(a: Adjustment) {
  if (canReverse(a)) decide(a.ref, 'reversed')
}

/* --------------------------------- derived -------------------------------- */

/**
 * What applied entries have done to an invoice by `today`. Split three ways:
 * a credit reduces what was billed, a write-off is billed and uncollected, and
 * an adjustment changes what was billed in either direction (`added` is signed).
 */
export function appliedAgainst(
  invoice: string,
  today = TODAY,
): { credited: number; writtenOff: number; added: number } {
  let credited = 0
  let writtenOff = 0
  let added = 0
  for (const a of allAdjustments()) {
    if (a.invoice !== invoice || a.status !== 'applied' || a.at > today) continue
    if (a.kind === 'credit') credited += a.amount
    if (a.kind === 'write-off') writtenOff += a.amount
    if (a.kind === 'adjustment') added += a.direction === 'decrease' ? -a.amount : a.amount
  }
  return { credited, writtenOff, added }
}

export function accountName(a: Adjustment): string {
  return getAccount(a.accountId)?.name ?? a.accountId
}

/** Signed for display: "+₦600" / "−₦390"; credits, refunds and write-offs unsigned. */
export function signOf(a: Adjustment): string {
  if (a.kind !== 'adjustment') return ''
  return a.direction === 'decrease' ? '−' : '+'
}
