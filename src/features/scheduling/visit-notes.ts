/**
 * The visit's Notes tab, as a view over records that already exist.
 *
 * Two things end up in one list:
 *
 *  - notes people wrote, from the client's care notes, filtered to this
 *    visit's window;
 *  - entries the *record* produced — the clock-in, the clock-out, the
 *    medication rounds — which are read straight off `timelineFor`, so the
 *    Notes tab and the Timeline tab cannot describe the same visit differently.
 *
 * Nothing here is stored against a visit. The app has no note-to-visit link, no
 * threading, no acknowledgement state and no read receipts, so this module
 * offers no reply, no acknowledge and no flag — the source design had all
 * three on every row.
 */
import { timelineFor } from './visit-detail'
import type { BoardVisit } from './board-data'
import { NOW, TODAY } from '@/lib/today'
import { noteCategoryLabels } from '@/features/care-recipients/notes-data'
import type { CareNoteEntry, NoteCategory } from '@/features/care-recipients/notes-data'
import type { Tone } from '@/types'

export type VisitNoteKind = 'caregiver' | 'team' | 'family' | 'record'

export const visitNoteKinds: { value: VisitNoteKind; label: string; tone: Tone }[] =
  [
    { value: 'caregiver', label: 'On this visit', tone: 'blue' },
    { value: 'team', label: 'Other staff', tone: 'purple' },
    { value: 'family', label: 'Family', tone: 'amber' },
    { value: 'record', label: 'From the record', tone: 'slate' },
  ]

export const visitNoteKindLabels = Object.fromEntries(
  visitNoteKinds.map((k) => [k.value, k.label]),
) as Record<VisitNoteKind, string>

export const visitNoteKindTones = Object.fromEntries(
  visitNoteKinds.map((k) => [k.value, k.tone]),
) as Record<VisitNoteKind, Tone>

export interface VisitNote {
  id: string
  kind: VisitNoteKind
  /** ISO datetime for an authored note; a 24-hour clock time for a record. */
  at: string
  /** True when `at` is a full ISO instant rather than a clock time. */
  isInstant: boolean
  author: string
  authorRole: string
  body: string
  /**
   * False for anything generated from a record rather than typed by a person.
   * The distinction the source design lost by giving a system check-in the
   * same avatar, byline and Reply button as a caregiver's write-up.
   */
  authored: boolean
  category?: NoteCategory
  categoryLabel?: string
  flagged?: boolean
  /** Where it came from, named on the row so nothing looks stored here. */
  source: string
  /** Set when the note sits outside the scheduled window but inside the grace. */
  outside?: boolean
}

const FAMILY_ROLE = 'Family'

function kindOf(note: CareNoteEntry, visit: BoardVisit): VisitNoteKind {
  if (note.authorRole === FAMILY_ROLE || note.category === 'family') return 'family'
  return note.author === visit.caregiverName ? 'caregiver' : 'team'
}

/**
 * Whether the note falls outside the scheduled window. `notesWithin` allows an
 * hour either side, so a write-up filed just after the shift still lands — but
 * the row should say which it is rather than implying it was written on site.
 */
function isOutside(note: CareNoteEntry, visit: BoardVisit): boolean {
  const start = Date.parse(`${visit.date}T${visit.start}:00Z`)
  if (Number.isNaN(start)) return false
  const end = start + Math.round(visit.durationHours * 60 * 60 * 1000)
  const at = Date.parse(note.at)
  // Half-open, matching `timelineFor` and `detailFor` — a note stamped exactly
  // at the finish counted as inside on one screen and outside on the other.
  return at < start || at >= end
}

/* --------------------------- notes added this session --------------------- */

interface AddedNote {
  id: string
  visitId: string
  at: string
  author: string
  authorRole: string
  body: string
  kind: VisitNoteKind
}
const addedNotes: AddedNote[] = []
let addedSeq = 0

