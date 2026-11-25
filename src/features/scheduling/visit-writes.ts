import { useSyncExternalStore } from 'react'

/*
 * Everything the app writes against a visit this session — assignment,
 * reassignment, edits and cancellation — lives here, in one leaf module that
 * imports nothing from the board or the rota. The board and each caregiver's
 * own Schedule tab both read it, so a reassignment shows up on both sides at
 * once. Held in memory, like every store in this prototype; the backend will
 * replace it with real persistence.
 */

/** The fields a reassignment reads off a board visit. */
export interface ReassignableVisit {
  id: string
  caregiverId: string | null
  date: string
  start: string
  durationHours: number
  type: string
  recipientId: string
  recipientName: string
}

export interface VisitEdit {
  type?: string
  start?: string
  durationHours?: number
}

/** A visit reassigned from one caregiver to another this session. */
export interface VisitMove {
  /** The caregiver it moved to. */
  toCaregiverId: string
  /** The caregiver it moved from, so the losing rota can drop it. */
  fromCaregiverId: string
  /** A snapshot, so the gaining caregiver's tab can show it without the rota. */
  date: string
  start: string
  durationHours: number
  type: string
  recipientId: string
  recipientName: string
}

interface VisitWrites {
  /** For an unassigned slot: the caregiver it was given. */
  caregiverId?: string
  /** For an already-assigned visit: where it was moved. */
  move?: VisitMove
  cancelled?: { reason: string }
  edit?: VisitEdit
}

/** Keyed by the board visit id (an assigned slot) or the unassigned slot id. */
const visitWrites = new Map<string, VisitWrites>()

let revision = 0
const listeners = new Set<() => void>()

function commit(): void {
  revision += 1
  for (const l of listeners) l()
}

/** Re-render a screen after a visit is assigned, reassigned, edited or cancelled. */
export function useBoardRevision(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => revision,
    () => revision,
  )
}

/** Non-React subscribers (the board's memo cache) clear themselves on a write. */
export function onVisitWrite(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function writeTo(id: string, patch: VisitWrites): void {
  visitWrites.set(id, { ...visitWrites.get(id), ...patch })
  commit()
}

/**
 * Assign or reassign a caregiver. An unassigned slot (no caregiver yet) simply
 * gains one. An already-assigned visit records a move, so the losing
 * caregiver's schedule drops it and the gaining caregiver's picks it up.
 */
export function assignVisitCaregiver(visit: ReassignableVisit, caregiverId: string): void {
  if (visit.caregiverId && visit.caregiverId !== caregiverId) {
    writeTo(visit.id, {
      move: {
        toCaregiverId: caregiverId,
        fromCaregiverId: visit.caregiverId,
        date: visit.date,
        start: visit.start,
        durationHours: visit.durationHours,
        type: visit.type,
        recipientId: visit.recipientId,
        recipientName: visit.recipientName,
      },
    })
  } else {
    writeTo(visit.id, { caregiverId })
  }
}

/** The caregiver an unassigned slot was given, if any. */
export function assignedCaregiverId(visitId: string): string | undefined {
  return visitWrites.get(visitId)?.caregiverId
}

/** Where a board visit was reassigned to, if at all. */
export function visitMove(visitId: string): VisitMove | undefined {
  return visitWrites.get(visitId)?.move
}

/** Every reassignment recorded this session. */
export function visitMoves(): { visitId: string; move: VisitMove }[] {
  const out: { visitId: string; move: VisitMove }[] = []
  for (const [visitId, w] of visitWrites) if (w.move) out.push({ visitId, move: w.move })
  return out
}

export function cancelVisit(visitId: string, reason: string): void {
  writeTo(visitId, { cancelled: { reason } })
}
export function isVisitCancelled(visitId: string): boolean {
  return Boolean(visitWrites.get(visitId)?.cancelled)
}
export function visitCancelReason(visitId: string): string | undefined {
  return visitWrites.get(visitId)?.cancelled?.reason
}

export function editVisit(visitId: string, edit: VisitEdit): void {
  writeTo(visitId, { edit: { ...visitWrites.get(visitId)?.edit, ...edit } })
}
export function visitEdit(visitId: string): VisitEdit | undefined {
  return visitWrites.get(visitId)?.edit
}
