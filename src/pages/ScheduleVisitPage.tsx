import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import { recipients } from '@/features/care-recipients/data'
import { addUnassignedVisit, formatTime } from '@/features/scheduling/board-data'
import { serviceTypes } from '@/features/scheduling/settings-data'
import { Field } from '@/components/ui/Field'
import { fieldControl } from '@/lib/field-classes'
import { TODAY } from '@/lib/today'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Schedule Visit. There is no Figma for it. A visit is created with the fields
 * the rota already carries (recipient, type, date, start, duration) and joins
 * the unassigned pool; "Save & Assign Caregiver" then opens the existing
 * Assign Caregiver page, so matching and eligibility checks live in one place.
 * Opened from a recipient's profile, the recipient comes preselected.
 */

const durations = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12]
const durationLabel = (h: number) => (h < 1 ? '30 minutes' : `${h} ${h === 1 ? 'hour' : 'hours'}`)

function endOf(start: string, hours: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + Math.round(hours * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function ScheduleVisitPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const from = recipients.find((r) => r.id === params.get('recipient'))
  const eligible = recipients.filter((r) => r.status !== 'discharged')
  const types = useMemo(() => serviceTypes(), [])

  const [recipientId, setRecipientId] = useState(from && from.status !== 'discharged' ? from.id : '')
  const [type, setType] = useState('')
  const [date, setDate] = useState(TODAY)
  const [start, setStart] = useState('09:00')
  const [hours, setHours] = useState(1)
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const recipient = recipients.find((r) => r.id === recipientId)
  const errors = {
    recipient: recipientId ? undefined : 'Choose who the visit is for.',
    type: type ? undefined : 'Choose the type of visit.',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= TODAY ? undefined : 'Choose today or a later date.',
    start: /^\d{2}:\d{2}$/.test(start) ? undefined : 'Enter a start time.',
  }
  const invalid = Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)
  const overnight = /^\d{2}:\d{2}$/.test(start) && endOf(start, hours) <= start

  // Back to where the page was opened from.
  const back = from ? `/care-recipients/${from.id}/overview` : '/scheduling'

  const save = (assign: boolean) => {
    setSubmitted(true)
    if (invalid || !recipient) return
    const id = addUnassignedVisit({
      date,
      start,
      durationHours: hours,
      recipientId: recipient.id,
      type,
      reason: notes.trim() || 'New visit, awaiting a caregiver',
    })
    navigate(assign ? `/scheduling/visits/${id}/assign` : '/scheduling?view=unassigned')
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        save(true)
      }}
    >
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-sm">
          {from ? (
            <>
              <li><Link to="/care-recipients" className="hover:text-ink">Care Recipients</Link></li>
              <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
              <li><Link to={back} className="hover:text-ink">{from.name}</Link></li>
            </>
          ) : (
            <li><Link to="/scheduling" className="hover:text-ink">Scheduling</Link></li>
          )}
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li className="text-ink" aria-current="page">Schedule Visit</li>
        </ol>
      </nav>

      <header className="-mt-4">
        <h1 className="text-ink text-2xl font-bold tracking-tight">Schedule Visit</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Book a visit, then match a caregiver to it.
        </p>
      </header>

      {submitted && invalid && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Some details are missing before this visit can be scheduled.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="visit-details" className="card p-5 sm:p-6">
          <h2 id="visit-details" className="text-ink text-base font-semibold tracking-tight">Visit Details</h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="Care Recipient" error={show('recipient')} className="sm:col-span-2">
              {(p) => (
                <SelectBox {...p} className={fieldControl} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                  <option value="">Select a care recipient</option>
                  {eligible.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.ref})</option>
                  ))}
                </SelectBox>
              )}
            </Field>
            <Field label="Visit Type" error={show('type')} className="sm:col-span-2">
              {(p) => (
                <SelectBox {...p} className={fieldControl} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">Select a visit type</option>
                  {types.map((t) => <option key={t}>{t}</option>)}
                </SelectBox>
              )}
            </Field>
            <Field label="Date" error={show('date')}>
              {(p) => <input {...p} type="date" min={TODAY} className={fieldControl} value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Start Time" error={show('start')}>
              {(p) => <input {...p} type="time" className={fieldControl} value={start} onChange={(e) => setStart(e.target.value)} />}
            </Field>
            <Field label="Duration">
              {(p) => (
                <SelectBox {...p} className={fieldControl} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  {durations.map((h) => <option key={h} value={h}>{durationLabel(h)}</option>)}
                </SelectBox>
              )}
            </Field>
            <Field label="Ends At">
              {(p) => <input {...p} readOnly className={`${fieldControl} bg-sunken`} value={/^\d{2}:\d{2}$/.test(start) ? `${formatTime(endOf(start, hours))}${overnight ? ' (next day)' : ''}` : ''} />}
            </Field>
            <Field label="Notes for the caregiver" hint="Optional. Shown with the visit while it is unassigned." className="sm:col-span-2">
              {(p) => (
                <textarea {...p} rows={3} maxLength={200} className={`${fieldControl} h-auto py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
              )}
            </Field>
          </div>
        </section>

        <aside aria-labelledby="visit-recipient" className="card space-y-3 p-5 sm:p-6">
          <h2 id="visit-recipient" className="text-ink text-base font-semibold tracking-tight">Care Recipient</h2>
          {recipient ? (
            <dl className="divide-line divide-y text-sm">
              {[
                ['Name', recipient.name],
                ['Condition', recipient.condition],
                ['Care Level', recipient.careLevel],
                ['Current Caregiver', recipient.caregiver ?? 'None assigned'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2 first:pt-0 last:pb-0">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="text-ink text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-ink-muted text-sm">Choose a care recipient to see their details.</p>
          )}
          {recipient?.status === 'on-hold' && (
            <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
              Care is on hold for {recipient.name}. Check with the coordinator before booking.
            </p>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          to={back}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => save(false)}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Save as Unassigned
        </button>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Save &amp; Assign Caregiver
        </button>
      </div>
    </form>
  )
}
