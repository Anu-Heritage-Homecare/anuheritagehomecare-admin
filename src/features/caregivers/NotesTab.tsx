import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus, Search, TriangleAlert } from 'lucide-react'
import {
  NOTES_PAGE_SIZE,
  TODAY,
  applyQuery,
  countNotes,
  formatNoteDay,
  formatNoteTime,
  hasClock,
  noteKindLabels,
  noteKindTones,
  noteKinds,
  addStaffNote,
  notesFor,
  rangeOptions,
  rangeStart,
} from './staff-notes-data'
import type { NoteRange, StaffNote, StaffNoteKind } from './staff-notes-data'
import type { StaffMember } from './roster-data'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { SelectBox } from '@/components/ui/SelectBox'
import { SIGNED_IN } from '@/lib/session'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { tonePill } from '@/lib/tone'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'

function isKind(v: string): v is StaffNoteKind {
  return noteKinds.some((k) => k.value === v)
}

function isRange(v: string): v is NoteRange {
  return rangeOptions.some((o) => o.value === v)
}

export function NotesTab({
  member,
  suffix = '',
}: {
  member: StaffMember
  /** Roster filters, carried onward so "Back to the roster" still works. */
  suffix?: string
}) {
  const [params, setParams] = useSearchParams()
  const [shown, setShown] = useState(NOTES_PAGE_SIZE)
  const [adding, setAdding] = useState(false)
  const [rev, setRev] = useState(0)

  const rawKind = params.get('kind') ?? 'all'
  const rawRange = params.get('range') ?? 'all'
  const search = params.get('note') ?? ''

  const query = useMemo(
    () => ({
      // Anything unrecognised in the URL falls back rather than filtering the
      // list to nothing.
      kind: (isKind(rawKind) ? rawKind : 'all') as StaffNoteKind | 'all',
      range: (isRange(rawRange) ? rawRange : 'all') as NoteRange,
      search,
    }),
    [rawKind, rawRange, search],
  )

  // `rev` bumps after a note is added, to recompute the list.
  const all = useMemo(() => (void rev, notesFor(member)), [member, rev])
  const filtered = useMemo(() => applyQuery(all, query), [all, query])
  // Chip counts are of everything the *other* filters leave, so a chip is
  // never a non-zero number above a list it would empty.
  const beforeKind = useMemo(
    () => applyQuery(all, { ...query, kind: 'all' as const }),
    [all, query],
  )
  const chipCounts = useMemo(() => countNotes(beforeKind), [beforeKind])
  const totals = useMemo(() => countNotes(all), [all])
  const visible = filtered.slice(0, shown)

  /** For the selects and chips, where 'all' is the reset value. */
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    // Pushed, not replaced: Back should undo a chip.
    setParams(next)
    setShown(NOTES_PAGE_SIZE)
  }

  /** Free text, where "all" is a search term and not a sentinel. */
  const setSearch = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === '') next.delete('note')
    else next.set('note', value)
    setParams(next, { replace: true })
    setShown(NOTES_PAGE_SIZE)
  }

  const clearFilters = () => {
    // Only this tab's own keys — wiping the lot took the roster's q/sort/page
    // and the Schedule tab's week with it.
    const next = new URLSearchParams(params)
    for (const key of ['kind', 'range', 'note']) next.delete(key)
    setParams(next)
    setShown(NOTES_PAGE_SIZE)
  }

  const filtering =
    query.kind !== 'all' || query.range !== 'all' || query.search !== ''

  if (all.length === 0)
    return (
      <p className="text-ink-subtle max-w-2xl text-sm" role="status">
        Nothing is on {member.name}&rsquo;s file yet — no care notes, no
        supervision entries, no completed training and nothing on the staff
        file.
      </p>
    )

  return (
    <div className="space-y-4">
      {/* ------------------------------- totals ------------------------------ */}

      <section aria-labelledby="notes-totals">
        <h2 id="notes-totals" className="sr-only">
          Notes totals
        </h2>
        {/* Whole-file figures. The line under the filters counts what is on
            screen; these deliberately do not move when a filter is applied,
            and say so. */}
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Notes on file"
            value={totals.total}
            hint="Across the whole file"
          />
          <Stat
            label="This month"
            value={totals.thisMonth}
            hint={`Since ${formatNoteDay(`${TODAY.slice(0, 7)}-01T12:00:00Z`)}`}
          />
          <Stat
            label={`Written by ${member.name.split(' ')[0]}`}
            value={totals.own}
            hint={
              totals.own < totals.total
                ? 'The rest are about them'
                : 'Everything on the file'
            }
          />
          <Stat
            label="Internal"
            value={totals.byKind.internal}
            hint="Not shared with families"
          />
        </dl>
      </section>

      {/* ------------------------------ filters ------------------------------ */}

      <div className="card space-y-3 p-4">
        <div
          role="group"
          aria-label="Filter by kind"
          className="no-scrollbar flex gap-1.5 overflow-x-auto"
        >
          <Chip
            label="All"
            count={beforeKind.length}
            active={query.kind === 'all'}
            onClick={() => setFilter('kind', 'all')}
          />
          {noteKinds.map((kind) => (
            <Chip
              key={kind.value}
              label={kind.label}
              count={chipCounts.byKind[kind.value]}
              active={query.kind === kind.value}
              onClick={() => setFilter('kind', kind.value)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 grow basis-56">
            <span className="sr-only">Search notes</span>
            <Search
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query.search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Text, author or client"
              className={cn(fieldControl, 'pr-3 pl-9')}
            />
          </label>
          <SelectFilter
            label="Period"
            value={query.range}
            onChange={(v) => setFilter('range', v)}
            options={rangeOptions.map((o) => ({ value: o.value, label: o.label }))}
          />
          {filtering && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-brand-700 hover:text-brand-800 inline-flex min-h-11 items-center px-1 text-sm font-medium"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="bg-brand-600 hover:bg-brand-700 ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Add note
          </button>
        </div>

        <p className="text-ink-subtle text-xs" role="status" aria-live="polite">
          Showing {visible.length} of {filtered.length}
          {filtering && ` matching, from ${all.length} on file`}
          {!filtering && ' on file'}
          {query.range !== 'all' &&
            ` · from ${formatNoteDay(`${rangeStart(query.range)}T12:00:00Z`)}`}
          .
        </p>
      </div>

      <Drawer open={adding} onClose={() => setAdding(false)} title="Add note" placement="center">
        <AddStaffNoteForm
          member={member}
          onDone={() => {
            setAdding(false)
            setRev((n) => n + 1)
          }}
        />
      </Drawer>

      {/* ------------------------------- entries ----------------------------- */}

      <section aria-labelledby="notes-list">
        <h2 id="notes-list" className="sr-only">
          Notes on file
        </h2>
        {filtered.length === 0 ? (
          <p className="text-ink-subtle card p-10 text-center text-sm">
            No notes match those filters.
          </p>
        ) : (
          <ul aria-label="Notes on file" className="space-y-3">
            {visible.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                member={member}
                suffix={suffix}
              />
            ))}
          </ul>
        )}
      </section>

      {visible.length < filtered.length && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + NOTES_PAGE_SIZE)}
            className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Show {Math.min(NOTES_PAGE_SIZE, filtered.length - visible.length)} more
            <span className="sr-only">
              {' '}
              of {filtered.length} notes
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

/* --------------------------------- pieces ---------------------------------- */

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="card p-4">
      <dt className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
        {label}
      </dt>
      <dd className="text-ink mt-2 text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </dd>
      <dd className="text-ink-subtle mt-1 text-xs break-words">{hint}</dd>
    </div>
  )
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-control text-ink-muted hover:text-ink',
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function NoteCard({
  note,
  member,
  suffix,
}: {
  note: StaffNote
  member: StaffMember
  suffix: string
}) {
  return (
    <li
      className={cn(
        'card p-4',
        // Icon and words too, not colour alone.
        note.flagged && 'border-red-200 bg-red-50/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* An entry generated from a record gets no avatar and no job
              title — nobody wrote it, and dressing it as a person's note
              attributed a colleague's words to a course completion. */}
          {note.authored && (
            <Avatar name={note.author} decorative className="size-8" />
          )}
          <div className="min-w-0">
            <p className="text-ink text-sm font-semibold break-words">
              {note.author}
              {/* Not "(Self)" — the reader is a coordinator looking at
                  somebody else's file, so "self" was never true from here. */}
              {note.own && (
                <span className="text-ink-subtle ml-2 text-xs font-normal">
                  own note
                </span>
              )}
            </p>
            <p className="text-ink-subtle text-xs break-words">
              {note.authorRole}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {note.flagged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-red-700">
              <TriangleAlert
                className="size-3"
                strokeWidth={2.6}
                aria-hidden="true"
              />
              Flagged for review
            </span>
          )}
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
              tonePill[noteKindTones[note.kind]],
            )}
          >
            {/* The care log's own category where there is one, so an incident
                does not read as a routine visit note. */}
            {note.categoryLabel ?? noteKindLabels[note.kind]}
          </span>
          {/* A review and a training record carry a date but no clock; showing
              one would be inventing it. */}
          <span className="text-ink-subtle text-xs whitespace-nowrap">
            {hasClock(note) ? formatNoteTime(note.at) : formatNoteDay(note.at)}
          </span>
        </div>
      </div>

      <p className="text-ink-muted mt-2.5 text-sm break-words">{note.body}</p>

      <p className="text-ink-subtle mt-2 flex flex-wrap items-center gap-x-1.5 text-xs">
        {note.recipientName && note.recipientId && (
          <>
            <Link
              to={`/care-recipients/${note.recipientId}`}
              className="text-brand-700 hover:text-brand-800 font-medium"
            >
              {note.recipientName}
            </Link>
            <span aria-hidden="true">·</span>
          </>
        )}
        {/* Says where the entry actually lives, so this tab reads as a view
            over other records rather than a second copy of them. */}
        {note.sourceTo ? (
          <Link
            to={
              // Roster filters travel with links that stay inside /caregivers.
              note.sourceTo.startsWith('/caregivers')
                ? `${note.sourceTo}${suffix}`
                : note.sourceTo
            }
            className="hover:text-ink inline-flex items-center gap-1"
          >
            {note.source}
            <ArrowRight className="size-3" strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">
              {' '}
              — open the record this note is kept on
            </span>
          </Link>
        ) : (
          <span>
            {note.source} — {member.name.split(' ')[0]}&rsquo;s record only
          </span>
        )}
      </p>
    </li>
  )
}

function AddStaffNoteForm({ member, onDone }: { member: StaffMember; onDone: () => void }) {
  const kinds = noteKinds.filter((k) => k.value !== 'training')
  const [kind, setKind] = useState<StaffNoteKind>('internal')
  const [body, setBody] = useState('')
  const valid = body.trim() !== ''
  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        addStaffNote(member, { author: SIGNED_IN, body: body.trim(), kind })
        onDone()
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">Note type</span>
        <SelectBox value={kind} onChange={(e) => setKind(e.target.value as StaffNoteKind)} className={cn(fieldControl, 'mt-1.5')}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </SelectBox>
      </label>
      <label className="block">
        <span className="text-ink text-sm font-medium">Note</span>
        <textarea
          rows={4}
          maxLength={500}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`A note on ${member.name}'s file`}
          className={cn(fieldControl, 'mt-1.5 h-auto py-2')}
        />
      </label>
      <p className="text-ink-subtle text-xs">Filed as {SIGNED_IN}.</p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
          Cancel
        </button>
        <button type="submit" disabled={!valid} className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white">
          Add note
        </button>
      </div>
    </form>
  )
}
