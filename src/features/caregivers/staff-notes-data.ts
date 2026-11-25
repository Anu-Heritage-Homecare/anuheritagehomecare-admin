import {
  getCareNotes,
  noteCategoryLabels,
} from '@/features/care-recipients/notes-data'
import type { NoteCategory } from '@/features/care-recipients/notes-data'
import {
  assignmentsFor,
  coordinatingFor,
  staffByName,
  staffMembers,
} from './roster-data'
import type { StaffMember } from './roster-data'
import { internalReviewsFor } from './performance-data'
import { trainingFor } from './documents-data'
import { TODAY } from '@/lib/today'
import type { Tone } from '@/types'

export { TODAY }

/* ---------------------------------- types --------------------------------- */

export type StaffNoteKind = 'visit' | 'supervision' | 'internal' | 'training'

export interface StaffNote {
  id: string
  kind: StaffNoteKind
  /** ISO datetime, UTC. */
  at: string
  author: string
  /** Resolved from the roster at read time, never stored. */
  authorRole: string
  body: string
  /**
   * False for entries generated from a record rather than written by a person
   * — a completed course has hours and a date but no author, and giving it one
   * would be inventing a person's words.
   */
  authored: boolean
  /** Set when the note is about a particular client. */
  recipientId?: string
  recipientName?: string
  /** The care log's own category, kept so a flagged incident stays one. */
  category?: NoteCategory
  categoryLabel?: string
  flagged?: boolean
  /** True when the caregiver wrote it themselves. */
  own: boolean
  /** Where the note actually lives, so nothing here is the only copy. */
  source: string
  sourceTo?: string
}

export const noteKinds: { value: StaffNoteKind; label: string; tone: Tone }[] = [
  // "Care notes", not "Visit notes": a coordinator's note about a client is
  // on this list too, and it is not a visit write-up.
  { value: 'visit', label: 'Care notes', tone: 'blue' },
  { value: 'supervision', label: 'Supervision', tone: 'purple' },
  { value: 'internal', label: 'Internal', tone: 'slate' },
  { value: 'training', label: 'Training', tone: 'green' },
]

export const noteKindLabels = Object.fromEntries(
  noteKinds.map((k) => [k.value, k.label]),
) as Record<StaffNoteKind, string>

export const noteKindTones = Object.fromEntries(
  noteKinds.map((k) => [k.value, k.tone]),
) as Record<StaffNoteKind, Tone>

/* ------------------------------ internal file ------------------------------ */

/**
 * Staff-file entries with no other home — leave, equipment, requests. Visit,
 * supervision and training notes are NOT stored here: they are read back out of
 * the care log, the review record and the training record respectively, so this
 * tab and those three screens cannot tell different stories.
 */
interface StoredInternal {
  id: string
  caregiverId: string
  /** ISO datetime, UTC. Nothing later than the sample clock. */
  at: string
  /** Must be somebody on the roster; the role is resolved, not stored. */
  author: string
  body: string
}

const internalNotes: StoredInternal[] = [
  {
    id: 'in1',
    caregiverId: 'cg-001',
    // Before the 30 June expiry it refers to, not three weeks after it.
    at: '2026-06-12T11:30:00Z',
    author: 'Mike Chen',
    body: 'Requested a place on the Alzheimer’s care recertification ahead of the June expiry. Approved and enrolled; she has started the course.',
  },
  {
    id: 'in2',
    caregiverId: 'cg-001',
    at: '2026-07-06T09:00:00Z',
    author: 'Mike Chen',
    body: 'CPR card lapsed at the end of March. Refresher booked but not yet started — she cannot be put on new visits until it is cleared.',
  },
  {
    id: 'in3',
    caregiverId: 'cg-001',
    at: '2026-05-11T14:00:00Z',
    author: 'Dr. Jane Foster',
    body: 'Asked to keep Tuesday afternoons free from September for a standing family commitment. Noted against her availability.',
  },
  {
    id: 'in4',
    caregiverId: 'cg-002',
    // After the 23 July care note that raised the Wednesday gap, not before.
    at: '2026-07-23T16:00:00Z',
    author: 'Mike Chen',
    body: 'Picked up two extra afternoons this week to cover the Wednesday gap. Confirmed he is still inside his contracted hours.',
  },
  {
    id: 'in5',
    caregiverId: 'cg-003',
    at: '2026-06-30T10:15:00Z',
    author: 'Dr. Jane Foster',
    body: 'Clinical supervision hours logged for the quarter. Nothing outstanding.',
  },
  {
    id: 'in6',
    caregiverId: 'cg-006',
    at: '2026-07-13T08:45:00Z',
    author: 'Dr. Jane Foster',
    body: 'Live-in placement running well past the contracted week. Flagged for a rota review before the next block.',
  },
]

