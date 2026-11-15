/**
 * The Billing Accounts list, fetched from the backend and mapped into the row
 * shape the page table renders (`GET /admin/billing/accounts`). Per tab counts,
 * the Branch filter options and paging all come from the one list response, so
 * the tab, search, branch and balance range move to the backend query params.
 *
 * Money note. The page formats the outstanding balance with the NGN only
 * `formatMoney` from data.ts, which takes a whole number unit; the mapper passes
 * `outstandingMinor / 100` so the figure is right but the symbol is always the
 * naira sign. The backend carries the real currency per row.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AccountStatus } from './ledger'

/* --------------------------- backend response ----------------------------- */

interface AccountRowDto {
  id: string
  reference: string
  accountName: string
  primaryContact: string
  phone: string | null
  branch: string | null
  recipientCount: number
  outstandingMinor: number
  currency: string | null
  lastPaymentAt: string | null
  /** FamilyMemberStatus: ACTIVE | INACTIVE | PENDING_VERIFICATION. */
  status: string
  /** CURRENT | NONE | OVERDUE | PENDING. */
  billingStatus: string
}

interface AccountsTabCountsDto {
  all: number
  outstanding: number
  inactive: number
}

interface AccountsListDto {
  tabs: AccountsTabCountsDto
  branches: string[]
  accounts: AccountRowDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** One account row, mapped for the page table. */
export interface AccountRow {
  id: string
  name: string
  contact: string
  phone: string
  recipients: number
  /** Whole currency units, for the NGN formatter. */
  outstanding: number
  lastPaymentAt: string | null
  status: AccountStatus
}

export type AccountTab = 'all' | 'outstanding' | 'inactive'

/** The list, mapped to the shapes the page renders. */
export interface AccountsView {
  rows: AccountRow[]
  counts: Record<AccountTab, number>
  branches: string[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/* ------------------------- query parameter mapping ------------------------ */

export interface AccountsParams {
  tab: AccountTab
  search: string
  branch: string
  minBalanceMinor?: number
  maxBalanceMinor?: number
  page: number
}

const TAB: Record<AccountTab, 'ALL' | 'OUTSTANDING' | 'INACTIVE'> = {
  all: 'ALL',
  outstanding: 'OUTSTANDING',
  inactive: 'INACTIVE',
}

/* -------------------------------- helpers --------------------------------- */

const toUnit = (minor: number): number => minor / 100

/**
 * The page's three way status: overdue when a pending invoice is past due,
 * inactive when the family member is inactive, active otherwise.
 */
function toStatus(dto: AccountRowDto): AccountStatus {
  if (dto.billingStatus === 'OVERDUE') return 'overdue'
  if (dto.status === 'INACTIVE') return 'inactive'
  return 'active'
}

/* -------------------------------- mappers --------------------------------- */

function toRow(dto: AccountRowDto): AccountRow {
  return {
    id: dto.id,
    name: dto.accountName,
    contact: dto.primaryContact,
    phone: dto.phone ?? '—',
    recipients: dto.recipientCount,
    outstanding: toUnit(dto.outstandingMinor),
    lastPaymentAt: dto.lastPaymentAt,
    status: toStatus(dto),
  }
}

function toView(dto: AccountsListDto): AccountsView {
  return {
    rows: dto.accounts.map(toRow),
    counts: {
      all: dto.tabs.all,
      outstanding: dto.tabs.outstanding,
      inactive: dto.tabs.inactive,
    },
    branches: dto.branches,
    page: dto.page,
    pageSize: dto.pageSize,
    total: dto.total,
    totalPages: dto.totalPages,
  }
}

/* --------------------------------- query ---------------------------------- */

export function useBillingAccounts(params: AccountsParams) {
  const search = params.search.trim()
  return useQuery({
    queryKey: [
      'admin',
      'billing',
      'accounts',
      params.tab,
      search,
      params.branch,
      params.minBalanceMinor ?? null,
      params.maxBalanceMinor ?? null,
      params.page,
    ] as const,
    queryFn: async () => {
      const query = new URLSearchParams({ tab: TAB[params.tab], page: String(params.page) })
      if (search) query.set('search', search)
      if (params.branch !== 'all') query.set('branch', params.branch)
      if (params.minBalanceMinor !== undefined) {
        query.set('minBalanceMinor', String(params.minBalanceMinor))
      }
      if (params.maxBalanceMinor !== undefined) {
        query.set('maxBalanceMinor', String(params.maxBalanceMinor))
      }
      return toView(await api.get<AccountsListDto>(`/admin/billing/accounts?${query.toString()}`))
    },
    placeholderData: keepPreviousData,
  })
}
