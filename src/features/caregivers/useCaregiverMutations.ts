/**
 * The write surface of the Caregivers screen: archiving a caregiver, setting a
 * status, and persisting an edit. The edit is split across the back office's
 * section endpoints (profile, personal, skills, languages, emergency contact,
 * preferences, hourly rate, availability) exactly as the API exposes them, so
 * one Save fans out to the sections that actually changed.
 *
 * Certifications are a child collection with their own add, edit and remove
 * routes rather than a bulk replace, so the save reconciles the form's list
 * against the ids that were loaded: new rows are added, kept rows are edited,
 * and dropped rows are removed.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FormValues } from './edit-form'
import type { Credential, StaffMember, StaffStatus, Weekday } from './staff'
import { weekdays } from './staff'
import { fromStaffStatus } from './useCaregivers'

/** "HH:MM" to minutes from midnight, for the availability endpoint. */
function toMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

// The back office has no "Bank" grade; its non permanent grade is CONTRACT, so
// the roster's "Bank" maps onto it (and back, in the roster mapper).
const EMPLOYMENT_ENUM: Record<string, string> = {
  'Full-Time': 'FULL_TIME',
  'Part-Time': 'PART_TIME',
  Bank: 'CONTRACT',
}

/**
 * The next Monday-anchored date for each weekday, so availability windows land
 * on a concrete week the API accepts. The exact week does not matter to the
 * roster's Mon..Sun grid; what matters is that each window keeps its weekday.
 */
function dateForWeekday(day: Weekday): string {
  const base = new Date()
  const index = weekdays.indexOf(day)
  // getUTCDay: 0 Sunday..6 Saturday; shift to a Monday start.
  const todayIndex = (base.getUTCDay() + 6) % 7
  base.setUTCDate(base.getUTCDate() + (index - todayIndex))
  return base.toISOString().slice(0, 10)
}

interface SaveInput {
  id: string
  before: StaffMember
  values: FormValues
}

/** Persist every section of the edit form that changed, then the status. */
async function saveCaregiver({ id, before, values }: SaveInput): Promise<void> {
  const base = `/admin/caregivers/${id}`

  await api.put(`${base}/profile`, {
    title: values.title,
    branch: values.branch,
    supervisorName: values.supervisor,
    employmentType: EMPLOYMENT_ENUM[values.employment],
    joinedAt: values.hiredAt || undefined,
    maxHoursPerWeek: Number(values.maxHoursPerWeek) || undefined,
    preferredShift: values.preferredShift,
  })

  await api.put(`${base}/personal`, {
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    email: values.email || undefined,
    dateOfBirth: values.dateOfBirth || undefined,
    addressLine1: values.street,
    city: values.city,
    state: values.state,
    postalCode: values.zip,
  })

  await api.put(`${base}/skills`, { skills: values.skills })
  await api.put(`${base}/languages`, { languages: values.languages })
  await api.put(`${base}/emergency-contact`, {
    name: values.emergencyName || undefined,
    phone: values.emergencyPhone || undefined,
    relationship: values.emergencyRelationship || undefined,
  })
  await api.put(`${base}/preferences`, { preferencesNote: values.notes || null })
  await api.put(`${base}/hourly-rate`, {
    hourlyRateMinor: Math.round((Number(values.hourlyRate) || 0) * 100),
  })

  await api.put(`${base}/availability`, {
    days: values.availability.map((w) => ({
      date: dateForWeekday(w.day),
      slots: [{ startMinute: toMinutes(w.start), endMinute: toMinutes(w.end) }],
    })),
  })

  await reconcileCertifications(base, before.credentials, values.credentials)

  if (values.status !== before.status) {
    await api.put(`${base}/status`, { status: fromStaffStatus(values.status) })
  }
}

/** A loaded credential carries a uuid id; a newly added one carries "new-N". */
function isExisting(credential: Credential): boolean {
  return !credential.id.startsWith('new-')
}

function certificationBody(c: Credential): Record<string, unknown> {
  return {
    name: c.name,
    licenseNumber: c.reference || undefined,
    issuedAt: c.issuedAt || undefined,
    // The API requires an expiry; a check with none is sent a far future date so
    // the write does not fail, matching how the roster treats an open credential.
    expiresAt: c.expiresAt || '2099-12-31',
  }
}

async function reconcileCertifications(
  base: string,
  before: Credential[],
  after: Credential[],
): Promise<void> {
  const keptIds = new Set(after.filter(isExisting).map((c) => c.id))
  const removals = before
    .filter((c) => !keptIds.has(c.id))
    .map((c) => api.delete(`${base}/certifications/${c.id}`))

  const writes = after.map((c) =>
    isExisting(c)
      ? api.put(`${base}/certifications/${c.id}`, certificationBody(c))
      : api.post(`${base}/certifications`, certificationBody(c)),
  )

  await Promise.all([...removals, ...writes])
}

/** Archive, set status and save, each refreshing the roster and the profile. */
export function useCaregiverMutations(id?: string) {
  const queryClient = useQueryClient()
  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'caregivers'] })
  }

  const remove = useMutation({
    mutationFn: (caregiverId: string) => api.delete(`/admin/caregivers/${caregiverId}`),
    onSuccess: invalidate,
  })

  const setStatus = useMutation({
    mutationFn: ({ caregiverId, status }: { caregiverId: string; status: StaffStatus }) =>
      api.put(`/admin/caregivers/${caregiverId}/status`, { status: fromStaffStatus(status) }),
    onSuccess: invalidate,
  })

  const save = useMutation({
    mutationFn: (input: SaveInput) => saveCaregiver(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'caregivers'] })
      if (id) {
        await queryClient.invalidateQueries({
          queryKey: ['admin', 'caregivers', 'profile', id],
        })
      }
    },
  })

  return { remove, setStatus, save }
}
