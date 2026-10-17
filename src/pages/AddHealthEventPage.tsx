import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import { addHealthEvent, eventKinds } from '@/features/care-recipients/health-data'
import { Field } from '@/components/ui/Field'
import { fieldControl } from '@/lib/field-classes'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { TODAY } from '@/lib/today'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Add Health Event. There is no Figma for it; it records one entry on the
 * Health tab's timeline with the fields each entry shows. The event type sets
 * the timeline's filter category, badge and colour, so a new entry files
 * exactly like the existing ones. Vitals trends are not changed by it.
 */

export function AddHealthEventPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const profile = useMemo(() => getRecipientProfile(id), [id])

  const [kind, setKind] = useState('')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [date, setDate] = useState(TODAY)
  const [recordedBy, setRecordedBy] = useState(SIGNED_IN)
  const [role, setRole] = useState(SIGNED_IN_ROLE)
  const [submitted, setSubmitted] = useState(false)

  if (!profile) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <p className="text-ink text-sm font-semibold">Care recipient not found</p>
        <Link to="/care-recipients" className="text-brand-700 mt-2 text-sm font-medium hover:underline">
          Back to Care Recipients
        </Link>
      </div>
    )
  }

  const back = `/care-recipients/${profile.id}/health`
  const chosen = eventKinds.find((k) => k.id === kind)
  const errors = {
    kind: chosen ? undefined : 'Choose the type of event.',
    title: title.trim() ? undefined : 'Enter a short title.',
    detail: detail.trim() ? undefined : 'Describe what happened or was found.',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= TODAY ? undefined : 'Enter today or an earlier date.',
    recordedBy: recordedBy.trim() ? undefined : 'Enter who recorded it.',
  }
  const invalid = Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if (invalid || !chosen) return
        addHealthEvent(profile.id, {
          date,
          title: title.trim(),
          detail: detail.trim(),
          recordedBy: recordedBy.trim(),
          recordedByRole: role.trim(),
          category: chosen.category,
          badge: chosen.badge,
          tone: chosen.tone,
        })
        navigate(back)
      }}
    >
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-sm">
          <li><Link to="/care-recipients" className="hover:text-ink">Care Recipients</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li><Link to={back} className="hover:text-ink">{profile.name}</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li className="text-ink" aria-current="page">Add Health Event</li>
        </ol>
      </nav>

      <header className="-mt-4">
        <h1 className="text-ink text-2xl font-bold tracking-tight">Add Health Event</h1>
        <p className="text-ink-muted mt-1 text-sm">Record a reading, incident, assessment or appointment for {profile.name}.</p>
      </header>

      {submitted && invalid && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Some details are missing before this event can be added.
        </div>
      )}

      <section aria-labelledby="event-details" className="card p-5 sm:p-6">
        <h2 id="event-details" className="text-ink text-base font-semibold tracking-tight">Event</h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Event Type" error={show('kind')}>
            {(p) => (
              <SelectBox {...p} className={fieldControl} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Select a type</option>
                {eventKinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </SelectBox>
            )}
          </Field>
          <Field label="Date" error={show('date')}>
            {(p) => <input {...p} type="date" max={TODAY} className={fieldControl} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Title" error={show('title')} className="sm:col-span-2">
            {(p) => <input {...p} className={fieldControl} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Blood pressure reading" />}
          </Field>
          <Field label="Details" error={show('detail')} className="sm:col-span-2">
            {(p) => (
              <textarea
                {...p}
                rows={4}
                maxLength={400}
                className={`${fieldControl} h-auto py-2`}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="What was observed, measured or decided"
              />
            )}
          </Field>
          <Field label="Recorded By" error={show('recordedBy')}>
            {(p) => <input {...p} className={fieldControl} value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)} />}
          </Field>
          <Field label="Role">
            {(p) => <input {...p} className={fieldControl} value={role} onChange={(e) => setRole(e.target.value)} />}
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link to={back} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
          Cancel
        </Link>
        <button type="submit" className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white">
          Add Health Event
        </button>
      </div>
    </form>
  )
}
