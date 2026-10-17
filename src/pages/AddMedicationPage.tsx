import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import { addPrescription } from '@/features/care-recipients/medications-data'
import { Field } from '@/components/ui/Field'
import { fieldControl } from '@/lib/field-classes'
import { TODAY } from '@/lib/today'

/*
 * Add Medication. There is no Figma for it; the fields are the ones each
 * prescription card on the Medications tab shows. A new prescription starts
 * active with no adherence and no doses given — those come from records, not
 * from this form — and is entered in the prescription history.
 */

export function AddMedicationPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const profile = useMemo(() => getRecipientProfile(id), [id])

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [strength, setStrength] = useState('')
  const [purpose, setPurpose] = useState('')
  const [schedule, setSchedule] = useState('')
  const [prescribedBy, setPrescribedBy] = useState('')
  const [startDate, setStartDate] = useState(TODAY)
  const [flag, setFlag] = useState('')
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

  const back = `/care-recipients/${profile.id}/medications`
  const errors = {
    name: name.trim() ? undefined : 'Enter the medication name.',
    strength: strength.trim() ? undefined : 'Enter the strength, e.g. 10mg.',
    purpose: purpose.trim() ? undefined : 'Enter what it is for.',
    schedule: schedule.trim() ? undefined : 'Enter when it is taken.',
    prescribedBy: prescribedBy.trim() ? undefined : 'Enter who prescribed it.',
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? undefined : 'Enter the start date.',
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
        if (invalid) return
        addPrescription(profile.id, {
          name: name.trim(),
          brand: brand.trim() || undefined,
          strength: strength.trim(),
          purpose: purpose.trim(),
          schedule: schedule.trim(),
          prescribedBy: prescribedBy.trim(),
          startDate,
          flag: flag.trim() || undefined,
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
          <li className="text-ink" aria-current="page">Add Medication</li>
        </ol>
      </nav>

      <header className="-mt-4">
        <h1 className="text-ink text-2xl font-bold tracking-tight">Add Medication</h1>
        <p className="text-ink-muted mt-1 text-sm">Record a new prescription for {profile.name}.</p>
      </header>

      {submitted && invalid && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Some details are missing before this medication can be added.
        </div>
      )}

      <section aria-labelledby="rx-details" className="card p-5 sm:p-6">
        <h2 id="rx-details" className="text-ink text-base font-semibold tracking-tight">Prescription</h2>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Medication Name" error={show('name')} hint="The generic name.">
            {(p) => <input {...p} className={fieldControl} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Donepezil" />}
          </Field>
          <Field label="Brand Name" hint="Optional.">
            {(p) => <input {...p} className={fieldControl} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Aricept" />}
          </Field>
          <Field label="Strength" error={show('strength')}>
            {(p) => <input {...p} className={fieldControl} value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="e.g. 10mg" />}
          </Field>
          <Field label="Purpose" error={show('purpose')}>
            {(p) => <input {...p} className={fieldControl} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Memory and cognition" />}
          </Field>
          <Field label="Schedule" error={show('schedule')} className="sm:col-span-2">
            {(p) => <input {...p} className={fieldControl} value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="e.g. Once daily, 8:00 PM" />}
          </Field>
          <Field label="Prescribed By" error={show('prescribedBy')}>
            {(p) => <input {...p} className={fieldControl} value={prescribedBy} onChange={(e) => setPrescribedBy(e.target.value)} placeholder="e.g. Dr. Sarah Kim" />}
          </Field>
          <Field label="Start Date" error={show('startDate')}>
            {(p) => <input {...p} type="date" className={fieldControl} value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
          </Field>
          <Field label="Special Instruction" hint="Optional. Shown as a highlighted note on the card." className="sm:col-span-2">
            {(p) => <input {...p} className={fieldControl} value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="e.g. Take with food" />}
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link to={back} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
          Cancel
        </Link>
        <button type="submit" className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white">
          Add Medication
        </button>
      </div>
    </form>
  )
}
