/**
 * Change notification for the receivables book. Raising an invoice or
 * recording a payment writes to `ledger` and `transactions` in place; screens
 * that read them call `useBook()` so they re-render when that happens.
 */
import { useSyncExternalStore } from 'react'

let version = 0
const listeners = new Set<() => void>()

export function bookChanged(): void {
  version += 1
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBook(): number {
  return useSyncExternalStore(subscribe, () => version, () => version)
}
