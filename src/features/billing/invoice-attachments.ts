import { useSyncExternalStore } from 'react'
import { SIGNED_IN } from '@/lib/session'
import { TODAY } from '@/lib/today'

export interface InvoiceAttachment {
  id: string
  invoice: string
  fileName: string
  kind: string
  sizeBytes: number
  /** ISO date. */
  uploadedAt: string
  uploadedBy: string
  /**
   * An object URL for a file added this session. Fixtures have none — there is
   * no file store — so they can be listed but not opened.
   */
  url?: string
}

const fixtures: InvoiceAttachment[] = [
  {
    id: 'a1',
    invoice: 'INV-2026-143',
    fileName: 'Visit_Log_May1-15_Musa.pdf',
    kind: 'PDF',
    sizeBytes: 412_000,
    uploadedAt: '2026-06-02',
    uploadedBy: 'Sarah Jenkins',
  },
  {
    id: 'a2',
    invoice: 'INV-2026-089',
    fileName: 'MedCare_Claim_MC-789456_Jul1-15.pdf',
    kind: 'PDF',
    sizeBytes: 184_000,
    uploadedAt: '2026-07-16',
    uploadedBy: 'Sarah Jenkins',
  },
  {
    id: 'a3',
    invoice: 'INV-2026-162',
    fileName: 'Resident_Visit_Register_Jul1-15.xlsx',
    kind: 'Excel',
    sizeBytes: 1_200_000,
    uploadedAt: '2026-07-16',
    uploadedBy: 'Sarah Jenkins',
  },
]

const added: InvoiceAttachment[] = []
const removed = new Set<string>()
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInvoiceAttachments(invoice: string): InvoiceAttachment[] {
  useSyncExternalStore(subscribe, () => version, () => version)
  return [...added, ...fixtures]
    .filter((a) => a.invoice === invoice && !removed.has(a.id))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

function kindOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'PDF'
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'Spreadsheet'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'Image'
  return ext ? ext.toUpperCase() : 'File'
}

/** Held in the browser for this session only, as an object URL. */
export function addAttachment(invoice: string, file: File): void {
  added.unshift({
    id: `u${Date.now()}-${added.length}`,
    invoice,
    fileName: file.name,
    kind: kindOf(file.name),
    sizeBytes: file.size,
    uploadedAt: TODAY,
    uploadedBy: SIGNED_IN,
    url: URL.createObjectURL(file),
  })
  emit()
}

export function removeAttachment(id: string): void {
  const own = added.findIndex((a) => a.id === id)
  if (own >= 0) {
    const [gone] = added.splice(own, 1)
    if (gone.url) URL.revokeObjectURL(gone.url)
  } else {
    removed.add(id)
  }
  emit()
}
