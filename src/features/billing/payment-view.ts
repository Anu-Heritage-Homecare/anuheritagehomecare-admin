/** Shared by the payment table and the Payment Details panel. */
import type { BillingAccount } from './accounts'
import { formatMoney } from './data'
import type { TransactionStatus } from './data'
import type { AccountPayment } from './ledger'

export const paymentStatus: Record<
  TransactionStatus,
  { label: string; tone: 'green' | 'amber' | 'blue' | 'red' }
> = {
  succeeded: { label: 'Completed', tone: 'green' },
  pending: { label: 'Pending', tone: 'amber' },
  processing: { label: 'Processing', tone: 'blue' },
  failed: { label: 'Failed', tone: 'red' },
}

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "18 Jul 2026". The log is dated, not timed, so no clock time is shown. */
export function formatDay(iso: string): string {
  return day.format(new Date(`${iso}T00:00:00Z`))
}

/** A plain HTML receipt, generated in the browser and saved by the viewer. */
export function downloadReceipt(p: AccountPayment, account: BillingAccount): void {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
  const rows: [string, string][] = [
    ['Receipt for', p.txId ?? `Payment for ${p.reference}`],
    ['Billing account', `${account.name} (${account.ref})`],
    ['Pays for', p.reference],
    ['Amount', formatMoney(p.amount)],
    ['Method', p.method ?? 'Not recorded'],
    ...(p.bank ? ([['Bank', p.bank]] as [string, string][]) : []),
    ...(p.externalRef ? ([['Bank reference', p.externalRef]] as [string, string][]) : []),
    ['Date paid', formatDay(p.at)],
  ]
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(p.txId ?? p.reference)}</title>
<style>body{font:14px system-ui,sans-serif;color:#111827;max-width:560px;margin:40px auto;padding:0 16px}h1{font-size:20px}td{padding:6px 0}td:last-child{text-align:right;font-weight:600}table{width:100%;border-collapse:collapse}tr{border-bottom:1px solid #e5e7eb}</style>
</head><body><h1>CareProfs — Payment Receipt</h1><table>${rows
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')}</table></body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `receipt-${p.txId ?? p.reference}.html`
  a.click()
  URL.revokeObjectURL(url)
}

