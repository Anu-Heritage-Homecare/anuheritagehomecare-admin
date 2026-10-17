/**
 * The invoice as a document: one HTML rendering used for the preview panel
 * and for printing to PDF, so what is previewed is what is saved.
 */
import type { BillingAccount } from './accounts'
import { formatMoney } from './data'
import { invoiceBreakdown } from './ledger'
import type { LedgerInvoice } from './ledger'

/** Who issues the invoices, as printed on them. */
export const issuer = {
  name: 'CAREPROFS',
  address: ['12 Medical Road, Ikeja,', 'Lagos, Nigeria'],
  bank: 'First Bank • 1029302910',
  accountName: 'CareProfs Medical Ltd',
}

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmt = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`))

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

/** "₦-72,500", as the designs write a reduction. */
function signed(amount: number): string {
  return amount < 0 ? formatMoney(-amount).replace('₦', '₦-') : formatMoney(amount)
}

export function invoiceDocumentHtml(invoice: LedgerInvoice, account: BillingAccount | undefined): string {
  const b = invoiceBreakdown(invoice, account)
  const multi = b.lines.length > 1 && new Set(b.lines.map((l) => l.recipient)).size > 1
  const billTo = [account?.contact, account?.email !== 'Not recorded' ? account?.email : undefined, account?.phone]
    .filter((x): x is string => Boolean(x) && x !== 'Not recorded')
  const rows = b.lines
    .map(
      (l) => `<tr><td>${esc(l.description)}${multi && l.recipient ? `<span class="sub"> — ${esc(l.recipient)}</span>` : ''}</td>
<td class="num muted">${l.units}</td><td class="num strong">${formatMoney(l.amount)}</td></tr>`,
    )
    .join('')
  const totals = [
    `<tr><td class="muted">Subtotal</td><td class="num strong">${formatMoney(b.subtotal)}</td></tr>`,
    ...b.adjustments.map(
      (a) =>
        `<tr><td class="muted">${esc(a.label)}</td><td class="num strong${a.amount < 0 ? ' red' : ''}">${signed(a.amount)}</td></tr>`,
    ),
    `<tr class="total"><td>Total Due</td><td class="num brand">${formatMoney(b.total)}</td></tr>`,
  ].join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(invoice.number)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font:12px/1.45 Inter,system-ui,sans-serif;color:#111827;background:#fff}
.doc{padding:16px}.row{display:flex;justify-content:space-between;gap:16px}
.brandname{color:#3e64ff;font-weight:700;font-size:13px}.muted{color:#6b7280}.sub{color:#6b7280;font-weight:400}
.label{color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
h1{margin:0;font-size:15px;font-weight:700;text-align:right}.right{text-align:right}
hr{border:0;border-top:1px solid #e5e7eb;margin:12px 0}
table{width:100%;border-collapse:collapse}th{font-weight:600;text-align:left;padding:6px 0;border-bottom:1px solid #e5e7eb}
.items td{padding:8px 0;border-bottom:1px solid #e5e7eb}.num{text-align:right;white-space:nowrap;padding-left:12px}.nowrap{white-space:nowrap}.wrap{overflow-wrap:anywhere;min-width:0}
.strong{font-weight:600}.red{color:#dc2626}.brand{color:#3e64ff;font-weight:700}
.totals{width:auto;min-width:170px;margin-left:auto}.totals td{padding:3px 0}.totals td.num{padding-left:24px}
.totals .total td{border-top:1px solid #e5e7eb;padding-top:8px;font-weight:700}
.bill{font-weight:700;font-size:13px;margin-top:2px}
@media print{.doc{padding:0}}
</style></head><body><div class="doc">
<div class="row"><div><div class="brandname">${issuer.name}</div><div class="muted">${issuer.address.map(esc).join('<br>')}</div></div>
<div><h1>INVOICE</h1><div class="muted right">#${esc(invoice.number)}</div></div></div>
<hr>
<div class="row"><div class="wrap"><div class="label">Bill To</div><div class="bill">${esc(account?.name ?? invoice.account)}</div>
<div class="muted">${billTo.map(esc).join('<br>')}</div></div>
<div class="muted right nowrap">Date: ${fmt(invoice.issuedAt)}<br>Due: ${fmt(invoice.dueAt)}</div></div>
<hr>
<table class="items"><thead><tr><th>Service Description</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="row" style="margin-top:16px;align-items:flex-start;flex-wrap:wrap">
<div><div class="label">Payment Info</div><div class="muted"><span class="nowrap">${esc(issuer.bank)}</span><br>${esc(issuer.accountName)}</div></div>
<table class="totals">${totals}</table></div>
</div></body></html>`
}

/**
 * Opens the browser's print dialog on the invoice, where it can be saved as a
 * PDF. A hidden frame rather than a new window, which pop-up blockers stop.
 */
export function printInvoice(invoice: LedgerInvoice, account: BillingAccount | undefined): void {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  frame.srcdoc = invoiceDocumentHtml(invoice, account)
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    // Printing blocks in most browsers; remove once the dialog has closed.
    setTimeout(() => frame.remove(), 1000)
  }
  document.body.appendChild(frame)
}
