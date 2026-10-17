import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Construction, Plus, Search, UserPlus } from 'lucide-react'
import {
  actions,
  cancelInvitation,
  createRole,
  departments,
  emailTaken,
  invite,
  modules,
  roleNameTaken,
  togglePermission,
  updateUser,
  userBranches,
  useUsers,
  validEmail,
  validPhone,
} from '@/features/settings/users'
import type { Permissions, Role, RoleDef, UserAccount, UserBranch } from '@/features/settings/users'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const tabs = [
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'invitations', label: 'Invitations' },
] as const
type TabId = (typeof tabs)[number]['id']

const ALL = 'all'
const withAll = (values: readonly string[]) => [
  { value: ALL, label: 'All' },
  ...values.map((v) => ({ value: v, label: v })),
]
const statusOptions = [
  { value: ALL, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'
const th = 'px-3 py-2.5 text-xs font-medium whitespace-nowrap'
const td = 'px-3 py-3 whitespace-nowrap'

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function UsersPermissionsSettingsPage() {
  const { users, invitations, roles: roleDefs } = useUsers()
  const roles = roleDefs.map((r) => r.name)
  const [params, setParams] = useSearchParams()
  const tab: TabId = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'users'

  const [query, setQuery] = useState('')
  const [role, setRole] = useState(ALL)
  const [branch, setBranch] = useState(ALL)
  /*
   * The design's chip reads "Status: Active" above a table that includes an
   * inactive account. Both cannot be true, so this starts on All and shows the
   * eight rows as drawn.
   */
  const [status, setStatus] = useState(ALL)
  const [inviting, setInviting] = useState(false)
  const [creatingRole, setCreatingRole] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = users.find((u) => u.id === editingId)

  const q = query.trim().toLowerCase()
  const rows = users.filter(
    (u) =>
      (q === '' || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (role === ALL || u.role === role) &&
      (branch === ALL || u.branch === branch) &&
      (status === ALL || u.active === (status === 'active')),
  )

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">Users &amp; Permissions</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Manage care coordinators, schedulers, admins, and caregiver accounts
        </p>
      </header>

      <nav aria-label="Users and permissions sections" className="border-line no-scrollbar flex gap-6 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => setParams(t.id === 'users' ? {} : { tab: t.id }, { replace: true })}
            className={cn(
              '-mb-px border-b-2 pb-2.5 text-sm whitespace-nowrap transition-colors',
              t.id === tab
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'text-ink-muted hover:text-ink border-transparent',
            )}
          >
            {t.label}
            {t.id === 'invitations' && invitations.length > 0 && (
              <span className="bg-brand-50 text-brand-700 ml-1.5 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold">
                {invitations.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'users' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-60">
              <Search
                className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search users"
                placeholder="Search users..."
                className="border-control bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 h-11 w-full rounded-lg border pr-3 pl-9 text-sm sm:h-9.5"
              />
            </div>
            <SelectFilter chip label="Role" value={role} onChange={setRole} options={withAll(roles)} className="bg-surface rounded-lg" />
            <SelectFilter chip label="Branch" value={branch} onChange={setBranch} options={withAll(userBranches)} className="bg-surface rounded-lg" />
            <SelectFilter chip label="Status" value={status} onChange={setStatus} options={statusOptions} className="bg-surface rounded-lg" />
            <button
              type="button"
              onClick={() => setInviting(true)}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors sm:ml-auto sm:h-9.5"
            >
              <UserPlus className="size-4" strokeWidth={2.2} aria-hidden="true" />
              Invite User
            </button>
          </div>

          <section aria-label="Users" className="card p-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead>
                  <tr className="bg-sunken text-ink">
                    <th scope="col" className={cn(th, 'rounded-l-lg pl-4')}>Full Name</th>
                    <th scope="col" className={th}>Email</th>
                    <th scope="col" className={th}>Role</th>
                    <th scope="col" className={th}>Branch</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}>Last Active</th>
                    <th scope="col" className={cn(th, 'rounded-r-lg pr-4 text-center')}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <th scope="row" className={cn(td, 'pl-4 font-semibold')}>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={u.name} decorative className="size-8" />
                          <span className="text-ink">{u.name}</span>
                        </span>
                      </th>
                      <td className={cn(td, 'text-ink-muted')}>{u.email}</td>
                      <td className={cn(td, 'text-ink')}>{u.role}</td>
                      <td className={cn(td, 'text-ink-muted')}>{u.branch}</td>
                      <td className={td}><StatusPill active={u.active} /></td>
                      <td className={cn(td, 'text-ink-muted')}>{u.lastActive}</td>
                      <td className={cn(td, 'pr-4 text-center')}>
                        <span className="inline-flex">
                          <DropdownMenu
                            label={`Actions for ${u.name}`}
                            items={[
                              { id: 'edit', label: 'Edit role & branch', onSelect: () => setEditingId(u.id) },
                              u.active
                                ? { id: 'deactivate', label: 'Deactivate', destructive: true, onSelect: () => updateUser(u.id, { active: false }) }
                                : { id: 'reactivate', label: 'Reactivate', onSelect: () => updateUser(u.id, { active: true }) },
                            ]}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <p className="text-ink-muted px-4 py-10 text-center text-sm">No users match these filters.</p>
            )}
          </section>
        </>
      )}

      {tab === 'invitations' && (
        <section aria-label="Pending invitations" className="card p-3">
          {invitations.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-ink text-sm font-semibold">No pending invitations</p>
              <p className="text-ink-muted mt-1 text-sm">People you invite appear here until they accept.</p>
              <button
                type="button"
                onClick={() => setInviting(true)}
                className="border-control text-ink hover:bg-sunken mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
              >
                <UserPlus className="size-4" strokeWidth={2} aria-hidden="true" />
                Invite User
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="bg-sunken text-ink">
                    <th scope="col" className={cn(th, 'rounded-l-lg pl-4')}>Full Name</th>
                    <th scope="col" className={th}>Email</th>
                    <th scope="col" className={th}>Role</th>
                    <th scope="col" className={th}>Branch</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={cn(th, 'rounded-r-lg pr-4')}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {invitations.map((i) => (
                    <tr key={i.id}>
                      <th scope="row" className={cn(td, 'text-ink pl-4 font-semibold')}>{i.name}</th>
                      <td className={cn(td, 'text-ink-muted')}>{i.email}</td>
                      <td className={cn(td, 'text-ink')}>{i.role}</td>
                      <td className={cn(td, 'text-ink-muted')}>{i.branch}</td>
                      <td className={td}>
                        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
                      </td>
                      <td className={cn(td, 'pr-4 text-right')}>
                        <button
                          type="button"
                          onClick={() => cancelInvitation(i.id)}
                          aria-label={`Cancel invitation for ${i.name}`}
                          className="text-sm font-medium text-red-700 hover:underline"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'roles' && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCreatingRole(true)}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors sm:h-9.5"
            >
              <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
              Create Role
            </button>
          </div>
          <section aria-label="Roles" className="card p-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="bg-sunken text-ink">
                    <th scope="col" className={cn(th, 'rounded-l-lg pl-4')}>Role</th>
                    <th scope="col" className={th}>Description</th>
                    <th scope="col" className={th}>Users</th>
                    <th scope="col" className={cn(th, 'rounded-r-lg pr-4')}>Type</th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {roleDefs.map((r) => (
                    <tr key={r.name}>
                      <th scope="row" className={cn(td, 'text-ink pl-4 font-semibold')}>{r.name}</th>
                      <td className="text-ink-muted px-3 py-3">{r.description || '—'}</td>
                      <td className={cn(td, 'text-ink')}>{users.filter((u) => u.role === r.name).length}</td>
                      <td className={cn(td, 'text-ink-muted pr-4')}>{r.builtIn ? 'Built-in' : 'Custom'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'permissions' && (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
            <Construction className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <p className="text-ink mt-3 text-sm font-semibold">Not built yet</p>
          <p className="text-ink-muted mt-1 max-w-sm text-sm">This tab is waiting on its design.</p>
        </div>
      )}

      <Drawer open={inviting} onClose={() => setInviting(false)} title="Invite User">
        <InviteForm
          roles={roles}
          onDone={(sent) => {
            setInviting(false)
            if (sent) setParams({ tab: 'invitations' }, { replace: true })
          }}
        />
      </Drawer>
      <Drawer open={creatingRole} onClose={() => setCreatingRole(false)} title="Create Role">
        <RoleForm roles={roleDefs} onDone={() => setCreatingRole(false)} />
      </Drawer>
      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title="Edit user"
        subtitle={editing?.name}
        placement="center"
      >
        {editing && <EditForm key={editing.id} user={editing} roles={roles} onDone={() => setEditingId(null)} />}
      </Drawer>
    </div>
  )
}

/* ---------------------------------- forms ---------------------------------- */

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-semibold">{label}</span>
      <SelectBox value={value} onChange={(e) => onChange(e.target.value as T)} className={fieldClass}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </SelectBox>
    </label>
  )
}

function Actions({ onCancel, disabled, label }: { onCancel: () => void; disabled?: boolean; label: string }) {
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

function InviteForm({ roles, onDone }: { roles: Role[]; onDone: (sent: boolean) => void }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>('Coordinator')
  const [branch, setBranch] = useState<UserBranch>('Lagos HQ')
  const [department, setDepartment] = useState('')
  const [sendWelcome, setSendWelcome] = useState(true)
  const emailError =
    email === '' ? null : !validEmail(email) ? 'Enter a valid email address.' : emailTaken(email) ? 'This email already has an account or invitation.' : null
  const phoneError = phone !== '' && !validPhone(phone) ? 'Enter the 10 digits after +234.' : null
  const valid =
    first.trim() !== '' && last.trim() !== '' && email !== '' && !emailError && phone !== '' && !phoneError
  const label = 'text-ink text-sm font-semibold'

  return (
    // Fills the drawer so the buttons sit at its foot, as drawn, and stay
    // there while a short screen scrolls the fields.
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        invite({
          name: `${first.trim()} ${last.trim()}`,
          email: email.trim(),
          phone: phone.replace(/\s/g, ''),
          role,
          branch,
          department,
          sendWelcome,
        })
        onDone(true)
      }}
    >
      <div className="flex-1 space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>First Name</span>
            <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="e.g. Sarah" autoComplete="off" className={fieldClass} />
          </label>
          <label className="block">
            <span className={label}>Last Name</span>
            <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="e.g. Jenkins" autoComplete="off" className={fieldClass} />
          </label>
        </div>
        <label className="block">
          <span className={label}>Email Address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. sarah@careprofs.com"
            autoComplete="off"
            aria-invalid={emailError ? true : undefined}
            className={cn(fieldClass, emailError && 'border-red-500')}
          />
          {emailError && <span className="mt-1 block text-xs text-red-700">{emailError}</span>}
        </label>
        <label className="block">
          <span className={label}>Phone Number</span>
          <span
            className={cn(
              'border-control focus-within:border-brand-500 bg-surface mt-1.5 flex h-10 items-center rounded-lg border px-3 text-sm',
              phoneError && 'border-red-500',
            )}
          >
            <span className="text-ink border-line border-r pr-2">+234</span>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="801 234 5678"
              autoComplete="off"
              aria-invalid={phoneError ? true : undefined}
              className="h-full min-w-0 flex-1 bg-transparent pl-2 outline-none"
            />
          </span>
          {phoneError && <span className="mt-1 block text-xs text-red-700">{phoneError}</span>}
        </label>
        <Choice label="Role" value={role} options={roles} onChange={setRole} />
        <Choice label="Branch" value={branch} options={userBranches} onChange={setBranch} />
        <label className="block">
          <span className={label}>
            Department <span className="text-ink-subtle text-xs font-normal">(Optional)</span>
          </span>
          <SelectBox
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={cn(fieldClass, department === '' && 'text-ink-subtle')}
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </SelectBox>
        </label>
        <label className="text-ink flex items-center gap-2.5 pt-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={sendWelcome}
            onChange={(e) => setSendWelcome(e.target.checked)}
            className="accent-brand-600 size-4"
          />
          Send welcome email with credentials
        </label>
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
          disabled={!valid}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Send Invitation
        </button>
      </div>
    </form>
  )
}

function EditForm({ user, roles, onDone }: { user: UserAccount; roles: Role[]; onDone: () => void }) {
  const [role, setRole] = useState(user.role)
  const [branch, setBranch] = useState(user.branch)
  const [active, setActive] = useState(user.active)

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        updateUser(user.id, { role, branch, active })
        onDone()
      }}
    >
      <p className="text-ink-muted text-sm">{user.email}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Choice label="Role" value={role} options={roles} onChange={setRole} />
        <Choice label="Branch" value={branch} options={userBranches} onChange={setBranch} />
      </div>
      <Toggle
        label="Active"
        hint={active ? 'Can sign in.' : 'Cannot sign in; the account is kept.'}
        checked={active}
        onChange={setActive}
        labelClassName="font-medium"
      />
      <Actions onCancel={onDone} label="Save" />
    </form>
  )
}

function RoleForm({ roles, onDone }: { roles: RoleDef[]; onDone: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [base, setBase] = useState<Role>('Coordinator')
  const [permissions, setPermissions] = useState<Permissions>(
    () => (roles.find((r) => r.name === 'Coordinator') ?? roles[0]).permissions,
  )
  const taken = name.trim() !== '' && roleNameTaken(name)
  const valid = name.trim() !== '' && !taken
  const label = 'text-ink text-sm font-semibold'

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        createRole({ name: name.trim(), description: description.trim(), permissions })
        onDone()
      }}
    >
      <div className="flex-1 space-y-4 p-5">
        <label className="block">
          <span className={label}>Role Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Clinical Coordinator"
            maxLength={40}
            autoComplete="off"
            aria-invalid={taken ? true : undefined}
            className={cn(fieldClass, taken && 'border-red-500')}
          />
          {taken && <span className="mt-1 block text-xs text-red-700">A role with this name already exists.</span>}
        </label>
        <label className="block">
          <span className={label}>Description</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the primary responsibilities and access level of this role..."
            maxLength={160}
            className={cn(fieldClass, 'h-auto py-2')}
          />
        </label>
        <label className="block">
          <span className={label}>Base Template</span>
          {/* Picking a template replaces the grid below with that role's. */}
          <SelectBox
            value={base}
            onChange={(e) => {
              setBase(e.target.value)
              const from = roles.find((r) => r.name === e.target.value)
              if (from) setPermissions(from.permissions)
            }}
            className={fieldClass}
          >
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                Copy from {r.name}
              </option>
            ))}
          </SelectBox>
        </label>

        <div className="pt-2">
          <h3 className="text-ink text-xs font-bold tracking-wide uppercase">Module Permissions</h3>
          <div className="border-line mt-2.5 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas border-line border-b">
                <tr className="text-ink-muted text-xs">
                  <th scope="col" className="px-3 py-2 font-medium">Module</th>
                  {actions.map((a) => (
                    <th key={a.id} scope="col" className="w-11 py-2 text-center font-medium">
                      <abbr title={a.label} className="no-underline">{a.short}</abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {modules.map((m) => (
                  <tr key={m}>
                    <th scope="row" className="text-ink px-3 py-2 font-normal">{m}</th>
                    {actions.map((a) => (
                      <td key={a.id} className="py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${a.label} ${m}`}
                          checked={permissions[m].includes(a.id)}
                          onChange={(e) => setPermissions((p) => togglePermission(p, m, a.id, e.target.checked))}
                          className="accent-brand-600 size-4 align-middle"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          Create Role
        </button>
      </div>
    </form>
  )
}
