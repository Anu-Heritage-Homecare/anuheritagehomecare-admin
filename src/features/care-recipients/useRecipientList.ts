/**
 * The Care Recipients directory, fetched from the backend and mapped into the
 * shapes the directory components already render. The server owns the filter tab,
 * search, sort and pagination; the summary cards, filter pill counts and action
 * trigger counts all come from the one list response.
 *
 * The static `recipients`, `summaries` and `triggers` consts in data.ts are kept
 * (other features import them), but this screen now reads live data through here.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CareLevel, Priority, RecipientStatus } from '@/types'
import type { DirectoryFilter } from './DirectoryToolbar'
import type { Recipient, Summary, Trigger } from './data'

/* --------------------------- backend response ----------------------------- */

interface ListItemDto {
  id: string
  code: string
  name: string
  photoKey: string | null
  age: number
  primaryCondition: string | null
  careLevel: string | null
  assignedCaregiverName: string | null
  status: string
  priority: string
  lastVisitAt: string | null
}

interface ListResponseDto {
  summary: {
    total: number
    active: number
    onHold: number
    discharged: number
    newThisMonth: number
    activePercent: number
  }
  tabs: {
    all: number
    active: number
    onHold: number
    highPriority: number
    newlyAdded: number
  }
  actionTriggers: {
    needsAttention: number
    missingCarePlan: number
    overdueVisit: number
  }
  items: ListItemDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** The directory, mapped to the shapes the components render. */
export interface RecipientListView {
  summaries: Summary[]
  triggers: Trigger[]
  tabCounts: Record<DirectoryFilter, number>
  rows: Recipient[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/* ------------------------- query parameter mapping ------------------------ */

export interface RecipientListParams {
  filter: DirectoryFilter
  search: string
  page: number
}

const TAB: Record<DirectoryFilter, string> = {
  all: 'ALL',
  active: 'ACTIVE',
  'on-hold': 'ON_HOLD',
  'high-priority': 'HIGH_PRIORITY',
  new: 'NEW',
}

/* -------------------------------- helpers --------------------------------- */

const PRIORITIES: Priority[] = ['critical', 'urgent', 'high', 'medium', 'normal', 'low']
function toPriority(value: string): Priority {
  const lower = value.toLowerCase()
  return PRIORITIES.find((p) => p === lower) ?? 'normal'
}

/** Backend status (DRAFT is surfaced as NEW by the list) to the UI union. */
function toStatus(value: string): RecipientStatus {
  switch (value) {
    case 'ACTIVE':
      return 'active'
    case 'ON_HOLD':
      return 'on-hold'
    case 'DISCHARGED':
      return 'discharged'
    default:
      return 'new'
  }
}

const CARE_LEVELS: CareLevel[] = ['Full-Time', 'Part-Time', 'Hourly', '24-Hour']
/** The backend already emits the UI care level labels; fall back if it changes. */
function toCareLevel(value: string | null): CareLevel {
  const match = CARE_LEVELS.find((level) => level === value)
  return match ?? 'Hourly'
}

/** An ISO timestamp to a short, local "last visit" label. */
function formatLastVisit(iso: string | null): string | null {
  if (iso === null) return null
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/* -------------------------------- mappers --------------------------------- */

function toSummaries(dto: ListResponseDto): Summary[] {
  const { summary } = dto
  return [
    {
      id: 'total',
      label: 'Total Care Recipients',
      value: String(summary.total),
      meta: summary.newThisMonth > 0 ? `+${summary.newThisMonth} this month` : 'this month',
      metaTone: 'green',
      hint: 'Active and pipeline recipients',
    },
    {
      id: 'active',
      label: 'Active',
      value: String(summary.active),
      meta: `${summary.activePercent}% of total`,
      metaTone: 'blue',
      hint: 'Receiving ongoing care services',
    },
    {
      id: 'on-hold',
      label: 'On Hold',
      value: String(summary.onHold),
      meta: 'Temporarily paused',
      metaTone: 'amber',
      hint: 'Awaiting clinical clearance',
    },
    {
      id: 'discharged',
      label: 'Discharged',
      value: String(summary.discharged),
      meta: 'Care completed',
      metaTone: 'blue',
      hint: 'Completed care transition',
    },
  ]
}

function toTriggers(dto: ListResponseDto): Trigger[] {
  const { actionTriggers } = dto
  return [
    { id: 'attention', label: 'Needs Attention', count: actionTriggers.needsAttention, tone: 'red' },
    { id: 'care-plan', label: 'Missing Care Plan', count: actionTriggers.missingCarePlan, tone: 'amber' },
    { id: 'overdue', label: 'Overdue Visit', count: actionTriggers.overdueVisit, tone: 'slate' },
  ]
}

function toTabCounts(dto: ListResponseDto): Record<DirectoryFilter, number> {
  return {
    all: dto.tabs.all,
    active: dto.tabs.active,
    'on-hold': dto.tabs.onHold,
    'high-priority': dto.tabs.highPriority,
    new: dto.tabs.newlyAdded,
  }
}

function toRows(dto: ListResponseDto): Recipient[] {
  return dto.items.map((item) => ({
    id: item.id,
    ref: `#${item.code}`,
    name: item.name,
    age: item.age,
    condition: item.primaryCondition ?? '—',
    careLevel: toCareLevel(item.careLevel),
    caregiver: item.assignedCaregiverName,
    status: toStatus(item.status),
    priority: toPriority(item.priority),
    lastVisit: formatLastVisit(item.lastVisitAt),
  }))
}

function toView(dto: ListResponseDto): RecipientListView {
  return {
    summaries: toSummaries(dto),
    triggers: toTriggers(dto),
    tabCounts: toTabCounts(dto),
    rows: toRows(dto),
    page: dto.page,
    pageSize: dto.pageSize,
    total: dto.total,
    totalPages: dto.totalPages,
  }
}

export function useRecipientList(params: RecipientListParams) {
  const search = params.search.trim()
  return useQuery({
    queryKey: ['admin', 'care-recipients', 'list', params.filter, search, params.page] as const,
    queryFn: async () => {
      const query = new URLSearchParams({ tab: TAB[params.filter], page: String(params.page) })
      if (search) query.set('search', search)
      return toView(await api.get<ListResponseDto>(`/admin/care-recipients?${query.toString()}`))
    },
    placeholderData: keepPreviousData,
  })
}
