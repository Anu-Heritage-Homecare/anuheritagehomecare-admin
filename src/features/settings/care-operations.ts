/**
 * Care Operations settings — the services offered, the visit formats and what
 * they are billed at, the scheduling guardrails and the standard checklists.
 *
 * Content follows the Figma settings-care-operations screen as drawn. Nothing
 * here drives the scheduling board, the plan catalogue or the task templates
 * yet; those screens keep their own data.
 *
 * Held in memory for the session, like every other settings store in the app.
 */
import { useSyncExternalStore } from 'react'

export interface ServiceOffering {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface VisitFormat {
  id: string
  name: string
  /** Null where the length is not fixed ("Varies"). */
  durationHours: number | null
  /** Naira. */
  rate: number
  hourly: boolean
}

export const matchAlgorithms = ['Proximity + Skills', 'Proximity only', 'Skills only', 'Manual assignment'] as const
export type MatchAlgorithm = (typeof matchAlgorithms)[number]

export interface Guardrails {
  noticeHours: number
  bufferMinutes: number
  maxVisitsPerDay: number
  algorithm: MatchAlgorithm
}

export interface Checklist {
  id: string
  name: string
  /** "5 vital tasks" — the count and the design's own noun for it. */
  summary: string
}

interface CareOperations {
  services: ServiceOffering[]
  formats: VisitFormat[]
  guardrails: Guardrails
  checklists: Checklist[]
}

const state: CareOperations = {
  services: [
    { id: 'personal-care', name: 'Personal Care', description: 'Assistance with bathing, dressing, and hygiene', enabled: true },
    { id: 'medication', name: 'Medication Management', description: 'Reminders, dosage tracking, and nurse reviews', enabled: true },
    { id: 'mobility', name: 'Mobility Support', description: 'Transferring assistance and walking guides', enabled: true },
    { id: 'meals', name: 'Meal Preparation', description: 'Dietary plan compliance and cooking support', enabled: true },
    { id: 'companionship', name: 'Companionship', description: 'Conversation, social visits, and recreation', enabled: true },
    { id: 'nursing', name: 'Nursing Care', description: 'Clinical procedures, wound care, and assessments', enabled: true },
    { id: 'physio', name: 'Physiotherapy', description: 'Physical therapy drills and rehabilitation sessions', enabled: false },
  ],
  formats: [
    { id: 'standard', name: 'Standard Visit', durationHours: 1, rate: 8500, hourly: false },
    { id: 'extended', name: 'Extended Visit', durationHours: 2, rate: 15000, hourly: false },
    { id: 'overnight', name: 'Overnight Care', durationHours: 12, rate: 45000, hourly: false },
    { id: 'live-in', name: 'Live-in Shift', durationHours: 24, rate: 75000, hourly: false },
    { id: 'emergency', name: 'Emergency Dispatch', durationHours: null, rate: 12000, hourly: true },
  ],
  guardrails: {
    noticeHours: 24,
    bufferMinutes: 30,
    maxVisitsPerDay: 6,
    algorithm: 'Proximity + Skills',
  },
  checklists: [
    { id: 'daily-check-in', name: 'Daily Check-in Checklist', summary: '5 vital tasks' },
    { id: 'medication-round', name: 'Medication Round Checklist', summary: '8 tracking checkpoints' },
    { id: 'personal-care', name: 'Personal Care Routine', summary: '6 personal guidelines' },
    { id: 'weekly-assessment', name: 'Weekly Assessment Guide', summary: '12 clinical criteria' },
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

export function useCareOperations(): CareOperations {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return state
}

let seq = 0
const nextId = (prefix: string) => `${prefix}-new-${(seq += 1)}`

export function setServiceEnabled(id: string, enabled: boolean): void {
  state.services = state.services.map((s) => (s.id === id ? { ...s, enabled } : s))
  emit()
}

export function addService(service: Omit<ServiceOffering, 'id'>): void {
  state.services = [...state.services, { ...service, id: nextId('service') }]
  emit()
}

export function addFormat(format: Omit<VisitFormat, 'id'>): void {
  state.formats = [...state.formats, { ...format, id: nextId('format') }]
  emit()
}

export function updateGuardrails(patch: Partial<Guardrails>): void {
  state.guardrails = { ...state.guardrails, ...patch }
  emit()
}

export function addChecklist(name: string, itemCount: number): void {
  state.checklists = [
    ...state.checklists,
    { id: nextId('checklist'), name, summary: `${itemCount} ${itemCount === 1 ? 'task' : 'tasks'}` },
  ]
  emit()
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

export function formatDuration(hours: number | null): string {
  return hours === null ? 'Varies' : plural(hours, 'hour')
}

export function formatRate(f: Pick<VisitFormat, 'rate' | 'hourly'>): string {
  return `₦${f.rate.toLocaleString('en-NG')}${f.hourly ? '/hr' : ''}`
}

export const guardrailText = {
  noticeHours: (g: Guardrails) => plural(g.noticeHours, 'hour'),
  bufferMinutes: (g: Guardrails) => plural(g.bufferMinutes, 'minute'),
  maxVisitsPerDay: (g: Guardrails) => plural(g.maxVisitsPerDay, 'shift'),
  algorithm: (g: Guardrails) => g.algorithm,
}

/** A whole number within the range, from typed text; null otherwise. */
export function parseWhole(raw: string, min: number, max: number): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const v = Number(t)
  return v >= min && v <= max ? v : null
}
