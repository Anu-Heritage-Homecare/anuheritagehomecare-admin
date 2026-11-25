import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useRecipientProfile } from '@/features/care-recipients/useRecipientProfile'
import { useUpdateRecipientProfile } from '@/features/care-recipients/useUpdateRecipientProfile'
import type { RecipientProfile } from '@/features/care-recipients/profile-data'
import { ApiError } from '@/lib/api'
import { Field } from '@/components/ui/Field'
import { fieldControl } from '@/lib/field-classes'
import { TODAY } from '@/lib/today'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Edit Profile for a care recipient. It writes the core identity profile through
 * PUT /admin/care-recipients/:id. That endpoint carries the name, gender, date of
 * birth, address parts, relationship and living situation; those are the fields
 * edited here.
 *
 * The profile read does not return gender as MALE/FEMALE, nor the city, state,
 * relationship or living situation separately, so those start empty (or best
 * effort) and the coordinator fills them in. Fields the endpoint does not accept
 * (phone, email, languages, diagnoses, care level, coordinator, emergency
 * contact) are not shown here; they are set through their own screens.
 */

const genders: { value: 'MALE' | 'FEMALE'; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
]

/** "June 15, 1948" or "1948-06-15" to "1948-06-15"; '' when it does not read. */
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

function initialGender(sex: string): 'MALE' | 'FEMALE' | '' {
  const lower = sex.toLowerCase()
  if (lower.startsWith('m')) return 'MALE'
  if (lower.startsWith('f')) return 'FEMALE'
  return ''
}

function initialValues(p: RecipientProfile) {
  const address = p.personal.address === '—' ? '' : p.personal.address
  return {
    name: p.name === '—' ? '' : p.name,
    gender: initialGender(p.sex),
    dob: toIso(p.personal.dateOfBirth),
    city: '',
    state: '',
    fullAddress: address,
    relationship: p.personal.familyMember.relationship === '—' ? '' : p.personal.familyMember.relationship,
    livingSituation: '',
  }
}
type Values = ReturnType<typeof initialValues>

function validate(v: Values): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {}
  if (!v.name.trim()) e.name = 'Enter the full name.'
  if (v.gender === '') e.gender = 'Select the gender.'
  if (ageOn(v.dob) === null) e.dob = 'Enter a date of birth before today.'
  if (!v.city.trim()) e.city = 'Enter the city.'
  if (!v.state.trim()) e.state = 'Enter the state.'
  if (!v.fullAddress.trim()) e.fullAddress = 'Enter the home address.'
  if (!v.relationship.trim()) e.relationship = 'Enter the relationship to the family owner.'
  if (!v.livingSituation.trim()) e.livingSituation = 'Enter the living situation.'
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
  const back = `/care-recipients/${profile.id}/overview`
  const [values, setValues] = useState(() => initialValues(profile))
  const [submitted, setSubmitted] = useState(false)
  const errors = validate(values)
  const invalid = Object.keys(errors).length > 0
  const show = (k: keyof Values) => (submitted ? errors[k] : undefined)
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((s) => ({ ...s, [k]: v }))

  const update = useUpdateRecipientProfile(profile.id)
  const saveError = update.error instanceof ApiError ? update.error.message : null

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
        disabled={update.isPending}
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-50"
      >
        {update.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
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
        if (invalid || values.gender === '') return
        update.reset()
        update.mutate(
          {
            name: values.name.trim(),
            gender: values.gender,
            dateOfBirth: values.dob,
            city: values.city.trim(),
            state: values.state.trim(),
            fullAddress: values.fullAddress.trim(),
            relationship: values.relationship.trim(),
            livingSituation: values.livingSituation.trim(),
          },
          { onSuccess: () => navigate(back) },
        )
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
            Update {profile.name}’s identity details, address and living situation.
          </p>
        </div>
        {actions}
      </header>

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
          <Field label="Gender" error={show('gender')}>
            {(p) => (
              <SelectBox {...p} className={fieldControl} value={values.gender} onChange={(e) => set('gender', e.target.value as Values['gender'])}>
                <option value="">Select</option>
                {genders.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </SelectBox>
            )}
          </Field>
          <Field label="Relationship to Family Owner" error={show('relationship')}>
            {(p) => <input {...p} className={fieldControl} value={values.relationship} onChange={(e) => set('relationship', e.target.value)} />}
          </Field>
          <Field label="Home Address" error={show('fullAddress')} className="sm:col-span-2">
            {(p) => <input {...p} className={fieldControl} value={values.fullAddress} onChange={(e) => set('fullAddress', e.target.value)} />}
          </Field>
          <Field label="City" error={show('city')}>
            {(p) => <input {...p} className={fieldControl} value={values.city} onChange={(e) => set('city', e.target.value)} />}
          </Field>
          <Field label="State" error={show('state')}>
            {(p) => <input {...p} className={fieldControl} value={values.state} onChange={(e) => set('state', e.target.value)} />}
          </Field>
          <Field label="Living Situation" error={show('livingSituation')} hint="For example, lives alone, with family, or in assisted living." className="sm:col-span-2">
            {(p) => <input {...p} className={fieldControl} value={values.livingSituation} onChange={(e) => set('livingSituation', e.target.value)} />}
          </Field>
        </div>
      </section>

      <div className="flex justify-end">{actions}</div>
    </form>
  )
}
