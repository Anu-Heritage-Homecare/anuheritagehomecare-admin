/**
 * The Activity tab, fetched from the backend and mapped into the
 * `ActivityEntry[]` the audit timeline already renders
 * (`GET /admin/care-recipients/:id/activity`).
 *
 * Filtering choice. The tab keeps its existing client side type, range, user
 * and search filters over the mapped rows, so the hook reads a wide window
 * (`days=90`) once and lets the tab narrow it — simpler than re-reading per
 * filter change, and the tab's range select already offers 7/30/90 which all
 * fall inside that window. "All Time" is therefore bounded by 90 days of data;
 * widen the query `days` if the office needs a longer tail.
 *
 * `occurredAt` is split into the date and 24h time the timeline groups and
 * labels on. `category` maps to the activity type; `source` is derived from the
 * backend `type` where it names a known module, else from the category.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ActivityEntry, ActivitySource, ActivityType } from './activity-data'

/* --------------------------- backend response ----------------------------- */

interface ActivityItemDto {
  id: string
  occurredAt: string
  category: string
  type: string
  title: string
  description: string
  performedByName: string | null
  performedByRole: string | null
}

export interface ActivityDto {
  windowDays: number
  users: string[]
  page: {
    items: ActivityItemDto[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

/* -------------------------------- helpers --------------------------------- */

const TYPE: Record<string, ActivityType> = {
  VISITS: 'visits',
  MEDICAL: 'medical',
  ADMINISTRATIVE: 'administrative',
  BILLING: 'billing',
}

function toType(category: string): ActivityType {
  return TYPE[category.toUpperCase()] ?? 'administrative'
}

const SOURCES: ActivitySource[] = [
  'Visits',
  'Notes',
  'Health',
  'Medications',
  'Documents',
  'Billing',
  'Care Plan',
  'Caregivers',
  'Family',
]

/** The source is which module the entry came from, by activity type. */
const SOURCE_BY_TYPE: Record<ActivityType, ActivitySource> = {
  visits: 'Visits',
  medical: 'Health',
  administrative: 'Care Plan',
  billing: 'Billing',
}

/** Prefer an explicit backend `type` that names a known module, else the type. */
function toSource(backendType: string, activityType: ActivityType): ActivitySource {
  return (
    SOURCES.find((s) => s.toLowerCase() === backendType.toLowerCase()) ??
    SOURCE_BY_TYPE[activityType]
  )
}

/* -------------------------------- mapper ---------------------------------- */

function toEntry(dto: ActivityItemDto): ActivityEntry {
  const type = toType(dto.category)
  return {
    id: dto.id,
    source: toSource(dto.type, type),
    date: dto.occurredAt.slice(0, 10),
    time: dto.occurredAt.slice(11, 16),
    title: dto.title,
    detail: dto.description,
    actor: dto.performedByName ?? 'System',
    actorRole: dto.performedByRole ?? '—',
    type,
  }
}

export function useRecipientActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'activity'] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      (
        await api.get<ActivityDto>(`/admin/care-recipients/${id}/activity?days=90`)
      ).page.items.map(toEntry),
  })
}
