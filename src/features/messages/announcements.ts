/**
 * Announcements — the broadcasts a coordinator writes for the agency.
 *
 * They are the one thing in the inbox nobody sends to a person: an
 * announcement goes to a *group*, and the groups here are the same rules over
 * the roster that task templates use, so "All Caregivers" is whoever is on the
 * round today rather than a list somebody typed and stopped maintaining.
 *
 * Four states, and only three of them are stored. Draft, published and
 * archived are set by a person. Scheduled is set by a person too, but it does
 * not stay scheduled on its own: nothing in this app runs while nobody is
 * looking at it, so a scheduled announcement whose moment has passed reads as
 * published, measured against the app's clock. That is the honest version of a
 * queue with no server behind it — the alternative is a row that says
 * "Scheduled for last Tuesday" for ever.
 *
 * Everything written here lives for the session, like the rest of the app.
 */
import { useSyncExternalStore } from 'react'
import { SIGNED_IN } from '@/lib/session'
import { NOW, TODAY } from '@/lib/today'
import { groupLabel, membersOfGroup } from '@/features/tasks/groups'
import type { StaffGroupId } from '@/features/tasks/groups'
import type { Attachment } from './data'
import { sanitizeRich } from './rich-text'

export type AnnouncementStatus =
  'draft' | 'scheduled' | 'published' | 'archived'

/**
 * How loudly it lands. Normal is the announcement everyone reads in their own
 * time; the two above it are marked wherever the announcement appears, which
 * is the whole of what a priority can do here — nothing chases anybody for a
 * broadcast.
 */
export type AnnouncementPriority = 'normal' | 'high' | 'urgent'

export const priorityLabels: Record<AnnouncementPriority, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export interface Announcement {
  id: string
  title: string
  body: string
  /** One or more groups. The people are the union, counted off the roster. */
  audiences: StaffGroupId[]
  priority: AnnouncementPriority
  /** A file sent with it, held for the session like every other attachment. */
  attachment?: Attachment
  /** What a person set it to. `scheduled` can still read as published. */
  status: AnnouncementStatus
  /** ISO date: when it went out, is due to go out, or was last written. */
  date: string
  /** 24-hour, where the state has a moment attached. */
  time: string | null
  author: string
  /** Where it links, for an announcement that points at a screen. */
  to: string | null
}

const seed: Announcement[] = [
  {
    id: 'ann-3',
    title: 'Coordination meeting tomorrow, 9:00 AM',
    body: 'North Branch meeting room. Bring anything still open on your caseload — we will go through the week together rather than one by one.',
    audiences: ['care-managers'],
    priority: 'normal',
    status: 'published',
    date: TODAY,
    time: '08:05',
    author: SIGNED_IN,
    to: null,
  },
  {
    id: 'ann-2',
    title: 'Write visit records up on the day',
    body: 'A lot of last week closed with no record against it. If signal is the problem in the flat, file it from the office on the way home rather than leaving it to the weekend.',
    audiences: ['all-caregivers'],
    priority: 'normal',
    status: 'published',
    date: '2026-07-22',
    time: '17:30',
    author: 'Mike Chen',
    to: '/live-monitoring/history',
  },
  {
    id: 'ann-1',
    title: 'Credential renewals this month',
    body: 'HR is collecting renewal paperwork. Check the expiry dates on your own profile before the end of the month — a lapsed licence takes you off the rota the day it runs out.',
    audiences: ['all-staff'],
    priority: 'high',
    status: 'published',
    date: '2026-07-20',
    time: '09:15',
    author: 'Dr. Jane Foster',
    to: '/caregivers',
  },
  {
    id: 'ann-4',
    title: 'Dementia care refresher: who still needs it',
    body: 'Two sessions are being put on next month and every caregiver on a dementia caseload is expected at one of them. Dates go out once the room is confirmed.',
    audiences: ['all-caregivers', 'certified-staff'],
    priority: 'normal',
    status: 'scheduled',
    date: '2026-07-29',
    time: '08:00',
    author: SIGNED_IN,
    to: null,
  },
  {
    id: 'ann-5',
    title: 'August bank holiday cover',
    body: 'Cover for the bank holiday weekend is still short. Say now if you can take a shift, before the rota is built around the people who already have.',
    audiences: ['all-staff'],
    priority: 'normal',
    status: 'draft',
    date: '2026-07-23',
    time: null,
    author: SIGNED_IN,
    to: null,
  },
  {
    id: 'ann-6',
    title: 'Parking permits for the North Branch car park',
    body: 'New permits are in reception. The old ones stop being recognised at the end of the month.',
    audiences: ['all-staff'],
    priority: 'normal',
    status: 'archived',
    date: '2026-06-18',
    time: '10:00',
    author: 'Mike Chen',
    to: null,
  },
]

