/**
 * Security settings — the password policy, multi-factor rules, session limits
 * and the recent sign-in history, read from and written to the back office.
 *
 * One read (`GET /admin/security`) powers the whole Security tab; the three
 * Edit actions PATCH their own section. The recent logins the screen shows come
 * from that same read; the paginated full history (`/admin/security/login-history`)
 * and the audit logs (`/admin/security/audit-logs`) are available on the backend
 * but the page renders no full-history or audit section, so they are not wired.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface PasswordPolicy {
  minLength: number
  uppercase: boolean
  numbers: boolean
  special: boolean
  expiryDays: number
  blockedPrevious: number
}

export const mfaStatuses = ['Enabled for all admins', 'Enabled for all users', 'Disabled'] as const
export type MfaStatus = (typeof mfaStatuses)[number]

/** In priority order: the first one allowed is the primary method. */
export const mfaMethodOptions = ['Authenticator App', 'SMS', 'Email'] as const
export const mfaRoleOptions = ['Administrator', 'Coordinator', 'Finance Managers', 'Scheduler', 'Caregiver'] as const

export interface MfaSettings {
  status: MfaStatus
  methods: string[]
  roles: string[]
}

export interface SessionSettings {
  timeoutMinutes: number
  maxConcurrent: number
  rememberDays: number
}

export interface LoginRecord {
  at: string
  operator: string
  ip: string
  device: string
  success: boolean
}

export interface SecuritySettings {
  password: PasswordPolicy
  mfa: MfaSettings
  session: SessionSettings
  logins: LoginRecord[]
}

/* --------------------------- backend response ----------------------------- */

interface PasswordPolicyDto {
  minLength: number
  requireUppercase: boolean
  requireNumber: boolean
  requireSpecialChar: boolean
  expiryDays: number
  historyBlocked: number
}

type MfaEnforcement = 'ENABLED_FOR_ALL' | 'OPTIONAL' | 'DISABLED'
type MfaMethod = 'AUTHENTICATOR' | 'SMS' | 'EMAIL'
type LoginEventOutcome = 'SUCCESS' | 'FAILED'

interface MfaConfigDto {
  enforcement: MfaEnforcement
  methods: MfaMethod[]
  enforcedRoles: string[]
}

interface SessionSettingsDto {
  timeoutMinutes: number
  maxConcurrentSessions: number
  rememberDeviceDays: number
}

interface LoginHistoryEntryDto {
  id: string
  email: string
  operatorName: string | null
  outcome: LoginEventOutcome
  ipAddress: string | null
  deviceLabel: string | null
  at: string
}

interface SecurityScreenDto {
  passwordPolicy: PasswordPolicyDto
  mfa: MfaConfigDto
  session: SessionSettingsDto
  recentLogins: LoginHistoryEntryDto[]
}

/* -------------------------------- enum maps -------------------------------- */

// The backend enforcement enum has no "users vs admins" split; the back office
// mandate is admin wide. "Enabled for all users" has no backend value, so it is
// not offered by the live mapping — ENABLED_FOR_ALL reads as the admins label.
const ENFORCEMENT_TO_STATUS: Record<MfaEnforcement, MfaStatus> = {
  ENABLED_FOR_ALL: 'Enabled for all admins',
  OPTIONAL: 'Disabled',
  DISABLED: 'Disabled',
}

function statusToEnforcement(status: MfaStatus): MfaEnforcement {
  return status === 'Disabled' ? 'DISABLED' : 'ENABLED_FOR_ALL'
}

const METHOD_TO_LABEL: Record<MfaMethod, string> = {
  AUTHENTICATOR: 'Authenticator App',
  SMS: 'SMS',
  EMAIL: 'Email',
}

const LABEL_TO_METHOD: Record<string, MfaMethod> = {
  'Authenticator App': 'AUTHENTICATOR',
  SMS: 'SMS',
  Email: 'EMAIL',
}

/* -------------------------------- helpers --------------------------------- */

/** An ISO timestamp to the "YYYY-MM-DD HH:MM" the login table shows. */
function formatStamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toView(dto: SecurityScreenDto): SecuritySettings {
  return {
    password: {
      minLength: dto.passwordPolicy.minLength,
      uppercase: dto.passwordPolicy.requireUppercase,
      numbers: dto.passwordPolicy.requireNumber,
      special: dto.passwordPolicy.requireSpecialChar,
      expiryDays: dto.passwordPolicy.expiryDays,
      blockedPrevious: dto.passwordPolicy.historyBlocked,
    },
    mfa: {
      status: ENFORCEMENT_TO_STATUS[dto.mfa.enforcement],
      methods: dto.mfa.methods.map((m) => METHOD_TO_LABEL[m]),
      roles: dto.mfa.enforcedRoles,
    },
    session: {
      timeoutMinutes: dto.session.timeoutMinutes,
      maxConcurrent: dto.session.maxConcurrentSessions,
      rememberDays: dto.session.rememberDeviceDays,
    },
    logins: dto.recentLogins.map((l) => ({
      at: formatStamp(l.at),
      operator: l.operatorName ?? l.email,
      ip: l.ipAddress ?? '—',
      device: l.deviceLabel ?? '—',
      success: l.outcome === 'SUCCESS',
    })),
  }
}

const SECURITY_KEY = ['admin', 'security'] as const

export function useSecuritySettings() {
  return useQuery({
    queryKey: SECURITY_KEY,
    queryFn: async () => toView(await api.get<SecurityScreenDto>('/admin/security')),
  })
}

/** The three Edit actions, each PATCHing its own section then refreshing. */
export function useSecurityMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: SECURITY_KEY })

  const setPasswordPolicy = useMutation({
    mutationFn: (p: PasswordPolicy) =>
      api.patch('/admin/security/password-policy', {
        passwordMinLength: p.minLength,
        requireUppercase: p.uppercase,
        requireNumber: p.numbers,
        requireSpecialChar: p.special,
        passwordExpiryDays: p.expiryDays,
        passwordHistoryBlocked: p.blockedPrevious,
      }),
    onSuccess: invalidate,
  })

  const setMfa = useMutation({
    mutationFn: (m: MfaSettings) =>
      api.patch('/admin/security/mfa', {
        enforcement: statusToEnforcement(m.status),
        methods: m.methods.map((label) => LABEL_TO_METHOD[label]),
        enforcedRoles: m.roles,
      }),
    onSuccess: invalidate,
  })

  const setSession = useMutation({
    mutationFn: (s: SessionSettings) =>
      api.patch('/admin/security/session', {
        sessionTimeoutMinutes: s.timeoutMinutes,
        maxConcurrentSessions: s.maxConcurrent,
        rememberDeviceDays: s.rememberDays,
      }),
    onSuccess: invalidate,
  })

  return { setPasswordPolicy, setMfa, setSession }
}

export function parseWhole(raw: string, min: number, max: number): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const v = Number(t)
  return v >= min && v <= max ? v : null
}
