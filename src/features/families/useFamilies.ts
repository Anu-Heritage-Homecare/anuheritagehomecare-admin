/**
 * The Families directory, fetched from the backend and mapped into the shapes
 * the Families screen renders. Three reads power the screen: the KPI bar
 * (`GET /admin/families/kpis`), the paginated table (`GET /admin/families`) and
 * the quick preview drawer (`GET /admin/families/:id`). The mutations the screen
 * exposes (add, import, bulk status, notes, status, emergency verified, primary
 * recipient, contact) each invalidate the affected reads.
 *
 * Fields the backend does not model are left off rather than faked: the rich
 * communication log, access level, preferred channel and linked plans the static
 * mock derived from other contexts have no backend source, so the preview shows
 * only what the directory actually knows.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Tone } from '@/types'

/* --------------------------- backend response ----------------------------- */

interface FamilyRowDto {
  id: string
  reference: string
  name: string
  relationship: string | null
  hasAccount: boolean
  phone: string | null
  email: string | null
  linkedRecipientNames: string[]
  billingStatus: string
  status: string
  unreadMessages: number | null
  lastActivity: string
}

interface FamilyListDto {
  total: number
  page: number
  pageSize: number
  rows: FamilyRowDto[]
}

interface FamilyKpisDto {
  totalFamilies: number
  newFamilies: number
  primaryContacts: number
  withActiveCare: number
  outstandingPayments: number
  pendingRequests: number
  unreadMessages: number | null
}

interface FamilyDetailDto {
  id: string
  reference: string
  name: string
  relationship: string | null
  hasAccount: boolean
  phone: string | null
  email: string | null
  primaryRecipientName: string | null
  linkedRecipientNames: string[]
  emergencyContactVerified: boolean
  outstandingBalanceMinor: number
  currency: string | null
  billingStatus: string
  status: string
  quickNotes: string | null
  lastActivity: string
  unreadMessages: number | null
}

/* ----------------------------- UI view shapes ----------------------------- */

export type AccountStatus = 'active' | 'inactive' | 'pending'
export type BillingState = 'current' | 'overdue' | 'pending' | 'none'

/** One row of the directory table, in the shape the table renders. */
export interface FamilyAccount {
  id: string
  ref: string
  name: string
  relationship: string | null
  phone: string
  email: string
  linkedNames: string[]
  status: AccountStatus
  billing: BillingState
  unread: number
  lastActivity: string
}

/** The quick preview drawer detail. */
export interface FamilyDetail extends FamilyAccount {
  hasAccount: boolean
  primaryRecipientName: string | null
  emergencyVerified: boolean
  outstandingBalanceMinor: number
  currency: string | null
  quickNotes: string | null
}

export interface FamilyKpis {
  totalFamilies: number
  newFamilies: number
  primaryContacts: number
  withActiveCare: number
  outstandingPayments: number
  pendingRequests: number
  unreadMessages: number | null
}

/* --------------------------------- labels --------------------------------- */

export const statusLabels: Record<AccountStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending verification',
}

export const statusTones: Record<AccountStatus, Tone> = {
  active: 'green',
  inactive: 'slate',
  pending: 'amber',
}

export const billingLabels: Record<BillingState, string> = {
  current: 'Current',
  overdue: 'Overdue',
  pending: 'Pending',
  none: 'No account',
}

export const billingTones: Record<BillingState, Tone> = {
  current: 'green',
  overdue: 'red',
  pending: 'amber',
  none: 'slate',
}

/** The row forms of the status words; the filter chips carry the full ones. */
export const shortStatus: Record<AccountStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
}

/** The tab/filter value an admin can pick, mapped to the backend status enum. */
export type StatusFilter = 'all' | AccountStatus
const STATUS_TO_BACKEND: Record<AccountStatus, string> = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
  pending: 'PENDING_VERIFICATION',
}

/* -------------------------------- helpers --------------------------------- */

function toAccountStatus(value: string): AccountStatus {
  switch (value) {
    case 'ACTIVE':
      return 'active'
    case 'PENDING_VERIFICATION':
      return 'pending'
    default:
      return 'inactive'
  }
}

