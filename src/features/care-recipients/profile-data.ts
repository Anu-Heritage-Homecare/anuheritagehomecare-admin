import { coordinatorFor, recipients } from './data'
import { getFamilyRecord } from './family-data'
import { placeOfRecipient } from '@/features/monitoring/locations-data'
import type { Recipient } from './data'
import { getCaregiverRecord } from './caregivers-data'
import { getMedicationPlan } from './medications-data'
import { formatNoteTime, getCareNotes } from './notes-data'
import { formatVisitDate, getVisitHistory } from './visits-data'
import type { Tone, VisitStatus } from '@/types'

/* ---------------------------------- types --------------------------------- */

export interface Contact {
  name: string
  relationship: string
  phone: string
}

export interface Personal {
  phone: string
  email: string
  address: string
  dateOfBirth: string
  familyMember: Contact
  languages: string
}

export interface CareSummary {
  /** ISO, for machine use. `startDate` is the display label. */
  startDateIso: string
  startDate: string
  primaryDiagnosis: string
  secondaryDiagnosis: string
  coordinator: string
  nextVisit: string
  emergencyContact: Contact
}

export interface QuickStat {
  label: string
  value: string
  tone?: Tone
}

export interface Medication {
  id: string
  name: string
  schedule: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
}

export interface PastVisit {
  id: string
  date: string
  caregiver: string
  type: string
  duration: string
  status: VisitStatus
}

export interface UpcomingVisit {
  id: string
  when: string
  title: string
  caregiver: string
}

export interface CareNote {
  id: string
  author: string
  role: string
  at: string
  body: string
}

export interface RecipientProfile extends Recipient {
  sex: string
  personal: Personal
  summary: CareSummary
  quickStats: QuickStat[]
  medications: Medication[]
  team: TeamMember[]
  recentVisits: PastVisit[]
  upcoming: UpcomingVisit[]
  notes: CareNote[]
}

/* ------------------------------- detail data ------------------------------ */

type Detail = Omit<
  RecipientProfile,
  keyof Recipient | 'medications' | 'recentVisits' | 'team' | 'notes'
>

const details: Record<string, Detail> = {
  'cr-001': {
    sex: 'Female',
    personal: {
      phone: '(555) 234-5678',
      email: 'margaret.johnson@example.com',
      address: '234 Maple Drive, Springfield, IL 62701',
      dateOfBirth: 'June 15, 1948',
      familyMember: {
        name: 'David Johnson',
        relationship: 'Son',
        phone: '(555) 123-4567',
      },
      languages: 'English',
    },
    summary: {
      startDateIso: '2026-03-15',
      startDate: 'March 15, 2026',
      primaryDiagnosis: "Alzheimer's Disease (Stage 2)",
      secondaryDiagnosis: 'Hypertension, Type 2 Diabetes',
      coordinator: 'Mike Chen',
      nextVisit: 'Today, 2:00 PM',
      emergencyContact: {
        name: 'David Johnson',
        relationship: 'Son',
        phone: '(555) 123-4567',
      },
    },
    quickStats: [
      { label: 'Total Visits', value: '28 visits' },
      { label: 'Care Hours Logged', value: '62 hours' },
      { label: 'Avg Satisfaction', value: '4.9 / 5.0', tone: 'green' },
      { label: 'Missed / Late Visits', value: '0', tone: 'green' },
      { label: 'Active Care Alerts', value: '1 urgent', tone: 'red' },
    ],
    upcoming: [
      {
        id: 'uv1',
        when: 'Today, 2:00 PM',
        title: 'Afternoon Walk & Exercise',
        caregiver: 'Sarah Williams',
      },
      {
        id: 'uv2',
        when: 'Tomorrow, 9:30 AM',
        title: 'Daily Assistance & Breakfast',
        caregiver: 'Sarah Williams',
      },
      {
        id: 'uv3',
        when: 'Today, 7:30 PM',
        title: 'Evening Routine & Medication',
        caregiver: 'David Park',
      },
      {
        id: 'uv4',
        when: 'Tomorrow, 10:00 AM',
        title: 'Occupational Therapy',
        caregiver: 'Emma Wilson',
      },
    ],
  },
}

/* --------------------------------- lookup --------------------------------- */

/**
 * Only cr-001 has hand-authored detail. Rather than 404 the other seven rows,
 * synthesise a plausible record from the directory entry so every row in the
 * table opens to a working profile.
 */
