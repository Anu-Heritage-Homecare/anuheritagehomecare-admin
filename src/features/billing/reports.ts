import { TODAY } from '@/lib/today'
import { getAccount } from './accounts'
import type { Branch } from './accounts'
import { allAdjustments } from './adjustments'
import { transactions } from './data'
import {
  accountOfTransaction,
  agingBuckets,
  appliedAdded,
  isCancelled,
  ledger,
  methodKind,
  openInvoices,
  sumBalances,
} from './ledger'
import type { LedgerInvoice } from './ledger'

/*
 * Financial Reports reads the receivables book and the transaction log for a
 * date window and a branch. Plan revenue (the dashboard's Total Revenue) is
 * organisation-wide and monthly, so it cannot be cut by branch or by an
 * arbitrary window; this page reports what was *billed*, and says so.
 */

export type BranchFilter = Branch | 'all'

export interface Window {
  /** Inclusive ISO dates. */
  from: string
  to: string
}

const DAY_MS = 86_400_000

function shift(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

export type RangeId = '30' | '90' | 'ytd'

export const rangeLabels: Record<RangeId, string> = {
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  ytd: 'Year to date',
}

export function windowFor(range: RangeId, today = TODAY): Window {
  if (range === 'ytd') return { from: `${today.slice(0, 4)}-01-01`, to: today }
  return { from: shift(today, -(Number(range) - 1)), to: today }
}

/** The same length of time immediately before `w`. */
export function previousWindow(w: Window): Window {
  const days =
    Math.round((new Date(`${w.to}T00:00:00Z`).getTime() - new Date(`${w.from}T00:00:00Z`).getTime()) / DAY_MS) + 1
  return { from: shift(w.from, -days), to: shift(w.from, -1) }
}

const within = (iso: string, w: Window) => iso >= w.from && iso <= w.to

function accountInBranch(accountId: string | undefined, branch: BranchFilter): boolean {
  if (branch === 'all') return true
  return accountId ? getAccount(accountId)?.branch === branch : false
}

/**
 * Card payments by recipients outside the directory (Grace Okafor's renewal)
 * belong to no account here, so they count under All branches only.
 */
function txInBranch(t: (typeof transactions)[number], branch: BranchFilter): boolean {
  if (branch === 'all') return true
  return accountInBranch(accountOfTransaction(t)?.id, branch)
}

/**
 * Raised in the window: invoices and failed charges from the book (with any
 * applied adjustment to their amount), plus card renewals that settled or are
 * clearing. Failed renewals are already in the book as charges.
 */
export function billedIn(w: Window, branch: BranchFilter): number {
  const book = ledger
    .filter((i) => within(i.issuedAt, w) && accountInBranch(i.accountId, branch) && !isCancelled(i, w.to))
    .reduce((sum, i) => sum + i.amount + appliedAdded(i.number, w.to), 0)
  const cards = transactions
    .filter(
      (t) =>
        within(t.at, w) &&
        !t.reference.startsWith('INV-') &&
        t.status !== 'failed' &&
        txInBranch(t, branch),
    )
    .reduce((sum, t) => sum + t.amount, 0)
  return book + cards
}

export interface Collected {
  amount: number
  count: number
  /** By method: "Bank transfer", "Card payment", or "Not recorded" before the log. */
  byMethod: Record<string, number>
}

/**
 * Settled in the window. The log begins in July, so an invoice settled before
 * it is counted from the book, with its method unknown.
 */
export function collectedIn(w: Window, branch: BranchFilter): Collected {
  const byMethod: Record<string, number> = {}
  let amount = 0
  let count = 0
  const add = (method: string, value: number) => {
    byMethod[method] = (byMethod[method] ?? 0) + value
    amount += value
    count += 1
  }
  const settledByLog = new Set<string>()
  for (const t of transactions) {
    if (t.status !== 'succeeded') continue
    const ref = t.reference.split(' ')[0]
    if (ref.startsWith('INV-')) settledByLog.add(ref)
    if (within(t.at, w) && txInBranch(t, branch)) add(methodKind(t.method), t.amount)
  }
  for (const i of ledger) {
    if (!i.paidAt || settledByLog.has(i.number)) continue
    if (within(i.paidAt, w) && accountInBranch(i.accountId, branch)) add('Not recorded', i.amount)
  }
  return { amount, count, byMethod }
}

/** Applied write-offs dated in the window. */
export function writtenOffIn(w: Window, branch: BranchFilter): number {
  return allAdjustments()
    .filter(
      (a) =>
        a.kind === 'write-off' &&
        a.status === 'applied' &&
        within(a.at, w) &&
        accountInBranch(a.accountId, branch),
    )
    .reduce((sum, a) => sum + a.amount, 0)
}

/** Owed as of today — a balance, not a flow, so the window does not apply. */
export function outstandingFor(branch: BranchFilter, today = TODAY) {
  const open = openInvoices(today).filter((i) => accountInBranch(i.accountId, branch))
  return { amount: sumBalances(open, today), count: open.length }
}

export function agingFor(branch: BranchFilter, today = TODAY) {
  return agingBuckets(today, (i: LedgerInvoice) => accountInBranch(i.accountId, branch))
}

/** Percentage change, one decimal; null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** The first day the book has anything on — comparisons before it are empty, not zero. */
export const BOOK_START = [
  ...ledger.map((i) => i.issuedAt),
  ...transactions.map((t) => t.at),
].sort()[0]