function toBillingState(value: string): BillingState {
  switch (value) {
    case 'CURRENT':
      return 'current'
    case 'OVERDUE':
      return 'overdue'
    case 'PENDING':
      return 'pending'
    default:
      return 'none'
  }
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const DAY_MS = 86_400_000

/** Relative inside the week, absolute beyond it; "No activity" when absent. */
export function formatActivity(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'No activity'
  const days = Math.max(0, Math.floor((Date.now() - at.getTime()) / DAY_MS))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return dayFormat.format(at)
}

/** Minor units to a plain grouped amount; currency symbol left to the caller. */
export function formatMoney(minor: number, currency: string | null): string {
  const major = (minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${currency} ${major}` : major
}

/* -------------------------------- mappers --------------------------------- */

function toAccount(row: FamilyRowDto): FamilyAccount {
  return {
    id: row.id,
    ref: row.reference,
    name: row.name,
    relationship: row.relationship,
    phone: row.phone ?? '—',
    email: row.email ?? '—',
    linkedNames: row.linkedRecipientNames,
    status: toAccountStatus(row.status),
    billing: toBillingState(row.billingStatus),
    unread: row.unreadMessages ?? 0,
    lastActivity: row.lastActivity,
  }
}

export interface FamiliesView {
  rows: FamilyAccount[]
  total: number
  page: number
  pageSize: number
}

function toView(dto: FamilyListDto): FamiliesView {
  return {
    rows: dto.rows.map(toAccount),
    total: dto.total,
    page: dto.page,
    pageSize: dto.pageSize,
  }
}

function toDetail(dto: FamilyDetailDto): FamilyDetail {
  return {
    ...toAccount(dto),
    hasAccount: dto.hasAccount,
    primaryRecipientName: dto.primaryRecipientName,
    emergencyVerified: dto.emergencyContactVerified,
    outstandingBalanceMinor: dto.outstandingBalanceMinor,
    currency: dto.currency,
    quickNotes: dto.quickNotes,
  }
}

/* --------------------------------- queries -------------------------------- */

export const PAGE_SIZE = 20

export interface FamiliesParams {
  status: StatusFilter
  page: number
}

export function useFamilyKpis() {
  return useQuery({
    queryKey: ['admin', 'families', 'kpis'],
    queryFn: async (): Promise<FamilyKpis> =>
      api.get<FamilyKpisDto>('/admin/families/kpis'),
  })
}

export function useFamilies(params: FamiliesParams) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
  })
  if (params.status !== 'all') {
    search.set('status', STATUS_TO_BACKEND[params.status])
  }
  return useQuery({
    queryKey: ['admin', 'families', 'list', params.status, params.page],
    queryFn: async (): Promise<FamiliesView> =>
      toView(await api.get<FamilyListDto>(`/admin/families?${search.toString()}`)),
  })
}

export function useFamilyDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'families', 'detail', id],
    queryFn: async (): Promise<FamilyDetail> =>
      toDetail(await api.get<FamilyDetailDto>(`/admin/families/${id as string}`)),
    enabled: Boolean(id),
  })
}

/* -------------------------------- mutations ------------------------------- */

/** The captured contact fields for add and edit. */
export interface ContactInput {
  fullName: string
  phone?: string
  email?: string
  relationship?: string
  primaryRecipientId?: string
}

type Invalidate = () => void

function useInvalidateFamilies(): Invalidate {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['admin', 'families'] })
  }
}

export function useAddFamily(): UseMutationResult<{ id: string }, Error, ContactInput> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (body: ContactInput) => api.post<{ id: string }>('/admin/families', body),
    onSuccess: invalidate,
  })
}

export function useImportFamilies(): UseMutationResult<
  { created: number },
  Error,
  ContactInput[]
> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (families: ContactInput[]) =>
      api.post<{ created: number }>('/admin/families/import', { families }),
    onSuccess: invalidate,
  })
}

export interface BulkStatusInput {
  ids: string[]
  status: AccountStatus
}

export function useBulkEditFamilies(): UseMutationResult<unknown, Error, BulkStatusInput> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (input: BulkStatusInput) =>
      api.post('/admin/families/bulk', {
        ids: input.ids,
        status: STATUS_TO_BACKEND[input.status],
      }),
    onSuccess: invalidate,
  })
}

export function useSetFamilyNotes(): UseMutationResult<
  void,
  Error,
  { id: string; quickNotes: string | null }
> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (input: { id: string; quickNotes: string | null }) =>
      api.put<void>(`/admin/families/${input.id}/notes`, { quickNotes: input.quickNotes }),
    onSuccess: invalidate,
  })
}

export function useSetFamilyStatus(): UseMutationResult<
  void,
  Error,
  { id: string; status: AccountStatus }
> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (input: { id: string; status: AccountStatus }) =>
      api.put<void>(`/admin/families/${input.id}/status`, {
        status: STATUS_TO_BACKEND[input.status],
      }),
    onSuccess: invalidate,
  })
}

export function useSetEmergencyVerified(): UseMutationResult<
  void,
  Error,
  { id: string; verified: boolean }
> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (input: { id: string; verified: boolean }) =>
      api.put<void>(`/admin/families/${input.id}/emergency-verified`, {
        verified: input.verified,
      }),
    onSuccess: invalidate,
  })
}

export function useSetPrimaryRecipient(): UseMutationResult<
  void,
  Error,
  { id: string; recipientId: string | null }
> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (input: { id: string; recipientId: string | null }) =>
      api.put<void>(`/admin/families/${input.id}/primary-recipient`, {
        recipientId: input.recipientId,
      }),
    onSuccess: invalidate,
  })
}

export function useSetFamilyContact(): UseMutationResult<
  void,
  Error,
  { id: string; contact: ContactInput }
> {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (input: { id: string; contact: ContactInput }) =>
      api.put<void>(`/admin/families/${input.id}/contact`, input.contact),
    onSuccess: invalidate,
  })
}
