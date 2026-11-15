import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { coordinators } from '@/features/care-recipients/data'
import { useRecipientProfile } from '@/features/care-recipients/useRecipientProfile'
import type { RecipientProfile } from '@/features/care-recipients/profile-data'
import { api, ApiError } from '@/lib/api'
import { Field } from '@/components/ui/Field'
import { fieldControl } from '@/lib/field-classes'
import { TODAY } from '@/lib/today'
import type { CareLevel, Priority } from '@/types'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Edit Profile for a care recipient. There is no Figma for it; it edits what
 * the profile header, Overview tab and directory already show, laid out like
 * the caregiver edit page.
 *
 * The backend exposes no general profile-update endpoint for this module, so of
 * the fields below only Priority has a live write (POST /:id/priority). The rest
 * stay editable for review but cannot be persisted yet; the page says so plainly
 * rather than pretending the save stuck.
 */

const careLevels: CareLevel[] = ['Full-Time', 'Part-Time', 'Hourly', '24-Hour']
const priorities: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'critical', label: 'Critical' },
]

/** Frontend lowercase priority to the backend enum token. */
const PRIORITY_TOKEN: Record<Priority, string> = {
  critical: 'CRITICAL',
  urgent: 'URGENT',
  high: 'HIGH',
  medium: 'MEDIUM',
  normal: 'NORMAL',
  low: 'LOW',
}

/** "June 15, 1948" → "1948-06-15"; '' when it does not read as a date. */
function toIso(display: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(display)) return display
  const d = new Date(display)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ageOn(dob: string, today = TODAY): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob >= today) return null
  const [y, m, d] = dob.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

const validPhone = (v: string) => /^\+?\d{7,15}$/.test(v.replace(/[\s\-().]/g, ''))
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

function initialValues(p: RecipientProfile) {
  return {
    name: p.name,
    dob: toIso(p.personal.dateOfBirth),
    sex: p.sex,
    phone: p.personal.phone,
    email: p.personal.email,
    address: p.personal.address,
    languages: p.personal.languages,
    condition: p.condition,
    primaryDiagnosis: p.summary.primaryDiagnosis,
    secondaryDiagnosis: p.summary.secondaryDiagnosis,
    careLevel: p.careLevel,
    priority: p.priority,
    coordinator: p.summary.coordinator,
    startDate: p.summary.startDateIso,
    contactName: p.summary.emergencyContact.name,
    contactRelationship: p.summary.emergencyContact.relationship,
    contactPhone: p.summary.emergencyContact.phone,
  }
}
type Values = ReturnType<typeof initialValues>

function validate(v: Values): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {}
  if (!v.name.trim()) e.name = 'Enter the full name.'
  if (ageOn(v.dob) === null) e.dob = 'Enter a date of birth before today.'
  if (v.phone.trim() && !validPhone(v.phone)) e.phone = 'Enter a phone number of 7 to 15 digits.'
  if (v.email.trim() && !validEmail(v.email)) e.email = 'Enter a valid email address.'
  if (!v.address.trim()) e.address = 'Enter the home address.'
  if (!v.condition.trim()) e.condition = 'Enter the primary condition.'
  if (!v.primaryDiagnosis.trim()) e.primaryDiagnosis = 'Enter the primary diagnosis.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.startDate)) e.startDate = 'Enter the date care started.'
  if (!v.contactName.trim()) e.contactName = 'Enter the emergency contact’s name.'
  if (!v.contactRelationship.trim()) e.contactRelationship = 'Enter how they are related.'
  if (!validPhone(v.contactPhone)) e.contactPhone = 'Enter a phone number of 7 to 15 digits.'
  return e
}

export function RecipientEditPage() {
  const { id = '' } = useParams()
  const profileQuery = useRecipientProfile(id)

  if (profileQuery.isPending) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <Loader2 className="text-brand-600 size-6 animate-spin" aria-hidden="true" />
        <p className="text-ink-muted mt-3 text-sm">Loading profile…</p>
      </div>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    const message =
      profileQuery.error instanceof ApiError
        ? profileQuery.error.message
        : 'This care recipient could not be loaded.'
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <p className="text-ink text-sm font-semibold">Could not load profile</p>
        <p className="text-ink-muted mt-2 text-sm">{message}</p>
        <button
          type="button"
          onClick={() => void profileQuery.refetch()}
          className="text-brand-700 mt-2 text-sm font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return <EditForm key={profileQuery.data.id} profile={profileQuery.data} />
}

