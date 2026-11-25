/**
 * The Billing tab, fetched from the backend and mapped into the `BillingRecord`
 * the billing panels already render (`GET /admin/care-recipients/:id/billing`).
 *
 * Money note. The DTO carries money as integer minor units with a currency
 * code; the billing children recompute every invoice figure from
 * `invoice.visits * RATE_PER_VISIT` and split it by `insurance.coverageRate`,
 * and format with the NGN `formatMoney`. Two consequences the mapper cannot
 * avoid without editing those (off limits) children:
 *   - Invoice amount is carried by backing out `visits = round(amount /
 *     RATE_PER_VISIT)`, so a DTO amount that is not a whole multiple of the flat
 *     rate is shown to the nearest multiple. The per invoice insurance/patient
 *     split the table draws is the child's `coverageRate` computation, not the
 *     DTO's own `insuranceCovered`/`patientDue`.
 *   - Everything the children take as a ready value rather than recomputing
 *     (payment history amounts, the service breakdown donut) is passed through
 *     exact from the DTO minor units.
 *   - All money is rendered NGN regardless of the DTO currency; a USD payer
 *     would read the right number with the wrong symbol.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  BillingContact,
  BillingRecord,
  Insurance,
  Invoice,
  Payment,
  PaymentMethod,
  ServiceLine,
} from './billing-data'
import { RATE_PER_VISIT } from './billing-data'
import type { Tone } from '@/types'

/* --------------------------- backend response ----------------------------- */

interface MoneyDto {
  amountMinor: number
  currency: string
}

interface InvoiceDto {
  id: string
  number: string
  periodStart: string
  periodEnd: string
  servicesLabel: string
  amount: MoneyDto
  insuranceCovered: MoneyDto | null
  patientDue: MoneyDto | null
  displayStatus: string
}

interface ServiceBreakdownItemDto {
  serviceName: string
  amount: MoneyDto
  percent: number
}

interface PaymentHistoryDto {
  amount: MoneyDto
  methodLabel: string | null
  receivedAt: string
}

export interface BillingDto {
  summary: {
    totalBilledThisMonth: MoneyDto | null
    billedTrendPercent: number | null
    outstanding: MoneyDto | null
    outstandingDueDate: string | null
    lastPayment: MoneyDto | null
    lastPaymentAt: string | null
    paymentStatus: string
  }
  profile: {
    contact: {
      name: string | null
      relationship: string | null
      email: string | null
      phone: string | null
    }
    paymentMethod: {
      brand: string | null
      last4: string | null
      autoPayEnabled: boolean
    }
    insurance: {
      provider: string | null
      policyNumber: string | null
      coveragePercent: number | null
      coverageDetails: string | null
      coPayPerVisit: MoneyDto | null
      secondary: string | null
    }
  }
  invoices: {
    items: InvoiceDto[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  serviceBreakdown: {
    total: MoneyDto | null
    items: ServiceBreakdownItemDto[]
  }
  paymentHistory: PaymentHistoryDto[]
}

/** The billing read, mapped plus the figures the tab's own stat cards show. */
export interface BillingView {
  record: BillingRecord
  payments: Payment[]
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

/** Minor units to the whole number unit the UI money formatter expects. */
function toUnit(money: MoneyDto | null): number {
  return money === null ? 0 : money.amountMinor / 100
}

/** The donut tones cycle through the palette the UI already uses. */
const SERVICE_TONES: Tone[] = ['blue', 'purple', 'green', 'amber', 'red', 'slate']

/* -------------------------------- mappers --------------------------------- */

function toContact(dto: BillingDto['profile']['contact']): BillingContact {
  return {
    name: dto.name ?? DASH,
    relationship: dto.relationship ?? DASH,
    email: dto.email ?? DASH,
    phone: dto.phone ?? DASH,
  }
}

function toMethod(dto: BillingDto['profile']['paymentMethod']): PaymentMethod {
  return {
    brand: dto.brand ?? DASH,
    last4: dto.last4 ?? DASH,
    autoPay: dto.autoPayEnabled,
  }
}

function toInsurance(dto: BillingDto['profile']['insurance']): Insurance {
  return {
    provider: dto.provider ?? DASH,
    policyNumber: dto.policyNumber ?? DASH,
    // The children split every invoice by this rate (0..1).
    coverageRate: dto.coveragePercent === null ? 0 : dto.coveragePercent / 100,
    secondary: dto.secondary,
  }
}

/**
 * The children recompute an invoice's amount as `visits * RATE_PER_VISIT`, so
 * the DTO amount is carried as a visit count. `displayStatus` decides whether
 * the row is settled, through the presence of `paidAt`.
 */
function toInvoice(dto: InvoiceDto): Invoice {
  const paid = dto.displayStatus.toLowerCase() === 'paid'
  return {
    id: dto.id,
    number: dto.number,
    // No separate issue date in the DTO; the period end is when the work the
    // invoice covers was delivered, which is the closest honest "raised" day.
    issuedAt: dto.periodEnd,
    periodStart: dto.periodStart,
    periodEnd: dto.periodEnd,
    services: dto.servicesLabel,
    visits: Math.round(toUnit(dto.amount) / RATE_PER_VISIT),
    // Overdue vs pending is the child's own `dueAt < today` test; the DTO gives
    // no due date per row, so an unpaid invoice falls back to its period end.
    dueAt: dto.periodEnd,
    paidAt: paid ? dto.periodEnd : undefined,
  }
}

function toServices(dto: BillingDto['serviceBreakdown']): ServiceLine[] {
  return dto.items.map((item, index) => ({
    id: `sv-${index}`,
    label: item.serviceName,
    amount: toUnit(item.amount),
    tone: SERVICE_TONES[index % SERVICE_TONES.length],
  }))
}

function toPayments(dto: PaymentHistoryDto[]): Payment[] {
  return dto.map((p, index) => ({
    id: `pay-${index}`,
    paidAt: p.receivedAt,
    amount: toUnit(p.amount),
    invoiceNumber: p.methodLabel ?? DASH,
  }))
}

function toView(dto: BillingDto): BillingView {
  return {
    record: {
      contact: toContact(dto.profile.contact),
      method: toMethod(dto.profile.paymentMethod),
      insurance: toInsurance(dto.profile.insurance),
      invoices: dto.invoices.items.map(toInvoice),
      services: toServices(dto.serviceBreakdown),
    },
    payments: toPayments(dto.paymentHistory),
  }
}

export function useRecipientBilling(id: string | undefined, page = 1) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'billing', page] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      toView(
        await api.get<BillingDto>(
          `/admin/care-recipients/${id}/billing?page=${page}`,
        ),
      ),
  })
}
