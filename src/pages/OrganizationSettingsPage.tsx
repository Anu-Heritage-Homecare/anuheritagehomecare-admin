import { useState } from 'react'
import { Building2, CalendarDays, Download, Pencil, PhoneCall, Plus, ShieldAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  addBranch,
  addContact,
  currencyOptions,
  dateFormatOptions,
  defaultBranchHours,
  formatHour,
  languageOptions,
  nigerianStates,
  setDayOpen,
  setHours,
  timezoneOptions,
  updateProfile,
  useOrganization,
  validHours,
  validPhone,
} from '@/features/settings/organization'
import type { ContactKind, OrgDayHours, OrgProfile } from '@/features/settings/organization'
import { useUsers } from '@/features/settings/users'
import { Drawer } from '@/components/ui/Drawer'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const outlineButton =
  'border-control text-ink hover:bg-sunken inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors print:hidden'
const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'

const contactIcon: Record<ContactKind, LucideIcon> = {
  medical: PhoneCall,
  security: ShieldAlert,
}

type Dialog = 'profile' | 'schedule' | 'branch' | 'contact' | null

function Card({
  title,
  badge,
  action,
  children,
}: {
  title: string
  badge?: React.ReactNode
  action: React.ReactNode
  children: React.ReactNode
}) {
  const id = `org-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 id={id} className="text-ink text-base font-semibold tracking-tight">
            {title}
          </h2>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-subtle text-[0.6875rem] font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-ink mt-1 text-sm whitespace-pre-line">{children}</dd>
    </div>
  )
}

export function OrganizationSettingsPage() {
  const org = useOrganization()
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const activeBranches = org.branches.filter((b) => b.active).length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">Organization Profile</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Manage legal identity, branches, business operations, and contacts
          </p>
        </div>
        {/* The browser's print dialog saves a PDF; no server renders one. */}
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors print:hidden"
        >
          <Download className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Export Systems PDF
        </button>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card
            title="Profile Details"
            action={
              <button type="button" onClick={() => setDialog('profile')} className={outlineButton}>
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" />
                Edit Profile
              </button>
            }
          >
            <div className="border-line flex items-center gap-4 border-b pt-1 pb-5">
              <span className="bg-brand-50 text-brand-600 grid size-18 shrink-0 place-items-center rounded-full">
                <Building2 className="size-7" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-ink text-base font-semibold break-words">{org.profile.name}</p>
                <p className="text-ink-muted mt-0.5 text-sm">Business Reg: {org.profile.registration}</p>
              </div>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-5 pt-5 sm:gap-y-2.5">
              <Detail label="Registered Address">{org.profile.address}</Detail>
              <Detail label="Timezone">{org.profile.timezone}</Detail>
              <Detail label="System Language">{org.profile.language}</Detail>
              <div className="hidden basis-full sm:block" aria-hidden="true" />
              <Detail label="System Currency">{org.profile.currency}</Detail>
              <Detail label="Date Format">{org.profile.dateFormat}</Detail>
            </dl>
          </Card>

          <Card
            title="Branches"
            badge={
              <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs font-medium">
                {activeBranches} Active
              </span>
            }
            action={
              <button type="button" onClick={() => setDialog('branch')} className={outlineButton}>
                <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
                Add Branch
              </button>
            }
          >
            <div className="border-line overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[30rem] table-fixed text-left text-sm">
                <thead className="bg-sunken border-line border-b">
                  <tr className="text-ink text-xs font-medium">
                    <th scope="col" className="w-[26%] px-4 py-2.5 font-medium">Name</th>
                    <th scope="col" className="w-[30%] px-2 py-2.5 font-medium">Address</th>
                    <th scope="col" className="w-[28%] px-2 py-2.5 font-medium">Manager</th>
                    <th scope="col" className="w-[16%] px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {org.branches.map((b) => (
                    <tr key={b.id}>
                      <th scope="row" className="text-ink truncate px-4 py-3.5 font-semibold">{b.name}</th>
                      <td className="text-ink-muted truncate px-2 py-3.5" title={b.address}>{b.address}</td>
                      <td className="text-ink truncate px-2 py-3.5">{b.manager}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            b.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {b.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Business Hours"
            action={
              <button type="button" onClick={() => setDialog('schedule')} className={outlineButton}>
                <CalendarDays className="size-4" strokeWidth={2} aria-hidden="true" />
                Edit Schedule
              </button>
            }
          >
            <ul className="divide-line divide-y">
              {org.hours.map((h) => (
                <li key={h.day} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <Toggle
                    leading
                    solidOff
                    label={h.day}
                    checked={h.open}
                    onChange={(v) => setDayOpen(h.day, v)}
                    labelClassName={cn('font-medium', !h.open && 'text-ink-muted')}
                  />
                  <span className={cn('text-sm whitespace-nowrap', h.open ? 'text-ink-muted' : 'text-ink-subtle')}>
                    {h.open ? `${formatHour(h.start)} - ${formatHour(h.end)}` : 'Closed (Off)'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Emergency Contacts"
            action={
              <button type="button" onClick={() => setDialog('contact')} className={outlineButton}>
                <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
                Add
              </button>
            }
          >
            <ul className="space-y-3">
              {org.contacts.map((c) => {
                const Icon = contactIcon[c.kind]
                return (
                  <li key={c.id} className="border-line flex items-center gap-3 rounded-lg border p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                      <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-ink truncate text-sm font-semibold">{c.name}</p>
                      <p className="text-ink-muted truncate text-xs">
                        {c.role} • {c.phone}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Drawer open={dialog === 'profile'} onClose={close} title="Edit profile" placement="center">
        <ProfileForm profile={org.profile} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'schedule'} onClose={close} title="Edit schedule" placement="center">
        <ScheduleForm hours={org.hours} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'branch'} onClose={close} title="Add Branch">
        <BranchForm onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'contact'} onClose={close} title="Add emergency contact" placement="center">
        <ContactForm onDone={close} />
      </Drawer>
    </div>
  )
}

/* ---------------------------------- forms ---------------------------------- */
/* Each holds a local draft; nothing changes until Save. The Drawer unmounts its
   children when closed, so a reopened form starts from the saved values. */

function Text({
  label,
  value,
  onChange,
  type = 'text',
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  error?: string | false
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(fieldClass, error && 'border-red-500')}
      />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-medium">{label}</span>
      <SelectBox value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </SelectBox>
    </label>
  )
}

function Actions({ onCancel, disabled, label = 'Save' }: { onCancel: () => void; disabled: boolean; label?: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
      >
        {label}
      </button>
    </div>
  )
}

function ProfileForm({ profile, onDone }: { profile: OrgProfile; onDone: () => void }) {
  const [draft, setDraft] = useState(profile)
  const set = (patch: Partial<OrgProfile>) => setDraft((d) => ({ ...d, ...patch }))
  const valid = Boolean(draft.name.trim() && draft.registration.trim() && draft.address.trim())

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        updateProfile({
          ...draft,
          name: draft.name.trim(),
          registration: draft.registration.trim(),
          address: draft.address.trim(),
        })
        onDone()
      }}
    >
      <Text label="Organization name" value={draft.name} onChange={(name) => set({ name })} error={!draft.name.trim() && 'Enter the registered name.'} />
      <Text label="Business registration number" value={draft.registration} onChange={(registration) => set({ registration })} error={!draft.registration.trim() && 'Enter the registration number.'} />
      <label className="block">
        <span className="text-ink text-sm font-medium">Registered address</span>
        <textarea
          rows={3}
          value={draft.address}
          onChange={(e) => set({ address: e.target.value })}
          aria-invalid={draft.address.trim() ? undefined : true}
          className={cn(fieldClass, 'h-auto py-2', !draft.address.trim() && 'border-red-500')}
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Timezone" value={draft.timezone} options={timezoneOptions} onChange={(timezone) => set({ timezone })} />
        <Select label="System language" value={draft.language} options={languageOptions} onChange={(language) => set({ language })} />
        <Select label="System currency" value={draft.currency} options={currencyOptions} onChange={(currency) => set({ currency })} />
        <Select label="Date format" value={draft.dateFormat} options={dateFormatOptions} onChange={(dateFormat) => set({ dateFormat })} />
      </div>
      <Actions onCancel={onDone} disabled={!valid} />
    </form>
  )
}

function ScheduleForm({ hours, onDone }: { hours: OrgDayHours[]; onDone: () => void }) {
  const [draft, setDraft] = useState(hours)
  const setDay = (day: string, patch: Partial<OrgDayHours>) =>
    setDraft((d) => d.map((h) => (h.day === day ? { ...h, ...patch } : h)))
  const valid = draft.every(validHours)
  const timeClass = 'border-control focus:border-brand-500 bg-surface h-9 rounded-lg border px-2 text-sm disabled:opacity-50'

  return (
    <form
      className="p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setHours(draft)
        onDone()
      }}
    >
      <ul className="divide-line divide-y">
        {draft.map((h) => {
          const ok = validHours(h)
          return (
            <li key={h.day} className="py-2.5 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <Toggle
                  leading
                  solidOff
                  label={h.day}
                  checked={h.open}
                  onChange={(open) => setDay(h.day, { open })}
                  labelClassName="font-medium"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label={`${h.day} opens`}
                    value={h.start}
                    disabled={!h.open}
                    onChange={(e) => setDay(h.day, { start: e.target.value })}
                    className={cn(timeClass, !ok && 'border-red-500')}
                  />
                  <span className="text-ink-subtle text-sm">to</span>
                  <input
                    type="time"
                    aria-label={`${h.day} closes`}
                    value={h.end}
                    disabled={!h.open}
                    onChange={(e) => setDay(h.day, { end: e.target.value })}
                    className={cn(timeClass, !ok && 'border-red-500')}
                  />
                </div>
              </div>
              {!ok && <p className="mt-1 text-right text-xs text-red-700">Closing time must be after opening time.</p>}
            </li>
          )
        })}
      </ul>
      <div className="pt-3">
        <Actions onCancel={onDone} disabled={!valid} />
      </div>
    </form>
  )
}

function BranchForm({ onDone }: { onDone: () => void }) {
  const { users } = useUsers()
  const [name, setName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('Lagos')
  const [phone, setPhone] = useState('')
  const [manager, setManager] = useState('')
  const [hours, setBranchHours] = useState(defaultBranchHours)
  const setDay = (day: string, patch: Partial<OrgDayHours>) =>
    setBranchHours((d) => d.map((h) => (h.day === day ? { ...h, ...patch } : h)))

  // The manager is picked from the accounts on Users & Permissions; typing
  // narrows the list, and only a name on it is accepted.
  const managerUser = users.find((u) => u.name.toLowerCase() === manager.trim().toLowerCase())
  const managerError = manager.trim() !== '' && !managerUser && 'Choose a user from the list.'
  const phoneError = phone !== '' && !validPhone(phone) && 'Enter a phone number of 7 to 15 digits.'
  const valid =
    Boolean(name.trim() && line1.trim() && city.trim() && managerUser) &&
    validPhone(phone) &&
    hours.every(validHours)
  const label = 'text-ink text-sm font-semibold'
  const timeClass =
    'border-control focus:border-brand-500 bg-surface h-8 min-w-0 flex-1 rounded-md border px-2 text-xs'

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || !managerUser) return
        addBranch({
          name: name.trim(),
          address: [line1.trim(), line2.trim()].filter(Boolean).join(', '),
          manager: managerUser.name,
          active: true,
          city: city.trim(),
          state,
          phone: phone.trim(),
          hours,
        })
        onDone()
      }}
    >
      <div className="flex-1 space-y-4 p-5">
        <label className="block">
          <span className={label}>Branch Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ikeja Mainland" autoComplete="off" className={fieldClass} />
        </label>
        <label className="block">
          <span className={label}>Address Line 1</span>
          <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="e.g. 24 Allen Avenue" autoComplete="off" className={fieldClass} />
        </label>
        <label className="block">
          <span className={label}>
            Address Line 2 <span className="text-ink-subtle text-xs font-normal">(Optional)</span>
          </span>
          <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="e.g. Suite 3B, 2nd Floor" autoComplete="off" className={fieldClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ikeja" autoComplete="off" className={fieldClass} />
          </label>
          <label className="block">
            <span className={label}>State</span>
            <SelectBox value={state} onChange={(e) => setState(e.target.value)} className={fieldClass}>
              {nigerianStates.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </SelectBox>
          </label>
          <label className="block">
            <span className={label}>Phone Number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08012345678"
              autoComplete="off"
              aria-invalid={phoneError ? true : undefined}
              className={cn(fieldClass, phoneError && 'border-red-500')}
            />
            {phoneError && <span className="mt-1 block text-xs text-red-700">{phoneError}</span>}
          </label>
          <label className="block">
            <span className={label}>Branch Manager</span>
            <input
              list="branch-manager-options"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              placeholder="Search users"
              autoComplete="off"
              aria-invalid={managerError ? true : undefined}
              className={cn(fieldClass, managerError && 'border-red-500')}
            />
            <datalist id="branch-manager-options">
              {users.filter((u) => u.active).map((u) => (
                <option key={u.id} value={u.name}>
                  {u.role} · {u.branch}
                </option>
              ))}
            </datalist>
            {managerError && <span className="mt-1 block text-xs text-red-700">{managerError}</span>}
          </label>
        </div>

        <fieldset className="pt-2">
          <legend className="text-ink text-xs font-bold tracking-wide uppercase">Operating Hours</legend>
          <ul className="mt-2.5 space-y-2">
            {hours.map((h) => {
              const ok = validHours(h)
              const short = h.day.slice(0, 3)
              return (
                <li key={h.day}>
                  <div className="flex min-h-8 items-center gap-3">
                    <Toggle
                      leading
                      solidOff
                      label={<abbr title={h.day} className="no-underline">{short}</abbr>}
                      checked={h.open}
                      onChange={(open) => setDay(h.day, { open })}
                      className="w-24 shrink-0"
                      labelClassName={cn('font-medium', !h.open && 'text-ink-subtle')}
                    />
                    {h.open ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          type="time"
                          aria-label={`${h.day} opens`}
                          value={h.start}
                          onChange={(e) => setDay(h.day, { start: e.target.value })}
                          className={cn(timeClass, !ok && 'border-red-500')}
                        />
                        <span className="text-ink-subtle text-xs">to</span>
                        <input
                          type="time"
                          aria-label={`${h.day} closes`}
                          value={h.end}
                          onChange={(e) => setDay(h.day, { end: e.target.value })}
                          className={cn(timeClass, !ok && 'border-red-500')}
                        />
                      </div>
                    ) : (
                      <span className="text-ink-subtle pl-1 text-xs">Closed all day</span>
                    )}
                  </div>
                  {!ok && <p className="mt-1 text-right text-xs text-red-700">Closing time must be after opening time.</p>}
                </li>
              )
            })}
          </ul>
        </fieldset>
      </div>
      <div className="border-line bg-surface sticky bottom-0 flex items-center justify-between gap-2 border-t p-5">
        <button
          type="button"
          onClick={onDone}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Save Branch
        </button>
      </div>
    </form>
  )
}

function ContactForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [kind, setKind] = useState<ContactKind>('medical')
  const phoneOk = validPhone(phone)
  const valid = Boolean(name.trim() && role.trim() && phoneOk)

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        addContact({ name: name.trim(), role: role.trim(), phone: phone.trim(), kind })
        onDone()
      }}
    >
      <Text label="Name" value={name} onChange={setName} />
      <Text label="Role" value={role} onChange={setRole} />
      <Text
        label="Phone number"
        type="tel"
        value={phone}
        onChange={setPhone}
        error={phone !== '' && !phoneOk && 'Enter a phone number of 7 to 15 digits.'}
      />
      <label className="block">
        <span className="text-ink text-sm font-medium">Contact type</span>
        <SelectBox value={kind} onChange={(e) => setKind(e.target.value as ContactKind)} className={fieldClass}>
          <option value="medical">Medical / on-call</option>
          <option value="security">Security</option>
        </SelectBox>
      </label>
      <Actions onCancel={onDone} disabled={!valid} label="Add Contact" />
    </form>
  )
}
