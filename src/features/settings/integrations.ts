/**
 * Integrations — third-party services the organisation has connected.
 *
 * Only Google Calendar is listed, because it is the only one the Figma draws
 * (drawer-configure-integration). Nothing is really connected: no calendar is
 * read or written, "Test Connection" does not leave the browser, and the
 * connection dates are the design's.
 *
 * Held in memory for the session, like every other settings store in the app.
 */
import { useSyncExternalStore } from 'react'
import { TODAY } from '@/lib/today'

export const syncDirections = ['Two-way Sync', 'CareProfs to Google only', 'Google to CareProfs only'] as const
export const targetCalendars = ['CareProfs Primary Calendar', 'Care Team Shifts', 'Staff Calendar'] as const
export const syncEventOptions = ['Visits & Care Shifts', 'Staff Meetings', 'Task Reminders'] as const
export const syncIntervals = [5, 15, 30, 60] as const

export interface IntegrationConfig {
  direction: string
  calendar: string
  events: string[]
  intervalMinutes: number
}

export interface Integration {
  id: string
  name: string
  description: string
  connected: boolean
  /** "Jul 1, 2026"; null while disconnected. */
  connectedSince: string | null
  /** "5 minutes ago"; null while disconnected. */
  lastSync: string | null
  config: IntegrationConfig
}

export interface ApiKey {
  id: string
  name: string
  status: 'Active' | 'Revoked'
  created: string
  createdBy: string
  lastUsed: string
  /** The characters after the "sk-cp-" prefix. Never drawn in full. */
  secret: string
  scopes: string[]
  rateLimitPerHour: number
  usage: { today: number; week: number }
}

const KEY_PREFIX = 'sk-cp-'
const SECRET_LENGTH = 32

/*
 * A stand-in secret, made up in the browser. No key is typed into the source:
 * nothing issues or checks keys here, and a literal that looks like one would
 * only trip secret scanners.
 */
function randomSecret(ending = ''): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_LENGTH))
  const body = Array.from(bytes, (b) => (b % 16).toString(16)).join('')
  return body.slice(0, SECRET_LENGTH - ending.length) + ending
}

/** "sk-cp-••••••3f7a": the prefix, dots, and the last four. */
export function maskedKey(key: ApiKey): string {
  return `${KEY_PREFIX}${'•'.repeat(SECRET_LENGTH - 4)}${key.secret.slice(-4)}`
}

export function fullKey(key: ApiKey): string {
  return `${KEY_PREFIX}${key.secret}`
}

const state: { integrations: Integration[]; apiKeys: ApiKey[] } = {
  apiKeys: [
    {
      id: 'mobile-app',
      name: 'Mobile App Integration',
      status: 'Active',
      created: 'Jul 5, 2026',
      createdBy: 'Adaeze Okonkwo',
      lastUsed: '2 hours ago',
      secret: randomSecret('3f7a'),
      scopes: ['Read Recipients', 'Read Schedules', 'Read/Write Messages'],
      rateLimitPerHour: 1000,
      usage: { today: 342, week: 2847 },
    },
  ],
  integrations: [
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync visits, staff meetings and task reminders with a shared calendar',
      connected: true,
      connectedSince: 'Jul 1, 2026',
      lastSync: '5 minutes ago',
      config: {
        direction: 'Two-way Sync',
        calendar: 'CareProfs Primary Calendar',
        events: ['Visits & Care Shifts', 'Staff Meetings', 'Task Reminders'],
        intervalMinutes: 15,
      },
    },
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

export function useIntegrations(): Integration[] {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return state.integrations
}

function patch(id: string, change: Partial<Integration>): void {
  state.integrations = state.integrations.map((i) => (i.id === id ? { ...i, ...change } : i))
  emit()
}

export function saveConfig(id: string, config: IntegrationConfig): void {
  patch(id, { config })
}

/** Stands in for a real round trip: marks a sync as having just happened. */
export function testConnection(id: string): void {
  patch(id, { lastSync: 'Just now' })
}

export function disconnect(id: string): void {
  patch(id, { connected: false, connectedSince: null, lastSync: null })
}

export function connect(id: string): void {
  const since = new Date(`${TODAY}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  patch(id, { connected: true, connectedSince: since, lastSync: 'Just now' })
}

export function useApiKeys(): ApiKey[] {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return state.apiKeys
}

function patchKey(id: string, change: Partial<ApiKey>): void {
  state.apiKeys = state.apiKeys.map((k) => (k.id === id ? { ...k, ...change } : k))
  emit()
}

/** A new secret; the old one is gone, so the key has not been used yet. */
export function regenerateKey(id: string): void {
  patchKey(id, { secret: randomSecret(), lastUsed: 'Not used yet' })
}

export function revokeKey(id: string): void {
  patchKey(id, { status: 'Revoked' })
}

export function formatInterval(minutes: number): string {
  return minutes === 60 ? 'Every hour' : `Every ${minutes} minutes`
}
