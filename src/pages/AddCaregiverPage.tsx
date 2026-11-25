import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Copy, TriangleAlert } from 'lucide-react'
import {
  TODAY,
  hasErrors,
  hoursOffered,
  joinName,
  relationships,
  supervisorOptions,
  validate,
} from '@/features/caregivers/edit-form'
import type { Errors, FormValues } from '@/features/caregivers/edit-form'
import { useProvisionCaregiver } from '@/features/caregivers/useProvisionCaregiver'
import type {
  ProvisionCaregiverBody,
  ProvisionedCaregiver,
} from '@/features/caregivers/useProvisionCaregiver'
import { ApiError } from '@/lib/api'
import {
  branches,
  employmentTypes,
  statusLabels,
  titles,
} from '@/features/caregivers/roster-data'
import {
  Availability,
  Credentials,
  TokenList,
} from '@/features/caregivers/form-sections'
import { Field } from '@/components/ui/Field'
import { Toggle } from '@/components/ui/Toggle'
import { SelectBox } from '@/components/ui/SelectBox'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'

/*
 * There is no Figma for creating a caregiver, so this captures the same record
 * the profile reads back, in the same sections and layout as the edit screen.
 * Everything is held in memory; the backend will replace createCaregiver with a
 * real write after this is pushed.
 */
function initialValues(): FormValues {
  return {
    namePrefix: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    title: titles[0],
    employment: 'Full-Time',
    branch: branches[0],
    hiredAt: TODAY,
    hourlyRate: '',
    supervisor: supervisorOptions[0] ?? '',
    status: 'active',
    skills: [],
    languages: ['English'],
    credentials: [],
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    availability: [],
    maxHoursPerWeek: '40',
    preferredShift: 'No preference',
    notes: '',
  }
}

