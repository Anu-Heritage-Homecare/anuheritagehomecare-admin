import type { Tone } from '@/types'

/* ---------------------------------- types --------------------------------- */

export interface HealthSummaryCard {
  id: string
  label: string
  value: string
  detail: string
}

/** Green = within range, amber = watch, blue = tracked but not scored. */
export type VitalStatus = 'normal' | 'watch' | 'neutral'

export interface VitalTrend {
  id: string
  label: string
  value: string
  unit: string
  status: VitalStatus
  /** Oldest → newest. Drives the sparkline and its text alternative. */
  series: number[]
  seriesUnit: string
}

export type EventCategory =
  | 'vitals'
  | 'incidents'
  | 'medication'
  | 'assessments'
  | 'appointments'

export interface HealthEvent {
  id: string
  /** ISO, for sorting and range filtering. */
  date: string
  dateLabel: string
  title: string
  detail: string
  recordedBy: string
  recordedByRole: string
  category: EventCategory
  /** Badge text — finer-grained than the filter category. */
  badge: string
  tone: Tone
}

export interface HealthRecord {
  summary: HealthSummaryCard[]
  vitals: VitalTrend[]
  events: HealthEvent[]
}

export const EVENTS_PAGE_SIZE = 8

export const eventFilters: { value: EventCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vitals', label: 'Vitals' },
  { value: 'incidents', label: 'Incidents' },
  { value: 'medication', label: 'Medication' },
  { value: 'assessments', label: 'Assessments' },
  { value: 'appointments', label: 'Appointments' },
]

/* ---------------------------------- data ---------------------------------- */

