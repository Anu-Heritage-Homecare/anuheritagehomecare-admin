/**
 * Users & Permissions — live from the back office admin access API.
 *
 * `useUsers()` keeps returning a plain `{ users, invitations, roles }` so the
 * Organization page (which consumes it directly) keeps working; it falls back to
 * empty collections while loading. The page here reads loading/error through the
 * per tab query hooks (`useUsersQuery`, `useRolesQuery`, `useInvitationsQuery`).
 *
 * The backend permission keys are `<module>.<action>` over the same seven modules
 * and four actions the grid draws, so the catalog maps onto the grid one for one;
 * no key is dropped. Roles carry their id for writes, resolved by name from the
 * roles list. Branch ids are resolved from whatever users already carry a branch;
 * a branch the loaded users never reference cannot be resolved and is skipped on
 * write (noted at each call site).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

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
  /** The backend role id, used for writes. Empty for a role not yet persisted. */
  id: string
  name: Role
  description: string
  permissions: Permissions
  builtIn: boolean
  /** How many accounts hold the role, as counted by the backend. */
  userCount: number
}

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
  /** National number without the +234 prefix, digits only, when present. */
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

/* --------------------------- backend response ----------------------------- */

interface AdminUserDto {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  roleId: string | null
  roleName: string | null
  branchId: string | null
  branchName: string | null
  status: string
  lastActiveAt: string | null
  photoKey: string | null
}

interface UsersScreenDto {
  users: AdminUserDto[]
  total: number
  page: number
  pageSize: number
}

interface RoleDto {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  permissionCount: number
  userCount: number
}

interface InvitationDto {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  phoneNumber: string | null
  department: string | null
  roleId: string
  branchId: string | null
  status: string
  expiresAt: string
  invitedByAdminId: string | null
  createdAt: string
}

/* -------------------------------- helpers --------------------------------- */

/** Backend module key to its UI Module label, by position in the shared order. */
const MODULE_BY_KEY: Record<string, Module> = {
  dashboard: 'Dashboard',
  care_recipients: 'Care Recipients',
  scheduling: 'Scheduling',
  billing: 'Billing',
  messages: 'Messages',
  reports: 'Reports',
  settings: 'Settings',
}
const KEY_BY_MODULE: Record<Module, string> = {
  Dashboard: 'dashboard',
  'Care Recipients': 'care_recipients',
  Scheduling: 'scheduling',
  Billing: 'billing',
  Messages: 'messages',
  Reports: 'reports',
  Settings: 'settings',
}
const ACTION_IDS = actions.map((a) => a.id)

/** An empty grid: every module present with no actions. */
function emptyPermissions(): Permissions {
  return Object.fromEntries(modules.map((m) => [m, [] as Action[]])) as Permissions
}

/** Backend permission keys (`module.action`) into the Module/Action grid. */
function toPermissions(keys: string[]): Permissions {
  const grid = emptyPermissions()
  for (const key of keys) {
    const [moduleKey, action] = key.split('.')
    const module = MODULE_BY_KEY[moduleKey]
    if (module && (ACTION_IDS as string[]).includes(action)) {
      grid[module].push(action as Action)
    }
  }
  // Keep each row in column order, however the backend ordered its keys.
  for (const m of modules) grid[m] = ACTION_IDS.filter((a) => grid[m].includes(a))
  return grid
}

/** The grid back to the backend permission-key array. */
export function toPermissionKeys(permissions: Permissions): string[] {
  return modules.flatMap((m) => permissions[m].map((a) => `${KEY_BY_MODULE[m]}.${a}`))
}

/** A branch name to a UI UserBranch when it matches, else the default branch. */
function toBranch(name: string | null): UserBranch {
  // A branch outside the three the UI draws falls back to the first; such a
  // branch cannot round trip through the UI union.
  return userBranches.find((b) => b === name) ?? userBranches[0]
}

/** "Today" / "Yesterday" / "Jul 17" from an ISO timestamp, or empty when never. */
function humanizeLastActive(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso)
  const today = new Date()
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(today) - startOf(then)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toUserAccount(dto: AdminUserDto): UserAccount {
  return {
    id: dto.id,
    name: dto.fullName || `${dto.firstName} ${dto.lastName}`.trim(),
    email: dto.email,
    role: dto.roleName ?? '',
    branch: toBranch(dto.branchName),
    active: dto.status === 'ACTIVE',
    lastActive: humanizeLastActive(dto.lastActiveAt),
  }
}

function toRoleDef(dto: RoleDto): RoleDef {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    permissions: toPermissions(dto.permissions),
    builtIn: dto.isSystem,
    userCount: dto.userCount,
  }
}

function toInvitation(dto: InvitationDto, roleName: (id: string) => string): Invitation {
  return {
    id: dto.id,
    name: dto.fullName || `${dto.firstName} ${dto.lastName}`.trim(),
    email: dto.email,
    phone: dto.phoneNumber ?? '',
    role: roleName(dto.roleId),
    branch: userBranches[0],
    department: dto.department ?? '',
    // The GET does not return the welcome-email choice; default true for display.
    sendWelcome: true,
  }
}

/* --------------------------------- queries -------------------------------- */

