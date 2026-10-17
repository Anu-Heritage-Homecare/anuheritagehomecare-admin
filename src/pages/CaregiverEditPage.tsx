import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  useBlocker,
  useLocation,
  useParams,
} from 'react-router-dom'
import { Check, ChevronRight, CircleX, Plus, Trash2, TriangleAlert } from 'lucide-react'
import {
  TODAY,
  changesFrom,
  credentialLabel,
  deleteBlockers,
  hasErrors,
  hoursOffered,
  supervisorOptions,
  toFormValues,
  validate,
  warnings,
} from '@/features/caregivers/edit-form'
import type { Change, FormValues } from '@/features/caregivers/edit-form'
import {
  branches,
  employmentTypes,
  formatTime,
  getStaffMember,
  shifts,
  statusLabels,
  titles,
  weekdays,
} from '@/features/caregivers/roster-data'
import type {
  Credential,
  Employment,
  Shift,
  StaffMember,
  Weekday,
} from '@/features/caregivers/roster-data'
import { Field } from '@/components/ui/Field'
import { Toggle } from '@/components/ui/Toggle'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

export function CaregiverEditPage() {
  const { caregiverId } = useParams()
  const { search } = useLocation()
  const member = getStaffMember(caregiverId)

  if (!member) return <Navigate to="/caregivers" replace />

  /*
   * Keyed on the person. The form's state used to live in this component and
   * be seeded once, so moving between two caregivers' edit screens — the same
   * route, so the same instance — left the previous one's values on screen and
   * diffed them against the new record.
   */
  return <EditForm key={member.id} member={member} search={search} />
}

