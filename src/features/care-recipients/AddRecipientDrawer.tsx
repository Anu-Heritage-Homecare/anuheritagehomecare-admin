import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAddRecipient } from './useAddRecipient'
import { useFamilyOwners } from './useFamilyOwners'
import type { FamilyOwnerOption } from './useFamilyOwners'
import { Drawer } from '@/components/ui/Drawer'
import { ApiError } from '@/lib/api'
import { TODAY } from '@/lib/today'
import { cn } from '@/lib/cn'
import type { Priority } from '@/types'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Add Care Recipient. Writes the real record through POST /admin/care-recipients.
 * A family owner must be chosen first: each owner's id is the ownerId the record
 * is created under. The fields below are exactly what that endpoint accepts
 * (identity, address parts, relationship, living situation and an optional
 * priority); nothing is invented.
 */

const priorities: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'critical', label: 'Critical' },
]
const genders: { value: 'MALE' | 'FEMALE'; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
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

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'
const labelClass = 'text-ink text-sm font-semibold'

/** Whole years between an ISO birth date and the sample "today". */
function ageOn(dob: string, today = TODAY): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob >= today) return null
  const [y, m, d] = dob.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

function Text({
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
}: {
  name: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  error?: string | false
}) {
  return (
    <label className="block">
      <span className={labelClass}>{name}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        max={type === 'date' ? TODAY : undefined}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        className={cn(fieldClass, error && 'border-red-500')}
      />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-ink mb-3 text-xs font-bold tracking-wide uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}

function ownerText(owner: FamilyOwnerOption): string {
  const detail = owner.email ?? owner.phone
  return detail ? `${owner.name} — ${detail}` : owner.name
}

function AddRecipientForm({ onDone }: { onDone: (created: boolean) => void }) {
  const ownersQuery = useFamilyOwners(true)
  const add = useAddRecipient()

  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('')
  const [fullAddress, setFullAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [relationship, setRelationship] = useState('')
  const [livingSituation, setLivingSituation] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [submitted, setSubmitted] = useState(false)

  const owners = useMemo(() => ownersQuery.data ?? [], [ownersQuery.data])
  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase()
    if (!q) return owners
    return owners.filter((o) =>
      [o.name, o.reference, o.email ?? '', o.phone ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [owners, ownerSearch])

  const age = ageOn(dob)
  const dobError = submitted && age === null && 'Enter a date of birth before today.'
  const valid =
    ownerId !== '' &&
    name.trim() !== '' &&
    gender !== '' &&
    age !== null &&
    city.trim() !== '' &&
    state.trim() !== '' &&
    fullAddress.trim() !== '' &&
    relationship.trim() !== '' &&
    livingSituation.trim() !== ''

  const loadError = ownersQuery.error instanceof ApiError ? ownersQuery.error.message : null
  const saveError = add.error instanceof ApiError ? add.error.message : null

  return (
    <form
      className="flex min-h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if (!valid) return
        add.reset()
        add.mutate(
          {
            ownerId,
            name: name.trim(),
            gender,
            dateOfBirth: dob,
            city: city.trim(),
            state: state.trim(),
            fullAddress: fullAddress.trim(),
            relationship: relationship.trim(),
            livingSituation: livingSituation.trim(),
            priority: PRIORITY_TOKEN[priority],
          },
          { onSuccess: () => onDone(true) },
        )
      }}
    >
      <div className="flex-1 space-y-6 p-5">
        {saveError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </div>
        )}

        <Section title="Family Owner">
          <label className="block">
            <span className={labelClass}>Search owners</span>
            <input
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              placeholder="Search by name, email or phone"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Owner</span>
            {loadError ? (
              <p className="mt-1.5 text-sm text-red-700">{loadError}</p>
            ) : (
              <SelectBox
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                disabled={ownersQuery.isPending}
                className={cn(fieldClass, ownerId === '' && 'text-ink-subtle')}
              >
                <option value="">
                  {ownersQuery.isPending ? 'Loading owners…' : 'Select the family owner'}
                </option>
                {filteredOwners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {ownerText(o)}
                  </option>
                ))}
              </SelectBox>
            )}
            {submitted && ownerId === '' && !loadError && (
              <span className="mt-1 block text-xs text-red-700">Choose the family owner.</span>
            )}
          </label>
        </Section>

        <Section title="Personal Details">
          <Text name="Full Name" value={name} onChange={setName} placeholder="e.g. Margaret Johnson" error={submitted && name.trim() === '' && 'Enter the full name.'} />
          <div className="grid grid-cols-2 gap-3">
            <Text name="Date of Birth" type="date" value={dob} onChange={setDob} error={dobError} />
            <label className="block">
              <span className={labelClass}>Gender</span>
              <SelectBox
                value={gender}
                onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | '')}
                className={cn(fieldClass, gender === '' && 'text-ink-subtle')}
              >
                <option value="">Select</option>
                {genders.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </SelectBox>
              {submitted && gender === '' && (
                <span className="mt-1 block text-xs text-red-700">Select the gender.</span>
              )}
            </label>
          </div>
          <Text name="Relationship to Owner" value={relationship} onChange={setRelationship} placeholder="e.g. Mother" error={submitted && relationship.trim() === '' && 'Enter the relationship.'} />
        </Section>

        <Section title="Address & Living Situation">
          <Text name="Home Address" value={fullAddress} onChange={setFullAddress} placeholder="e.g. 234 Maple Drive" error={submitted && fullAddress.trim() === '' && 'Enter the home address.'} />
          <div className="grid grid-cols-2 gap-3">
            <Text name="City" value={city} onChange={setCity} placeholder="e.g. Springfield" error={submitted && city.trim() === '' && 'Enter the city.'} />
            <Text name="State" value={state} onChange={setState} placeholder="e.g. Illinois" error={submitted && state.trim() === '' && 'Enter the state.'} />
          </div>
          <Text name="Living Situation" value={livingSituation} onChange={setLivingSituation} placeholder="e.g. Lives with family" error={submitted && livingSituation.trim() === '' && 'Enter the living situation.'} />
        </Section>

        <Section title="Priority">
          <label className="block">
            <span className={labelClass}>Priority</span>
            <SelectBox value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={fieldClass}>
              {priorities.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectBox>
          </label>
        </Section>
      </div>
      <div className="border-line bg-surface sticky bottom-0 flex items-center justify-between gap-2 border-t p-5">
        <button
          type="button"
          onClick={() => onDone(false)}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid || add.isPending}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
        >
          {add.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Add Care Recipient
        </button>
      </div>
    </form>
  )
}

export function AddRecipientDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: (created: boolean) => void
}) {
  return (
    <Drawer open={open} onClose={() => onClose(false)} title="Add Care Recipient">
      <AddRecipientForm onDone={onClose} />
    </Drawer>
  )
}
