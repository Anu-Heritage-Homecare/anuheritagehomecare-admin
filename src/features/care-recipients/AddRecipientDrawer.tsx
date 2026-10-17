import { useState } from 'react'
import { addRecipient } from './data'
import type { Recipient } from './data'
import { staffMembers } from '@/features/caregivers/staff'
import { Drawer } from '@/components/ui/Drawer'
import { TODAY } from '@/lib/today'
import { cn } from '@/lib/cn'
import type { CareLevel, Priority } from '@/types'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Placeholder intake form. There is no design for this yet; the fields are the
 * ones the directory and profile already show (name, age, condition, care
 * level, priority, caregiver) plus the basics any intake collects. Replace the
 * body when a design lands — the drawer shell matches the other side drawers.
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
const genders = ['Female', 'Male', 'Prefer not to say']
const relationships = ['Daughter', 'Son', 'Spouse', 'Sibling', 'Parent', 'Friend', 'Other']

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'
const label = 'text-ink text-sm font-semibold'

/** Whole years between an ISO birth date and the sample "today". */
function ageOn(dob: string, today = TODAY): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob >= today) return null
  const [y, m, d] = dob.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

const digits = (v: string) => v.replace(/[\s-]/g, '')
const validPhone = (v: string) => /^\+?\d{7,15}$/.test(digits(v))

function Text({
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  optional,
  error,
}: {
  name: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  optional?: boolean
  error?: string | false
}) {
  return (
    <label className="block">
      <span className={label}>
        {name}
        {optional && <span className="text-ink-subtle ml-1 text-xs font-normal">(Optional)</span>}
      </span>
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

function Select<T extends string>({
  name,
  value,
  onChange,
  options,
  placeholder,
}: {
  name: string
  value: T
  onChange: (v: T) => void
  options: readonly { value: T; label: string }[]
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className={label}>{name}</span>
      <SelectBox
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(fieldClass, value === '' && 'text-ink-subtle')}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectBox>
    </label>
  )
}

const asOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }))

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-ink mb-3 text-xs font-bold tracking-wide uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}

function AddRecipientForm({ onDone }: { onDone: (added: Recipient | null) => void }) {
  const caregivers = staffMembers.filter((m) => m.status === 'active' && !/coordinator/i.test(m.title))
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [condition, setCondition] = useState('')
  const [careLevel, setCareLevel] = useState<CareLevel>('Part-Time')
  const [priority, setPriority] = useState<Priority>('normal')
  const [caregiver, setCaregiver] = useState('')
  const [contactName, setContactName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const age = ageOn(dob)
  const dobError = dob !== '' && age === null && 'Enter a date of birth before today.'
  const phoneError = phone !== '' && !validPhone(phone) && 'Enter a phone number of 7 to 15 digits.'
  const contactPhoneError =
    contactPhone !== '' && !validPhone(contactPhone) && 'Enter a phone number of 7 to 15 digits.'
  const valid =
    first.trim() !== '' &&
    last.trim() !== '' &&
    age !== null &&
    gender !== '' &&
    !phoneError &&
    address.trim() !== '' &&
    condition.trim() !== '' &&
    contactName.trim() !== '' &&
    relationship !== '' &&
    validPhone(contactPhone)

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || age === null) return
        const added = addRecipient({
          name: `${first.trim()} ${last.trim()}`,
          age,
          condition: condition.trim(),
          careLevel,
          priority,
          caregiver: caregiver || null,
          intake: {
            dateOfBirth: dob,
            gender,
            phone: phone.trim(),
            address: address.trim(),
            emergencyContact: { name: contactName.trim(), relationship, phone: contactPhone.trim() },
          },
        })
        onDone(added)
      }}
    >
      <div className="flex-1 space-y-6 p-5">
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-3">
            <Text name="First Name" value={first} onChange={setFirst} placeholder="e.g. Grace" />
            <Text name="Last Name" value={last} onChange={setLast} placeholder="e.g. Adebayo" />
            <Text name="Date of Birth" type="date" value={dob} onChange={setDob} error={dobError} />
            <Select name="Gender" value={gender} onChange={setGender} options={asOptions(genders)} placeholder="Select" />
          </div>
          <Text name="Phone Number" type="tel" value={phone} onChange={setPhone} placeholder="e.g. 08012345678" optional error={phoneError} />
          <Text name="Home Address" value={address} onChange={setAddress} placeholder="e.g. 12 Bode Thomas Street, Surulere, Lagos" />
        </Section>

        <Section title="Care Needs">
          <Text name="Primary Condition" value={condition} onChange={setCondition} placeholder="e.g. Type 2 Diabetes" />
          <div className="grid grid-cols-2 gap-3">
            <Select name="Care Level" value={careLevel} onChange={setCareLevel} options={asOptions(careLevels) as { value: CareLevel; label: string }[]} />
            <Select name="Priority" value={priority} onChange={setPriority} options={priorities} />
          </div>
          <Select
            name="Assigned Caregiver"
            value={caregiver}
            onChange={setCaregiver}
            options={caregivers.map((c) => ({ value: c.name, label: `${c.name} — ${c.branch}` }))}
            placeholder="Assign later"
          />
        </Section>

        <Section title="Emergency Contact">
          <div className="grid grid-cols-2 gap-3">
            <Text name="Full Name" value={contactName} onChange={setContactName} placeholder="e.g. Tunde Adebayo" />
            <Select name="Relationship" value={relationship} onChange={setRelationship} options={asOptions(relationships)} placeholder="Select" />
          </div>
          <Text name="Phone Number" type="tel" value={contactPhone} onChange={setContactPhone} placeholder="e.g. 08012345678" error={contactPhoneError} />
        </Section>
      </div>
      <div className="border-line bg-surface sticky bottom-0 flex items-center justify-between gap-2 border-t p-5">
        <button
          type="button"
          onClick={() => onDone(null)}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
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
  onClose: (added: Recipient | null) => void
}) {
  return (
    <Drawer open={open} onClose={() => onClose(null)} title="Add Care Recipient">
      <AddRecipientForm onDone={onClose} />
    </Drawer>
  )
}
