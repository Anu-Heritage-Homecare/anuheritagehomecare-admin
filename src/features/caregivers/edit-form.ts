import { RATE_PER_HOUR } from '@/features/billing/data'
import { assignmentsFor, coordinatingFor } from './roster-data'
import {
  RENEWAL_WINDOW_DAYS,
  addStaffMember,
  nextStaffId,
  staffMembers,
  statusLabels,
  weekdays,
} from './staff'
import type {
  AvailabilityWindow,
  Credential,
  Employment,
  Shift,
  StaffMember,
  StaffStatus,
  Weekday,
} from './staff'
import { TODAY } from '@/lib/today'

export { TODAY }

/* ---------------------------------- shape --------------------------------- */

/**
 * Everything is a string, the way the DOM holds it. Parsing at the edge rather
 * than mid-form keeps "" a legal intermediate state — a number field that
 * coerces as you type fights the person clearing it.
 */
export interface FormValues {
  /** "Dr.", "Prof." — kept so a stored name round-trips exactly. */
  namePrefix: string
  firstName: string
  lastName: string
  dateOfBirth: string
  phone: string
  email: string
  street: string
  city: string
  state: string
  zip: string
  title: string
  employment: Employment
  branch: string
  hiredAt: string
  hourlyRate: string
  supervisor: string
  status: StaffStatus
  skills: string[]
  languages: string[]
  credentials: Credential[]
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  availability: AvailabilityWindow[]
  maxHoursPerWeek: string
  preferredShift: Shift
  notes: string
}

/* ------------------------------- name and place ---------------------------- */

/**
 * "Dr. Jane Foster" → title "Dr.", first "Jane", last "Foster". Splitting on
 * the first space alone would have made her first name "Dr.".
 */
export function splitName(full: string): {
  prefix: string
  first: string
  last: string
} {
  const parts = full.trim().split(/\s+/)
  const prefix = /^(dr|mr|mrs|ms|prof)\.?$/i.test(parts[0]) ? parts.shift()! : ''
  const last = parts.length > 1 ? parts.pop()! : ''
  return { prefix, first: parts.join(' '), last }
}

export function joinName(prefix: string, first: string, last: string): string {
  return [prefix, first, last].filter(Boolean).join(' ').trim()
}

/** The record stores one address line; the form edits it in four boxes. */
export function splitAddress(address: string): {
  street: string
  city: string
  state: string
  zip: string
} {
  const parts = address.split(',').map((p) => p.trim())
  // The tail is the last segment and the street keeps everything before the
  // city, so a four-part address no longer loses a line.
  const tail = parts.length > 2 ? parts.pop()! : ''
  const city = parts.length > 1 ? parts.pop()! : ''
  const street = parts.join(', ')

  const match = /^(.*?)\s*([\d-]{4,10})?$/.exec(tail)
  return {
    street,
    city,
    state: (match?.[1] ?? tail).trim(),
    zip: (match?.[2] ?? '').trim(),
  }
}

export function joinAddress(v: FormValues): string {
  const tail = [v.state, v.zip].filter(Boolean).join(' ')
  return [v.street, v.city, tail].filter(Boolean).join(', ')
}

/**
 * Builds a staff record from the form and adds it to the roster. No design
 * existed for creating a caregiver, so this follows the same shape the edit
 * form reads back: name and address are joined the way the record stores them,
 * and the fields the form does not collect take safe defaults the profile can
 * be edited to change.
 */
export function createCaregiver(values: FormValues): StaffMember {
  const id = nextStaffId()
  const email = values.email.trim()
  const member: StaffMember = {
    id,
    ref: `#${id.toUpperCase()}`,
    name: joinName(values.namePrefix, values.firstName.trim(), values.lastName.trim()),
    title: values.title,
    status: values.status,
    employment: values.employment,
    branch: values.branch,
    hiredAt: values.hiredAt,
    dateOfBirth: values.dateOfBirth,
    priorExperienceYears: 0,
    phone: values.phone.trim(),
    ...(email ? { email } : {}),
    hourlyRate: Number(values.hourlyRate),
    maxHoursPerWeek: Number(values.maxHoursPerWeek),
    preferredShift: values.preferredShift,
    supervisor: values.supervisor,
    notes: values.notes.trim(),
    address: joinAddress(values),
    emergencyContact: {
      name: values.emergencyName.trim(),
      relationship: values.emergencyRelationship.trim(),
      phone: values.emergencyPhone.trim(),
    },
    languages: values.languages,
    skills: values.skills,
    credentials: values.credentials,
    availability: values.availability,
  }
  addStaffMember(member)
  return member
}

/* -------------------------------- conversion ------------------------------- */

