import { TODAY } from '@/lib/today'
import { recipients } from '@/features/care-recipients/data'
import {
  RATE_PER_VISIT,
  getBillingRecord,
  patientDue,
} from '@/features/care-recipients/billing-data'
import { failedPayment, planById, subscriptions, transactions } from './data'
import type { Transaction, TransactionStatus } from './data'
import { accountForRecipient, billingAccounts, getAccount } from './accounts'
import { allAdjustments, appliedAgainst } from './adjustments'
import type { BillingAccount } from './accounts'
import type { Tone } from '@/types'

/* ---------------------------------- types --------------------------------- */

/**
 * One line in the organisation's receivables book: an invoice raised to an
 * account on invoice terms, or a card renewal that failed and is still owed.
 */
export interface LedgerInvoice {
  /** Invoice number, or the transaction id of a failed card charge. */
  number: string
  /**
   * An invoice, or a card renewal whose charge failed. A failed charge is
   * money owed exactly as an unpaid invoice is — leaving it out let an account
   * read "₦0 outstanding" while its last payment had bounced.
   */
  kind: 'invoice' | 'charge'
  accountId: string
  /** The account's display name, resolved once. */
  account: string
  /** ISO. */
  issuedAt: string
  /** ISO. `issuedAt + PAYMENT_TERMS_DAYS`. */
  dueAt: string
  /** ISO. The service the line bills for. */
  periodStart: string
  periodEnd: string
  amount: number
  /** ISO. Present exactly when settled. */
  paidAt?: string
  /** ISO. When a payment reminder last went out. */
  remindedAt?: string
  /** Set when the reminder was sent by hand from the app. */
  remindedBy?: string
  remindedVia?: ('Email' | 'SMS')[]
  /** Visits billed. Invoices only; `amount` is derived from it. */
  visits?: number
  /** The service line the recipient billing record names, where it names one. */
  services?: string
  /**
   * Set where an insurer pays part: `amount` is then the family's share and the
   * gross is `visits × RATE_PER_VISIT`.
   */
  insurance?: { provider: string; coverageRate: number }
  /**
   * Invoices raised in the app carry their own lines, discounts, adjustments
   * and VAT; the book's fixtures are worked out from `visits` instead.
   */
  breakdown?: InvoiceBreakdown
  /** ISO. When the invoice was sent to the account's contact. */
  sentAt?: string
  /**
   * ISO. Filed away from the working Invoices list. Archiving moves nothing:
   * the invoice keeps its status, balance and place on the account.
   */
  archivedAt?: string
  archivedBy?: string
  /** Set when the invoice was voided: nothing is owed on it from then on. */
  cancelled?: { at: string; reason: string; note?: string; by: string }
}

/**
 * A draft: raised in the app and not yet sent, paid, cancelled or touched by
 * a credit, refund or adjustment. Nothing refers to it, so it can be deleted.
 */
export function isDraft(invoice: LedgerInvoice): boolean {
  return (
    Boolean(invoice.breakdown) &&
    !invoice.sentAt &&
    !invoice.paidAt &&
    !invoice.cancelled &&
    !allAdjustments().some((a) => a.invoice === invoice.number && a.status !== 'rejected')
  )
}

/** Voided as of `today`. A cancelled invoice is billed for nothing. */
export function isCancelled(invoice: LedgerInvoice, today = TODAY): boolean {
  return Boolean(invoice.cancelled && invoice.cancelled.at <= today)
}

/** Net terms on every invoice — the recipient billing tab runs on the same. */
export const PAYMENT_TERMS_DAYS = 15

const DAY_MS = 86_400_000

function toTime(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime()
}

