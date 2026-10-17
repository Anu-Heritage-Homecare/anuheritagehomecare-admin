/**
 * What an invoice can charge for a care recipient over a billing period.
 *
 * Each of the recipient's billable targets (the list the wizard shows on the
 * recipient step) maps to a priced service here, and every invoice carries
 * the coordination fee. Quantities are a month of service; the app keeps no
 * per-session care log to count them from, so they are the same whichever
 * month is billed.
 */
import { TODAY } from '@/lib/today'

export type ServiceUnit = 'hour' | 'session' | 'visit' | 'fixed'

export interface BillableService {
  id: string
  label: string
  detail: string
  unit: ServiceUnit
  /** Naira per unit, or the flat amount for `fixed`. */
  rate: number
  /** Units in a month of service. */
  quantity: number
}

export interface BillableLine extends BillableService {
  total: number
}

/** Keyed by the billable target name the recipient's record uses. */
const catalogue: Record<string, Omit<BillableService, 'id'>> = {
  'Personal Care': { label: 'Personal Care Support', detail: 'Hourly Care Plan Support Tasks', unit: 'hour', rate: 15_000, quantity: 40 },
  'Medication Management': { label: 'Medication Management', detail: 'Vitals monitoring & daily dosage prep', unit: 'hour', rate: 12_000, quantity: 30 },
  Physiotherapy: { label: 'Physiotherapy Sessions', detail: 'Specialized motor & movement rehabilitation', unit: 'session', rate: 25_000, quantity: 8 },
  'Physical Therapy': { label: 'Physiotherapy Sessions', detail: 'Specialized motor & movement rehabilitation', unit: 'session', rate: 25_000, quantity: 8 },
  'Meal Prep': { label: 'Nutritional Meal Prep', detail: 'Dietary plan cooking and kitchen safety supervision', unit: 'hour', rate: 8_000, quantity: 20 },
  Companionship: { label: 'Companionship Visits', detail: 'Social engagement and supervised outings', unit: 'hour', rate: 7_000, quantity: 24 },
  'Clinical Checkups': { label: 'Clinical Checkups', detail: 'Nurse-led vitals and health reviews', unit: 'visit', rate: 20_000, quantity: 4 },
  'Wound Care': { label: 'Wound Care', detail: 'Dressing changes and wound monitoring', unit: 'visit', rate: 18_000, quantity: 12 },
  'Pain Management': { label: 'Pain Management', detail: 'Comfort care and symptom relief', unit: 'hour', rate: 14_000, quantity: 30 },
  'Morning Care': { label: 'Morning Care', detail: 'Wake-up routine, hygiene and breakfast', unit: 'hour', rate: 12_000, quantity: 44 },
  'Afternoon Care': { label: 'Afternoon Care', detail: 'Lunch, activities and afternoon routine', unit: 'hour', rate: 12_000, quantity: 44 },
  'Home Care Visits': { label: 'Home Care Visits', detail: 'Scheduled caregiver visits', unit: 'visit', rate: 15_000, quantity: 22 },
}

const coordinationFee: BillableService = {
  id: 'coordination',
  label: 'Admin & Care Coordination Fee',
  detail: 'Quality compliance & caregiver routing',
  unit: 'fixed',
  rate: 130_000,
  quantity: 1,
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** The lines a month of this recipient's care would bill, fee last. */
export function billableLines(targets: string[]): BillableLine[] {
  const seen = new Set<string>()
  const services: BillableService[] = []
  for (const t of targets) {
    const svc = catalogue[t] ?? {
      label: t,
      detail: 'Care plan service',
      unit: 'hour' as const,
      rate: 10_000,
      quantity: 20,
    }
    const id = slug(svc.label)
    // Physiotherapy and Physical Therapy are one service.
    if (seen.has(id)) continue
    seen.add(id)
    services.push({ id, ...svc })
  }
  services.push(coordinationFee)
  return services.map((s) => ({ ...s, total: s.rate * s.quantity }))
}

const rateSuffix: Record<ServiceUnit, string> = { hour: '/hr', session: '/sess', visit: '/visit', fixed: '' }

export function rateLabel(line: BillableService, money: (n: number) => string): string {
  return line.unit === 'fixed' ? 'Fixed' : `${money(line.rate)}${rateSuffix[line.unit]}`
}

export function quantityLabel(line: BillableService): string {
  const q = line.quantity
  switch (line.unit) {
    case 'hour':
      return `${q} ${q === 1 ? 'hr' : 'hrs'}`
    case 'session':
      return `${q} ${q === 1 ? 'session' : 'sessions'}`
    case 'visit':
      return `${q} ${q === 1 ? 'visit' : 'visits'}`
    case 'fixed':
      return `${q} flat`
  }
}

/* --------------------------------- periods --------------------------------- */

/** `YYYY-MM`. Billing runs by calendar month. */
export type Period = string

export const currentPeriod: Period = TODAY.slice(0, 7)

/** This month and the five before it, newest first. */
export function periodOptions(from: Period = currentPeriod): Period[] {
  const [y, m] = from.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

export function isPeriod(value: string | null): value is Period {
  return value !== null && periodOptions().includes(value)
}

const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** "Jul 1 - Jul 31, 2026". */
export function periodLabel(period: Period): string {
  const [y, m] = period.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0))
  return `${short.format(first)} - ${short.format(last)}, ${y}`
}
