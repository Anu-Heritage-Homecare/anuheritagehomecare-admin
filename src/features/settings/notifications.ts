/**
 * Notification settings — which alerts go out by email, SMS and push, when
 * visit reminders fire, and who an emergency reaches.
 *
 * Live backend data (`GET /admin/notifications`), mapped into the shapes the
 * page renders, with mutations that write back and refetch. The backend models
 * only the per channel toggles, the visit reminder timing, the emergency alert
 * routing and the SMS provider name; the client only channel config that used
 * to live here (email sender name and reply to, SMS sender id, push sound and
 * preview) has no backend source and is no longer kept.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Channel = 'email' | 'sms' | 'push'

export interface NotificationRule {
  id: string
  label: string
  hint: string
  on: boolean
}

export const smsProviders = ['Termii', 'Twilio', "Africa's Talking"] as const
export type SmsProvider = (typeof smsProviders)[number]

/** Kept for callers that still describe the channel config shape; unmodelled. */
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

/* --------------------------- backend response ----------------------------- */

type NotificationChannelEnum = 'EMAIL' | 'SMS' | 'PUSH'

interface ToggleDto {
  key: string
  label: string
  description: string
  enabled: boolean
}

interface ChannelDto {
  channel: NotificationChannelEnum
  types: ToggleDto[]
}

interface VisitRemindersDto {
  caregiverReminderMinutes: number
  familyNotificationMinutes: number
  coordinatorLateMinutes: number
}

interface TriggerDto {
  key: string
  label: string
}

interface EmergencyAlertsDto {
  recipients: string[]
  channels: NotificationChannelEnum[]
  triggers: string[]
  availableTriggers: TriggerDto[]
}

interface SmsProviderDto {
  name: string | null
  connected: boolean
}

interface NotificationsResponseDto {
  channels: ChannelDto[]
  visitReminders: VisitRemindersDto
  emergencyAlerts: EmergencyAlertsDto
  smsProvider: SmsProviderDto
}

/** The settings, mapped to the shapes the page renders. */
export interface NotificationsView {
  rules: Record<Channel, NotificationRule[]>
  reminders: ReminderRules
  emergency: EmergencyAlerts
  availableTriggers: string[]
  smsProvider: { name: string | null; connected: boolean }
}

/* -------------------------------- mapping --------------------------------- */

const CHANNEL_FROM_ENUM: Record<NotificationChannelEnum, Channel> = {
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
}
const CHANNEL_TO_ENUM: Record<Channel, NotificationChannelEnum> = {
  email: 'EMAIL',
  sms: 'SMS',
  push: 'PUSH',
}

// The emergency card shows the title case channel labels; the backend speaks
// the enum. These map between the two in each direction.
const CHANNEL_DISPLAY: Record<NotificationChannelEnum, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  PUSH: 'Push',
}
const CHANNEL_DISPLAY_TO_ENUM: Record<string, NotificationChannelEnum> = {
  Email: 'EMAIL',
  SMS: 'SMS',
  Push: 'PUSH',
}

function toView(dto: NotificationsResponseDto): NotificationsView {
  const rules: Record<Channel, NotificationRule[]> = { email: [], sms: [], push: [] }
  for (const group of dto.channels) {
    rules[CHANNEL_FROM_ENUM[group.channel]] = group.types.map((t) => ({
      id: t.key,
      label: t.label,
      hint: t.description,
      on: t.enabled,
    }))
  }

  return {
    rules,
    reminders: {
      caregiverMinutes: dto.visitReminders.caregiverReminderMinutes,
      familyMinutes: dto.visitReminders.familyNotificationMinutes,
      lateMinutes: dto.visitReminders.coordinatorLateMinutes,
    },
    emergency: {
      recipients: dto.emergencyAlerts.recipients,
      channels: dto.emergencyAlerts.channels.map((c) => CHANNEL_DISPLAY[c]),
      triggers: dto.emergencyAlerts.triggers,
    },
    availableTriggers: dto.emergencyAlerts.availableTriggers.map((t) => t.label),
    smsProvider: { name: dto.smsProvider.name, connected: dto.smsProvider.connected },
  }
}

const QUERY_KEY = ['admin', 'notifications'] as const

export function useNotificationSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => toView(await api.get<NotificationsResponseDto>('/admin/notifications')),
  })
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  const setToggle = useMutation({
    mutationFn: ({ channel, key, enabled }: { channel: Channel; key: string; enabled: boolean }) =>
      api.put(`/admin/notifications/toggles/${CHANNEL_TO_ENUM[channel]}/${key}`, { enabled }),
    onSuccess: invalidate,
  })

  const setReminders = useMutation({
    mutationFn: (reminders: ReminderRules) =>
      api.put('/admin/notifications/visit-reminders', {
        caregiverReminderMinutes: reminders.caregiverMinutes,
        familyNotificationMinutes: reminders.familyMinutes,
        coordinatorLateMinutes: reminders.lateMinutes,
      }),
    onSuccess: invalidate,
  })

  const setEmergency = useMutation({
    mutationFn: (emergency: EmergencyAlerts) =>
      api.put('/admin/notifications/emergency-alerts', {
        recipients: emergency.recipients,
        channels: emergency.channels.map((c) => CHANNEL_DISPLAY_TO_ENUM[c]),
        triggers: emergency.triggers,
      }),
    onSuccess: invalidate,
  })

  const setSmsProvider = useMutation({
    mutationFn: (name: string | null) =>
      api.patch('/admin/notifications/sms-provider', { name }),
    onSuccess: invalidate,
  })

  return { setToggle, setReminders, setEmergency, setSmsProvider }
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
