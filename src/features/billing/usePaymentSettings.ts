/**
 * The Billing & Payments settings screen, fetched from the backend and mapped
 * into the shapes `BillingPaymentsSettingsPage` renders
 * (`GET /admin/billing/settings`, the `BillingAndPaymentsScreenResponseDto`),
 * plus the mutations that page exposes: edit the invoice settings
 * (`PUT /settings`), add a tax (`POST /settings/taxes`) and add a payment term
 * (`POST /settings/payment-terms`).
 *
 * The page's UI shapes come from its off limits store
 * (`@/features/settings/billing-payments` exports `InvoiceSettings`, `Tax`,
 * `PaymentMethod`, `PaymentTerm`); this hook returns the same shapes so the page
 * body is unchanged below the data source.
 *
 * Gaps noted for the page: the backend exposes no "add payment method" endpoint
 * (methods are a fixed enum, edited one at a time through a separate route), and
 * "auto generate invoices" has no matching setting, so those two controls stay
 * inert. Money note: no money renders on this screen.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  InvoiceSettings,
  PaymentMethod,
  PaymentTerm,
  Tax,
} from '@/features/settings/billing-payments'

/* --------------------------- backend response ----------------------------- */

interface BillingTaxDto {
  id: string
  name: string
  ratePercent: number
  scope: string
  isActive: boolean
  description: string | null
}

interface BillingPaymentTermDto {
  id: string
  name: string
  netDays: number | null
  isDefault: boolean
  isActive: boolean
  isCustom: boolean
  description: string | null
}

interface BillingPaymentMethodDto {
  method: string
  enabled: boolean
  description: string
}

interface BillingPaymentsScreenDto {
  invoice: {
    defaultPaymentTermsDays: number
    invoicePrefix: string
    defaultCurrency: string
    standardTaxRatePercent: number
    autoNumbering: boolean
    includeVatInPricing: boolean
  }
  paymentMethods: BillingPaymentMethodDto[]
  taxes: BillingTaxDto[]
  paymentTerms: BillingPaymentTermDto[]
  nextInvoiceNumber: string
}

/** The screen, mapped to the shapes the page renders. */
export interface BillingPaymentsView {
  invoice: InvoiceSettings
  taxes: Tax[]
  methods: PaymentMethod[]
  terms: PaymentTerm[]
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card Payments',
  CASH: 'Cash Payments',
  MOBILE_MONEY: 'Mobile Money',
}

/* -------------------------------- mappers --------------------------------- */

function toTax(dto: BillingTaxDto): Tax {
  return {
    id: dto.id,
    name: dto.name,
    ratePercent: dto.ratePercent,
    description: dto.description ?? '',
    active: dto.isActive,
  }
}

function toMethod(dto: BillingPaymentMethodDto): PaymentMethod {
  return {
    id: dto.method,
    name: METHOD_LABEL[dto.method] ?? dto.method,
    detail: dto.description || DASH,
    status: dto.enabled ? 'Active' : 'Disabled',
  }
}

/** The page's term status is Default, Active or Available; mapped from flags. */
function toTerm(dto: BillingPaymentTermDto): PaymentTerm {
  const status: PaymentTerm['status'] = dto.isDefault
    ? 'Default'
    : dto.isActive
      ? 'Active'
      : 'Available'
  return {
    id: dto.id,
    name: dto.name,
    detail: dto.description ?? (dto.netDays === null ? 'Custom terms' : `${dto.netDays} days from issue date`),
    status,
    days: dto.netDays,
  }
}

function toView(dto: BillingPaymentsScreenDto): BillingPaymentsView {
  return {
    invoice: {
      prefix: dto.invoice.invoicePrefix,
      nextNumber: dto.nextInvoiceNumber,
      dueDays: dto.invoice.defaultPaymentTermsDays,
      // The backend has no "auto generate invoices" setting; auto numbering is
      // the nearest recorded automation flag the page can mirror.
      autoGenerate: dto.invoice.autoNumbering,
      vatIncluded: dto.invoice.includeVatInPricing,
    },
    taxes: dto.taxes.map(toTax),
    methods: dto.paymentMethods.map(toMethod),
    terms: dto.paymentTerms.map(toTerm),
  }
}

const SETTINGS_KEY = ['admin', 'billing', 'settings'] as const

export function usePaymentSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () =>
      toView(await api.get<BillingPaymentsScreenDto>('/admin/billing/settings')),
  })
}

/* -------------------------------- mutations ------------------------------- */

export function useUpdateInvoiceSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    // The page edits prefix, due period and VAT inclusion; the next number is
    // server computed, so it is read only (the page's input is ignored here).
    mutationFn: (patch: { prefix: string; dueDays: number; vatIncluded: boolean }) =>
      api.put<unknown>('/admin/billing/settings', {
        invoicePrefix: patch.prefix,
        defaultPaymentTermsDays: patch.dueDays,
        includeVatInPricing: patch.vatIncluded,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}

export function useAddTax() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; ratePercent: number; description: string }) =>
      api.post<unknown>('/admin/billing/settings/taxes', {
        name: input.name,
        ratePercent: input.ratePercent,
        scope: 'CLIENT_INVOICE',
        description: input.description,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}

export function useAddPaymentTerm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (days: number) =>
      api.post<unknown>('/admin/billing/settings/payment-terms', {
        name: `Net ${days}`,
        netDays: days,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}
