/**
 * The care recipient Documents tab, fetched from the backend and mapped into the
 * `CareDocument[]` shape the tab components (table, activity feed) already render.
 * One request (`GET /admin/care-recipients/:id/documents`) powers the tab.
 *
 * The backend supports server side category, search, sort and paging, but the tab
 * already owns a rich client side filter, sort and pagination over the loaded set.
 * To keep that UI intact we fetch a single generous page and let the tab filter and
 * sort over it (the choice noted in the tab). The backend's `displayStatus` is
 * mapped back to a review state plus the expiry date, so the children's existing
 * `effectiveStatus` derivation stays the single source of a document's status.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CareDocument, DocumentCategory, ReviewState } from './documents-data'

/* Big enough that the client side filters see a full library; the tab paginates. */
const PAGE_SIZE = 200

/* --------------------------- backend response ----------------------------- */

interface DocumentItemDto {
  id: string
  name: string
  category: string
  uploadedAt: string
  uploadedByName: string | null
  displayStatus: string
  sizeBytes: number
  expiresAt: string | null
}

export interface DocumentsResponseDto {
  summary: {
    totalDocuments: number
    pendingReview: number
    expiringSoon: number
    lastUploadAt: string | null
  }
  all: number
  categories: { category: string; count: number }[]
  page: {
    items: DocumentItemDto[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  activity: { documentName: string; uploadedByName: string | null; at: string }[]
}

/* -------------------------------- helpers --------------------------------- */

const CATEGORY: Record<string, DocumentCategory> = {
  MEDICAL_RECORDS: 'Medical Records',
  CARE_PLANS: 'Care Plans',
  LEGAL: 'Legal',
  INSURANCE: 'Insurance',
  CERTIFICATIONS: 'Certifications',
  PHOTOS: 'Photos',
}
function toCategory(value: string): DocumentCategory {
  return CATEGORY[value] ?? 'Medical Records'
}

/**
 * Backend `displayStatus` to the review state the tab stores. Expiry is left to
 * `effectiveStatus`, which reads `expiresAt`, so EXPIRING and EXPIRED map to the
 * underlying review (the date drives the chip) rather than being asserted here.
 */
function toReview(value: string): ReviewState {
  switch (value) {
    case 'PENDING':
      return 'pending'
    case 'VERIFIED':
      return 'verified'
    default:
      return 'current'
  }
}

/* -------------------------------- mapper ---------------------------------- */

function toDocuments(dto: DocumentsResponseDto): CareDocument[] {
  return dto.page.items.map((d) => ({
    id: d.id,
    name: d.name,
    category: toCategory(d.category),
    uploadedAt: d.uploadedAt,
    uploadedBy: d.uploadedByName ?? 'Unknown',
    review: toReview(d.displayStatus),
    sizeKb: Math.round(d.sizeBytes / 1024),
    ...(d.expiresAt ? { expiresAt: d.expiresAt } : {}),
  }))
}

export function useRecipientDocuments(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'documents'] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      toDocuments(
        await api.get<DocumentsResponseDto>(
          `/admin/care-recipients/${id}/documents?pageSize=${PAGE_SIZE}`,
        ),
      ),
  })
}
