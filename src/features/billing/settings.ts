/**
 * Billing settings.
 *
 * Like the message settings, two kinds of thing live here. The invoice
 * defaults (terms, prefix, tax, numbering) describe invoices raised *from now*
 * — the invoices already in the book keep the terms they were raised on, so
 * changing Net 15 here does not move a single due date. The automation and
 * notification switches record how this organisation wants to work; nothing
 * in the prototype emails, texts or charges anybody, so what they do is be
 * remembered.
 *
 * Held in memory for the session, like everything else this app writes.
 */
import { useSyncExternalStore } from 'react'
import { ledger } from './ledger'
import { TODAY } from '@/lib/today'

export type MethodId = 'bank' | 'card' | 'cash' | 'mobile'

export interface PaymentMethodSetting {
  id: MethodId
  label: string
  detail: string
  enabled: boolean
}

export interface BillingSettings {
  paymentTermsDays: number
  invoicePrefix: string
  taxRatePercent: number
  autoNumbering: boolean
  autoSendInvoices: boolean
  paymentReminders: boolean
  overdueNotifications: boolean
  autoReceipts: boolean
  methods: PaymentMethodSetting[]
  notify: { email: boolean; sms: boolean; inApp: boolean }
}

export const termsOptions = [7, 15, 30, 45]

/*
 * Automation defaults and wording follow the Figma: every switch on, reminders
 * 7 days before the due date, overdue notice 1 day after. Payment methods
 * follow the Figma too (all enabled). So do the invoice
 * defaults (Net 30, 7.5% tax) — they apply to new invoices only; the ledger
 * keeps the Net 15 terms its invoices were raised on.
 */
const settings: BillingSettings = {
  paymentTermsDays: 30,
  invoicePrefix: 'INV-',
  taxRatePercent: 7.5,
  autoNumbering: true,
  autoSendInvoices: true,
  paymentReminders: true,
  overdueNotifications: true,
  autoReceipts: true,
  methods: [
    { id: 'bank', label: 'Bank Transfer', detail: 'Manual confirmation of transfers', enabled: true },
    { id: 'card', label: 'Card Payment', detail: 'Paystack integration active', enabled: true },
    { id: 'cash', label: 'Cash Payment', detail: 'Record physical cash at office', enabled: true },
    { id: 'mobile', label: 'Mobile Money', detail: 'Automated instant confirmation', enabled: true },
  ],
  notify: { email: true, sms: true, inApp: true },
}

let revision = 0
const listeners = new Set<() => void>()

function emit(): void {
  revision += 1
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBillingSettings(): BillingSettings {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return settings
}

export function update(patch: Partial<Omit<BillingSettings, 'methods' | 'notify'>>): void {
  Object.assign(settings, patch)
  emit()
}

export function setMethod(
  id: MethodId,
  patch: Partial<Pick<PaymentMethodSetting, 'enabled' | 'detail'>>,
): void {
  const m = settings.methods.find((x) => x.id === id)
  if (m) Object.assign(m, patch)
  emit()
}

export function setNotify(key: keyof BillingSettings['notify'], value: boolean): void {
  settings.notify[key] = value
  emit()
}

/** 1–8 letters, digits or dashes. */
export function validPrefix(prefix: string): boolean {
  return /^[A-Za-z0-9-]{1,8}$/.test(prefix)
}

/**
 * What the next invoice would be numbered: the prefix, the year, and one past
 * the highest sequence the book has used this year.
 */
export function nextInvoiceNumber(prefix = settings.invoicePrefix, today = TODAY): string {
  const year = today.slice(0, 4)
  const used = ledger
    .filter((i) => i.kind === 'invoice' && i.number.startsWith(`INV-${year}-`))
    .map((i) => Number(i.number.split('-')[2]))
    .filter(Number.isFinite)
  const next = (used.length ? Math.max(...used) : 0) + 1
  return `${prefix}${year}-${String(next).padStart(3, '0')}`
}
