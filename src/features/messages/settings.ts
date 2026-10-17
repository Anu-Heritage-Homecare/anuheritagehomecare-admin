/**
 * Message settings.
 *
 * Two kinds of thing live here. Some are preferences the app itself acts on —
 * the quick replies and templates are offered in the composer, and the
 * auto-archive rules decide what the folders hold. The notification switches
 * are the other kind: they record how this account wants to be reached, and
 * nothing in this app posts, emails or texts anybody, so what they do here is
 * be remembered.
 *
 * Held in memory for the session, like everything else this app writes.
 */
import { useSyncExternalStore } from 'react'

export interface QuickReply {
  id: string
  text: string
}

export interface MessageTemplate {
  id: string
  name: string
  body: string
}

export interface NotificationPrefs {
  desktop: boolean
  email: boolean
  sms: boolean
  quietHours: boolean
}

export interface MessageSettings {
  notifications: NotificationPrefs
  quickReplies: QuickReply[]
  templates: MessageTemplate[]
  /** Days of silence after which a conversation drops out of the folders. */
  archiveAfterDays: number
  autoArchiveReadAnnouncements: boolean
  emergencySound: boolean
}

/** The window quiet hours covers, as the design labels it. */
export const QUIET_HOURS = '9 PM - 7 AM'

/** What the slider offers, shortest first. The last one turns the rule off. */
export const archiveOptions = [7, 14, 30, 60, 90, 0]

const settings: MessageSettings = {
  notifications: { desktop: true, email: true, sms: true, quietHours: true },
  quickReplies: [
    { id: 'qr-1', text: 'Thank you for the update' },
    { id: 'qr-2', text: 'I will follow up shortly' },
    { id: 'qr-3', text: 'Please confirm receipt' },
  ],
  templates: [
    {
      id: 'mt-1',
      name: 'Visit Confirmation',
      body: 'Confirming your visit for tomorrow. Please let me know straight away if anything has changed at your end.',
    },
    {
      id: 'mt-2',
      name: 'Schedule Change',
      body: 'Your visit time has moved. The new time is on your rota — reply here if it does not work and we will look at it again.',
    },
    {
      id: 'mt-3',
      name: 'Payment Reminder',
      body: "A reminder that this month's invoice is now due. The breakdown is on the billing page of the account.",
    },
    {
      id: 'mt-4',
      name: 'Care Update',
      body: "A short update after today's visit: everything on the care plan was covered and there is nothing to flag.",
    },
  ],
  archiveAfterDays: 30,
  autoArchiveReadAnnouncements: true,
  emergencySound: true,
}

let revision = 0
const listeners = new Set<() => void>()

function emit(): void {
  revision += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMessageSettings(): number {
  return useSyncExternalStore(
    subscribe,
    () => revision,
    () => revision,
  )
}

export function messageSettings(): MessageSettings {
  return settings
}

export function setNotification(
  key: keyof NotificationPrefs,
  value: boolean,
): void {
  settings.notifications[key] = value
  emit()
}

export function setArchiveAfterDays(days: number): void {
  settings.archiveAfterDays = days
  emit()
}

export function setAutoArchiveReadAnnouncements(value: boolean): void {
  settings.autoArchiveReadAnnouncements = value
  emit()
}

export function setEmergencySound(value: boolean): void {
  settings.emergencySound = value
  emit()
}

/* ------------------------------ quick replies ------------------------------ */

let counter = 100

export function saveQuickReply(id: string | null, text: string): void {
  const trimmed = text.trim()
  if (trimmed === '') return
  if (id) {
    const found = settings.quickReplies.find((r) => r.id === id)
    if (found) found.text = trimmed
  } else {
    counter += 1
    settings.quickReplies.push({ id: `qr-${counter}`, text: trimmed })
  }
  emit()
}

export function deleteQuickReply(id: string): void {
  settings.quickReplies = settings.quickReplies.filter((r) => r.id !== id)
  emit()
}

/* -------------------------------- templates -------------------------------- */

export function saveTemplate(
  id: string | null,
  name: string,
  body: string,
): void {
  const cleanName = name.trim()
  const cleanBody = body.trim()
  if (cleanName === '' || cleanBody === '') return
  if (id) {
    const found = settings.templates.find((t) => t.id === id)
    if (found) {
      found.name = cleanName
      found.body = cleanBody
    }
  } else {
    counter += 1
    settings.templates.push({
      id: `mt-${counter}`,
      name: cleanName,
      body: cleanBody,
    })
  }
  emit()
}

export function deleteTemplate(id: string): void {
  settings.templates = settings.templates.filter((t) => t.id !== id)
  emit()
}
