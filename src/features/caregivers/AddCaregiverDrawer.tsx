import { useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { useProvisionCaregiver } from './useProvisionCaregiver'
import type { ProvisionCaregiverBody } from './useProvisionCaregiver'
import { Drawer } from '@/components/ui/Drawer'
import { SelectBox } from '@/components/ui/SelectBox'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'

/*
 * Add caregiver. Provisions the real account and profile through
 * POST /admin/caregivers. The fields below are exactly what that endpoint
 * accepts (identity, contact, postal address and an optional role posture);
 * nothing is invented. The server issues a one time temporary password and
 * flags the account to change it on first login, so on success the drawer shows
 * that password once before closing rather than navigating away.
 */

const countries: { value: 'US' | 'NG'; label: string }[] = [
  { value: 'US', label: 'United States' },
  { value: 'NG', label: 'Nigeria' },
]
const genders: { value: 'MALE' | 'FEMALE'; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
]
const employmentTypes: { value: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
]

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'
const labelClass = 'text-ink text-sm font-semibold'

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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AddCaregiverForm({ onDone }: { onDone: (created: boolean) => void }) {
  const provision = useProvisionCaregiver()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState<'US' | 'NG' | ''>('')
  const [title, setTitle] = useState('')
  const [branch, setBranch] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('')
  const [employmentType, setEmploymentType] = useState<'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | ''>('')
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)

  const emailError = submitted && !EMAIL.test(email.trim()) && 'Enter a valid email address.'
  const valid =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    EMAIL.test(email.trim()) &&
    phone.trim() !== '' &&
    addressLine1.trim() !== '' &&
    city.trim() !== '' &&
    state.trim() !== '' &&
    postalCode.trim() !== '' &&
    country !== ''

  const saveError = provision.error instanceof ApiError ? provision.error.message : null

  // The account is provisioned and the password is shown once; closing here
  // invalidates the roster so the new caregiver appears.
  if (provision.isSuccess && provision.data) {
    const { temporaryPassword } = provision.data
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-5 p-5">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Check className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              Caregiver account created
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              {firstName.trim()} {lastName.trim()} can sign in with {email.trim()} and the temporary
              password below. They will be asked to change it on first login.
            </p>
          </div>
          <div>
            <span className={labelClass}>Temporary password</span>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="border-line bg-sunken text-ink flex-1 rounded-lg border px-3 py-2.5 font-mono text-sm break-all">
                {temporaryPassword}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(temporaryPassword).then(() => setCopied(true))
                }}
                className="border-control text-ink hover:bg-sunken inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
              >
                {copied ? (
                  <Check className="size-4" strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Copy className="size-4" strokeWidth={2.2} aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-ink-subtle mt-2 text-xs">
              This password is shown once and is not stored. Copy it now; if it is lost, reset it
              from the caregiver's account.
            </p>
          </div>
        </div>
        <div className="border-line bg-surface sticky bottom-0 flex items-center justify-end border-t p-5">
          <button
            type="button"
            onClick={() => onDone(true)}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="flex min-h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        // `valid` includes `country !== ''`, so this narrows country to US | NG.
        if (!valid) return
        const body: ProvisionCaregiverBody = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country,
          ...(addressLine2.trim() ? { addressLine2: addressLine2.trim() } : {}),
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(branch.trim() ? { branch: branch.trim() } : {}),
          ...(gender ? { gender } : {}),
          ...(employmentType ? { employmentType } : {}),
        }
        provision.reset()
        provision.mutate(body)
      }}
    >
      <div className="flex-1 space-y-6 p-5">
        {saveError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </div>
        )}

        <Section title="Caregiver">
          <div className="grid grid-cols-2 gap-3">
            <Text name="First name" value={firstName} onChange={setFirstName} placeholder="e.g. Sarah" error={submitted && firstName.trim() === '' && 'Enter the first name.'} />
            <Text name="Last name" value={lastName} onChange={setLastName} placeholder="e.g. Adams" error={submitted && lastName.trim() === '' && 'Enter the last name.'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Text name="Email" type="email" value={email} onChange={setEmail} placeholder="name@example.com" error={emailError} />
            <Text name="Phone" value={phone} onChange={setPhone} placeholder="e.g. +1 555 0100" error={submitted && phone.trim() === '' && 'Enter the phone number.'} />
          </div>
        </Section>

        <Section title="Address">
          <Text name="Street address" value={addressLine1} onChange={setAddressLine1} placeholder="e.g. 234 Maple Drive" error={submitted && addressLine1.trim() === '' && 'Enter the street address.'} />
          <Text name="Apartment, suite (optional)" value={addressLine2} onChange={setAddressLine2} placeholder="e.g. Apt 4B" />
          <div className="grid grid-cols-2 gap-3">
            <Text name="City" value={city} onChange={setCity} placeholder="e.g. Springfield" error={submitted && city.trim() === '' && 'Enter the city.'} />
            <Text name="State" value={state} onChange={setState} placeholder="e.g. Illinois" error={submitted && state.trim() === '' && 'Enter the state.'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Text name="Postal code" value={postalCode} onChange={setPostalCode} placeholder="e.g. 62704" error={submitted && postalCode.trim() === '' && 'Enter the postal code.'} />
            <label className="block">
              <span className={labelClass}>Country</span>
              <SelectBox
                value={country}
                onChange={(e) => setCountry(e.target.value as 'US' | 'NG' | '')}
                className={cn(fieldClass, country === '' && 'text-ink-subtle')}
              >
                <option value="">Select</option>
                {countries.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </SelectBox>
              {submitted && country === '' && (
                <span className="mt-1 block text-xs text-red-700">Select the country.</span>
              )}
            </label>
          </div>
        </Section>

        <Section title="Role (optional)">
          <div className="grid grid-cols-2 gap-3">
            <Text name="Title" value={title} onChange={setTitle} placeholder="e.g. Senior caregiver" />
            <Text name="Branch" value={branch} onChange={setBranch} placeholder="e.g. Springfield" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            </label>
            <label className="block">
              <span className={labelClass}>Employment type</span>
              <SelectBox
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | '')
                }
                className={cn(fieldClass, employmentType === '' && 'text-ink-subtle')}
              >
                <option value="">Select</option>
                {employmentTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectBox>
            </label>
          </div>
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
          disabled={!valid || provision.isPending}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
        >
          {provision.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Add caregiver
        </button>
      </div>
    </form>
  )
}

export function AddCaregiverDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: (created: boolean) => void
}) {
  return (
    <Drawer open={open} onClose={() => onClose(false)} title="Add caregiver">
      <AddCaregiverForm onDone={onClose} />
    </Drawer>
  )
}
