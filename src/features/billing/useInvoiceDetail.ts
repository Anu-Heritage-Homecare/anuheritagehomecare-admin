/**
 * The Invoice Details screen, fetched from the backend. The overview powers the
 * header and the Overview tab (`GET /admin/billing/invoices/:id`); the other
 * five tabs are fetched on demand, one query each, when their tab is active
 * (services, payments, history, notes, attachments). Every mutation the screen
 * exposes lives here too and invalidates the invoice detail plus the touched tab
 * on success.
 *
 * The route param is the invoice id (a uuid); the page reads it from the router.
 *
 * Money note: every figure is minor units plus a currency code. The hook formats
 * ready made display strings with Intl.NumberFormat on the DTO currency, so no
 * symbol is hardcoded and a USD invoice reads in dollars; raw minor fields are
 * also exposed where the page needs to compare or total.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend response ----------------------------- */

interface InvoiceLineDto {
  serviceName: string
  quantity: number | null
  unit: string | null
  rateMinor: number | null
  amountMinor: number
}

interface InvoiceIssuerDto {
  companyName: string | null
  companyAddress: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
}

export interface InvoiceDetailDto {
  id: string
  number: string
  status: string
  billingAccountId: string | null
  billingAccountName: string | null
  billingAddress: string | null
  careRecipientName: string
  careRecipientPhotoKey: string | null
  invoiceDate: string
  dueDate: string | null
  paymentTerms: string | null
  servicePeriodStart: string
  servicePeriodEnd: string
  currency: string
  subtotalMinor: number
  discountTotalMinor: number
  taxMinor: number
  taxRatePercent: number
  totalAmountMinor: number
  insuranceCoveredMinor: number
  amountPaidMinor: number
  balanceDueMinor: number
  percentPaid: number
  lineItems: InvoiceLineDto[]
  issuer: InvoiceIssuerDto
}

interface InvoiceServiceDto {
  serviceName: string
  category: string | null
  hoursUnits: number | null
  unit: string | null
  rateMinor: number | null
  amountMinor: number
  serviceDateStart: string | null
  serviceDateEnd: string | null
  assignedCaregiver: string | null
}

export interface InvoiceServicesDto {
  currency: string
  servicePeriodStart: string
  servicePeriodEnd: string
  services: InvoiceServiceDto[]
  distinctCount: number
  summaryAmountMinor: number
}

interface InvoicePaymentRowDto {
  id: string
  reference: string
  amountMinor: number
  currency: string
  method: string | null
  receivedAt: string
  status: string
}

export interface InvoicePaymentsDto {
  payments: InvoicePaymentRowDto[]
  total: number
}

interface InvoiceHistoryEventDto {
  type: string
  title: string
  at: string
  amountMinor: number | null
  methodLabel: string | null
  detail: string | null
  performedBy: string | null
}

export interface InvoiceHistoryDto {
  events: InvoiceHistoryEventDto[]
  total: number
}

interface InvoiceNoteDto {
  id: string
  category: string
  body: string
  createdAt: string
  authorName: string
  authorRole: string
  authorPhotoKey: string | null
}

export interface InvoiceNotesDto {
  notes: InvoiceNoteDto[]
  total: number
}

interface InvoiceAttachmentDto {
  id: string
  title: string
  fileName: string
  sizeBytes: number
  uploadedAt: string
  uploadedBy: string | null
  downloadUrl: string
}

export interface InvoiceAttachmentsDto {
  attachments: InvoiceAttachmentDto[]
  total: number
}

export interface InvoiceReminderPreviewDto {
  invoiceNumber: string
  amountDueMinor: number
  currency: string
  daysOverdue: number
  subject: string
  body: string
}

/* -------------------------------- helpers --------------------------------- */

/** A minor amount to a display string in its own currency, no symbol hardcoded. */
export function formatCurrency(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100)
}

const key = (id: string | undefined) => ['admin', 'billing', 'invoice', id] as const

/* --------------------------------- reads ---------------------------------- */

