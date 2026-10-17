/**
 * Per-thread flags a coordinator sets: archived, muted, and left.
 *
 * Archived takes a conversation out of the folders without deleting anything —
 * the thread is still there on its own URL, and the details panel offers it
 * back. Muted leaves it in the folders but keeps it out of the Unread count,
 * for a thread somebody is working through and does not want chased about.
 *
 * Leaving is the stronger one: the coordinator comes off the conversation, so
 * it goes out of the folders and the composer goes with it. Nothing is sent to
 * the other side — there is no membership service here to tell — and the thread
 * can be rejoined from its own link, which is why leaving is a flag rather than
 * a deletion.
 *
 * Held in memory for the session, like everything else this app writes.
 */
import { useSyncExternalStore } from 'react'

const archived = new Set<string>()
const muted = new Set<string>()
const left = new Set<string>()
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

export function useThreadFlags(): number {
  return useSyncExternalStore(
    subscribe,
    () => revision,
    () => revision,
  )
}

export function isArchived(id: string): boolean {
  return archived.has(id)
}

export function isMuted(id: string): boolean {
  return muted.has(id)
}

export function setArchived(id: string, value: boolean): void {
  if (value) archived.add(id)
  else archived.delete(id)
  emit()
}

export function setMuted(id: string, value: boolean): void {
  if (value) muted.add(id)
  else muted.delete(id)
  emit()
}

export function hasLeft(id: string): boolean {
  return left.has(id)
}

export function setLeft(id: string, value: boolean): void {
  if (value) left.add(id)
  else left.delete(id)
  emit()
}
