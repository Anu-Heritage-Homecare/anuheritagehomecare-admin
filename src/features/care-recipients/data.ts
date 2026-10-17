import type {
  CareLevel,
  Priority,
  RecipientStatus,
  Tone,
} from '@/types'

export interface Recipient {
  id: string
  /** Human-facing reference shown under the name, e.g. #CR-001. */
  ref: string
  name: string
  age: number
  condition: string
  careLevel: CareLevel
  caregiver: string | null
  status: RecipientStatus
  priority: Priority
  lastVisit: string | null
  /** Collected by the Add Care Recipient drawer; the fixtures predate it. */
  intake?: RecipientIntake
}

export interface RecipientIntake {
  dateOfBirth: string
  gender: string
  phone: string
  address: string
  emergencyContact: { name: string; relationship: string; phone: string }
}

export interface Summary {
  id: string
  label: string
  value: string
  meta: string
  metaTone: Tone
  hint: string
}

export interface Trigger {
  id: string
  label: string
  count: number
  tone: Tone
}

/*
 * Stands in for a paged API response. The directory summary, the plan mix on
 * Plans & Billing and every derived headline read these four numbers, so they
 * are constants rather than strings inside the cards.
 */
export const TOTAL_RECIPIENTS = 342
export const ACTIVE_RECIPIENTS = 298
export const ON_HOLD_RECIPIENTS = 31
/** Whatever is left, so the three states always account for the total. */
export const DISCHARGED_RECIPIENTS =
  TOTAL_RECIPIENTS - ACTIVE_RECIPIENTS - ON_HOLD_RECIPIENTS

export const PAGE_SIZE = 8

/*
 * Care coordinators. A single hard-coded name used to appear in two places —
 * the fallback profile and the synthesised care team — which made the
 * coordinator column on the subscriptions workspace carry no information, and
 * let the two disagree once one of them varied. Assigned by position so it is
 * stable across reloads rather than random, and drawn from a roster distinct
 * from the caregivers.
 */
export const coordinators = ['Mike Chen', 'Dr. Jane Foster', 'Amara Nwosu'] as const

export function coordinatorFor(recipientId: string): string {
  const index = recipients.findIndex((r) => r.id === recipientId)
  return coordinators[Math.max(index, 0) % coordinators.length]
}

export const summaries: Summary[] = [
  {
    id: 'total',
    label: 'Total Care Recipients',
    value: String(TOTAL_RECIPIENTS),
    meta: '↑8 this month',
    metaTone: 'green',
    hint: 'Active and pipeline recipients',
  },
  {
    id: 'active',
    label: 'Active',
    value: String(ACTIVE_RECIPIENTS),
    meta: `${Math.round((ACTIVE_RECIPIENTS / TOTAL_RECIPIENTS) * 100)}% of total`,
    metaTone: 'blue',
    hint: 'Receiving ongoing care services',
  },
  {
    id: 'on-hold',
    label: 'On Hold',
    value: String(ON_HOLD_RECIPIENTS),
    meta: 'Temporarily paused',
    metaTone: 'amber',
    hint: 'Awaiting clinical clearance',
  },
  {
    id: 'discharged',
    label: 'Discharged',
    value: String(DISCHARGED_RECIPIENTS),
    meta: 'This quarter',
    metaTone: 'blue',
    hint: 'Completed care transition',
  },
]

export const recipients: Recipient[] = [
  {
    id: 'cr-001',
    ref: '#CR-001',
    name: 'Margaret Johnson',
    age: 78,
    condition: "Alzheimer's Disease",
    careLevel: 'Full-Time',
    caregiver: 'Sarah Williams',
    status: 'active',
    priority: 'high',
    lastVisit: 'Today, 9:00 AM',
  },
  {
    id: 'cr-002',
    ref: '#CR-002',
    name: 'Robert Chen',
    age: 82,
    condition: 'Post-Stroke Recovery',
    careLevel: 'Full-Time',
    caregiver: 'David Park',
    status: 'active',
    priority: 'medium',
    lastVisit: 'Wed, 1:00 PM',
  },
  {
    id: 'cr-003',
    ref: '#CR-003',
    name: 'Eleanor Davis',
    age: 71,
    condition: "Parkinson's Disease",
    careLevel: 'Part-Time',
    caregiver: 'Maria Garcia',
    status: 'active',
    priority: 'high',
    lastVisit: 'Yesterday',
  },
  {
    id: 'cr-004',
    ref: '#CR-004',
    name: 'James Wilson',
    age: 88,
    condition: 'Wound Care',
    careLevel: 'Full-Time',
    caregiver: null,
    status: 'on-hold',
    priority: 'urgent',
    lastVisit: '3 days ago',
  },
  {
    id: 'cr-005',
    ref: '#CR-005',
    name: 'Patricia Brown',
    age: 65,
    condition: 'Diabetes Management',
    careLevel: 'Hourly',
    caregiver: 'Lisa Thompson',
    status: 'active',
    priority: 'low',
    lastVisit: 'Today, 11:00 AM',
  },
  {
    id: 'cr-006',
    ref: '#CR-006',
    name: 'William Taylor',
    age: 91,
    condition: 'Palliative Care',
    careLevel: '24-Hour',
    caregiver: 'John Adams',
    status: 'active',
    priority: 'critical',
    lastVisit: 'Today, 8:00 AM',
  },
  {
    id: 'cr-007',
    ref: '#CR-007',
    name: 'Dorothy Martinez',
    age: 74,
    condition: 'Hip Replacement Recovery',
    careLevel: 'Part-Time',
    caregiver: 'Emma Wilson',
    status: 'active',
    priority: 'medium',
    lastVisit: 'Yesterday',
  },
  {
    id: 'cr-008',
    ref: '#CR-008',
    name: 'Richard Lee',
    age: 69,
    condition: 'COPD Management',
    careLevel: 'Hourly',
    caregiver: null,
    status: 'new',
    priority: 'normal',
    lastVisit: null,
  },
]

export const recentlyViewed = [
  'Margaret Johnson',
  'Robert Chen',
  'Eleanor Davis',
  'William Taylor',
]

export const triggers: Trigger[] = [
  { id: 'attention', label: 'Needs Attention', count: 12, tone: 'red' },
  { id: 'care-plan', label: 'Missing Care Plan', count: 3, tone: 'amber' },
  { id: 'overdue', label: 'Overdue Visit', count: 5, tone: 'slate' },
]

/**
 * Adds a recipient from the Add Care Recipient drawer. A placeholder for
 * intake until there is a design and an API: held in memory for the session,
 * entered as "New" with no visits yet. The headline counts above are a paged
 * API's totals and are not moved by it.
 */
export function addRecipient(input: Omit<Recipient, 'id' | 'ref' | 'status' | 'lastVisit'>): Recipient {
  const next =
    Math.max(0, ...recipients.map((r) => Number(r.id.replace(/\D/g, '')) || 0)) + 1
  const n = String(next).padStart(3, '0')
  const recipient: Recipient = {
    ...input,
    id: `cr-${n}`,
    ref: `#CR-${n}`,
    status: 'new',
    lastVisit: null,
  }
  recipients.unshift(recipient)
  return recipient
}