function addDays(iso: string, days: number): string {
  return new Date(toTime(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * The half-month an invoice raised on `issuedAt` bills for: one raised on the
 * 1st covers the 16th to the end of the month before, one raised on the 16th
 * covers the 1st to the 15th — the same cycle as the recipient billing tab.
 */
function semiMonthlyPeriod(issuedAt: string): { periodStart: string; periodEnd: string } {
  const [y, m, d] = issuedAt.split('-').map(Number)
  if (d >= 16) {
    const month = issuedAt.slice(0, 8)
    return { periodStart: `${month}01`, periodEnd: `${month}15` }
  }
  const prev = new Date(Date.UTC(y, m - 1, 0)) // last day of the month before
  const month = prev.toISOString().slice(0, 8)
  return { periodStart: `${month}16`, periodEnd: prev.toISOString().slice(0, 10) }
}

/** A card renewal on `at` pays for the cycle that starts that day. */
export function cyclePeriod(
  at: string,
  cycle: 'Monthly' | 'Annual',
): { periodStart: string; periodEnd: string } {
  const end = new Date(toTime(at))
  if (cycle === 'Annual') end.setUTCFullYear(end.getUTCFullYear() + 1)
  else end.setUTCMonth(end.getUTCMonth() + 1)
  end.setUTCDate(end.getUTCDate() - 1)
  return { periodStart: at, periodEnd: end.toISOString().slice(0, 10) }
}

function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS)
}

/* ---------------------------------- data ---------------------------------- */

/*
 * Invoice-billed accounts, semi-monthly like the recipient billing tab. Every
 * amount is `visits × RATE_PER_VISIT`. Each invoice settled in July has a
 * matching succeeded transaction in `data.ts` (reference = invoice number), so
 * the payments table and "Payments this month" count the same money as this
 * book — `ledgerMismatches()` checks it.
 *
 * Bello Trust is the chronic late payer and carries the 61–90 and 90+
 * buckets; the Musa Family has one invoice under dispute from May.
 */
const rows: (Omit<
  LedgerInvoice,
  'dueAt' | 'amount' | 'kind' | 'account' | 'periodStart' | 'periodEnd'
> & {
  visits: number
})[] = [
  { number: 'INV-2026-140', accountId: 'acc-bello', issuedAt: '2026-04-16', visits: 30 },
  { number: 'INV-2026-141', accountId: 'acc-bello', issuedAt: '2026-05-01', visits: 28 },
  { number: 'INV-2026-142', accountId: 'acc-bello', issuedAt: '2026-05-16', visits: 30, paidAt: '2026-06-20', archivedAt: '2026-07-05' },
  { number: 'INV-2026-143', accountId: 'acc-musa', issuedAt: '2026-05-16', visits: 18 },
  { number: 'INV-2026-144', accountId: 'acc-babalola', issuedAt: '2026-06-01', visits: 93, paidAt: '2026-06-15', archivedAt: '2026-07-02' },
  { number: 'INV-2026-145', accountId: 'acc-adeyemi', issuedAt: '2026-06-01', visits: 27, paidAt: '2026-06-12', archivedAt: '2026-06-30' },
  { number: 'INV-2026-146', accountId: 'acc-okafor', issuedAt: '2026-06-01', visits: 14, paidAt: '2026-06-14', archivedAt: '2026-06-30' },
  { number: 'INV-2026-147', accountId: 'acc-bello', issuedAt: '2026-06-01', visits: 30 },
  { number: 'INV-2026-148', accountId: 'acc-eze', issuedAt: '2026-06-01', visits: 15, paidAt: '2026-06-16' },
  { number: 'INV-2026-149', accountId: 'acc-musa', issuedAt: '2026-06-01', visits: 18, paidAt: '2026-06-17' },
  { number: 'INV-2026-150', accountId: 'acc-babalola', issuedAt: '2026-06-16', visits: 92, paidAt: '2026-06-30' },
  { number: 'INV-2026-151', accountId: 'acc-adeyemi', issuedAt: '2026-06-16', visits: 26, paidAt: '2026-06-29' },
  { number: 'INV-2026-152', accountId: 'acc-okafor', issuedAt: '2026-06-16', visits: 14, paidAt: '2026-07-02' },
  { number: 'INV-2026-153', accountId: 'acc-bello', issuedAt: '2026-06-16', visits: 30 },
  { number: 'INV-2026-154', accountId: 'acc-eze', issuedAt: '2026-06-16', visits: 16 },
  { number: 'INV-2026-155', accountId: 'acc-musa', issuedAt: '2026-06-16', visits: 16 },
  { number: 'INV-2026-156', accountId: 'acc-babalola', issuedAt: '2026-07-01', visits: 93, paidAt: '2026-07-14' },
  { number: 'INV-2026-157', accountId: 'acc-adeyemi', issuedAt: '2026-07-01', visits: 27, paidAt: '2026-07-10' },
  { number: 'INV-2026-158', accountId: 'acc-okafor', issuedAt: '2026-07-01', visits: 14, paidAt: '2026-07-23' },
  { number: 'INV-2026-159', accountId: 'acc-bello', issuedAt: '2026-07-01', visits: 30, remindedAt: '2026-07-21' },
  { number: 'INV-2026-160', accountId: 'acc-eze', issuedAt: '2026-07-01', visits: 15, remindedAt: '2026-07-23' },
  { number: 'INV-2026-161', accountId: 'acc-musa', issuedAt: '2026-07-01', visits: 18, paidAt: '2026-07-18' },
  { number: 'INV-2026-162', accountId: 'acc-babalola', issuedAt: '2026-07-16', visits: 92 },
  { number: 'INV-2026-163', accountId: 'acc-adeyemi', issuedAt: '2026-07-16', visits: 26, paidAt: '2026-07-22' },
  { number: 'INV-2026-164', accountId: 'acc-okafor', issuedAt: '2026-07-16', visits: 14 },
  { number: 'INV-2026-165', accountId: 'acc-bello', issuedAt: '2026-07-16', visits: 30 },
  { number: 'INV-2026-166', accountId: 'acc-eze', issuedAt: '2026-07-16', visits: 16 },
  { number: 'INV-2026-167', accountId: 'acc-musa', issuedAt: '2026-07-16', visits: 18 },
]

/*
 * Recipients billed per visit are read from their billing record rather than
 * copied, so this book and their Billing tab cannot disagree. What the family
 * owes is the patient share; the insurer's part is not a receivable here.
 */
const recipientInvoices: LedgerInvoice[] = recipients.flatMap((r) => {
  const record = getBillingRecord(r.id)
  const account = accountForRecipient(r.id)
  if (!record || !account) return []
  const rate = record.insurance.coverageRate
  return record.invoices.map((inv) => ({
    number: inv.number,
    kind: 'invoice' as const,
    accountId: account.id,
    account: account.name,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    amount: patientDue(inv, rate),
    paidAt: inv.paidAt,
    visits: inv.visits,
    services: inv.services,
    insurance: { provider: record.insurance.provider, coverageRate: rate },
  }))
})

/*
 * A card renewal whose latest charge failed. `failedPayment` already answers
 * "is the last charge on this plan a bounce" — a later successful retry clears
 * it — so this reads that rather than re-deciding it. Due the day it failed.
 */
const failedCharges: LedgerInvoice[] = subscriptions.flatMap((sub) => {
  const tx = failedPayment(sub)
  const account = accountForRecipient(sub.recipientId)
  if (!tx || !account) return []
  return [
    {
      number: tx.id,
      kind: 'charge' as const,
      accountId: account.id,
      account: account.name,
      issuedAt: tx.at,
      dueAt: tx.at,
      ...cyclePeriod(tx.at, sub.cycle),
      amount: tx.amount,
    },
  ]
})

export const ledger: LedgerInvoice[] = [
  ...rows.map(({ visits, ...row }) => ({
    ...row,
    visits,
    kind: 'invoice' as const,
    account: getAccount(row.accountId)?.name ?? row.accountId,
    dueAt: addDays(row.issuedAt, PAYMENT_TERMS_DAYS),
    ...semiMonthlyPeriod(row.issuedAt),
    amount: visits * RATE_PER_VISIT,
  })),
  ...recipientInvoices,
  ...failedCharges,
]

/* --------------------------------- derived -------------------------------- */

/**
 * What is still owed on a line as of `today`: nothing once paid, otherwise the
 * amount less any applied credits and write-offs (adjustments.ts).
 */
export function balanceOf(invoice: LedgerInvoice, today = TODAY): number {
  if (invoice.issuedAt > today) return 0
  if (isCancelled(invoice, today)) return 0
  if (invoice.paidAt && invoice.paidAt <= today) return 0
  const { credited, writtenOff, added } = appliedAgainst(invoice.number, today)
  return Math.max(0, invoice.amount + added - credited - writtenOff)
}

/** Owed as of `today`. An invoice settled later than `today` was unpaid then. */
function openOn(invoice: LedgerInvoice, today: string): boolean {
  return balanceOf(invoice, today) > 0
}

export function openInvoices(today = TODAY): LedgerInvoice[] {
  return ledger.filter((i) => openOn(i, today))
}

export function overdueInvoices(today = TODAY): LedgerInvoice[] {
  return openInvoices(today).filter((i) => i.dueAt < today)
}

/** An invoice's applied adjustments to its amount, signed. */
export function appliedAdded(invoice: string, today = TODAY): number {
  return appliedAgainst(invoice, today).added
}

/** Gross — what was billed. */
export function sumAmounts(invoices: LedgerInvoice[]): number {
  return invoices.reduce((sum, i) => sum + i.amount, 0)
}

/** Still owed — what outstanding, overdue and aging figures add up. */
export function sumBalances(invoices: LedgerInvoice[], today = TODAY): number {
  return invoices.reduce((sum, i) => sum + balanceOf(i, today), 0)
}

export interface AgingBucket {
  id: string
  label: string
  amount: number
  count: number
  /** Share of the outstanding total, 0–100. */
  share: number
  tone: Tone
}

/*
 * Aged from the issue date, the usual receivables convention — so the buckets
 * sum to the outstanding balance, and "overdue" (past the due date) is a
 * separate, smaller figure.
 */
const agingSpecs: { id: string; label: string; max: number; tone: Tone }[] = [
  { id: '0-30', label: '0–30 days', max: 30, tone: 'blue' },
  { id: '31-60', label: '31–60 days', max: 60, tone: 'amber' },
  { id: '61-90', label: '61–90 days', max: 90, tone: 'red' },
  { id: '90+', label: '90+ days', max: Infinity, tone: 'slate' },
]

export function agingBuckets(
  today = TODAY,
  /** Narrows the book first, e.g. to one branch's accounts. */
  include: (i: LedgerInvoice) => boolean = () => true,
): AgingBucket[] {
  const open = openInvoices(today).filter(include)
  const total = sumBalances(open, today)
  let min = 0
  return agingSpecs.map((spec) => {
    const items = open.filter((i) => {
      const age = daysBetween(i.issuedAt, today)
      return age >= min && age <= spec.max
    })
    min = spec.max + 1
    const amount = sumBalances(items, today)
    return {
      id: spec.id,
      label: spec.label,
      tone: spec.tone,
      amount,
      count: items.length,
      share: total === 0 ? 0 : Math.round((amount / total) * 100),
    }
  })
}

/**
 * Of everything that had fallen due by `today`, the share by value that had
 * been collected by then. Measured as of a date so the delta below compares
 * like with like.
 */
export function collectionRate(today = TODAY): number {
  const due = ledger.filter((i) => i.dueAt <= today && !isCancelled(i, today))
  // A credit reduces what was billed; a write-off is billed and uncollected.
  const billed = due.reduce(
    (sum, i) => {
      const { credited, added } = appliedAgainst(i.number, today)
      return sum + i.amount + added - credited
    },
    0,
  )
  if (billed === 0) return 0
  const collected = sumAmounts(due.filter((i) => i.paidAt && i.paidAt <= today))
  return Math.round((collected / billed) * 1000) / 10
}

/** Change in collection rate against 30 days earlier, in percentage points. */
export function collectionRateDelta(today = TODAY): number {
  const before = collectionRate(addDays(today, -30))
  return Math.round((collectionRate(today) - before) * 10) / 10
}

/* --------------------------------- payments -------------------------------- */

/** Settled payments, newest first. Card renewals and invoice settlements alike. */
export function settledPayments() {
  return transactions
    .filter((t) => t.status === 'succeeded')
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
}

export function paymentsThisMonth(today = TODAY) {
  const month = today.slice(0, 7)
  return settledPayments().filter((t) => t.at.slice(0, 7) === month)
}

/** "Card payment" / "Bank transfer" — the table's method column. */
export function methodKind(method: string): string {
  if (/^bank/i.test(method)) return 'Bank transfer'
  if (/^cash/i.test(method)) return 'Cash'
  if (/^mobile/i.test(method)) return 'Mobile money'
  return 'Card payment'
}

/**
 * Invoices settled inside the log's window that have no matching succeeded
 * transaction, or the reverse. Empty when the book and the log agree.
 */
export function ledgerMismatches(): string[] {
  const logStart = transactions.map((t) => t.at).sort()[0]
  const settled = new Set(
    transactions
      .filter((t) => t.status === 'succeeded')
      .map((t) => t.reference.split(' ')[0]),
  )
  const issues: string[] = []
  for (const inv of ledger) {
    if (inv.paidAt && inv.paidAt >= logStart && !settled.has(inv.number)) {
      issues.push(`${inv.number} paid ${inv.paidAt} with no transaction`)
    }
  }
  for (const t of transactions) {
    const ref = t.reference.split(' ')[0]
    if (!ref.startsWith('INV-')) continue
    const inv = ledger.find((i) => i.number === ref)
    if (!inv) {
      issues.push(`${t.id} settles unknown ${ref}`)
      continue
    }
    if (t.client !== payerName(inv.accountId))
      issues.push(`${t.id} is from ${t.client}, but ${ref} is billed to ${inv.account}`)
    if (t.status === 'succeeded' && (inv.paidAt !== t.at || inv.amount !== t.amount))
      issues.push(`${t.id} disagrees with ${ref}`)
  }
  return issues
}

/*
 * The log names who paid: the recipient for a directory account (the card on
 * file is theirs), the account itself for everyone else.
 */
export function payerName(accountId: string): string | undefined {
  const account = getAccount(accountId)
  if (!account) return undefined
  if (!account.recipientId) return account.name
  return recipients.find((r) => r.id === account.recipientId)?.name
}

/* --------------------------------- accounts -------------------------------- */

export type AccountStatus = 'active' | 'overdue' | 'inactive'

export const accountStatusLabels: Record<AccountStatus, string> = {
  active: 'Active',
  overdue: 'Overdue',
  inactive: 'Inactive',
}

export const accountStatusTones: Record<AccountStatus, Tone> = {
  active: 'green',
  overdue: 'amber',
  inactive: 'slate',
}

export interface AccountSummary {
  account: BillingAccount
  /** Everything open against the account: unpaid invoices and failed charges. */
  open: LedgerInvoice[]
  outstanding: number
  /** ISO. The most recent settled payment, from the log or the book. */
  lastPaymentAt?: string
  status: AccountStatus
}

/** Succeeded payments made by an account, newest first. */
export function accountPayments(account: BillingAccount) {
  const payer = payerName(account.id)
  const invoices = new Set(
    ledger.filter((i) => i.accountId === account.id).map((i) => i.number),
  )
  return settledPayments().filter(
    (t) => t.client === payer || invoices.has(t.reference.split(' ')[0]),
  )
}

export function summariseAccount(account: BillingAccount, today = TODAY): AccountSummary {
  const own = ledger.filter((i) => i.accountId === account.id)
  const open = own.filter((i) => openOn(i, today))

  // The log only reaches back to July; an invoice settled before that is still
  // a payment, so the book's settlement dates are counted too.
  const dates = [
    ...accountPayments(account).map((t) => t.at),
    ...own.flatMap((i) => (i.paidAt && i.paidAt <= today ? [i.paidAt] : [])),
  ].sort()

  const subStatus = account.subscription?.status
  const status: AccountStatus =
    subStatus === 'paused' || subStatus === 'cancelled'
      ? 'inactive'
      : open.some((i) => i.dueAt < today)
        ? 'overdue'
        : 'active'

  return {
    account,
    open,
    outstanding: sumBalances(open, today),
    lastPaymentAt: dates.at(-1),
    status,
  }
}

export function accountSummaries(today = TODAY): AccountSummary[] {
  return billingAccounts.map((a) => summariseAccount(a, today))
}

/**
 * Whose payment a log entry is: the account an invoice settlement names, else
 * the directory account of the recipient whose card was charged.
 */
export function accountOfTransaction(t: Transaction): BillingAccount | undefined {
  const ref = t.reference.split(' ')[0]
  const invoice = ledger.find((i) => i.number === ref && i.kind === 'invoice')
  if (invoice) return getAccount(invoice.accountId)
  const recipient = recipients.find((r) => r.name === t.client)
  return recipient ? accountForRecipient(recipient.id) : undefined
}

/** `closed`: nothing paid, but credits and write-offs cover the whole amount. */
export type StatementStatus = 'paid' | 'due' | 'overdue' | 'clearing' | 'closed' | 'cancelled' | 'draft'

export const statementStatusLabels: Record<StatementStatus, string> = {
  paid: 'Paid',
  due: 'Awaiting payment',
  overdue: 'Overdue',
  clearing: 'Clearing',
  closed: 'Closed',
  cancelled: 'Cancelled',
  draft: 'Draft',
}

export const statementStatusTones: Record<StatementStatus, Tone> = {
  paid: 'green',
  due: 'blue',
  overdue: 'red',
  clearing: 'amber',
  closed: 'slate',
  cancelled: 'slate',
  draft: 'slate',
}

/** Where a line in the book stands as of `today`. */
export function invoiceStatus(i: LedgerInvoice, today = TODAY): StatementStatus {
  if (i.paidAt && i.paidAt <= today) return 'paid'
  if (isCancelled(i, today)) return 'cancelled'
  if (isDraft(i)) return 'draft'
  if (balanceOf(i, today) === 0) return 'closed'
  return i.dueAt < today ? 'overdue' : 'due'
}

/** One thing an account was billed for: an invoice, or a card renewal charge. */
export interface StatementLine {
  ref: string
  kind: 'invoice' | 'charge'
  issuedAt: string
  dueAt: string
  periodStart: string
  periodEnd: string
  amount: number
  paidAt?: string
  /** Applied credits, write-offs and (signed) adjustments against the line. */
  credited: number
  writtenOff: number
  added: number
  /** Still owed: amount less payment, credits and write-offs. */
  balance: number
  status: StatementStatus
}

/**
 * Everything billed to an account, newest first. Invoices come from the book;
 * card renewals from the log. A failed charge counts only while it is the
 * latest on its plan — the book already holds exactly those — so a retried
 * one is not billed twice.
 */
export function accountStatement(account: BillingAccount, today = TODAY): StatementLine[] {
  const lines: StatementLine[] = ledger
    .filter((i) => i.accountId === account.id && i.issuedAt <= today)
    .map((i) => {
      const paid = Boolean(i.paidAt && i.paidAt <= today)
      return {
        ref: i.number,
        kind: i.kind,
        issuedAt: i.issuedAt,
        dueAt: i.dueAt,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
        amount: i.amount,
        paidAt: paid ? i.paidAt : undefined,
        ...(paid ? { credited: 0, writtenOff: 0, added: 0 } : appliedAgainst(i.number, today)),
        balance: balanceOf(i, today),
        status: invoiceStatus(i, today),
      }
    })

  // Card renewals that settled or are still clearing. Failed ones that still
  // count are already in the book as charges.
  for (const t of transactions) {
    if (t.at > today || t.reference.startsWith('INV-') || t.status === 'failed') continue
    if (accountOfTransaction(t)?.id !== account.id) continue
    lines.push({
      ref: t.id,
      kind: 'charge',
      issuedAt: t.at,
      dueAt: t.at,
      ...cyclePeriod(t.at, account.subscription?.cycle ?? 'Monthly'),
      amount: t.amount,
      paidAt: t.status === 'succeeded' ? t.at : undefined,
      credited: 0,
      writtenOff: 0,
      added: 0,
      balance: 0,
      status: t.status === 'succeeded' ? 'paid' : 'clearing',
    })
  }

  return lines.sort(
    (a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.ref.localeCompare(a.ref),
  )
}

export interface AccountTotals {
  billed: number
  paid: number
  outstanding: number
  /** Charged but not yet settled or failed — neither paid nor owed yet. */
  clearing: number
  /** Taken off by applied credits and write-offs. */
  credited: number
  writtenOff: number
}

/**
 * billed = paid + outstanding + clearing + credited + writtenOff, by
 * construction; `billed` includes applied adjustments to the amount.
 */
export function accountTotals(lines: StatementLine[]): AccountTotals {
  const sum = (xs: StatementLine[], f: (l: StatementLine) => number = (l) => l.amount) =>
    xs.reduce((s, l) => s + f(l), 0)
  return {
    // A cancelled invoice was voided, so it was never billed.
    billed: sum(lines.filter((l) => l.status !== 'cancelled'), (l) => l.amount + l.added),
    paid: sum(lines.filter((l) => l.status === 'paid')),
    outstanding: sum(lines, (l) => l.balance),
    clearing: sum(lines.filter((l) => l.status === 'clearing')),
    credited: sum(lines, (l) => l.credited),
    writtenOff: sum(lines, (l) => l.writtenOff),
  }
}

export interface AccountPayment {
  /** The transaction id, or undefined for a settlement from before the log. */
  txId?: string
  at: string
  amount: number
  /** "Bank transfer", "Card (Visa)"; unknown before the log begins. */
  method?: string
  /** What it paid for: an invoice number, or the plan renewal. */
  reference: string
  status: TransactionStatus
  /** The bank's own reference, where one was recorded. */
  externalRef?: string
  bank?: string
  note?: string
  recordedBy?: string
}

/** "Bank transfer" / "Card (Mastercard)" — the brand without the digits. */
export function methodDetail(method: string): string {
  if (/^bank/i.test(method)) return 'Bank transfer'
  if (/^cash/i.test(method)) return 'Cash'
  if (/^mobile/i.test(method)) return 'Mobile money'
  // Recorded by hand as "Card Payment": the brand is not known.
  if (/^card/i.test(method)) return 'Card'
  return `Card (${method.split(' ')[0]})`
}

/**
 * Every payment attempt against an account, newest first — settled, clearing
 * and failed alike. The log reaches back only to July, so an invoice settled
 * earlier is listed from the book, without a transaction or a method.
 */
export function accountPaymentHistory(
  account: BillingAccount,
  today = TODAY,
): AccountPayment[] {
  const logged: AccountPayment[] = transactions
    .filter((t) => t.at <= today && accountOfTransaction(t)?.id === account.id)
    .map((t) => ({
      txId: t.id,
      at: t.at,
      amount: t.amount,
      method: methodDetail(t.method),
      reference: t.reference.split(' · ')[0],
      status: t.status,
      // Recorded by hand as "INV-… · <bank reference>"; a renewal's second
      // part is its cycle, not a reference.
      externalRef: t.recordedBy ? t.reference.split(' · ')[1] : undefined,
      bank: t.bank,
      note: t.note,
      recordedBy: t.recordedBy,
    }))
  const inLog = new Set(
    logged.filter((p) => p.status === 'succeeded').map((p) => p.reference),
  )
  const fromBook: AccountPayment[] = ledger.flatMap((i) =>
    i.accountId === account.id && i.paidAt && i.paidAt <= today && !inLog.has(i.number)
      ? [{ at: i.paidAt, amount: i.amount, reference: i.number, status: 'succeeded' as const }]
      : [],
  )
  return [...logged, ...fromBook].sort((a, b) => b.at.localeCompare(a.at))
}

/** The method used most often for settled payments; the latest wins a tie. */
export function preferredMethod(history: AccountPayment[]): string | undefined {
  const tally = new Map<string, number>()
  const settled = history.filter((p) => p.status === 'succeeded')
  for (const p of settled) if (p.method) tally.set(p.method, (tally.get(p.method) ?? 0) + 1)
  let best: string | undefined
  for (const p of settled) {
    if (!p.method) continue
    if (!best || (tally.get(p.method) ?? 0) > (tally.get(best) ?? 0)) best = p.method
  }
  return best
}

/* --------------------------------- activity -------------------------------- */

export type ActivityKind = 'payment' | 'failed' | 'issued' | 'reminder' | 'overdue'

export interface BillingEvent {
  id: string
  kind: ActivityKind
  /** The account it concerns, where one is known. */
  accountId?: string
  /** The invoice it concerns, where there is one. */
  invoice?: string
  /**
   * Who or what did it, as far as the records say: the gateway for a card
   * charge, reconciliation for a bank transfer, the billing system for what
   * runs on a schedule. Never a named person — nothing records one.
   */
  actor: string
  /** ISO date. The fixtures carry no time of day. */
  at: string
  title: string
  detail: string
}

/** Within one day, the item needing attention sorts first. */
const kindRank: Record<ActivityKind, number> = {
  overdue: 0,
  failed: 1,
  payment: 2,
  reminder: 3,
  issued: 4,
}

const money = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

/** The invoice a log entry settles, if it settles one. */
function invoiceRef(t: Transaction): string | undefined {
  const ref = t.reference.split(' ')[0]
  return ref.startsWith('INV-') ? ref : undefined
}

/** Every event is read off the ledger or the log — nothing is written here. */
export function billingActivity(
  limit = 5,
  today = TODAY,
  accountId?: string,
): BillingEvent[] {
  const events: BillingEvent[] = []

  for (const t of transactions) {
    if (t.status === 'succeeded') {
      events.push({
        id: `pay-${t.id}`,
        invoice: invoiceRef(t),
        accountId: accountOfTransaction(t)?.id,
        actor: /^bank/i.test(t.method) ? 'Bank reconciliation' : 'Payment gateway',
        kind: 'payment',
        at: t.at,
        title: 'Payment received',
        detail: `${money.format(t.amount)} from ${t.client} for ${t.reference.split(' · ')[0]}`,
      })
    } else if (t.status === 'failed') {
      events.push({
        id: `fail-${t.id}`,
        invoice: invoiceRef(t),
        accountId: accountOfTransaction(t)?.id,
        actor: /^bank/i.test(t.method) ? 'Bank reconciliation' : 'Payment gateway',
        kind: 'failed',
        at: t.at,
        title: 'Payment failed',
        detail: `${money.format(t.amount)} from ${t.client}`,
      })
    }
  }

  // A failed charge already has its "Payment failed" event from the log.
  for (const inv of ledger.filter((i) => i.kind === 'invoice')) {
    events.push({
      id: `iss-${inv.number}`,
      invoice: inv.number,
      accountId: inv.accountId,
      actor: 'Billing system',
      kind: 'issued',
      at: inv.issuedAt,
      title: 'Invoice issued',
      detail: `${inv.number} raised for ${inv.account}`,
    })
    if (inv.remindedAt) {
      events.push({
        id: `rem-${inv.number}`,
        invoice: inv.number,
        accountId: inv.accountId,
        actor: inv.remindedBy ?? 'Billing system',
        kind: 'reminder',
        at: inv.remindedAt,
        title: 'Reminder sent',
        detail: `${inv.account} reminded of ${inv.number}${inv.remindedVia ? ` by ${inv.remindedVia.join(' and ')}` : ''}`,
      })
    }
    // It became overdue the day after it fell due, whether or not it was paid
    // later — that it happened is the event.
    const lapsed = addDays(inv.dueAt, 1)
    if (lapsed <= today && (!inv.paidAt || inv.paidAt >= lapsed)) {
      events.push({
        id: `od-${inv.number}`,
        invoice: inv.number,
        accountId: inv.accountId,
        actor: 'Billing system',
        kind: 'overdue',
        at: lapsed,
        title: 'Invoice overdue',
        detail: `${inv.number} for ${inv.account} is past due`,
      })
    }
  }

  return events
    .filter((e) => e.at <= today && (!accountId || e.accountId === accountId))
    .sort((a, b) => b.at.localeCompare(a.at) || kindRank[a.kind] - kindRank[b.kind])
    .slice(0, limit)
}

/** "Today", "Yesterday", "3d ago" — the fixtures are dated, not timed. */
export function relativeDay(iso: string, today = TODAY): string {
  const days = daysBetween(iso, today)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

/* --------------------------------- invoices -------------------------------- */

/** The net terms an invoice was raised on, in days. */
export function termsDays(invoice: LedgerInvoice): number {
  return daysBetween(invoice.issuedAt, invoice.dueAt)
}

export function getInvoice(number: string): LedgerInvoice | undefined {
  return ledger.find((i) => i.number === number && i.kind === 'invoice')
}

export interface InvoiceLine {
  description: string
  /** Who the line is for, where the account pays for more than one. */
  recipient?: string
  units: number
  unitLabel: string
  rate: number
  amount: number
}

export interface InvoiceBreakdown {
  lines: InvoiceLine[]
  /** Gross of every line. */
  subtotal: number
  /** Signed: an insurer's share or a discount is negative, VAT positive. */
  adjustments: { label: string; amount: number }[]
  /** What the account owes: `subtotal + adjustments`, equal to `invoice.amount`. */
  total: number
}

/**
 * Split `total` across `weights`, largest remainder first, so the parts are
 * whole and always sum back to `total`.
 */
function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (total * w) / sum)
  const parts = exact.map(Math.floor)
  let left = total - parts.reduce((a, b) => a + b, 0)
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r)
  for (const { i } of order) {
    if (left <= 0) break
    parts[i] += 1
    left -= 1
  }
  return parts
}

