/**
 * The Billing Account detail screen, fetched from the backend. One hook per tab,
 * each mapping its endpoint into the shapes the page already renders:
 *   - overview  GET /admin/billing/accounts/:id
 *   - recipients GET /admin/billing/accounts/:id/care-recipients
 *   - invoices  GET /admin/billing/accounts/:id/invoices
 *   - payments  GET /admin/billing/accounts/:id/payments
 *   - activity  GET /admin/billing/accounts/:id/activity
 *   - documents GET /admin/billing/accounts/:id/documents
 * plus the Edit Account (preferences) and Send Reminder mutations.
 *
 * Money note. The page formats every figure with the NGN only `formatMoney` from
 * data.ts (whole units); the mappers pass `minor / 100`, so figures are right but
 * the symbol is always the naira sign. The backend carries the real currency.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RecipientStatus } from '@/types'

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'
const toUnit = (minor: number): number => minor / 100
/** ISO timestamp to the YYYY-MM-DD the page date formatters expect. */
const toDay = (iso: string | null): string | undefined =>
  iso === null ? undefined : iso.slice(0, 10)

/* -------------------------------- overview -------------------------------- */

interface AccountDetailDto {
  id: string
  accountName: string
  primaryContact: string
  email: string | null
  phone: string | null
  status: string
  summary: {
    reference: string
    createdDate: string
    branch: string | null
    paymentTerms: string | null
    preferredMethod: string | null
  }
  financial: {
    currency: string | null
    outstandingMinor: number
    totalBilledMinor: number
    totalPaidMinor: number
    lastPaymentAt: string | null
  }
  recentInvoices: {
    number: string
    amountMinor: number
    dueDate: string | null
    status: string
  }[]
  timeline: {
    type: string
    title: string
    at: string
    amountMinor: number | null
    methodLabel: string | null
    invoiceNumber: string | null
    recipientName: string | null
    detail: string | null
    actorName: string | null
  }[]
}

export interface AccountDetailView {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  status: string
  summary: {
    reference: string
    createdDate: string
    branch: string
    paymentTerms: string
    preferredMethod: string
  }
  financial: {
    outstanding: number
    totalBilled: number
    totalPaid: number
    lastPaymentAt?: string
  }
  recentInvoices: { number: string; amount: number; dueDate?: string; status: string }[]
  timeline: {
    id: string
    title: string
    detail: string
    at: string
    actor?: string
  }[]
}

function toDetail(dto: AccountDetailDto): AccountDetailView {
  return {
    id: dto.id,
    name: dto.accountName,
    contact: dto.primaryContact,
    email: dto.email ?? DASH,
    phone: dto.phone ?? DASH,
    status: dto.status,
    summary: {
      reference: dto.summary.reference,
      createdDate: dto.summary.createdDate.slice(0, 10),
      branch: dto.summary.branch ?? DASH,
      paymentTerms: dto.summary.paymentTerms ?? DASH,
      preferredMethod: dto.summary.preferredMethod ?? 'Not recorded',
    },
    financial: {
      outstanding: toUnit(dto.financial.outstandingMinor),
      totalBilled: toUnit(dto.financial.totalBilledMinor),
      totalPaid: toUnit(dto.financial.totalPaidMinor),
      lastPaymentAt: toDay(dto.financial.lastPaymentAt),
    },
    recentInvoices: dto.recentInvoices.map((i) => ({
      number: i.number,
      amount: toUnit(i.amountMinor),
      dueDate: toDay(i.dueDate),
      status: i.status,
    })),
    timeline: dto.timeline.map((e, index) => ({
      id: `event-${index}`,
      title: e.title,
      detail: e.detail ?? '',
      at: e.at.slice(0, 10),
      actor: e.actorName ?? undefined,
    })),
  }
}

export function useBillingAccount(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'account', id] as const,
    enabled: id !== undefined,
    queryFn: async () => toDetail(await api.get<AccountDetailDto>(`/admin/billing/accounts/${id}`)),
  })
}

/* ------------------------------- recipients ------------------------------- */

interface AccountRecipientDto {
  id: string
  name: string
  photoKey: string | null
  relationship: string
  servicePlan: string | null
  monthlyCostMinor: number | null
  currency: string | null
  startDate: string | null
  status: string
}

export interface AccountRecipientView {
  id: string
  name: string
  relationship: string
  plan: string
  monthly?: number
  startedAt?: string
  status: RecipientStatus
}

const RECIPIENT_STATUS: Record<string, RecipientStatus> = {
  ACTIVE: 'active',
  ON_HOLD: 'on-hold',
  DISCHARGED: 'discharged',
  DRAFT: 'new',
  NEW: 'new',
}

function toRecipient(dto: AccountRecipientDto): AccountRecipientView {
  return {
    id: dto.id,
    name: dto.name,
    relationship: dto.relationship,
    plan: dto.servicePlan ?? DASH,
    monthly: dto.monthlyCostMinor === null ? undefined : toUnit(dto.monthlyCostMinor),
    startedAt: toDay(dto.startDate),
    status: RECIPIENT_STATUS[dto.status] ?? 'new',
  }
}

export function useAccountRecipients(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'account', id, 'recipients'] as const,
    enabled: id !== undefined,
    queryFn: async () => {
      const dto = await api.get<{ recipients: AccountRecipientDto[]; total: number }>(
        `/admin/billing/accounts/${id}/care-recipients`,
      )
      return dto.recipients.map(toRecipient)
    },
  })
}

/* -------------------------------- invoices -------------------------------- */