function EditForm({ member, search }: { member: StaffMember; search: string }) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(member))
  const [submitted, setSubmitted] = useState(false)
  // Not on the staff record yet, so it lives only on this form for now.
  const [gender, setGender] = useState('')
  const [emergencyEmail, setEmergencyEmail] = useState('')
  const [saved, setSaved] = useState<Change[] | null>(null)
  const nextCredentialId = useRef(0)

  const summaryRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)

  const errors = useMemo(() => validate(values), [values])
  const notices = useMemo(() => warnings(values), [values])
  const changes = useMemo(() => changesFrom(member, values), [member, values])
  const blockers = useMemo(() => deleteBlockers(member), [member])

  const dirty = changes.length > 0
  const invalid = hasErrors(errors)
  // Carries the roster's filters, so cancelling returns to the list the user
  // was actually working through.
  const profile = `/caregivers/${member.id}/overview${search}`
  const rosterPath = `/caregivers${search}`

  /*
   * The only screen in the app that can lose typed input, so leaving with a
   * dirty form asks first — both for in-app navigation and for the tab close.
   */
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  // Focus moves to the message rather than being left on a Save button that is
  // often a screenful away from the first problem.
  useEffect(() => {
    if (submitted && invalid) summaryRef.current?.focus()
  }, [submitted, invalid, attempt])

  useEffect(() => {
    if (saved) savedRef.current?.focus()
  }, [saved])

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setSaved(null)
    setValues({ ...values, [key]: value })
  }

  const show = (key: string) => (submitted ? errors[key] : undefined)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAttempt((n) => n + 1)
    setSubmitted(true)
    // Nothing to save is not an error, but it must not report "0 changes".
    if (!dirty || invalid) return
    setSaved(changes)
  }

  const offered = hoursOffered(values.availability)

  return (
    /* noValidate: the browser's own bubbles would fire before validate() and
       phrase the same problems differently. */
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link to={rosterPath} className="hover:text-ink">
              Caregivers
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </li>
          <li>
            <Link to={profile} className="hover:text-ink">
              {member.name}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </li>
          <li className="text-ink" aria-current="page">
            Edit
          </li>
        </ol>
      </nav>

      <header className="-mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Edit Caregiver Profile
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Update {member.name}{/s$/i.test(member.name) ? '’' : '’s'} information, certifications, and preferences.
          </p>
        </div>
        <Actions dirty={dirty} to={profile} where="at the top of the form" />
      </header>

      {submitted && invalid && (
        <div
          key={attempt}
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 focus:outline-hidden"
        >
          {/* Keyed on the attempt so a repeated submit re-announces, and it
              lists what is wrong rather than only counting it. */}
          <p className="font-semibold">
            {Object.keys(errors).length} field
            {Object.keys(errors).length === 1 ? '' : 's'} need attention before
            this can be saved.
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key} className="break-words">
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitted && !invalid && !dirty && !saved && (
        <p
          key={`clean-${attempt}`}
          role="status"
          className="border-line text-ink-muted rounded-lg border p-3 text-sm"
        >
          Nothing has changed yet, so there is nothing to save.
        </p>
      )}

      {/* Warnings appear and disappear as fields change, so they are announced
          rather than only rendered. */}
      {notices.length > 0 && (
        <ul aria-live="polite" className="space-y-2">
          {notices.map((notice) => (
            <li
              key={notice.id}
              className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className="break-words">{notice.message}</span>
            </li>
          ))}
        </ul>
      )}

      {blocker.state === 'blocked' && (
        <div
          role="alertdialog"
          aria-labelledby="leave-heading"
          className="border-amber-200 bg-amber-50 rounded-lg border p-4 text-sm text-amber-900"
        >
          <p id="leave-heading" className="font-semibold">
            {changes.length} unsaved change{changes.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1">
            Leaving now discards them. Nothing is written until you save.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => blocker.reset?.()}
              className="border-line bg-surface text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => blocker.proceed?.()}
              className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
            >
              Discard and leave
            </button>
          </div>
        </div>
      )}

      {saved && (
        <SaveSummary
          ref={savedRef}
          changes={saved}
          name={member.name}
          to={profile}
        />
      )}

      <section aria-labelledby="edit-personal" className="card p-5 sm:p-6">
        <h2 id="edit-personal" className="text-ink text-base font-semibold tracking-tight">
          Personal Information
        </h2>
        {/* Two columns read top to bottom, as the Figma lays them out; on a
            phone they stack in the same order. */}
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
            <Field label="Email" error={show('email')}>
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
          </div>
        </div>
      </section>

      <section aria-labelledby="edit-employment" className="card p-5 sm:p-6">
        <h2 id="edit-employment" className="text-ink text-base font-semibold tracking-tight">
          Employment Details
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Employee ID">
            {(p) => (
              <input
                {...p}
                readOnly
                value={member.ref}
                aria-description="Issued on hire; it cannot be changed."
                className={cn(fieldControl, 'bg-sunken text-ink-subtle border-transparent')}
              />
            )}
          </Field>
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
                onChange={(e) => set('employment', e.target.value as Employment)}
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
                {/* A stored value outside the list would otherwise display as
                    whichever option came first, while the diff kept the old
                    one — three parts of the screen disagreeing at once. */}
                {!supervisorOptions.includes(values.supervisor) && (
                  <option value={values.supervisor} disabled>
                    {values.supervisor} (no longer a coordinator)
                  </option>
                )}
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
                className={fieldControl}
                value={values.hiredAt}
                onChange={(e) => set('hiredAt', e.target.value)}
              />
            )}
          </Field>
          <div className="min-w-0">
            <p className="text-ink-muted mb-1.5 block text-xs font-medium">Status</p>
            {/* On means active; off means inactive. "On leave" shows as off
                and keeps its label until the switch is touched. */}
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

      <section aria-labelledby="edit-skills" className="card p-5 sm:p-6">
        <h2 id="edit-skills" className="text-ink text-base font-semibold tracking-tight">
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

      <section aria-labelledby="edit-emergency" className="card p-5 sm:p-6">
        <h2 id="edit-emergency" className="text-ink text-base font-semibold tracking-tight">
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
                {/* A stored relationship outside the list still shows as itself. */}
                {!relationships.includes(values.emergencyRelationship) && (
                  <option value={values.emergencyRelationship}>
                    {values.emergencyRelationship || 'Select…'}
                  </option>
                )}
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

      <section aria-labelledby="edit-notes" className="card p-5 sm:p-6">
        <h2 id="edit-notes" className="text-ink text-base font-semibold tracking-tight">
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

      <div className="border-line -mx-4 flex flex-wrap items-center justify-between gap-3 border-t px-4 pt-5 sm:-mx-6 sm:px-6">
        <DeleteControl member={member} blockers={blockers} />
        <Actions dirty={dirty} to={profile} where="at the end of the form" />
      </div>
    </form>
  )
}

