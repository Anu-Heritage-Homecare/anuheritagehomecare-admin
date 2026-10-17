/**
 * What has been opened this session.
 *
 * "Unread" needs somebody to have recorded a read, and until now nothing did —
 * which is why the rail counted replies owed instead. This records it: opening
 * a thread or a notice marks it, and everything starts unread because nothing
 * has been opened yet. Held in memory like the rest of what this app writes, so
 * a reload makes the inbox new again.
 */
import { useSyncExternalStore } from 'react'

const opened = new Set<string>()
let revision = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useReadState(): number {
  return useSyncExternalStore(
    subscribe,
    () => revision,
    () => revision,
  )
}

export function isRead(id: string): boolean {
  return opened.has(id)
}

export function markRead(id: string): void {
  if (opened.has(id)) return
  opened.add(id)
  revision += 1
  for (const listener of listeners) listener()
}