/**
 * The lines behind an invoice. The book records visits per invoice, not per
 * person, so an account paying for several recipients has its visits shared
 * out by each one's plan allowance — an apportionment, and labelled as such
 * on the page, not a record of who was seen when.
 */
export function invoiceBreakdown(
  invoice: LedgerInvoice,
  account: BillingAccount | undefined,
): InvoiceBreakdown {
  if (invoice.breakdown) return invoice.breakdown
  const visits = invoice.visits ?? 0
  const line = (description: string, units: number, recipient?: string): InvoiceLine => ({
    description,
    recipient,
    units,
    unitLabel: units === 1 ? 'visit' : 'visits',
    rate: RATE_PER_VISIT,
    amount: units * RATE_PER_VISIT,
  })

  let lines: InvoiceLine[]
  const members = account?.members ?? []
  if (members.length > 1) {
    const split = apportion(
      visits,
      members.map((m) => planById[m.planId].unitsPerMonth),
    )
    lines = members.map((m, i) => line('Home care visits', split[i], m.name))
  } else {
    lines = [line(invoice.services ?? 'Home care visits', visits, members[0]?.name)]
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  const adjustments = invoice.insurance
    ? [
        {
          label: `${invoice.insurance.provider} (${Math.round(invoice.insurance.coverageRate * 100)}% coverage)`,
          amount: invoice.amount - subtotal,
        },
      ]
    : []
  return { lines, subtotal, adjustments, total: invoice.amount }
}
