/**
 * Billing & Payments settings — invoice numbering, taxes, the ways an account
 * can pay and the payment terms on offer.
 *
 * Content follows the Figma settings-billing-payments screen as drawn. It is
 * separate from the Billing section's own settings store
 * (`src/features/billing/settings.ts`), which the invoice screens read; nothing
 * joins the two yet.
 *
 * Held in memory for the session, like every other settings store in the app.
 */
import { useSyncExternalStore } from 'react'

export interface InvoiceSettings {
  prefix: string
  nextNumber: string
  dueDays: number
  autoGenerate: boolean
  vatIncluded: boolean
}

export interface Tax {
  id: string
  name: string
  ratePercent: number
  description: string
  active: boolean
}

export interface PaymentMethod {
  id: string
  name: string
  detail: string
  /** As the design words it: "Active, default", "Active", "Enabled". */
  status: string
}

export interface PaymentTerm {
  id: string
  name: string
  detail: string
  status: 'Active' | 'Default' | 'Available'
  /** Null for the custom term. */
  days: number | null
}

interface BillingPayments {
  invoice: InvoiceSettings
  taxes: Tax[]
  methods: PaymentMethod[]
  terms: PaymentTerm[]
}

const net = (days: number, status: PaymentTerm['status'] = 'Active'): PaymentTerm => ({
  id: `net-${days}`,
  name: `Net ${days}`,
  detail: `${days} days from issue date`,
  status,
  days,
})

const state: BillingPayments = {
  invoice: {
    prefix: 'INV-',
    nextNumber: '2026-0458',
    dueDays: 30,
    autoGenerate: true,
    vatIncluded: true,
  },
  taxes: [
    { id: 'vat', name: 'VAT', ratePercent: 7.5, description: 'Applied to all client invoices', active: true },
    { id: 'wht', name: 'WHT', ratePercent: 5, description: 'Applied to contractor payout processing', active: true },
  ],
  methods: [
    {
      id: 'bank',
      name: 'Bank Transfer',
      detail: 'First Bank 0123456789 - CareProfs Health Services Ltd',
      status: 'Active, default',
    },
    { id: 'card', name: 'Card Payments', detail: 'Paystack connected gateway', status: 'Active' },
    { id: 'ussd', name: 'USSD', detail: 'Universal mobile banking channels', status: 'Enabled' },
  ],
  terms: [
    net(15),
    net(30, 'Default'),
    net(45),
    { id: 'custom', name: 'Custom', detail: 'Manual parameters per account', status: 'Available', days: null },
  ],
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

export function useBillingPayments(): BillingPayments {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return state
}

export function updateInvoice(patch: Partial<InvoiceSettings>): void {
  state.invoice = { ...state.invoice, ...patch }
  emit()
}

let seq = 0
const nextId = (prefix: string) => `${prefix}-new-${(seq += 1)}`

export function addTax(tax: Omit<Tax, 'id' | 'active'>): void {
  state.taxes = [...state.taxes, { ...tax, id: nextId('tax'), active: true }]
  emit()
}

export function addMethod(method: Omit<PaymentMethod, 'id' | 'status'>): void {
  state.methods = [...state.methods, { ...method, id: nextId('method'), status: 'Active' }]
  emit()
}

/** Inserted in day order, ahead of Custom. */
export function addTerm(days: number): void {
  const fixed = [...state.terms.filter((t) => t.days !== null), net(days)].sort(
    (a, b) => (a.days ?? 0) - (b.days ?? 0),
  )
  state.terms = [...fixed, ...state.terms.filter((t) => t.days === null)]
  emit()
}

export function termExists(days: number): boolean {
  return state.terms.some((t) => t.days === days)
}

/** 1–8 letters, digits or dashes. */
export function validPrefix(prefix: string): boolean {
  return /^[A-Za-z0-9-]{1,8}$/.test(prefix)
}

/** Digits with optional dashes, as in "2026-0458". */
export function validNumber(value: string): boolean {
  return /^\d[\d-]{0,14}$/.test(value) && !value.endsWith('-')
}

export function parseWhole(raw: string, min: number, max: number): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const v = Number(t)
  return v >= min && v <= max ? v : null
}

/** "7.5" or "7.5%" → 7.5; null unless above 0 and at most 100. */
export function parseRate(raw: string): number | null {
  const t = raw.trim().replace(/%$/, '').trim()
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const v = Number(t)
  return v > 0 && v <= 100 ? v : null
}