export function useInvoiceDetail(id: string | undefined) {
  return useQuery({
    queryKey: key(id),
    enabled: id !== undefined,
    queryFn: () => api.get<InvoiceDetailDto>(`/admin/billing/invoices/${id}`),
  })
}

export function useInvoiceServices(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...key(id), 'services'] as const,
    enabled: id !== undefined && enabled,
    queryFn: () => api.get<InvoiceServicesDto>(`/admin/billing/invoices/${id}/services`),
  })
}

export function useInvoicePayments(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...key(id), 'payments'] as const,
    enabled: id !== undefined && enabled,
    queryFn: () => api.get<InvoicePaymentsDto>(`/admin/billing/invoices/${id}/payments`),
  })
}

export function useInvoiceHistory(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...key(id), 'history'] as const,
    enabled: id !== undefined && enabled,
    queryFn: () => api.get<InvoiceHistoryDto>(`/admin/billing/invoices/${id}/history`),
  })
}

export function useInvoiceNotes(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...key(id), 'notes'] as const,
    enabled: id !== undefined && enabled,
    queryFn: () => api.get<InvoiceNotesDto>(`/admin/billing/invoices/${id}/notes`),
  })
}

export function useInvoiceAttachments(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...key(id), 'attachments'] as const,
    enabled: id !== undefined && enabled,
    queryFn: () => api.get<InvoiceAttachmentsDto>(`/admin/billing/invoices/${id}/attachments`),
  })
}

/* -------------------------------- mutations ------------------------------- */

/** Invalidate every query for this invoice after a change lands. */
function useInvoiceMutation<TVars>(
  id: string | undefined,
  run: (vars: TVars) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(id) }),
  })
}

export function useSendInvoice(id: string | undefined) {
  return useInvoiceMutation(id, () => api.post<unknown>(`/admin/billing/invoices/${id}/send`))
}

export function useApproveInvoice(id: string | undefined) {
  return useInvoiceMutation(id, () => api.post<void>(`/admin/billing/invoices/${id}/approve`))
}

export function useRecordInvoicePayment(id: string | undefined) {
  return useInvoiceMutation(
    id,
    (input: {
      amountMinor: number
      methodLabel?: string
      receivedAt?: string
      referenceNumber?: string
      bankName?: string
      notes?: string
    }) => api.post<unknown>(`/admin/billing/invoices/${id}/payments`, input),
  )
}

export function useAddInvoiceNote(id: string | undefined) {
  return useInvoiceMutation(id, (input: { category: string; body: string }) =>
    api.post<unknown>(`/admin/billing/invoices/${id}/notes`, input),
  )
}

export function useCancelInvoice(id: string | undefined) {
  return useInvoiceMutation(id, (input: { reason: string; notes?: string }) =>
    api.post<unknown>(`/admin/billing/invoices/${id}/cancel`, input),
  )
}

export function useWriteOffInvoice(id: string | undefined) {
  return useInvoiceMutation(id, (input: { reason: string; justification: string }) =>
    api.post<unknown>(`/admin/billing/invoices/${id}/write-off`, input),
  )
}

export function useDeleteDraftInvoice(id: string | undefined) {
  return useInvoiceMutation(id, () => api.delete<void>(`/admin/billing/invoices/${id}`))
}

export function useSendReminder(id: string | undefined) {
  return useInvoiceMutation(id, (channels: string[]) =>
    api.post<void>(`/admin/billing/invoices/${id}/reminders`, { channels }),
  )
}

export function useDeleteAttachment(id: string | undefined) {
  return useInvoiceMutation(id, (attachmentId: string) =>
    api.delete<void>(`/admin/billing/invoices/${id}/attachments/${attachmentId}`),
  )
}

/** The reminder preview is a one shot fetch when the dialog opens. */
export function fetchReminderPreview(id: string): Promise<InvoiceReminderPreviewDto> {
  return api.get<InvoiceReminderPreviewDto>(`/admin/billing/invoices/${id}/reminder-preview`)
}
