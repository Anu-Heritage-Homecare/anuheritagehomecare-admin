/**
 * Files held against a billing account. Metadata only — there is no file
 * store behind the prototype, so View and Download have nothing to open.
 */
export interface AccountDocument {
  id: string
  title: string
  fileName: string
  /** ISO. */
  uploadedAt: string
  sizeBytes: number
}

/*
 * Keyed by account id. Each is dated on or after the account opened (see
 * accounts.ts) — an ID check filed before the account existed would be wrong.
 * Accounts with nothing on file are simply absent.
 */
const documents: Record<string, AccountDocument[]> = {
  'acc-adeyemi': [
    { id: 'doc-ade-1', title: 'ID Verification', fileName: 'ACC-1001_ID_Adeyemi_Funmilayo.pdf', uploadedAt: '2025-01-12', sizeBytes: 4_400_000 },
    { id: 'doc-ade-2', title: 'Service Agreement', fileName: 'ACC-1001_Service_Agreement.pdf', uploadedAt: '2025-01-12', sizeBytes: 1_250_000 },
    { id: 'doc-ade-3', title: 'Care Plan Addendum', fileName: 'ACC-1001_Addendum_Adeyemi_Snr.pdf', uploadedAt: '2025-06-01', sizeBytes: 640_000 },
  ],
  'acc-okafor': [
    { id: 'doc-oka-1', title: 'ID Verification', fileName: 'ACC-1002_ID_Okafor_Chinedu.pdf', uploadedAt: '2025-06-03', sizeBytes: 3_100_000 },
    { id: 'doc-oka-2', title: 'Service Agreement', fileName: 'ACC-1002_Service_Agreement.pdf', uploadedAt: '2025-06-03', sizeBytes: 1_180_000 },
  ],
  'acc-babalola': [
    { id: 'doc-bab-1', title: 'Facility Contract', fileName: 'ACC-1003_Facility_Contract.pdf', uploadedAt: '2024-11-20', sizeBytes: 2_800_000 },
    { id: 'doc-bab-2', title: 'CAC Certificate', fileName: 'ACC-1003_CAC_Certificate.pdf', uploadedAt: '2024-11-20', sizeBytes: 920_000 },
    { id: 'doc-bab-3', title: 'Resident Schedule', fileName: 'ACC-1003_Resident_Schedule_2026.xlsx', uploadedAt: '2026-03-02', sizeBytes: 86_000 },
  ],
  'acc-bello': [
    { id: 'doc-bel-1', title: 'Trust Deed', fileName: 'ACC-1004_Trust_Deed.pdf', uploadedAt: '2025-09-08', sizeBytes: 5_600_000 },
    { id: 'doc-bel-2', title: 'Payment Plan Letter', fileName: 'ACC-1004_Payment_Plan_Letter.pdf', uploadedAt: '2026-07-21', sizeBytes: 210_000 },
  ],
  'acc-eze': [
    { id: 'doc-eze-1', title: 'ID Verification', fileName: 'ACC-1005_ID_Eze_Nkechi.pdf', uploadedAt: '2026-02-17', sizeBytes: 3_900_000 },
  ],
  'acc-musa': [
    { id: 'doc-mus-1', title: 'ID Verification', fileName: 'ACC-1006_ID_Musa_Ibrahim.pdf', uploadedAt: '2025-12-01', sizeBytes: 2_700_000 },
    { id: 'doc-mus-2', title: 'Invoice Dispute — INV-2026-143', fileName: 'ACC-1006_Dispute_INV-2026-143.pdf', uploadedAt: '2026-06-02', sizeBytes: 180_000 },
  ],
  'acc-cr-001': [
    { id: 'doc-joh-1', title: 'Insurance Card — MedCare Plus', fileName: 'ACC-CR-001_MedCare_MC-789456.pdf', uploadedAt: '2026-03-15', sizeBytes: 540_000 },
  ],
}

export function accountDocuments(accountId: string): AccountDocument[] {
  return [...(documents[accountId] ?? [])].sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt),
  )
}

/** 4.4 MB / 86 KB / 5 B. Decimal units, as file managers show them. */
export function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`
  return `${bytes} B`
}
