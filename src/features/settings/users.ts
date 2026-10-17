/**
 * Users & Permissions — the accounts that can sign in, and the invitations
 * still waiting to be accepted.
 *
 * Content follows the Figma settings-users-permissions screen as drawn: these
 * eight accounts, their roles, branches and "last active" wording. They are
 * not joined to the caregiver roster, which has its own people.
 *
 * Held in memory for the session, like every other settings store in the app.
 */
import { useSyncExternalStore } from 'react'

/** A role's name. A string, not a union: roles can be created at runtime. */
export type Role = string

export const modules = ['Dashboard', 'Care Recipients', 'Scheduling', 'Billing', 'Messages', 'Reports', 'Settings'] as const
export type Module = (typeof modules)[number]

export const actions = [
  { id: 'view', short: 'View', label: 'View' },
  { id: 'create', short: 'Crt', label: 'Create' },
  { id: 'edit', short: 'Edt', label: 'Edit' },
  { id: 'delete', short: 'Del', label: 'Delete' },
] as const
export type Action = (typeof actions)[number]['id']

export type Permissions = Record<Module, Action[]>

export interface RoleDef {
  name: Role
  description: string
  permissions: Permissions
  builtIn: boolean
}

/** One letter per action — "vce" is view, create, edit — in module order. */
function grid(...rows: string[]): Permissions {
  const key: Record<string, Action> = { v: 'view', c: 'create', e: 'edit', d: 'delete' }
  return Object.fromEntries(
    modules.map((m, i) => [m, [...(rows[i] ?? '')].map((ch) => key[ch])]),
  ) as Permissions
}

/*
 * Coordinator's grid is the one the Figma create-role drawer draws under
 * "Copy from Coordinator". The other four are not drawn anywhere and are
 * filled in here so every template has something to copy.
 */
const builtIn = (name: string, description: string, permissions: Permissions): RoleDef => ({
  name,
  description,
  permissions,
  builtIn: true,
})

export const userBranches = ['Lagos HQ', 'Abuja', 'Port Harcourt'] as const
export type UserBranch = (typeof userBranches)[number]

export interface UserAccount {
  id: string
  name: string
  email: string
  role: Role
  branch: UserBranch
  active: boolean
  /** As the design words it: "Today", "Yesterday", "Jul 17". */
  lastActive: string
}

export const departments = ['Care Coordination', 'Clinical', 'Operations', 'Finance', 'Human Resources'] as const

export interface Invitation {
  id: string
  name: string
  email: string
  /** National number without the +234 prefix, digits only. */
  phone: string
  role: Role
  branch: UserBranch
  /** Empty when none was chosen. */
  department: string
  sendWelcome: boolean
}

interface UsersState {
  users: UserAccount[]
  invitations: Invitation[]
  roles: RoleDef[]
}

const user = (
  name: string,
  role: Role,
  branch: UserBranch,
  lastActive: string,
  active = true,
): UserAccount => {
  const first = name.split(' ')[0].toLowerCase()
  return { id: first, name, email: `${first}@careprofs.ng`, role, branch, active, lastActive }
}

const state: UsersState = {
  users: [
    user('Adaeze Okonkwo', 'Administrator', 'Lagos HQ', 'Today'),
    user('Ibrahim Musa', 'Coordinator', 'Abuja', 'Yesterday'),
    user('Chidinma Eze', 'Coordinator', 'Port Harcourt', 'Jul 17'),
    user('Amina Bello', 'Caregiver', 'Lagos HQ', 'Today'),
    user('Taiwo Ogunleye', 'Scheduler', 'Lagos HQ', 'Jul 18'),
    user('Ngozi Ibe', 'Finance', 'Lagos HQ', 'Jul 16'),
    user('Emeka Nwosu', 'Caregiver', 'Abuja', 'Jul 10', false),
    user('Blessing Okafor', 'Caregiver', 'Port Harcourt', 'Jul 18'),
  ],
  invitations: [],
  roles: [
    builtIn('Administrator', 'Full access to every module and setting', grid('vced', 'vced', 'vced', 'vced', 'vced', 'vced', 'vced')),
    builtIn('Coordinator', 'Runs day-to-day care delivery for a branch', grid('v', 'vced', 'vce', 'vc', 'v', 'v', 've')),
    builtIn('Scheduler', 'Builds and maintains the visit rota', grid('v', 'v', 'vced', '', 'v', 'v', '')),
    builtIn('Finance', 'Manages invoices, payments and financial reports', grid('v', 'v', '', 'vced', 'v', 'v', '')),
    builtIn('Caregiver', 'Delivers visits and records care notes', grid('v', 'v', 'v', '', 'v', '', '')),
  ],
}

let revision = 0
const listeners = new Set<() => void>()

function emit(): void {
  revision += 1
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUsers(): UsersState {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return state
}

export function updateUser(id: string, patch: Partial<Pick<UserAccount, 'role' | 'branch' | 'active'>>): void {
  state.users = state.users.map((u) => (u.id === id ? { ...u, ...patch } : u))
  emit()
}

let seq = 0

export function invite(invitation: Omit<Invitation, 'id'>): void {
  seq += 1
  state.invitations = [...state.invitations, { ...invitation, id: `invite-${seq}` }]
  emit()
}

export function cancelInvitation(id: string): void {
  state.invitations = state.invitations.filter((i) => i.id !== id)
  emit()
}

export function roleNameTaken(name: string): boolean {
  const n = name.trim().toLowerCase()
  return state.roles.some((r) => r.name.toLowerCase() === n)
}

export function createRole(role: Omit<RoleDef, 'builtIn'>): void {
  state.roles = [...state.roles, { ...role, builtIn: false }]
  emit()
}

/**
 * One tick, with the rule that makes the grid coherent: anything beyond View
 * needs View, so ticking Create turns View on and unticking View clears the row.
 */
export function togglePermission(p: Permissions, module: Module, action: Action, on: boolean): Permissions {
  const current = new Set(p[module])
  if (on) {
    current.add(action)
    current.add('view')
  } else if (action === 'view') {
    current.clear()
  } else {
    current.delete(action)
  }
  return { ...p, [module]: actions.map((a) => a.id).filter((a) => current.has(a)) }
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Ten digits after +234, spaces allowed, e.g. "801 234 5678". */
export function validPhone(phone: string): boolean {
  return /^[1-9]\d{9}$/.test(phone.replace(/\s/g, ''))
}

/** Already an account, or already invited. */
export function emailTaken(email: string): boolean {
  const e = email.trim().toLowerCase()
  return (
    state.users.some((u) => u.email.toLowerCase() === e) ||
    state.invitations.some((i) => i.email.toLowerCase() === e)
  )
}
