/**
 * The org wide Invoices list, fetched from the backend and mapped into the row
 * shape the page table renders (`GET /admin/billing/invoices`). Status tab
 * counts, the billing account filter options and paging all come from the one
 * list response, so filtering and paging move to the backend query params.
 *
 * Deleting a draft is exposed as a mutation that invalidates the list.
 *
 * Money note. The page formats the amount with the NGN only `formatMoney` from
 * data.ts, which takes a whole number unit; the mapper passes `amountMinor / 100`
 * so the figure is right but the symbol is always the naira sign. The backend
 * carries the real currency per row.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { StatementStatus } from './ledger'

/* --------------------------- backend response ----------------------------- */

type BackendInvoiceStatus =
  | 'DRAFT'
  | 'AWAITING_PAYMENT'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'PAID'
  | 'CANCELLED'
  | 'WRITTEN_OFF'

interface InvoiceRowDto {
  id: string
  number: string
  billingAccountId: string | null
  billingAccountName: string | null
  careRecipientName: string
  amountMinor: number
  currency: string
  dueDate: string | null
  status: BackendInvoiceStatus
}

interface InvoiceCountsDto {
  all: number
  draft: number
  awaitingPayment: number
  partiallyPaid: number
  overdue: number
  paid: number
  cancelled: number
  writtenOff: number
}

interface InvoicesListDto {
  invoices: InvoiceRowDto[]
  tabs: InvoiceCountsDto
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** One invoice row, mapped for the page table. */
export interface InvoiceRow {
  /** The backend uuid, for the row actions. */
  id: string
  number: string
  billingAccountId: string | null
  account: string
  recipient: string
  /** Whole currency units. */
  amount: number
  currency: string
  dueDate: string | null
  status: StatementStatus
}

/** The tabs the page draws (archived is dropped: the backend has no archive). */
export type InvoiceTab = 'all' | 'draft' | 'due' | 'overdue' | 'paid'

/** The list, mapped to the shapes the page renders. */
export interface InvoicesView {
  rows: InvoiceRow[]
  counts: Record<InvoiceTab, number>
  /** Billing account filter options gathered from the current page. */
  accounts: { value: string; label: string }[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/* ------------------------- query parameter mapping ------------------------ */

export interface InvoicesParams {
  tab: InvoiceTab
  search: string
  /** A billing account uuid, or 'all'. */
  accountId: string
  dueFrom?: string
  dueTo?: string
  page: number
}

/** The tab a page view sits on, as the backend status filter. */
const TAB_STATUS: Record<InvoiceTab, BackendInvoiceStatus | undefined> = {
  all: undefined,
  draft: 'DRAFT',
  due: 'AWAITING_PAYMENT',
  overdue: 'OVERDUE',
  paid: 'PAID',
}

/* -------------------------------- helpers --------------------------------- */

const toUnit = (minor: number): number => minor / 100

/** The backend status to the page's statement status union. */
function toStatus(status: BackendInvoiceStatus): StatementStatus {
  switch (status) {
    case 'DRAFT':
      return 'draft'
    case 'AWAITING_PAYMENT':
    case 'PARTIALLY_PAID':
      return 'due'
    case 'OVERDUE':
      return 'overdue'
    case 'PAID':
      return 'paid'
    case 'CANCELLED':
      return 'cancelled'
    case 'WRITTEN_OFF':
      return 'closed'
  }
}

/* -------------------------------- mappers --------------------------------- */

function toRow(dto: InvoiceRowDto): InvoiceRow {
  return {
    id: dto.id,
    number: dto.number,
    billingAccountId: dto.billingAccountId,
    account: dto.billingAccountName ?? '—',
    recipient: dto.careRecipientName,
    amount: toUnit(dto.amountMinor),
    currency: dto.currency,
    dueDate: dto.dueDate,
    status: toStatus(dto.status),
  }
}

function toView(dto: InvoicesListDto): InvoicesView {
  const rows = dto.invoices.map(toRow)
  const accountMap = new Map<string, string>()
  for (const r of rows) {
    if (r.billingAccountId) accountMap.set(r.billingAccountId, r.account)
  }
  return {
    rows,
    counts: {
      all: dto.tabs.all,
      draft: dto.tabs.draft,
      due: dto.tabs.awaitingPayment + dto.tabs.partiallyPaid,
      overdue: dto.tabs.overdue,
      paid: dto.tabs.paid,
    },
    accounts: [...accountMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label })),
    page: dto.page,
    pageSize: dto.pageSize,
    total: dto.total,
    totalPages: dto.totalPages,
  }
}

/* --------------------------------- query ---------------------------------- */

export function useInvoices(params: InvoicesParams) {
  const search = params.search.trim()
  return useQuery({
    queryKey: [
      'admin',
      'billing',
      'invoices',
      params.tab,
      search,
      params.accountId,
      params.dueFrom ?? null,
      params.dueTo ?? null,
      params.page,
    ] as const,
    queryFn: async () => {
      const query = new URLSearchParams({ page: String(params.page) })
      const status = TAB_STATUS[params.tab]
      if (status) query.set('status', status)
      if (search) query.set('search', search)
      if (params.accountId !== 'all') query.set('billingAccountId', params.accountId)
      if (params.dueFrom) query.set('dueFrom', params.dueFrom)
      if (params.dueTo) query.set('dueTo', params.dueTo)
      return toView(await api.get<InvoicesListDto>(`/admin/billing/invoices?${query.toString()}`))
    },
    placeholderData: keepPreviousData,
  })
}

/** Delete a draft invoice, refreshing the list on success. */
export function useDeleteDraftInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/billing/invoices/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'invoices'] }),
  })
}