export function toFormValues(member: StaffMember): FormValues {
  const { prefix, first, last } = splitName(member.name)
  const address = splitAddress(member.address)

  return {
    namePrefix: prefix,
    firstName: first,
    lastName: last,
    dateOfBirth: member.dateOfBirth,
    phone: member.phone,
    email: member.email ?? '',
    ...address,
    title: member.title,
    employment: member.employment,
    branch: member.branch,
    hiredAt: member.hiredAt,
    hourlyRate: String(member.hourlyRate),
    supervisor: member.supervisor,
    status: member.status,
    skills: [...member.skills],
    languages: [...member.languages],
    credentials: member.credentials.map((c) => ({ ...c })),
    emergencyName: member.emergencyContact.name,
    emergencyRelationship: member.emergencyContact.relationship,
    emergencyPhone: member.emergencyContact.phone,
    availability: member.availability.map((w) => ({ ...w })),
    maxHoursPerWeek: String(member.maxHoursPerWeek),
    preferredShift: member.preferredShift,
    notes: member.notes,
  }
}

/* -------------------------------- validation ------------------------------- */

export type Errors = Partial<Record<keyof FormValues | string, string>>

const DAY_MS = 86_400_000

export function daysUntil(iso: string, today = TODAY): number {
  return Math.round(
    (new Date(`${iso}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime()) /
      DAY_MS,
  )
}

/** The same three states the roster and the profile use. */
export function credentialLabel(
  expiresAt: string | undefined,
  today = TODAY,
): { label: string; tone: 'expired' | 'expiring' | 'compliant' } {
  if (!expiresAt) return { label: 'No expiry recorded', tone: 'compliant' }
  const days = daysUntil(expiresAt, today)
  if (days < 0) return { label: `Expired ${Math.abs(days)} days ago`, tone: 'expired' }
  if (days <= RENEWAL_WINDOW_DAYS)
    return { label: `Renewal due in ${days} days`, tone: 'expiring' }
  return { label: 'Valid', tone: 'compliant' }
}

/** Derived from the label map rather than restated beside it. */
export const statusOptions = Object.keys(statusLabels) as (keyof typeof statusLabels)[]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_WORKING_AGE = 18

function yearsSince(iso: string, today = TODAY): number {
  const from = new Date(`${iso}T00:00:00Z`)
  const now = new Date(`${today}T00:00:00Z`)
  let years = now.getUTCFullYear() - from.getUTCFullYear()
  const months = now.getUTCMonth() - from.getUTCMonth()
  if (months < 0 || (months === 0 && now.getUTCDate() < from.getUTCDate())) years -= 1
  return years
}

/**
 * Rules the screen can actually check. Nothing here is a house style — each one
 * catches a value that would make another screen contradict itself.
 */
export function validate(values: FormValues, today = TODAY): Errors {
  const errors: Errors = {}

  if (!values.firstName.trim()) errors.firstName = 'A first name is required.'
  if (!values.lastName.trim()) errors.lastName = 'A last name is required.'

  if (!values.dateOfBirth) {
    errors.dateOfBirth = 'A date of birth is required.'
  } else if (values.dateOfBirth > today) {
    errors.dateOfBirth = 'A date of birth cannot be in the future.'
  } else if (yearsSince(values.dateOfBirth, today) < MIN_WORKING_AGE) {
    errors.dateOfBirth = `Caregivers must be at least ${MIN_WORKING_AGE}.`
  }

  if (!values.phone.trim()) errors.phone = 'A contact number is required.'
  if (values.email.trim() && !EMAIL.test(values.email.trim())) {
    errors.email = 'That is not a valid email address.'
  }

  if (!values.hiredAt) {
    errors.hiredAt = 'A start date is required.'
  } else if (values.hiredAt > today) {
    errors.hiredAt = 'A start date cannot be in the future.'
  } else if (values.dateOfBirth && values.hiredAt <= values.dateOfBirth) {
    errors.hiredAt = 'A start date must come after the date of birth.'
  }

  const rate = Number(values.hourlyRate)
  if (!values.hourlyRate.trim() || Number.isNaN(rate) || rate <= 0) {
    errors.hourlyRate = 'Enter a pay rate above zero.'
  } else if (rate >= RATE_PER_HOUR) {
    // Paying at or above what the client is charged loses money on every hour.
    errors.hourlyRate = `Pay cannot reach the ₦${RATE_PER_HOUR} charged to the client.`
  }

  const max = Number(values.maxHoursPerWeek)
  if (!values.maxHoursPerWeek.trim() || Number.isNaN(max) || max <= 0) {
    errors.maxHoursPerWeek = 'Enter a weekly maximum above zero.'
  } else if (max > 80) {
    errors.maxHoursPerWeek = 'A weekly maximum above 80 hours is not permitted.'
  }

  if (!values.emergencyName.trim()) {
    errors.emergencyName = 'An emergency contact is required.'
  }
  if (!values.emergencyPhone.trim()) {
    errors.emergencyPhone = 'An emergency contact number is required.'
  }

  if (values.skills.length === 0) errors.skills = 'Record at least one skill.'
  if (values.languages.length === 0) {
    errors.languages = 'Record at least one language.'
  }

  for (const credential of values.credentials) {
    if (!credential.name.trim()) {
      errors[`credential-${credential.id}`] = 'A credential needs a name.'
      continue
    }
    if (credential.issuedAt && credential.expiresAt) {
      if (credential.issuedAt >= credential.expiresAt) {
        errors[`credential-${credential.id}`] =
          'The expiry date must come after the issue date.'
      }
    }
  }

  for (const window of values.availability) {
    if (window.start >= window.end) {
      errors[`availability-${window.day}`] =
        'The finish time must be after the start time.'
    }
  }

  return errors
}

export function hasErrors(errors: Errors): boolean {
  return Object.keys(errors).length > 0
}

/* --------------------------------- warnings -------------------------------- */

export interface Warning {
  id: string
  message: string
}

export function hoursOffered(availability: AvailabilityWindow[]): number {
  return (
    Math.round(
      availability.reduce((sum, w) => {
        const [sh, sm] = w.start.split(':').map(Number)
        const [eh, em] = w.end.split(':').map(Number)
        return sum + (eh * 60 + em - (sh * 60 + sm)) / 60
      }, 0) * 10,
    ) / 10
  )
}

/**
 * Things that are legal but contradict something else on the screen. Warnings,
 * not errors: the operator may know better than the form.
 */
export function warnings(values: FormValues, today = TODAY): Warning[] {
  const list: Warning[] = []

  const offered = hoursOffered(values.availability)
  const max = Number(values.maxHoursPerWeek)
  if (!Number.isNaN(max) && max > 0 && offered > max) {
    list.push({
      id: 'hours',
      message: `The availability grid offers ${offered} hours a week against a ${max}-hour contract. ${offered - max} of them cannot be rostered.`,
    })
  }

  const lapsed = values.credentials.filter(
    (c) => c.expiresAt && c.expiresAt < today,
  )
  const renewing = values.credentials.filter(
    (c) =>
      c.expiresAt &&
      c.expiresAt >= today &&
      daysUntil(c.expiresAt, today) <= RENEWAL_WINDOW_DAYS,
  )
  if (lapsed.length > 0 && values.status === 'active') {
    list.push({
      id: 'compliance',
      message: `${lapsed.map((c) => c.name).join(', ')} ${lapsed.length === 1 ? 'has' : 'have'} expired. An active caregiver with a lapsed credential should not be rostered.`,
    })
  }

  if (renewing.length > 0) {
    list.push({
      id: 'renewals',
      message: `${renewing.map((c) => c.name).join(', ')} ${renewing.length === 1 ? 'expires' : 'expire'} within ${RENEWAL_WINDOW_DAYS} days.`,
    })
  }

  if (values.availability.length === 0 && values.status === 'active') {
    list.push({
      id: 'availability',
      message: 'No availability is set, so this caregiver cannot be rostered at all.',
    })
  }

  const supervisorOnRoster = staffMembers.some(
    (s) => s.name === values.supervisor && s.title === 'Care Coordinator',
  )
  if (values.supervisor && !supervisorOnRoster) {
    list.push({
      id: 'supervisor',
      message: `${values.supervisor} is not a care coordinator on the roster.`,
    })
  }

  return list
}

/** Gross margin on an hour of this person's time. */
export function marginPercent(hourlyRate: number): number | null {
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return null
  return Math.round(((RATE_PER_HOUR - hourlyRate) / RATE_PER_HOUR) * 100)
}

export { RATE_PER_HOUR }

/* --------------------------------- changes -------------------------------- */

export interface Change {
  field: string
  from: string
  to: string
}

function list(values: string[]): string {
  return values.length === 0 ? 'none' : values.join(', ')
}

/**
 * What would be written. There is no backend, so rather than pretend a save
 * happened the screen reports the diff — which is also the thing a reviewer
 * would want to see before one.
 */
export function changesFrom(member: StaffMember, values: FormValues): Change[] {
  const current = toFormValues(member)
  const changes: Change[] = []

  const scalar: [string, keyof FormValues][] = [
    ['Name prefix', 'namePrefix'],
    ['First name', 'firstName'],
    ['Last name', 'lastName'],
    ['Date of birth', 'dateOfBirth'],
    ['Phone', 'phone'],
    ['Email', 'email'],
    ['Street', 'street'],
    ['City', 'city'],
    ['State', 'state'],
    ['Postcode', 'zip'],
    ['Role', 'title'],
    ['Employment type', 'employment'],
    ['Branch', 'branch'],
    ['Start date', 'hiredAt'],
    ['Hourly rate', 'hourlyRate'],
    ['Supervisor', 'supervisor'],
    ['Status', 'status'],
    ['Emergency contact', 'emergencyName'],
    ['Emergency relationship', 'emergencyRelationship'],
    ['Emergency phone', 'emergencyPhone'],
    ['Maximum hours a week', 'maxHoursPerWeek'],
    ['Preferred shift', 'preferredShift'],
    ['Internal notes', 'notes'],
  ]

  const numeric = new Set(['hourlyRate', 'maxHoursPerWeek'])

  for (const [label, key] of scalar) {
    const before = String(current[key] ?? '')
    const after = String(values[key] ?? '')
    // "95" and "95.0" are the same rate; a string compare called it a change.
    const same = numeric.has(key)
      ? Number(before) === Number(after)
      : before === after
    if (!same) {
      changes.push({ field: label, from: before || 'empty', to: after || 'empty' })
    }
  }

  if (list(current.skills) !== list(values.skills)) {
    changes.push({ field: 'Skills', from: list(current.skills), to: list(values.skills) })
  }
  if (list(current.languages) !== list(values.languages)) {
    changes.push({
      field: 'Languages',
      from: list(current.languages),
      to: list(values.languages),
    })
  }

  // Every field, not just name and expiry — editing a reference number
  // produced no diff, so the form went clean and refused to save it.
  const describe = (c: Credential) =>
    [
      c.name || 'unnamed',
      c.reference ? `ref ${c.reference}` : null,
      c.issuedAt ? `issued ${c.issuedAt}` : null,
      c.expiresAt ? `expires ${c.expiresAt}` : null,
    ]
      .filter(Boolean)
      .join(', ')
  const before = current.credentials.map(describe)
  const after = values.credentials.map(describe)
  if (list(before) !== list(after)) {
    changes.push({ field: 'Credentials', from: list(before), to: list(after) })
  }

  const window = (w: AvailabilityWindow) => `${w.day} ${w.start}–${w.end}`
  const beforeWindows = weekdays.flatMap((d) => {
    const w = current.availability.find((x) => x.day === d)
    return w ? [window(w)] : []
  })
  const afterWindows = weekdays.flatMap((d) => {
    const w = values.availability.find((x) => x.day === d)
    return w ? [window(w)] : []
  })
  if (list(beforeWindows) !== list(afterWindows)) {
    changes.push({
      field: 'Availability',
      from: list(beforeWindows),
      to: list(afterWindows),
    })
  }

  const nameBefore = joinName(current.namePrefix, current.firstName, current.lastName)
  const nameAfter = joinName(values.namePrefix, values.firstName, values.lastName)
  if (nameBefore !== nameAfter) {
    changes.push({ field: 'Full name', from: nameBefore, to: nameAfter })
  }

  const addressBefore = joinAddress(current)
  const addressAfter = joinAddress(values)
  if (addressBefore !== addressAfter) {
    changes.push({ field: 'Address', from: addressBefore, to: addressAfter })
  }

  return changes
}

/* --------------------------------- deletion -------------------------------- */

/**
 * Deleting a caregiver who still holds a caseload would orphan those care
 * records, so the screen has to say what is in the way rather than failing
 * after the click.
 */
export function deleteBlockers(member: StaffMember): string[] {
  const blockers: string[] = []

  const caseload = assignmentsFor(member)
  if (caseload.length > 0) {
    blockers.push(
      `Assigned to ${caseload.map((a) => a.recipientName).join(', ')}. Reassign the${caseload.length === 1 ? ' care record' : 'se care records'} first.`,
    )
  }

  const coordinating = coordinatingFor(member)
  if (coordinating.length > 0) {
    blockers.push(
      `Coordinates ${coordinating.map((a) => a.recipientName).join(', ')}. Hand the${coordinating.length === 1 ? ' case' : 'se cases'} over first.`,
    )
  }

  return blockers
}

export const relationships = [
  'Husband',
  'Wife',
  'Partner',
  'Mother',
  'Father',
  'Sister',
  'Brother',
  'Son',
  'Daughter',
  'Friend',
  'Other',
]

export const supervisorOptions = staffMembers
  .filter((s) => s.title === 'Care Coordinator')
  .map((s) => s.name)

export type { Weekday }