/** A note written on a visit from the Visit Details screen. Held in memory. */
export function addVisitNote(
  visitId: string,
  note: { author: string; authorRole: string; body: string; kind?: VisitNoteKind },
): void {
  addedSeq += 1
  addedNotes.push({
    id: `added-${addedSeq}`,
    visitId,
    at: new Date().toISOString(),
    author: note.author,
    authorRole: note.authorRole,
    body: note.body,
    kind: note.kind ?? 'team',
  })
}

export function visitNotesFor(
  visit: BoardVisit,
  notes: CareNoteEntry[],
  today = TODAY,
  now = NOW,
): VisitNote[] {
  const out: VisitNote[] = notes.map((note) => ({
    id: `note-${note.id}`,
    kind: kindOf(note, visit),
    at: note.at,
    isInstant: true,
    author: note.author,
    authorRole: note.authorRole,
    body: note.body,
    authored: true,
    category: note.category,
    categoryLabel: noteCategoryLabels[note.category],
    flagged: note.flagged,
    source: `${visit.recipientName}’s care notes`,
    outside: isOutside(note, visit),
  }))

  /*
   * The record's own entries, taken from the timeline rather than rebuilt.
   * Notes are dropped because they are already above — including them would
   * list every note twice, once as itself and once as a "record".
   */
  for (const entry of timelineFor(visit, notes, today, now)) {
    if (entry.source !== 'record' || entry.kind === 'note') continue
    out.push({
      id: entry.id,
      kind: 'record',
      at: entry.at,
      isInstant: false,
      // Nobody typed these, so there is no author. Naming the caregiver here
      // would attribute a generated line to a person.
      author: 'Visit record',
      authorRole:
        entry.kind === 'dose' ? 'Medication plan' : 'Clock time on the record',
      body: entry.detail ? `${entry.label}. ${entry.detail}` : entry.label,
      authored: false,
      source:
        entry.kind === 'dose'
          ? `${visit.recipientName}’s medication plan`
          : 'The visit record',
    })
  }

  for (const note of addedNotes) {
    if (note.visitId !== visit.id) continue
    out.push({
      id: note.id,
      kind: note.kind,
      at: note.at,
      isInstant: true,
      author: note.author,
      authorRole: note.authorRole,
      body: note.body,
      authored: true,
      source: 'Added on this visit',
    })
  }

  // Newest first, matching every other note list in the app. Record entries
  // carry a clock time only, so they are placed on the visit's own date. The
  // tiebreak is explicit rather than leaning on sort stability, so two entries
  // at the same minute do not depend on the order they were pushed.
  return out.sort(
    (a, b) =>
      instantOf(b, visit) - instantOf(a, visit) ||
      kindOrder[a.kind] - kindOrder[b.kind] ||
      a.id.localeCompare(b.id),
  )
}

/** On a tie, what a person wrote outranks what the record generated. */
const kindOrder: Record<VisitNoteKind, number> = {
  caregiver: 0,
  team: 1,
  family: 2,
  record: 3,
}

function instantOf(note: VisitNote, visit: BoardVisit): number {
  if (note.isInstant) return Date.parse(note.at)
  const at = Date.parse(`${visit.date}T${note.at}:00Z`)
  // An overnight block's early-hours entries belong to the following day.
  const start = Date.parse(`${visit.date}T${visit.start}:00Z`)
  return visit.overnight && at < start ? at + 24 * 60 * 60 * 1000 : at
}

/** Counts per kind, for the filter chips. */
export function countVisitNotes(
  notes: VisitNote[],
): Record<VisitNoteKind | 'all', number> {
  const counts = {
    all: notes.length,
    caregiver: 0,
    team: 0,
    family: 0,
    record: 0,
  }
  for (const note of notes) counts[note.kind] += 1
  return counts
}

export function filterVisitNotes(
  notes: VisitNote[],
  kind: VisitNoteKind | 'all',
): VisitNote[] {
  return kind === 'all' ? notes : notes.filter((n) => n.kind === kind)
}

/** The 24-hour clock time, whichever shape the entry stores. */
export function visitNoteTime(note: VisitNote): string {
  return note.isInstant ? note.at.slice(11, 16) : note.at
}