interface AccountInvoiceDto {
  id: string
  number: string
  periodStart: string
  periodEnd: string
  amountMinor: number
  currency: string
  dueDate: string | null
  paidAmountMinor: number
  status: 'PAID' | 'AWAITING_PAYMENT' | 'OVERDUE' | 'CANCELLED' | 'WRITTEN_OFF'
}

export interface AccountInvoiceView {
  id: string
  number: string
  periodStart: string
  periodEnd: string
  amount: number
  dueDate?: string
  paidAmount: number
  status: 'PAID' | 'AWAITING_PAYMENT' | 'OVERDUE' | 'CANCELLED' | 'WRITTEN_OFF'
}

function toAccountInvoice(dto: AccountInvoiceDto): AccountInvoiceView {
  return {
    id: dto.id,
    number: dto.number,
    periodStart: dto.periodStart.slice(0, 10),
    periodEnd: dto.periodEnd.slice(0, 10),
    amount: toUnit(dto.amountMinor),
    dueDate: toDay(dto.dueDate),
    paidAmount: toUnit(dto.paidAmountMinor),
    status: dto.status,
  }
}

export function useAccountInvoices(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'account', id, 'invoices'] as const,
    enabled: id !== undefined,
    queryFn: async () => {
      const dto = await api.get<{ invoices: AccountInvoiceDto[]; total: number }>(
        `/admin/billing/accounts/${id}/invoices`,
      )
      return dto.invoices.map(toAccountInvoice)
    },
  })
}

/* -------------------------------- payments -------------------------------- */

interface AccountPaymentDto {
  id: string
  reference: string
  invoiceNumber: string | null
  amountMinor: number
  currency: string
  method: string | null
  receivedAt: string
  status: 'COMPLETED'
  referenceNumber: string | null
  bankName: string | null
  notes: string | null
}

export interface AccountPaymentView {
  id: string
  reference: string
  invoiceNumber?: string
  amount: number
  method?: string
  receivedAt: string
  referenceNumber?: string
  bankName?: string
  notes?: string
}

function toAccountPayment(dto: AccountPaymentDto): AccountPaymentView {
  return {
    id: dto.id,
    reference: dto.reference,
    invoiceNumber: dto.invoiceNumber ?? undefined,
    amount: toUnit(dto.amountMinor),
    method: dto.method ?? undefined,
    receivedAt: dto.receivedAt.slice(0, 10),
    referenceNumber: dto.referenceNumber ?? undefined,
    bankName: dto.bankName ?? undefined,
    notes: dto.notes ?? undefined,
  }
}

export function useAccountPayments(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'account', id, 'payments'] as const,
    enabled: id !== undefined,
    queryFn: async () => {
      const dto = await api.get<{ payments: AccountPaymentDto[]; total: number }>(
        `/admin/billing/accounts/${id}/payments`,
      )
      return dto.payments.map(toAccountPayment)
    },
  })
}

/* -------------------------------- activity -------------------------------- */

interface AccountActivityEventDto {
  type: string
  title: string
  at: string
  amountMinor: number | null
  methodLabel: string | null
  invoiceNumber: string | null
  recipientName: string | null
  detail: string | null
  performedBy: string | null
}

export interface AccountActivityEventView {
  id: string
  title: string
  detail: string
  at: string
  actor?: string
}

export function useAccountActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'account', id, 'activity'] as const,
    enabled: id !== undefined,
    queryFn: async () => {
      const dto = await api.get<{ events: AccountActivityEventDto[]; total: number }>(
        `/admin/billing/accounts/${id}/activity`,
      )
      return dto.events.map(
        (e, index): AccountActivityEventView => ({
          id: `event-${index}`,
          title: e.title,
          detail: e.detail ?? '',
          at: e.at.slice(0, 10),
          actor: e.performedBy ?? undefined,
        }),
      )
    },
  })
}

/* -------------------------------- documents ------------------------------- */

interface AccountDocumentDto {
  id: string
  title: string
  fileName: string
  sizeBytes: number
  uploadedAt: string
  uploadedBy: string | null
  downloadUrl: string
}

export interface AccountDocumentView {
  id: string
  title: string
  fileName: string
  sizeBytes: number
  uploadedAt: string
  downloadUrl: string
}

export function useAccountDocuments(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'account', id, 'documents'] as const,
    enabled: id !== undefined,
    queryFn: async () => {
      const dto = await api.get<{ documents: AccountDocumentDto[]; total: number }>(
        `/admin/billing/accounts/${id}/documents`,
      )
      return dto.documents.map(
        (d): AccountDocumentView => ({
          id: d.id,
          title: d.title,
          fileName: d.fileName,
          sizeBytes: d.sizeBytes,
          uploadedAt: d.uploadedAt.slice(0, 10),
          downloadUrl: d.downloadUrl,
        }),
      )
    },
  })
}

/* ------------------------------- mutations -------------------------------- */

/** Edit Account (preferences), delete a document and Send Reminder. */
export function useAccountMutations(id: string | undefined) {
  const queryClient = useQueryClient()
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'account', id] })

  const savePreferences = useMutation({
    mutationFn: (preferredPaymentMethod: string | null) =>
      api.put(`/admin/billing/accounts/${id}/preferences`, { preferredPaymentMethod }),
    onSuccess: invalidate,
  })

  const sendReminder = useMutation({
    mutationFn: () => api.post(`/admin/billing/accounts/${id}/reminders`),
    onSuccess: invalidate,
  })

  const deleteDocument = useMutation({
    mutationFn: (documentId: string) =>
      api.delete(`/admin/billing/accounts/${id}/documents/${documentId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'billing', 'account', id, 'documents'],
      }),
  })

  return { savePreferences, sendReminder, deleteDocument }
}
