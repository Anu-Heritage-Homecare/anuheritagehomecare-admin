/**
 * The Billing Settings screen, fetched from the backend and mapped into the
 * shapes `BillingSettingsPage` renders (`GET /admin/billing/settings`), plus the
 * mutations that page exposes: save the invoice and automation preferences
 * (`PUT /settings`), toggle a notification channel (also `PUT /settings`), and
 * edit one payment avenue (`PUT /settings/payment-methods/:method`).
 *
 * The page's own UI shapes come from its off limits store
 * (`./settings` exports `BillingSettings`, `PaymentMethodSetting`, `MethodId`);
 * this hook returns the same shapes so the page body is unchanged below the data
 * source. The backend keys a payment avenue by an UPPER_SNAKE `method` kind; the
 * page keys it by a short `MethodId`, so the two are bridged here.
 *
 * Money note: there is no money on this screen; the default currency is a label
 * only and the backend reports NGN.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BillingSettings, MethodId, PaymentMethodSetting } from './settings'

/* --------------------------- backend response ----------------------------- */

interface BillingPaymentMethodDto {
  method: string
  enabled: boolean
  description: string
}

interface BillingSettingsDto {
  invoice: {
    defaultPaymentTermsDays: number
    invoicePrefix: string
    defaultCurrency: string
    standardTaxRatePercent: number
    autoNumbering: boolean
    includeVatInPricing: boolean
  }
  automation: {
    autoSendInvoices: boolean
    paymentReminders: boolean
    reminderDaysBefore: number
    overdueNotifications: boolean
    overdueNoticeDaysAfter: number
    autoReceipts: boolean
  }
  notifications: { email: boolean; sms: boolean; inApp: boolean }
  paymentMethods: BillingPaymentMethodDto[]
  defaultPaymentMethod: string | null
}

/* -------------------------------- helpers --------------------------------- */

/** Backend payment method kind to the page's short id, and the label to show. */
const METHOD_META: Record<string, { id: MethodId; label: string }> = {
  BANK_TRANSFER: { id: 'bank', label: 'Bank Transfer' },
  CARD: { id: 'card', label: 'Card Payment' },
  CASH: { id: 'cash', label: 'Cash Payment' },
  MOBILE_MONEY: { id: 'mobile', label: 'Mobile Money' },
}

const KIND_BY_ID: Record<MethodId, string> = {
  bank: 'BANK_TRANSFER',
  card: 'CARD',
  cash: 'CASH',
  mobile: 'MOBILE_MONEY',
}

/* -------------------------------- mapper ---------------------------------- */

function toMethods(dto: BillingPaymentMethodDto[]): PaymentMethodSetting[] {
  return dto.flatMap((m) => {
    const meta = METHOD_META[m.method]
    if (!meta) return []
    return [{ id: meta.id, label: meta.label, detail: m.description, enabled: m.enabled }]
  })
}

function toSettings(dto: BillingSettingsDto): BillingSettings {
  return {
    paymentTermsDays: dto.invoice.defaultPaymentTermsDays,
    invoicePrefix: dto.invoice.invoicePrefix,
    taxRatePercent: dto.invoice.standardTaxRatePercent,
    autoNumbering: dto.invoice.autoNumbering,
    autoSendInvoices: dto.automation.autoSendInvoices,
    paymentReminders: dto.automation.paymentReminders,
    overdueNotifications: dto.automation.overdueNotifications,
    autoReceipts: dto.automation.autoReceipts,
    methods: toMethods(dto.paymentMethods),
    notify: dto.notifications,
  }
}

const SETTINGS_KEY = ['admin', 'billing', 'settings'] as const

export function useBillingSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => toSettings(await api.get<BillingSettingsDto>('/admin/billing/settings')),
  })
}

/* -------------------------------- mutations ------------------------------- */

/** What the page's invoice, automation and notification controls can change. */
export interface SettingsPatch {
  paymentTermsDays?: number
  invoicePrefix?: string
  standardTaxRatePercent?: number
  autoNumbering?: boolean
  autoSendInvoices?: boolean
  paymentReminders?: boolean
  overdueNotifications?: boolean
  autoReceipts?: boolean
  emailNotifications?: boolean
  smsNotifications?: boolean
  inAppNotifications?: boolean
}

export function useUpdateBillingSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatch) =>
      api.put<BillingSettingsDto>('/admin/billing/settings', {
        // The server names its term field defaultPaymentTermsDays; the rest line up.
        ...(patch.paymentTermsDays !== undefined && {
          defaultPaymentTermsDays: patch.paymentTermsDays,
        }),
        ...(patch.invoicePrefix !== undefined && { invoicePrefix: patch.invoicePrefix }),
        ...(patch.standardTaxRatePercent !== undefined && {
          standardTaxRatePercent: patch.standardTaxRatePercent,
        }),
        ...(patch.autoNumbering !== undefined && { autoNumbering: patch.autoNumbering }),
        ...(patch.autoSendInvoices !== undefined && { autoSendInvoices: patch.autoSendInvoices }),
        ...(patch.paymentReminders !== undefined && { paymentReminders: patch.paymentReminders }),
        ...(patch.overdueNotifications !== undefined && {
          overdueNotifications: patch.overdueNotifications,
        }),
        ...(patch.autoReceipts !== undefined && { autoReceipts: patch.autoReceipts }),
        ...(patch.emailNotifications !== undefined && {
          emailNotifications: patch.emailNotifications,
        }),
        ...(patch.smsNotifications !== undefined && { smsNotifications: patch.smsNotifications }),
        ...(patch.inAppNotifications !== undefined && {
          inAppNotifications: patch.inAppNotifications,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: MethodId; enabled: boolean; description: string }) =>
      api.put<BillingPaymentMethodDto>(
        `/admin/billing/settings/payment-methods/${KIND_BY_ID[input.id]}`,
        { enabled: input.enabled, description: input.description },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}
