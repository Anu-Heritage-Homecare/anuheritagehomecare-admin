import { Activity, Clock, Link2, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Tone } from '@/types'

/* ---------------------------------- types --------------------------------- */

export type PrescriptionStatus = 'active' | 'paused' | 'discontinued'

export interface Prescription {
  id: string
  name: string
  /** Brand name shown in parentheses after the generic, where one exists. */
  brand?: string
  strength: string
  purpose: string
  schedule: string
  prescribedBy: string
  /** ISO, for sorting. `startDateLabel` is what gets rendered. */
  startDate: string
  startDateLabel: string
  /** Null until a dose has been recorded — a new prescription has no history. */
  adherence: number | null
  status: PrescriptionStatus
  lastAdministered: string
  /** Surfaced as an amber chip on the card. */
  flag?: string
}

export type DoseState = 'administered' | 'scheduled' | 'missed'

export interface DoseWindow {
  id: string
  time: string
  title: string
  medications: string
  state: DoseState
  /** Who gave (or is assigned) the dose — a field, not scraped from `note`. */
  administeredBy: string
  note: string
}

export interface ClinicalWarning {
  id: string
  title: string
  detail: string
  /** Only `interaction` entries count toward the Active Alerts stat. */
  kind: 'interaction' | 'instruction'
}

export interface AuditEntry {
  id: string
  /** ISO, for machine use. `date` is the display label. */
  dateIso: string
  date: string
  title: string
  detail: string
}

export interface MedicationStat {
  id: string
  label: string
  value: string
  hint: string
  hintTone: Tone
  icon: LucideIcon
  tone: Tone
}

export interface MedicationPlan {
  stats: MedicationStat[]
  prescriptions: Prescription[]
  /** ISO, for machine use. `scheduleDate` is the display label. */
  scheduleDateIso: string
  scheduleDate: string
  doses: DoseWindow[]
  warnings: ClinicalWarning[]
  audits: AuditEntry[]
}

/**
 * Below this, adherence is treated as needing attention — it drives the card
 * accent and the progress bar colour rather than each row hardcoding a tone.
 */
export const ADHERENCE_THRESHOLD = 95

/* ---------------------------------- data ---------------------------------- */

const plans: Record<string, MedicationPlan> = {
  'cr-001': {
    stats: [
      {
        id: 'active',
        label: 'Active Medications',
        value: '4',
        hint: 'All current prescriptions',
        hintTone: 'slate',
        icon: Link2,
        tone: 'blue',
      },
      {
        id: 'adherence',
        label: 'Adherence Rate',
        value: '93%',
        hint: '↑ 2% vs last month',
        hintTone: 'green',
        icon: Activity,
        tone: 'green',
      },
      {
        id: 'next-dose',
        label: 'Next Dose Due',
        value: '5:00 PM Today',
        hint: 'Metformin (500mg)',
        hintTone: 'blue',
        icon: Clock,
        tone: 'blue',
      },
      {
        id: 'alerts',
        label: 'Active Alerts',
        value: '1 Alert',
        hint: 'Interaction warning',
        hintTone: 'amber',
        icon: TriangleAlert,
        tone: 'amber',
      },
    ],
    prescriptions: [
      {
        id: 'rx1',
        name: 'Donepezil',
        brand: 'Aricept',
        strength: '10mg',
        purpose: "Alzheimer's cognitive function",
        schedule: 'Once daily, Morning (with food)',
        prescribedBy: 'Dr. Sarah Kim',
        startDate: '2026-03-15',
        startDateLabel: 'Mar 15, 2026',
        adherence: 96,
        status: 'active',
        lastAdministered: 'Today 9:00 AM by Sarah Williams',
      },
      {
        id: 'rx2',
        name: 'Lisinopril',
        strength: '20mg',
        purpose: 'Blood pressure management',
        schedule: 'Once daily, Morning',
        prescribedBy: 'Dr. James Park',
        startDate: '2026-01-08',
        startDateLabel: 'Jan 8, 2026',
        adherence: 98,
        status: 'active',
        lastAdministered: 'Today 9:00 AM by Sarah Williams',
      },
      {
        id: 'rx3',
        name: 'Metformin',
        strength: '500mg',
        purpose: 'Type 2 Diabetes management',
        schedule: 'Twice daily, Breakfast & Dinner',
        prescribedBy: 'Dr. James Park',
        startDate: '2026-06-20',
        startDateLabel: 'Jun 20, 2026',
        adherence: 91,
        status: 'active',
        lastAdministered: 'Today 9:00 AM by Sarah Williams',
        flag: 'Missed dinner dose July 22',
      },
      {
        id: 'rx4',
        name: 'Memantine',
        brand: 'Namenda',
        strength: '10mg',
        purpose: "Alzheimer's — moderate to severe",
        schedule: 'Once daily, Evening',
        prescribedBy: 'Dr. Sarah Kim',
        startDate: '2026-07-01',
        startDateLabel: 'Jul 1, 2026',
        adherence: 88,
        status: 'active',
        lastAdministered: 'Yesterday 8:00 PM by David Park',
      },
    ],
    scheduleDateIso: '2026-07-24',
    scheduleDate: 'July 24, 2026',
    doses: [
      {
        id: 'd1',
        time: '9:00 AM',
        title: 'Morning Doses',
        medications: 'Donepezil (10mg), Lisinopril (20mg), Metformin (500mg)',
        state: 'administered',
        administeredBy: 'Sarah Williams',
        note: 'Administered by Sarah Williams',
      },
      {
        id: 'd2',
        time: '5:00 PM',
        title: 'Dinner Dose',
        medications: 'Metformin (500mg)',
        state: 'scheduled',
        administeredBy: 'Sarah Williams',
        note: 'Scheduled (Sarah Williams assigned)',
      },
      {
        id: 'd3',
        time: '8:00 PM',
        title: 'Evening Dose',
        medications: 'Memantine (10mg)',
        state: 'scheduled',
        administeredBy: 'David Park',
        note: 'Scheduled (David Park assigned)',
      },
    ],
    warnings: [
      {
        id: 'w1',
        title: 'Donepezil + Memantine Interaction',
        detail:
          'Moderate risk. Monitor closely for increased cognitive and side effect synergy. Prescribed & approved jointly by Dr. Sarah Kim.',
        kind: 'interaction',
      },
      {
        id: 'w2',
        title: 'Metformin Food Instructions',
        detail:
          'Metformin should always be taken with food (Breakfast and Dinner) to minimize gastrointestinal discomfort.',
        kind: 'instruction',
      },
    ],
    audits: [
      {
        id: 'a1',
        dateIso: '2026-07-01',
        date: 'Jul 1, 2026',
        title: 'Memantine 10mg Added',
        detail: 'Authorized by Dr. Sarah Kim',
      },
      {
        id: 'a1b',
        dateIso: '2026-06-20',
        date: 'Jun 20, 2026',
        title: 'Metformin 500mg Added',
        detail: 'Initiated by Dr. James Park following elevated HbA1c',
      },
      {
        id: 'a2',
        dateIso: '2026-06-15',
        date: 'Jun 15, 2026',
        title: 'Donepezil Increased',
        detail: 'Increased 5mg → 10mg — Dr. Kim',
      },
      {
        id: 'a3',
        dateIso: '2026-06-01',
        date: 'Jun 1, 2026',
        title: 'Prescription Review',
        detail: 'Status confirmed, no changes — Dr. Park',
      },
      {
        id: 'a4',
        dateIso: '2026-04-20',
        date: 'Apr 20, 2026',
        title: 'Lisinopril Adjusted',
        detail: 'Dose stabilised, blood pressure watch cleared — Dr. Park',
      },
    ],
  },
}

