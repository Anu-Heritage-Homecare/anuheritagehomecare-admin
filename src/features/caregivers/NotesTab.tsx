import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Plus, Search } from 'lucide-react'
import type { StaffMember } from './staff'
import {
  useAddCaregiverNote,
  useCaregiverNotes,
  type NoteEntryDto,
  type NoteType,
  type NoteWriteKind,
} from './useCaregiverNotes'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { SelectBox } from '@/components/ui/SelectBox'
import { SIGNED_IN } from '@/lib/session'
import { tonePill } from '@/lib/tone'
import type { Tone } from '@/types'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 10

const TYPES: { value: NoteType; label: string }[] = [
  { value: 'VISIT', label: 'Visit' },
  { value: 'SUPERVISOR', label: 'Supervision' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'TRAINING', label: 'Training' },
]

const WRITE_KINDS: { value: NoteWriteKind; label: string }[] = [
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'SUPERVISOR', label: 'Supervision' },
  { value: 'TRAINING', label: 'Training' },
]

const TYPE_TONES: Record<string, Tone> = {
  VISIT: 'blue',
  SUPERVISOR: 'purple',
  INTERNAL: 'slate',
  TRAINING: 'green',
}

function isType(value: string | null): value is NoteType {
  return TYPES.some((t) => t.value === value)
}

const noteDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
function formatNoteDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : noteDate.format(date)
}

export function NotesTab({ member }: { member: StaffMember }) {
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)

  const rawType = params.get('kind')
  const type = isType(rawType) ? rawType : undefined
  const search = params.get('note') ?? ''
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)

  const { data, isPending, isError, error, refetch } = useCaregiverNotes(member.id, {
    type,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Any filter change resets paging.
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'note' })
  }

  const filtering = Boolean(type) || search !== ''

  return (
    <div className="space-y-4">
      <section aria-labelledby="notes-totals">
        <h2 id="notes-totals" className="sr-only">
          Notes totals
        </h2>
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
          <Stat label="Notes on file" value={data?.counts.total ?? 0} hint="Across the whole file" />
          <Stat label="This month" value={data?.counts.thisMonth ?? 0} hint="Added this month" />
          <Stat
            label="Internal"
            value={data?.counts.internal ?? 0}
            hint="Not shared with families"
          />
        </dl>
      </section>

      <div className="card space-y-3 p-4">
        <div
          role="group"
          aria-label="Filter by type"
          className="no-scrollbar flex gap-1.5 overflow-x-auto"
        >
          <Chip label="All" active={!type} onClick={() => setFilter('kind', null)} />
          {TYPES.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              active={type === t.value}
              onClick={() => setFilter('kind', t.value)}
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
              value={search}
              onChange={(e) => setFilter('note', e.target.value || null)}
              placeholder="Text, author or client"
              className={cn(fieldControl, 'pr-3 pl-9')}
            />
          </label>
          {filtering && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const key of ['kind', 'note', 'page']) next.delete(key)
                setParams(next)
              }}
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

        {data && (
          <p className="text-ink-subtle text-xs" role="status" aria-live="polite">
            Showing {data.notes.rows.length} of {data.notes.total}
            {filtering ? ' matching' : ' on file'}.
          </p>
        )}
      </div>

      <Drawer open={adding} onClose={() => setAdding(false)} title="Add note" placement="center">
        <AddStaffNoteForm member={member} onDone={() => setAdding(false)} />
      </Drawer>

      <section aria-labelledby="notes-list">
        <h2 id="notes-list" className="sr-only">
          Notes on file
        </h2>
        {isPending ? (
          <p
            className="text-ink-subtle card flex items-center justify-center gap-2 p-10 text-center text-sm"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            Loading notes…
          </p>
        ) : isError ? (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-ink text-sm font-medium">Could not load notes.</p>
            <p className="text-ink-subtle text-sm">{error.message}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data.notes.rows.length === 0 ? (
          <p className="text-ink-subtle card p-10 text-center text-sm">
            {filtering ? 'No notes match those filters.' : `Nothing is on ${member.name}'s file yet.`}
          </p>
        ) : (
          <ul aria-label="Notes on file" className="space-y-3">
            {data.notes.rows.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </ul>
        )}
      </section>

      {data && data.notes.total > page * PAGE_SIZE && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setFilter('page', String(page + 1))}
            className="border-line text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Next page
          </button>
        </div>
      )}
    </div>
  )
}

/* --------------------------------- pieces ---------------------------------- */

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card p-4">
      <dt className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">{label}</dt>
      <dd className="text-ink mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</dd>
      <dd className="text-ink-subtle mt-1 text-xs break-words">{hint}</dd>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
    </button>
  )
}

function NoteCard({ note }: { note: NoteEntryDto }) {
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={note.authorName} decorative className="size-8" />
          <div className="min-w-0">
            <p className="text-ink text-sm font-semibold break-words">
              {note.authorName}
              {note.bySelf && (
                <span className="text-ink-subtle ml-2 text-xs font-normal">own note</span>
              )}
            </p>
            {note.authorRole && (
              <p className="text-ink-subtle text-xs break-words">{note.authorRole}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
              tonePill[TYPE_TONES[note.type] ?? 'slate'],
            )}
          >
            {note.typeLabel}
          </span>
          <span className="text-ink-subtle text-xs whitespace-nowrap">
            {formatNoteDate(note.date)}
          </span>
        </div>
      </div>

      <p className="text-ink-muted mt-2.5 text-sm break-words">{note.text}</p>
    </li>
  )
}

function AddStaffNoteForm({ member, onDone }: { member: StaffMember; onDone: () => void }) {
  const [kind, setKind] = useState<NoteWriteKind>('INTERNAL')
  const [body, setBody] = useState('')
  const addNote = useAddCaregiverNote(member.id)
  const valid = body.trim() !== ''

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || addNote.isPending) return
        addNote.mutate(
          { body: body.trim(), kind },
          {
            onSuccess: () => onDone(),
          },
        )
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">Note type</span>
        <SelectBox
          value={kind}
          onChange={(e) => setKind(e.target.value as NoteWriteKind)}
          className={cn(fieldControl, 'mt-1.5')}
        >
          {WRITE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </SelectBox>
      </label>
      <label className="block">
        <span className="text-ink text-sm font-medium">Note</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`A note on ${member.name}'s file`}
          className={cn(fieldControl, 'mt-1.5 h-auto py-2')}
        />
      </label>
      {addNote.isError && (
        <p className="text-sm text-red-700">{addNote.error.message}</p>
      )}
      <p className="text-ink-subtle text-xs">Filed as {SIGNED_IN}.</p>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid || addNote.isPending}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          {addNote.isPending ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </form>
  )
}
