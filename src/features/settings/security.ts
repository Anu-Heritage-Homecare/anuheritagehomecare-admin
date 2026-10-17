/**
 * Security settings — the password policy, multi-factor rules, session limits
 * and the recent sign-in history.
 *
 * Content follows the Figma settings-security-integrations screen as drawn.
 * The app has no sign-in of its own, so nothing here is enforced: these record
 * the policy, and the login history is the design's five rows.
 *
 * Held in memory for the session, like every other settings store in the app.
 */
import { useSyncExternalStore } from 'react'

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

interface SecuritySettings {
  password: PasswordPolicy
  mfa: MfaSettings
  session: SessionSettings
  logins: LoginRecord[]
}

const state: SecuritySettings = {
  password: {
    minLength: 8,
    uppercase: true,
    numbers: true,
    special: true,
    expiryDays: 90,
    blockedPrevious: 5,
  },
  mfa: {
    status: 'Enabled for all admins',
    methods: ['Authenticator App', 'SMS'],
    roles: ['Administrator', 'Coordinator', 'Finance Managers'],
  },
  session: { timeoutMinutes: 30, maxConcurrent: 3, rememberDays: 30 },
  logins: [
    { at: '2026-03-31 10:45', operator: 'Sarah Jenkins', ip: '192.168.1.42', device: 'Chrome / macOS', success: true },
    { at: '2026-03-31 09:12', operator: 'John Carter (Coordinator)', ip: '102.89.34.12', device: 'Safari / iOS', success: true },
    { at: '2026-03-31 08:30', operator: 'Finance Admin', ip: '197.210.64.1', device: 'Firefox / Windows', success: true },
    { at: '2026-03-30 18:22', operator: 'Sarah Jenkins', ip: '192.168.1.42', device: 'Chrome / macOS', success: true },
    { at: '2026-03-30 14:15', operator: 'Unknown Account', ip: '45.12.89.90', device: 'Unknown / Android', success: false },
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

export function useSecuritySettings(): SecuritySettings {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return state
}

export function setPasswordPolicy(password: PasswordPolicy): void {
  state.password = password
  emit()
}

export function setMfa(mfa: MfaSettings): void {
  state.mfa = mfa
  emit()
}

export function setSession(session: SessionSettings): void {
  state.session = session
  emit()
}

export function parseWhole(raw: string, min: number, max: number): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const v = Number(t)
  return v >= min && v <= max ? v : null
}
