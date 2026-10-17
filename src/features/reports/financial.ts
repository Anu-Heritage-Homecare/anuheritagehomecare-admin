/**
 * The Financial Report — the receivables book plus card renewals, cut by date
 * range, care plan, payment status and branch.
 *
 * Every figure is a sum over billing lines: book invoices and failed charges
 * (from the ledger, with applied credits, write-offs and adjustments) and card
 * renewals that settled or are clearing (from the transaction log). The book
 * begins in April 2026, so month-by-month views start there rather than
 * inventing earlier months. Plan revenue — the org-wide model the dashboards
 * use — cannot be cut by these filters and is not used here.
 */
import { TODAY } from '@/lib/today'
import { addDays } from '@/features/scheduling/board-data'
import { planById, transactions } from '@/features/billing/data'
import type { PlanId } from '@/features/billing/data'
import { getAccount } from '@/features/billing/accounts'
import type { BillingAccount } from '@/features/billing/accounts'
import {
  accountOfTransaction,
  appliedAdded,
  balanceOf,
  invoiceBreakdown,
  invoiceStatus,
  isCancelled,
  isDraft,
  ledger,
} from '@/features/billing/ledger'
import { rangeLabels, windowFor } from '@/features/billing/reports'
import type { RangeId, Window } from '@/features/billing/reports'

export { TODAY, rangeLabels, windowFor }
export type { RangeId, Window }

export type PayStatus = 'paid' | 'clearing' | 'due' | 'overdue'

export const payStatusLabels: Record<PayStatus, string> = {
  paid: 'Paid',
  clearing: 'Clearing',
  due: 'Awaiting payment',
  overdue: 'Overdue',
}

export interface Line {
  ref: string
  kind: 'invoice' | 'charge' | 'renewal'
  account: string
  accountId: string | null
  branch: string | null
  issuedAt: string
  dueAt: string
  paidAt: string | null
  /** Billed, after applied adjustments. */
  amount: number
  /** Still owed today. */
  balance: number
  status: PayStatus
  /** When a payment reminder last went out, where the book records one. */
  remindedAt: string | null
  /** Share of `amount` by care plan; sums to `amount`. */
  plans: Partial<Record<PlanId, number>>
}

function planSplit(account: BillingAccount | undefined, amount: number, invoice?: (typeof ledger)[number]) {
  const out: Partial<Record<PlanId, number>> = {}
  if (!account) return out
  const members = account.members ?? []
  if (members.length > 1 && invoice) {
    const lines = invoiceBreakdown(invoice, account).lines
    const subtotal = lines.reduce((s, l) => s + l.amount, 0) || 1
    let left = amount
    lines.forEach((l, i) => {
      const plan = members.find((m) => m.name === l.recipient)?.planId ?? members[i].planId
      const part = i === lines.length - 1 ? left : Math.round((l.amount / subtotal) * amount)
      left -= part
      out[plan] = (out[plan] ?? 0) + part
    })
    return out
  }
  const plan = members[0]?.planId ?? account.subscription?.planId
  if (plan) out[plan] = amount
  return out
}

function build(today = TODAY): Line[] {
  const book: Line[] = ledger
    .filter((i) => !isDraft(i) && !isCancelled(i, today) && i.issuedAt <= today)
    .map((i) => {
      const account = getAccount(i.accountId)
      const amount = i.amount + appliedAdded(i.number, today)
      const st = invoiceStatus(i, today)
      return {
        ref: i.number,
        kind: i.kind,
        account: i.account,
        accountId: i.accountId,
        branch: account?.branch ?? null,
        issuedAt: i.issuedAt,
        dueAt: i.dueAt,
        paidAt: i.paidAt && i.paidAt <= today ? i.paidAt : null,
        amount,
        balance: balanceOf(i, today),
        // Closed by credits counts as settled; clearing is still awaiting.
        status: st === 'paid' || st === 'closed' ? 'paid' : st === 'overdue' ? 'overdue' : 'due',
        remindedAt: i.remindedAt ?? null,
        plans: planSplit(account, amount, i),
      }
    })
  const cards: Line[] = transactions
    .filter((t) => !t.reference.startsWith('INV-') && t.status !== 'failed' && t.at <= today)
    .map((t) => {
      const account = accountOfTransaction(t)
      const paid = t.status === 'succeeded'
      return {
        ref: t.id,
        kind: 'renewal',
        account: account?.name ?? t.client,
        accountId: account?.id ?? null,
        branch: account?.branch ?? null,
        issuedAt: t.at,
        dueAt: t.at,
        paidAt: paid ? t.at : null,
        amount: t.amount,
        // Money in flight is not owed; the dashboards leave it out of
        // outstanding too.
        balance: 0,
        status: paid ? 'paid' : 'clearing',
        remindedAt: null,
        plans: planSplit(account, t.amount),
      }
    })
  return [...book, ...cards]
}

export const ALL = 'all'

export interface FinFilters {
  plan: string
  status: string
  branch: string
}

export const planOptions = (Object.keys(planById) as PlanId[]).map((id) => ({ value: id, label: planById[id].name }))

/**
 * Lines matching the filters. A plan filter keeps only that plan's share of a
 * line, so a multi-recipient invoice contributes what its members on that plan
 * were billed.
 */
