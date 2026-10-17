import { useSyncExternalStore } from 'react'
import { SIGNED_IN, SIGNED_IN_ROLE } from '@/lib/session'
import { NOW, TODAY } from '@/lib/today'

export type NoteCategory = 'Follow-up' | 'Invoice audit' | 'Dispute' | 'General'

export const noteCategories: NoteCategory[] = ['Follow-up', 'Invoice audit', 'Dispute', 'General']

export interface InvoiceNote {
  id: string
  invoice: string
  author: string
  role: string
  category: NoteCategory
  /** ISO timestamp. Fixtures carry a date only and are stamped at midnight. */
  at: string
  body: string
}

/*
 * Each fixture sits beside something that happened in the book or on file:
 * a reminder date, the Musa dispute letter, the MedCare split. None invents
 * an event the ledger does not have.
 */
const fixtures: InvoiceNote[] = [
  {
    id: 'n1',
    invoice: 'INV-2026-159',
    author: 'Sarah Jenkins',
    role: 'Operations Manager',
    category: 'Follow-up',
    at: '2026-07-21T00:00:00Z',
    body: 'Reminder sent for INV-2026-159. Bello Trust has five invoices open back to April; payment plan letter issued the same day and filed on the account.',
  },
  {
    id: 'n2',
    invoice: 'INV-2026-143',
    author: 'Sarah Jenkins',
    role: 'Operations Manager',
    category: 'Dispute',
    at: '2026-06-02T00:00:00Z',
    body: 'Mr. Musa disputes the visit count for 1–15 May. Invoice held until the visit log is checked; dispute letter filed on the account.',
  },
  {
    id: 'n3',
    invoice: 'INV-2026-089',
    author: 'Sarah Jenkins',
    role: 'Operations Manager',
    category: 'Invoice audit',
    at: '2026-07-16T00:00:00Z',
    body: '80% claimed from MedCare Plus under MC-789456. Family share of ₦1,200 due 1 Aug on the Visa ending 4521 (auto-pay).',
  },
  {
    id: 'n4',
    invoice: 'INV-2026-160',
    author: 'Sarah Jenkins',
    role: 'Operations Manager',
    category: 'Follow-up',
    at: '2026-07-23T00:00:00Z',
    body: 'Reminder sent. Mrs. Eze asked for the invoice to be re-sent to her new email; contact details still to be updated.',
  },
]

const written: InvoiceNote[] = []
let version = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Re-renders the caller whenever a note is added. */
export function useInvoiceNotes(invoice: string): InvoiceNote[] {
  useSyncExternalStore(subscribe, () => version, () => version)
  return [...written, ...fixtures]
    .filter((n) => n.invoice === invoice)
    .sort((a, b) => b.at.localeCompare(a.at))
}

/**
 * In memory only — there is no backend. Written as the signed-in user, off the
 * sample clock, so a new note sorts where the rest of the app says "now" is.
 */
export function addInvoiceNote(invoice: string, category: NoteCategory, body: string): void {
  written.push({
    id: `w${written.length + 1}`,
    invoice,
    author: SIGNED_IN,
    role: SIGNED_IN_ROLE,
    category,
    at: `${TODAY}T${NOW}:00Z`,
    body: body.trim(),
  })
  version += 1
  listeners.forEach((l) => l())
}
