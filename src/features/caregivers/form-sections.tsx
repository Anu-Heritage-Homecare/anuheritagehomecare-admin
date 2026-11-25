import { Fragment, useId, useState } from 'react'
import { CircleX, Paperclip, Plus, Upload } from 'lucide-react'
import { TODAY, credentialLabel } from '@/features/caregivers/edit-form'
import type { FormValues } from '@/features/caregivers/edit-form'
import { formatTime, shifts, weekdays } from '@/features/caregivers/roster-data'
import type { Credential, Shift, Weekday } from '@/features/caregivers/roster-data'
import { Field } from '@/components/ui/Field'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * The form sections shared by the Add and Edit caregiver pages, so both screens
 * capture the same record in the same layout. Pulled out of the edit page when
 * the create flow was added.
 */

/* -------------------------------- token list ------------------------------- */

export function TokenList({
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

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const shortMonth = (iso?: string) =>
  iso ? monthYear.format(new Date(`${iso}T00:00:00Z`)) : '—'

export function Credentials({
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
                          <div className="sm:col-span-2 xl:col-span-4">
                            <DocumentField
                              value={credential.document}
                              onChange={(name) =>
                                update(credential.id, { document: name })
                              }
                            />
                          </div>
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

export function Availability({
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

/* ----------------------------- document upload ----------------------------- */

/**
 * Captures the name of a certificate scan the agency has on file. This is a
 * frontend prototype, so the file itself is not stored anywhere — only the
 * filename is kept, which the backend will replace with a real upload.
 */
function DocumentField({
  value,
  onChange,
}: {
  value?: string
  onChange: (name: string | undefined) => void
}) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-ink-muted mb-1.5 block text-xs font-medium">
        Supporting document
      </label>
      {value ? (
        <div className="border-line flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
          <span className="text-ink inline-flex min-w-0 items-center gap-2">
            <Paperclip className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span className="truncate">{value}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 text-sm font-medium text-red-600 hover:text-red-700"
          >
            Remove
            <span className="sr-only"> uploaded document</span>
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="border-control text-ink-muted hover:bg-sunken flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm"
        >
          <Upload className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          Upload a scan or photo (PDF, JPG or PNG)
        </label>
      )}
      <input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0]?.name)}
      />
    </div>
  )
}
