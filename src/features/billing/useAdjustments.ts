/**
 * The Credits & Adjustments list, fetched from the backend and mapped into the
 * `Adjustment` shape the page table and its drawers already render
 * (`GET /admin/billing/adjustments`). Per category tab counts, the Type filter
 * options and paging all come from the one list response, so filtering and
 * paging move to the backend query params.
 *
 * The write actions (create, approve, reject, reverse) are exposed here as React
 * Query mutations that invalidate the list on success.
 *
 * Money note. The page formats every amount with the NGN only `formatMoney` from
 * data.ts, which takes a whole number unit; the mapper passes `amountMinor / 100`
 * so the figure is right but the symbol is always the naira sign, even for a USD
 * account. The backend carries the real currency per row.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Adjustment,
  AdjustmentKind,
  AdjustmentStatus,
} from './adjustments'

/* --------------------------- backend response ----------------------------- */

type BackendCategory = 'CREDIT' | 'REFUND' | 'WRITE_OFF' | 'ADJUSTMENT'
type BackendStatus =
  | 'PENDING_APPROVAL'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'REVERSED'

interface AdjustmentRowDto {
  id: string
  reference: string
  category: BackendCategory
  type: string
  billingAccountId: string
  billingAccountName: string | null
  amountMinor: number
  currency: string
  reason: string
  status: BackendStatus
  createdAt: string
}

interface AdjustmentCountsDto {
  credits: number
  refunds: number
  writeOffs: number
  adjustments: number
}

interface AdjustmentsListDto {
  adjustments: AdjustmentRowDto[]
  tabs: AdjustmentCountsDto
  types: string[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** The list, mapped to the shapes the page renders. */
export interface AdjustmentsView {
  rows: Adjustment[]
  /**
   * The backend uuid for each row, keyed by its display reference. The page's
   * `Adjustment` is keyed by `ref`, but the write endpoints take the uuid, so
   * the row id is kept alongside rather than forced onto the shared type.
   */
  idByRef: Record<string, string>
  counts: Record<AdjustmentKind, number>
  types: string[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/* ------------------------- query parameter mapping ------------------------ */

export interface AdjustmentsParams {
  /** The active tab maps to the backend category. */
  tab: AdjustmentKind
  search: string
  /** Exact Type value, or 'all'. */
  type: string
  status: AdjustmentStatus | 'all'
  minAmountMinor?: number
  maxAmountMinor?: number
  page: number
}

const CATEGORY: Record<AdjustmentKind, BackendCategory> = {
  credit: 'CREDIT',
  refund: 'REFUND',
  'write-off': 'WRITE_OFF',
  adjustment: 'ADJUSTMENT',
}

const KIND: Record<BackendCategory, AdjustmentKind> = {
  CREDIT: 'credit',
  REFUND: 'refund',
  WRITE_OFF: 'write-off',
  ADJUSTMENT: 'adjustment',
}

/**
 * The backend has five statuses; the page's `AdjustmentStatus` has more labels
 * but the UI only filters on these. `PENDING_APPROVAL` is the page's `pending`,
 * and `COMPLETED`/`PROCESSING` carry across. `applied` is how a completed
 * credit, write off or adjustment reads on the page.
 */
const STATUS_TO_BACKEND: Partial<Record<AdjustmentStatus, BackendStatus>> = {
  pending: 'PENDING_APPROVAL',
  processing: 'PROCESSING',
  completed: 'COMPLETED',
  rejected: 'REJECTED',
  reversed: 'REVERSED',
  applied: 'COMPLETED',
}

/* -------------------------------- helpers --------------------------------- */

/** Minor units to the whole number unit the page money formatter expects. */
const toUnit = (minor: number): number => minor / 100

/**
 * The backend status to the page union. A completed credit, write off or
 * adjustment reads as `applied` (it moved a balance); a completed refund reads
 * as `completed` (money paid out).
 */
function toStatus(status: BackendStatus, kind: AdjustmentKind): AdjustmentStatus {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'pending'
    case 'PROCESSING':
      return 'processing'
    case 'REJECTED':
      return 'rejected'
    case 'REVERSED':
      return 'reversed'
    case 'COMPLETED':
      return kind === 'refund' ? 'completed' : 'applied'
  }
}

/* -------------------------------- mappers --------------------------------- */

function toRow(dto: AdjustmentRowDto): Adjustment {
  const kind = KIND[dto.category]
  return {
    ref: dto.reference,
    kind,
    type: dto.type,
    accountId: dto.billingAccountId,
    amount: toUnit(dto.amountMinor),
    currency: dto.currency,
    at: dto.createdAt.slice(0, 10),
    status: toStatus(dto.status, kind),
    reason: dto.reason,
    // The list row carries no raised by; the office audit is on the detail only.
    raisedBy: '—',
  }
}

function toView(dto: AdjustmentsListDto): AdjustmentsView {
  return {
    rows: dto.adjustments.map(toRow),
    idByRef: Object.fromEntries(dto.adjustments.map((a) => [a.reference, a.id])),
    counts: {
      credit: dto.tabs.credits,
      refund: dto.tabs.refunds,
      'write-off': dto.tabs.writeOffs,
      adjustment: dto.tabs.adjustments,
    },
    types: dto.types,
    page: dto.page,
    pageSize: dto.pageSize,
    total: dto.total,
    totalPages: dto.totalPages,
  }
}

/* --------------------------------- query ---------------------------------- */

export function useAdjustments(params: AdjustmentsParams) {
  const search = params.search.trim()
  return useQuery({
    queryKey: [
      'admin',
      'billing',
      'adjustments',
      params.tab,
      search,
      params.type,
      params.status,
      params.minAmountMinor ?? null,
      params.maxAmountMinor ?? null,
      params.page,
    ] as const,
    queryFn: async () => {
      const query = new URLSearchParams({
        category: CATEGORY[params.tab],
        page: String(params.page),
      })
      if (search) query.set('search', search)
      if (params.type !== 'all') query.set('type', params.type)
      const status = params.status !== 'all' ? STATUS_TO_BACKEND[params.status] : undefined
      if (status) query.set('status', status)
      if (params.minAmountMinor !== undefined) {
        query.set('minAmountMinor', String(params.minAmountMinor))
      }
      if (params.maxAmountMinor !== undefined) {
        query.set('maxAmountMinor', String(params.maxAmountMinor))
      }
      return toView(await api.get<AdjustmentsListDto>(`/admin/billing/adjustments?${query.toString()}`))
    },
    placeholderData: keepPreviousData,
  })
}

/* ------------------------------- mutations -------------------------------- */

/** The create, approve, reject and reverse actions, each refreshing the list. */
export function useAdjustmentMutations() {
  const queryClient = useQueryClient()
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'adjustments'] })

  const approve = useMutation({
    mutationFn: ({ id, approverNotes }: { id: string; approverNotes?: string }) =>
      api.post(`/admin/billing/adjustments/${id}/approve`, { approverNotes }),
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: ({ id, approverNotes }: { id: string; approverNotes?: string }) =>
      api.post(`/admin/billing/adjustments/${id}/reject`, { approverNotes }),
    onSuccess: invalidate,
  })

  const reverse = useMutation({
    mutationFn: (id: string) => api.post(`/admin/billing/adjustments/${id}/reverse`),
    onSuccess: invalidate,
  })

  return { approve, reject, reverse }
}