const announcements: Announcement[] = seed.map((a) => ({ ...a }))

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

export function useAnnouncements(): number {
  return useSyncExternalStore(
    subscribe,
    () => revision,
    () => revision,
  )
}

/**
 * What the row actually reads as: a scheduled announcement whose moment has
 * passed on the app's clock has gone out, because the screen is the only thing
 * that could have sent it.
 */
export function statusOf(
  announcement: Announcement,
  today = TODAY,
  now = NOW,
): AnnouncementStatus {
  if (announcement.status !== 'scheduled') return announcement.status
  const due = `${announcement.date} ${announcement.time ?? '00:00'}`
  return due <= `${today} ${now}` ? 'published' : 'scheduled'
}

export const statusOrder: AnnouncementStatus[] = [
  'draft',
  'scheduled',
  'published',
  'archived',
]

export const statusLabels: Record<AnnouncementStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

/** Newest first, with the clock breaking a same-day tie. */
function newestFirst(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) =>
    `${b.date} ${b.time ?? '00:00'}`.localeCompare(
      `${a.date} ${a.time ?? '00:00'}`,
    ),
  )
}

export function allAnnouncements(): Announcement[] {
  return newestFirst(announcements)
}

export function announcementsWithStatus(
  status: AnnouncementStatus,
): Announcement[] {
  return newestFirst(announcements.filter((a) => statusOf(a) === status))
}

/** What the inbox shows: the ones that have actually gone out. */
export function publishedAnnouncements(): Announcement[] {
  return newestFirst(announcements.filter((a) => statusOf(a) === 'published'))
}

export function announcementCounts(): Record<AnnouncementStatus, number> {
  const counts: Record<AnnouncementStatus, number> = {
    draft: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  }
  for (const a of announcements) counts[statusOf(a)] += 1
  return counts
}

export function findAnnouncement(id: string): Announcement | undefined {
  return announcements.find((a) => a.id === id)
}

export function audienceLabel(id: StaffGroupId): string {
  return groupLabel(id)
}

/**
 * How many people it actually reaches. Groups overlap — every caregiver is
 * also all-staff — so the size is the union, counted as the row is read rather
 * than stored.
 */
export function audienceSize(ids: StaffGroupId[]): number {
  const people = new Set<string>()
  for (const id of ids) for (const m of membersOfGroup(id)) people.add(m.id)
  return people.size
}

function nextId(): string {
  let n = announcements.length + 1
  while (announcements.some((a) => a.id === `ann-${n}`)) n += 1
  return `ann-${n}`
}

export interface NewAnnouncement {
  title: string
  body: string
  audiences: StaffGroupId[]
  priority: AnnouncementPriority
  attachment?: Attachment
  /** Publishing now, holding it as a draft, or a date and time to go out on. */
  when:
    | { kind: 'draft' }
    | { kind: 'now' }
    | { kind: 'schedule'; date: string; time: string }
}

export function createAnnouncement(input: NewAnnouncement): Announcement {
  const made: Announcement = {
    id: nextId(),
    title: input.title.trim(),
    // Stored as the four things the editor can make, never as raw markup.
    body: sanitizeRich(input.body),
    audiences: input.audiences,
    priority: input.priority,
    attachment: input.attachment,
    status:
      input.when.kind === 'now'
        ? 'published'
        : input.when.kind === 'schedule'
          ? 'scheduled'
          : 'draft',
    date: input.when.kind === 'schedule' ? input.when.date : TODAY,
    time:
      input.when.kind === 'schedule'
        ? input.when.time
        : input.when.kind === 'now'
          ? NOW
          : null,
    author: SIGNED_IN,
    to: null,
  }
  announcements.push(made)
  emit()
  return made
}

/** A copy to work from, held as a draft — never a second thing already sent. */
export function duplicateAnnouncement(id: string): Announcement | undefined {
  const source = findAnnouncement(id)
  if (!source) return undefined
  const copy: Announcement = {
    ...source,
    id: nextId(),
    title: `${source.title} (copy)`,
    status: 'draft',
    date: TODAY,
    time: null,
    author: SIGNED_IN,
  }
  announcements.push(copy)
  emit()
  return copy
}

export function setAnnouncementStatus(
  id: string,
  status: AnnouncementStatus,
): void {
  const found = findAnnouncement(id)
  if (!found) return
  found.status = status
  if (status === 'published') {
    found.date = TODAY
    found.time = NOW
  }
  emit()
}
