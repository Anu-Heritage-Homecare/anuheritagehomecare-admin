import {
  ClipboardCheck,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  Heart,
  Megaphone,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { lastMessage } from './data'
import type { Thread } from './data'
import { TODAY } from '@/lib/today'
import type { Notice } from './notices'
import { isRead } from './read-state'
import { hasLeft, isArchived, isMuted } from './flags'
import { messageSettings } from './settings'

/**
 * The rail.
 *
 * One flat list, and every folder is a real cut of the same inbox: All is
 * everything, Direct is the conversations somebody is on the other end of, and
 * Visits and Announcements are the records and broadcasts that arrive
 * alongside them and cannot be replied to. All = Direct + Visits +
 * Announcements, so the counts add up rather than overlapping.
 */
export type Folder =
  | 'all'
  | 'unread'
  | 'direct'
  | 'caregivers'
  | 'families'
  | 'visits'
  | 'announcements'

export const folderOrder: Folder[] = [
  'all',
  'unread',
  'direct',
  'caregivers',
  'families',
  'visits',
  'announcements',
]

export const folderLabels: Record<Folder, string> = {
  all: 'All',
  unread: 'Unread',
  direct: 'Direct',
  caregivers: 'Caregivers',
  families: 'Families',
  visits: 'Visits',
  announcements: 'Announcements',
}

export const folderHints: Record<Folder, string> = {
  all: 'Every conversation, visit record and announcement.',
  unread: 'Anything nobody has opened yet this session.',
  direct: 'Conversations with a caregiver or a family contact.',
  caregivers: 'Staff on the roster.',
  families: 'Family contacts, reading the same log as each care record.',
  visits: 'Visit records filed in the last seven days. Read-only.',
  announcements: 'Written to everyone. There is nowhere to reply.',
}

export const folderIcons: Record<Folder, LucideIcon> = {
  all: FolderIcon,
  unread: FolderOpen,
  direct: FolderInput,
  caregivers: UserRound,
  families: Heart,
  visits: ClipboardCheck,
  announcements: Megaphone,
}

/** Folders that hold no conversation, so the list offers no sort. */
export function isNoticeFolder(folder: Folder): boolean {
  return folder === 'visits' || folder === 'announcements'
}

/** Falls back to the inbox rather than 404ing on a hand-edited query string. */
export function readFolder(value: string | null): Folder {
  return folderOrder.includes(value as Folder) ? (value as Folder) : 'all'
}

export function threadsIn(folder: Folder, list: Thread[]): Thread[] {
  // Archived is out of every folder. Not deleted — the thread keeps its URL,
  // and the conversation's own panel is where it comes back from.
  list = list.filter((t) => !isArchived(t.id) && !hasLeft(t.id) && !agedOut(t))
  switch (folder) {
    case 'unread':
      // Muted stays in the folders and out of the chasing.
      return list.filter((t) => !isRead(t.id) && !isMuted(t.id))
    case 'caregivers':
      return list.filter((t) => t.kind === 'caregiver')
    case 'families':
      return list.filter((t) => t.kind === 'family')
    case 'visits':
    case 'announcements':
      return []
    default:
      // All and Direct: every conversation is one-to-one with somebody, as
      // against the records and broadcasts below them.
      return list
  }
}

const DAY_MS = 86_400_000

/**
 * The auto-archive rule from Message Settings, applied where it belongs: a
 * conversation nobody has written in for longer than the setting allows drops
 * out of the folders, exactly as archiving it by hand would. Nothing is
 * deleted and the thread keeps its own link — the rule is read as the folder
 * is built, so moving the setting puts the conversations straight back.
 */
function agedOut(thread: Thread): boolean {
  const days = messageSettings().archiveAfterDays
  if (days <= 0) return false
  const last = lastMessage(thread)
  if (!last) return false
  const age =
    (new Date(`${TODAY}T00:00:00Z`).getTime() -
      new Date(`${last.at}T00:00:00Z`).getTime()) /
    DAY_MS
  return age > days
}

export function noticesIn(folder: Folder, list: Notice[]): Notice[] {
  switch (folder) {
    case 'visits':
      return list.filter((n) => n.kind === 'visit')
    case 'announcements':
      return list.filter((n) => n.kind === 'announcement')
    case 'all':
      return list
    case 'unread':
      return list.filter((n) => !isRead(n.id))
    default:
      return []
  }
}

/**
 * Counted from what the search left rather than from everything, so the rail
 * and the list beside it never disagree about how many there are.
 */
export function folderCounts(
  threads: Thread[],
  notices: Notice[],
): Record<Folder, number> {
  return {
    all: threads.length + notices.length,
    unread:
      threadsIn('unread', threads).length + noticesIn('unread', notices).length,
    direct: threads.length,
    caregivers: threadsIn('caregivers', threads).length,
    families: threadsIn('families', threads).length,
    visits: noticesIn('visits', notices).length,
    announcements: noticesIn('announcements', notices).length,
  }
}
