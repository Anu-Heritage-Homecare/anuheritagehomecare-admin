/**
 * The parts of the file screens that are not components: a size in words, what
 * kind of file it is, and everything the preview says about where one came
 * from.
 */
import { SIGNED_IN_ROLE } from '@/lib/session'
import { formatClock, threadContext } from './data'
import type { Message, Thread } from './data'

/** "24 KB" — enough to tell a photo from a form before opening it. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function isImage(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|svg|avif)$/i.test(name)
}

export function isPdf(name: string): boolean {
  return /\.pdf$/i.test(name)
}

export interface FileContext {
  /** The message the file came on, so it can be taken off again. */
  messageId?: string
  uploadedBy: string
  /** "Caregiver", "Operations Manager" — how they appear on the record. */
  role: string | null
  /** Already formatted: "Jul 24, 2026, 2:39 PM". */
  uploadedAt: string
  visit: { id: string; reference: string } | null
}

const uploadedLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * Everything the preview says about a file, read off the message it came on
 * and the conversation it was sent in — the sender's standing, the day it
 * arrived, and the visit this conversation is about, where there is one.
 */
export function fileContextFor(thread: Thread, message: Message): FileContext {
  const outbound = message.direction === 'outbound'
  const day = uploadedLabel.format(new Date(`${message.at}T00:00:00Z`))
  const next = thread.about ? threadContext(thread.about.id)?.next : undefined

  return {
    // Only a message sent this session holds a file this app can take back.
    messageId: message.id,
    uploadedBy: message.author,
    role: outbound
      ? SIGNED_IN_ROLE
      : thread.kind === 'caregiver'
        ? 'Caregiver'
        : thread.role,
    uploadedAt: message.time ? `${day}, ${formatClock(message.time)}` : day,
    visit: next ? { id: next.id, reference: next.reference } : null,
  }
}
