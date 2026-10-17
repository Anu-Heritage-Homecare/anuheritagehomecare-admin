import { TriangleAlert } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { deleteDraft } from './delete-draft'

export function DeleteDraftDialog({
  invoice,
  open,
  onClose,
  onDeleted,
}: {
  invoice: string
  open: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  return (
    <Drawer open={open} onClose={onClose} title={`Delete draft invoice ${invoice}`} placement="center" bare>
      <div className="p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50">
          <TriangleAlert className="size-5.5 text-red-600" strokeWidth={2} aria-hidden="true" />
        </span>
        <p aria-hidden="true" className="text-ink mt-4 text-lg font-bold tracking-tight">
          Delete Draft Invoice
        </p>
        <p className="text-ink-muted mt-2 text-sm">
          Are you sure you want to delete draft invoice
          <br />
          <strong className="text-ink font-semibold">{invoice}</strong>?
          <br />
          This draft has not been sent and can be safely deleted.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="border-control text-ink hover:bg-sunken bg-surface inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium"
          >
            Keep Draft
          </button>
          <button
            type="button"
            onClick={() => {
              if (deleteDraft(invoice)) onDeleted()
              else onClose()
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete Draft
          </button>
        </div>
      </div>
    </Drawer>
  )
}
