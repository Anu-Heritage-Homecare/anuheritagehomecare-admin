/**
 * Organisation settings — the legal identity, the hours the office keeps, its
 * branches and who to ring in an emergency.
 *
 * Content follows the Figma settings-organization screen as drawn. Note the
 * branches here (Lagos HQ, Abuja, Port Harcourt) are the organisation's
 * offices as that screen lists them; the caregiver roster still files staff
 * under its own North / Central / South labels, and nothing joins the two yet.
 *
 * Held in memory for the session, like every other settings store in the app.
 */
import { useSyncExternalStore } from 'react'

export interface OrgProfile {
  name: string
  registration: string
  /** One line per row, as it is shown. */
  address: string
  timezone: string
  language: string
  currency: string
  dateFormat: string
}

export interface OrgDayHours {
  day: string
  open: boolean
  /** 24-hour "HH:MM". */
  start: string
  end: string
}

export interface Branch {
  id: string
  name: string
  /** Street address as the table shows it: line 1, then line 2 if there is one. */
  address: string
  manager: string
  active: boolean
  /* Collected by the Add Branch drawer; the three branches the design lists
     were drawn without them. */
  city?: string
  state?: string
  phone?: string
  hours?: OrgDayHours[]
}

export const nigerianStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
  'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna',
  'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

/** What the Add Branch drawer opens with: 8 to 6, Monday to Saturday. */
export function defaultBranchHours(): OrgDayHours[] {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => ({
    day,
    open: day !== 'Sunday',
    start: '08:00',
    end: '18:00',
  }))
}

export type ContactKind = 'medical' | 'security'

export interface EmergencyContact {
  id: string
  name: string
  role: string
  phone: string
  kind: ContactKind
}

export interface OrganizationSettings {
  profile: OrgProfile
  hours: OrgDayHours[]
  branches: Branch[]
  contacts: EmergencyContact[]
}

export const timezoneOptions = ['WAT (UTC+1)', 'GMT (UTC+0)', 'CAT (UTC+2)', 'EAT (UTC+3)']
export const languageOptions = ['English (UK)', 'English (US)']
/* Naira only: every amount in the app is naira and nothing converts. */
export const currencyOptions = ['₦ Nigerian Naira (NGN)']
export const dateFormatOptions = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

const weekday = (day: string): OrgDayHours => ({ day, open: true, start: '07:00', end: '21:00' })

const settings: OrganizationSettings = {
  profile: {
    name: 'CareProfs Health Services Ltd',
    registration: 'RC-2847291',
    address: '15 Admiralty Way,\nLekki Phase 1,\nLagos',
    timezone: 'WAT (UTC+1)',
    language: 'English (UK)',
    currency: '₦ Nigerian Naira (NGN)',
    dateFormat: 'DD/MM/YYYY',
  },
  hours: [
    weekday('Monday'),
    weekday('Tuesday'),
    weekday('Wednesday'),
    weekday('Thursday'),
    weekday('Friday'),
    { day: 'Saturday', open: true, start: '08:00', end: '18:00' },
    { day: 'Sunday', open: false, start: '08:00', end: '18:00' },
  ],
  branches: [
    { id: 'lagos-hq', name: 'Lagos HQ', address: '15 Admiralty Way, Lekki Phase 1', manager: 'Adaeze Okonkwo', active: true },
    { id: 'abuja', name: 'Abuja Branch', address: 'Plot 234 Wuse 2', manager: 'Ibrahim Musa', active: true },
    { id: 'port-harcourt', name: 'Port Harcourt', address: '12 Aba Road', manager: 'Chidinma Eze', active: true },
  ],
  contacts: [
    { id: 'medical-director', name: 'Dr. Folake Adeyemi', role: 'Medical Director', phone: '08012345678', kind: 'medical' },
    { id: 'security-desk', name: 'Security Desk', role: 'Duty Lead Officer', phone: '08098765432', kind: 'security' },
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

export function useOrganization(): OrganizationSettings {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return settings
}

export function updateProfile(profile: OrgProfile): void {
  settings.profile = profile
  emit()
}

export function setHours(hours: OrgDayHours[]): void {
  settings.hours = hours
  emit()
}

export function setDayOpen(day: string, open: boolean): void {
  settings.hours = settings.hours.map((h) => (h.day === day ? { ...h, open } : h))
  emit()
}

let seq = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`

export function addBranch(branch: Omit<Branch, 'id'>): void {
  settings.branches = [...settings.branches, { ...branch, id: nextId('branch') }]
  emit()
}

export function addContact(contact: Omit<EmergencyContact, 'id'>): void {
  settings.contacts = [...settings.contacts, { ...contact, id: nextId('contact') }]
  emit()
}

/** "07:00" → "7:00 AM". */
export function formatHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** A day's hours are usable when it closes after it opens. */
export function validHours(h: OrgDayHours): boolean {
  return !h.open || (h.start !== '' && h.end !== '' && h.start < h.end)
}

/** Digits, spaces and a leading +, 7–15 digits in all. */
export function validPhone(phone: string): boolean {
  const digits = phone.replace(/[\s-]/g, '')
  return /^\+?\d{7,15}$/.test(digits)
}