/* --------------------------------- actions -------------------------------- */

function Actions({
  dirty,
  to,
  where,
}: {
  dirty: boolean
  to: string
  /** Distinguishes the header pair from the footer pair for a screen reader. */
  where: string
}) {
  const reasonId = `save-reason-${where.replace(/\s+/g, '-')}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to={to}
        className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-medium"
      >
        Cancel
        <span className="sr-only"> and return to the profile, {where}</span>
      </Link>
      {/*
        `aria-disabled`, not `disabled`: a submit button that vanishes from the
        tab order the moment the form is clean strands keyboard focus, and the
        message explaining why nothing happened has to be reachable.
      */}
      <button
        type="submit"
        aria-disabled={!dirty}
        aria-describedby={dirty ? undefined : reasonId}
        // Drawn as the Figma's primary button either way; a clean submit is
        // answered by the "nothing to save" message rather than a grey button.
        className={cn(
          'bg-brand-600 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white',
          dirty ? 'hover:bg-brand-700' : 'cursor-default',
        )}
      >
        Save Changes
        <span className="sr-only"> {where}</span>
      </button>
      {!dirty && (
        <span id={reasonId} className="sr-only">
          Nothing has changed yet.
        </span>
      )}
    </div>
  )
}

function SaveSummary({
  ref,
  changes,
  name,
  to,
}: {
  ref: React.Ref<HTMLDivElement>
  changes: Change[]
  name: string
  to: string
}) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 focus:outline-hidden"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Check className="size-4 shrink-0" strokeWidth={2.6} aria-hidden="true" />
        {changes.length} change{changes.length === 1 ? '' : 's'} ready for{' '}
        {name}
      </p>
      {/* No backend to write to, so the screen reports the diff rather than
          claiming a save that did not happen. */}
      <p className="mt-1 text-emerald-800">
        Nothing has been written — this build has no server. Here is what would
        change:
      </p>
      <ul className="mt-2 space-y-1">
        {changes.map((change) => (
          <li key={change.field} className="break-words">
            <span className="font-medium">{change.field}:</span> {change.from} →{' '}
            {change.to}
          </li>
        ))}
      </ul>
      <Link to={to} className="mt-3 inline-flex min-h-11 items-center font-semibold underline">
        Back to the profile
      </Link>
    </div>
  )
}

function DeleteControl({
  member,
  blockers,
}: {
  member: StaffMember
  blockers: string[]
}) {
  const [confirming, setConfirming] = useState(false)
  const blocked = blockers.length > 0

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-disabled={blocked}
        aria-describedby={blocked ? 'delete-blockers' : undefined}
        onClick={() => !blocked && setConfirming(true)}
        className={cn(
          'inline-flex h-10 items-center gap-2 text-sm font-medium',
          blocked ? 'cursor-not-allowed text-red-600/50' : 'text-red-600 hover:text-red-700',
        )}
      >
        <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
        Delete Caregiver Profile
        <span className="sr-only"> for {member.name}</span>
      </button>
      {blocked && (
        <ul id="delete-blockers" className="text-ink-subtle mt-2 space-y-0.5 text-xs">
          {blockers.map((b) => (
            <li key={b} className="break-words">
              {b}
            </li>
          ))}
        </ul>
      )}
      {/* Says what would happen instead of looking live and doing nothing. */}
      {confirming && (
        <p
          role="status"
          className="border-line text-ink-muted mt-2 max-w-sm rounded-lg border p-3 text-xs"
        >
          Deleting {member.name} would remove the employment record, the
          credentials and the availability. Nothing has been removed — this
          build has no server.
        </p>
      )}
    </div>
  )
}

/* -------------------------------- token list ------------------------------- */

function TokenList({
  label,
  addLabel,
  placeholder,
  values,
  error,
  onChange,
}: {
  label: string
  /** The link that opens the add box, e.g. "Add Skill". */
  addLabel: string
  placeholder: string
  values: string[]
  error?: string
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [adding, setAdding] = useState(false)
  const listId = `tokens-${label.toLowerCase()}`
  const errorId = `${listId}-error`

  const add = () => {
    const value = draft.trim()
    if (!value) return
    // Case-insensitive: "english" beside "English" is the same language, and
    // silently emptying the box gave the user no way to tell what happened.
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setNotice(`${value} is already in the list.`)
      return
    }
    onChange([...values, value])
    setNotice(`${value} added.`)
    setDraft('')
  }

  const remove = (value: string) => {
    onChange(values.filter((v) => v !== value))
    setNotice(`${value} removed.`)
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-ink-muted mb-2 text-sm font-medium">{label}</legend>
      <ul className="flex flex-wrap gap-2">
        {values.map((value) => (
          <li key={value}>
            <span className="bg-brand-50 text-brand-700 inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm">
              {value}
              <button
                type="button"
                onClick={() => remove(value)}
                className="text-brand-600 hover:text-brand-800 grid size-6 place-items-center rounded-full"
              >
                <CircleX className="size-4" strokeWidth={2.2} aria-hidden="true" />
                <span className="sr-only">
                  Remove {value} from {label.toLowerCase()}
                </span>
              </button>
            </span>
          </li>
        ))}
      </ul>

      {adding || error ? (
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{placeholder}</span>
          <input
            value={draft}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            onChange={(e) => {
              setNotice('')
              setDraft(e.target.value)
            }}
            // Enter inside a form submits it; here it should add the token.
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            className={cn(fieldControl, 'min-w-40')}
          />
        </label>
        <button
          type="button"
          onClick={add}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
        >
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Add
          <span className="sr-only"> to {label.toLowerCase()}</span>
        </button>
      </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-brand-700 hover:text-brand-800 mt-3 inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
          {addLabel}
        </button>
      )}

      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      {/* Adding and removing a chip changes a list nobody is looking at, so
          the outcome is announced rather than only rendered. */}
      <p aria-live="polite" className="text-ink-subtle mt-1 text-xs">
        {notice}
      </p>
    </fieldset>
  )
}

/* ------------------------------- credentials ------------------------------- */

const relationships = [
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

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const shortMonth = (iso?: string) =>
  iso ? monthYear.format(new Date(`${iso}T00:00:00Z`)) : '—'

function Credentials({
  values,
  errors,
  nextId,
  onChange,
}: {
  values: FormValues
  errors: Record<string, string | undefined>
  /** A counter, not Date.now() — two adds in one millisecond collided. */
  nextId: () => string
  onChange: (next: Credential[]) => void
}) {
  // Rows read as a table; Edit opens one for changes underneath it.
  const [open, setOpen] = useState<string | null>(null)

  const update = (id: string, patch: Partial<Credential>) =>
    onChange(values.credentials.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const add = () => {
    const id = nextId()
    onChange([
      ...values.credentials,
      { id, name: '', kind: 'certification', reference: '', issuedAt: '', expiresAt: '' },
    ])
    setOpen(id)
  }

  const cell = 'text-ink-muted px-4 py-3.5 whitespace-nowrap'

  return (
    <section aria-labelledby="edit-certifications" className="card p-5 sm:p-6">
      <h2 id="edit-certifications" className="text-ink text-base font-semibold tracking-tight">
        Certifications
      </h2>

      <div
        tabIndex={0}
        role="region"
        aria-label="Certifications table"
        className="border-line mt-4 overflow-x-auto rounded-lg border"
      >
        <table className="w-full min-w-2xl text-left text-sm">
          <thead className="border-line bg-sunken text-ink-muted border-b text-xs">
            <tr>
              {['Certification', 'License #', 'Issue Date', 'Expiry Date', 'Status', 'Actions'].map(
                (col) => (
                  <th
                    key={col}
                    scope="col"
                    className={cn('px-4 py-2.5 font-medium', col === 'Actions' && 'text-right')}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-line/70 divide-y">
            {values.credentials.length === 0 && (
              <tr>
                <td colSpan={6} className="text-ink-muted px-4 py-6 text-center">
                  No certifications on file.
                </td>
              </tr>
            )}
            {values.credentials.map((credential) => {
              const error = errors[`credential-${credential.id}`]
              const editing = open === credential.id || Boolean(error)
              const state = credentialLabel(credential.expiresAt || undefined, TODAY)
              return (
                <Fragment key={credential.id}>
                  <tr className={cn(error && 'bg-red-50/40')}>
                    <th scope="row" className="text-ink px-4 py-3.5 font-semibold">
                      {credential.name || <span className="text-ink-subtle font-normal">New certification</span>}
                    </th>
                    <td className={cell}>{credential.reference || '—'}</td>
                    <td className={cell}>{shortMonth(credential.issuedAt)}</td>
                    <td className={cell}>{shortMonth(credential.expiresAt)}</td>
                    <td className={cell}>
                      <span
                        title={state.label}
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                          state.tone === 'expired'
                            ? 'bg-red-50 text-red-700'
                            : state.tone === 'expiring'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {state.tone === 'expired'
                          ? 'Expired'
                          : state.tone === 'expiring'
                            ? 'Renewal Due'
                            : 'Valid'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-4">
                        <button
                          type="button"
                          aria-expanded={editing}
                          onClick={() => setOpen(editing ? null : credential.id)}
                          className="text-brand-700 hover:text-brand-800 text-sm font-medium"
                        >
                          {editing ? 'Done' : 'Edit'}
                          <span className="sr-only"> {credential.name || 'certification'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onChange(values.credentials.filter((c) => c.id !== credential.id))
                          }
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          Remove
                          <span className="sr-only"> {credential.name || 'certification'}</span>
                        </button>
                      </span>
                    </td>
                  </tr>
                  {editing && (
                    <tr className="bg-canvas">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <Field label="Certification" error={error}>
                            {(p) => (
                              <input
                                {...p}
                                className={fieldControl}
                                value={credential.name}
                                onChange={(e) => update(credential.id, { name: e.target.value })}
                              />
                            )}
                          </Field>
                          <Field label="License #">
                            {(p) => (
                              <input
                                {...p}
                                className={fieldControl}
                                value={credential.reference ?? ''}
                                onChange={(e) =>
                                  update(credential.id, { reference: e.target.value })
                                }
                              />
                            )}
                          </Field>
                          <Field label="Issue Date">
                            {(p) => (
                              <input
                                {...p}
                                type="date"
                                className={fieldControl}
                                value={credential.issuedAt ?? ''}
                                onChange={(e) =>
                                  update(credential.id, { issuedAt: e.target.value })
                                }
                              />
                            )}
                          </Field>
                          <Field label="Expiry Date" error={error}>
                            {(p) => (
                              <input
                                {...p}
                                type="date"
                                className={fieldControl}
                                value={credential.expiresAt ?? ''}
                                onChange={(e) =>
                                  update(credential.id, { expiresAt: e.target.value })
                                }
                              />
                            )}
                          </Field>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={add}
        className="border-control text-ink hover:bg-sunken mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium"
      >
        <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
        Add Certification
      </button>
    </section>
  )
}

/* ------------------------------- availability ------------------------------ */

function Availability({
  values,
  errors,
  offered,
  onChange,
  onMax,
  onShift,
  maxError,
}: {
  values: FormValues
  errors: Record<string, string | undefined>
  offered: number
  onChange: (next: FormValues['availability']) => void
  onMax: (next: string) => void
  onShift: (next: Shift) => void
  maxError?: string
}) {
  const windowFor = (day: Weekday) => values.availability.find((w) => w.day === day)
  const [editingDay, setEditingDay] = useState<Weekday | null>(null)

  const toggle = (day: Weekday) => {
    const existing = windowFor(day)
    if (existing) {
      onChange(values.availability.filter((w) => w.day !== day))
      return
    }
    onChange([...values.availability, { day, start: '09:00', end: '17:00' }])
    setEditingDay(day)
  }

  const update = (day: Weekday, patch: Partial<FormValues['availability'][number]>) =>
    onChange(values.availability.map((w) => (w.day === day ? { ...w, ...patch } : w)))

  const max = Number(values.maxHoursPerWeek)
  const over = !Number.isNaN(max) && max > 0 && offered > max

  return (
    <section aria-labelledby="edit-availability" className="card p-5 sm:p-6">
      <h2 id="edit-availability" className="text-ink text-base font-semibold tracking-tight">
        Availability Preferences
      </h2>
      <fieldset className="mt-4">
        <legend className="text-ink-muted mb-2 text-sm font-medium">
          Weekly Availability Grid
        </legend>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {weekdays.map((day) => {
            const window = windowFor(day)
            const error = errors[`availability-${day}`]
            const editing = window && (editingDay === day || Boolean(error))
            return (
              <li
                key={day}
                className={cn(
                  'min-w-0 rounded-xl border px-3.5 py-3',
                  error
                    ? 'border-red-300 bg-red-50/40'
                    : window
                      ? 'border-brand-500 bg-brand-50/50'
                      : 'border-line bg-sunken',
                )}
              >
                {/* The dot is the switch: a real checkbox under it. */}
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-base font-semibold',
                      window ? 'text-brand-700' : 'text-ink-muted',
                    )}
                  >
                    {day}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(window)}
                    onChange={() => toggle(day)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2.5 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600',
                      window ? 'bg-emerald-500' : 'bg-ink-subtle',
                    )}
                  />
                  <span className="sr-only">Available on {day}</span>
                </label>

                <p className={cn('mt-2 text-xs', window ? 'text-ink-muted' : 'text-ink-subtle')}>
                  Hours
                </p>
                {!window ? (
                  <p className="text-ink-subtle text-sm font-semibold">Not Available</p>
                ) : editing ? (
                  <div className="mt-1 space-y-1.5">
                    <label className="block">
                      <span className="sr-only">{day} start time</span>
                      <input
                        type="time"
                        value={window.start}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `availability-${day}` : undefined}
                        onChange={(e) => update(day, { start: e.target.value })}
                        className="border-control focus:border-brand-500 h-8 w-full rounded-md border bg-white px-2 text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">{day} finish time</span>
                      <input
                        type="time"
                        value={window.end}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `availability-${day}` : undefined}
                        onChange={(e) => update(day, { end: e.target.value })}
                        className="border-control focus:border-brand-500 h-8 w-full rounded-md border bg-white px-2 text-xs"
                      />
                    </label>
                    {!error && (
                      <button
                        type="button"
                        onClick={() => setEditingDay(null)}
                        className="text-brand-700 text-xs font-medium"
                      >
                        Done
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDay(day)}
                    className="text-ink hover:text-brand-700 text-left text-sm font-semibold"
                  >
                    {formatTime(window.start)} - {formatTime(window.end)}
                    <span className="sr-only">, change {day} hours</span>
                  </button>
                )}

                {error && (
                  <p id={`availability-${day}`} className="mt-1 text-xs font-medium text-red-700">
                    {error}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field
          label="Maximum Hours Per Week"
          error={maxError}
          hint={
            over
              ? `The grid above offers ${offered} hours — ${offered - max} beyond this.`
              : undefined
          }
        >
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              className={fieldControl}
              value={values.maxHoursPerWeek}
              onChange={(e) => onMax(e.target.value)}
            />
          )}
        </Field>
        <Field label="Preferred Shift">
          {(p) => (
            <SelectBox
              {...p}
              className={fieldControl}
              value={values.preferredShift}
              onChange={(e) => onShift(e.target.value as Shift)}
            >
              {shifts.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectBox>
          )}
        </Field>
      </div>
    </section>
  )
}