/* --------------------------------- derived --------------------------------- */

function roleOf(name: string): string {
  // Only ever called for staff-file authors, so an unknown name is a gap in
  // the roster, not a family member.
  return staffByName(name)?.title ?? 'Role not recorded'
}

/**
 * Care notes are stored per recipient and carry an author, so a caregiver's own
 * notes are read back out rather than duplicated. Deduped by recipient and note
 * id — a caregiver assigned twice to one client would otherwise list each note
 * twice.
 */
function visitNotes(member: StaffMember): StaffNote[] {
  const seen = new Set<string>()
  const out: StaffNote[] = []

  // Coordinators hold cases without being on the rota, so their client notes
  // come through `coordinatingFor` — without it their file was empty.
  const clients = [...assignmentsFor(member), ...coordinatingFor(member)]

  for (const assignment of clients) {
    for (const note of getCareNotes(assignment.recipientId)) {
      if (note.author !== member.name) continue
      const key = `${assignment.recipientId}-${note.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        id: key,
        kind: 'visit',
        at: note.at,
        author: note.author,
        authorRole: note.authorRole,
        body: note.body,
        authored: true,
        recipientId: assignment.recipientId,
        recipientName: assignment.recipientName,
        // Kept, not flattened: two of Sarah's care notes are flagged
        // incidents, and dropping the flag made her file read as routine
        // while the client's own Notes tab showed them in red.
        category: note.category,
        categoryLabel: noteCategoryLabels[note.category],
        flagged: note.flagged,
        own: true,
        source: 'Care record',
        sourceTo: `/care-recipients/${assignment.recipientId}/notes`,
      })
    }
  }
  return out
}

/** Written by a colleague about this caregiver — the internal reviews. */
function supervisionNotes(member: StaffMember): StaffNote[] {
  return internalReviewsFor(member).map((review) => ({
    id: `sv-${review.id}`,
    kind: 'supervision',
    // Reviews carry a date, not a time; midday keeps the ordering stable
    // without inventing a clock reading.
    at: `${review.at}T12:00:00Z`,
    author: review.authorName,
    authorRole: review.authorRole,
    body: review.body,
    authored: true,
    recipientId: review.recipientId,
    recipientName: review.recipientName,
    own: false,
    source: 'Performance',
    sourceTo: `/caregivers/${member.id}/performance`,
  }))
}

/**
 * One note per completed course, dated at completion and carrying the hours
 * actually recorded. Derived, so this tab cannot date a course differently
 * from the Documents tab — the source design had the same HIPAA refresher
 * completed in January on one tab and in July on another.
 */
function trainingNotes(member: StaffMember): StaffNote[] {
  return trainingFor(member)
    .filter((record) => record.completedAt !== null)
    .map((record) => ({
      id: `tr-${record.id}`,
      kind: 'training' as const,
      at: `${record.completedAt!}T12:00:00Z`,
      // A training record has no author. Naming the supervisor put words in
      // the mouth of a colleague — in two cases one who is on leave.
      author: record.name,
      authorRole: 'Training record',
      authored: false,
      body: `Completed — ${record.hours} of ${record.requiredHours} hours recorded. Certificate is on file.`,
      own: false,
      source: 'Documents',
      sourceTo: `/caregivers/${member.id}/documents`,
    }))
}

function fileNotes(member: StaffMember): StaffNote[] {
  return internalNotes
    .filter((n) => n.caregiverId === member.id)
    .map((n) => ({
      id: n.id,
      kind: 'internal' as const,
      at: n.at,
      author: n.author,
      authorRole: roleOf(n.author),
      body: n.body,
      authored: true,
      own: n.author === member.name,
      source: 'Staff file',
    }))
}

/* ------------------------- notes added this session ------------------------ */

interface AddedStaffNote {
  id: string
  caregiverId: string
  at: string
  author: string
  body: string
  kind: StaffNoteKind
}
const addedStaffNotes: AddedStaffNote[] = []
let addedStaffSeq = 0

/** A note written on a caregiver's file from their Notes tab. Held in memory. */
export function addStaffNote(
  member: StaffMember,
  note: { author: string; body: string; kind: StaffNoteKind },
): void {
  addedStaffSeq += 1
  addedStaffNotes.push({
    id: `staff-added-${addedStaffSeq}`,
    caregiverId: member.id,
    at: new Date().toISOString(),
    author: note.author,
    body: note.body,
    kind: note.kind,
  })
}

function addedNotesFor(member: StaffMember): StaffNote[] {
  return addedStaffNotes
    .filter((n) => n.caregiverId === member.id)
    .map((n) => ({
      id: n.id,
      kind: n.kind,
      at: n.at,
      author: n.author,
      authorRole: roleOf(n.author),
      body: n.body,
      authored: true,
      own: n.author === member.name,
      source: 'Added on this file',
    }))
}

/** Everything on this caregiver's file, newest first. */
export function notesFor(member: StaffMember): StaffNote[] {
  return [
    ...visitNotes(member),
    ...supervisionNotes(member),
    ...trainingNotes(member),
    ...fileNotes(member),
    ...addedNotesFor(member),
  ].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
}

/* --------------------------------- filtering -------------------------------- */

export const NOTES_PAGE_SIZE = 6

export type NoteRange = 'all' | 'month' | 'quarter' | 'year'

export const rangeOptions: { value: NoteRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'year', label: 'Last 12 months' },
]

/** The first date a range includes, or null for all time. */
export function rangeStart(range: NoteRange, today = TODAY): string | null {
  if (range === 'all') return null
  if (range === 'month') return `${today.slice(0, 7)}-01`
  const months = range === 'quarter' ? 3 : 12
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

export interface NoteQuery {
  kind: StaffNoteKind | 'all'
  range: NoteRange
  search: string
}

export function applyQuery(notes: StaffNote[], query: NoteQuery): StaffNote[] {
  const from = rangeStart(query.range)
  const term = query.search.trim().toLowerCase()

  return notes.filter((note) => {
    if (query.kind !== 'all' && note.kind !== query.kind) return false
    if (from !== null && note.at.slice(0, 10) < from) return false
    if (term === '') return true
    return (
      note.body.toLowerCase().includes(term) ||
      note.author.toLowerCase().includes(term) ||
      (note.recipientName?.toLowerCase().includes(term) ?? false)
    )
  })
}

/* --------------------------------- counting -------------------------------- */

export interface NoteCounts {
  total: number
  thisMonth: number
  own: number
  byKind: Record<StaffNoteKind, number>
}

/**
 * Counted from the list, never stated beside it. The source design headlined
 * 56 notes, 12 this month and 8 internal above a list of six.
 */
export function countNotes(notes: StaffNote[], today = TODAY): NoteCounts {
  const month = today.slice(0, 7)
  const byKind = Object.fromEntries(
    noteKinds.map((k) => [k.value, 0]),
  ) as Record<StaffNoteKind, number>
  for (const note of notes) byKind[note.kind] += 1

  return {
    total: notes.length,
    thisMonth: notes.filter((n) => n.at.slice(0, 7) === month).length,
    own: notes.filter((n) => n.own).length,
    byKind,
  }
}

/* -------------------------------- formatting ------------------------------- */

const stamp = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})

const dayOnly = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatNoteTime(iso: string): string {
  return stamp.format(new Date(iso)).replace(' at ', ', ')
}

/** Reviews and training carry a date but no clock; do not invent one. */
export function formatNoteDay(iso: string): string {
  return dayOnly.format(new Date(iso))
}

/** True when the entry's time of day is real rather than a sort placeholder. */
export function hasClock(note: StaffNote): boolean {
  return note.kind === 'visit' || note.kind === 'internal'
}

export { staffMembers }