function EditForm({ profile }: { profile: RecipientProfile }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const back = `/care-recipients/${profile.id}/overview`
  const [values, setValues] = useState(() => initialValues(profile))
  const [submitted, setSubmitted] = useState(false)
  const errors = validate(values)
  const invalid = Object.keys(errors).length > 0
  const show = (k: keyof Values) => (submitted ? errors[k] : undefined)
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((s) => ({ ...s, [k]: v }))
  const sexes = ['Female', 'Male'].includes(profile.sex) ? ['Female', 'Male'] : ['Female', 'Male', profile.sex]

  const setPriority = useMutation({
    mutationFn: (priority: Priority) =>
      api.post<void>(`/admin/care-recipients/${profile.id}/priority`, {
        priority: PRIORITY_TOKEN[priority],
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'care-recipients', profile.id] }),
  })

  const saveError = setPriority.error instanceof ApiError ? setPriority.error.message : null

  const actions = (
    <div className="flex gap-2">
      <Link
        to={back}
        className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
      >
        Cancel
      </Link>
      <button
        type="submit"
        disabled={setPriority.isPending}
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-50"
      >
        {setPriority.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Save Changes
      </button>
    </div>
  )

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        const age = ageOn(values.dob)
        if (invalid || age === null) return
        // Only Priority has a backend write today. The other fields are
        // validated and editable but not persisted (see the notice below).
        setPriority.reset()
        setPriority.mutate(values.priority, {
          onSuccess: () => navigate(back),
        })
      }}
    >
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/care-recipients" className="hover:text-ink">Care Recipients</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li>
            <Link to={back} className="hover:text-ink">{profile.name}</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li className="text-ink" aria-current="page">Edit</li>
        </ol>
      </nav>

      <header className="-mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">Edit Care Recipient Profile</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Update {profile.name}’s personal details, care information and emergency contact.
          </p>
        </div>
        {actions}
      </header>

      <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <p className="font-semibold">Only Priority is saved for now.</p>
        <p className="mt-0.5 text-amber-700">
          The other fields on this page are read only until a profile update service is available;
          editing them here will not change the record.
        </p>
      </div>

      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">{saveError}</p>
        </div>
      )}

      {submitted && invalid && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">
            {Object.keys(errors).length} field{Object.keys(errors).length === 1 ? '' : 's'} need attention before this can be saved.
          </p>
        </div>
      )}

      <section aria-labelledby="edit-personal" className="card p-5 sm:p-6">
        <h2 id="edit-personal" className="text-ink text-base font-semibold tracking-tight">Personal Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Full Name" error={show('name')}>
            {(p) => <input {...p} className={fieldControl} value={values.name} onChange={(e) => set('name', e.target.value)} />}
          </Field>
          <Field label="Date of Birth" error={show('dob')} hint={ageOn(values.dob) !== null ? `Age ${ageOn(values.dob)}` : undefined}>
            {(p) => <input {...p} type="date" max={TODAY} className={fieldControl} value={values.dob} onChange={(e) => set('dob', e.target.value)} />}
          </Field>
          <Field label="Sex">
            {(p) => (
              <SelectBox {...p} className={fieldControl} value={values.sex} onChange={(e) => set('sex', e.target.value)}>
                {sexes.map((s) => <option key={s}>{s}</option>)}
              </SelectBox>
            )}
          </Field>
          <Field label="Languages" hint="Separate several with commas.">
            {(p) => <input {...p} className={fieldControl} value={values.languages} onChange={(e) => set('languages', e.target.value)} />}
          </Field>
          <Field label="Phone" error={show('phone')}>
            {(p) => <input {...p} type="tel" className={fieldControl} value={values.phone} onChange={(e) => set('phone', e.target.value)} />}
          </Field>
          <Field label="Email" error={show('email')}>
            {(p) => <input {...p} type="email" className={fieldControl} value={values.email} onChange={(e) => set('email', e.target.value)} />}
          </Field>
          <Field label="Home Address" error={show('address')} className="sm:col-span-2">
            {(p) => <input {...p} className={fieldControl} value={values.address} onChange={(e) => set('address', e.target.value)} />}
          </Field>
        </div>
      </section>

      <section aria-labelledby="edit-care" className="card p-5 sm:p-6">
        <h2 id="edit-care" className="text-ink text-base font-semibold tracking-tight">Care Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Primary Condition" error={show('condition')} hint="Shown in the directory and the profile header.">
            {(p) => <input {...p} className={fieldControl} value={values.condition} onChange={(e) => set('condition', e.target.value)} />}
          </Field>
          <Field label="Primary Diagnosis" error={show('primaryDiagnosis')}>
            {(p) => <input {...p} className={fieldControl} value={values.primaryDiagnosis} onChange={(e) => set('primaryDiagnosis', e.target.value)} />}
          </Field>
          <Field label="Secondary Diagnosis" hint="Optional.">
            {(p) => <input {...p} className={fieldControl} value={values.secondaryDiagnosis} onChange={(e) => set('secondaryDiagnosis', e.target.value)} />}
          </Field>
          <Field label="Care Start Date" error={show('startDate')}>
            {(p) => <input {...p} type="date" className={fieldControl} value={values.startDate} onChange={(e) => set('startDate', e.target.value)} />}
          </Field>
          <Field label="Care Level">
            {(p) => (
              <SelectBox {...p} className={fieldControl} value={values.careLevel} onChange={(e) => set('careLevel', e.target.value as CareLevel)}>
                {careLevels.map((c) => <option key={c}>{c}</option>)}
              </SelectBox>
            )}
          </Field>
          <Field label="Priority" hint="Saved live.">
            {(p) => (
              <SelectBox {...p} className={fieldControl} value={values.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                {priorities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectBox>
            )}
          </Field>
          <Field label="Care Coordinator">
            {(p) => (
              <SelectBox {...p} className={fieldControl} value={values.coordinator} onChange={(e) => set('coordinator', e.target.value)}>
                {[...new Set([values.coordinator, ...coordinators])].map((c) => <option key={c}>{c}</option>)}
              </SelectBox>
            )}
          </Field>
        </div>
      </section>

      <section aria-labelledby="edit-emergency" className="card p-5 sm:p-6">
        <h2 id="edit-emergency" className="text-ink text-base font-semibold tracking-tight">Emergency Contact</h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Full Name" error={show('contactName')}>
            {(p) => <input {...p} className={fieldControl} value={values.contactName} onChange={(e) => set('contactName', e.target.value)} />}
          </Field>
          <Field label="Relationship" error={show('contactRelationship')}>
            {(p) => <input {...p} className={fieldControl} value={values.contactRelationship} onChange={(e) => set('contactRelationship', e.target.value)} />}
          </Field>
          <Field label="Phone" error={show('contactPhone')}>
            {(p) => <input {...p} type="tel" className={fieldControl} value={values.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />}
          </Field>
        </div>
      </section>

      <div className="flex justify-end">{actions}</div>
    </form>
  )
}
