/**
 * Notification settings — which alerts go out by email, SMS and push, when
 * visit reminders fire, and who an emergency reaches.
 *
 * Content follows the Figma settings-notifications screen as drawn. Nothing in
 * the app sends an email, a text or a push, so these record how the
 * organisation wants to be notified; they are also separate from the
 * notification switches on the Billing and Message settings screens.
 *
 * Held in memory for the session, like every other settings store in the app.
 */
import { useSyncExternalStore } from 'react'

export type Channel = 'email' | 'sms' | 'push'

export interface NotificationRule {
  id: string
  label: string
  hint: string
  on: boolean
}

export const smsProviders = ['Termii', 'Twilio', "Africa's Talking"] as const
export type SmsProvider = (typeof smsProviders)[number]

export interface ChannelConfig {
  email: { senderName: string; replyTo: string }
  sms: { provider: SmsProvider; senderId: string }
  push: { sound: boolean; preview: boolean }
}

export interface ReminderRules {
  caregiverMinutes: number
  familyMinutes: number
  lateMinutes: number
}

export const recipientOptions = ['All Coordinators', 'Medical Director', 'Branch Manager', 'Administrators'] as const
export const channelOptions = ['SMS', 'Push', 'Email'] as const
export const triggerOptions = ['SOS Button', 'Missed Check-in (30m)', 'Incident Report'] as const

export interface EmergencyAlerts {
  recipients: string[]
  channels: string[]
  triggers: string[]
}

interface NotificationSettings {
  rules: Record<Channel, NotificationRule[]>
  config: ChannelConfig
  reminders: ReminderRules
  emergency: EmergencyAlerts
}

const rule = (id: string, label: string, hint: string, on = true): NotificationRule => ({ id, label, hint, on })

const state: NotificationSettings = {
  rules: {
    email: [
      rule('visit-assigned', 'New visit assigned', 'Notify caregiver when a new visit is confirmed'),
      rule('visit-cancelled', 'Visit cancelled', 'Send immediate update if a visit schedule changes'),
      rule('payment-received', 'Payment received', 'Send confirmation on invoice settlements'),
      rule('invoice-overdue', 'Invoice overdue', 'Alert when net payment window passes'),
      rule('new-message', 'New message', 'Direct alert on internal messaging platform'),
      rule('weekly-digest', 'Weekly digest', 'Summary report of operations & metrics'),
      rule('system-updates', 'System updates', 'Technical maintenance & releases alert', false),
    ],
    sms: [
      rule('visit-reminders', 'Visit reminders', 'Sent 1 hour before scheduled start'),
      rule('emergency-alerts', 'Emergency alerts', 'Critical dispatch signals for coordinators'),
      rule('payment-confirmations', 'Payment confirmations', 'Settlement validation texts'),
      rule('shift-changes', 'Shift changes', 'Roster reallocation details'),
    ],
    push: [
      rule('visit-updates', 'Real-time visit updates', 'Instant caregiver clock-in/out reports'),
      rule('chat-messages', 'Chat messages', 'In-app discussion pathways'),
      rule('task-reminders', 'Task reminders', 'Care task execution checklists'),
      rule('approval-requests', 'Approval requests', 'Coordinator validation tasks'),
    ],
  },
  config: {
    email: { senderName: 'CareProfs', replyTo: 'support@careprofs.ng' },
    sms: { provider: 'Termii', senderId: 'CareProfs' },
    push: { sound: true, preview: true },
  },
  reminders: { caregiverMinutes: 60, familyMinutes: 30, lateMinutes: 15 },
  emergency: {
    recipients: ['All Coordinators', 'Medical Director', 'Branch Manager'],
    channels: ['SMS', 'Push', 'Email'],
    triggers: ['SOS Button', 'Missed Check-in (30m)', 'Incident Report'],
  },
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

export function useNotificationSettings(): NotificationSettings {
  useSyncExternalStore(subscribe, () => revision, () => revision)
  return state
}

export function setRule(channel: Channel, id: string, on: boolean): void {
  state.rules = {
    ...state.rules,
    [channel]: state.rules[channel].map((r) => (r.id === id ? { ...r, on } : r)),
  }
  emit()
}

export function setConfig<C extends Channel>(channel: C, value: ChannelConfig[C]): void {
  state.config = { ...state.config, [channel]: value }
  emit()
}

export function setReminders(reminders: ReminderRules): void {
  state.reminders = reminders
  emit()
}

export function setEmergency(emergency: EmergencyAlerts): void {
  state.emergency = emergency
  emit()
}

export const leadOptions = [15, 30, 45, 60, 120, 1440]
export const lateOptions = [5, 10, 15, 30]

/** 60 → "1 hour", 30 → "30 min", 1440 → "24 hours". */
export function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60
    return `${h} ${h === 1 ? 'hour' : 'hours'}`
  }
  return `${minutes} min`
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** SMS sender IDs are 3–11 letters or digits. */
export function validSenderId(id: string): boolean {
  return /^[A-Za-z0-9]{3,11}$/.test(id)
}
