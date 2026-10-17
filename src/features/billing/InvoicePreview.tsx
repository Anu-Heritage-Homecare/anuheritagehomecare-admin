import { useState } from 'react'
import { Check } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import type { BillingAccount } from './accounts'
import { markSent } from './create-invoice'
import { invoiceDocumentHtml, printInvoice } from './invoice-document'
import type { LedgerInvoice } from './ledger'

export function InvoicePreviewDrawer({
  invoice,
  account,
  onClose,
}: {
  invoice: LedgerInvoice | undefined
  account: BillingAccount | undefined
  onClose: () => void
}) {
  return (
    <Drawer open={Boolean(invoice)} onClose={onClose} title="Invoice Preview">
      {invoice && <Preview key={invoice.number} invoice={invoice} account={account} />}
    </Drawer>
  )
}

function Preview({ invoice, account }: { invoice: LedgerInvoice; account: BillingAccount | undefined }) {
  const [height, setHeight] = useState(420)
  const canSend = Boolean(account && account.email !== 'Not recorded')

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 p-4">
        <div className="border-line overflow-hidden rounded-xl border">
          <iframe
            title={`Invoice ${invoice.number}`}
            srcDoc={invoiceDocumentHtml(invoice, account)}
            onLoad={(e) => {
              const doc = e.currentTarget.contentDocument
              if (doc) setHeight(doc.documentElement.scrollHeight)
            }}
            style={{ height }}
            className="block w-full"
          />
        </div>
      </div>
      <div className="border-line bg-surface sticky bottom-0 grid grid-cols-2 gap-3 border-t p-5">
        <button
          type="button"
          onClick={() => printInvoice(invoice, account)}
          className="border-control text-ink hover:bg-sunken inline-flex h-11 items-center justify-center rounded-lg border text-sm font-medium"
        >
          Download PDF
        </button>
        {invoice.sentAt ? (
          <p
            role="status"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700"
          >
            <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Sent
          </p>
        ) : (
          <button
            type="button"
            disabled={!canSend}
            title={canSend ? `Send to ${account?.email}` : 'No email address is recorded for this account.'}
            onClick={() => markSent(invoice.number)}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white"
          >
            Send Invoice
          </button>
        )}
      </div>
    </div>
  )
}
