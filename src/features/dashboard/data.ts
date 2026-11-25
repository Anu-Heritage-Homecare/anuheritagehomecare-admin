import {
  BarChart3,
  CalendarPlus,
  FilePlus,
  Megaphone,
  UserPlus,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Priority, Severity, Tone, VisitStatus } from '@/types'

/* ---------------------------------- types --------------------------------- */

export interface Stat {
  id: string
  label: string
  value: string
  meta: string
  /** Direction of `meta` relative to the previous period. */
  trend?: 'up' | 'down'
  icon: LucideIcon
  tone: Tone
}

export interface Visit {
  id: string
  time: string
  recipient: string
  caregiver: string | null
  type: string
  status: VisitStatus
  priority: Priority
}

export interface Alert {
  id: string
  title: string
  severity: Severity
  detail: string
  coordinator: string
  action: string
  /** Destructive actions get a red button. */
  destructive?: boolean
  /**
   * Where the button takes you: the screen where that job is done. Either a
   * fixed path, or a visit to reassign — that one is looked up on the rota
   * when clicked, because the visit's id carries today's date.
   */
  target:
    | { kind: 'path'; to: string }
    | { kind: 'reassign'; caregiver: string; recipient: string }
}

export interface ActivityEntry {
  id: string
  title: string
  detail: string
  ago: string
  icon: LucideIcon
  tone: Tone
}

export interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  /** Where the tile goes — the screen where that action is actually done. */
  to: string
  /**
   * Wayfinding, not status. These six are a launcher — the colour is there so
   * the eye can find "Broadcast Announcement" without reading all six labels,
   * and it carries none of the meaning a tone carries on a visit or an alert.
   */
  tone: Tone
}

export interface Metric {
  id: string
  label: string
  value: string
  /** 0–100, drives the progress bar width. */
  percent: number
  tone: Tone
  emphasis?: boolean
}

/* ---------------------------------- data ---------------------------------- */

/*
 * The launcher is navigation, not backend data, so it stays a static list. The
 * live dashboard figures come from `useDashboard`.
 */
export const quickActions: QuickAction[] = [
  // The board's unassigned queue is where a caregiver is actually assigned.
  { id: 'q1', label: 'Assign Caregiver', icon: UserPlus, tone: 'blue', to: '/scheduling' },
  { id: 'q2', label: 'Schedule Visit', icon: CalendarPlus, tone: 'blue', to: '/scheduling/visits/new' },
  // A plan belongs to a recipient; the directory is where you pick whose.
  { id: 'q3', label: 'Create Care Plan', icon: FilePlus, tone: 'green', to: '/care-recipients' },
  { id: 'q4', label: 'Register Care Recipient', icon: UserRound, tone: 'purple', to: '/care-recipients?new=1' },
  { id: 'q5', label: 'Broadcast Announcement', icon: Megaphone, tone: 'amber', to: '/messages?folder=announcements' },
  { id: 'q6', label: 'Generate Report', icon: BarChart3, tone: 'slate', to: '/reports' },
]