const records: Record<string, HealthRecord> = {
  'cr-001': {
    summary: [
      {
        id: 'conditions',
        label: 'Primary Conditions',
        value: "Alzheimer's (Stage 2)",
        detail: 'Also diagnosed with Hypertension and Type 2 Diabetes.',
      },
      {
        id: 'vitals',
        label: 'Last Vitals',
        value: '128/82 mmHg • 72 bpm',
        detail: 'Temp 98.4°F • O₂ 97% — Recorded today',
      },
      {
        id: 'appointment',
        label: 'Next Appointment',
        value: 'Dr. Sarah Kim • Nov 5, 2026',
        detail: 'Scheduled for Quarterly Review.',
      },
    ],
    vitals: [
      {
        id: 'bp',
        label: 'Blood Pressure',
        value: '128/82',
        unit: 'mmHg',
        status: 'normal',
        series: [126, 130, 124, 132, 128, 127, 128],
        seriesUnit: 'mmHg systolic',
      },
      {
        id: 'hr',
        label: 'Heart Rate',
        value: '72',
        unit: 'bpm',
        status: 'normal',
        series: [70, 74, 71, 75, 72, 73, 72],
        seriesUnit: 'bpm',
      },
      {
        id: 'glucose',
        label: 'Blood Glucose',
        value: '142',
        unit: 'mg/dL',
        status: 'watch',
        series: [138, 145, 150, 146, 168, 152, 142],
        seriesUnit: 'mg/dL',
      },
      {
        id: 'weight',
        label: 'Weight',
        value: '145',
        unit: 'lbs',
        status: 'neutral',
        series: [147, 146, 146, 145, 144, 146, 145],
        seriesUnit: 'lbs',
      },
      {
        id: 'oxygen',
        label: 'Oxygen',
        value: '97',
        unit: '%',
        status: 'normal',
        series: [97, 96, 98, 97, 97, 98, 97],
        seriesUnit: '% saturation',
      },
    ],
    /*
     * Reverse-chronological and all at or before 2026-07-24, the sample's
     * "today". Cross-referenced with visits-data (caregiver on shift) and
     * medications-data (the Memantine timing change).
     */
    events: [
      {
        id: 'he1',
        date: '2026-07-24',
        dateLabel: 'July 24, 2026',
        title: 'Vitals Recorded',
        detail:
          'BP 128/82, HR 72, Temp 98.4, glucose 142 mg/dL. All within normal range except glucose. Recorded during morning visit.',
        recordedBy: 'Sarah Williams',
        recordedByRole: 'Primary Caregiver',
        category: 'vitals',
        badge: 'Vitals',
        tone: 'green',
      },
      {
        // Paired with the flagged care note and the near-miss report document.
        id: 'he2b',
        date: '2026-07-22',
        dateLabel: 'July 22, 2026',
        title: 'Near-Miss Incident',
        detail:
          'Client attempted to stand from wheelchair unassisted at 2:45 PM during a therapy session. Caregiver intervened, no fall and no injury. Call button use reinforced.',
        recordedBy: 'David Park',
        recordedByRole: 'Backup Caregiver',
        category: 'incidents',
        badge: 'Incident',
        tone: 'red',
      },
      {
        id: 'he2',
        date: '2026-07-22',
        dateLabel: 'July 22, 2026',
        title: 'Blood Glucose Alert',
        detail:
          'Fasting glucose 168 mg/dL — above target range. Caregiver notified care coordinator. Diet adjustment recommended.',
        recordedBy: 'Sarah Williams',
        recordedByRole: 'Primary Caregiver',
        category: 'vitals',
        badge: 'Alert',
        tone: 'amber',
      },
      {
        id: 'he3',
        date: '2026-07-20',
        dateLabel: 'July 20, 2026',
        title: 'Medication Change',
        detail:
          'Evening medication schedule adjusted. Memantine moved from 9 PM to 8 PM per patient sleep pattern.',
        recordedBy: 'Dr. Sarah Kim',
        recordedByRole: 'Geriatrician',
        category: 'medication',
        badge: 'Medication',
        tone: 'blue',
      },
      {
        id: 'he4',
        date: '2026-07-15',
        dateLabel: 'July 15, 2026',
        title: 'Fall Incident',
        detail:
          'Minor fall in bathroom at 9:15 AM. No injury sustained. Grab bars check completed. Incident report filed.',
        recordedBy: 'Sarah Williams',
        recordedByRole: 'Primary Caregiver',
        category: 'incidents',
        badge: 'Incident',
        tone: 'red',
      },
      {
        id: 'he5',
        date: '2026-07-12',
        dateLabel: 'July 12, 2026',
        title: 'Quarterly Assessment',
        detail:
          'Cognitive assessment score: 18/30 MMSE (stable from last quarter). Physical mobility maintained. Care plan goals reviewed.',
        recordedBy: 'Mike Chen',
        recordedByRole: 'Care Coordinator',
        category: 'assessments',
        badge: 'Assessment',
        tone: 'purple',
      },
      {
        id: 'he6',
        date: '2026-07-01',
        dateLabel: 'July 1, 2026',
        title: 'Specialist Visit',
        detail:
          "Neurologist Dr. Osei — Alzheimer's progression stable. Memantine 10mg initiated alongside the existing regimen. Next visit in 3 months.",
        recordedBy: 'Dr. Osei',
        recordedByRole: 'Neurologist',
        category: 'appointments',
        badge: 'Specialist',
        tone: 'blue',
      },
      {
        id: 'he7',
        date: '2026-06-25',
        dateLabel: 'June 25, 2026',
        title: 'Vitals Recorded',
        detail:
          'BP 132/84, HR 75, Temp 98.2. Blood pressure slightly elevated. Monitoring.',
        recordedBy: 'Sarah Williams',
        recordedByRole: 'Primary Caregiver',
        category: 'vitals',
        badge: 'Vitals',
        tone: 'green',
      },
      {
        id: 'he8',
        date: '2026-06-20',
        dateLabel: 'June 20, 2026',
        title: 'Metformin Started',
        detail:
          'Metformin 500mg twice daily initiated following elevated HbA1c. Food instructions documented in the care plan.',
        recordedBy: 'Dr. James Park',
        recordedByRole: 'Physician',
        category: 'medication',
        badge: 'Medication',
        tone: 'blue',
      },
      {
        id: 'he9',
        date: '2026-06-05',
        dateLabel: 'June 5, 2026',
        title: 'Wound Check',
        detail:
          'Surgical wound from the May procedure healing well, no signs of infection. Dressing changes continue every 48 hours.',
        recordedBy: 'Emma Wilson',
        recordedByRole: 'Clinical Nurse',
        category: 'assessments',
        badge: 'Assessment',
        tone: 'green',
      },
      {
        id: 'he10',
        date: '2026-06-01',
        dateLabel: 'June 1, 2026',
        title: 'Prescription Review',
        detail:
          'Prescription status confirmed with no changes. Care plan goals on track. Family briefed by coordinator.',
        recordedBy: 'Dr. James Park',
        recordedByRole: 'Physician',
        category: 'assessments',
        badge: 'Assessment',
        tone: 'purple',
      },
      {
        id: 'he11',
        date: '2026-05-18',
        dateLabel: 'May 18, 2026',
        title: 'Post-Surgical Follow-up',
        detail:
          'Clinic follow-up. Wound site reviewed, healing on schedule. Dressing change frequency confirmed at every 48 hours.',
        recordedBy: 'Emma Wilson',
        recordedByRole: 'Clinical Nurse',
        category: 'appointments',
        badge: 'Specialist',
        tone: 'blue',
      },
      {
        // Deliberately older than 90 days so the range filter has something to
        // exclude at every setting.
        id: 'he12',
        date: '2026-04-20',
        dateLabel: 'April 20, 2026',
        title: 'Blood Pressure Watch Cleared',
        detail:
          'Two weeks of readings within target after the Lisinopril adjustment. Returned to routine monitoring.',
        recordedBy: 'Dr. James Park',
        recordedByRole: 'Physician',
        category: 'vitals',
        badge: 'Vitals',
        tone: 'green',
      },
    ],
  },
}

export function getHealthRecord(recipientId: string): HealthRecord | undefined {
  return records[recipientId]
}

/** What Add Health Event offers, each with the badge and colour the timeline uses. */
export const eventKinds: { id: string; label: string; category: EventCategory; badge: string; tone: Tone }[] = [
  { id: 'vitals', label: 'Vitals reading', category: 'vitals', badge: 'Vitals', tone: 'green' },
  { id: 'vitals-alert', label: 'Vitals alert', category: 'vitals', badge: 'Alert', tone: 'amber' },
  { id: 'incident', label: 'Incident', category: 'incidents', badge: 'Incident', tone: 'red' },
  { id: 'medication', label: 'Medication change', category: 'medication', badge: 'Medication', tone: 'blue' },
  { id: 'assessment', label: 'Assessment', category: 'assessments', badge: 'Assessment', tone: 'purple' },
  { id: 'appointment', label: 'Appointment', category: 'appointments', badge: 'Appointment', tone: 'blue' },
]

/**
 * Adds an event from the Add Health Event page to the timeline. A recipient
 * with no record gets one with just the timeline. Held in memory.
 */
export function addHealthEvent(recipientId: string, event: Omit<HealthEvent, 'id' | 'dateLabel'>): void {
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const record = records[recipientId] ?? { summary: [], vitals: [], events: [] }
  records[recipientId] = {
    ...record,
    events: [{ ...event, id: `he-new-${Date.now().toString(36)}`, dateLabel }, ...record.events],
  }
}
