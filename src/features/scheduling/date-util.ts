/**
 * Pure date helpers for the Scheduling screens, measured off the real wall
 * clock (the static board-data helpers are anchored to a fixed fixture date and
 * are kept only for the other features that still read the fixture).
 */

/** Today as an ISO date (YYYY-MM-DD), in UTC so it matches the backend dates. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Shift an ISO date by whole days. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The Monday that starts the week an ISO date falls in. */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const offset = (d.getUTCDay() + 6) % 7
  return addDays(iso, -offset)
}

/** The seven ISO dates of a Monday-anchored week. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

const timeLabel = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** A "HH:MM" clock to "8:00 AM". */
export function formatTime(clock: string): string {
  const [h, m] = clock.split(':').map(Number)
  const base = new Date(Date.UTC(2000, 0, 1, h, m))
  return timeLabel.format(base)
}

const fullDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** An ISO date to "Friday, July 24, 2026". */
export function formatFullDay(iso: string): string {
  return fullDay.format(new Date(`${iso}T00:00:00Z`))
}

const shortWeekday = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC',
})

/** An ISO date to "Mon". */
export function dayOf(iso: string): string {
  return shortWeekday.format(new Date(`${iso}T00:00:00Z`))
}

const weekRange = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** A Monday to "Jul 20 – Jul 26". */
export function formatWeekRange(monday: string): string {
  const sunday = addDays(monday, 6)
  return `${weekRange.format(new Date(`${monday}T00:00:00Z`))} – ${weekRange.format(new Date(`${sunday}T00:00:00Z`))}`
}

/** "HH:MM" to minutes from midnight. */
export function minutesOfClock(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}