function synthesise(r: Recipient): Detail {
  const surname = r.name.split(' ').slice(-1)[0] ?? 'Family'

  /*
   * The family directory is the record of who the contacts are, so the profile
   * reads it rather than inventing "Davis family contact" — the two used to
   * name different people for the same client.
   */
  const family = getFamilyRecord(r.id)?.members ?? []
  const primary =
    family.find((m) => m.roles.includes('Primary Contact')) ?? family[0]
  const emergency =
    family.find((m) => m.roles.includes('Emergency Contact')) ?? primary

  const contactFrom = (member: (typeof family)[number] | undefined): Contact =>
    member
      ? {
          name: member.name,
          relationship: member.relationship,
          phone: member.phone,
        }
      : {
          name: `${surname} family contact`,
          relationship: 'Next of kin',
          phone: 'Not recorded',
        }

  return {
    sex: 'Not recorded',
    personal: {
      phone: '(555) 000-0000',
      email: `${r.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      // The same address the map plots, so the two cannot disagree.
      address: placeOfRecipient(r.id)?.address ?? 'On file — not shown in sample data',
      dateOfBirth: `${new Date().getFullYear() - r.age} (approx.)`,
      familyMember: contactFrom(primary),
      languages: 'English',
    },
    summary: {
      startDateIso: '',
      startDate: 'Not recorded',
      primaryDiagnosis: r.condition,
      secondaryDiagnosis: 'None recorded',
      coordinator: coordinatorFor(r.id),
      nextVisit: r.lastVisit ? 'Scheduled' : 'Not scheduled',
      emergencyContact: contactFrom(emergency),
    },
    quickStats: [
      { label: 'Total Visits', value: '—' },
      { label: 'Care Hours Logged', value: '—' },
      { label: 'Avg Satisfaction', value: '—' },
      { label: 'Missed / Late Visits', value: '—' },
      { label: 'Active Care Alerts', value: '—' },
    ],
    upcoming: [],
  }
}

/* --------------------------------- edits ---------------------------------- */

/** What the Edit Profile page changes beyond the directory row itself. */
export interface ProfileEdits {
  sex: string
  personal: Pick<Personal, 'phone' | 'email' | 'address' | 'dateOfBirth' | 'languages'>
  summary: Pick<
    CareSummary,
    'startDateIso' | 'startDate' | 'primaryDiagnosis' | 'secondaryDiagnosis' | 'coordinator' | 'emergencyContact'
  >
}

const edits = new Map<string, ProfileEdits>()

/**
 * Saves the Edit Profile page. The directory fields are written onto the
 * shared row, so the directory, the header and every tab agree; the rest is
 * laid over the profile detail. Held in memory for the session.
 */
export function saveRecipientProfile(
  id: string,
  row: Pick<Recipient, 'name' | 'age' | 'condition' | 'careLevel' | 'priority'>,
  profile: ProfileEdits,
): void {
  const base = recipients.find((r) => r.id === id)
  if (!base) return
  Object.assign(base, row)
  edits.set(id, profile)
}

function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** What an intake form entered beats what synthesise() would invent. */
function withIntake(detail: Detail, base: Recipient): Detail {
  const intake = base.intake
  if (!intake) return detail
  return {
    ...detail,
    sex: intake.gender,
    personal: {
      ...detail.personal,
      phone: intake.phone || detail.personal.phone,
      address: intake.address,
      dateOfBirth: formatLongDate(intake.dateOfBirth),
    },
    summary: { ...detail.summary, emergencyContact: intake.emergencyContact },
  }
}

function withEdits(detail: Detail, id: string): Detail {
  const e = edits.get(id)
  if (!e) return detail
  return {
    ...detail,
    sex: e.sex,
    personal: { ...detail.personal, ...e.personal },
    summary: { ...detail.summary, ...e.summary },
  }
}

/**
 * The Overview panels summarise the Visits and Medications tabs, so they read
 * from those modules rather than keeping a second hand-authored copy — the two
 * copies had already drifted into contradicting each other.
 */
export function getRecipientProfile(id: string): RecipientProfile | undefined {
  const base = recipients.find((r) => r.id === id)
  if (!base) return undefined

  const recentVisits: PastVisit[] = (getVisitHistory(id)?.visits ?? [])
    .slice(0, 4)
    .map((v) => ({
      id: v.id,
      date: formatVisitDate(v),
      caregiver: v.caregiver,
      type: v.type,
      duration: `${v.durationHours.toFixed(1)} hrs`,
      status: v.status,
    }))

  const medications: Medication[] = (
    getMedicationPlan(id)?.prescriptions ?? []
  ).map((rx) => ({
    id: rx.id,
    name: `${rx.name} ${rx.strength}`,
    schedule: rx.schedule,
  }))

  const team: TeamMember[] = (getCaregiverRecord(id)?.team ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.primary ? `${m.role} (Active)` : m.role,
  }))

  // The Overview panel summarises the Notes tab; a second copy had already
  // drifted (it titled Sarah Williams "CNA", a certification, not a role).
  const notes: CareNote[] = getCareNotes(id)
    .slice(0, 3)
    .map((n) => ({
      id: n.id,
      author: n.author,
      role: n.authorRole,
      at: formatNoteTime(n.at),
      body: n.body,
    }))

  return {
    ...base,
    ...withEdits(withIntake(details[id] ?? synthesise(base), base), id),
    recentVisits,
    medications,
    team,
    notes,
  }
}