export function AddCaregiverPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>(initialValues)
  const [emergencyEmail, setEmergencyEmail] = useState('')
  const [gender, setGender] = useState('')
  const [country, setCountry] = useState<'US' | 'NG' | ''>('')
  const [submitted, setSubmitted] = useState(false)
  const nextCredentialId = useRef(0)
  const provision = useProvisionCaregiver()
  const [created, setCreated] = useState<ProvisionedCaregiver | null>(null)

  const errors = useMemo(() => validate(values), [values])
  // A certification on file needs its document; the agency does not record one
  // it cannot evidence. Enforced here, on create, rather than in the shared
  // validator — existing records predate the upload field.
  const missingDocs = useMemo(
    () => values.credentials.filter((c) => c.name.trim() && !c.document),
    [values.credentials],
  )
  const invalid = hasErrors(errors) || missingDocs.length > 0

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const show = (key: keyof FormValues | string): string | undefined =>
    submitted ? (errors as Errors)[key] : undefined

  const offered = hoursOffered(values.availability)

  const saveError = provision.isError
    ? provision.error instanceof ApiError
      ? provision.error.message
      : 'Could not create the caregiver. Please try again.'
    : null

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (invalid || country === '') {
      document.querySelector('[role="alert"]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }
    provision.reset()
    provision.mutate(toProvisionBody(values, gender, emergencyEmail, country), {
      onSuccess: setCreated,
    })
  }

  if (created) {
    return (
      <CreatedPanel
        name={joinName(values.namePrefix, values.firstName.trim(), values.lastName.trim())}
        result={created}
        onDone={() => navigate(`/caregivers/${created.profileId}`)}
      />
    )
  }

  const errorList = Object.values(errors)
  if (missingDocs.length > 0) {
    errorList.push(
      `Upload a supporting document for ${missingDocs
        .map((c) => c.name.trim())
        .join(', ')}.`,
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to="/caregivers" className="hover:text-ink">
              Caregivers
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </li>
          <li className="text-ink" aria-current="page">
            Add
          </li>
        </ol>
      </nav>

      <header className="-mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Add Caregiver
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Create a staff record with their details, certifications, and
            preferences. It joins the roster straight away.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/caregivers"
            className="border-line bg-surface text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
          >
            Add Caregiver
          </button>
        </div>
      </header>

      {submitted && invalid && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <p className="font-semibold">
            {errorList.length} field{errorList.length === 1 ? '' : 's'} need
            attention before this caregiver can be added.
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {errorList.map((message) => (
              <li key={message} className="break-words">
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="add-personal" className="card p-5 sm:p-6">
        <h2 id="add-personal" className="text-ink text-base font-semibold tracking-tight">
          Personal Information
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="space-y-4">
            <Field label="First Name" error={show('firstName')}>
              {(p) => (
                <input
                  {...p}
                  className={fieldControl}
                  value={values.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                />
              )}
            </Field>
            <Field label="Last Name" error={show('lastName')}>
              {(p) => (
                <input
                  {...p}
                  className={fieldControl}
                  value={values.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                />
              )}
            </Field>
            <Field label="Date of Birth" error={show('dateOfBirth')}>
              {(p) => (
                <input
                  {...p}
                  type="date"
                  max={TODAY}
                  className={fieldControl}
                  value={values.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                />
              )}
            </Field>
            <Field label="Gender">
              {(p) => (
                <SelectBox
                  {...p}
                  className={fieldControl}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                </SelectBox>
              )}
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="Phone" error={show('phone')}>
              {(p) => (
                <input
                  {...p}
                  type="tel"
                  className={fieldControl}
                  value={values.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Email"
              error={show('email')}
              hint="Left blank, the profile uses firstname.lastname@careprofs.com."
            >
              {(p) => (
                <input
                  {...p}
                  type="email"
                  placeholder="firstname.lastname@careprofs.com"
                  className={fieldControl}
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              )}
            </Field>
            <Field label="Address">
              {(p) => (
                <input
                  {...p}
                  className={fieldControl}
                  value={values.street}
                  onChange={(e) => set('street', e.target.value)}
                />
              )}
            </Field>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_6.5rem] gap-3">
              <Field label="City">
                {(p) => (
                  <input
                    {...p}
                    className={fieldControl}
                    value={values.city}
                    onChange={(e) => set('city', e.target.value)}
                  />
                )}
              </Field>
              <Field label="State">
                {(p) => (
                  <input
                    {...p}
                    className={fieldControl}
                    value={values.state}
                    onChange={(e) => set('state', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Zip">
                {(p) => (
                  <input
                    {...p}
                    inputMode="numeric"
                    className={fieldControl}
                    value={values.zip}
                    onChange={(e) => set('zip', e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label="Country" error={submitted && !country ? 'Select a country' : undefined}>
              {(p) => (
                <SelectBox
                  {...p}
                  className={fieldControl}
                  value={country}
                  onChange={(e) => setCountry(e.target.value as 'US' | 'NG' | '')}
                >
                  <option value="">Select a country</option>
                  <option value="US">United States</option>
                  <option value="NG">Nigeria</option>
                </SelectBox>
              )}
            </Field>
          </div>
        </div>
      </section>

      <section aria-labelledby="add-employment" className="card p-5 sm:p-6">
        <h2 id="add-employment" className="text-ink text-base font-semibold tracking-tight">
          Employment Details
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Role">
            {(p) => (
              <SelectBox
                {...p}
                className={fieldControl}
                value={values.title}
                onChange={(e) => set('title', e.target.value)}
              >
                {titles.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </SelectBox>
            )}
          </Field>
          <Field label="Employment Type">
            {(p) => (
              <SelectBox
                {...p}
                className={fieldControl}
                value={values.employment}
                onChange={(e) =>
                  set('employment', e.target.value as FormValues['employment'])
                }
              >
                {employmentTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </SelectBox>
            )}
          </Field>
          <Field label="Hourly Rate" error={show('hourlyRate')}>
            {(p) => (
              <span className="relative block">
                <span
                  aria-hidden="true"
                  className="text-ink pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
                >
                  ₦
                </span>
                <input
                  {...p}
                  inputMode="decimal"
                  className={cn(fieldControl, 'pl-6')}
                  value={values.hourlyRate}
                  onChange={(e) => set('hourlyRate', e.target.value)}
                />
              </span>
            )}
          </Field>
          <Field label="Branch">
            {(p) => (
              <SelectBox
                {...p}
                className={fieldControl}
                value={values.branch}
                onChange={(e) => set('branch', e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </SelectBox>
            )}
          </Field>
          <Field label="Supervisor">
            {(p) => (
              <SelectBox
                {...p}
                className={fieldControl}
                value={values.supervisor}
                onChange={(e) => set('supervisor', e.target.value)}
              >
                <option value="">Unassigned</option>
                {supervisorOptions.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </SelectBox>
            )}
          </Field>
          <Field label="Start Date" error={show('hiredAt')}>
            {(p) => (
              <input
                {...p}
                type="date"
                max={TODAY}
                className={fieldControl}
                value={values.hiredAt}
                onChange={(e) => set('hiredAt', e.target.value)}
              />
            )}
          </Field>
          <div className="min-w-0">
            <p className="text-ink-muted mb-1.5 block text-xs font-medium">Status</p>
            <Toggle
              leading
              label={statusLabels[values.status]}
              labelClassName="font-semibold"
              checked={values.status === 'active'}
              onChange={(on) => set('status', on ? 'active' : 'inactive')}
              className="h-10"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="add-skills" className="card p-5 sm:p-6">
        <h2 id="add-skills" className="text-ink text-base font-semibold tracking-tight">
          Skills &amp; Specializations
        </h2>
        <div className="mt-4">
          <TokenList
            label="Current Skills"
            addLabel="Add Skill"
            placeholder="Add a skill"
            values={values.skills}
            error={show('skills')}
            onChange={(next) => set('skills', next)}
          />
          <div className="mt-5">
            <TokenList
              label="Languages"
              addLabel="Add Language"
              placeholder="Add a language"
              values={values.languages}
              error={show('languages')}
              onChange={(next) => set('languages', next)}
            />
          </div>
        </div>
      </section>

      <Credentials
        values={values}
        errors={submitted ? errors : {}}
        nextId={() => `new-${(nextCredentialId.current += 1)}`}
        onChange={(next) => set('credentials', next)}
      />

      <section aria-labelledby="add-emergency" className="card p-5 sm:p-6">
        <h2 id="add-emergency" className="text-ink text-base font-semibold tracking-tight">
          Emergency Contact
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Contact Name" error={show('emergencyName')}>
            {(p) => (
              <input
                {...p}
                className={fieldControl}
                value={values.emergencyName}
                onChange={(e) => set('emergencyName', e.target.value)}
              />
            )}
          </Field>
          <Field label="Phone" error={show('emergencyPhone')}>
            {(p) => (
              <input
                {...p}
                type="tel"
                className={fieldControl}
                value={values.emergencyPhone}
                onChange={(e) => set('emergencyPhone', e.target.value)}
              />
            )}
          </Field>
          <Field label="Relationship">
            {(p) => (
              <SelectBox
                {...p}
                className={fieldControl}
                value={values.emergencyRelationship}
                onChange={(e) => set('emergencyRelationship', e.target.value)}
              >
                <option value="">Select…</option>
                {relationships.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </SelectBox>
            )}
          </Field>
          <Field label="Email">
            {(p) => (
              <input
                {...p}
                type="email"
                placeholder="name@email.com"
                className={fieldControl}
                value={emergencyEmail}
                onChange={(e) => setEmergencyEmail(e.target.value)}
              />
            )}
          </Field>
        </div>
      </section>

      <Availability
        values={values}
        errors={submitted ? errors : {}}
        offered={offered}
        onChange={(next) => set('availability', next)}
        onMax={(next) => set('maxHoursPerWeek', next)}
        onShift={(next) => set('preferredShift', next)}
        maxError={show('maxHoursPerWeek')}
      />

      <section aria-labelledby="add-notes" className="card p-5 sm:p-6">
        <h2 id="add-notes" className="text-ink text-base font-semibold tracking-tight">
          Notes
        </h2>
        <div className="mt-4">
          <Field label="Internal Notes & Caregiver Preferences">
            {(p) => (
              <textarea
                {...p}
                rows={5}
                aria-description="Visible to coordinators only; families never see this."
                className="border-control focus:border-brand-500 w-full rounded-lg border px-3 py-2.5 text-sm"
                value={values.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            )}
          </Field>
        </div>
      </section>

      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {saveError}
        </div>
      )}

      <div className="border-line flex flex-wrap items-center justify-end gap-3 border-t pt-5">
        {submitted && invalid && (
          <p className="text-ink-muted mr-auto inline-flex items-center gap-2 text-sm">
            <TriangleAlert className="size-4 text-amber-500" strokeWidth={2.2} aria-hidden="true" />
            Fix the highlighted fields to continue.
          </p>
        )}
        <Link
          to="/caregivers"
          className="border-line bg-surface text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={provision.isPending}
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {provision.isPending ? 'Adding…' : 'Add Caregiver'}
        </button>
      </div>
    </form>
  )
}

/** Maps the create form into exactly what POST /admin/caregivers accepts. Empty
 * optionals are omitted so the server keeps its own defaults. */
function toProvisionBody(
  v: FormValues,
  gender: string,
  emergencyEmail: string,
  country: 'US' | 'NG',
): ProvisionCaregiverBody {
  const trimmed = (s: string) => s.trim()
  const body: ProvisionCaregiverBody = {
    firstName: trimmed(v.firstName),
    lastName: trimmed(v.lastName),
    email: trimmed(v.email),
    phone: trimmed(v.phone),
    addressLine1: trimmed(v.street),
    city: trimmed(v.city),
    state: trimmed(v.state),
    postalCode: trimmed(v.zip),
    country,
  }
  const set = (key: keyof ProvisionCaregiverBody, value: string | undefined) => {
    if (value && value.trim()) (body as unknown as Record<string, string>)[key] = value.trim()
  }
  set('dateOfBirth', v.dateOfBirth)
  set('title', v.title)
  set('branch', v.branch)
  set('supervisorName', v.supervisor)
  set('joinedAt', v.hiredAt)
  set('emergencyContactName', v.emergencyName)
  set('emergencyContactPhone', v.emergencyPhone)
  set('emergencyContactRelationship', v.emergencyRelationship)
  set('emergencyContactEmail', emergencyEmail)
  set('preferencesNote', v.notes)

  if (gender === 'Male') body.gender = 'MALE'
  else if (gender === 'Female') body.gender = 'FEMALE'

  if (v.employment === 'Full-Time') body.employmentType = 'FULL_TIME'
  else if (v.employment === 'Part-Time') body.employmentType = 'PART_TIME'
  else if (v.employment === 'Bank') body.employmentType = 'CONTRACT'

  const maxHours = Number(v.maxHoursPerWeek)
  if (Number.isFinite(maxHours) && maxHours > 0) body.maxHoursPerWeek = maxHours
  if (v.preferredShift && v.preferredShift !== 'No preference') {
    body.preferredShift = v.preferredShift
  }
  if (v.skills.length > 0) body.skills = v.skills
  if (v.languages.length > 0) body.languages = v.languages
  return body
}

/** Success state: the server issues a one time temporary password that is shown
 * exactly once, so the form is replaced by this panel rather than navigating. */
function CreatedPanel({
  name,
  result,
  onDone,
}: {
  name: string
  result: ProvisionedCaregiver
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-5" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <h1 className="text-ink mt-3 text-lg font-semibold">{name} has been added</h1>
      <p className="text-ink-muted mt-1 text-sm">
        Share this one time temporary password with the caregiver. They must change it on first
        login, and it cannot be retrieved later.
      </p>
      <div className="border-line bg-sunken mt-4 flex items-center justify-between gap-3 rounded-lg border p-3">
        <code className="text-ink font-mono text-sm">{result.temporaryPassword}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(result.temporaryPassword)
            setCopied(true)
          }}
          className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-xs"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
      >
        View caregiver
      </button>
    </div>
  )
}