/** The raw users screen, cached once; the mapped list and branch map read it. */
function useUsersScreen() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<UsersScreenDto>('/admin/users?pageSize=100'),
  })
}

export function useUsersQuery() {
  const screen = useUsersScreen()
  return { ...screen, data: screen.data?.users.map(toUserAccount) }
}

/**
 * A branch name to branch id lookup, built from whatever branches the loaded
 * users reference. There is no branches list in this module, so a branch no user
 * sits in cannot be resolved; such a branch is skipped on write.
 */
export function useBranchId(): (name: string) => string | undefined {
  const screen = useUsersScreen()
  const byName = new Map<string, string>()
  for (const u of screen.data?.users ?? []) {
    if (u.branchName && u.branchId) byName.set(u.branchName, u.branchId)
  }
  return (name: string) => byName.get(name)
}

export function useRolesQuery() {
  return useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => (await api.get<RoleDto[]>('/admin/roles')).map(toRoleDef),
  })
}

export function useInvitationsQuery() {
  const roles = useRolesQuery()
  return useQuery({
    queryKey: ['admin', 'invitations'],
    queryFn: async () => {
      const dtos = await api.get<InvitationDto[]>('/admin/invitations?status=PENDING')
      const roleName = (id: string) => roles.data?.find((r) => r.id === id)?.name ?? ''
      return dtos.map((dto) => toInvitation(dto, roleName))
    },
    // Only resolve role names once the roles are loaded, so the join is honest.
    enabled: roles.isSuccess,
  })
}

/**
 * The combined store the Organization page consumes directly. Returns a plain
 * `{ users, invitations, roles }`, empty while loading, never a query result.
 */
export function useUsers(): UsersState {
  const users = useUsersQuery()
  const roles = useRolesQuery()
  const invitations = useInvitationsQuery()
  return {
    users: users.data ?? [],
    invitations: invitations.data ?? [],
    roles: roles.data ?? [],
  }
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidate() {
  const queryClient = useQueryClient()
  return (key: string) => queryClient.invalidateQueries({ queryKey: ['admin', key] })
}

export interface UpdateUserInput {
  id: string
  roleId?: string
  branchId?: string | null
  active?: boolean
}

export function useUpdateUser() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, roleId, branchId, active }: UpdateUserInput) =>
      api.patch(`/admin/users/${id}`, {
        roleId,
        branchId,
        status: active === undefined ? undefined : active ? 'ACTIVE' : 'SUSPENDED',
      }),
    onSuccess: async () => {
      await invalidate('users')
      await invalidate('roles')
    },
  })
}

export function useRemoveUser() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: async () => {
      await invalidate('users')
      await invalidate('roles')
    },
  })
}

export interface CreateRoleInput {
  name: string
  description: string
  baseRoleId?: string
  permissions: Permissions
}

export function useCreateRole() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ name, description, baseRoleId, permissions }: CreateRoleInput) =>
      api.post('/admin/roles', {
        name,
        description: description || undefined,
        baseRoleId,
        permissions: toPermissionKeys(permissions),
      }),
    onSuccess: async () => {
      await invalidate('roles')
      await invalidate('permissions')
    },
  })
}

export function useSetRolePermissions() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: Permissions }) =>
      api.put(`/admin/roles/${id}/permissions`, { permissions: toPermissionKeys(permissions) }),
    onSuccess: async () => {
      await invalidate('roles')
      await invalidate('permissions')
    },
  })
}

export function useDeleteRole() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: async () => {
      await invalidate('roles')
      await invalidate('permissions')
    },
  })
}

export interface InviteInput {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  roleId: string
  branchId?: string
  department: string
  sendWelcome: boolean
}

export function useInvite() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: InviteInput) =>
      api.post('/admin/invitations', {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber || undefined,
        department: input.department || undefined,
        roleId: input.roleId,
        branchId: input.branchId,
        sendWelcomeEmail: input.sendWelcome,
      }),
    onSuccess: async () => {
      await invalidate('invitations')
      await invalidate('users')
    },
  })
}

export function useResendInvitation() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/invitations/${id}/resend`),
    onSuccess: () => invalidate('invitations'),
  })
}

export function useRevokeInvitation() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/invitations/${id}/revoke`),
    onSuccess: () => invalidate('invitations'),
  })
}

/* ------------------------------ pure helpers ------------------------------ */

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
  return { ...p, [module]: ACTION_IDS.filter((a) => current.has(a)) }
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Ten digits after +234, spaces allowed, e.g. "801 234 5678". */
export function validPhone(phone: string): boolean {
  return /^[1-9]\d{9}$/.test(phone.replace(/\s/g, ''))
}

/** Taken against a loaded roles list (pure; pass the current roles). */
export function roleNameTaken(roles: RoleDef[], name: string): boolean {
  const n = name.trim().toLowerCase()
  return roles.some((r) => r.name.toLowerCase() === n)
}

/** Already an account, or already invited (pure; pass the loaded lists). */
export function emailTaken(users: UserAccount[], invitations: Invitation[], email: string): boolean {
  const e = email.trim().toLowerCase()
  return (
    users.some((u) => u.email.toLowerCase() === e) ||
    invitations.some((i) => i.email.toLowerCase() === e)
  )
}