export function linesFor(f: FinFilters, today = TODAY): Line[] {
  return build(today)
    .filter(
      (l) =>
        (f.branch === ALL || l.branch === f.branch) &&
        (f.status === ALL || l.status === f.status),
    )
    .flatMap((l) => {
      if (f.plan === ALL) return [l]
      const part = l.plans[f.plan as PlanId]
      if (!part) return []
      const ratio = part / l.amount
      return [{ ...l, amount: part, balance: Math.round(l.balance * ratio), plans: { [f.plan]: part } }]
    })
}

/* --------------------------------- figures --------------------------------- */

const within = (iso: string | null, w: Window) => iso !== null && iso >= w.from && iso <= w.to
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

function pct(part: number, whole: number, dp = 1): number | null {
  if (whole === 0) return null
  const f = 10 ** dp
  return Math.round((part / whole) * 100 * f) / f
}

export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function previousWindow(w: Window): Window {
  const days = Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000) + 1
  return { from: addDays(w.from, -days), to: addDays(w.from, -1) }
}

export const BOOK_START = build().map((l) => l.issuedAt).sort()[0]

export function billed(lines: Line[], w: Window): number {
  return sum(lines.filter((l) => within(l.issuedAt, w)).map((l) => l.amount))
}

/** Of what was issued in the window and has fallen due, the share by value paid. */
export function collectionRate(lines: Line[], w: Window, today = TODAY) {
  const due = lines.filter((l) => within(l.issuedAt, w) && l.dueAt <= today)
  const paid = due.filter((l) => l.paidAt)
  return {
    rate: pct(sum(paid.map((l) => l.amount)), sum(due.map((l) => l.amount))),
    paid: paid.length,
    due: due.length,
  }
}

export function outstanding(lines: Line[]) {
  const open = lines.filter((l) => l.balance > 0)
  const overdue = open.filter((l) => l.status === 'overdue')
  return {
    amount: sum(open.map((l) => l.balance)),
    count: open.length,
    overdue: sum(overdue.map((l) => l.balance)),
  }
}

/** Book invoices only — a card renewal settles the day it is raised. */
export function averages(lines: Line[], w: Window) {
  const issued = lines.filter((l) => l.kind === 'invoice' && within(l.issuedAt, w))
  const settled = lines.filter((l) => l.kind === 'invoice' && l.paidAt && within(l.issuedAt, w))
  const days = settled.map((l) => Math.round((Date.parse(l.paidAt!) - Date.parse(l.issuedAt)) / 86_400_000))
  return {
    invoice: issued.length === 0 ? null : Math.round(sum(issued.map((l) => l.amount)) / issued.length),
    daysToPay: days.length === 0 ? null : Math.round(sum(days) / days.length),
  }
}

export function byPlan(lines: Line[], w: Window) {
  const totals: Partial<Record<PlanId, number>> = {}
  for (const l of lines.filter((x) => within(x.issuedAt, w)))
    for (const [p, v] of Object.entries(l.plans) as [PlanId, number][]) totals[p] = (totals[p] ?? 0) + v
  const rows: { id: string; label: string; value: number }[] = (Object.entries(totals) as [PlanId, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: planById[id].name, value }))
  // A payer outside the directory (a card renewal with no account) has no plan
  // on record; shown as such so the ring still sums to what was billed.
  const unplanned = billed(lines, w) - sum(rows.map((r) => r.value))
  if (unplanned > 0) rows.push({ id: 'none', label: 'No plan on record', value: unplanned })
  return rows
}

/* --------------------------------- months ---------------------------------- */

const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

export interface MonthRow {
  id: string
  label: string
  short: string
  invoiced: number
  /** Settled during the month, whenever issued. */
  collected: number
  /** Still owed today on what the month issued. */
  outstanding: number
  /** Of what the month issued and has fallen due, the share by value paid. */
  rate: number | null
  growth: number | null
}

/** Book months, oldest first, from BOOK_START to TODAY's month. */
export function months(lines: Line[], today = TODAY): MonthRow[] {
  const out: MonthRow[] = []
  for (let m = BOOK_START.slice(0, 7); m <= today.slice(0, 7); ) {
    const from = `${m}-01`
    const next = new Date(`${from}T00:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + 1)
    const to = addDays(next.toISOString().slice(0, 10), -1)
    const w = { from, to }
    const invoiced = billed(lines, w)
    const prev = out[out.length - 1]
    out.push({
      id: m,
      label: monthLong.format(new Date(`${from}T00:00:00Z`)),
      short: monthShort.format(new Date(`${from}T00:00:00Z`)),
      invoiced,
      collected: sum(lines.filter((l) => within(l.paidAt, w)).map((l) => l.amount)),
      outstanding: sum(lines.filter((l) => within(l.issuedAt, w)).map((l) => l.balance)),
      rate: collectionRate(lines, w, today).rate,
      growth: prev ? change(invoiced, prev.invoiced) : null,
    })
    m = next.toISOString().slice(0, 7)
  }
  return out
}

/* ------------------------------ open invoices ------------------------------ */

export function openLines(lines: Line[], today = TODAY) {
  return lines
    .filter((l) => l.balance > 0)
    .map((l) => ({
      ...l,
      daysOverdue:
        l.status === 'overdue' ? Math.round((Date.parse(today) - Date.parse(l.dueAt)) / 86_400_000) : null,
    }))
    .sort((a, b) => (b.daysOverdue ?? -1) - (a.daysOverdue ?? -1) || a.dueAt.localeCompare(b.dueAt))
}
