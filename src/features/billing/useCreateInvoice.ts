/**
 * The Create Invoice wizard, driven live off the backend. Each step reads its own
 * endpoint and the totals and the final submit go through the server so figures
 * are authoritative (the client never decides money):
 *   step 1  GET /admin/billing/invoice-wizard/accounts/:id        (account preview)
 *   step 2  GET /admin/billing/accounts/:id/care-recipients       (pick a recipient)
 *           GET /admin/billing/invoice-wizard/recipients/:id      (service preview)
 *   step 3  GET /admin/billing/invoice-wizard/recipients/:id/billable-services
 *                 ?from=&to=&currency=                            (rendered lines, prefilled)
 *   totals  POST /admin/billing/invoice-wizard/compute-totals     (authoritative)
 *   submit  POST /admin/billing/invoices                          (create)
 *           POST /admin/billing/invoices/:id/send                 (optional send)
 *
 * The wizard is entered with ?account=:id (a uuid), as BillingAccountsPage links
 * it. The recipient id the account recipients list returns is the careRecipientId
 * the submit needs. Money is minor units plus a currency code throughout; nothing
 * is recomputed client side as authoritative.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend responses ---------------------------- */

export interface AccountPreviewDto {
  id: string
  accountNumber: string
  name: string
  status: string
  primaryContactName: string
  primaryContactRelationship: string | null
  contactEmail: string | null
  contactPhone: string | null
  billingAddress: string | null
  outstandingBalanceMinor: number
  currency: string | null
  lastInvoiceNumber: string | null
  lastInvoiceStatus: string | null
}

export interface AccountRecipientDto {
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

interface AccountRecipientsDto {
  recipients: AccountRecipientDto[]
  total: number
}

export interface RecipientServicePreviewDto {
  id: string
  name: string
  carePlanModel: string | null
  assignedCaregiverName: string | null
  assignedCaregiverTitle: string | null
  keyBillableTargets: string[]
}

export interface RenderedServiceDto {
  id: string
  code: string
  name: string
  description: string
  unit: 'HOURLY' | 'SESSION' | 'FIXED'
  rateMinor: number | null
  suggestedQuantity: number
  sourceVisitCount: number
  amountMinor: number
}

export interface RenderedServicesDto {
  currency: string
  periodStart: string
  periodEnd: string
  taxRatePercent: number
  services: RenderedServiceDto[]
}

interface AppliedAmountDto {
  label: string
  amountMinor: number
}

export interface InvoiceTotalsDto {
  currency: string
  subtotalMinor: number
  discounts: AppliedAmountDto[]
  discountTotalMinor: number
  adjustments: AppliedAmountDto[]
  adjustmentTotalMinor: number
  taxableBaseMinor: number
  taxRatePercent: number
  vatMinor: number
  totalMinor: number
}

export interface InvoiceCreatedDto {
  id: string
  invoiceNumber: string
  status: string
  currency: string
  issueDate: string
  dueDate: string
  periodStart: string
  periodEnd: string
  subtotalMinor: number
  discountTotalMinor: number
  taxMinor: number
  taxRatePercent: number
  totalMinor: number
}

/* ------------------------------ request shapes ---------------------------- */

export interface ComputeLine {
  serviceId: string
  quantity: number
}

export interface CreateInvoiceInput {
  careRecipientId: string
  periodStart: string
  periodEnd: string
  currency: string
  lines: ComputeLine[]
}

/* ---------------------------------- reads --------------------------------- */

export function useAccountPreview(accountId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'wizard', 'account', accountId] as const,
    enabled: accountId !== undefined && accountId !== '',
    queryFn: () => api.get<AccountPreviewDto>(`/admin/billing/invoice-wizard/accounts/${accountId}`),
  })
}

export function useAccountRecipients(accountId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'wizard', 'account-recipients', accountId] as const,
    enabled: accountId !== undefined && accountId !== '',
    queryFn: async () =>
      (await api.get<AccountRecipientsDto>(`/admin/billing/accounts/${accountId}/care-recipients`))
        .recipients,
  })
}

export function useRecipientPreview(recipientId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'billing', 'wizard', 'recipient', recipientId] as const,
    enabled: recipientId !== undefined && recipientId !== '',
    queryFn: () =>
      api.get<RecipientServicePreviewDto>(`/admin/billing/invoice-wizard/recipients/${recipientId}`),
  })
}

export function useRenderedServices(
  recipientId: string | undefined,
  period: { from: string; to: string },
  currency: string | undefined,
) {
  return useQuery({
    queryKey: ['admin', 'billing', 'wizard', 'rendered', recipientId, period.from, period.to, currency] as const,
    enabled: recipientId !== undefined && recipientId !== '',
    queryFn: () => {
      const params = new URLSearchParams({ from: period.from, to: period.to })
      if (currency) params.set('currency', currency)
      return api.get<RenderedServicesDto>(
        `/admin/billing/invoice-wizard/recipients/${recipientId}/billable-services?${params.toString()}`,
      )
    },
  })
}

/** Authoritative totals for the chosen lines. Enabled once there is a line. */
export function useComputeTotals(currency: string | undefined, lines: ComputeLine[]) {
  return useQuery({
    queryKey: ['admin', 'billing', 'wizard', 'totals', currency, lines] as const,
    enabled: lines.length > 0,
    queryFn: () =>
      api.post<InvoiceTotalsDto>('/admin/billing/invoice-wizard/compute-totals', {
        currency,
        lines,
      }),
  })
}

/* -------------------------------- mutations ------------------------------- */

export function useCreateInvoice() {
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      api.post<InvoiceCreatedDto>('/admin/billing/invoices', input),
  })
}

export function useSendCreatedInvoice() {
  return useMutation({
    mutationFn: (invoiceId: string) =>
      api.post<unknown>(`/admin/billing/invoices/${invoiceId}/send`),
  })
}

/* -------------------------------- helpers --------------------------------- */

export function formatCurrency(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100)
}
