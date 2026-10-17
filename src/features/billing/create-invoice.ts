/**
 * Raising an invoice from the Create Invoice wizard.
 *
 * The new invoice joins the receivables book, so the account's statement,
 * the outstanding figures and the invoice page all see it. Like everything
 * else the app writes, it lasts for the session.
 */
import { TODAY } from '@/lib/today'
import type { AccountRecipient, BillingAccount } from './accounts'
import type { BillableLine, Period } from './billable'
import { discountAmount, draftTotals } from './invoice-draft'
import type { DraftAdjustment, DraftDiscount } from './invoice-draft'
import { getInvoice, ledger } from './ledger'
import type { InvoiceLine, LedgerInvoice } from './ledger'
import { nextInvoiceNumber, useBillingSettings } from './settings'
import { bookChanged, useBook } from './book'

/** Re-renders when an invoice is raised or sent, or a payment recorded. */
export const useRaisedInvoices = useBook

const unitLabels: Record<BillableLine['unit'], string> = {
  hour: 'hrs',
  session: 'sessions',
  visit: 'visits',
  fixed: 'flat',
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Issue and due dates for an invoice raised today on the default terms. */
export function invoiceDates(paymentTermsDays: number, today = TODAY): { issuedAt: string; dueAt: string } {
  return { issuedAt: today, dueAt: addDays(today, paymentTermsDays) }
}

export interface InvoiceDraft {
  account: BillingAccount
  recipient: AccountRecipient
  period: Period
  lines: BillableLine[]
  discounts: DraftDiscount[]
  adjustments: DraftAdjustment[]
}

/** Adds the invoice to the book and returns it. */
export function raiseInvoice(
  draft: InvoiceDraft,
  settings: Pick<ReturnType<typeof useBillingSettings>, 'invoicePrefix' | 'paymentTermsDays' | 'taxRatePercent'>,
): LedgerInvoice {
  const subtotal = draft.lines.reduce((sum, l) => sum + l.total, 0)
  const totals = draftTotals(subtotal, draft.discounts, draft.adjustments, settings.taxRatePercent)
  const [y, m] = draft.period.split('-').map(Number)
  const lines: InvoiceLine[] = draft.lines.map((l) => ({
    description: l.label,
    recipient: draft.recipient.name,
    units: l.quantity,
    unitLabel: unitLabels[l.unit],
    rate: l.rate,
    amount: l.total,
  }))

  const invoice: LedgerInvoice = {
    number: nextInvoiceNumber(settings.invoicePrefix),
    kind: 'invoice',
    accountId: draft.account.id,
    account: draft.account.name,
    ...invoiceDates(settings.paymentTermsDays),
    periodStart: `${draft.period}-01`,
    periodEnd: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
    amount: totals.due,
    services: draft.lines.map((l) => l.label).join(', '),
    breakdown: {
      lines,
      subtotal,
      adjustments: [
        ...draft.discounts.map((d) => ({
          label: d.kind === 'percent' ? `${d.label} (${d.value}%)` : d.label,
          amount: -discountAmount(d, subtotal),
        })),
        ...draft.adjustments.map((a) => ({ label: a.label, amount: a.amount })),
        ...(totals.vat > 0 ? [{ label: `VAT (${settings.taxRatePercent}%)`, amount: totals.vat }] : []),
      ],
      total: totals.due,
    },
  }
  ledger.push(invoice)
  bookChanged()
  return invoice
}

/** Records that the invoice went to the account's contact. */
export function markSent(number: string, today = TODAY): void {
  const invoice = getInvoice(number)
  if (!invoice) return
  invoice.sentAt = today
  bookChanged()
}