export function getMedicationPlan(
  recipientId: string,
): MedicationPlan | undefined {
  return plans[recipientId]
}

/* --------------------------------- adding --------------------------------- */

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Adds a prescription from the Add Medication page, records it in the
 * prescription history and keeps the Active Medications count true. A
 * recipient with no plan gets one. Held in memory for the session.
 */
export function addPrescription(
  recipientId: string,
  rx: Omit<Prescription, 'id' | 'adherence' | 'lastAdministered' | 'status' | 'startDateLabel'>,
): void {
  const prescription: Prescription = {
    ...rx,
    id: `rx-new-${Date.now().toString(36)}`,
    startDateLabel: shortDate(rx.startDate),
    adherence: null,
    status: 'active',
    lastAdministered: 'Not yet administered',
  }
  const audit: AuditEntry = {
    id: `a-new-${Date.now().toString(36)}`,
    dateIso: rx.startDate,
    date: shortDate(rx.startDate),
    title: `${rx.name} ${rx.strength} Added`,
    detail: `Prescribed by ${rx.prescribedBy}${rx.purpose ? ` for ${rx.purpose.toLowerCase()}` : ''}`,
  }
  const plan = plans[recipientId] ?? {
    stats: [
      { id: 'active', label: 'Active Medications', value: '0', hint: 'All current prescriptions', hintTone: 'slate', icon: Link2, tone: 'blue' },
      { id: 'adherence', label: 'Adherence Rate', value: '—', hint: 'No doses recorded yet', hintTone: 'slate', icon: Activity, tone: 'green' },
      { id: 'next-dose', label: 'Next Dose Due', value: '—', hint: 'No dosing schedule yet', hintTone: 'slate', icon: Clock, tone: 'blue' },
      { id: 'alerts', label: 'Active Alerts', value: 'None', hint: 'No interaction warnings', hintTone: 'slate', icon: TriangleAlert, tone: 'amber' },
    ],
    prescriptions: [],
    scheduleDateIso: rx.startDate,
    scheduleDate: shortDate(rx.startDate),
    doses: [],
    warnings: [],
    audits: [],
  }
  const prescriptions = [...plan.prescriptions, prescription]
  const active = prescriptions.filter((p) => p.status === 'active').length
  plans[recipientId] = {
    ...plan,
    prescriptions,
    stats: plan.stats.map((s) => (s.id === 'active' ? { ...s, value: String(active) } : s)),
    audits: [audit, ...plan.audits].sort((a, b) => b.dateIso.localeCompare(a.dateIso)),
  }
}

/* --------------------------------- sorting -------------------------------- */

export type MedicationSort = 'newest' | 'oldest' | 'adherence' | 'name'

export const sortOptions: { value: MedicationSort; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'adherence', label: 'Lowest Adherence' },
  { value: 'name', label: 'Name A–Z' },
]

const comparators: Record<
  MedicationSort,
  (a: Prescription, b: Prescription) => number
> = {
  newest: (a, b) => b.startDate.localeCompare(a.startDate),
  oldest: (a, b) => a.startDate.localeCompare(b.startDate),
  // Unrecorded adherence sorts last: there is nothing yet to be low.
  adherence: (a, b) => (a.adherence ?? Infinity) - (b.adherence ?? Infinity),
  name: (a, b) => a.name.localeCompare(b.name),
}

export function sortPrescriptions(
  items: Prescription[],
  sort: MedicationSort,
): Prescription[] {
  return [...items].sort(comparators[sort])
}
